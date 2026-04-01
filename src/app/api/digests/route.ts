import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  loadDigestConfigs,
  getDigestLogs,
  sendDigest,
  updateDigestConfig,
} from '@/lib/email-digest';

// ── Auth Guard ───────────────────────────────────────────────

async function requireAdmin(): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') return null;
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

// ── GET: List digest configs and recent logs ─────────────────

export async function GET(): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  const configs = loadDigestConfigs();
  const logs = getDigestLogs();

  return NextResponse.json({
    success: true,
    digests: configs,
    recentLogs: logs.slice(0, 20),
  });
}

// ── POST: Trigger a digest manually ──────────────────────────

export async function POST(request: Request): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { digestId?: string } = {};
  try {
    body = (await request.json()) as { digestId?: string };
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { digestId } = body;
  if (!digestId || typeof digestId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing required field: digestId' },
      { status: 400 }
    );
  }

  const result = await sendDigest(digestId);

  const status = result.status === 'sent' ? 200 : 502;
  return NextResponse.json({ success: result.status === 'sent', result }, { status });
}

// ── PATCH: Enable/disable a digest or update config ──────────

export async function PATCH(request: Request): Promise<NextResponse> {
  const authError = await requireAdmin();
  if (authError) return authError;

  let body: { digestId?: string; enabled?: boolean; recipients?: string[]; schedule?: string } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const { digestId, ...updates } = body;
  if (!digestId || typeof digestId !== 'string') {
    return NextResponse.json(
      { success: false, error: 'Missing required field: digestId' },
      { status: 400 }
    );
  }

  // Validate recipients if provided
  if (updates.recipients !== undefined) {
    if (!Array.isArray(updates.recipients) || updates.recipients.some((r) => typeof r !== 'string' || !r.includes('@'))) {
      return NextResponse.json(
        { success: false, error: 'recipients must be an array of valid email addresses' },
        { status: 400 }
      );
    }
  }

  // Validate schedule if provided
  if (updates.schedule !== undefined) {
    if (typeof updates.schedule !== 'string' || updates.schedule.trim().split(/\s+/).length !== 5) {
      return NextResponse.json(
        { success: false, error: 'schedule must be a valid 5-field cron expression' },
        { status: 400 }
      );
    }
  }

  const updated = updateDigestConfig(digestId, updates);
  if (!updated) {
    return NextResponse.json(
      { success: false, error: `Digest not found: ${digestId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({ success: true, digest: updated });
}
