'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, RefreshCw, Clock, AlertTriangle, AlertCircle, Info } from 'lucide-react';
import type { IntelligenceBrief, BriefSection } from '@/lib/engines/intelligence-brief';

// ── Severity helpers ─────────────────────────────────────────

function severityColor(severity?: 'info' | 'warning' | 'critical') {
  switch (severity) {
    case 'critical':
      return 'bg-red-500/10 text-red-400 border-red-500/30';
    case 'warning':
      return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30';
    default:
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30';
  }
}

function severityBadge(severity?: 'info' | 'warning' | 'critical') {
  const base = 'inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wide border';
  switch (severity) {
    case 'critical':
      return (
        <span className={`${base} ${severityColor('critical')}`}>
          <AlertCircle size={10} /> Critical
        </span>
      );
    case 'warning':
      return (
        <span className={`${base} ${severityColor('warning')}`}>
          <AlertTriangle size={10} /> Warning
        </span>
      );
    default:
      return (
        <span className={`${base} ${severityColor('info')}`}>
          <Info size={10} /> Info
        </span>
      );
  }
}

// ── Section card ─────────────────────────────────────────────

function SectionCard({ section }: { section: BriefSection }) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-semibold text-white">{section.title}</h3>
        {severityBadge(section.severity)}
      </div>
      <p className="text-xs text-zinc-400 leading-relaxed mb-2.5">
        {section.content}
      </p>
      {(section.metrics ?? []).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(section.metrics ?? []).map((m) => (
            <div
              key={m.label}
              className="rounded-md bg-[#09090B] border border-[#27272A] px-3 py-2"
            >
              <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">
                {m.label}
              </div>
              <div className="text-xs font-semibold text-white">{m.value}</div>
              {m.change && (
                <div className="text-[10px] text-zinc-500">{m.change}</div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── History item ─────────────────────────────────────────────

interface HistoryEntry {
  id: string;
  type: string;
  generatedAt: string;
  summary: string;
}

function HistoryItem({
  entry,
  onRestore,
}: {
  entry: HistoryEntry;
  onRestore: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onRestore(entry.id)}
      className="w-full text-left rounded-md border border-[#27272A] bg-[#18181B] hover:bg-[#27272A]/60 transition-colors px-3 py-2"
    >
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] font-semibold text-[#FE5000] uppercase tracking-wide">
          {entry.type}
        </span>
        <span className="text-[10px] text-zinc-600">
          {new Date(entry.generatedAt).toLocaleString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <p className="text-xs text-zinc-400 line-clamp-2">{entry.summary}</p>
    </button>
  );
}

// ── Page ─────────────────────────────────────────────────────

const HISTORY_KEY = 'di_brief_history';
const MAX_HISTORY = 20;

function loadHistory(): HistoryEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? (JSON.parse(raw) as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function saveToHistory(brief: IntelligenceBrief): void {
  const history = loadHistory();
  const entry: HistoryEntry = {
    id: brief.id,
    type: brief.type,
    generatedAt: brief.generatedAt,
    summary: brief.summary,
  };
  const updated = [entry, ...history.filter((h) => h.id !== brief.id)].slice(
    0,
    MAX_HISTORY,
  );
  localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
}

export default function BriefPage() {
  const [brief, setBrief] = useState<IntelligenceBrief | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [briefType, setBriefType] = useState<'daily' | 'weekly' | 'flash'>(
    'daily',
  );
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [briefCache, setBriefCache] = useState<
    Map<string, IntelligenceBrief>
  >(new Map());

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const generate = useCallback(
    async (type: 'daily' | 'weekly' | 'flash') => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/brief?type=${type}`);
        const data = await res.json();
        if (data.success && data.brief) {
          const b = data.brief as IntelligenceBrief;
          setBrief(b);
          saveToHistory(b);
          setHistory(loadHistory());
          setBriefCache((prev) => {
            const next = new Map(prev);
            next.set(b.id, b);
            return next;
          });
        } else {
          setError(data.error ?? 'Failed to generate brief');
        }
      } catch {
        setError('Unable to reach brief API');
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const restoreFromHistory = useCallback(
    (id: string) => {
      const cached = briefCache.get(id);
      if (cached) {
        setBrief(cached);
      }
    },
    [briefCache],
  );

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <FileText size={20} className="text-[#FE5000]" />
          <h1 className="text-lg font-semibold text-white">
            Delta Intelligence Brief
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Type selector */}
          <div className="flex rounded-lg border border-[#27272A] overflow-hidden">
            {(['daily', 'weekly', 'flash'] as const).map((t) => (
              <button
                key={t}
                onClick={() => setBriefType(t)}
                className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                  briefType === t
                    ? 'bg-[#FE5000] text-white'
                    : 'bg-[#18181B] text-zinc-400 hover:text-white'
                }`}
              >
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          {/* Generate */}
          <button
            onClick={() => generate(briefType)}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-[#FE5000] text-white text-xs font-semibold hover:bg-[#CC4000] disabled:opacity-50 transition-colors"
          >
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            {loading ? 'Generating...' : 'Generate'}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-6 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {error}
        </div>
      )}

      {/* Brief content */}
      {brief && (
        <div className="space-y-4 mb-8">
          {/* Timestamp */}
          <div className="flex items-center gap-2 text-[10px] text-zinc-600">
            <Clock size={12} />
            <span>
              Generated{' '}
              {new Date(brief.generatedAt).toLocaleString('en-US', {
                weekday: 'short',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#27272A] text-zinc-400 uppercase text-[9px] font-semibold">
              {brief.type}
            </span>
            <span className="text-zinc-600">Period: {brief.period}</span>
          </div>

          {/* Sections */}
          {brief.sections.map((section) => (
            <SectionCard key={section.title} section={section} />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!brief && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText size={40} className="text-zinc-700 mb-2.5" />
          <p className="text-sm text-zinc-500 mb-2">No brief generated yet</p>
          <p className="text-xs text-zinc-600 mb-2.5">
            Select a brief type and click Generate to pull the latest KPIs.
          </p>
          <button
            onClick={() => generate(briefType)}
            className="px-4 py-2 rounded-lg bg-[#FE5000] text-white text-xs font-semibold hover:bg-[#CC4000] transition-colors"
          >
            Generate {briefType.charAt(0).toUpperCase() + briefType.slice(1)}{' '}
            Brief
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !brief && (
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="h-36 rounded-lg bg-[#18181B] border border-[#27272A] animate-pulse"
            />
          ))}
        </div>
      )}

      {/* History */}
      {history.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wide mb-2">
            Recent Briefs
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {history.map((entry) => (
              <HistoryItem
                key={entry.id}
                entry={entry}
                onRestore={restoreFromHistory}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
