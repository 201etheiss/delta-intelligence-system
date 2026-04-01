/**
 * Tax Engine
 * Core logic for tax provision calculation, fuel tax by state,
 * estimated payments, and tax journal entry generation.
 * File persistence to data/tax-provisions.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type TaxProvisionStatus = 'draft' | 'review' | 'final';

export interface TaxProvision {
  readonly id: string;
  readonly period: string; // YYYY-MM
  readonly federalTaxable: number;
  readonly stateTaxable: number;
  readonly federalRate: number;
  readonly stateRate: number;
  readonly federalTax: number;
  readonly stateTax: number;
  readonly totalProvision: number;
  readonly estimatedPayments: number;
  readonly netDue: number;
  readonly preparedBy: string;
  readonly status: TaxProvisionStatus;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FuelTaxReturn {
  readonly id: string;
  readonly period: string; // YYYY-MM
  readonly state: string;
  readonly gallonsDelivered: number;
  readonly taxRate: number;
  readonly taxDue: number;
  readonly exemptGallons: number;
  readonly netTax: number;
}

export interface TaxCollectedSummary {
  readonly year: number;
  readonly totalCollected: number;
  readonly byType: ReadonlyArray<{ readonly type: string; readonly amount: number }>;
}

export interface TaxRateEntry {
  readonly jurisdiction: string;
  readonly rate: number;
  readonly effectiveDate: string;
}

export interface TaxJE {
  readonly id: string;
  readonly period: string;
  readonly description: string;
  readonly lines: ReadonlyArray<{
    readonly account: string;
    readonly accountName: string;
    readonly debit: number;
    readonly credit: number;
  }>;
  readonly createdAt: string;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const TAX_FILE = join(DATA_DIR, 'tax-provisions.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readProvisions(): readonly TaxProvision[] {
  ensureDataDir();
  if (!existsSync(TAX_FILE)) return [];
  try {
    const raw = readFileSync(TAX_FILE, 'utf-8');
    return JSON.parse(raw) as TaxProvision[];
  } catch {
    return [];
  }
}

function writeProvisions(provisions: readonly TaxProvision[]): void {
  ensureDataDir();
  writeFileSync(TAX_FILE, JSON.stringify(provisions, null, 2), 'utf-8');
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
// Input Validation
// ---------------------------------------------------------------------------

function validatePeriod(period: string): { year: number; month: number } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Invalid period format (expected YYYY-MM)');
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) throw new Error('Period out of range');
  return { year, month };
}

function validateYear(year: string | number): number {
  const y = typeof year === 'string' ? parseInt(year) : year;
  if (Number.isNaN(y) || y < 2000 || y > 2100) throw new Error('Year out of range (2000-2100)');
  return y;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FEDERAL_TAX_RATE = 0.21; // 21% corporate federal rate

// State rates by jurisdiction (Colorado default + common states)
const STATE_TAX_RATES: Readonly<Record<string, number>> = {
  CO: 0.044, // Colorado 4.4%
  TX: 0.0, // Texas — no state income tax (franchise tax handled separately)
  OK: 0.04, // Oklahoma 4%
  NM: 0.059, // New Mexico 5.9%
  WY: 0.0, // Wyoming — no state income tax
  KS: 0.04, // Kansas 4%
  NE: 0.0584, // Nebraska 5.84%
  UT: 0.0485, // Utah 4.85%
  AZ: 0.049, // Arizona 4.9%
  DEFAULT: 0.044, // Fallback: Colorado rate
};

// ---------------------------------------------------------------------------
// Core Functions
// ---------------------------------------------------------------------------

/**
 * Calculate tax provision for a given period.
 * Pulls pretax income from GL/Ascend, applies federal (21%) + state rates.
 */
export async function calculateProvision(
  period: string,
  opts?: { stateCode?: string; pretaxIncome?: number; preparedBy?: string }
): Promise<TaxProvision> {
  validatePeriod(period);
  // Try to pull pretax income from Ascend GL, fall back to provided value
  let pretaxIncome = opts?.pretaxIncome ?? 0;

  if (!opts?.pretaxIncome) {
    try {
      const resp = await gatewayFetch(`/ascend/gl/pretax-income?period=${period}`, 'admin');
      if (resp.success && resp.data) {
        const glData = resp.data as { pretaxIncome?: number };
        pretaxIncome = glData.pretaxIncome ?? 0;
      }
    } catch {
      // Ascend unavailable — use provided value or 0
    }
  }

  const stateCode = opts?.stateCode ?? 'CO';
  const stateRate = STATE_TAX_RATES[stateCode] ?? STATE_TAX_RATES['DEFAULT'];
  const federalTax = pretaxIncome * FEDERAL_TAX_RATE;
  const stateTax = pretaxIncome * stateRate;
  const totalProvision = federalTax + stateTax;

  // Pull estimated payments already made
  const estPayments = await getEstimatedPayments(period.slice(0, 4));
  const estimatedTotal = (estPayments ?? []).reduce((sum, p) => sum + p.amount, 0);

  const existing = readProvisions();
  const existingIndex = existing.findIndex((p) => p.period === period);

  const provision: TaxProvision = {
    id: existingIndex >= 0 ? existing[existingIndex].id : generateId('tax'),
    period,
    federalTaxable: pretaxIncome,
    stateTaxable: pretaxIncome,
    federalRate: FEDERAL_TAX_RATE,
    stateRate,
    federalTax: Math.round(federalTax * 100) / 100,
    stateTax: Math.round(stateTax * 100) / 100,
    totalProvision: Math.round(totalProvision * 100) / 100,
    estimatedPayments: Math.round(estimatedTotal * 100) / 100,
    netDue: Math.round((totalProvision - estimatedTotal) * 100) / 100,
    preparedBy: opts?.preparedBy ?? 'system',
    status: 'draft',
    createdAt: existingIndex >= 0 ? existing[existingIndex].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // Upsert
  const updated = existingIndex >= 0
    ? [...existing.slice(0, existingIndex), provision, ...existing.slice(existingIndex + 1)]
    : [...existing, provision];
  writeProvisions(updated);

  return provision;
}

/**
 * Get estimated tax payments made for a year.
 */
export async function getEstimatedPayments(
  year: string
): Promise<ReadonlyArray<{ readonly quarter: string; readonly amount: number; readonly paidAt: string }>> {
  const validYear = validateYear(year);
  try {
    const resp = await gatewayFetch(`/ascend/taxes/estimated-payments?year=${validYear}`, 'admin');
    if (resp.success && resp.data) {
      return resp.data as ReadonlyArray<{ quarter: string; amount: number; paidAt: string }>;
    }
  } catch {
    // Ascend unavailable
  }

  // Return stub data when gateway unavailable
  return [
    { quarter: `${year}-Q1`, amount: 0, paidAt: '' },
    { quarter: `${year}-Q2`, amount: 0, paidAt: '' },
    { quarter: `${year}-Q3`, amount: 0, paidAt: '' },
    { quarter: `${year}-Q4`, amount: 0, paidAt: '' },
  ];
}

/**
 * Get fuel tax by state for a period.
 * Pulls delivery volumes from Ascend billing by state.
 */
export async function getFuelTaxByState(period: string): Promise<readonly FuelTaxReturn[]> {
  validatePeriod(period);
  try {
    const resp = await gatewayFetch(`/ascend/billing/fuel-tax?period=${period}`, 'admin');
    if (resp.success && resp.data) {
      const raw = resp.data as ReadonlyArray<{
        state: string;
        gallonsDelivered: number;
        taxRate: number;
        exemptGallons: number;
      }>;
      return raw.map((r) => {
        const taxDue = r.gallonsDelivered * r.taxRate;
        const netTax = (r.gallonsDelivered - r.exemptGallons) * r.taxRate;
        return {
          id: generateId('ftx'),
          period,
          state: r.state,
          gallonsDelivered: r.gallonsDelivered,
          taxRate: r.taxRate,
          taxDue: Math.round(taxDue * 100) / 100,
          exemptGallons: r.exemptGallons,
          netTax: Math.round(netTax * 100) / 100,
        };
      });
    }
  } catch {
    // Ascend unavailable
  }

  // Stub data for common states
  const states = ['CO', 'TX', 'OK', 'NM', 'WY', 'KS'];
  return states.map((state) => ({
    id: generateId('ftx'),
    period,
    state,
    gallonsDelivered: 0,
    taxRate: 0,
    taxDue: 0,
    exemptGallons: 0,
    netTax: 0,
  }));
}

/**
 * Generate a draft journal entry for the tax provision.
 */
export function generateTaxJE(period: string): TaxJE {
  validatePeriod(period);
  const provisions = readProvisions();
  const provision = provisions.find((p) => p.period === period);

  if (!provision) {
    return {
      id: generateId('tje'),
      period,
      description: `Tax provision JE for ${period} — no provision calculated`,
      lines: [],
      createdAt: new Date().toISOString(),
    };
  }

  const lines: Array<{ account: string; accountName: string; debit: number; credit: number }> = [];

  if (provision.federalTax > 0) {
    lines.push(
      {
        account: '7100',
        accountName: 'Federal Income Tax Expense',
        debit: provision.federalTax,
        credit: 0,
      },
      {
        account: '2200',
        accountName: 'Federal Income Tax Payable',
        debit: 0,
        credit: provision.federalTax,
      }
    );
  }

  if (provision.stateTax > 0) {
    lines.push(
      {
        account: '7110',
        accountName: 'State Income Tax Expense',
        debit: provision.stateTax,
        credit: 0,
      },
      {
        account: '2210',
        accountName: 'State Income Tax Payable',
        debit: 0,
        credit: provision.stateTax,
      }
    );
  }

  return {
    id: generateId('tje'),
    period,
    description: `Tax provision for ${period} — Federal $${provision.federalTax.toFixed(2)} + State $${provision.stateTax.toFixed(2)}`,
    lines,
    createdAt: new Date().toISOString(),
  };
}

/**
 * Proxy to /ascend/taxes/collected for tax collected summary.
 */
export async function getTaxCollected(year: number): Promise<TaxCollectedSummary> {
  const validYear = validateYear(year);
  try {
    const resp = await gatewayFetch(`/ascend/taxes/collected?year=${validYear}`, 'admin');
    if (resp.success && resp.data) {
      return resp.data as TaxCollectedSummary;
    }
  } catch {
    // Ascend unavailable
  }

  return { year, totalCollected: 0, byType: [] };
}

/**
 * Proxy to /ascend/taxes/rates for current tax rates.
 */
export async function getTaxRates(): Promise<readonly TaxRateEntry[]> {
  try {
    const resp = await gatewayFetch('/ascend/taxes/rates', 'admin');
    if (resp.success && resp.data) {
      return resp.data as TaxRateEntry[];
    }
  } catch {
    // Ascend unavailable
  }

  // Return built-in rates as fallback
  return Object.entries(STATE_TAX_RATES)
    .filter(([k]) => k !== 'DEFAULT')
    .map(([jurisdiction, rate]) => ({
      jurisdiction,
      rate,
      effectiveDate: '2026-01-01',
    }));
}

/**
 * Get provision for a specific period (read-only).
 */
export function getProvision(period: string): TaxProvision | null {
  const provisions = readProvisions();
  return provisions.find((p) => p.period === period) ?? null;
}

/**
 * Get all provisions.
 */
export function getAllProvisions(): readonly TaxProvision[] {
  return readProvisions();
}
