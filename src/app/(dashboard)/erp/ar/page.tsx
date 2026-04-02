'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Banknote,
  RefreshCw,
  AlertTriangle,
  ExternalLink,
  Clock,
  TrendingUp,
  Users,
} from 'lucide-react';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY || '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AgingRow {
  customer: string;
  current: number;
  days1to30: number;
  days31to60: number;
  days61to90: number;
  days90Plus: number;
  total: number;
}

interface Invoice {
  date: string;
  customer: string;
  invoiceNumber: string;
  amount: number;
  status: 'paid' | 'open' | 'overdue';
  daysOutstanding: number;
}

interface RevenueByCustomer {
  customer: string;
  revenue: number;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

const fmtCurrency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const fmtCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});

function safeFmt(n: unknown): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  return fmtCurrency.format(n);
}

function safeCompact(n: unknown): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  return fmtCompact.format(n);
}

// ---------------------------------------------------------------------------
// Gateway fetch helper
// ---------------------------------------------------------------------------

async function gw<T>(path: string): Promise<T> {
  const res = await fetch(`${GATEWAY_BASE_URL}${path}`, {
    headers: {
      'x-api-key': GATEWAY_API_KEY,
      'Content-Type': 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`Gateway ${res.status}: ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

// ---------------------------------------------------------------------------
// Status badge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
    open: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
    overdue: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium capitalize ${colors[status] ?? 'bg-zinc-700 text-zinc-300 border-zinc-600'}`}
    >
      {status}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function AccountsReceivablePage() {
  const [agingRows, setAgingRows] = useState<AgingRow[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [revenueByCustomer, setRevenueByCustomer] = useState<RevenueByCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agingRes, invoiceRes, revenueRes] = await Promise.all([
        gw<{ data?: AgingRow[]; rows?: AgingRow[] }>('/ascend/ar/aging'),
        gw<{ data?: Invoice[]; invoices?: Invoice[] }>('/ascend/invoices?year=2026'),
        gw<{ data?: RevenueByCustomer[]; customers?: RevenueByCustomer[] }>(
          '/ascend/revenue/by-customer'
        ),
      ]);

      setAgingRows(agingRes.data ?? agingRes.rows ?? []);
      setInvoices(invoiceRes.data ?? invoiceRes.invoices ?? []);
      setRevenueByCustomer(revenueRes.data ?? revenueRes.customers ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reach gateway');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // -----------------------------------------------------------------------
  // Derived KPIs
  // -----------------------------------------------------------------------

  const totalAR = (agingRows ?? []).reduce((sum, r) => sum + (r.total ?? 0), 0);
  const total90Plus = (agingRows ?? []).reduce((sum, r) => sum + (r.days90Plus ?? 0), 0);
  const totalRevenue = (revenueByCustomer ?? []).reduce((sum, r) => sum + (r.revenue ?? 0), 0);
  const dso = totalRevenue > 0 ? Math.round(totalAR / (totalRevenue / 365)) : 0;
  const topCustomer =
    (agingRows ?? []).length > 0
      ? [...agingRows].sort((a, b) => (b.total ?? 0) - (a.total ?? 0))[0]?.customer ?? '—'
      : '—';

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/10 border border-orange-500/20">
            <Banknote className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Accounts Receivable</h1>
            <p className="text-sm text-zinc-500">ERP &middot; AR Aging &amp; Invoices</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="http://localhost:3000/admin/invoices"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors"
          >
            View in Portal
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-700 hover:text-zinc-100 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {/* Gateway error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-lg border border-orange-500/30 bg-orange-500/10 p-4">
          <AlertTriangle className="h-5 w-5 shrink-0 text-orange-400" />
          <div className="flex-1">
            <p className="text-sm font-medium text-orange-300">Gateway offline</p>
            <p className="text-xs text-orange-400/70">{error}</p>
          </div>
          <button
            onClick={fetchData}
            className="rounded-md border border-orange-500/30 bg-orange-500/20 px-3 py-1.5 text-xs font-medium text-orange-300 hover:bg-orange-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          label="Total AR Outstanding"
          value={safeCompact(totalAR)}
          icon={<Banknote className="h-4 w-4 text-orange-400" />}
        />
        <KpiCard
          label="90+ Days"
          value={safeCompact(total90Plus)}
          icon={<AlertTriangle className="h-4 w-4 text-orange-400" />}
          highlight={total90Plus > 0}
        />
        <KpiCard
          label="DSO"
          value={`${dso} days`}
          icon={<Clock className="h-4 w-4 text-orange-400" />}
        />
        <KpiCard
          label="Top Customer"
          value={topCustomer}
          icon={<Users className="h-4 w-4 text-orange-400" />}
          small
        />
      </div>

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="h-6 w-6 animate-spin text-zinc-500" />
          <span className="ml-2 text-sm text-zinc-500">Loading AR data...</span>
        </div>
      )}

      {/* AR Aging Table */}
      {!loading && !error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <TrendingUp className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold">AR Aging Summary</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3 text-right">Current</th>
                  <th className="px-4 py-3 text-right">1-30</th>
                  <th className="px-4 py-3 text-right">31-60</th>
                  <th className="px-4 py-3 text-right">61-90</th>
                  <th className="px-4 py-3 text-right">90+</th>
                  <th className="px-4 py-3 text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {(agingRows ?? []).length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-zinc-500">
                      No aging data available
                    </td>
                  </tr>
                )}
                {(agingRows ?? []).map((row, idx) => (
                  <tr
                    key={`${row.customer}-${idx}`}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 font-medium text-zinc-200">
                      {row.customer}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">
                      {safeFmt(row.current)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">
                      {safeFmt(row.days1to30)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">
                      {safeFmt(row.days31to60)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-400">
                      {safeFmt(row.days61to90)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right font-medium ${
                        (row.days90Plus ?? 0) > 0
                          ? 'text-orange-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {safeFmt(row.days90Plus)}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-zinc-200">
                      {safeFmt(row.total)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Recent Invoices */}
      {!loading && !error && (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 overflow-hidden">
          <div className="flex items-center gap-2 border-b border-zinc-800 px-4 py-3">
            <Banknote className="h-4 w-4 text-orange-400" />
            <h2 className="text-sm font-semibold">Recent Invoices</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-left text-xs font-medium uppercase tracking-wider text-zinc-500">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Invoice #</th>
                  <th className="px-4 py-3 text-right">Amount</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Days Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {(invoices ?? []).length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-zinc-500">
                      No invoices available
                    </td>
                  </tr>
                )}
                {(invoices ?? []).map((inv, idx) => (
                  <tr
                    key={`${inv.invoiceNumber}-${idx}`}
                    className="hover:bg-zinc-800/30 transition-colors"
                  >
                    <td className="px-4 py-2.5 text-zinc-400">
                      {inv.date}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-zinc-200">
                      {inv.customer}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-zinc-400">
                      {inv.invoiceNumber}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-200">
                      {safeFmt(inv.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <StatusBadge status={inv.status} />
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right ${
                        (inv.daysOutstanding ?? 0) > 90
                          ? 'font-medium text-orange-400'
                          : 'text-zinc-400'
                      }`}
                    >
                      {inv.daysOutstanding ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  icon,
  highlight = false,
  small = false,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  highlight?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-zinc-900/50 p-4 ${
        highlight
          ? 'border-orange-500/30 bg-orange-500/5'
          : 'border-zinc-800'
      }`}
    >
      <div className="flex items-center gap-2 text-xs text-zinc-500 mb-1">
        {icon}
        {label}
      </div>
      <p
        className={`font-bold tracking-tight ${
          small ? 'text-lg truncate' : 'text-2xl'
        } ${highlight ? 'text-orange-400' : 'text-zinc-100'}`}
      >
        {value}
      </p>
    </div>
  );
}
