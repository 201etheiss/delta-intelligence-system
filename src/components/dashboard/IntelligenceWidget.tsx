'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';

// ── Types ───────────────────────────────────────────────────

interface AnomalyItem {
  id: string;
  metric: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  category: string;
  recommendedAction: string;
}

interface SuggestionItem {
  text: string;
  category: string;
  description: string;
  source: string;
}

interface PatternItem {
  id: string;
  name: string;
  description: string;
  confidence: number;
  recommendedAction: string;
}

interface AutomationSummary {
  total: number;
  enabled: number;
  recentRuns: number;
}

interface IntelligenceData {
  anomalies: AnomalyItem[];
  suggestions: SuggestionItem[];
  patterns: PatternItem[];
  automations: AutomationSummary;
  loading: boolean;
  error: string | null;
}

// ── Component ───────────────────────────────────────────────

interface IntelligenceWidgetProps {
  page?: string;
  compact?: boolean;
}

export default function IntelligenceWidget({ page = '/', compact = false }: IntelligenceWidgetProps) {
  const [data, setData] = useState<IntelligenceData>({
    anomalies: [],
    suggestions: [],
    patterns: [],
    automations: { total: 0, enabled: 0, recentRuns: 0 },
    loading: true,
    error: null,
  });
  const [activeTab, setActiveTab] = useState<'anomalies' | 'suggestions' | 'patterns'>('anomalies');

  const fetchData = useCallback(async () => {
    try {
      const [anomalyRes, suggestionsRes, patternsRes, automationsRes] = await Promise.all([
        fetch('/api/anomalies').then((r) => r.json()).catch(() => ({ success: false })),
        fetch(`/api/suggestions?page=${encodeURIComponent(page)}`).then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/patterns').then((r) => r.json()).catch(() => ({ success: false })),
        fetch('/api/automations').then((r) => r.json()).catch(() => ({ automations: [] })),
      ]);

      const anomalies: AnomalyItem[] = (anomalyRes.success && Array.isArray(anomalyRes.anomalies))
        ? (anomalyRes.anomalies as AnomalyItem[]).slice(0, 5)
        : [];

      const suggestions: SuggestionItem[] = (suggestionsRes.success && Array.isArray(suggestionsRes.suggestions))
        ? (suggestionsRes.suggestions as SuggestionItem[]).slice(0, 5)
        : [];

      const patterns: PatternItem[] = (patternsRes.success && Array.isArray(patternsRes.patterns))
        ? (patternsRes.patterns as PatternItem[]).slice(0, 5)
        : [];

      const automationsList = Array.isArray(automationsRes.automations) ? automationsRes.automations : [];
      const automations: AutomationSummary = {
        total: automationsList.length,
        enabled: automationsList.filter((a: Record<string, unknown>) => a.enabled).length,
        recentRuns: automationsList.reduce((sum: number, a: Record<string, unknown>) => sum + (Number(a.runCount) || 0), 0),
      };

      setData({
        anomalies,
        suggestions,
        patterns,
        automations,
        loading: false,
        error: null,
      });
    } catch (err) {
      setData((prev) => ({
        ...prev,
        loading: false,
        error: err instanceof Error ? err.message : 'Failed to load intelligence data',
      }));
    }
  }, [page]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const criticalCount = data.anomalies.filter((a) => a.severity === 'critical').length;
  const warningCount = data.anomalies.filter((a) => a.severity === 'warning').length;

  if (data.loading) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4 animate-pulse">
        <div className="h-4 w-32 bg-[#27272A] rounded mb-3" />
        <div className="space-y-2">
          <div className="h-3 w-full bg-[#27272A] rounded" />
          <div className="h-3 w-3/4 bg-[#27272A] rounded" />
          <div className="h-3 w-1/2 bg-[#27272A] rounded" />
        </div>
      </div>
    );
  }

  if (data.error) {
    return (
      <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
        <p className="text-xs text-[#A1A1AA]">Intelligence unavailable</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#27272A]">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-[#FF5C00]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
          <span className="text-xs font-semibold text-white uppercase tracking-wide">AI Intelligence</span>
        </div>
        <div className="flex items-center gap-2">
          {criticalCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2 py-0.5 text-[10px] font-semibold text-red-400">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
              {criticalCount}
            </span>
          )}
          {warningCount > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-orange-500/10 px-2 py-0.5 text-[10px] font-semibold text-orange-400">
              {warningCount}
            </span>
          )}
          <span className="text-[10px] text-[#71717A]">{data.automations.enabled} active</span>
        </div>
      </div>

      {/* Summary Row */}
      <div className="grid grid-cols-4 gap-px bg-[#27272A]">
        <StatBox label="Anomalies" value={String(data.anomalies.length)} color={criticalCount > 0 ? '#EF4444' : '#A1A1AA'} />
        <StatBox label="Automations" value={String(data.automations.enabled)} color="#22C55E" />
        <StatBox label="Patterns" value={String(data.patterns.length)} color="#8B5CF6" />
        <StatBox label="Suggestions" value={String(data.suggestions.length)} color="#3B82F6" />
      </div>

      {/* Tab bar */}
      <div className="flex border-b border-[#27272A]">
        {(['anomalies', 'suggestions', 'patterns'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 px-3 py-2 text-[10px] font-medium uppercase tracking-wide transition-colors ${
              activeTab === tab
                ? 'text-[#FF5C00] border-b-2 border-[#FF5C00] bg-[#FF5C00]/5'
                : 'text-[#71717A] hover:text-[#A1A1AA]'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={`px-4 py-3 ${compact ? 'max-h-48' : 'max-h-64'} overflow-y-auto`}>
        {activeTab === 'anomalies' && (
          <div className="space-y-2">
            {data.anomalies.length === 0 ? (
              <p className="text-xs text-[#71717A]">No anomalies detected</p>
            ) : (
              (data.anomalies ?? []).map((a) => (
                <div key={a.id} className="flex items-start gap-2">
                  <span
                    className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${
                      a.severity === 'critical' ? 'bg-red-500 animate-pulse' :
                      a.severity === 'warning' ? 'bg-orange-500' : 'bg-blue-500'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-xs text-white font-medium">{a.metric}</p>
                    <p className="text-[10px] text-[#A1A1AA] line-clamp-1">{a.description}</p>
                    {a.recommendedAction && (
                      <p className="text-[10px] text-[#FF5C00] mt-0.5">{a.recommendedAction}</p>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {activeTab === 'suggestions' && (
          <div className="space-y-2">
            {data.suggestions.length === 0 ? (
              <p className="text-xs text-[#71717A]">No suggestions available</p>
            ) : (
              (data.suggestions ?? []).map((s, i) => (
                <Link
                  key={`suggestion-${i}`}
                  href="/chat"
                  className="block rounded-lg border border-[#27272A] px-3 py-2 hover:border-[#FF5C00]/30 hover:bg-[#27272A]/50 transition-colors"
                >
                  <p className="text-xs text-white">{s.text}</p>
                  {s.description && (
                    <p className="text-[10px] text-[#71717A] mt-0.5">{s.description}</p>
                  )}
                </Link>
              ))
            )}
          </div>
        )}

        {activeTab === 'patterns' && (
          <div className="space-y-2">
            {data.patterns.length === 0 ? (
              <p className="text-xs text-[#71717A]">No patterns discovered yet</p>
            ) : (
              (data.patterns ?? []).map((p) => (
                <div key={p.id} className="border-b border-[#27272A] pb-2 last:border-0">
                  <div className="flex items-center justify-between">
                    <p className="text-xs text-white font-medium">{p.name}</p>
                    <span className="text-[10px] text-[#71717A] font-mono">
                      {typeof p.confidence === 'number' ? `${(p.confidence * 100).toFixed(0)}%` : '--'}
                    </span>
                  </div>
                  <p className="text-[10px] text-[#A1A1AA] line-clamp-2 mt-0.5">{p.description}</p>
                  {p.recommendedAction && (
                    <p className="text-[10px] text-[#FF5C00] mt-0.5">{p.recommendedAction}</p>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Footer link */}
      <Link
        href="/analytics"
        className="flex items-center justify-center gap-1.5 border-t border-[#27272A] px-4 py-2.5 text-[10px] font-medium text-[#71717A] hover:text-[#FF5C00] transition-colors"
      >
        View Full Intelligence Dashboard
        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </Link>
    </div>
  );
}

// ── Sub-components ──────────────────────────────────────────

function StatBox({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#18181B] px-3 py-2.5 text-center">
      <p className="text-lg font-bold font-mono text-white" style={{ color }}>{value}</p>
      <p className="text-[9px] text-[#71717A] uppercase tracking-wide mt-0.5">{label}</p>
    </div>
  );
}
