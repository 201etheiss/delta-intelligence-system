import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { issueSpokeToken } from '@/lib/auth/federation';
import { getSpokeById } from '@/lib/spoke-registry';

export async function POST(request: Request): Promise<NextResponse> {
  // Require authenticated DI session
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required' },
      { status: 401 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const spokeId = body.spokeId;
  if (typeof spokeId !== 'string' || spokeId.length === 0) {
    return NextResponse.json(
      { error: 'spokeId is required' },
      { status: 400 }
    );
  }

  const spoke = getSpokeById(spokeId);
  if (!spoke) {
    return NextResponse.json(
      { error: `Unknown spoke: ${spokeId}` },
      { status: 404 }
    );
  }

  if (spoke.authType !== 'federation') {
    return NextResponse.json(
      { error: `Spoke '${spokeId}' does not use federation auth` },
      { status: 400 }
    );
  }

  const permissions = Array.isArray(body.permissions)
    ? (body.permissions as string[]).filter((p): p is string => typeof p === 'string')
    : [];

  try {
    const token = await issueSpokeToken({
      userEmail: session.user.email,
      role: session.user.role,
      spokeId,
      permissions,
    });

    return NextResponse.json({
      token,
      expiresIn: 3600,
      spokeId,
      issuedTo: session.user.email,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Token issuance failed' },
      { status: 500 }
    );
  }
}
