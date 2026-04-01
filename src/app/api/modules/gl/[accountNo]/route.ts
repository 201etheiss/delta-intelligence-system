/**
 * GET /api/modules/gl/[accountNo] — single account balance + history
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getAccountBalance } from '@/lib/modules/gl/gl-engine';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return { email: session.user.email, role: getUserRole(session.user.email) };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as const };
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { accountNo: string } }
): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { accountNo } = params;
    if (!accountNo) {
      return NextResponse.json({ success: false, error: 'accountNo is required' }, { status: 400 });
    }

    const result = await getAccountBalance(accountNo);
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get account balance';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
