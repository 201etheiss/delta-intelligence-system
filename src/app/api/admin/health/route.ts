import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getErrorStats } from '@/lib/usage-logger';

interface ServiceCheck {
  name: string;
  status: 'connected' | 'error' | 'degraded';
  responseTime: number;
  lastChecked: string;
  error?: string;
}

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL ?? 'http://localhost:3847';
const GATEWAY_KEY = process.env.GATEWAY_ADMIN_KEY ?? '';

const SERVICES: { name: string; path: string }[] = [
  { name: 'Gateway Root', path: '/' },
  { name: 'Ascend (ERP)', path: '/ascend/tables' },
  { name: 'Salesforce (CRM)', path: '/salesforce/accounts' },
  { name: 'Samsara (Fleet)', path: '/samsara/vehicles' },
  { name: 'Power BI', path: '/powerbi/workspaces' },
  { name: 'Microsoft 365', path: '/microsoft/sites' },
  { name: 'Vroozi (Procurement)', path: '/vroozi/suppliers' },
  { name: 'Fleet Panda', path: '/fleetpanda/assets' },
];

async function checkService(service: { name: string; path: string }): Promise<ServiceCheck> {
  const start = Date.now();
  try {
    const url = `${GATEWAY_BASE}${service.path}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);

    const res = await fetch(url, {
      method: 'GET',
      headers: {
        'x-api-key': GATEWAY_KEY,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTime = Date.now() - start;

    if (res.ok) {
      return {
        name: service.name,
        status: responseTime > 5000 ? 'degraded' : 'connected',
        responseTime,
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: service.name,
      status: 'error',
      responseTime,
      lastChecked: new Date().toISOString(),
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      name: service.name,
      status: 'error',
      responseTime: Date.now() - start,
      lastChecked: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
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

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  const results = await Promise.all(SERVICES.map(checkService));

  const connected = results.filter((r) => r.status === 'connected').length;
  const degraded = results.filter((r) => r.status === 'degraded').length;
  const errored = results.filter((r) => r.status === 'error').length;

  const includeErrors = request.nextUrl.searchParams.get('include') === 'errors';
  const errorStats = includeErrors ? getErrorStats() : undefined;

  return NextResponse.json({
    success: true,
    summary: { total: results.length, connected, degraded, errored },
    services: results,
    checkedAt: new Date().toISOString(),
    ...(errorStats ? { errorStats } : {}),
  });
}
