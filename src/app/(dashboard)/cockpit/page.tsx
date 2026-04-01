'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Gauge,
  CheckCircle2,
  Clock,
  AlertTriangle,
  XCircle,
  FileSpreadsheet,
  GitCompare,
  DollarSign,
  Wallet,
  Timer,
  ArrowRight,
  RefreshCw,
  Plus,
  CalendarCheck,
  BarChart3,
  Sunrise,
} from 'lucide-react';
import IntelligenceWidget from '@/components/dashboard/IntelligenceWidget';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ─────────────────────────────────────────────────────

interface CloseDay {
  day: number;
  label: string;
  tasks: number;
  completed: number;
}

interface JEPipelineCounts {
  draft: number;
  inReview: number;
  approved: number;
  posted: number;
  rejected: number;
}

interface ReconciliationSummary {
  completed: number;
  inProgress: number;
  exception: number;
}

interface FinancialKpis {
  revenueYTD: number;
  grossProfitYTD: number;
  arOutstanding: number;
  cogsYTD: number;
}

interface CashPosition {
  currentCash: number;
  locAvailable: number;
  borrowingBaseUtil: number; // 0-100
}

interface RackPrice {
  product: string;
  price: number;
}

interface ExceptionBucket {
  label: string;
  count: number;
  color: string;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (Math.abs(n) >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(1)}B`;
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString()}`;
}

function pct(completed: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

function dayStatusColor(completion: number): string {
  if (completion >= 100) return 'bg-green-500';
  if (completion >= 50) return 'bg-yellow-500';
  return 'bg-red-500';
}

function dayStatusBorder(completion: number): string {
  if (completion >= 100) return 'border-green-500/30';
  if (completion >= 50) return 'border-yellow-500/30';
  return 'border-red-500/30';
}

// ── Data Fetchers ───────────────────────────────────────────

async function fetchCockpitData(): Promise<{
  kpis: FinancialKpis;
  cash: CashPosition;
  rackPrice: RackPrice;
}> {
  const res = await fetch('/api/cockpit');
  const json = await res.json();
  if (!json.success) throw new Error(json.error ?? 'Failed to load cockpit data');
  return json.data;
}

async function fetchCloseData(): Promise<CloseDay[]> {
  try {
    const res = await fetch('/api/close');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) return [];
    // Map close periods into day-based tracker view
    // Each close has tasks — aggregate by day grouping if available
    const closes = json.data as Array<{
      tasks?: Array<{ day?: number; label?: string; status?: string }>;
      [key: string]: unknown;
    }>;
    if (closes.length === 0) return [];

    // Use the most recent close period
    const latest = closes[0];
    const tasks = Array.isArray(latest.tasks) ? latest.tasks : [];
    if (tasks.length === 0) return [];

    // Group tasks by day
    const dayMap = new Map<number, { label: string; tasks: number; completed: number }>();
    for (const t of tasks) {
      const day = t.day ?? 1;
      const existing = dayMap.get(day) ?? { label: t.label ?? `Day ${day}`, tasks: 0, completed: 0 };
      existing.tasks += 1;
      if (t.status === 'completed' || t.status === 'done') existing.completed += 1;
      dayMap.set(day, existing);
    }

    return Array.from(dayMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([day, d]) => ({ day, label: d.label, tasks: d.tasks, completed: d.completed }));
  } catch {
    return [];
  }
}

async function fetchJEPipeline(): Promise<JEPipelineCounts> {
  try {
    const res = await fetch('/api/journal-entries');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      return { draft: 0, inReview: 0, approved: 0, posted: 0, rejected: 0 };
    }
    const entries = json.data as Array<{ status?: string }>;
    return {
      draft: entries.filter((e) => e.status === 'draft').length,
      inReview: entries.filter((e) => e.status === 'in_review' || e.status === 'review').length,
      approved: entries.filter((e) => e.status === 'approved').length,
      posted: entries.filter((e) => e.status === 'posted').length,
      rejected: entries.filter((e) => e.status === 'rejected').length,
    };
  } catch {
    return { draft: 0, inReview: 0, approved: 0, posted: 0, rejected: 0 };
  }
}

async function fetchReconSummary(): Promise<ReconciliationSummary> {
  try {
    const res = await fetch('/api/reconciliations');
    const json = await res.json();
    if (!json.success || !Array.isArray(json.data)) {
      return { completed: 0, inProgress: 0, exception: 0 };
    }
    const items = json.data as Array<{ status?: string }>;
    return {
      completed: items.filter((i) => i.status === 'completed' || i.status === 'matched').length,
      inProgress: items.filter((i) => i.status === 'in_progress' || i.status === 'pending').length,
      exception: items.filter((i) => i.status === 'exception' || i.status === 'unmatched').length,
    };
  } catch {
    return { completed: 0, inProgress: 0, exception: 0 };
  }
}

// ── Skeleton ─────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

// ── Page ─────────────────────────────────────────────────────

export default function CockpitPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [closeDays, setCloseDays] = useState<CloseDay[]>([]);
  const [jePipeline, setJePipeline] = useState<JEPipelineCounts | null>(null);
  const [recon, setRecon] = useState<ReconciliationSummary | null>(null);
  const [kpis, setKpis] = useState<FinancialKpis | null>(null);
  const [cash, setCash] = useState<CashPosition | null>(null);
  const [rackPrice, setRackPrice] = useState<RackPrice | null>(null);
  const [exceptions] = useState<ExceptionBucket[]>([
    // Exception aging buckets — will be wired to reconciliation exceptions when API supports aging breakdown
    { label: '0-7d', count: 0, color: 'bg-green-500' },
    { label: '8-14d', count: 0, color: 'bg-yellow-500' },
    { label: '15-30d', count: 0, color: 'bg-orange-500' },
    { label: '30+d', count: 0, color: 'bg-red-500' },
  ]);
  const [lastRefresh, setLastRefresh] = useState('');

  // Stage 1: Load KPIs first (fast, small payload — shows immediately)
  const loadKpis = useCallback(async () => {
    try {
      const cockpitData = await fetchCockpitData();
      setKpis(cockpitData.kpis);
      setCash(cockpitData.cash);
      setRackPrice(cockpitData.rackPrice);
      setLastRefresh(new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load cockpit data');
    }
  }, []);

  // Stage 2: Load detail panels in background (can fail independently)
  const loadDetails = useCallback(async () => {
    const [closeResult, jeResult, reconResult] = await Promise.allSettled([
      fetchCloseData(),
      fetchJEPipeline(),
      fetchReconSummary(),
    ]);
    if (closeResult.status === 'fulfilled') setCloseDays(closeResult.value);
    if (jeResult.status === 'fulfilled') setJePipeline(jeResult.value);
    if (reconResult.status === 'fulfilled') setRecon(reconResult.value);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    // Stage 1: KPIs load first and render immediately
    await loadKpis();
    setLoading(false);
    // Stage 2: Detail panels load in background
    loadDetails();
  }, [loadKpis, loadDetails]);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  if (loading && !kpis) {
    return (
      <div className="px-5 py-4 space-y-4 h-full bg-white dark:bg-[#09090B]">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44" />
          ))}
        </div>
      </div>
    );
  }

  const totalCloseTasks = closeDays.reduce((s, d) => s + d.tasks, 0);
  const totalCloseCompleted = closeDays.reduce((s, d) => s + d.completed, 0);
  const overallClose = pct(totalCloseCompleted, totalCloseTasks);

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white flex items-center gap-2">
            <Gauge size={20} className="text-[#FF5C00]" />
            Controller Cockpit
          </h2>
          <p className="mt-0.5 text-sm text-[#71717A]">
            Single-pane operational view
            {lastRefresh && <span className="ml-2 text-[#A1A1AA]">Updated {lastRefresh}</span>}
          </p>
        </div>
        <button
          onClick={loadAll}
          className="flex items-center gap-1.5 text-xs text-[#A1A1AA] hover:text-[#FF5C00] border border-[#27272A] rounded-lg px-3 py-1.5 transition-colors"
        >
          <RefreshCw size={14} />
          Refresh
        </button>
      </div>

      <AIInsightsBanner module="cockpit" compact />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={loadAll} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
            Retry
          </button>
        </div>
      )}

      {/* Rack Price Banner */}
      {rackPrice && rackPrice.price > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#18181B] px-4 py-2">
          <DollarSign size={14} className="text-[#FF5C00]" />
          <span className="text-xs text-[#A1A1AA]">
            {rackPrice.product}: <span className="font-mono font-bold text-white">${typeof rackPrice.price === 'number' ? rackPrice.price.toFixed(4) : '0.0000'}/gal</span>
          </span>
        </div>
      )}

      {/* ─── 1. Close Progress ─────────────────────────────────── */}
      <Link href="/close-tracker" className="block group">
        <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <CalendarCheck size={16} className="text-[#FF5C00]" />
              <span className="text-xs font-semibold text-[#09090B] dark:text-white">Close Progress</span>
              <span className="text-xs text-[#71717A] font-mono">{overallClose}%</span>
            </div>
            <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
          </div>
          {closeDays.length > 0 ? (
            <div className="grid grid-cols-5 gap-3">
              {closeDays.map((d) => {
                const completion = pct(d.completed, d.tasks);
                return (
                  <div key={d.day} className={`rounded-lg border ${dayStatusBorder(completion)} bg-[#09090B] p-3 text-center`}>
                    <div className="text-[10px] text-[#71717A] uppercase tracking-wider mb-1">Day {d.day}</div>
                    <div className="h-1.5 w-full rounded-full bg-[#27272A] mb-2">
                      <div className={`h-1.5 rounded-full ${dayStatusColor(completion)} transition-all`} style={{ width: `${completion}%` }} />
                    </div>
                    <div className="text-xs font-mono text-white">{d.completed}/{d.tasks}</div>
                    <div className="text-[10px] text-[#52525B] mt-0.5 truncate">{d.label}</div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-[#52525B]">No active close period. Start one from Quick Actions below.</p>
          )}
        </div>
      </Link>

      {/* ─── 2. JE Pipeline + 3. Reconciliation Status ─────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* JE Pipeline */}
        <Link href="/journal-entries" className="block group">
          <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <FileSpreadsheet size={16} className="text-[#FF5C00]" />
                <span className="text-xs font-semibold text-[#09090B] dark:text-white">JE Pipeline</span>
              </div>
              <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
            </div>
            {jePipeline && (
              <div className="grid grid-cols-5 gap-2">
                {([
                  { label: 'Draft', value: jePipeline.draft, color: 'text-[#A1A1AA]', icon: Clock },
                  { label: 'Review', value: jePipeline.inReview, color: 'text-blue-400', icon: FileSpreadsheet },
                  { label: 'Approved', value: jePipeline.approved, color: 'text-green-400', icon: CheckCircle2 },
                  { label: 'Posted', value: jePipeline.posted, color: 'text-emerald-400', icon: CheckCircle2 },
                  { label: 'Rejected', value: jePipeline.rejected, color: 'text-red-400', icon: XCircle },
                ] as const).map((s) => (
                  <div key={s.label} className="text-center">
                    <s.icon size={14} className={`${s.color} mx-auto mb-1`} />
                    <div className={`text-lg font-mono font-bold ${s.color}`}>{s.value}</div>
                    <div className="text-[10px] text-[#52525B] uppercase tracking-wider">{s.label}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Link>

        {/* Reconciliation Status */}
        <Link href="/reconciliations" className="block group">
          <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <GitCompare size={16} className="text-[#FF5C00]" />
                <span className="text-xs font-semibold text-[#09090B] dark:text-white">Reconciliation Status</span>
              </div>
              <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
            </div>
            {recon && (
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center">
                  <CheckCircle2 size={14} className="text-green-400 mx-auto mb-1" />
                  <div className="text-lg font-mono font-bold text-green-400">{recon.completed}</div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider">Completed</div>
                </div>
                <div className="text-center">
                  <Clock size={14} className="text-yellow-400 mx-auto mb-1" />
                  <div className="text-lg font-mono font-bold text-yellow-400">{recon.inProgress}</div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider">In Progress</div>
                </div>
                <div className="text-center">
                  <AlertTriangle size={14} className="text-red-400 mx-auto mb-1" />
                  <div className="text-lg font-mono font-bold text-red-400">{recon.exception}</div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider">Exception</div>
                </div>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* ─── 4. Financial KPIs + 5. Cash Position ──────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Financial KPIs */}
        <Link href="/reports" className="block group">
          <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <DollarSign size={16} className="text-[#FF5C00]" />
                <span className="text-xs font-semibold text-[#09090B] dark:text-white">Financial KPIs</span>
              </div>
              <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
            </div>
            {kpis && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider mb-0.5">Revenue YTD</div>
                  <div className="text-lg font-mono font-bold text-white">{fmt(kpis.revenueYTD)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider mb-0.5">Gross Profit YTD</div>
                  <div className="text-lg font-mono font-bold text-green-400">{fmt(kpis.grossProfitYTD)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider mb-0.5">AR Outstanding</div>
                  <div className="text-lg font-mono font-bold text-yellow-400">{fmt(kpis.arOutstanding)}</div>
                </div>
                <div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider mb-0.5">COGS YTD</div>
                  <div className="text-lg font-mono font-bold text-[#A1A1AA]">{fmt(kpis.cogsYTD)}</div>
                </div>
              </div>
            )}
          </div>
        </Link>

        {/* Cash Position */}
        <Link href="/cash-flow" className="block group">
          <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Wallet size={16} className="text-[#FF5C00]" />
                <span className="text-xs font-semibold text-[#09090B] dark:text-white">Cash Position</span>
              </div>
              <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
            </div>
            {cash && (
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#71717A]">Current Cash</span>
                  <span className="text-lg font-mono font-bold text-white">{fmt(cash.currentCash)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs text-[#71717A]">LOC Available</span>
                  <span className={`text-lg font-mono font-bold ${cash.locAvailable > 0 ? 'text-green-400' : 'text-red-400'}`}>{fmt(cash.locAvailable)}</span>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs text-[#71717A]">Borrowing Base Util.</span>
                    <span className={`text-sm font-mono font-bold ${cash.borrowingBaseUtil > 100 ? 'text-red-500' : 'text-[#FF5C00]'}`}>{cash.borrowingBaseUtil}%</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-[#27272A]">
                    <div
                      className={`h-2 rounded-full transition-all ${
                        cash.borrowingBaseUtil > 80 ? 'bg-red-500' : cash.borrowingBaseUtil > 60 ? 'bg-[#FF5C00]' : 'bg-green-500'
                      }`}
                      style={{ width: `${Math.min(cash.borrowingBaseUtil, 100)}%` }}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        </Link>
      </div>

      {/* ─── 6. Exception Aging + 7. Quick Actions ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Exception Aging */}
        <Link href="/reconciliations" className="block group">
          <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-colors h-full">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <Timer size={16} className="text-[#FF5C00]" />
                <span className="text-xs font-semibold text-[#09090B] dark:text-white">Exception Aging</span>
              </div>
              <ArrowRight size={14} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors" />
            </div>
            <div className="grid grid-cols-4 gap-3">
              {exceptions.map((bucket) => (
                <div key={bucket.label} className="text-center">
                  <div className={`w-3 h-3 rounded-full ${bucket.color} mx-auto mb-2`} />
                  <div className="text-lg font-mono font-bold text-white">{bucket.count}</div>
                  <div className="text-[10px] text-[#52525B] uppercase tracking-wider">{bucket.label}</div>
                </div>
              ))}
            </div>
            <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center justify-between">
              <span className="text-xs text-[#71717A]">Total Open Exceptions</span>
              <span className="text-sm font-mono font-bold text-red-400">
                {exceptions.reduce((s, b) => s + b.count, 0)}
              </span>
            </div>
          </div>
        </Link>

        {/* AI Intelligence */}
        <IntelligenceWidget page="/cockpit" compact />

        {/* Quick Actions */}
        <div className="rounded-lg border border-[#27272A] bg-white dark:bg-[#18181B] p-3.5">
          <div className="flex items-center gap-2 mb-2.5">
            <BarChart3 size={16} className="text-[#FF5C00]" />
            <span className="text-xs font-semibold text-[#09090B] dark:text-white">Quick Actions</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/journal-entries?action=new"
              className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#09090B] p-3 hover:border-[#FF5C00]/50 transition-colors"
            >
              <Plus size={14} className="text-[#FF5C00]" />
              <span className="text-xs text-white">New Journal Entry</span>
            </Link>
            <Link
              href="/close-tracker?action=start"
              className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#09090B] p-3 hover:border-[#FF5C00]/50 transition-colors"
            >
              <CalendarCheck size={14} className="text-[#FF5C00]" />
              <span className="text-xs text-white">Start Month-End Close</span>
            </Link>
            <Link
              href="/cash-flow?action=borrowing-base"
              className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#09090B] p-3 hover:border-[#FF5C00]/50 transition-colors"
            >
              <Wallet size={14} className="text-[#FF5C00]" />
              <span className="text-xs text-white">Run Borrowing Base</span>
            </Link>
            <Link
              href="/digest"
              className="flex items-center gap-2 rounded-lg border border-[#27272A] bg-[#09090B] p-3 hover:border-[#FF5C00]/50 transition-colors"
            >
              <Sunrise size={14} className="text-[#FF5C00]" />
              <span className="text-xs text-white">View Daily Brief</span>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
