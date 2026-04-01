/**
 * GET   /api/ar/credit  — List credit limits
 * PATCH /api/ar/credit  — Update credit limit for a customer
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getCreditLimits,
  updateCreditLimit,
  assessCreditRisk,
} from '@/lib/engines/ar-collections';

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

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const limits = getCreditLimits();
    return NextResponse.json({ success: true, data: limits, count: limits.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load credit limits';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as {
      customerId: string;
      limit?: number;
      assessRisk?: boolean;
    };

    if (!body.customerId) {
      return NextResponse.json({ success: false, error: 'customerId is required' }, { status: 400 });
    }

    // If assessRisk flag is set, run credit risk assessment
    if (body.assessRisk) {
      const assessed = await assessCreditRisk(body.customerId);
      return NextResponse.json({ success: true, data: assessed });
    }

    // Otherwise update the credit limit
    if (body.limit === undefined || body.limit < 0) {
      return NextResponse.json({ success: false, error: 'limit must be a non-negative number' }, { status: 400 });
    }

    const updated = updateCreditLimit(body.customerId, body.limit, user.email);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update credit limit';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
