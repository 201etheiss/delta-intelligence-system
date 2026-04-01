import { NextResponse } from 'next/server';

/**
 * GET /api/integrations/health
 *
 * Pings each gateway service and returns real-time connection status,
 * response times, and last-checked timestamps. Used by the Integrations
 * and Sources pages to show live health indicators.
 */

const GATEWAY_BASE = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const GATEWAY_KEY = process.env.GATEWAY_ADMIN_KEY ?? '';

interface ServiceHealth {
  id: string;
  name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  responseTimeMs: number;
  lastChecked: string;
  endpointCount: number;
  error?: string;
}

const SERVICES: ReadonlyArray<{ id: string; name: string; path: string; endpointCount: number }> = [
  { id: 'ascend', name: 'Ascend ERP', path: '/ascend/tables', endpointCount: 43 },
  { id: 'salesforce', name: 'Salesforce', path: '/salesforce/accounts', endpointCount: 16 },
  { id: 'samsara', name: 'Samsara', path: '/samsara/vehicles', endpointCount: 13 },
  { id: 'vroozi', name: 'Vroozi', path: '/vroozi/suppliers', endpointCount: 18 },
  { id: 'ms365', name: 'Microsoft 365', path: '/microsoft/sites', endpointCount: 11 },
  { id: 'powerbi', name: 'Power BI', path: '/powerbi/workspaces', endpointCount: 4 },
  { id: 'paylocity', name: 'Paylocity', path: '/paylocity/employees', endpointCount: 11 },
  { id: 'fleetpanda', name: 'Fleet Panda', path: '/fleetpanda/assets', endpointCount: 14 },
];

async function checkService(svc: typeof SERVICES[number]): Promise<ServiceHealth> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${GATEWAY_BASE}${svc.path}`, {
      method: 'GET',
      headers: {
        'x-api-key': GATEWAY_KEY,
        'Accept': 'application/json',
      },
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseTimeMs = Date.now() - start;

    if (res.ok) {
      return {
        id: svc.id,
        name: svc.name,
        status: responseTimeMs > 5000 ? 'degraded' : 'connected',
        responseTimeMs,
        lastChecked: new Date().toISOString(),
        endpointCount: svc.endpointCount,
      };
    }

    return {
      id: svc.id,
      name: svc.name,
      status: 'disconnected',
      responseTimeMs,
      lastChecked: new Date().toISOString(),
      endpointCount: svc.endpointCount,
      error: `HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      id: svc.id,
      name: svc.name,
      status: 'disconnected',
      responseTimeMs: Date.now() - start,
      lastChecked: new Date().toISOString(),
      endpointCount: svc.endpointCount,
      error: err instanceof Error ? err.message : 'Connection failed',
    };
  }
}

export async function GET(): Promise<NextResponse> {
  const results = await Promise.all(SERVICES.map(checkService));

  const connected = results.filter(r => r.status === 'connected').length;
  const degraded = results.filter(r => r.status === 'degraded').length;
  const disconnected = results.filter(r => r.status === 'disconnected').length;
  const totalEndpoints = results.reduce((sum, r) => sum + r.endpointCount, 0);

  return NextResponse.json({
    success: true,
    summary: { total: results.length, connected, degraded, disconnected, totalEndpoints },
    services: results,
    checkedAt: new Date().toISOString(),
  });
}
