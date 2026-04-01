'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart3,
  RefreshCw,
  ChevronDown,
  Download,
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  DollarSign,
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'bva-analysis' | 'variance-detail' | 'rolling-forecast';

interface VarianceLine {
  accountNumber: string;
  accountName: string;
  budget: number;
  actual: number;
  varianceDollar: number;
  variancePct: number | null;
  status: 'favorable' | 'unfavorable' | 'neutral';
}

interface BvASummary {
  totalBudget: number;
  totalActual: number;
  netVariance: number;
  materialVarianceCount: number;
}

interface MonthlyTrend {
  month: string;
  budget: number;
  actual: number;
}

interface ForecastLine {
  accountNumber: string;
  accountName: string;
  ytdActual: number;
  annualBudget: number;
  forecast: number;
  forecastVariance: number;
}

interface BudgetsData {
  period: string;
  department: string;
  lines: VarianceLine[];
  summary: BvASummary;
  trend: MonthlyTrend[];
  forecast: ForecastLine[];
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtAcct(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtCompact(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `$${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `$${(abs / 1_000).toFixed(1)}K`;
  else formatted = `$${abs.toFixed(0)}`;
  return n < 0 ? `(${formatted})` : formatted;
}

function fmtPct(n: number | null): string {
  if (n === null || typeof n !== 'number' || Number.isNaN(n)) return '--';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function getPeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MATERIALITY_THRESHOLD = 5000;

const DEPARTMENTS = [
  'All',
  'Operations',
  'Sales',
  'Accounting',
  'HR',
  'IT',
  'Executive',
  'Fleet',
  'Maintenance',
];

const TABS: { id: TabId; label: string }[] = [
  { id: 'bva-analysis', label: 'BvA Analysis' },
  { id: 'variance-detail', label: 'Variance Detail' },
  { id: 'rolling-forecast', label: 'Rolling Forecast' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function KPICard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
      <div className="flex items-center gap-2 text-zinc-400 text-xs mb-1">{icon}<span>{label}</span></div>
      <div className={`text-lg font-mono font-bold ${color ?? 'text-white'}`}>{value}</div>
    </div>
  );
}

function BvAChartSection({ trend }: { trend: MonthlyTrend[] }) {
  if ((trend ?? []).length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
        Budget vs Actual Trend
      </h3>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4" style={{ height: 300 }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={trend ?? []}>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272A" />
            <XAxis dataKey="month" stroke="#71717A" tick={{ fontSize: 12 }} />
            <YAxis
              stroke="#71717A"
              tick={{ fontSize: 12 }}
              tickFormatter={(v: number) => fmtCompact(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: '#18181B',
                border: '1px solid #3F3F46',
                borderRadius: '8px',
                color: '#E4E4E7',
                fontSize: '12px',
              }}
              formatter={(value: unknown, name: unknown) => [fmtAcct(typeof value === 'number' ? value : 0), String(name ?? '')]}
            />
            <Legend />
            <Line
              type="monotone"
              dataKey="budget"
              stroke="#FE5000"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Budget"
            />
            <Line
              type="monotone"
              dataKey="actual"
              stroke="#22D3EE"
              strokeWidth={2}
              dot={{ r: 3 }}
              name="Actual"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function BvAAnalysisView({ data }: { data: BudgetsData }) {
  return (
    <div>
      <BvAChartSection trend={data.trend ?? []} />

      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Account</th>
            <th className="py-2 text-left">Account Name</th>
            <th className="py-2 text-right w-32">Budget</th>
            <th className="py-2 text-right w-32">Actual</th>
            <th className="py-2 text-right w-28">Variance $</th>
            <th className="py-2 text-right w-20">Variance %</th>
            <th className="py-2 text-center w-28">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data.lines ?? []).map((line, i) => {
            const isMaterial = Math.abs(line.varianceDollar) >= MATERIALITY_THRESHOLD;
            return (
              <tr
                key={`${line.accountNumber}-${i}`}
                className={`border-b border-zinc-800 ${isMaterial ? 'bg-yellow-900/10' : 'hover:bg-zinc-800/50'}`}
              >
                <td className="py-1.5 text-zinc-500">{line.accountNumber}</td>
                <td className="py-1.5 text-zinc-300">{line.accountName}</td>
                <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.budget)}</td>
                <td className="py-1.5 text-right text-white">{fmtAcct(line.actual)}</td>
                <td className={`py-1.5 text-right font-semibold ${
                  line.status === 'favorable' ? 'text-green-400'
                  : line.status === 'unfavorable' ? 'text-red-400'
                  : 'text-zinc-400'
                }`}>
                  {fmtAcct(line.varianceDollar)}
                  {isMaterial && <AlertTriangle className="w-3 h-3 inline ml-1 text-yellow-400" />}
                </td>
                <td className={`py-1.5 text-right ${
                  line.status === 'favorable' ? 'text-green-400'
                  : line.status === 'unfavorable' ? 'text-red-400'
                  : 'text-zinc-500'
                }`}>
                  {fmtPct(line.variancePct)}
                </td>
                <td className="py-1.5 text-center">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                    line.status === 'favorable' ? 'text-green-400 bg-green-900/30'
                    : line.status === 'unfavorable' ? 'text-red-400 bg-red-900/30'
                    : 'text-zinc-400 bg-zinc-800'
                  }`}>
                    {line.status === 'favorable' && <TrendingUp className="w-3 h-3" />}
                    {line.status === 'unfavorable' && <TrendingDown className="w-3 h-3" />}
                    {line.status}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2" colSpan={2}>Totals</td>
            <td className="py-2 text-right text-white font-mono">{fmtAcct(data.summary?.totalBudget ?? 0)}</td>
            <td className="py-2 text-right text-white font-mono">{fmtAcct(data.summary?.totalActual ?? 0)}</td>
            <td className={`py-2 text-right font-mono ${
              (data.summary?.netVariance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {fmtAcct(data.summary?.netVariance ?? 0)}
            </td>
            <td />
            <td />
          </tr>
        </tfoot>
      </table>
      {(data.lines ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No budget vs actual data for this period.</div>
      )}
    </div>
  );
}

function VarianceDetailView({ data }: { data: BudgetsData }) {
  const materialLines = (data.lines ?? []).filter(
    (l) => Math.abs(l.varianceDollar) >= MATERIALITY_THRESHOLD
  );

  return (
    <div>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <AlertTriangle className="w-4 h-4 text-yellow-400" />
          <span>
            Showing {materialLines.length} material variance{materialLines.length !== 1 ? 's' : ''} exceeding
            the ${MATERIALITY_THRESHOLD.toLocaleString()} threshold.
          </span>
        </div>
      </div>

      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Account</th>
            <th className="py-2 text-left">Account Name</th>
            <th className="py-2 text-right w-32">Budget</th>
            <th className="py-2 text-right w-32">Actual</th>
            <th className="py-2 text-right w-28">Variance $</th>
            <th className="py-2 text-right w-20">Variance %</th>
            <th className="py-2 text-center w-28">Status</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(materialLines ?? []).map((line, i) => (
            <tr
              key={`${line.accountNumber}-${i}`}
              className="border-b border-zinc-800 bg-yellow-900/10 hover:bg-yellow-900/20"
            >
              <td className="py-1.5 text-zinc-500">{line.accountNumber}</td>
              <td className="py-1.5 text-zinc-300">{line.accountName}</td>
              <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.budget)}</td>
              <td className="py-1.5 text-right text-white">{fmtAcct(line.actual)}</td>
              <td className={`py-1.5 text-right font-semibold ${
                line.status === 'favorable' ? 'text-green-400' : 'text-red-400'
              }`}>
                {fmtAcct(line.varianceDollar)}
              </td>
              <td className={`py-1.5 text-right ${
                line.status === 'favorable' ? 'text-green-400' : 'text-red-400'
              }`}>
                {fmtPct(line.variancePct)}
              </td>
              <td className="py-1.5 text-center">
                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                  line.status === 'favorable' ? 'text-green-400 bg-green-900/30' : 'text-red-400 bg-red-900/30'
                }`}>
                  {line.status === 'favorable' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {line.status}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {(materialLines ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">
          No material variances exceeding ${MATERIALITY_THRESHOLD.toLocaleString()} for this period.
        </div>
      )}
    </div>
  );
}

function RollingForecastView({ data }: { data: BudgetsData }) {
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-24">Account</th>
            <th className="py-2 text-left">Account Name</th>
            <th className="py-2 text-right w-28">YTD Actual</th>
            <th className="py-2 text-right w-28">Annual Budget</th>
            <th className="py-2 text-right w-28">Forecast</th>
            <th className="py-2 text-right w-28">Forecast Var.</th>
            <th className="py-2 text-center w-20">Trend</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data.forecast ?? []).map((line, i) => {
            const isOver = line.forecastVariance < 0;
            return (
              <tr key={`${line.accountNumber}-${i}`} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-1.5 text-zinc-500">{line.accountNumber}</td>
                <td className="py-1.5 text-zinc-300">{line.accountName}</td>
                <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.ytdActual)}</td>
                <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.annualBudget)}</td>
                <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(line.forecast)}</td>
                <td className={`py-1.5 text-right font-semibold ${isOver ? 'text-red-400' : 'text-green-400'}`}>
                  {fmtAcct(line.forecastVariance)}
                </td>
                <td className="py-1.5 text-center">
                  {isOver ? (
                    <TrendingDown className="w-4 h-4 mx-auto text-red-400" />
                  ) : (
                    <TrendingUp className="w-4 h-4 mx-auto text-green-400" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2" colSpan={2}>Totals</td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.forecast ?? []).reduce((s, l) => s + (l.ytdActual ?? 0), 0))}
            </td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.forecast ?? []).reduce((s, l) => s + (l.annualBudget ?? 0), 0))}
            </td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct((data.forecast ?? []).reduce((s, l) => s + (l.forecast ?? 0), 0))}
            </td>
            <td className={`py-2 text-right font-mono ${
              (data.forecast ?? []).reduce((s, l) => s + (l.forecastVariance ?? 0), 0) >= 0
                ? 'text-green-400' : 'text-red-400'
            }`}>
              {fmtAcct((data.forecast ?? []).reduce((s, l) => s + (l.forecastVariance ?? 0), 0))}
            </td>
            <td />
          </tr>
        </tfoot>
      </table>
      {(data.forecast ?? []).length === 0 && (
        <div className="text-center text-zinc-500 py-12">No rolling forecast data available.</div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function BudgetsPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [department, setDepartment] = useState('All');
  const [activeTab, setActiveTab] = useState<TabId>('bva-analysis');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BudgetsData | null>(null);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [deptOpen, setDeptOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const deptParam = department !== 'All' ? `&department=${encodeURIComponent(department)}` : '';
      const res = await fetch(`/api/budgets/variance?period=${period}${deptParam}`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to fetch budget variance data');
    } finally {
      setLoading(false);
    }
  }, [period, department]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Budget vs Actual</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Department selector */}
          <div className="relative">
            <button
              onClick={() => setDeptOpen(!deptOpen)}
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {department}
              <ChevronDown className="w-4 h-4" />
            </button>
            {deptOpen && (
              <div className="absolute right-0 mt-0.5 w-48 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
                {DEPARTMENTS.map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      setDepartment(d);
                      setDeptOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                      d === department ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Period selector */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {periodLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 mt-0.5 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
                {periods.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPeriod(p.value);
                      setPeriodOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                      p.value === period ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 rounded-lg px-4 py-2 text-sm text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <AIInsightsBanner module="budgets" compact />

      {/* Summary KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Budget"
          value={fmtCompact(data?.summary?.totalBudget ?? 0)}
        />
        <KPICard
          icon={<DollarSign className="w-4 h-4" />}
          label="Total Actual"
          value={fmtCompact(data?.summary?.totalActual ?? 0)}
        />
        <KPICard
          icon={(data?.summary?.netVariance ?? 0) >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          label="Net Variance"
          value={fmtCompact(data?.summary?.netVariance ?? 0)}
          color={(data?.summary?.netVariance ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}
        />
        <KPICard
          icon={<AlertTriangle className="w-4 h-4" />}
          label="Material Variances"
          value={`${data?.summary?.materialVarianceCount ?? 0}`}
          color={(data?.summary?.materialVarianceCount ?? 0) > 0 ? 'text-yellow-400' : 'text-green-400'}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-5 py-4">
        <div className="text-center mb-6">
          <div className="text-lg font-bold text-white">Delta360 Energy LLC</div>
          <div className="text-sm text-zinc-400">
            {activeTab === 'bva-analysis' && `Budget vs Actual Analysis - ${periodLabel}${department !== 'All' ? ` - ${department}` : ''}`}
            {activeTab === 'variance-detail' && `Material Variance Detail - ${periodLabel}${department !== 'All' ? ` - ${department}` : ''}`}
            {activeTab === 'rolling-forecast' && `Rolling Forecast - ${periodLabel}${department !== 'All' ? ` - ${department}` : ''}`}
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error !== null ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {String(error)}
          </div>
        ) : null}

        {!loading && !error && data !== null ? (
          <>
            {activeTab === 'bva-analysis' && <BvAAnalysisView data={data} />}
            {activeTab === 'variance-detail' && <VarianceDetailView data={data} />}
            {activeTab === 'rolling-forecast' && <RollingForecastView data={data} />}
          </>
        ) : null}

        {!loading && !error && !data && (
          <div className="text-center text-zinc-500 py-12">
            No budget data available for this period. Upload budgets to enable variance analysis.
          </div>
        )}
      </div>
    </div>
  );
}
