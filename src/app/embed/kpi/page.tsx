'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ── Types ────────────────────────────────────────────────────

interface KpiData {
  customerCount: number;
  pipelineTotal: number;
  vehicleCount: number;
  arTotal: number;
}

interface MetricConfig {
  key: keyof KpiData;
  label: string;
  format: (v: number) => string;
}

// ── Metric Definitions ───────────────────────────────────────

const METRIC_DEFS: Record<string, MetricConfig> = {
  customers: {
    key: 'customerCount',
    label: 'Customers',
    format: (v) => v.toLocaleString(),
  },
  pipeline: {
    key: 'pipelineTotal',
    label: 'Pipeline',
    format: (v) =>
      `$${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toLocaleString()}`,
  },
  vehicles: {
    key: 'vehicleCount',
    label: 'Vehicles',
    format: (v) => v.toLocaleString(),
  },
  ar: {
    key: 'arTotal',
    label: 'A/R Total',
    format: (v) =>
      `$${v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1_000 ? `${(v / 1_000).toFixed(0)}K` : v.toLocaleString()}`,
  },
};

const ALL_METRIC_KEYS = Object.keys(METRIC_DEFS);

// ── Main Component ───────────────────────────────────────────

function EmbedKpiContent() {
  const params = useSearchParams();
  const theme = params.get('theme') ?? 'dark';
  const metricsParam = params.get('metrics') ?? '';

  const isDark = theme === 'dark';
  const bg = isDark ? '#09090B' : '#FFFFFF';
  const cardBg = isDark ? '#18181B' : '#F4F4F5';
  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const mutedText = isDark ? '#71717A' : '#A1A1AA';
  const accentColor = '#FF5C00';

  const requestedMetrics = metricsParam
    ? metricsParam.split(',').filter((m) => m in METRIC_DEFS)
    : ALL_METRIC_KEYS;

  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchKpis = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      const data = await res.json();
      if (data.success && data.kpis) {
        setKpis(data.kpis);
      } else {
        setError(data.error ?? 'Failed to load KPIs');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchKpis();
    const interval = setInterval(fetchKpis, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [fetchKpis]);

  if (loading) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ backgroundColor: bg, color: mutedText }}
      >
        Loading KPIs...
      </div>
    );
  }

  if (error || !kpis) {
    return (
      <div
        className="flex items-center justify-center h-full text-sm"
        style={{ backgroundColor: bg, color: '#EF4444' }}
      >
        {error || 'No data available'}
      </div>
    );
  }

  return (
    <div
      className="p-4 h-full overflow-auto"
      style={{ backgroundColor: bg }}
    >
      <div
        className="grid gap-3"
        style={{
          gridTemplateColumns: `repeat(${Math.min(requestedMetrics.length, 4)}, 1fr)`,
        }}
      >
        {requestedMetrics.map((metricKey) => {
          const def = METRIC_DEFS[metricKey];
          if (!def) return null;
          const value = kpis[def.key];
          return (
            <div
              key={metricKey}
              className="rounded-lg p-4"
              style={{
                backgroundColor: cardBg,
                border: `1px solid ${borderColor}`,
              }}
            >
              <div
                className="text-[11px] font-medium uppercase tracking-wide mb-1"
                style={{ color: mutedText }}
              >
                {def.label}
              </div>
              <div
                className="text-xl font-bold tabular-nums"
                style={{ color: accentColor }}
              >
                {typeof value === 'number' ? def.format(value) : '--'}
              </div>
            </div>
          );
        })}
      </div>
      <div
        className="text-center text-[10px] mt-3"
        style={{ color: mutedText }}
      >
        Powered by Delta Intelligence
      </div>
    </div>
  );
}

export default function EmbedKpiPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <EmbedKpiContent />
    </Suspense>
  );
}
