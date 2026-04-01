'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  RefreshCw,
  ChevronDown,
  Download,
  AlertTriangle,
  Clock,
  Phone,
  Users,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'collections-queue' | 'aging-analysis' | 'credit-limits';

interface AgingBuckets {
  current: number;
  days30: number;
  days60: number;
  days90: number;
  days90Plus: number;
}

interface CollectionItem {
  customerId: string;
  customerName: string;
  outstandingBalance: number;
  aging: AgingBuckets;
  lastContactDate: string | null;
  contactNotes: string | null;
  priority: 'low' | 'medium' | 'high' | 'critical';
  creditLimit: number;
  creditUtilization: number;
}

interface CollectionsSummary {
  totalAR: number;
  pastDue: number;
  currentAmount: number;
  avgDaysOutstanding: number;
}

interface ContactLogEntry {
  id: string;
  customerId: string;
  customerName: string;
  date: string;
  method: string;
  notes: string;
  followUpDate: string | null;
}

interface CollectionsData {
  period: string;
  items: CollectionItem[];
  summary: CollectionsSummary;
  contactLog: ContactLogEntry[];
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
// Priority helpers
// ---------------------------------------------------------------------------

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-400 bg-red-900/30';
    case 'high': return 'text-orange-400 bg-orange-900/30';
    case 'medium': return 'text-yellow-400 bg-yellow-900/30';
    case 'low': return 'text-zinc-400 bg-zinc-800';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

function agingColor(bucket: string): string {
  switch (bucket) {
    case '90+': return 'text-red-400';
    case '60': return 'text-orange-400';
    case '30': return 'text-yellow-400';
    default: return 'text-zinc-300';
  }
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'collections-queue', label: 'Collections Queue' },
  { id: 'aging-analysis', label: 'Aging Analysis' },
  { id: 'credit-limits', label: 'Credit Limits' },
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

function CollectionsQueueView({ data }: { data: CollectionsData }) {
  const sorted = [...(data.items ?? [])].sort((a, b) => {
    const order: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
    return (order[a.priority] ?? 4) - (order[b.priority] ?? 4);
  });

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left">Priority</th>
            <th className="py-2 text-left">Customer</th>
            <th className="py-2 text-right w-32">Outstanding</th>
            <th className="py-2 text-right w-24">Current</th>
            <th className="py-2 text-right w-24">30 Days</th>
            <th className="py-2 text-right w-24">60 Days</th>
            <th className="py-2 text-right w-24">90 Days</th>
            <th className="py-2 text-right w-24">90+ Days</th>
            <th className="py-2 text-left w-28">Last Contact</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(sorted ?? []).map((item, i) => (
            <tr key={`${item.customerId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className="py-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityColor(item.priority)}`}>
                  {item.priority}
                </span>
              </td>
              <td className="py-2 text-zinc-300">{item.customerName}</td>
              <td className="py-2 text-right text-white font-semibold">{fmtAcct(item.outstandingBalance)}</td>
              <td className="py-2 text-right text-zinc-300">{fmtAcct(item.aging.current)}</td>
              <td className={`py-2 text-right ${item.aging.days30 > 0 ? agingColor('30') : 'text-zinc-500'}`}>
                {fmtAcct(item.aging.days30)}
              </td>
              <td className={`py-2 text-right ${item.aging.days60 > 0 ? agingColor('60') : 'text-zinc-500'}`}>
                {fmtAcct(item.aging.days60)}
              </td>
              <td className={`py-2 text-right ${item.aging.days90 > 0 ? agingColor('90+') : 'text-zinc-500'}`}>
                {fmtAcct(item.aging.days90)}
              </td>
              <td className={`py-2 text-right ${item.aging.days90Plus > 0 ? agingColor('90+') : 'text-zinc-500'}`}>
                {item.aging.days90Plus > 0 && <AlertTriangle className="w-3 h-3 inline mr-1" />}
                {fmtAcct(item.aging.days90Plus)}
              </td>
              <td className="py-2 text-zinc-500 text-xs">{item.lastContactDate ?? '--'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {(sorted ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No items in the collections queue.</div>
      )}
    </div>
  );
}

function AgingAnalysisView({ data }: { data: CollectionsData }) {
  const items = data.items ?? [];
  const totalCurrent = items.reduce((s, it) => s + (it.aging.current ?? 0), 0);
  const total30 = items.reduce((s, it) => s + (it.aging.days30 ?? 0), 0);
  const total60 = items.reduce((s, it) => s + (it.aging.days60 ?? 0), 0);
  const total90 = items.reduce((s, it) => s + (it.aging.days90 ?? 0), 0);
  const total90Plus = items.reduce((s, it) => s + (it.aging.days90Plus ?? 0), 0);
  const grandTotal = totalCurrent + total30 + total60 + total90 + total90Plus;

  const buckets = [
    { label: 'Current', value: totalCurrent, color: 'text-green-400', bgColor: 'bg-green-400' },
    { label: '1-30 Days', value: total30, color: 'text-yellow-400', bgColor: 'bg-yellow-400' },
    { label: '31-60 Days', value: total60, color: 'text-orange-400', bgColor: 'bg-orange-400' },
    { label: '61-90 Days', value: total90, color: 'text-red-400', bgColor: 'bg-red-400' },
    { label: '90+ Days', value: total90Plus, color: 'text-red-500', bgColor: 'bg-red-500' },
  ];

  return (
    <div>
      <div className="grid grid-cols-5 gap-3 mb-8">
        {buckets.map((b) => {
          const pct = grandTotal > 0 ? (b.value / grandTotal) * 100 : 0;
          return (
            <div key={b.label} className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 text-center">
              <div className="text-xs text-zinc-400 mb-1">{b.label}</div>
              <div className={`text-lg font-mono font-bold ${b.color}`}>{fmtCompact(b.value)}</div>
              <div className="text-xs text-zinc-500 mt-0.5">
                {typeof pct === 'number' && !Number.isNaN(pct) ? pct.toFixed(1) : '0.0'}%
              </div>
              <div className="mt-2 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div className={`h-full rounded-full ${b.bgColor}`} style={{ width: `${Math.min(pct, 100)}%` }} />
              </div>
            </div>
          );
        })}
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left">Customer</th>
            <th className="py-2 text-right w-28">Current</th>
            <th className="py-2 text-right w-28">1-30</th>
            <th className="py-2 text-right w-28">31-60</th>
            <th className="py-2 text-right w-28">61-90</th>
            <th className="py-2 text-right w-28">90+</th>
            <th className="py-2 text-right w-32">Total</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(items ?? []).map((item, i) => (
            <tr key={`${item.customerId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
              <td className="py-1.5 text-zinc-300">{item.customerName}</td>
              <td className="py-1.5 text-right text-green-400">{fmtAcct(item.aging.current)}</td>
              <td className={`py-1.5 text-right ${item.aging.days30 > 0 ? 'text-yellow-400' : 'text-zinc-500'}`}>{fmtAcct(item.aging.days30)}</td>
              <td className={`py-1.5 text-right ${item.aging.days60 > 0 ? 'text-orange-400' : 'text-zinc-500'}`}>{fmtAcct(item.aging.days60)}</td>
              <td className={`py-1.5 text-right ${item.aging.days90 > 0 ? 'text-red-400' : 'text-zinc-500'}`}>{fmtAcct(item.aging.days90)}</td>
              <td className={`py-1.5 text-right ${item.aging.days90Plus > 0 ? 'text-red-500' : 'text-zinc-500'}`}>{fmtAcct(item.aging.days90Plus)}</td>
              <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(item.outstandingBalance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2 text-zinc-200">Totals</td>
            <td className="py-2 text-right text-green-400 font-mono">{fmtAcct(totalCurrent)}</td>
            <td className="py-2 text-right text-yellow-400 font-mono">{fmtAcct(total30)}</td>
            <td className="py-2 text-right text-orange-400 font-mono">{fmtAcct(total60)}</td>
            <td className="py-2 text-right text-red-400 font-mono">{fmtAcct(total90)}</td>
            <td className="py-2 text-right text-red-500 font-mono">{fmtAcct(total90Plus)}</td>
            <td className="py-2 text-right text-white font-mono">{fmtAcct(grandTotal)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function CreditLimitsView({ data }: { data: CollectionsData }) {
  const items = data.items ?? [];

  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left">Customer</th>
            <th className="py-2 text-right w-32">Credit Limit</th>
            <th className="py-2 text-right w-32">Outstanding</th>
            <th className="py-2 text-right w-28">Available</th>
            <th className="py-2 text-right w-24">Utilization</th>
            <th className="py-2 text-center w-24">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(items ?? []).map((item, i) => {
            const available = item.creditLimit - item.outstandingBalance;
            const utilPct = item.creditLimit > 0
              ? (item.outstandingBalance / item.creditLimit) * 100
              : 0;
            const statusLabel = utilPct >= 90 ? 'Over Limit'
              : utilPct >= 75 ? 'Warning'
              : utilPct >= 50 ? 'Moderate'
              : 'Healthy';

            return (
              <tr key={`${item.customerId}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-1.5 text-zinc-300">{item.customerName}</td>
                <td className="py-1.5 text-right text-zinc-200">{fmtAcct(item.creditLimit)}</td>
                <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(item.outstandingBalance)}</td>
                <td className={`py-1.5 text-right ${available < 0 ? 'text-red-400' : 'text-green-400'}`}>{fmtAcct(available)}</td>
                <td className={`py-1.5 text-right ${
                  utilPct >= 90 ? 'text-red-400'
                  : utilPct >= 75 ? 'text-orange-400'
                  : utilPct >= 50 ? 'text-yellow-400'
                  : 'text-green-400'
                }`}>
                  {typeof utilPct === 'number' && !Number.isNaN(utilPct) ? utilPct.toFixed(1) : '0.0'}%
                </td>
                <td className="py-1.5 text-center">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    utilPct >= 90 ? 'text-red-400 bg-red-900/30'
                    : utilPct >= 75 ? 'text-orange-400 bg-orange-900/30'
                    : utilPct >= 50 ? 'text-yellow-400 bg-yellow-900/30'
                    : 'text-green-400 bg-green-900/30'
                  }`}>
                    {statusLabel}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {(items ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No credit limit data available.</div>
      )}
    </div>
  );
}

function ContactLogSection({ entries }: { entries: ContactLogEntry[] }) {
  if ((entries ?? []).length === 0) return null;

  return (
    <div className="mt-8 border-t border-zinc-700 pt-6">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 flex items-center gap-2">
        <Phone className="w-4 h-4" /> Recent Contact Log
      </h3>
      <div className="space-y-2">
        {(entries ?? []).slice(0, 10).map((entry) => (
          <div key={entry.id} className="bg-zinc-900 border border-zinc-800 rounded-lg p-3 text-sm">
            <div className="flex items-center justify-between mb-1">
              <span className="text-zinc-300 font-medium">{entry.customerName}</span>
              <span className="text-zinc-500 text-xs">{entry.date} via {entry.method}</span>
            </div>
            <p className="text-zinc-400 text-xs">{entry.notes}</p>
            {entry.followUpDate && (
              <div className="mt-0.5 text-xs text-orange-400">Follow-up: {entry.followUpDate}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ARCollectionsPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [activeTab, setActiveTab] = useState<TabId>('collections-queue');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<CollectionsData | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(`/api/ar/collections?period=${period}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to fetch AR collections data');
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
          <Users className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">AR Collections</h1>
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

      <AIInsightsBanner module="ar-collections" compact />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total AR"
          value={fmtCompact(data?.summary?.totalAR ?? 0)}
        />
        <KPICard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Past Due"
          value={fmtCompact(data?.summary?.pastDue ?? 0)}
          color="text-red-400"
        />
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Current"
          value={fmtCompact(data?.summary?.currentAmount ?? 0)}
          color="text-green-400"
        />
        <KPICard
          icon={<Clock className="w-4 h-4" />}
          label="Avg Days Outstanding"
          value={`${typeof data?.summary?.avgDaysOutstanding === 'number' && !Number.isNaN(data.summary.avgDaysOutstanding) ? data.summary.avgDaysOutstanding.toFixed(0) : '0'}`}
          color="text-orange-400"
        />
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
        <div className="text-center mb-6">
          <div className="text-lg font-bold text-white">Delta360 Energy LLC</div>
          <div className="text-sm text-zinc-400">
            {activeTab === 'collections-queue' && `Collections Queue - ${periodLabel}`}
            {activeTab === 'aging-analysis' && `Aging Analysis - ${periodLabel}`}
            {activeTab === 'credit-limits' && `Credit Limits - ${periodLabel}`}
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
            {activeTab === 'collections-queue' && <CollectionsQueueView data={data} />}
            {activeTab === 'aging-analysis' && <AgingAnalysisView data={data} />}
            {activeTab === 'credit-limits' && <CreditLimitsView data={data} />}
            <ContactLogSection entries={data.contactLog ?? []} />
          </>
        ) : null}

        {!loading && !error && !data && (
          <div className="text-center text-zinc-500 py-12">
            No AR collections data available for this period.
          </div>
        )}
      </div>
    </div>
  );
}
