'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Settings, Users, Shield, BarChart3, Activity, RefreshCw, Download, FileSearch, ThumbsUp, ThumbsDown } from 'lucide-react';

interface PeriodStats {
  queries: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
}

interface UsageEntry {
  timestamp: string;
  userEmail: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
}

interface TopUser {
  email: string;
  queries: number;
  tokens: number;
  cost: number;
}

interface TopEndpoint {
  endpoint: string;
  calls: number;
}

interface UsageStats {
  today: PeriodStats;
  thisWeek: PeriodStats;
  thisMonth: PeriodStats;
  allTime: PeriodStats;
  byModel: Record<string, PeriodStats>;
  recentEntries: UsageEntry[];
  topUsers: TopUser[];
  topEndpoints: TopEndpoint[];
}

function fmtCost(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.0000';
  return `$${n.toFixed(4)}`;
}

function fmtTokens(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0';
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function fmtTime(ts: string): string {
  try {
    return new Date(ts).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

const MODEL_COLORS: Record<string, string> = {
  Haiku: '#22C55E',
  Sonnet: '#3B82F6',
  Opus: '#A855F7',
  'GPT-4o': '#F59E0B',
  'Gemini Flash': '#EC4899',
};

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

export default function AdminUsagePage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'admin';
  const [stats, setStats] = useState<UsageStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedbackStats, setFeedbackStats] = useState<{
    total: number;
    thumbsUp: number;
    thumbsDown: number;
    byModel: Record<string, { up: number; down: number; total: number }>;
  } | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/usage');
      const data = await res.json();
      if (data.success && data.stats) {
        setStats(data.stats);
        setError(null);
      } else {
        setError(data.error ?? 'Failed to load usage stats');
      }
    } catch {
      setError('Unable to reach usage API');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    // Fetch feedback stats
    fetch('/api/feedback?mode=stats')
      .then((r) => r.json())
      .then((data) => {
        if (data.total !== undefined) setFeedbackStats(data);
      })
      .catch(() => {});
  }, [fetchStats]);

  const handleExportCSV = () => {
    window.open('/api/admin/usage/export', '_blank');
  };

  const modelEntries = stats ? Object.entries(stats.byModel) : [];
  const maxTokens = modelEntries.reduce(
    (max, [, v]) => Math.max(max, v.inputTokens + v.outputTokens),
    1
  );

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-[#FE5000]" />
          <div>
            <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Admin Portal</h2>
            <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">Manage users, permissions, usage, and system health</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FE5000] border border-[#27272A] uppercase tracking-wide">
          {userRole}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-[#E4E4E7] dark:border-[#27272A]">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/usage';
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-[#FE5000] text-[#FE5000]'
                  : 'border-transparent text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white hover:border-[#D4D4D8] dark:border-[#3F3F46]',
              ].join(' ')}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </nav>

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Today" stats={stats?.today ?? null} loading={loading} />
        <StatCard label="This Week" stats={stats?.thisWeek ?? null} loading={loading} />
        <StatCard label="This Month" stats={stats?.thisMonth ?? null} loading={loading} />
        <StatCard label="All Time" stats={stats?.allTime ?? null} loading={loading} />
      </div>

      {/* Model Breakdown */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 shadow-sm">
        <div className="flex items-center justify-between mb-2.5">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Token Consumption by Model</h3>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-1.5 text-xs text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white transition-colors"
            >
              <Download size={12} />
              Export CSV
            </button>
            <button
              onClick={fetchStats}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-[#71717A] dark:text-[#A1A1AA] hover:text-[#09090B] dark:text-white transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>
        {modelEntries.length === 0 ? (
          <p className="text-sm text-[#A1A1AA]">No usage data yet. Start chatting to see model breakdown.</p>
        ) : (
          <div className="space-y-3">
            {modelEntries.map(([model, data]) => {
              const total = data.inputTokens + data.outputTokens;
              const pct = Math.round((total / maxTokens) * 100);
              const color = MODEL_COLORS[model] ?? '#71717A';
              return (
                <div key={model}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-[#09090B] dark:text-white">{model}</span>
                    <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">
                      {fmtTokens(total)} tokens | {data.queries} queries | {fmtCost(data.cost)}
                    </span>
                  </div>
                  <div className="h-3 rounded-full bg-[#F4F4F5] dark:bg-[#27272A] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: color }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Response Quality (Feedback) */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5 shadow-sm">
        <h3 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2.5">Response Quality</h3>
        {feedbackStats && feedbackStats.total > 0 ? (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-[#F4F4F5] dark:bg-[#27272A] p-3 text-center">
                <p className="text-lg font-bold text-[#09090B] dark:text-white font-mono">{feedbackStats.total}</p>
                <p className="text-[10px] text-[#71717A] dark:text-[#A1A1AA] uppercase tracking-wide">Total Feedback</p>
              </div>
              <div className="rounded-lg bg-green-50 p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ThumbsUp size={14} className="text-green-600" />
                  <p className="text-lg font-bold text-green-700 font-mono">{feedbackStats.thumbsUp}</p>
                </div>
                <p className="text-[10px] text-green-600 uppercase tracking-wide">
                  {feedbackStats.total > 0 ? `${Math.round((feedbackStats.thumbsUp / feedbackStats.total) * 100)}%` : '0%'} positive
                </p>
              </div>
              <div className="rounded-lg bg-red-50 p-3 text-center">
                <div className="flex items-center justify-center gap-1">
                  <ThumbsDown size={14} className="text-red-500" />
                  <p className="text-lg font-bold text-red-600 font-mono">{feedbackStats.thumbsDown}</p>
                </div>
                <p className="text-[10px] text-red-500 uppercase tracking-wide">
                  {feedbackStats.total > 0 ? `${Math.round((feedbackStats.thumbsDown / feedbackStats.total) * 100)}%` : '0%'} negative
                </p>
              </div>
            </div>
            {Object.keys(feedbackStats.byModel).length > 0 && (
              <div>
                <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-2">Quality by Model</p>
                <div className="space-y-1.5">
                  {Object.entries(feedbackStats.byModel).map(([model, data]) => {
                    const pct = data.total > 0 ? Math.round((data.up / data.total) * 100) : 0;
                    return (
                      <div key={model} className="flex items-center justify-between text-xs">
                        <span className="font-medium text-[#09090B] dark:text-white">{model || 'unknown'}</span>
                        <span className="text-[#71717A] dark:text-[#A1A1AA] font-mono">
                          {pct}% positive ({data.up}/{data.total})
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-[#A1A1AA]">No feedback data yet. Users can rate responses with thumbs up/down.</p>
        )}
      </div>

      {/* Per-User Breakdown */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Per-User Breakdown</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] dark:border-[#27272A]">
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">User</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Queries</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Tokens</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#A1A1AA]">Loading...</td>
              </tr>
            ) : (stats?.topUsers ?? []).length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-[#A1A1AA]">No user data yet.</td>
              </tr>
            ) : (
              (stats?.topUsers ?? []).slice(0, 20).map((user) => (
                <tr key={user.email} className="border-b border-[#F4F4F5] last:border-0 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] dark:bg-[#09090B]">
                  <td className="px-4 py-2.5 text-[#09090B] dark:text-white">{user.email}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">{user.queries}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">{fmtTokens(user.tokens)}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#09090B] dark:text-white">{fmtCost(user.cost)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Per-Service Endpoint Breakdown */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Top Gateway Endpoints</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] dark:border-[#27272A]">
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Endpoint</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Calls</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-[#A1A1AA]">Loading...</td>
              </tr>
            ) : (stats?.topEndpoints ?? []).length === 0 ? (
              <tr>
                <td colSpan={2} className="px-4 py-8 text-center text-[#A1A1AA]">No endpoint data yet.</td>
              </tr>
            ) : (
              (stats?.topEndpoints ?? []).slice(0, 15).map((ep) => (
                <tr key={ep.endpoint} className="border-b border-[#F4F4F5] last:border-0 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] dark:bg-[#09090B]">
                  <td className="px-4 py-2.5 font-mono text-xs text-[#09090B] dark:text-white">{ep.endpoint}</td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">{ep.calls}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Recent Queries Table */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Recent Queries</h3>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] dark:border-[#27272A]">
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Time</th>
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">User</th>
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Model</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Input</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Output</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Cost</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A1A1AA]">Loading...</td>
              </tr>
            ) : (stats?.recentEntries ?? []).length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-[#A1A1AA]">
                  No queries logged yet.
                </td>
              </tr>
            ) : (
              (stats?.recentEntries ?? []).slice(0, 25).map((entry, i) => (
                <tr key={`${entry.timestamp}-${i}`} className="border-b border-[#F4F4F5] last:border-0 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] dark:bg-[#09090B]">
                  <td className="px-4 py-2.5 text-[#71717A] dark:text-[#A1A1AA] font-mono text-xs">{fmtTime(entry.timestamp)}</td>
                  <td className="px-4 py-2.5 text-[#09090B] dark:text-white">{entry.userEmail || 'anonymous'}</td>
                  <td className="px-4 py-2.5">
                    <span className="inline-flex rounded px-2 py-0.5 text-xs font-medium bg-[#F4F4F5] dark:bg-[#27272A] text-[#09090B] dark:text-white">
                      {entry.model}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    {fmtTokens(entry.inputTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">
                    {fmtTokens(entry.outputTokens)}
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-xs text-[#09090B] dark:text-white">
                    {fmtCost(entry.estimatedCost)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function StatCard({ label, stats, loading }: { label: string; stats: PeriodStats | null; loading: boolean }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm">
      <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide mb-1.5">{label}</p>
      {loading ? (
        <div className="h-7 w-16 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
      ) : (
        <>
          <span className="text-lg font-bold text-[#09090B] dark:text-white font-mono">{stats?.queries ?? 0}</span>
          <span className="text-xs text-[#71717A] dark:text-[#A1A1AA] ml-1">queries</span>
          <div className="mt-0.5 text-[10px] text-[#A1A1AA]">
            {fmtTokens((stats?.inputTokens ?? 0) + (stats?.outputTokens ?? 0))} tokens | {fmtCost(stats?.cost ?? 0)}
          </div>
        </>
      )}
    </div>
  );
}
