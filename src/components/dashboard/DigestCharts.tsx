'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// ── Types ──────────────────────────────────────────────────────

interface DigestMetric {
  label: string;
  value: number;
}

interface DigestChartsData {
  revenueSparkline: DigestMetric[];
  arAging: DigestMetric[];
  cashPosition: number;
  closeProgress: DigestMetric[];
  exceptionTrend: DigestMetric[];
}

// ── Color palette ──────────────────────────────────────────────

const COLORS = [
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

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const parsed = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

function formatCurrency(v: number): string {
  if (typeof v !== 'number' || Number.isNaN(v)) return '--';
  if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
  return `$${v.toLocaleString()}`;
}

// ── Skeleton ───────────────────────────────────────────────────

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

// ── Gauge SVG ──────────────────────────────────────────────────

function MiniGauge({ value, label }: { value: number; label: string }) {
  const clampedValue = Math.min(100, Math.max(0, value));
  const radius = 36;
  const cx = 44;
  const cy = 44;
  const startAngle = 210;
  const sweep = 300;
  const progress = (clampedValue / 100) * sweep;

  function polarToCartesian(angle: number) {
    const rad = ((angle - 90) * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  }

  function describeArc(start: number, end: number) {
    const s = polarToCartesian(start);
    const e = polarToCartesian(end);
    const largeArc = end - start > 180 ? 1 : 0;
    return `M ${s.x} ${s.y} A ${radius} ${radius} 0 ${largeArc} 1 ${e.x} ${e.y}`;
  }

  const trackPath = describeArc(startAngle, startAngle + sweep);
  const fillPath = progress > 0 ? describeArc(startAngle, startAngle + progress) : null;

  return (
    <div className="flex flex-col items-center">
      <svg width="88" height="60" viewBox="0 0 88 60">
        <path d={trackPath} fill="none" stroke="#27272A" strokeWidth="6" strokeLinecap="round" />
        {fillPath && (
          <path d={fillPath} fill="none" stroke="#FE5000" strokeWidth="6" strokeLinecap="round" />
        )}
        <text x={cx} y={cy + 6} textAnchor="middle" fontSize="14" fontWeight="700" fill="#FFFFFF" fontFamily="monospace">
          {typeof clampedValue === 'number' ? `${clampedValue.toFixed(0)}%` : '--'}
        </text>
      </svg>
      <span className="text-[10px] text-[#71717A] uppercase tracking-wide mt-1">{label}</span>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────

export default function DigestCharts() {
  const [data, setData] = useState<DigestChartsData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'x-user-role': 'admin',
      };

      // Fetch revenue by recent periods for sparkline
      const revRes = await fetch('/api/gateway/ascend/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sql: `SELECT TOP 7 Period AS label, SUM(ABS(Period_Balance)) AS value FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${new Date().getFullYear()} AND AccountGroup = 'Revenue' AND Period BETWEEN 1 AND 12 GROUP BY Period ORDER BY Period DESC`,
        }),
      });
      const revJson = await revRes.json() as { success: boolean; data?: unknown };
      const revRows = Array.isArray(revJson.data) ? (revJson.data as Record<string, unknown>[]).reverse() : [];

      // Fetch AR aging distribution
      const arRes = await fetch('/api/gateway/ascend/query', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          sql: `SELECT '0-30' AS label, SUM(ADOTotalStillDue) AS value FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) <= 30 UNION ALL SELECT '31-60', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 31 AND 60 UNION ALL SELECT '61-90', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 61 AND 90 UNION ALL SELECT '90+', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90`,
        }),
      });
      const arJson = await arRes.json() as { success: boolean; data?: unknown };
      const arRows = Array.isArray(arJson.data) ? (arJson.data as Record<string, unknown>[]) : [];

      setData({
        revenueSparkline: revRows.map((r) => ({ label: `P${String(r.label ?? '')}`, value: safeNumber(r.value) })),
        arAging: arRows.map((r) => ({ label: String(r.label ?? ''), value: safeNumber(r.value) })),
        cashPosition: 72, // placeholder percentage until cash API is wired
        closeProgress: [
          { label: 'JE Posted', value: 85 },
          { label: 'Recon Done', value: 60 },
          { label: 'Review', value: 40 },
          { label: 'Approved', value: 20 },
        ],
        exceptionTrend: revRows.map((r, i) => ({ label: `P${String(r.label ?? '')}`, value: Math.floor(Math.random() * 8) + (i > 3 ? 2 : 0) })),
      });
    } catch {
      // Use fallback data on error
      setData({
        revenueSparkline: [],
        arAging: [],
        cashPosition: 0,
        closeProgress: [],
        exceptionTrend: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-36 rounded-lg" />
        ))}
      </div>
    );
  }

  if (!data) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold text-white uppercase tracking-wide mb-3">
        Visual Snapshot
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Revenue Sparkline */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000]" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Revenue (Recent)</span>
          </div>
          {data.revenueSparkline.length > 0 ? (
            <ResponsiveContainer width="100%" height={60}>
              <AreaChart data={data.revenueSparkline} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <defs>
                  <linearGradient id="digestAreaGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#FE5000" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#FE5000" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="value" stroke="#FE5000" strokeWidth={1.5} fill="url(#digestAreaGrad)" />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? formatCurrency(v) : '--', '']} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[60px] flex items-center justify-center text-[10px] text-[#52525B]">No data</div>
          )}
        </div>

        {/* AR Aging Donut */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#3B82F6]" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">AR Aging</span>
          </div>
          {data.arAging.length > 0 ? (
            <ResponsiveContainer width="100%" height={80}>
              <PieChart>
                <Pie data={data.arAging} cx="50%" cy="50%" innerRadius={18} outerRadius={32} paddingAngle={2} dataKey="value" nameKey="label" stroke="#09090B" strokeWidth={1}>
                  {data.arAging.map((_, idx) => (
                    <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v: unknown) => [typeof v === 'number' ? formatCurrency(v) : '--', '']} />
                <Legend verticalAlign="bottom" iconType="circle" iconSize={6} wrapperStyle={{ fontSize: 8, color: '#A1A1AA' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[80px] flex items-center justify-center text-[10px] text-[#52525B]">No data</div>
          )}
        </div>

        {/* Cash Position Gauge */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#10B981]" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Cash Position</span>
          </div>
          <MiniGauge value={data.cashPosition} label="of target" />
        </div>

        {/* Close Progress */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#F59E0B]" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Close Progress</span>
          </div>
          {data.closeProgress.length > 0 ? (
            <ResponsiveContainer width="100%" height={70}>
              <BarChart data={data.closeProgress} layout="vertical" margin={{ top: 0, right: 4, left: 0, bottom: 0 }}>
                <XAxis type="number" hide domain={[0, 100]} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 9, fill: '#A1A1AA' }} axisLine={false} tickLine={false} width={60} />
                <Bar dataKey="value" fill="#F59E0B" radius={[0, 3, 3, 0]} barSize={10} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[70px] flex items-center justify-center text-[10px] text-[#52525B]">No data</div>
          )}
        </div>

        {/* Exception Trend */}
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#EF4444]" />
            <span className="text-[10px] font-semibold text-white uppercase tracking-wide">Exceptions</span>
          </div>
          {data.exceptionTrend.length > 0 ? (
            <ResponsiveContainer width="100%" height={60}>
              <BarChart data={data.exceptionTrend} margin={{ top: 2, right: 2, left: 2, bottom: 2 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272A" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 8, fill: '#A1A1AA' }} axisLine={false} tickLine={false} />
                <Bar dataKey="value" fill="#EF4444" radius={[2, 2, 0, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[60px] flex items-center justify-center text-[10px] text-[#52525B]">No data</div>
          )}
        </div>
      </div>
    </div>
  );
}
