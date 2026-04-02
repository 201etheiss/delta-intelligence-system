'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Package,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  TrendingUp,
  DollarSign,
  Layers,
  BarChart3,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Constants ───────────────────────────────────────────────

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY || '';

// ── Types ───────────────────────────────────────────────────

interface ProductRow {
  MasterProdID: string;
  MasterProdDescr: string;
  ProductType: string;
  line_count: number;
}

interface RackPriceRow {
  Vendor_Name: string;
  SupplyPoint: string;
  ProductDescr: string;
  RackPrice: number;
  PriceDate: string;
}

interface SalesVolumeRow {
  MasterProdDescr: string;
  total_qty: number;
  total_revenue: number;
}

// ── Helpers ─────────────────────────────────────────────────

const currencyFmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const currencyFmtDec = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
});

const numFmt = new Intl.NumberFormat('en-US', {
  maximumFractionDigits: 0,
});

function shortCurrency(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return currencyFmt.format(n);
}

async function queryGateway(sql: string): Promise<unknown[]> {
  const res = await fetch(`${GATEWAY_BASE_URL}/ascend/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(GATEWAY_API_KEY ? { 'x-api-key': GATEWAY_API_KEY } : {}),
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}: ${res.statusText}`);
  const json = await res.json();
  return (json.data ?? json.rows ?? json) as unknown[];
}

// ── Price color helper ──────────────────────────────────────

function priceColor(price: number, min: number, max: number): string {
  if (max === min) return 'text-zinc-300';
  const ratio = (price - min) / (max - min);
  if (ratio > 0.66) return 'text-orange-400';
  if (ratio > 0.33) return 'text-amber-300';
  return 'text-emerald-400';
}

function priceBg(price: number, min: number, max: number): string {
  if (max === min) return '';
  const ratio = (price - min) / (max - min);
  if (ratio > 0.66) return 'bg-orange-500/10';
  if (ratio > 0.33) return 'bg-amber-500/10';
  return 'bg-emerald-500/10';
}

// ── Skeleton ────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4 animate-pulse">
      <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
      <div className="h-7 w-28 bg-zinc-800 rounded mb-2" />
      <div className="h-2.5 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="space-y-2 animate-pulse">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-8 bg-zinc-800/50 rounded" />
      ))}
    </div>
  );
}

// ── Page ────────────────────────────────────────────────────

export default function InventoryProductsPage() {
  const [products, setProducts] = useState<ProductRow[]>([]);
  const [rackPrices, setRackPrices] = useState<RackPriceRow[]>([]);
  const [salesVolume, setSalesVolume] = useState<SalesVolumeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRows, rackRows, volRows] = await Promise.all([
        queryGateway(
          `SELECT MasterProdID, MasterProdDescr, ProductType, COUNT(*) as line_count
           FROM DF_PBI_DS_SalesAndProfitAnalysis
           GROUP BY MasterProdID, MasterProdDescr, ProductType
           ORDER BY line_count DESC
           LIMIT 50`
        ),
        queryGateway(
          `SELECT Vendor_Name, SupplyPoint, ProductDescr, RackPrice, PriceDate
           FROM vRackPrice
           WHERE RackPrice > 0
           ORDER BY PriceDate DESC, Vendor_Name, SupplyPoint
           LIMIT 100`
        ),
        queryGateway(
          `SELECT MasterProdDescr, SUM(Qty) as total_qty, SUM(Qty * UnitPrice) as total_revenue
           FROM DF_PBI_BillingChartQuery
           WHERE Year_For_Period = 2026
           GROUP BY MasterProdDescr
           ORDER BY total_revenue DESC
           LIMIT 30`
        ),
      ]);
      setProducts(prodRows as ProductRow[]);
      setRackPrices(rackRows as RackPriceRow[]);
      setSalesVolume(volRows as SalesVolumeRow[]);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load inventory data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // ── Derived KPIs ────────────────────────────────────────────

  const productCount = products.length;
  const topProduct =
    (salesVolume[0]?.MasterProdDescr ?? '--').length > 25
      ? (salesVolume[0]?.MasterProdDescr ?? '--').slice(0, 25) + '...'
      : (salesVolume[0]?.MasterProdDescr ?? '--');

  const allRackValues = rackPrices.map((r) => r.RackPrice).filter(Boolean);
  const rackMin = allRackValues.length > 0 ? Math.min(...allRackValues) : 0;
  const rackMax = allRackValues.length > 0 ? Math.max(...allRackValues) : 0;

  const revenueYTD = (salesVolume ?? []).reduce(
    (sum, r) => sum + (r.total_revenue ?? 0),
    0
  );

  // ── Rack price matrix ──────────────────────────────────────

  const supplyPoints = Array.from(
    new Set((rackPrices ?? []).map((r) => r.SupplyPoint))
  );
  const rackProducts = Array.from(
    new Set((rackPrices ?? []).map((r) => r.ProductDescr))
  );

  // Build lookup: supplyPoint -> product -> latest price
  const rackMatrix: Record<string, Record<string, number>> = {};
  for (const row of rackPrices ?? []) {
    if (!rackMatrix[row.SupplyPoint]) {
      rackMatrix[row.SupplyPoint] = {};
    }
    // First row per supply point + product wins (sorted by PriceDate DESC)
    if (rackMatrix[row.SupplyPoint][row.ProductDescr] === undefined) {
      rackMatrix[row.SupplyPoint][row.ProductDescr] = row.RackPrice;
    }
  }

  // ── Volume + Revenue joined onto catalog ──────────────────

  const volLookup: Record<string, { qty: number; revenue: number }> = {};
  for (const v of salesVolume ?? []) {
    volLookup[v.MasterProdDescr] = {
      qty: v.total_qty ?? 0,
      revenue: v.total_revenue ?? 0,
    };
  }

  // ── Chart data (top 15 by revenue) ────────────────────────

  const chartData = (salesVolume ?? []).slice(0, 15).map((v) => ({
    name:
      (v.MasterProdDescr ?? '').length > 18
        ? (v.MasterProdDescr ?? '').slice(0, 18) + '...'
        : v.MasterProdDescr ?? '',
    revenue: v.total_revenue ?? 0,
  }));

  // ── KPI Cards ─────────────────────────────────────────────

  const kpis = [
    {
      label: 'Product Count',
      value: numFmt.format(productCount),
      icon: Package,
      color: 'text-[#FE5000]',
    },
    {
      label: 'Top Product (Vol)',
      value: topProduct,
      icon: TrendingUp,
      color: 'text-emerald-400',
    },
    {
      label: 'Rack Price Range',
      value:
        allRackValues.length > 0
          ? `${currencyFmtDec.format(rackMin)} – ${currencyFmtDec.format(rackMax)}`
          : '--',
      icon: Layers,
      color: 'text-blue-400',
    },
    {
      label: 'Revenue YTD',
      value: shortCurrency(revenueYTD),
      icon: DollarSign,
      color: 'text-amber-400',
    },
  ];

  // ── Render ────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-[#09090B] text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Package className="h-6 w-6 text-[#FE5000]" />
          <h1 className="text-2xl font-bold tracking-tight">
            Inventory &amp; Products
          </h1>
        </div>
        <div className="flex items-center gap-4">
          <Link
            href="http://localhost:3000/products"
            target="_blank"
            className="flex items-center gap-1.5 text-sm text-zinc-400 hover:text-[#FE5000] transition-colors"
          >
            Portal Products
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
          <button
            onClick={loadAll}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-[#27272A] bg-[#18181B] px-3 py-1.5 text-sm text-zinc-300 hover:border-[#FE5000]/40 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {lastRefresh && (
        <p className="text-xs text-zinc-500">
          Last refreshed {lastRefresh.toLocaleTimeString()}
        </p>
      )}

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : kpis.map((k) => (
              <div
                key={k.label}
                className="rounded-lg border border-[#27272A] bg-[#18181B] p-4"
              >
                <div className="flex items-center gap-2 mb-1">
                  <k.icon className={`h-4 w-4 ${k.color}`} />
                  <span className="text-xs text-zinc-500 uppercase tracking-wider">
                    {k.label}
                  </span>
                </div>
                <p className="text-xl font-semibold truncate">{k.value}</p>
              </div>
            ))}
      </div>

      {/* Product Catalog Table */}
      <section className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A]">
          <BarChart3 className="h-4 w-4 text-[#FE5000]" />
          <h2 className="text-sm font-semibold">Product Catalog</h2>
          <span className="ml-auto text-xs text-zinc-500">
            Top {products.length} products
          </span>
        </div>
        {loading ? (
          <div className="p-4">
            <SkeletonTable />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#27272A] text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2">Product ID</th>
                  <th className="text-left px-4 py-2">Name</th>
                  <th className="text-left px-4 py-2">Type</th>
                  <th className="text-right px-4 py-2">Volume (gal)</th>
                  <th className="text-right px-4 py-2">Revenue</th>
                  <th className="text-right px-4 py-2">Avg Price</th>
                </tr>
              </thead>
              <tbody>
                {(products ?? []).map((p, idx) => {
                  const vol = volLookup[p.MasterProdDescr];
                  const avgPrice =
                    vol && vol.qty > 0 ? vol.revenue / vol.qty : 0;
                  return (
                    <tr
                      key={`${p.MasterProdID}-${idx}`}
                      className="border-b border-[#27272A]/50 hover:bg-zinc-800/30 transition-colors"
                    >
                      <td className="px-4 py-2 font-mono text-zinc-400">
                        {p.MasterProdID ?? '--'}
                      </td>
                      <td className="px-4 py-2">{p.MasterProdDescr ?? '--'}</td>
                      <td className="px-4 py-2 text-zinc-400">
                        {p.ProductType ?? '--'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {vol ? numFmt.format(vol.qty) : '--'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {vol ? currencyFmt.format(vol.revenue) : '--'}
                      </td>
                      <td className="px-4 py-2 text-right font-mono">
                        {avgPrice > 0
                          ? currencyFmtDec.format(avgPrice)
                          : '--'}
                      </td>
                    </tr>
                  );
                })}
                {products.length === 0 && (
                  <tr>
                    <td
                      colSpan={6}
                      className="px-4 py-8 text-center text-zinc-500"
                    >
                      No product data available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Rack Price Tracker */}
      <section className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A]">
          <Layers className="h-4 w-4 text-[#FE5000]" />
          <h2 className="text-sm font-semibold">Rack Price Tracker</h2>
          <span className="ml-auto text-xs text-zinc-500">
            {supplyPoints.length} supply points &middot;{' '}
            {rackProducts.length} products
          </span>
        </div>
        {loading ? (
          <div className="p-4">
            <SkeletonTable />
          </div>
        ) : supplyPoints.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            No rack price data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[#27272A] text-xs text-zinc-500 uppercase tracking-wider">
                  <th className="text-left px-4 py-2 sticky left-0 bg-[#18181B] z-10">
                    Supply Point
                  </th>
                  {rackProducts.map((prod) => (
                    <th key={prod} className="text-right px-3 py-2 whitespace-nowrap">
                      {prod}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {supplyPoints.map((sp, idx) => (
                  <tr
                    key={`${sp}-${idx}`}
                    className="border-b border-[#27272A]/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-2 font-medium sticky left-0 bg-[#18181B] z-10 whitespace-nowrap">
                      {sp}
                    </td>
                    {rackProducts.map((prod) => {
                      const price = rackMatrix[sp]?.[prod];
                      return (
                        <td
                          key={prod}
                          className={`px-3 py-2 text-right font-mono ${
                            price !== undefined
                              ? `${priceColor(price, rackMin, rackMax)} ${priceBg(price, rackMin, rackMax)}`
                              : 'text-zinc-600'
                          }`}
                        >
                          {price !== undefined
                            ? currencyFmtDec.format(price)
                            : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sales Volume Chart */}
      <section className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A]">
          <TrendingUp className="h-4 w-4 text-[#FE5000]" />
          <h2 className="text-sm font-semibold">
            Top 15 Products by Revenue (2026 YTD)
          </h2>
        </div>
        {loading ? (
          <div className="p-4 h-80 animate-pulse bg-zinc-800/30 rounded" />
        ) : chartData.length === 0 ? (
          <div className="px-4 py-8 text-center text-zinc-500 text-sm">
            No sales volume data available
          </div>
        ) : (
          <div className="p-4 h-96">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={chartData}
                margin={{ top: 8, right: 16, left: 16, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                <XAxis
                  dataKey="name"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  stroke="#27272A"
                />
                <YAxis
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  stroke="#27272A"
                  tickFormatter={(v: number) => shortCurrency(v)}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#18181B',
                    border: '1px solid #27272A',
                    borderRadius: '8px',
                    color: '#f4f4f5',
                  }}
                  formatter={(value) => [
                    currencyFmt.format(Number(value)),
                    'Revenue',
                  ]}
                  labelStyle={{ color: '#a1a1aa' }}
                />
                <Bar
                  dataKey="revenue"
                  fill="#FE5000"
                  radius={[4, 4, 0, 0]}
                  maxBarSize={48}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
