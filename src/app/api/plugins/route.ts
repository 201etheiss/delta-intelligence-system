import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import type { PluginCapability, PluginCategory, PluginConfig, PluginStatus } from '@/lib/plugins/types';
import { loadPlugins, savePlugins, getPlugin } from '@/lib/plugins/registry';

// ── Helpers ──────────────────────────────────────────────────

async function getSessionAndRole() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return { session: null, role: null, email: null };
  }
  const email = session?.user?.email ?? 'dev@delta360.energy';
  const role = getUserRole(email);
  return { session, role, email };
}

function isAdmin(role: string | null): boolean {
  return role === 'admin';
}

function isValidRegisterInput(body: unknown): body is {
  name: string;
  provider: string;
  description: string;
  category: PluginCategory;
  capabilities: PluginCapability[];
  baseUrl: string;
  authType: PluginConfig['authType'];
  authEnvVar: string;
  teamAccess: string[];
} {
  if (typeof body !== 'object' || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    typeof b.name === 'string' &&
    typeof b.provider === 'string' &&
    typeof b.description === 'string' &&
    typeof b.category === 'string' &&
    Array.isArray(b.capabilities) &&
    typeof b.baseUrl === 'string' &&
    typeof b.authType === 'string' &&
    typeof b.authEnvVar === 'string' &&
    Array.isArray(b.teamAccess)
  );
}

function isValidUpdateInput(body: unknown): body is { id: string } & Record<string, unknown> {
  if (typeof body !== 'object' || body === null) return false;
  return typeof (body as Record<string, unknown>).id === 'string';
}

// ── GET: List plugins with optional filters ──────────────────

export async function GET(request: Request) {
  const { role } = await getSessionAndRole();
  if (!role) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category');
  const capability = searchParams.get('capability');
  const status = searchParams.get('status');
  const team = searchParams.get('team');

  try {
    let plugins = loadPlugins();

    if (category) {
      plugins = plugins.filter((p) => p.category === category);
    }
    if (capability) {
      const cap = capability as PluginCapability;
      plugins = plugins.filter((p) => p.capabilities.includes(cap));
    }
    if (status) {
      plugins = plugins.filter((p) => p.status === status);
    }
    if (team) {
      plugins = plugins.filter((p) => p.teamAccess.includes(team));
    }

    return NextResponse.json({ success: true, data: plugins, count: plugins.length });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to list plugins';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── POST: Register a new plugin (admin only) ─────────────────

export async function POST(request: Request) {
  const { role } = await getSessionAndRole();
  if (!role) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!isAdmin(role)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (!isValidRegisterInput(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid input: requires name, provider, description, category, capabilities, baseUrl, authType, authEnvVar, teamAccess' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const id = `plg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const b = body as Record<string, unknown>;

    const plugin: PluginConfig = {
      id,
      name: body.name,
      provider: body.provider,
      description: body.description,
      category: body.category,
      capabilities: [...body.capabilities],
      status: 'active' as PluginStatus,
      baseUrl: body.baseUrl,
      authType: body.authType,
      authEnvVar: body.authEnvVar,
      authHeader: typeof b.authHeader === 'string' ? b.authHeader : undefined,
      qualityScore: 0.5,
      costPerCall: typeof b.costPerCall === 'number' ? b.costPerCall : 0,
      latencyP95Ms: 0,
      reliabilityScore: 1.0,
      rateLimitPerMinute: typeof b.rateLimitPerMinute === 'number' ? b.rateLimitPerMinute : 60,
      rateLimitPerDay: typeof b.rateLimitPerDay === 'number' ? b.rateLimitPerDay : 10000,
      docsUrl: typeof b.docsUrl === 'string' ? b.docsUrl : '',
      pricingUrl: typeof b.pricingUrl === 'string' ? b.pricingUrl : undefined,
      tags: Array.isArray(b.tags) ? (b.tags as string[]) : [],
      teamAccess: [...body.teamAccess],
      createdAt: now,
      updatedAt: now,
      totalCalls: 0,
      totalCost: 0,
      avgRating: 0,
      ratingCount: 0,
    };

    const existing = loadPlugins();
    savePlugins([...existing, plugin]);

    return NextResponse.json({ success: true, data: plugin }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to register plugin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── PATCH: Update plugin config (admin only) ─────────────────

export async function PATCH(request: Request) {
  const { role } = await getSessionAndRole();
  if (!role) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!isAdmin(role)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const body: unknown = await request.json();
    if (!isValidUpdateInput(body)) {
      return NextResponse.json(
        { success: false, error: 'Invalid input: requires id' },
        { status: 400 }
      );
    }

    const b = body as Record<string, unknown>;
    const id = b.id as string;
    const plugins = loadPlugins();
    const idx = plugins.findIndex((p) => p.id === id);

    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    const existing = plugins[idx];
    const updated: PluginConfig = {
      ...existing,
      name: typeof b.name === 'string' ? b.name : existing.name,
      description: typeof b.description === 'string' ? b.description : existing.description,
      status: typeof b.status === 'string' ? (b.status as PluginStatus) : existing.status,
      teamAccess: Array.isArray(b.teamAccess) ? (b.teamAccess as string[]) : existing.teamAccess,
      costPerCall: typeof b.costPerCall === 'number' ? b.costPerCall : existing.costPerCall,
      rateLimitPerMinute: typeof b.rateLimitPerMinute === 'number' ? b.rateLimitPerMinute : existing.rateLimitPerMinute,
      rateLimitPerDay: typeof b.rateLimitPerDay === 'number' ? b.rateLimitPerDay : existing.rateLimitPerDay,
      tags: Array.isArray(b.tags) ? (b.tags as string[]) : existing.tags,
      updatedAt: new Date().toISOString(),
    };

    const next = [...plugins.slice(0, idx), updated, ...plugins.slice(idx + 1)];
    savePlugins(next);

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update plugin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── DELETE: Remove a plugin (admin only) ─────────────────────

export async function DELETE(request: Request) {
  const { role } = await getSessionAndRole();
  if (!role) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }
  if (!isAdmin(role)) {
    return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing plugin id' }, { status: 400 });
    }

    const plugins = loadPlugins();
    const idx = plugins.findIndex((p) => p.id === id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    const next = [...plugins.slice(0, idx), ...plugins.slice(idx + 1)];
    savePlugins(next);

    return NextResponse.json({ success: true, message: 'Plugin deleted' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete plugin';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
