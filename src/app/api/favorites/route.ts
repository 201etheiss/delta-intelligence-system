import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserFavorites, addFavorite, deleteFavorite } from '@/lib/favorites';

// GET /api/favorites
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const favorites = getUserFavorites(userEmail);
    return NextResponse.json({ favorites, total: favorites.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// POST /api/favorites — pin a query
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const body = await request.json();
    if (!body.query || !body.title) {
      return NextResponse.json(
        { error: 'query and title are required' },
        { status: 400 }
      );
    }

    const fav = addFavorite({
      query: body.query,
      title: body.title,
      category: body.category ?? 'general',
      userEmail,
    });

    return NextResponse.json({ favorite: fav }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

// DELETE /api/favorites?id=fav_xxx
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const deleted = deleteFavorite(id, userEmail);
    if (!deleted) {
      return NextResponse.json({ error: 'Favorite not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
