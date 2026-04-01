import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { randomBytes } from 'crypto';
import { authOptions } from '@/lib/auth';
import {
  loadAutomations,
  saveAutomations,
  type Automation,
  type Trigger,
  type Action,
  type Condition,
} from '@/lib/automations';
import { seedDefaultAutomations } from '@/lib/default-automations';

// ── Auth Guard ───────────────────────────────────────────────

async function requireAdmin(): Promise<
  { authorized: true } | { authorized: false; response: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    return {
      authorized: false,
      response: NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      ),
    };
  }
  return { authorized: true };
}

// ── GET: List all automations ────────────────────────────────

export async function GET() {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  // Seed default automation rules on first access
  const seedResult = seedDefaultAutomations();

  const automations = loadAutomations();
  return NextResponse.json({
    automations,
    ...(seedResult.seeded ? { seeded: true, seedCount: seedResult.count } : {}),
  });
}

// ── POST: Create new automation ──────────────────────────────

interface CreateBody {
  name: string;
  description: string;
  trigger: Trigger;
  conditions?: Condition[];
  actions: Action[];
}

export async function POST(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const session = await getServerSession(authOptions);

  let body: CreateBody;
  try {
    body = (await request.json()) as CreateBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.name || !body.trigger || !body.actions || body.actions.length === 0) {
    return NextResponse.json(
      { error: 'name, trigger, and at least one action are required' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const automation: Automation = {
    id: randomBytes(8).toString('hex'),
    name: body.name,
    description: body.description ?? '',
    enabled: false,
    trigger: body.trigger,
    conditions: body.conditions ?? [],
    actions: body.actions.map((a) => ({
      ...a,
      id: a.id || randomBytes(4).toString('hex'),
    })),
    createdBy: session?.user?.email ?? 'system',
    createdAt: now,
    updatedAt: now,
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  };

  const automations = loadAutomations();
  saveAutomations([...automations, automation]);

  return NextResponse.json({ automation }, { status: 201 });
}

// ── PATCH: Update automation ─────────────────────────────────

interface PatchBody {
  id: string;
  enabled?: boolean;
  name?: string;
  description?: string;
  trigger?: Trigger;
  conditions?: Condition[];
  actions?: Action[];
}

export async function PATCH(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const automations = loadAutomations();
  const index = automations.findIndex((a) => a.id === body.id);
  if (index === -1) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  const existing = automations[index];
  const updated: Automation = {
    ...existing,
    ...(body.name !== undefined ? { name: body.name } : {}),
    ...(body.description !== undefined ? { description: body.description } : {}),
    ...(body.enabled !== undefined ? { enabled: body.enabled } : {}),
    ...(body.trigger !== undefined ? { trigger: body.trigger } : {}),
    ...(body.conditions !== undefined ? { conditions: body.conditions } : {}),
    ...(body.actions !== undefined ? { actions: body.actions } : {}),
    updatedAt: new Date().toISOString(),
  };

  const newList = automations.map((a, i) => (i === index ? updated : a));
  saveAutomations(newList);

  return NextResponse.json({ automation: updated });
}

// ── DELETE: Remove automation ────────────────────────────────

export async function DELETE(request: NextRequest) {
  const auth = await requireAdmin();
  if (!auth.authorized) return auth.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param required' }, { status: 400 });
  }

  const automations = loadAutomations();
  const filtered = automations.filter((a) => a.id !== id);
  if (filtered.length === automations.length) {
    return NextResponse.json({ error: 'Automation not found' }, { status: 404 });
  }

  saveAutomations(filtered);
  return NextResponse.json({ success: true });
}
