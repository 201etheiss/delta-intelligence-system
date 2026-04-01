'use client';

import { useState, useCallback, useEffect } from 'react';
import { Clock, RefreshCw, ChevronDown, ChevronRight, AlertTriangle } from 'lucide-react';

// ── Types ────────────────────────────────────────────────────

interface LatePostedLine {
  account: string;
  desc: string;
  debit: number;
  credit: number;
}

interface LatePostedEntry {
  id: string;
  transDate: string;
  postDate: string;
  description: string;
  source: string;
  daysLate: number;
  lines: LatePostedLine[];
}

interface LatePostedData {
  entries: LatePostedEntry[];
  totalCount: number;
  avgDaysLate: number;
}

// ── Helpers ──────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

function lateBadgeColor(days: number): string {
  if (days > 30) return 'bg-red-500/10 text-red-400 border-red-500/30';
  if (days > 14) return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
  return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
}

function formatDate(d: string): string {
  if (!d) return '-';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

// ── Expandable row ───────────────────────────────────────────

function EntryRow({ entry }: { entry: LatePostedEntry }) {
  const [expanded, setExpanded] = useState(false);
  const debitTotal = (entry.lines ?? []).reduce((s, l) => s + l.debit, 0);
  const creditTotal = (entry.lines ?? []).reduce((s, l) => s + l.credit, 0);

  return (
    <>
      <tr
        onClick={() => setExpanded(!expanded)}
        className="border-b border-[#27272A] hover:bg-[#27272A]/30 cursor-pointer transition-colors"
      >
        <td className="px-3 py-2 text-xs text-zinc-400">
          <span className="flex items-center gap-1.5">
            {expanded ? (
              <ChevronDown size={12} className="text-zinc-600" />
            ) : (
              <ChevronRight size={12} className="text-zinc-600" />
            )}
            {entry.id}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400">
          {formatDate(entry.transDate)}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400">
          {formatDate(entry.postDate)}
        </td>
        <td className="px-3 py-2">
          <span
            className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-semibold border ${lateBadgeColor(entry.daysLate)}`}
          >
            {entry.daysLate}d
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400 max-w-[200px] truncate">
          {entry.description}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-500">{entry.source}</td>
        <td className="px-3 py-2 text-xs text-zinc-400 tabular-nums text-right">
          {fmt(debitTotal)}
        </td>
        <td className="px-3 py-2 text-xs text-zinc-400 tabular-nums text-right">
          {fmt(creditTotal)}
        </td>
      </tr>
      {expanded && (entry.lines ?? []).length > 0 && (
        <tr className="border-b border-[#27272A]">
          <td colSpan={8} className="px-0 py-0">
            <div className="bg-[#09090B] border-l-2 border-[#FF5C00]/30 mx-4 my-2 rounded overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="text-[10px] text-zinc-600 uppercase tracking-wide">
                    <th className="px-4 py-2 text-left">Account</th>
                    <th className="px-4 py-2 text-left">Description</th>
                    <th className="px-4 py-2 text-right">Debit</th>
                    <th className="px-4 py-2 text-right">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(entry.lines ?? []).map((line, i) => (
                    <tr
                      key={`${entry.id}-${line.account}-${i}`}
                      className="border-t border-[#27272A]/50"
                    >
                      <td className="px-4 py-1.5 text-xs text-zinc-500 font-mono">
                        {line.account}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-zinc-400">
                        {line.desc}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-zinc-400 tabular-nums text-right">
                        {line.debit > 0 ? fmt(line.debit) : '-'}
                      </td>
                      <td className="px-4 py-1.5 text-xs text-zinc-400 tabular-nums text-right">
                        {line.credit > 0 ? fmt(line.credit) : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

// ── KPI card ─────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] px-3 py-2">
      <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold text-white">{value}</div>
      {sub && <div className="text-[10px] text-zinc-600 mt-0.5">{sub}</div>}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

const THRESHOLD_OPTIONS = [7, 14, 30, 60, 90] as const;

export default function LatePostedPage() {
  const [data, setData] = useState<LatePostedData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [days, setDays] = useState<number>(30);

  const fetchData = useCallback(async (threshold: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/late-posted?days=${threshold}`);
      const json = await res.json();
      if (json.success && json.data) {
        setData(json.data as LatePostedData);
      } else {
        setError(json.error ?? 'Failed to load late-posted entries');
      }
    } catch {
      setError('Unable to reach late-posted API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(days);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const entries = data?.entries ?? [];

  const totalAmount = entries.reduce((s, e) => {
    const d = (e.lines ?? []).reduce((ls, l) => ls + l.debit, 0);
    return s + d;
  }, 0);

  const oldestEntry =
    entries.length > 0
      ? Math.max(...entries.map((e) => e.daysLate))
      : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <AlertTriangle size={20} className="text-[#FF5C00]" />
          <h1 className="text-lg font-semibold text-white">
            Late-Posted Journal Entries
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Threshold selector */}
          <div className="flex rounded-lg border border-[#27272A] overflow-hidden">
            {THRESHOLD_OPTIONS.map((t) => (
              <button
                key={t}
                onClick={() => setDays(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  days === t
                    ? 'bg-[#FF5C00] text-white'
                    : 'bg-[#18181B] text-zinc-400 hover:text-white'
                }`}
              >
                {t}d
              </button>
            ))}
          </div>

          {/* Refresh */}
          <button
            onClick={() => fetchData(days)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#FF5C00] text-white text-xs font-semibold hover:bg-[#E54800] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Loading...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* KPI cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard
            label="Total Late-Posted"
            value={String(data.totalCount)}
            sub={`Threshold: ${days}+ days`}
          />
          <KpiCard
            label="Avg Days Late"
            value={`${data.avgDaysLate}d`}
          />
          <KpiCard
            label="Oldest Entry"
            value={`${oldestEntry}d`}
          />
          <KpiCard label="Total Debit Amount" value={fmt(totalAmount)} />
        </div>
      )}

      {/* Table */}
      {data && entries.length > 0 && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-[10px] text-zinc-500 uppercase tracking-wide border-b border-[#27272A]">
                  <th className="px-3 py-2 text-left">JE ID</th>
                  <th className="px-3 py-2 text-left">Trans Date</th>
                  <th className="px-3 py-2 text-left">Post Date</th>
                  <th className="px-3 py-2 text-left">Days Late</th>
                  <th className="px-3 py-2 text-left">Description</th>
                  <th className="px-3 py-2 text-left">Source</th>
                  <th className="px-3 py-2 text-right">Debit Total</th>
                  <th className="px-3 py-2 text-right">Credit Total</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <EntryRow key={entry.id} entry={entry} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Clock size={40} className="text-zinc-700 mb-2.5" />
          <p className="text-sm text-zinc-500 mb-2">
            No data loaded yet
          </p>
          <p className="text-xs text-zinc-600 mb-2.5">
            Select a threshold and click Refresh to query late-posted journal
            entries.
          </p>
          <button
            onClick={() => fetchData(days)}
            className="px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-xs font-semibold hover:bg-[#E54800] transition-colors"
          >
            Load Entries ({days}+ days late)
          </button>
        </div>
      )}

      {/* No results */}
      {data && entries.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Clock size={32} className="text-green-600 mb-2" />
          <p className="text-sm text-zinc-400">
            No journal entries posted more than {days} days late.
          </p>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !data && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-20 rounded-lg bg-[#18181B] border border-[#27272A] animate-pulse"
              />
            ))}
          </div>
          <div className="h-64 rounded-lg bg-[#18181B] border border-[#27272A] animate-pulse" />
        </div>
      )}
    </div>
  );
}
