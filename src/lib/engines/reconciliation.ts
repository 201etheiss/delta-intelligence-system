/**
 * Reconciliation Engine
 *
 * Core logic for account reconciliation: GL vs sub-ledger matching,
 * exception tracking, and evidence management.
 * File persistence to data/reconciliations.json and data/recon-rules.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export type ReconStatus = 'pending' | 'in_progress' | 'reconciled' | 'exception';
export type ExceptionStatus = 'open' | 'resolved' | 'waived';

export interface ReconException {
  id: string;
  description: string;
  amount: number;
  status: ExceptionStatus;
  ageInDays: number;
  resolvedBy: string | null;
  resolution: string | null;
}

export interface Reconciliation {
  id: string;
  accountNumber: string;
  accountName: string;
  period: string; // YYYY-MM
  status: ReconStatus;
  glBalance: number;
  subBalance: number;
  difference: number;
  tolerance: number;
  matchedItems: number;
  exceptions: ReconException[];
  evidence: string[];
  preparedBy: string | null;
  reviewedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ReconRule {
  id: string;
  accountNumber: string;
  accountName: string;
  sourceEndpoint: string;
  sourceField: string;
  frequency: 'daily' | 'weekly' | 'monthly';
  tolerance: number;
}

interface ReconciliationsFile {
  reconciliations: Reconciliation[];
  lastUpdated: string;
}

interface ReconRulesFile {
  rules: ReconRule[];
}

// ── File I/O ─────────────────────────────────────────────────

function getReconsPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/reconciliations.json';
  }
  return path.join(process.cwd(), 'data', 'reconciliations.json');
}

function getRulesPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/recon-rules.json';
  }
  return path.join(process.cwd(), 'data', 'recon-rules.json');
}

function readRecons(): Reconciliation[] {
  const filePath = getReconsPath();
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ReconciliationsFile;
    return data.reconciliations ?? [];
  } catch {
    return [];
  }
}

function writeRecons(reconciliations: Reconciliation[]): void {
  const filePath = getReconsPath();
  const data: ReconciliationsFile = {
    reconciliations,
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

export function readRules(): ReconRule[] {
  const filePath = getRulesPath();
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as ReconRulesFile;
    return data.rules ?? [];
  } catch {
    return [];
  }
}

// ── Account Name Map ─────────────────────────────────────────

const ACCOUNT_NAMES: Readonly<Record<string, string>> = {
  '10100': 'Cash - Operating',
  '10200': 'Cash - Payroll',
  '10300': 'Cash - Savings',
  '10400': 'Cash - Money Market',
  '10500': 'Petty Cash',
  '12000': 'Accounts Receivable',
  '12100': 'AR - Trade',
  '12200': 'AR - Other',
  '12500': 'Allowance for Doubtful Accounts',
  '13000': 'Notes Receivable',
  '14000': 'Inventory',
  '14100': 'Inventory - Fuel',
  '14200': 'Inventory - Lubricants',
  '14300': 'Inventory - Parts',
  '15000': 'Prepaid Expenses',
  '15100': 'Prepaid Insurance',
  '15200': 'Prepaid Rent',
  '15300': 'Prepaid Taxes',
  '16000': 'Deposits',
  '17000': 'Fixed Assets - Equipment',
  '17100': 'Fixed Assets - Vehicles',
  '17200': 'Fixed Assets - Furniture & Fixtures',
  '17300': 'Fixed Assets - Leasehold Improvements',
  '17500': 'Accumulated Depreciation',
  '18000': 'Intangible Assets',
  '18500': 'Accumulated Amortization',
  '20000': 'Accounts Payable',
  '20100': 'AP - Trade',
  '20200': 'AP - Other',
  '21000': 'Accrued Payroll',
  '21100': 'Payroll Tax Liabilities',
  '21200': 'Benefits Payable',
  '22000': 'Accrued Liabilities',
  '22100': 'Accrued Interest',
  '22200': 'Accrued Taxes',
  '23000': 'Sales Tax Payable',
  '24000': 'Customer Deposits',
  '25000': 'Notes Payable - Short Term',
  '25100': 'Line of Credit - JPM Chase',
  '26000': 'Current Portion - Long Term Debt',
  '27000': 'Notes Payable - Long Term',
};

function getAccountName(accountNumber: string): string {
  return ACCOUNT_NAMES[accountNumber] ?? `Account ${accountNumber}`;
}

// ── Input Validation ────────────────────────────────────────

function validatePeriod(period: string): { year: number; month: number } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Invalid period format (expected YYYY-MM)');
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) throw new Error('Period out of range');
  return { year, month };
}

// ── Gateway Helpers ──────────────────────────────────────────

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export async function fetchGLBalance(account: string, period: string): Promise<number> {
  // Query Ascend GL for the account balance at period end
  const { year, month } = validatePeriod(period);
  const periodEnd = new Date(year, month, 0); // last day of month
  const dateStr = periodEnd.toISOString().split('T')[0];

  const query = encodeURIComponent(
    `SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '${account}' AND PostDate <= '${dateStr}'`
  );

  const result = await gatewayFetch(`/ascend/query?sql=${query}`, 'admin', { timeout: 20000 });

  if (!result.success || !result.data) {
    return 0;
  }

  const rows = result.data as Array<Record<string, unknown>>;
  if (rows.length === 0) return 0;
  const balance = Number(rows[0]?.Balance ?? 0);
  return Math.round(balance * 100) / 100;
}

// ── Core Functions ───────────────────────────────────────────

export async function createRecon(
  period: string,
  accountNumber: string,
  preparedBy?: string
): Promise<Reconciliation> {
  const recons = readRecons();

  // Check for existing recon for this account+period
  const existing = recons.find(
    (r) => r.accountNumber === accountNumber && r.period === period
  );
  if (existing) {
    throw new Error(`Reconciliation already exists for account ${accountNumber} period ${period} (id: ${existing.id})`);
  }

  const glBalance = await fetchGLBalance(accountNumber, period);
  const now = new Date().toISOString();

  const recon: Reconciliation = {
    id: generateId(),
    accountNumber,
    accountName: getAccountName(accountNumber),
    period,
    status: 'pending',
    glBalance,
    subBalance: 0,
    difference: glBalance,
    tolerance: 1.00,
    matchedItems: 0,
    exceptions: [],
    evidence: [],
    preparedBy: preparedBy ?? null,
    reviewedBy: null,
    completedAt: null,
    createdAt: now,
    updatedAt: now,
  };

  const updated = [...recons, recon];
  writeRecons(updated);
  return recon;
}

export function autoMatch(reconId: string): Reconciliation {
  const recons = readRecons();
  const idx = recons.findIndex((r) => r.id === reconId);
  if (idx === -1) throw new Error(`Reconciliation ${reconId} not found`);

  const recon = recons[idx];
  const absDiff = Math.abs(recon.difference);

  // If difference is within tolerance, mark as reconciled
  if (absDiff <= recon.tolerance) {
    const matched: Reconciliation = {
      ...recon,
      status: 'reconciled',
      matchedItems: recon.matchedItems + 1,
      updatedAt: new Date().toISOString(),
      completedAt: new Date().toISOString(),
    };
    const updated = [...recons.slice(0, idx), matched, ...recons.slice(idx + 1)];
    writeRecons(updated);
    return matched;
  }

  // Otherwise create exception for the difference
  const exception: ReconException = {
    id: generateId(),
    description: `Unmatched difference of $${absDiff.toFixed(2)} on account ${recon.accountNumber}`,
    amount: recon.difference,
    status: 'open',
    ageInDays: 0,
    resolvedBy: null,
    resolution: null,
  };

  const withException: Reconciliation = {
    ...recon,
    status: 'exception',
    exceptions: [...recon.exceptions, exception],
    updatedAt: new Date().toISOString(),
  };

  const updated = [...recons.slice(0, idx), withException, ...recons.slice(idx + 1)];
  writeRecons(updated);
  return withException;
}

export function addException(
  reconId: string,
  description: string,
  amount: number
): Reconciliation {
  const recons = readRecons();
  const idx = recons.findIndex((r) => r.id === reconId);
  if (idx === -1) throw new Error(`Reconciliation ${reconId} not found`);

  const recon = recons[idx];
  const exception: ReconException = {
    id: generateId(),
    description,
    amount,
    status: 'open',
    ageInDays: 0,
    resolvedBy: null,
    resolution: null,
  };

  const updated: Reconciliation = {
    ...recon,
    status: 'exception',
    exceptions: [...recon.exceptions, exception],
    updatedAt: new Date().toISOString(),
  };

  const all = [...recons.slice(0, idx), updated, ...recons.slice(idx + 1)];
  writeRecons(all);
  return updated;
}

export function resolveException(
  reconId: string,
  exceptionId: string,
  resolution: string,
  resolvedBy: string
): Reconciliation {
  const recons = readRecons();
  const idx = recons.findIndex((r) => r.id === reconId);
  if (idx === -1) throw new Error(`Reconciliation ${reconId} not found`);

  const recon = recons[idx];
  const exIdx = recon.exceptions.findIndex((e) => e.id === exceptionId);
  if (exIdx === -1) throw new Error(`Exception ${exceptionId} not found`);

  const resolvedEx: ReconException = {
    ...recon.exceptions[exIdx],
    status: 'resolved',
    resolution,
    resolvedBy,
  };

  const newExceptions = [
    ...recon.exceptions.slice(0, exIdx),
    resolvedEx,
    ...recon.exceptions.slice(exIdx + 1),
  ];

  // Check if all exceptions are resolved/waived
  const allResolved = newExceptions.every((e) => e.status !== 'open');
  const newStatus: ReconStatus = allResolved ? 'reconciled' : 'exception';

  const updated: Reconciliation = {
    ...recon,
    status: newStatus,
    exceptions: newExceptions,
    updatedAt: new Date().toISOString(),
    completedAt: allResolved ? new Date().toISOString() : recon.completedAt,
  };

  const all = [...recons.slice(0, idx), updated, ...recons.slice(idx + 1)];
  writeRecons(all);
  return updated;
}

export function getReconById(id: string): Reconciliation | undefined {
  return readRecons().find((r) => r.id === id);
}

export function getReconsByPeriod(period: string): Reconciliation[] {
  return readRecons().filter((r) => r.period === period);
}

export function getReconsByStatus(status: ReconStatus): Reconciliation[] {
  return readRecons().filter((r) => r.status === status);
}

export function getExceptionAging(): Array<{ reconId: string; accountNumber: string; exception: ReconException }> {
  const recons = readRecons();
  const now = Date.now();
  const results: Array<{ reconId: string; accountNumber: string; exception: ReconException }> = [];

  for (const recon of recons) {
    for (const ex of recon.exceptions) {
      if (ex.status === 'open') {
        const createdMs = new Date(recon.createdAt).getTime();
        const ageInDays = Math.floor((now - createdMs) / (1000 * 60 * 60 * 24));
        results.push({
          reconId: recon.id,
          accountNumber: recon.accountNumber,
          exception: { ...ex, ageInDays },
        });
      }
    }
  }

  return results.sort((a, b) => b.exception.ageInDays - a.exception.ageInDays);
}

export function updateRecon(
  id: string,
  patch: Partial<Pick<Reconciliation, 'subBalance' | 'status' | 'evidence' | 'reviewedBy' | 'preparedBy' | 'tolerance'>>
): Reconciliation {
  const recons = readRecons();
  const idx = recons.findIndex((r) => r.id === id);
  if (idx === -1) throw new Error(`Reconciliation ${id} not found`);

  const recon = recons[idx];

  const subBalance = patch.subBalance ?? recon.subBalance;
  const difference = Math.round((recon.glBalance - subBalance) * 100) / 100;

  const updated: Reconciliation = {
    ...recon,
    ...patch,
    subBalance,
    difference,
    updatedAt: new Date().toISOString(),
    completedAt: patch.status === 'reconciled' ? new Date().toISOString() : recon.completedAt,
  };

  const all = [...recons.slice(0, idx), updated, ...recons.slice(idx + 1)];
  writeRecons(all);
  return updated;
}
