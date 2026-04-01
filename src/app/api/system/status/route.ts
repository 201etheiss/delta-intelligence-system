import { NextResponse } from 'next/server';

// ── Constants ────────────────────────────────────────────────

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const GATEWAY_KEY = process.env.GATEWAY_ADMIN_KEY ?? '';

const SERVICE_CHECKS: ReadonlyArray<{ name: string; path: string }> = [
  { name: 'Ascend ERP', path: '/ascend/tables' },
  { name: 'Salesforce CRM', path: '/salesforce/accounts' },
  { name: 'Samsara Fleet', path: '/samsara/vehicles' },
  { name: 'Vroozi Procurement', path: '/vroozi/suppliers' },
  { name: 'Microsoft 365', path: '/microsoft/sites' },
  { name: 'Power BI', path: '/powerbi/workspaces' },
  { name: 'Paylocity HR', path: '/paylocity/employees' },
  { name: 'Fleet Panda', path: '/fleetpanda/assets' },
];

const ENGINE_NAMES: ReadonlyArray<string> = [
  'Financial Statements',
  'Journal Entry',
  'Close Management',
  'Reconciliation',
  'Cash Flow',
  'General Ledger',
  'AP Processing',
  'AR Collections',
  'Fixed Assets',
  'Inventory/Margin',
  'Tax',
  'Evidence Vault',
  'Audit Portal',
  'Budgeting',
  'Expense Management',
  'Contracts',
  'Commentary',
  'Data Bridge',
];

// ── Types ────────────────────────────────────────────────────

interface ServiceResult {
  name: string;
  status: 'connected' | 'error' | 'unknown';
  latencyMs: number;
  details?: string;
}

// ── Helpers ──────────────────────────────────────────────────

async function checkService(
  name: string,
  path: string
): Promise<ServiceResult> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(`${GATEWAY_BASE}${path}`, {
      method: 'GET',
      headers: {
        'x-api-key': GATEWAY_KEY,
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const latencyMs = Date.now() - start;

    if (res.ok) {
      return { name, status: 'connected', latencyMs };
    }

    return {
      name,
      status: 'error',
      latencyMs,
      details: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name,
      status: 'error',
      latencyMs: Date.now() - start,
      details: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ── Route Handler ────────────────────────────────────────────

export async function GET() {
  try {
    const settled = await Promise.allSettled(
      SERVICE_CHECKS.map((s) => checkService(s.name, s.path))
    );

    const services: ServiceResult[] = settled.map((s) =>
      s.status === 'fulfilled'
        ? s.value
        : { name: 'Unknown', status: 'error' as const, latencyMs: 0, details: 'Check failed' }
    );

    const connectedCount = services.filter((r) => r.status === 'connected').length;
    const totalCount = services.length;

    const overall: 'healthy' | 'degraded' | 'down' =
      connectedCount === totalCount
        ? 'healthy'
        : connectedCount > 0
          ? 'degraded'
          : 'down';

    return NextResponse.json({
      success: true,
      data: {
        overall,
        services,
        connectedCount,
        totalCount,
        engines: ENGINE_NAMES,
        engineCount: ENGINE_NAMES.length,
        pageCount: 48,
        apiRouteCount: 91,
        checkedAt: new Date().toISOString(),
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'System status check failed',
      },
      { status: 500 }
    );
  }
}
