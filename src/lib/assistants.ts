/**
 * Assistant Engine — Data Model & Persistence
 *
 * Role-based AI assistants that learn from interactions, manage reminders,
 * and take actions (email drafts, report schedules, task creation, etc.).
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import type { UserRole } from '@/lib/config/roles';
import { addNotification } from '@/lib/notifications-inbox';
import { notify } from '@/lib/notifications';

// ── Core Types ──────────────────────────────────────────────

export interface Reminder {
  id: string;
  message: string;
  dueAt: string;                   // ISO datetime
  recurring?: string;              // daily, weekly, monthly
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: string;
}

export interface AssistantAction {
  type: 'reminder' | 'calendar' | 'email_draft' | 'task_create' | 'report_schedule' | 'data_alert' | 'note';
  description: string;
  params: Record<string, unknown>;
}

export interface Assistant {
  id: string;
  name: string;
  role: string;                    // which user role this serves
  description: string;
  capabilities: string[];
  systemPrompt: string;
  learnings: string[];
  reminders: Reminder[];
  preferences: Record<string, string>;
  createdAt: string;
  updatedAt: string;
}

// ── Persistence Paths ───────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const ASSISTANTS_PATH = join(DATA_DIR, 'assistants.json');
const REMINDERS_PATH = join(DATA_DIR, 'reminders.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

// ── Assistant CRUD ──────────────────────────────────────────

export function loadAssistants(): Assistant[] {
  if (!existsSync(ASSISTANTS_PATH)) return [];
  try {
    const raw = readFileSync(ASSISTANTS_PATH, 'utf-8');
    return JSON.parse(raw) as Assistant[];
  } catch {
    return [];
  }
}

export function saveAssistants(assistants: Assistant[]): void {
  ensureDataDir();
  writeFileSync(ASSISTANTS_PATH, JSON.stringify(assistants, null, 2), 'utf-8');
}

export function getAssistantForRole(role: UserRole): Assistant | undefined {
  const assistants = loadAssistants();
  // Try exact match first, fall back to 'general' assistant
  return assistants.find(a => a.role === role)
    ?? assistants.find(a => a.role === 'general');
}

// ── Learnings ───────────────────────────────────────────────

export function addLearning(role: UserRole, learning: string): Assistant | undefined {
  const assistants = loadAssistants();
  const idx = assistants.findIndex(a => a.role === role);
  if (idx === -1) return undefined;

  const updated: Assistant = {
    ...assistants[idx],
    learnings: [...assistants[idx].learnings, learning],
    updatedAt: new Date().toISOString(),
  };
  const next = [...assistants];
  next[idx] = updated;
  saveAssistants(next);
  return updated;
}

// ── Reminders ───────────────────────────────────────────────

export interface ReminderEntry {
  id: string;
  userEmail: string;
  role: UserRole;
  message: string;
  dueAt: string;
  recurring?: string;
  status: 'pending' | 'sent' | 'dismissed';
  createdAt: string;
}

function loadRemindersFile(): ReminderEntry[] {
  if (!existsSync(REMINDERS_PATH)) return [];
  try {
    const raw = readFileSync(REMINDERS_PATH, 'utf-8');
    return JSON.parse(raw) as ReminderEntry[];
  } catch {
    return [];
  }
}

function saveRemindersFile(reminders: ReminderEntry[]): void {
  ensureDataDir();
  writeFileSync(REMINDERS_PATH, JSON.stringify(reminders, null, 2), 'utf-8');
}

export function addReminder(entry: Omit<ReminderEntry, 'id' | 'createdAt' | 'status'>): ReminderEntry {
  const reminders = loadRemindersFile();
  const newReminder: ReminderEntry = {
    ...entry,
    id: `rem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    status: 'pending',
    createdAt: new Date().toISOString(),
  };
  saveRemindersFile([...reminders, newReminder]);
  return newReminder;
}

export function getActiveReminders(userEmail: string): ReminderEntry[] {
  const reminders = loadRemindersFile();
  return reminders.filter(r => r.userEmail === userEmail && r.status === 'pending');
}

export function updateReminderStatus(
  id: string,
  status: 'pending' | 'sent' | 'dismissed'
): ReminderEntry | undefined {
  const reminders = loadRemindersFile();
  const idx = reminders.findIndex(r => r.id === id);
  if (idx === -1) return undefined;

  const updated: ReminderEntry = { ...reminders[idx], status };
  const next = [...reminders];
  next[idx] = updated;
  saveRemindersFile(next);
  return updated;
}

export function deleteReminder(id: string): boolean {
  const reminders = loadRemindersFile();
  const filtered = reminders.filter(r => r.id !== id);
  if (filtered.length === reminders.length) return false;
  saveRemindersFile(filtered);
  return true;
}

export function getAllReminders(userEmail: string): ReminderEntry[] {
  const reminders = loadRemindersFile();
  return reminders.filter(r => r.userEmail === userEmail);
}

// ── Due Reminder Check ──────────────────────────────────────

export async function checkDueReminders(): Promise<number> {
  const reminders = loadRemindersFile();
  const now = new Date();
  let count = 0;

  const updated = reminders.map((r) => {
    if (r.status !== 'pending') return r;

    const dueAt = new Date(r.dueAt);
    if (dueAt > now) return r;

    // Reminder is due — create in-app notification
    addNotification({
      title: 'Reminder',
      body: r.message,
      type: 'info',
      actionUrl: `/chat?q=${encodeURIComponent(r.message)}`,
      userEmail: r.userEmail,
    });

    // Optionally send email notification (fire and forget)
    if (r.userEmail) {
      notify({
        channel: 'email',
        to: r.userEmail,
        subject: 'Delta Intelligence Reminder',
        body: r.message,
      }).catch(() => {});
    }

    count++;
    return { ...r, status: 'sent' as const };
  });

  if (count > 0) {
    saveRemindersFile(updated);
  }

  return count;
}

// ── Action Detection ────────────────────────────────────────

export function detectActions(content: string): AssistantAction[] {
  const actions: AssistantAction[] = [];

  if (/remind|reminder|don'?t forget|follow up in|follow.up/i.test(content)) {
    actions.push({ type: 'reminder', description: 'Detected reminder intent', params: {} });
  }
  if (/draft.*email|write.*email|send.*email|compose.*email/i.test(content)) {
    actions.push({ type: 'email_draft', description: 'Detected email draft intent', params: {} });
  }
  if (/schedule.*report|recurring.*report|report.*every/i.test(content)) {
    actions.push({ type: 'report_schedule', description: 'Detected report schedule intent', params: {} });
  }
  if (/create.*task|add.*task|new.*task|to.?do/i.test(content)) {
    actions.push({ type: 'task_create', description: 'Detected task creation intent', params: {} });
  }
  if (/calendar|meeting|schedule.*meeting|book.*time/i.test(content)) {
    actions.push({ type: 'calendar', description: 'Detected calendar intent', params: {} });
  }
  if (/alert.*when|notify.*when|watch.*for|flag.*if/i.test(content)) {
    actions.push({ type: 'data_alert', description: 'Detected data alert intent', params: {} });
  }
  if (/add.*note|remember.*that|note.*that|save.*note/i.test(content)) {
    actions.push({ type: 'note', description: 'Detected note/learning intent', params: {} });
  }

  return actions;
}
