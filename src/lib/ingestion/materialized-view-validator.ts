import { replayEvents } from '@/lib/events/event-store';
import { INGESTION_CONFIGS } from './ascend-ingestor';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ValidationResult {
  tableName: string;
  directQueryCount: number;
  eventReplayCount: number;
  match: boolean;
  missingInEvents: number;
  extraInEvents: number;
  timestamp: string;
}

// ---------------------------------------------------------------------------
// Gateway helper (duplicated to keep validator self-contained)
// ---------------------------------------------------------------------------

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const GATEWAY_ADMIN_KEY = process.env.GATEWAY_ADMIN_KEY ?? 'df360-admin-c67f1da4ddb3bb32aa4fde80';

async function queryAscend(query: string): Promise<Record<string, unknown>[]> {
  const response = await fetch(`${GATEWAY_BASE_URL}/ascend/query`, {
    method: 'POST',
    headers: {
      'x-api-key': GATEWAY_ADMIN_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown');
    throw new Error(`Gateway ${response.status}: ${text}`);
  }

  const body = (await response.json()) as { data?: unknown; rows?: unknown; results?: unknown };
  const rows = body.data ?? body.rows ?? body.results ?? body;

  if (!Array.isArray(rows)) {
    throw new Error('Unexpected gateway response shape — expected array');
  }

  return rows as Record<string, unknown>[];
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export async function validateTable(
  tableName: string,
  query: string,
  eventType: string
): Promise<ValidationResult> {
  // 1. Direct query to Ascend
  const directRecords = await queryAscend(query);
  const directCount = directRecords.length;

  // 2. Replay events from Event Store
  const events = await replayEvents({ type: eventType, limit: 10000 });

  // Deduplicate by most recent event per idValue
  const eventMap = new Map<string, unknown>();
  for (const evt of events) {
    const payload = evt.payload as { idValue?: unknown } | undefined;
    const key = String(payload?.idValue ?? evt.sequence_number);
    eventMap.set(key, evt);
  }
  const eventCount = eventMap.size;

  // 3. Compare counts
  const missing = Math.max(0, directCount - eventCount);
  const extra = Math.max(0, eventCount - directCount);

  return {
    tableName,
    directQueryCount: directCount,
    eventReplayCount: eventCount,
    match: directCount === eventCount && missing === 0 && extra === 0,
    missingInEvents: missing,
    extraInEvents: extra,
    timestamp: new Date().toISOString(),
  };
}

export async function validateAllTables(): Promise<ValidationResult[]> {
  const results: ValidationResult[] = [];

  for (const config of INGESTION_CONFIGS) {
    try {
      const result = await validateTable(config.tableName, config.query, config.eventType);
      results.push(result);
    } catch (err) {
      results.push({
        tableName: config.tableName,
        directQueryCount: -1,
        eventReplayCount: -1,
        match: false,
        missingInEvents: -1,
        extraInEvents: -1,
        timestamp: new Date().toISOString(),
      });
    }
  }

  return results;
}
