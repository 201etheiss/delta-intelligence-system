/**
 * AP Invoice Processing Engine
 * Core logic for creating, coding, approving, and paying AP invoices.
 * File persistence to data/ap-invoices.json.
 * Vendor list pulled from gateway: /vroozi/suppliers.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type APInvoiceStatus =
  | 'received'
  | 'coding'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'paid';

export interface APLineItem {
  readonly id: string;
  readonly description: string;
  readonly quantity: number;
  readonly unitPrice: number;
  readonly amount: number;
  readonly glAccount: string;
  readonly glAccountName: string;
  readonly profitCenter: string;
  readonly taxCode: string;
}

export interface APInvoice {
  readonly id: string;
  readonly vendorId: string;
  readonly vendorName: string;
  readonly invoiceNumber: string;
  readonly date: string;
  readonly dueDate: string;
  readonly amount: number;
  readonly lineItems: readonly APLineItem[];
  readonly status: APInvoiceStatus;
  readonly glCoding: readonly string[];
  readonly autoCoded: boolean;
  readonly autoCodeConfidence: number;
  readonly approvedBy: string | null;
  readonly paidDate: string | null;
  readonly paidReference: string | null;
  readonly sourceDocument: string | null;
  readonly ocrExtracted: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const AP_FILE = join(DATA_DIR, 'ap-invoices.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readInvoices(): readonly APInvoice[] {
  ensureDataDir();
  if (!existsSync(AP_FILE)) return [];
  try {
    const raw = readFileSync(AP_FILE, 'utf-8');
    return JSON.parse(raw) as APInvoice[];
  } catch {
    return [];
  }
}

function writeInvoices(invoices: readonly APInvoice[]): void {
  ensureDataDir();
  writeFileSync(AP_FILE, JSON.stringify(invoices, null, 2), 'utf-8');
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
// Historical GL coding patterns (rule-based auto-code)
// ---------------------------------------------------------------------------

const VENDOR_GL_PATTERNS: Readonly<Record<string, { gl: string; name: string; confidence: number }>> = {
  comdata: { gl: '5100', name: 'Fuel Purchases', confidence: 0.95 },
  'fleet panda': { gl: '5100', name: 'Fuel Purchases', confidence: 0.90 },
  fleetpanda: { gl: '5100', name: 'Fuel Purchases', confidence: 0.90 },
  samsara: { gl: '6200', name: 'Vehicle Telematics', confidence: 0.92 },
  'rush truck': { gl: '5300', name: 'Truck Maintenance & Repair', confidence: 0.88 },
  'loves': { gl: '5100', name: 'Fuel Purchases', confidence: 0.85 },
  'pilot flying j': { gl: '5100', name: 'Fuel Purchases', confidence: 0.85 },
  'ta petro': { gl: '5100', name: 'Fuel Purchases', confidence: 0.85 },
  geotab: { gl: '6200', name: 'Vehicle Telematics', confidence: 0.90 },
  'progressive insurance': { gl: '6300', name: 'Insurance Expense', confidence: 0.93 },
  'great plains energy': { gl: '6400', name: 'Utilities', confidence: 0.88 },
  'office depot': { gl: '6500', name: 'Office Supplies', confidence: 0.90 },
  staples: { gl: '6500', name: 'Office Supplies', confidence: 0.90 },
  unifirst: { gl: '6600', name: 'Uniform Expense', confidence: 0.92 },
  cintas: { gl: '6600', name: 'Uniform Expense', confidence: 0.92 },
};

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export interface CreateInvoiceInput {
  readonly vendorId: string;
  readonly vendorName: string;
  readonly invoiceNumber: string;
  readonly date: string;
  readonly dueDate: string;
  readonly amount: number;
  readonly lineItems?: readonly APLineItem[];
  readonly sourceDocument?: string | null;
  readonly ocrExtracted?: boolean;
}

export function createInvoice(input: CreateInvoiceInput): APInvoice {
  if (!input.vendorName || input.vendorName.trim().length === 0) {
    throw new Error('Validation failed: vendorName is required');
  }
  if (!input.invoiceNumber || input.invoiceNumber.trim().length === 0) {
    throw new Error('Validation failed: invoiceNumber is required');
  }
  if (typeof input.amount !== 'number' || input.amount <= 0) {
    throw new Error('Validation failed: amount must be a positive number');
  }
  if (!input.date) {
    throw new Error('Validation failed: date is required');
  }
  if (!input.dueDate) {
    throw new Error('Validation failed: dueDate is required');
  }

  // Check for duplicate invoice number per vendor
  const existing = readInvoices();
  const duplicate = existing.find(
    (inv) => inv.vendorId === input.vendorId && inv.invoiceNumber === input.invoiceNumber
  );
  if (duplicate) {
    throw new Error(`Validation failed: duplicate invoice ${input.invoiceNumber} for vendor ${input.vendorName}`);
  }

  const lineItems = input.lineItems ?? [];
  const now = new Date().toISOString();

  const invoice: APInvoice = {
    id: generateId('AP'),
    vendorId: input.vendorId,
    vendorName: input.vendorName,
    invoiceNumber: input.invoiceNumber,
    date: input.date,
    dueDate: input.dueDate,
    amount: Math.round(input.amount * 100) / 100,
    lineItems: [...lineItems],
    status: 'received',
    glCoding: [],
    autoCoded: false,
    autoCodeConfidence: 0,
    approvedBy: null,
    paidDate: null,
    paidReference: null,
    sourceDocument: input.sourceDocument ?? null,
    ocrExtracted: input.ocrExtracted ?? false,
    createdAt: now,
    updatedAt: now,
  };

  const all = [...existing, invoice];
  writeInvoices(all);
  return invoice;
}

export function updateInvoice(
  id: string,
  patch: Partial<Pick<APInvoice, 'lineItems' | 'glCoding' | 'amount' | 'dueDate' | 'invoiceNumber'>>
): APInvoice {
  const all = [...readInvoices()];
  const idx = all.findIndex((inv) => inv.id === id);
  if (idx === -1) throw new Error(`Invoice ${id} not found`);

  const existing = all[idx];
  if (existing.status === 'paid') {
    throw new Error(`Cannot update invoice in status 'paid'`);
  }

  const merged: APInvoice = {
    ...existing,
    lineItems: patch.lineItems ? [...patch.lineItems] : existing.lineItems,
    glCoding: patch.glCoding ? [...patch.glCoding] : existing.glCoding,
    amount: patch.amount != null ? Math.round(patch.amount * 100) / 100 : existing.amount,
    dueDate: patch.dueDate ?? existing.dueDate,
    invoiceNumber: patch.invoiceNumber ?? existing.invoiceNumber,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeInvoices(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

function transitionInvoice(
  id: string,
  toStatus: APInvoiceStatus,
  extra: Partial<Pick<APInvoice, 'approvedBy' | 'paidDate' | 'paidReference' | 'glCoding' | 'autoCoded' | 'autoCodeConfidence'>> = {}
): APInvoice {
  const all = [...readInvoices()];
  const idx = all.findIndex((inv) => inv.id === id);
  if (idx === -1) throw new Error(`Invoice ${id} not found`);

  const merged: APInvoice = {
    ...all[idx],
    status: toStatus,
    ...extra,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeInvoices(updated);
  return merged;
}

export function submitForReview(id: string): APInvoice {
  const inv = readInvoices().find((i) => i.id === id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  if (inv.status !== 'coding' && inv.status !== 'received') {
    throw new Error(`Cannot submit for review from status '${inv.status}'`);
  }
  if ((inv.glCoding ?? []).length === 0 && (inv.lineItems ?? []).length === 0) {
    throw new Error('Cannot submit for review without GL coding or line items');
  }
  return transitionInvoice(id, 'review');
}

export function approveInvoice(id: string, approvedBy: string): APInvoice {
  const inv = readInvoices().find((i) => i.id === id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  if (inv.status !== 'review') {
    throw new Error(`Cannot approve invoice in status '${inv.status}' — must be in review`);
  }
  return transitionInvoice(id, 'approved', { approvedBy });
}

export function schedulePayment(id: string): APInvoice {
  const inv = readInvoices().find((i) => i.id === id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  if (inv.status !== 'approved') {
    throw new Error(`Cannot schedule payment for invoice in status '${inv.status}' — must be approved`);
  }
  return transitionInvoice(id, 'scheduled');
}

export function markPaid(id: string, paidReference: string): APInvoice {
  const inv = readInvoices().find((i) => i.id === id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  if (inv.status !== 'scheduled') {
    throw new Error(`Cannot mark paid for invoice in status '${inv.status}' — must be scheduled`);
  }
  return transitionInvoice(id, 'paid', {
    paidDate: new Date().toISOString().slice(0, 10),
    paidReference,
  });
}

// ---------------------------------------------------------------------------
// Auto-code (rule-based vendor → GL matching)
// ---------------------------------------------------------------------------

export function autoCodeInvoice(id: string): APInvoice {
  const inv = readInvoices().find((i) => i.id === id);
  if (!inv) throw new Error(`Invoice ${id} not found`);
  if (inv.status !== 'received' && inv.status !== 'coding') {
    throw new Error(`Cannot auto-code invoice in status '${inv.status}'`);
  }

  const vendorLower = inv.vendorName.toLowerCase();
  let match: { gl: string; name: string; confidence: number } | null = null;

  for (const [pattern, mapping] of Object.entries(VENDOR_GL_PATTERNS)) {
    if (vendorLower.includes(pattern)) {
      match = mapping;
      break;
    }
  }

  if (!match) {
    // No match — move to coding status for manual assignment
    return transitionInvoice(id, 'coding', {
      autoCoded: false,
      autoCodeConfidence: 0,
    });
  }

  const glCoding = [match.gl];
  const lineItems: readonly APLineItem[] = inv.lineItems.length > 0
    ? inv.lineItems.map((li) => ({
        ...li,
        glAccount: match!.gl,
        glAccountName: match!.name,
      }))
    : [{
        id: generateId('LI'),
        description: inv.vendorName,
        quantity: 1,
        unitPrice: inv.amount,
        amount: inv.amount,
        glAccount: match.gl,
        glAccountName: match.name,
        profitCenter: '',
        taxCode: '',
      }];

  return transitionInvoice(id, 'coding', {
    glCoding,
    autoCoded: true,
    autoCodeConfidence: match.confidence,
  });
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function getAllInvoices(): readonly APInvoice[] {
  return readInvoices();
}

export function getInvoiceById(id: string): APInvoice | undefined {
  return readInvoices().find((inv) => inv.id === id);
}

export function getInvoicesByStatus(status: APInvoiceStatus): readonly APInvoice[] {
  return readInvoices().filter((inv) => inv.status === status);
}

export function getInvoicesByVendor(vendorId: string): readonly APInvoice[] {
  return readInvoices().filter((inv) => inv.vendorId === vendorId);
}

export function getOverdueInvoices(): readonly APInvoice[] {
  const today = new Date().toISOString().slice(0, 10);
  return readInvoices().filter(
    (inv) => inv.status !== 'paid' && inv.dueDate < today
  );
}

export interface APAgingBucket {
  readonly label: string;
  readonly count: number;
  readonly total: number;
  readonly invoiceIds: readonly string[];
}

export interface APAgingSummary {
  readonly current: APAgingBucket;
  readonly days30: APAgingBucket;
  readonly days60: APAgingBucket;
  readonly days90plus: APAgingBucket;
  readonly totalOutstanding: number;
}

export function getAPAgingSummary(): APAgingSummary {
  const unpaid = readInvoices().filter((inv) => inv.status !== 'paid');
  const today = new Date();

  const buckets = {
    current: { label: 'Current', count: 0, total: 0, invoiceIds: [] as string[] },
    days30: { label: '1-30 Days', count: 0, total: 0, invoiceIds: [] as string[] },
    days60: { label: '31-60 Days', count: 0, total: 0, invoiceIds: [] as string[] },
    days90plus: { label: '61-90+ Days', count: 0, total: 0, invoiceIds: [] as string[] },
  };

  for (const inv of unpaid) {
    const dueDate = new Date(inv.dueDate);
    const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

    let bucket: { count: number; total: number; invoiceIds: string[] };
    if (daysOverdue <= 0) {
      bucket = buckets.current;
    } else if (daysOverdue <= 30) {
      bucket = buckets.days30;
    } else if (daysOverdue <= 60) {
      bucket = buckets.days60;
    } else {
      bucket = buckets.days90plus;
    }

    bucket.count += 1;
    bucket.total = Math.round((bucket.total + inv.amount) * 100) / 100;
    bucket.invoiceIds.push(inv.id);
  }

  const totalOutstanding = Math.round(
    (buckets.current.total + buckets.days30.total + buckets.days60.total + buckets.days90plus.total) * 100
  ) / 100;

  return {
    current: buckets.current,
    days30: buckets.days30,
    days60: buckets.days60,
    days90plus: buckets.days90plus,
    totalOutstanding,
  };
}

export function getInvoices(filters?: {
  status?: APInvoiceStatus;
  vendorId?: string;
  overdue?: boolean;
  dateFrom?: string;
  dateTo?: string;
}): readonly APInvoice[] {
  let results = [...readInvoices()];

  if (filters?.status) {
    results = results.filter((inv) => inv.status === filters.status);
  }
  if (filters?.vendorId) {
    results = results.filter((inv) => inv.vendorId === filters.vendorId);
  }
  if (filters?.overdue) {
    const today = new Date().toISOString().slice(0, 10);
    results = results.filter((inv) => inv.status !== 'paid' && inv.dueDate < today);
  }
  if (filters?.dateFrom) {
    results = results.filter((inv) => inv.date >= filters.dateFrom!);
  }
  if (filters?.dateTo) {
    results = results.filter((inv) => inv.date <= filters.dateTo!);
  }

  return results;
}
