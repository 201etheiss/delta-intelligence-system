'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Wallet,
  CreditCard,
  BarChart3,
  RefreshCw,
  ArrowRight,
  FileSpreadsheet,
  Landmark,
  Gauge,
  BookOpen,
  GitCompare,
  FileBarChart,
  Download,
  Users,
  Truck,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// Lazy-load recharts — heavy bundle, only needed after KPI cards render
const BarChart = dynamic(() => import('recharts').then(m => ({ default: m.BarChart })), { ssr: false });
const Bar = dynamic(() => import('recharts').then(m => ({ default: m.Bar })), { ssr: false });
const LineChart = dynamic(() => import('recharts').then(m => ({ default: m.LineChart })), { ssr: false });
const Line = dynamic(() => import('recharts').then(m => ({ default: m.Line })), { ssr: false });
const XAxis = dynamic(() => import('recharts').then(m => ({ default: m.XAxis })), { ssr: false });
const YAxis = dynamic(() => import('recharts').then(m => ({ default: m.YAxis })), { ssr: false });
const CartesianGrid = dynamic(() => import('recharts').then(m => ({ default: m.CartesianGrid })), { ssr: false });
const Tooltip = dynamic(() => import('recharts').then(m => ({ default: m.Tooltip })), { ssr: false });
const ResponsiveContainer = dynamic(() => import('recharts').then(m => ({ default: m.ResponsiveContainer })), { ssr: false });

// ── Types ─────────────────────────────────────────────────────

interface KPIs {
  revenueYTD: number;
  cogsYTD: number;
  gpYTD: number;
  gpMarginPct: number;
  cashBalance: number;
  locAvailable: number;
  locBalance: number;
  rackPrice: number;
  rackProduct: string;
  arTotal: number;
  arPastDue: number;
  arCurrent: number;
  dso: number;
}

interface FlashData {
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  operatingIncome: number;
  ebitda: number;
  netIncome: number;
  cashPosition: number;
  priorYear: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingExpenses: number;
    operatingIncome: number;
    ebitda: number;
    netIncome: number;
    cashPosition: number;
  } | null;
}

interface MonthlyRecord {
  month: number;
  revenue: number;
  cogs: number;
}

interface AgingCustomer {
  customerName: string;
  current: number;
  past30: number;
  past60: number;
  past90: number;
  past90Plus: number;
  total: number;
}

interface SnapshotData {
  period: string;
  kpis: KPIs;
  flash: FlashData | null;
  trends: { monthlyRevenue: MonthlyRecord[] };
  arAging: {
    topCustomers: AgingCustomer[];
    summary: { total: number; pastDue: number; current: number };
  };
  dataFreshness: string;
}

interface TopEntity {
  name: string;
  value: number;
}

interface HRSummary {
  headcount: number;
  departments: number;
  newHiresYTD: number;
}

// ── Formatters ───────────────────────────────────────────────

function fmt(n: unknown): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
}

function fmtPct(n: unknown): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
}

function monthLabel(period: number): string {
  const labels = ['', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return labels[period] ?? `P${period}`;
}

function changeColor(current: number, prior: number, favorable: 'up' | 'down'): string {
  if (typeof current !== 'number' || typeof prior !== 'number') return 'text-zinc-400';
  const diff = current - prior;
  if (diff === 0) return 'text-zinc-400';
  const isGood = favorable === 'up' ? diff > 0 : diff < 0;
  return isGood ? 'text-green-400' : 'text-red-400';
}

function changePct(current: number, prior: number): string {
  if (typeof prior !== 'number' || prior === 0) return '--';
  if (typeof current !== 'number') return '--';
  const pct = ((current - prior) / Math.abs(prior)) * 100;
  const sign = pct > 0 ? '+' : '';
  return `${sign}${pct.toFixed(1)}%`;
}

function changeDollar(current: number, prior: number): string {
  if (typeof current !== 'number' || typeof prior !== 'number') return '--';
  return fmt(current - prior);
}

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 animate-pulse">
      <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
      <div className="h-7 w-28 bg-zinc-800 rounded mb-2" />
      <div className="h-2.5 w-16 bg-zinc-800 rounded" />
    </div>
  );
}

function SkeletonChart() {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 animate-pulse h-72">
      <div className="h-3 w-32 bg-zinc-800 rounded mb-2.5" />
      <div className="h-48 bg-zinc-800/50 rounded" />
    </div>
  );
}

function SkeletonTable() {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 animate-pulse">
      <div className="h-3 w-40 bg-zinc-800 rounded mb-2.5" />
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="h-6 bg-zinc-800/40 rounded mb-2" />
      ))}
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────

function KPICard({
  label,
  value,
  subtext,
  icon: Icon,
  accent,
  yoyChange,
}: {
  label: string;
  value: string;
  subtext?: string;
  icon: typeof DollarSign;
  accent?: boolean;
  yoyChange?: string;
}) {
  const isPositive = yoyChange?.startsWith('+');
  const isNegative = yoyChange?.startsWith('-');
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">{label}</span>
        <Icon size={14} className={accent ? 'text-[#FE5000]' : 'text-zinc-600'} />
      </div>
      <span className={`text-lg font-bold tabular-nums ${accent ? 'text-[#FE5000]' : 'text-white'}`}>
        {value}
      </span>
      <div className="flex items-center gap-2">
        {subtext && <span className="text-[11px] text-zinc-500">{subtext}</span>}
        {yoyChange && yoyChange !== '--' && (
          <span className={`text-[11px] font-medium tabular-nums flex items-center gap-0.5 ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-zinc-500'}`}>
            {isPositive && <ArrowUpRight size={10} />}
            {isNegative && <ArrowDownRight size={10} />}
            {yoyChange} YoY
          </span>
        )}
      </div>
    </div>
  );
}

// ── Custom Tooltip ───────────────────────────────────────────

function ChartTooltip({ active, payload, label }: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; color: string }>;
  label?: string | number;
}) {
  if (!active || !(payload ?? []).length) return null;
  return (
    <div className="bg-[#27272A] border border-[#3F3F46] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-zinc-400 mb-1">{typeof label === 'number' ? monthLabel(label) : label}</p>
      {(payload ?? []).map((p) => (
        <p key={p.name} className="text-xs font-medium" style={{ color: p.color }}>
          {p.name}: {fmt(p.value)}
        </p>
      ))}
    </div>
  );
}

// ── Top 5 List Component ─────────────────────────────────────

function Top5List({ title, items, icon: Icon, valuePrefix }: {
  title: string;
  items: TopEntity[];
  icon: typeof DollarSign;
  valuePrefix?: string;
}) {
  const maxVal = Math.max(...items.map(i => i.value), 1);
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
      <h3 className="text-xs font-semibold text-white mb-2.5 flex items-center gap-2">
        <Icon size={14} className="text-[#FE5000]" />
        {title}
      </h3>
      <div className="space-y-3">
        {items.map((item, i) => (
          <div key={item.name} className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-400 truncate max-w-[60%]">
                <span className="text-[10px] text-zinc-600 mr-1.5">{i + 1}.</span>
                {item.name}
              </span>
              <span className="text-xs font-medium text-white tabular-nums">
                {valuePrefix ?? ''}{fmt(item.value)}
              </span>
            </div>
            <div className="w-full h-1 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FE5000]/60 transition-all"
                style={{ width: `${(item.value / maxVal) * 100}%` }}
              />
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="text-xs text-zinc-600">No data available</p>
        )}
      </div>
    </div>
  );
}

// ── Main Page ────────────────────────────────────────────────

export default function ExecutiveSnapshotPage() {
  const [data, setData] = useState<SnapshotData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [topCustomers, setTopCustomers] = useState<TopEntity[]>([]);
  const [topVendors, setTopVendors] = useState<TopEntity[]>([]);
  const [hrSummary, setHrSummary] = useState<HRSummary | null>(null);
  const [fleetUtilization, setFleetUtilization] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  const fetchSnapshot = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [snapshotRes, salesRes, apRes, hrRes, fleetRes] = await Promise.allSettled([
        fetch('/api/executive/snapshot').then(r => r.json()),
        fetch('/api/sales/summary').then(r => r.json()).catch(() => null),
        fetch('/api/ap/vendors').then(r => r.json()).catch(() => null),
        fetch('/api/hr/summary').then(r => r.json()).catch(() => null),
        fetch('/api/gateway/samsara/vehicles').then(r => r.json()).catch(() => null),
      ]);

      // Main snapshot
      if (snapshotRes.status === 'fulfilled' && snapshotRes.value?.success) {
        setData(snapshotRes.value.data);
      } else {
        throw new Error(
          snapshotRes.status === 'fulfilled'
            ? (snapshotRes.value?.error ?? 'Failed to load')
            : 'Network error'
        );
      }

      // Top customers by revenue
      if (salesRes.status === 'fulfilled' && salesRes.value?.success) {
        const customers = salesRes.value.data?.topCustomers ?? salesRes.value.topCustomers ?? [];
        setTopCustomers(
          (Array.isArray(customers) ? customers : []).slice(0, 5).map((c: Record<string, unknown>) => ({
            name: String(c.name ?? c.CustomerName ?? 'Unknown'),
            value: typeof c.revenue === 'number' ? c.revenue : typeof c.amount === 'number' ? c.amount : 0,
          }))
        );
      }

      // Top vendors by spend
      if (apRes.status === 'fulfilled' && apRes.value?.success) {
        const vendors = apRes.value.data?.topVendors ?? apRes.value.vendors ?? [];
        setTopVendors(
          (Array.isArray(vendors) ? vendors : []).slice(0, 5).map((v: Record<string, unknown>) => ({
            name: String(v.name ?? v.VendorName ?? 'Unknown'),
            value: typeof v.spend === 'number' ? v.spend : typeof v.amount === 'number' ? v.amount : 0,
          }))
        );
      }

      // HR summary
      if (hrRes.status === 'fulfilled' && hrRes.value?.success) {
        const hr = hrRes.value.data ?? hrRes.value;
        setHrSummary({
          headcount: typeof hr.headcount === 'number' ? hr.headcount : typeof hr.employeeCount === 'number' ? hr.employeeCount : 0,
          departments: typeof hr.departments === 'number' ? hr.departments : typeof hr.departmentCount === 'number' ? hr.departmentCount : 0,
          newHiresYTD: typeof hr.newHiresYTD === 'number' ? hr.newHiresYTD : 0,
        });
      }

      // Fleet utilization
      if (fleetRes.status === 'fulfilled' && fleetRes.value) {
        const vehicles = fleetRes.value.data ?? fleetRes.value.vehicles ?? [];
        const vehicleList = Array.isArray(vehicles) ? vehicles : [];
        const active = vehicleList.filter((v: Record<string, unknown>) =>
          v.engineState === 'on' || v.status === 'active'
        ).length;
        setFleetUtilization(vehicleList.length > 0 ? (active / vehicleList.length) * 100 : 0);
      }

      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load executive snapshot');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSnapshot();
    const interval = setInterval(fetchSnapshot, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchSnapshot]);

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await fetch('/api/reports/export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'executive-snapshot', format: 'pdf' }),
      });
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `executive-snapshot-${new Date().toISOString().split('T')[0]}.pdf`;
        a.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      // Export not configured
    } finally {
      setExporting(false);
    }
  };

  // Chart data
  const chartData = (data?.trends.monthlyRevenue ?? []).map((r) => ({
    month: r.month,
    label: monthLabel(r.month),
    revenue: r.revenue,
    cogs: r.cogs,
    gp: r.revenue - r.cogs,
    gpMargin: r.revenue > 0 ? ((r.revenue - r.cogs) / r.revenue) * 100 : 0,
  }));

  const kpis = data?.kpis;
  const flash = data?.flash;

  // Income statement rows for the comparison table
  const incomeRows = flash
    ? [
        { label: 'Revenue', current: flash.revenue, prior: flash.priorYear?.revenue, favorable: 'up' as const },
        { label: 'Cost of Goods Sold', current: flash.cogs, prior: flash.priorYear?.cogs, favorable: 'down' as const },
        { label: 'Gross Profit', current: flash.grossProfit, prior: flash.priorYear?.grossProfit, favorable: 'up' as const },
        { label: 'Operating Expenses', current: flash.operatingExpenses, prior: flash.priorYear?.operatingExpenses, favorable: 'down' as const },
        { label: 'Operating Income', current: flash.operatingIncome, prior: flash.priorYear?.operatingIncome, favorable: 'up' as const },
        { label: 'EBITDA', current: flash.ebitda, prior: flash.priorYear?.ebitda, favorable: 'up' as const },
        { label: 'Net Income', current: flash.netIncome, prior: flash.priorYear?.netIncome, favorable: 'up' as const },
      ]
    : [];

  // AR aging buckets for bar
  const agingSummary = data?.arAging.summary;
  const agingBuckets = agingSummary
    ? [
        { label: 'Current', value: agingSummary.current, color: '#22c55e' },
        {
          label: '30+',
          value: (data?.arAging.topCustomers ?? []).reduce((s, c) => s + c.past30, 0),
          color: '#eab308',
        },
        {
          label: '60+',
          value: (data?.arAging.topCustomers ?? []).reduce((s, c) => s + c.past60, 0),
          color: '#f97316',
        },
        {
          label: '90+',
          value: (data?.arAging.topCustomers ?? []).reduce((s, c) => s + c.past90, 0),
          color: '#ef4444',
        },
        {
          label: '90++',
          value: (data?.arAging.topCustomers ?? []).reduce((s, c) => s + c.past90Plus, 0),
          color: '#dc2626',
        },
      ]
    : [];

  const pastDueTotal = agingBuckets.slice(1).reduce((s, b) => s + b.value, 0);

  const locTotal = 15_000_000;
  const locDrawn = typeof kpis?.locBalance === 'number' ? kpis.locBalance : 0;
  const locUtilPct = locTotal > 0 ? (locDrawn / locTotal) * 100 : 0;

  // Quick actions
  const quickActions = [
    { label: 'Financial Statements', href: '/financial-statements', icon: FileSpreadsheet },
    { label: 'Cash Flow', href: '/cash-flow', icon: Landmark },
    { label: 'Cockpit', href: '/cockpit', icon: Gauge },
    { label: 'Journal Entries', href: '/journal-entries', icon: BookOpen },
    { label: 'Reconciliations', href: '/reconciliations', icon: GitCompare },
    { label: 'Reports', href: '/reports', icon: FileBarChart },
  ];

  if (error && !data) {
    return (
      <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg px-5 py-4 text-center">
            <p className="text-red-400 text-sm">{error}</p>
            <button
              onClick={fetchSnapshot}
              className="mt-3 text-xs text-[#FE5000] hover:underline"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Executive Snapshot</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              {data ? `Period: ${data.period}` : 'Loading...'}
              {lastRefresh && (
                <span className="ml-3">
                  Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExport}
              disabled={exporting || loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/50 transition-colors disabled:opacity-50"
            >
              <Download size={12} className={exporting ? 'animate-bounce' : ''} />
              Export PDF
            </button>
            <button
              onClick={fetchSnapshot}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-white hover:border-[#FE5000]/50 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        <AIInsightsBanner module="executive" compact />

        {/* Row 1 -- KPI Cards */}
        {loading && !data ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : kpis ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
            <KPICard
              label="Revenue YTD"
              value={fmt(kpis.revenueYTD)}
              subtext={flash?.priorYear ? `PY: ${fmt(flash.priorYear.revenue)}` : undefined}
              icon={TrendingUp}
              accent
              yoyChange={flash?.priorYear ? changePct(kpis.revenueYTD, flash.priorYear.revenue) : undefined}
            />
            <KPICard
              label="Gross Profit YTD"
              value={fmt(kpis.gpYTD)}
              subtext={flash?.priorYear ? `PY: ${fmt(flash.priorYear.grossProfit)}` : undefined}
              icon={DollarSign}
              yoyChange={flash?.priorYear ? changePct(kpis.gpYTD, flash.priorYear.grossProfit) : undefined}
            />
            <KPICard
              label="GP Margin"
              value={fmtPct(kpis.gpMarginPct)}
              subtext={flash?.priorYear ? `PY: ${fmtPct(flash.priorYear.grossMarginPct)}` : undefined}
              icon={BarChart3}
            />
            <KPICard
              label="Cash Position"
              value={fmt(kpis.cashBalance)}
              icon={Wallet}
            />
            <KPICard
              label="LOC Available"
              value={fmt(kpis.locAvailable)}
              subtext={`Drawn: ${fmt(kpis.locBalance)}`}
              icon={CreditCard}
            />
            <KPICard
              label="AR Outstanding"
              value={fmt(kpis.arTotal)}
              subtext={`DSO: ${typeof kpis.dso === 'number' ? kpis.dso.toFixed(1) : '0'} days`}
              icon={TrendingDown}
            />
          </div>
        ) : null}

        {/* Row 1.5 -- Secondary KPIs: Headcount, Fleet, AP */}
        {!loading && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Headcount</span>
                <Users size={14} className="text-zinc-600" />
              </div>
              <span className="text-lg font-bold text-white tabular-nums">
                {hrSummary?.headcount ?? '--'}
              </span>
              <span className="text-[11px] text-zinc-500">
                {hrSummary ? `${hrSummary.departments} depts, ${hrSummary.newHiresYTD} new YTD` : 'HR data unavailable'}
              </span>
            </div>

            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">Fleet Utilization</span>
                <Truck size={14} className="text-zinc-600" />
              </div>
              <span className="text-lg font-bold text-white tabular-nums">
                {fleetUtilization !== null ? fmtPct(fleetUtilization) : '--'}
              </span>
              <div className="w-full h-1.5 bg-[#27272A] rounded-full overflow-hidden mt-0.5">
                <div
                  className="h-full rounded-full bg-green-500 transition-all"
                  style={{ width: `${fleetUtilization ?? 0}%` }}
                />
              </div>
            </div>

            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">AR Past Due</span>
                <TrendingDown size={14} className={pastDueTotal > 0 ? 'text-red-500' : 'text-zinc-600'} />
              </div>
              <span className={`text-lg font-bold tabular-nums ${pastDueTotal > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {fmt(pastDueTotal)}
              </span>
              <span className="text-[11px] text-zinc-500">
                {agingSummary ? `of ${fmt(agingSummary.total)} total` : ''}
              </span>
            </div>

            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4 flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-medium text-zinc-500 uppercase tracking-wider">COGS YTD</span>
                <BarChart3 size={14} className="text-zinc-600" />
              </div>
              <span className="text-lg font-bold text-white tabular-nums">
                {fmt(kpis?.cogsYTD)}
              </span>
              {flash?.priorYear && (
                <span className="text-[11px] text-zinc-500">PY: {fmt(flash.priorYear.cogs)}</span>
              )}
            </div>
          </div>
        )}

        {/* Row 2 -- Charts */}
        {loading && !data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SkeletonChart />
            <SkeletonChart />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Revenue & COGS Bar Chart */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
              <h3 className="text-xs font-semibold text-white mb-2.5">Revenue & COGS by Month</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#71717A', fontSize: 11 }}
                      axisLine={{ stroke: '#27272A' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717A', fontSize: 11 }}
                      axisLine={{ stroke: '#27272A' }}
                      tickLine={false}
                      tickFormatter={(v: number) => fmt(v)}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Bar dataKey="revenue" name="Revenue" fill="#FE5000" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="cogs" name="COGS" fill="#52525B" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* GP Margin Trend Line Chart */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
              <h3 className="text-xs font-semibold text-white mb-2.5">GP Margin Trend</h3>
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
                    <XAxis
                      dataKey="label"
                      tick={{ fill: '#71717A', fontSize: 11 }}
                      axisLine={{ stroke: '#27272A' }}
                      tickLine={false}
                    />
                    <YAxis
                      tick={{ fill: '#71717A', fontSize: 11 }}
                      axisLine={{ stroke: '#27272A' }}
                      tickLine={false}
                      tickFormatter={(v: number) => `${typeof v === 'number' ? v.toFixed(0) : 0}%`}
                      domain={[0, 'auto']}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Line
                      type="monotone"
                      dataKey="gpMargin"
                      name="GP Margin %"
                      stroke="#FE5000"
                      strokeWidth={2}
                      dot={{ r: 3, fill: '#FE5000' }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Row 3 -- Financial Summary Table (mini income statement) */}
        {loading && !data ? (
          <SkeletonTable />
        ) : flash ? (
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
            <h3 className="text-xs font-semibold text-white mb-2.5">Financial Summary (YoY Comparison)</h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#27272A]">
                    <th className="text-left py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Line Item</th>
                    <th className="text-right py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Current YTD</th>
                    {flash.priorYear && (
                      <>
                        <th className="text-right py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">Prior Year YTD</th>
                        <th className="text-right py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">$ Change</th>
                        <th className="text-right py-2 text-[11px] text-zinc-500 font-medium uppercase tracking-wider">% Change</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {incomeRows.map((row) => {
                    const isBold = ['Gross Profit', 'Operating Income', 'EBITDA', 'Net Income'].includes(row.label);
                    const prior = typeof row.prior === 'number' ? row.prior : 0;
                    const colorClass = flash.priorYear && typeof row.prior === 'number'
                      ? changeColor(row.current, prior, row.favorable)
                      : 'text-zinc-400';
                    return (
                      <tr
                        key={row.label}
                        className={`border-b border-[#27272A]/50 ${isBold ? 'bg-[#27272A]/20' : ''}`}
                      >
                        <td className={`py-2 ${isBold ? 'font-semibold text-white' : 'text-zinc-300'}`}>
                          {row.label}
                        </td>
                        <td className="py-2 text-right tabular-nums text-white font-medium">
                          {fmt(row.current)}
                        </td>
                        {flash.priorYear && (
                          <>
                            <td className="py-2 text-right tabular-nums text-zinc-400">
                              {typeof row.prior === 'number' ? fmt(row.prior) : '--'}
                            </td>
                            <td className={`py-2 text-right tabular-nums ${colorClass}`}>
                              {typeof row.prior === 'number' ? changeDollar(row.current, prior) : '--'}
                            </td>
                            <td className={`py-2 text-right tabular-nums ${colorClass}`}>
                              {typeof row.prior === 'number' ? changePct(row.current, prior) : '--'}
                            </td>
                          </>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}

        {/* Row 4 -- Cash & Liquidity + AR Aging */}
        {loading && !data ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <SkeletonTable />
            <SkeletonTable />
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {/* Cash & Liquidity */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
              <h3 className="text-xs font-semibold text-white mb-2.5">Cash & Liquidity</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Bank Balance</span>
                  <span className="text-xs font-semibold text-white tabular-nums">{fmt(kpis?.cashBalance)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">LOC Drawn</span>
                  <span className="text-sm font-medium text-zinc-300 tabular-nums">{fmt(locDrawn)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">LOC Available</span>
                  <span className="text-xs font-semibold text-green-400 tabular-nums">{fmt(kpis?.locAvailable)}</span>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-zinc-600">LOC Utilization</span>
                    <span className="text-[10px] text-zinc-500 tabular-nums">{fmtPct(locUtilPct)}</span>
                  </div>
                  <div className="w-full h-2 bg-[#27272A] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        width: `${Math.min(locUtilPct, 100)}%`,
                        backgroundColor: locUtilPct > 75 ? '#ef4444' : locUtilPct > 50 ? '#eab308' : '#22c55e',
                      }}
                    />
                  </div>
                </div>
                {kpis && typeof kpis.rackPrice === 'number' && kpis.rackPrice > 0 && (
                  <div className="flex items-center justify-between pt-2 border-t border-[#27272A]">
                    <span className="text-xs text-zinc-500">Rack Price ({kpis.rackProduct})</span>
                    <span className="text-sm font-medium text-[#FE5000] tabular-nums">
                      ${typeof kpis.rackPrice === 'number' ? kpis.rackPrice.toFixed(4) : '0.0000'}/gal
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* AR Aging Summary */}
            <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
              <h3 className="text-xs font-semibold text-white mb-2.5">AR Aging Summary</h3>
              {/* Aging buckets bar */}
              <div className="space-y-2 mb-2.5">
                {agingBuckets.map((bucket) => {
                  const maxVal = Math.max(...agingBuckets.map((b) => b.value), 1);
                  const widthPct = (bucket.value / maxVal) * 100;
                  return (
                    <div key={bucket.label} className="flex items-center gap-3">
                      <span className="text-[11px] text-zinc-500 w-10 text-right">{bucket.label}</span>
                      <div className="flex-1 h-4 bg-[#27272A] rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${widthPct}%`,
                            backgroundColor: bucket.color,
                            minWidth: bucket.value > 0 ? '4px' : '0px',
                          }}
                        />
                      </div>
                      <span className="text-[11px] text-zinc-400 tabular-nums w-16 text-right">{fmt(bucket.value)}</span>
                    </div>
                  );
                })}
              </div>
              {/* Top 5 customers */}
              <div className="border-t border-[#27272A] pt-3">
                <p className="text-[10px] text-zinc-600 uppercase tracking-wider mb-2">Top 5 by Balance</p>
                <div className="space-y-1.5">
                  {(data?.arAging.topCustomers ?? []).slice(0, 5).map((c) => (
                    <div key={c.customerName} className="flex items-center justify-between">
                      <span className="text-xs text-zinc-400 truncate max-w-[60%]">{c.customerName}</span>
                      <span className="text-xs font-medium text-white tabular-nums">{fmt(c.total)}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Row 5 -- Top 5 Customers & Top 5 Vendors */}
        {!loading && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <Top5List
              title="Top 5 Customers by Revenue"
              items={topCustomers}
              icon={TrendingUp}
            />
            <Top5List
              title="Top 5 Vendors by Spend"
              items={topVendors}
              icon={DollarSign}
            />
          </div>
        )}

        {/* Row 6 -- Quick Actions */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <div className="flex items-center flex-wrap gap-3">
            {quickActions.map((action) => (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FE5000] hover:border-[#FE5000]/30 transition-colors"
              >
                <action.icon size={14} />
                {action.label}
                <ArrowRight size={10} className="ml-1" />
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
