import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import type { UserRole } from '@/lib/config/roles';

// ── Types ────────────────────────────────────────────────────

export interface ReportSchedule {
  id: string;
  name: string;
  prompt: string;
  type: string;
  schedule: string; // cron expression (5-field)
  timezone: string;
  owner: string;
  role: UserRole;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt?: string;
  updatedAt?: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getSchedulesPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/report-schedules.json';
  }
  return path.join(process.cwd(), 'data', 'report-schedules.json');
}

function readSchedules(): ReportSchedule[] {
  const filePath = getSchedulesPath();
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ReportSchedule[];
  } catch {
    return [];
  }
}

function writeSchedules(schedules: ReportSchedule[]): void {
  const filePath = getSchedulesPath();
  writeFileSync(filePath, JSON.stringify(schedules, null, 2), 'utf-8');
}

// ── Auth Guard ───────────────────────────────────────────────

async function requireAuth(): Promise<{ error: NextResponse } | { email: string; role: UserRole }> {
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as UserRole };
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }
  const role = getUserRole(session.user.email);
  return { email: session.user.email, role };
}

// ── Validation ───────────────────────────────────────────────

const CRON_FIELD_RE = /^(\*|(\d+)([-/]\d+)?)(,(\d+)([-/]\d+)?)*$/;

function isValidCron(cron: string): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;
  return parts.every((p) => CRON_FIELD_RE.test(p) || p === '*');
}

function generateId(): string {
  return `sched_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── GET: List all schedules ──────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  const schedules = readSchedules();
  return NextResponse.json({ schedules, count: schedules.length });
}

// ── POST: Create a new schedule ──────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();

    // Validate required fields
    const missing: string[] = [];
    if (!body.name) missing.push('name');
    if (!body.prompt) missing.push('prompt');
    if (!body.schedule) missing.push('schedule');
    if (missing.length > 0) {
      return NextResponse.json(
        { error: `Missing required fields: ${missing.join(', ')}` },
        { status: 400 }
      );
    }

    if (!isValidCron(body.schedule)) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Expected 5-field format: min hour dom month dow' },
        { status: 400 }
      );
    }

    const schedules = readSchedules();

    // Prevent duplicate names
    if (schedules.some((s) => s.name === body.name)) {
      return NextResponse.json(
        { error: `Schedule with name "${body.name}" already exists` },
        { status: 409 }
      );
    }

    const now = new Date().toISOString();
    const newSchedule: ReportSchedule = {
      id: body.id || generateId(),
      name: body.name,
      prompt: body.prompt,
      type: body.type ?? 'auto',
      schedule: body.schedule,
      timezone: body.timezone ?? 'America/Chicago',
      owner: body.owner ?? auth.email,
      role: body.role ?? auth.role,
      enabled: body.enabled ?? true,
      lastRun: null,
      nextRun: null,
      createdAt: now,
      updatedAt: now,
    };

    const updated = [...schedules, newSchedule];
    writeSchedules(updated);

    return NextResponse.json({ success: true, schedule: newSchedule }, { status: 201 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to create schedule';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// ── PATCH: Update an existing schedule ───────────────────────

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const body = await request.json();

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    if (body.schedule && !isValidCron(body.schedule)) {
      return NextResponse.json(
        { error: 'Invalid cron expression. Expected 5-field format: min hour dom month dow' },
        { status: 400 }
      );
    }

    const schedules = readSchedules();
    const idx = schedules.findIndex((s) => s.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ error: `Schedule "${body.id}" not found` }, { status: 404 });
    }

    // Allowlist of mutable fields
    const allowedFields: (keyof ReportSchedule)[] = [
      'name', 'prompt', 'type', 'schedule', 'timezone',
      'owner', 'role', 'enabled',
    ];

    const existing = schedules[idx];
    const patched: ReportSchedule = { ...existing, updatedAt: new Date().toISOString() };

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (patched as any)[field] = body[field];
      }
    }

    const updated = [...schedules];
    updated[idx] = patched;
    writeSchedules(updated);

    return NextResponse.json({ success: true, schedule: patched });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to update schedule';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

// ── DELETE: Remove a schedule ────────────────────────────────

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const auth = await requireAuth();
  if ('error' in auth) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const schedules = readSchedules();
    const filtered = schedules.filter((s) => s.id !== id);

    if (filtered.length === schedules.length) {
      return NextResponse.json({ error: `Schedule "${id}" not found` }, { status: 404 });
    }

    writeSchedules(filtered);
    return NextResponse.json({ success: true, deleted: id });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to delete schedule';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
