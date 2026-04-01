/**
 * Generated Documentation API Route
 *
 * GET: List all generated docs, filter by category, or get by ID
 * POST: Trigger doc regeneration for a category (or all)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listDocs,
  getDocById,
  regenerateDocs,
  getDocCategories,
  type DocCategory,
} from '@/lib/doc-generator';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const category = req.nextUrl.searchParams.get('category') as DocCategory | null;
    const id = req.nextUrl.searchParams.get('id');
    const mode = req.nextUrl.searchParams.get('mode');

    // List available categories
    if (mode === 'categories') {
      return NextResponse.json({ categories: getDocCategories() });
    }

    // Get specific doc by ID
    if (id) {
      const doc = getDocById(id);
      if (!doc) {
        return NextResponse.json({ error: `Document not found: ${id}` }, { status: 404 });
      }
      return NextResponse.json({ doc });
    }

    // List docs, optionally filtered by category
    const validCategories = getDocCategories();
    if (category && !validCategories.includes(category)) {
      return NextResponse.json(
        { error: `Invalid category: ${category}. Valid: ${validCategories.join(', ')}` },
        { status: 400 }
      );
    }

    const docs = listDocs(category ?? undefined);
    return NextResponse.json({
      docs,
      total: docs.length,
      categories: validCategories,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to list docs' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    let category: DocCategory | undefined;

    // Parse body if present
    try {
      const body = await req.json() as { category?: string };
      if (body.category) {
        const validCategories = getDocCategories();
        if (!validCategories.includes(body.category as DocCategory)) {
          return NextResponse.json(
            { error: `Invalid category: ${body.category}. Valid: ${validCategories.join(', ')}` },
            { status: 400 }
          );
        }
        category = body.category as DocCategory;
      }
    } catch {
      // No body or invalid JSON — regenerate all
    }

    const docs = regenerateDocs(category);
    return NextResponse.json({
      docs,
      total: docs.length,
      regeneratedCategory: category ?? 'all',
      triggeredBy: session.user.email,
      message: `Documentation regenerated for ${category ?? 'all categories'}`,
    }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Documentation generation failed' },
      { status: 500 }
    );
  }
}
