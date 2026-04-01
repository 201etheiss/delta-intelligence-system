import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  calculateProvision,
  getProvision,
  getFuelTaxByState,
  getTaxCollected,
  getTaxRates,
  generateTaxJE,
  getAllProvisions,
} from '@/lib/engines/tax';

/**
 * GET /api/tax
 * Query params:
 *   ?period=2026-03         → Get tax provision for period
 *   ?type=fuel&period=2026-03 → Fuel tax by state
 *   ?type=collected&year=2026 → Tax collected summary
 *   ?type=rates             → Current tax rates
 *   ?type=je&period=2026-03 → Generate tax JE preview
 *   (no params)             → All provisions
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const type = searchParams.get('type');
    const period = searchParams.get('period');
    const year = searchParams.get('year');

    if (type === 'fuel' && period) {
      const fuelTax = await getFuelTaxByState(period);
      return NextResponse.json({ fuelTax });
    }

    if (type === 'collected') {
      const y = year ? parseInt(year, 10) : new Date().getFullYear();
      const collected = await getTaxCollected(y);
      return NextResponse.json({ collected });
    }

    if (type === 'rates') {
      const rates = await getTaxRates();
      return NextResponse.json({ rates });
    }

    if (type === 'je' && period) {
      const je = generateTaxJE(period);
      return NextResponse.json({ journalEntry: je });
    }

    if (period) {
      const provision = getProvision(period);
      if (!provision) {
        return NextResponse.json(
          { error: `No provision found for period ${period}` },
          { status: 404 }
        );
      }
      return NextResponse.json({ provision });
    }

    // Default: return all provisions
    const provisions = getAllProvisions();
    return NextResponse.json({ provisions });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load tax data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/tax
 * Calculate a new tax provision.
 * Body: { period: string, stateCode?: string, pretaxIncome?: number, preparedBy?: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      period?: string;
      stateCode?: string;
      pretaxIncome?: number;
      preparedBy?: string;
    };

    if (!body.period) {
      return NextResponse.json({ error: 'period is required (YYYY-MM)' }, { status: 400 });
    }

    if (!/^\d{4}-\d{2}$/.test(body.period)) {
      return NextResponse.json(
        { error: 'period must be in YYYY-MM format' },
        { status: 400 }
      );
    }

    const provision = await calculateProvision(body.period, {
      stateCode: body.stateCode,
      pretaxIncome: body.pretaxIncome,
      preparedBy: body.preparedBy ?? session?.user?.email ?? 'system',
    });

    return NextResponse.json({ provision }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to calculate provision' },
      { status: 500 }
    );
  }
}
