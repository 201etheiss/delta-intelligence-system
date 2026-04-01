import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { listSharedResults, createSharedResult } from '@/lib/shared-results';

// GET /api/shared?search=term
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role ?? 'readonly';

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') ?? undefined;

    const results = listSharedResults(userRole, search);
    return NextResponse.json({ results, total: results.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/shared — share a result
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const body = await request.json();
    if (!body.title || !body.content) {
      return NextResponse.json(
        { error: 'title and content are required' },
        { status: 400 }
      );
    }

    const result = createSharedResult({
      title: body.title,
      content: body.content,
      sharedBy: userEmail,
      visibility: body.visibility ?? 'team',
      allowedRoles: body.allowedRoles,
    });

    return NextResponse.json({ result }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
