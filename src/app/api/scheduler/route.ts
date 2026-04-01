import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  startScheduler,
  stopScheduler,
  getSchedulerStatus,
} from '@/lib/cron-scheduler';

// ── Auth Guard ───────────────────────────────────────────────

async function requireAdmin(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') return null;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = getUserRole(session.user.email);
  if (role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

// ── GET: Scheduler status ────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const status = getSchedulerStatus();
    return NextResponse.json({ success: true, ...status });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── POST: Start scheduler ────────────────────────────────────

export async function POST(): Promise<NextResponse> {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const result = startScheduler();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}

// ── DELETE: Stop scheduler ───────────────────────────────────

export async function DELETE(): Promise<NextResponse> {
  try {
    const authError = await requireAdmin();
    if (authError) return authError;

    const result = stopScheduler();
    return NextResponse.json({ success: true, ...result });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
