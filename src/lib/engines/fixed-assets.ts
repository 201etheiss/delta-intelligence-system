/**
 * Fixed Asset Register Engine
 *
 * Manages fixed assets, depreciation calculations (straight-line + MACRS),
 * and generates JE-ready depreciation entries.
 * File persistence to data/fixed-assets.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export type AssetCategory = 'vehicles' | 'equipment' | 'buildings' | 'land' | 'cip' | 'other';
export type DepreciationMethod = 'straight_line' | 'macrs_5' | 'macrs_7' | 'macrs_15';
export type AssetStatus = 'active' | 'disposed' | 'cip';

export interface FixedAsset {
  readonly id: string;
  readonly code: string;
  readonly description: string;
  readonly category: AssetCategory;
  readonly acquisitionDate: string;
  readonly cost: number;
  readonly salvageValue: number;
  readonly usefulLifeMonths: number;
  readonly depreciationMethod: DepreciationMethod;
  readonly accumulatedDepreciation: number;
  readonly netBookValue: number;
  readonly glAccountAsset: string;
  readonly glAccountDepreciation: string;
  readonly glAccountExpense: string;
  readonly profitCenter: string;
  readonly entityId: string;
  readonly status: AssetStatus;
  readonly disposedDate: string | null;
  readonly disposalProceeds: number | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface DepreciationJELine {
  readonly account: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly profitCenter: string;
  readonly description: string;
  readonly entityId: string;
}

export interface DepreciationJE {
  readonly id: string;
  readonly period: string;
  readonly description: string;
  readonly lines: readonly DepreciationJELine[];
  readonly totalDebit: number;
  readonly totalCredit: number;
  readonly assetCount: number;
  readonly createdAt: string;
}

export interface AssetSummary {
  readonly totalAssets: number;
  readonly totalCost: number;
  readonly totalNBV: number;
  readonly totalAccumDepr: number;
  readonly monthlyDepreciationRunRate: number;
  readonly cipBalance: number;
  readonly byCategory: ReadonlyArray<{
    readonly category: AssetCategory;
    readonly count: number;
    readonly cost: number;
    readonly nbv: number;
    readonly monthlyDepr: number;
  }>;
}

export interface CreateAssetInput {
  readonly code: string;
  readonly description: string;
  readonly category: AssetCategory;
  readonly acquisitionDate: string;
  readonly cost: number;
  readonly salvageValue: number;
  readonly usefulLifeMonths: number;
  readonly depreciationMethod: DepreciationMethod;
  readonly glAccountAsset: string;
  readonly glAccountDepreciation: string;
  readonly glAccountExpense: string;
  readonly profitCenter: string;
  readonly entityId: string;
  readonly status?: AssetStatus;
}

interface AssetsFile {
  assets: FixedAsset[];
  depreciationJEs: DepreciationJE[];
  lastUpdated: string;
}

// ── MACRS Tables ─────────────────────────────────────────────

/** MACRS half-year convention percentages by year */
const MACRS_5: readonly number[] = [20.00, 32.00, 19.20, 11.52, 11.52, 5.76];
const MACRS_7: readonly number[] = [14.29, 24.49, 17.49, 12.49, 8.93, 8.92, 8.93, 4.46];
const MACRS_15: readonly number[] = [5.00, 9.50, 8.55, 7.70, 6.93, 6.23, 5.90, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 5.90, 5.91, 2.95];

function getMacrsTable(method: DepreciationMethod): readonly number[] | null {
  switch (method) {
    case 'macrs_5': return MACRS_5;
    case 'macrs_7': return MACRS_7;
    case 'macrs_15': return MACRS_15;
    default: return null;
  }
}

// ── GL Account Mapping ───────────────────────────────────────

const GL_ACCOUNTS: Readonly<Record<string, string>> = {
  '17200': 'Vehicles',
  '17300': 'Equipment',
  '17400': 'Buildings',
  '17500': 'Land',
  '17800': 'Construction in Progress',
  '17900': 'Other Fixed Assets',
  '18200': 'Accum Depreciation - Vehicles',
  '18300': 'Accum Depreciation - Equipment',
  '18400': 'Accum Depreciation - Buildings',
  '18900': 'Accum Depreciation - Other',
  '65100': 'Depreciation Expense - Vehicles',
  '65200': 'Depreciation Expense - Equipment',
  '65300': 'Depreciation Expense - Buildings',
  '65900': 'Depreciation Expense - Other',
};

function glName(account: string): string {
  return GL_ACCOUNTS[account] ?? `GL ${account}`;
}

// ── File I/O ─────────────────────────────────────────────────

function getDataPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/fixed-assets.json';
  }
  return path.join(process.cwd(), 'data', 'fixed-assets.json');
}

function readData(): AssetsFile {
  const filePath = getDataPath();
  if (!existsSync(filePath)) {
    return { assets: [], depreciationJEs: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as AssetsFile;
  } catch {
    return { assets: [], depreciationJEs: [], lastUpdated: new Date().toISOString() };
  }
}

function writeData(data: AssetsFile): void {
  const filePath = getDataPath();
  writeFileSync(
    filePath,
    JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8'
  );
}

function generateId(): string {
  return `fa-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Gateway Helpers ──────────────────────────────────────────

async function queryAscend(sql: string): Promise<Array<Record<string, unknown>>> {
  const query = encodeURIComponent(sql);
  const result = await gatewayFetch(`/ascend/query?sql=${query}`, 'admin', { timeout: 20000 });
  if (!result.success || !result.data) return [];
  return result.data as Array<Record<string, unknown>>;
}

// ── Depreciation Calculation ─────────────────────────────────

function monthsBetween(startDate: string, endDate: string): number {
  const start = new Date(startDate);
  const end = new Date(endDate);
  return (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
}

/**
 * Calculate monthly depreciation for one asset.
 * Straight-line: (cost - salvage) / usefulLifeMonths
 * MACRS: annual rate / 12 applied to cost (no salvage in MACRS)
 */
export function calculateMonthlyDepreciation(asset: FixedAsset): {
  readonly monthlyAmount: number;
  readonly debitAccount: string;
  readonly debitName: string;
  readonly creditAccount: string;
  readonly creditName: string;
} {
  if (asset.status !== 'active' || asset.category === 'land') {
    return {
      monthlyAmount: 0,
      debitAccount: asset.glAccountExpense,
      debitName: glName(asset.glAccountExpense),
      creditAccount: asset.glAccountDepreciation,
      creditName: glName(asset.glAccountDepreciation),
    };
  }

  let monthlyAmount = 0;

  if (asset.depreciationMethod === 'straight_line') {
    if (asset.usefulLifeMonths > 0) {
      monthlyAmount = (asset.cost - asset.salvageValue) / asset.usefulLifeMonths;
    }
  } else {
    const table = getMacrsTable(asset.depreciationMethod);
    if (table) {
      const monthsElapsed = monthsBetween(asset.acquisitionDate, new Date().toISOString());
      const yearIndex = Math.floor(monthsElapsed / 12);
      if (yearIndex >= 0 && yearIndex < table.length) {
        const annualRate = table[yearIndex] / 100;
        monthlyAmount = (asset.cost * annualRate) / 12;
      }
    }
  }

  // Cap depreciation so we don't exceed cost - salvage (or cost for MACRS)
  const maxRemaining = asset.cost - (asset.depreciationMethod === 'straight_line' ? asset.salvageValue : 0) - asset.accumulatedDepreciation;
  monthlyAmount = Math.min(monthlyAmount, Math.max(0, maxRemaining));

  return {
    monthlyAmount: Math.round(monthlyAmount * 100) / 100,
    debitAccount: asset.glAccountExpense,
    debitName: glName(asset.glAccountExpense),
    creditAccount: asset.glAccountDepreciation,
    creditName: glName(asset.glAccountDepreciation),
  };
}

// ── Core Functions ───────────────────────────────────────────

export function getAssets(
  filters?: { category?: AssetCategory; status?: AssetStatus }
): readonly FixedAsset[] {
  const data = readData();
  let assets = data.assets;

  if (filters?.category) {
    assets = assets.filter((a) => a.category === filters.category);
  }
  if (filters?.status) {
    assets = assets.filter((a) => a.status === filters.status);
  }

  return assets;
}

export function getAsset(id: string): FixedAsset | null {
  const data = readData();
  return data.assets.find((a) => a.id === id) ?? null;
}

export function createAsset(input: CreateAssetInput): FixedAsset {
  const data = readData();
  const now = new Date().toISOString();

  const asset: FixedAsset = {
    id: generateId(),
    code: input.code,
    description: input.description,
    category: input.category,
    acquisitionDate: input.acquisitionDate,
    cost: input.cost,
    salvageValue: input.salvageValue,
    usefulLifeMonths: input.usefulLifeMonths,
    depreciationMethod: input.depreciationMethod,
    accumulatedDepreciation: 0,
    netBookValue: input.cost,
    glAccountAsset: input.glAccountAsset,
    glAccountDepreciation: input.glAccountDepreciation,
    glAccountExpense: input.glAccountExpense,
    profitCenter: input.profitCenter,
    entityId: input.entityId,
    status: input.status ?? 'active',
    disposedDate: null,
    disposalProceeds: null,
    createdAt: now,
    updatedAt: now,
  };

  writeData({
    ...data,
    assets: [...data.assets, asset],
  });

  return asset;
}

export function disposeAsset(
  id: string,
  disposedDate: string,
  disposalProceeds: number
): FixedAsset | null {
  const data = readData();
  const idx = data.assets.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const existing = data.assets[idx];
  const updated: FixedAsset = {
    ...existing,
    status: 'disposed',
    disposedDate,
    disposalProceeds,
    updatedAt: new Date().toISOString(),
  };

  const newAssets = [...data.assets];
  newAssets[idx] = updated;
  writeData({ ...data, assets: newAssets });

  return updated;
}

export function updateAsset(
  id: string,
  updates: Partial<Pick<FixedAsset, 'description' | 'category' | 'profitCenter' | 'status' | 'entityId'>>
): FixedAsset | null {
  const data = readData();
  const idx = data.assets.findIndex((a) => a.id === id);
  if (idx === -1) return null;

  const existing = data.assets[idx];
  const updated: FixedAsset = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const newAssets = [...data.assets];
  newAssets[idx] = updated;
  writeData({ ...data, assets: newAssets });

  return updated;
}

/**
 * Generate depreciation journal entry for all active assets in a given period.
 * Returns JE-ready debit/credit lines.
 */
export function generateDepreciationJE(period: string): DepreciationJE {
  const data = readData();
  const activeAssets = data.assets.filter((a) => a.status === 'active' && a.category !== 'land');
  const lines: DepreciationJELine[] = [];

  for (const asset of activeAssets) {
    const depr = calculateMonthlyDepreciation(asset);
    if (depr.monthlyAmount <= 0) continue;

    // Debit depreciation expense
    lines.push({
      account: depr.debitAccount,
      accountName: depr.debitName,
      debit: depr.monthlyAmount,
      credit: 0,
      profitCenter: asset.profitCenter,
      description: `Depreciation - ${asset.code} ${asset.description}`,
      entityId: asset.entityId,
    });

    // Credit accumulated depreciation
    lines.push({
      account: depr.creditAccount,
      accountName: depr.creditName,
      debit: 0,
      credit: depr.monthlyAmount,
      profitCenter: asset.profitCenter,
      description: `Accum Depr - ${asset.code} ${asset.description}`,
      entityId: asset.entityId,
    });
  }

  const totalDebit = lines.reduce((sum, l) => sum + l.debit, 0);
  const totalCredit = lines.reduce((sum, l) => sum + l.credit, 0);

  const je: DepreciationJE = {
    id: `depr-${period}-${Date.now()}`,
    period,
    description: `Monthly Depreciation - ${period}`,
    lines,
    totalDebit: Math.round(totalDebit * 100) / 100,
    totalCredit: Math.round(totalCredit * 100) / 100,
    assetCount: activeAssets.filter((a) => {
      const d = calculateMonthlyDepreciation(a);
      return d.monthlyAmount > 0;
    }).length,
    createdAt: new Date().toISOString(),
  };

  // Persist the draft JE
  writeData({
    ...data,
    depreciationJEs: [...data.depreciationJEs, je],
  });

  return je;
}

/**
 * Get summary totals by category, total NBV, and monthly run rate.
 */
export function getAssetSummary(): AssetSummary {
  const data = readData();
  const assets = data.assets;
  const categories: AssetCategory[] = ['vehicles', 'equipment', 'buildings', 'land', 'cip', 'other'];

  const byCategory = categories.map((cat) => {
    const catAssets = assets.filter((a) => a.category === cat && a.status !== 'disposed');
    const cost = catAssets.reduce((s, a) => s + a.cost, 0);
    const nbv = catAssets.reduce((s, a) => s + a.netBookValue, 0);
    const monthlyDepr = catAssets.reduce((s, a) => {
      const d = calculateMonthlyDepreciation(a);
      return s + d.monthlyAmount;
    }, 0);

    return {
      category: cat,
      count: catAssets.length,
      cost: Math.round(cost * 100) / 100,
      nbv: Math.round(nbv * 100) / 100,
      monthlyDepr: Math.round(monthlyDepr * 100) / 100,
    };
  });

  const activeAssets = assets.filter((a) => a.status !== 'disposed');

  return {
    totalAssets: activeAssets.length,
    totalCost: Math.round(activeAssets.reduce((s, a) => s + a.cost, 0) * 100) / 100,
    totalNBV: Math.round(activeAssets.reduce((s, a) => s + a.netBookValue, 0) * 100) / 100,
    totalAccumDepr: Math.round(activeAssets.reduce((s, a) => s + a.accumulatedDepreciation, 0) * 100) / 100,
    monthlyDepreciationRunRate: Math.round(byCategory.reduce((s, c) => s + c.monthlyDepr, 0) * 100) / 100,
    cipBalance: Math.round(
      assets.filter((a) => a.status === 'cip').reduce((s, a) => s + a.cost, 0) * 100
    ) / 100,
    byCategory,
  };
}

/**
 * Pull existing equipment from the Ascend gateway to seed the register.
 */
export async function syncFromGateway(): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;

  // Try /ascend/assets/fixed first, fallback to /ascend/equipment
  const fixedResult = await gatewayFetch('/ascend/assets/fixed', 'admin', { timeout: 20000 });
  const equipResult = await gatewayFetch('/ascend/equipment', 'admin', { timeout: 20000 });

  const rows: Array<Record<string, unknown>> = [];
  if (fixedResult.success && Array.isArray(fixedResult.data)) {
    rows.push(...(fixedResult.data as Array<Record<string, unknown>>));
  }
  if (equipResult.success && Array.isArray(equipResult.data)) {
    rows.push(...(equipResult.data as Array<Record<string, unknown>>));
  }

  if (rows.length === 0) {
    // Fallback: query GL for asset accounts
    const glRows = await queryAscend(
      "SELECT Account, Account_Desc, SUM(Amount) as Balance FROM GLDetail WHERE Account LIKE '17%' GROUP BY Account, Account_Desc"
    );
    for (const row of glRows) {
      const account = String(row.Account ?? '');
      const desc = String(row.Account_Desc ?? '');
      const balance = Number(row.Balance ?? 0);
      if (balance <= 0) continue;

      let category: AssetCategory = 'other';
      if (account.startsWith('172')) category = 'vehicles';
      else if (account.startsWith('173')) category = 'equipment';
      else if (account.startsWith('174')) category = 'buildings';
      else if (account.startsWith('175')) category = 'land';
      else if (account.startsWith('178')) category = 'cip';

      try {
        createAsset({
          code: `GL-${account}`,
          description: desc || `Asset from GL ${account}`,
          category,
          acquisitionDate: '2024-01-01',
          cost: balance,
          salvageValue: category === 'land' ? 0 : Math.round(balance * 0.1),
          usefulLifeMonths: category === 'vehicles' ? 60 : category === 'buildings' ? 480 : 84,
          depreciationMethod: category === 'vehicles' ? 'macrs_5' : category === 'buildings' ? 'macrs_15' : 'macrs_7',
          glAccountAsset: account,
          glAccountDepreciation: `18${account.slice(2)}`,
          glAccountExpense: `65${account.slice(2)}`,
          profitCenter: '100',
          entityId: 'D360',
          status: category === 'cip' ? 'cip' : 'active',
        });
        imported++;
      } catch (e) {
        errors.push(`Failed to import GL ${account}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  return { imported, errors };
}
