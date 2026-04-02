'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ── Constants ────────────────────────────────────────────────
const GATEWAY_BASE_URL =
  process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY =
  process.env.NEXT_PUBLIC_GATEWAY_API_KEY || '';

// ── Types ────────────────────────────────────────────────────
interface AgingRow {
  vendor_name: string;
  Current_Amount: number;
  Days_1_30: number;
  Days_31_60: number;
  Days_61_90: number;
  Days_Over_90: number;
  Total: number;
}

interface VendorSpend {
  vendor_name: string;
  total_spend: number;
}

interface GLCategory {
  Account_Desc: string;
  total: number;
}

type SortKey = keyof AgingRow;
type SortDir = 'asc' | 'desc';

// ── Helpers ──────────────────────────────────────────────────
const usd = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

const usdFull = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function fmtCompact(n: number): string {
  if (typeof n !== 'number' || isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return usd.format(n);
}

async function queryGateway<T>(sql: string): Promise<T[]> {
  const res = await fetch(`${GATEWAY_BASE_URL}/ascend/query`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': GATEWAY_API_KEY,
    },
    body: JSON.stringify({ sql }),
  });
  if (!res.ok) throw new Error(`Gateway ${res.status}`);
  const json = await res.json();
  return (json.data ?? json.rows ?? json ?? []) as T[];
}

// ── SQL Queries ──────────────────────────────────────────────
const SQL_AGING = `SELECT vendor_name,
  SUM(CASE WHEN DATEDIFF(day, invoice_date, GETDATE()) <= 0 THEN debit ELSE 0 END) as Current_Amount,
  SUM(CASE WHEN DATEDIFF(day, invoice_date, GETDATE()) BETWEEN 1 AND 30 THEN debit ELSE 0 END) as Days_1_30,
  SUM(CASE WHEN DATEDIFF(day, invoice_date, GETDATE()) BETWEEN 31 AND 60 THEN debit ELSE 0 END) as Days_31_60,
  SUM(CASE WHEN DATEDIFF(day, invoice_date, GETDATE()) BETWEEN 61 AND 90 THEN debit ELSE 0 END) as Days_61_90,
  SUM(CASE WHEN DATEDIFF(day, invoice_date, GETDATE()) > 90 THEN debit ELSE 0 END) as Days_Over_90,
  SUM(debit) as Total
FROM vPurchaseJournal
WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12
GROUP BY vendor_name
ORDER BY Total DESC
LIMIT 50`;

const SQL_TOP_VENDORS = `SELECT vendor_name, SUM(debit) as total_spend
FROM vPurchaseJournal
WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12
GROUP BY vendor_name
ORDER BY total_spend DESC
LIMIT 15`;

const SQL_GL_CATEGORIES = `SELECT Account_Desc, SUM(debit) as total
FROM vPurchaseJournal
WHERE Year_For_Period = 2026 AND Period BETWEEN 1 AND 12
GROUP BY Account_Desc
ORDER BY total DESC
LIMIT 30`;

// ── Component ────────────────────────────────────────────────
export default function AccountsPayablePage() {
  const [aging, setAging] = useState<AgingRow[]>([]);
  const [vendors, setVendors] = useState<VendorSpend[]>([]);
  const [categories, setCategories] = useState<GLCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('Total');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [glExpanded, setGlExpanded] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [agingData, vendorData, glData] = await Promise.all([
        queryGateway<AgingRow>(SQL_AGING),
        queryGateway<VendorSpend>(SQL_TOP_VENDORS),
        queryGateway<GLCategory>(SQL_GL_CATEGORIES),
      ]);
      setAging(agingData ?? []);
      setVendors(vendorData ?? []);
      setCategories(glData ?? []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gateway offline'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ── Derived KPIs ─────────────────────────────────────────
  const totalAP = (aging ?? []).reduce(
    (sum, r) => sum + (Number(r.Total) || 0),
    0
  );
  const overdue90 = (aging ?? []).reduce(
    (sum, r) => sum + (Number(r.Days_Over_90) || 0),
    0
  );
  const topVendor =
    (aging ?? []).length > 0 ? (aging ?? [])[0].vendor_name : '--';
  const vendorCount = (aging ?? []).length;

  // ── Sorting ──────────────────────────────────────────────
  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  const sortedAging = [...(aging ?? [])].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === 'string' && typeof bVal === 'string') {
      return sortDir === 'asc'
        ? aVal.localeCompare(bVal)
        : bVal.localeCompare(aVal);
    }
    const aNum = Number(aVal) || 0;
    const bNum = Number(bVal) || 0;
    return sortDir === 'asc' ? aNum - bNum : bNum - aNum;
  });

  // ── Chart data ───────────────────────────────────────────
  const chartData = (vendors ?? []).map((v) => ({
    name:
      v.vendor_name.length > 20
        ? v.vendor_name.slice(0, 18) + '...'
        : v.vendor_name,
    spend: Number(v.total_spend) || 0,
  }));

  // ── Render ───────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-5 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 rounded-lg bg-[#FE5000]/10 flex items-center justify-center">
          <svg
            className="w-5 h-5 text-[#FE5000]"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        </div>
        <div>
          <h1 className="text-lg font-bold text-white">
            Accounts Payable
          </h1>
          <p className="text-sm text-zinc-500">
            Vendor invoices, payments &amp; aging
          </p>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg
              className="w-4 h-4 text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
              />
            </svg>
            <span className="text-sm text-red-300">
              Gateway offline — showing cached data
            </span>
          </div>
          <button
            onClick={fetchData}
            className="rounded bg-red-500/20 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-500/30 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* KPI Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <KPICard
          label="Total AP YTD"
          value={fmtCompact(totalAP)}
          loading={loading}
        />
        <KPICard
          label="90+ Days Overdue"
          value={fmtCompact(overdue90)}
          loading={loading}
          highlight={overdue90 > 0}
        />
        <KPICard
          label="Top Vendor"
          value={topVendor}
          loading={loading}
          isText
        />
        <KPICard
          label="Vendor Count"
          value={String(vendorCount)}
          loading={loading}
        />
      </div>

      {/* AP Aging Table */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">
            AP Aging by Vendor
          </h2>
        </div>
        {loading ? (
          <div className="p-4 space-y-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-8 rounded bg-zinc-800 animate-pulse"
              />
            ))}
          </div>
        ) : (sortedAging ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No AP aging data available
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-400 text-xs">
                  {[
                    { key: 'vendor_name' as SortKey, label: 'Vendor' },
                    {
                      key: 'Current_Amount' as SortKey,
                      label: 'Current',
                    },
                    { key: 'Days_1_30' as SortKey, label: '1-30' },
                    { key: 'Days_31_60' as SortKey, label: '31-60' },
                    { key: 'Days_61_90' as SortKey, label: '61-90' },
                    {
                      key: 'Days_Over_90' as SortKey,
                      label: '90+',
                    },
                    { key: 'Total' as SortKey, label: 'Total' },
                  ].map((col) => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key)}
                      className={`px-4 py-2 font-medium cursor-pointer hover:text-white transition-colors ${
                        col.key === 'vendor_name'
                          ? 'text-left'
                          : 'text-right'
                      } ${
                        sortKey === col.key ? 'text-[#FE5000]' : ''
                      }`}
                    >
                      {col.label}
                      {sortKey === col.key && (
                        <span className="ml-1">
                          {sortDir === 'asc' ? '\u2191' : '\u2193'}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedAging.map((row, idx) => (
                  <tr
                    key={row.vendor_name}
                    className={`border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors ${
                      idx % 2 === 0 ? 'bg-zinc-900' : 'bg-zinc-900/60'
                    }`}
                  >
                    <td className="px-4 py-2.5 text-white font-medium truncate max-w-[240px]">
                      {row.vendor_name}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-300 tabular-nums">
                      {usdFull.format(Number(row.Current_Amount) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-300 tabular-nums">
                      {usdFull.format(Number(row.Days_1_30) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-300 tabular-nums">
                      {usdFull.format(Number(row.Days_31_60) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-zinc-300 tabular-nums">
                      {usdFull.format(Number(row.Days_61_90) || 0)}
                    </td>
                    <td
                      className={`px-4 py-2.5 text-right tabular-nums font-medium ${
                        (Number(row.Days_Over_90) || 0) > 0
                          ? 'text-[#FE5000]'
                          : 'text-zinc-300'
                      }`}
                    >
                      {usdFull.format(Number(row.Days_Over_90) || 0)}
                    </td>
                    <td className="px-4 py-2.5 text-right text-white tabular-nums font-semibold">
                      {usdFull.format(Number(row.Total) || 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Top Vendors Chart */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 mb-6 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <h2 className="text-sm font-semibold text-white">
            Top 15 Vendors by Spend
          </h2>
        </div>
        {loading ? (
          <div className="p-4 h-[400px] flex items-center justify-center">
            <div className="w-6 h-6 border-2 border-zinc-700 border-t-[#FE5000] rounded-full animate-spin" />
          </div>
        ) : (chartData ?? []).length === 0 ? (
          <div className="p-8 text-center text-sm text-zinc-500">
            No vendor spend data available
          </div>
        ) : (
          <div className="px-4 py-4">
            <ResponsiveContainer width="100%" height={400}>
              <BarChart
                data={chartData}
                layout="vertical"
                margin={{ left: 120, right: 20, top: 10, bottom: 10 }}
              >
                <XAxis
                  type="number"
                  tickFormatter={(v: number) => fmtCompact(v)}
                  tick={{ fill: '#71717a', fontSize: 11 }}
                  axisLine={{ stroke: '#3f3f46' }}
                  tickLine={false}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  tick={{ fill: '#a1a1aa', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                  width={110}
                />
                <Tooltip
                  formatter={(value) => [
                    usdFull.format(Number(value)),
                    'Spend',
                  ]}
                  contentStyle={{
                    backgroundColor: '#18181b',
                    border: '1px solid #3f3f46',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                  }}
                  cursor={{ fill: 'rgba(254,80,0,0.05)' }}
                />
                <Bar
                  dataKey="spend"
                  fill="#FE5000"
                  radius={[0, 4, 4, 0]}
                  barSize={18}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* GL Categories */}
      <div className="rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden">
        <button
          onClick={() => setGlExpanded(!glExpanded)}
          className="w-full flex items-center justify-between px-4 py-3 border-b border-zinc-800 hover:bg-zinc-800/50 transition-colors"
        >
          <h2 className="text-sm font-semibold text-white">
            GL Category Breakdown
          </h2>
          <svg
            className={`w-4 h-4 text-zinc-400 transition-transform ${
              glExpanded ? 'rotate-180' : ''
            }`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
        {glExpanded && (
          <div className="divide-y divide-zinc-800/50">
            {loading ? (
              <div className="p-4 space-y-2">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-6 rounded bg-zinc-800 animate-pulse"
                  />
                ))}
              </div>
            ) : (categories ?? []).length === 0 ? (
              <div className="p-6 text-center text-sm text-zinc-500">
                No GL category data available
              </div>
            ) : (
              (categories ?? []).map((cat, idx) => {
                const maxTotal = (categories ?? [])[0]?.total ?? 1;
                const pct =
                  maxTotal > 0
                    ? ((Number(cat.total) || 0) / maxTotal) * 100
                    : 0;
                return (
                  <div
                    key={cat.Account_Desc}
                    className={`flex items-center gap-4 px-4 py-2.5 ${
                      idx % 2 === 0
                        ? 'bg-zinc-900'
                        : 'bg-zinc-900/60'
                    }`}
                  >
                    <span className="text-xs text-zinc-500 w-6 text-right tabular-nums">
                      {idx + 1}
                    </span>
                    <span className="text-sm text-white flex-1 truncate">
                      {cat.Account_Desc}
                    </span>
                    <div className="w-32 h-1.5 rounded-full bg-zinc-800 overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#FE5000]/60"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm text-zinc-300 tabular-nums font-medium w-28 text-right">
                      {usd.format(Number(cat.total) || 0)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── KPI Card ─────────────────────────────────────────────────
function KPICard({
  label,
  value,
  loading,
  highlight,
  isText,
}: {
  label: string;
  value: string;
  loading: boolean;
  highlight?: boolean;
  isText?: boolean;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900 px-4 py-3">
      <p className="text-xs text-zinc-500 mb-1">{label}</p>
      {loading ? (
        <div className="h-7 w-24 rounded bg-zinc-800 animate-pulse" />
      ) : (
        <p
          className={`text-lg font-bold tabular-nums ${
            highlight
              ? 'text-[#FE5000]'
              : isText
                ? 'text-white text-sm truncate'
                : 'text-white'
          }`}
        >
          {value}
        </p>
      )}
    </div>
  );
}
