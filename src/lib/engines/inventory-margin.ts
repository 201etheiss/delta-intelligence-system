/**
 * Inventory & Margin Analytics Engine
 *
 * Margin analysis by product, division, and customer.
 * Rack vs invoice spread tracking.
 * File persistence to data/margin-snapshots.json (cached results).
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export interface MarginAnalysis {
  readonly period: string;
  readonly product: string;
  readonly division: string;
  readonly revenue: number;
  readonly cogs: number;
  readonly grossProfit: number;
  readonly margin: number; // percentage 0-100
  readonly volume: number;
}

export interface InventoryPosition {
  readonly product: string;
  readonly location: string;
  readonly quantity: number;
  readonly unitCost: number;
  readonly totalValue: number;
  readonly lastCountDate: string;
}

export interface MarginTrendPoint {
  readonly period: string;
  readonly revenue: number;
  readonly cogs: number;
  readonly grossProfit: number;
  readonly margin: number;
  readonly volume: number;
}

export interface RackSpread {
  readonly product: string;
  readonly rackPrice: number;
  readonly avgInvoicePrice: number;
  readonly spread: number;
  readonly spreadPct: number;
  readonly asOf: string;
}

export interface MarginSummary {
  readonly avgMarginPct: number;
  readonly totalGP: number;
  readonly totalRevenue: number;
  readonly totalVolume: number;
  readonly avgRackSpread: number;
}

interface MarginSnapshotsFile {
  snapshots: Record<string, MarginAnalysis[]>; // keyed by "view:period"
  lastUpdated: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getDataPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/margin-snapshots.json';
  }
  return path.join(process.cwd(), 'data', 'margin-snapshots.json');
}

function readData(): MarginSnapshotsFile {
  const filePath = getDataPath();
  if (!existsSync(filePath)) {
    return { snapshots: {}, lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as MarginSnapshotsFile;
  } catch {
    return { snapshots: {}, lastUpdated: new Date().toISOString() };
  }
}

function writeData(data: MarginSnapshotsFile): void {
  const filePath = getDataPath();
  writeFileSync(
    filePath,
    JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2),
    'utf-8'
  );
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

// ── Helpers ──────────────────────────────────────────────────

function safeNumber(val: unknown): number {
  const n = Number(val);
  return Number.isNaN(n) ? 0 : n;
}

function calcMargin(revenue: number, cogs: number): number {
  if (revenue === 0) return 0;
  return Math.round(((revenue - cogs) / revenue) * 10000) / 100;
}

function cacheKey(view: string, period: string): string {
  return `${view}:${period}`;
}

// ── Core Functions ───────────────────────────────────────────

/**
 * Margin by product for a given period (YYYY-MM).
 * Queries Ascend billing data grouped by product.
 */
export async function getMarginByProduct(period: string): Promise<readonly MarginAnalysis[]> {
  validatePeriod(period);
  const data = readData();
  const key = cacheKey('product', period);

  // Check cache (1 hour TTL)
  const cached = data.snapshots[key];
  if (cached && data.lastUpdated) {
    const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();
    if (cacheAge < 3600000) return cached;
  }

  const rows = await queryAscend(
    `SELECT Product, SUM(Revenue) as Revenue, SUM(COGS) as COGS, SUM(Revenue - COGS) as GP, SUM(Quantity) as Volume FROM Billing WHERE Period = '${period}' GROUP BY Product ORDER BY GP DESC`
  );

  const results: MarginAnalysis[] = rows.map((row) => {
    const revenue = safeNumber(row.Revenue);
    const cogs = safeNumber(row.COGS);
    const gp = safeNumber(row.GP);
    const volume = safeNumber(row.Volume);
    return {
      period,
      product: String(row.Product ?? 'Unknown'),
      division: '',
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(gp * 100) / 100,
      margin: calcMargin(revenue, cogs),
      volume: Math.round(volume * 100) / 100,
    };
  });

  // Cache results
  writeData({
    ...data,
    snapshots: { ...data.snapshots, [key]: results },
  });

  return results;
}

/**
 * Margin by division (profit center) for a given period.
 */
export async function getMarginByDivision(period: string): Promise<readonly MarginAnalysis[]> {
  validatePeriod(period);
  const data = readData();
  const key = cacheKey('division', period);

  const cached = data.snapshots[key];
  if (cached && data.lastUpdated) {
    const cacheAge = Date.now() - new Date(data.lastUpdated).getTime();
    if (cacheAge < 3600000) return cached;
  }

  const rows = await queryAscend(
    `SELECT ProfitCenter, SUM(Revenue) as Revenue, SUM(COGS) as COGS, SUM(Revenue - COGS) as GP, SUM(Quantity) as Volume FROM Billing WHERE Period = '${period}' GROUP BY ProfitCenter ORDER BY GP DESC`
  );

  const results: MarginAnalysis[] = rows.map((row) => {
    const revenue = safeNumber(row.Revenue);
    const cogs = safeNumber(row.COGS);
    const gp = safeNumber(row.GP);
    const volume = safeNumber(row.Volume);
    return {
      period,
      product: '',
      division: String(row.ProfitCenter ?? 'Unknown'),
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(gp * 100) / 100,
      margin: calcMargin(revenue, cogs),
      volume: Math.round(volume * 100) / 100,
    };
  });

  writeData({
    ...data,
    snapshots: { ...data.snapshots, [key]: results },
  });

  return results;
}

/**
 * Top customers by gross profit for a given period.
 */
export async function getMarginByCustomer(
  period: string,
  top: number = 10
): Promise<readonly MarginAnalysis[]> {
  validatePeriod(period);
  const rows = await queryAscend(
    `SELECT TOP ${top} Customer, SUM(Revenue) as Revenue, SUM(COGS) as COGS, SUM(Revenue - COGS) as GP, SUM(Quantity) as Volume FROM Billing WHERE Period = '${period}' GROUP BY Customer ORDER BY GP DESC`
  );

  return rows.map((row) => {
    const revenue = safeNumber(row.Revenue);
    const cogs = safeNumber(row.COGS);
    const gp = safeNumber(row.GP);
    const volume = safeNumber(row.Volume);
    return {
      period,
      product: String(row.Customer ?? 'Unknown'),
      division: '',
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round(gp * 100) / 100,
      margin: calcMargin(revenue, cogs),
      volume: Math.round(volume * 100) / 100,
    };
  });
}

/**
 * Margin trend over N months.
 */
export async function getMarginTrend(months: number = 6): Promise<readonly MarginTrendPoint[]> {
  const now = new Date();
  const periods: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    periods.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
  }

  const periodsIn = periods.map((p) => `'${p}'`).join(',');
  const rows = await queryAscend(
    `SELECT Period, SUM(Revenue) as Revenue, SUM(COGS) as COGS, SUM(Revenue - COGS) as GP, SUM(Quantity) as Volume FROM Billing WHERE Period IN (${periodsIn}) GROUP BY Period ORDER BY Period`
  );

  // Build a map for fast lookup
  const rowMap: Record<string, Record<string, unknown>> = {};
  for (const row of rows) {
    rowMap[String(row.Period)] = row;
  }

  return periods.map((period) => {
    const row = rowMap[period];
    if (!row) {
      return { period, revenue: 0, cogs: 0, grossProfit: 0, margin: 0, volume: 0 };
    }
    const revenue = safeNumber(row.Revenue);
    const cogs = safeNumber(row.COGS);
    return {
      period,
      revenue: Math.round(revenue * 100) / 100,
      cogs: Math.round(cogs * 100) / 100,
      grossProfit: Math.round((revenue - cogs) * 100) / 100,
      margin: calcMargin(revenue, cogs),
      volume: Math.round(safeNumber(row.Volume) * 100) / 100,
    };
  });
}

/**
 * Current rack price vs average invoice price = margin capture.
 * Queries DTN rack prices and Ascend invoice averages.
 */
export async function getRackVsInvoiceSpread(): Promise<readonly RackSpread[]> {
  // Get average invoice prices by product from recent billing
  const invoiceRows = await queryAscend(
    "SELECT Product, AVG(UnitPrice) as AvgPrice, SUM(Quantity) as Volume FROM Billing WHERE Period = (SELECT MAX(Period) FROM Billing) GROUP BY Product"
  );

  // Get rack prices from DTN endpoint if available
  const rackResult = await gatewayFetch('/ascend/pricing/rack', 'admin', { timeout: 10000 });
  const rackData: Record<string, number> = {};

  if (rackResult.success && rackResult.data && typeof rackResult.data === 'object') {
    const rackRows = rackResult.data as Array<Record<string, unknown>>;
    if (Array.isArray(rackRows)) {
      for (const r of rackRows) {
        rackData[String(r.Product ?? '')] = safeNumber(r.RackPrice);
      }
    }
  }

  const now = new Date().toISOString();

  return invoiceRows.map((row) => {
    const product = String(row.Product ?? 'Unknown');
    const avgInvoicePrice = Math.round(safeNumber(row.AvgPrice) * 10000) / 10000;
    const rackPrice = rackData[product] ?? 0;
    const spread = Math.round((avgInvoicePrice - rackPrice) * 10000) / 10000;
    const spreadPct = rackPrice > 0 ? Math.round((spread / rackPrice) * 10000) / 100 : 0;

    return {
      product,
      rackPrice,
      avgInvoicePrice,
      spread,
      spreadPct,
      asOf: now,
    };
  });
}

/**
 * Compute summary KPIs from the latest period.
 */
export async function getMarginSummary(period: string): Promise<MarginSummary> {
  validatePeriod(period);
  const products = await getMarginByProduct(period);
  const spreads = await getRackVsInvoiceSpread();

  const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
  const totalCogs = products.reduce((s, p) => s + p.cogs, 0);
  const totalGP = products.reduce((s, p) => s + p.grossProfit, 0);
  const totalVolume = products.reduce((s, p) => s + p.volume, 0);
  const avgMarginPct = calcMargin(totalRevenue, totalCogs);
  const avgRackSpread = spreads.length > 0
    ? Math.round(spreads.reduce((s, r) => s + r.spread, 0) / spreads.length * 10000) / 10000
    : 0;

  return {
    avgMarginPct,
    totalGP: Math.round(totalGP * 100) / 100,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    totalVolume: Math.round(totalVolume * 100) / 100,
    avgRackSpread,
  };
}
