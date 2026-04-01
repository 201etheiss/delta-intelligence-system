/**
 * Audit Log — tracks who did what, when, across all tools and data access.
 * Writes to data/audit-log.json with automatic rotation.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface AuditEntry {
  id: string;
  timestamp: string;
  userEmail: string;
  role: string;
  action: string; // 'query' | 'sf_create' | 'sf_update' | 'calendar_create' | 'email_read' | 'email_send' | 'email_manage' | 'workbook' | 'export' | 'login'
  detail: string; // human-readable description
  tool?: string; // tool name if from agentic loop
  target?: string; // target resource (mailbox, SF object, endpoint)
  success: boolean;
  metadata?: Record<string, unknown>; // extra context (query, response size, etc.)
  ip?: string;
  duration?: number; // ms
}

const AUDIT_FILE = join(process.cwd(), 'data', 'audit-log.json');
const MAX_ENTRIES = 10000;

function readLog(): AuditEntry[] {
  try {
    if (!existsSync(AUDIT_FILE)) return [];
    const raw = readFileSync(AUDIT_FILE, 'utf-8');
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : (data.entries ?? []);
  } catch {
    return [];
  }
}

function writeLog(entries: AuditEntry[]): void {
  try {
    // Keep only last MAX_ENTRIES
    const trimmed = entries.slice(-MAX_ENTRIES);
    writeFileSync(AUDIT_FILE, JSON.stringify({ entries: trimmed, lastUpdated: new Date().toISOString() }, null, 2));
  } catch {
    // Silent fail — audit logging should never break the main flow
  }
}

export function logAudit(entry: Omit<AuditEntry, 'id' | 'timestamp'>): void {
  const full: AuditEntry = {
    ...entry,
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };

  const entries = readLog();
  entries.push(full);
  writeLog(entries);
}

export function getAuditLog(options?: {
  userEmail?: string;
  action?: string;
  since?: string;
  limit?: number;
}): AuditEntry[] {
  let entries = readLog();

  if (options?.userEmail) {
    entries = entries.filter(e => e.userEmail === options.userEmail);
  }
  if (options?.action) {
    entries = entries.filter(e => e.action === options.action);
  }
  if (options?.since) {
    const sinceDate = new Date(options.since).getTime();
    entries = entries.filter(e => new Date(e.timestamp).getTime() >= sinceDate);
  }

  // Most recent first
  entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return entries.slice(0, options?.limit ?? 100);
}

export function getAuditStats(since?: string): {
  totalActions: number;
  byUser: Record<string, number>;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  failureRate: number;
} {
  let entries = readLog();
  if (since) {
    const sinceDate = new Date(since).getTime();
    entries = entries.filter(e => new Date(e.timestamp).getTime() >= sinceDate);
  }

  const byUser: Record<string, number> = {};
  const byAction: Record<string, number> = {};
  const byTool: Record<string, number> = {};
  let failures = 0;

  for (const e of entries) {
    byUser[e.userEmail] = (byUser[e.userEmail] ?? 0) + 1;
    byAction[e.action] = (byAction[e.action] ?? 0) + 1;
    if (e.tool) byTool[e.tool] = (byTool[e.tool] ?? 0) + 1;
    if (!e.success) failures++;
  }

  return {
    totalActions: entries.length,
    byUser,
    byAction,
    byTool,
    failureRate: entries.length > 0 ? failures / entries.length : 0,
  };
}
