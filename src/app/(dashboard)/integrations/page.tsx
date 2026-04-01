'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Plug,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  ArrowRight,
  Database,
  Cloud,
  Truck,
  ShoppingCart,
  FileText,
  BarChart3,
  Users,
  Fuel,
  Calculator,
  Receipt,
  Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

type ConnectionStatus = 'connected' | 'degraded' | 'disconnected' | 'evaluation';

interface ServiceHealth {
  id: string;
  name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  responseTimeMs: number;
  lastChecked: string;
  endpointCount: number;
  error?: string;
}

interface HealthResponse {
  success: boolean;
  summary: {
    total: number;
    connected: number;
    degraded: number;
    disconnected: number;
    totalEndpoints: number;
  };
  services: ServiceHealth[];
  checkedAt: string;
}

interface IntegrationSystem {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly icon: typeof Database;
  readonly description: string;
  readonly dataFlowLabel: string;
}

// ── Data ──────────────────────────────────────────────────────

const SYSTEMS: readonly IntegrationSystem[] = [
  {
    id: 'ascend',
    name: 'Ascend',
    type: 'ERP',
    icon: Database,
    description: 'Core ERP system for GL, AP, AR, inventory, and financial data',
    dataFlowLabel: 'GL, AP, AR, Inventory',
  },
  {
    id: 'salesforce',
    name: 'Salesforce',
    type: 'CRM',
    icon: Cloud,
    description: 'Customer relationship management, accounts, contacts, opportunities',
    dataFlowLabel: 'Accounts, Contacts, Pipeline',
  },
  {
    id: 'samsara',
    name: 'Samsara',
    type: 'Fleet Telematics',
    icon: Truck,
    description: 'Fleet GPS, engine diagnostics, driver safety, fuel consumption',
    dataFlowLabel: 'GPS, Diagnostics, Fuel',
  },
  {
    id: 'vroozi',
    name: 'Vroozi',
    type: 'Procurement',
    icon: ShoppingCart,
    description: 'Purchase orders, requisitions, vendor management, spend analytics',
    dataFlowLabel: 'POs, Requisitions, Spend',
  },
  {
    id: 'ms365',
    name: 'Microsoft 365',
    type: 'Productivity',
    icon: FileText,
    description: 'Email, calendar, documents, Teams, SharePoint, OneDrive',
    dataFlowLabel: 'Docs, Email, Calendar',
  },
  {
    id: 'powerbi',
    name: 'Power BI',
    type: 'Dashboards',
    icon: BarChart3,
    description: 'Business intelligence dashboards, reports, datasets, refresh scheduling',
    dataFlowLabel: 'Reports, Datasets',
  },
  {
    id: 'paylocity',
    name: 'Paylocity',
    type: 'HR / Payroll',
    icon: Users,
    description: 'Payroll, benefits, time tracking, employee records, compliance',
    dataFlowLabel: 'Payroll, Headcount, Benefits',
  },
  {
    id: 'fleetpanda',
    name: 'Fleet Panda',
    type: 'Fleet Management',
    icon: Fuel,
    description: 'Fuel delivery scheduling, BOL tracking, driver dispatch',
    dataFlowLabel: 'BOLs, Dispatch, Delivery',
  },
] as const;

const EVAL_SYSTEMS: readonly IntegrationSystem[] = [
  {
    id: 'netsuite',
    name: 'NetSuite',
    type: 'ERP (Evaluation)',
    icon: Calculator,
    description: 'Potential ERP replacement under evaluation for multi-entity consolidation',
    dataFlowLabel: 'Under Evaluation',
  },
  {
    id: 'avalara',
    name: 'Avalara',
    type: 'Tax Compliance',
    icon: Receipt,
    description: 'Automated sales tax calculation, exemption certificates, filing',
    dataFlowLabel: 'Under Evaluation',
  },
] as const;

// ── Helpers ───────────────────────────────────────────────────

const STATUS_CONFIG: Record<ConnectionStatus, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  connected: { label: 'Connected', color: 'text-emerald-400 bg-emerald-500/15 border-emerald-500/30', icon: CheckCircle2 },
  degraded: { label: 'Degraded', color: 'text-amber-400 bg-amber-500/15 border-amber-500/30', icon: AlertTriangle },
  disconnected: { label: 'Disconnected', color: 'text-red-400 bg-red-500/15 border-red-500/30', icon: XCircle },
  evaluation: { label: 'Evaluation', color: 'text-blue-400 bg-blue-500/15 border-blue-500/30', icon: Clock },
};

function formatResponseTime(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimeSince(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  return `${hours}h ago`;
}

// ── Components ────────────────────────────────────────────────

function StatusBadge({ status }: { status: ConnectionStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide border ${cfg.color}`}
    >
      <Icon size={10} />
      {cfg.label}
    </span>
  );
}

function SystemCard({
  system,
  health,
  onTest,
  testing,
}: {
  system: IntegrationSystem;
  health: ServiceHealth | null;
  onTest: () => void;
  testing: boolean;
}) {
  const Icon = system.icon;
  const status: ConnectionStatus = health?.status ?? 'disconnected';
  const lastSync = health?.lastChecked ? formatTimeSince(health.lastChecked) : '--';
  const endpointCount = health?.endpointCount ?? 0;

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 hover:border-[#3F3F46] transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
            <Icon size={20} className="text-[#FF5C00]" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">{system.name}</div>
            <div className="text-xs text-[#52525B]">{system.type}</div>
          </div>
        </div>
        <StatusBadge status={status} />
      </div>

      <p className="text-xs text-[#71717A] mt-3 line-clamp-2">{system.description}</p>

      <div className="mt-4 flex items-center justify-between text-[11px] text-[#52525B]">
        <div className="flex items-center gap-3">
          {endpointCount > 0 && <span>{endpointCount} endpoints</span>}
          {typeof health?.responseTimeMs === 'number' && (
            <span className={health.responseTimeMs > 3000 ? 'text-amber-400' : 'text-emerald-400'}>
              {formatResponseTime(health.responseTimeMs)}
            </span>
          )}
          <span className="flex items-center gap-1">
            <Clock size={10} />
            {lastSync}
          </span>
        </div>
        <button
          onClick={onTest}
          disabled={testing}
          className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium bg-[#27272A] text-[#A1A1AA] hover:text-white hover:bg-[#3F3F46] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={10} className={testing ? 'animate-spin' : ''} />
          Test
        </button>
      </div>

      {health?.error && (
        <div className="mt-2 text-[10px] text-red-400 truncate">
          {health.error}
        </div>
      )}

      {/* Data flow indicator */}
      <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center gap-2 text-[10px] text-[#52525B]">
        <span>{system.name}</span>
        <ArrowRight size={10} className="text-[#FF5C00]" />
        <span className="text-[#A1A1AA]">Delta Intelligence</span>
        <span className="ml-auto text-[#3F3F46]">{system.dataFlowLabel}</span>
      </div>
    </div>
  );
}

function EvalCard({ system }: { system: IntegrationSystem }) {
  const Icon = system.icon;
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 opacity-70">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
            <Icon size={20} className="text-blue-400" />
          </div>
          <div>
            <div className="text-xs font-semibold text-white">{system.name}</div>
            <div className="text-xs text-[#52525B]">{system.type}</div>
          </div>
        </div>
        <StatusBadge status="evaluation" />
      </div>
      <p className="text-xs text-[#71717A] mt-3 line-clamp-2">{system.description}</p>
      <div className="mt-3 pt-3 border-t border-[#27272A] flex items-center gap-2 text-[10px] text-[#52525B]">
        <span>{system.dataFlowLabel}</span>
      </div>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────

export default function IntegrationsPage() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchHealth = useCallback(async () => {
    try {
      const res = await fetch('/api/integrations/health');
      if (res.ok) {
        const data: HealthResponse = await res.json();
        setHealthData(data);
      }
    } catch {
      // silent — page shows disconnected state
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    // Auto-refresh every 60s
    const interval = setInterval(fetchHealth, 60_000);
    return () => clearInterval(interval);
  }, [fetchHealth]);

  const handleTest = async (systemId: string) => {
    setTestingId(systemId);
    await fetchHealth();
    setTestingId(null);
  };

  const getServiceHealth = (id: string): ServiceHealth | null => {
    return (healthData?.services ?? []).find(s => s.id === id) ?? null;
  };

  const connectedCount = healthData?.summary.connected ?? 0;
  const degradedCount = healthData?.summary.degraded ?? 0;
  const disconnectedCount = healthData?.summary.disconnected ?? 0;
  const totalEndpoints = healthData?.summary.totalEndpoints ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-6xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Plug size={22} className="text-[#FF5C00]" />
              Systems Integration Status
            </h1>
            <p className="text-sm text-[#71717A] mt-0.5">
              {SYSTEMS.length + EVAL_SYSTEMS.length} systems | {connectedCount} connected | {totalEndpoints} total endpoints
            </p>
          </div>
          <button
            onClick={fetchHealth}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-1.5 rounded text-xs font-medium bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white hover:border-[#3F3F46] transition-colors disabled:opacity-50"
          >
            {loading ? (
              <Loader2 size={12} className="animate-spin" />
            ) : (
              <RefreshCw size={12} />
            )}
            Refresh All
          </button>
        </div>

        {/* Summary stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Connected</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{connectedCount}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Degraded</div>
            <div className="text-lg font-bold text-amber-400 mt-0.5">{degradedCount}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Disconnected</div>
            <div className="text-lg font-bold text-red-400 mt-0.5">{disconnectedCount}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Total Endpoints</div>
            <div className="text-lg font-bold text-white mt-0.5">{totalEndpoints}</div>
          </div>
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <div className="text-[11px] text-[#71717A] font-medium uppercase tracking-wide">Evaluating</div>
            <div className="text-lg font-bold text-blue-400 mt-0.5">{EVAL_SYSTEMS.length}</div>
          </div>
        </div>

        {/* Data Flow Overview */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 mb-6">
          <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2.5">
            Data Flow Architecture
          </h2>
          <div className="flex items-center justify-center gap-1 flex-wrap">
            {SYSTEMS.map((s, i) => {
              const Icon = s.icon;
              const svcHealth = getServiceHealth(s.id);
              const statusColor = svcHealth?.status === 'connected'
                ? 'text-emerald-400'
                : svcHealth?.status === 'degraded'
                  ? 'text-amber-400'
                  : 'text-red-400';
              return (
                <div key={s.id} className="flex items-center gap-1">
                  {i > 0 && <span className="text-[#27272A] mx-1">|</span>}
                  <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-[#27272A]">
                    <Icon size={12} className={statusColor} />
                    <span className="text-[11px] text-[#A1A1AA] font-medium">{s.name}</span>
                  </div>
                </div>
              );
            })}
            <ArrowRight size={16} className="text-[#FF5C00] mx-3" />
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-[#FF5C00]/15 border border-[#FF5C00]/30">
              <Database size={12} className="text-[#FF5C00]" />
              <span className="text-[11px] text-[#FF5C00] font-semibold">Delta Intelligence</span>
            </div>
          </div>
        </div>

        {/* Connected Systems */}
        <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
          Gateway Services ({SYSTEMS.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-8">
          {SYSTEMS.map((system) => (
            <SystemCard
              key={system.id}
              system={system}
              health={getServiceHealth(system.id)}
              onTest={() => handleTest(system.id)}
              testing={testingId === system.id}
            />
          ))}
        </div>

        {/* Evaluation Systems */}
        <h2 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
          Under Evaluation ({EVAL_SYSTEMS.length})
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {EVAL_SYSTEMS.map((system) => (
            <EvalCard key={system.id} system={system} />
          ))}
        </div>

        {/* Last checked */}
        {healthData?.checkedAt && (
          <p className="text-[10px] text-[#52525B] mt-6 text-center">
            Last health check: {new Date(healthData.checkedAt).toLocaleString()}
          </p>
        )}
      </div>
    </div>
  );
}
