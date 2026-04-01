/**
 * GET  /api/close  — List close periods with optional filters
 * POST /api/close  — Create a new close period from template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAllCloses,
  createClose,
  type CloseStatus,
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

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const status = params.get('status') as CloseStatus | null;

    const closes = getAllCloses({ status: status ?? undefined });

    return NextResponse.json({ success: true, data: closes, count: closes.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list close periods';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as { period: string; templateId?: string };
    if (!body.period) {
      return NextResponse.json({ success: false, error: 'period is required (YYYY-MM)' }, { status: 400 });
    }

    const checklist = createClose(body.period, body.templateId);
    return NextResponse.json({ success: true, data: checklist }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create close period';
    const status = msg.includes('already exists') ? 409 : msg.includes('not found') ? 404 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
