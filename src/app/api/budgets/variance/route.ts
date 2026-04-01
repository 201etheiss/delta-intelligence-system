/**
 * GET /api/budgets/variance?period=2026-03&threshold=10
 * Budget vs actual with variance filtering.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getBudgetVsActual,
  getVarianceReport,
  getRollingForecast,
  listScenarios,
  createScenario,
  applyScenario,
} from '@/lib/engines/budgeting';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    return { email: session.user.email, role };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as const };
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const allowed = ['admin', 'accounting', 'sales', 'operations'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const period = params.get('period');
    const threshold = params.get('threshold') ? parseFloat(params.get('threshold')!) : undefined;
    const profitCenter = params.get('profitCenter') ?? undefined;
    const mode = params.get('mode'); // 'variance' | 'forecast' | 'scenarios'

    // Rolling forecast mode
    if (mode === 'forecast') {
      const year = params.get('year') ? parseInt(params.get('year')!, 10) : new Date().getFullYear();
      const monthsForward = params.get('monthsForward') ? parseInt(params.get('monthsForward')!, 10) : 3;
      const forecast = await getRollingForecast(year, monthsForward);
      return NextResponse.json({ success: true, data: forecast });
    }

    // Scenarios list mode
    if (mode === 'scenarios') {
      const scenarios = listScenarios();
      return NextResponse.json({ success: true, data: scenarios, count: scenarios.length });
    }

    if (!period) {
      return NextResponse.json({ success: false, error: 'period is required (YYYY-MM)' }, { status: 400 });
    }

    // If threshold provided, return variance report (filtered)
    if (threshold !== undefined) {
      const report = await getVarianceReport(period, threshold, profitCenter);
      return NextResponse.json({ success: true, data: report, count: report.length });
    }

    // Default: full budget vs actual
    const bva = await getBudgetVsActual(period, profitCenter);
    return NextResponse.json({ success: true, data: bva, count: bva.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load variance data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

/**
 * POST /api/budgets/variance
 * Create or apply a scenario.
 */
export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as {
      operation: 'createScenario' | 'applyScenario';
      name?: string;
      assumptions?: Record<string, number>;
      budgetId?: string;
      scenarioId?: string;
    };

    if (body.operation === 'createScenario') {
      if (!body.name || !body.assumptions) {
        return NextResponse.json({ success: false, error: 'name and assumptions required' }, { status: 400 });
      }
      const scenario = createScenario(body.name, body.assumptions);
      return NextResponse.json({ success: true, data: scenario }, { status: 201 });
    }

    if (body.operation === 'applyScenario') {
      if (!body.budgetId || !body.scenarioId) {
        return NextResponse.json({ success: false, error: 'budgetId and scenarioId required' }, { status: 400 });
      }
      const revised = applyScenario(body.budgetId, body.scenarioId);
      return NextResponse.json({ success: true, data: revised }, { status: 201 });
    }

    return NextResponse.json({ success: false, error: 'Invalid operation' }, { status: 400 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to process scenario operation';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
