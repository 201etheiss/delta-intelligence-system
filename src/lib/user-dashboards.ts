/**
 * User dashboard persistence layer.
 *
 * Stores custom dashboard layouts per user email in data/user-dashboards.json.
 * Server-side only — do not import in client components.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getCatalogItem } from './widget-catalog';
import type { LiveWidgetConfig } from '@/components/dashboard/LiveWidget';

// ── Types ──────────────────────────────────────────────────────────

export type WidgetSize = 'sm' | 'md' | 'lg';

export interface UserDashboardWidget {
  /** References WidgetCatalogItem.id */
  catalogId: string;
  /** 0-based render order / grid position */
  position: number;
  /** sm = 1 col, md = 2 cols, lg = 4 cols (on a 4-col grid) */
  size: WidgetSize;
}

export interface UserDashboard {
  id: string;
  userEmail: string;
  name: string;
  widgets: UserDashboardWidget[];
  createdAt: string;
  updatedAt: string;
}

// ── Storage ────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const FILE_PATH = join(DATA_DIR, 'user-dashboards.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadAll(): UserDashboard[] {
  ensureDataDir();
  if (!existsSync(FILE_PATH)) return [];
  try {
    const raw = readFileSync(FILE_PATH, 'utf-8');
    return JSON.parse(raw) as UserDashboard[];
  } catch {
    return [];
  }
}

function saveAll(dashboards: UserDashboard[]): void {
  ensureDataDir();
  writeFileSync(FILE_PATH, JSON.stringify(dashboards, null, 2), 'utf-8');
}

// ── Public API ────────────────────────────────────────────────────

/**
 * Return all dashboards belonging to a user.
 */
export function getUserDashboards(userEmail: string): UserDashboard[] {
  const all = loadAll();
  return all.filter((d) => d.userEmail.toLowerCase() === userEmail.toLowerCase());
}

/**
 * Get a single dashboard by id, enforcing ownership.
 */
export function getUserDashboard(id: string, userEmail: string): UserDashboard | null {
  const all = loadAll();
  return all.find(
    (d) => d.id === id && d.userEmail.toLowerCase() === userEmail.toLowerCase()
  ) ?? null;
}

/**
 * Create or fully replace a dashboard.
 * If a dashboard with the same id already exists for this user it is overwritten.
 */
export function saveDashboard(dashboard: UserDashboard): UserDashboard {
  const all = loadAll();
  const idx = all.findIndex(
    (d) => d.id === dashboard.id && d.userEmail.toLowerCase() === dashboard.userEmail.toLowerCase()
  );
  const updated: UserDashboard = { ...dashboard, updatedAt: new Date().toISOString() };
  if (idx >= 0) {
    const next = [...all];
    next[idx] = updated;
    saveAll(next);
  } else {
    saveAll([...all, updated]);
  }
  return updated;
}

/**
 * Delete a dashboard by id, enforcing ownership.
 * Returns true if deleted, false if not found.
 */
export function deleteDashboard(id: string, userEmail: string): boolean {
  const all = loadAll();
  const next = all.filter(
    (d) => !(d.id === id && d.userEmail.toLowerCase() === userEmail.toLowerCase())
  );
  if (next.length === all.length) return false;
  saveAll(next);
  return true;
}

/**
 * Generate a new dashboard id.
 */
export function newDashboardId(): string {
  return `ud-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
}

/**
 * Resolve a UserDashboard's widget catalog entries to LiveWidgetConfigs,
 * stamping each with a unique id (catalogId + dashboardId) to avoid collisions
 * when the same catalog widget appears on multiple dashboards.
 */
export function resolveWidgetConfigs(
  dashboard: UserDashboard
): Array<{ widget: UserDashboardWidget; config: LiveWidgetConfig }> {
  const sorted = [...dashboard.widgets].sort((a, b) => a.position - b.position);
  return sorted.flatMap((widget) => {
    const item = getCatalogItem(widget.catalogId);
    if (!item) return [];
    const config: LiveWidgetConfig = {
      ...item.config,
      // Unique id per dashboard instance to isolate auto-refresh timers
      id: `${dashboard.id}__${widget.catalogId}__${widget.position}`,
    };
    return [{ widget, config }];
  });
}
