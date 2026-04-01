import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  listNotifications,
  markAsRead,
  markAllAsRead,
  dismissNotification,
  addNotification,
} from '@/lib/notifications-inbox';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const userEmail = session.user.email;
    const notifications = listNotifications(userEmail);
    const unreadCount = notifications.filter((n) => !n.read).length;

    return NextResponse.json({ notifications, unreadCount });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load notifications' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as { id?: string; markAllRead?: boolean; email?: string };

    if (body.markAllRead) {
      const count = markAllAsRead(session.user.email);
      return NextResponse.json({ success: true, markedRead: count });
    }

    if (body.id) {
      const ok = markAsRead(body.id);
      if (!ok) {
        return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: 'Missing id or markAllRead flag' }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update notification' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const body = (await req.json()) as {
      title: string;
      body: string;
      type?: 'alert' | 'info' | 'warning' | 'success' | 'system';
      actionUrl?: string;
      userEmail?: string;
    };

    if (!body.title || !body.body) {
      return NextResponse.json({ error: 'Title and body are required' }, { status: 400 });
    }

    const notification = addNotification({
      title: body.title,
      body: body.body,
      type: body.type ?? 'info',
      actionUrl: body.actionUrl,
      userEmail: body.userEmail,
    });

    return NextResponse.json({ notification }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to create notification' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const id = req.nextUrl.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Missing notification id' }, { status: 400 });
    }

    const ok = dismissNotification(id);
    if (!ok) {
      return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to delete notification' },
      { status: 500 }
    );
  }
}
