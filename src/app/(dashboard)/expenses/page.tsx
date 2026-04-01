'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Plus,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Send,
  Receipt,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ─────────────────────────────────────────────────────

interface ExpenseItem {
  id: string;
  date: string;
  category: string;
  description: string;
  amount: number;
  glAccount: string;
  profitCenter: string;
  receiptEvidence: string | null;
  mileage: number | null;
  mileageRate: number | null;
}

interface ExpenseReport {
  id: string;
  employeeName: string;
  employeeEmail: string;
  period: string;
  status: string;
  items: ExpenseItem[];
  totalAmount: number;
  approvedBy: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  rejectionReason: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PolicyViolation {
  itemId: string;
  category: string;
  rule: string;
  amount: number;
  limit: number;
}

interface ExpenseSummary {
  totalByCategory: Record<string, number>;
  totalAmount: number;
  reportCount: number;
  pendingApproval: number;
  ytdTotal: number;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return 'text-zinc-400 bg-zinc-800';
    case 'submitted': return 'text-yellow-400 bg-yellow-900/30';
    case 'approved': return 'text-green-400 bg-green-900/30';
    case 'reimbursed': return 'text-blue-400 bg-blue-900/30';
    case 'rejected': return 'text-red-400 bg-red-900/30';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

function categoryLabel(cat: string): string {
  return cat.charAt(0).toUpperCase() + cat.slice(1);
}

// ── Component ─────────────────────────────────────────────────

export default function ExpensesPage() {
  const [tab, setTab] = useState<'my' | 'all'>('my');
  const [reports, setReports] = useState<ExpenseReport[]>([]);
  const [summary, setSummary] = useState<ExpenseSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [violations, setViolations] = useState<Record<string, PolicyViolation[]>>({});

  const currentPeriod = new Date().toISOString().slice(0, 7);

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = tab === 'my' ? '?employee=dev@delta360.energy' : '';
      const res = await fetch(`/api/expenses${params}`);
      const data = await res.json();
      setReports(data.data ?? []);
    } catch {
      setReports([]);
    }
    try {
      const sumRes = await fetch(`/api/expenses?summary=${currentPeriod}`);
      const sumData = await sumRes.json();
      setSummary(sumData.data ?? null);
    } catch {
      // silent
    }
    setLoading(false);
  }, [tab, currentPeriod]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period: currentPeriod }),
      });
      if (res.ok) {
        setShowCreate(false);
        fetchReports();
      }
    } catch {
      // silent
    }
  };

  const handleAction = async (id: string, action: string, extra?: Record<string, unknown>) => {
    try {
      const res = await fetch('/api/expenses', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (data.violations && (data.violations as PolicyViolation[]).length > 0) {
        setViolations((prev) => ({ ...prev, [id]: data.violations }));
      }
      fetchReports();
    } catch {
      // silent
    }
  };

  const pendingCount = (reports ?? []).filter((r) => r.status === 'submitted').length;
  const monthTotal = (reports ?? []).filter((r) => r.period === currentPeriod)
    .reduce((sum, r) => sum + r.totalAmount, 0);

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">Expense Management</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Submit, track, and approve expense reports</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={fetchReports} className="p-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#E54800] transition-colors"
          >
            <Plus size={16} /> New Report
          </button>
        </div>
      </div>

      <AIInsightsBanner module="expenses" compact />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Pending Approval
          </div>
          <div className="text-lg font-bold text-yellow-400">{summary?.pendingApproval ?? pendingCount}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign size={14} /> This Month
          </div>
          <div className="text-lg font-bold text-white">{fmt(summary?.totalAmount ?? monthTotal)}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign size={14} /> YTD Total
          </div>
          <div className="text-lg font-bold text-white">{fmt(summary?.ytdTotal ?? 0)}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Receipt size={14} /> Reports
          </div>
          <div className="text-lg font-bold text-white">{summary?.reportCount ?? (reports ?? []).length}</div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-2.5 bg-[#18181B] rounded-lg p-1 w-fit">
        {(['my', 'all'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t ? 'bg-[#FF5C00] text-white' : 'text-zinc-400 hover:text-white'
            }`}
          >
            {t === 'my' ? 'My Reports' : 'All Reports'}
          </button>
        ))}
      </div>

      {/* Create modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#18181B] border border-zinc-700 rounded-lg px-5 py-4 w-96">
            <h3 className="text-xs font-semibold mb-2.5">New Expense Report</h3>
            <p className="text-xs text-zinc-500 mb-2.5">Period: {currentPeriod}</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-sm text-zinc-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleCreate} className="px-4 py-1.5 text-sm bg-[#FF5C00] text-white rounded-lg hover:bg-[#E54800]">
                Create
              </button>
            </div>
          </div>
        </>
      )}

      {/* Reports table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : (reports ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <Receipt size={40} className="mx-auto mb-2 opacity-50" />
          <p>No expense reports found</p>
          <p className="text-xs mt-0.5">Create a new report to get started</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">Report ID</th>
                <th className="text-left px-3 py-2">Employee</th>
                <th className="text-left px-3 py-2">Period</th>
                <th className="text-left px-3 py-2">Items</th>
                <th className="text-right px-3 py-2">Total</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(reports ?? []).map((report) => {
                const isExpanded = expandedId === report.id;
                const reportViolations = violations[report.id] ?? [];
                return (
                  <Fragment key={report.id}>
                    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <button onClick={() => setExpandedId(isExpanded ? null : report.id)}>
                          {isExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                        </button>
                      </td>
                      <td className="px-3 py-2 font-mono text-xs text-zinc-400">{report.id}</td>
                      <td className="px-3 py-2">{report.employeeName}</td>
                      <td className="px-3 py-2 text-zinc-400">{report.period}</td>
                      <td className="px-3 py-2 text-zinc-400">{(report.items ?? []).length}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(report.totalAmount)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusColor(report.status)}`}>
                          {report.status === 'submitted' && <Clock size={10} />}
                          {report.status === 'approved' && <CheckCircle2 size={10} />}
                          {report.status === 'rejected' && <XCircle size={10} />}
                          {report.status}
                        </span>
                        {reportViolations.length > 0 && (
                          <span className="ml-2 inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium text-red-400 bg-red-900/30">
                            <AlertTriangle size={10} /> {reportViolations.length} violation{reportViolations.length > 1 ? 's' : ''}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {report.status === 'draft' && (
                            <button
                              onClick={() => handleAction(report.id, 'submit')}
                              className="flex items-center gap-1 px-2 py-1 text-xs text-[#FF5C00] hover:bg-[#FF5C00]/10 rounded transition-colors"
                            >
                              <Send size={12} /> Submit
                            </button>
                          )}
                          {report.status === 'submitted' && tab === 'all' && (
                            <>
                              <button
                                onClick={() => handleAction(report.id, 'approve')}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:bg-green-900/20 rounded transition-colors"
                              >
                                <CheckCircle2 size={12} /> Approve
                              </button>
                              <button
                                onClick={() => handleAction(report.id, 'reject', { reason: 'Policy violation' })}
                                className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 rounded transition-colors"
                              >
                                <XCircle size={12} /> Reject
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-zinc-900/50 px-8 py-4">
                          {(report.items ?? []).length === 0 ? (
                            <p className="text-xs text-zinc-600">No line items yet</p>
                          ) : (
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="text-zinc-600">
                                  <th className="text-left py-1">Date</th>
                                  <th className="text-left py-1">Category</th>
                                  <th className="text-left py-1">Description</th>
                                  <th className="text-left py-1">GL Account</th>
                                  <th className="text-right py-1">Amount</th>
                                  <th className="text-center py-1">Receipt</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(report.items ?? []).map((item) => (
                                  <tr key={item.id} className="border-t border-zinc-800/30">
                                    <td className="py-1.5 text-zinc-400">{item.date}</td>
                                    <td className="py-1.5">{categoryLabel(item.category)}</td>
                                    <td className="py-1.5 text-zinc-300">{item.description}</td>
                                    <td className="py-1.5 font-mono text-zinc-500">{item.glAccount}</td>
                                    <td className="py-1.5 text-right font-mono">{fmt(item.amount)}</td>
                                    <td className="py-1.5 text-center">
                                      {item.receiptEvidence ? (
                                        <CheckCircle2 size={12} className="mx-auto text-green-500" />
                                      ) : (
                                        <AlertTriangle size={12} className="mx-auto text-yellow-500" />
                                      )}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                          {report.rejectionReason && (
                            <div className="mt-3 px-3 py-2 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
                              Rejection reason: {report.rejectionReason}
                            </div>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// Fragment import needed for JSX
import { Fragment } from 'react';
