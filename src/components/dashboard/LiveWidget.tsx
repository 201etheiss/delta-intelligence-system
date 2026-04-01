'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { TrendingUp, TrendingDown, Minus, RefreshCw, AlertCircle } from 'lucide-react';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  Treemap as RechartsTreemap,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────────

export type WidgetDisplayType = 'kpi' | 'chart' | 'table' | 'gauge' | 'list' | 'pie' | 'area' | 'stackedbar' | 'sparkline' | 'heatmap' | 'treemap';
export type ChartSubType = 'bar' | 'line';
export type ValueFormat = 'currency' | 'number' | 'percent' | 'price';

/** Either a gateway GET path or a SQL/SOQL POST body */
export type WidgetQuery =
  | { sql: string }
  | { soql: string };

export interface LiveWidgetConfig {
  /** Unique identifier */
  id: string;
  /** Widget display type */
  type: WidgetDisplayType;
  /** Card title */
  title: string;
  /** Gateway GET path (mutually exclusive with query) */
  endpoint?: string;
  /** POST body for /ascend/query or /salesforce/query */
  query?: WidgetQuery;
  /** Key to extract the primary value from response rows */
  valueKey?: string;
  /** Key to extract label from response rows (list/chart) */
  labelKey?: string;
  /** Number format for display */
  format?: ValueFormat;
  /** Bar or line (only for type=chart) */
  chartType?: ChartSubType;
  /** When true, count the length of the returned array instead of extracting valueKey */
  countArray?: boolean;
  /** Auto-refresh interval in seconds (default 300) */
  refreshInterval?: number;
  /** Optional subtitle override */
  subtitle?: string;
  /** For table widgets: sort rows by this key descending before display */
  sortByKey?: string;
  /** For table widgets: only show these columns (in order) */
  displayColumns?: string[];
  /** For table/list widgets: max rows to show (default 10) */
  limit?: number;
  /** When countArray is true, only count rows where this key matches filterValue */
  filterKey?: string;
  /** Value to match against filterKey (string equality) */
  filterValue?: string;
}

interface LiveWidgetProps {
  config: LiveWidgetConfig;
  /** Optional role hint sent to the proxy API (default: admin) */
  role?: string;
}

// ── Formatting ─────────────────────────────────────────────────────

function formatValue(value: number, format: ValueFormat | undefined): string {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  switch (format) {
    case 'currency': {
      if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
      if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
      if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
      return `$${value.toLocaleString()}`;
    }
    case 'price':
      return `$${value.toFixed(4)}`;
    case 'percent':
      return `${value.toFixed(1)}%`;
    case 'number':
    default:
      return value.toLocaleString();
  }
}

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

// ── Data fetching ──────────────────────────────────────────────────

interface FetchResult {
  rows: Record<string, unknown>[];
  error: string | null;
}

async function fetchWidgetData(config: LiveWidgetConfig, role: string): Promise<FetchResult> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'x-user-role': role,
  };

  try {
    if (config.query) {
      // POST through the existing /api/gateway/[...path] proxy
      const isSOQL = 'soql' in config.query;
      const gatewayPath = isSOQL
        ? '/api/gateway/salesforce/query'
        : '/api/gateway/ascend/query';

      const res = await fetch(gatewayPath, {
        method: 'POST',
        headers,
        body: JSON.stringify(config.query),
      });
      const json = await res.json() as { success: boolean; data?: unknown; records?: unknown; totalSize?: number; error?: string };

      // Salesforce aggregate responses may nest under records or data
      const rawData = json.data ?? json.records ?? [];
      const rows = Array.isArray(rawData) ? rawData as Record<string, unknown>[] : [];
      return { rows, error: json.success ? null : (json.error ?? 'Query failed') };
    }

    if (config.endpoint) {
      // GET through the existing /api/gateway/[...path] proxy
      // Strip leading slash; the proxy reconstructs it via [...path]
      const normalized = config.endpoint.startsWith('/') ? config.endpoint : `/${config.endpoint}`;
      const res = await fetch(`/api/gateway${normalized}`, { headers });
      const json = await res.json() as { success: boolean; data?: unknown; error?: string };
      const rows = Array.isArray(json.data) ? json.data as Record<string, unknown>[] : [];
      return { rows, error: json.success ? null : (json.error ?? 'Endpoint fetch failed') };
    }

    return { rows: [], error: 'Widget config missing endpoint and query' };
  } catch (err) {
    return { rows: [], error: err instanceof Error ? err.message : 'Fetch failed' };
  }
}

// ── Skeleton ───────────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />
  );
}

// ── Sub-renderers ──────────────────────────────────────────────────

interface KpiBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function KpiBody({ rows, config, loading }: KpiBodyProps) {
  let primary = 0;
  let prior = 0;

  if (!loading && rows.length > 0) {
    if (config.countArray) {
      const filtered = config.filterKey
        ? rows.filter((r) => String(r[config.filterKey!]) === config.filterValue)
        : rows;
      primary = filtered.length;
    } else if (config.valueKey) {
      primary = safeNumber(rows[0]?.[config.valueKey]);
      // Second row treated as prior period if present
      if (rows[1]) prior = safeNumber(rows[1][config.valueKey]);
    }
  }

  const hasTrend = prior > 0 && primary !== prior;
  const trendUp = primary >= prior;

  return (
    <div className="flex flex-col gap-1">
      {loading ? (
        <Skeleton className="h-8 w-28 mt-1" />
      ) : (
        <span className="text-2xl font-bold text-white font-mono leading-none">
          {formatValue(primary, config.format)}
        </span>
      )}
      {hasTrend && !loading && (
        <span className={`flex items-center gap-1 text-xs font-medium ${trendUp ? 'text-[#FE5000]' : 'text-red-400'}`}>
          {trendUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          vs prior period
        </span>
      )}
    </div>
  );
}

interface ChartBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function ChartBody({ rows, config, loading }: ChartBodyProps) {
  const labelKey = config.labelKey ?? 'label';
  const valueKey = config.valueKey ?? 'value';
  const chartType = config.chartType ?? 'bar';

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState />;
  }

  const data = rows.map((r) => ({
    [labelKey]: String(r[labelKey] ?? ''),
    [valueKey]: safeNumber(r[valueKey]),
  }));

  const tooltipStyle = {
    backgroundColor: '#09090B',
    border: '1px solid #27272A',
    borderRadius: 6,
    fontSize: 12,
    color: '#FFFFFF',
  };

  // Detect if any label is long enough to warrant rotation
  const hasLongLabels = data.some((d) => String(d[labelKey] ?? '').length > 6);
  const yAxisFormatter = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
    : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
    : String(v);

  return (
    <ResponsiveContainer width="100%" height={hasLongLabels ? 180 : 160}>
      {chartType === 'bar' ? (
        <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: hasLongLabels ? 28 : 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis
            dataKey={labelKey}
            tick={{ fontSize: 10, fill: '#A1A1AA', ...(hasLongLabels ? { angle: -35, textAnchor: 'end', dy: 4 } : {}) }}
            axisLine={false}
            tickLine={false}
            interval={0}
          />
          <YAxis tick={{ fontSize: 9, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={50} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} cursor={{ fill: '#27272A' }} formatter={(v: unknown) => [typeof v === 'number' ? yAxisFormatter(v) : String(v ?? ''), '']} />
          <Bar dataKey={valueKey} fill="#FE5000" radius={[3, 3, 0, 0]} maxBarSize={40} />
        </BarChart>
      ) : (
        <LineChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
          <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 9, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={50} tickFormatter={yAxisFormatter} />
          <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? yAxisFormatter(v) : String(v ?? ''), '']} />
          <Line
            type="monotone"
            dataKey={valueKey}
            stroke="#FE5000"
            strokeWidth={2}
            dot={{ r: 3, fill: '#FE5000', strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}

interface TableBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function TableBody({ rows, config, loading }: TableBodyProps) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const maxRows = config.limit ?? 10;

  // Pre-sort by config.sortByKey descending before user interaction sort
  const preSorted = config.sortByKey
    ? [...rows].sort((a, b) => safeNumber(b[config.sortByKey!]) - safeNumber(a[config.sortByKey!]))
    : rows;

  // Determine columns: config.displayColumns takes priority, then infer from rows
  const allColumns = preSorted.length > 0 ? Object.keys(preSorted[0] ?? {}) : [];
  const columns = config.displayColumns
    ? config.displayColumns.filter((c) => allColumns.includes(c))
    : allColumns;

  const sorted = [...preSorted].sort((a, b) => {
    if (!sortKey) return 0;
    const av = safeNumber(a[sortKey]) || String(a[sortKey] ?? '');
    const bv = safeNumber(b[sortKey]) || String(b[sortKey] ?? '');
    if (typeof av === 'number' && typeof bv === 'number') {
      return sortDir === 'asc' ? av - bv : bv - av;
    }
    return sortDir === 'asc'
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  function toggleSort(col: string) {
    if (sortKey === col) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(col);
      setSortDir('desc');
    }
  }

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-5 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) return <EmptyState />;

  return (
    <div className="overflow-x-auto -mx-1">
      <table className="w-full text-xs">
        <thead>
          <tr className="border-b border-[#27272A]">
            {columns.map((col) => (
              <th
                key={col}
                onClick={() => toggleSort(col)}
                className="px-2 py-1.5 text-left font-semibold text-[#A1A1AA] uppercase tracking-wide cursor-pointer select-none hover:text-white transition-colors whitespace-nowrap"
              >
                {col}
                {sortKey === col && (
                  <span className="ml-1 text-[#FE5000]">{sortDir === 'asc' ? '↑' : '↓'}</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#27272A]/60">
          {sorted.slice(0, maxRows).map((row, idx) => (
            <tr key={idx} className="hover:bg-[#27272A]/40 transition-colors">
              {columns.map((col) => {
                const val = row[col];
                const isNum = typeof val === 'number';
                return (
                  <td
                    key={col}
                    className={`px-2 py-1.5 text-[#D4D4D8] font-mono whitespace-nowrap max-w-[160px] truncate ${isNum ? 'text-right' : ''}`}
                    title={val === null || val === undefined ? '' : String(val)}
                  >
                    {val === null || val === undefined ? '—' : isNum ? formatValue(val as number, 'currency') : String(val)}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

interface GaugeBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function GaugeBody({ rows, config, loading }: GaugeBodyProps) {
  let value = 0;
  if (!loading && rows.length > 0 && config.valueKey) {
    value = safeNumber(rows[0]?.[config.valueKey]);
    // If not a 0-100 percent value, clamp
    if (config.format !== 'percent') {
      value = Math.min(100, Math.max(0, value));
    } else {
      value = Math.min(100, Math.max(0, value));
    }
  }

  const radius = 48;
  const cx = 60;
  const cy = 60;
  const startAngle = 210; // degrees
  const endAngle = 330; // total sweep = 300 degrees
  const sweep = 300;
  const progress = (value / 100) * sweep;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return {
      x: cx + radius * Math.cos(rad),
      y: cy + radius * Math.sin(rad),
    };
  }

  function describeArc(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const trackPath = describeArc(startAngle, startAngle + sweep);
  const fillPath = progress > 0 ? describeArc(startAngle, startAngle + progress) : null;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Skeleton className="w-28 h-28 rounded-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 py-2">
      <svg width="120" height="80" viewBox="0 0 120 80">
        <path d={trackPath} fill="none" stroke="#27272A" strokeWidth="8" strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke="#FE5000" strokeWidth="8" strokeLinecap="round" />
        )}
        <text x={cx} y={cy + 10} textAnchor="middle" fontSize="18" fontWeight="700" fill="#FFFFFF" fontFamily="monospace">
          {formatValue(value, config.format ?? 'percent')}
        </text>
      </svg>
      <span className="text-[10px] text-[#71717A] uppercase tracking-wide">of target</span>
    </div>
  );
}

interface ListBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function ListBody({ rows, config, loading }: ListBodyProps) {
  const labelKey = config.labelKey ?? Object.keys(rows[0] ?? {})[0] ?? 'label';
  const valueKey = config.valueKey ?? Object.keys(rows[0] ?? {})[1] ?? 'value';
  const maxValue = rows.reduce((m, r) => Math.max(m, safeNumber(r[valueKey])), 0);

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) return <EmptyState />;

  return (
    <ol className="space-y-1.5">
      {rows.slice(0, 10).map((row, idx) => {
        const label = String(row[labelKey] ?? '—');
        const num = safeNumber(row[valueKey]);
        const barWidth = maxValue > 0 ? (num / maxValue) * 100 : 0;

        return (
          <li key={idx} className="group">
            <div className="flex items-center justify-between mb-0.5">
              <span className="flex items-center gap-2 min-w-0">
                <span className="text-[10px] font-mono text-[#52525B] w-4 shrink-0">{idx + 1}</span>
                <span className="text-xs text-[#D4D4D8] truncate" title={label}>{label}</span>
              </span>
              <span className="text-xs font-mono font-semibold text-white shrink-0 ml-2">
                {formatValue(num, config.format)}
              </span>
            </div>
            <div className="h-1 rounded-full bg-[#27272A] overflow-hidden">
              <div
                className="h-full rounded-full bg-[#FE5000]/70 transition-all duration-500"
                style={{ width: `${barWidth}%` }}
              />
            </div>
          </li>
        );
      })}
    </ol>
  );
}

// ── Color palette ─────────────────────────────────────────────────

const CHART_COLORS = [
  '#FE5000', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316',
];

const tooltipStyle = {
  backgroundColor: '#09090B',
  border: '1px solid #27272A',
  borderRadius: 6,
  fontSize: 12,
  color: '#FFFFFF',
};

// ── Pie / Donut ───────────────────────────────────────────────────

interface PieBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function PieBody({ rows, config, loading }: PieBodyProps) {
  const labelKey = config.labelKey ?? 'label';
  const valueKey = config.valueKey ?? 'value';

  if (loading) {
    return (
      <div className="flex items-center justify-center py-4">
        <Skeleton className="w-28 h-28 rounded-full" />
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState />;

  const data = (rows ?? []).map((r) => ({
    name: String(r[labelKey] ?? ''),
    value: Math.abs(safeNumber(r[valueKey])),
  }));

  return (
    <ResponsiveContainer width="100%" height={200}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          innerRadius={35}
          outerRadius={65}
          paddingAngle={2}
          dataKey="value"
          nameKey="name"
          stroke="#09090B"
          strokeWidth={2}
        >
          {data.map((_, idx) => (
            <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? v.toLocaleString() : String(v ?? ''), '']} />
        <Legend
          verticalAlign="bottom"
          iconType="circle"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: '#A1A1AA' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

// ── Area Chart ────────────────────────────────────────────────────

interface AreaBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function AreaBody({ rows, config, loading }: AreaBodyProps) {
  const labelKey = config.labelKey ?? 'label';
  const valueKey = config.valueKey ?? 'value';

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState />;

  const data = (rows ?? []).map((r) => ({
    [labelKey]: String(r[labelKey] ?? ''),
    [valueKey]: safeNumber(r[valueKey]),
  }));

  const yAxisFormatter = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
    : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
    : String(v);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#FE5000" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#FE5000" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={50} tickFormatter={yAxisFormatter} />
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? yAxisFormatter(v) : String(v ?? ''), '']} />
        <Area type="monotone" dataKey={valueKey} stroke="#FE5000" strokeWidth={2} fill="url(#areaGrad)" />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Stacked Bar ───────────────────────────────────────────────────

interface StackedBarBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function StackedBarBody({ rows, config, loading }: StackedBarBodyProps) {
  const labelKey = config.labelKey ?? 'label';

  if (loading) {
    return (
      <div className="space-y-2 pt-1">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState />;

  // Detect numeric keys (exclude the label key)
  const firstRow = rows[0] ?? {};
  const numericKeys = Object.keys(firstRow).filter(
    (k) => k !== labelKey && typeof firstRow[k] === 'number'
  );
  // Fallback: if no numeric keys detected, try valueKey
  const stackKeys = numericKeys.length > 0 ? numericKeys : (config.valueKey ? [config.valueKey] : []);

  const data = (rows ?? []).map((r) => {
    const d: Record<string, unknown> = { [labelKey]: String(r[labelKey] ?? '') };
    stackKeys.forEach((k) => { d[k] = safeNumber(r[k]); });
    return d;
  });

  const yAxisFormatter = (v: number) =>
    v >= 1e9 ? `${(v / 1e9).toFixed(1)}B`
    : v >= 1e6 ? `${(v / 1e6).toFixed(1)}M`
    : v >= 1e3 ? `${(v / 1e3).toFixed(0)}K`
    : String(v);

  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
        <XAxis dataKey={labelKey} tick={{ fontSize: 10, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
        <YAxis tick={{ fontSize: 9, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={50} tickFormatter={yAxisFormatter} />
        <Tooltip contentStyle={tooltipStyle} />
        {stackKeys.map((key, idx) => (
          <Bar key={key} dataKey={key} stackId="stack" fill={CHART_COLORS[idx % CHART_COLORS.length]} radius={idx === stackKeys.length - 1 ? [3, 3, 0, 0] : [0, 0, 0, 0]} maxBarSize={40} />
        ))}
        <Legend
          verticalAlign="bottom"
          iconType="square"
          iconSize={8}
          wrapperStyle={{ fontSize: 10, color: '#A1A1AA' }}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}

// ── Sparkline ─────────────────────────────────────────────────────

interface SparklineBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function SparklineBody({ rows, config, loading }: SparklineBodyProps) {
  const valueKey = config.valueKey ?? 'value';

  if (loading) {
    return <Skeleton className="h-10 w-full mt-1" />;
  }
  if (rows.length === 0) return <EmptyState />;

  const values = (rows ?? []).map((r) => safeNumber(r[valueKey]));
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 240;
  const height = 40;
  const padding = 4;

  const points = values.map((v, i) => ({
    x: padding + (i / Math.max(values.length - 1, 1)) * (width - 2 * padding),
    y: padding + (1 - (v - minVal) / range) * (height - 2 * padding),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const lastPoint = points[points.length - 1];
  const firstPoint = points[0];
  const areaD = lastPoint && firstPoint
    ? `${pathD} L ${lastPoint.x} ${height} L ${firstPoint.x} ${height} Z`
    : pathD;

  const lastVal = values[values.length - 1] ?? 0;
  const firstVal = values[0] ?? 0;
  const trendUp = lastVal >= firstVal;

  return (
    <div className="flex items-center gap-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="flex-1 h-10">
        <defs>
          <linearGradient id="sparkGradWidget" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FE5000" stopOpacity={0.2} />
            <stop offset="100%" stopColor="#FE5000" stopOpacity={0} />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGradWidget)" />
        <path d={pathD} fill="none" stroke="#FE5000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span className="text-lg font-bold text-white font-mono shrink-0">
        {formatValue(lastVal, config.format)}
      </span>
      <span className={`text-xs ${trendUp ? 'text-[#FE5000]' : 'text-red-400'}`}>
        {trendUp ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
      </span>
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────

interface HeatmapBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

function HeatmapBody({ rows, config, loading }: HeatmapBodyProps) {
  const labelKey = config.labelKey ?? 'label';
  const valueKey = config.valueKey ?? 'value';

  if (loading) {
    return (
      <div className="space-y-1 pt-1">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-full" />
        ))}
      </div>
    );
  }
  if (rows.length === 0) return <EmptyState />;

  const values = (rows ?? []).map((r) => safeNumber(r[valueKey]));
  const maxVal = Math.max(...values, 1);

  // Render as a grid of cells
  const cols = Math.min(7, rows.length);
  const gridRows = Math.ceil(rows.length / cols);

  return (
    <div className="space-y-1">
      {Array.from({ length: gridRows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex gap-1">
          {Array.from({ length: cols }).map((_, colIdx) => {
            const idx = rowIdx * cols + colIdx;
            if (idx >= rows.length) return <div key={colIdx} className="flex-1 h-8" />;
            const row = rows[idx];
            const val = safeNumber(row[valueKey]);
            const intensity = val / maxVal;
            const label = String(row[labelKey] ?? '');
            return (
              <div
                key={colIdx}
                className="flex-1 h-8 rounded-sm flex items-center justify-center text-[9px] font-mono text-white/80 cursor-default transition-colors"
                style={{ backgroundColor: `rgba(255, 92, 0, ${Math.max(0.08, intensity)})` }}
                title={`${label}: ${val}`}
              >
                {val > 0 ? val : ''}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

// ── Treemap ───────────────────────────────────────────────────────

interface TreemapBodyProps {
  rows: Record<string, unknown>[];
  config: LiveWidgetConfig;
  loading: boolean;
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string;
}

function TreemapCustomContent({ x = 0, y = 0, width = 0, height = 0, name = '' }: TreemapContentProps) {
  if (width < 30 || height < 20) return null;
  const truncated = name.length > Math.floor(width / 6) ? name.slice(0, Math.floor(width / 6) - 1) + '\u2026' : name;
  return (
    <g>
      <text
        x={x + width / 2}
        y={y + height / 2}
        textAnchor="middle"
        dominantBaseline="central"
        fill="#FFFFFF"
        fontSize={10}
        fontWeight={500}
      >
        {truncated}
      </text>
    </g>
  );
}

function TreemapBody({ rows, config, loading }: TreemapBodyProps) {
  const labelKey = config.labelKey ?? 'label';
  const valueKey = config.valueKey ?? 'value';

  if (loading) {
    return <Skeleton className="h-40 w-full mt-1" />;
  }
  if (rows.length === 0) return <EmptyState />;

  const data = (rows ?? []).map((r, idx) => ({
    name: String(r[labelKey] ?? ''),
    size: Math.abs(safeNumber(r[valueKey])),
    fill: CHART_COLORS[idx % CHART_COLORS.length],
  }));

  return (
    <ResponsiveContainer width="100%" height={180}>
      <RechartsTreemap
        data={data}
        dataKey="size"
        nameKey="name"
        stroke="#09090B"
        content={<TreemapCustomContent />}
      >
        <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? v.toLocaleString() : String(v ?? ''), '']} />
      </RechartsTreemap>
    </ResponsiveContainer>
  );
}

function EmptyState() {
  return (
    <div className="flex items-center justify-center py-6">
      <span className="text-xs text-[#52525B]">No data available</span>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="flex items-center gap-2 py-4 px-1">
      <AlertCircle size={14} className="text-[#52525B] shrink-0" />
      <span className="text-xs text-[#52525B]">Data unavailable</span>
      {process.env.NODE_ENV === 'development' && (
        <span className="text-[10px] text-[#3F3F46] truncate" title={message}>{message}</span>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────

export default function LiveWidget({ config, role = 'admin' }: LiveWidgetProps) {
  const [rows, setRows] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetched, setLastFetched] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const intervalMs = (config.refreshInterval ?? 300) * 1000;

  const load = useCallback(async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else if (!lastFetched) setLoading(true);

    const result = await fetchWidgetData(config, role);

    setRows(result.rows);
    setError(result.error);
    setLastFetched(new Date());
    setLoading(false);
    setRefreshing(false);
  }, [config, role, lastFetched]);

  useEffect(() => {
    void load();

    if (intervalMs > 0) {
      intervalRef.current = setInterval(() => void load(), intervalMs);
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.id]);

  function handleManualRefresh() {
    if (!refreshing) void load(true);
  }

  // Subtitle: config override or last-fetched timestamp
  const subtitle = config.subtitle ?? (lastFetched
    ? `Updated ${lastFetched.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
    : null);

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] shadow-sm overflow-hidden flex flex-col hover:border-[#3F3F46] transition-colors">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000] shrink-0" />
          <h3 className="text-xs font-semibold text-white uppercase tracking-wide truncate">{config.title}</h3>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing || loading}
          aria-label="Refresh widget"
          className="p-1 rounded text-[#52525B] hover:text-[#A1A1AA] hover:bg-[#27272A] transition-colors disabled:opacity-40"
        >
          <RefreshCw size={12} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Body */}
      <div className="px-4 py-3 flex-1">
        {error && !loading ? (
          <ErrorState message={error} />
        ) : config.type === 'kpi' ? (
          <KpiBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'chart' ? (
          <ChartBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'table' ? (
          <TableBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'gauge' ? (
          <GaugeBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'list' ? (
          <ListBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'pie' ? (
          <PieBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'area' ? (
          <AreaBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'stackedbar' ? (
          <StackedBarBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'sparkline' ? (
          <SparklineBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'heatmap' ? (
          <HeatmapBody rows={rows} config={config} loading={loading} />
        ) : config.type === 'treemap' ? (
          <TreemapBody rows={rows} config={config} loading={loading} />
        ) : null}
      </div>

      {/* Footer — always present when there's a subtitle or last-fetched time */}
      {(subtitle || loading) && (
        <div className="px-4 py-2 border-t border-[#27272A]/60">
          {loading ? (
            <Skeleton className="h-2.5 w-28" />
          ) : (
            <span className="text-[10px] text-[#3F3F46] font-mono">{subtitle}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ── Grid wrapper ───────────────────────────────────────────────────

interface LiveWidgetGridProps {
  widgets: LiveWidgetConfig[];
  role?: string;
  columns?: 2 | 3 | 4;
}

const WIDE_TYPES: WidgetDisplayType[] = ['table', 'chart', 'list', 'area', 'stackedbar', 'heatmap', 'treemap'];

export function LiveWidgetGrid({ widgets, role, columns = 4 }: LiveWidgetGridProps) {
  const colClass =
    columns === 2 ? 'grid-cols-1 sm:grid-cols-2' :
    columns === 3 ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3' :
    'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';

  return (
    <div className={`grid ${colClass} gap-3`}>
      {widgets.map((w) => {
        const isWide = WIDE_TYPES.includes(w.type);
        return (
          <div key={w.id} className={isWide ? 'md:col-span-2' : ''}>
            <LiveWidget config={w} role={role} />
          </div>
        );
      })}
    </div>
  );
}
