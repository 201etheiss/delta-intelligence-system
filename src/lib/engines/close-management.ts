/**
 * Close Management Engine
 * Tracks month-end close checklists, task completion, and progress.
 * File persistence to data/close-periods.json and data/close-templates.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CloseStatus = 'open' | 'in_progress' | 'completed';
export type CloseItemStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';

export interface CloseItem {
  readonly id: string;
  readonly task: string;
  readonly day: number;
  readonly owner: string;
  readonly status: CloseItemStatus;
  readonly dependency: string | null;
  readonly completedAt: string | null;
  readonly completedBy: string | null;
  readonly notes: string;
  readonly evidence: string | null;
}

export interface CloseChecklist {
  readonly id: string;
  readonly period: string; // "YYYY-MM"
  readonly status: CloseStatus;
  readonly items: readonly CloseItem[];
  readonly createdAt: string;
  readonly completedAt: string | null;
  readonly targetDay: number;
}

export interface CloseTemplateItem {
  readonly task: string;
  readonly day: number;
  readonly owner: string;
  readonly dependency: string | null;
}

export interface CloseTemplate {
  readonly id: string;
  readonly name: string;
  readonly items: readonly CloseTemplateItem[];
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const CLOSE_FILE = join(DATA_DIR, 'close-periods.json');
const TEMPLATE_FILE = join(DATA_DIR, 'close-templates.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCloses(): readonly CloseChecklist[] {
  ensureDataDir();
  if (!existsSync(CLOSE_FILE)) return [];
  try {
    const raw = readFileSync(CLOSE_FILE, 'utf-8');
    return JSON.parse(raw) as CloseChecklist[];
  } catch {
    return [];
  }
}

function writeCloses(checklists: readonly CloseChecklist[]): void {
  ensureDataDir();
  writeFileSync(CLOSE_FILE, JSON.stringify(checklists, null, 2), 'utf-8');
}

export function readCloseTemplates(): readonly CloseTemplate[] {
  ensureDataDir();
  if (!existsSync(TEMPLATE_FILE)) return [];
  try {
    const raw = readFileSync(TEMPLATE_FILE, 'utf-8');
    return JSON.parse(raw) as CloseTemplate[];
  } catch {
    return [];
  }
}

export function writeCloseTemplates(templates: readonly CloseTemplate[]): void {
  ensureDataDir();
  writeFileSync(TEMPLATE_FILE, JSON.stringify(templates, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Create close period from template
// ---------------------------------------------------------------------------

export function createClose(period: string, templateId?: string): CloseChecklist {
  // Check if period already exists
  const existing = readCloses();
  if (existing.find((c) => c.period === period)) {
    throw new Error(`Close period ${period} already exists`);
  }

  // Validate period format
  if (!/^\d{4}-\d{2}$/.test(period)) {
    throw new Error('Period must be in YYYY-MM format');
  }

  const templates = readCloseTemplates();
  const template = templateId
    ? templates.find((t) => t.id === templateId)
    : templates[0]; // default to first template

  if (!template) {
    throw new Error(templateId ? `Template ${templateId} not found` : 'No close templates available');
  }

  const items: CloseItem[] = template.items.map((ti) => ({
    id: generateId('CI'),
    task: ti.task,
    day: ti.day,
    owner: ti.owner,
    status: 'pending' as const,
    dependency: ti.dependency,
    completedAt: null,
    completedBy: null,
    notes: '',
    evidence: null,
  }));

  const now = new Date().toISOString();
  const checklist: CloseChecklist = {
    id: generateId('CL'),
    period,
    status: 'open',
    items,
    createdAt: now,
    completedAt: null,
    targetDay: 5,
  };

  writeCloses([...existing, checklist]);
  return checklist;
}

// ---------------------------------------------------------------------------
// Get / query
// ---------------------------------------------------------------------------

export function getClose(period: string): CloseChecklist | undefined {
  return readCloses().find((c) => c.period === period);
}

export function getCloseById(id: string): CloseChecklist | undefined {
  return readCloses().find((c) => c.id === id);
}

export function getAllCloses(filters?: { status?: CloseStatus }): readonly CloseChecklist[] {
  let results = [...readCloses()];
  if (filters?.status) {
    results = results.filter((c) => c.status === filters.status);
  }
  return results;
}

// ---------------------------------------------------------------------------
// Update item
// ---------------------------------------------------------------------------

export function updateItem(
  closeId: string,
  itemId: string,
  patch: {
    status?: CloseItemStatus;
    completedBy?: string;
    notes?: string;
    evidence?: string;
  }
): CloseChecklist {
  const all = [...readCloses()];
  const idx = all.findIndex((c) => c.id === closeId);
  if (idx === -1) throw new Error(`Close period ${closeId} not found`);

  const checklist = all[idx];
  const itemIdx = checklist.items.findIndex((i) => i.id === itemId);
  if (itemIdx === -1) throw new Error(`Close item ${itemId} not found`);

  const item = checklist.items[itemIdx];

  // Check dependencies — cannot complete if dependency is not completed
  if (patch.status === 'completed' && item.dependency) {
    const depItem = checklist.items.find((i) => i.id === item.dependency);
    if (depItem && depItem.status !== 'completed') {
      throw new Error(`Cannot complete — dependency "${depItem.task}" is not yet completed`);
    }
  }

  const updatedItem: CloseItem = {
    ...item,
    status: patch.status ?? item.status,
    completedBy: patch.status === 'completed' ? (patch.completedBy ?? item.completedBy) : item.completedBy,
    completedAt: patch.status === 'completed' ? new Date().toISOString() : item.completedAt,
    notes: patch.notes ?? item.notes,
    evidence: patch.evidence ?? item.evidence,
  };

  const updatedItems = [
    ...checklist.items.slice(0, itemIdx),
    updatedItem,
    ...checklist.items.slice(itemIdx + 1),
  ];

  // Determine overall status
  const allCompleted = updatedItems.every((i) => i.status === 'completed');
  const anyStarted = updatedItems.some((i) => i.status !== 'pending');

  const updatedChecklist: CloseChecklist = {
    ...checklist,
    items: updatedItems,
    status: allCompleted ? 'completed' : anyStarted ? 'in_progress' : 'open',
    completedAt: allCompleted ? new Date().toISOString() : null,
  };

  const updated = [...all.slice(0, idx), updatedChecklist, ...all.slice(idx + 1)];
  writeCloses(updated);
  return updatedChecklist;
}

// ---------------------------------------------------------------------------
// Progress helpers
// ---------------------------------------------------------------------------

export interface CloseProgress {
  readonly period: string;
  readonly status: CloseStatus;
  readonly totalItems: number;
  readonly completed: number;
  readonly inProgress: number;
  readonly blocked: number;
  readonly pending: number;
  readonly percentComplete: number;
  readonly dayProgress: readonly DayProgress[];
}

export interface DayProgress {
  readonly day: number;
  readonly totalItems: number;
  readonly completed: number;
  readonly percentComplete: number;
}

export function getCloseProgress(period: string): CloseProgress | undefined {
  const checklist = getClose(period);
  if (!checklist) return undefined;

  const items = checklist.items ?? [];
  const completed = items.filter((i) => i.status === 'completed').length;
  const inProgress = items.filter((i) => i.status === 'in_progress').length;
  const blocked = items.filter((i) => i.status === 'blocked').length;
  const pending = items.filter((i) => i.status === 'pending').length;
  const total = items.length;

  const days = Array.from(new Set(items.map((i) => i.day))).sort((a, b) => a - b);
  const dayProgress: DayProgress[] = days.map((day) => {
    const dayItems = items.filter((i) => i.day === day);
    const dayCompleted = dayItems.filter((i) => i.status === 'completed').length;
    return {
      day,
      totalItems: dayItems.length,
      completed: dayCompleted,
      percentComplete: dayItems.length > 0 ? Math.round((dayCompleted / dayItems.length) * 100) : 0,
    };
  });

  return {
    period: checklist.period,
    status: checklist.status,
    totalItems: total,
    completed,
    inProgress,
    blocked,
    pending,
    percentComplete: total > 0 ? Math.round((completed / total) * 100) : 0,
    dayProgress,
  };
}

export function getOverdueItems(): readonly (CloseItem & { period: string; closeId: string })[] {
  const now = new Date();
  const currentDay = now.getDate();

  return readCloses()
    .filter((c) => c.status !== 'completed')
    .flatMap((c) =>
      (c.items ?? [])
        .filter((item) => item.status !== 'completed' && item.day < currentDay)
        .map((item) => ({ ...item, period: c.period, closeId: c.id }))
    );
}

export function getDayProgress(period: string, day: number): DayProgress | undefined {
  const progress = getCloseProgress(period);
  if (!progress) return undefined;
  return progress.dayProgress.find((d) => d.day === day);
}
