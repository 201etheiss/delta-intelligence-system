import type { DomainEvent } from './event-schema';
import { replayEvents } from './event-store';

const SUPABASE_ANON_KEY = process.env.EVENT_STORE_SUPABASE_ANON_KEY ?? '';
const SUPABASE_REST_URL = process.env.EVENT_STORE_REST_URL ?? 'http://localhost:8000/rest/v1';

function headers(): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    Prefer: 'return=representation',
  };
}

function isAvailable(): boolean {
  return Boolean(SUPABASE_ANON_KEY);
}

export async function getConsumerOffset(groupName: string): Promise<number> {
  if (!isAvailable()) return 0;

  try {
    const params = new URLSearchParams();
    params.set('consumer_group', `eq.${groupName}`);
    params.set('select', 'last_sequence_number');
    params.set('limit', '1');

    const response = await fetch(`${SUPABASE_REST_URL}/consumer_offsets?${params.toString()}`, {
      headers: headers(),
    });

    if (!response.ok) return 0;

    const data = await response.json();
    const rows = Array.isArray(data) ? data : [];
    if (rows.length === 0) return 0;

    const row = rows[0] as { last_sequence_number?: number };
    return row?.last_sequence_number ?? 0;
  } catch {
    return 0;
  }
}

export async function saveConsumerOffset(groupName: string, sequenceNumber: number): Promise<void> {
  if (!isAvailable()) return;

  try {
    // Upsert: use Supabase's on-conflict merge via Prefer header
    await fetch(`${SUPABASE_REST_URL}/consumer_offsets`, {
      method: 'POST',
      headers: {
        ...headers(),
        Prefer: 'resolution=merge-duplicates,return=representation',
      },
      body: JSON.stringify({
        consumer_group: groupName,
        last_sequence_number: sequenceNumber,
        updated_at: new Date().toISOString(),
      }),
    });
  } catch {
    // Graceful degradation — offset save failure is non-fatal
    // Consumer will re-process from last known offset on next run
  }
}

export async function consumeEvents(
  groupName: string,
  handler: (event: DomainEvent) => Promise<void>
): Promise<void> {
  const lastOffset = await getConsumerOffset(groupName);

  const events = await replayEvents({ fromSequence: lastOffset });

  let latestSequence = lastOffset;

  for (const event of events) {
    await handler(event);
    if (event.sequence_number !== undefined && event.sequence_number > latestSequence) {
      latestSequence = event.sequence_number;
    }
  }

  if (latestSequence > lastOffset) {
    await saveConsumerOffset(groupName, latestSequence);
  }
}
