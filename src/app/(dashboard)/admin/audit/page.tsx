'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import {
  Settings,
  Users,
  Shield,
  BarChart3,
  Activity,
  FileSearch,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import type { AuditEntry } from '@/lib/audit-log';

interface AuditStats {
  totalActions: number;
  byUser: Record<string, number>;
  byAction: Record<string, number>;
  byTool: Record<string, number>;
  failureRate: number;
}

interface AuditResponse {
  entries: AuditEntry[];
  stats: AuditStats;
  total: number;
}

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit Log', icon: FileSearch },
];

const ACTION_TYPES = [
  'query',
  'sf_create',
  'sf_update',
  'calendar_create',
  'email_read',
  'email_send',
  'email_manage',
  'workbook',
  'export',
  'login',
];

const PAGE_SIZE = 25;
const REFRESH_INTERVAL_MS = 30_000;

function StatusDot({ success }: { success: boolean }) {
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full shrink-0 ${
        success ? 'bg-emerald-500' : 'bg-red-500'
      }`}
      title={success ? 'Success' : 'Failure'}
    />
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2">
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-1">
        {label}
      </div>
      <div className="text-lg font-semibold text-white tabular-nums">{value}</div>
    </div>
  );
}

function ByBreakdown({
  label,
  data,
}: {
  label: string;
  data: Record<string, number>;
}) {
  const entries = Object.entries(data).sort((a, b) => b[1] - a[1]).slice(0, 6);
  const total = entries.reduce((sum, [, v]) => sum + v, 0);

  if (entries.length === 0) {
    return (
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2">
        <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
          {label}
        </div>
        <div className="text-xs text-zinc-600">No data</div>
      </div>
    );
  }

  return (
    <div className="bg-[#18181B] border border-[#27272A] rounded-lg px-3 py-2">
      <div className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-2">
        {label}
      </div>
      <div className="space-y-2">
        {entries.map(([key, count]) => {
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={key}>
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-xs text-zinc-400 truncate max-w-[140px]" title={key}>
                  {key}
                </span>
                <span className="text-xs text-zinc-500 tabular-nums ml-2">
                  {count} <span className="text-zinc-600">({pct}%)</span>
                </span>
              </div>
              <div className="h-1 rounded-full bg-[#27272A] overflow-hidden">
                <div
                  className="h-1 rounded-full bg-[#FF5C00]"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AuditLogPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'readonly';

  const [data, setData] = useState<AuditResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  // Filters
  const [filterUser, setFilterUser] = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [filterSince, setFilterSince] = useState('');
  const [page, setPage] = useState(0);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({ limit: '200' });
      if (filterUser) params.set('user', filterUser);
      if (filterAction) params.set('action', filterAction);
      if (filterSince) params.set('since', new Date(filterSince).toISOString());

      const res = await fetch(`/api/admin/audit?${params.toString()}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as AuditResponse;
      setData(json);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load audit log');
    } finally {
      setLoading(false);
    }
  }, [filterUser, filterAction, filterSince]);

  // Initial fetch and auto-refresh
  useEffect(() => {
    fetchData();

    timerRef.current = setInterval(() => {
      fetchData(true);
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [fetchData]);

  // Reset page when filters change
  useEffect(() => {
    setPage(0);
  }, [filterUser, filterAction, filterSince]);

  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center h-full bg-[#09090B]">
        <div className="text-zinc-500 text-sm">Admin access required</div>
      </div>
    );
  }

  const entries = data?.entries ?? [];
  const stats = data?.stats ?? null;

  const totalPages = Math.ceil(entries.length / PAGE_SIZE);
  const pageEntries = entries.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const todayCount = stats?.totalActions ?? 0;
  const failurePct =
    stats && stats.totalActions > 0
      ? Math.round(stats.failureRate * 100)
      : 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B]">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Admin header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Settings size={20} className="text-[#FF5C00]" />
            <h1 className="text-lg font-semibold text-white">Administration</h1>
          </div>
          <div className="flex items-center gap-3">
            {lastRefresh && (
              <span className="text-[10px] text-zinc-600 font-mono">
                Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
              </span>
            )}
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-[#27272A] text-zinc-300 hover:bg-[#3F3F46] transition-colors disabled:opacity-40"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>
        </div>

        {/* Admin tabs */}
        <div className="flex items-center gap-1 mb-6 border-b border-[#27272A]">
          {ADMIN_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = tab.href === '/admin/audit';
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                  active
                    ? 'border-[#FF5C00] text-[#FF5C00]'
                    : 'border-transparent text-zinc-500 hover:text-zinc-300'
                }`}
              >
                <Icon size={14} />
                {tab.label}
              </Link>
            );
          })}
        </div>

        {error && (
          <div className="mb-2.5 px-4 py-2 rounded bg-red-900/30 border border-red-700/50 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* Stats cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
          <StatCard label="Actions Today" value={todayCount.toLocaleString()} />
          <StatCard label="Failure Rate (Today)" value={`${failurePct}%`} />
          <StatCard
            label="Unique Users (Today)"
            value={stats ? Object.keys(stats.byUser).length : 0}
          />
          <StatCard
            label="Action Types (Today)"
            value={stats ? Object.keys(stats.byAction).length : 0}
          />
        </div>

        {/* Breakdown charts */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
            <ByBreakdown label="By User (Today)" data={stats.byUser} />
            <ByBreakdown label="By Action (Today)" data={stats.byAction} />
          </div>
        )}

        {/* Filter bar */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-2.5">
          <input
            type="text"
            placeholder="Filter by user email..."
            value={filterUser}
            onChange={(e) => setFilterUser(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white placeholder-zinc-600 focus:border-[#FF5C00]/50 focus:outline-none"
          />
          <select
            value={filterAction}
            onChange={(e) => setFilterAction(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FF5C00]/50 focus:outline-none"
          >
            <option value="">All action types</option>
            {ACTION_TYPES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filterSince}
            onChange={(e) => setFilterSince(e.target.value)}
            className="bg-[#18181B] border border-[#27272A] rounded-md px-3 py-2 text-sm text-white focus:border-[#FF5C00]/50 focus:outline-none"
          />
        </div>

        {/* Entry count */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-zinc-500">
            {entries.length} entries
            {filterUser || filterAction || filterSince ? ' (filtered)' : ''}
          </span>
          <span className="text-[10px] text-zinc-600">Auto-refreshes every 30s</span>
        </div>

        {/* Table */}
        {loading && !data ? (
          <div className="text-zinc-500 text-sm text-center py-12">Loading audit log...</div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-[#27272A]">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#18181B] text-zinc-400 text-xs">
                  <th className="text-left px-4 py-2.5 font-medium w-6"></th>
                  <th className="text-left px-4 py-2.5 font-medium whitespace-nowrap">Time</th>
                  <th className="text-left px-4 py-2.5 font-medium">User</th>
                  <th className="text-left px-4 py-2.5 font-medium">Role</th>
                  <th className="text-left px-4 py-2.5 font-medium">Action</th>
                  <th className="text-left px-4 py-2.5 font-medium">Tool</th>
                  <th className="text-left px-4 py-2.5 font-medium">Target</th>
                  <th className="text-left px-4 py-2.5 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody>
                {pageEntries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center py-8 text-zinc-600 text-xs">
                      No audit entries found
                    </td>
                  </tr>
                ) : (
                  pageEntries.map((entry) => (
                    <tr
                      key={entry.id}
                      className="border-t border-[#27272A] hover:bg-[#18181B]/50"
                    >
                      <td className="px-4 py-2.5">
                        <StatusDot success={entry.success} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs font-mono whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleString('en-US', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: false,
                        })}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300 text-xs truncate max-w-[160px]" title={entry.userEmail}>
                        {entry.userEmail || 'anonymous'}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-[#27272A] text-zinc-400 border border-[#3F3F46] uppercase tracking-wide">
                          {entry.role}
                        </span>
                      </td>
                      <td className="px-4 py-2.5">
                        <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium bg-[#FF5C00]/10 text-[#FF5C00] border border-[#FF5C00]/20">
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-[120px]">
                        {entry.tool ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-500 text-xs truncate max-w-[140px]" title={entry.target}>
                        {entry.target ?? '-'}
                      </td>
                      <td className="px-4 py-2.5 text-zinc-400 text-xs truncate max-w-[200px]" title={entry.detail}>
                        {entry.detail}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <button
              onClick={() => setPage(Math.max(0, page - 1))}
              disabled={page === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30"
            >
              <ChevronLeft size={14} />
              Previous
            </button>
            <span className="text-xs text-zinc-500">
              Page {page + 1} of {totalPages}
            </span>
            <button
              onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
              disabled={page >= totalPages - 1}
              className="flex items-center gap-1 px-3 py-1.5 rounded text-xs text-zinc-400 hover:text-white disabled:opacity-30"
            >
              Next
              <ChevronRight size={14} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
