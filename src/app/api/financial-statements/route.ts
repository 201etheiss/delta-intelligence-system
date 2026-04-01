/**
 * GET /api/financial-statements
 *
 * Query params:
 *   type = 'balance-sheet' | 'income-statement' | 'trial-balance' | 'flash' | 'variance'
 *   period = 'YYYY-MM' (e.g. '2026-03')
 *
 * Auth: admin or accounting only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  generateFlashReport,
  compareToAscend,
  generateCashFlowStatement,
} from '@/lib/engines/financial-statements';

type StatementType = 'balance-sheet' | 'income-statement' | 'trial-balance' | 'flash' | 'variance' | 'cash-flow-statement';

const VALID_TYPES: readonly StatementType[] = [
  'balance-sheet',
  'income-statement',
  'trial-balance',
  'flash',
  'variance',
  'cash-flow-statement',
];

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
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json(
        { success: false, error: 'Admin or accounting access required' },
        { status: 403 }
      );
    }

    const params = req.nextUrl.searchParams;
    const type = params.get('type') as StatementType | null;
    const period = params.get('period');

    if (!type || !VALID_TYPES.includes(type)) {
      return NextResponse.json(
        {
          success: false,
          error: `Invalid type. Must be one of: ${VALID_TYPES.join(', ')}`,
        },
        { status: 400 }
      );
    }

    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { success: false, error: 'period is required in YYYY-MM format' },
        { status: 400 }
      );
    }

    let data: unknown;

    switch (type) {
      case 'balance-sheet':
        data = await generateBalanceSheet(period);
        break;
      case 'income-statement':
        data = await generateIncomeStatement(period);
        break;
      case 'trial-balance':
        data = await generateTrialBalance(period);
        break;
      case 'flash':
        data = await generateFlashReport(period);
        break;
      case 'variance':
        data = await compareToAscend(period, user.role);
        break;
      case 'cash-flow-statement':
        data = await generateCashFlowStatement(period);
        break;
    }

    return NextResponse.json({ success: true, type, period, data });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate financial statement';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
