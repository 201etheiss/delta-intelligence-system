/**
 * Power Automate Webhook Connector — accepts webhook calls from
 * Power Automate flows and executes actions against the DI platform.
 *
 * Supported actions:
 *  - query_data: Run a gateway query and return results
 *  - send_report: Generate and email a report
 *  - create_sf_record: Create a Salesforce record via gateway
 *  - check_health: Return system health status
 *  - ask_di: Run a natural language query through the DI engine
 *
 * Auth: Shared secret via POWERAUTOMATE_WEBHOOK_SECRET env var.
 */

import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway';
import { logAudit } from '@/lib/audit-log';
import type { UserRole } from '@/lib/config/roles';

// ── Types ────────────────────────────────────────────────────

interface PowerAutomateRequest {
  action: string;
  params: Record<string, unknown>;
  secret: string;
  /** Optional: override the role used for gateway calls (default: admin) */
  role?: UserRole;
}

interface ActionResult {
  success: boolean;
  action: string;
  data?: unknown;
  error?: string;
}

// ── Action Handlers ──────────────────────────────────────────

async function handleQueryData(
  params: Record<string, unknown>,
  role: UserRole
): Promise<ActionResult> {
  const path = params.path as string | undefined;
  const method = (params.method as string) ?? 'GET';
  const body = params.body as Record<string, unknown> | undefined;

  if (!path) {
    return { success: false, action: 'query_data', error: 'Missing required param: path' };
  }

  const result = await gatewayFetch(path, role, {
    method,
    body,
  });

  return {
    success: true,
    action: 'query_data',
    data: result,
  };
}

async function handleSendReport(
  params: Record<string, unknown>,
  role: UserRole
): Promise<ActionResult> {
  const reportType = params.reportType as string | undefined;
  const recipients = params.recipients as string[] | undefined;

  if (!reportType || !recipients || recipients.length === 0) {
    return {
      success: false,
      action: 'send_report',
      error: 'Missing required params: reportType, recipients',
    };
  }

  // Trigger the report generation endpoint internally
  const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
  const response = await fetch(`${baseUrl}/api/reports/generate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: reportType,
      recipients,
      format: (params.format as string) ?? 'email',
      dateRange: params.dateRange ?? 'this_month',
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    return { success: false, action: 'send_report', error: `Report generation failed: ${errText}` };
  }

  const data = await response.json();
  return { success: true, action: 'send_report', data };
}

async function handleCreateSfRecord(
  params: Record<string, unknown>,
  role: UserRole
): Promise<ActionResult> {
  const object = params.object as string | undefined;
  const fields = params.fields as Record<string, unknown> | undefined;

  if (!object || !fields) {
    return {
      success: false,
      action: 'create_sf_record',
      error: 'Missing required params: object, fields',
    };
  }

  const result = await gatewayFetch('/salesforce/create', role, {
    method: 'POST',
    body: { object, fields },
  });

  return { success: true, action: 'create_sf_record', data: result };
}

async function handleCheckHealth(): Promise<ActionResult> {
  const checks: Record<string, unknown> = {
    status: 'operational',
    timestamp: new Date().toISOString(),
    services: {} as Record<string, string>,
  };

  // Check gateway connectivity
  try {
    const gatewayResult = await gatewayFetch('/health', 'admin', { timeout: 5000 });
    (checks.services as Record<string, string>).gateway = gatewayResult.success ? 'up' : 'degraded';
  } catch {
    (checks.services as Record<string, string>).gateway = 'down';
  }

  // Check Anthropic API
  (checks.services as Record<string, string>).ai = process.env.ANTHROPIC_API_KEY ? 'configured' : 'not_configured';

  // Check Teams bot
  (checks.services as Record<string, string>).teamsBot = process.env.TEAMS_BOT_APP_ID ? 'configured' : 'not_configured';

  return { success: true, action: 'check_health', data: checks };
}

// ── POST: Handle Power Automate Webhook ──────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  let body: PowerAutomateRequest;
  try {
    body = (await request.json()) as PowerAutomateRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Validate shared secret
  const expectedSecret = process.env.POWERAUTOMATE_WEBHOOK_SECRET;
  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'POWERAUTOMATE_WEBHOOK_SECRET not configured on the server' },
      { status: 503 }
    );
  }

  if (!body.secret || body.secret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!body.action) {
    return NextResponse.json({ error: 'Missing required field: action' }, { status: 400 });
  }

  const params = body.params ?? {};
  const role: UserRole = body.role ?? 'admin';

  // Audit log
  logAudit({
    userEmail: 'powerautomate',
    role,
    action: 'webhook',
    detail: `Action: ${body.action}`,
    tool: 'powerautomate',
    success: true,
  });

  let result: ActionResult;

  try {
    switch (body.action) {
      case 'query_data':
        result = await handleQueryData(params, role);
        break;

      case 'send_report':
        result = await handleSendReport(params, role);
        break;

      case 'create_sf_record':
        result = await handleCreateSfRecord(params, role);
        break;

      case 'check_health':
        result = await handleCheckHealth();
        break;

      default:
        result = {
          success: false,
          action: body.action,
          error: `Unknown action: ${body.action}. Supported: query_data, send_report, create_sf_record, check_health`,
        };
    }
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal error';
    console.error(`[powerautomate-webhook] Error in ${body.action}:`, errMsg);
    result = { success: false, action: body.action, error: errMsg };
  }

  const status = result.success ? 200 : (result.error?.includes('Missing') ? 400 : 500);
  return NextResponse.json(result, { status });
}
