/**
 * /api/user-dashboards
 *
 * GET    — List all dashboards for the authenticated user
 * POST   — Create or overwrite a dashboard layout
 * DELETE — Remove a dashboard by id (body: { id })
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  getUserDashboards,
  saveDashboard,
  deleteDashboard,
  newDashboardId,
  type UserDashboard,
  type UserDashboardWidget,
} from '@/lib/user-dashboards';
import { WIDGET_CATALOG } from '@/lib/widget-catalog';

// ─── helpers ──────────────────────────────────────────────────────

function resolveUserEmail(session: { user?: { email?: string | null } } | null): string | null {
  if (session?.user?.email) return session.user.email;
  if (process.env.NODE_ENV === 'development') return 'dev@delta360.energy';
  return null;
}

function isValidSize(s: unknown): s is 'sm' | 'md' | 'lg' {
  return s === 'sm' || s === 'md' || s === 'lg';
}

function validateWidgets(raw: unknown): UserDashboardWidget[] | null {
  if (!Array.isArray(raw)) return null;
  const result: UserDashboardWidget[] = [];
  for (const item of raw) {
    if (
      typeof item !== 'object' ||
      item === null ||
      typeof (item as Record<string, unknown>).catalogId !== 'string' ||
      typeof (item as Record<string, unknown>).position !== 'number' ||
      !isValidSize((item as Record<string, unknown>).size)
    ) {
      return null;
    }
    // Validate catalog id exists
    const exists = WIDGET_CATALOG.some(
      (c) => c.id === (item as Record<string, unknown>).catalogId
    );
    if (!exists) return null;
    result.push(item as UserDashboardWidget);
  }
  return result;
}

// ─── GET ──────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userEmail = resolveUserEmail(session);
  if (!userEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const dashboards = getUserDashboards(userEmail);
  return NextResponse.json({ success: true, dashboards });
}

// ─── POST ─────────────────────────────────────────────────────────

interface SaveRequest {
  id?: string;
  name?: string;
  widgets?: unknown;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userEmail = resolveUserEmail(session);
  if (!userEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: SaveRequest;
  try {
    body = (await request.json()) as SaveRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const name = typeof body.name === 'string' ? body.name.trim() : '';
  if (!name) {
    return NextResponse.json({ error: 'Dashboard name is required' }, { status: 400 });
  }

  const widgets = validateWidgets(body.widgets ?? []);
  if (widgets === null) {
    return NextResponse.json({ error: 'Invalid widget list' }, { status: 400 });
  }

  const now = new Date().toISOString();
  const id = typeof body.id === 'string' && body.id.trim() ? body.id.trim() : newDashboardId();

  const dashboard: UserDashboard = {
    id,
    userEmail,
    name,
    widgets,
    createdAt: now,
    updatedAt: now,
  };

  const saved = saveDashboard(dashboard);
  return NextResponse.json({ success: true, dashboard: saved }, { status: 201 });
}

// ─── DELETE ───────────────────────────────────────────────────────

interface DeleteRequest {
  id?: string;
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const userEmail = resolveUserEmail(session);
  if (!userEmail) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: DeleteRequest;
  try {
    body = (await request.json()) as DeleteRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const deleted = deleteDashboard(body.id, userEmail);
  if (!deleted) {
    return NextResponse.json({ error: 'Dashboard not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true });
}
