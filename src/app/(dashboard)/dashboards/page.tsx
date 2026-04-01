'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import {
  PanelLeft,
  Plus,
  Clock,
  User,
  LayoutGrid,
  Pencil,
  Trash2,
  X,
  RefreshCw,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import LiveWidget from '@/components/dashboard/LiveWidget';
import { ROLES, getUserRole } from '@/lib/config/roles';
import { WIDGET_CATALOG, getCatalogItem } from '@/lib/widget-catalog';

// Dynamically import the modal to avoid SSR issues
const WidgetPicker = dynamic(() => import('@/components/dashboard/WidgetPicker'), {
  ssr: false,
});

// ── Shared types ──────────────────────────────────────────────────

interface PickedWidget {
  catalogId: string;
  size: 'sm' | 'md' | 'lg';
}

interface ApiDashboard {
  id: string;
  userEmail: string;
  name: string;
  widgets: Array<{ catalogId: string; position: number; size: 'sm' | 'md' | 'lg' }>;
  createdAt: string;
  updatedAt: string;
}

type UserDashboard = ApiDashboard;

// ── Size → column span mapping ────────────────────────────────────

const SIZE_COLS: Record<string, string> = {
  sm: 'col-span-1',
  md: 'col-span-2',
  lg: 'col-span-4',
};

// ── Dashboard card (list view) ─────────────────────────────────────

interface DashboardCardProps {
  dashboard: UserDashboard;
  onOpen: (d: UserDashboard) => void;
  onDelete: (id: string) => void;
}

function DashboardCard({ dashboard, onOpen, onDelete }: DashboardCardProps) {
  const widgetCount = dashboard.widgets.length;
  const updatedAt = new Date(dashboard.updatedAt).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return (
    <div className="group rounded-lg border border-[#27272A] bg-[#18181B] p-3.5 hover:border-[#FE5000]/40 hover:shadow-sm transition-all">
      <div className="flex items-start justify-between mb-2">
        <button
          onClick={() => onOpen(dashboard)}
          className="flex items-center gap-2 min-w-0 flex-1"
        >
          <div className="flex items-center justify-center w-8 h-8 rounded-md bg-[#27272A] group-hover:bg-[#FE5000]/10 transition-colors shrink-0">
            <PanelLeft size={16} className="text-[#A1A1AA] group-hover:text-[#FE5000] transition-colors" />
          </div>
          <h3 className="text-xs font-semibold text-white group-hover:text-[#FE5000] transition-colors text-left truncate">
            {dashboard.name}
          </h3>
        </button>
        <button
          onClick={() => onDelete(dashboard.id)}
          className="ml-2 p-1.5 rounded text-[#52525B] hover:text-red-400 hover:bg-red-900/20 transition-colors shrink-0 opacity-0 group-hover:opacity-100"
          title="Delete dashboard"
        >
          <Trash2 size={13} />
        </button>
      </div>

      <div className="flex items-center gap-3 text-[11px] text-[#A1A1AA]">
        <span className="inline-flex items-center gap-1">
          <LayoutGrid size={11} />
          {widgetCount} widget{widgetCount !== 1 ? 's' : ''}
        </span>
        <span className="inline-flex items-center gap-1">
          <Clock size={11} />
          {updatedAt}
        </span>
        <span className="inline-flex items-center gap-1">
          <User size={11} />
          {dashboard.userEmail.split('@')[0]}
        </span>
      </div>
    </div>
  );
}

// ── Active dashboard view ─────────────────────────────────────────

interface ActiveDashboardProps {
  dashboard: UserDashboard;
  role: string;
  roleServices: string[];
  onEdit: () => void;
  onClose: () => void;
}

function ActiveDashboardView({
  dashboard,
  role,
  roleServices,
  onEdit,
  onClose,
}: ActiveDashboardProps) {
  const sorted = [...dashboard.widgets].sort((a, b) => a.position - b.position);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1.5 rounded-md text-[#71717A] hover:text-white hover:bg-[#27272A] transition-colors"
              title="Back to dashboards"
            >
              <X size={18} />
            </button>
            <div>
              <h1 className="text-lg font-bold text-white">{dashboard.name}</h1>
              <p className="text-xs text-[#71717A] mt-0.5">
                {sorted.length} widget{sorted.length !== 1 ? 's' : ''} — auto-refreshing
              </p>
            </div>
          </div>
          <button
            onClick={onEdit}
            className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium border border-[#27272A] text-[#A1A1AA] hover:border-[#FE5000] hover:text-[#FE5000] transition-colors"
          >
            <Pencil size={13} />
            Edit
          </button>
        </div>

        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <LayoutGrid size={32} className="text-[#27272A] mb-2" />
            <p className="text-sm text-[#52525B] mb-2">No widgets on this dashboard.</p>
            <button
              onClick={onEdit}
              className="text-xs text-[#FE5000] hover:underline"
            >
              Add widgets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {sorted.map((w) => {
              const item = getCatalogItem(w.catalogId);
              if (!item) return null;
              const config = {
                ...item.config,
                id: `${dashboard.id}__${w.catalogId}__${w.position}`,
              };
              return (
                <div
                  key={`${w.catalogId}-${w.position}`}
                  className={SIZE_COLS[w.size] ?? SIZE_COLS.md}
                >
                  <LiveWidget config={config} role={role} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Edit dashboard view ───────────────────────────────────────────

interface EditDashboardProps {
  dashboard: UserDashboard;
  roleServices: string[];
  onSave: (widgets: PickedWidget[]) => Promise<void>;
  onCancel: () => void;
}

function EditDashboardView({ dashboard, roleServices, onSave, onCancel }: EditDashboardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const [widgets, setWidgets] = useState<PickedWidget[]>(
    dashboard.widgets.map((w) => ({ catalogId: w.catalogId, size: w.size }))
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    setSaving(true);
    await onSave(widgets);
    setSaving(false);
  }

  function handlePickerConfirm(picked: PickedWidget[]) {
    // Merge: keep existing sizes, add new at md
    const merged: PickedWidget[] = picked.map((p) => {
      const existing = widgets.find((w) => w.catalogId === p.catalogId);
      return { catalogId: p.catalogId, size: existing?.size ?? p.size };
    });
    setWidgets(merged);
    setPickerOpen(false);
  }

  const sorted = [...widgets].map((w, i) => ({ ...w, position: i }));

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">Editing: {dashboard.name}</h1>
            <p className="text-xs text-[#71717A] mt-0.5">
              Add or remove widgets, adjust sizes, then save.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
            >
              <Plus size={14} />
              Add Widgets
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold border border-[#FE5000] text-[#FE5000] hover:bg-[#FE5000]/10 disabled:opacity-40 transition-colors"
            >
              {saving ? <RefreshCw size={13} className="animate-spin" /> : null}
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={onCancel}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[#71717A] hover:text-white transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>

        {/* Widget tray */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center border border-dashed border-[#27272A] rounded-lg">
            <LayoutGrid size={32} className="text-[#27272A] mb-2" />
            <p className="text-sm text-[#52525B] mb-2">No widgets yet.</p>
            <button
              onClick={() => setPickerOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-2 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
            >
              <Plus size={14} />
              Add Widgets
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {sorted.map((w) => {
              const item = getCatalogItem(w.catalogId);
              if (!item) return null;

              function cycleSize() {
                const sizes: Array<'sm' | 'md' | 'lg'> = ['sm', 'md', 'lg'];
                const idx = sizes.indexOf(w.size as 'sm' | 'md' | 'lg');
                const next = sizes[(idx + 1) % sizes.length] ?? 'md';
                setWidgets((prev) =>
                  prev.map((pw) =>
                    pw.catalogId === w.catalogId ? { ...pw, size: next } : pw
                  )
                );
              }

              function removeWidget() {
                setWidgets((prev) => prev.filter((pw) => pw.catalogId !== w.catalogId));
              }

              return (
                <div
                  key={w.catalogId}
                  className={`${SIZE_COLS[w.size] ?? SIZE_COLS.md} group relative`}
                >
                  {/* Edit overlay */}
                  <div className="absolute inset-0 z-10 rounded-lg border-2 border-transparent group-hover:border-[#FE5000]/40 pointer-events-none transition-colors" />
                  <div className="absolute top-2 right-2 z-20 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={cycleSize}
                      className="rounded px-1.5 py-0.5 text-[10px] font-medium bg-[#27272A] text-[#A1A1AA] hover:bg-[#3F3F46] hover:text-white transition-colors"
                      title="Cycle size"
                    >
                      {w.size}
                    </button>
                    <button
                      onClick={removeWidget}
                      className="p-1 rounded bg-[#27272A] text-[#A1A1AA] hover:bg-red-900/40 hover:text-red-400 transition-colors"
                      title="Remove widget"
                    >
                      <X size={11} />
                    </button>
                  </div>
                  <div className="opacity-60 pointer-events-none select-none">
                    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FE5000]" />
                        <span className="text-xs font-semibold text-white uppercase tracking-wide truncate">
                          {item.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-[#71717A] leading-snug">{item.description}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Widget picker modal */}
      {pickerOpen && (
        <WidgetPicker
          roleServices={roleServices}
          initialSelected={widgets}
          onConfirm={handlePickerConfirm}
          onClose={() => setPickerOpen(false)}
        />
      )}
    </div>
  );
}

// ── Create dashboard modal ─────────────────────────────────────────

function CreateModal({
  onConfirm,
  onClose,
}: {
  onConfirm: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  function submit() {
    if (name.trim()) onConfirm(name.trim());
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm rounded-lg border border-[#27272A] bg-[#09090B] shadow-2xl p-3.5">
        <h2 className="text-sm font-bold text-white mb-2.5">New Dashboard</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && submit()}
          placeholder="Dashboard name..."
          autoFocus
          className="w-full rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2 text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000] transition-colors mb-2.5"
        />
        <div className="flex items-center gap-2 justify-end">
          <button
            onClick={onClose}
            className="rounded-md px-3 py-1.5 text-xs font-medium text-[#71717A] hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!name.trim()}
            className="rounded-md px-4 py-1.5 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Create
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────

type PageView = 'list' | 'view' | 'edit';

export default function DashboardsPage() {
  const { data: session } = useSession();
  const userEmail = session?.user?.email ?? 'dev@delta360.energy';
  const userRole = getUserRole(userEmail);
  const roleConfig = ROLES[userRole];
  const roleServices = roleConfig?.services ?? [];

  const [dashboards, setDashboards] = useState<UserDashboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<PageView>('list');
  const [activeDashboard, setActiveDashboard] = useState<UserDashboard | null>(null);
  const [creating, setCreating] = useState(false);

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await fetch('/api/user-dashboards');
      const data = await res.json() as { dashboards?: UserDashboard[] };
      setDashboards(data.dashboards ?? []);
    } catch {
      setDashboards([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchDashboards();
  }, [fetchDashboards]);

  async function handleCreate(name: string) {
    setCreating(false);
    const res = await fetch('/api/user-dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, widgets: [] }),
    });
    if (res.ok) {
      const data = await res.json() as { dashboard: UserDashboard };
      setActiveDashboard(data.dashboard);
      setView('edit');
      void fetchDashboards();
    }
  }

  async function handleDelete(id: string) {
    const res = await fetch('/api/user-dashboards', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    if (res.ok) {
      void fetchDashboards();
    }
  }

  async function handleSaveWidgets(picked: PickedWidget[]) {
    if (!activeDashboard) return;
    const widgets = picked.map((p, i) => ({
      catalogId: p.catalogId,
      position: i,
      size: p.size,
    }));
    const res = await fetch('/api/user-dashboards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: activeDashboard.id, name: activeDashboard.name, widgets }),
    });
    if (res.ok) {
      const data = await res.json() as { dashboard: UserDashboard };
      setActiveDashboard(data.dashboard);
      setView('view');
      void fetchDashboards();
    }
  }

  function openDashboard(d: UserDashboard) {
    setActiveDashboard(d);
    setView('view');
  }

  function startEdit() {
    setView('edit');
  }

  function cancelEdit() {
    setView(activeDashboard ? 'view' : 'list');
  }

  function backToList() {
    setActiveDashboard(null);
    setView('list');
  }

  // ── Render routing ──

  if (view === 'view' && activeDashboard) {
    return (
      <ActiveDashboardView
        dashboard={activeDashboard}
        role={userRole}
        roleServices={roleServices}
        onEdit={startEdit}
        onClose={backToList}
      />
    );
  }

  if (view === 'edit' && activeDashboard) {
    return (
      <EditDashboardView
        dashboard={activeDashboard}
        roleServices={roleServices}
        onSave={handleSaveWidgets}
        onCancel={cancelEdit}
      />
    );
  }

  // List view
  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-5xl mx-auto px-6 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-lg font-bold text-white">My Dashboards</h1>
            <p className="text-sm text-[#71717A] mt-0.5">
              Custom single-pane-of-glass views with live data.
            </p>
          </div>
          <button
            onClick={() => setCreating(true)}
            className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
          >
            <Plus size={16} />
            New Dashboard
          </button>
        </div>

        {/* Role context pill */}
        <div className="mb-5 flex items-center gap-2">
          <span className="text-[11px] text-[#52525B] font-medium uppercase tracking-wide">Role:</span>
          <span className="text-[11px] font-semibold text-[#A1A1AA] bg-[#18181B] border border-[#27272A] rounded px-2 py-0.5">
            {roleConfig?.name ?? userRole}
          </span>
          <span className="text-[11px] text-[#52525B]">
            — {WIDGET_CATALOG.filter((w) => w.requiredServices.every((s) => roleServices.includes(s))).length} of {WIDGET_CATALOG.length} widgets available
          </span>
        </div>

        {/* Dashboard grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5 animate-pulse">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-8 h-8 rounded-md bg-[#27272A]" />
                  <div className="h-4 w-36 rounded bg-[#27272A]" />
                </div>
                <div className="flex gap-3">
                  <div className="h-3 w-20 rounded bg-[#27272A]" />
                  <div className="h-3 w-24 rounded bg-[#27272A]" />
                </div>
              </div>
            ))}
          </div>
        ) : dashboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <PanelLeft size={40} className="text-[#27272A] mb-2.5" />
            <h3 className="text-xs font-semibold text-[#71717A] mb-1">No dashboards yet</h3>
            <p className="text-xs text-[#52525B] mb-5 max-w-xs">
              Build a custom view by adding widgets scoped to your data access.
            </p>
            <button
              onClick={() => setCreating(true)}
              className="inline-flex items-center gap-2 rounded-md px-4 py-2 text-xs font-semibold bg-[#FE5000] text-white hover:bg-[#CC4000] transition-colors"
            >
              <Plus size={16} />
              Create your first dashboard
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {dashboards.map((d) => (
              <DashboardCard
                key={d.id}
                dashboard={d}
                onOpen={openDashboard}
                onDelete={handleDelete}
              />
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {creating && (
        <CreateModal
          onConfirm={handleCreate}
          onClose={() => setCreating(false)}
        />
      )}
    </div>
  );
}
