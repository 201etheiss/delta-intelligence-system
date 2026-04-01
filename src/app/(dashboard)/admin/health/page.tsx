'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { Settings, Users, Shield, BarChart3, Activity, RefreshCw, ExternalLink, AlertTriangle, FileSearch } from 'lucide-react';

interface ServiceCheck {
  name: string;
  status: 'connected' | 'error' | 'degraded';
  responseTime: number;
  lastChecked: string;
  error?: string;
}

interface HealthData {
  summary: { total: number; connected: number; degraded: number; errored: number };
  services: ServiceCheck[];
  checkedAt: string;
}

interface ErrorEntry {
  timestamp: string;
  endpoint: string;
  error: string;
  statusCode?: number;
}

interface ErrorStats {
  total: number;
  last24h: number;
  byEndpoint: Record<string, number>;
  recentErrors: ErrorEntry[];
}

function fmtMs(ms: number): string {
  if (typeof ms !== 'number' || Number.isNaN(ms)) return '0ms';
  if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
  return `${ms}ms`;
}

function fmtTime(ts: string): string {
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

const STATUS_STYLES: Record<string, { dot: string; bg: string; text: string }> = {
  connected: { dot: 'bg-green-500', bg: 'bg-green-50', text: 'text-green-700' },
  degraded: { dot: 'bg-yellow-500', bg: 'bg-yellow-50', text: 'text-yellow-700' },
  error: { dot: 'bg-red-500', bg: 'bg-red-50', text: 'text-red-700' },
};

const ADMIN_TABS = [
  { href: '/admin/users', label: 'Users', icon: Users },
  { href: '/admin/permissions', label: 'Permissions', icon: Shield },
  { href: '/admin/usage', label: 'Usage', icon: BarChart3 },
  { href: '/admin/health', label: 'Health', icon: Activity },
  { href: '/admin/audit', label: 'Audit', icon: FileSearch },
];

export default function AdminHealthPage() {
  const { data: session } = useSession();
  const userRole = session?.user?.role ?? 'admin';
  const [health, setHealth] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [errorStats, setErrorStats] = useState<ErrorStats | null>(null);
  const [errorStatsLoading, setErrorStatsLoading] = useState(true);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/health');
      const data = await res.json();
      if (data.success) {
        setHealth(data);
      } else {
        setError(data.error ?? 'Failed to load health data');
      }
    } catch {
      setError('Unable to reach health API');
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchErrorStats = useCallback(async () => {
    setErrorStatsLoading(true);
    try {
      const res = await fetch('/api/admin/health?include=errors');
      const data = await res.json();
      if (data.errorStats) {
        setErrorStats(data.errorStats);
      }
    } catch {
      // Non-critical, silently fail
    } finally {
      setErrorStatsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchErrorStats();
  }, [fetchHealth, fetchErrorStats]);

  const handleSamsaraReauth = () => {
    window.open('http://localhost:3847/samsara/auth', '_blank');
  };

  const summary = health?.summary ?? { total: 0, connected: 0, degraded: 0, errored: 0 };

  const samsaraService = (health?.services ?? []).find(
    (s) => s.name.toLowerCase().includes('samsara')
  );

  const topErrorEndpoints = errorStats
    ? Object.entries(errorStats.byEndpoint)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
    : [];

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Settings size={20} className="text-[#FF5C00]" />
          <div>
            <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Admin Portal</h2>
            <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">Manage users, permissions, usage, and system health</p>
          </div>
        </div>
        <span className="inline-flex items-center rounded px-2.5 py-1 text-xs font-semibold bg-[#09090B] text-[#FF5C00] border border-[#27272A] uppercase tracking-wide">
          {userRole}
        </span>
      </div>

      {/* Tabs */}
      <nav className="flex gap-1 border-b border-[#E4E4E7] dark:border-[#27272A]">
        {ADMIN_TABS.map(({ href, label, icon: Icon }) => {
          const active = href === '/admin/health';
          return (
            <Link
              key={href}
              href={href}
              className={[
                'flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
                active
                  ? 'border-[#FF5C00] text-[#FF5C00]'
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

      {/* Summary Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <SummaryCard label="Total Services" value={summary.total} color="#09090B" loading={loading} />
        <SummaryCard label="Connected" value={summary.connected} color="#22C55E" loading={loading} />
        <SummaryCard label="Degraded" value={summary.degraded} color="#EAB308" loading={loading} />
        <SummaryCard label="Errors" value={summary.errored} color="#EF4444" loading={loading} />
      </div>

      {/* Samsara Re-Auth */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Samsara Authentication</h3>
            <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5">
              Status:{' '}
              {samsaraService ? (
                <span className={samsaraService.status === 'connected' ? 'text-green-600' : 'text-red-600'}>
                  {samsaraService.status}
                </span>
              ) : (
                <span className="text-[#A1A1AA]">unknown</span>
              )}
            </p>
          </div>
          <button
            onClick={handleSamsaraReauth}
            className="flex items-center gap-1.5 rounded-md border border-[#D4D4D8] dark:border-[#3F3F46] px-3 py-1.5 text-xs font-medium text-[#09090B] dark:text-white hover:bg-[#F4F4F5] dark:bg-[#27272A] transition-colors"
          >
            <ExternalLink size={12} />
            Re-authorize Samsara
          </button>
        </div>
      </div>

      {/* Service Status Table */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Gateway Services</h3>
          <div className="flex items-center gap-3">
            {health?.checkedAt && (
              <span className="text-[10px] text-[#A1A1AA]">Last checked: {fmtTime(health.checkedAt)}</span>
            )}
            <button
              onClick={fetchHealth}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border border-[#D4D4D8] dark:border-[#3F3F46] px-3 py-1.5 text-xs font-medium text-[#09090B] dark:text-white hover:bg-[#F4F4F5] dark:bg-[#27272A] disabled:opacity-50 transition-colors"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh All
            </button>
          </div>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E4E4E7] dark:border-[#27272A]">
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Service</th>
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Status</th>
              <th className="text-right px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Response Time</th>
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Last Checked</th>
              <th className="text-left px-4 py-2.5 font-medium text-[#71717A] dark:text-[#A1A1AA]">Error</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#A1A1AA]">
                  Checking services...
                </td>
              </tr>
            ) : (health?.services ?? []).length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-[#A1A1AA]">
                  No service data available.
                </td>
              </tr>
            ) : (
              (health?.services ?? []).map((svc) => {
                const style = STATUS_STYLES[svc.status] ?? STATUS_STYLES.error;
                return (
                  <tr key={svc.name} className="border-b border-[#F4F4F5] last:border-0 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] dark:bg-[#09090B]">
                    <td className="px-3 py-2 font-medium text-[#09090B] dark:text-white">{svc.name}</td>
                    <td className="px-3 py-2">
                      <span
                        className={[
                          'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium',
                          style.bg,
                          style.text,
                        ].join(' ')}
                      >
                        <span className={['w-1.5 h-1.5 rounded-full', style.dot].join(' ')} />
                        {svc.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-[#71717A] dark:text-[#A1A1AA]">
                      {fmtMs(svc.responseTime)}
                    </td>
                    <td className="px-3 py-2 text-xs text-[#71717A] dark:text-[#A1A1AA]">{fmtTime(svc.lastChecked)}</td>
                    <td className="px-3 py-2 text-xs text-red-600">{svc.error ?? '--'}</td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Error Log Section */}
      <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
        <div className="px-3 py-2 border-b border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <div className="flex items-center gap-2">
            <AlertTriangle size={14} className="text-red-500" />
            <h3 className="text-xs font-semibold text-[#09090B] dark:text-white">Error Log</h3>
          </div>
        </div>
        <div className="p-4 space-y-4">
          {/* Error Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-md border border-[#E4E4E7] dark:border-[#27272A] p-3">
              <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">Total Errors</p>
              {errorStatsLoading ? (
                <div className="h-6 w-10 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse mt-0.5" />
              ) : (
                <span className="text-lg font-bold font-mono text-red-600">{errorStats?.total ?? 0}</span>
              )}
            </div>
            <div className="rounded-md border border-[#E4E4E7] dark:border-[#27272A] p-3">
              <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">Last 24h</p>
              {errorStatsLoading ? (
                <div className="h-6 w-10 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse mt-0.5" />
              ) : (
                <span className="text-lg font-bold font-mono text-red-600">{errorStats?.last24h ?? 0}</span>
              )}
            </div>
          </div>

          {/* Top Error Endpoints */}
          {topErrorEndpoints.length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-2">Top Endpoints by Error Count</p>
              <div className="space-y-1">
                {topErrorEndpoints.map(([endpoint, count]) => (
                  <div key={endpoint} className="flex items-center justify-between text-xs">
                    <span className="font-mono text-[#09090B] dark:text-white">{endpoint}</span>
                    <span className="font-mono text-red-600">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Errors */}
          {(errorStats?.recentErrors ?? []).length > 0 && (
            <div>
              <p className="text-xs font-medium text-[#71717A] dark:text-[#A1A1AA] mb-2">Recent Errors</p>
              <div className="space-y-1.5">
                {(errorStats?.recentErrors ?? []).slice(0, 10).map((err, i) => (
                  <div key={`${err.timestamp}-${i}`} className="rounded border border-red-100 bg-red-50 px-3 py-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[#71717A] dark:text-[#A1A1AA]">{fmtTime(err.timestamp)}</span>
                      <span className="font-mono text-red-600">{err.endpoint}</span>
                    </div>
                    <p className="text-red-700 mt-0.5">{err.error}{err.statusCode ? ` (${err.statusCode})` : ''}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!errorStatsLoading && (errorStats?.total ?? 0) === 0 && (
            <p className="text-sm text-[#A1A1AA] text-center py-4">No errors logged.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number;
  color: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 shadow-sm">
      <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide mb-1.5">{label}</p>
      {loading ? (
        <div className="h-7 w-10 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
      ) : (
        <span className="text-lg font-bold font-mono" style={{ color }}>
          {value}
        </span>
      )}
    </div>
  );
}
