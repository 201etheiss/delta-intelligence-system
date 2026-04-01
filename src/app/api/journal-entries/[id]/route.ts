/**
 * GET  /api/journal-entries/[id]  — Get a single JE
 * POST /api/journal-entries/[id]  — Perform action (submit, approve, reject, post, reverse)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getJEById,
  submitForReview,
  approveJE,
  rejectJE,
  postJE,
  reverseJE,
} from '@/lib/engines/journal-entry';

type ActionBody = {
  action: 'submit' | 'approve' | 'reject' | 'post' | 'reverse';
  reviewedBy?: string;
  approvedBy?: string;
};

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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { id } = await params;
    const je = getJEById(id);
    if (!je) {
      return NextResponse.json({ success: false, error: `Journal entry ${id} not found` }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: je });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get journal entry';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const { id } = await params;
    const body = (await req.json()) as ActionBody;

    if (!body.action) {
      return NextResponse.json({ success: false, error: 'action is required' }, { status: 400 });
    }

    let result;
    switch (body.action) {
      case 'submit':
        result = submitForReview(id);
        break;
      case 'approve':
        result = approveJE(id, body.approvedBy ?? user.email);
        break;
      case 'reject':
        result = rejectJE(id, body.reviewedBy ?? user.email);
        break;
      case 'post':
        result = postJE(id);
        break;
      case 'reverse':
        result = reverseJE(id, user.email);
        break;
      default:
        return NextResponse.json(
          { success: false, error: `Unknown action: ${body.action}` },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to perform action';
    const status = msg.includes('not found') ? 404 : msg.includes('Only') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
