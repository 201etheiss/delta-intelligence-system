import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { authOptions } from '@/lib/auth';
import type { Dashboard, DashboardVisibility, Widget } from '@/lib/widgets';

const DASHBOARDS_PATH = join(process.cwd(), 'data', 'dashboards.json');

function loadDashboards(): Dashboard[] {
  if (!existsSync(DASHBOARDS_PATH)) return [];
  try {
    const raw = readFileSync(DASHBOARDS_PATH, 'utf-8');
    return JSON.parse(raw) as Dashboard[];
  } catch {
    return [];
  }
}

function saveDashboards(dashboards: Dashboard[]): void {
  writeFileSync(DASHBOARDS_PATH, JSON.stringify(dashboards, null, 2), 'utf-8');
}

// ─── GET: List all dashboards ─────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const dashboards = loadDashboards();
  return NextResponse.json({ success: true, dashboards });
}

// ─── POST: Create a new dashboard ─────────────────────────────────

interface CreateRequest {
  name: string;
  description?: string;
  widgets?: Widget[];
  visibility?: DashboardVisibility;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as CreateRequest;

    if (!body.name || body.name.trim().length === 0) {
      return NextResponse.json({ error: 'Dashboard name is required' }, { status: 400 });
    }

    const now = new Date().toISOString();
    const id = `dash-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
    const createdBy = session?.user?.email ?? 'dev@delta360.energy';

    const dashboard: Dashboard = {
      id,
      name: body.name.trim(),
      description: body.description?.trim() ?? '',
      widgets: body.widgets ?? [],
      createdBy,
      createdAt: now,
      updatedAt: now,
      isDefault: false,
      visibility: body.visibility ?? 'private',
    };

    const dashboards = loadDashboards();
    dashboards.push(dashboard);
    saveDashboards(dashboards);

    return NextResponse.json({ success: true, dashboard }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// ─── PATCH: Update a dashboard ────────────────────────────────────

interface PatchRequest {
  id: string;
  name?: string;
  description?: string;
  widgets?: Widget[];
  visibility?: DashboardVisibility;
  isDefault?: boolean;
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const body = (await request.json()) as PatchRequest;

    if (!body.id) {
      return NextResponse.json({ error: 'Dashboard id is required' }, { status: 400 });
    }

    const dashboards = loadDashboards();
    const idx = dashboards.findIndex((d) => d.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
    }

    const existing = dashboards[idx];
    const updated: Dashboard = {
      ...existing,
      name: body.name?.trim() ?? existing.name,
      description: body.description?.trim() ?? existing.description,
      widgets: body.widgets ?? existing.widgets,
      visibility: body.visibility ?? existing.visibility,
      isDefault: body.isDefault ?? existing.isDefault,
      updatedAt: new Date().toISOString(),
    };

    dashboards[idx] = updated;
    saveDashboards(dashboards);

    return NextResponse.json({ success: true, dashboard: updated });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

// ─── DELETE: Remove a dashboard ───────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const url = new URL(request.url);
  const id = url.searchParams.get('id');

  if (!id) {
    return NextResponse.json({ error: 'Dashboard id is required' }, { status: 400 });
  }

  const dashboards = loadDashboards();
  const idx = dashboards.findIndex((d) => d.id === id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
  }

  const removed = dashboards[idx];
  dashboards.splice(idx, 1);
  saveDashboards(dashboards);

  return NextResponse.json({ success: true, deleted: removed.id });
}
