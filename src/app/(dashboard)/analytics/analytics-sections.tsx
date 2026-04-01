'use client';

import type {
  AnalyticsData,
  ChatInsights,
  TopEndpoint,
  AutomationRun,
  WorkspaceItem,
} from './analytics-types';

// ── Shared Helpers ────────────────────────────────────────────

export function fmtCost(n: number): string {
  if (n < 0.01) return `$${n.toFixed(4)}`;
  if (n < 1) return `$${n.toFixed(3)}`;
  return `$${n.toFixed(2)}`;
}

export function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function pct(a: number, b: number): string {
  if (b === 0) return '0%';
  return `${Math.round((a / b) * 100)}%`;
}

export function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

// ── Shared Sub-components ─────────────────────────────────────

export function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-5 shadow-sm">
      <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-4">
        {title}
      </h3>
      {children}
    </div>
  );
}

function Kpi({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#A1A1AA] uppercase tracking-wide">{label}</span>
      <span className="text-lg font-bold font-mono text-[#09090B] dark:text-white">{value}</span>
      {sub && <span className="text-[10px] text-[#71717A]">{sub}</span>}
    </div>
  );
}

function BarInline({ value, max, color }: { value: number; max: number; color: string }) {
  const width = max > 0 ? Math.max(2, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-3 w-full bg-[#F4F4F5] dark:bg-[#27272A] rounded overflow-hidden">
      <div className="h-full rounded transition-all" style={{ width: `${width}%`, backgroundColor: color }} />
    </div>
  );
}

function StatusDot({ status }: { status: string }) {
  const color = status === 'success' ? '#22C55E' : status === 'error' ? '#EF4444' : '#A1A1AA';
  return <span className="w-2 h-2 rounded-full inline-block shrink-0" style={{ backgroundColor: color }} />;
}

// ── Section 1: Usage Overview ────────────────────────────────

const MODEL_COLORS: Record<string, string> = {
  Haiku: '#3B82F6',
  Sonnet: '#FE5000',
  Opus: '#8B5CF6',
  'GPT-4o': '#22C55E',
  'Gemini Flash': '#FBBF24',
};

export function UsageOverview({
  usage,
  activeUsers,
  modelEntries,
  maxModelQueries,
}: {
  usage: AnalyticsData['usage'];
  activeUsers: number;
  modelEntries: [string, { queries: number; cost: number }][];
  maxModelQueries: number;
}) {
  return (
    <Card title="Usage Overview">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <Kpi label="All Time" value={String(usage.allTime.queries)} sub="total queries" />
        <Kpi label="This Week" value={String(usage.thisWeek.queries)} sub="queries" />
        <Kpi label="Today" value={String(usage.today.queries)} sub="queries" />
        <Kpi label="Active Users" value={String(activeUsers)} sub="this week" />
      </div>
      <div className="grid grid-cols-2 gap-4 mb-5">
        <Kpi
          label="Total Tokens"
          value={fmtTokens(usage.allTime.inputTokens + usage.allTime.outputTokens)}
          sub={`${fmtTokens(usage.allTime.inputTokens)} in / ${fmtTokens(usage.allTime.outputTokens)} out`}
        />
        <Kpi label="Estimated Cost" value={fmtCost(usage.allTime.cost)} sub="all time" />
      </div>
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Queries by Model</p>
      <div className="space-y-2">
        {modelEntries.map(([model, stats]) => (
          <div key={model} className="flex items-center gap-3">
            <span className="text-xs text-[#A1A1AA] w-20 shrink-0 truncate">{model}</span>
            <div className="flex-1">
              <BarInline value={stats.queries} max={maxModelQueries} color={MODEL_COLORS[model] ?? '#71717A'} />
            </div>
            <span className="text-xs font-mono text-[#09090B] dark:text-white w-10 text-right">{stats.queries}</span>
          </div>
        ))}
        {modelEntries.length === 0 && <p className="text-xs text-[#71717A]">No model usage data yet.</p>}
      </div>
    </Card>
  );
}

// ── Section 2: Top Queries & Topics ──────────────────────────

export function TopQueriesSection({
  topEndpoints,
  topUsers,
}: {
  topEndpoints: TopEndpoint[];
  topUsers: AnalyticsData['usage']['topUsers'];
}) {
  return (
    <Card title="Top Users & Endpoints">
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Top Users</p>
      {topUsers.length > 0 ? (
        <div className="space-y-1.5 mb-5">
          {topUsers.slice(0, 5).map((u) => (
            <div key={u.email} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
              <span className="text-xs text-[#09090B] dark:text-white truncate max-w-[60%]">{u.email}</span>
              <div className="flex items-center gap-3">
                <span className="text-[10px] text-[#A1A1AA] font-mono">{u.queries} queries</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono">{fmtCost(u.cost)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#71717A] mb-5">No user data yet.</p>
      )}
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Most Called Endpoints</p>
      {topEndpoints.length > 0 ? (
        <div className="space-y-1.5">
          {topEndpoints.slice(0, 8).map((ep) => (
            <div key={ep.endpoint} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
              <span className="text-xs font-mono text-[#09090B] dark:text-white truncate max-w-[70%]">{ep.endpoint}</span>
              <span className="text-xs font-mono text-[#A1A1AA]">{ep.calls}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#71717A]">No endpoint data yet.</p>
      )}
    </Card>
  );
}

// ── Section 3: Response Quality ──────────────────────────────

export function ResponseQualitySection({
  feedback,
  thumbsUpPct,
}: {
  feedback: AnalyticsData['feedback'];
  thumbsUpPct: number;
}) {
  const fbModelEntries = Object.entries(feedback.byModel).sort((a, b) => b[1].total - a[1].total);

  return (
    <Card title="Response Quality">
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Kpi label="Total Feedback" value={String(feedback.total)} />
        <Kpi label="Thumbs Up" value={`${thumbsUpPct}%`} sub={`${feedback.thumbsUp} of ${feedback.total}`} />
        <Kpi label="Thumbs Down" value={String(feedback.thumbsDown)} />
      </div>
      {feedback.total > 0 && (
        <div className="mb-5">
          <div className="flex h-4 rounded overflow-hidden">
            <div className="transition-all" style={{ width: pct(feedback.thumbsUp, feedback.total), backgroundColor: '#22C55E' }} />
            <div className="transition-all" style={{ width: pct(feedback.thumbsDown, feedback.total), backgroundColor: '#EF4444' }} />
            <div className="flex-1 bg-[#27272A]" />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[10px] text-[#22C55E]">Positive</span>
            <span className="text-[10px] text-[#EF4444]">Negative</span>
          </div>
        </div>
      )}
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Quality by Model</p>
      {fbModelEntries.length > 0 ? (
        <div className="space-y-1.5">
          {fbModelEntries.map(([model, stats]) => (
            <div key={model} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
              <span className="text-xs text-[#09090B] dark:text-white">{model}</span>
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-[#22C55E] font-mono">{stats.up} up</span>
                <span className="text-[10px] text-[#EF4444] font-mono">{stats.down} down</span>
                <span className="text-[10px] text-[#A1A1AA] font-mono">({stats.total > 0 ? pct(stats.up, stats.total) : '0%'})</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#71717A]">No feedback data yet.</p>
      )}
      {feedback.recentEntries.filter((e) => e.rating === 'down').length > 0 && (
        <>
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2 mt-4">Recent Negative Feedback</p>
          <div className="space-y-1.5">
            {feedback.recentEntries.filter((e) => e.rating === 'down').slice(0, 5).map((e) => (
              <div key={e.id} className="py-1.5 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
                <p className="text-xs text-[#09090B] dark:text-white truncate">{e.query || 'No query recorded'}</p>
                {e.comment && <p className="text-[10px] text-[#71717A] mt-0.5 line-clamp-2">{e.comment}</p>}
                <span className="text-[10px] text-[#A1A1AA]">{e.model} - {timeAgo(e.createdAt)}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Section 4: Data Source Usage ─────────────────────────────

export function DataSourceSection({
  topEndpoints,
  errors,
}: {
  topEndpoints: TopEndpoint[];
  errors: AnalyticsData['errors'];
}) {
  const maxCalls = Math.max(1, ...topEndpoints.slice(0, 10).map((e) => e.calls));
  const errorEndpoints = Object.entries(errors.byEndpoint).sort((a, b) => b[1] - a[1]).slice(0, 8);

  return (
    <Card title="Data Source Usage">
      <div className="grid grid-cols-3 gap-4 mb-5">
        <Kpi label="Total Errors" value={String(errors.total)} />
        <Kpi label="Last 24h" value={String(errors.last24h)} />
        <Kpi label="Endpoints Hit" value={String(topEndpoints.length)} />
      </div>
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Endpoint Call Volume</p>
      {topEndpoints.length > 0 ? (
        <div className="space-y-2 mb-5">
          {topEndpoints.slice(0, 10).map((ep) => (
            <div key={ep.endpoint} className="flex items-center gap-3">
              <span className="text-[10px] font-mono text-[#A1A1AA] w-32 shrink-0 truncate" title={ep.endpoint}>{ep.endpoint}</span>
              <div className="flex-1"><BarInline value={ep.calls} max={maxCalls} color="#3B82F6" /></div>
              <span className="text-xs font-mono text-[#09090B] dark:text-white w-8 text-right">{ep.calls}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#71717A] mb-5">No endpoint data yet.</p>
      )}
      {errorEndpoints.length > 0 && (
        <>
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Errors by Endpoint</p>
          <div className="space-y-1.5">
            {errorEndpoints.map(([endpoint, count]) => (
              <div key={endpoint} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
                <span className="text-xs font-mono text-[#EF4444] truncate max-w-[70%]">{endpoint}</span>
                <span className="text-xs font-mono text-[#A1A1AA]">{count}</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Section 5: Workspace Performance ─────────────────────────

export function WorkspaceSection({
  workspaces,
  total,
}: {
  workspaces: WorkspaceItem[];
  total: number;
}) {
  const sorted = [...workspaces].sort((a, b) => b.usageCount - a.usageCount);
  const maxUsage = Math.max(1, ...sorted.map((w) => w.usageCount));

  return (
    <Card title="Workspace Performance">
      <Kpi label="Total Workspaces" value={String(total)} />
      <div className="mt-4 space-y-2">
        {sorted.length > 0 ? (
          sorted.map((w) => (
            <div key={w.id} className="flex items-center gap-3">
              <span className="text-xs text-[#09090B] dark:text-white w-28 shrink-0 truncate">{w.name}</span>
              <div className="flex-1"><BarInline value={w.usageCount} max={maxUsage} color="#FE5000" /></div>
              <span className="text-xs font-mono text-[#A1A1AA] w-8 text-right">{w.usageCount}</span>
              {w.rating != null && <span className="text-[10px] text-[#FBBF24] w-10 text-right">{w.rating}/5</span>}
            </div>
          ))
        ) : (
          <p className="text-xs text-[#71717A]">No workspaces configured yet.</p>
        )}
      </div>
    </Card>
  );
}

// ── Section 6: Automation Health ─────────────────────────────

export function AutomationSection({
  automations,
}: {
  automations: AnalyticsData['automations'];
}) {
  return (
    <Card title="Automation Health">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <Kpi label="Total Runs" value={String(automations.totalRuns)} />
        <Kpi label="Success" value={String(automations.successCount)} />
        <Kpi label="Errors" value={String(automations.errorCount)} />
        <Kpi label="Success Rate" value={`${automations.successRate}%`} sub={automations.totalRuns > 0 ? undefined : 'no runs'} />
      </div>
      {automations.totalRuns > 0 && (
        <div className="mb-5">
          <div className="flex h-3 rounded overflow-hidden">
            <div className="transition-all" style={{ width: `${automations.successRate}%`, backgroundColor: '#22C55E' }} />
            <div className="flex-1 bg-[#EF4444]/30" />
          </div>
        </div>
      )}
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Recent Runs</p>
      {automations.recentRuns.length > 0 ? (
        <div className="space-y-1.5">
          {automations.recentRuns.slice(0, 8).map((run: AutomationRun, i: number) => (
            <div key={`${run.automationId}-${i}`} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                <StatusDot status={run.status} />
                <span className="text-xs text-[#09090B] dark:text-white truncate">{run.automationId}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-[#A1A1AA] capitalize">{run.status}</span>
                <span className="text-[10px] text-[#71717A]">{timeAgo(run.startedAt)}</span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-xs text-[#71717A]">No automation runs yet.</p>
      )}
      {automations.recentRuns.filter((r) => r.status === 'error').length > 0 && (
        <>
          <p className="text-[10px] text-[#EF4444] uppercase tracking-wide mb-2 mt-4">Failed Runs</p>
          <div className="space-y-1.5">
            {automations.recentRuns.filter((r) => r.status === 'error').slice(0, 5).map((run, i) => (
              <div key={`err-${run.automationId}-${i}`} className="py-1.5 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
                <p className="text-xs text-[#09090B] dark:text-white">{run.automationId}</p>
                {run.error && <p className="text-[10px] text-[#EF4444] mt-0.5 line-clamp-2">{run.error}</p>}
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}

// ── Section 7: Chat Insights ─────────────────────────────────

export function ChatInsightsSection({ insights }: { insights: ChatInsights }) {
  const maxHour = Math.max(1, ...insights.hourDistribution);

  return (
    <Card title="Chat Insights (Local)">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-5">
        <Kpi label="Conversations" value={String(insights.totalConversations)} />
        <Kpi label="Avg Messages" value={String(insights.avgMessagesPerConvo)} sub="per conversation" />
        <Kpi label="Avg Response" value={`${insights.avgResponseLength}`} sub="characters" />
        <Kpi label="First Questions" value={String(insights.topFirstQuestions.length)} sub="unique patterns" />
      </div>
      <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Usage by Hour</p>
      <div className="flex items-end gap-px h-16 mb-5">
        {insights.hourDistribution.map((count, hour) => (
          <div
            key={hour}
            className="flex-1 rounded-t transition-all hover:opacity-80"
            style={{
              height: `${Math.max(2, (count / maxHour) * 100)}%`,
              backgroundColor: count > 0 ? '#FE5000' : '#27272A',
            }}
            title={`${hour}:00 - ${count} messages`}
          />
        ))}
      </div>
      <div className="flex justify-between text-[8px] text-[#52525B] mb-5">
        <span>12am</span>
        <span>6am</span>
        <span>12pm</span>
        <span>6pm</span>
        <span>12am</span>
      </div>
      {insights.topFirstQuestions.length > 0 && (
        <>
          <p className="text-[10px] text-[#A1A1AA] uppercase tracking-wide mb-2">Common First Questions</p>
          <div className="space-y-1.5">
            {insights.topFirstQuestions.map((q) => (
              <div key={q.question} className="flex items-center justify-between py-1 border-b border-[#F4F4F5] dark:border-[#27272A] last:border-0">
                <span className="text-xs text-[#09090B] dark:text-white truncate max-w-[80%]">{q.question}</span>
                <span className="text-[10px] font-mono text-[#A1A1AA]">{q.count}x</span>
              </div>
            ))}
          </div>
        </>
      )}
    </Card>
  );
}
