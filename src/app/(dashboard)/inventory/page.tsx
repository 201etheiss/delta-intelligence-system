'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Filter,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'margin' | 'product-mix' | 'division';

interface MarginRow {
  period: string;
  product: string;
  division: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  margin: number;
  volume: number;
}

interface RackSpread {
  product: string;
  rackPrice: number;
  avgInvoicePrice: number;
  spread: number;
  spreadPct: number;
  asOf: string;
}

interface MarginSummary {
  avgMarginPct: number;
  totalGP: number;
  totalRevenue: number;
  totalVolume: number;
  avgRackSpread: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtCurrency(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtCompact(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `$${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `$${(abs / 1_000).toFixed(1)}K`;
  else formatted = `$${abs.toFixed(0)}`;
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtPct(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
}

function fmtVolume(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toLocaleString('en-US', { maximumFractionDigits: 0 });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'margin', label: 'Margin Analysis' },
  { id: 'product-mix', label: 'Product Mix' },
  { id: 'division', label: 'Division Performance' },
];

// ---------------------------------------------------------------------------
// Margin Table (shared between tabs)
// ---------------------------------------------------------------------------

function MarginTable({
  data,
  nameKey,
  nameLabel,
}: {
  data: MarginRow[];
  nameKey: 'product' | 'division';
  nameLabel: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[700px]">
        <thead>
          <tr className="border-b border-zinc-700 text-xs text-zinc-400 uppercase tracking-wider">
            <th className="py-2 text-left">{nameLabel}</th>
            <th className="py-2 text-right w-24">Volume</th>
            <th className="py-2 text-right w-28">Revenue</th>
            <th className="py-2 text-right w-28">Cost</th>
            <th className="py-2 text-right w-28">Margin $</th>
            <th className="py-2 text-right w-20">Margin %</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data ?? []).map((row, i) => {
            const isPositive = row.grossProfit >= 0;
            return (
              <tr key={`${row[nameKey]}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-2.5 text-zinc-200 font-sans">{row[nameKey] || 'Unknown'}</td>
                <td className="py-2.5 text-right text-zinc-400">{fmtVolume(row.volume)}</td>
                <td className="py-2.5 text-right text-zinc-200">{fmtCompact(row.revenue)}</td>
                <td className="py-2.5 text-right text-zinc-400">{fmtCompact(row.cogs)}</td>
                <td className={`py-2.5 text-right font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtCompact(row.grossProfit)}
                </td>
                <td className={`py-2.5 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(row.margin)}
                </td>
              </tr>
            );
          })}
        </tbody>
        {(data ?? []).length > 0 && (
          <tfoot>
            <tr className="border-t-2 border-zinc-500 font-semibold">
              <td className="py-2 text-white">Total</td>
              <td className="py-2 text-right text-white font-mono">
                {fmtVolume((data ?? []).reduce((s, r) => s + r.volume, 0))}
              </td>
              <td className="py-2 text-right text-white font-mono">
                {fmtCompact((data ?? []).reduce((s, r) => s + r.revenue, 0))}
              </td>
              <td className="py-2 text-right text-white font-mono">
                {fmtCompact((data ?? []).reduce((s, r) => s + r.cogs, 0))}
              </td>
              <td className="py-2 text-right text-white font-mono">
                {fmtCompact((data ?? []).reduce((s, r) => s + r.grossProfit, 0))}
              </td>
              <td className="py-2 text-right text-white font-mono">
                {(() => {
                  const totalRev = (data ?? []).reduce((s, r) => s + r.revenue, 0);
                  const totalCogs = (data ?? []).reduce((s, r) => s + r.cogs, 0);
                  const avgMargin = totalRev > 0 ? ((totalRev - totalCogs) / totalRev) * 100 : 0;
                  return fmtPct(avgMargin);
                })()}
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rack Spread Component
// ---------------------------------------------------------------------------

function RackSpreadTable({ data }: { data: RackSpread[] }) {
  if ((data ?? []).length === 0) return null;

  return (
    <div className="mt-8 border-t border-zinc-700 pt-6">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
        Rack vs Invoice Spread
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-700 text-xs text-zinc-400">
            <th className="py-2 text-left">Product</th>
            <th className="py-2 text-right w-28">Rack Price</th>
            <th className="py-2 text-right w-28">Avg Invoice</th>
            <th className="py-2 text-right w-24">Spread</th>
            <th className="py-2 text-right w-20">Spread %</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data ?? []).map((row, i) => {
            const isPositive = row.spread >= 0;
            return (
              <tr key={`${row.product}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-2 text-zinc-200 font-sans">{row.product}</td>
                <td className="py-2 text-right text-zinc-400">{fmtCurrency(row.rackPrice)}</td>
                <td className="py-2 text-right text-zinc-200">{fmtCurrency(row.avgInvoicePrice)}</td>
                <td className={`py-2 text-right font-semibold ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtCurrency(row.spread)}
                </td>
                <td className={`py-2 text-right ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtPct(row.spreadPct)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function InventoryPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<TabId>('margin');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [productData, setProductData] = useState<MarginRow[]>([]);
  const [divisionData, setDivisionData] = useState<MarginRow[]>([]);
  const [spreadData, setSpreadData] = useState<RackSpread[]>([]);
  const [summary, setSummary] = useState<MarginSummary | null>(null);

  const [productFilter, setProductFilter] = useState('');
  const [divisionFilter, setDivisionFilter] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [prodRes, divRes, spreadRes, summaryRes] = await Promise.all([
        fetch(`/api/inventory/margin?view=product&period=${period}`),
        fetch(`/api/inventory/margin?view=division&period=${period}`),
        fetch(`/api/inventory/margin?view=spread`),
        fetch(`/api/inventory/margin?view=summary&period=${period}`),
      ]);

      const [prodJson, divJson, spreadJson, summaryJson] = await Promise.all([
        prodRes.json(),
        divRes.json(),
        spreadRes.json(),
        summaryRes.json(),
      ]);

      if (!prodJson.success && prodJson.error) {
        setError(prodJson.error);
        return;
      }

      setProductData(prodJson.data ?? []);
      setDivisionData(divJson.data ?? []);
      setSpreadData(spreadJson.data ?? []);
      setSummary(summaryJson.data ?? null);
    } catch {
      setError('Failed to fetch inventory & margin data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Filter data
  const filteredProducts = productFilter
    ? (productData ?? []).filter((r) => r.product.toLowerCase().includes(productFilter.toLowerCase()))
    : (productData ?? []);

  const filteredDivisions = divisionFilter
    ? (divisionData ?? []).filter((r) => r.division.toLowerCase().includes(divisionFilter.toLowerCase()))
    : (divisionData ?? []);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Package className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Inventory & Margin</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {periodLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 mt-0.5 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
                {periods.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPeriod(p.value);
                      setPeriodOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                      p.value === period ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <AIInsightsBanner module="inventory" compact />

      {/* Summary KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Volume</span>
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {summary ? fmtVolume(summary.totalVolume) : '--'}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Revenue</span>
          </div>
          <div className="text-lg font-mono font-bold text-white">
            {summary ? fmtCompact(summary.totalRevenue) : '--'}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            {summary && summary.totalGP >= 0
              ? <TrendingUp className="w-4 h-4 text-green-400" />
              : <TrendingDown className="w-4 h-4 text-red-400" />}
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Total Margin</span>
          </div>
          <div className={`text-lg font-mono font-bold ${summary && summary.totalGP >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary ? fmtCompact(summary.totalGP) : '--'}
          </div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-orange-500" />
            <span className="text-xs text-zinc-400 uppercase tracking-wider">Avg Margin %</span>
          </div>
          <div className={`text-lg font-mono font-bold ${summary && summary.avgMarginPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {summary ? fmtPct(summary.avgMarginPct) : '--'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-5 py-4">
        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error !== null && !loading ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {String(error)}
          </div>
        ) : null}

        {/* Margin Analysis Tab */}
        {!loading && !error && activeTab === 'margin' && (
          <>
            {/* Product filter */}
            <div className="flex items-center gap-2 mb-2.5">
              <Filter className="w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter products..."
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 w-60"
              />
            </div>

            {filteredProducts.length > 0 ? (
              <>
                <MarginTable data={filteredProducts} nameKey="product" nameLabel="Product" />
                <RackSpreadTable data={spreadData} />
              </>
            ) : (
              <div className="text-center text-zinc-500 py-12">
                No margin data available for {periodLabel}.
              </div>
            )}
          </>
        )}

        {/* Product Mix Tab */}
        {!loading && !error && activeTab === 'product-mix' && (
          <>
            {(productData ?? []).length > 0 ? (
              <div>
                <div className="text-center mb-2.5">
                  <div className="text-sm text-zinc-400">Product Mix by Gross Profit for {periodLabel}</div>
                </div>
                {/* Visual mix bars */}
                <div className="space-y-3 mb-8">
                  {(() => {
                    const totalGP = Math.max(
                      (productData ?? []).reduce((s, r) => s + Math.abs(r.grossProfit), 0),
                      1
                    );
                    return (productData ?? []).map((row, i) => {
                      const widthPct = (Math.abs(row.grossProfit) / totalGP) * 100;
                      const isPositive = row.grossProfit >= 0;
                      return (
                        <div key={`${row.product}-${i}`} className="flex items-center gap-3">
                          <div className="w-32 text-sm text-zinc-300 truncate text-right">
                            {row.product || 'Unknown'}
                          </div>
                          <div className="flex-1 h-6 bg-zinc-800 rounded overflow-hidden">
                            <div
                              className={`h-full rounded ${isPositive ? 'bg-orange-500/70' : 'bg-red-500/70'}`}
                              style={{ width: `${Math.max(2, widthPct)}%` }}
                            />
                          </div>
                          <div className={`w-24 text-right font-mono text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                            {fmtCompact(row.grossProfit)}
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>

                <MarginTable data={productData ?? []} nameKey="product" nameLabel="Product" />
              </div>
            ) : (
              <div className="text-center text-zinc-500 py-12">
                No product data available for {periodLabel}.
              </div>
            )}
          </>
        )}

        {/* Division Performance Tab */}
        {!loading && !error && activeTab === 'division' && (
          <>
            {/* Division filter */}
            <div className="flex items-center gap-2 mb-2.5">
              <Filter className="w-4 h-4 text-zinc-500" />
              <input
                type="text"
                placeholder="Filter divisions..."
                value={divisionFilter}
                onChange={(e) => setDivisionFilter(e.target.value)}
                className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-200 placeholder-zinc-600 w-60"
              />
            </div>

            {filteredDivisions.length > 0 ? (
              <MarginTable data={filteredDivisions} nameKey="division" nameLabel="Division" />
            ) : (
              <div className="text-center text-zinc-500 py-12">
                No division data available for {periodLabel}.
              </div>
            )}
          </>
        )}

        {!loading && !error && (productData ?? []).length === 0 && (divisionData ?? []).length === 0 && (
          <div className="text-center text-zinc-500 py-12">
            No data available for {periodLabel}. Ensure billing data is loaded in Ascend.
          </div>
        )}
      </div>
    </div>
  );
}
