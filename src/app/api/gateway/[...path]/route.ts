import { type NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { gatewayFetch } from '@/lib/gateway';
import { ROLES, getUserRole, checkServiceAccess, resolveServiceAdmin, type UserRole } from '@/lib/config/roles';
import { authOptions } from '@/lib/auth';

const VALID_ROLES = new Set<UserRole>(['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly']);

const ALLOWED_PREFIXES = [
  '/ascend/',
  '/salesforce/',
  '/samsara/',
  '/powerbi/',
  '/vroozi/',
  '/microsoft/',
  '/fleetpanda/',
];

function validateGatewayPath(gatewayPath: string): string | null {
  // Reject path traversal: literal or encoded variants
  const lower = gatewayPath.toLowerCase();
  if (
    lower.includes('..') ||
    lower.includes('//') ||
    lower.includes('%2e%2e') ||
    lower.includes('%2f%2f')
  ) {
    return 'Invalid gateway path';
  }
  // Enforce allowlist
  const allowed = ALLOWED_PREFIXES.some((prefix) => gatewayPath.startsWith(prefix));
  if (!allowed) {
    return 'Invalid gateway path';
  }
  return null;
}

function resolveRole(header: string | null): UserRole {
  if (header && VALID_ROLES.has(header as UserRole)) {
    return header as UserRole;
  }
  return 'readonly';
}

interface RouteContext {
  params: { path: string[] };
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { path } = context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const role = session?.user?.email ? getUserRole(session.user.email) : resolveRole(request.headers.get('x-user-role'));

  const service = path[0];
  if (!service) {
    return NextResponse.json({ success: false, error: 'Missing service in gateway path' }, { status: 400 });
  }
  const access = checkServiceAccess(role, service);
  if (!access.allowed) {
    // Enrich with dynamic admin from MS Graph org hierarchy
    const userEmail = session?.user?.email ?? undefined;
    const admin = await resolveServiceAdmin(service, userEmail);
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
    const message = `You don't have access to ${serviceName} data with your current role (${ROLES[role].name}). To request access, contact ${admin.name} (${admin.email}) — ${admin.title}.`;
    return NextResponse.json(
      { success: false, error: message },
      { status: 403 }
    );
  }

  const gatewayPath = '/' + path.join('/');
  const pathError = validateGatewayPath(gatewayPath);
  if (pathError) {
    return NextResponse.json({ error: pathError }, { status: 400 });
  }

  const queryString = request.nextUrl.search;
  const fullPath = queryString ? `${gatewayPath}${queryString}` : gatewayPath;

  const result = await gatewayFetch(fullPath, role, { method: 'GET' });
  return NextResponse.json(result);
}

export async function POST(request: NextRequest, context: RouteContext) {
  const { path } = context.params;
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const role = session?.user?.email ? getUserRole(session.user.email) : resolveRole(request.headers.get('x-user-role'));

  const service = path[0];
  if (!service) {
    return NextResponse.json({ success: false, error: 'Missing service in gateway path' }, { status: 400 });
  }
  const access = checkServiceAccess(role, service);
  if (!access.allowed) {
    // Enrich with dynamic admin from MS Graph org hierarchy
    const userEmail = session?.user?.email ?? undefined;
    const admin = await resolveServiceAdmin(service, userEmail);
    const serviceName = service.charAt(0).toUpperCase() + service.slice(1);
    const message = `You don't have access to ${serviceName} data with your current role (${ROLES[role].name}). To request access, contact ${admin.name} (${admin.email}) — ${admin.title}.`;
    return NextResponse.json(
      { success: false, error: message },
      { status: 403 }
    );
  }

  const gatewayPath = '/' + path.join('/');
  const pathError = validateGatewayPath(gatewayPath);
  if (pathError) {
    return NextResponse.json({ error: pathError }, { status: 400 });
  }

  const queryString = request.nextUrl.search;
  const fullPath = queryString ? `${gatewayPath}${queryString}` : gatewayPath;

  // Read body — Next.js may have already consumed the stream for auth check
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    try {
      const cloned = request.clone();
      body = await cloned.json();
    } catch {
      body = undefined;
    }
  }

  // Direct fetch to gateway (bypass gatewayFetch to avoid double-stringify issues)
  const apiKey = process.env[`GATEWAY_${role.toUpperCase()}_KEY`] ?? process.env.GATEWAY_ADMIN_KEY ?? '';
  const gwBase = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
  try {
    const gwRes = await fetch(`${gwBase}${fullPath}`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await gwRes.json();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json({ success: false, error: err instanceof Error ? err.message : 'Gateway POST failed' }, { status: 502 });
  }
}
