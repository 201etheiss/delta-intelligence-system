'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  X,
  Search,
  Hash,
  BarChart3,
  Table,
  Activity,
  List,
  Lock,
  Check,
  ChevronRight,
  PieChart,
  TrendingUp,
  LayoutGrid,
  Zap,
  Grid3X3,
  TreePine,
} from 'lucide-react';
import { WIDGET_CATALOG, CATALOG_CATEGORIES } from '@/lib/widget-catalog';
import type { WidgetCatalogItem, WidgetCatalogCategory } from '@/lib/widget-catalog';
import type { WidgetSize } from '@/lib/user-dashboards';

// ── Type icons ────────────────────────────────────────────────────

const TYPE_ICONS: Record<string, typeof Hash> = {
  kpi: Hash,
  chart: BarChart3,
  table: Table,
  gauge: Activity,
  list: List,
  pie: PieChart,
  area: TrendingUp,
  stackedbar: LayoutGrid,
  sparkline: Zap,
  heatmap: Grid3X3,
  treemap: TreePine,
};

function TypeBadge({ type }: { type: WidgetCatalogItem['type'] }) {
  const Icon = TYPE_ICONS[type] ?? Hash;
  const labels: Record<string, string> = {
    kpi: 'KPI',
    chart: 'Chart',
    table: 'Table',
    gauge: 'Gauge',
    list: 'List',
    pie: 'Donut',
    area: 'Area',
    stackedbar: 'Stacked',
    sparkline: 'Spark',
    heatmap: 'Heat',
    treemap: 'Tree',
  };
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#71717A] bg-[#27272A] rounded px-1.5 py-0.5 uppercase tracking-wide">
      <Icon size={9} />
      {labels[type] ?? type}
    </span>
  );
}

// ── Category pill ─────────────────────────────────────────────────

function CategoryPill({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={[
        'rounded-full px-3 py-1 text-xs font-medium border transition-colors whitespace-nowrap',
        active
          ? 'border-[#FF5C00] bg-[#FF5C00]/10 text-[#FF5C00]'
          : 'border-[#27272A] text-[#71717A] hover:border-[#52525B] hover:text-[#A1A1AA]',
      ].join(' ')}
    >
      {label}
    </button>
  );
}

// ── Catalog card ──────────────────────────────────────────────────

function CatalogCard({
  item,
  roleServices,
  selected,
  onToggle,
}: {
  item: WidgetCatalogItem;
  roleServices: string[];
  selected: boolean;
  onToggle: () => void;
}) {
  const accessible = item.requiredServices.every((s) => roleServices.includes(s));
  const missingServices = item.requiredServices.filter((s) => !roleServices.includes(s));

  const Icon = TYPE_ICONS[item.type] ?? Hash;

  return (
    <button
      onClick={accessible ? onToggle : undefined}
      disabled={!accessible}
      title={
        !accessible
          ? `Requires: ${missingServices.join(', ')}`
          : selected
          ? 'Remove from dashboard'
          : 'Add to dashboard'
      }
      className={[
        'relative text-left rounded-lg border p-3 transition-all',
        accessible
          ? selected
            ? 'border-[#FF5C00] bg-[#FF5C00]/5 hover:bg-[#FF5C00]/10'
            : 'border-[#27272A] bg-[#18181B] hover:border-[#3F3F46] hover:bg-[#1F1F22] cursor-pointer'
          : 'border-[#27272A]/40 bg-[#18181B]/40 cursor-not-allowed opacity-50',
      ].join(' ')}
    >
      {/* Selection indicator */}
      {accessible && selected && (
        <span className="absolute top-2 right-2 flex items-center justify-center w-4 h-4 rounded-full bg-[#FF5C00]">
          <Check size={10} className="text-white" />
        </span>
      )}
      {/* Lock for inaccessible */}
      {!accessible && (
        <span className="absolute top-2 right-2 text-[#52525B]">
          <Lock size={12} />
        </span>
      )}

      <div className="flex items-center gap-2 mb-2">
        <span
          className={[
            'flex items-center justify-center w-7 h-7 rounded-md',
            accessible
              ? selected
                ? 'bg-[#FF5C00]/20 text-[#FF5C00]'
                : 'bg-[#27272A] text-[#A1A1AA]'
              : 'bg-[#27272A]/50 text-[#52525B]',
          ].join(' ')}
        >
          <Icon size={14} />
        </span>
        <TypeBadge type={item.type} />
      </div>

      <h4 className="text-xs font-semibold text-white mb-0.5 leading-tight pr-5">
        {item.name}
      </h4>
      <p className="text-[10px] text-[#71717A] leading-snug line-clamp-2">
        {item.description}
      </p>

      {!accessible && (
        <p className="text-[9px] text-[#52525B] mt-1.5 font-mono">
          Requires: {missingServices.join(', ')}
        </p>
      )}
    </button>
  );
}

// ── Size selector ─────────────────────────────────────────────────

const SIZE_OPTIONS: Array<{ value: WidgetSize; label: string; desc: string }> = [
  { value: 'sm', label: 'Small', desc: '1 column' },
  { value: 'md', label: 'Medium', desc: '2 columns' },
  { value: 'lg', label: 'Large', desc: 'Full width' },
];

// ── Selected widget row ───────────────────────────────────────────

function SelectedRow({
  item,
  size,
  onRemove,
  onSizeChange,
}: {
  item: WidgetCatalogItem;
  size: WidgetSize;
  onRemove: () => void;
  onSizeChange: (s: WidgetSize) => void;
}) {
  const Icon = TYPE_ICONS[item.type] ?? Hash;
  return (
    <div className="flex items-center gap-2 rounded-md border border-[#27272A] bg-[#18181B] px-3 py-2">
      <span className="flex items-center justify-center w-6 h-6 rounded bg-[#FF5C00]/15 text-[#FF5C00] shrink-0">
        <Icon size={12} />
      </span>
      <span className="text-xs font-medium text-white flex-1 min-w-0 truncate">{item.name}</span>
      <div className="flex items-center gap-1 shrink-0">
        {SIZE_OPTIONS.map((s) => (
          <button
            key={s.value}
            onClick={() => onSizeChange(s.value)}
            title={s.desc}
            className={[
              'rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors',
              size === s.value
                ? 'bg-[#FF5C00] text-white'
                : 'bg-[#27272A] text-[#A1A1AA] hover:bg-[#3F3F46]',
            ].join(' ')}
          >
            {s.label}
          </button>
        ))}
      </div>
      <button
        onClick={onRemove}
        className="p-1 rounded text-[#52525B] hover:text-red-400 hover:bg-red-900/20 transition-colors ml-1"
      >
        <X size={12} />
      </button>
    </div>
  );
}

// ── Main modal ────────────────────────────────────────────────────

export interface PickedWidget {
  catalogId: string;
  size: WidgetSize;
}

interface WidgetPickerProps {
  /** Services available to this role — controls which widgets are enabled */
  roleServices: string[];
  /** Currently selected widgets — pass existing dashboard widgets to pre-select */
  initialSelected?: PickedWidget[];
  onConfirm: (widgets: PickedWidget[]) => void;
  onClose: () => void;
}

export default function WidgetPicker({
  roleServices,
  initialSelected = [],
  onConfirm,
  onClose,
}: WidgetPickerProps) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState<WidgetCatalogCategory | 'all'>('all');
  const [selected, setSelected] = useState<PickedWidget[]>(initialSelected);

  // Close on Escape
  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const filteredCatalog = useMemo(() => {
    const q = search.toLowerCase();
    return WIDGET_CATALOG.filter((item) => {
      if (activeCategory !== 'all' && item.category !== activeCategory) return false;
      if (q && !item.name.toLowerCase().includes(q) && !item.description.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [search, activeCategory]);

  const isSelected = useCallback(
    (id: string) => selected.some((s) => s.catalogId === id),
    [selected]
  );

  function toggleWidget(id: string) {
    setSelected((prev) => {
      if (prev.some((s) => s.catalogId === id)) {
        return prev.filter((s) => s.catalogId !== id);
      }
      return [...prev, { catalogId: id, size: 'md' }];
    });
  }

  function updateSize(catalogId: string, size: WidgetSize) {
    setSelected((prev) =>
      prev.map((s) => (s.catalogId === catalogId ? { ...s, size } : s))
    );
  }

  function removeSelected(catalogId: string) {
    setSelected((prev) => prev.filter((s) => s.catalogId !== catalogId));
  }

  const selectedItems = selected
    .map((s) => {
      const item = WIDGET_CATALOG.find((c) => c.id === s.catalogId);
      return item ? { item, size: s.size } : null;
    })
    .filter((x): x is { item: WidgetCatalogItem; size: WidgetSize } => x !== null);

  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Modal */}
      <div className="relative w-full max-w-3xl max-h-[90vh] flex flex-col rounded-t-xl sm:rounded-xl border border-[#27272A] bg-[#09090B] shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#27272A] shrink-0">
          <div>
            <h2 className="text-sm font-bold text-white">Add Widgets</h2>
            <p className="text-[11px] text-[#71717A] mt-0.5">
              Select widgets to add to your dashboard.
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-md text-[#52525B] hover:text-white hover:bg-[#27272A] transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Search + category filter */}
        <div className="px-5 py-3 border-b border-[#27272A] shrink-0 space-y-2.5">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search widgets..."
              className="w-full pl-9 pr-3 py-2 rounded-md border border-[#27272A] bg-[#18181B] text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FF5C00] transition-colors"
              autoFocus
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-[#A1A1AA]"
              >
                <X size={12} />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-0.5">
            <CategoryPill
              label="All"
              active={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
            />
            {CATALOG_CATEGORIES.map((cat) => (
              <CategoryPill
                key={cat.id}
                label={cat.label}
                active={activeCategory === cat.id}
                onClick={() => setActiveCategory(cat.id)}
              />
            ))}
          </div>
        </div>

        {/* Widget grid — scrollable */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {filteredCatalog.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Search size={24} className="text-[#27272A] mb-3" />
              <p className="text-sm text-[#52525B]">No widgets match your search.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {filteredCatalog.map((item) => (
                <CatalogCard
                  key={item.id}
                  item={item}
                  roleServices={roleServices}
                  selected={isSelected(item.id)}
                  onToggle={() => toggleWidget(item.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Selected widgets tray */}
        {selectedItems.length > 0 && (
          <div className="border-t border-[#27272A] px-5 py-3 shrink-0 bg-[#0D0D0F]">
            <div className="flex items-center gap-1.5 mb-2">
              <span className="text-[11px] font-semibold text-[#A1A1AA] uppercase tracking-wide">
                Selected
              </span>
              <span className="flex items-center justify-center w-4 h-4 rounded-full bg-[#FF5C00] text-[9px] font-bold text-white">
                {selectedItems.length}
              </span>
            </div>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-0.5">
              {selectedItems.map(({ item, size }) => (
                <SelectedRow
                  key={item.id}
                  item={item}
                  size={size}
                  onRemove={() => removeSelected(item.id)}
                  onSizeChange={(s) => updateSize(item.id, s)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Footer CTA */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-[#27272A] bg-[#0D0D0F] shrink-0">
          <span className="text-[11px] text-[#52525B]">
            {selected.length === 0
              ? 'No widgets selected'
              : `${selected.length} widget${selected.length !== 1 ? 's' : ''} selected`}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="rounded-md px-3 py-1.5 text-xs font-medium text-[#71717A] hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onConfirm(selected)}
              disabled={selected.length === 0}
              className="inline-flex items-center gap-1.5 rounded-md px-4 py-1.5 text-xs font-semibold bg-[#FF5C00] text-white hover:bg-[#E54800] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Apply
              <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
