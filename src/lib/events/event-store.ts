import { EventSchema, type DomainEvent, type EmitEventInput, EmitEventSchema } from './event-schema';

const SUPABASE_URL = process.env.EVENT_STORE_SUPABASE_URL ?? 'http://localhost:5433';
const SUPABASE_ANON_KEY = process.env.EVENT_STORE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_REST_URL = process.env.EVENT_STORE_REST_URL ?? 'http://localhost:8000/rest/v1';

function isAvailable(): boolean {
  return Boolean(SUPABASE_ANON_KEY);
}

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'return=representation',
  };
}

async function supabaseRest(
  path: string,
  options?: { method?: string; body?: unknown; timeout?: number }
): Promise<{ ok: boolean; data: unknown; error?: string }> {
  if (!isAvailable()) {
    if (typeof globalThis.console !== 'undefined') {
      globalThis.console.warn('[EventStore] Supabase not configured — EVENT_STORE_SUPABASE_ANON_KEY missing. Degrading gracefully.');
    }
    return { ok: false, data: null, error: 'Event store not configured' };
  }

  const controller = new AbortController();
  const timeoutMs = options?.timeout ?? 10000;
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const url = `${SUPABASE_REST_URL}${path}`;
    const fetchOptions: RequestInit = {
      method: options?.method ?? 'GET',
      headers: headers(),
      signal: controller.signal,
    };

    if (options?.body && fetchOptions.method !== 'GET') {
      fetchOptions.body = JSON.stringify(options.body);
    }

    const response = await fetch(url, fetchOptions);
    const data = await response.json();

    if (!response.ok) {
      return { ok: false, data: null, error: typeof data === 'object' && data !== null && 'message' in data ? String(data.message) : 'Request failed' };
    }

    return { ok: true, data };
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      return { ok: false, data: null, error: 'Event store request timed out' };
    }
    return { ok: false, data: null, error: error instanceof Error ? error.message : 'Unknown error' };
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function emitEvent(input: EmitEventInput): Promise<DomainEvent | null> {
  const parsed = EmitEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(`Invalid event: ${parsed.error.issues.map((i) => i.message).join(', ')}`);
  }

  const result = await supabaseRest('/events', {
    method: 'POST',
    body: parsed.data,
  });

  if (!result.ok || !result.data) {
    if (typeof globalThis.console !== 'undefined') {
      globalThis.console.warn('[EventStore] Failed to emit event:', result.error);
    }
    return null;
  }

  const rows = Array.isArray(result.data) ? result.data : [result.data];
  const row = rows[0];
  if (!row) return null;

  const validated = EventSchema.safeParse(row);
  return validated.success ? validated.data : null;
}

export interface ReplayOptions {
  fromSequence?: number;
  type?: string;
  limit?: number;
}

export async function replayEvents(options: ReplayOptions = {}): Promise<DomainEvent[]> {
  const params = new URLSearchParams();
  params.set('order', 'sequence_number.asc');

  if (options.fromSequence !== undefined) {
    params.set('sequence_number', `gt.${options.fromSequence}`);
  }
  if (options.type) {
    params.set('type', `eq.${options.type}`);
  }
  if (options.limit) {
    params.set('limit', String(options.limit));
  }

  const result = await supabaseRest(`/events?${params.toString()}`);

  if (!result.ok || !Array.isArray(result.data)) {
    return [];
  }

  return (result.data as unknown[])
    .map((row) => EventSchema.safeParse(row))
    .filter((r) => r.success)
    .map((r) => r.data);
}

export async function getLatestSequence(): Promise<number> {
  const params = new URLSearchParams();
  params.set('select', 'sequence_number');
  params.set('order', 'sequence_number.desc');
  params.set('limit', '1');

  const result = await supabaseRest(`/events?${params.toString()}`);

  if (!result.ok || !Array.isArray(result.data) || result.data.length === 0) {
    return 0;
  }

  const row = result.data[0] as { sequence_number?: number };
  return row?.sequence_number ?? 0;
}
