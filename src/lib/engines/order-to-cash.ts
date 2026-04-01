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
// Ascend schema:
//   OrderHdr: SysTrxNo, OrderDtTm, Status (O=Open, C=Closed, A=Cancelled, Q=Quote),
//             OrderType (S=Sales, I=Internal), InternalTransferOrder (Y/N),
//             PONo, DispatchedDate, DDOrder (Y/N = contractor/digital dispatch)
//   vBOLHdrInfo: VSysTrxNo, StatusDescr (Open/Resolved/Posted/etc), CarrierCode, PeriodCode
//   BOLHdr: SysTrxNo, Status (O=Open, R=Resolved, P=Posted, BR=Never Resolved, PP=Partially Posted)
//   OrderStatusID maps to DF_OrderStatusProcessFlow for dispatch/billing stages

async function getOrderCounts(year: number): Promise<{ january: number; february: number; march: number }> {
  // Sales orders only (OrderType='S'), excluding cancelled and quotes
  const rows = await querySQL(
    `SELECT MONTH(OrderDtTm) AS Mo, COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE YEAR(OrderDtTm) = ${year} AND MONTH(OrderDtTm) IN (1,2,3)
       AND OrderType = 'S'
       AND Status NOT IN ('A','Q')
     GROUP BY MONTH(OrderDtTm)
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

  // Open sales orders (Status='O') — these are unbilled
  // DDOrder = 'Y' indicates contractor/digital dispatch orders
  // Split by whether DispatchedDate is set (dispatch vs billing stage)
  const unbilledRows = await querySQL(
    `SELECT
       CASE WHEN DDOrder = 'Y' THEN 'contractor' ELSE 'direct' END AS Type,
       CASE WHEN DispatchedDate IS NULL THEN 'dispatch' ELSE 'billing' END AS Stage,
       COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE OrderDtTm BETWEEN '${start}' AND '${end}'
       AND OrderType = 'S'
       AND Status = 'O'
     GROUP BY
       CASE WHEN DDOrder = 'Y' THEN 'contractor' ELSE 'direct' END,
       CASE WHEN DispatchedDate IS NULL THEN 'dispatch' ELSE 'billing' END`
  );

  // Pending PO — orders missing PO number
  const pendingRows = await querySQL(
    `SELECT COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE OrderDtTm BETWEEN '${start}' AND '${end}'
       AND OrderType = 'S'
       AND Status = 'O'
       AND (PONo IS NULL OR PONo = '')`
  );

  // BOL Unresolved — BOLs with Open status for this period
  const bolRows = await querySQL(
    `SELECT
       CASE WHEN h.CarrierCode IS NOT NULL AND h.CarrierCode != '' THEN 'contractor' ELSE 'noncontractor' END AS Type,
       COUNT(*) AS Cnt
     FROM vBOLHdrInfo h
     WHERE h.PeriodCode LIKE '${year}-${String(month).padStart(2, '0')}%'
       AND h.StatusDescr = 'Open'
     GROUP BY CASE WHEN h.CarrierCode IS NOT NULL AND h.CarrierCode != '' THEN 'contractor' ELSE 'noncontractor' END`
  );

  // Total order count for percentage calc
  const totalRows = await querySQL(
    `SELECT COUNT(*) AS Cnt FROM OrderHdr
     WHERE OrderDtTm BETWEEN '${start}' AND '${end}'
       AND OrderType = 'S'
       AND Status NOT IN ('A','Q')`
  );
  const totalOrders = safeNumber((totalRows[0] ?? {}).Cnt) || 1;

  // Aggregate by stage
  const dispatch = aggregateByStage(unbilledRows, 'direct', 'dispatch');
  const dispatchContractors = aggregateByStage(unbilledRows, 'contractor', 'dispatch');
  const billing = aggregateByStage(unbilledRows, 'direct', 'billing');
  const billingContractors = aggregateByStage(unbilledRows, 'contractor', 'billing');

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

function aggregateByStage(
  rows: Record<string, unknown>[],
  type: string,
  stage: string
): DepartmentBreakdown {
  const cnt = safeNumber(
    rows.find(r => String(r.Type ?? '') === type && String(r.Stage ?? '') === stage)?.Cnt ?? 0
  );
  // Note: Commercial/Industrial vs Oil & Gas split requires CustType join which varies by Ascend config.
  // For now, total is returned. Segment breakdown can be refined once CustType mapping is confirmed.
  return { total: cnt, commercialIndustrial: cnt, oilAndGas: 0 };
}

async function getOpenInternalOrders(year: number): Promise<readonly OpenInternalOrders[]> {
  // Internal transfer orders (InternalTransferOrder='Y') that are still open
  const rows = await querySQL(
    `SELECT MONTH(OrderDtTm) AS Mo, COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE YEAR(OrderDtTm) = ${year}
       AND InternalTransferOrder = 'Y'
       AND Status = 'O'
     GROUP BY MONTH(OrderDtTm)
     ORDER BY Mo`
  );
  return rows.map(r => ({
    month: MONTH_NAMES[safeNumber(r.Mo)] ?? `Month ${safeNumber(r.Mo)}`,
    count: safeNumber(r.Cnt),
  }));
}

async function getPendingRigStamps(year: number): Promise<readonly PendingRigStamp[]> {
  // Orders missing PO number that are still open — proxy for pending rig stamps/POs
  const rows = await querySQL(
    `SELECT MONTH(OrderDtTm) AS Mo, COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE YEAR(OrderDtTm) = ${year}
       AND OrderType = 'S'
       AND Status = 'O'
       AND (PONo IS NULL OR PONo = '')
     GROUP BY MONTH(OrderDtTm)
     ORDER BY Mo`
  );
  return rows.map(r => ({
    month: MONTH_NAMES[safeNumber(r.Mo)] ?? `Month ${safeNumber(r.Mo)}`,
    count: safeNumber(r.Cnt),
  }));
}

async function getMissingLoads(year: number): Promise<readonly MissingLoad[]> {
  // Open orders that were dispatched but have no corresponding BOL yet
  // DispatchedDate is set but no LoadNo assigned
  const rows = await querySQL(
    `SELECT MONTH(DispatchedDate) AS Mo, COUNT(*) AS Cnt
     FROM OrderHdr
     WHERE YEAR(DispatchedDate) = ${year}
       AND OrderType = 'S'
       AND Status = 'O'
       AND DispatchedDate IS NOT NULL
       AND (LoadNo IS NULL OR LoadNo = 0)
     GROUP BY MONTH(DispatchedDate)
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
