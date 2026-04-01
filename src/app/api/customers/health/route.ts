import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { gatewayFetch } from '@/lib/gateway';
import { computeHealthScore, getMockHealthScores, type CustomerHealth } from '@/lib/customer-health';
import { getUserRole } from '@/lib/config/roles';

// ── Types for gateway responses ────────────────────────────────

interface ArAgingRow {
  CustomerName: string;
  CustomerId?: string;
  Current?: number;
  Over30?: number;
  Over60?: number;
  Over90?: number;
}

interface BillingRow {
  CustomerName: string;
  Invoices: number;
  TotalQty: number;
}

interface GpRow {
  CustomerName: string;
  Revenue: number;
  GP: number;
}

// ── SQL queries ────────────────────────────────────────────────

const BILLING_SQL = `SELECT CustomerName, COUNT(*) AS Invoices, SUM(i.Qty) AS TotalQty FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE b.Year >= 2025 GROUP BY b.CustomerName ORDER BY TotalQty DESC`;

const GP_SQL = `SELECT b.CustomerName, SUM(i.Qty * i.UnitPrice) AS Revenue, SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost,0))) AS GP FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE b.Year >= 2025 AND i.Total_UnitCost > 0 GROUP BY b.CustomerName`;

// ── Helpers ────────────────────────────────────────────────────

function normalizeCustomerName(name: string): string {
  return name.trim().toLowerCase();
}

function buildCustomerMap<T>(rows: T[], keyFn: (row: T) => string): ReadonlyMap<string, T> {
  const map = new Map<string, T>();
  for (const row of rows) {
    map.set(normalizeCustomerName(keyFn(row)), row);
  }
  return map;
}

// ── Route handler ──────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const customerFilter = request.nextUrl.searchParams.get('customer') ?? null;
  const userEmail = session?.user?.email ?? 'etheiss@delta360.energy';
  const role = getUserRole(userEmail);

  try {
    // Fetch all three data sources in parallel
    const [arResult, billingResult, gpResult] = await Promise.all([
      gatewayFetch('/ascend/ar/aging', role, { timeout: 15000 }),
      gatewayFetch('/ascend/query', role, { method: 'POST', body: { sql: BILLING_SQL }, timeout: 15000 }),
      gatewayFetch('/ascend/query', role, { method: 'POST', body: { sql: GP_SQL }, timeout: 15000 }),
    ]);

    // If all gateway calls failed, fall back to mock data
    if (!arResult.success && !billingResult.success && !gpResult.success) {
      const mockScores = getMockHealthScores();
      const filtered = customerFilter
        ? mockScores.filter((s) => normalizeCustomerName(s.customer) === normalizeCustomerName(customerFilter))
        : mockScores.slice(0, 20);

      return NextResponse.json({
        success: true,
        customers: formatOutput(filtered),
        count: filtered.length,
        source: 'mock',
        generatedAt: new Date().toISOString(),
      });
    }

    // Parse gateway responses (default to empty arrays on partial failure)
    const arRows: ArAgingRow[] = arResult.success ? (arResult.data as ArAgingRow[] ?? []) : [];
    const billingRows: BillingRow[] = billingResult.success ? (billingResult.data as BillingRow[] ?? []) : [];
    const gpRows: GpRow[] = gpResult.success ? (gpResult.data as GpRow[] ?? []) : [];

    // Index by normalized customer name
    const arMap = buildCustomerMap(arRows, (r) => r.CustomerName);
    const billingMap = buildCustomerMap(billingRows, (r) => r.CustomerName);
    const gpMap = buildCustomerMap(gpRows, (r) => r.CustomerName);

    // Collect unique customer names across all data sources
    const allNames = new Set<string>();
    for (const row of arRows) allNames.add(normalizeCustomerName(row.CustomerName));
    for (const row of billingRows) allNames.add(normalizeCustomerName(row.CustomerName));
    for (const row of gpRows) allNames.add(normalizeCustomerName(row.CustomerName));

    // Compute health scores
    const scores: CustomerHealth[] = [];

    for (const normName of Array.from(allNames)) {
      const ar = arMap.get(normName);
      const billing = billingMap.get(normName);
      const gp = gpMap.get(normName);

      // Use the first available original-cased name
      const displayName = ar?.CustomerName ?? billing?.CustomerName ?? gp?.CustomerName ?? normName;

      // Derive GP margin percentage
      const revenue = gp?.Revenue ?? 0;
      const grossProfit = gp?.GP ?? 0;
      const gpMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

      // Use billing TotalQty as a volume proxy (current period)
      // Prior period data is not available from a single query, so we use a heuristic:
      // if there is billing data, treat it as current; prior is unknown (0 triggers "new customer" path)
      const revenueThisPeriod = billing?.TotalQty ?? 0;

      const health = computeHealthScore({
        name: displayName,
        id: ar?.CustomerId ?? normName.replace(/\s+/g, '-').substring(0, 12),
        arCurrent: ar?.Current ?? 0,
        ar30: ar?.Over30 ?? 0,
        ar60: ar?.Over60 ?? 0,
        ar90Plus: ar?.Over90 ?? 0,
        revenueThisPeriod,
        revenuePriorPeriod: 0, // Not available from current queries; will score as "new customer"
        gpMarginPct,
      });

      scores.push(health);
    }

    // Sort by score descending
    scores.sort((a, b) => b.score - a.score);

    // Apply customer filter or top-20 limit
    const filtered = customerFilter
      ? scores.filter((s) => normalizeCustomerName(s.customer) === normalizeCustomerName(customerFilter))
      : scores.slice(0, 20);

    return NextResponse.json({
      success: true,
      customers: formatOutput(filtered),
      count: filtered.length,
      source: 'gateway',
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Health score calculation failed' },
      { status: 500 }
    );
  }
}

// ── Output formatting ──────────────────────────────────────────

interface CustomerOutput {
  name: string;
  score: number;
  grade: string;
  factors: {
    payment: { score: number; detail: string };
    volume: { score: number; detail: string };
    margin: { score: number; detail: string };
    recency: { score: number; detail: string };
  };
}

function formatOutput(scores: readonly CustomerHealth[]): readonly CustomerOutput[] {
  return scores.map((s) => ({
    name: s.customer,
    score: s.score,
    grade: s.grade,
    factors: {
      payment: { score: s.factors.payment.score, detail: s.factors.payment.detail },
      volume: { score: s.factors.volume.score, detail: s.factors.volume.detail },
      margin: { score: s.factors.margin.score, detail: s.factors.margin.detail },
      recency: { score: s.factors.recency.score, detail: s.factors.recency.detail },
    },
  }));
}
