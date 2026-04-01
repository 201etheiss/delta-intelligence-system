'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Search,
  Filter,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Plus,
  Wand2,
  Check,
  Clock,
  AlertTriangle,
  DollarSign,
  Calendar,
  X,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';
import { DensityKPI } from '@/components/density/DensityKPI';
import { DensityTable } from '@/components/density/DensityTable';
import { DensityChart } from '@/components/density/DensityChart';
import { DensityInsight } from '@/components/density/DensityInsight';
import { DensitySection } from '@/components/density/DensitySection';

// ── Types ─────────────────────────────────────────────────────

type APInvoiceStatus = 'received' | 'coding' | 'review' | 'approved' | 'scheduled' | 'paid';

interface APLineItem {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  amount: number;
  glAccount: string;
  glAccountName: string;
  profitCenter: string;
  taxCode: string;
}

interface APInvoice {
  id: string;
  vendorId: string;
  vendorName: string;
  invoiceNumber: string;
  date: string;
  dueDate: string;
  amount: number;
  lineItems: APLineItem[];
  status: APInvoiceStatus;
  glCoding: string[];
  autoCoded: boolean;
  autoCodeConfidence: number;
  approvedBy: string | null;
  paidDate: string | null;
  paidReference: string | null;
  sourceDocument: string | null;
  ocrExtracted: boolean;
  createdAt: string;
  updatedAt: string;
}

interface AgingBucket {
  label: string;
  count: number;
  total: number;
}

interface AgingSummary {
  current: AgingBucket;
  days30: AgingBucket;
  days60: AgingBucket;
  days90plus: AgingBucket;
  totalOutstanding: number;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const STATUS_CONFIG: Record<APInvoiceStatus, { label: string; bg: string; text: string }> = {
  received: { label: 'Received', bg: 'bg-blue-500/20', text: 'text-blue-400' },
  coding: { label: 'Coding', bg: 'bg-yellow-500/20', text: 'text-yellow-400' },
  review: { label: 'Review', bg: 'bg-orange-500/20', text: 'text-orange-400' },
  approved: { label: 'Approved', bg: 'bg-green-500/20', text: 'text-green-400' },
  scheduled: { label: 'Scheduled', bg: 'bg-purple-500/20', text: 'text-purple-400' },
  paid: { label: 'Paid', bg: 'bg-zinc-500/20', text: 'text-zinc-400' },
};

function StatusBadge({ status }: { status: APInvoiceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.received;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

// ── Create Invoice Modal ──────────────────────────────────────

function CreateInvoiceModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [vendorName, setVendorName] = useState('');
  const [vendorId, setVendorId] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [dueDate, setDueDate] = useState('');
  const [amount, setAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      const res = await fetch('/api/ap/invoices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendorId: vendorId || vendorName.toLowerCase().replace(/\s+/g, '-'),
          vendorName,
          invoiceNumber,
          date,
          dueDate,
          amount: parseFloat(amount),
        }),
      });
      const data = await res.json();
      if (!data.success) {
        setError(data.error ?? 'Failed to create invoice');
        return;
      }
      onCreated();
      onClose();
      setVendorName('');
      setVendorId('');
      setInvoiceNumber('');
      setAmount('');
      setDueDate('');
    } catch {
      setError('Network error');
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg w-full max-w-md px-5 py-4">
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-lg font-semibold text-white">New AP Invoice</h2>
          <button onClick={onClose} className="text-zinc-400 hover:text-white">
            <X size={18} />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Vendor Name *</label>
            <input
              className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
              value={vendorName}
              onChange={(e) => setVendorName(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Vendor ID</label>
            <input
              className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
              value={vendorId}
              onChange={(e) => setVendorId(e.target.value)}
              placeholder="Auto-generated if blank"
            />
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Invoice Number *</label>
            <input
              className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
              value={invoiceNumber}
              onChange={(e) => setInvoiceNumber(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Invoice Date *</label>
              <input
                type="date"
                className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Due Date *</label>
              <input
                type="date"
                className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                required
              />
            </div>
          </div>
          <div>
            <label className="block text-xs text-zinc-400 mb-1">Amount *</label>
            <input
              type="number"
              step="0.01"
              min="0.01"
              className="w-full bg-[#09090B] border border-[#27272A] rounded px-3 py-2 text-sm text-white focus:border-[#FF6006] focus:outline-none"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              required
            />
          </div>
          {error && <p className="text-red-400 text-xs">{error}</p>}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-3 py-2 rounded text-sm text-zinc-400 border border-[#27272A] hover:bg-[#27272A]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-3 py-2 rounded text-sm font-medium text-white bg-[#FF6006] hover:bg-[#FF6006]/80 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Invoice'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────

export default function APInvoicesPage() {
  const density = useDensity();
  const [invoices, setInvoices] = useState<APInvoice[]>([]);
  const [aging, setAging] = useState<AgingSummary | null>(null);
  const [vendors, setVendors] = useState<Array<{ name: string; total: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<APInvoiceStatus | ''>('');
  const [vendorSearch, setVendorSearch] = useState('');
  const [showOverdue, setShowOverdue] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (showOverdue) params.set('overdue', 'true');

      const [invRes, agingRes] = await Promise.all([
        fetch(`/api/ap/invoices?${params.toString()}`),
        fetch('/api/ap/aging'),
      ]);

      const invData = await invRes.json();
      const agingData = await agingRes.json();

      if (invData.success) {
        let filtered = invData.data as APInvoice[];
        if (vendorSearch) {
          const q = vendorSearch.toLowerCase();
          filtered = filtered.filter(
            (inv) =>
              inv.vendorName.toLowerCase().includes(q) ||
              inv.invoiceNumber.toLowerCase().includes(q)
          );
        }
        setInvoices(filtered);

        // Compute top vendors by spend from invoice data
        const vendorMap = new Map<string, number>();
        for (const inv of filtered) {
          const prev = vendorMap.get(inv.vendorName) ?? 0;
          vendorMap.set(inv.vendorName, prev + (typeof inv.amount === 'number' ? inv.amount : 0));
        }
        const sorted = Array.from(vendorMap.entries())
          .map(([name, total]) => ({ name, total }))
          .sort((a, b) => b.total - a.total)
          .slice(0, 5);
        setVendors(sorted);
      }
      if (agingData.success) {
        setAging(agingData.data as AgingSummary);
      }
      setLastRefresh(new Date());
    } catch {
      // silently handle — data stays empty
    } finally {
      setLoading(false);
    }
  }, [statusFilter, vendorSearch, showOverdue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  async function handleAction(id: string, action: string, extra?: Record<string, unknown>) {
    setActionLoading(id);
    try {
      const res = await fetch('/api/ap/invoices', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, ...extra }),
      });
      const data = await res.json();
      if (data.success) {
        await loadData();
      }
    } catch {
      // handle silently
    } finally {
      setActionLoading(null);
    }
  }

  const overdueCount = (invoices ?? []).filter((inv) => {
    if (inv.status === 'paid') return false;
    return inv.dueDate < new Date().toISOString().slice(0, 10);
  }).length;

  const overdueTotal = (invoices ?? []).filter((inv) => {
    if (inv.status === 'paid') return false;
    return inv.dueDate < new Date().toISOString().slice(0, 10);
  }).reduce((s, inv) => s + (typeof inv.amount === 'number' ? inv.amount : 0), 0);

  const pendingApproval = (invoices ?? []).filter((inv) => inv.status === 'review');
  const pendingApprovalTotal = pendingApproval.reduce(
    (s, inv) => s + (typeof inv.amount === 'number' ? inv.amount : 0),
    0
  );

  // ── Executive density view ────────────────────────────────────
  if (density === 'executive') {
    const agingChartData = aging
      ? [
          { label: 'Current', value: aging.current.total, color: '#22c55e' },
          { label: '1-30d', value: aging.days30.total, color: '#eab308' },
          { label: '31-60d', value: aging.days60.total, color: '#f97316' },
          { label: '61-90+d', value: aging.days90plus.total, color: '#ef4444' },
        ]
      : [];

    return (
      <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">AP Console</h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Executive view — aging overview and top vendors
            </p>
          </div>
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 border border-[#27272A] rounded hover:bg-[#27272A]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>

        <AIInsightsBanner module="ap-invoices" compact />

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <DensityKPI
            label="Total Outstanding"
            value={aging ? fmt(aging.totalOutstanding) : '--'}
            delta={overdueCount > 0 ? `${overdueCount} overdue` : 'All current'}
            deltaDirection={overdueCount > 0 ? 'down' : 'up'}
          />
          <DensityKPI
            label="Pending Approval"
            value={String(pendingApproval.length)}
            delta={fmt(pendingApprovalTotal)}
            deltaDirection="neutral"
          />
          <DensityKPI
            label="Past Due"
            value={String(overdueCount)}
            delta={overdueCount > 0 ? fmt(overdueTotal) : undefined}
            deltaDirection={overdueCount > 0 ? 'down' : undefined}
          />
          <DensityKPI
            label="Invoices"
            value={String((invoices ?? []).length)}
            delta={lastRefresh ? `Updated ${lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}` : undefined}
            deltaDirection="neutral"
          />
        </div>

        {/* Aging Chart */}
        {agingChartData.length > 0 && (
          <DensitySection title="AP Aging Distribution">
            <DensityChart type="bar" data={agingChartData} height={140} title="Invoice Aging Buckets" />
          </DensitySection>
        )}

        {/* Top Vendors */}
        {(vendors ?? []).length > 0 && (
          <DensitySection title="Top Vendors by Spend">
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {(vendors ?? []).map((v, i) => (
                <DensityKPI
                  key={`exec-vendor-${v.name}-${i}`}
                  label={v.name}
                  value={fmt(v.total)}
                />
              ))}
            </div>
          </DensitySection>
        )}

        {/* Overdue alert */}
        {overdueCount > 0 && (
          <DensityInsight
            text={`${overdueCount} invoice${overdueCount > 1 ? 's' : ''} totaling ${fmt(overdueTotal)} are past due. Immediate payment review recommended.`}
            actionLabel="View Overdue"
            onAction={() => setShowOverdue(true)}
          />
        )}

        <CreateInvoiceModal
          open={showCreate}
          onClose={() => setShowCreate(false)}
          onCreated={loadData}
        />
      </div>
    );
  }

  // ── Operator density view (full invoice queue) ─────────────────

  return (
    <div className="h-full overflow-y-auto px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">AP Console</h1>
          <p className="text-xs text-zinc-400 mt-0.5">
            Accounts payable invoices, GL coding, and payment workflows
            {lastRefresh && (
              <span className="ml-2 text-zinc-600">
                — Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-zinc-400 border border-[#27272A] rounded hover:bg-[#27272A]"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-[#FF6006] rounded hover:bg-[#FF6006]/80"
          >
            <Plus size={14} />
            New Invoice
          </button>
        </div>
      </div>

      <AIInsightsBanner module="ap-invoices" compact />

      {/* Summary Header Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Pending + Overdue KPIs */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
          <h3 className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Action Required</h3>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300">Pending Approval</span>
              <div className="text-right">
                <span className="text-xs font-semibold text-amber-400 tabular-nums">
                  {pendingApproval.length}
                </span>
                <span className="text-xs text-zinc-500 ml-2 tabular-nums">{fmt(pendingApprovalTotal)}</span>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-300 flex items-center gap-1.5">
                Past Due
                {overdueCount > 0 && <AlertTriangle size={12} className="text-red-400" />}
              </span>
              <div className="text-right">
                <span className={`text-xs font-semibold tabular-nums ${overdueCount > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {overdueCount}
                </span>
                <span className="text-xs text-zinc-500 ml-2 tabular-nums">{fmt(overdueTotal)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Top Vendors by Spend */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
          <h3 className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Top Vendors by Spend</h3>
          {(vendors ?? []).length === 0 ? (
            <p className="text-xs text-zinc-600">No vendor data</p>
          ) : (
            <div className="space-y-2">
              {(vendors ?? []).map((v, i) => (
                <div key={`vendor-${v.name}-${i}`} className="flex items-center justify-between">
                  <span className="text-xs text-zinc-400 truncate max-w-[60%]">{v.name}</span>
                  <span className="text-xs font-medium text-white tabular-nums">{fmt(v.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick Actions */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
          <h3 className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider mb-2">Quick Actions</h3>
          <div className="space-y-2">
            <button
              onClick={() => setShowCreate(true)}
              className="w-full flex items-center gap-2 rounded-md border border-[#27272A] bg-[#09090B] p-2.5 hover:border-[#FF6006]/40 transition-colors text-left group"
            >
              <Plus size={14} className="text-zinc-600 group-hover:text-[#FF6006] transition-colors shrink-0" />
              <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">New Invoice</span>
            </button>
            <button
              onClick={() => { setStatusFilter(''); setShowOverdue(false); setVendorSearch(''); loadData(); }}
              className="w-full flex items-center gap-2 rounded-md border border-[#27272A] bg-[#09090B] p-2.5 hover:border-[#FF6006]/40 transition-colors text-left group"
            >
              <FileText size={14} className="text-zinc-600 group-hover:text-[#FF6006] transition-colors shrink-0" />
              <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Run Aging Report</span>
            </button>
            <button
              onClick={() => setVendorSearch('')}
              className="w-full flex items-center gap-2 rounded-md border border-[#27272A] bg-[#09090B] p-2.5 hover:border-[#FF6006]/40 transition-colors text-left group"
            >
              <Search size={14} className="text-zinc-600 group-hover:text-[#FF6006] transition-colors shrink-0" />
              <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">Vendor Lookup</span>
            </button>
          </div>
        </div>
      </div>

      {/* Aging Summary Cards */}
      {aging && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Current', data: aging.current, color: 'text-green-400' },
            { label: '1-30 Days', data: aging.days30, color: 'text-yellow-400' },
            { label: '31-60 Days', data: aging.days60, color: 'text-orange-400' },
            { label: '61-90+ Days', data: aging.days90plus, color: 'text-red-400' },
          ].map((bucket) => (
            <div
              key={bucket.label}
              className="bg-[#18181B] border border-[#27272A] rounded-lg p-4"
            >
              <p className="text-xs text-zinc-500 mb-1">{bucket.label}</p>
              <p className={`text-lg font-semibold ${bucket.color}`}>
                {fmt(bucket.data.total)}
              </p>
              <p className="text-xs text-zinc-500">{bucket.data.count} invoices</p>
            </div>
          ))}
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
            <p className="text-xs text-zinc-500 mb-1">Total Outstanding</p>
            <p className="text-lg font-semibold text-white">{fmt(aging.totalOutstanding)}</p>
            <p className="text-xs text-zinc-500">
              {overdueCount > 0 ? (
                <span className="text-red-400">{overdueCount} overdue</span>
              ) : (
                'All current'
              )}
            </p>
          </div>
        </div>
      )}
      {!aging && !loading && (
        <div className="grid grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex items-center gap-3 bg-[#18181B] border border-[#27272A] rounded-lg p-3">
        <Filter size={14} className="text-zinc-500" />
        <div className="relative">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as APInvoiceStatus | '')}
            className="bg-[#09090B] border border-[#27272A] rounded px-3 py-1.5 text-sm text-white focus:border-[#FF6006] focus:outline-none appearance-none pr-8"
          >
            <option value="">All Statuses</option>
            <option value="received">Received</option>
            <option value="coding">Coding</option>
            <option value="review">Review</option>
            <option value="approved">Approved</option>
            <option value="scheduled">Scheduled</option>
            <option value="paid">Paid</option>
          </select>
          <ChevronDown size={12} className="absolute right-2 top-1/2 -translate-y-1/2 text-zinc-500 pointer-events-none" />
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
          <input
            type="text"
            placeholder="Search vendor or invoice #..."
            value={vendorSearch}
            onChange={(e) => setVendorSearch(e.target.value)}
            className="w-full bg-[#09090B] border border-[#27272A] rounded pl-8 pr-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-[#FF6006] focus:outline-none"
          />
        </div>
        <label className="flex items-center gap-1.5 text-sm text-zinc-400 cursor-pointer">
          <input
            type="checkbox"
            checked={showOverdue}
            onChange={(e) => setShowOverdue(e.target.checked)}
            className="rounded border-[#27272A] bg-[#09090B] text-[#FF6006] focus:ring-[#FF6006]"
          />
          Overdue only
        </label>
      </div>

      {/* Operator Invoice Queue — DensityTable */}
      <DensitySection title="Invoice Queue">
        <DensityTable
          columns={[
            { key: 'vendor', label: 'Vendor' },
            { key: 'invoiceNumber', label: 'Invoice #' },
            { key: 'agingBucket', label: 'Aging' },
            { key: 'amount', label: 'Amount', align: 'right' },
            { key: 'status', label: 'Status' },
            { key: 'dueDate', label: 'Due Date' },
          ]}
          data={(invoices ?? []).map((inv) => {
            const today = new Date().toISOString().slice(0, 10);
            const daysOverdue = inv.dueDate < today && inv.status !== 'paid'
              ? Math.round((Date.now() - new Date(inv.dueDate).getTime()) / 86400000)
              : 0;
            const agingBucket = inv.status === 'paid'
              ? 'Paid'
              : daysOverdue === 0
              ? 'Current'
              : daysOverdue <= 30
              ? '1-30d'
              : daysOverdue <= 60
              ? '31-60d'
              : '61-90+d';
            return {
              vendor: inv.vendorName,
              invoiceNumber: inv.invoiceNumber,
              agingBucket,
              amount: fmt(inv.amount),
              status: STATUS_CONFIG[inv.status]?.label ?? inv.status,
              dueDate: inv.dueDate,
            };
          })}
          sectionGroupBy="agingBucket"
        />
      </DensitySection>

      {/* Full Invoice Table (detailed operator view) */}
      <div className="bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-[#27272A] text-left">
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider w-8" />
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Vendor
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Invoice #
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Date
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Due Date
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider text-right">
                Amount
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Status
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                GL Coding
              </th>
              <th className="px-3 py-2 text-xs font-medium text-zinc-500 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {loading && (invoices ?? []).length === 0 && (
              <>
                {Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="border-b border-[#27272A]">
                    <td colSpan={9} className="px-3 py-2">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              </>
            )}
            {!loading && (invoices ?? []).length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-zinc-500 text-sm">
                  <FileText size={32} className="mx-auto mb-2 opacity-40" />
                  No invoices found. Create one to get started.
                </td>
              </tr>
            )}
            {(invoices ?? []).map((inv) => {
              const isExpanded = expandedId === inv.id;
              const isOverdue =
                inv.status !== 'paid' &&
                inv.dueDate < new Date().toISOString().slice(0, 10);

              return (
                <InvoiceRow
                  key={inv.id}
                  invoice={inv}
                  isExpanded={isExpanded}
                  isOverdue={isOverdue}
                  actionLoading={actionLoading === inv.id}
                  onToggle={() => setExpandedId(isExpanded ? null : inv.id)}
                  onAction={handleAction}
                />
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Modal */}
      <CreateInvoiceModal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={loadData}
      />
    </div>
  );
}

// ── Invoice Row Component ─────────────────────────────────────

function InvoiceRow({
  invoice,
  isExpanded,
  isOverdue,
  actionLoading,
  onToggle,
  onAction,
}: {
  invoice: APInvoice;
  isExpanded: boolean;
  isOverdue: boolean;
  actionLoading: boolean;
  onToggle: () => void;
  onAction: (id: string, action: string, extra?: Record<string, unknown>) => void;
}) {
  return (
    <>
      <tr
        className={`border-b border-[#27272A] hover:bg-[#27272A]/40 cursor-pointer ${
          isOverdue ? 'bg-red-500/5' : ''
        }`}
        onClick={onToggle}
      >
        <td className="px-3 py-2 text-zinc-500">
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </td>
        <td className="px-3 py-2 text-sm text-white font-medium">{invoice.vendorName}</td>
        <td className="px-3 py-2 text-sm text-zinc-300 font-mono">{invoice.invoiceNumber}</td>
        <td className="px-3 py-2 text-sm text-zinc-400">{invoice.date}</td>
        <td className="px-3 py-2 text-sm">
          <span className={isOverdue ? 'text-red-400 font-medium' : 'text-zinc-400'}>
            {invoice.dueDate}
            {isOverdue && <AlertTriangle size={12} className="inline ml-1" />}
          </span>
        </td>
        <td className="px-3 py-2 text-sm text-white text-right font-mono">{fmt(invoice.amount)}</td>
        <td className="px-3 py-2">
          <StatusBadge status={invoice.status} />
        </td>
        <td className="px-3 py-2 text-sm text-zinc-400 font-mono">
          {(invoice.glCoding ?? []).length > 0
            ? (invoice.glCoding ?? []).join(', ')
            : <span className="text-zinc-600">--</span>
          }
          {invoice.autoCoded && (
            <span className="ml-1 text-xs text-green-500" title={`Confidence: ${Math.round(invoice.autoCodeConfidence * 100)}%`}>
              (auto {Math.round(invoice.autoCodeConfidence * 100)}%)
            </span>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            {(invoice.status === 'received' || invoice.status === 'coding') && (
              <button
                onClick={() => onAction(invoice.id, 'auto_code')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-[#FF6006] border border-[#FF6006]/30 rounded hover:bg-[#FF6006]/10 disabled:opacity-50"
                title="Auto-Code GL"
              >
                <Wand2 size={12} />
                Auto-Code
              </button>
            )}
            {invoice.status === 'coding' && (
              <button
                onClick={() => onAction(invoice.id, 'submit_review')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-blue-400 border border-blue-400/30 rounded hover:bg-blue-400/10 disabled:opacity-50"
              >
                <Clock size={12} />
                Submit
              </button>
            )}
            {invoice.status === 'review' && (
              <button
                onClick={() => onAction(invoice.id, 'approve')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 border border-green-400/30 rounded hover:bg-green-400/10 disabled:opacity-50"
              >
                <Check size={12} />
                Approve
              </button>
            )}
            {invoice.status === 'approved' && (
              <button
                onClick={() => onAction(invoice.id, 'schedule')}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-purple-400 border border-purple-400/30 rounded hover:bg-purple-400/10 disabled:opacity-50"
              >
                <Calendar size={12} />
                Schedule
              </button>
            )}
            {invoice.status === 'scheduled' && (
              <button
                onClick={() => {
                  const ref = prompt('Enter payment reference (check #, EFT ID):');
                  if (ref) onAction(invoice.id, 'mark_paid', { paidReference: ref });
                }}
                disabled={actionLoading}
                className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-300 border border-zinc-500/30 rounded hover:bg-zinc-500/10 disabled:opacity-50"
              >
                <DollarSign size={12} />
                Mark Paid
              </button>
            )}
          </div>
        </td>
      </tr>
      {isExpanded && (
        <tr className="border-b border-[#27272A]">
          <td colSpan={9} className="px-6 py-4 bg-[#09090B]">
            <div className="space-y-3">
              {/* Invoice details */}
              <div className="grid grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-zinc-500">Vendor ID:</span>{' '}
                  <span className="text-zinc-300">{invoice.vendorId}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Source:</span>{' '}
                  <span className="text-zinc-300">
                    {invoice.ocrExtracted ? 'OCR' : 'Manual'}
                    {invoice.sourceDocument && ` — ${invoice.sourceDocument}`}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-500">Approved By:</span>{' '}
                  <span className="text-zinc-300">{invoice.approvedBy ?? '--'}</span>
                </div>
                <div>
                  <span className="text-zinc-500">Paid:</span>{' '}
                  <span className="text-zinc-300">
                    {invoice.paidDate
                      ? `${invoice.paidDate} (${invoice.paidReference ?? ''})`
                      : '--'}
                  </span>
                </div>
              </div>

              {/* Line items */}
              {(invoice.lineItems ?? []).length > 0 && (
                <div>
                  <h4 className="text-xs font-medium text-zinc-400 mb-2 uppercase tracking-wider">
                    Line Items
                  </h4>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-zinc-500 border-b border-[#27272A]">
                        <th className="text-left py-1 pr-3">Description</th>
                        <th className="text-right py-1 pr-3">Qty</th>
                        <th className="text-right py-1 pr-3">Unit Price</th>
                        <th className="text-right py-1 pr-3">Amount</th>
                        <th className="text-left py-1 pr-3">GL Account</th>
                        <th className="text-left py-1 pr-3">Profit Center</th>
                        <th className="text-left py-1">Tax Code</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(invoice.lineItems ?? []).map((li) => (
                        <tr key={li.id} className="text-zinc-300 border-b border-[#27272A]/50">
                          <td className="py-1.5 pr-3">{li.description}</td>
                          <td className="py-1.5 pr-3 text-right">{li.quantity}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{fmt(li.unitPrice)}</td>
                          <td className="py-1.5 pr-3 text-right font-mono">{fmt(li.amount)}</td>
                          <td className="py-1.5 pr-3 font-mono">
                            {li.glAccount ? `${li.glAccount} — ${li.glAccountName}` : '--'}
                          </td>
                          <td className="py-1.5 pr-3">{li.profitCenter || '--'}</td>
                          <td className="py-1.5">{li.taxCode || '--'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {(invoice.lineItems ?? []).length === 0 && (
                <p className="text-xs text-zinc-500 italic">
                  No line items. Use Auto-Code to generate GL coding from vendor patterns.
                </p>
              )}
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
