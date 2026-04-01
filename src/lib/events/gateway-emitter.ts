import { emitEvent } from './event-store';

const GATEWAY_URL = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const GATEWAY_KEY = process.env.GATEWAY_ADMIN_KEY ?? '';

export interface GatewayFetchWithEventOptions {
  service: string;
  endpoint: string;
  method: string;
  body?: unknown;
  actorId?: string;
  apiKey?: string;
}

/**
 * Wrap a gateway fetch to emit an event after completion.
 * Event emission is fire-and-forget — it never blocks or fails the caller.
 */
export async function gatewayFetchWithEvent(
  options: GatewayFetchWithEventOptions
): Promise<Response> {
  const startTime = Date.now();
  const key = options.apiKey ?? GATEWAY_KEY;

  const fetchOptions: RequestInit = {
    method: options.method,
    headers: {
      'x-api-key': key,
      'Content-Type': 'application/json',
    },
  };

  if (options.body && options.method !== 'GET') {
    fetchOptions.body = JSON.stringify(options.body);
  }

  const url = `${GATEWAY_URL}/${options.service}${options.endpoint}`;
  const response = await fetch(url, fetchOptions);
  const duration = Date.now() - startTime;

  // Fire-and-forget: event emission must never block or throw to the caller
  emitEvent({
    type: `gateway.${options.service}_query`,
    tenant_id: 'delta360',
    version: 1,
    actor_id: options.actorId ?? 'system',
    payload: {
      service: options.service,
      endpoint: options.endpoint,
      method: options.method,
      status: response.status,
      duration_ms: duration,
    },
    metadata: {},
  }).catch(() => {});

  return response;
}
