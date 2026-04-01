'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ClipboardCheck,
  RefreshCw,
  Plus,
  Clock,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Search,
  Link2,
  BarChart3,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditRequest {
  id: string;
  auditorName: string;
  auditorFirm: string;
  requestDescription: string;
  requestedItems: string[];
  status: string;
  dueDate: string;
  assignedTo: string | null;
  evidenceIds: string[];
  notes: string | null;
  agingDays: number;
  createdAt: string;
  updatedAt: string;
  fulfilledAt: string | null;
}

interface DashboardStats {
  total: number;
  open: number;
  inProgress: number;
  fulfilled: number;
  overdue: number;
  avgResponseDays: number;
  agingBuckets: { bucket: string; count: number }[];
}

type TabId = 'pbc' | 'aging' | 'evidence';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusBadge(status: string): { label: string; cls: string } {
  switch (status) {
    case 'open':
      return { label: 'Open', cls: 'text-blue-400 bg-blue-900/30' };
    case 'in_progress':
      return { label: 'In Progress', cls: 'text-[#FE5000] bg-orange-900/30' };
    case 'fulfilled':
      return { label: 'Completed', cls: 'text-green-400 bg-green-900/30' };
    case 'overdue':
      return { label: 'Overdue', cls: 'text-red-400 bg-red-900/30' };
    default:
      return { label: status, cls: 'text-zinc-400 bg-zinc-800' };
  }
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'pbc', label: 'PBC Requests' },
  { id: 'aging', label: 'Aging Dashboard' },
  { id: 'evidence', label: 'Evidence Links' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function AuditPage() {
  const [activeTab, setActiveTab] = useState<TabId>('pbc');
  const [requests, setRequests] = useState<AuditRequest[]>([]);
  const [dashboard, setDashboard] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reqRes, dashRes] = await Promise.all([
        fetch('/api/audit/pbc'),
        fetch('/api/audit/pbc?dashboard=true'),
      ]);
      const reqJson = await reqRes.json();
      const dashJson = await dashRes.json();

      if (reqJson.error) {
        setError(reqJson.error);
        setRequests([]);
      } else {
        setRequests(reqJson.requests ?? []);
      }

      setDashboard(dashJson.dashboard ?? null);
    } catch {
      setError('Failed to fetch audit data');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = (requests ?? []).filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      (r.id ?? '').toLowerCase().includes(q) ||
      (r.requestDescription ?? '').toLowerCase().includes(q) ||
      (r.auditorName ?? '').toLowerCase().includes(q)
    );
  });

  // KPIs from dashboard or fallback
  const totalRequests = dashboard?.total ?? (requests ?? []).length;
  const openCount = dashboard?.open ?? (requests ?? []).filter((r) => r.status === 'open').length;
  const overdueCount = dashboard?.overdue ?? (requests ?? []).filter((r) => r.status === 'overdue').length;
  const avgResponseTime = dashboard?.avgResponseDays ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ClipboardCheck className="w-6 h-6 text-[#FE5000]" />
          <h1 className="text-lg font-bold text-white">Audit Portal</h1>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
          <button className="flex items-center gap-2 bg-[#FE5000] hover:bg-[#E54800] rounded-lg px-4 py-2 text-sm text-white transition-colors">
            <Plus className="w-4 h-4" />
            New Request
          </button>
        </div>
      </div>

      <AIInsightsBanner module="audit" compact />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <ClipboardCheck size={14} /> Total Requests
          </div>
          <div className="text-lg font-bold text-white">{totalRequests}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Open
          </div>
          <div className="text-lg font-bold text-blue-400">{openCount}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <AlertTriangle size={14} /> Overdue
          </div>
          <div className="text-lg font-bold text-red-400">{overdueCount}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Avg Response Time
          </div>
          <div className="text-lg font-bold text-white">
            {typeof avgResponseTime === 'number' && !Number.isNaN(avgResponseTime)
              ? `${avgResponseTime.toFixed(1)}d`
              : '--'}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-[#FE5000] text-[#FE5000]'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Search (PBC tab) */}
      {activeTab === 'pbc' && (
        <div className="relative mb-2.5">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
          <input
            type="text"
            placeholder="Search by request ID, description, or auditor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-sm text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:border-[#FE5000] transition-colors"
          />
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : error !== null ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {String(error)}
        </div>
      ) : (
        <>
          {/* PBC Requests Tab */}
          {activeTab === 'pbc' && (
            <>
              {filtered.length === 0 ? (
                <div className="text-center py-20 text-zinc-600">
                  <ClipboardCheck size={40} className="mx-auto mb-2 opacity-50" />
                  <p>No audit requests found</p>
                  <p className="text-xs mt-0.5">Create a new PBC request to get started</p>
                </div>
              ) : (
                <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                        <th className="text-left px-3 py-2">Request ID</th>
                        <th className="text-left px-3 py-2">Description</th>
                        <th className="text-left px-3 py-2">Auditor</th>
                        <th className="text-left px-3 py-2">Status</th>
                        <th className="text-left px-3 py-2">Due Date</th>
                        <th className="text-right px-3 py-2">Aging (days)</th>
                        <th className="text-center px-3 py-2">Evidence</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((req) => {
                        const badge = statusBadge(req.status);
                        return (
                          <tr
                            key={req.id}
                            className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                          >
                            <td className="px-3 py-2 font-mono text-xs text-zinc-400">{req.id}</td>
                            <td className="px-3 py-2 text-zinc-200 max-w-xs truncate">
                              {req.requestDescription}
                            </td>
                            <td className="px-3 py-2">
                              <div className="text-zinc-200">{req.auditorName}</div>
                              <div className="text-xs text-zinc-500">{req.auditorFirm}</div>
                            </td>
                            <td className="px-3 py-2">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${badge.cls}`}
                              >
                                {req.status === 'open' && <Clock size={10} />}
                                {req.status === 'in_progress' && <Clock size={10} />}
                                {req.status === 'fulfilled' && <CheckCircle2 size={10} />}
                                {req.status === 'overdue' && <XCircle size={10} />}
                                {badge.label}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-zinc-400 text-xs">{req.dueDate}</td>
                            <td className="px-3 py-2 text-right font-mono">
                              <span
                                className={
                                  typeof req.agingDays === 'number' && req.agingDays > 30
                                    ? 'text-red-400'
                                    : typeof req.agingDays === 'number' && req.agingDays > 14
                                      ? 'text-yellow-400'
                                      : 'text-zinc-400'
                                }
                              >
                                {typeof req.agingDays === 'number' ? req.agingDays : '--'}
                              </span>
                            </td>
                            <td className="px-3 py-2 text-center">
                              {(req.evidenceIds ?? []).length > 0 ? (
                                <span className="inline-flex items-center gap-1 text-xs text-green-400">
                                  <Link2 size={12} />
                                  {(req.evidenceIds ?? []).length}
                                </span>
                              ) : (
                                <span className="text-xs text-zinc-600">None</span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Aging Dashboard Tab */}
          {activeTab === 'aging' && (
            <div className="bg-[#18181B] border border-zinc-800 rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <BarChart3 size={18} className="text-[#FE5000]" />
                <h3 className="text-lg font-semibold text-white">Request Aging Distribution</h3>
              </div>
              {(dashboard?.agingBuckets ?? []).length > 0 ? (
                <div className="space-y-3">
                  {(dashboard?.agingBuckets ?? []).map((bucket) => {
                    const maxCount = Math.max(
                      ...(dashboard?.agingBuckets ?? []).map((b) => b.count),
                      1
                    );
                    const widthPct = (bucket.count / maxCount) * 100;
                    return (
                      <div key={bucket.bucket} className="flex items-center gap-3">
                        <span className="text-sm text-zinc-400 w-24 text-right">{bucket.bucket}</span>
                        <div className="flex-1 h-8 bg-zinc-800 rounded overflow-hidden">
                          <div
                            className="h-full bg-[#FE5000] rounded flex items-center justify-end pr-2"
                            style={{ width: `${Math.max(widthPct, 2)}%` }}
                          >
                            {bucket.count > 0 && (
                              <span className="text-xs text-white font-mono">{bucket.count}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-zinc-600">
                  <BarChart3 size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No aging data available</p>
                </div>
              )}
            </div>
          )}

          {/* Evidence Links Tab */}
          {activeTab === 'evidence' && (
            <div className="bg-[#18181B] border border-zinc-800 rounded-lg px-5 py-4">
              <div className="flex items-center gap-2 mb-2.5">
                <Link2 size={18} className="text-[#FE5000]" />
                <h3 className="text-lg font-semibold text-white">Evidence Linkage</h3>
              </div>
              {(requests ?? []).filter((r) => (r.evidenceIds ?? []).length > 0).length === 0 ? (
                <div className="text-center py-12 text-zinc-600">
                  <Link2 size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No evidence linked to any requests</p>
                  <p className="text-xs mt-0.5">Upload evidence in the Vault and link it to audit requests</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {(requests ?? [])
                    .filter((r) => (r.evidenceIds ?? []).length > 0)
                    .map((req) => (
                      <div
                        key={req.id}
                        className="flex items-center justify-between bg-zinc-900 border border-zinc-800 rounded-lg p-3"
                      >
                        <div>
                          <div className="text-sm text-zinc-200">{req.requestDescription}</div>
                          <div className="text-xs text-zinc-500 mt-0.5">
                            {req.id} - {req.auditorFirm}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-green-400 font-mono">
                            {(req.evidenceIds ?? []).length} file{(req.evidenceIds ?? []).length !== 1 ? 's' : ''}
                          </span>
                          <CheckCircle2 size={14} className="text-green-500" />
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
