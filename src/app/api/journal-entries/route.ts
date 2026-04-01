/**
 * GET  /api/journal-entries  — List JEs with optional filters
 * POST /api/journal-entries  — Create a new JE
 * PATCH /api/journal-entries — Update a draft JE
 * DELETE /api/journal-entries — Delete a draft JE
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getAllJEs,
  createJE,
  updateJE,
  deleteJE,
  type JEStatus,
  type CreateJEInput,
} from '@/lib/engines/journal-entry';

async function getUser(req: NextRequest) {
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

    const params = req.nextUrl.searchParams;
    const status = params.get('status') as JEStatus | null;
    const period = params.get('period') ?? undefined;
    const family = params.get('family') ?? undefined;

    const rawEntries = getAllJEs({
      status: status ?? undefined,
      period,
      family,
    });

    // Map engine fields to page-expected shape
    const entries = rawEntries.map((je) => ({
      id: je.id,
      jeNumber: je.id,
      date: je.date,
      period: je.date.slice(0, 7),
      description: je.description,
      lines: (je.entries ?? []).map((line) => ({
        accountNumber: line.account,
        accountName: line.accountName,
        debit: line.debit,
        credit: line.credit,
        description: line.description,
      })),
      totalDebit: je.totalDebit,
      totalCredit: je.totalCredit,
      status: je.status === 'review' ? 'in_review' : je.status,
      family: je.templateId ?? '',
      createdBy: je.createdBy,
      approvedBy: je.approvedBy,
      createdAt: je.createdAt,
      updatedAt: je.updatedAt,
    }));

    return NextResponse.json({ success: true, data: entries, count: entries.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list journal entries';
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
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as CreateJEInput;

    const je = createJE({
      ...body,
      createdBy: body.createdBy ?? user.email,
    });

    return NextResponse.json({ success: true, data: je }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create journal entry';
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
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as { id: string; [key: string]: unknown };
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const { id, ...patch } = body;
    const updated = updateJE(id, patch as Parameters<typeof updateJE>[1]);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update journal entry';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser(req);
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Accounting or admin access required' }, { status: 403 });
    }

    const { id } = (await req.json()) as { id: string };
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    deleteJE(id);
    return NextResponse.json({ success: true, message: `Journal entry ${id} deleted` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete journal entry';
    const status = msg.includes('not found') ? 404 : msg.includes('Cannot') ? 409 : 500;
    return NextResponse.json({ success: false, error: msg }, { status });
  }
}
