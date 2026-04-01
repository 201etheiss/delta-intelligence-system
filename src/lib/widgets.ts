/**
 * Widget Type System for the Dashboard Builder (Phase 4)
 *
 * Defines the widget types, configuration schema, and dashboard structure
 * used by the custom dashboard builder.
 */

// ─── Widget Types ─────────────────────────────────────────────────

export type WidgetType = 'kpi' | 'table' | 'bar-chart' | 'list' | 'text';

export interface WidgetConfig {
  endpoint?: string;        // gateway endpoint to fetch data
  sql?: string;             // raw SQL for POST /ascend/query
  field?: string;           // which field to display (for KPI)
  refreshInterval?: number; // seconds between refreshes (0 = no auto-refresh)
  maxRows?: number;         // for tables and lists
  textContent?: string;     // for text widgets (markdown)
  barField?: string;        // field for bar chart x-axis labels
  barValue?: string;        // field for bar chart y-axis values
}

export interface WidgetPosition {
  x: number;  // column (0-based, 12-column grid)
  y: number;  // row (0-based)
  w: number;  // width in columns
  h: number;  // height in rows
}

export interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  config: WidgetConfig;
  position: WidgetPosition;
}

// ─── Dashboard Types ──────────────────────────────────────────────

export type DashboardVisibility = 'private' | 'team' | 'public';

export interface Dashboard {
  id: string;
  name: string;
  description: string;
  widgets: Widget[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  isDefault: boolean;
  visibility: DashboardVisibility;
}

// ─── Widget Type Metadata ─────────────────────────────────────────

export interface WidgetTypeMeta {
  type: WidgetType;
  label: string;
  description: string;
  icon: string;
  defaultSize: { w: number; h: number };
}

export const WIDGET_TYPES: WidgetTypeMeta[] = [
  {
    type: 'kpi',
    label: 'KPI Card',
    description: 'Single metric with label',
    icon: 'Hash',
    defaultSize: { w: 3, h: 1 },
  },
  {
    type: 'table',
    label: 'Data Table',
    description: 'Sortable table from endpoint data',
    icon: 'Table',
    defaultSize: { w: 6, h: 2 },
  },
  {
    type: 'bar-chart',
    label: 'Bar Chart',
    description: 'Bar chart visualization',
    icon: 'BarChart3',
    defaultSize: { w: 6, h: 2 },
  },
  {
    type: 'list',
    label: 'List',
    description: 'Scrollable list of items',
    icon: 'List',
    defaultSize: { w: 4, h: 2 },
  },
  {
    type: 'text',
    label: 'Text Block',
    description: 'Static markdown text or notes',
    icon: 'Type',
    defaultSize: { w: 4, h: 1 },
  },
];

// ─── Helpers ──────────────────────────────────────────────────────

export function getWidgetTypeMeta(type: WidgetType): WidgetTypeMeta | undefined {
  return WIDGET_TYPES.find((wt) => wt.type === type);
}

export function createWidget(
  type: WidgetType,
  title: string,
  config: WidgetConfig,
  position: WidgetPosition
): Widget {
  const id = `w-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return { id, type, title, config, position };
}

export function createDashboard(
  name: string,
  description: string,
  createdBy: string,
  visibility: DashboardVisibility = 'private'
): Dashboard {
  const now = new Date().toISOString();
  const id = `dash-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
  return {
    id,
    name,
    description,
    widgets: [],
    createdBy,
    createdAt: now,
    updatedAt: now,
    isDefault: false,
    visibility,
  };
}
