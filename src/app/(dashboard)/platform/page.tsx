'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Globe,
  ExternalLink,
  ArrowRight,
  Brain,
  BarChart3,
  Truck,
  MapPin,
  Target,
  ShoppingCart,
  Users,
  Plug,
  Puzzle,
  Gauge,
  Activity,
  RefreshCw,
  Database,
  Cloud,
  Car,
  Mail,
  PieChart,
  Briefcase,
  Fuel,
  Server,
  Cpu,
  Layers,
  Route,
  CheckCircle,
  XCircle,
  AlertCircle,
  Zap,
  BarChart,
  type LucideIcon,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface AppCard {
  name: string;
  description: string;
  status: 'Live' | 'Dev' | 'Planned';
  url: string;
  external: boolean;
  metric?: string;
  icon: LucideIcon;
}

interface AppGroup {
  label: string;
  apps: AppCard[];
}

interface ServiceResult {
  name: string;
  status: 'connected' | 'error' | 'unknown';
  latencyMs: number;
  details?: string;
}

interface SystemStatusData {
  overall: 'healthy' | 'degraded' | 'down';
  services: ServiceResult[];
  connectedCount: number;
  totalCount: number;
  engines: string[];
  engineCount: number;
  pageCount: number;
  apiRouteCount: number;
  checkedAt: string;
}

interface SystemStatusResponse {
  success: boolean;
  data?: SystemStatusData;
  error?: string;
}

interface IntegrationService {
  id: string;
  name: string;
  status: 'connected' | 'degraded' | 'disconnected';
  responseTimeMs: number;
  endpointCount: number;
  error?: string;
}

interface IntegrationHealth {
  summary: { total: number; connected: number; degraded: number; disconnected: number; totalEndpoints: number };
  services: IntegrationService[];
}

interface PluginStats {
  total: number;
  active: number;
  categories: number;
}

interface SystemMetrics {
  apiCalls24h: number;
  cacheHitRate: number;
  errors24h: number;
  avgResponseMs: number;
}

// ── Module Map ──────────────────────────────────────────────

interface ModuleMapEntry {
  name: string;
  href: string;
}

interface ModuleCategory {
  label: string;
  color: string;
  modules: ModuleMapEntry[];
}

const MODULE_MAP: ModuleCategory[] = [
  {
    label: 'Intelligence',
    color: '#FF5C00',
    modules: [
      { name: 'Chat', href: '/chat' },
      { name: 'Digest', href: '/digest' },
      { name: 'Executive', href: '/executive' },
      { name: 'Cockpit', href: '/cockpit' },
      { name: 'Brief', href: '/brief' },
      { name: 'Anomalies', href: '/anomalies' },
    ],
  },
  {
    label: 'Accounting',
    color: '#22c55e',
    modules: [
      { name: 'Financial Statements', href: '/financial-statements' },
      { name: 'Journal Entries', href: '/journal-entries' },
      { name: 'Close Management', href: '/close' },
      { name: 'Reconciliations', href: '/reconciliations' },
      { name: 'Cash Flow', href: '/cash-flow' },
      { name: 'General Ledger', href: '/gl' },
      { name: 'Budgets', href: '/budgets' },
      { name: 'Tax', href: '/tax' },
      { name: 'Commentary', href: '/commentary' },
    ],
  },
  {
    label: 'Receivables & Payables',
    color: '#3b82f6',
    modules: [
      { name: 'AR Collections', href: '/ar' },
      { name: 'AR Credit', href: '/ar/credit' },
      { name: 'AP Invoices', href: '/ap' },
      { name: 'AP Aging', href: '/ap/aging' },
      { name: 'AP Vendors', href: '/ap/vendors' },
      { name: 'Contracts', href: '/contracts' },
      { name: 'Expenses', href: '/expenses' },
    ],
  },
  {
    label: 'Assets & Inventory',
    color: '#eab308',
    modules: [
      { name: 'Fixed Assets', href: '/assets' },
      { name: 'Depreciation', href: '/assets/depreciation' },
      { name: 'Inventory', href: '/inventory' },
      { name: 'Margin Analysis', href: '/inventory/margin' },
    ],
  },
  {
    label: 'Operations',
    color: '#8b5cf6',
    modules: [
      { name: 'Fleet Map', href: '/fleet-map' },
      { name: 'Fleet Events', href: '/fleet/events' },
      { name: 'OTC Workflow', href: '/otc' },
      { name: 'Customers', href: '/customers' },
    ],
  },
  {
    label: 'Sales & People',
    color: '#ec4899',
    modules: [
      { name: 'Sales Summary', href: '/sales' },
      { name: 'People', href: '/people' },
      { name: 'HR Summary', href: '/hr' },
      { name: 'Workstreams', href: '/workstreams' },
    ],
  },
  {
    label: 'Compliance & Audit',
    color: '#14b8a6',
    modules: [
      { name: 'Evidence Vault', href: '/vault' },
      { name: 'Audit Portal', href: '/audit' },
      { name: 'Late-Posted Items', href: '/late-posted' },
    ],
  },
  {
    label: 'Platform',
    color: '#71717A',
    modules: [
      { name: 'Reports', href: '/reports' },
      { name: 'Dashboards', href: '/dashboards' },
      { name: 'Automations', href: '/automations' },
      { name: 'Workspaces', href: '/workspaces' },
      { name: 'Workbooks', href: '/workbooks' },
      { name: 'Settings', href: '/settings' },
      { name: 'Integrations', href: '/integrations' },
      { name: 'Admin', href: '/admin' },
      { name: 'Notifications', href: '/notifications' },
      { name: 'API Docs', href: '/api-docs' },
      { name: 'Navigation', href: '/navigation' },
    ],
  },
];

// ── Constants ────────────────────────────────────────────────

const SERVICE_ICONS: Readonly<Record<string, LucideIcon>> = {
  'Ascend ERP': Database,
  'Salesforce CRM': Cloud,
  'Salesforce': Cloud,
  'Samsara Fleet': Car,
  'Samsara': Car,
  'Vroozi Procurement': ShoppingCart,
  'Vroozi': ShoppingCart,
  'Microsoft 365': Mail,
  'Power BI': PieChart,
  'Paylocity HR': Briefcase,
  'Paylocity': Briefcase,
  'Fleet Panda': Fuel,
};

const APP_GROUPS: AppGroup[] = [
  {
    label: 'Intelligence & Analytics',
    apps: [
      {
        name: 'Delta Intelligence',
        description: 'Enterprise AI platform',
        status: 'Live',
        url: '/',
        external: false,
        metric: '78 query patterns',
        icon: Brain,
      },
      {
        name: 'Power BI Dashboards',
        description: 'Executive visualizations',
        status: 'Live',
        url: 'http://localhost:3847/powerbi',
        external: true,
        metric: '12 dashboards',
        icon: BarChart3,
      },
    ],
  },
  {
    label: 'Field Operations',
    apps: [
      {
        name: 'Equipment Tracker',
        description: 'Tank assignments, equipment lifecycle',
        status: 'Live',
        url: 'https://equipment-tracker-tau.vercel.app',
        external: true,
        metric: '142 active tanks',
        icon: Truck,
      },
      {
        name: 'Fleet Map',
        description: 'Vehicle GPS, driver status',
        status: 'Live',
        url: '/fleet-map',
        external: false,
        metric: '157 vehicles',
        icon: MapPin,
      },
    ],
  },
  {
    label: 'Sales & CRM',
    apps: [
      {
        name: 'Sales Scorecard',
        description: 'Pipeline, visits, rep performance',
        status: 'Dev',
        url: 'http://localhost:3005',
        external: true,
        metric: '21 reps tracked',
        icon: Target,
      },
      {
        name: 'Salesforce',
        description: 'CRM, opportunities, contacts',
        status: 'Live',
        url: 'http://localhost:3847/salesforce',
        external: true,
        metric: 'SOQL + CRUD',
        icon: Users,
      },
    ],
  },
  {
    label: 'Assessment & Training',
    apps: [
      {
        name: 'Signal Map (OTED)',
        description: 'Assessment platform, scoring rubrics',
        status: 'Live',
        url: 'https://oted-system.vercel.app/admin',
        external: true,
        metric: '10 rubric dimensions',
        icon: Activity,
      },
    ],
  },
  {
    label: 'Accounting & Finance',
    apps: [
      {
        name: 'Controller Cockpit',
        description: 'Close management, JE workflow',
        status: 'Live',
        url: '/cockpit',
        external: false,
        metric: '5-day close cycle',
        icon: Gauge,
      },
      {
        name: 'Vroozi',
        description: 'Procurement, POs, invoices',
        status: 'Live',
        url: 'http://localhost:3847/vroozi',
        external: true,
        metric: 'PO automation',
        icon: ShoppingCart,
      },
    ],
  },
  {
    label: 'HR & People',
    apps: [
      {
        name: 'Paylocity',
        description: 'Employees, payroll, departments',
        status: 'Live',
        url: 'http://localhost:3847/paylocity',
        external: true,
        metric: 'Payroll + time',
        icon: Users,
      },
    ],
  },
  {
    label: 'Integration Layer',
    apps: [
      {
        name: 'Unified Gateway',
        description: '128 endpoints, 8 services',
        status: 'Live',
        url: 'http://localhost:3847',
        external: true,
        metric: '128 endpoints',
        icon: Plug,
      },
      {
        name: 'Plugin Registry',
        description: '86 plugins, weighted routing',
        status: 'Live',
        url: '/api-docs',
        external: false,
        metric: '86 plugins',
        icon: Puzzle,
      },
    ],
  },
];

// ── Sub-Components ──────────────────────────────────────────

function StatusBadge({ status }: { status: 'Live' | 'Dev' | 'Planned' }) {
  const styles: Record<string, string> = {
    Live: 'bg-green-500/10 text-green-400 border-green-500/20',
    Dev: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20',
    Planned: 'bg-[#27272A] text-[#71717A] border-[#3F3F46]',
  };
  return (
    <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${styles[status]}`}>
      {status}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function OverallBadge({ overall }: { overall: 'healthy' | 'degraded' | 'down' }) {
  const map: Record<string, { label: string; bg: string; text: string; dot: string }> = {
    healthy: { label: 'Healthy', bg: 'bg-green-500/10', text: 'text-green-400', dot: 'bg-green-400' },
    degraded: { label: 'Degraded', bg: 'bg-yellow-500/10', text: 'text-yellow-400', dot: 'bg-yellow-400' },
    down: { label: 'Down', bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-400' },
  };
  const s = map[overall] ?? map.down;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold ${s.bg} ${s.text}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${s.dot} animate-pulse`} />
      {s.label}
    </span>
  );
}

function ServiceStatusIcon({ status }: { status: 'connected' | 'error' | 'unknown' | 'degraded' | 'disconnected' }) {
  if (status === 'connected') return <CheckCircle size={14} className="text-green-400" />;
  if (status === 'error' || status === 'disconnected') return <XCircle size={14} className="text-red-400" />;
  if (status === 'degraded') return <AlertCircle size={14} className="text-yellow-400" />;
  return <AlertCircle size={14} className="text-[#71717A]" />;
}

function OverviewCard({ label, value, sub, icon: Icon }: { label: string; value: string | number; sub?: string; icon: LucideIcon }) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
      <div className="flex items-center gap-2 mb-2">
        <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
          <Icon size={14} className="text-[#FF5C00]" />
        </div>
        <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">{label}</span>
      </div>
      <div className="text-lg font-bold text-white">{value}</div>
      {sub && <div className="text-[11px] text-[#71717A] mt-0.5">{sub}</div>}
    </div>
  );
}

function ServiceCard({ service }: { service: ServiceResult | IntegrationService }) {
  const name = service.name;
  const Icon = SERVICE_ICONS[name] ?? Server;
  const status = 'status' in service ? service.status : 'unknown';
  const latencyMs = 'latencyMs' in service ? service.latencyMs : ('responseTimeMs' in service ? (service as IntegrationService).responseTimeMs : 0);
  const details = 'details' in service ? service.details : ('error' in service ? (service as IntegrationService).error : undefined);
  const endpointCount = 'endpointCount' in service ? (service as IntegrationService).endpointCount : undefined;

  const borderColor =
    status === 'connected'
      ? 'border-green-500/20'
      : status === 'error' || status === 'disconnected'
        ? 'border-red-500/20'
        : status === 'degraded'
          ? 'border-yellow-500/20'
          : 'border-[#27272A]';

  return (
    <div className={`rounded-lg border ${borderColor} bg-[#18181B] p-4`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#27272A] flex items-center justify-center">
            <Icon size={14} className="text-[#A1A1AA]" />
          </div>
          <div>
            <span className="text-xs font-semibold text-white block">{name}</span>
            {typeof endpointCount === 'number' && (
              <span className="text-[10px] text-[#52525B]">{endpointCount} endpoints</span>
            )}
          </div>
        </div>
        <ServiceStatusIcon status={status as 'connected' | 'error' | 'unknown' | 'degraded' | 'disconnected'} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-2 border-t border-[#27272A]">
        <span className="text-[11px] font-mono text-[#71717A]">
          {latencyMs}ms
        </span>
        <span
          className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded ${
            status === 'connected'
              ? 'bg-green-500/10 text-green-400'
              : status === 'error' || status === 'disconnected'
                ? 'bg-red-500/10 text-red-400'
                : status === 'degraded'
                  ? 'bg-yellow-500/10 text-yellow-400'
                  : 'bg-[#27272A] text-[#71717A]'
          }`}
        >
          {status}
        </span>
      </div>
      {details && (
        <div className="mt-1.5 text-[10px] text-red-400/80 font-mono truncate" title={details}>
          {details}
        </div>
      )}
    </div>
  );
}

function EngineList({ engines }: { engines: string[] }) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2 flex items-center gap-2">
        <Cpu size={14} className="text-[#FF5C00]" />
        Accounting Engines ({engines.length}/20)
      </h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
        {engines.map((engine) => (
          <div
            key={engine}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#09090B] border border-[#27272A]"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
            <span className="text-[11px] text-[#A1A1AA] truncate">{engine}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DataFlowDiagram() {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2 flex items-center gap-2">
        <Route size={14} className="text-[#FF5C00]" />
        Data Flow
      </h3>
      <pre className="text-[11px] font-mono text-[#A1A1AA] leading-relaxed overflow-x-auto">
{`Ascend ERP    --+
Salesforce    --+
Samsara       --+-->  [ Gateway :3847 ]  -->  DI Engines  -->  [ API :3004 ]  -->  UI Pages
Vroozi        --+          |                      |
Microsoft 365 --+          |                  Data Bridge
Power BI      --+     Role-based             (5min cache)
Paylocity     --+     API keys
Fleet Panda   --+`}
      </pre>
    </div>
  );
}

function ModuleMapSection({ categories }: { categories: ModuleCategory[] }) {
  const totalModules = categories.reduce((s, c) => s + c.modules.length, 0);
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2.5 flex items-center gap-2">
        <Layers size={14} className="text-[#FF5C00]" />
        Module Map ({totalModules} pages across {categories.length} categories)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        {categories.map((cat) => (
          <div key={cat.label}>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
              <span className="text-[11px] font-semibold text-white uppercase tracking-wider">{cat.label}</span>
              <span className="text-[10px] text-[#52525B]">({cat.modules.length})</span>
            </div>
            <div className="space-y-1">
              {cat.modules.map((mod) => (
                <Link
                  key={mod.href}
                  href={mod.href}
                  className="flex items-center gap-1.5 px-2 py-1 rounded text-[11px] text-[#A1A1AA] hover:text-[#FF5C00] hover:bg-[#27272A]/50 transition-colors"
                >
                  <ArrowRight size={8} className="shrink-0 opacity-50" />
                  {mod.name}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function PlatformPage() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [systemStatus, setSystemStatus] = useState<SystemStatusData | null>(null);
  const [integrationHealth, setIntegrationHealth] = useState<IntegrationHealth | null>(null);
  const [pluginStats, setPluginStats] = useState<PluginStats | null>(null);
  const [systemMetrics, setSystemMetrics] = useState<SystemMetrics | null>(null);

  const fetchStatus = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true);
    try {
      const [statusRes, healthRes, pluginRes, analyticsRes] = await Promise.allSettled([
        fetch('/api/system/status').then(r => r.json()),
        fetch('/api/integrations/health').then(r => r.json()),
        fetch('/api/plugins/stats').then(r => r.json()).catch(() => null),
        fetch('/api/analytics').then(r => r.json()).catch(() => null),
      ]);

      // System status
      if (statusRes.status === 'fulfilled') {
        const json = statusRes.value as SystemStatusResponse;
        if (json.success && json.data) {
          setSystemStatus(json.data);
        }
      }

      // Integration health (more detailed)
      if (healthRes.status === 'fulfilled' && healthRes.value?.success) {
        setIntegrationHealth({
          summary: healthRes.value.summary,
          services: healthRes.value.services ?? [],
        });
      }

      // Plugin stats
      if (pluginRes.status === 'fulfilled' && pluginRes.value?.success) {
        const pd = pluginRes.value.data ?? pluginRes.value;
        setPluginStats({
          total: typeof pd.total === 'number' ? pd.total : 86,
          active: typeof pd.active === 'number' ? pd.active : typeof pd.activeCount === 'number' ? pd.activeCount : 86,
          categories: typeof pd.categories === 'number' ? pd.categories : typeof pd.categoryCount === 'number' ? pd.categoryCount : 10,
        });
      }

      // System metrics
      if (analyticsRes.status === 'fulfilled' && analyticsRes.value?.success) {
        const ad = analyticsRes.value.data ?? analyticsRes.value;
        setSystemMetrics({
          apiCalls24h: typeof ad.apiCalls === 'number' ? ad.apiCalls : typeof ad.totalRequests === 'number' ? ad.totalRequests : 0,
          cacheHitRate: typeof ad.cacheHitRate === 'number' ? ad.cacheHitRate : 0,
          errors24h: typeof ad.errors === 'number' ? ad.errors : typeof ad.errorCount === 'number' ? ad.errorCount : 0,
          avgResponseMs: typeof ad.avgResponseMs === 'number' ? ad.avgResponseMs : typeof ad.averageLatency === 'number' ? ad.averageLatency : 0,
        });
      }
    } catch {
      // Status fetch failed -- leave previous state
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchStatus(false);
    const interval = setInterval(() => fetchStatus(true), 60_000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const totalApps = APP_GROUPS.reduce((s, g) => s + g.apps.length, 0);
  const liveCount = APP_GROUPS.reduce((s, g) => s + g.apps.filter((a) => a.status === 'Live').length, 0);

  if (loading) {
    return (
      <div className="px-5 py-4 space-y-4 h-full bg-[#09090B]">
        <Skeleton className="h-8 w-56" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20" />
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      </div>
    );
  }

  const overall = systemStatus?.overall ?? 'down';
  const services = integrationHealth?.services ?? (systemStatus?.services ?? []);
  const engines = systemStatus?.engines ?? [];
  const connectedCount = integrationHealth?.summary.connected ?? systemStatus?.connectedCount ?? 0;
  const totalCount = integrationHealth?.summary.total ?? systemStatus?.totalCount ?? 8;
  const totalEndpoints = integrationHealth?.summary.totalEndpoints ?? 128;

  return (
    <div className="px-5 py-4 space-y-8 overflow-y-auto h-full bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Globe size={20} className="text-[#FF5C00]" />
            Platform Hub
          </h2>
          <p className="mt-0.5 text-sm text-[#71717A]">
            {totalApps} applications across Delta360
            <span className="mx-1.5 text-[#3F3F46]">|</span>
            <span className="text-green-400">{liveCount} live</span>
            <span className="mx-1.5 text-[#3F3F46]">|</span>
            <span className="text-[#A1A1AA]">{totalEndpoints} gateway endpoints</span>
          </p>
        </div>
        <button
          onClick={() => fetchStatus(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 text-xs text-[#71717A] hover:text-[#FF5C00] transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* System Overview Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
              <Activity size={14} className="text-[#FF5C00]" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">Overall Status</span>
          </div>
          <OverallBadge overall={overall} />
          {systemStatus?.checkedAt && (
            <div className="text-[10px] text-[#52525B] mt-2 font-mono">
              {new Date(systemStatus.checkedAt).toLocaleTimeString()}
            </div>
          )}
        </div>
        <OverviewCard
          label="Services"
          value={`${connectedCount}/${totalCount}`}
          sub="data sources connected"
          icon={Server}
        />
        <OverviewCard
          label="Engines"
          value={systemStatus?.engineCount ?? 18}
          sub="accounting engines active"
          icon={Cpu}
        />
        <OverviewCard
          label="Coverage"
          value={`${systemStatus?.pageCount ?? 48} pages`}
          sub={`${systemStatus?.apiRouteCount ?? 91} API routes`}
          icon={Layers}
        />
      </div>

      {/* System Metrics + Plugin Status */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
              <Zap size={14} className="text-[#FF5C00]" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">API Calls (24h)</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {systemMetrics ? systemMetrics.apiCalls24h.toLocaleString() : '--'}
          </div>
          {systemMetrics && systemMetrics.avgResponseMs > 0 && (
            <div className="text-[11px] text-[#71717A] mt-0.5">avg {systemMetrics.avgResponseMs}ms</div>
          )}
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
              <BarChart size={14} className="text-[#FF5C00]" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">Cache Hit Rate</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {systemMetrics ? `${systemMetrics.cacheHitRate.toFixed(1)}%` : '--'}
          </div>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
              <AlertCircle size={14} className="text-[#FF5C00]" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">Errors (24h)</span>
          </div>
          <div className={`text-lg font-bold tabular-nums ${(systemMetrics?.errors24h ?? 0) > 0 ? 'text-red-400' : 'text-green-400'}`}>
            {systemMetrics ? systemMetrics.errors24h : '--'}
          </div>
        </div>

        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-7 h-7 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
              <Puzzle size={14} className="text-[#FF5C00]" />
            </div>
            <span className="text-[11px] uppercase tracking-wider text-[#71717A] font-medium">Plugins</span>
          </div>
          <div className="text-lg font-bold text-white tabular-nums">
            {pluginStats ? `${pluginStats.active}/${pluginStats.total}` : '86/86'}
          </div>
          <div className="text-[11px] text-[#71717A] mt-0.5">
            {pluginStats ? `${pluginStats.categories} categories` : '10 categories'}
          </div>
        </div>
      </div>

      {/* Service Grid */}
      <div>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2 flex items-center gap-2">
          <Server size={14} className="text-[#FF5C00]" />
          Data Services ({connectedCount}/{totalCount} connected)
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {(services as (ServiceResult | IntegrationService)[]).map((service) => (
            <ServiceCard key={service.name} service={service} />
          ))}
        </div>
      </div>

      {/* Engine List */}
      {engines.length > 0 && <EngineList engines={engines} />}

      {/* Module Map */}
      <ModuleMapSection categories={MODULE_MAP} />

      {/* Data Flow Diagram */}
      <DataFlowDiagram />

      {/* Quick Links to Admin */}
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2">Admin Tools</h3>
        <div className="flex items-center flex-wrap gap-2">
          {[
            { label: 'User Management', href: '/admin/users' },
            { label: 'Permissions', href: '/admin/permissions' },
            { label: 'Usage Analytics', href: '/admin/usage' },
            { label: 'Audit Log', href: '/admin/audit' },
            { label: 'Health Check', href: '/admin/health' },
            { label: 'Integrations', href: '/integrations' },
            { label: 'Settings', href: '/settings' },
            { label: 'Scheduler', href: '/scheduler' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 px-3 py-1.5 text-[11px] text-[#A1A1AA] border border-[#27272A] rounded-lg hover:text-[#FF5C00] hover:border-[#FF5C00]/30 transition-colors"
            >
              {link.label}
              <ArrowRight size={10} />
            </Link>
          ))}
        </div>
      </div>

      {/* Application Groups */}
      {APP_GROUPS.map((group) => (
        <div key={group.label}>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[#71717A] mb-2">{group.label}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {group.apps.map((app) => {
              const Wrapper = app.external ? 'a' : 'div';
              const wrapperProps = app.external
                ? { href: app.url, target: '_blank', rel: 'noopener noreferrer' }
                : {};

              return (
                <Wrapper
                  key={app.name}
                  {...wrapperProps}
                  className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5 hover:border-[#FF5C00]/40 transition-all cursor-pointer group"
                  onClick={
                    !app.external
                      ? () => {
                          window.location.href = app.url;
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-[#FF5C00]/10 flex items-center justify-center">
                        <app.icon size={16} className="text-[#FF5C00]" />
                      </div>
                      <div>
                        <div className="text-xs font-semibold text-white group-hover:text-[#FF5C00] transition-colors">
                          {app.name}
                        </div>
                        <div className="text-[11px] text-[#71717A]">{app.description}</div>
                      </div>
                    </div>
                    <StatusBadge status={app.status} />
                  </div>
                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-[#27272A]">
                    {app.metric && (
                      <span className="text-[11px] font-mono text-[#A1A1AA]">{app.metric}</span>
                    )}
                    {app.external ? (
                      <ExternalLink size={12} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors ml-auto" />
                    ) : (
                      <ArrowRight size={12} className="text-[#52525B] group-hover:text-[#FF5C00] transition-colors ml-auto" />
                    )}
                  </div>
                </Wrapper>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
