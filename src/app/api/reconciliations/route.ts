import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createRecon,
  getReconsByPeriod,
  getReconsByStatus,
  getExceptionAging,
  readRules,
  type ReconStatus,
} from '@/lib/engines/reconciliation';

/**
 * GET /api/reconciliations
 * List reconciliations with optional filters.
 * Query params: period (YYYY-MM), status (pending|in_progress|reconciled|exception)
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const period = req.nextUrl.searchParams.get('period');
    const status = req.nextUrl.searchParams.get('status') as ReconStatus | null;
    const view = req.nextUrl.searchParams.get('view'); // 'aging' | 'rules'

    if (view === 'aging') {
      const rawAging = getExceptionAging();
      // Group into aging buckets for the page
      const buckets: Record<string, number> = {
        '0-7 days': 0,
        '8-14 days': 0,
        '15-30 days': 0,
        '30+ days': 0,
      };
      for (const item of rawAging) {
        const days = item.exception.ageInDays;
        if (days <= 7) buckets['0-7 days'] += 1;
        else if (days <= 14) buckets['8-14 days'] += 1;
        else if (days <= 30) buckets['15-30 days'] += 1;
        else buckets['30+ days'] += 1;
      }
      const aging = Object.entries(buckets).map(([bucket, count]) => ({ bucket, count }));
      return NextResponse.json({ aging });
    }

    if (view === 'rules') {
      const rules = readRules();
      return NextResponse.json({ rules });
    }

    let recons;
    if (period && status) {
      recons = getReconsByPeriod(period).filter((r) => r.status === status);
    } else if (period) {
      recons = getReconsByPeriod(period);
    } else if (status) {
      recons = getReconsByStatus(status);
    } else {
      // Return all — use period filter in production
      recons = getReconsByPeriod(new Date().toISOString().slice(0, 7));
    }

    // Map engine fields to page-expected shape
    const mapped = recons.map((r) => ({
      id: r.id,
      accountNumber: r.accountNumber,
      accountName: r.accountName,
      period: r.period,
      sourceBalance: r.glBalance,
      targetBalance: r.subBalance,
      difference: r.difference,
      status: r.status,
      assignedTo: r.preparedBy ?? 'Unassigned',
      autoMatched: r.matchedItems > 0 && r.status === 'reconciled',
      preparedBy: r.preparedBy ?? '',
      reviewedBy: r.reviewedBy,
      completedAt: r.completedAt,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    }));

    return NextResponse.json({
      reconciliations: mapped,
      count: mapped.length,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load reconciliations' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/reconciliations
 * Create a new reconciliation for an account+period.
 * Body: { accountNumber: string, period: string }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { accountNumber?: string; period?: string };

    if (!body.accountNumber || !body.period) {
      return NextResponse.json(
        { error: 'accountNumber and period are required' },
        { status: 400 }
      );
    }

    // Validate period format YYYY-MM
    if (!/^\d{4}-\d{2}$/.test(body.period)) {
      return NextResponse.json(
        { error: 'period must be in YYYY-MM format' },
        { status: 400 }
      );
    }

    const preparedBy = session?.user?.email ?? 'system';
    const recon = await createRecon(body.period, body.accountNumber, preparedBy);

    return NextResponse.json({ reconciliation: recon }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create reconciliation' },
      { status: 500 }
    );
  }
}
