import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  calculateBorrowingBase,
  getLatestBorrowingBase,
} from '@/lib/engines/cash-flow';

/**
 * GET /api/cash-flow/borrowing-base
 * Get the latest borrowing base calculation.
 */
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const borrowingBase = getLatestBorrowingBase();

    if (!borrowingBase) {
      return NextResponse.json(
        { borrowingBase: null, message: 'No borrowing base calculated yet. POST to generate.' }
      );
    }

    return NextResponse.json({ borrowingBase });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load borrowing base' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cash-flow/borrowing-base
 * Recalculate borrowing base from live Ascend data.
 */
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const borrowingBase = await calculateBorrowingBase();

    return NextResponse.json({ borrowingBase }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to calculate borrowing base' },
      { status: 500 }
    );
  }
}
