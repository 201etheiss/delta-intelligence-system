/**
 * Audit / PBC Portal Engine
 * Manages audit requests from external auditors, tracks fulfillment,
 * and links to evidence vault entries.
 * File persistence to data/audit-requests.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuditRequestStatus = 'open' | 'in_progress' | 'fulfilled' | 'overdue';

export interface AuditRequest {
  readonly id: string;
  readonly auditorName: string;
  readonly auditorFirm: string;
  readonly requestDescription: string;
  readonly requestedItems: readonly string[];
  readonly dueDate: string; // ISO date
  readonly status: AuditRequestStatus;
  readonly assignedTo: string | null;
  readonly evidenceIds: readonly string[];
  readonly fulfilledAt: string | null;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AuditDashboard {
  readonly totalRequests: number;
  readonly openRequests: number;
  readonly overdueRequests: number;
  readonly inProgressRequests: number;
  readonly fulfilledRequests: number;
  readonly fulfilledThisMonth: number;
  readonly avgDaysToFulfill: number;
  readonly agingBuckets: ReadonlyArray<{ readonly label: string; readonly count: number }>;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const AUDIT_FILE = join(DATA_DIR, 'audit-requests.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readRequests(): readonly AuditRequest[] {
  ensureDataDir();
  if (!existsSync(AUDIT_FILE)) return [];
  try {
    const raw = readFileSync(AUDIT_FILE, 'utf-8');
    return JSON.parse(raw) as AuditRequest[];
  } catch {
    return [];
  }
}

function writeRequests(requests: readonly AuditRequest[]): void {
  ensureDataDir();
  writeFileSync(AUDIT_FILE, JSON.stringify(requests, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `aud-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000;
  return Math.round(
    (new Date(b).getTime() - new Date(a).getTime()) / msPerDay
  );
}

/**
 * Auto-detect overdue requests and update their status.
 */
function applyOverdueStatus(requests: readonly AuditRequest[]): readonly AuditRequest[] {
  const now = new Date().toISOString();
  let changed = false;

  const updated = requests.map((r) => {
    if (
      (r.status === 'open' || r.status === 'in_progress') &&
      new Date(r.dueDate) < new Date(now)
    ) {
      changed = true;
      return { ...r, status: 'overdue' as const, updatedAt: now };
    }
    return r;
  });

  if (changed) {
    writeRequests(updated);
  }
  return updated;
}

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Create a new audit request.
 */
export function createRequest(input: {
  auditorName: string;
  auditorFirm: string;
  requestDescription: string;
  requestedItems: readonly string[];
  dueDate: string;
  notes?: string;
}): AuditRequest {
  const now = new Date().toISOString();
  const request: AuditRequest = {
    id: generateId(),
    auditorName: input.auditorName,
    auditorFirm: input.auditorFirm,
    requestDescription: input.requestDescription,
    requestedItems: input.requestedItems,
    dueDate: input.dueDate,
    status: 'open',
    assignedTo: null,
    evidenceIds: [],
    fulfilledAt: null,
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const existing = readRequests();
  writeRequests([...existing, request]);

  return request;
}

/**
 * Assign a request to a team member.
 */
export function assignRequest(id: string, assignedTo: string): AuditRequest | null {
  const requests = readRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const updated: AuditRequest = {
    ...requests[idx],
    assignedTo,
    status: requests[idx].status === 'open' ? 'in_progress' : requests[idx].status,
    updatedAt: new Date().toISOString(),
  };

  const newList = [...requests.slice(0, idx), updated, ...requests.slice(idx + 1)];
  writeRequests(newList);
  return updated;
}

/**
 * Fulfill a request by linking evidence IDs.
 */
export function fulfillRequest(id: string, evidenceIds: readonly string[]): AuditRequest | null {
  const requests = readRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const now = new Date().toISOString();
  const updated: AuditRequest = {
    ...requests[idx],
    evidenceIds: [...requests[idx].evidenceIds, ...evidenceIds],
    status: 'fulfilled',
    fulfilledAt: now,
    updatedAt: now,
  };

  const newList = [...requests.slice(0, idx), updated, ...requests.slice(idx + 1)];
  writeRequests(newList);
  return updated;
}

/**
 * Update request notes or add evidence without marking fulfilled.
 */
export function updateRequest(
  id: string,
  patch: {
    notes?: string;
    evidenceIds?: readonly string[];
    assignedTo?: string;
    status?: AuditRequestStatus;
  }
): AuditRequest | null {
  const requests = readRequests();
  const idx = requests.findIndex((r) => r.id === id);
  if (idx < 0) return null;

  const current = requests[idx];
  const now = new Date().toISOString();

  const updated: AuditRequest = {
    ...current,
    notes: patch.notes ?? current.notes,
    evidenceIds: patch.evidenceIds
      ? [...current.evidenceIds, ...patch.evidenceIds]
      : current.evidenceIds,
    assignedTo: patch.assignedTo ?? current.assignedTo,
    status: patch.status ?? current.status,
    fulfilledAt: patch.status === 'fulfilled' ? now : current.fulfilledAt,
    updatedAt: now,
  };

  const newList = [...requests.slice(0, idx), updated, ...requests.slice(idx + 1)];
  writeRequests(newList);
  return updated;
}

/**
 * Get requests filtered by optional status.
 */
export function getRequests(status?: AuditRequestStatus): readonly AuditRequest[] {
  const requests = applyOverdueStatus(readRequests());
  if (!status) return requests;
  return requests.filter((r) => r.status === status);
}

/**
 * Get a single request by ID.
 */
export function getRequest(id: string): AuditRequest | null {
  const requests = applyOverdueStatus(readRequests());
  return requests.find((r) => r.id === id) ?? null;
}

/**
 * Get overdue requests.
 */
export function getOverdueRequests(): readonly AuditRequest[] {
  return getRequests('overdue');
}

/**
 * Get audit dashboard summary stats.
 */
export function getAuditDashboard(): AuditDashboard {
  const requests = applyOverdueStatus(readRequests());
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const fulfilled = requests.filter((r) => r.status === 'fulfilled');
  const fulfilledThisMonth = fulfilled.filter(
    (r) => r.fulfilledAt && r.fulfilledAt >= monthStart
  ).length;

  // Average days to fulfill
  const fulfillDays = fulfilled
    .filter((r) => r.fulfilledAt)
    .map((r) => daysBetween(r.createdAt, r.fulfilledAt!));
  const avgDaysToFulfill =
    fulfillDays.length > 0
      ? Math.round(fulfillDays.reduce((a, b) => a + b, 0) / fulfillDays.length)
      : 0;

  // Aging buckets for open/in_progress/overdue
  const active = requests.filter(
    (r) => r.status === 'open' || r.status === 'in_progress' || r.status === 'overdue'
  );
  const buckets = [
    { label: '0-7 days', count: 0 },
    { label: '8-14 days', count: 0 },
    { label: '15-30 days', count: 0 },
    { label: '30+ days', count: 0 },
  ];
  for (const r of active) {
    const age = daysBetween(r.createdAt, now.toISOString());
    if (age <= 7) buckets[0] = { ...buckets[0], count: buckets[0].count + 1 };
    else if (age <= 14) buckets[1] = { ...buckets[1], count: buckets[1].count + 1 };
    else if (age <= 30) buckets[2] = { ...buckets[2], count: buckets[2].count + 1 };
    else buckets[3] = { ...buckets[3], count: buckets[3].count + 1 };
  }

  return {
    totalRequests: requests.length,
    openRequests: requests.filter((r) => r.status === 'open').length,
    overdueRequests: requests.filter((r) => r.status === 'overdue').length,
    inProgressRequests: requests.filter((r) => r.status === 'in_progress').length,
    fulfilledRequests: fulfilled.length,
    fulfilledThisMonth,
    avgDaysToFulfill,
    agingBuckets: buckets,
  };
}
