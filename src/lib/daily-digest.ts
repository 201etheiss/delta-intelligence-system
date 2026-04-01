/**
 * Daily Digest Generator
 *
 * Generates role-specific morning briefings by pulling LIVE metrics from
 * the Ascend/Salesforce/Samsara gateway. Falls back to placeholder text
 * if a data source is unreachable (never blocks the briefing).
 *
 * All financial queries use DF_PBI_IncomeStatementData (GL source of truth)
 * to stay aligned with dashboard widgets.
 */

import { type UserRole } from '@/lib/config/roles';
import { gatewayFetch } from '@/lib/gateway';
import { detectAnomalies, type Anomaly } from '@/lib/anomaly-detector';

// ── Types ─────────────────────────────────────────────────────

export interface DigestHighlight {
  title: string;
  detail: string;
  color: 'orange' | 'green' | 'red' | 'blue' | 'yellow';
}

export interface DigestSection {
  title: string;
  items: Array<{ label: string; value: string; trend?: 'up' | 'down' | 'flat' }>;
}

export interface DailyDigest {
  date: string;
  role: UserRole;
  greeting: string;
  highlights: DigestHighlight[];
  sections: DigestSection[];
  anomalies: Anomaly[];
  generatedAt: string;
}

// ── Formatting ────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function fmtNumber(n: number): string {
  return Math.round(n).toLocaleString();
}

function fmtPercent(n: number): string {
  return `${(typeof n === 'number' && !Number.isNaN(n) ? n : 0).toFixed(1)}%`;
}

function pctChange(current: number, prior: number): { text: string; trend: 'up' | 'down' | 'flat' } {
  if (prior === 0) return { text: '', trend: 'flat' };
  const pct = ((current - prior) / prior) * 100;
  if (Math.abs(pct) < 1) return { text: '', trend: 'flat' };
  const dir = pct > 0 ? 'up' : 'down';
  return { text: `${pct > 0 ? '+' : ''}${pct.toFixed(1)}%`, trend: dir };
}

// ── Safe helpers ──────────────────────────────────────────────

function safeArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[,$]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

// ── Data Fetchers ─────────────────────────────────────────────

const YEAR = new Date().getFullYear();
const MONTH = new Date().getMonth() + 1;

async function fetchSQL(sql: string): Promise<Record<string, unknown>[]> {
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: { sql },
    timeout: 15000,
  });
  return safeArray(res.data) as Record<string, unknown>[];
}

async function fetchSOQL(soql: string): Promise<{ records: Record<string, unknown>[]; totalSize: number }> {
  const res = await gatewayFetch('/salesforce/query', 'admin', {
    method: 'POST',
    body: { soql },
    timeout: 15000,
  });
  const records = (res as Record<string, unknown>).records as Record<string, unknown>[] | undefined;
  const totalSize = safeNumber((res as Record<string, unknown>).totalSize);
  return { records: records ?? [], totalSize };
}

interface LiveMetrics {
  // Financial (GL source of truth)
  revenueYTD: number;
  revenuePriorYTD: number;
  grossMarginYTD: number;
  grossMarginPriorYTD: number;
  gpMarginPct: number;
  revenueCurrentMonth: number;
  revenuePriorMonth: number;

  // AR
  arTotal: number;
  ar90Plus: number;
  arBuckets: { current: number; past30: number; past60: number; past90: number; past90Plus: number };

  // Fleet / Ops
  vehicleCount: number;
  activeDrivers: number;
  totalDrivers: number;
  invoicesThisMonth: number;
  rackPrice: number;
  rackProduct: string;

  // Sales / Pipeline
  pipelineTotal: number;
  openOpportunities: number;
  closedWonYTD: number;
  closedWonCount: number;
  avgDealSize: number;

  // Activity
  invoicesYesterday: number;
  customersWithActivity: number;

  // Top lists (for enriched digest)
  topArOffenders: Array<{ name: string; amount: number }>;
  topCustomersByGP: Array<{ name: string; gp: number }>;
  closingSoonDeals: Array<{ name: string; amount: number; stage: string }>;
  recentInvoices: Array<{ customer: string; amount: number }>;

  // AP
  apTotal: number;
  apDueThisWeek: number;

  // Customer count
  customerCount: number;
}

async function fetchAllMetrics(): Promise<LiveMetrics> {
  const defaults: LiveMetrics = {
    revenueYTD: 0, revenuePriorYTD: 0, grossMarginYTD: 0, grossMarginPriorYTD: 0,
    gpMarginPct: 0, revenueCurrentMonth: 0, revenuePriorMonth: 0,
    arTotal: 0, ar90Plus: 0,
    arBuckets: { current: 0, past30: 0, past60: 0, past90: 0, past90Plus: 0 },
    vehicleCount: 0, activeDrivers: 0, totalDrivers: 0,
    invoicesThisMonth: 0, rackPrice: 0, rackProduct: 'Diesel Dyed',
    pipelineTotal: 0, openOpportunities: 0, closedWonYTD: 0, closedWonCount: 0,
    avgDealSize: 0, invoicesYesterday: 0, customersWithActivity: 0,
    topArOffenders: [], topCustomersByGP: [], closingSoonDeals: [], recentInvoices: [],
    apTotal: 0, apDueThisWeek: 0, customerCount: 0,
  };

  // Fire all queries in parallel, catch individually so one failure doesn't block everything
  const [
    revenueRows,
    priorRevenueRows,
    monthlyRevRows,
    arRows,
    ar90Rows,
    arBucketRows,
    vehicles,
    drivers,
    invoiceCountRows,
    invoiceYestRows,
    rackRows,
    pipelineRes,
    openOppsRes,
    closedWonRes,
    closedWonCountRes,
    avgDealRes,
    custActivityRows,
    arOffenderRows,
    topGPRows,
    closingSoonRes,
    recentInvRows,
    apTotalRows,
    customerRows,
  ] = await Promise.all([
    // Revenue + GP YTD (GL)
    fetchSQL(`SELECT AccountGroup, SUM(ABS(Period_Balance)) AS Amount FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY AccountGroup`).catch(() => []),
    // Prior year revenue + GP
    fetchSQL(`SELECT AccountGroup, SUM(ABS(Period_Balance)) AS Amount FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR - 1} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY AccountGroup`).catch(() => []),
    // Revenue by period (current + prior month)
    fetchSQL(`SELECT Period, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND AccountGroup = 'Revenue' AND Period IN (${MONTH}, ${Math.max(1, MONTH - 1)}) GROUP BY Period ORDER BY Period`).catch(() => []),
    // AR total
    fetchSQL("SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0").catch(() => []),
    // AR 90+
    fetchSQL("SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90").catch(() => []),
    // AR buckets
    fetchSQL(`SELECT
      SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) <= 30 THEN ADOTotalStillDue ELSE 0 END) AS [Current],
      SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 31 AND 60 THEN ADOTotalStillDue ELSE 0 END) AS [Past30],
      SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 61 AND 90 THEN ADOTotalStillDue ELSE 0 END) AS [Past60],
      SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) > 90 THEN ADOTotalStillDue ELSE 0 END) AS [Past90Plus]
    FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0`).catch(() => []),
    // Vehicles
    gatewayFetch('/samsara/vehicles', 'admin', { timeout: 15000 }).then(r => safeArray(r.data)).catch(() => []),
    // Drivers
    gatewayFetch('/samsara/drivers', 'admin', { timeout: 15000 }).then(r => safeArray(r.data)).catch(() => []),
    // Invoice count this month
    fetchSQL(`SELECT COUNT(*) AS Count FROM ARInvoice WHERE MONTH(InvoiceDt) = MONTH(GETDATE()) AND YEAR(InvoiceDt) = ${YEAR}`).catch(() => []),
    // Invoices yesterday
    fetchSQL("SELECT COUNT(*) AS Count FROM ARInvoice WHERE InvoiceDt = CAST(DATEADD(day, -1, GETDATE()) AS DATE)").catch(() => []),
    // Rack price
    fetchSQL("SELECT TOP 1 ProductDescr, RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC").catch(() => []),
    // Pipeline total
    fetchSOQL('SELECT SUM(Amount) total FROM Opportunity WHERE IsClosed = false').catch(() => ({ records: [], totalSize: 0 })),
    // Open opportunities count
    fetchSOQL('SELECT COUNT(Id) cnt FROM Opportunity WHERE IsClosed = false').catch(() => ({ records: [], totalSize: 0 })),
    // Closed won YTD
    fetchSOQL(`SELECT SUM(Amount) total FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}`).catch(() => ({ records: [], totalSize: 0 })),
    // Closed won count
    fetchSOQL(`SELECT COUNT(Id) cnt FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}`).catch(() => ({ records: [], totalSize: 0 })),
    // Avg deal size
    fetchSOQL('SELECT AVG(Amount) avg FROM Opportunity WHERE IsClosed = false AND Amount > 0').catch(() => ({ records: [], totalSize: 0 })),
    // Customers with recent invoices
    fetchSQL(`SELECT COUNT(DISTINCT CustomerName) AS Count FROM ARInvoice WHERE InvoiceDt >= DATEADD(day, -7, GETDATE())`).catch(() => []),
    // Top AR offenders (90+ days)
    fetchSQL("SELECT TOP 5 CustomerName, SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90 GROUP BY CustomerName ORDER BY Total DESC").catch(() => []),
    // Top customers by GP
    fetchSQL(`SELECT TOP 5 b.CustomerName, SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost, 0))) AS GP FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE b.Year = ${YEAR} AND i.Total_UnitCost > 0 GROUP BY b.CustomerName ORDER BY GP DESC`).catch(() => []),
    // Closing this month (Salesforce)
    fetchSOQL(`SELECT Name, Amount, StageName FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_MONTH ORDER BY Amount DESC LIMIT 5`).catch(() => ({ records: [], totalSize: 0 })),
    // Recent invoices
    fetchSQL(`SELECT TOP 5 b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Amount FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE b.Year = ${YEAR} GROUP BY b.CustomerName, b.InvoiceDt, b.SysTrxNo ORDER BY b.InvoiceDt DESC`).catch(() => []),
    // AP total (vendor payments YTD)
    fetchSQL(`SELECT SUM(debit) AS Total FROM vPurchaseJournal WHERE Year_For_Period = ${YEAR}`).catch(() => []),
    // Customer count
    gatewayFetch('/ascend/customers', 'admin', { timeout: 15000 }).then(r => safeArray(r.data)).catch(() => []),
  ]);

  // Parse revenue/GP — "Gross margin" AccountGroup = COGS in Ascend, not GP
  let currentCOGS = 0;
  let priorCOGS = 0;
  for (const row of revenueRows) {
    const group = String(row.AccountGroup ?? '');
    const amt = safeNumber(row.Amount);
    if (group === 'Revenue') defaults.revenueYTD = amt;
    else if (group === 'Gross margin') currentCOGS = amt;
  }
  for (const row of priorRevenueRows) {
    const group = String(row.AccountGroup ?? '');
    const amt = safeNumber(row.Amount);
    if (group === 'Revenue') defaults.revenuePriorYTD = amt;
    else if (group === 'Gross margin') priorCOGS = amt;
  }
  // Actual Gross Profit = Revenue - COGS
  defaults.grossMarginYTD = defaults.revenueYTD - currentCOGS;
  defaults.grossMarginPriorYTD = defaults.revenuePriorYTD - priorCOGS;
  if (defaults.revenueYTD > 0) {
    defaults.gpMarginPct = (defaults.grossMarginYTD / defaults.revenueYTD) * 100;
  }

  // Monthly revenue
  for (const row of monthlyRevRows) {
    const period = safeNumber(row.Period);
    const rev = safeNumber(row.Revenue);
    if (period === MONTH) defaults.revenueCurrentMonth = rev;
    else if (period === MONTH - 1) defaults.revenuePriorMonth = rev;
  }

  // AR
  defaults.arTotal = arRows[0] ? safeNumber(arRows[0].Total) : 0;
  defaults.ar90Plus = ar90Rows[0] ? safeNumber(ar90Rows[0].Total) : 0;
  if (arBucketRows[0]) {
    defaults.arBuckets = {
      current: safeNumber(arBucketRows[0].Current),
      past30: safeNumber(arBucketRows[0].Past30),
      past60: safeNumber(arBucketRows[0].Past60),
      past90: 0,
      past90Plus: safeNumber(arBucketRows[0].Past90Plus),
    };
  }

  // Fleet
  defaults.vehicleCount = (vehicles as unknown[]).length;
  defaults.totalDrivers = (drivers as unknown[]).length;
  defaults.activeDrivers = (drivers as Record<string, unknown>[]).filter(
    (d) => d.driverActivationStatus === 'active'
  ).length;

  // Invoices
  defaults.invoicesThisMonth = invoiceCountRows[0] ? safeNumber(invoiceCountRows[0].Count) : 0;
  defaults.invoicesYesterday = invoiceYestRows[0] ? safeNumber(invoiceYestRows[0].Count) : 0;

  // Rack
  if (rackRows[0]) {
    defaults.rackPrice = safeNumber(rackRows[0].RackPrice);
    defaults.rackProduct = String(rackRows[0].ProductDescr ?? 'Diesel Dyed');
  }

  // Pipeline
  defaults.pipelineTotal = pipelineRes.records[0] ? safeNumber(pipelineRes.records[0].total) : 0;
  defaults.openOpportunities = openOppsRes.records[0] ? safeNumber(openOppsRes.records[0].cnt) : safeNumber(openOppsRes.totalSize);
  defaults.closedWonYTD = closedWonRes.records[0] ? safeNumber(closedWonRes.records[0].total) : 0;
  defaults.closedWonCount = closedWonCountRes.records[0] ? safeNumber(closedWonCountRes.records[0].cnt) : 0;
  defaults.avgDealSize = avgDealRes.records[0] ? safeNumber(avgDealRes.records[0].avg) : 0;

  // Activity
  defaults.customersWithActivity = custActivityRows[0] ? safeNumber(custActivityRows[0].Count) : 0;

  // Top AR offenders
  defaults.topArOffenders = (arOffenderRows as Record<string, unknown>[]).map(r => ({
    name: String(r.CustomerName ?? 'Unknown'),
    amount: safeNumber(r.Total),
  }));

  // Top customers by GP
  defaults.topCustomersByGP = (topGPRows as Record<string, unknown>[]).map(r => ({
    name: String(r.CustomerName ?? 'Unknown'),
    gp: safeNumber(r.GP),
  }));

  // Closing soon deals
  defaults.closingSoonDeals = (closingSoonRes.records ?? []).map((r: Record<string, unknown>) => ({
    name: String(r.Name ?? 'Unnamed'),
    amount: safeNumber(r.Amount),
    stage: String(r.StageName ?? '-'),
  }));

  // Recent invoices
  defaults.recentInvoices = (recentInvRows as Record<string, unknown>[]).map(r => ({
    customer: String(r.CustomerName ?? 'Unknown'),
    amount: safeNumber(r.Amount),
  }));

  // AP
  defaults.apTotal = apTotalRows[0] ? safeNumber((apTotalRows[0] as Record<string, unknown>).Total) : 0;

  // Customer count
  defaults.customerCount = (customerRows as unknown[]).length;

  return defaults;
}

// ── Highlight Builders ────────────────────────────────────────

function revenueHighlight(m: LiveMetrics): DigestHighlight {
  const { text, trend } = pctChange(m.revenueCurrentMonth, m.revenuePriorMonth);
  const color = trend === 'down' ? 'red' : trend === 'up' ? 'green' : 'blue';
  const vsText = text ? ` — ${text} vs prior month` : '';
  return { title: 'Revenue this month', detail: `${fmtCurrency(m.revenueCurrentMonth)}${vsText}`, color };
}

function arHighlight(m: LiveMetrics): DigestHighlight {
  const pct90 = m.arTotal > 0 ? (m.ar90Plus / m.arTotal) * 100 : 0;
  const color = pct90 > 30 ? 'red' : pct90 > 15 ? 'orange' : 'green';
  return {
    title: 'AR collections',
    detail: `${fmtCurrency(m.arTotal)} outstanding, ${fmtCurrency(m.ar90Plus)} past 90 days (${fmtPercent(pct90)})`,
    color,
  };
}

function pipelineHighlight(m: LiveMetrics): DigestHighlight {
  const color = m.pipelineTotal > 0 ? 'green' : 'orange';
  return {
    title: 'Sales pipeline',
    detail: `${fmtCurrency(m.pipelineTotal)} across ${fmtNumber(m.openOpportunities)} open opportunities`,
    color,
  };
}

function fleetHighlight(m: LiveMetrics): DigestHighlight {
  return {
    title: 'Fleet status',
    detail: `${fmtNumber(m.vehicleCount)} vehicles, ${fmtNumber(m.activeDrivers)} active drivers`,
    color: 'blue',
  };
}

function rackHighlight(m: LiveMetrics): DigestHighlight {
  return {
    title: "Today's rack price",
    detail: m.rackPrice > 0 ? `$${m.rackPrice.toFixed(4)} — ${m.rackProduct}` : 'Unavailable',
    color: 'blue',
  };
}

// ── Digest Builders ───────────────────────────────────────────

function buildAdminDigest(m: LiveMetrics, anomalies: Anomaly[]): DailyDigest {
  const revChange = pctChange(m.revenueYTD, m.revenuePriorYTD);
  const gpChange = pctChange(m.grossMarginYTD, m.grossMarginPriorYTD);

  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    role: 'admin',
    greeting: 'Good morning. Here is your executive briefing.',
    highlights: [revenueHighlight(m), arHighlight(m), pipelineHighlight(m)],
    sections: [
      {
        title: 'Financial Snapshot',
        items: [
          { label: 'Revenue YTD', value: fmtCurrency(m.revenueYTD), trend: revChange.trend },
          { label: 'Revenue This Month', value: fmtCurrency(m.revenueCurrentMonth), trend: pctChange(m.revenueCurrentMonth, m.revenuePriorMonth).trend },
          { label: 'Gross Profit YTD', value: fmtCurrency(m.grossMarginYTD), trend: gpChange.trend },
          { label: 'GP Margin %', value: fmtPercent(m.gpMarginPct), trend: 'flat' },
          { label: 'Total AR', value: fmtCurrency(m.arTotal), trend: 'flat' },
          { label: 'AR 90+ Days', value: fmtCurrency(m.ar90Plus), trend: m.ar90Plus > 0 ? 'up' : 'flat' },
          { label: 'Rack Price', value: m.rackPrice > 0 ? `$${m.rackPrice.toFixed(4)}` : '--', trend: 'flat' },
        ],
      },
      {
        title: 'Fleet & Operations',
        items: [
          { label: 'Active Vehicles', value: fmtNumber(m.vehicleCount), trend: 'flat' },
          { label: 'Active Drivers', value: fmtNumber(m.activeDrivers), trend: 'flat' },
          { label: 'Invoices This Month', value: fmtNumber(m.invoicesThisMonth), trend: 'flat' },
          { label: 'Invoices Yesterday', value: fmtNumber(m.invoicesYesterday), trend: 'flat' },
        ],
      },
      {
        title: 'Sales Pipeline',
        items: [
          { label: 'Open Pipeline', value: fmtCurrency(m.pipelineTotal), trend: 'flat' },
          { label: 'Open Opportunities', value: fmtNumber(m.openOpportunities), trend: 'flat' },
          { label: 'Closed Won YTD', value: fmtCurrency(m.closedWonYTD), trend: 'flat' },
          { label: 'Deals Won YTD', value: fmtNumber(m.closedWonCount), trend: 'flat' },
          { label: 'Avg Deal Size', value: fmtCurrency(m.avgDealSize), trend: 'flat' },
        ],
      },
      {
        title: 'Accounts Payable',
        items: [
          { label: 'AP Spend YTD', value: fmtCurrency(m.apTotal), trend: 'flat' },
          { label: 'Customer Count', value: fmtNumber(m.customerCount), trend: 'flat' },
          { label: 'Customers w/ Invoices (7d)', value: fmtNumber(m.customersWithActivity), trend: 'flat' },
        ],
      },
      ...(m.topArOffenders.length > 0 ? [{
        title: 'Top AR Offenders (90+ Days)',
        items: m.topArOffenders.map(c => ({
          label: c.name,
          value: fmtCurrency(c.amount),
          trend: 'up' as const,
        })),
      }] : []),
      ...(m.topCustomersByGP.length > 0 ? [{
        title: `Top Customers by Gross Profit (${YEAR})`,
        items: m.topCustomersByGP.map(c => ({
          label: c.name,
          value: fmtCurrency(c.gp),
          trend: 'flat' as const,
        })),
      }] : []),
      ...(m.closingSoonDeals.length > 0 ? [{
        title: 'Deals Closing This Month',
        items: m.closingSoonDeals.map(d => ({
          label: `${d.name} (${d.stage})`,
          value: fmtCurrency(d.amount),
          trend: 'flat' as const,
        })),
      }] : []),
    ],
    anomalies,
    generatedAt: new Date().toISOString(),
  };
}

function buildAccountingDigest(m: LiveMetrics, anomalies: Anomaly[]): DailyDigest {
  const arAnomalies = anomalies.filter(a => ['ar', 'ap', 'revenue', 'cost'].includes(a.category));

  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    role: 'accounting',
    greeting: 'Good morning. Here is your accounting briefing.',
    highlights: [arHighlight(m), revenueHighlight(m), rackHighlight(m)],
    sections: [
      {
        title: 'Accounts Receivable',
        items: [
          { label: 'Total AR', value: fmtCurrency(m.arTotal), trend: 'flat' },
          { label: '0-30 Days', value: fmtCurrency(m.arBuckets.current), trend: 'flat' },
          { label: '31-60 Days', value: fmtCurrency(m.arBuckets.past30), trend: 'flat' },
          { label: '61-90 Days', value: fmtCurrency(m.arBuckets.past60), trend: 'flat' },
          { label: '90+ Days', value: fmtCurrency(m.arBuckets.past90Plus), trend: m.arBuckets.past90Plus > 0 ? 'up' : 'flat' },
        ],
      },
      {
        title: 'Revenue & Margins',
        items: [
          { label: 'Revenue YTD', value: fmtCurrency(m.revenueYTD), trend: pctChange(m.revenueYTD, m.revenuePriorYTD).trend },
          { label: 'Revenue This Month', value: fmtCurrency(m.revenueCurrentMonth), trend: pctChange(m.revenueCurrentMonth, m.revenuePriorMonth).trend },
          { label: 'Gross Profit YTD', value: fmtCurrency(m.grossMarginYTD), trend: 'flat' },
          { label: 'GP Margin %', value: fmtPercent(m.gpMarginPct), trend: 'flat' },
        ],
      },
      {
        title: 'Invoicing & AP',
        items: [
          { label: 'Invoices This Month', value: fmtNumber(m.invoicesThisMonth), trend: 'flat' },
          { label: 'Invoices Yesterday', value: fmtNumber(m.invoicesYesterday), trend: 'flat' },
          { label: 'AP Spend YTD', value: fmtCurrency(m.apTotal), trend: 'flat' },
          { label: 'Rack Price', value: m.rackPrice > 0 ? `$${m.rackPrice.toFixed(4)}` : '--', trend: 'flat' },
        ],
      },
      ...(m.topArOffenders.length > 0 ? [{
        title: 'Top AR Offenders (90+ Days)',
        items: m.topArOffenders.map(c => ({
          label: c.name,
          value: fmtCurrency(c.amount),
          trend: 'up' as const,
        })),
      }] : []),
      ...(m.recentInvoices.length > 0 ? [{
        title: 'Recent Invoices',
        items: m.recentInvoices.map(inv => ({
          label: inv.customer,
          value: fmtCurrency(inv.amount),
          trend: 'flat' as const,
        })),
      }] : []),
    ],
    anomalies: arAnomalies,
    generatedAt: new Date().toISOString(),
  };
}

function buildSalesDigest(m: LiveMetrics, anomalies: Anomaly[]): DailyDigest {
  const salesAnomalies = anomalies.filter(a => ['pipeline', 'revenue'].includes(a.category));

  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    role: 'sales',
    greeting: 'Good morning. Here is your sales briefing.',
    highlights: [
      pipelineHighlight(m),
      {
        title: 'Closed won YTD',
        detail: `${fmtCurrency(m.closedWonYTD)} across ${fmtNumber(m.closedWonCount)} deals`,
        color: m.closedWonYTD > 0 ? 'green' : 'orange',
      },
      {
        title: 'Avg deal size',
        detail: fmtCurrency(m.avgDealSize),
        color: 'blue',
      },
    ],
    sections: [
      {
        title: 'Pipeline Summary',
        items: [
          { label: 'Open Pipeline', value: fmtCurrency(m.pipelineTotal), trend: 'flat' },
          { label: 'Open Opportunities', value: fmtNumber(m.openOpportunities), trend: 'flat' },
          { label: 'Avg Deal Size', value: fmtCurrency(m.avgDealSize), trend: 'flat' },
        ],
      },
      {
        title: 'Wins & Activity',
        items: [
          { label: 'Closed Won YTD', value: fmtCurrency(m.closedWonYTD), trend: 'flat' },
          { label: 'Deals Won YTD', value: fmtNumber(m.closedWonCount), trend: 'flat' },
          { label: 'Customers w/ Invoices (7d)', value: fmtNumber(m.customersWithActivity), trend: 'flat' },
        ],
      },
      {
        title: 'Company Context',
        items: [
          { label: 'Revenue YTD', value: fmtCurrency(m.revenueYTD), trend: pctChange(m.revenueYTD, m.revenuePriorYTD).trend },
          { label: 'Revenue This Month', value: fmtCurrency(m.revenueCurrentMonth), trend: pctChange(m.revenueCurrentMonth, m.revenuePriorMonth).trend },
          { label: 'Customer Count', value: fmtNumber(m.customerCount), trend: 'flat' },
        ],
      },
      ...(m.closingSoonDeals.length > 0 ? [{
        title: 'Deals Closing This Month',
        items: m.closingSoonDeals.map(d => ({
          label: `${d.name} (${d.stage})`,
          value: fmtCurrency(d.amount),
          trend: 'flat' as const,
        })),
      }] : []),
      ...(m.topCustomersByGP.length > 0 ? [{
        title: 'Top Customers by GP',
        items: m.topCustomersByGP.map(c => ({
          label: c.name,
          value: fmtCurrency(c.gp),
          trend: 'flat' as const,
        })),
      }] : []),
    ],
    anomalies: salesAnomalies,
    generatedAt: new Date().toISOString(),
  };
}

function buildOperationsDigest(m: LiveMetrics, anomalies: Anomaly[]): DailyDigest {
  const opsAnomalies = anomalies.filter(a => ['fleet', 'cost'].includes(a.category));

  return {
    date: new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }),
    role: 'operations',
    greeting: 'Good morning. Here is your operations briefing.',
    highlights: [fleetHighlight(m), rackHighlight(m), revenueHighlight(m)],
    sections: [
      {
        title: 'Fleet Overview',
        items: [
          { label: 'Active Vehicles', value: fmtNumber(m.vehicleCount), trend: 'flat' },
          { label: 'Active Drivers', value: fmtNumber(m.activeDrivers), trend: 'flat' },
          { label: 'Total Drivers', value: fmtNumber(m.totalDrivers), trend: 'flat' },
        ],
      },
      {
        title: 'Deliveries & Invoicing',
        items: [
          { label: 'Invoices This Month', value: fmtNumber(m.invoicesThisMonth), trend: 'flat' },
          { label: 'Invoices Yesterday', value: fmtNumber(m.invoicesYesterday), trend: 'flat' },
          { label: 'Customers w/ Invoices (7d)', value: fmtNumber(m.customersWithActivity), trend: 'flat' },
        ],
      },
      {
        title: 'Pricing & Revenue',
        items: [
          { label: 'Rack Price', value: m.rackPrice > 0 ? `$${m.rackPrice.toFixed(4)}` : '--', trend: 'flat' },
          { label: 'Revenue This Month', value: fmtCurrency(m.revenueCurrentMonth), trend: pctChange(m.revenueCurrentMonth, m.revenuePriorMonth).trend },
          { label: 'Revenue YTD', value: fmtCurrency(m.revenueYTD), trend: pctChange(m.revenueYTD, m.revenuePriorYTD).trend },
        ],
      },
    ],
    anomalies: opsAnomalies,
    generatedAt: new Date().toISOString(),
  };
}

// ── Public API ────────────────────────────────────────────────

type DigestBuilder = (m: LiveMetrics, anomalies: Anomaly[]) => DailyDigest;

const DIGEST_BUILDERS: Record<string, DigestBuilder> = {
  admin: buildAdminDigest,
  accounting: buildAccountingDigest,
  sales: buildSalesDigest,
  operations: buildOperationsDigest,
  readonly: buildAdminDigest,
};

export async function generateDigest(role: UserRole): Promise<DailyDigest> {
  const metrics = await fetchAllMetrics();

  // Run anomaly detection with live data
  const anomalies = detectAnomalies({
    revenue: metrics.revenueCurrentMonth,
    previousRevenue: metrics.revenuePriorMonth,
    arTotal: metrics.arTotal,
    previousArTotal: undefined, // no prior-period AR cached yet
    pipelineTotal: metrics.pipelineTotal,
    previousPipelineTotal: undefined,
  });

  const builder = DIGEST_BUILDERS[role] ?? buildAdminDigest;
  return builder(metrics, anomalies);
}
