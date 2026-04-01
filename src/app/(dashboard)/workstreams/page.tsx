'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Layers,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  Clock,
  User,
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  ExternalLink,
  Activity,
  XCircle,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface WorkstreamModule {
  name: string;
  route: string | null;
  status: 'operational' | 'degraded' | 'offline' | 'planned';
}

interface Workstream {
  id: string;
  name: string;
  owner: string;
  description: string;
  modules: WorkstreamModule[];
  totalModules: number;
  operationalModules: number;
  degradedModules: number;
  plannedModules: number;
  completionPct: number;
  health: 'healthy' | 'degraded' | 'critical';
  lastUpdated: string;
}

interface WorkstreamsSummary {
  totalWorkstreams: number;
  totalModules: number;
  operationalModules: number;
  avgCompletion: number;
}

interface WorkstreamsData {
  workstreams: Workstream[];
  summary: WorkstreamsSummary;
}

// ── Helpers ───────────────────────────────────────────────────

const HEALTH_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  healthy: { label: 'Healthy', color: 'text-emerald-400', bg: 'bg-emerald-500/15 border-emerald-500/30' },
  degraded: { label: 'Degraded', color: 'text-amber-400', bg: 'bg-amber-500/15 border-amber-500/30' },
  critical: { label: 'Critical', color: 'text-red-400', bg: 'bg-red-500/15 border-red-500/30' },
};

const MODULE_STATUS_CONFIG: Record<string, { icon: typeof CheckCircle2; color: string; label: string }> = {
  operational: { icon: CheckCircle2, color: 'text-emerald-400', label: 'Operational' },
  degraded: { icon: AlertTriangle, color: 'text-amber-400', label: 'Degraded' },
  offline: { icon: XCircle, color: 'text-red-400', label: 'Offline' },
  planned: { icon: Clock, color: 'text-[#52525B]', label: 'Planned' },
};

function safePct(value: number): string {
  return typeof value === 'number' && !Number.isNaN(value) ? `${value}%` : '0%';
}

// ── Components ────────────────────────────────────────────────

function HealthBadge({ health }: { health: string }) {
  const cfg = HEALTH_STYLES[health] ?? HEALTH_STYLES.critical;
  return (
    <span className={`inline-flex items-center rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${cfg.bg} ${cfg.color}`}>
      {cfg.label}
    </span>
  );
}

function ModuleRow({ module }: { module: WorkstreamModule }) {
  const cfg = MODULE_STATUS_CONFIG[module.status] ?? MODULE_STATUS_CONFIG.planned;
  const Icon = cfg.icon;
  return (
    <div className="flex items-center gap-2 py-1.5">
      <Icon size={12} className={cfg.color} />
      <span className="text-xs text-[#A1A1AA] flex-1">{module.name}</span>
      <span className={`text-[10px] font-medium ${cfg.color}`}>
        {cfg.label}
      </span>
      {module.route && (
        <a
          href={module.route}
          className="text-[10px] text-[#FF5C00] hover:text-[#FF5C00]/80 flex items-center gap-0.5"
        >
          <ExternalLink size={9} />
          Open
        </a>
      )}
    </div>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  const safeVal = typeof pct === 'number' && !Number.isNaN(pct) ? pct : 0;
  return (
    <div className="w-full h-1.5 bg-[#27272A] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all duration-500"
        style={{
          width: `${safeVal}%`,
          backgroundColor: safeVal >= 75 ? '#10b981' : safeVal >= 40 ? '#f59e0b' : '#ef4444',
        }}
      />
    </div>
  );
}

function WorkstreamCard({ workstream }: { workstream: Workstream }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg hover:border-[#3F3F46] transition-colors">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full p-3.5 text-left"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-semibold text-white">{workstream.name}</span>
              <HealthBadge health={workstream.health} />
            </div>
            <p className="text-[11px] text-zinc-600 mb-1.5 line-clamp-1">{workstream.description}</p>
            <div className="flex items-center gap-3 text-[11px] text-[#52525B]">
              <span className="flex items-center gap-1">
                <User size={10} />
                {workstream.owner}
              </span>
              <span>
                {workstream.operationalModules}/{workstream.totalModules} modules live
              </span>
              {workstream.degradedModules > 0 && (
                <span className="text-amber-500">
                  {workstream.degradedModules} degraded
                </span>
              )}
              {workstream.plannedModules > 0 && (
                <span className="text-zinc-600">
                  {workstream.plannedModules} planned
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-3 shrink-0">
            <div className="text-right">
              <div className="text-sm font-bold text-white">{safePct(workstream.completionPct)}</div>
              <div className="w-20 mt-0.5">
                <ProgressBar pct={workstream.completionPct} />
              </div>
            </div>
            {expanded ? (
              <ChevronDown size={14} className="text-[#52525B]" />
            ) : (
              <ChevronRight size={14} className="text-[#52525B]" />
            )}
          </div>
        </div>
      </button>

      {expanded && (
        <div className="px-5 pb-4 border-t border-[#27272A] pt-3">
          <div className="space-y-0.5">
            {(workstream.modules ?? []).map((mod) => (
              <ModuleRow key={mod.name} module={mod} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function WorkstreamsPage() {
  const [data, setData] = useState<WorkstreamsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterHealth, setFilterHealth] = useState<string>('All');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/workstreams');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load workstream data');
        return;
      }
      setData(json.data as WorkstreamsData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load workstream data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const workstreams = data?.workstreams ?? [];
  const summary = data?.summary ?? { totalWorkstreams: 0, totalModules: 0, operationalModules: 0, avgCompletion: 0 };

  const filtered = filterHealth === 'All'
    ? workstreams
    : workstreams.filter((w) => w.health === filterHealth);

  const healthCounts = {
    healthy: workstreams.filter((w) => w.health === 'healthy').length,
    degraded: workstreams.filter((w) => w.health === 'degraded').length,
    critical: workstreams.filter((w) => w.health === 'critical').length,
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Layers size={22} className="text-[#FF5C00]" />
              Workstream Tracker
            </h1>
            <p className="text-sm text-[#71717A] mt-0.5">
              {summary.totalWorkstreams} workstreams | {summary.totalModules} modules | {safePct(summary.avgCompletion)} avg completion
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="mb-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 flex items-start gap-3">
            <AlertCircle size={14} className="text-amber-400 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-300">{error}</p>
          </div>
        )}

        {/* Summary stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Workstreams</div>
            <div className="text-lg font-bold text-white mt-0.5">{summary.totalWorkstreams}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Modules Live</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">
              {summary.operationalModules}/{summary.totalModules}
            </div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Avg Completion</div>
            <div className="text-lg font-bold text-white mt-0.5">{safePct(summary.avgCompletion)}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Health</div>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="text-sm font-bold text-emerald-400">{healthCounts.healthy}</span>
              {healthCounts.degraded > 0 && (
                <span className="text-sm font-bold text-amber-400">{healthCounts.degraded}</span>
              )}
              {healthCounts.critical > 0 && (
                <span className="text-sm font-bold text-red-400">{healthCounts.critical}</span>
              )}
            </div>
          </div>
        </div>

        {/* Health filter */}
        <div className="flex gap-2 mb-2.5">
          <button
            onClick={() => setFilterHealth('All')}
            className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
              filterHealth === 'All'
                ? 'bg-[#FF5C00]/15 text-[#FF5C00] border border-[#FF5C00]/30'
                : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
            }`}
          >
            All ({workstreams.length})
          </button>
          {(['healthy', 'degraded', 'critical'] as const).map((h) => {
            const cfg = HEALTH_STYLES[h];
            return (
              <button
                key={h}
                onClick={() => setFilterHealth(h)}
                className={`px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                  filterHealth === h
                    ? 'bg-[#FF5C00]/15 text-[#FF5C00] border border-[#FF5C00]/30'
                    : 'bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white'
                }`}
              >
                {cfg.label} ({healthCounts[h]})
              </button>
            );
          })}
        </div>

        {/* Module status legend */}
        <div className="flex items-center gap-3 mb-2.5">
          <span className="text-xs text-[#52525B] font-medium">Status:</span>
          {(['operational', 'degraded', 'offline', 'planned'] as const).map((s) => {
            const cfg = MODULE_STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <span key={s} className="flex items-center gap-1 text-xs">
                <Icon size={12} className={cfg.color} />
                <span className={cfg.color}>{cfg.label}</span>
              </span>
            );
          })}
        </div>

        {/* Loading state */}
        {loading && workstreams.length === 0 && (
          <div className="flex items-center justify-center h-32 text-sm text-zinc-600">
            <Activity size={16} className="animate-pulse mr-2" />
            Loading workstream data...
          </div>
        )}

        {/* Workstream cards */}
        <div className="space-y-3">
          {filtered.map((ws) => (
            <WorkstreamCard key={ws.id} workstream={ws} />
          ))}
        </div>

        {filtered.length === 0 && !loading && (
          <div className="text-center py-12 text-[#52525B]">
            <AlertTriangle size={24} className="mx-auto mb-2" />
            <p className="text-sm">No workstreams match the selected filter</p>
          </div>
        )}
      </div>
    </div>
  );
}
