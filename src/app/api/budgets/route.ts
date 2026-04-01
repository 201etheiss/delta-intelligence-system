/**
 * GET   /api/budgets  — List budgets (?year=2026&status=active)
 * POST  /api/budgets  — Create a new budget
 * PATCH /api/budgets  — Update budget lines or status
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  listBudgets,
  createBudget,
  updateBudget,
  importBudgetLines,
  type BudgetStatus,
  type BudgetVersion,
  type BudgetLine,
} from '@/lib/engines/budgeting';

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

    // Sales and operations can view but only their profit centers (handled at UI level)
    const allowed = ['admin', 'accounting', 'sales', 'operations'];
    if (!allowed.includes(user.role)) {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const year = params.get('year') ? parseInt(params.get('year')!, 10) : undefined;
    const status = params.get('status') as BudgetStatus | null;
    const version = params.get('version') as BudgetVersion | null;

    const budgets = listBudgets({
      year,
      status: status ?? undefined,
      version: version ?? undefined,
    });

    return NextResponse.json({ success: true, data: budgets, count: budgets.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list budgets';
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
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as { year: number; lines?: BudgetLine[] };
    if (!body.year || body.year < 2020 || body.year > 2040) {
      return NextResponse.json({ success: false, error: 'year is required (2020-2040)' }, { status: 400 });
    }

    const budget = createBudget(body.year, user.email);

    // If lines provided, import them
    if (body.lines && body.lines.length > 0) {
      const withLines = importBudgetLines(budget.id, body.lines);
      return NextResponse.json({ success: true, data: withLines }, { status: 201 });
    }

    return NextResponse.json({ success: true, data: budget }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create budget';
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
      budgetId: string;
      status?: BudgetStatus;
      version?: BudgetVersion;
      approvedBy?: string;
      lines?: BudgetLine[];
    };

    if (!body.budgetId) {
      return NextResponse.json({ success: false, error: 'budgetId is required' }, { status: 400 });
    }

    const updated = updateBudget(body.budgetId, {
      status: body.status,
      version: body.version,
      approvedBy: body.approvedBy,
      lines: body.lines,
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update budget';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
