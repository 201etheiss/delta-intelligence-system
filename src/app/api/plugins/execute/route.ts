import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getPlugin } from '@/lib/plugins/registry';
import { executePlugin } from '@/lib/plugins/proxy';

// ── POST: Execute a plugin ───────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const email = session?.user?.email ?? 'dev@delta360.energy';
  const role = getUserRole(email);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pluginId = body.pluginId;
    const path = body.path;
    const method = typeof body.method === 'string' ? body.method : 'GET';
    const reqBody = body.body;

    if (typeof pluginId !== 'string' || typeof path !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: pluginId, path' },
        { status: 400 }
      );
    }

    // Check plugin exists and user has team access
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    if (plugin.teamAccess.length > 0 && !plugin.teamAccess.includes(role) && !plugin.teamAccess.includes('*')) {
      return NextResponse.json(
        { success: false, error: `Access denied: your role (${role}) is not in this plugin's teamAccess` },
        { status: 403 }
      );
    }

    const result = await executePlugin(pluginId, {
      path,
      method,
      body: reqBody,
      userEmail: email,
      requestSummary: `${method} ${path}`,
    });

    return NextResponse.json({
      success: result.success,
      data: result.data ?? null,
      error: result.error,
      latencyMs: result.latencyMs,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to execute plugin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
