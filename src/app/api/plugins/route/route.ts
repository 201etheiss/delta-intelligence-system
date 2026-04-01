import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { routeToPlugin, type RouteOptions } from '@/lib/plugins/router';
import type { PluginCapability } from '@/lib/plugins/types';

// ── POST: Route a capability to the best plugin ──────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const email = session?.user?.email ?? 'dev@delta360.energy';
  const role = getUserRole(email);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const capability = body.capability;
    if (typeof capability !== 'string' || capability.trim().length === 0) {
      return NextResponse.json(
        { success: false, error: 'Missing or invalid capability string' },
        { status: 400 }
      );
    }

    const options: RouteOptions = {
      preferProvider: typeof body.options === 'object' && body.options !== null
        ? (body.options as Record<string, unknown>).preferProvider as string | undefined
        : undefined,
      maxCost: typeof body.options === 'object' && body.options !== null
        ? (body.options as Record<string, unknown>).maxCost as number | undefined
        : undefined,
      teamRole: role,
    };

    const result = routeToPlugin(capability as PluginCapability, options);

    if (!result) {
      return NextResponse.json(
        { success: false, error: `No plugin found for capability: ${capability}` },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to route capability';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
