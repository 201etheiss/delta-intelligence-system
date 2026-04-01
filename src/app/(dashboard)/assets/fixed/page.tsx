'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Building2,
  RefreshCw,
  ChevronDown,
  Download,
  Search,
  TrendingDown,
  Package,
  DollarSign,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'asset-register' | 'depreciation-schedule' | 'disposals';

type AssetCategory = 'Vehicles' | 'Equipment' | 'Buildings' | 'Land' | 'CIP';

interface FixedAsset {
  assetId: string;
  description: string;
  category: AssetCategory;
  acquisitionDate: string;
  cost: number;
  accumulatedDepreciation: number;
  netBookValue: number;
  usefulLife: number;
  method: string;
  status: 'Active' | 'Disposed' | 'Fully Depreciated';
}

interface DepreciationEntry {
  assetId: string;
  description: string;
  category: AssetCategory;
  period: string;
  openingNBV: number;
  depreciationAmount: number;
  closingNBV: number;
  method: string;
  remainingLife: number;
}

interface DisposalEntry {
  assetId: string;
  description: string;
  category: AssetCategory;
  disposalDate: string;
  cost: number;
  accumulatedDepreciation: number;
  nbvAtDisposal: number;
  saleProceeds: number;
  gainLoss: number;
}

interface AssetsSummary {
  totalAssets: number;
  totalNBV: number;
  ytdDepreciation: number;
  fullyDepreciatedCount: number;
}

interface FixedAssetsData {
  period: string;
  assets: FixedAsset[];
  depreciation: DepreciationEntry[];
  disposals: DisposalEntry[];
  summary: AssetsSummary;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtAcct(n: number): string {
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

// ---------------------------------------------------------------------------
// Period helpers
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
// Constants
// ---------------------------------------------------------------------------

const CATEGORIES: AssetCategory[] = ['Vehicles', 'Equipment', 'Buildings', 'Land', 'CIP'];

const TABS: { id: TabId; label: string }[] = [
  { id: 'asset-register', label: 'Asset Register' },
  { id: 'depreciation-schedule', label: 'Depreciation Schedule' },
  { id: 'disposals', label: 'Disposals' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">{icon}<span>{label}</span></div>
      <div className={`text-lg font-mono font-bold ${color ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function statusBadge(status: string): string {
  switch (status) {
    case 'Active': return 'text-green-400 bg-green-900/30';
    case 'Disposed': return 'text-red-400 bg-red-900/30';
    case 'Fully Depreciated': return 'text-yellow-400 bg-yellow-900/30';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

function AssetRegisterView({
  data,
  searchTerm,
  categoryFilter,
}: {
  data: FixedAssetsData;
  searchTerm: string;
  categoryFilter: AssetCategory | 'All';
}) {
  const filtered = (data.assets ?? []).filter((a) => {
    const matchesSearch = searchTerm === ''
      || a.assetId.toLowerCase().includes(searchTerm.toLowerCase())
      || a.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'All' || a.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Asset ID</th>
            <th className="py-2 text-left">Description</th>
            <th className="py-2 text-left w-24">Category</th>
            <th className="py-2 text-left w-28">Acquired</th>
            <th className="py-2 text-right w-32">Cost</th>
            <th className="py-2 text-right w-32">Accum. Depr.</th>
            <th className="py-2 text-right w-32">Net Book Value</th>
            <th className="py-2 text-center w-28">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(filtered ?? []).map((asset, i) => (
            <tr key={`${asset.assetId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className="py-1.5 text-zinc-500">{asset.assetId}</td>
              <td className="py-1.5 text-zinc-300">{asset.description}</td>
              <td className="py-1.5 text-zinc-400 text-xs">{asset.category}</td>
              <td className="py-1.5 text-zinc-500 text-xs">{asset.acquisitionDate}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(asset.cost)}</td>
              <td className="py-1.5 text-right text-orange-400">{fmtAcct(asset.accumulatedDepreciation)}</td>
              <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(asset.netBookValue)}</td>
              <td className="py-1.5 text-center">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusBadge(asset.status)}`}>
                  {asset.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(filtered ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">
          {searchTerm || categoryFilter !== 'All'
            ? 'No assets match the current filters.'
            : 'No fixed assets registered.'}
        </div>
      )}
    </div>
  );
}

function DepreciationScheduleView({ data }: { data: FixedAssetsData }) {
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Asset ID</th>
            <th className="py-2 text-left">Description</th>
            <th className="py-2 text-left w-24">Category</th>
            <th className="py-2 text-left w-20">Method</th>
            <th className="py-2 text-right w-28">Opening NBV</th>
            <th className="py-2 text-right w-28">Depreciation</th>
            <th className="py-2 text-right w-28">Closing NBV</th>
            <th className="py-2 text-right w-20">Rem. Life</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data.depreciation ?? []).map((entry, i) => (
            <tr key={`${entry.assetId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className="py-1.5 text-zinc-500">{entry.assetId}</td>
              <td className="py-1.5 text-zinc-300">{entry.description}</td>
              <td className="py-1.5 text-zinc-400 text-xs">{entry.category}</td>
              <td className="py-1.5 text-zinc-500 text-xs">{entry.method}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(entry.openingNBV)}</td>
              <td className="py-1.5 text-right text-orange-400">{fmtAcct(entry.depreciationAmount)}</td>
              <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(entry.closingNBV)}</td>
              <td className="py-1.5 text-right text-zinc-400">
                {typeof entry.remainingLife === 'number' && !Number.isNaN(entry.remainingLife) ? entry.remainingLife.toFixed(1) : '0'} yr
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2" colSpan={4}>Totals</td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.depreciation ?? []).reduce((s, e) => s + (e.openingNBV ?? 0), 0))}
            </td>
            <td className="py-2 text-right text-orange-400 font-mono">
              {fmtAcct((data.depreciation ?? []).reduce((s, e) => s + (e.depreciationAmount ?? 0), 0))}
            </td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.depreciation ?? []).reduce((s, e) => s + (e.closingNBV ?? 0), 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      {(data.depreciation ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No depreciation entries for this period.</div>
      )}
    </div>
  );
}

function DisposalsView({ data }: { data: FixedAssetsData }) {
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Asset ID</th>
            <th className="py-2 text-left">Description</th>
            <th className="py-2 text-left w-28">Disposal Date</th>
            <th className="py-2 text-right w-28">Cost</th>
            <th className="py-2 text-right w-28">Accum. Depr.</th>
            <th className="py-2 text-right w-28">NBV</th>
            <th className="py-2 text-right w-28">Proceeds</th>
            <th className="py-2 text-right w-28">Gain/(Loss)</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data.disposals ?? []).map((entry, i) => (
            <tr key={`${entry.assetId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className="py-1.5 text-zinc-500">{entry.assetId}</td>
              <td className="py-1.5 text-zinc-300">{entry.description}</td>
              <td className="py-1.5 text-zinc-500 text-xs">{entry.disposalDate}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(entry.cost)}</td>
              <td className="py-1.5 text-right text-zinc-400">{fmtAcct(entry.accumulatedDepreciation)}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(entry.nbvAtDisposal)}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(entry.saleProceeds)}</td>
              <td className={`py-1.5 text-right font-semibold ${entry.gainLoss >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtAcct(entry.gainLoss)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2" colSpan={6}>Totals</td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.disposals ?? []).reduce((s, e) => s + (e.saleProceeds ?? 0), 0))}
            </td>
            <td className={`py-2 text-right font-mono ${
              (data.disposals ?? []).reduce((s, e) => s + (e.gainLoss ?? 0), 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {fmtAcct((data.disposals ?? []).reduce((s, e) => s + (e.gainLoss ?? 0), 0))}
            </td>
          </tr>
        </tfoot>
      </table>
      {(data.disposals ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No asset disposals for this period.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FixedAssetsPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [activeTab, setActiveTab] = useState<TabId>('asset-register');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<FixedAssetsData | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<AssetCategory | 'All'>('All');
  const [categoryOpen, setCategoryOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/assets/fixed?period=${period}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to fetch fixed assets data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Building2 className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Fixed Assets</h1>
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

          <button
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 rounded-lg px-4 py-2 text-sm text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <AIInsightsBanner module="fixed-assets" compact />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          icon={<Package className="w-4 h-4" />}
          label="Total Assets"
          value={`${data?.summary?.totalAssets ?? 0}`}
        />
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Net Book Value"
          value={fmtCompact(data?.summary?.totalNBV ?? 0)}
          color="text-green-400"
        />
        <KPICard
          icon={<TrendingDown className="w-4 h-4" />}
          label="YTD Depreciation"
          value={fmtCompact(data?.summary?.ytdDepreciation ?? 0)}
          color="text-orange-400"
        />
        <KPICard
          icon={<Package className="w-4 h-4" />}
          label="Fully Depreciated"
          value={`${data?.summary?.fullyDepreciatedCount ?? 0}`}
          color="text-yellow-400"
        />
      </div>

      {/* Search + Category Filter (only on Asset Register tab) */}
      {activeTab === 'asset-register' && (
        <div className="flex items-center gap-3 mb-2.5">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by asset ID or description..."
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-10 pr-4 py-2 text-sm text-zinc-200 placeholder-zinc-500 focus:outline-none focus:border-orange-500 transition-colors"
            />
          </div>
          <div className="relative">
            <button
              onClick={() => setCategoryOpen(!categoryOpen)}
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {categoryFilter}
              <ChevronDown className="w-4 h-4" />
            </button>
            {categoryOpen && (
              <div className="absolute right-0 mt-0.5 w-40 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50">
                <button
                  onClick={() => { setCategoryFilter('All'); setCategoryOpen(false); }}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                    categoryFilter === 'All' ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                  }`}
                >
                  All
                </button>
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => { setCategoryFilter(cat); setCategoryOpen(false); }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                      categoryFilter === cat ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

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
        <div className="text-center mb-6">
          <div className="text-lg font-bold text-white">Delta360 Energy LLC</div>
          <div className="text-sm text-zinc-400">
            {activeTab === 'asset-register' && `Fixed Asset Register - ${periodLabel}`}
            {activeTab === 'depreciation-schedule' && `Depreciation Schedule - ${periodLabel}`}
            {activeTab === 'disposals' && `Asset Disposals - ${periodLabel}`}
          </div>
        </div>

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

        {error !== null ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {String(error)}
          </div>
        ) : null}

        {!loading && !error && data !== null ? (
          <>
            {activeTab === 'asset-register' && (
              <AssetRegisterView data={data} searchTerm={searchTerm} categoryFilter={categoryFilter} />
            )}
            {activeTab === 'depreciation-schedule' && <DepreciationScheduleView data={data} />}
            {activeTab === 'disposals' && <DisposalsView data={data} />}
          </>
        ) : null}

        {!loading && !error && !data && (
          <div className="text-center text-zinc-500 py-12">
            No fixed assets data available for this period.
          </div>
        )}
      </div>
    </div>
  );
}
