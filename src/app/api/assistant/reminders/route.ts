import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/config/roles';
import {
  addReminder,
  getActiveReminders,
  getAllReminders,
  updateReminderStatus,
  deleteReminder,
} from '@/lib/assistants';

function resolveUser(session: { user?: { email?: string | null; role?: UserRole } } | null, headers: Headers) {
  const email = session?.user?.email ?? 'anonymous';
  const role: UserRole = session?.user?.email
    ? getUserRole(session.user.email)
    : (['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'].includes(headers.get('x-user-role') ?? '')
      ? (headers.get('x-user-role') as UserRole)
      : 'admin');
  return { email, role };
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const { email } = resolveUser(session, request.headers);
    const all = request.nextUrl.searchParams.get('all') === 'true';

    const reminders = all ? getAllReminders(email) : getActiveReminders(email);
    return NextResponse.json({ reminders });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const { email, role } = resolveUser(session, request.headers);

    const body = (await request.json()) as {
      message?: string;
      dueAt?: string;
      recurring?: string;
    };

    if (!body.message || typeof body.message !== 'string') {
      return NextResponse.json({ error: 'message is required' }, { status: 400 });
    }
    if (!body.dueAt || typeof body.dueAt !== 'string') {
      return NextResponse.json({ error: 'dueAt is required (ISO datetime)' }, { status: 400 });
    }

    const reminder = addReminder({
      userEmail: email,
      role,
      message: body.message,
      dueAt: body.dueAt,
      recurring: body.recurring,
    });

    return NextResponse.json({ reminder }, { status: 201 });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  try {
    const body = (await request.json()) as {
      id?: string;
      status?: 'pending' | 'sent' | 'dismissed';
    };

    if (!body.id || typeof body.id !== 'string') {
      return NextResponse.json({ error: 'id is required' }, { status: 400 });
    }
    if (!body.status || !['pending', 'sent', 'dismissed'].includes(body.status)) {
      return NextResponse.json({ error: 'status must be pending, sent, or dismissed' }, { status: 400 });
    }

    const updated = updateReminderStatus(body.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json({ reminder: updated });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const id = request.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    const deleted = deleteReminder(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Reminder not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
