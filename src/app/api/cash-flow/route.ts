import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getCashPosition,
  getLatestForecast,
  getLatestBorrowingBase,
  generateWeeklyForecast,
} from '@/lib/engines/cash-flow';

/**
 * GET /api/cash-flow
 * Get current cash position + latest forecast + borrowing base.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const [position, forecast, borrowingBase] = await Promise.all([
      getCashPosition(),
      Promise.resolve(getLatestForecast()),
      Promise.resolve(getLatestBorrowingBase()),
    ]);

    return NextResponse.json({
      cashPosition: position,
      forecast,
      borrowingBase,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load cash flow data' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-flow
 * Generate a new weekly forecast.
 * Body: { weeksAhead?: number } (default 13 = one quarter)
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { weeksAhead?: number };
    const weeksAhead = body.weeksAhead ?? 13;

    if (weeksAhead < 1 || weeksAhead > 52) {
      return NextResponse.json(
        { error: 'weeksAhead must be between 1 and 52' },
        { status: 400 }
      );
    }

    const forecast = await generateWeeklyForecast(weeksAhead);

    return NextResponse.json({
      forecast,
      weeksGenerated: forecast.length,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to generate forecast' },
      { status: 500 }
    );
  }
}
