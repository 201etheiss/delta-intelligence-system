/**
 * GET   /api/ap/invoices — List invoices (?status=review&vendor=X&overdue=true&dateFrom=&dateTo=)
 * POST  /api/ap/invoices — Create new invoice (manual or from OCR)
 * PATCH /api/ap/invoices — Update invoice (coding, approve, schedule, mark paid, auto-code)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getInvoices,
  createInvoice,
  updateInvoice,
  submitForReview,
  approveInvoice,
  schedulePayment,
  markPaid,
  autoCodeInvoice,
  type APInvoiceStatus,
  type CreateInvoiceInput,
} from '@/lib/engines/ap-processing';

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

function requireAccountingOrAdmin(role: string): NextResponse | null {
  if (role !== 'admin' && role !== 'accounting') {
    return NextResponse.json(
      { success: false, error: 'Accounting or admin access required' },
      { status: 403 }
    );
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const denied = requireAccountingOrAdmin(user.role);
    if (denied) return denied;

    const params = req.nextUrl.searchParams;
    const status = params.get('status') as APInvoiceStatus | null;
    const vendorId = params.get('vendor') ?? undefined;
    const overdue = params.get('overdue') === 'true';
    const dateFrom = params.get('dateFrom') ?? undefined;
    const dateTo = params.get('dateTo') ?? undefined;

    const invoices = getInvoices({
      status: status ?? undefined,
      vendorId,
      overdue: overdue || undefined,
      dateFrom,
      dateTo,
    });

    return NextResponse.json({ success: true, data: invoices, count: invoices.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list invoices';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const denied = requireAccountingOrAdmin(user.role);
    if (denied) return denied;

    const body = (await req.json()) as CreateInvoiceInput;
    const invoice = createInvoice(body);

    return NextResponse.json({ success: true, data: invoice }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create invoice';
    const status = msg.includes('Validation') ? 400 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    const denied = requireAccountingOrAdmin(user.role);
    if (denied) return denied;

    const body = (await req.json()) as { id: string; action?: string; [key: string]: unknown };
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    let result;
    switch (body.action) {
      case 'submit_review':
        result = submitForReview(body.id);
        break;
      case 'approve':
        result = approveInvoice(body.id, user.email);
        break;
      case 'schedule':
        result = schedulePayment(body.id);
        break;
      case 'mark_paid':
        if (!body.paidReference || typeof body.paidReference !== 'string') {
          return NextResponse.json({ success: false, error: 'paidReference is required' }, { status: 400 });
        }
        result = markPaid(body.id, body.paidReference);
        break;
      case 'auto_code':
        result = autoCodeInvoice(body.id);
        break;
      default: {
        const { id, action, ...patch } = body;
        result = updateInvoice(id, patch as Parameters<typeof updateInvoice>[1]);
        break;
      }
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update invoice';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
