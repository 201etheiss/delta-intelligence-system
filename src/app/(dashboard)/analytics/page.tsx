'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { AnalyticsData, ChatInsights, StoredConversation } from './analytics-types';
import {
  timeAgo,
  UsageOverview,
  TopQueriesSection,
  ResponseQualitySection,
  DataSourceSection,
  WorkspaceSection,
  AutomationSection,
  ChatInsightsSection,
} from './analytics-sections';

// ── Helpers ───────────────────────────────────────────────────

function loadConversations(): StoredConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem('di_conversations');
    return raw ? (JSON.parse(raw) as StoredConversation[]) : [];
  } catch {
    return [];
  }
}

function computeChatInsights(convos: StoredConversation[]): ChatInsights {
  const totalConversations = convos.length;
  if (totalConversations === 0) {
    return {
      totalConversations: 0,
      avgMessagesPerConvo: 0,
      avgResponseLength: 0,
      topFirstQuestions: [],
      hourDistribution: new Array(24).fill(0) as number[],
    };
  }

  let totalMessages = 0;
  let totalResponseChars = 0;
  let responseCount = 0;
  const firstQuestionCounts: Record<string, number> = {};
  const hourDist = new Array(24).fill(0) as number[];

  for (const c of convos) {
    const msgs = c.messages ?? [];
    totalMessages += msgs.length;

    const firstUser = msgs.find((m) => m.role === 'user');
    if (firstUser) {
      const q = firstUser.content.trim().slice(0, 80);
      firstQuestionCounts[q] = (firstQuestionCounts[q] ?? 0) + 1;
    }

    for (const m of msgs) {
      if (m.role === 'assistant') {
        totalResponseChars += m.content.length;
        responseCount++;
      }
      try {
        const hour = new Date(m.timestamp).getHours();
        if (hour >= 0 && hour < 24) hourDist[hour]++;
      } catch {
        // skip invalid timestamps
      }
    }
  }

  const topFirstQuestions = Object.entries(firstQuestionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([question, count]) => ({ question, count }));

  return {
    totalConversations,
    avgMessagesPerConvo: Math.round(totalMessages / totalConversations),
    avgResponseLength: responseCount > 0 ? Math.round(totalResponseChars / responseCount) : 0,
    topFirstQuestions,
    hourDistribution: hourDist,
  };
}

// ── Main Component ────────────────────────────────────────────

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chatInsights, setChatInsights] = useState<ChatInsights | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/analytics');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as AnalyticsData;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load analytics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 60_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const convos = loadConversations();
    setChatInsights(computeChatInsights(convos));
  }, []);

  const modelEntries = useMemo(() => {
    if (!data) return [];
    return Object.entries(data.usage.byModel).sort((a, b) => b[1].queries - a[1].queries);
  }, [data]);

  const maxModelQueries = useMemo(
    () => Math.max(1, ...modelEntries.map(([, v]) => v.queries)),
    [modelEntries]
  );

  const activeUsersThisWeek = useMemo(() => {
    if (!data) return 0;
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    const weekEmails = new Set(
      data.usage.recentEntries
        .filter((e) => new Date(e.timestamp).getTime() >= weekAgo)
        .map((e) => e.userEmail)
    );
    return weekEmails.size;
  }, [data]);

  if (loading) {
    return (
      <div className="px-5 py-4 h-full overflow-y-auto bg-white dark:bg-[#09090B]">
        <div className="animate-pulse space-y-4">
          <div className="h-8 w-48 bg-[#F4F4F5] dark:bg-[#27272A] rounded" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-48 bg-[#F4F4F5] dark:bg-[#27272A] rounded-lg" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-5 py-4 h-full overflow-y-auto bg-white dark:bg-[#09090B]">
        <div className="rounded-md border border-red-200 dark:border-red-700/50 bg-red-50 dark:bg-red-900/30 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const u = data.usage;
  const fb = data.feedback;
  const thumbsUpPct = fb.total > 0 ? Math.round((fb.thumbsUp / fb.total) * 100) : 0;

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Platform Analytics</h2>
          <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">
            Usage, quality, and performance insights
          </p>
        </div>
        <span className="text-[10px] text-[#52525B] font-mono">
          Updated {data.cachedAt ? timeAgo(data.cachedAt) : '--'}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <UsageOverview
          usage={u}
          activeUsers={activeUsersThisWeek}
          modelEntries={modelEntries}
          maxModelQueries={maxModelQueries}
        />
        <TopQueriesSection topEndpoints={u.topEndpoints} topUsers={u.topUsers} />
        <ResponseQualitySection feedback={fb} thumbsUpPct={thumbsUpPct} />
        <DataSourceSection topEndpoints={u.topEndpoints} errors={data.errors} />
        <WorkspaceSection workspaces={data.workspaces.items} total={data.workspaces.total} />
        <AutomationSection automations={data.automations} />
        {chatInsights && <ChatInsightsSection insights={chatInsights} />}
      </div>
    </div>
  );
}
