import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  readRules,
  createRule,
  updateRule,
  deleteRule,
  snoozeRule,
  acknowledgeRule,
  unsnoozeRule,
} from '@/lib/alerts-engine';
import type { AlertRule } from '@/lib/alerts-engine';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const rules = readRules();
    return NextResponse.json({ rules });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load alert rules' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as AlertRule;

    if (!body.id || !body.name || !body.metric) {
      return NextResponse.json(
        { error: 'id, name, and metric are required' },
        { status: 400 }
      );
    }

    const rule = createRule(body);
    return NextResponse.json({ rule }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create alert rule' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      id: string;
      action?: 'snooze' | 'acknowledge' | 'unsnooze';
      snoozeDuration?: number;
    } & Partial<AlertRule>;

    if (!body.id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }

    let rule: AlertRule;

    if (body.action === 'snooze') {
      rule = snoozeRule(body.id, body.snoozeDuration ?? 60);
    } else if (body.action === 'acknowledge') {
      rule = acknowledgeRule(body.id);
    } else if (body.action === 'unsnooze') {
      rule = unsnoozeRule(body.id);
    } else {
      const { id, action: _action, snoozeDuration: _sd, ...patch } = body;
      rule = updateRule(id, patch);
    }

    return NextResponse.json({ rule });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update alert rule' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing alert rule id' }, { status: 400 });
    }

    const ok = deleteRule(id);
    if (!ok) {
      return NextResponse.json({ error: 'Alert rule not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete alert rule' },
      { status: 500 }
    );
  }
}
