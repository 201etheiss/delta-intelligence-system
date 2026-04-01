import { type UserRole, getGatewayKey } from '@/lib/config/roles';

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';

interface GatewayResponse {
  success: boolean;
  source?: string;
  data?: unknown;
  error?: string;
  [key: string]: unknown;
}

export async function gatewayFetch(
  path: string,
  role: UserRole,
  options?: { method?: string; body?: unknown; timeout?: number }
): Promise<GatewayResponse> {
  const apiKey = getGatewayKey(role);
  if (!apiKey) {
    return { success: false, error: `No gateway key configured for role: ${role}` };
  }

  const method = options?.method ?? 'GET';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options?.timeout ?? 15000);

  try {
    const fetchOptions: RequestInit = {
      method,
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (options?.body && method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const url = `${GATEWAY_BASE}${path}`;
    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    return data as GatewayResponse;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { success: false, error: 'Gateway request timed out' };
    }
    return { success: false, error: error instanceof Error ? error.message : 'Gateway request failed' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function gatewayGet(path: string, role: UserRole): Promise<GatewayResponse> {
  return gatewayFetch(path, role);
}

export async function gatewayPost(path: string, role: UserRole, body: unknown): Promise<GatewayResponse> {
  return gatewayFetch(path, role, { method: 'POST', body });
}
