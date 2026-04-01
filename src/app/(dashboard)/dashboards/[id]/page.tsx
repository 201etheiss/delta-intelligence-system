'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Pencil, Plus, Trash2, ArrowLeft, Save, X, Hash, Table, BarChart3, List, Type } from 'lucide-react';
import type { Dashboard, Widget, WidgetType } from '@/lib/widgets';
import { WIDGET_TYPES } from '@/lib/widgets';

// ─── Widget Renderer ──────────────────────────────────────────────

function WidgetCard({
  widget,
  editing,
  onRemove,
}: {
  widget: Widget;
  editing: boolean;
  onRemove: () => void;
}) {
  const typeIcons: Record<WidgetType, typeof Hash> = {
    kpi: Hash,
    table: Table,
    'bar-chart': BarChart3,
    list: List,
    text: Type,
  };
  const Icon = typeIcons[widget.type] ?? Hash;

  return (
    <div
      className="relative rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 flex flex-col"
      style={{
        gridColumn: `span ${widget.position.w}`,
        gridRow: `span ${widget.position.h}`,
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Icon size={14} className="text-[#A1A1AA]" />
          <h4 className="text-xs font-semibold text-[#09090B] dark:text-white">{widget.title}</h4>
        </div>
        {editing && (
          <button
            onClick={onRemove}
            className="p-1 rounded hover:bg-red-50 text-[#A1A1AA] hover:text-red-500 transition-colors"
            title="Remove widget"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>

      {/* Content placeholder */}
      <div className="flex-1 flex items-center justify-center rounded bg-[#FAFAFA] dark:bg-[#09090B] border border-dashed border-[#E4E4E7] dark:border-[#27272A] min-h-[60px]">
        {widget.type === 'kpi' && (
          <div className="text-center">
            <div className="text-lg font-bold text-[#09090B] dark:text-white tabular-nums">--</div>
            <div className="text-[10px] text-[#A1A1AA] mt-0.5">
              {widget.config.endpoint ?? 'No endpoint'}
            </div>
          </div>
        )}
        {widget.type === 'table' && (
          <div className="text-xs text-[#A1A1AA]">
            Table: {widget.config.endpoint ?? 'No endpoint'} (max {widget.config.maxRows ?? 25} rows)
          </div>
        )}
        {widget.type === 'bar-chart' && (
          <div className="text-xs text-[#A1A1AA]">
            Bar Chart: {widget.config.endpoint ?? 'No endpoint'}
          </div>
        )}
        {widget.type === 'list' && (
          <div className="text-xs text-[#A1A1AA]">
            List: {widget.config.endpoint ?? 'No endpoint'}
          </div>
        )}
        {widget.type === 'text' && (
          <div className="text-xs text-[#71717A] dark:text-[#A1A1AA] px-2">
            {widget.config.textContent ?? 'Empty text block'}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Add Widget Dialog ────────────────────────────────────────────

function AddWidgetDialog({
  onAdd,
  onCancel,
}: {
  onAdd: (type: WidgetType, title: string, endpoint: string) => void;
  onCancel: () => void;
}) {
  const [selectedType, setSelectedType] = useState<WidgetType>('kpi');
  const [title, setTitle] = useState('');
  const [endpoint, setEndpoint] = useState('');

  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 mb-2.5">
      <h3 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2.5">Add Widget</h3>

      {/* Type selector */}
      <div className="mb-2.5">
        <label className="block text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-2">Widget Type</label>
        <div className="flex flex-wrap gap-2">
          {WIDGET_TYPES.map((wt) => (
            <button
              key={wt.type}
              onClick={() => setSelectedType(wt.type)}
              className={[
                'rounded-md px-3 py-1.5 text-xs font-medium border transition-colors',
                selectedType === wt.type
                  ? 'border-[#FE5000] bg-[#FE5000]/10 text-[#FE5000]'
                  : 'border-[#E4E4E7] dark:border-[#27272A] text-[#71717A] dark:text-[#A1A1AA] hover:border-[#A1A1AA]',
              ].join(' ')}
            >
              {wt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="mb-2">
        <label className="block text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-1">Title</label>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Widget title..."
          className="w-full rounded-md border border-[#E4E4E7] dark:border-[#27272A] px-3 py-2 text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] outline-none focus:border-[#FE5000]"
        />
      </div>

      {/* Endpoint */}
      {selectedType !== 'text' && (
        <div className="mb-2.5">
          <label className="block text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-1">Gateway Endpoint</label>
          <input
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            placeholder="/ascend/ar/aging"
            className="w-full rounded-md border border-[#E4E4E7] dark:border-[#27272A] px-3 py-2 text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] outline-none focus:border-[#FE5000] font-mono"
          />
        </div>
      )}

      <div className="flex items-center gap-2">
        <button
          onClick={() => onAdd(selectedType, title, endpoint)}
          disabled={!title.trim()}
          className="rounded-md px-4 py-2 text-sm font-medium bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Add Widget
        </button>
        <button
          onClick={onCancel}
          className="rounded-md px-4 py-2 text-sm font-medium text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ─── Main Dashboard Viewer ────────────────────────────────────────

export default function DashboardViewPage() {
  const params = useParams();
  const router = useRouter();
  const dashboardId = params.id as string;

  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editedWidgets, setEditedWidgets] = useState<Widget[]>([]);

  const fetchDashboard = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboards');
      const data = await res.json();
      const found = (data.dashboards ?? []).find(
        (d: Dashboard) => d.id === dashboardId
      );
      if (found) {
        setDashboard(found);
        setEditedWidgets(found.widgets);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [dashboardId]);

  useEffect(() => {
    fetchDashboard();
  }, [fetchDashboard]);

  const handleSave = async () => {
    if (!dashboard) return;
    setSaving(true);
    try {
      const res = await fetch('/api/dashboards', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: dashboard.id, widgets: editedWidgets }),
      });
      if (res.ok) {
        const data = await res.json();
        setDashboard(data.dashboard);
        setEditing(false);
      }
    } catch {
      // silently fail
    } finally {
      setSaving(false);
    }
  };

  const handleAddWidget = (type: WidgetType, title: string, endpoint: string) => {
    const meta = WIDGET_TYPES.find((wt) => wt.type === type);
    const maxY = editedWidgets.reduce(
      (max, w) => Math.max(max, w.position.y + w.position.h),
      0
    );
    const newWidget: Widget = {
      id: `w-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
      type,
      title,
      config: type === 'text' ? { textContent: '' } : { endpoint },
      position: {
        x: 0,
        y: maxY,
        w: meta?.defaultSize.w ?? 4,
        h: meta?.defaultSize.h ?? 1,
      },
    };
    setEditedWidgets([...editedWidgets, newWidget]);
    setAdding(false);
  };

  const handleRemoveWidget = (widgetId: string) => {
    setEditedWidgets(editedWidgets.filter((w) => w.id !== widgetId));
  };

  const handleCancelEdit = () => {
    setEditedWidgets(dashboard?.widgets ?? []);
    setEditing(false);
    setAdding(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full bg-[#FAFAFA] dark:bg-[#09090B]">
        <div className="text-sm text-[#A1A1AA]">Loading dashboard...</div>
      </div>
    );
  }

  if (!dashboard) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-[#FAFAFA] dark:bg-[#09090B]">
        <div className="text-sm text-[#71717A] dark:text-[#A1A1AA] mb-2">Dashboard not found</div>
        <button
          onClick={() => router.push('/dashboards')}
          className="text-sm text-[#FE5000] hover:underline"
        >
          Back to Dashboards
        </button>
      </div>
    );
  }

  const displayWidgets = editing ? editedWidgets : dashboard.widgets;

  return (
    <div className="h-full overflow-y-auto bg-[#FAFAFA] dark:bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push('/dashboards')}
              className="p-1.5 rounded-md hover:bg-[#F4F4F5] dark:bg-[#27272A] text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white transition-colors"
              title="Back to dashboards"
            >
              <ArrowLeft size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-[#09090B] dark:text-white">{dashboard.name}</h1>
              {dashboard.description && (
                <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5">{dashboard.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setAdding(true)}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-[#E4E4E7] dark:border-[#27272A] text-[#71717A] dark:text-[#A1A1AA] hover:border-[#FE5000] hover:text-[#FE5000] transition-colors"
                >
                  <Plus size={14} />
                  Add Widget
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
                >
                  <Save size={14} />
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button
                  onClick={handleCancelEdit}
                  className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white transition-colors"
                >
                  <X size={14} />
                  Cancel
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-[#E4E4E7] dark:border-[#27272A] text-[#71717A] dark:text-[#A1A1AA] hover:border-[#FE5000] hover:text-[#FE5000] transition-colors"
              >
                <Pencil size={14} />
                Edit
              </button>
            )}
          </div>
        </div>

        {/* Add widget dialog */}
        {editing && adding && (
          <AddWidgetDialog
            onAdd={handleAddWidget}
            onCancel={() => setAdding(false)}
          />
        )}

        {/* Widget grid */}
        {displayWidgets.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="text-sm text-[#71717A] dark:text-[#A1A1AA] mb-2">No widgets yet</div>
            <p className="text-xs text-[#A1A1AA] mb-2.5">
              Click Edit, then Add Widget to build your dashboard.
            </p>
            {!editing && (
              <button
                onClick={() => setEditing(true)}
                className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
              >
                <Pencil size={14} />
                Start Editing
              </button>
            )}
          </div>
        ) : (
          <div
            className="grid gap-3"
            style={{ gridTemplateColumns: 'repeat(12, 1fr)' }}
          >
            {displayWidgets.map((widget) => (
              <WidgetCard
                key={widget.id}
                widget={widget}
                editing={editing}
                onRemove={() => handleRemoveWidget(widget.id)}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
