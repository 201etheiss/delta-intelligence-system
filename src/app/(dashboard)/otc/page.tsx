'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft,
  RefreshCw,
  ShoppingCart,
  Clock,
  DollarSign,
  TrendingUp,
  CheckCircle2,
  FileText,
  Truck,
  CreditCard,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CollectionAction {
  id: string;
  customerId: string;
  customerName: string;
  invoiceNumber: string;
  amountDue: number;
  daysPastDue: number;
  priority: string;
  status: string;
  assignedTo: string;
  lastContact: string | null;
  nextFollowUp: string | null;
}

interface CollectionStats {
  totalOutstanding: number;
  totalActions: number;
  overdueCount: number;
  averageDSO: number;
  collectionRate: number;
  byPriority: Record<string, number>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  return `$${Math.abs(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtCompact(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return `$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `$${(abs / 1_000).toFixed(1)}K`;
  return `$${abs.toFixed(0)}`;
}

function priorityColor(priority: string): string {
  switch (priority) {
    case 'critical': return 'text-red-400 bg-red-900/30';
    case 'high': return 'text-orange-400 bg-orange-900/30';
    case 'medium': return 'text-yellow-400 bg-yellow-900/30';
    case 'low': return 'text-zinc-400 bg-zinc-800';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

function statusColor(status: string): string {
  switch (status) {
    case 'pending': return 'text-zinc-400 bg-zinc-800';
    case 'in_progress': return 'text-blue-400 bg-blue-900/30';
    case 'escalated': return 'text-[#FE5000] bg-orange-900/30';
    case 'resolved': return 'text-green-400 bg-green-900/30';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

// ---------------------------------------------------------------------------
// Pipeline stages
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { label: 'Order', icon: ShoppingCart, color: 'text-blue-400' },
  { label: 'Fulfillment', icon: Truck, color: 'text-yellow-400' },
  { label: 'Invoice', icon: FileText, color: 'text-[#FE5000]' },
  { label: 'Collection', icon: CreditCard, color: 'text-purple-400' },
  { label: 'Cash', icon: DollarSign, color: 'text-green-400' },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function OTCPage() {
  const [actions, setActions] = useState<CollectionAction[]>([]);
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ar/collections');
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load collection data');
        setActions([]);
        setStats(null);
        return;
      }
      setActions(json.data ?? []);
      setStats(json.stats ?? null);
    } catch {
      setError('Failed to fetch order-to-cash data');
      setActions([]);
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // KPIs
  const ordersPending = stats?.totalActions ?? (actions ?? []).filter((a) => a.status === 'pending').length;
  const arAging = stats?.totalOutstanding ?? (actions ?? []).reduce((sum, a) => sum + (typeof a.amountDue === 'number' ? a.amountDue : 0), 0);
  const dso = stats?.averageDSO ?? 0;
  const collectionRate = stats?.collectionRate ?? 0;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <ArrowRightLeft className="w-6 h-6 text-[#FE5000]" />
          <div>
            <h1 className="text-lg font-bold text-white">Order-to-Cash</h1>
            <p className="text-sm text-zinc-500 mt-0.5">End-to-end OTC cycle overview</p>
          </div>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <Clock size={14} /> Orders Pending
          </div>
          <div className="text-lg font-bold text-white">{ordersPending}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <DollarSign size={14} /> AR Aging
          </div>
          <div className="text-lg font-bold text-white">{fmtCompact(arAging)}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <TrendingUp size={14} /> DSO
          </div>
          <div className="text-lg font-bold text-white">
            {typeof dso === 'number' && !Number.isNaN(dso) ? `${dso.toFixed(1)}` : '--'}
            <span className="text-sm text-zinc-500 ml-1">days</span>
          </div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="flex items-center gap-2 text-zinc-500 text-xs mb-1">
            <CheckCircle2 size={14} /> Collection Rate
          </div>
          <div className="text-lg font-bold text-green-400">
            {typeof collectionRate === 'number' && !Number.isNaN(collectionRate)
              ? `${collectionRate.toFixed(1)}%`
              : '--'}
          </div>
        </div>
      </div>

      {/* Pipeline Visualization */}
      <div className="bg-[#18181B] border border-zinc-800 rounded-lg px-5 py-4 mb-6">
        <h3 className="text-xs font-semibold text-zinc-300 mb-2.5">OTC Pipeline</h3>
        <div className="flex items-center justify-between">
          {PIPELINE_STAGES.map((stage, i) => {
            const Icon = stage.icon;
            return (
              <div key={stage.label} className="flex items-center flex-1">
                <div className="flex flex-col items-center flex-1">
                  <div className={`w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center ${stage.color}`}>
                    <Icon size={20} />
                  </div>
                  <span className="text-xs text-zinc-400 mt-2">{stage.label}</span>
                </div>
                {i < PIPELINE_STAGES.length - 1 && (
                  <div className="flex-shrink-0 w-8 h-0.5 bg-zinc-700 -mt-5" />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : error !== null ? (
        <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
          {String(error)}
        </div>
      ) : (actions ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <ArrowRightLeft size={40} className="mx-auto mb-2 opacity-50" />
          <p>No collection actions found</p>
          <p className="text-xs mt-0.5">Generate the collection queue from AR aging data</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <div className="px-3 py-2 border-b border-zinc-800">
            <h3 className="text-xs font-semibold text-zinc-300">Collection Queue</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2">Customer</th>
                <th className="text-left px-3 py-2">Invoice</th>
                <th className="text-right px-3 py-2">Amount Due</th>
                <th className="text-right px-3 py-2">Days Past Due</th>
                <th className="text-left px-3 py-2">Priority</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-left px-3 py-2">Assigned To</th>
                <th className="text-left px-3 py-2">Next Follow-Up</th>
              </tr>
            </thead>
            <tbody>
              {(actions ?? []).map((action) => (
                <tr
                  key={action.id}
                  className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors"
                >
                  <td className="px-3 py-2">
                    <div className="text-zinc-200">{action.customerName}</div>
                    <div className="text-xs text-zinc-500">{action.customerId}</div>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-zinc-400">
                    {action.invoiceNumber}
                  </td>
                  <td className="px-3 py-2 text-right font-mono text-zinc-200">
                    {fmt(action.amountDue)}
                  </td>
                  <td className="px-3 py-2 text-right font-mono">
                    <span
                      className={
                        typeof action.daysPastDue === 'number' && action.daysPastDue > 90
                          ? 'text-red-400'
                          : typeof action.daysPastDue === 'number' && action.daysPastDue > 60
                            ? 'text-orange-400'
                            : typeof action.daysPastDue === 'number' && action.daysPastDue > 30
                              ? 'text-yellow-400'
                              : 'text-zinc-400'
                      }
                    >
                      {typeof action.daysPastDue === 'number' ? action.daysPastDue : '--'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${priorityColor(action.priority)}`}
                    >
                      {action.priority}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${statusColor(action.status)}`}
                    >
                      {action.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">{action.assignedTo}</td>
                  <td className="px-3 py-2 text-zinc-400 text-xs">
                    {action.nextFollowUp ?? '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
