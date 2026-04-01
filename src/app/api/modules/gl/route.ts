/**
 * GET  /api/modules/gl                              — chart of accounts
 * GET  /api/modules/gl?action=trial-balance&date=   — trial balance as of date
 * GET  /api/modules/gl?action=journal-entries&...   — journal entries with optional filters
 * POST /api/modules/gl                              — create journal entry
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getChartOfAccounts,
  getTrialBalance,
  getJournalEntries,
  createJournalEntry,
} from '@/lib/modules/gl/gl-engine';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    return { email: session.user.email, role: getUserRole(session.user.email) };
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
    const action = params.get('action');

    if (action === 'trial-balance') {
      const date = params.get('date') ?? new Date().toISOString().slice(0, 10);
      const tb = await getTrialBalance(date);
      return NextResponse.json({ success: true, data: tb });
    }

    if (action === 'journal-entries') {
      const from = params.get('from') ?? undefined;
      const to = params.get('to') ?? undefined;
      const status = params.get('status') ?? undefined;
      const entries = await getJournalEntries({ from, to, status });
      return NextResponse.json({ success: true, data: entries, count: entries.length });
    }

    // Default: chart of accounts
    const accounts = await getChartOfAccounts();
    return NextResponse.json({ success: true, data: accounts, count: accounts.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'GL module error';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const body = (await req.json()) as Record<string, unknown>;

    const date = typeof body.date === 'string' ? body.date : new Date().toISOString().slice(0, 10);
    const description = typeof body.description === 'string' ? body.description : '';
    const createdBy = typeof body.createdBy === 'string' ? body.createdBy : user.email;
    const rawLines = Array.isArray(body.lines) ? (body.lines as Record<string, unknown>[]) : [];

    if (!description) {
      return NextResponse.json({ success: false, error: 'description is required' }, { status: 400 });
    }
    if (rawLines.length === 0) {
      return NextResponse.json({ success: false, error: 'at least one line is required' }, { status: 400 });
    }

    const lines = rawLines.map((l) => ({
      accountNo: String(l.accountNo ?? ''),
      accountName: String(l.accountName ?? ''),
      debit: Number(l.debit ?? 0),
      credit: Number(l.credit ?? 0),
      department: typeof l.department === 'string' ? l.department : undefined,
      memo: typeof l.memo === 'string' ? l.memo : undefined,
    }));

    const entry = await createJournalEntry({
      date,
      description,
      status: 'pending',
      lines,
      createdBy,
    });

    return NextResponse.json({ success: true, data: entry }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create journal entry';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
