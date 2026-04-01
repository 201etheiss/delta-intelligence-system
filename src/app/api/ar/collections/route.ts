/**
 * GET   /api/ar/collections  — Collection queue (?priority=critical&assignedTo=X&status=pending)
 * POST  /api/ar/collections  — Generate collection queue from AR aging
 * PATCH /api/ar/collections  — Update action (log contact, escalate, resolve)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getCollectionQueue,
  getCollectionStats,
  generateCollectionQueue,
  logContact,
  escalate,
  resolve,
  updateCollectionAction,
  type CollectionPriority,
  type CollectionStatus,
  type ContactEntry,
} from '@/lib/engines/ar-collections';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    return { email: session.user.email, role };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as const };
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const params = req.nextUrl.searchParams;
    const priority = params.get('priority') as CollectionPriority | null;
    const assignedTo = params.get('assignedTo');
    const status = params.get('status') as CollectionStatus | null;

    const queue = getCollectionQueue({
      priority: priority ?? undefined,
      assignedTo: assignedTo ?? undefined,
      status: status ?? undefined,
    });
    const stats = getCollectionStats();

    return NextResponse.json({ success: true, data: queue, stats, count: queue.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to load collection queue';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    // Consume body to avoid Next.js warning, but we don't need it
    await req.text().catch(() => {});

    const newActions = await generateCollectionQueue();
    return NextResponse.json(
      { success: true, data: newActions, count: newActions.length, message: `Generated ${newActions.length} new collection actions` },
      { status: 201 }
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to generate collection queue';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin' && user.role !== 'accounting') {
      return NextResponse.json({ success: false, error: 'Admin or accounting access required' }, { status: 403 });
    }

    const body = (await req.json()) as {
      actionId: string;
      operation: 'logContact' | 'escalate' | 'resolve' | 'update';
      contact?: Omit<ContactEntry, 'date' | 'contactedBy'>;
      resolution?: string;
      updates?: { status?: CollectionStatus; assignedTo?: string; nextFollowUp?: string };
    };

    if (!body.actionId) {
      return NextResponse.json({ success: false, error: 'actionId is required' }, { status: 400 });
    }
    if (!body.operation) {
      return NextResponse.json({ success: false, error: 'operation is required' }, { status: 400 });
    }

    let result;
    switch (body.operation) {
      case 'logContact': {
        if (!body.contact?.method || !body.contact?.notes) {
          return NextResponse.json({ success: false, error: 'contact.method and contact.notes are required' }, { status: 400 });
        }
        const entry: ContactEntry = {
          date: new Date().toISOString(),
          method: body.contact.method,
          notes: body.contact.notes,
          contactedBy: user.email,
        };
        result = logContact(body.actionId, entry);
        break;
      }
      case 'escalate':
        result = escalate(body.actionId);
        break;
      case 'resolve':
        if (!body.resolution) {
          return NextResponse.json({ success: false, error: 'resolution is required for resolve operation' }, { status: 400 });
        }
        result = resolve(body.actionId, body.resolution);
        break;
      case 'update':
        if (!body.updates) {
          return NextResponse.json({ success: false, error: 'updates object is required for update operation' }, { status: 400 });
        }
        result = updateCollectionAction(body.actionId, body.updates);
        break;
      default:
        return NextResponse.json({ success: false, error: 'Invalid operation' }, { status: 400 });
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update collection action';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
