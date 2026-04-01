/**
 * Journal Entry Engine
 * Core logic for creating, validating, and managing journal entries.
 * File persistence to data/journal-entries.json and data/je-templates.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type JEStatus = 'draft' | 'review' | 'approved' | 'posted' | 'rejected';

export interface JELine {
  readonly account: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly profitCenter: string;
  readonly description: string;
  readonly entityId: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly status: JEStatus;
  readonly entries: readonly JELine[];
  readonly createdBy: string;
  readonly reviewedBy: string | null;
  readonly approvedBy: string | null;
  readonly templateId: string | null;
  readonly reversalOf: string | null;
  readonly autoReverse: boolean;
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly notes: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type JETemplateType = 'fixed' | 'source_balance' | 'allocation';

export type JEFamily =
  | 'depreciation'
  | 'payroll_accrual'
  | 'internal_billings'
  | 'stonex_hedging'
  | 'health_insurance_hsa'
  | 'tax'
  | 'prepaid_amortization'
  | 'interest_allocation'
  | 'fixed_assets'
  | 'overhead_allocation'
  | 'inventory_reserves'
  | 'cash_flow_borrowing';

export interface JETemplateLine {
  readonly account: string;
  readonly accountName: string;
  readonly debitFormula: string;
  readonly creditFormula: string;
  readonly profitCenter: string;
  readonly description: string;
}

export interface JETemplate {
  readonly id: string;
  readonly name: string;
  readonly family: JEFamily;
  readonly type: JETemplateType;
  readonly lines: readonly JETemplateLine[];
  readonly autoReverse: boolean;
  readonly frequency: string;
  readonly sourceParser: string | null;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const JE_FILE = join(DATA_DIR, 'journal-entries.json');
const TEMPLATE_FILE = join(DATA_DIR, 'je-templates.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readJEs(): readonly JournalEntry[] {
  ensureDataDir();
  if (!existsSync(JE_FILE)) return [];
  try {
    const raw = readFileSync(JE_FILE, 'utf-8');
    return JSON.parse(raw) as JournalEntry[];
  } catch {
    return [];
  }
}

function writeJEs(entries: readonly JournalEntry[]): void {
  ensureDataDir();
  writeFileSync(JE_FILE, JSON.stringify(entries, null, 2), 'utf-8');
}

export function readTemplates(): readonly JETemplate[] {
  ensureDataDir();
  if (!existsSync(TEMPLATE_FILE)) return [];
  try {
    const raw = readFileSync(TEMPLATE_FILE, 'utf-8');
    return JSON.parse(raw) as JETemplate[];
  } catch {
    return [];
  }
}

export function writeTemplates(templates: readonly JETemplate[]): void {
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
// Validation
// ---------------------------------------------------------------------------

export interface JEValidationResult {
  readonly valid: boolean;
  readonly errors: readonly string[];
}

export function validateJE(entry: {
  entries: readonly JELine[];
  description?: string;
}): JEValidationResult {
  const errors: string[] = [];

  if ((entry.entries ?? []).length === 0) {
    errors.push('Journal entry must have at least one line');
  }

  const totalDebit = (entry.entries ?? []).reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = (entry.entries ?? []).reduce((sum, l) => sum + l.credit, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.005) {
    errors.push(
      `Debits ($${totalDebit.toFixed(2)}) must equal credits ($${totalCredit.toFixed(2)})`
    );
  }

  for (const line of entry.entries ?? []) {
    if (!line.account) errors.push('Each line must have an account number');
    if (line.debit < 0) errors.push(`Negative debit on account ${line.account}`);
    if (line.credit < 0) errors.push(`Negative credit on account ${line.account}`);
    if (line.debit === 0 && line.credit === 0) {
      errors.push(`Line for account ${line.account} has zero debit and credit`);
    }
    if (line.debit > 0 && line.credit > 0) {
      errors.push(`Line for account ${line.account} has both debit and credit`);
    }
  }

  if (!entry.description || entry.description.trim().length === 0) {
    errors.push('Description is required');
  }

  return { valid: errors.length === 0, errors };
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export interface CreateJEInput {
  readonly date: string;
  readonly description: string;
  readonly entries: readonly JELine[];
  readonly createdBy: string;
  readonly templateId?: string | null;
  readonly autoReverse?: boolean;
  readonly notes?: string;
}

export function createJE(input: CreateJEInput): JournalEntry {
  const validation = validateJE(input);
  if (!validation.valid) {
    throw new Error(`Validation failed: ${validation.errors.join('; ')}`);
  }

  const totalDebit = input.entries.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = input.entries.reduce((sum, l) => sum + l.credit, 0);
  const now = new Date().toISOString();

  const je: JournalEntry = {
    id: generateId('JE'),
    date: input.date,
    description: input.description,
    status: 'draft',
    entries: [...input.entries],
    createdBy: input.createdBy,
    reviewedBy: null,
    approvedBy: null,
    templateId: input.templateId ?? null,
    reversalOf: null,
    autoReverse: input.autoReverse ?? false,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    notes: input.notes ?? '',
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readJEs(), je];
  writeJEs(all);
  return je;
}

export function updateJE(
  id: string,
  patch: Partial<Pick<JournalEntry, 'date' | 'description' | 'entries' | 'notes' | 'autoReverse'>>
): JournalEntry {
  const all = [...readJEs()];
  const idx = all.findIndex((j) => j.id === id);
  if (idx === -1) throw new Error(`Journal entry ${id} not found`);

  const existing = all[idx];
  if (existing.status !== 'draft') {
    throw new Error(`Cannot update JE in status '${existing.status}' — must be draft`);
  }

  const updatedEntries = patch.entries ?? existing.entries;
  const totalDebit = updatedEntries.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = updatedEntries.reduce((sum, l) => sum + l.credit, 0);

  const merged: JournalEntry = {
    ...existing,
    date: patch.date ?? existing.date,
    description: patch.description ?? existing.description,
    entries: [...updatedEntries],
    notes: patch.notes ?? existing.notes,
    autoReverse: patch.autoReverse ?? existing.autoReverse,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    updatedAt: new Date().toISOString(),
  };

  if (patch.entries) {
    const v = validateJE(merged);
    if (!v.valid) throw new Error(`Validation failed: ${v.errors.join('; ')}`);
  }

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeJEs(updated);
  return merged;
}

export function deleteJE(id: string): void {
  const all = [...readJEs()];
  const target = all.find((j) => j.id === id);
  if (!target) throw new Error(`Journal entry ${id} not found`);
  if (target.status !== 'draft') {
    throw new Error(`Cannot delete JE in status '${target.status}' — must be draft`);
  }
  writeJEs(all.filter((j) => j.id !== id));
}

export function getJEById(id: string): JournalEntry | undefined {
  return readJEs().find((j) => j.id === id);
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

function transitionJE(
  id: string,
  toStatus: JEStatus,
  extra: Partial<Pick<JournalEntry, 'reviewedBy' | 'approvedBy'>> = {}
): JournalEntry {
  const all = [...readJEs()];
  const idx = all.findIndex((j) => j.id === id);
  if (idx === -1) throw new Error(`Journal entry ${id} not found`);

  const je = all[idx];
  const merged: JournalEntry = {
    ...je,
    status: toStatus,
    reviewedBy: extra.reviewedBy ?? je.reviewedBy,
    approvedBy: extra.approvedBy ?? je.approvedBy,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeJEs(updated);
  return merged;
}

export function submitForReview(id: string): JournalEntry {
  const je = getJEById(id);
  if (!je) throw new Error(`Journal entry ${id} not found`);
  if (je.status !== 'draft') throw new Error('Only draft JEs can be submitted for review');
  return transitionJE(id, 'review');
}

export function approveJE(id: string, approvedBy: string): JournalEntry {
  const je = getJEById(id);
  if (!je) throw new Error(`Journal entry ${id} not found`);
  if (je.status !== 'review') throw new Error('Only JEs in review can be approved');
  return transitionJE(id, 'approved', { approvedBy });
}

export function rejectJE(id: string, reviewedBy: string): JournalEntry {
  const je = getJEById(id);
  if (!je) throw new Error(`Journal entry ${id} not found`);
  if (je.status !== 'review') throw new Error('Only JEs in review can be rejected');
  return transitionJE(id, 'rejected', { reviewedBy });
}

export function postJE(id: string): JournalEntry {
  const je = getJEById(id);
  if (!je) throw new Error(`Journal entry ${id} not found`);
  if (je.status !== 'approved') throw new Error('Only approved JEs can be posted');
  return transitionJE(id, 'posted');
}

export function reverseJE(id: string, createdBy: string): JournalEntry {
  const original = getJEById(id);
  if (!original) throw new Error(`Journal entry ${id} not found`);
  if (original.status !== 'posted') throw new Error('Only posted JEs can be reversed');

  const reversedLines: JELine[] = original.entries.map((line) => ({
    ...line,
    debit: line.credit,
    credit: line.debit,
    description: `Reversal: ${line.description}`,
  }));

  const now = new Date().toISOString();
  const reversal: JournalEntry = {
    id: generateId('JE'),
    date: new Date().toISOString().slice(0, 10),
    description: `Reversal of ${original.id}: ${original.description}`,
    status: 'draft',
    entries: reversedLines,
    createdBy,
    reviewedBy: null,
    approvedBy: null,
    templateId: original.templateId,
    reversalOf: original.id,
    autoReverse: false,
    totalDebit: original.totalCredit,
    totalCredit: original.totalDebit,
    notes: `Auto-reversal of JE ${original.id}`,
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readJEs(), reversal];
  writeJEs(all);
  return reversal;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getJEsByStatus(status: JEStatus): readonly JournalEntry[] {
  return readJEs().filter((j) => j.status === status);
}

export function getJEsByPeriod(period: string): readonly JournalEntry[] {
  // period = "YYYY-MM"
  return readJEs().filter((j) => j.date.startsWith(period));
}

export function getJEsByFamily(family: string): readonly JournalEntry[] {
  const templates = readTemplates();
  const familyTemplateIds = new Set(
    templates.filter((t) => t.family === family).map((t) => t.id)
  );
  return readJEs().filter((j) => j.templateId && familyTemplateIds.has(j.templateId));
}

export function getAllJEs(filters?: {
  status?: JEStatus;
  period?: string;
  family?: string;
}): readonly JournalEntry[] {
  let results = [...readJEs()];

  if (filters?.status) {
    results = results.filter((j) => j.status === filters.status);
  }
  if (filters?.period) {
    results = results.filter((j) => j.date.startsWith(filters.period!));
  }
  if (filters?.family) {
    const templates = readTemplates();
    const familyTemplateIds = new Set(
      templates.filter((t) => t.family === filters.family!).map((t) => t.id)
    );
    results = results.filter((j) => j.templateId && familyTemplateIds.has(j.templateId));
  }

  return results;
}
