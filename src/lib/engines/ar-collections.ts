/**
 * AR Collections Engine
 *
 * Collection queue management, contact logging, credit limits,
 * and credit risk assessment via the Ascend gateway.
 * File persistence to data/ar-collections.json and data/credit-limits.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export interface ContactEntry {
  date: string;
  method: 'phone' | 'email' | 'letter' | 'visit';
  notes: string;
  contactedBy: string;
}

export type CollectionStatus =
  | 'pending'
  | 'contacted'
  | 'promised'
  | 'escalated'
  | 'resolved'
  | 'written_off';

export type CollectionPriority = 'low' | 'medium' | 'high' | 'critical';

export interface CollectionAction {
  id: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  amount: number;
  ageInDays: number;
  status: CollectionStatus;
  assignedTo: string | null;
  contactLog: ContactEntry[];
  nextFollowUp: string | null; // ISO date
  priority: CollectionPriority;
  createdAt: string;
  updatedAt: string;
}

export interface CreditLimit {
  id: string;
  customerId: string;
  customerName: string;
  limit: number;
  currentUtilization: number;
  riskScore: number; // 1-10
  lastReviewed: string;
  reviewedBy: string | null;
}

export interface CollectionStats {
  totalPastDue: number;
  totalPastDue90Plus: number;
  openActions: number;
  promisedPayments: number;
  totalCollected: number;
  collectionRate: number; // percentage 0-100
  avgDaysToResolve: number;
}

interface CollectionsFile {
  actions: CollectionAction[];
  lastUpdated: string;
}

interface CreditLimitsFile {
  limits: CreditLimit[];
  lastUpdated: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getCollectionsPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/ar-collections.json';
  }
  return path.join(process.cwd(), 'data', 'ar-collections.json');
}

function getCreditPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/credit-limits.json';
  }
  return path.join(process.cwd(), 'data', 'credit-limits.json');
}

function readCollections(): CollectionsFile {
  const filePath = getCollectionsPath();
  if (!existsSync(filePath)) {
    return { actions: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CollectionsFile;
  } catch {
    return { actions: [], lastUpdated: new Date().toISOString() };
  }
}

function writeCollections(data: CollectionsFile): void {
  const filePath = getCollectionsPath();
  writeFileSync(
    filePath,
    JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8'
  );
}

function readCreditLimits(): CreditLimitsFile {
  const filePath = getCreditPath();
  if (!existsSync(filePath)) {
    return { limits: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as CreditLimitsFile;
  } catch {
    return { limits: [], lastUpdated: new Date().toISOString() };
  }
}

function writeCreditLimits(data: CreditLimitsFile): void {
  const filePath = getCreditPath();
  writeFileSync(
    filePath,
    JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8'
  );
}

function generateId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Gateway Helpers ──────────────────────────────────────────

async function queryAscend(sql: string): Promise<Array<Record<string, unknown>>> {
  const query = encodeURIComponent(sql);
  const result = await gatewayFetch(`/ascend/query?sql=${query}`, 'admin', { timeout: 20000 });
  if (!result.success || !result.data) return [];
  return result.data as Array<Record<string, unknown>>;
}

// ── Priority Helpers ─────────────────────────────────────────

function computePriority(amount: number, ageInDays: number): CollectionPriority {
  if (ageInDays >= 180 || amount >= 100_000) return 'critical';
  if (ageInDays >= 120 || amount >= 50_000) return 'high';
  if (ageInDays >= 90 || amount >= 20_000) return 'medium';
  return 'low';
}

// ── Core Functions ───────────────────────────────────────────

/**
 * Pull AR aging from Ascend and create CollectionActions for all 90+ day balances.
 * Prioritized by amount descending.
 */
export async function generateCollectionQueue(): Promise<CollectionAction[]> {
  const agingRows = await queryAscend(
    "SELECT CustomerCode, CustomerName, InvoiceNumber, Balance, DaysOutstanding " +
    "FROM ARAgingDetail WHERE DaysOutstanding >= 90 AND Balance > 0 " +
    "ORDER BY Balance DESC"
  );

  const data = readCollections();
  const existingInvoiceIds = new Set(data.actions.map((a) => a.invoiceId));
  const now = new Date().toISOString();

  const newActions: CollectionAction[] = (agingRows ?? [])
    .filter((row) => !existingInvoiceIds.has(String(row.InvoiceNumber ?? '')))
    .map((row) => {
      const amount = Number(row.Balance ?? 0);
      const ageInDays = Number(row.DaysOutstanding ?? 90);
      return {
        id: generateId('col'),
        customerId: String(row.CustomerCode ?? ''),
        customerName: String(row.CustomerName ?? 'Unknown'),
        invoiceId: String(row.InvoiceNumber ?? ''),
        amount: Math.round(amount * 100) / 100,
        ageInDays,
        status: 'pending' as CollectionStatus,
        assignedTo: null,
        contactLog: [],
        nextFollowUp: null,
        priority: computePriority(amount, ageInDays),
        createdAt: now,
        updatedAt: now,
      };
    });

  const updatedActions = [...data.actions, ...newActions];
  writeCollections({ ...data, actions: updatedActions });
  return newActions;
}

/**
 * Get the current collection queue with optional filters.
 */
export function getCollectionQueue(filters?: {
  priority?: CollectionPriority;
  assignedTo?: string;
  status?: CollectionStatus;
}): CollectionAction[] {
  const data = readCollections();
  let queue = [...data.actions];

  if (filters?.priority) {
    queue = queue.filter((a) => a.priority === filters.priority);
  }
  if (filters?.assignedTo) {
    queue = queue.filter((a) => a.assignedTo === filters.assignedTo);
  }
  if (filters?.status) {
    queue = queue.filter((a) => a.status === filters.status);
  }

  // Sort: critical first, then by amount descending
  const priorityOrder: Record<CollectionPriority, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  queue.sort((a, b) => {
    const pd = priorityOrder[a.priority] - priorityOrder[b.priority];
    if (pd !== 0) return pd;
    return b.amount - a.amount;
  });

  return queue;
}

/**
 * Log a contact attempt on a collection action.
 */
export function logContact(actionId: string, entry: ContactEntry): CollectionAction {
  const data = readCollections();
  const idx = data.actions.findIndex((a) => a.id === actionId);
  if (idx === -1) throw new Error(`Collection action not found: ${actionId}`);

  const action = data.actions[idx];
  const updated: CollectionAction = {
    ...action,
    contactLog: [...action.contactLog, entry],
    status: action.status === 'pending' ? 'contacted' : action.status,
    updatedAt: new Date().toISOString(),
  };
  const updatedActions = [...data.actions];
  updatedActions[idx] = updated;
  writeCollections({ ...data, actions: updatedActions });
  return updated;
}

/**
 * Escalate a collection action.
 */
export function escalate(actionId: string): CollectionAction {
  const data = readCollections();
  const idx = data.actions.findIndex((a) => a.id === actionId);
  if (idx === -1) throw new Error(`Collection action not found: ${actionId}`);

  const updated: CollectionAction = {
    ...data.actions[idx],
    status: 'escalated',
    updatedAt: new Date().toISOString(),
  };
  const updatedActions = [...data.actions];
  updatedActions[idx] = updated;
  writeCollections({ ...data, actions: updatedActions });
  return updated;
}

/**
 * Resolve a collection action with a resolution note.
 */
export function resolve(actionId: string, resolution: string): CollectionAction {
  const data = readCollections();
  const idx = data.actions.findIndex((a) => a.id === actionId);
  if (idx === -1) throw new Error(`Collection action not found: ${actionId}`);

  const now = new Date().toISOString();
  const updated: CollectionAction = {
    ...data.actions[idx],
    status: 'resolved',
    contactLog: [
      ...data.actions[idx].contactLog,
      { date: now, method: 'email', notes: `Resolved: ${resolution}`, contactedBy: 'system' },
    ],
    updatedAt: now,
  };
  const updatedActions = [...data.actions];
  updatedActions[idx] = updated;
  writeCollections({ ...data, actions: updatedActions });
  return updated;
}

/**
 * Update status of a collection action (e.g., to 'promised' or 'written_off').
 */
export function updateCollectionAction(
  actionId: string,
  updates: Partial<Pick<CollectionAction, 'status' | 'assignedTo' | 'nextFollowUp'>>
): CollectionAction {
  const data = readCollections();
  const idx = data.actions.findIndex((a) => a.id === actionId);
  if (idx === -1) throw new Error(`Collection action not found: ${actionId}`);

  const updated: CollectionAction = {
    ...data.actions[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  const updatedActions = [...data.actions];
  updatedActions[idx] = updated;
  writeCollections({ ...data, actions: updatedActions });
  return updated;
}

/**
 * Get collection statistics.
 */
export function getCollectionStats(): CollectionStats {
  const data = readCollections();
  const actions = data.actions ?? [];

  const openStatuses: CollectionStatus[] = ['pending', 'contacted', 'promised', 'escalated'];
  const openActions = actions.filter((a) => openStatuses.includes(a.status));
  const resolvedActions = actions.filter((a) => a.status === 'resolved');

  const totalPastDue = openActions.reduce((sum, a) => sum + a.amount, 0);
  const totalPastDue90Plus = openActions
    .filter((a) => a.ageInDays >= 90)
    .reduce((sum, a) => sum + a.amount, 0);
  const promisedPayments = actions
    .filter((a) => a.status === 'promised')
    .reduce((sum, a) => sum + a.amount, 0);
  const totalCollected = resolvedActions.reduce((sum, a) => sum + a.amount, 0);

  const totalAttempted = resolvedActions.length + openActions.length;
  const collectionRate = totalAttempted > 0
    ? Math.round((resolvedActions.length / totalAttempted) * 100)
    : 0;

  let avgDaysToResolve = 0;
  if (resolvedActions.length > 0) {
    const totalDays = resolvedActions.reduce((sum, a) => {
      const created = new Date(a.createdAt).getTime();
      const updated = new Date(a.updatedAt).getTime();
      return sum + Math.max(1, Math.round((updated - created) / (1000 * 60 * 60 * 24)));
    }, 0);
    avgDaysToResolve = Math.round(totalDays / resolvedActions.length);
  }

  return {
    totalPastDue: Math.round(totalPastDue * 100) / 100,
    totalPastDue90Plus: Math.round(totalPastDue90Plus * 100) / 100,
    openActions: openActions.length,
    promisedPayments: Math.round(promisedPayments * 100) / 100,
    totalCollected: Math.round(totalCollected * 100) / 100,
    collectionRate,
    avgDaysToResolve,
  };
}

// ── Credit Limits ────────────────────────────────────────────

/**
 * Get all credit limits.
 */
export function getCreditLimits(): CreditLimit[] {
  const data = readCreditLimits();
  return data.limits ?? [];
}

/**
 * Update or create a credit limit for a customer.
 */
export function updateCreditLimit(
  customerId: string,
  limit: number,
  reviewedBy: string
): CreditLimit {
  const data = readCreditLimits();
  const idx = data.limits.findIndex((l) => l.customerId === customerId);
  const now = new Date().toISOString();

  if (idx >= 0) {
    const updated: CreditLimit = {
      ...data.limits[idx],
      limit,
      lastReviewed: now,
      reviewedBy,
    };
    const updatedLimits = [...data.limits];
    updatedLimits[idx] = updated;
    writeCreditLimits({ ...data, limits: updatedLimits });
    return updated;
  }

  const newLimit: CreditLimit = {
    id: generateId('cl'),
    customerId,
    customerName: customerId, // Will be enriched by assessCreditRisk
    limit,
    currentUtilization: 0,
    riskScore: 5,
    lastReviewed: now,
    reviewedBy,
  };
  const updatedLimits = [...data.limits, newLimit];
  writeCreditLimits({ ...data, limits: updatedLimits });
  return newLimit;
}

/**
 * Assess credit risk for a customer by pulling AR history and payment patterns from Ascend.
 */
export async function assessCreditRisk(customerId: string): Promise<CreditLimit> {
  // Get customer AR balance
  const arRows = await queryAscend(
    `SELECT CustomerName, SUM(Balance) as TotalAR FROM ARAgingDetail ` +
    `WHERE CustomerCode = '${customerId}' GROUP BY CustomerName`
  );
  const customerName = String(arRows[0]?.CustomerName ?? customerId);
  const totalAR = Number(arRows[0]?.TotalAR ?? 0);

  // Get payment history — avg days to pay
  const payRows = await queryAscend(
    `SELECT AVG(DATEDIFF(day, InvoiceDate, PaymentDate)) as AvgDaysToPay ` +
    `FROM ARPaymentHistory WHERE CustomerCode = '${customerId}'`
  );
  const avgDaysToPay = Number(payRows[0]?.AvgDaysToPay ?? 30);

  // Compute risk score (1 = lowest risk, 10 = highest)
  let riskScore = 3; // base
  if (avgDaysToPay > 90) riskScore += 4;
  else if (avgDaysToPay > 60) riskScore += 3;
  else if (avgDaysToPay > 45) riskScore += 2;
  else if (avgDaysToPay > 30) riskScore += 1;

  if (totalAR > 100_000) riskScore += 2;
  else if (totalAR > 50_000) riskScore += 1;

  riskScore = Math.min(10, Math.max(1, riskScore));

  const data = readCreditLimits();
  const idx = data.limits.findIndex((l) => l.customerId === customerId);
  const now = new Date().toISOString();

  // Suggest limit based on risk
  const suggestedLimit = riskScore <= 3 ? 200_000
    : riskScore <= 5 ? 100_000
    : riskScore <= 7 ? 50_000
    : 25_000;

  const creditLimit: CreditLimit = {
    id: idx >= 0 ? data.limits[idx].id : generateId('cl'),
    customerId,
    customerName,
    limit: idx >= 0 ? data.limits[idx].limit : suggestedLimit,
    currentUtilization: Math.round(totalAR * 100) / 100,
    riskScore,
    lastReviewed: now,
    reviewedBy: 'system',
  };

  const updatedLimits = [...data.limits];
  if (idx >= 0) {
    updatedLimits[idx] = creditLimit;
  } else {
    updatedLimits.push(creditLimit);
  }
  writeCreditLimits({ ...data, limits: updatedLimits });
  return creditLimit;
}
