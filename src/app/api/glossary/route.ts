import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  searchGlossary,
  addGlossaryEntry,
  updateGlossaryEntry,
  deleteGlossaryEntry,
} from '@/lib/glossary';

// GET /api/glossary?category=finance&search=profit
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category') ?? undefined;
    const search = searchParams.get('search') ?? undefined;

    const entries = searchGlossary(search, category);
    return NextResponse.json({ entries, total: entries.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/glossary — add new term (admin only)
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.term || !body.definition || !body.category) {
      return NextResponse.json(
        { error: 'term, definition, and category are required' },
        { status: 400 }
      );
    }

    const entry = addGlossaryEntry({
      term: body.term,
      definition: body.definition,
      category: body.category,
      aliases: body.aliases ?? [],
      examples: body.examples ?? [],
      updatedBy: session.user.email,
    });

    return NextResponse.json({ entry }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// PATCH /api/glossary — update term (admin only)
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    const updated = updateGlossaryEntry(body.id, {
      ...(body.term !== undefined && { term: body.term }),
      ...(body.definition !== undefined && { definition: body.definition }),
      ...(body.category !== undefined && { category: body.category }),
      ...(body.aliases !== undefined && { aliases: body.aliases }),
      ...(body.examples !== undefined && { examples: body.examples }),
      updatedBy: session.user.email,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ entry: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/glossary?id=gl_xxx (admin only)
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const deleted = deleteGlossaryEntry(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Entry not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
