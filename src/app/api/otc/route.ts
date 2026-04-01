import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  generateOTCSnapshot,
  getLatestSnapshot,
  getAllSnapshots,
  getOTCStats,
  getOTCTrends,
  formatOTCMarkdownReport,
  seedFromFlashReport,
} from '@/lib/engines/order-to-cash';

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

// ── GET: Retrieve OTC data ──────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const view = req.nextUrl.searchParams.get('view') ?? 'latest';

    switch (view) {
      case 'latest': {
        const snapshot = getLatestSnapshot();
        if (!snapshot) {
          return NextResponse.json({ success: true, data: null, message: 'No snapshots yet' });
        }
        const stats = getOTCStats(snapshot);
        return NextResponse.json({ success: true, data: { snapshot, stats } });
      }
      case 'all': {
        const snapshots = getAllSnapshots();
        return NextResponse.json({ success: true, data: snapshots, count: snapshots.length });
      }
      case 'trends': {
        const trends = getOTCTrends();
        return NextResponse.json({ success: true, data: trends, count: trends.length });
      }
      case 'report': {
        const snapshot = getLatestSnapshot();
        if (!snapshot) {
          return NextResponse.json({ success: false, error: 'No snapshots to report on' }, { status: 404 });
        }
        const markdown = formatOTCMarkdownReport(snapshot);
        return NextResponse.json({ success: true, data: { markdown, snapshot } });
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown view: ${view}` }, { status: 400 });
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load OTC data';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── POST: Generate new snapshot or seed ─────────────────────

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = await req.json().catch(() => ({})) as {
      action?: 'generate' | 'seed';
      weekendEnding?: string;
    };

    const action = body.action ?? 'generate';

    if (action === 'seed') {
      const snapshot = seedFromFlashReport();
      const stats = getOTCStats(snapshot);
      const markdown = formatOTCMarkdownReport(snapshot);
      return NextResponse.json(
        { success: true, data: { snapshot, stats, markdown }, message: 'Seeded from 3/31/2026 flash report' },
        { status: 201 }
      );
    }

    // Generate from live Ascend data
    const weekendEnding = body.weekendEnding ?? new Date().toISOString().slice(0, 10);
    const snapshot = await generateOTCSnapshot(weekendEnding, user.email);
    const stats = getOTCStats(snapshot);
    const markdown = formatOTCMarkdownReport(snapshot);

    return NextResponse.json(
      { success: true, data: { snapshot, stats, markdown }, message: `Generated OTC snapshot for ${weekendEnding}` },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate OTC snapshot';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
