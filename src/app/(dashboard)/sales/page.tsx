'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Target,
  DollarSign,
  Users,
  TrendingUp,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  Search,
  PlusCircle,
  ArrowRight,
  Heart,
  BarChart3,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ────────────────────────────────────────────────────

interface StageRow {
  StageName?: string;
  total?: number;
  cnt?: number;
}

interface SalesSummary {
  pipeline: {
    total: number;
    count: number;
    byStage: StageRow[];
  };
  accountCount: number;
}

interface CustomerHealthItem {
  customerName: string;
  score: number;
  revenue: number;
  arBalance: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface SalesKpi {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof Target;
  color: string;
}

// ── Helpers ──────────────────────────────────────────────────

function formatCurrency(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

function formatNumber(n: number): string {
  return typeof n === 'number' ? n.toLocaleString() : '0';
}

function healthColor(level: string): string {
  if (level === 'high') return 'text-red-400';
  if (level === 'medium') return 'text-amber-400';
  return 'text-emerald-400';
}

function healthBg(level: string): string {
  if (level === 'high') return 'bg-red-500/10';
  if (level === 'medium') return 'bg-amber-500/10';
  return 'bg-emerald-500/10';
}

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4 animate-pulse">
      <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
      <div className="h-7 w-28 bg-zinc-800 rounded mb-2" />
      <div className="h-2.5 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function SalesCommandConsolePage() {
  const [data, setData] = useState<SalesSummary | null>(null);
  const [healthData, setHealthData] = useState<CustomerHealthItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [healthLoading, setHealthLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/sales/summary');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load sales data');
        return;
      }
      setData(json.data as SalesSummary);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load sales data');
    } finally {
      setLoading(false);
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const res = await fetch('/api/customers/health');
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        setHealthData(
          (json.data as CustomerHealthItem[]).slice(0, 10)
        );
      }
    } catch {
      // health data optional — fail silently
    } finally {
      setHealthLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    loadHealth();
  }, [loadData, loadHealth]);

  const pipeline = data?.pipeline ?? { total: 0, count: 0, byStage: [] };
  const stages = pipeline.byStage ?? [];

  // Revenue target gauge (placeholder — target will come from config later)
  const revenueTarget = 50_000_000;
  const revPct = pipeline.total > 0
    ? Math.min((pipeline.total / revenueTarget) * 100, 100)
    : 0;

  const kpis: SalesKpi[] = [
    {
      label: 'Pipeline Value',
      value: formatCurrency(pipeline.total),
      subtext: `${typeof revPct === 'number' ? revPct.toFixed(0) : '0'}% of ${formatCurrency(revenueTarget)} target`,
      icon: DollarSign,
      color: 'text-[#FE5000]',
    },
    {
      label: 'Open Opportunities',
      value: formatNumber(pipeline.count),
      subtext: `${stages.length} stages`,
      icon: Target,
      color: 'text-emerald-400',
    },
    {
      label: 'Total Accounts',
      value: formatNumber(data?.accountCount ?? 0),
      icon: Users,
      color: 'text-blue-400',
    },
    {
      label: 'Avg Deal Size',
      value: pipeline.count > 0 ? formatCurrency(pipeline.total / pipeline.count) : '--',
      icon: TrendingUp,
      color: 'text-amber-400',
    },
  ];

  // Find max pipeline amount for bar scaling
  const maxStageAmount = Math.max(...stages.map((s) => (typeof s.total === 'number' ? s.total : 0)), 1);

  // Top accounts by pipeline (from stages sorted by total)
  const topStages = [...stages].sort((a, b) => (typeof b.total === 'number' ? b.total : 0) - (typeof a.total === 'number' ? a.total : 0)).slice(0, 5);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Sales Command Console</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Salesforce CRM Pipeline
              {lastRefresh && (
                <span className="ml-3">
                  Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={() => { loadData(); loadHealth(); }}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <AIInsightsBanner module="sales" compact />

        {/* Quick Actions Bar */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <div className="flex items-center flex-wrap gap-3">
            <Link
              href="/customer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/30 transition-colors"
            >
              <Search size={14} />
              Customer Lookup
              <ArrowRight size={10} className="ml-1" />
            </Link>
            <a
              href="https://delta360energy.lightning.force.com/lightning/o/Opportunity/new"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/30 transition-colors"
            >
              <PlusCircle size={14} />
              New Opportunity
              <ExternalLink size={10} className="ml-1" />
            </a>
            <a
              href="https://delta360energy.lightning.force.com/lightning/o/Opportunity/list"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/30 transition-colors"
            >
              <BarChart3 size={14} />
              View Pipeline
              <ExternalLink size={10} className="ml-1" />
            </a>
            <a
              href="https://delta360energy.lightning.force.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/30 transition-colors"
            >
              <ExternalLink size={14} />
              Open Salesforce
            </a>
          </div>
        </div>

        {/* KPI Cards */}
        {loading && !data ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <Icon size={14} className="text-zinc-600" />
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </div>
                  {kpi.subtext && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">{kpi.subtext}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Revenue vs Target Gauge */}
        {data && (
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white">Pipeline vs Revenue Target</h3>
              <span className="text-xs text-zinc-500 tabular-nums">
                {formatCurrency(pipeline.total)} / {formatCurrency(revenueTarget)}
              </span>
            </div>
            <div className="w-full h-3 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all bg-[#FE5000]"
                style={{ width: `${revPct}%` }}
              />
            </div>
            <p className="text-[10px] text-zinc-600 mt-0.5">
              {typeof revPct === 'number' ? revPct.toFixed(1) : '0'}% pipeline coverage
            </p>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-300">{error}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ensure the Salesforce gateway is running on port 3847.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Pipeline by Stage */}
          <div className="lg:col-span-2 rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
            <h2 className="text-xs font-semibold text-white mb-2.5">Pipeline by Stage</h2>
            {loading && stages.length === 0 ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="animate-pulse">
                    <div className="h-3 w-32 bg-zinc-800 rounded mb-2" />
                    <div className="h-2 bg-zinc-800/50 rounded-full" />
                  </div>
                ))}
              </div>
            ) : stages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Target size={24} className="text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No pipeline data available</p>
                <p className="text-xs text-zinc-600 mt-0.5">
                  Connect Salesforce gateway for live CRM data
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stages.map((stage, i) => {
                  const amount = typeof stage.total === 'number' ? stage.total : 0;
                  const count = typeof stage.cnt === 'number' ? stage.cnt : 0;
                  const pct = (amount / maxStageAmount) * 100;
                  return (
                    <div key={`${stage.StageName ?? 'unknown'}-${i}`}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-zinc-300">{stage.StageName ?? 'Unknown'}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-zinc-500">{count} opps</span>
                          <span className="text-sm font-medium text-white tabular-nums">
                            {formatCurrency(amount)}
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-[#27272A] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FE5000]"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Top Stages by Revenue */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5">Top Stages by Revenue</h2>
              {topStages.length === 0 ? (
                <p className="text-xs text-zinc-500">No data</p>
              ) : (
                <div className="space-y-2">
                  {topStages.map((s, i) => (
                    <div key={`top-${s.StageName ?? 'unknown'}-${i}`} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 truncate max-w-[60%]">
                        {s.StageName ?? 'Unknown'}
                      </span>
                      <span className="text-xs font-medium text-white tabular-nums">
                        {formatCurrency(typeof s.total === 'number' ? s.total : 0)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Customer Health Scores */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5 flex items-center gap-2">
                <Heart size={14} className="text-[#FE5000]" />
                Customer Health
              </h2>
              {healthLoading ? (
                <div className="space-y-2 animate-pulse">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <div key={i} className="h-5 bg-zinc-800/40 rounded" />
                  ))}
                </div>
              ) : (healthData ?? []).length === 0 ? (
                <p className="text-xs text-zinc-500">
                  Connect customer health API for scoring
                </p>
              ) : (
                <div className="space-y-2">
                  {(healthData ?? []).slice(0, 7).map((c, i) => (
                    <div
                      key={`health-${c.customerName}-${i}`}
                      className="flex items-center justify-between"
                    >
                      <span className="text-xs text-zinc-400 truncate max-w-[55%]">
                        {c.customerName}
                      </span>
                      <span className={`text-xs font-medium tabular-nums px-1.5 py-0.5 rounded ${healthBg(c.riskLevel)} ${healthColor(c.riskLevel)}`}>
                        {typeof c.score === 'number' ? c.score.toFixed(0) : '--'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Summary Stats */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5">Summary</h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Pipeline Stages</span>
                  <span className="text-sm text-white tabular-nums">{stages.length}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Total Accounts</span>
                  <span className="text-sm text-white tabular-nums">
                    {formatNumber(data?.accountCount ?? 0)}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Avg Deal Size</span>
                  <span className="text-sm text-white tabular-nums">
                    {pipeline.count > 0
                      ? formatCurrency(pipeline.total / pipeline.count)
                      : '--'}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Win Rate</span>
                  <span className="text-sm text-zinc-500 tabular-nums">--</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
