import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { getSpokeById } from '@/lib/spoke-registry';

export interface FederatedToken extends JWTPayload {
  sub: string;
  tenant_id: string;
  role: string;
  spoke_id: string;
  permissions: string[];
  iat: number;
  exp: number;
}

const DEV_SECRET = 'di-federation-dev-secret-do-not-use-in-prod';
const TOKEN_TTL_SECONDS = 3600; // 1 hour

function getSecret(): Uint8Array {
  const raw = process.env.FEDERATION_SECRET ?? DEV_SECRET;
  return new TextEncoder().encode(raw);
}

export async function issueSpokeToken(params: {
  userEmail: string;
  role: string;
  spokeId: string;
  permissions?: string[];
}): Promise<string> {
  const spoke = getSpokeById(params.spokeId);
  if (!spoke) {
    throw new Error(`Unknown spoke: ${params.spokeId}`);
  }

  if (spoke.authType !== 'federation') {
    throw new Error(`Spoke ${params.spokeId} does not use federation auth`);
  }

  const now = Math.floor(Date.now() / 1000);

  const token = await new SignJWT({
    sub: params.userEmail,
    tenant_id: 'delta360',
    role: params.role,
    spoke_id: params.spokeId,
    permissions: params.permissions ?? [],
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(now)
    .setExpirationTime(now + TOKEN_TTL_SECONDS)
    .setIssuer('delta-intelligence')
    .setAudience(params.spokeId)
    .sign(getSecret());

  return token;
}

export async function verifySpokeToken(token: string): Promise<FederatedToken | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), {
      issuer: 'delta-intelligence',
    });

    const fed = payload as unknown as FederatedToken;

    if (!fed.sub || !fed.tenant_id || !fed.role || !fed.spoke_id) {
      return null;
    }

    return fed;
  } catch {
    return null;
  }
}

export async function requireFederatedAuth(
  spokeId: string
): Promise<(req: Request) => Promise<FederatedToken | null>> {
  return async (req: Request): Promise<FederatedToken | null> => {
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.slice(7);
    const verified = await verifySpokeToken(token);

    if (!verified) {
      return null;
    }

    if (verified.spoke_id !== spokeId) {
      return null;
    }

    return verified;
  };
}
