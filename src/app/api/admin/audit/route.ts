import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getAuditLog, getAuditStats } from '@/lib/audit-log';

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = getUserRole(session.user.email);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const { searchParams } = request.nextUrl;
    const userEmail = searchParams.get('user') ?? undefined;
    const action = searchParams.get('action') ?? undefined;
    const since = searchParams.get('since') ?? undefined;
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.min(parseInt(limitParam, 10), 500) : 100;

    const entries = getAuditLog({ userEmail, action, since, limit });

    // Stats scoped to today for the stats cards
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const stats = getAuditStats(todayStart.toISOString());

    return NextResponse.json({ entries, stats, total: entries.length });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load audit log' },
      { status: 500 }
    );
  }
}
