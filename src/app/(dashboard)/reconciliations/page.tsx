'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Scale,
  RefreshCw,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  Search,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Reconciliation {
  id: string;
  accountNumber: string;
  accountName: string;
  period: string;
  sourceBalance: number;
  targetBalance: number;
  difference: number;
  status: string;
  assignedTo: string;
  autoMatched: boolean;
  preparedBy: string;
  reviewedBy: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

interface AgingBucket {
  bucket: string;
  count: number;
}

type TabId = 'active' | 'completed' | 'exceptions';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

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

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'pending':
      return { label: 'Pending', cls: 'text-zinc-400 bg-zinc-800' };
    case 'in_progress':
      return { label: 'In Progress', cls: 'text-blue-400 bg-blue-900/30' };
    case 'reconciled':
      return { label: 'Reconciled', cls: 'text-green-400 bg-green-900/30' };
    case 'exception':
      return { label: 'Exception', cls: 'text-red-400 bg-red-900/30' };
    default:
      return { label: status, cls: 'text-zinc-400 bg-zinc-800' };
  }
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'active', label: 'Active Recons' },
  { id: 'completed', label: 'Completed' },
  { id: 'exceptions', label: 'Exceptions' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReconciliationsPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [activeTab, setActiveTab] = useState<TabId>('active');
  const [recons, setRecons] = useState<Reconciliation[]>([]);
  const [aging, setAging] = useState<AgingBucket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchRecons = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'completed'
        ? '&status=reconciled'
        : activeTab === 'exceptions'
          ? '&status=exception'
          : '';
      const res = await fetch(`/api/reconciliations?period=${period}${statusParam}`);
      const json = await res.json();
      if (json.error) {
        setError(json.error);
        setRecons([]);
        return;
      }
      setRecons(json.reconciliations ?? []);
    } catch {
      setError('Failed to fetch reconciliations');
      setRecons([]);
    }

    // Fetch aging data
    try {
      const agingRes = await fetch('/api/reconciliations?view=aging');
      const agingJson = await agingRes.json();
      setAging(agingJson.aging ?? []);
    } catch {
      setAging([]);
    }

    setLoading(false);
  }, [period, activeTab]);

  useEffect(() => {
    fetchRecons();
  }, [fetchRecons]);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  const filtered = (recons ?? []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.accountNumber ?? '').toLowerCase().includes(q) ||
      (r.accountName ?? '').toLowerCase().includes(q)
    );
  });

  // KPIs
  const totalRecons = (recons ?? []).length;
  const passed = (recons ?? []).filter((r) => r.status === 'reconciled').length;
  const exceptions = (recons ?? []).filter((r) => r.status === 'exception').length;
  const completedRecons = (recons ?? []).filter((r) => r.completedAt);
  const avgCompletionDays = completedRecons.length > 0
    ? completedRecons.reduce((sum, r) => {
        const created = new Date(r.createdAt).getTime();
        const completed = new Date(r.completedAt as string).getTime();
        return sum + (completed - created) / (1000 * 60 * 60 * 24);
      }, 0) / completedRecons.length
    : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Scale className="w-6 h-6 text-[#FE5000]" />
          <h1 className="text-lg font-bold text-white">Reconciliations</h1>
        </div>
        <div className="flex items-center gap-3">
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
                      p.value === period ? 'text-[#FE5000] bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={fetchRecons}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <AIInsightsBanner module="reconciliations" compact />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Scale size={14} /> Total Recons
          </div>
          <div className="text-lg font-bold text-white">{totalRecons}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <CheckCircle2 size={14} /> Passed
          </div>
          <div className="text-lg font-bold text-green-400">{passed}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <AlertTriangle size={14} /> Exceptions
          </div>
          <div className="text-lg font-bold text-red-400">{exceptions}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Avg Completion
          </div>
          <div className="text-lg font-bold text-white">
            {typeof avgCompletionDays === 'number' && !Number.isNaN(avgCompletionDays)
              ? `${avgCompletionDays.toFixed(1)}d`
              : '--'}
          </div>
        </div>
      </div>

      {/* Exception Aging */}
      {(aging ?? []).length > 0 && activeTab === 'exceptions' && (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4 mb-6">
          <h3 className="text-xs font-semibold text-zinc-300 mb-2">Exception Aging</h3>
          <div className="flex items-end gap-2 h-32">
            {(aging ?? []).map((bucket) => {
              const maxCount = Math.max(...(aging ?? []).map((a) => a.count), 1);
              const heightPct = (bucket.count / maxCount) * 100;
              return (
                <div key={bucket.bucket} className="flex flex-col items-center flex-1">
                  <span className="text-xs text-zinc-400 mb-1">{bucket.count}</span>
                  <div
                    className="w-full bg-[#FE5000] rounded-t"
                    style={{ height: `${heightPct}%`, minHeight: bucket.count > 0 ? '4px' : '0' }}
                  />
                  <span className="text-xs text-zinc-500 mt-0.5">{bucket.bucket}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by account number or name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#FE5000] transition-colors"
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
                ? 'border-[#FE5000] text-[#FE5000]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : error !== null ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {String(error)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Scale size={40} className="mx-auto mb-2 opacity-50" />
          <p>No reconciliations found</p>
          <p className="text-xs mt-0.5">Reconciliations will appear here when created</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2">Recon ID</th>
                <th className="text-left px-3 py-2">Account</th>
                <th className="text-right px-3 py-2">Source Balance</th>
                <th className="text-right px-3 py-2">Target Balance</th>
                <th className="text-right px-3 py-2">Difference</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Assigned To</th>
                <th className="text-center px-3 py-2">Auto-Match</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((recon) => {
                const badge = statusBadge(recon.status);
                const diff = typeof recon.difference === 'number' ? recon.difference : 0;
                const withinTolerance = Math.abs(diff) <= 1;
                return (
                  <tr
                    key={recon.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-3 py-2 font-mono text-xs text-zinc-400">{recon.id}</td>
                    <td className="px-3 py-2">
                      <div className="text-zinc-200">{recon.accountName}</div>
                      <div className="text-xs text-zinc-500">{recon.accountNumber}</div>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-200">
                      {fmt(recon.sourceBalance)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-zinc-200">
                      {fmt(recon.targetBalance)}
                    </td>
                    <td className="px-3 py-2 text-right font-mono">
                      <span className="flex items-center justify-end gap-1">
                        {withinTolerance ? (
                          <>
                            <CheckCircle2 size={12} className="text-green-400" />
                            <span className="text-green-400">{fmt(diff)}</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle size={12} className="text-yellow-400" />
                            <span className="text-yellow-400">{fmt(diff)}</span>
                          </>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}
                      >
                        {recon.status === 'reconciled' && <CheckCircle2 size={10} />}
                        {recon.status === 'exception' && <XCircle size={10} />}
                        {recon.status === 'in_progress' && <Clock size={10} />}
                        {badge.label}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-zinc-400 text-xs">{recon.assignedTo}</td>
                    <td className="px-3 py-2 text-center">
                      {recon.autoMatched ? (
                        <CheckCircle2 size={14} className="mx-auto text-green-500" />
                      ) : (
                        <span className="text-zinc-600 text-xs">Manual</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
