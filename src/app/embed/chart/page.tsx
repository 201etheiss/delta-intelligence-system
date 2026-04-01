'use client';

import { Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import LiveWidget from '@/components/dashboard/LiveWidget';
import type { LiveWidgetConfig, WidgetDisplayType } from '@/components/dashboard/LiveWidget';
import { getCatalogItem } from '@/lib/widget-catalog';

/**
 * Embeddable chart widget for iframes, Teams, Slack, and email digests.
 *
 * Usage:
 *   /embed/chart?catalogId=cat-fin-rev-trend-area&theme=dark
 *   /embed/chart?type=area&title=Revenue&sql=SELECT...&labelKey=Month&valueKey=Revenue&theme=light
 *
 * Query params:
 *   catalogId  — look up from WIDGET_CATALOG
 *   type       — chart type (bar, line, pie, area, stackedbar, sparkline, heatmap, treemap, gauge, kpi)
 *   title      — chart title
 *   sql        — SQL query
 *   soql       — SOQL query (Salesforce)
 *   endpoint   — gateway GET path
 *   labelKey   — x-axis / label field
 *   valueKey   — y-axis / value field
 *   format     — number | currency | percent | price
 *   theme      — dark (default) | light
 *   refresh    — auto-refresh interval in seconds
 */

function EmbedChartContent() {
  const params = useSearchParams();
  const theme = params.get('theme') ?? 'dark';
  const catalogId = params.get('catalogId');

  const isDark = theme === 'dark';
  const bg = isDark ? '#09090B' : '#FFFFFF';

  // If catalogId provided, look up the config
  if (catalogId) {
    const item = getCatalogItem(catalogId);
    if (!item) {
      return (
        <div className="flex items-center justify-center h-full text-sm" style={{ backgroundColor: bg, color: '#EF4444' }}>
          Widget not found: {catalogId}
        </div>
      );
    }
    return (
      <div className="p-3 h-full overflow-auto" style={{ backgroundColor: bg }}>
        <LiveWidget config={item.config} role="admin" />
        <div className="text-center text-[10px] mt-2" style={{ color: isDark ? '#52525B' : '#A1A1AA' }}>
          Powered by Delta Intelligence
        </div>
      </div>
    );
  }

  // Build config from query params
  const type = (params.get('type') ?? 'chart') as WidgetDisplayType;
  const title = params.get('title') ?? 'Chart';
  const sql = params.get('sql');
  const soql = params.get('soql');
  const endpoint = params.get('endpoint');
  const labelKey = params.get('labelKey') ?? 'label';
  const valueKey = params.get('valueKey') ?? 'value';
  const format = params.get('format') as LiveWidgetConfig['format'] | null;
  const refresh = params.get('refresh');

  if (!sql && !soql && !endpoint) {
    return (
      <div className="flex items-center justify-center h-full text-sm" style={{ backgroundColor: bg, color: '#EF4444' }}>
        Missing required param: sql, soql, or endpoint
      </div>
    );
  }

  const config: LiveWidgetConfig = {
    id: `embed-${Date.now()}`,
    type,
    title,
    labelKey,
    valueKey,
    format: format ?? undefined,
    refreshInterval: refresh ? parseInt(refresh, 10) : 300,
  };

  if (sql) {
    config.query = { sql };
  } else if (soql) {
    config.query = { soql };
  } else if (endpoint) {
    config.endpoint = endpoint;
  }

  return (
    <div className="p-3 h-full overflow-auto" style={{ backgroundColor: bg }}>
      <LiveWidget config={config} role="admin" />
      <div className="text-center text-[10px] mt-2" style={{ color: isDark ? '#52525B' : '#A1A1AA' }}>
        Powered by Delta Intelligence
      </div>
    </div>
  );
}

export default function EmbedChartPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-zinc-400">
          Loading chart...
        </div>
      }
    >
      <EmbedChartContent />
    </Suspense>
  );
}
