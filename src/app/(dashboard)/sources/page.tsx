'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Database,
  Cloud,
  Truck,
  ShoppingCart,
  FileText,
  BarChart3,
  Users,
  Fuel,
  RefreshCw,
  Loader2,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Clock,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

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

interface RegistryStatus {
  lastFullCrawl: string | null;
  tableCount: number;
  productCount: number;
  locationCount: number;
  queryLogCount: number;
  learnings: number;
}

interface DataSource {
  id: string;
  name: string;
  icon: typeof Database;
  description: string;
  endpointCount: number;
  keyData: string;
}

// ── Constants ─────────────────────────────────────────────────

const DATA_SOURCES: readonly DataSource[] = [
  { id: 'ascend', name: 'Ascend ERP', icon: Database, description: '5,105 tables — invoicing, AR/AP, GL, equipment, tanks, pricing', endpointCount: 43, keyData: 'GL, Trial Balance, AR/AP Aging, Equipment, Customers, Rack Pricing' },
  { id: 'salesforce', name: 'Salesforce CRM', icon: Cloud, description: 'Accounts, contacts, opportunities, leads, cases', endpointCount: 16, keyData: 'Opportunities, Accounts, Contacts, Pipeline' },
  { id: 'samsara', name: 'Samsara Fleet', icon: Truck, description: '160 vehicles, 237 drivers — live GPS, fuel, engine stats', endpointCount: 13, keyData: 'Vehicles, Drivers, GPS, Fuel, Safety' },
  { id: 'vroozi', name: 'Vroozi Procurement', icon: ShoppingCart, description: 'Purchase orders, requisitions, vendor management, spend analytics', endpointCount: 18, keyData: 'Purchase Orders, Suppliers, Catalogs, Invoices' },
  { id: 'ms365', name: 'Microsoft 365', icon: FileText, description: 'SharePoint sites, OneDrive document search, calendar, users', endpointCount: 11, keyData: 'Users, Calendar, Sites, Documents, Org Chart' },
  { id: 'powerbi', name: 'Power BI', icon: BarChart3, description: 'Workspaces, datasets, reports, DAX queries', endpointCount: 4, keyData: 'Reports, Workspaces, Datasets' },
  { id: 'paylocity', name: 'Paylocity', icon: Users, description: 'Payroll, benefits, time tracking, employee records, compliance', endpointCount: 11, keyData: 'Employees, Time Off, Payroll, Benefits' },
  { id: 'fleetpanda', name: 'Fleet Panda', icon: Fuel, description: 'Truck and tank asset management, BOL tracking, driver dispatch', endpointCount: 14, keyData: 'Assets, BOLs, Dispatch, Deliveries' },
] as const;

// ── Helpers ───────────────────────────────────────────────────

function formatTimeSince(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime();
  if (diff < 60_000) return 'Just now';
  const mins = Math.floor(diff / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function statusIcon(status: string) {
  switch (status) {
    case 'connected':
      return <CheckCircle2 size={14} className="text-emerald-400" />;
    case 'degraded':
      return <AlertTriangle size={14} className="text-amber-400" />;
    default:
      return <XCircle size={14} className="text-red-400" />;
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'connected': return '#22C55E';
    case 'degraded': return '#F59E0B';
    default: return '#EF4444';
  }
}

// ── Page ──────────────────────────────────────────────────────

export default function SourcesPage() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null);
  const [registry, setRegistry] = useState<RegistryStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [crawling, setCrawling] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const [healthRes, registryRes] = await Promise.all([
        fetch('/api/integrations/health').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/registry/crawl').then(r => r.ok ? r.json() : null).catch(() => null),
      ]);
      if (healthRes) setHealthData(healthRes as HealthResponse);
      if (registryRes) setRegistry(registryRes as RegistryStatus);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  async function runCrawl() {
    setCrawling(true);
    try {
      await fetch('/api/registry/crawl', { method: 'POST' });
      await fetchData();
    } finally {
      setCrawling(false);
    }
  }

  const getServiceHealth = (id: string): ServiceHealth | null => {
    return (healthData?.services ?? []).find(s => s.id === id) ?? null;
  };

  const connectedCount = healthData?.summary.connected ?? 0;
  const totalEndpoints = healthData?.summary.totalEndpoints ?? 0;

  return (
    <div className="px-5 py-4 overflow-y-auto h-full bg-[#09090B]">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-bold text-white">Data Sources</h2>
            <p className="mt-0.5 text-sm text-[#A1A1AA]">
              {DATA_SOURCES.length} services | {connectedCount} connected | {totalEndpoints} endpoints
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-[#18181B] text-[#A1A1AA] border border-[#27272A] hover:text-white hover:border-[#3F3F46] transition-colors disabled:opacity-50"
            >
              {loading ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RefreshCw size={12} />
              )}
            </button>
            <button
              onClick={runCrawl}
              disabled={crawling}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-[#FF5C00] text-white hover:bg-[#E54800] disabled:opacity-50 transition-colors"
            >
              {crawling ? 'Crawling...' : 'Re-index All'}
            </button>
          </div>
        </div>

        {/* Registry stats */}
        {registry && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            {[
              { label: 'Tables', value: registry.tableCount },
              { label: 'Products', value: registry.productCount },
              { label: 'Locations', value: registry.locationCount },
              { label: 'Query Log', value: registry.queryLogCount },
              { label: 'Learnings', value: registry.learnings },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
                <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">{label}</p>
                <p className="text-lg font-bold text-white mt-0.5 font-mono">
                  {typeof value === 'number' ? value.toLocaleString() : '0'}
                </p>
              </div>
            ))}
          </div>
        )}

        {/* Source list */}
        <div className="space-y-2">
          {DATA_SOURCES.map((source) => {
            const health = getServiceHealth(source.id);
            const status = health?.status ?? 'disconnected';

            return (
              <div
                key={source.id}
                className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#18181B] p-4 hover:border-[#FF5C00]/30 transition-all"
              >
                {/* Status dot */}
                <div
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: statusColor(status) }}
                />

                {/* Icon */}
                <div className="w-9 h-9 rounded-lg bg-[#27272A] flex items-center justify-center shrink-0">
                  <source.icon size={16} className="text-[#FF5C00]" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-semibold text-white">{source.name}</p>
                    {statusIcon(status)}
                  </div>
                  <p className="text-xs text-[#A1A1AA] truncate">{source.description}</p>
                </div>

                {/* Metrics */}
                <div className="hidden md:flex items-center gap-3 shrink-0 text-[11px] text-[#71717A]">
                  <div className="text-center">
                    <div className="text-[9px] uppercase tracking-wide text-[#52525B]">Endpoints</div>
                    <div className="font-mono font-semibold text-white">{source.endpointCount}</div>
                  </div>
                  {typeof health?.responseTimeMs === 'number' && (
                    <div className="text-center">
                      <div className="text-[9px] uppercase tracking-wide text-[#52525B]">Latency</div>
                      <div className={`font-mono font-semibold ${health.responseTimeMs > 3000 ? 'text-amber-400' : 'text-emerald-400'}`}>
                        {health.responseTimeMs < 1000 ? `${health.responseTimeMs}ms` : `${(health.responseTimeMs / 1000).toFixed(1)}s`}
                      </div>
                    </div>
                  )}
                  <div className="text-center">
                    <div className="text-[9px] uppercase tracking-wide text-[#52525B]">Freshness</div>
                    <div className="font-mono text-[#A1A1AA] flex items-center gap-1">
                      <Clock size={10} />
                      {health?.lastChecked ? formatTimeSince(health.lastChecked) : '--'}
                    </div>
                  </div>
                </div>

                {/* Status label */}
                <span className="text-[10px] font-semibold uppercase tracking-wide shrink-0"
                  style={{ color: statusColor(status) }}
                >
                  {status}
                </span>
              </div>
            );
          })}
        </div>

        {/* Footer timestamps */}
        <div className="flex items-center justify-between mt-4 text-[10px] text-[#52525B]">
          {registry?.lastFullCrawl && (
            <span>Last schema crawl: {new Date(registry.lastFullCrawl).toLocaleString()}</span>
          )}
          {healthData?.checkedAt && (
            <span>Last health check: {new Date(healthData.checkedAt).toLocaleString()}</span>
          )}
        </div>
      </div>
    </div>
  );
}
