/**
 * GET  /api/assets/depreciation?period=2026-03 — Calculate depreciation for period
 * POST /api/assets/depreciation?period=2026-03 — Generate depreciation JE draft
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAssets,
  calculateMonthlyDepreciation,
  generateDepreciationJE,
} from '@/lib/engines/fixed-assets';

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
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const period = req.nextUrl.searchParams.get('period');
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { success: false, error: 'period is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    const activeAssets = getAssets({ status: 'active' });
    const calculations = activeAssets.map((asset) => {
      const depr = calculateMonthlyDepreciation(asset);
      return {
        assetId: asset.id,
        code: asset.code,
        description: asset.description,
        category: asset.category,
        cost: asset.cost,
        accumulatedDepreciation: asset.accumulatedDepreciation,
        netBookValue: asset.netBookValue,
        monthlyDepreciation: depr.monthlyAmount,
        debitAccount: depr.debitAccount,
        creditAccount: depr.creditAccount,
      };
    });

    const totalMonthly = calculations.reduce((s, c) => s + c.monthlyDepreciation, 0);

    return NextResponse.json({
      success: true,
      data: {
        period,
        calculations,
        totalMonthlyDepreciation: Math.round(totalMonthly * 100) / 100,
        assetCount: calculations.filter((c) => c.monthlyDepreciation > 0).length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to calculate depreciation' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Only admin/accounting can generate JEs' }, { status: 403 });
    }

    const period = req.nextUrl.searchParams.get('period');
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { success: false, error: 'period is required (format: YYYY-MM)' },
        { status: 400 }
      );
    }

    const je = generateDepreciationJE(period);

    return NextResponse.json({
      success: true,
      data: je,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate depreciation JE' },
      { status: 500 }
    );
  }
}
