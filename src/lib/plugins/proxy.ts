/**
 * Plugin Proxy — Unified execution layer for calling external plugin APIs.
 *
 * Handles:
 *   - Auth injection (api_key, bearer, oauth2, basic, none, session)
 *   - Timeout enforcement (default 30s)
 *   - Error normalization
 *   - Automatic call logging via the registry
 */

import { getPlugin, logPluginCall } from '@/lib/plugins/registry';
import type { PluginCallLog, PluginConfig } from '@/lib/plugins/types';

/** Default request timeout in milliseconds */
const DEFAULT_TIMEOUT_MS = 30_000;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ExecuteParams {
  /** URL path appended to the plugin's baseUrl (e.g. "/v1/images/generations") */
  path: string;
  /** HTTP method (default: GET) */
  method?: string;
  /** Request body — serialized as JSON when present */
  body?: unknown;
  /** Additional headers merged after auth headers */
  headers?: Record<string, string>;
  /** Override default timeout (ms) */
  timeoutMs?: number;
  /** Caller email for audit logging */
  userEmail?: string;
  /** Capability being invoked (for logging) */
  capability?: string;
  /** Brief request summary for the call log */
  requestSummary?: string;
}

export interface ExecuteResult {
  /** Whether the call completed with a 2xx status */
  success: boolean;
  /** Parsed response body (JSON when possible, raw text otherwise) */
  data?: unknown;
  /** Error message when success is false */
  error?: string;
  /** Actual round-trip latency in milliseconds */
  latencyMs: number;
}

// ---------------------------------------------------------------------------
// Auth injection
// ---------------------------------------------------------------------------

/**
 * Build the authorization header(s) for a plugin based on its authType.
 * Reads the credential from the environment variable specified in the config.
 */
function buildAuthHeaders(plugin: PluginConfig): Record<string, string> {
  const headerName = plugin.authHeader ?? 'Authorization';
  const credential = process.env[plugin.authEnvVar] ?? '';

  if (!credential && plugin.authType !== 'none') {
    // No credential available — return empty; the call will likely 401
    return {};
  }

  switch (plugin.authType) {
    case 'api_key':
      return { [headerName]: credential };
    case 'bearer':
    case 'oauth2':
      return { [headerName]: `Bearer ${credential}` };
    case 'basic':
      return { [headerName]: `Basic ${credential}` };
    case 'session':
      return { Cookie: credential };
    case 'none':
    default:
      return {};
  }
}

// ---------------------------------------------------------------------------
// Execution
// ---------------------------------------------------------------------------

/**
 * Execute an API call through a registered plugin.
 *
 * @param pluginId - ID of the plugin to call
 * @param params   - Request parameters (path, method, body, headers, etc.)
 * @returns ExecuteResult with success flag, data/error, and latency
 */
export async function executePlugin(
  pluginId: string,
  params: ExecuteParams,
): Promise<ExecuteResult> {
  const start = Date.now();

  const plugin = getPlugin(pluginId);
  if (!plugin) {
    return {
      success: false,
      error: `Plugin "${pluginId}" not found in registry`,
      latencyMs: Date.now() - start,
    };
  }

  if (plugin.status !== 'active' && plugin.status !== 'configured') {
    return {
      success: false,
      error: `Plugin "${pluginId}" is not active (status: ${plugin.status})`,
      latencyMs: Date.now() - start,
    };
  }

  const url = `${plugin.baseUrl.replace(/\/+$/, '')}${params.path}`;
  const method = (params.method ?? 'GET').toUpperCase();
  const timeoutMs = params.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  // Merge auth + caller headers
  const authHeaders = buildAuthHeaders(plugin);
  const mergedHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeaders,
    ...(params.headers ?? {}),
  };

  // Build fetch options
  const fetchOptions: RequestInit = {
    method,
    headers: mergedHeaders,
    signal: AbortSignal.timeout(timeoutMs),
  };

  if (params.body !== undefined && method !== 'GET' && method !== 'HEAD') {
    fetchOptions.body = JSON.stringify(params.body);
  }

  let responseStatus: 'success' | 'error' | 'timeout' | 'rate_limited' = 'error';
  let result: ExecuteResult;

  try {
    const response = await fetch(url, fetchOptions);
    const latencyMs = Date.now() - start;

    if (response.status === 429) {
      responseStatus = 'rate_limited';
      result = {
        success: false,
        error: `Rate limited by ${plugin.name} (HTTP 429)`,
        latencyMs,
      };
    } else if (response.ok) {
      responseStatus = 'success';
      const contentType = response.headers.get('content-type') ?? '';
      const data = contentType.includes('application/json')
        ? await response.json()
        : await response.text();

      result = { success: true, data, latencyMs };
    } else {
      responseStatus = 'error';
      const errorText = await response.text().catch(() => 'Unknown error');
      result = {
        success: false,
        error: `HTTP ${response.status}: ${errorText.slice(0, 500)}`,
        latencyMs,
      };
    }
  } catch (err: unknown) {
    const latencyMs = Date.now() - start;
    const isTimeout =
      err instanceof DOMException && err.name === 'TimeoutError';

    if (isTimeout) {
      responseStatus = 'timeout';
      result = {
        success: false,
        error: `Request to ${plugin.name} timed out after ${timeoutMs}ms`,
        latencyMs,
      };
    } else {
      responseStatus = 'error';
      const message = err instanceof Error ? err.message : String(err);
      result = {
        success: false,
        error: `Request to ${plugin.name} failed: ${message}`,
        latencyMs,
      };
    }
  }

  // Log the call
  const logEntry: PluginCallLog = {
    id: `log-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    pluginId,
    capability: (params.capability ?? 'unknown') as PluginCallLog['capability'],
    userEmail: params.userEmail ?? 'system',
    requestSummary: params.requestSummary ?? `${method} ${params.path}`,
    responseStatus,
    latencyMs: result.latencyMs,
    estimatedCost: plugin.costPerCall,
    timestamp: new Date().toISOString(),
  };

  logPluginCall(logEntry);

  return result;
}
