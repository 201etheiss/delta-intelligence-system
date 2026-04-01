import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getSharedResult,
  incrementViews,
  addComment,
  updateVisibility,
  deleteSharedResult,
} from '@/lib/shared-results';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/shared/[id] — view a shared result
export async function GET(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const result = getSharedResult(id);
    if (!result) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check visibility
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role ?? 'readonly';
    if (
      result.visibility === 'role' &&
      result.allowedRoles &&
      !result.allowedRoles.includes(userRole)
    ) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    // Increment view count
    const updated = incrementViews(id);
    return NextResponse.json({ result: updated ?? result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/shared/[id] — add comment
export async function POST(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    const author = session?.user?.email ?? 'anonymous';

    const body = await request.json();
    if (!body.text) {
      return NextResponse.json({ error: 'text is required' }, { status: 400 });
    }

    const comment = addComment(id, author, body.text);
    if (!comment) {
      return NextResponse.json({ error: 'Shared result not found' }, { status: 404 });
    }

    return NextResponse.json({ comment }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/shared/[id] — update visibility
export async function PATCH(
  request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const body = await request.json();
    if (!body.visibility) {
      return NextResponse.json({ error: 'visibility is required' }, { status: 400 });
    }

    const updated = updateVisibility(id, body.visibility, body.allowedRoles);
    if (!updated) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ result: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/shared/[id] — unshare
export async function DELETE(
  _request: NextRequest,
  context: RouteContext
): Promise<NextResponse> {
  try {
    const { id } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const deleted = deleteSharedResult(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
