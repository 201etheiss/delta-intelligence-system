/**
 * Order-to-Cash Progress Engine
 *
 * Pulls LIVE data from Ascend via the gateway to generate the weekly
 * Order-to-Cash Flash Report — tracking unbilled orders, pending invoices,
 * BOLs, missing loads, rig stamps, and open internal orders.
 *
 * Data sources:
 *   - SalesOrder / OrderHeader for order counts
 *   - vBOLHdrInfo for BOL resolution status
 *   - InvoiceHeader / InternalOrder for billing pipeline
 *
 * File persistence of snapshots to data/otc-snapshots.json
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export interface DepartmentBreakdown {
  readonly total: number;
  readonly commercialIndustrial: number;
  readonly oilAndGas: number;
}

export interface MonthUnbilled {
  readonly month: string; // 'January', 'February', 'March'
  readonly dispatch: DepartmentBreakdown;
  readonly dispatchContractors: DepartmentBreakdown;
  readonly billing: DepartmentBreakdown;
  readonly billingContractors: DepartmentBreakdown;
  readonly ordersPendingInvoice: number;
  readonly ordersPendingInvoicePct: number;
  readonly pendingPOStampPricing: number;
  readonly pendingPOStampPricingPct: number;
  readonly bolUnresolved: {
    readonly contractors: number;
    readonly nonContractors: number;
    readonly total: number;
  };
}

export interface OpenInternalOrders {
  readonly month: string;
  readonly count: number;
}

export interface PendingRigStamp {
  readonly month: string;
  readonly count: number;
}

export interface MissingLoad {
  readonly month: string;
  readonly count: number;
}

export interface OTCSnapshot {
  readonly id: string;
  readonly weekendEnding: string; // ISO date
  readonly generatedAt: string;
  readonly generatedBy: string;
  readonly orderCounts: {
    readonly january: number;
    readonly february: number;
    readonly march: number;
  };
  readonly unbilledByMonth: readonly MonthUnbilled[];
  readonly openInternalOrders: readonly OpenInternalOrders[];
  readonly openInternalOrdersTotal: number;
  readonly pendingRigStamps: readonly PendingRigStamp[];
  readonly pendingRigStampsTotal: number;
  readonly missingLoads: readonly MissingLoad[];
  readonly missingLoadsTotal: number;
}

export interface OTCStats {
  readonly totalOrdersPendingInvoice: number;
  readonly totalUnbilledOrders: number;
  readonly totalBOLUnresolved: number;
  readonly totalMissingLoads: number;
  readonly totalPendingRigStamps: number;
  readonly totalOpenInternalOrders: number;
  readonly weekOverWeekChange: {
    readonly pendingInvoice: number;
    readonly bolUnresolved: number;
    readonly missingLoads: number;
  } | null;
}

export interface OTCTrend {
  readonly weekendEnding: string;
  readonly pendingInvoice: number;
  readonly bolUnresolved: number;
  readonly missingLoads: number;
  readonly pendingRigStamps: number;
}

// ── File I/O ────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const SNAPSHOTS_FILE = join(DATA_DIR, 'otc-snapshots.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
}

function readSnapshots(): readonly OTCSnapshot[] {
  ensureDataDir();
  if (!existsSync(SNAPSHOTS_FILE)) return [];
  try {
    const raw = readFileSync(SNAPSHOTS_FILE, 'utf-8');
    return JSON.parse(raw) as OTCSnapshot[];
  } catch {
    return [];
  }
}

function writeSnapshots(data: readonly OTCSnapshot[]): void {
  ensureDataDir();
  writeFileSync(SNAPSHOTS_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

function generateId(): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `otc-${ts}-${rand}`;
}

// ── Ascend Query Helper ─────────────────────────────────────

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

function safeArray(d: unknown): unknown[] {
  return Array.isArray(d) ? d : [];
}

async function querySQL(sql: string): Promise<Record<string, unknown>[]> {
  try {
    const res = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: { sql },
      timeout: 30000,
    });
    return safeArray(res.data) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

// ── Month Helpers ───────────────────────────────────────────

function getMonthRange(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;
  return { start, end };
}

const MONTH_NAMES = [
  '', 'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

// ── Core Data Pull Functions ────────────────────────────────

async function getOrderCounts(year: number): Promise<{ january: number; february: number; march: number }> {
  // Pull order counts from SalesOrder by month
  const rows = await querySQL(
    `SELECT MONTH(OrderDate) AS Mo, COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE YEAR(OrderDate) = ${year} AND MONTH(OrderDate) IN (1,2,3)
       AND OrderStatus NOT IN ('Cancelled','Quote')
     GROUP BY MONTH(OrderDate)
     ORDER BY Mo`
  );

  const counts = { january: 0, february: 0, march: 0 };
  for (const r of rows) {
    const mo = safeNumber(r.Mo);
    const cnt = safeNumber(r.Cnt);
    if (mo === 1) counts.january = cnt;
    else if (mo === 2) counts.february = cnt;
    else if (mo === 3) counts.march = cnt;
  }
  return counts;
}

async function getUnbilledOrders(year: number, month: number): Promise<MonthUnbilled> {
  const { start, end } = getMonthRange(year, month);
  const monthName = MONTH_NAMES[month] ?? `Month ${month}`;

  // Orders in dispatch (not yet at billing stage)
  const dispatchRows = await querySQL(
    `SELECT
       CASE WHEN IsContractor = 1 THEN 'contractor' ELSE 'direct' END AS Type,
       CASE WHEN CustomerType LIKE '%Oil%Gas%' THEN 'oilgas' ELSE 'comind' END AS Segment,
       COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE OrderDate BETWEEN '${start}' AND '${end}'
       AND OrderStatus = 'Dispatch'
       AND InvoiceNo IS NULL
     GROUP BY
       CASE WHEN IsContractor = 1 THEN 'contractor' ELSE 'direct' END,
       CASE WHEN CustomerType LIKE '%Oil%Gas%' THEN 'oilgas' ELSE 'comind' END`
  );

  // Orders in billing (dispatched but not invoiced)
  const billingRows = await querySQL(
    `SELECT
       CASE WHEN IsContractor = 1 THEN 'contractor' ELSE 'direct' END AS Type,
       CASE WHEN CustomerType LIKE '%Oil%Gas%' THEN 'oilgas' ELSE 'comind' END AS Segment,
       COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE OrderDate BETWEEN '${start}' AND '${end}'
       AND OrderStatus = 'Billing'
       AND InvoiceNo IS NULL
     GROUP BY
       CASE WHEN IsContractor = 1 THEN 'contractor' ELSE 'direct' END,
       CASE WHEN CustomerType LIKE '%Oil%Gas%' THEN 'oilgas' ELSE 'comind' END`
  );

  // Pending PO/Stamp/Pricing
  const pendingRows = await querySQL(
    `SELECT COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE OrderDate BETWEEN '${start}' AND '${end}'
       AND (PONumber IS NULL OR StampApproved = 0 OR UnitPrice = 0)
       AND OrderStatus NOT IN ('Cancelled','Invoiced','Delivered')`
  );

  // BOL Unresolved
  const bolRows = await querySQL(
    `SELECT
       CASE WHEN b.IsContractor = 1 THEN 'contractor' ELSE 'noncontractor' END AS Type,
       COUNT(*) AS Cnt
     FROM vBOLHdrInfo b
     WHERE b.BOLDate BETWEEN '${start}' AND '${end}'
       AND b.BOLStatus = 'Unresolved'
     GROUP BY CASE WHEN b.IsContractor = 1 THEN 'contractor' ELSE 'noncontractor' END`
  );

  // Total order count for percentage calc
  const totalRows = await querySQL(
    `SELECT COUNT(*) AS Cnt FROM SalesOrder
     WHERE OrderDate BETWEEN '${start}' AND '${end}'
       AND OrderStatus NOT IN ('Cancelled','Quote')`
  );
  const totalOrders = safeNumber((totalRows[0] ?? {}).Cnt) || 1;

  // Aggregate dispatch
  const dispatch = aggregateBreakdown(dispatchRows, 'direct');
  const dispatchContractors = aggregateBreakdown(dispatchRows, 'contractor');
  const billing = aggregateBreakdown(billingRows, 'direct');
  const billingContractors = aggregateBreakdown(billingRows, 'contractor');

  const pendingInvoice = dispatch.total + dispatchContractors.total + billing.total + billingContractors.total;
  const pendingPO = safeNumber((pendingRows[0] ?? {}).Cnt);

  const bolContractors = safeNumber(bolRows.find(r => r.Type === 'contractor')?.Cnt ?? 0);
  const bolNon = safeNumber(bolRows.find(r => r.Type === 'noncontractor')?.Cnt ?? 0);

  return {
    month: monthName,
    dispatch,
    dispatchContractors,
    billing,
    billingContractors,
    ordersPendingInvoice: pendingInvoice,
    ordersPendingInvoicePct: Math.round((pendingInvoice / totalOrders) * 100),
    pendingPOStampPricing: pendingPO,
    pendingPOStampPricingPct: Math.round((pendingPO / totalOrders) * 100),
    bolUnresolved: {
      contractors: bolContractors,
      nonContractors: bolNon,
      total: bolContractors + bolNon,
    },
  };
}

function aggregateBreakdown(
  rows: Record<string, unknown>[],
  type: string
): DepartmentBreakdown {
  const filtered = rows.filter(r => String(r.Type ?? '') === type);
  const comind = safeNumber(filtered.find(r => String(r.Segment ?? '') === 'comind')?.Cnt ?? 0);
  const oilgas = safeNumber(filtered.find(r => String(r.Segment ?? '') === 'oilgas')?.Cnt ?? 0);
  return { total: comind + oilgas, commercialIndustrial: comind, oilAndGas: oilgas };
}

async function getOpenInternalOrders(year: number): Promise<readonly OpenInternalOrders[]> {
  const rows = await querySQL(
    `SELECT MONTH(OrderDate) AS Mo, COUNT(*) AS Cnt
     FROM InternalOrder
     WHERE YEAR(OrderDate) = ${year}
       AND OrderStatus NOT IN ('Delivered','Cancelled','Quote')
     GROUP BY MONTH(OrderDate)
     ORDER BY Mo`
  );
  return rows.map(r => ({
    month: MONTH_NAMES[safeNumber(r.Mo)] ?? `Month ${safeNumber(r.Mo)}`,
    count: safeNumber(r.Cnt),
  }));
}

async function getPendingRigStamps(year: number): Promise<readonly PendingRigStamp[]> {
  const rows = await querySQL(
    `SELECT MONTH(OrderDate) AS Mo, COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE YEAR(OrderDate) = ${year}
       AND StampApproved = 0
       AND OrderStatus NOT IN ('Cancelled','Invoiced','Delivered')
     GROUP BY MONTH(OrderDate)
     ORDER BY Mo`
  );
  return rows.map(r => ({
    month: MONTH_NAMES[safeNumber(r.Mo)] ?? `Month ${safeNumber(r.Mo)}`,
    count: safeNumber(r.Cnt),
  }));
}

async function getMissingLoads(year: number): Promise<readonly MissingLoad[]> {
  const rows = await querySQL(
    `SELECT MONTH(DispatchDate) AS Mo, COUNT(*) AS Cnt
     FROM SalesOrder
     WHERE YEAR(DispatchDate) = ${year}
       AND OrderStatus = 'Dispatch'
       AND LoadConfirmed = 0
     GROUP BY MONTH(DispatchDate)
     ORDER BY Mo`
  );
  return rows.map(r => ({
    month: MONTH_NAMES[safeNumber(r.Mo)] ?? `Month ${safeNumber(r.Mo)}`,
    count: safeNumber(r.Cnt),
  }));
}

// ── Public API ──────────────────────────────────────────────

export async function generateOTCSnapshot(
  weekendEnding: string,
  generatedBy: string
): Promise<OTCSnapshot> {
  const date = new Date(weekendEnding);
  const year = date.getFullYear();

  // Pull all data in parallel
  const [
    orderCounts,
    janUnbilled,
    febUnbilled,
    marUnbilled,
    openInternal,
    rigStamps,
    missingLoads,
  ] = await Promise.all([
    getOrderCounts(year),
    getUnbilledOrders(year, 1),
    getUnbilledOrders(year, 2),
    getUnbilledOrders(year, 3),
    getOpenInternalOrders(year),
    getPendingRigStamps(year),
    getMissingLoads(year),
  ]);

  const snapshot: OTCSnapshot = {
    id: generateId(),
    weekendEnding,
    generatedAt: new Date().toISOString(),
    generatedBy,
    orderCounts,
    unbilledByMonth: [janUnbilled, febUnbilled, marUnbilled],
    openInternalOrders: openInternal,
    openInternalOrdersTotal: openInternal.reduce((s, o) => s + o.count, 0),
    pendingRigStamps: rigStamps,
    pendingRigStampsTotal: rigStamps.reduce((s, r) => s + r.count, 0),
    missingLoads,
    missingLoadsTotal: missingLoads.reduce((s, m) => s + m.count, 0),
  };

  // Persist
  const existing = [...readSnapshots()];
  existing.push(snapshot);
  // Keep last 52 weeks (1 year of snapshots)
  const trimmed = existing.slice(-52);
  writeSnapshots(trimmed);

  return snapshot;
}

export function getLatestSnapshot(): OTCSnapshot | null {
  const all = readSnapshots();
  return all.length > 0 ? all[all.length - 1] ?? null : null;
}

export function getAllSnapshots(): readonly OTCSnapshot[] {
  return readSnapshots();
}

export function getSnapshotByDate(weekendEnding: string): OTCSnapshot | undefined {
  return readSnapshots().find(s => s.weekendEnding === weekendEnding);
}

export function getOTCStats(snapshot: OTCSnapshot): OTCStats {
  const allSnapshots = readSnapshots();
  const idx = allSnapshots.findIndex(s => s.id === snapshot.id);
  const prev = idx > 0 ? allSnapshots[idx - 1] : null;

  const totalPending = snapshot.unbilledByMonth.reduce((s, m) => s + m.ordersPendingInvoice, 0);
  const totalBOL = snapshot.unbilledByMonth.reduce((s, m) => s + m.bolUnresolved.total, 0);
  const totalUnbilled = snapshot.unbilledByMonth.reduce(
    (s, m) => s + m.dispatch.total + m.dispatchContractors.total + m.billing.total + m.billingContractors.total, 0
  );

  let weekOverWeekChange: OTCStats['weekOverWeekChange'] = null;
  if (prev) {
    const prevPending = prev.unbilledByMonth.reduce((s, m) => s + m.ordersPendingInvoice, 0);
    const prevBOL = prev.unbilledByMonth.reduce((s, m) => s + m.bolUnresolved.total, 0);
    weekOverWeekChange = {
      pendingInvoice: totalPending - prevPending,
      bolUnresolved: totalBOL - (prevBOL),
      missingLoads: snapshot.missingLoadsTotal - prev.missingLoadsTotal,
    };
  }

  return {
    totalOrdersPendingInvoice: totalPending,
    totalUnbilledOrders: totalUnbilled,
    totalBOLUnresolved: totalBOL,
    totalMissingLoads: snapshot.missingLoadsTotal,
    totalPendingRigStamps: snapshot.pendingRigStampsTotal,
    totalOpenInternalOrders: snapshot.openInternalOrdersTotal,
    weekOverWeekChange,
  };
}

export function getOTCTrends(): readonly OTCTrend[] {
  return readSnapshots().map(s => ({
    weekendEnding: s.weekendEnding,
    pendingInvoice: s.unbilledByMonth.reduce((sum, m) => sum + m.ordersPendingInvoice, 0),
    bolUnresolved: s.unbilledByMonth.reduce((sum, m) => sum + m.bolUnresolved.total, 0),
    missingLoads: s.missingLoadsTotal,
    pendingRigStamps: s.pendingRigStampsTotal,
  }));
}

// ── Report Formatting ───────────────────────────────────────

export function formatOTCMarkdownReport(snapshot: OTCSnapshot): string {
  const stats = getOTCStats(snapshot);
  const wow = stats.weekOverWeekChange;
  const fmtChange = (n: number) => n > 0 ? `+${n}` : `${n}`;

  let md = `# Order To Cash Progress Report\n\n`;
  md += `**Weekend Ending:** ${snapshot.weekendEnding}\n`;
  md += `**Generated:** ${new Date(snapshot.generatedAt).toLocaleDateString()}\n\n`;

  // Summary KPIs
  md += `## Summary\n\n`;
  md += `| Metric | Current |${wow ? ' WoW Change |' : ''}\n`;
  md += `|--------|---------|${wow ? '------------|' : ''}\n`;
  md += `| Orders Pending Invoice | ${stats.totalOrdersPendingInvoice.toLocaleString()} |${wow ? ` ${fmtChange(wow.pendingInvoice)} |` : ''}\n`;
  md += `| BOL Unresolved | ${stats.totalBOLUnresolved.toLocaleString()} |${wow ? ` ${fmtChange(wow.bolUnresolved)} |` : ''}\n`;
  md += `| Missing Loads | ${stats.totalMissingLoads.toLocaleString()} |${wow ? ` ${fmtChange(wow.missingLoads)} |` : ''}\n`;
  md += `| Pending Rig Stamps | ${stats.totalPendingRigStamps.toLocaleString()} |\n`;
  md += `| Open Internal Orders | ${stats.totalOpenInternalOrders.toLocaleString()} |\n\n`;

  // Order Counts
  md += `## Order Counts\n\n`;
  md += `| Month | Orders |\n`;
  md += `|-------|--------|\n`;
  md += `| January | ${snapshot.orderCounts.january.toLocaleString()} |\n`;
  md += `| February | ${snapshot.orderCounts.february.toLocaleString()} |\n`;
  md += `| March | ${snapshot.orderCounts.march.toLocaleString()} |\n\n`;

  // Unbilled by month
  for (const m of snapshot.unbilledByMonth) {
    md += `## ${m.month} — Unbilled Orders\n\n`;
    md += `| Category | Total | Commercial/Industrial | Oil & Gas |\n`;
    md += `|----------|-------|-----------------------|-----------|\n`;
    md += `| Dispatch | ${m.dispatch.total} | ${m.dispatch.commercialIndustrial} | ${m.dispatch.oilAndGas} |\n`;
    md += `| Dispatch - Contractors | ${m.dispatchContractors.total} | ${m.dispatchContractors.commercialIndustrial} | ${m.dispatchContractors.oilAndGas} |\n`;
    md += `| Billing | ${m.billing.total} | ${m.billing.commercialIndustrial} | ${m.billing.oilAndGas} |\n`;
    md += `| Billing - Contractors | ${m.billingContractors.total} | ${m.billingContractors.commercialIndustrial} | ${m.billingContractors.oilAndGas} |\n`;
    md += `| **Orders Pending Invoice** | **${m.ordersPendingInvoice}** | | ${m.ordersPendingInvoicePct}% |\n`;
    md += `| Pending PO/Stamp/Pricing | ${m.pendingPOStampPricing} | | ${m.pendingPOStampPricingPct}% |\n\n`;

    if (m.bolUnresolved.total > 0) {
      md += `### BOL Unresolved — ${m.month}\n\n`;
      md += `| Type | Count |\n`;
      md += `|------|-------|\n`;
      md += `| Contractors | ${m.bolUnresolved.contractors} |\n`;
      md += `| Non-Contractors | ${m.bolUnresolved.nonContractors} |\n`;
      md += `| **Total** | **${m.bolUnresolved.total}** |\n\n`;
    }
  }

  // Open Internal Orders
  md += `## Open Internal Orders\n\n`;
  md += `| Month | Count |\n`;
  md += `|-------|-------|\n`;
  for (const o of snapshot.openInternalOrders) {
    md += `| ${o.month} | ${o.count} |\n`;
  }
  md += `| **Total** | **${snapshot.openInternalOrdersTotal}** |\n\n`;

  // Pending Rig Stamps
  md += `## Pending Rig Stamps/POs\n\n`;
  md += `| Month | Count |\n`;
  md += `|-------|-------|\n`;
  for (const r of snapshot.pendingRigStamps) {
    md += `| ${r.month} | ${r.count} |\n`;
  }
  md += `| **Total** | **${snapshot.pendingRigStampsTotal}** |\n\n`;

  // Missing Loads
  md += `## Missing Loads — Open\n\n`;
  md += `| Month | Count |\n`;
  md += `|-------|-------|\n`;
  for (const m of snapshot.missingLoads) {
    md += `| ${m.month} | ${m.count} |\n`;
  }
  md += `| **Total** | **${snapshot.missingLoadsTotal}** |\n\n`;

  md += `---\n*Generated by Delta Intelligence — Order-to-Cash Automation Engine*\n`;

  return md;
}

/**
 * Generates the current week's snapshot from hardcoded flash report data.
 * Used as the initial seed from the 3/31/2026 PDF before live Ascend queries are available.
 */
export function seedFromFlashReport(): OTCSnapshot {
  const snapshot: OTCSnapshot = {
    id: generateId(),
    weekendEnding: '2026-03-31',
    generatedAt: new Date().toISOString(),
    generatedBy: 'system-seed',
    orderCounts: {
      january: 4202,
      february: 3935,
      march: 3914,
    },
    unbilledByMonth: [
      {
        month: 'January',
        dispatch: { total: 3, commercialIndustrial: 0, oilAndGas: 0 },
        dispatchContractors: { total: 4, commercialIndustrial: 0, oilAndGas: 0 },
        billing: { total: 15, commercialIndustrial: 0, oilAndGas: 0 },
        billingContractors: { total: 12, commercialIndustrial: 0, oilAndGas: 0 },
        ordersPendingInvoice: 34,
        ordersPendingInvoicePct: 1,
        pendingPOStampPricing: 50,
        pendingPOStampPricingPct: 1,
        bolUnresolved: { contractors: 0, nonContractors: 0, total: 0 },
      },
      {
        month: 'February',
        dispatch: { total: 6, commercialIndustrial: 6, oilAndGas: 0 },
        dispatchContractors: { total: 3, commercialIndustrial: 3, oilAndGas: 0 },
        billing: { total: 10, commercialIndustrial: 3, oilAndGas: 6 },
        billingContractors: { total: 3, commercialIndustrial: 0, oilAndGas: 0 },
        ordersPendingInvoice: 22,
        ordersPendingInvoicePct: 1,
        pendingPOStampPricing: 34,
        pendingPOStampPricingPct: 1,
        bolUnresolved: { contractors: 1, nonContractors: 8, total: 9 },
      },
      {
        month: 'March',
        dispatch: { total: 306, commercialIndustrial: 149, oilAndGas: 152 },
        dispatchContractors: { total: 276, commercialIndustrial: 248, oilAndGas: 24 },
        billing: { total: 957, commercialIndustrial: 225, oilAndGas: 697 },
        billingContractors: { total: 272, commercialIndustrial: 262, oilAndGas: 3 },
        ordersPendingInvoice: 1811,
        ordersPendingInvoicePct: 46,
        pendingPOStampPricing: 55,
        pendingPOStampPricingPct: 1,
        bolUnresolved: { contractors: 320, nonContractors: 103, total: 423 },
      },
    ],
    openInternalOrders: [
      { month: 'February', count: 2 },
      { month: 'March', count: 205 },
    ],
    openInternalOrdersTotal: 207,
    pendingRigStamps: [
      { month: 'December', count: 0 },
      { month: 'January', count: 1 },
      { month: 'February', count: 5 },
      { month: 'March', count: 9 },
    ],
    pendingRigStampsTotal: 15,
    missingLoads: [
      { month: 'February', count: 26 },
      { month: 'March', count: 274 },
    ],
    missingLoadsTotal: 300,
  };

  // Persist
  const existing = [...readSnapshots()];
  // Don't duplicate if same weekend already exists
  const dup = existing.findIndex(s => s.weekendEnding === snapshot.weekendEnding);
  if (dup >= 0) {
    existing[dup] = snapshot;
  } else {
    existing.push(snapshot);
  }
  writeSnapshots(existing);

  return snapshot;
}
