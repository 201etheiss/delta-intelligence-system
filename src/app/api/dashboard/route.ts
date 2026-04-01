import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { gatewayFetch } from '@/lib/gateway';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';

// ── In-memory cache (5-minute TTL) ────────────────────────────
interface CacheEntry {
  data: DashboardData;
  expiresAt: number;
}

let cache: CacheEntry | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000;

// ── Response types ────────────────────────────────────────────
interface DashboardKpis {
  customerCount: number;
  pipelineTotal: number;
  vehicleCount: number;
  arTotal: number;
  revenueYTD: number;
  grossProfitYTD: number;
  openOpportunities: number;
  activeDrivers: number;
}

interface RecentInvoice {
  id: string;
  date: string;
  amount: number;
  customer: string;
}

interface RackPriceData {
  product: string;
  price: number;
  date: string;
}

interface DashboardData {
  kpis: DashboardKpis;
  recentInvoices: RecentInvoice[];
  rackPrice: RackPriceData | null;
  fetchedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────
function safeArray(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return [];
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[,$]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

// ── Fetchers ──────────────────────────────────────────────────
async function fetchCustomerCount(): Promise<number> {
  const res = await gatewayFetch('/ascend/customers', 'admin', { timeout: 15000 });
  if (!res.success) return 0;
  const rows = safeArray(res.data);
  return rows.length;
}

async function fetchPipelineTotal(): Promise<number> {
  // Use SOQL aggregate for accurate pipeline total (GET endpoint may return empty)
  const res = await gatewayFetch('/salesforce/query', 'admin', {
    method: 'POST',
    body: { soql: 'SELECT SUM(Amount) total FROM Opportunity WHERE IsClosed = false' },
    timeout: 15000,
  });
  if (!res.success) return 0;
  const records = (res as Record<string, unknown>).records as Array<Record<string, unknown>> | undefined;
  if (records && records.length > 0) {
    return safeNumber(records[0].total ?? 0);
  }
  return 0;
}

async function fetchVehicleCount(): Promise<number> {
  const res = await gatewayFetch('/samsara/vehicles', 'admin', { timeout: 15000 });
  if (!res.success) return 0;
  const rows = safeArray(res.data);
  return rows.length;
}

async function fetchArTotal(): Promise<number> {
  // Use SQL to get actual outstanding AR (still-due amounts on open/active invoices)
  // This is the real AR number — not the cumulative TotalAR from the summary endpoint
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: { sql: "SELECT SUM(ADOTotalStillDue) AS TotalAR FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0" },
    timeout: 15000,
  });
  if (!res.success) return 0;
  const rows = safeArray(res.data);
  if (rows.length > 0) {
    return safeNumber((rows[0] as Record<string, unknown>).TotalAR ?? 0);
  }
  return 0;
}

async function fetchRevenueAndGP(): Promise<{ revenue: number; gp: number }> {
  const year = new Date().getFullYear();
  // Use DF_PBI_IncomeStatementData — the GL source of truth for revenue and COGS
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: { sql: `SELECT AccountGroup, SUM(ABS(Period_Balance)) AS Amount FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${year} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY AccountGroup` },
    timeout: 15000,
  });
  if (!res.success) return { revenue: 0, gp: 0 };
  const rows = safeArray(res.data);

  let revenue = 0;
  let cogs = 0;
  for (const row of rows) {
    const rec = row as Record<string, unknown>;
    const group = String(rec.AccountGroup ?? '');
    const amt = safeNumber(rec.Amount ?? 0);
    if (group === 'Revenue') revenue = amt;
    else if (group === 'Gross margin') cogs = amt; // "Gross margin" AccountGroup = COGS in Ascend
  }

  // Actual Gross Profit = Revenue - COGS
  return { revenue, gp: revenue - cogs };
}

async function fetchOpenOpportunities(): Promise<number> {
  const res = await gatewayFetch('/salesforce/query', 'admin', {
    method: 'POST',
    body: { soql: 'SELECT COUNT() FROM Opportunity WHERE IsClosed = false' },
    timeout: 15000,
  });
  if (!res.success) return 0;
  return safeNumber((res as Record<string, unknown>).totalSize ?? 0);
}

async function fetchActiveDrivers(): Promise<number> {
  const res = await gatewayFetch('/samsara/drivers', 'admin', { timeout: 15000 });
  if (!res.success) return 0;
  const rows = safeArray(res.data);
  return rows.filter((r) => {
    const driver = r as Record<string, unknown>;
    return driver.driverActivationStatus === 'active';
  }).length;
}

async function fetchRackPrice(): Promise<RackPriceData | null> {
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: {
      sql: "SELECT TOP 1 ProductDescr, RackPrice, EffDtTm FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC",
    },
    timeout: 15000,
  });
  if (!res.success) return null;
  const rows = safeArray(res.data);
  if (rows.length === 0) return null;
  const row = rows[0] as Record<string, unknown>;
  return {
    product: String(row.ProductDescr ?? 'Diesel Dyed'),
    price: safeNumber(row.RackPrice ?? 0),
    date: String(row.EffDtTm ?? ''),
  };
}

async function fetchRecentInvoices(): Promise<RecentInvoice[]> {
  // Use SQL to get recent invoices WITH amounts (the /ascend/invoices endpoint doesn't include dollar amounts)
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: {
      sql: `SELECT TOP 5 b.CustomerName, b.InvoiceDt, b.SysTrxNo, SUM(i.Qty * i.UnitPrice) AS Amount
            FROM DF_PBI_BillingChartQuery b
            JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
            WHERE b.Year = ${new Date().getFullYear()}
            GROUP BY b.CustomerName, b.InvoiceDt, b.SysTrxNo
            ORDER BY b.InvoiceDt DESC`,
    },
    timeout: 15000,
  });
  if (!res.success) return [];
  const rows = safeArray(res.data);
  return rows.slice(0, 5).map((row) => {
    const rec = row as Record<string, unknown>;
    return {
      id: String(rec.SysTrxNo ?? ''),
      date: String(rec.InvoiceDt ?? ''),
      amount: safeNumber(rec.Amount ?? 0),
      customer: String(rec.CustomerName ?? 'Unknown'),
    };
  });
}

// ── Route handler ─────────────────────────────────────────────
export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Return cached data if still valid AND has real data (not stale zeros)
  if (cache && Date.now() < cache.expiresAt && cache.data.kpis.revenueYTD > 0) {
    return NextResponse.json({ success: true, ...cache.data, cached: true });
  }

  try {
    // Batch 1: non-Ascend queries (fast, no SQL contention)
    const [pipelineTotal, vehicleCount, openOpportunities, activeDrivers] = await Promise.all([
      fetchPipelineTotal(),
      fetchVehicleCount(),
      fetchOpenOpportunities(),
      fetchActiveDrivers(),
    ]);

    // Batch 2: Ascend queries — run in parallel with allSettled so partial failures don't block
    const [revenueGPResult, customerCountResult, arTotalResult, rackPriceResult, recentInvoicesResult] = await Promise.allSettled([
      fetchRevenueAndGP(),
      fetchCustomerCount(),
      fetchArTotal(),
      fetchRackPrice(),
      fetchRecentInvoices(),
    ]);
    const revenueGP = revenueGPResult.status === 'fulfilled' ? revenueGPResult.value : { revenue: 0, gp: 0 };
    const customerCount = customerCountResult.status === 'fulfilled' ? customerCountResult.value : 0;
    const arTotal = arTotalResult.status === 'fulfilled' ? arTotalResult.value : 0;
    const rackPrice = rackPriceResult.status === 'fulfilled' ? rackPriceResult.value : null;
    const recentInvoices = recentInvoicesResult.status === 'fulfilled' ? recentInvoicesResult.value : [];

    const data: DashboardData = {
      kpis: {
        customerCount,
        pipelineTotal,
        vehicleCount,
        arTotal,
        revenueYTD: revenueGP.revenue,
        grossProfitYTD: revenueGP.gp,
        openOpportunities,
        activeDrivers,
      },
      recentInvoices,
      rackPrice,
      fetchedAt: new Date().toISOString(),
    };

    cache = { data, expiresAt: Date.now() + CACHE_TTL_MS };

    return NextResponse.json({ success: true, ...data, cached: false });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard data';
    return NextResponse.json({ success: false, error: message }, { status: 502 });
  }
}
