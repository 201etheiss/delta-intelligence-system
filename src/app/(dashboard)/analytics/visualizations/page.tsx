'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  BarChart3,
  PieChart as PieChartIcon,
  TrendingUp,
  LayoutGrid,
  Maximize2,
  X,
  Search,
  Play,
  Zap,
  Grid3X3,
  TreePine,
  Settings2,
  Eye,
} from 'lucide-react';
import LiveWidget from '@/components/dashboard/LiveWidget';
import type { LiveWidgetConfig, WidgetDisplayType } from '@/components/dashboard/LiveWidget';
import { WIDGET_CATALOG } from '@/lib/widget-catalog';
import type { WidgetCatalogItem, WidgetCatalogCategory } from '@/lib/widget-catalog';

// ── Types ──────────────────────────────────────────────────────

type ChartTypeOption = {
  id: WidgetDisplayType;
  label: string;
  icon: typeof BarChart3;
  description: string;
};

const CHART_TYPES: ChartTypeOption[] = [
  { id: 'chart', label: 'Bar Chart', icon: BarChart3, description: 'Compare values across categories' },
  { id: 'area', label: 'Area Chart', icon: TrendingUp, description: 'Show trends over time with filled area' },
  { id: 'pie', label: 'Donut Chart', icon: PieChartIcon, description: 'Show proportional distribution' },
  { id: 'stackedbar', label: 'Stacked Bar', icon: LayoutGrid, description: 'Compare multiple series stacked' },
  { id: 'sparkline', label: 'Sparkline', icon: Zap, description: 'Compact inline trend indicator' },
  { id: 'heatmap', label: 'Heatmap', icon: Grid3X3, description: 'Activity/intensity grid view' },
  { id: 'treemap', label: 'Treemap', icon: TreePine, description: 'Hierarchical proportional view' },
  { id: 'gauge', label: 'Gauge', icon: Eye, description: 'Percentage/progress indicator' },
  { id: 'kpi', label: 'KPI Card', icon: Settings2, description: 'Single value with trend' },
];

const CATEGORY_LABELS: Record<WidgetCatalogCategory | 'all', string> = {
  all: 'All',
  financial: 'Financial',
  sales: 'Sales',
  fleet: 'Fleet',
  operations: 'Operations',
  custom: 'Custom',
};

// ── Gallery items — pre-built visualizations ───────────────────

interface GalleryItem {
  id: string;
  title: string;
  description: string;
  domain: 'financial' | 'operations' | 'sales' | 'hr';
  config: LiveWidgetConfig;
}

const YEAR = new Date().getFullYear();

const GALLERY_ITEMS: GalleryItem[] = [
  // Financial
  {
    id: 'gallery-revenue-trend',
    title: 'Revenue Trend (12 Months)',
    description: 'Monthly revenue progression across the current fiscal year.',
    domain: 'financial',
    config: {
      id: 'gallery-revenue-trend',
      type: 'area',
      title: `Revenue Trend ${YEAR}`,
      query: { sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND AccountGroup = 'Revenue' AND Period BETWEEN 1 AND 12 GROUP BY Period ORDER BY Period` },
      labelKey: 'Month',
      valueKey: 'Revenue',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-gp-margin-area',
    title: 'GP Margin Trend',
    description: 'Gross profit margin trajectory over recent periods.',
    domain: 'financial',
    config: {
      id: 'gallery-gp-margin-area',
      type: 'area',
      title: 'GP Margin Trend',
      query: { sql: `SELECT Period AS Month, SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY Period ORDER BY Period` },
      labelKey: 'Month',
      valueKey: 'GP',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-ar-aging-donut',
    title: 'AR Aging Distribution',
    description: 'Receivables breakdown across 0-30, 31-60, 61-90, and 90+ day buckets.',
    domain: 'financial',
    config: {
      id: 'gallery-ar-aging-donut',
      type: 'pie',
      title: 'AR Aging',
      query: { sql: `SELECT '0-30' AS Bucket, SUM(ADOTotalStillDue) AS Amount FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) <= 30 UNION ALL SELECT '31-60', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 31 AND 60 UNION ALL SELECT '61-90', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 61 AND 90 UNION ALL SELECT '90+', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90` },
      labelKey: 'Bucket',
      valueKey: 'Amount',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-budget-vs-actual',
    title: 'Budget vs Actual',
    description: 'Revenue and COGS comparison by period.',
    domain: 'financial',
    config: {
      id: 'gallery-budget-vs-actual',
      type: 'stackedbar',
      title: `Budget vs Actual ${YEAR}`,
      query: { sql: `SELECT Period AS Month, SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) AS Revenue, SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS COGS FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 GROUP BY Period ORDER BY Period` },
      labelKey: 'Month',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-cashflow-area',
    title: 'Cash Flow Forecast',
    description: 'Projected cash flow based on recent revenue trajectory.',
    domain: 'financial',
    config: {
      id: 'gallery-cashflow-area',
      type: 'area',
      title: 'Cash Flow',
      query: { sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS CashFlow FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue' GROUP BY Period ORDER BY Period` },
      labelKey: 'Month',
      valueKey: 'CashFlow',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  // Operations
  {
    id: 'gallery-fleet-util',
    title: 'Fleet Utilization',
    description: 'Current fleet utilization as a percentage of dispatched vehicles.',
    domain: 'operations',
    config: {
      id: 'gallery-fleet-util',
      type: 'gauge',
      title: 'Fleet Utilization',
      endpoint: '/samsara/vehicles',
      countArray: true,
      format: 'percent',
      subtitle: 'Dispatched vs total',
      refreshInterval: 300,
    },
  },
  {
    id: 'gallery-vehicle-status',
    title: 'Vehicle Status',
    description: 'Distribution of vehicle statuses across the fleet.',
    domain: 'operations',
    config: {
      id: 'gallery-vehicle-status',
      type: 'pie',
      title: 'Vehicle Status',
      endpoint: '/samsara/vehicles',
      labelKey: 'status',
      valueKey: 'count',
      format: 'number',
      refreshInterval: 300,
    },
  },
  {
    id: 'gallery-fuel-costs',
    title: 'Fuel Costs by Month',
    description: 'Monthly fuel expenditure trend for the current year.',
    domain: 'operations',
    config: {
      id: 'gallery-fuel-costs',
      type: 'chart',
      title: 'Fuel Costs by Month',
      query: { sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS FuelCost FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND Account_Desc LIKE '%Fuel%' GROUP BY Period ORDER BY Period` },
      chartType: 'bar',
      labelKey: 'Month',
      valueKey: 'FuelCost',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  // Sales
  {
    id: 'gallery-pipeline-stage',
    title: 'Pipeline by Stage',
    description: 'Open pipeline value broken down by sales stage.',
    domain: 'sales',
    config: {
      id: 'gallery-pipeline-stage',
      type: 'stackedbar',
      title: 'Pipeline by Stage',
      query: { soql: 'SELECT StageName, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY total DESC' },
      labelKey: 'StageName',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-rev-by-rep',
    title: 'Revenue by Rep',
    description: 'Closed-won revenue attributed to each sales rep this year.',
    domain: 'sales',
    config: {
      id: 'gallery-rev-by-rep',
      type: 'chart',
      title: 'Revenue by Rep',
      query: { soql: `SELECT Owner.Name, SUM(Amount) total FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR} GROUP BY Owner.Name ORDER BY total DESC LIMIT 10` },
      chartType: 'bar',
      labelKey: 'Name',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'gallery-winrate-trend',
    title: 'Win Rate Trend',
    description: 'Win/loss ratio for closed deals this year.',
    domain: 'sales',
    config: {
      id: 'gallery-winrate-trend',
      type: 'pie',
      title: 'Win/Loss Ratio',
      query: { soql: `SELECT CASE WHEN IsWon = true THEN 'Won' ELSE 'Lost' END AS Result, COUNT(Id) cnt FROM Opportunity WHERE IsClosed = true AND CALENDAR_YEAR(CloseDate) = ${YEAR} GROUP BY IsWon` },
      labelKey: 'Result',
      valueKey: 'cnt',
      format: 'number',
      refreshInterval: 3600,
    },
  },
  // HR
  {
    id: 'gallery-headcount-dept',
    title: 'Headcount by Department',
    description: 'Employee distribution across departments.',
    domain: 'hr',
    config: {
      id: 'gallery-headcount-dept',
      type: 'pie',
      title: 'Headcount by Dept',
      endpoint: '/paylocity/codes/departments',
      labelKey: 'description',
      valueKey: 'code',
      format: 'number',
      refreshInterval: 3600,
    },
  },
];

const DOMAIN_COLORS: Record<string, string> = {
  financial: '#FE5000',
  operations: '#3B82F6',
  sales: '#10B981',
  hr: '#8B5CF6',
};

// ── Chart Builder ──────────────────────────────────────────────

function ChartBuilder() {
  const [selectedType, setSelectedType] = useState<WidgetDisplayType>('chart');
  const [sqlQuery, setSqlQuery] = useState('');
  const [labelKey, setLabelKey] = useState('label');
  const [valueKey, setValueKey] = useState('value');
  const [title, setTitle] = useState('Custom Chart');
  const [preview, setPreview] = useState<LiveWidgetConfig | null>(null);

  const handlePreview = useCallback(() => {
    if (!sqlQuery.trim()) return;
    setPreview({
      id: `custom-${Date.now()}`,
      type: selectedType,
      title,
      query: { sql: sqlQuery },
      labelKey,
      valueKey,
      format: 'number',
      refreshInterval: 0,
    });
  }, [selectedType, sqlQuery, labelKey, valueKey, title]);

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
      <div className="px-5 py-4 border-b border-[#27272A]">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Settings2 size={14} className="text-[#FE5000]" />
          Chart Builder
        </h3>
        <p className="text-[11px] text-[#71717A] mt-0.5">Build custom visualizations from SQL queries</p>
      </div>

      <div className="p-5 space-y-4">
        {/* Chart type selector */}
        <div>
          <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide block mb-2">Chart Type</label>
          <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-1.5">
            {CHART_TYPES.map((ct) => {
              const Icon = ct.icon;
              const isActive = selectedType === ct.id;
              return (
                <button
                  key={ct.id}
                  onClick={() => setSelectedType(ct.id)}
                  title={ct.description}
                  className={[
                    'flex flex-col items-center gap-1 rounded-md px-2 py-2 text-[10px] font-medium transition-colors border',
                    isActive
                      ? 'border-[#FE5000] bg-[#FE5000]/10 text-[#FE5000]'
                      : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]',
                  ].join(' ')}
                >
                  <Icon size={14} />
                  {ct.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide block mb-1">Title</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-[#27272A] bg-[#09090B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors"
            placeholder="Chart title"
          />
        </div>

        {/* SQL query input */}
        <div>
          <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide block mb-1">SQL Query</label>
          <textarea
            value={sqlQuery}
            onChange={(e) => setSqlQuery(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 rounded-md border border-[#27272A] bg-[#09090B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors font-mono resize-none"
            placeholder="SELECT Period AS label, SUM(Amount) AS value FROM ... GROUP BY ..."
          />
        </div>

        {/* Axis config */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide block mb-1">Label Key (X-Axis)</label>
            <input
              value={labelKey}
              onChange={(e) => setLabelKey(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[#27272A] bg-[#09090B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors font-mono"
              placeholder="label"
            />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-[#71717A] uppercase tracking-wide block mb-1">Value Key (Y-Axis)</label>
            <input
              value={valueKey}
              onChange={(e) => setValueKey(e.target.value)}
              className="w-full px-3 py-2 rounded-md border border-[#27272A] bg-[#09090B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors font-mono"
              placeholder="value"
            />
          </div>
        </div>

        {/* Preview button */}
        <button
          onClick={handlePreview}
          disabled={!sqlQuery.trim()}
          className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          <Play size={14} />
          Generate Preview
        </button>

        {/* Preview area */}
        {preview && (
          <div className="mt-2">
            <LiveWidget config={preview} role="admin" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Full-screen modal ──────────────────────────────────────────

function FullScreenChart({ config, onClose }: { config: LiveWidgetConfig; onClose: () => void }) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center px-5 py-4">
      <div className="relative w-full max-w-4xl rounded-lg border border-[#27272A] bg-[#09090B] shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#27272A]">
          <h3 className="text-sm font-bold text-white">{config.title}</h3>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#52525B] hover:text-white hover:bg-[#27272A] transition-colors"
          >
            <X size={16} />
          </button>
        </div>
        <div className="px-5 py-4">
          <LiveWidget config={{ ...config, id: `fullscreen-${config.id}` }} role="admin" />
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────

export default function VisualizationsPage() {
  const [activeTab, setActiveTab] = useState<'gallery' | 'builder' | 'catalog'>('gallery');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeDomain, setActiveDomain] = useState<string>('all');
  const [activeCategory, setActiveCategory] = useState<WidgetCatalogCategory | 'all'>('all');
  const [fullScreenConfig, setFullScreenConfig] = useState<LiveWidgetConfig | null>(null);

  // Filter gallery items
  const filteredGallery = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return GALLERY_ITEMS.filter((item) => {
      if (activeDomain !== 'all' && item.domain !== activeDomain) return false;
      if (q && !item.title.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [searchQuery, activeDomain]);

  // Filter catalog for the catalog tab
  const filteredCatalog = useMemo(() => {
    const q = searchQuery.toLowerCase();
    return WIDGET_CATALOG.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) return false;
      // Only show visual chart types in catalog tab
      const visualTypes: WidgetDisplayType[] = ['chart', 'pie', 'area', 'stackedbar', 'sparkline', 'heatmap', 'treemap', 'gauge'];
      if (!visualTypes.includes(item.type)) return false;
      return true;
    });
  }, [searchQuery, activeCategory]);

  const domains = ['all', 'financial', 'operations', 'sales', 'hr'];
  const categories: (WidgetCatalogCategory | 'all')[] = ['all', 'financial', 'sales', 'fleet', 'operations', 'custom'];

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-[#09090B]">
      {fullScreenConfig && (
        <FullScreenChart config={fullScreenConfig} onClose={() => setFullScreenConfig(null)} />
      )}

      {/* Header */}
      <div>
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <BarChart3 size={20} className="text-[#FE5000]" />
          Visualization Portal
        </h2>
        <p className="mt-0.5 text-sm text-[#71717A]">
          Interactive charts, pre-built dashboards, and custom chart builder.
        </p>
      </div>

      {/* Tab switcher */}
      <div className="flex items-center gap-1 border-b border-[#27272A] pb-0">
        {(['gallery', 'builder', 'catalog'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={[
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-[1px]',
              activeTab === tab
                ? 'border-[#FE5000] text-[#FE5000]'
                : 'border-transparent text-[#71717A] hover:text-[#A1A1AA]',
            ].join(' ')}
          >
            {tab === 'gallery' ? 'Gallery' : tab === 'builder' ? 'Chart Builder' : 'Widget Catalog'}
          </button>
        ))}
      </div>

      {/* Search bar */}
      <div className="relative max-w-md">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search visualizations..."
          className="w-full pl-9 pr-3 py-2 rounded-md border border-[#27272A] bg-[#18181B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors"
        />
      </div>

      {/* Gallery Tab */}
      {activeTab === 'gallery' && (
        <>
          {/* Domain filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {domains.map((d) => (
              <button
                key={d}
                onClick={() => setActiveDomain(d)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                  activeDomain === d
                    ? 'border-[#FE5000] bg-[#FE5000]/10 text-[#FE5000]'
                    : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]',
                ].join(' ')}
              >
                {d === 'all' ? 'All Domains' : d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>

          {/* Gallery grid */}
          {filteredGallery.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#52525B]">No visualizations match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredGallery.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden hover:border-[#3F3F46] transition-colors group"
                >
                  {/* Chart preview */}
                  <div className="relative">
                    <LiveWidget config={item.config} role="admin" />
                    {/* Expand overlay */}
                    <button
                      onClick={() => setFullScreenConfig(item.config)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-[#09090B]/80 text-[#52525B] opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                      title="Expand to full screen"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                  {/* Card footer */}
                  <div className="px-3 py-2 border-t border-[#27272A]">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: DOMAIN_COLORS[item.domain] ?? '#71717A' }}
                      />
                      <span className="text-[10px] font-medium text-[#71717A] uppercase tracking-wide">
                        {item.domain}
                      </span>
                    </div>
                    <h4 className="text-xs font-semibold text-white">{item.title}</h4>
                    <p className="text-[10px] text-[#52525B] mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Builder Tab */}
      {activeTab === 'builder' && <ChartBuilder />}

      {/* Catalog Tab */}
      {activeTab === 'catalog' && (
        <>
          {/* Category filter pills */}
          <div className="flex items-center gap-2 flex-wrap">
            {categories.map((c) => (
              <button
                key={c}
                onClick={() => setActiveCategory(c)}
                className={[
                  'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
                  activeCategory === c
                    ? 'border-[#FE5000] bg-[#FE5000]/10 text-[#FE5000]'
                    : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]',
                ].join(' ')}
              >
                {CATEGORY_LABELS[c]}
              </button>
            ))}
          </div>

          {/* Catalog grid */}
          {filteredCatalog.length === 0 ? (
            <div className="text-center py-12 text-sm text-[#52525B]">No chart widgets match your search.</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {filteredCatalog.map((item) => (
                <div
                  key={item.id}
                  className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden hover:border-[#3F3F46] transition-colors group"
                >
                  <div className="relative">
                    <LiveWidget config={item.config} role="admin" />
                    <button
                      onClick={() => setFullScreenConfig(item.config)}
                      className="absolute top-2 right-2 p-1.5 rounded-md bg-[#09090B]/80 text-[#52525B] opacity-0 group-hover:opacity-100 hover:text-white transition-all"
                      title="Expand to full screen"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                  <div className="px-3 py-2 border-t border-[#27272A]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-medium text-[#71717A] uppercase tracking-wide bg-[#27272A] rounded px-1.5 py-0.5">
                        {item.type}
                      </span>
                      <span className="text-[10px] text-[#52525B]">{item.category}</span>
                    </div>
                    <h4 className="text-xs font-semibold text-white">{item.name}</h4>
                    <p className="text-[10px] text-[#52525B] mt-0.5 line-clamp-2">{item.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
