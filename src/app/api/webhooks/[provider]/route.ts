import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getIntegrationConfig } from '@/lib/integrations';
import { loadAutomations } from '@/lib/automations';
import { executeAutomation } from '@/lib/automation-executor';

// ── Types ────────────────────────────────────────────────────

interface WebhookEventLog {
  id: string;
  provider: string;
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

// ── Supported Providers ──────────────────────────────────────

const SUPPORTED_PROVIDERS = new Set(['n8n', 'zapier', 'power_automate', 'custom']);

// ── POST: Receive Generic Webhook ────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ provider: string }> }
): Promise<NextResponse> {
  const { provider } = await params;

  if (!SUPPORTED_PROVIDERS.has(provider)) {
    return NextResponse.json(
      { error: `Unsupported provider: ${provider}` },
      { status: 404 }
    );
  }

  // Verify provider is configured (except custom)
  if (provider !== 'custom') {
    const config = getIntegrationConfig(provider);
    if (!config) {
      return NextResponse.json(
        { error: `Provider ${provider} is not configured` },
        { status: 400 }
      );
    }
  }

  // Parse payload
  let payload: Record<string, unknown>;
  try {
    payload = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const eventType =
    (typeof payload.eventType === 'string' ? payload.eventType : '') ||
    (typeof payload.event === 'string' ? payload.event : '') ||
    'webhook_received';

  // Find automations with webhook triggers from this provider
  const automations = loadAutomations();
  const matching = automations.filter((a) => {
    if (!a.enabled) return false;
    // Match automations whose trigger references this provider
    const triggerEndpoint = a.trigger.config.endpoint ?? '';
    const triggerField = a.trigger.config.field ?? '';
    return (
      triggerEndpoint.toLowerCase().includes(provider) ||
      triggerField.toLowerCase().includes(provider) ||
      // Also match webhook actions that reference this provider
      a.actions.some(
        (act) =>
          act.type === 'webhook' &&
          (act.config.url ?? '').toLowerCase().includes(provider)
      )
    );
  });

  const triggered: string[] = [];
  for (const automation of matching) {
    try {
      await executeAutomation(automation);
      triggered.push(automation.id);
    } catch (err) {
      console.error(
        `[webhook/${provider}] Error executing automation ${automation.name}:`,
        err
      );
    }
  }

  // Log event
  const logEntry: WebhookEventLog = {
    id: `${provider}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    provider,
    eventType,
    receivedAt: new Date().toISOString(),
    payload,
    automationsTriggered: triggered,
  };
  appendEvent(logEntry);

  console.log(
    `[webhook/${provider}] ${eventType} — ${triggered.length} automations triggered`
  );

  return NextResponse.json({
    received: true,
    provider,
    eventType,
    automationsTriggered: triggered.length,
  });
}
