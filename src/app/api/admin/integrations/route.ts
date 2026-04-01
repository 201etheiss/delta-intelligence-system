import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  INTEGRATIONS,
  getAllIntegrationsWithStatus,
  getIntegrationConfig,
  upsertIntegrationConfig,
} from '@/lib/integrations';
import { notify } from '@/lib/notifications';

// ── Auth Guard ───────────────────────────────────────────────

async function requireAdmin(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = getUserRole(session.user.email);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

// ── GET: List all integrations with config status ────────────

export async function GET(): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const integrations = getAllIntegrationsWithStatus();
  return NextResponse.json({ integrations });
}

// ── PATCH: Update integration config ─────────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';
    const values = body.values as Record<string, string> | undefined;

    if (!id) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 });
    }

    const integration = INTEGRATIONS.find((i) => i.id === id);
    if (!integration) {
      return NextResponse.json({ error: `Unknown integration: ${id}` }, { status: 404 });
    }

    if (!values || typeof values !== 'object') {
      return NextResponse.json({ error: 'values object is required' }, { status: 400 });
    }

    // Validate required fields
    const missing = integration.configFields
      .filter((f) => f.required)
      .filter((f) => !values[f.key] || values[f.key].trim() === '');

    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.map((f) => f.label).join(', ')}` },
        { status: 400 }
      );
    }

    const config = upsertIntegrationConfig(id, values);
    return NextResponse.json({ success: true, config });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// ── POST: Test an integration ────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  try {
    const body = await request.json();
    const id = typeof body.id === 'string' ? body.id : '';

    if (!id) {
      return NextResponse.json({ error: 'Integration ID is required' }, { status: 400 });
    }

    const integration = INTEGRATIONS.find((i) => i.id === id);
    if (!integration) {
      return NextResponse.json({ error: `Unknown integration: ${id}` }, { status: 404 });
    }

    const config = getIntegrationConfig(id);
    if (!config) {
      return NextResponse.json(
        { error: 'Integration not configured. Save config first.' },
        { status: 400 }
      );
    }

    const testMessage = `Test from Delta Intelligence at ${new Date().toISOString()}`;

    // Route test by integration type
    switch (id) {
      case 'teams': {
        const result = await notify({
          channel: 'teams',
          to: '',
          subject: 'Integration Test',
          body: testMessage,
        });
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'slack': {
        const result = await notify({
          channel: 'slack',
          to: '',
          subject: 'Integration Test',
          body: testMessage,
        });
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'resend': {
        const result = await notify({
          channel: 'email',
          to: 'test@delta360.energy',
          subject: 'Delta Intelligence — Integration Test',
          body: testMessage,
        });
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'twilio': {
        const result = await notify({
          channel: 'sms',
          to: config.values.fromNumber ?? '+10000000000',
          body: testMessage,
        });
        return NextResponse.json({ success: result.success, error: result.error });
      }

      case 'n8n':
      case 'zapier':
      case 'power_automate': {
        const url =
          config.values.webhookBaseUrl ??
          config.values.webhookUrl ??
          config.values.flowTriggerUrl ??
          '';
        if (!url) {
          return NextResponse.json({ success: false, error: 'No webhook URL configured' });
        }
        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              test: true,
              source: 'delta-intelligence',
              timestamp: new Date().toISOString(),
            }),
          });
          return NextResponse.json({
            success: resp.ok,
            error: resp.ok ? undefined : `Webhook returned ${resp.status}`,
          });
        } catch (err) {
          return NextResponse.json({
            success: false,
            error: err instanceof Error ? err.message : 'Webhook request failed',
          });
        }
      }

      case 'samsara_webhooks': {
        // Samsara webhooks are inbound — we can only verify the secret is set
        return NextResponse.json({
          success: true,
          message: 'Samsara webhook secret is configured. Waiting for inbound events.',
        });
      }

      default:
        return NextResponse.json({ error: `No test handler for ${id}` }, { status: 400 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
