import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getApp } from '@/lib/integration/app-registry';

// Endpoint allowlist per app — only these paths can be proxied
const ALLOWED_ENDPOINTS: Record<string, readonly string[]> = {
  'delta-portal': [
    '/api/health',
    '/api/live/customers',
    '/api/live/invoices',
    '/api/live/revenue',
    '/api/live/ar/aging',
    '/api/live/pricing/rack',
    '/api/live/sites',
    '/api/live/tanks',
    '/api/live/equipment',
    '/api/live/financial/income-statement',
    '/api/live/crm/accounts',
  ],
  'equipment-tracker': [
    '/api/gateway/status',
    '/api/equipment',
    '/api/dashboard',
    '/api/analytics/utilization',
    '/api/alerts',
  ],
  'signal-map': [
    '/api/health',
  ],
};

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ app: string }> }
) {
  // Auth gate
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const { app: appId } = await params;
  const endpoint = request.nextUrl.searchParams.get('endpoint');

  if (!endpoint) {
    return NextResponse.json(
      { success: false, error: 'Missing endpoint query parameter' },
      { status: 400 }
    );
  }

  // Validate app exists
  const app = getApp(appId);
  if (!app) {
    return NextResponse.json(
      { success: false, error: `Unknown app: ${appId}` },
      { status: 404 }
    );
  }

  // Validate endpoint is allowlisted
  const allowed = ALLOWED_ENDPOINTS[appId] ?? [];
  if (!allowed.includes(endpoint)) {
    return NextResponse.json(
      { success: false, error: `Endpoint not allowed: ${endpoint}` },
      { status: 403 }
    );
  }

  // Proxy the request
  try {
    const targetUrl = `${app.url}${endpoint}`;
    const res = await fetch(targetUrl, {
      headers: {
        'x-api-key': process.env.GATEWAY_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(10000),
    });

    const data = await res.json();
    return NextResponse.json({ success: true, source: appId, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Proxy failed' },
      { status: 502 }
    );
  }
}
