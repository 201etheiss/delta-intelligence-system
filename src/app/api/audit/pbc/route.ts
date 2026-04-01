import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  createRequest,
  getRequests,
  getRequest,
  assignRequest,
  fulfillRequest,
  updateRequest,
  getAuditDashboard,
  type AuditRequestStatus,
  type AuditRequest,
} from '@/lib/engines/audit-portal';

const VALID_STATUSES: readonly string[] = ['open', 'in_progress', 'fulfilled', 'overdue'];

/** Add agingDays field for the page to consume */
function addAgingDays(r: AuditRequest): AuditRequest & { agingDays: number } {
  const msPerDay = 86_400_000;
  const endDate = r.fulfilledAt ? new Date(r.fulfilledAt) : new Date();
  const agingDays = Math.round((endDate.getTime() - new Date(r.createdAt).getTime()) / msPerDay);
  return { ...r, agingDays };
}

/**
 * GET /api/audit/pbc
 * Query params:
 *   ?status=open          → Filter by status
 *   ?id=aud-xxx           → Get single request
 *   ?dashboard=true       → Get dashboard stats
 *   (no params)           → All requests
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = req.nextUrl;
    const status = searchParams.get('status');
    const id = searchParams.get('id');
    const dashboard = searchParams.get('dashboard');

    if (dashboard === 'true') {
      const raw = getAuditDashboard();
      // Map engine fields to page-expected shape
      const stats = {
        total: raw.totalRequests,
        open: raw.openRequests,
        inProgress: raw.inProgressRequests,
        fulfilled: raw.fulfilledRequests,
        overdue: raw.overdueRequests,
        avgResponseDays: raw.avgDaysToFulfill,
        agingBuckets: raw.agingBuckets.map((b) => ({ bucket: b.label, count: b.count })),
      };
      return NextResponse.json({ dashboard: stats });
    }

    if (id) {
      const request = getRequest(id);
      if (!request) {
        return NextResponse.json({ error: 'Audit request not found' }, { status: 404 });
      }
      return NextResponse.json({ request });
    }

    if (status) {
      if (!VALID_STATUSES.includes(status)) {
        return NextResponse.json(
          { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
          { status: 400 }
        );
      }
      const requests = getRequests(status as AuditRequestStatus).map(addAgingDays);
      return NextResponse.json({ requests });
    }

    const requests = getRequests().map(addAgingDays);
    return NextResponse.json({ requests });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load audit requests' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/audit/pbc
 * Create a new audit request.
 * Body: { auditorName, auditorFirm, requestDescription, requestedItems[], dueDate, notes? }
 */
export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      auditorName?: string;
      auditorFirm?: string;
      requestDescription?: string;
      requestedItems?: string[];
      dueDate?: string;
      notes?: string;
    };

    if (!body.auditorName || !body.auditorFirm) {
      return NextResponse.json(
        { error: 'auditorName and auditorFirm are required' },
        { status: 400 }
      );
    }

    if (!body.requestDescription) {
      return NextResponse.json(
        { error: 'requestDescription is required' },
        { status: 400 }
      );
    }

    if (!(body.requestedItems ?? []).length) {
      return NextResponse.json(
        { error: 'requestedItems must have at least one item' },
        { status: 400 }
      );
    }

    if (!body.dueDate) {
      return NextResponse.json({ error: 'dueDate is required' }, { status: 400 });
    }

    const request = createRequest({
      auditorName: body.auditorName,
      auditorFirm: body.auditorFirm,
      requestDescription: body.requestDescription,
      requestedItems: body.requestedItems ?? [],
      dueDate: body.dueDate,
      notes: body.notes,
    });

    return NextResponse.json({ request }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create audit request' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/audit/pbc
 * Update a request: assign, fulfill, add evidence, or change status.
 * Body: { id, action: 'assign'|'fulfill'|'update', assignedTo?, evidenceIds?, notes?, status? }
 */
export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await req.json()) as {
      id?: string;
      action?: 'assign' | 'fulfill' | 'update';
      assignedTo?: string;
      evidenceIds?: string[];
      notes?: string;
      status?: AuditRequestStatus;
    };

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let result = null;

    switch (body.action) {
      case 'assign':
        if (!body.assignedTo) {
          return NextResponse.json({ error: 'assignedTo is required for assign' }, { status: 400 });
        }
        result = assignRequest(body.id, body.assignedTo);
        break;

      case 'fulfill':
        if (!(body.evidenceIds ?? []).length) {
          return NextResponse.json(
            { error: 'evidenceIds are required for fulfill' },
            { status: 400 }
          );
        }
        result = fulfillRequest(body.id, body.evidenceIds ?? []);
        break;

      case 'update':
      default:
        result = updateRequest(body.id, {
          notes: body.notes,
          evidenceIds: body.evidenceIds,
          assignedTo: body.assignedTo,
          status: body.status,
        });
        break;
    }

    if (!result) {
      return NextResponse.json({ error: 'Audit request not found' }, { status: 404 });
    }

    return NextResponse.json({ request: result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update audit request' },
      { status: 500 }
    );
  }
}
