'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Briefcase, Plus, X, Search, Copy, Share2, Settings,
} from 'lucide-react';
import HelpTooltip from '@/components/common/HelpTooltip';
import type { Workspace, TabKey, CategoryFilter } from '@/components/workspaces/types';
import { CATEGORIES, CATEGORY_COLORS } from '@/components/workspaces/types';
import { WorkspaceIcon } from '@/components/workspaces/WorkspaceIcon';
import { StarRating } from '@/components/workspaces/StarRating';
import { DetailPanel } from '@/components/workspaces/DetailPanel';
import { WorkspaceModal } from '@/components/workspaces/WorkspaceModal';

// ── Main Page ─────────────────────────────────────────────────
export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('');
  const [showModal, setShowModal] = useState(false);
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | undefined>();
  const [detailWorkspace, setDetailWorkspace] = useState<Workspace | null>(null);

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch('/api/workspaces');
      const data = (await res.json()) as { success: boolean; workspaces?: Workspace[] };
      if (data.success) setWorkspaces(data.workspaces ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const filtered = useMemo(() => {
    let list = workspaces;
    if (activeTab === 'my') {
      list = list.filter((w) => w.visibility === 'private');
    } else if (activeTab === 'team') {
      list = list.filter((w) => w.visibility === 'team');
    }
    if (categoryFilter) {
      list = list.filter((w) => w.category === categoryFilter);
    }
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      list = list.filter((w) =>
        w.name.toLowerCase().includes(q) ||
        w.description.toLowerCase().includes(q) ||
        (w.tags ?? []).some((t) => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [workspaces, activeTab, categoryFilter, searchQuery]);

  const handleSave = useCallback(async (ws: Partial<Workspace>) => {
    try {
      if (ws.id) {
        const res = await fetch('/api/workspaces', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ws),
        });
        const data = (await res.json()) as { success: boolean; workspace?: Workspace };
        if (data.success && data.workspace) {
          setWorkspaces((prev) => prev.map((w) => w.id === data.workspace!.id ? data.workspace! : w));
        }
      } else {
        const res = await fetch('/api/workspaces', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(ws),
        });
        const data = (await res.json()) as { success: boolean; workspace?: Workspace };
        if (data.success && data.workspace) {
          setWorkspaces((prev) => [...prev, data.workspace!]);
        }
      }
    } catch {
      // silent
    }
    setShowModal(false);
    setEditingWorkspace(undefined);
  }, []);

  const handleDuplicate = useCallback(async (ws: Workspace) => {
    const clone: Partial<Workspace> = {
      name: `${ws.name} (Copy)`,
      description: ws.description,
      longDescription: ws.longDescription,
      color: ws.color,
      icon: ws.icon,
      dataSources: [...ws.dataSources],
      systemPrompt: ws.systemPrompt,
      temperature: ws.temperature,
      preferredModel: ws.preferredModel,
      maxToolRounds: ws.maxToolRounds,
      visibility: 'private',
      tags: [...(ws.tags ?? [])],
      category: ws.category,
      samplePrompts: [...(ws.samplePrompts ?? [])],
      responseFormat: ws.responseFormat,
    };
    try {
      const res = await fetch('/api/workspaces', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(clone),
      });
      const data = (await res.json()) as { success: boolean; workspace?: Workspace };
      if (data.success && data.workspace) {
        setWorkspaces((prev) => [...prev, data.workspace!]);
      }
    } catch {
      // silent
    }
    setDetailWorkspace(null);
  }, []);

  const handleRate = useCallback(async (wsId: string, rating: number) => {
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: wsId, ratingValue: rating }),
      });
      const data = (await res.json()) as { success: boolean; workspace?: Workspace };
      if (data.success && data.workspace) {
        setWorkspaces((prev) => prev.map((w) => w.id === data.workspace!.id ? data.workspace! : w));
      }
    } catch {
      // silent
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    try {
      await fetch(`/api/workspaces?id=${id}`, { method: 'DELETE' });
      setWorkspaces((prev) => prev.filter((w) => w.id !== id));
    } catch {
      // silent
    }
  }, []);

  const handleToggleVisibility = useCallback(async (ws: Workspace) => {
    const next = ws.visibility === 'private' ? 'team' : ws.visibility === 'team' ? 'public' : 'private';
    try {
      const res = await fetch('/api/workspaces', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: ws.id, visibility: next }),
      });
      const data = (await res.json()) as { success: boolean; workspace?: Workspace };
      if (data.success && data.workspace) {
        setWorkspaces((prev) => prev.map((w) => w.id === data.workspace!.id ? data.workspace! : w));
      }
    } catch {
      // silent
    }
  }, []);

  const openWorkspace = useCallback((id: string) => {
    router.push(`/chat?workspace=${id}`);
  }, [router]);

  const TABS: { key: TabKey; label: string }[] = [
    { key: 'my', label: 'My Workspaces' },
    { key: 'team', label: 'Team' },
    { key: 'all', label: 'All' },
  ];

  return (
    <div className="px-5 py-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-white">
            Workspaces <HelpTooltip text="Pre-configured AI assistant focused on a specific domain" position="right" />
          </h2>
          <p className="mt-0.5 text-sm text-zinc-500">
            Pre-configured AI assistants for specific domains
          </p>
        </div>
        <button
          onClick={() => { setEditingWorkspace(undefined); setShowModal(true); }}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium bg-[#FF5C00] text-white rounded-lg hover:bg-[#E54800] transition-colors"
        >
          <Plus size={16} />
          New Workspace
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-2.5 border-b border-zinc-200 dark:border-zinc-700">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === tab.key
                ? 'border-[#FF5C00] text-[#FF5C00]'
                : 'border-transparent text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search + Filter bar */}
      <div className="flex items-center gap-3 mb-5">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
          <input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search workspaces..."
            className="w-full pl-9 pr-3 py-2 border border-zinc-300 dark:border-zinc-600 rounded-lg text-sm bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#FF5C00] focus:ring-1 focus:ring-[#FF5C00]/20"
          />
        </div>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value as CategoryFilter)}
          className="border border-zinc-300 dark:border-zinc-600 rounded-lg px-3 py-2 text-sm bg-white dark:bg-[#18181B] text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#FF5C00]"
        >
          {CATEGORIES.map((c) => (
            <option key={c.value} value={c.value}>{c.label}</option>
          ))}
        </select>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 rounded-lg bg-zinc-100 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Briefcase size={32} className="text-zinc-400 mb-2" />
          <h3 className="text-xs font-semibold text-zinc-900 dark:text-white mb-1">No workspaces found</h3>
          <p className="text-xs text-zinc-400">
            {searchQuery || categoryFilter ? 'Try adjusting your filters.' : 'Create your first workspace to get started.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((ws) => (
            <WorkspaceCard
              key={ws.id}
              ws={ws}
              onDetail={() => setDetailWorkspace(ws)}
              onUse={() => openWorkspace(ws.id)}
              onDuplicate={() => handleDuplicate(ws)}
              onToggleVisibility={() => handleToggleVisibility(ws)}
              onEdit={() => { setEditingWorkspace(ws); setShowModal(true); }}
              onDelete={() => handleDelete(ws.id)}
              onRate={(v) => handleRate(ws.id, v)}
            />
          ))}
        </div>
      )}

      {/* Detail Panel */}
      {detailWorkspace && (
        <DetailPanel
          workspace={detailWorkspace}
          onClose={() => setDetailWorkspace(null)}
          onOpen={() => openWorkspace(detailWorkspace.id)}
          onDuplicate={() => handleDuplicate(detailWorkspace)}
          onEdit={() => {
            setEditingWorkspace(detailWorkspace);
            setDetailWorkspace(null);
            setShowModal(true);
          }}
        />
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <WorkspaceModal
          initial={editingWorkspace}
          onClose={() => { setShowModal(false); setEditingWorkspace(undefined); }}
          onSave={handleSave}
        />
      )}
    </div>
  );
}

// ── Workspace Card ────────────────────────────────────────────
function WorkspaceCard({
  ws,
  onDetail,
  onUse,
  onDuplicate,
  onToggleVisibility,
  onEdit,
  onDelete,
  onRate,
}: {
  ws: Workspace;
  onDetail: () => void;
  onUse: () => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onRate: (v: number) => void;
}) {
  return (
    <div
      className="group relative rounded-lg border border-zinc-200 bg-white dark:bg-[#18181B] shadow-sm hover:shadow-md transition-all cursor-pointer overflow-hidden"
      style={{ borderLeftWidth: 4, borderLeftColor: ws.color }}
      onClick={onDetail}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onDetail(); }}
    >
      <div className="p-4">
        <div className="flex items-start gap-3 mb-2">
          <WorkspaceIcon icon={ws.icon} color={ws.color} />
          <div className="flex-1 min-w-0">
            <h3 className="text-xs font-semibold text-zinc-900 dark:text-white truncate">{ws.name}</h3>
            <p className="text-xs text-zinc-500 mt-0.5 line-clamp-2">{ws.description}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 mb-2">
          <span
            className="px-2 py-0.5 rounded-full text-[10px] font-medium text-white"
            style={{ backgroundColor: CATEGORY_COLORS[ws.category] ?? '#71717A' }}
          >
            {ws.category}
          </span>
          {(ws.tags ?? []).slice(0, 3).map((tag) => (
            <span key={tag} className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">
              {tag}
            </span>
          ))}
          {(ws.tags ?? []).length > 3 && (
            <span className="text-[10px] text-zinc-400">+{(ws.tags ?? []).length - 3}</span>
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <StarRating rating={ws.rating} onRate={onRate} />
            <span className="text-[10px] text-zinc-400 tabular-nums">{ws.usageCount} uses</span>
          </div>
          <span className="text-[10px] text-zinc-400">{ws.createdBy}</span>
        </div>
      </div>

      {/* Hover actions */}
      <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          onClick={(e) => { e.stopPropagation(); onUse(); }}
          className="px-2 py-1 rounded text-[10px] font-medium bg-[#FF5C00] text-white hover:bg-[#E54800] transition-colors"
        >
          Use
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
          className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Duplicate"
        >
          <Copy size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onToggleVisibility(); }}
          className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title={`Visibility: ${ws.visibility}`}
        >
          <Share2 size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
          className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-zinc-500 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors"
          title="Edit"
        >
          <Settings size={12} />
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1 rounded bg-zinc-100 dark:bg-zinc-800 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
          title="Delete"
        >
          <X size={12} />
        </button>
      </div>
    </div>
  );
}
