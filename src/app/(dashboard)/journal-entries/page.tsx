'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  XCircle,
  FileEdit,
  Send,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface JELine {
  accountNumber: string;
  accountName: string;
  debit: number;
  credit: number;
  description: string;
}

interface JournalEntry {
  id: string;
  jeNumber: string;
  date: string;
  period: string;
  description: string;
  lines: JELine[];
  totalDebit: number;
  totalCredit: number;
  status: string;
  family: string;
  createdBy: string;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

type TabId = 'all' | 'templates' | 'draft' | 'pending';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'draft':
      return { label: 'Draft', cls: 'text-zinc-400 bg-zinc-800' };
    case 'in_review':
      return { label: 'In Review', cls: 'text-blue-400 bg-blue-900/30' };
    case 'approved':
      return { label: 'Approved', cls: 'text-green-400 bg-green-900/30' };
    case 'posted':
      return { label: 'Posted', cls: 'text-[#FE5000] bg-orange-900/30' };
    case 'rejected':
      return { label: 'Rejected', cls: 'text-red-400 bg-red-900/30' };
    default:
      return { label: status, cls: 'text-zinc-400 bg-zinc-800' };
  }
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

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'all', label: 'All Entries' },
  { id: 'templates', label: 'Templates' },
  { id: 'draft', label: 'Draft' },
  { id: 'pending', label: 'Pending Review' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function JournalEntriesPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [activeTab, setActiveTab] = useState<TabId>('all');
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const statusParam = activeTab === 'draft'
        ? '&status=draft'
        : activeTab === 'pending'
          ? '&status=in_review'
          : '';
      const res = await fetch(`/api/journal-entries?period=${period}${statusParam}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load journal entries');
        setEntries([]);
        return;
      }
      setEntries(json.data ?? []);
    } catch {
      setError('Failed to fetch journal entries');
      setEntries([]);
    } finally {
      setLoading(false);
    }
  }, [period, activeTab]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  const filtered = (entries ?? []).filter((e) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (e.jeNumber ?? '').toLowerCase().includes(q) ||
      (e.description ?? '').toLowerCase().includes(q)
    );
  });

  // KPIs
  const totalJEs = (entries ?? []).length;
  const pendingReview = (entries ?? []).filter((e) => e.status === 'in_review').length;
  const postedThisPeriod = (entries ?? []).filter((e) => e.status === 'posted').length;
  const totalAmount = (entries ?? []).reduce((sum, e) => sum + (typeof e.totalDebit === 'number' ? e.totalDebit : 0), 0);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BookOpen className="w-6 h-6 text-[#FE5000]" />
          <h1 className="text-lg font-bold text-white">Journal Entries</h1>
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
            onClick={fetchEntries}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button className="flex items-center gap-2 bg-[#FE5000] hover:bg-[#CC4000] rounded-lg px-4 py-2 text-sm text-white transition-colors">
            <Plus className="w-4 h-4" />
            New JE
          </button>
        </div>
      </div>

      <AIInsightsBanner module="journal-entries" compact />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <BookOpen size={14} /> Total JEs
          </div>
          <div className="text-lg font-bold text-white">{totalJEs}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Pending Review
          </div>
          <div className="text-lg font-bold text-yellow-400">{pendingReview}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <CheckCircle2 size={14} /> Posted This Period
          </div>
          <div className="text-lg font-bold text-green-400">{postedThisPeriod}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <FileEdit size={14} /> Total Amount
          </div>
          <div className="text-lg font-bold text-white">{fmt(totalAmount)}</div>
        </div>
      </div>

      {/* Search */}
      <div className="relative mb-2.5">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
        <input
          type="text"
          placeholder="Search by description or JE number..."
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
          <BookOpen size={40} className="mx-auto mb-2 opacity-50" />
          <p>No journal entries found</p>
          <p className="text-xs mt-0.5">Create a new journal entry to get started</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2 w-8" />
                <th className="text-left px-3 py-2">JE #</th>
                <th className="text-left px-3 py-2">Date</th>
                <th className="text-left px-3 py-2">Description</th>
                <th className="text-right px-3 py-2">Debit Total</th>
                <th className="text-right px-3 py-2">Credit Total</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Created By</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((entry) => {
                const isExpanded = expandedId === entry.id;
                const badge = statusBadge(entry.status);
                return (
                  <Fragment key={entry.id}>
                    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <button onClick={() => setExpandedId(isExpanded ? null : entry.id)}>
                          {isExpanded ? (
                            <ChevronDown size={14} className="text-zinc-500" />
                          ) : (
                            <ChevronRight size={14} className="text-zinc-500" />
                          )}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                        {entry.jeNumber ?? entry.id}
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{entry.date}</td>
                      <td className="px-3 py-2 text-zinc-200 max-w-xs truncate">
                        {entry.description}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-200">
                        {fmt(entry.totalDebit)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-zinc-200">
                        {fmt(entry.totalCredit)}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}
                        >
                          {entry.status === 'in_review' && <Clock size={10} />}
                          {entry.status === 'approved' && <CheckCircle2 size={10} />}
                          {entry.status === 'posted' && <Send size={10} />}
                          {entry.status === 'rejected' && <XCircle size={10} />}
                          {badge.label}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400 text-xs">{entry.createdBy}</td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-zinc-900/50 px-8 py-4">
                          {(entry.lines ?? []).length === 0 ? (
                            <p className="text-xs text-zinc-600">No line items</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-zinc-600">
                                  <th className="text-left py-1">Account #</th>
                                  <th className="text-left py-1">Account Name</th>
                                  <th className="text-left py-1">Description</th>
                                  <th className="text-right py-1">Debit</th>
                                  <th className="text-right py-1">Credit</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(entry.lines ?? []).map((line, i) => (
                                  <tr
                                    key={`${entry.id}-line-${i}`}
                                    className="border-t border-zinc-800/30"
                                  >
                                    <td className="py-1.5 font-mono text-zinc-500">
                                      {line.accountNumber}
                                    </td>
                                    <td className="py-1.5 text-zinc-300">{line.accountName}</td>
                                    <td className="py-1.5 text-zinc-400">{line.description}</td>
                                    <td className="py-1.5 text-right font-mono text-zinc-200">
                                      {typeof line.debit === 'number' && line.debit > 0
                                        ? fmt(line.debit)
                                        : ''}
                                    </td>
                                    <td className="py-1.5 text-right font-mono text-zinc-200">
                                      {typeof line.credit === 'number' && line.credit > 0
                                        ? fmt(line.credit)
                                        : ''}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                              <tfoot>
                                <tr className="border-t border-zinc-700 font-semibold">
                                  <td colSpan={3} className="py-2 text-zinc-300">
                                    Totals
                                  </td>
                                  <td className="py-2 text-right font-mono text-white">
                                    {fmt(entry.totalDebit)}
                                  </td>
                                  <td className="py-2 text-right font-mono text-white">
                                    {fmt(entry.totalCredit)}
                                  </td>
                                </tr>
                              </tfoot>
                            </table>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
