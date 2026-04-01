'use client';

import { useState, useMemo } from 'react';
import type { ParsedTable, ChartSuggestion } from '@/lib/chart-detector';
import { parseNumericValue, isSummaryRow } from '@/lib/chart-detector';

// ── Color palette ─────────────────────────────────────────────
const COLORS = [
  '#FF5C00', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6',
  '#EC4899', '#14B8A6', '#F97316',
];

const ZINC = {
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  700: '#3F3F46',
  800: '#27272A',
};

interface InlineChartProps {
  suggestion: ChartSuggestion;
  table: ParsedTable;
  /** When true, render just the chart content without wrapper/toggle UI */
  bare?: boolean;
}

// ── Bar Chart (vertical) ──────────────────────────────────────
function BarChart({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    return table.rows
      .filter((row) => !isSummaryRow(row, labelCol))
      .map((row) => ({
        label: row[labelCol] ?? '',
        values: valueCols.map((c) => parseNumericValue(row[c] ?? '0')),
      }));
  }, [table, labelCol, valueCols]);

  const maxVal = Math.max(...data.flatMap((d) => d.values), 1);
  const barWidth = Math.max(28, Math.min(60, 400 / data.length));
  // Dynamic label truncation based on bar width
  const maxLabelChars = Math.max(6, Math.floor(barWidth / 5));

  return (
    <div className="flex items-end gap-1.5 h-44 px-3 pt-4 pb-8 relative overflow-x-auto">
      {data.map((d, i) => (
        <div
          key={i}
          className="flex flex-col items-center gap-0.5 relative shrink-0"
          style={{ width: barWidth }}
          onMouseEnter={() => setHoveredIdx(i)}
          onMouseLeave={() => setHoveredIdx(null)}
        >
          {hoveredIdx === i && (
            <div className="absolute bottom-full mb-1 bg-zinc-900 dark:bg-zinc-800 text-white text-[10px] px-2.5 py-1.5 rounded whitespace-nowrap z-10 shadow-lg">
              <span className="font-medium">{d.label}</span>: {d.values.map((v) => v.toLocaleString()).join(', ')}
            </div>
          )}
          {d.values.map((v, vi) => (
            <div
              key={vi}
              className="w-full rounded-t transition-all duration-200"
              style={{
                height: `${Math.max(2, (v / maxVal) * 130)}px`,
                backgroundColor: COLORS[vi % COLORS.length],
                opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.4,
              }}
            />
          ))}
          <span className="text-[9px] text-zinc-500 dark:text-zinc-400 w-full text-center mt-1 absolute -bottom-6 leading-tight" title={d.label}>
            {d.label.length > maxLabelChars ? d.label.slice(0, maxLabelChars - 1) + '\u2026' : d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Horizontal Bar Chart ──────────────────────────────────────
function HorizontalBarChart({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const data = useMemo(() => {
    return table.rows
      .filter((row) => !isSummaryRow(row, labelCol))
      .map((row) => ({
        label: row[labelCol] ?? '',
        values: valueCols.map((c) => parseNumericValue(row[c] ?? '0')),
      }));
  }, [table, labelCol, valueCols]);

  const maxVal = Math.max(...data.flatMap((d) => d.values), 1);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      {data.slice(0, 12).map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-20 truncate text-right shrink-0">
            {d.label}
          </span>
          <div className="flex-1 flex items-center gap-0.5 h-5">
            {d.values.map((v, vi) => (
              <div
                key={vi}
                className="h-full rounded-sm transition-all duration-300"
                style={{
                  width: `${Math.max(1, (v / maxVal) * 100)}%`,
                  backgroundColor: COLORS[vi % COLORS.length],
                }}
                title={`${d.label}: ${v.toLocaleString()}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-zinc-400 tabular-nums w-16 text-right shrink-0">
            {d.values[0]?.toLocaleString() ?? ''}
          </span>
        </div>
      ))}
    </div>
  );
}

// ── Sparkline ─────────────────────────────────────────────────
function Sparkline({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const [hoveredPoint, setHoveredPoint] = useState<number | null>(null);

  const data = useMemo(() => {
    return table.rows.filter((row) => !isSummaryRow(row, labelCol)).map((row) => ({
      label: row[labelCol] ?? '',
      value: parseNumericValue(row[valueCols[0]] ?? '0'),
    }));
  }, [table, labelCol, valueCols]);

  const values = data.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;

  const width = 300;
  const height = 80;
  const padding = 10;

  const points = data.map((d, i) => ({
    x: padding + (i / Math.max(data.length - 1, 1)) * (width - 2 * padding),
    y: padding + (1 - (d.value - minVal) / range) * (height - 2 * padding),
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = pathD + ` L ${points[points.length - 1]?.x ?? 0} ${height} L ${points[0]?.x ?? 0} ${height} Z`;

  return (
    <div className="relative px-2 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-20">
        <defs>
          <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#FF5C00" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#FF5C00" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaD} fill="url(#sparkGrad)" />
        <path d={pathD} fill="none" stroke="#FF5C00" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={hoveredPoint === i ? 4 : 2}
            fill={hoveredPoint === i ? '#FF5C00' : 'white'}
            stroke="#FF5C00"
            strokeWidth="1.5"
            className="cursor-pointer transition-all"
            onMouseEnter={() => setHoveredPoint(i)}
            onMouseLeave={() => setHoveredPoint(null)}
          />
        ))}
      </svg>
      {hoveredPoint !== null && data[hoveredPoint] && (
        <div
          className="absolute bg-zinc-900 text-white text-[10px] px-2 py-1 rounded shadow-lg z-10 pointer-events-none"
          style={{
            left: `${(points[hoveredPoint]?.x ?? 0) / width * 100}%`,
            top: '-4px',
            transform: 'translateX(-50%)',
          }}
        >
          {data[hoveredPoint].label}: {data[hoveredPoint].value.toLocaleString()}
        </div>
      )}
      <div className="flex justify-between text-[9px] text-zinc-400 mt-1 px-1">
        <span>{data[0]?.label ?? ''}</span>
        <span>{data[data.length - 1]?.label ?? ''}</span>
      </div>
    </div>
  );
}

// ── Donut Chart ───────────────────────────────────────────────
function DonutChart({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    return table.rows.filter((row) => !isSummaryRow(row, labelCol)).map((row) => ({
      label: row[labelCol] ?? '',
      value: Math.abs(parseNumericValue(row[valueCols[0]] ?? '0')),
    }));
  }, [table, labelCol, valueCols]);

  const total = data.reduce((sum, d) => sum + d.value, 0) || 1;
  const cx = 60;
  const cy = 60;
  const r = 45;
  const innerR = 28;

  let currentAngle = -Math.PI / 2;
  const slices = data.map((d, i) => {
    const angle = (d.value / total) * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + angle;
    currentAngle = endAngle;

    const x1 = cx + r * Math.cos(startAngle);
    const y1 = cy + r * Math.sin(startAngle);
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const ix1 = cx + innerR * Math.cos(endAngle);
    const iy1 = cy + innerR * Math.sin(endAngle);
    const ix2 = cx + innerR * Math.cos(startAngle);
    const iy2 = cy + innerR * Math.sin(startAngle);

    const largeArc = angle > Math.PI ? 1 : 0;
    const path = [
      `M ${x1} ${y1}`,
      `A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`,
      `L ${ix1} ${iy1}`,
      `A ${innerR} ${innerR} 0 ${largeArc} 0 ${ix2} ${iy2}`,
      'Z',
    ].join(' ');

    return { path, color: COLORS[i % COLORS.length], ...d };
  });

  return (
    <div className="flex items-center gap-4 px-2 py-2">
      <svg viewBox="0 0 120 120" className="w-28 h-28 shrink-0">
        {slices.map((s, i) => (
          <path
            key={i}
            d={s.path}
            fill={s.color}
            stroke="white"
            strokeWidth="1"
            opacity={hoveredIdx === null || hoveredIdx === i ? 1 : 0.4}
            className="cursor-pointer transition-opacity"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          />
        ))}
        {hoveredIdx !== null && slices[hoveredIdx] && (
          <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central" className="text-[8px] fill-zinc-700 font-medium">
            {((slices[hoveredIdx].value / total) * 100).toFixed(1)}%
          </text>
        )}
      </svg>
      <div className="flex flex-col gap-1 min-w-0">
        {slices.map((s, i) => (
          <div
            key={i}
            className="flex items-center gap-1.5 text-[10px] cursor-pointer"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            <span className="w-2.5 h-2.5 rounded-sm shrink-0" style={{ backgroundColor: s.color }} />
            <span className="text-zinc-600 dark:text-zinc-300 truncate">{s.label}</span>
            <span className="text-zinc-400 tabular-nums ml-auto shrink-0">{s.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Line Chart (multi-series time series) ────────────────────
function LineChart({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const data = useMemo(() => {
    return table.rows.filter((row) => !isSummaryRow(row, labelCol)).map((row) => ({
      label: row[labelCol] ?? '',
      values: valueCols.map((c) => parseNumericValue(row[c] ?? '0')),
    }));
  }, [table, labelCol, valueCols]);

  const allValues = data.flatMap(d => d.values);
  const minVal = Math.min(...allValues);
  const maxVal = Math.max(...allValues);
  const range = maxVal - minVal || 1;

  const width = 350;
  const height = 120;
  const pad = 16;

  return (
    <div className="relative px-2 py-2">
      <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-28">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => (
          <line key={pct} x1={pad} y1={pad + pct * (height - 2 * pad)} x2={width - pad} y2={pad + pct * (height - 2 * pad)} stroke={ZINC[800]} strokeWidth={0.5} strokeDasharray="2,3" />
        ))}
        {/* Lines per value column */}
        {valueCols.map((_, vi) => {
          const points = data.map((d, i) => ({
            x: pad + (i / Math.max(data.length - 1, 1)) * (width - 2 * pad),
            y: pad + (1 - (d.values[vi] - minVal) / range) * (height - 2 * pad),
          }));
          const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
          return (
            <g key={vi}>
              <path d={pathD} fill="none" stroke={COLORS[vi % COLORS.length]} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              {points.map((p, i) => (
                <circle key={i} cx={p.x} cy={p.y} r={hoveredIdx === i ? 4 : 2} fill={COLORS[vi % COLORS.length]} className="transition-all duration-100"
                  onMouseEnter={() => setHoveredIdx(i)} onMouseLeave={() => setHoveredIdx(null)} />
              ))}
            </g>
          );
        })}
      </svg>
      {/* Legend */}
      <div className="flex items-center gap-3 px-2 mt-1">
        {valueCols.map((c, vi) => (
          <div key={vi} className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: COLORS[vi % COLORS.length] }} />
            <span className="text-zinc-500 dark:text-zinc-400 truncate">{table.headers[c]}</span>
          </div>
        ))}
      </div>
      {/* Hover tooltip */}
      {hoveredIdx !== null && data[hoveredIdx] && (
        <div className="absolute top-1 right-2 bg-zinc-900 dark:bg-zinc-800 text-white text-[10px] px-2 py-1 rounded shadow-lg z-10">
          <span className="font-medium">{data[hoveredIdx].label}</span>
          {data[hoveredIdx].values.map((v, vi) => (
            <span key={vi} className="ml-2" style={{ color: COLORS[vi % COLORS.length] }}>{v.toLocaleString()}</span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Stacked Bar Chart ────────────────────────────────────────
function StackedBarChart({ table, labelCol, valueCols }: {
  table: ParsedTable;
  labelCol: number;
  valueCols: number[];
}) {
  const data = useMemo(() => {
    return table.rows.filter((row) => !isSummaryRow(row, labelCol)).map((row) => ({
      label: row[labelCol] ?? '',
      values: valueCols.map((c) => parseNumericValue(row[c] ?? '0')),
      total: valueCols.reduce((sum, c) => sum + parseNumericValue(row[c] ?? '0'), 0),
    }));
  }, [table, labelCol, valueCols]);

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  return (
    <div className="flex flex-col gap-1.5 px-2 py-2">
      {data.slice(0, 12).map((d, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className="text-[10px] text-zinc-500 w-20 truncate text-right shrink-0">{d.label}</span>
          <div className="flex-1 flex h-5 rounded-sm overflow-hidden">
            {d.values.map((v, vi) => (
              <div
                key={vi}
                className="h-full transition-all duration-300"
                style={{
                  width: `${Math.max(0.5, (v / maxTotal) * 100)}%`,
                  backgroundColor: COLORS[vi % COLORS.length],
                }}
                title={`${table.headers[valueCols[vi]]}: ${v.toLocaleString()}`}
              />
            ))}
          </div>
          <span className="text-[10px] text-zinc-400 tabular-nums w-16 text-right shrink-0">
            {d.total.toLocaleString()}
          </span>
        </div>
      ))}
      {/* Legend */}
      <div className="flex items-center gap-3 px-1 mt-1">
        {valueCols.map((c, vi) => (
          <div key={vi} className="flex items-center gap-1 text-[10px]">
            <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: COLORS[vi % COLORS.length] }} />
            <span className="text-zinc-500 dark:text-zinc-400 truncate">{table.headers[c]}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main InlineChart ──────────────────────────────────────────
export default function InlineChart({ suggestion, table, bare = false }: InlineChartProps) {
  const [showChart, setShowChart] = useState(false);

  const chartContent = (() => {
    switch (suggestion.type) {
      case 'bar':
        return <BarChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      case 'horizontal-bar':
        return <HorizontalBarChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      case 'sparkline':
        return <Sparkline table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      case 'donut':
        return <DonutChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      case 'line':
        return <LineChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      case 'stacked-bar':
        return <StackedBarChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
      default:
        return <BarChart table={table} labelCol={suggestion.labelColumn} valueCols={suggestion.valueColumns} />;
    }
  })();

  // Bare mode: just render the chart content directly (used inside InteractiveTable)
  if (bare) {
    return <div className="px-2 py-2">{chartContent}</div>;
  }

  if (!showChart) {
    return (
      <button
        onClick={() => setShowChart(true)}
        className="mt-1 mb-2 inline-flex items-center gap-1.5 text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-[#FF5C00] transition-colors px-2 py-1 rounded hover:bg-[#FF5C00]/5 dark:hover:bg-[#FF5C00]/10"
      >
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        View as {suggestion.type === 'horizontal-bar' ? 'bar' : suggestion.type} chart
      </button>
    );
  }

  return (
    <div className="my-2 border border-zinc-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#18181B] overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-800/50">
        <span className="text-[10px] text-zinc-400 uppercase tracking-wide font-medium">
          {suggestion.type === 'horizontal-bar' ? 'Bar' : suggestion.type.charAt(0).toUpperCase() + suggestion.type.slice(1)} Chart
        </span>
        <button
          onClick={() => setShowChart(false)}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
        >
          Show table
        </button>
      </div>
      {chartContent}
    </div>
  );
}
