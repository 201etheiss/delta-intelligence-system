'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Landmark,
  Wallet,
  CreditCard,
  BarChart3,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'position' | 'forecast' | 'borrowing-base';

interface CashPosition {
  bankBalance: number;
  arTotal: number;
  apTotal: number;
  locDrawn: number;
  locAvailable: number;
  netWorkingCapital: number;
  asOf: string;
}

interface ForecastWeek {
  id: string;
  weekStarting: string;
  operatingReceipts: number;
  operatingDisbursements: number;
  netOperating: number;
  investingCF: number;
  financingCF: number;
  netChange: number;
  openingBalance: number;
  closingBalance: number;
  borrowingBaseUtilization: number;
  locAvailable: number;
  createdAt: string;
}

interface BorrowingBase {
  id: string;
  date: string;
  eligibleAR: number;
  eligibleInventory: number;
  totalBase: number;
  advanceRate: number;
  maxBorrowing: number;
  currentDrawn: number;
  available: number;
  createdAt: string;
}

interface CashFlowData {
  cashPosition: CashPosition | null;
  forecast: ForecastWeek[];
  borrowingBase: BorrowingBase | null;
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

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function KPICard({
  label,
  value,
  icon: Icon,
  color = 'text-white',
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4 text-orange-500" />
        <span className="text-xs text-zinc-400 uppercase tracking-wider">{label}</span>
      </div>
      <div className={`text-lg font-mono font-bold ${color}`}>{value}</div>
    </div>
  );
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'position', label: 'Cash Position' },
  { id: 'forecast', label: '13-Week Forecast' },
  { id: 'borrowing-base', label: 'Borrowing Base' },
];

// ---------------------------------------------------------------------------
// Cash Position Tab
// ---------------------------------------------------------------------------

function CashPositionView({ data }: { data: CashPosition }) {
  const rows: { label: string; value: number; indent?: boolean }[] = [
    { label: 'Bank Balance (Operating)', value: data.bankBalance },
    { label: 'Accounts Receivable', value: data.arTotal },
    { label: 'Accounts Payable', value: data.apTotal },
    { label: 'LOC Drawn', value: data.locDrawn, indent: true },
    { label: 'LOC Available', value: data.locAvailable, indent: true },
  ];

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-2.5">
        As of {new Date(data.asOf).toLocaleString('en-US')}
      </div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-700 text-sm text-zinc-400">
            <th className="py-2 text-left">Line Item</th>
            <th className="py-2 text-right w-40">Amount</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className={`py-2.5 text-zinc-300 ${row.indent ? 'pl-6' : ''}`}>{row.label}</td>
              <td className="py-2.5 text-right text-zinc-200">{fmtCurrency(row.value)}</td>
            </tr>
          ))}
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-3 text-white">Net Working Capital</td>
            <td className={`py-3 text-right font-bold ${data.netWorkingCapital >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {fmtCurrency(data.netWorkingCapital)}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Forecast Tab (simple table since Recharts may not be installed)
// ---------------------------------------------------------------------------

function ForecastView({
  data,
  onGenerate,
  generating,
}: {
  data: ForecastWeek[];
  onGenerate: () => void;
  generating: boolean;
}) {
  if ((data ?? []).length === 0) {
    return (
      <div className="text-center py-12">
        <BarChart3 className="w-10 h-10 text-zinc-600 mx-auto mb-2" />
        <p className="text-zinc-500 mb-2.5">No forecast data available</p>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate 13-Week Forecast'}
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2.5">
        <div className="text-xs text-zinc-500">
          {(data ?? []).length} weeks projected
        </div>
        <button
          onClick={onGenerate}
          disabled={generating}
          className="px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 text-white text-xs font-medium transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Regenerate'}
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-zinc-700 text-xs text-zinc-400">
              <th className="py-2 text-left">Week Starting</th>
              <th className="py-2 text-right">Opening</th>
              <th className="py-2 text-right">Inflows</th>
              <th className="py-2 text-right">Outflows</th>
              <th className="py-2 text-right">Net Change</th>
              <th className="py-2 text-right">Closing</th>
              <th className="py-2 text-right">LOC Avail</th>
            </tr>
          </thead>
          <tbody className="font-mono text-sm">
            {(data ?? []).map((week) => (
              <tr key={week.id} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-2 text-zinc-300">{week.weekStarting}</td>
                <td className="py-2 text-right text-zinc-400">{fmtCompact(week.openingBalance)}</td>
                <td className="py-2 text-right text-green-400">{fmtCompact(week.operatingReceipts)}</td>
                <td className="py-2 text-right text-red-400">{fmtCompact(week.operatingDisbursements)}</td>
                <td className={`py-2 text-right font-semibold ${week.netChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtCompact(week.netChange)}
                </td>
                <td className="py-2 text-right text-white font-semibold">{fmtCompact(week.closingBalance)}</td>
                <td className="py-2 text-right text-zinc-400">{fmtCompact(week.locAvailable)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Mini visual: bar representation */}
      <div className="mt-6 border-t border-zinc-700 pt-4">
        <h3 className="text-xs text-zinc-400 uppercase tracking-wider mb-2">Projected Cash Trend</h3>
        <div className="flex items-end gap-1 h-32">
          {(data ?? []).map((week) => {
            const allClosing = (data ?? []).map((w) => w.closingBalance);
            const maxVal = Math.max(...allClosing, 1);
            const minVal = Math.min(...allClosing, 0);
            const range = maxVal - minVal || 1;
            const heightPct = Math.max(5, ((week.closingBalance - minVal) / range) * 100);
            const isNeg = week.closingBalance < 0;
            return (
              <div
                key={week.id}
                className="flex-1 relative group"
              >
                <div
                  className={`rounded-t ${isNeg ? 'bg-red-500/70' : 'bg-orange-500/70'}`}
                  style={{ height: `${heightPct}%` }}
                />
                <div className="absolute bottom-full mb-1 left-1/2 -translate-x-1/2 bg-zinc-800 border border-zinc-600 rounded px-2 py-1 text-[10px] text-zinc-300 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  {week.weekStarting}: {fmtCompact(week.closingBalance)}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Borrowing Base Tab
// ---------------------------------------------------------------------------

function BorrowingBaseView({ data }: { data: BorrowingBase }) {
  const utilization = data.maxBorrowing > 0
    ? Math.round((data.currentDrawn / data.maxBorrowing) * 10000) / 100
    : 0;

  const rows: { label: string; value: string; highlight?: boolean }[] = [
    { label: 'Eligible Accounts Receivable', value: fmtCurrency(data.eligibleAR) },
    { label: 'Eligible Inventory', value: fmtCurrency(data.eligibleInventory) },
    { label: 'Total Collateral Base', value: fmtCurrency(data.totalBase) },
    { label: 'Advance Rate', value: fmtPct(data.advanceRate) },
    { label: 'Maximum Borrowing', value: fmtCurrency(data.maxBorrowing), highlight: true },
    { label: 'Current Drawn', value: fmtCurrency(data.currentDrawn) },
    { label: 'Available', value: fmtCurrency(data.available), highlight: true },
  ];

  return (
    <div>
      <div className="text-xs text-zinc-500 mb-2.5">
        As of {data.date}
      </div>

      {/* Utilization bar */}
      <div className="mb-6 bg-zinc-900 border border-zinc-700 rounded-lg p-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-zinc-400">Borrowing Utilization</span>
          <span className={`font-mono font-bold ${utilization > 80 ? 'text-red-400' : utilization > 60 ? 'text-yellow-400' : 'text-green-400'}`}>
            {fmtPct(utilization)}
          </span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all ${
              utilization > 80 ? 'bg-red-500' : utilization > 60 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(100, utilization)}%` }}
          />
        </div>
        <div className="flex justify-between text-[10px] text-zinc-600 mt-0.5">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
      </div>

      <table className="w-full">
        <tbody className="font-mono text-sm">
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className={`py-2.5 ${row.highlight ? 'text-white font-semibold' : 'text-zinc-300'}`}>
                {row.label}
              </td>
              <td className={`py-2.5 text-right w-40 ${row.highlight ? 'text-white font-bold' : 'text-zinc-200'}`}>
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CashFlowPage() {
  const density = useDensity();
  const [activeTab, setActiveTab] = useState<TabId>('position');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CashFlowData>({
    cashPosition: null,
    forecast: [],
    borrowingBase: null,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/cash-flow');
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        return;
      }
      setData({
        cashPosition: json.cashPosition ?? null,
        forecast: json.forecast ?? [],
        borrowingBase: json.borrowingBase ?? null,
      });
    } catch {
      setError('Failed to fetch cash flow data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const res = await fetch('/api/cash-flow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ weeksAhead: 13 }),
      });
      const json = await res.json();
      if (json.forecast) {
        setData((prev) => ({ ...prev, forecast: json.forecast }));
      }
    } catch {
      // silent — user can retry
    } finally {
      setGenerating(false);
    }
  };

  // Compute KPI values
  const position = data.cashPosition;
  const bb = data.borrowingBase;
  const borrowingUtil = bb && bb.maxBorrowing > 0
    ? Math.round((bb.currentDrawn / bb.maxBorrowing) * 10000) / 100
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <DollarSign className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Cash Flow</h1>
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

      <AIInsightsBanner module="cash-flow" compact />

      {/* KPI Cards */}
      {density === 'executive' ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
          <KPICard
            label="Current Cash"
            value={position ? fmtCompact(position.bankBalance) : '--'}
            icon={Wallet}
            color={position && position.bankBalance >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <KPICard
            label="LOC Available"
            value={position ? fmtCompact(position.locAvailable) : '--'}
            icon={CreditCard}
          />
          <KPICard
            label="Net Working Capital"
            value={position ? fmtCompact(position.netWorkingCapital) : '--'}
            icon={position && position.netWorkingCapital >= 0 ? TrendingUp : TrendingDown}
            color={position && position.netWorkingCapital >= 0 ? 'text-green-400' : 'text-red-400'}
          />
          <KPICard
            label="Borrowing Utilization"
            value={bb ? fmtPct(borrowingUtil) : '--'}
            icon={Landmark}
            color={borrowingUtil > 80 ? 'text-red-400' : borrowingUtil > 60 ? 'text-yellow-400' : 'text-green-400'}
          />
        </div>
      ) : (
        <div className="flex items-center gap-6 text-xs px-4 py-2 mb-6 bg-zinc-900 border border-zinc-800 rounded-lg">
          <span className="text-zinc-500">Cash:</span><span className={`font-mono ${position && position.bankBalance >= 0 ? 'text-green-400' : 'text-red-400'}`}>{position ? fmtCompact(position.bankBalance) : '--'}</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">LOC:</span><span className="font-mono text-white">{position ? fmtCompact(position.locAvailable) : '--'}</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">NWC:</span><span className={`font-mono ${position && position.netWorkingCapital >= 0 ? 'text-green-400' : 'text-red-400'}`}>{position ? fmtCompact(position.netWorkingCapital) : '--'}</span>
          <span className="text-zinc-700">|</span>
          <span className="text-zinc-500">Borrow:</span><span className={`font-mono ${borrowingUtil > 80 ? 'text-red-400' : borrowingUtil > 60 ? 'text-yellow-400' : 'text-green-400'}`}>{bb ? fmtPct(borrowingUtil) : '--'}</span>
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

        {!loading && !error && activeTab === 'position' && (
          position ? (
            <CashPositionView data={position} />
          ) : (
            <div className="text-center text-zinc-500 py-12">
              No cash position data available. Ensure the Ascend gateway is connected.
            </div>
          )
        )}

        {!loading && !error && activeTab === 'forecast' && (
          <ForecastView
            data={data.forecast ?? []}
            onGenerate={handleGenerate}
            generating={generating}
          />
        )}

        {!loading && !error && activeTab === 'borrowing-base' && (
          bb ? (
            <BorrowingBaseView data={bb} />
          ) : (
            <div className="text-center text-zinc-500 py-12">
              No borrowing base data available. Generate a forecast to calculate the borrowing base.
            </div>
          )
        )}
      </div>
    </div>
  );
}
