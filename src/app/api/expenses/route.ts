/**
 * GET  /api/expenses  — List expense reports (optional ?status=&employee=&period=)
 * POST /api/expenses  — Create a new expense report
 * PATCH /api/expenses — Update (add item, submit, approve, reject)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAllReports,
  createReport,
  addItem,
  submitReport,
  approveReport,
  rejectReport,
  getExpenseSummary,
  enforcePolicy,
  type ExpenseReportStatus,
  type CreateReportInput,
  type AddItemInput,
} from '@/lib/engines/expense-management';

async function getUser(_req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    return { email: session.user.email, name: session.user.name ?? '', role };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', name: 'Dev User', role: 'admin' as const };
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const params = req.nextUrl.searchParams;
    const status = params.get('status') as ExpenseReportStatus | null;
    const employee = params.get('employee') ?? undefined;
    const period = params.get('period') ?? undefined;
    const summaryPeriod = params.get('summary');

    if (summaryPeriod) {
      const summary = getExpenseSummary(summaryPeriod);
      return NextResponse.json({ success: true, data: summary });
    }

    // HR can only view, admin + accounting can manage
    const reports = getAllReports({
      status: status ?? undefined,
      employee,
      period,
    });

    return NextResponse.json({ success: true, data: reports, count: reports.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list expense reports';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await req.json()) as CreateReportInput;
    const report = createReport({
      employeeName: body.employeeName ?? user.name,
      employeeEmail: body.employeeEmail ?? user.email,
      period: body.period,
    });

    return NextResponse.json({ success: true, data: report }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create expense report';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await req.json()) as {
      id: string;
      action: 'addItem' | 'submit' | 'approve' | 'reject';
      item?: AddItemInput;
      reason?: string;
    };

    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    let result;
    switch (body.action) {
      case 'addItem': {
        if (!body.item) {
          return NextResponse.json({ success: false, error: 'item is required for addItem' }, { status: 400 });
        }
        result = addItem(body.id, body.item);
        // Check policy violations on the new item
        const lastItem = result.items[result.items.length - 1];
        const violations = enforcePolicy(lastItem);
        return NextResponse.json({ success: true, data: result, violations });
      }
      case 'submit':
        result = submitReport(body.id);
        break;
      case 'approve': {
        if (user.role !== 'admin' && user.role !== 'accounting') {
          return NextResponse.json({ success: false, error: 'Approval requires admin or accounting role' }, { status: 403 });
        }
        result = approveReport(body.id, user.email);
        break;
      }
      case 'reject': {
        if (user.role !== 'admin' && user.role !== 'accounting') {
          return NextResponse.json({ success: false, error: 'Rejection requires admin or accounting role' }, { status: 403 });
        }
        result = rejectReport(body.id, user.email, body.reason ?? 'No reason provided');
        break;
      }
      default:
        return NextResponse.json({ success: false, error: `Unknown action: ${body.action}` }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update expense report';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot') || msg.includes('Only') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
