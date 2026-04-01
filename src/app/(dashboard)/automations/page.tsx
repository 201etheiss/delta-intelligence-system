'use client';

import { useState, useEffect, useCallback } from 'react';
import { Zap, Plus, Loader2 } from 'lucide-react';
import AutomationCard from '@/components/automations/AutomationCard';
import AutomationForm from '@/components/automations/AutomationForm';
import RunHistoryTable from '@/components/automations/RunHistoryTable';
import type { Automation, AutomationRun, Trigger, Action, Condition } from '@/lib/automations';

type Tab = 'active' | 'all' | 'history';

export default function AutomationsPage() {
  const [tab, setTab] = useState<Tab>('active');
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [runs, setRuns] = useState<AutomationRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editTarget, setEditTarget] = useState<Automation | null>(null);

  // ── Fetch Data ───────────────────────────────────────────

  const fetchAutomations = useCallback(async () => {
    try {
      const resp = await fetch('/api/automations');
      if (resp.ok) {
        const data = (await resp.json()) as { automations: Automation[] };
        setAutomations(data.automations ?? []);
      }
    } catch {
      // Silently fail on fetch error
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const resp = await fetch('/api/automations/history');
      if (resp.ok) {
        const data = (await resp.json()) as { runs: AutomationRun[] };
        setRuns(data.runs ?? []);
      }
    } catch {
      // Silently fail
    }
  }, []);

  useEffect(() => {
    async function load() {
      setLoading(true);
      await Promise.all([fetchAutomations(), fetchHistory()]);
      setLoading(false);
    }
    void load();
  }, [fetchAutomations, fetchHistory]);

  // ── Actions ──────────────────────────────────────────────

  const handleToggle = useCallback(
    async (id: string, enabled: boolean) => {
      await fetch('/api/automations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, enabled }),
      });
      await fetchAutomations();
    },
    [fetchAutomations]
  );

  const handleRunNow = useCallback(
    async (id: string) => {
      setRunningId(id);
      try {
        await fetch('/api/automations/run', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ automationId: id }),
        });
        await Promise.all([fetchAutomations(), fetchHistory()]);
      } finally {
        setRunningId(null);
      }
    },
    [fetchAutomations, fetchHistory]
  );

  const handleDelete = useCallback(
    async (id: string) => {
      if (!confirm('Delete this automation?')) return;
      await fetch(`/api/automations?id=${id}`, { method: 'DELETE' });
      await fetchAutomations();
    },
    [fetchAutomations]
  );

  const handleEdit = useCallback((automation: Automation) => {
    setEditTarget(automation);
    setShowForm(true);
  }, []);

  const handleSave = useCallback(
    async (data: {
      name: string;
      description: string;
      trigger: Trigger;
      conditions: Condition[];
      actions: Action[];
    }) => {
      if (editTarget) {
        // Update
        await fetch('/api/automations', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editTarget.id, ...data }),
        });
      } else {
        // Create
        await fetch('/api/automations', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        });
      }
      setShowForm(false);
      setEditTarget(null);
      await fetchAutomations();
    },
    [editTarget, fetchAutomations]
  );

  // ── Derived Data ─────────────────────────────────────────

  const activeAutomations = automations.filter((a) => a.enabled);
  const displayList = tab === 'active' ? activeAutomations : automations;

  const automationNames: Record<string, string> = {};
  for (const a of automations) {
    automationNames[a.id] = a.name;
  }

  // ── Render ───────────────────────────────────────────────

  const TABS: { id: Tab; label: string; count?: number }[] = [
    { id: 'active', label: 'Active', count: activeAutomations.length },
    { id: 'all', label: 'All', count: automations.length },
    { id: 'history', label: 'History', count: runs.length },
  ];

  return (
    <div className="h-full overflow-y-auto bg-zinc-50 dark:bg-zinc-900">
      {/* Header */}
      <div className="bg-white dark:bg-[#18181B] border-b border-zinc-200 px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#FE5000]/10">
              <Zap size={18} className="text-[#FE5000]" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">
                Automations
              </h1>
              <p className="text-xs text-zinc-500">
                Automate reports, alerts, and data workflows
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              setEditTarget(null);
              setShowForm(true);
            }}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#FE5000] rounded-md hover:bg-[#CC4000] transition-colors"
          >
            <Plus size={16} />
            Create Automation
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mt-4">
          {TABS.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                tab === t.id
                  ? 'bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900'
                  : 'text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800'
              }`}
            >
              {t.label}
              {t.count !== undefined && (
                <span className="ml-1.5 text-xs opacity-60">{t.count}</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-zinc-200 bg-white dark:bg-[#18181B] p-4 animate-pulse">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-zinc-100 dark:bg-zinc-800" />
                    <div>
                      <div className="h-4 w-40 rounded bg-zinc-100 dark:bg-zinc-800 mb-1.5" />
                      <div className="h-3 w-56 rounded bg-zinc-100 dark:bg-zinc-800" />
                    </div>
                  </div>
                  <div className="h-6 w-12 rounded-full bg-zinc-100 dark:bg-zinc-800" />
                </div>
              </div>
            ))}
          </div>
        ) : tab === 'history' ? (
          <div className="bg-white dark:bg-[#18181B] rounded-lg border border-zinc-200">
            <RunHistoryTable runs={runs} automationNames={automationNames} />
          </div>
        ) : displayList.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-zinc-400">
            <Zap size={32} className="mb-2" />
            <p className="text-sm font-medium">
              {tab === 'active'
                ? 'No active automations'
                : 'No automations yet'}
            </p>
            <p className="text-xs mt-0.5">
              {tab === 'active'
                ? 'Enable an automation or create a new one.'
                : 'Create your first automation to get started.'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {displayList.map((auto) => (
              <AutomationCard
                key={auto.id}
                automation={auto}
                onToggle={handleToggle}
                onRunNow={handleRunNow}
                onEdit={handleEdit}
                onDelete={handleDelete}
                running={runningId === auto.id}
              />
            ))}
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <AutomationForm
          initial={editTarget}
          onSave={handleSave}
          onCancel={() => {
            setShowForm(false);
            setEditTarget(null);
          }}
        />
      )}
    </div>
  );
}
