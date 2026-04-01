'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  AlertOctagon,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  Filter,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ExceptionItem {
  id: string;
  engine: string;
  type: string;
  description: string;
  amount: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'waived';
  createdAt: string;
  agingDays: number;
  assignedTo: string | null;
}

interface AgingBuckets {
  '0-7': number;
  '8-14': number;
  '15-30': number;
  '30+': number;
}

interface ExceptionsResponse {
  success: boolean;
  data: {
    exceptions: ExceptionItem[];
    totalCount: number;
    aging: AgingBuckets;
    byEngine: Record<string, number>;
    bySeverity: { critical: number; high: number; medium: number; low: number };
  };
}

type FilterTab = 'all' | 'engine' | 'severity' | 'status';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function severityBadge(severity: ExceptionItem['severity']) {
  switch (severity) {
    case 'critical':
      return { label: 'Critical', cls: 'text-red-400 bg-red-900/30 border-red-800/50' };
    case 'high':
      return { label: 'High', cls: 'text-orange-400 bg-orange-900/30 border-orange-800/50' };
    case 'medium':
      return { label: 'Medium', cls: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50' };
    case 'low':
      return { label: 'Low', cls: 'text-blue-400 bg-blue-900/30 border-blue-800/50' };
  }
}

function statusBadge(status: ExceptionItem['status']) {
  switch (status) {
    case 'open':
      return { label: 'Open', cls: 'text-red-400 bg-red-900/30' };
    case 'investigating':
      return { label: 'Investigating', cls: 'text-yellow-400 bg-yellow-900/30' };
    case 'resolved':
      return { label: 'Resolved', cls: 'text-green-400 bg-green-900/30' };
    case 'waived':
      return { label: 'Waived', cls: 'text-zinc-400 bg-zinc-800/50' };
  }
}

function formatAmount(amount: number | null): string {
  if (amount === null) return '-';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ExceptionMonitor() {
  const [exceptions, setExceptions] = useState<ExceptionItem[]>([]);
  const [aging, setAging] = useState<AgingBuckets>({ '0-7': 0, '8-14': 0, '15-30': 0, '30+': 0 });
  const [bySeverity, setBySeverity] = useState<{ critical: number; high: number; medium: number; low: number }>({ critical: 0, high: 0, medium: 0, low: 0 });
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const fetchExceptions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/exceptions');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ExceptionsResponse = await res.json();
      if (json.success) {
        setExceptions(json.data.exceptions);
        setAging(json.data.aging);
        setBySeverity(json.data.bySeverity);
        setTotalCount(json.data.totalCount);
      } else {
        setError('Failed to load exception data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach exceptions API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchExceptions();
  }, [fetchExceptions]);

  const avgAging = exceptions.length > 0
    ? Math.round(exceptions.reduce((sum, e) => sum + e.agingDays, 0) / exceptions.length)
    : 0;

  const engineCounts: Record<string, number> = {};
  for (const e of exceptions) {
    engineCounts[e.engine] = (engineCounts[e.engine] ?? 0) + 1;
  }

  const agingBars: { label: string; key: keyof AgingBuckets; color: string }[] = [
    { label: '0-7 days', key: '0-7', color: 'bg-green-500' },
    { label: '8-14 days', key: '8-14', color: 'bg-yellow-500' },
    { label: '15-30 days', key: '15-30', color: 'bg-orange-500' },
    { label: '30+ days', key: '30+', color: 'bg-red-500' },
  ];

  const maxAging = Math.max(...Object.values(aging), 1);

  const TABS: { id: FilterTab; label: string }[] = [
    { id: 'all', label: 'All' },
    { id: 'engine', label: 'By Engine' },
    { id: 'severity', label: 'By Severity' },
    { id: 'status', label: 'By Status' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <AlertOctagon size={24} className="text-[#FF5C00]" />
          <div>
            <h1 className="text-lg font-semibold text-white">
              Exception Monitor
              {totalCount > 0 && (
                <span className="ml-2 inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-red-500 text-white text-[10px] font-bold px-1.5">
                  {totalCount}
                </span>
              )}
            </h1>
            <p className="text-xs text-zinc-500 mt-0.5">Aggregated exceptions across all accounting engines</p>
          </div>
        </div>
        <button
          onClick={fetchExceptions}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#18181B] border border-[#27272A] text-zinc-300 hover:border-[#FF5C00]/50 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <AIInsightsBanner module="exceptions" compact />

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KpiCard label="Total Open" value={totalCount} color="text-[#FF5C00]" icon={AlertOctagon} />
        <KpiCard label="Critical" value={bySeverity.critical} color="text-red-400" icon={XCircle} />
        <KpiCard label="Avg Aging (days)" value={avgAging} color="text-yellow-400" icon={Clock} />
        <KpiCard label="Engines Affected" value={Object.keys(engineCounts).length} color="text-blue-400" icon={AlertTriangle} />
      </div>

      {/* Aging Chart */}
      <div className="mb-6 p-4 bg-[#18181B] border border-[#27272A] rounded-lg">
        <h2 className="text-sm font-medium text-zinc-300 mb-2">Exception Aging Distribution</h2>
        <div className="space-y-2">
          {agingBars.map((bar) => (
            <div key={bar.key} className="flex items-center gap-3">
              <span className="text-[10px] text-zinc-500 w-20 text-right">{bar.label}</span>
              <div className="flex-1 h-5 bg-[#27272A] rounded overflow-hidden">
                <div
                  className={`h-full ${bar.color} rounded transition-all duration-500 flex items-center justify-end pr-2`}
                  style={{ width: `${(aging[bar.key] / maxAging) * 100}%`, minWidth: aging[bar.key] > 0 ? '24px' : '0' }}
                >
                  {aging[bar.key] > 0 && (
                    <span className="text-[10px] font-bold text-white">{aging[bar.key]}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-1 mb-2.5 p-1 bg-[#18181B] border border-[#27272A] rounded-lg w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
              activeTab === tab.id
                ? 'bg-[#FF5C00]/10 text-[#FF5C00]'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <Filter size={12} />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Exceptions Table or Empty State */}
      {totalCount === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 bg-[#18181B] border border-[#27272A] rounded-lg">
          <CheckCircle2 size={48} className="text-green-400 mb-2.5" />
          <h3 className="text-lg font-semibold text-white mb-1">No open exceptions</h3>
          <p className="text-sm text-zinc-500">All systems clean — no rule violations detected</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-[#27272A]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">ID</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Engine</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Type</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Description</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Amount</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Severity</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Aging</th>
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Assigned</th>
                </tr>
              </thead>
              <tbody>
                {(exceptions ?? []).map((ex) => {
                  const sevCfg = severityBadge(ex.severity);
                  const stsCfg = statusBadge(ex.status);
                  return (
                    <tr key={ex.id} className="border-b border-[#27272A]/50 hover:bg-[#27272A]/30 transition-colors">
                      <td className="px-3 py-2 text-xs text-zinc-500 font-mono">{ex.id}</td>
                      <td className="px-3 py-2 text-xs text-zinc-300">{ex.engine}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{ex.type}</td>
                      <td className="px-3 py-2 text-xs text-white max-w-xs truncate">{ex.description}</td>
                      <td className="px-3 py-2 text-xs text-zinc-400 font-mono">{formatAmount(ex.amount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full border ${sevCfg.cls}`}>
                          {sevCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full ${stsCfg.cls}`}>
                          {stsCfg.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-xs text-zinc-400">{ex.agingDays}d</td>
                      <td className="px-3 py-2 text-xs text-zinc-500">{ex.assignedTo ?? '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading && exceptions.length === 0 && totalCount === 0 && (
        <div className="mt-4 text-center text-sm text-zinc-600">Loading exceptions...</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  color,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  icon: typeof AlertOctagon;
}) {
  return (
    <div className="flex items-center gap-3 p-4 rounded-lg bg-[#18181B] border border-[#27272A]">
      <Icon size={20} className={color} />
      <div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}
