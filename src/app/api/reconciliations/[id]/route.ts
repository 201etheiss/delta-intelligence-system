import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getReconById,
  updateRecon,
  autoMatch,
  addException,
  resolveException,
} from '@/lib/engines/reconciliation';

/**
 * GET /api/reconciliations/:id
 * Get reconciliation detail with all exceptions.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Reconciliation ID is required' }, { status: 400 });
    }

    const recon = getReconById(id);
    if (!recon) {
      return NextResponse.json({ error: 'Reconciliation not found' }, { status: 404 });
    }

    return NextResponse.json({ reconciliation: recon });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * PATCH /api/reconciliations/:id
 * Update a reconciliation. Supports multiple actions:
 * - action: 'auto_match' — run auto-matching logic
 * - action: 'add_exception' — add a new exception { description, amount }
 * - action: 'resolve_exception' — resolve an exception { exceptionId, resolution }
 * - No action — update fields (subBalance, evidence, reviewedBy, status, tolerance)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Reconciliation ID is required' }, { status: 400 });
    }

    const body = (await request.json()) as {
      action?: 'auto_match' | 'add_exception' | 'resolve_exception';
      description?: string;
      amount?: number;
      exceptionId?: string;
      resolution?: string;
      subBalance?: number;
      evidence?: string[];
      reviewedBy?: string;
      status?: 'pending' | 'in_progress' | 'reconciled' | 'exception';
      tolerance?: number;
    };

    const userEmail = session?.user?.email ?? 'system';
    let recon;

    if (body.action === 'auto_match') {
      recon = autoMatch(id);
    } else if (body.action === 'add_exception') {
      if (!body.description || body.amount === undefined) {
        return NextResponse.json(
          { error: 'description and amount are required for add_exception' },
          { status: 400 }
        );
      }
      recon = addException(id, body.description, body.amount);
    } else if (body.action === 'resolve_exception') {
      if (!body.exceptionId || !body.resolution) {
        return NextResponse.json(
          { error: 'exceptionId and resolution are required for resolve_exception' },
          { status: 400 }
        );
      }
      recon = resolveException(id, body.exceptionId, body.resolution, userEmail);
    } else {
      // General update
      const patch: Record<string, unknown> = {};
      if (body.subBalance !== undefined) patch.subBalance = body.subBalance;
      if (body.evidence !== undefined) patch.evidence = body.evidence;
      if (body.reviewedBy !== undefined) patch.reviewedBy = body.reviewedBy;
      if (body.status !== undefined) patch.status = body.status;
      if (body.tolerance !== undefined) patch.tolerance = body.tolerance;

      recon = updateRecon(id, patch);
    }

    return NextResponse.json({ reconciliation: recon });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update reconciliation';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
