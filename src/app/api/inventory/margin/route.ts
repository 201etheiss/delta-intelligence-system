/**
 * GET /api/inventory/margin
 *   ?view=product&period=2026-03   — Margin by product
 *   ?view=division&period=2026-03  — Margin by profit center
 *   ?view=customer&period=2026-03&top=10 — Top customers by GP
 *   ?view=trend&months=6           — Margin trend
 *   ?view=spread                   — Rack vs invoice spread
 *   ?view=summary&period=2026-03   — Summary KPIs
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole, ROLES } from '@/lib/config/roles';
import {
  getMarginByProduct,
  getMarginByDivision,
  getMarginByCustomer,
  getMarginTrend,
  getRackVsInvoiceSpread,
  getMarginSummary,
} from '@/lib/engines/inventory-margin';

const ALLOWED_ROLES = new Set(['admin', 'accounting', 'operations']);

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

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * Operations role can see volume data but not dollar margins.
 * Strip financial fields for operations users.
 */
function redactForOps<T extends Record<string, unknown>>(data: readonly T[]): readonly Partial<T>[] {
  return data.map((item) => {
    const redacted: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(item)) {
      if (['revenue', 'cogs', 'grossProfit', 'totalGP', 'totalRevenue', 'avgRackSpread', 'rackPrice', 'avgInvoicePrice', 'spread'].includes(key)) {
        continue; // strip financial data
      }
      redacted[key] = val;
    }
    return redacted as Partial<T>;
  });
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (!ALLOWED_ROLES.has(user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const view = params.get('view') ?? 'product';
    const period = params.get('period') ?? getCurrentPeriod();
    const isOps = user.role === 'operations';
    const roleConfig = ROLES[user.role];
    const hasFinancialAccess = roleConfig?.financialAccess ?? false;

    switch (view) {
      case 'product': {
        const data = await getMarginByProduct(period);
        return NextResponse.json({
          success: true,
          data: (isOps && !hasFinancialAccess) ? redactForOps(data as unknown as Array<Record<string, unknown>>) : data,
          period,
        });
      }

      case 'division': {
        const data = await getMarginByDivision(period);
        return NextResponse.json({
          success: true,
          data: (isOps && !hasFinancialAccess) ? redactForOps(data as unknown as Array<Record<string, unknown>>) : data,
          period,
        });
      }

      case 'customer': {
        const top = Math.min(Math.max(1, Number(params.get('top') ?? 10)), 50);
        const data = await getMarginByCustomer(period, top);
        return NextResponse.json({
          success: true,
          data: (isOps && !hasFinancialAccess) ? redactForOps(data as unknown as Array<Record<string, unknown>>) : data,
          period,
        });
      }

      case 'trend': {
        const months = Math.min(Math.max(1, Number(params.get('months') ?? 6)), 24);
        const data = await getMarginTrend(months);
        return NextResponse.json({
          success: true,
          data: (isOps && !hasFinancialAccess) ? redactForOps(data as unknown as Array<Record<string, unknown>>) : data,
        });
      }

      case 'spread': {
        if (isOps && !hasFinancialAccess) {
          return NextResponse.json({ success: false, error: 'Financial data not available for operations role' }, { status: 403 });
        }
        const data = await getRackVsInvoiceSpread();
        return NextResponse.json({ success: true, data });
      }

      case 'summary': {
        const summary = await getMarginSummary(period);
        if (isOps && !hasFinancialAccess) {
          return NextResponse.json({
            success: true,
            data: {
              avgMarginPct: summary.avgMarginPct,
              totalVolume: summary.totalVolume,
            },
            period,
          });
        }
        return NextResponse.json({ success: true, data: summary, period });
      }

      default:
        return NextResponse.json(
          { success: false, error: `Unknown view: ${view}. Valid: product, division, customer, trend, spread, summary` },
          { status: 400 }
        );
    }
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to load margin data' },
      { status: 500 }
    );
  }
}
