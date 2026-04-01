import { NextResponse } from 'next/server';
import { verifySpokeToken } from '@/lib/auth/federation';

export async function POST(request: Request): Promise<NextResponse> {
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const token = body.token;
  if (typeof token !== 'string' || token.length === 0) {
    return NextResponse.json(
      { error: 'token is required' },
      { status: 400 }
    );
  }

  const verified = await verifySpokeToken(token);

  if (!verified) {
    return NextResponse.json(
      { valid: false, error: 'Token invalid or expired' },
      { status: 401 }
    );
  }

  return NextResponse.json({
    valid: true,
    claims: {
      sub: verified.sub,
      tenant_id: verified.tenant_id,
      role: verified.role,
      spoke_id: verified.spoke_id,
      permissions: verified.permissions,
      exp: verified.exp,
    },
  });
}
