import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getWhiteLabelConfig,
  updateWhiteLabelConfig,
  type WhiteLabelConfig,
} from '@/lib/white-label';
import { getUserRole } from '@/lib/config/roles';

/**
 * GET /api/config — return white-label configuration (public)
 */
export async function GET(): Promise<NextResponse> {
  const config = getWhiteLabelConfig();
  return NextResponse.json({ success: true, config });
}

/**
 * PATCH /api/config — update white-label configuration (admin only)
 */
export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);

  // Auth check: require admin role
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    if (role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }
  } else if (process.env.NODE_ENV !== 'development') {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  try {
    const body = (await request.json()) as Partial<WhiteLabelConfig>;

    // Validate: only allow known keys
    const allowed = new Set([
      'companyName',
      'platformName',
      'primaryColor',
      'logoUrl',
      'logoMarkUrl',
      'domain',
      'supportEmail',
    ]);
    const patch: Partial<WhiteLabelConfig> = {};
    for (const [key, value] of Object.entries(body)) {
      if (allowed.has(key) && typeof value === 'string' && value.trim()) {
        (patch as Record<string, string>)[key] = value.trim();
      }
    }

    if (Object.keys(patch).length === 0) {
      return NextResponse.json(
        { error: 'No valid fields provided' },
        { status: 400 }
      );
    }

    const updated = updateWhiteLabelConfig(patch);
    return NextResponse.json({ success: true, config: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }
    const msg =
      error instanceof Error ? error.message : 'Failed to update config';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
