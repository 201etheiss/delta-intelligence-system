/**
 * In-App Notifications Inbox
 *
 * Stores and manages notifications displayed in the header bell dropdown.
 * Persists to data/notifications-inbox.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────

export type NotificationType = 'alert' | 'info' | 'warning' | 'success' | 'system';

export interface InboxNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
  userEmail?: string;
}

interface NotificationsFile {
  notifications: InboxNotification[];
}

// ── File I/O ─────────────────────────────────────────────────

function getFilePath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/notifications-inbox.json';
  }
  return path.join(process.cwd(), 'data', 'notifications-inbox.json');
}

function readFile(): NotificationsFile {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { notifications: [] };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as NotificationsFile;
  } catch {
    return { notifications: [] };
  }
}

function writeFile(data: NotificationsFile): void {
  const filePath = getFilePath();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── CRUD ─────────────────────────────────────────────────────

export function listNotifications(userEmail?: string): InboxNotification[] {
  const data = readFile();
  const all = data.notifications ?? [];

  // Return notifications for the user (or all if no userEmail filter)
  const filtered = userEmail
    ? all.filter((n) => !n.userEmail || n.userEmail === userEmail)
    : all;

  // Sort: unread first, then by date desc
  return [...filtered].sort((a, b) => {
    if (a.read !== b.read) return a.read ? 1 : -1;
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });
}

export function getUnreadCount(userEmail?: string): number {
  return listNotifications(userEmail).filter((n) => !n.read).length;
}

export function addNotification(
  notification: Omit<InboxNotification, 'id' | 'createdAt' | 'read'>
): InboxNotification {
  const data = readFile();
  const entry: InboxNotification = {
    ...notification,
    id: `notif-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    read: false,
    createdAt: new Date().toISOString(),
  };

  const updated: NotificationsFile = {
    notifications: [entry, ...(data.notifications ?? [])],
  };

  // Cap at 500 notifications
  if (updated.notifications.length > 500) {
    updated.notifications = updated.notifications.slice(0, 500);
  }

  writeFile(updated);
  return entry;
}

export function markAsRead(id: string): boolean {
  const data = readFile();
  const idx = (data.notifications ?? []).findIndex((n) => n.id === id);
  if (idx === -1) return false;

  const notifications = [...(data.notifications ?? [])];
  notifications[idx] = { ...notifications[idx], read: true };
  writeFile({ notifications });
  return true;
}

export function markAllAsRead(userEmail?: string): number {
  const data = readFile();
  let count = 0;
  const notifications = (data.notifications ?? []).map((n) => {
    if (!n.read && (!userEmail || !n.userEmail || n.userEmail === userEmail)) {
      count++;
      return { ...n, read: true };
    }
    return n;
  });
  writeFile({ notifications });
  return count;
}

export function dismissNotification(id: string): boolean {
  const data = readFile();
  const before = (data.notifications ?? []).length;
  const notifications = (data.notifications ?? []).filter((n) => n.id !== id);
  if (notifications.length === before) return false;
  writeFile({ notifications });
  return true;
}
