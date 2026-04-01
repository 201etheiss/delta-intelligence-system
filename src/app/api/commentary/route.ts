/**
 * GET  /api/commentary?period=2026-03  — List commentary items
 * POST /api/commentary?period=2026-03  — Bulk generate AI draft commentary
 * PATCH /api/commentary               — Update/approve/reject commentary
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAllCommentary,
  bulkGenerateCommentary,
  updateCommentaryText,
  approveCommentary,
  rejectCommentary,
  getCommentarySummary,
  type CommentaryStatus,
} from '@/lib/engines/commentary';

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
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const period = params.get('period') ?? undefined;
    const status = params.get('status') as CommentaryStatus | null;

    if (params.get('summary') === 'true' && period) {
      const summary = getCommentarySummary(period);
      return NextResponse.json({ success: true, data: summary });
    }

    const items = getAllCommentary({
      period,
      status: status ?? undefined,
    });

    return NextResponse.json({ success: true, data: items, count: items.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list commentary';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const period = params.get('period');
    if (!period) {
      return NextResponse.json({ success: false, error: 'period query parameter is required' }, { status: 400 });
    }

    const body = (await req.json().catch(() => ({}))) as { threshold?: number };
    const threshold = body.threshold ?? 5000;

    const generated = await bulkGenerateCommentary(period, user.email, threshold);

    return NextResponse.json({
      success: true,
      data: generated,
      count: generated.length,
      message: `Generated ${generated.length} draft commentaries for ${period}`,
    }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate commentary';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as {
      id: string;
      action: 'update' | 'approve' | 'reject';
      text?: string;
    };

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    let result;
    switch (body.action) {
      case 'update':
        if (!body.text) {
          return NextResponse.json({ success: false, error: 'text is required for update' }, { status: 400 });
        }
        result = updateCommentaryText(body.id, body.text, user.email);
        break;
      case 'approve':
        result = approveCommentary(body.id, user.email);
        break;
      case 'reject':
        result = rejectCommentary(body.id);
        break;
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update commentary';
    const status = msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
