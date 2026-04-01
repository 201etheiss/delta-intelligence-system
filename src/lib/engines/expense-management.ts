/**
 * Expense Management Engine
 * Core logic for expense report creation, policy enforcement, and approval workflows.
 * File persistence to data/expense-reports.json and data/expense-policies.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ExpenseReportStatus = 'draft' | 'submitted' | 'approved' | 'reimbursed' | 'rejected';

export type ExpenseCategory =
  | 'travel'
  | 'meals'
  | 'fuel'
  | 'supplies'
  | 'lodging'
  | 'mileage'
  | 'other';

export interface ExpenseItem {
  readonly id: string;
  readonly date: string;
  readonly category: ExpenseCategory;
  readonly description: string;
  readonly amount: number;
  readonly glAccount: string;
  readonly profitCenter: string;
  readonly receiptEvidence: string | null;
  readonly mileage: number | null;
  readonly mileageRate: number | null;
}

export interface ExpenseReport {
  readonly id: string;
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly period: string; // YYYY-MM
  readonly status: ExpenseReportStatus;
  readonly items: readonly ExpenseItem[];
  readonly totalAmount: number;
  readonly approvedBy: string | null;
  readonly submittedAt: string | null;
  readonly approvedAt: string | null;
  readonly rejectionReason: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ExpensePolicy {
  readonly category: ExpenseCategory;
  readonly maxAmount: number;
  readonly requiresReceipt: boolean;
  readonly requiresPreApproval: boolean;
  readonly glDefault: string;
}

export interface PolicyViolation {
  readonly itemId: string;
  readonly category: ExpenseCategory;
  readonly rule: string;
  readonly amount: number;
  readonly limit: number;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const REPORTS_FILE = join(DATA_DIR, 'expense-reports.json');
const POLICIES_FILE = join(DATA_DIR, 'expense-policies.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readReports(): readonly ExpenseReport[] {
  ensureDataDir();
  if (!existsSync(REPORTS_FILE)) return [];
  try {
    const raw = readFileSync(REPORTS_FILE, 'utf-8');
    return JSON.parse(raw) as ExpenseReport[];
  } catch {
    return [];
  }
}

function writeReports(reports: readonly ExpenseReport[]): void {
  ensureDataDir();
  writeFileSync(REPORTS_FILE, JSON.stringify(reports, null, 2), 'utf-8');
}

export function readPolicies(): readonly ExpensePolicy[] {
  ensureDataDir();
  if (!existsSync(POLICIES_FILE)) return getDefaultPolicies();
  try {
    const raw = readFileSync(POLICIES_FILE, 'utf-8');
    return JSON.parse(raw) as ExpensePolicy[];
  } catch {
    return getDefaultPolicies();
  }
}

function getDefaultPolicies(): readonly ExpensePolicy[] {
  return [
    { category: 'meals', maxAmount: 75, requiresReceipt: true, requiresPreApproval: false, glDefault: '6210' },
    { category: 'lodging', maxAmount: 200, requiresReceipt: true, requiresPreApproval: false, glDefault: '6220' },
    { category: 'mileage', maxAmount: 0, requiresReceipt: false, requiresPreApproval: false, glDefault: '6230' },
    { category: 'fuel', maxAmount: 0, requiresReceipt: true, requiresPreApproval: false, glDefault: '6240' },
    { category: 'supplies', maxAmount: 500, requiresReceipt: true, requiresPreApproval: true, glDefault: '6250' },
    { category: 'travel', maxAmount: 1000, requiresReceipt: true, requiresPreApproval: true, glDefault: '6200' },
    { category: 'other', maxAmount: 250, requiresReceipt: true, requiresPreApproval: true, glDefault: '6290' },
  ];
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
// IRS mileage rate
// ---------------------------------------------------------------------------

/** IRS standard mileage rate for 2026 (cents per mile) */
export function getMileageRate(): number {
  return 0.70; // $0.70/mile — IRS 2026 rate
}

// ---------------------------------------------------------------------------
// Policy enforcement
// ---------------------------------------------------------------------------

export function enforcePolicy(item: ExpenseItem): readonly PolicyViolation[] {
  const policies = readPolicies();
  const policy = policies.find((p) => p.category === item.category);
  if (!policy) return [];

  const violations: PolicyViolation[] = [];

  // maxAmount = 0 means unlimited (fuel, mileage)
  if (policy.maxAmount > 0 && item.amount > policy.maxAmount) {
    violations.push({
      itemId: item.id,
      category: item.category,
      rule: `Exceeds ${item.category} limit of $${policy.maxAmount}`,
      amount: item.amount,
      limit: policy.maxAmount,
    });
  }

  if (policy.requiresReceipt && !item.receiptEvidence) {
    violations.push({
      itemId: item.id,
      category: item.category,
      rule: `Receipt required for ${item.category} expenses`,
      amount: item.amount,
      limit: 0,
    });
  }

  return violations;
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export interface CreateReportInput {
  readonly employeeName: string;
  readonly employeeEmail: string;
  readonly period: string;
}

export function createReport(input: CreateReportInput): ExpenseReport {
  const now = new Date().toISOString();
  const report: ExpenseReport = {
    id: generateId('EXP'),
    employeeName: input.employeeName,
    employeeEmail: input.employeeEmail,
    period: input.period,
    status: 'draft',
    items: [],
    totalAmount: 0,
    approvedBy: null,
    submittedAt: null,
    approvedAt: null,
    rejectionReason: null,
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readReports(), report];
  writeReports(all);
  return report;
}

export interface AddItemInput {
  readonly date: string;
  readonly category: ExpenseCategory;
  readonly description: string;
  readonly amount: number;
  readonly glAccount?: string;
  readonly profitCenter?: string;
  readonly receiptEvidence?: string | null;
  readonly mileage?: number | null;
}

export function addItem(reportId: string, input: AddItemInput): ExpenseReport {
  const all = [...readReports()];
  const idx = all.findIndex((r) => r.id === reportId);
  if (idx === -1) throw new Error(`Expense report ${reportId} not found`);

  const report = all[idx];
  if (report.status !== 'draft') {
    throw new Error(`Cannot add items to report in status '${report.status}' — must be draft`);
  }

  const policies = readPolicies();
  const policy = policies.find((p) => p.category === input.category);
  const mileageRate = input.category === 'mileage' && input.mileage ? getMileageRate() : null;
  const amount = input.category === 'mileage' && input.mileage
    ? Math.round(input.mileage * getMileageRate() * 100) / 100
    : input.amount;

  const item: ExpenseItem = {
    id: generateId('ITM'),
    date: input.date,
    category: input.category,
    description: input.description,
    amount,
    glAccount: input.glAccount ?? policy?.glDefault ?? '6290',
    profitCenter: input.profitCenter ?? '',
    receiptEvidence: input.receiptEvidence ?? null,
    mileage: input.mileage ?? null,
    mileageRate,
  };

  const updatedItems = [...report.items, item];
  const totalAmount = Math.round(updatedItems.reduce((sum, i) => sum + i.amount, 0) * 100) / 100;

  const merged: ExpenseReport = {
    ...report,
    items: updatedItems,
    totalAmount,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeReports(updated);
  return merged;
}

export function submitReport(reportId: string): ExpenseReport {
  const all = [...readReports()];
  const idx = all.findIndex((r) => r.id === reportId);
  if (idx === -1) throw new Error(`Expense report ${reportId} not found`);

  const report = all[idx];
  if (report.status !== 'draft') {
    throw new Error(`Only draft reports can be submitted`);
  }
  if ((report.items ?? []).length === 0) {
    throw new Error('Cannot submit a report with no items');
  }

  const merged: ExpenseReport = {
    ...report,
    status: 'submitted',
    submittedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeReports(updated);
  return merged;
}

export function approveReport(reportId: string, approvedBy: string): ExpenseReport {
  const all = [...readReports()];
  const idx = all.findIndex((r) => r.id === reportId);
  if (idx === -1) throw new Error(`Expense report ${reportId} not found`);

  const report = all[idx];
  if (report.status !== 'submitted') {
    throw new Error('Only submitted reports can be approved');
  }

  const merged: ExpenseReport = {
    ...report,
    status: 'approved',
    approvedBy,
    approvedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeReports(updated);
  return merged;
}

export function rejectReport(reportId: string, rejectedBy: string, reason: string): ExpenseReport {
  const all = [...readReports()];
  const idx = all.findIndex((r) => r.id === reportId);
  if (idx === -1) throw new Error(`Expense report ${reportId} not found`);

  const report = all[idx];
  if (report.status !== 'submitted') {
    throw new Error('Only submitted reports can be rejected');
  }

  const merged: ExpenseReport = {
    ...report,
    status: 'rejected',
    rejectionReason: reason,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeReports(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getReportsByStatus(status: ExpenseReportStatus): readonly ExpenseReport[] {
  return readReports().filter((r) => r.status === status);
}

export function getReportsByEmployee(email: string): readonly ExpenseReport[] {
  return readReports().filter((r) => r.employeeEmail === email);
}

export function getAllReports(filters?: {
  status?: ExpenseReportStatus;
  employee?: string;
  period?: string;
}): readonly ExpenseReport[] {
  let results = [...readReports()];

  if (filters?.status) {
    results = results.filter((r) => r.status === filters.status);
  }
  if (filters?.employee) {
    results = results.filter((r) => r.employeeEmail === filters.employee);
  }
  if (filters?.period) {
    results = results.filter((r) => r.period === filters.period);
  }

  return results;
}

export function getReportById(id: string): ExpenseReport | undefined {
  return readReports().find((r) => r.id === id);
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ExpenseSummary {
  readonly totalByCategory: Readonly<Record<string, number>>;
  readonly totalAmount: number;
  readonly reportCount: number;
  readonly pendingApproval: number;
  readonly ytdTotal: number;
}

export function getExpenseSummary(period: string): ExpenseSummary {
  const allReports = readReports();
  const periodReports = allReports.filter((r) => r.period === period);
  const yearPrefix = period.slice(0, 4);
  const ytdReports = allReports.filter((r) => r.period.startsWith(yearPrefix) && r.status !== 'rejected');

  const totalByCategory: Record<string, number> = {};
  for (const report of periodReports) {
    for (const item of report.items ?? []) {
      totalByCategory[item.category] = (totalByCategory[item.category] ?? 0) + item.amount;
    }
  }

  return {
    totalByCategory,
    totalAmount: Math.round(periodReports.reduce((sum, r) => sum + r.totalAmount, 0) * 100) / 100,
    reportCount: periodReports.length,
    pendingApproval: periodReports.filter((r) => r.status === 'submitted').length,
    ytdTotal: Math.round(ytdReports.reduce((sum, r) => sum + r.totalAmount, 0) * 100) / 100,
  };
}
