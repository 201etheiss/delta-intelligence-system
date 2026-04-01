import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { validateChecksum } from '@/lib/engines/evidence-vault';

/**
 * GET /api/vault/verify?id=ev-xxx
 * Verify checksum integrity for a single evidence entry.
 */
export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const result = validateChecksum(id);
    if (!result) {
      return NextResponse.json({ error: 'Evidence not found' }, { status: 404 });
    }

    return NextResponse.json({ result });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to verify checksum' },
      { status: 500 }
    );
  }
}
