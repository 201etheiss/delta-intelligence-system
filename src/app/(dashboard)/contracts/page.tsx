'use client';

import { useState, useEffect, useCallback, Fragment } from 'react';
import {
  FileText,
  AlertTriangle,
  Clock,
  DollarSign,
  RefreshCw,
  Plus,
  ChevronDown,
  ChevronRight,
  Bell,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ─────────────────────────────────────────────────────

interface ContractAlert {
  type: string;
  date: string;
  acknowledged: boolean;
}

interface Contract {
  id: string;
  title: string;
  counterparty: string;
  type: string;
  status: string;
  startDate: string;
  endDate: string;
  value: number;
  renewalDate: string | null;
  autoRenew: boolean;
  signedBy: string | null;
  keyTerms: string[];
  alerts: ContractAlert[];
  createdAt: string;
  updatedAt: string;
}

interface ContractSummary {
  activeCount: number;
  expiringIn90: number;
  totalActiveValue: number;
  renewalsDue: number;
  byType: Record<string, number>;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  return Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

function expiryColor(days: number): string {
  if (days < 0) return 'text-zinc-500';
  if (days <= 30) return 'text-red-400';
  if (days <= 90) return 'text-yellow-400';
  return 'text-green-400';
}

function expiryBg(days: number): string {
  if (days < 0) return 'bg-zinc-800';
  if (days <= 30) return 'bg-red-900/30';
  if (days <= 90) return 'bg-yellow-900/30';
  return 'bg-green-900/30';
}

function statusColor(status: string): string {
  switch (status) {
    case 'draft': return 'text-zinc-400 bg-zinc-800';
    case 'negotiation': return 'text-blue-400 bg-blue-900/30';
    case 'active': return 'text-green-400 bg-green-900/30';
    case 'expired': return 'text-red-400 bg-red-900/30';
    case 'terminated': return 'text-zinc-500 bg-zinc-800';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

function typeLabel(t: string): string {
  return t.charAt(0).toUpperCase() + t.slice(1);
}

// ── Component ─────────────────────────────────────────────────

export default function ContractsPage() {
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [summary, setSummary] = useState<ContractSummary | null>(null);
  const [renewalQueue, setRenewalQueue] = useState<Contract[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<{ type?: string; status?: string }>({});
  const [showCreate, setShowCreate] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showRenewals, setShowRenewals] = useState(false);

  // Create form state
  const [createForm, setCreateForm] = useState({
    title: '',
    counterparty: '',
    type: 'vendor' as string,
    startDate: '',
    endDate: '',
    value: '',
    autoRenew: false,
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.type) params.set('type', filter.type);
      if (filter.status) params.set('status', filter.status);
      const res = await fetch(`/api/contracts?${params.toString()}`);
      const data = await res.json();
      setContracts(data.data ?? []);
    } catch {
      setContracts([]);
    }
    try {
      const sumRes = await fetch('/api/contracts?summary=true');
      const sumData = await sumRes.json();
      setSummary(sumData.data ?? null);
    } catch {
      // silent
    }
    try {
      const renRes = await fetch('/api/contracts?status=active&expiring=90');
      const renData = await renRes.json();
      setRenewalQueue(renData.data ?? []);
    } catch {
      setRenewalQueue([]);
    }
    setLoading(false);
  }, [filter]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleCreate = async () => {
    try {
      const res = await fetch('/api/contracts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...createForm,
          value: parseFloat(createForm.value) || 0,
        }),
      });
      if (res.ok) {
        setShowCreate(false);
        setCreateForm({ title: '', counterparty: '', type: 'vendor', startDate: '', endDate: '', value: '', autoRenew: false });
        fetchData();
      }
    } catch {
      // silent
    }
  };

  const generateAlerts = async () => {
    await fetch('/api/contracts?alerts=true');
    fetchData();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">Contract Management</h1>
          <p className="text-sm text-zinc-500 mt-0.5">Track contracts, renewals, and expirations</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={generateAlerts} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-700 hover:border-zinc-600 text-sm text-zinc-400 transition-colors">
            <Bell size={14} /> Generate Alerts
          </button>
          <button onClick={fetchData} className="p-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FF5C00] text-white text-sm font-medium hover:bg-[#E54800] transition-colors"
          >
            <Plus size={16} /> New Contract
          </button>
        </div>
      </div>

      <AIInsightsBanner module="contracts" compact />

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <FileText size={14} /> Active Contracts
          </div>
          <div className="text-lg font-bold text-white">{summary?.activeCount ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <AlertTriangle size={14} /> Expiring in 90d
          </div>
          <div className="text-lg font-bold text-yellow-400">{summary?.expiringIn90 ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign size={14} /> Total Value
          </div>
          <div className="text-lg font-bold text-white">{fmt(summary?.totalActiveValue ?? 0)}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Renewals Due
          </div>
          <div className="text-lg font-bold text-[#FF5C00]">{summary?.renewalsDue ?? 0}</div>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-2.5">
        <select
          value={filter.type ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, type: e.target.value || undefined }))}
          className="bg-[#18181B] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
        >
          <option value="">All Types</option>
          {['customer', 'vendor', 'employment', 'lease', 'service'].map((t) => (
            <option key={t} value={t}>{typeLabel(t)}</option>
          ))}
        </select>
        <select
          value={filter.status ?? ''}
          onChange={(e) => setFilter((f) => ({ ...f, status: e.target.value || undefined }))}
          className="bg-[#18181B] border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-zinc-300"
        >
          <option value="">All Status</option>
          {['draft', 'negotiation', 'active', 'expired', 'terminated'].map((s) => (
            <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
          ))}
        </select>
      </div>

      {/* Create modal */}
      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowCreate(false)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 bg-[#18181B] border border-zinc-700 rounded-lg px-5 py-4 w-[28rem]">
            <h3 className="text-xs font-semibold mb-2.5">New Contract</h3>
            <div className="space-y-3">
              <input
                placeholder="Title"
                value={createForm.title}
                onChange={(e) => setCreateForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600"
              />
              <input
                placeholder="Counterparty"
                value={createForm.counterparty}
                onChange={(e) => setCreateForm((f) => ({ ...f, counterparty: e.target.value }))}
                className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600"
              />
              <div className="grid grid-cols-2 gap-3">
                <select
                  value={createForm.type}
                  onChange={(e) => setCreateForm((f) => ({ ...f, type: e.target.value }))}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
                >
                  {['customer', 'vendor', 'employment', 'lease', 'service'].map((t) => (
                    <option key={t} value={t}>{typeLabel(t)}</option>
                  ))}
                </select>
                <input
                  placeholder="Value"
                  type="number"
                  value={createForm.value}
                  onChange={(e) => setCreateForm((f) => ({ ...f, value: e.target.value }))}
                  className="bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">Start Date</label>
                  <input
                    type="date"
                    value={createForm.startDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, startDate: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
                  />
                </div>
                <div>
                  <label className="text-[10px] text-zinc-500 block mb-1">End Date</label>
                  <input
                    type="date"
                    value={createForm.endDate}
                    onChange={(e) => setCreateForm((f) => ({ ...f, endDate: e.target.value }))}
                    className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
                  />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-zinc-400">
                <input
                  type="checkbox"
                  checked={createForm.autoRenew}
                  onChange={(e) => setCreateForm((f) => ({ ...f, autoRenew: e.target.checked }))}
                  className="rounded border-zinc-700"
                />
                Auto-renew
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
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

      {/* Renewal queue section */}
      {(renewalQueue ?? []).length > 0 && (
        <div className="mb-6">
          <button
            onClick={() => setShowRenewals(!showRenewals)}
            className="flex items-center gap-2 text-sm font-medium text-[#FF5C00] mb-2"
          >
            {showRenewals ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            Renewal Queue ({(renewalQueue ?? []).length})
          </button>
          {showRenewals && (
            <div className="bg-[#18181B] border border-[#FF5C00]/20 rounded-lg p-4 space-y-2">
              {(renewalQueue ?? []).map((c) => {
                const days = daysUntil(c.endDate);
                return (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
                    <div>
                      <span className="text-sm font-medium">{c.counterparty}</span>
                      <span className="text-xs text-zinc-500 ml-2">{c.title}</span>
                    </div>
                    <span className={`text-xs font-mono px-2 py-0.5 rounded ${expiryColor(days)} ${expiryBg(days)}`}>
                      {days}d
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Contracts table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : (contracts ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <FileText size={40} className="mx-auto mb-2 opacity-50" />
          <p>No contracts found</p>
          <p className="text-xs mt-0.5">Create a new contract to get started</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2 w-8"></th>
                <th className="text-left px-3 py-2">Counterparty</th>
                <th className="text-left px-3 py-2">Type</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Start</th>
                <th className="text-left px-3 py-2">End</th>
                <th className="text-right px-3 py-2">Value</th>
                <th className="text-right px-3 py-2">Days Left</th>
              </tr>
            </thead>
            <tbody>
              {(contracts ?? []).map((contract) => {
                const days = daysUntil(contract.endDate);
                const isExpanded = expandedId === contract.id;
                return (
                  <Fragment key={contract.id}>
                    <tr className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors">
                      <td className="px-3 py-2">
                        <button onClick={() => setExpandedId(isExpanded ? null : contract.id)}>
                          {isExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
                        </button>
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{contract.counterparty}</div>
                        <div className="text-xs text-zinc-500">{contract.title}</div>
                      </td>
                      <td className="px-3 py-2 text-zinc-400">{typeLabel(contract.type)}</td>
                      <td className="px-3 py-2">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium ${statusColor(contract.status)}`}>
                          {contract.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-zinc-400 text-xs">{contract.startDate}</td>
                      <td className="px-3 py-2 text-zinc-400 text-xs">{contract.endDate}</td>
                      <td className="px-3 py-2 text-right font-mono">{fmt(contract.value)}</td>
                      <td className="px-3 py-2 text-right">
                        <span className={`text-xs font-mono px-2 py-0.5 rounded ${expiryColor(days)} ${expiryBg(days)}`}>
                          {days < 0 ? 'Expired' : `${days}d`}
                        </span>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr>
                        <td colSpan={8} className="bg-zinc-900/50 px-8 py-4">
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="text-zinc-600">Auto-Renew:</span>
                              <span className="ml-2 text-zinc-300">{contract.autoRenew ? 'Yes' : 'No'}</span>
                            </div>
                            <div>
                              <span className="text-zinc-600">Signed By:</span>
                              <span className="ml-2 text-zinc-300">{contract.signedBy ?? 'N/A'}</span>
                            </div>
                            {(contract.keyTerms ?? []).length > 0 && (
                              <div className="col-span-2">
                                <span className="text-zinc-600">Key Terms:</span>
                                <div className="flex flex-wrap gap-1 mt-0.5">
                                  {(contract.keyTerms ?? []).map((term, i) => (
                                    <span key={i} className="px-2 py-0.5 bg-zinc-800 rounded text-zinc-400">{term}</span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(contract.alerts ?? []).length > 0 && (
                              <div className="col-span-2">
                                <span className="text-zinc-600">Alerts:</span>
                                <div className="space-y-1 mt-0.5">
                                  {(contract.alerts ?? []).map((alert, i) => (
                                    <div key={i} className="flex items-center gap-2 text-yellow-400">
                                      <Bell size={10} />
                                      <span>{alert.type.replace(/_/g, ' ')}</span>
                                      <span className="text-zinc-600">{new Date(alert.date).toLocaleDateString()}</span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
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
