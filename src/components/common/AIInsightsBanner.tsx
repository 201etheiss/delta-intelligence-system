'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Lightbulb, AlertTriangle, TrendingUp, X, ChevronDown, ChevronUp, Zap } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Insight {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'trend';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  dismissible: boolean;
}

interface AIInsightsBannerProps {
  module: string;
  compact?: boolean;
}

// ---------------------------------------------------------------------------
// Style maps
// ---------------------------------------------------------------------------

const SEVERITY_STYLES: Record<string, { border: string; bg: string; icon: string }> = {
  info: { border: 'border-l-blue-400', bg: 'bg-blue-500/5', icon: 'text-blue-400' },
  warning: { border: 'border-l-amber-400', bg: 'bg-amber-500/5', icon: 'text-amber-400' },
  warn: { border: 'border-l-amber-400', bg: 'bg-amber-500/5', icon: 'text-amber-400' },
  critical: { border: 'border-l-red-400', bg: 'bg-red-500/5', icon: 'text-red-400' },
  trend: { border: 'border-l-green-400', bg: 'bg-green-500/5', icon: 'text-green-400' },
};

function getStyles(insight: Insight) {
  return SEVERITY_STYLES[insight.type] ?? SEVERITY_STYLES[insight.severity] ?? SEVERITY_STYLES.info;
}

function InsightIcon({ insight, size = 14 }: { insight: Insight; size?: number }) {
  const styles = getStyles(insight);
  switch (insight.type) {
    case 'warning':
    case 'critical':
      return <AlertTriangle size={size} className={styles.icon} />;
    case 'trend':
      return <TrendingUp size={size} className={styles.icon} />;
    default:
      return <Lightbulb size={size} className={styles.icon} />;
  }
}

// ---------------------------------------------------------------------------
// Dismissed storage
// ---------------------------------------------------------------------------

const STORAGE_KEY = 'di-dismissed-insights';

function getDismissed(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

function addDismissed(id: string) {
  const set = getDismissed();
  set.add(id);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(set)));
  } catch {
    // storage full — ignore
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function AIInsightsBanner({ module, compact = false }: AIInsightsBannerProps) {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch(`/api/insights?module=${encodeURIComponent(module)}`);
      if (!res.ok) {
        setInsights([]);
        return;
      }
      const data = await res.json();
      setInsights(data.insights ?? []);
    } catch {
      setInsights([]);
    } finally {
      setLoading(false);
    }
  }, [module]);

  useEffect(() => {
    setDismissed(getDismissed());
    fetchInsights();
    intervalRef.current = setInterval(fetchInsights, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchInsights]);

  const handleDismiss = (id: string) => {
    addDismissed(id);
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  // Filter dismissed
  const visible = insights.filter((i) => !dismissed.has(i.id));
  if (visible.length === 0 && !loading) return null;

  // Skeleton
  if (loading) {
    return (
      <div className="h-[36px] rounded-md bg-zinc-800/40 animate-pulse" />
    );
  }

  const primary = visible[0];
  if (!primary) return null;

  // ── Compact mode ────────────────────────────────────────────
  if (compact && !expanded) {
    const styles = getStyles(primary);
    return (
      <div
        className={`flex items-center gap-2 rounded-md border-l-2 ${styles.border} ${styles.bg} px-3 py-2 min-h-[36px] max-h-[40px]`}
      >
        <Zap size={12} className="text-[#FF5C00] shrink-0" />
        <InsightIcon insight={primary} size={14} />
        <span className="text-xs text-zinc-300 truncate flex-1">{primary.title}</span>
        {primary.action && primary.actionUrl && (
          <a
            href={primary.actionUrl}
            className="text-xs text-[#FF5C00] hover:underline shrink-0"
          >
            {primary.action}
          </a>
        )}
        {visible.length > 1 && (
          <button
            onClick={() => setExpanded(true)}
            className="flex items-center gap-0.5 text-xs text-zinc-500 hover:text-zinc-300 shrink-0"
          >
            +{visible.length - 1}
            <ChevronDown size={12} />
          </button>
        )}
        {primary.dismissible && (
          <button
            onClick={() => handleDismiss(primary.id)}
            className="text-zinc-600 hover:text-zinc-400 shrink-0"
          >
            <X size={12} />
          </button>
        )}
      </div>
    );
  }

  // ── Expanded mode ───────────────────────────────────────────
  return (
    <div className="rounded-md border border-zinc-800 bg-zinc-900/50 overflow-hidden">
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-zinc-800">
        <div className="flex items-center gap-1.5">
          <Zap size={12} className="text-[#FF5C00]" />
          <span className="text-xs font-medium text-zinc-400">AI Insights</span>
          <span className="text-[10px] text-zinc-600">({visible.length})</span>
        </div>
        {compact && (
          <button
            onClick={() => setExpanded(false)}
            className="text-zinc-600 hover:text-zinc-400"
          >
            <ChevronUp size={14} />
          </button>
        )}
      </div>
      <div className="divide-y divide-zinc-800/60">
        {visible.slice(0, 3).map((insight) => {
          const styles = getStyles(insight);
          return (
            <div
              key={insight.id}
              className={`flex items-start gap-2 px-3 py-2 border-l-2 ${styles.border} ${styles.bg}`}
            >
              <InsightIcon insight={insight} size={14} />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-zinc-300">{insight.title}</p>
                {insight.description && (
                  <p className="text-[11px] text-zinc-500 mt-0.5">{insight.description}</p>
                )}
              </div>
              {insight.action && insight.actionUrl && (
                <a
                  href={insight.actionUrl}
                  className="text-xs text-[#FF5C00] hover:underline shrink-0 mt-0.5"
                >
                  {insight.action}
                </a>
              )}
              {insight.dismissible && (
                <button
                  onClick={() => handleDismiss(insight.id)}
                  className="text-zinc-600 hover:text-zinc-400 shrink-0 mt-0.5"
                >
                  <X size={12} />
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
