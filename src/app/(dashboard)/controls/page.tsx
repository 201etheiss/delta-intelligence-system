'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Shield,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ControlMetric {
  id: number;
  name: string;
  target: string;
  status: 'met' | 'not_met' | 'not_measured' | 'partial';
  currentValue: string;
  module: string;
  description: string;
  lastChecked?: string;
}

interface ControlSummary {
  met: number;
  partial: number;
  notMet: number;
  notMeasured: number;
  total: number;
}

interface ControlsResponse {
  success: boolean;
  data: {
    controls: ControlMetric[];
    summary: ControlSummary;
    complianceScore: number;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusConfig(status: ControlMetric['status']) {
  switch (status) {
    case 'met':
      return { label: 'Met', cls: 'text-green-400 bg-green-900/30 border-green-800/50', icon: CheckCircle2, iconCls: 'text-green-400' };
    case 'partial':
      return { label: 'Partial', cls: 'text-yellow-400 bg-yellow-900/30 border-yellow-800/50', icon: AlertTriangle, iconCls: 'text-yellow-400' };
    case 'not_met':
      return { label: 'Not Met', cls: 'text-red-400 bg-red-900/30 border-red-800/50', icon: XCircle, iconCls: 'text-red-400' };
    case 'not_measured':
      return { label: 'Not Measured', cls: 'text-zinc-500 bg-zinc-800/50 border-zinc-700/50', icon: HelpCircle, iconCls: 'text-zinc-500' };
  }
}

function complianceColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function complianceRingColor(score: number): string {
  if (score >= 80) return '#4ade80';
  if (score >= 50) return '#facc15';
  return '#f87171';
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ControlMetricsDashboard() {
  const [controls, setControls] = useState<ControlMetric[]>([]);
  const [summary, setSummary] = useState<ControlSummary | null>(null);
  const [complianceScore, setComplianceScore] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchControls = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/controls');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json: ControlsResponse = await res.json();
      if (json.success) {
        setControls(json.data.controls);
        setSummary(json.data.summary);
        setComplianceScore(json.data.complianceScore);
      } else {
        setError('Failed to load controls data');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reach controls API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchControls();
  }, [fetchControls]);

  const circumference = 2 * Math.PI * 40;
  const strokeOffset = circumference - (complianceScore / 100) * circumference;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield size={24} className="text-[#FE5000]" />
          <div>
            <h1 className="text-lg font-semibold text-white">Control Metrics Dashboard</h1>
            <p className="text-xs text-zinc-500 mt-0.5">12 controls from the Delta Intelligence action plan</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {/* Compliance Score Circle */}
          <div className="relative w-20 h-20">
            <svg className="w-20 h-20 -rotate-90" viewBox="0 0 100 100">
              <circle cx="50" cy="50" r="40" stroke="#27272A" strokeWidth="6" fill="none" />
              <circle
                cx="50"
                cy="50"
                r="40"
                stroke={complianceRingColor(complianceScore)}
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={strokeOffset}
                className="transition-all duration-700"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-bold ${complianceColor(complianceScore)}`}>
                {complianceScore}%
              </span>
            </div>
          </div>
          <button
            onClick={fetchControls}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg bg-[#18181B] border border-[#27272A] text-zinc-300 hover:border-[#FE5000]/50 hover:text-white transition-colors disabled:opacity-50"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </div>

      <AIInsightsBanner module="controls" compact />

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard label="Met" value={summary.met} color="text-green-400" bgColor="bg-green-900/20" icon={CheckCircle2} />
          <KpiCard label="Partial" value={summary.partial} color="text-yellow-400" bgColor="bg-yellow-900/20" icon={AlertTriangle} />
          <KpiCard label="Not Met" value={summary.notMet} color="text-red-400" bgColor="bg-red-900/20" icon={XCircle} />
          <KpiCard label="Not Measured" value={summary.notMeasured} color="text-zinc-500" bgColor="bg-zinc-800/30" icon={HelpCircle} />
        </div>
      )}

      {/* Progress Bar */}
      {summary && (
        <div className="mb-6 p-4 bg-[#18181B] border border-[#27272A] rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-zinc-400">Overall Compliance</span>
            <span className="text-xs text-zinc-500">
              {summary.met} met + {summary.partial} partial of {summary.total} controls
            </span>
          </div>
          <div className="w-full h-3 bg-[#27272A] rounded-full overflow-hidden flex">
            {summary.met > 0 && (
              <div
                className="h-full bg-green-500 transition-all duration-500"
                style={{ width: `${(summary.met / summary.total) * 100}%` }}
              />
            )}
            {summary.partial > 0 && (
              <div
                className="h-full bg-yellow-500 transition-all duration-500"
                style={{ width: `${(summary.partial / summary.total) * 100}%` }}
              />
            )}
            {summary.notMet > 0 && (
              <div
                className="h-full bg-red-500 transition-all duration-500"
                style={{ width: `${(summary.notMet / summary.total) * 100}%` }}
              />
            )}
            {summary.notMeasured > 0 && (
              <div
                className="h-full bg-zinc-700 transition-all duration-500"
                style={{ width: `${(summary.notMeasured / summary.total) * 100}%` }}
              />
            )}
          </div>
          <div className="flex items-center gap-3 mt-2">
            <Legend color="bg-green-500" label="Met" />
            <Legend color="bg-yellow-500" label="Partial" />
            <Legend color="bg-red-500" label="Not Met" />
            <Legend color="bg-zinc-700" label="Not Measured" />
          </div>
        </div>
      )}

      {/* Controls Table */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#27272A]">
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider w-10">#</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Control</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Target</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hidden lg:table-cell">Current Value</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider">Status</th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-zinc-500 uppercase tracking-wider hidden md:table-cell">Module</th>
              <th className="w-8" />
            </tr>
          </thead>
          <tbody>
            {(controls ?? []).map((control) => {
              const cfg = statusConfig(control.status);
              const StatusIcon = cfg.icon;
              const isExpanded = expandedId === control.id;

              return (
                <ControlRow
                  key={control.id}
                  control={control}
                  cfg={cfg}
                  StatusIcon={StatusIcon}
                  isExpanded={isExpanded}
                  onToggle={() => setExpandedId(isExpanded ? null : control.id)}
                />
              );
            })}
          </tbody>
        </table>

        {loading && controls.length === 0 && (
          <div className="px-4 py-12 text-center text-sm text-zinc-600">Loading controls...</div>
        )}
      </div>
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
  bgColor,
  icon: Icon,
}: {
  label: string;
  value: number;
  color: string;
  bgColor: string;
  icon: typeof CheckCircle2;
}) {
  return (
    <div className={`flex items-center gap-3 p-4 rounded-lg border border-[#27272A] ${bgColor}`}>
      <Icon size={20} className={color} />
      <div>
        <div className={`text-lg font-bold ${color}`}>{value}</div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={`w-2.5 h-2.5 rounded-full ${color}`} />
      <span className="text-[10px] text-zinc-500">{label}</span>
    </div>
  );
}

function ControlRow({
  control,
  cfg,
  StatusIcon,
  isExpanded,
  onToggle,
}: {
  control: ControlMetric;
  cfg: ReturnType<typeof statusConfig>;
  StatusIcon: typeof CheckCircle2;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  return (
    <>
      <tr
        className="border-b border-[#27272A]/50 hover:bg-[#27272A]/30 cursor-pointer transition-colors"
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-xs text-zinc-600 font-mono">{control.id}</td>
        <td className="px-3 py-2 text-sm text-white font-medium">{control.name}</td>
        <td className="px-3 py-2 text-xs text-zinc-400 hidden md:table-cell">{control.target}</td>
        <td className="px-3 py-2 text-xs text-zinc-400 hidden lg:table-cell">{control.currentValue}</td>
        <td className="px-3 py-2">
          <span className={`inline-flex items-center gap-1.5 px-2 py-1 text-[10px] font-medium rounded-full border ${cfg.cls}`}>
            <StatusIcon size={12} />
            {cfg.label}
          </span>
        </td>
        <td className="px-3 py-2 text-xs text-zinc-500 hidden md:table-cell">{control.module}</td>
        <td className="px-4 py-2">
          {isExpanded ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />}
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-[#27272A]/20">
          <td />
          <td colSpan={6} className="px-3 py-2">
            <div className="text-xs text-zinc-400 leading-relaxed">{control.description}</div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[10px] text-zinc-600">Module: {control.module}</span>
              <span className="text-[10px] text-zinc-600">Target: {control.target}</span>
              <span className="text-[10px] text-zinc-600">Current: {control.currentValue}</span>
              {control.lastChecked && (
                <span className="text-[10px] text-zinc-600">
                  Checked: {new Date(control.lastChecked).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
