/**
 * GET /api/ap/aging — AP aging summary (current, 30, 60, 90+ buckets)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getAPAgingSummary } from '@/lib/engines/ap-processing';

async function getUser(_req: NextRequest) {
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
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json(
        { success: false, error: 'Accounting or admin access required' },
        { status: 403 }
      );
    }

    const aging = getAPAgingSummary();

    return NextResponse.json({ success: true, data: aging });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate aging summary';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
