/**
 * GET   /api/close/[period]  — Get close detail with progress
 * PATCH /api/close/[period]  — Update a close item status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getClose,
  updateItem,
  getCloseProgress,
  type CloseItemStatus,
} from '@/lib/engines/close-management';

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
  { params }: { params: Promise<{ period: string }> }
): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const { period } = await params;
    const checklist = getClose(period);
    if (!checklist) {
      return NextResponse.json(
        { success: false, error: `Close period ${period} not found` },
        { status: 404 }
      );
    }

    const progress = getCloseProgress(period);

    return NextResponse.json({ success: true, data: checklist, progress });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to get close period';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ period: string }> }
): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const { period } = await params;
    const checklist = getClose(period);
    if (!checklist) {
      return NextResponse.json(
        { success: false, error: `Close period ${period} not found` },
        { status: 404 }
      );
    }

    const body = (await req.json()) as {
      itemId: string;
      status?: CloseItemStatus;
      completedBy?: string;
      notes?: string;
      evidence?: string;
    };

    if (!body.itemId) {
      return NextResponse.json({ success: false, error: 'itemId is required' }, { status: 400 });
    }

    const updated = updateItem(checklist.id, body.itemId, {
      status: body.status,
      completedBy: body.completedBy ?? user.email,
      notes: body.notes,
      evidence: body.evidence,
    });

    const progress = getCloseProgress(period);

    return NextResponse.json({ success: true, data: updated, progress });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update close item';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
