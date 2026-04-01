'use client';

import { useState, useEffect } from 'react';
import {
  Sunrise,
  Send,
  Settings,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Minus,
  DollarSign,
  CreditCard,
  Wallet,
  BookOpen,
  GitCompare,
  Truck,
  CheckCircle2,
  Clock,
  FileText,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import type { DailyDigest, DigestHighlight, DigestSection } from '@/lib/daily-digest';
import type { Anomaly } from '@/lib/anomaly-detector';
import DigestCharts from '@/components/dashboard/DigestCharts';

// ── Extended data types for enriched digest ──────────────────

interface RevenueComparison {
  today: number;
  priorDay: number;
  priorWeek: number;
  priorMonth: number;
}

interface ARAgingBucket {
  label: string;
  amount: number;
  color: string;
}

interface CashSnapshot {
  cashBalance: number;
  locAvailable: number;
  locBalance: number;
  borrowingBase: number;
}

interface CloseProgress {
  period: string;
  status: string;
  completedSteps: number;
  totalSteps: number;
  dueDate: string;
}

interface RecentJE {
  id: string;
  description: string;
  amount: number;
  type: string;
  createdAt: string;
}

interface FleetStatus {
  activeVehicles: number;
  totalVehicles: number;
  alerts: number;
}

interface ActionItem {
  id: string;
  title: string;
  priority: 'high' | 'medium' | 'low';
  category: string;
}

interface EnrichedDigest extends DailyDigest {
  revenueComparison?: RevenueComparison;
  arAgingBuckets?: ARAgingBucket[];
  cashSnapshot?: CashSnapshot;
  closeProgress?: CloseProgress;
  recentJournalEntries?: RecentJE[];
  reconExceptionCount?: number;
  fleetStatus?: FleetStatus;
  aiSummary?: string;
  actionItems?: ActionItem[];
}

// ── Formatters ──────────────────────────────────────────────

function fmt(n: unknown): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function changePct(current: number, prior: number): string {
  if (typeof prior !== 'number' || prior === 0) return '--';
  if (typeof current !== 'number') return '--';
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

// ── Page ──────────────────────────────────────────────────────

export default function DigestPage() {
  const [digest, setDigest] = useState<EnrichedDigest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  useEffect(() => {
    const fetchDigest = async () => {
      try {
        const res = await fetch('/api/digest');
        const data = await res.json();
        if (data.success && data.digest) {
          // Fetch supplementary data in parallel
          const [cashRes, closeRes, jeRes, reconRes, fleetRes] = await Promise.allSettled([
            fetch('/api/cash-flow').then(r => r.json()).catch(() => null),
            fetch('/api/close').then(r => r.json()).catch(() => null),
            fetch('/api/journal-entries?limit=5&recent=24h').then(r => r.json()).catch(() => null),
            fetch('/api/reconciliations?status=exception').then(r => r.json()).catch(() => null),
            fetch('/api/gateway/samsara/vehicles').then(r => r.json()).catch(() => null),
          ]);

          const enriched: EnrichedDigest = { ...data.digest };

          // Cash snapshot
          if (cashRes.status === 'fulfilled' && cashRes.value?.success) {
            const cd = cashRes.value.data ?? cashRes.value;
            enriched.cashSnapshot = {
              cashBalance: typeof cd.cashBalance === 'number' ? cd.cashBalance : 0,
              locAvailable: typeof cd.locAvailable === 'number' ? cd.locAvailable : 0,
              locBalance: typeof cd.locBalance === 'number' ? cd.locBalance : 0,
              borrowingBase: typeof cd.borrowingBase === 'number' ? cd.borrowingBase : 0,
            };
          }

          // Close progress
          if (closeRes.status === 'fulfilled' && closeRes.value?.success) {
            const cp = closeRes.value.data ?? closeRes.value.close ?? closeRes.value;
            if (cp && typeof cp.status === 'string') {
              enriched.closeProgress = {
                period: String(cp.period ?? ''),
                status: String(cp.status ?? 'unknown'),
                completedSteps: typeof cp.completedSteps === 'number' ? cp.completedSteps : 0,
                totalSteps: typeof cp.totalSteps === 'number' ? cp.totalSteps : 0,
                dueDate: String(cp.dueDate ?? ''),
              };
            }
          }

          // Recent journal entries
          if (jeRes.status === 'fulfilled' && jeRes.value?.success) {
            const entries = (jeRes.value.data ?? jeRes.value.entries ?? []);
            enriched.recentJournalEntries = (Array.isArray(entries) ? entries : []).slice(0, 5).map((e: Record<string, unknown>) => ({
              id: String(e.id ?? e.SysTrxNo ?? ''),
              description: String(e.description ?? e.Description ?? e.Descr ?? ''),
              amount: typeof e.amount === 'number' ? e.amount : typeof e.Amount === 'number' ? e.Amount : 0,
              type: String(e.type ?? e.JEType ?? 'Standard'),
              createdAt: String(e.createdAt ?? e.CreatedDt ?? ''),
            }));
          }

          // Reconciliation exceptions
          if (reconRes.status === 'fulfilled' && reconRes.value) {
            const exceptions = reconRes.value.data ?? reconRes.value.exceptions ?? [];
            enriched.reconExceptionCount = Array.isArray(exceptions) ? exceptions.length : 0;
          }

          // Fleet status
          if (fleetRes.status === 'fulfilled' && fleetRes.value) {
            const vehicles = fleetRes.value.data ?? fleetRes.value.vehicles ?? [];
            const vehicleList = Array.isArray(vehicles) ? vehicles : [];
            enriched.fleetStatus = {
              activeVehicles: vehicleList.filter((v: Record<string, unknown>) =>
                v.engineState === 'on' || v.status === 'active'
              ).length,
              totalVehicles: vehicleList.length,
              alerts: vehicleList.filter((v: Record<string, unknown>) =>
                (v.alerts ?? []) as unknown[]
              ).length,
            };
          }

          // Build AR aging buckets from digest sections
          const arSection = (enriched.sections ?? []).find(s =>
            s.title.toLowerCase().includes('receivable') || s.title.toLowerCase().includes('ar')
          );
          if (arSection) {
            enriched.arAgingBuckets = (arSection.items ?? []).map(item => ({
              label: item.label,
              amount: parseFloat(item.value.replace(/[$,KMB]/g, '')) * (item.value.includes('M') ? 1000000 : item.value.includes('K') ? 1000 : 1),
              color: item.label.includes('90') ? '#ef4444' : item.label.includes('60') ? '#f97316' : item.label.includes('30') ? '#eab308' : '#22c55e',
            }));
          }

          // Action items derived from anomalies and data
          const items: ActionItem[] = [];
          (enriched.anomalies ?? []).forEach((a, i) => {
            items.push({
              id: `anomaly-${i}`,
              title: `${a.metric}: ${a.description}`,
              priority: a.severity === 'critical' ? 'high' : a.severity === 'warning' ? 'medium' : 'low',
              category: 'Anomaly',
            });
          });
          if (enriched.reconExceptionCount && enriched.reconExceptionCount > 0) {
            items.push({
              id: 'recon-exceptions',
              title: `${enriched.reconExceptionCount} reconciliation exceptions need review`,
              priority: 'medium',
              category: 'Reconciliation',
            });
          }
          if (enriched.closeProgress && enriched.closeProgress.status === 'in_progress') {
            items.push({
              id: 'close-progress',
              title: `Month-end close in progress (${enriched.closeProgress.completedSteps}/${enriched.closeProgress.totalSteps} steps)`,
              priority: 'high',
              category: 'Close',
            });
          }
          enriched.actionItems = items;

          setDigest(enriched);
        } else {
          setError(data.error ?? 'Failed to generate digest');
        }
      } catch {
        setError('Unable to reach digest API');
      } finally {
        setLoading(false);
      }
    };

    fetchDigest();
  }, []);

  const handleGenerateAISummary = async () => {
    if (!digest || loadingAI) return;
    setLoadingAI(true);
    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: `Generate a concise 3-4 sentence executive morning briefing based on: Revenue YTD highlights, AR status, fleet operations, and any anomalies detected. Keep it factual and actionable.`,
          context: 'digest-summary',
        }),
      });
      const data = await res.json();
      if (data.response ?? data.message ?? data.content) {
        setAiSummary(String(data.response ?? data.message ?? data.content));
      } else {
        setAiSummary('AI summary generation requires chat API configuration.');
      }
    } catch {
      setAiSummary('AI summary unavailable. Configure /api/chat endpoint to enable.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleSendEmail = async () => {
    setSendingEmail(true);
    try {
      const res = await fetch('/api/digest', { method: 'POST' });
      const data = await res.json();
      if (data.success) setEmailSent(true);
    } catch {
      // silent
    } finally {
      setSendingEmail(false);
    }
  };

  if (loading) {
    return (
      <div className="px-5 py-4 space-y-4 h-full bg-[#09090B]">
        <div className="h-8 w-48 rounded bg-[#27272A] animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-32 rounded-lg bg-[#27272A] animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-[#27272A] animate-pulse" />
          ))}
        </div>
        <div className="h-64 rounded-lg bg-[#27272A] animate-pulse" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-4 h-full bg-[#09090B]">
        <div className="rounded-md border border-red-700/50 bg-red-900/30 px-3 py-2 text-sm text-red-300">{error}</div>
      </div>
    );
  }

  if (!digest) return null;

  const priorityColors: Record<string, string> = {
    high: 'bg-red-500/10 text-red-400 border-red-500/20',
    medium: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    low: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  };

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Sunrise size={20} className="text-[#FF5C00]" />
            Daily Briefing
          </h2>
          <p className="mt-0.5 text-sm text-[#71717A]">{digest.date}</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateAISummary}
            disabled={loadingAI}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#27272A] text-[#A1A1AA] hover:text-[#FF5C00] hover:border-[#FF5C00]/40 transition-colors disabled:opacity-50"
          >
            <Sparkles size={14} className={loadingAI ? 'animate-spin' : ''} />
            AI Summary
          </button>
          <button
            onClick={handleSendEmail}
            disabled={sendingEmail || emailSent}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium bg-[#FF5C00] text-white hover:bg-[#E54800] transition-colors disabled:opacity-50"
          >
            <Send size={14} />
            {emailSent ? 'Sent' : 'Send to Email'}
          </button>
          <button className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#FF5C00]/40 transition-colors">
            <Settings size={14} />
            Configure
          </button>
        </div>
      </div>

      {/* AI Summary */}
      {aiSummary && (
        <div className="rounded-lg border border-[#FF5C00]/20 bg-[#FF5C00]/5 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles size={14} className="text-[#FF5C00]" />
            <span className="text-xs font-semibold text-[#FF5C00] uppercase tracking-wide">AI Narrative Summary</span>
          </div>
          <p className="text-sm text-[#A1A1AA] leading-relaxed">{aiSummary}</p>
        </div>
      )}

      {/* Greeting */}
      <p className="text-sm text-[#A1A1AA]">{digest.greeting}</p>

      {/* 3 Things to Know Today */}
      <div>
        <h3 className="text-xs font-semibold text-white uppercase tracking-wide mb-2">
          3 Things to Know Today
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {(digest.highlights ?? []).map((h, i) => (
            <HighlightCard key={i} highlight={h} index={i + 1} />
          ))}
        </div>
      </div>

      {/* Visual Snapshot Charts */}
      <DigestCharts />

      {/* Cash Position + Revenue Comparison Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Cash Position */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wallet size={14} className="text-[#FF5C00]" />
            <span className="text-[11px] font-medium text-[#71717A] uppercase tracking-wider">Cash Position</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {fmt(digest.cashSnapshot?.cashBalance)}
          </div>
          <div className="text-[11px] text-[#52525B] mt-0.5">Bank balance</div>
        </div>

        {/* LOC Available */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <CreditCard size={14} className="text-[#FF5C00]" />
            <span className="text-[11px] font-medium text-[#71717A] uppercase tracking-wider">LOC Available</span>
          </div>
          <div className="text-lg font-bold text-green-400 tabular-nums">
            {fmt(digest.cashSnapshot?.locAvailable)}
          </div>
          <div className="text-[11px] text-[#52525B] mt-0.5">
            Drawn: {fmt(digest.cashSnapshot?.locBalance)}
          </div>
        </div>

        {/* Close Progress */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-[#FF5C00]" />
            <span className="text-[11px] font-medium text-[#71717A] uppercase tracking-wider">Close Progress</span>
          </div>
          {digest.closeProgress ? (
            <>
              <div className="text-lg font-bold text-white tabular-nums">
                {digest.closeProgress.completedSteps}/{digest.closeProgress.totalSteps}
              </div>
              <div className="text-[11px] text-[#52525B] mt-0.5">
                {digest.closeProgress.period} - {digest.closeProgress.status}
              </div>
              <div className="w-full h-1.5 bg-[#27272A] rounded-full mt-2 overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FF5C00] transition-all"
                  style={{
                    width: `${digest.closeProgress.totalSteps > 0 ? (digest.closeProgress.completedSteps / digest.closeProgress.totalSteps) * 100 : 0}%`,
                  }}
                />
              </div>
            </>
          ) : (
            <div className="text-sm text-[#52525B]">No active close</div>
          )}
        </div>

        {/* Recon Exceptions */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <GitCompare size={14} className="text-[#FF5C00]" />
            <span className="text-[11px] font-medium text-[#71717A] uppercase tracking-wider">Recon Exceptions</span>
          </div>
          <div className={`text-lg font-bold tabular-nums ${(digest.reconExceptionCount ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {digest.reconExceptionCount ?? 0}
          </div>
          <div className="text-[11px] text-[#52525B] mt-0.5">
            {(digest.reconExceptionCount ?? 0) === 0 ? 'All reconciled' : 'Items needing review'}
          </div>
        </div>
      </div>

      {/* Fleet + Recent JEs Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Fleet Status */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-2 flex items-center gap-2">
            <Truck size={14} className="text-[#FF5C00]" />
            Fleet Status
          </h4>
          {digest.fleetStatus ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-[#71717A]">Active Vehicles</span>
                <span className="text-xs font-semibold text-white tabular-nums">
                  {digest.fleetStatus.activeVehicles} / {digest.fleetStatus.totalVehicles}
                </span>
              </div>
              <div className="w-full h-2 bg-[#27272A] rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{
                    width: `${digest.fleetStatus.totalVehicles > 0 ? (digest.fleetStatus.activeVehicles / digest.fleetStatus.totalVehicles) * 100 : 0}%`,
                  }}
                />
              </div>
              {digest.fleetStatus.alerts > 0 && (
                <div className="flex items-center gap-2 text-yellow-400 text-xs">
                  <AlertTriangle size={12} />
                  {digest.fleetStatus.alerts} vehicle alerts active
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#52525B]">Fleet data unavailable</p>
          )}
        </div>

        {/* Recent Journal Entries */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-2 flex items-center gap-2">
            <BookOpen size={14} className="text-[#FF5C00]" />
            Recent Journal Entries (Last 24h)
          </h4>
          {(digest.recentJournalEntries ?? []).length > 0 ? (
            <div className="space-y-2">
              {(digest.recentJournalEntries ?? []).map((je) => (
                <div key={je.id} className="flex items-center justify-between py-1 border-b border-[#27272A]/50 last:border-0">
                  <div className="flex-1 min-w-0">
                    <span className="text-sm text-[#A1A1AA] truncate block">{je.description || `JE #${je.id}`}</span>
                    <span className="text-[10px] text-[#52525B]">{je.type}</span>
                  </div>
                  <span className="text-xs font-semibold text-white tabular-nums ml-3">{fmt(je.amount)}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[#52525B]">No journal entries in the last 24 hours</p>
          )}
        </div>
      </div>

      {/* AR Aging Summary */}
      {(digest.arAgingBuckets ?? []).length > 0 && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-2 flex items-center gap-2">
            <DollarSign size={14} className="text-[#FF5C00]" />
            AR Aging Summary
          </h4>
          <div className="space-y-2">
            {(digest.arAgingBuckets ?? []).map((bucket) => {
              const maxVal = Math.max(...(digest.arAgingBuckets ?? []).map(b => b.amount), 1);
              const widthPct = (bucket.amount / maxVal) * 100;
              return (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="text-[11px] text-[#71717A] w-20 text-right truncate">{bucket.label}</span>
                  <div className="flex-1 h-4 bg-[#27272A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: bucket.color,
                        minWidth: bucket.amount > 0 ? '4px' : '0px',
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-[#A1A1AA] tabular-nums w-16 text-right">{fmt(bucket.amount)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Anomalies */}
      {(digest.anomalies ?? []).length > 0 && (
        <div>
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <AlertTriangle size={12} className="text-red-500" />
            Detected Anomalies
          </h3>
          <div className="space-y-2">
            {(digest.anomalies ?? []).map((a) => (
              <AnomalyRow key={a.id} anomaly={a} />
            ))}
          </div>
        </div>
      )}

      {/* Action Items */}
      {(digest.actionItems ?? []).length > 0 && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
          <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-2 flex items-center gap-2">
            <CheckCircle2 size={14} className="text-[#FF5C00]" />
            Action Items
          </h4>
          <div className="space-y-2">
            {(digest.actionItems ?? []).map((item) => (
              <div
                key={item.id}
                className={`flex items-center gap-3 rounded-lg border px-4 py-2.5 ${priorityColors[item.priority] ?? priorityColors.low}`}
              >
                <span className="text-[10px] font-mono uppercase tracking-wider shrink-0 w-14">{item.priority}</span>
                <div className="flex-1 min-w-0">
                  <span className="text-sm">{item.title}</span>
                </div>
                <span className="text-[10px] text-[#52525B] shrink-0">{item.category}</span>
                <ArrowRight size={12} className="shrink-0 opacity-50" />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Sections (original digest sections) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(digest.sections ?? []).map((section) => (
          <SectionCard key={section.title} section={section} />
        ))}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

const HIGHLIGHT_COLORS: Record<DigestHighlight['color'], string> = {
  orange: 'border-[#FF5C00]/30 bg-[#FF5C00]/5',
  green: 'border-green-500/30 bg-green-500/5',
  red: 'border-red-500/30 bg-red-500/5',
  blue: 'border-blue-500/30 bg-blue-500/5',
  yellow: 'border-yellow-500/30 bg-yellow-500/5',
};

const HIGHLIGHT_DOT_COLORS: Record<DigestHighlight['color'], string> = {
  orange: '#FF5C00',
  green: '#22C55E',
  red: '#EF4444',
  blue: '#3B82F6',
  yellow: '#EAB308',
};

function HighlightCard({ highlight, index }: { highlight: DigestHighlight; index: number }) {
  return (
    <div className={`rounded-lg border p-4 ${HIGHLIGHT_COLORS[highlight.color]}`}>
      <div className="flex items-center gap-2 mb-2">
        <span
          className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
          style={{ backgroundColor: HIGHLIGHT_DOT_COLORS[highlight.color] }}
        >
          {index}
        </span>
        <span className="text-xs font-semibold text-white">{highlight.title}</span>
      </div>
      <p className="text-xs text-[#A1A1AA]">{highlight.detail}</p>
    </div>
  );
}

function AnomalyRow({ anomaly }: { anomaly: Anomaly }) {
  const severityColors = {
    critical: 'bg-red-500/10 border-red-500/30 text-red-500',
    warning: 'bg-orange-500/10 border-orange-500/30 text-orange-500',
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-500',
  };

  return (
    <div className={`flex items-center gap-3 rounded-lg border px-3 py-2 ${severityColors[anomaly.severity]}`}>
      <AlertTriangle size={14} className="shrink-0" />
      <div className="flex-1 min-w-0">
        <span className="text-sm font-medium">{anomaly.metric}</span>
        <span className="text-xs ml-2 opacity-80">{anomaly.description}</span>
      </div>
      <span className="text-[10px] font-semibold uppercase shrink-0">{anomaly.severity}</span>
    </div>
  );
}

function SectionCard({ section }: { section: DigestSection }) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5 shadow-sm">
      <h4 className="text-xs font-semibold text-white uppercase tracking-wide mb-2">{section.title}</h4>
      <div className="space-y-2">
        {(section.items ?? []).map((item) => (
          <div key={item.label} className="flex items-center justify-between">
            <span className="text-sm text-[#A1A1AA]">{item.label}</span>
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-semibold text-white font-mono">{item.value}</span>
              {item.trend === 'up' && <TrendingUp size={12} className="text-green-500" />}
              {item.trend === 'down' && <TrendingDown size={12} className="text-red-500" />}
              {item.trend === 'flat' && <Minus size={12} className="text-[#71717A]" />}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
