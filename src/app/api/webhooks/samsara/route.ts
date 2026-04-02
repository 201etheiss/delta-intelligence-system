import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHmac } from 'crypto';
import { getIntegrationConfig } from '@/lib/integrations';
import { loadAutomations } from '@/lib/automations';
import { executeAutomation } from '@/lib/automation-executor';

// ── Types ────────────────────────────────────────────────────

interface SamsaraEvent {
  eventType: string;
  data: Record<string, unknown>;
  timestamp?: string;
}

interface WebhookEventLog {
  id: string;
  provider: 'samsara';
  eventType: string;
  receivedAt: string;
  payload: Record<string, unknown>;
  automationsTriggered: string[];
}

// ── Event Log Persistence ────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const EVENTS_PATH = join(DATA_DIR, 'webhook-events.json');
const MAX_EVENTS = 100;

function loadEvents(): WebhookEventLog[] {
  if (!existsSync(EVENTS_PATH)) return [];
  try {
    const raw = readFileSync(EVENTS_PATH, 'utf-8');
    return JSON.parse(raw) as WebhookEventLog[];
  } catch {
    return [];
  }
}

function appendEvent(event: WebhookEventLog): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
  const events = loadEvents();
  const updated = [...events, event].slice(-MAX_EVENTS);
  writeFileSync(EVENTS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}

// ── Signature Validation ─────────────────────────────────────

function verifySignature(
  body: string,
  signature: string | null,
  secret: string
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(body).digest('hex');
  return signature === expected || signature === `sha256=${expected}`;
}

// ── Samsara Event Types We Handle ────────────────────────────

const HANDLED_EVENTS = new Set([
  'geofence_entry',
  'geofence_exit',
  'harsh_event',
  'hos_violation',
  'vehicle_fault',
]);

// ── POST: Receive Samsara Webhook ────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const rawBody = await request.text();

  // Validate signature if configured
  const samsaraConfig = getIntegrationConfig('samsara_webhooks');
  if (samsaraConfig?.values.webhookSecret) {
    const signature = request.headers.get('x-samsara-signature')
      ?? request.headers.get('x-webhook-signature');
    if (!verifySignature(rawBody, signature, samsaraConfig.values.webhookSecret)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }
  }

  // Parse payload
  let event: SamsaraEvent;
  try {
    event = JSON.parse(rawBody) as SamsaraEvent;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType = event.eventType ?? 'unknown';

  // Find matching automations
  const automations = loadAutomations();
  const matching = automations.filter((a) => {
    if (!a.enabled) return false;
    if (a.trigger.type !== 'threshold') return false;
    // Match on endpoint containing samsara and field matching event type
    const endpoint = a.trigger.config.endpoint ?? '';
    const field = a.trigger.config.field ?? '';
    return (
      endpoint.toLowerCase().includes('samsara') ||
      field === eventType ||
      field === 'samsara_event'
    );
  });

  const triggered: string[] = [];
  for (const automation of matching) {
    try {
      await executeAutomation(automation);
      triggered.push(automation.id);
    } catch (err) {
      console.error(
        `[samsara-webhook] Error executing automation ${automation.name}:`,
        err
      );
    }
  }

  // Log event
  const logEntry: WebhookEventLog = {
    id: `samsara_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider: 'samsara',
    eventType,
    receivedAt: new Date().toISOString(),
    payload: event.data ?? {},
    automationsTriggered: triggered,
  };
  appendEvent(logEntry);

  const recognized = HANDLED_EVENTS.has(eventType);
  console.info(
    `[samsara-webhook] ${eventType} ${recognized ? '(handled)' : '(unrecognized)'} — ${triggered.length} automations triggered`
  );

  return NextResponse.json({
    received: true,
    eventType,
    recognized,
    automationsTriggered: triggered.length,
  });
}
