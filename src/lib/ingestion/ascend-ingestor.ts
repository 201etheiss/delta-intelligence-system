import { emitEvent } from '@/lib/events/event-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface IngestionConfig {
  tableName: string;
  eventType: string;
  query: string;
  idColumn: string;
  timestampColumn?: string;
  interval: number; // seconds
}

export interface IngestionStatus {
  tableName: string;
  eventType: string;
  interval: number;
  lastRunAt: string | null;
  lastRecordCount: number;
  lastError: string | null;
  running: boolean;
}

// ---------------------------------------------------------------------------
// Configs — key Ascend tables to ingest
// ---------------------------------------------------------------------------

export const INGESTION_CONFIGS: readonly IngestionConfig[] = [
  {
    tableName: 'APInvoice',
    eventType: 'ascend.ap_invoice_sync',
    query: "SELECT TOP 100 * FROM APInvoice ORDER BY Date_Last_Modified DESC",
    idColumn: 'Invoice_Number',
    timestampColumn: 'Date_Last_Modified',
    interval: 300,
  },
  {
    tableName: 'ARInvoice',
    eventType: 'ascend.ar_invoice_sync',
    query: "SELECT TOP 100 * FROM ARInvoice ORDER BY Date_Last_Modified DESC",
    idColumn: 'SysTrxNo',
    timestampColumn: 'Date_Last_Modified',
    interval: 300,
  },
  {
    tableName: 'Customer',
    eventType: 'ascend.customer_sync',
    query: "SELECT TOP 100 * FROM Customer ORDER BY Date_Last_Modified DESC",
    idColumn: 'Customer_ID',
    timestampColumn: 'Date_Last_Modified',
    interval: 600,
  },
  {
    tableName: 'JournalEntryHeader',
    eventType: 'ascend.journal_entry_sync',
    query: "SELECT TOP 50 * FROM JournalEntryHeader ORDER BY DateCreated DESC",
    idColumn: 'JournalEntryID',
    timestampColumn: 'DateCreated',
    interval: 300,
  },
  {
    tableName: 'vRackPrice',
    eventType: 'ascend.rack_price_sync',
    query: "SELECT TOP 50 * FROM vRackPrice ORDER BY PriceDate DESC",
    idColumn: 'Vendor_Name',
    timestampColumn: 'PriceDate',
    interval: 900,
  },
] as const;

// ---------------------------------------------------------------------------
// Internal state
// ---------------------------------------------------------------------------

interface InternalState {
  lastRunAt: string | null;
  lastRecordCount: number;
  lastError: string | null;
  timerId: ReturnType<typeof setInterval> | null;
}

const stateMap = new Map<string, InternalState>();

function getState(tableName: string): InternalState {
  const existing = stateMap.get(tableName);
  if (existing) return existing;
  const fresh: InternalState = {
    lastRunAt: null,
    lastRecordCount: 0,
    lastError: null,
    timerId: null,
  };
  stateMap.set(tableName, fresh);
  return fresh;
}

// ---------------------------------------------------------------------------
// Gateway call
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
// Core ingestion
// ---------------------------------------------------------------------------

export async function runIngestion(config: IngestionConfig): Promise<number> {
  const state = getState(config.tableName);

  try {
    const records = await queryAscend(config.query);

    // Fire-and-forget event emission for each record
    let emitted = 0;
    for (const record of records) {
      // We don't await — fire-and-forget per spec
      void emitEvent({
        type: config.eventType,
        tenant_id: 'delta360',
        version: 1,
        actor_id: 'ascend-ingestor',
        payload: {
          record,
          tableName: config.tableName,
          idValue: record[config.idColumn] ?? null,
        },
        metadata: {
          source: 'ascend-ingestion',
          timestampColumn: config.timestampColumn ?? null,
        },
      });
      emitted += 1;
    }

    state.lastRunAt = new Date().toISOString();
    state.lastRecordCount = emitted;
    state.lastError = null;

    return emitted;
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    state.lastRunAt = new Date().toISOString();
    state.lastRecordCount = 0;
    state.lastError = msg;
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Polling loop
// ---------------------------------------------------------------------------

let loopActive = false;

export function startIngestionLoop(): void {
  if (loopActive) return;
  loopActive = true;

  for (const config of INGESTION_CONFIGS) {
    const state = getState(config.tableName);

    // Clear any stale timer
    if (state.timerId !== null) {
      clearInterval(state.timerId);
    }

    // Run immediately, then on interval
    void runIngestion(config).catch(() => {
      /* errors captured in state */
    });

    state.timerId = setInterval(() => {
      void runIngestion(config).catch(() => {
        /* errors captured in state */
      });
    }, config.interval * 1000);
  }
}

export function stopIngestionLoop(): void {
  loopActive = false;

  for (const config of INGESTION_CONFIGS) {
    const state = getState(config.tableName);
    if (state.timerId !== null) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }
}

export function isLoopActive(): boolean {
  return loopActive;
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

export function getIngestionStatus(): IngestionStatus[] {
  return INGESTION_CONFIGS.map((config) => {
    const state = getState(config.tableName);
    return {
      tableName: config.tableName,
      eventType: config.eventType,
      interval: config.interval,
      lastRunAt: state.lastRunAt,
      lastRecordCount: state.lastRecordCount,
      lastError: state.lastError,
      running: state.timerId !== null,
    };
  });
}
