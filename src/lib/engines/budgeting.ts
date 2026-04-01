/**
 * Budgeting & FP&A Engine
 *
 * Budget creation, budget vs actual comparison, variance reporting,
 * scenario modeling, and rolling forecasts via the Ascend gateway.
 * File persistence to data/budgets.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export type BudgetVersion = 'original' | 'revised' | 'forecast';
export type BudgetStatus = 'draft' | 'approved' | 'active';
export type AccountType = 'revenue' | 'cogs' | 'opex' | 'capex' | 'other';

export interface BudgetLine {
  accountNumber: string;
  accountName: string;
  type: AccountType;
  profitCenter: string;
  monthly: [number, number, number, number, number, number, number, number, number, number, number, number];
  annual: number;
}

export interface Budget {
  id: string;
  year: number;
  version: BudgetVersion;
  status: BudgetStatus;
  lines: BudgetLine[];
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetVsActual {
  period: string; // YYYY-MM
  accountNumber: string;
  accountName: string;
  type: AccountType;
  profitCenter: string;
  budgetAmount: number;
  actualAmount: number;
  variance: number;
  variancePct: number;
}

export interface Scenario {
  id: string;
  name: string;
  assumptions: Record<string, number>; // e.g. { "revenueGrowth": 0.05, "cogsReduction": 0.02 }
  adjustments: BudgetLine[];
  createdAt: string;
}

interface BudgetsFile {
  budgets: Budget[];
  scenarios: Scenario[];
  lastUpdated: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getDataPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/budgets.json';
  }
  return path.join(process.cwd(), 'data', 'budgets.json');
}

function readData(): BudgetsFile {
  const filePath = getDataPath();
  if (!existsSync(filePath)) {
    return { budgets: [], scenarios: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as BudgetsFile;
  } catch {
    return { budgets: [], scenarios: [], lastUpdated: new Date().toISOString() };
  }
}

function writeData(data: BudgetsFile): void {
  const filePath = getDataPath();
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

// ── Input Validation ────────────────────────────────────────

function validatePeriod(period: string): { year: number; month: number } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Invalid period format (expected YYYY-MM)');
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) throw new Error('Period out of range');
  return { year, month };
}

function validateYear(year: number): number {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new Error('Year out of range (2000-2100)');
  return year;
}

// ── Core Functions ───────────────────────────────────────────

/**
 * Create a new budget for a given year with empty lines.
 */
export function createBudget(year: number, createdBy: string): Budget {
  const data = readData();
  const now = new Date().toISOString();

  const budget: Budget = {
    id: generateId('bud'),
    year,
    version: 'original',
    status: 'draft',
    lines: [],
    createdBy,
    approvedBy: null,
    createdAt: now,
    updatedAt: now,
  };

  const updatedBudgets = [...data.budgets, budget];
  writeData({ ...data, budgets: updatedBudgets });
  return budget;
}

/**
 * Import budget lines from a CSV-like array of objects.
 */
export function importBudgetLines(
  budgetId: string,
  lines: BudgetLine[]
): Budget {
  const data = readData();
  const idx = data.budgets.findIndex((b) => b.id === budgetId);
  if (idx === -1) throw new Error(`Budget not found: ${budgetId}`);

  // Recompute annual for each line
  const enrichedLines = lines.map((line) => ({
    ...line,
    annual: line.monthly.reduce((sum, m) => sum + m, 0),
  }));

  const updated: Budget = {
    ...data.budgets[idx],
    lines: enrichedLines,
    updatedAt: new Date().toISOString(),
  };
  const updatedBudgets = [...data.budgets];
  updatedBudgets[idx] = updated;
  writeData({ ...data, budgets: updatedBudgets });
  return updated;
}

/**
 * List budgets with optional filters.
 */
export function listBudgets(filters?: {
  year?: number;
  status?: BudgetStatus;
  version?: BudgetVersion;
}): Budget[] {
  const data = readData();
  let budgets = [...data.budgets];

  if (filters?.year) {
    budgets = budgets.filter((b) => b.year === filters.year);
  }
  if (filters?.status) {
    budgets = budgets.filter((b) => b.status === filters.status);
  }
  if (filters?.version) {
    budgets = budgets.filter((b) => b.version === filters.version);
  }

  return budgets;
}

/**
 * Update a budget's status or lines.
 */
export function updateBudget(
  budgetId: string,
  updates: Partial<Pick<Budget, 'status' | 'version' | 'approvedBy' | 'lines'>>
): Budget {
  const data = readData();
  const idx = data.budgets.findIndex((b) => b.id === budgetId);
  if (idx === -1) throw new Error(`Budget not found: ${budgetId}`);

  const updated: Budget = {
    ...data.budgets[idx],
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  // Recompute annuals if lines updated
  if (updates.lines) {
    updated.lines = updated.lines.map((line) => ({
      ...line,
      annual: line.monthly.reduce((sum, m) => sum + m, 0),
    }));
  }

  const updatedBudgets = [...data.budgets];
  updatedBudgets[idx] = updated;
  writeData({ ...data, budgets: updatedBudgets });
  return updated;
}

/**
 * Get budget vs actual comparison for a given period.
 * Pulls actuals from Ascend GL and compares to budget lines.
 */
export async function getBudgetVsActual(
  period: string, // YYYY-MM
  profitCenter?: string
): Promise<BudgetVsActual[]> {
  const { year, month } = validatePeriod(period);
  const monthIdx = month - 1; // 0-indexed

  // Find active budget for the year
  const data = readData();
  const budget = data.budgets.find(
    (b) => b.year === year && (b.status === 'active' || b.status === 'approved')
  );
  if (!budget) {
    return [];
  }

  // Pull actuals from GL
  const actualRows = await queryAscend(
    `SELECT Account, Account_Desc, SUM(Amount) as Actual ` +
    `FROM GLDetail WHERE Period = '${period}' ` +
    `GROUP BY Account, Account_Desc`
  );

  const actualsMap = new Map<string, number>();
  for (const row of actualRows ?? []) {
    actualsMap.set(String(row.Account ?? ''), Number(row.Actual ?? 0));
  }

  let lines = budget.lines;
  if (profitCenter) {
    lines = lines.filter((l) => l.profitCenter === profitCenter);
  }

  return lines.map((line) => {
    const budgetAmount = line.monthly[monthIdx] ?? 0;
    const actualAmount = actualsMap.get(line.accountNumber) ?? 0;
    const variance = actualAmount - budgetAmount;
    const variancePct = budgetAmount !== 0
      ? Math.round((variance / Math.abs(budgetAmount)) * 10000) / 100
      : 0;

    return {
      period,
      accountNumber: line.accountNumber,
      accountName: line.accountName,
      type: line.type,
      profitCenter: line.profitCenter,
      budgetAmount: Math.round(budgetAmount * 100) / 100,
      actualAmount: Math.round(actualAmount * 100) / 100,
      variance: Math.round(variance * 100) / 100,
      variancePct,
    };
  });
}

/**
 * Get variance report — only accounts exceeding threshold percentage.
 */
export async function getVarianceReport(
  period: string,
  thresholdPct: number = 10,
  profitCenter?: string
): Promise<BudgetVsActual[]> {
  const bva = await getBudgetVsActual(period, profitCenter);
  return bva.filter((row) => Math.abs(row.variancePct) >= thresholdPct);
}

// ── Scenarios ────────────────────────────────────────────────

/**
 * Create a new scenario.
 */
export function createScenario(
  name: string,
  assumptions: Record<string, number>
): Scenario {
  const data = readData();
  const scenario: Scenario = {
    id: generateId('scn'),
    name,
    assumptions,
    adjustments: [],
    createdAt: new Date().toISOString(),
  };
  const updatedScenarios = [...data.scenarios, scenario];
  writeData({ ...data, scenarios: updatedScenarios });
  return scenario;
}

/**
 * List all scenarios.
 */
export function listScenarios(): Scenario[] {
  const data = readData();
  return data.scenarios ?? [];
}

/**
 * Apply a scenario to a budget, creating a revised version.
 * Applies percentage adjustments from assumptions to matching account types.
 */
export function applyScenario(budgetId: string, scenarioId: string): Budget {
  const data = readData();
  const budget = data.budgets.find((b) => b.id === budgetId);
  if (!budget) throw new Error(`Budget not found: ${budgetId}`);

  const scenario = data.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) throw new Error(`Scenario not found: ${scenarioId}`);

  const adjustedLines: BudgetLine[] = budget.lines.map((line) => {
    let multiplier = 1;

    // Apply assumption multipliers by account type
    if (line.type === 'revenue' && scenario.assumptions['revenueGrowth'] !== undefined) {
      multiplier = 1 + scenario.assumptions['revenueGrowth'];
    }
    if (line.type === 'cogs' && scenario.assumptions['cogsChange'] !== undefined) {
      multiplier = 1 + scenario.assumptions['cogsChange'];
    }
    if (line.type === 'opex' && scenario.assumptions['opexChange'] !== undefined) {
      multiplier = 1 + scenario.assumptions['opexChange'];
    }
    if (line.type === 'capex' && scenario.assumptions['capexChange'] !== undefined) {
      multiplier = 1 + scenario.assumptions['capexChange'];
    }

    const newMonthly = line.monthly.map((m) =>
      Math.round(m * multiplier * 100) / 100
    ) as BudgetLine['monthly'];

    return {
      ...line,
      monthly: newMonthly,
      annual: newMonthly.reduce((sum, m) => sum + m, 0),
    };
  });

  // Create a revised budget
  const revised: Budget = {
    id: generateId('bud'),
    year: budget.year,
    version: 'revised',
    status: 'draft',
    lines: adjustedLines,
    createdBy: 'system',
    approvedBy: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  const updatedBudgets = [...data.budgets, revised];
  writeData({ ...data, budgets: updatedBudgets });
  return revised;
}

// ── Rolling Forecast ─────────────────────────────────────────

/**
 * Generate a rolling forecast by extrapolating from YTD actuals.
 * Returns monthly figures: actuals for past months + projected for future months.
 */
export async function getRollingForecast(
  year: number,
  monthsForward: number = 3
): Promise<Array<{ month: string; actual: number | null; projected: number | null }>> {
  validateYear(year);
  const now = new Date();
  const currentMonth = now.getFullYear() === year ? now.getMonth() + 1 : 12; // 1-indexed

  // Pull YTD actuals
  const actualRows = await queryAscend(
    `SELECT Period, SUM(Amount) as Total FROM GLDetail ` +
    `WHERE Period LIKE '${year}-%' AND Account LIKE '4%' ` +
    `GROUP BY Period ORDER BY Period`
  );

  const monthlyActuals = new Map<number, number>();
  for (const row of actualRows ?? []) {
    const periodStr = String(row.Period ?? '');
    const month = parseInt(periodStr.split('-')[1] ?? '0', 10);
    if (month >= 1 && month <= 12) {
      monthlyActuals.set(month, Number(row.Total ?? 0));
    }
  }

  // Calculate average of last 3 months for projection
  const completedMonths = Math.min(currentMonth - 1, 12);
  const lookbackStart = Math.max(1, completedMonths - 2);
  let lookbackSum = 0;
  let lookbackCount = 0;
  for (let m = lookbackStart; m <= completedMonths; m++) {
    const val = monthlyActuals.get(m);
    if (val !== undefined) {
      lookbackSum += val;
      lookbackCount++;
    }
  }
  const avgMonthly = lookbackCount > 0 ? lookbackSum / lookbackCount : 0;

  const endMonth = Math.min(12, completedMonths + monthsForward);
  const result: Array<{ month: string; actual: number | null; projected: number | null }> = [];

  for (let m = 1; m <= endMonth; m++) {
    const monthStr = `${year}-${String(m).padStart(2, '0')}`;
    if (m <= completedMonths) {
      result.push({
        month: monthStr,
        actual: Math.round((monthlyActuals.get(m) ?? 0) * 100) / 100,
        projected: null,
      });
    } else {
      result.push({
        month: monthStr,
        actual: null,
        projected: Math.round(avgMonthly * 100) / 100,
      });
    }
  }

  return result;
}
