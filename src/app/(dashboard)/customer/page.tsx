'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import {
  Users,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  Building2,
  FileText,
  MapPin,
  Briefcase,
  Phone,
  Mail,
  RefreshCw,
  Search,
  ChevronRight,
  Activity,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';

// ── Types ─────────────────────────────────────────────────────

interface FinancialSummary {
  revenueYTD: number;
  gpYTD: number;
  gpMarginPct: number;
  arOutstanding: number;
  custType?: string;
  standardAcctNo?: string;
}

interface ArAging {
  current: number;
  over30: number;
  over60: number;
  over90: number;
}

interface Invoice {
  invoiceNo: string;
  date: string;
  amount: number;
  status?: string;
}

interface SfContact {
  id: string;
  name: string;
  title?: string;
  phone?: string;
  email?: string;
}

interface SfOpportunity {
  id: string;
  name: string;
  stage: string;
  amount?: number;
  closeDate?: string;
}

interface SfActivity {
  id: string;
  subject: string;
  type?: string;
  date?: string;
}

interface SalesforceData {
  contacts: SfContact[];
  opportunities: SfOpportunity[];
  activities: SfActivity[];
}

interface DeliverySite {
  id: string;
  name: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
}

interface HealthData {
  score: number;
  grade: string;
  factors: {
    payment: { score: number; detail: string };
    volume: { score: number; detail: string };
    margin: { score: number; detail: string };
    recency: { score: number; detail: string };
  };
}

interface Customer360State {
  loading: boolean;
  error: string | null;
  financial: FinancialSummary | null;
  aging: ArAging | null;
  invoices: Invoice[];
  salesforce: SalesforceData | null;
  sites: DeliverySite[];
  health: HealthData | null;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number | null | undefined, decimals = 0): string {
  if (n == null || isNaN(n)) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(n);
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || isNaN(n)) return '0.0%';
  return `${n.toFixed(1)}%`;
}

function fmtDate(d: string | null | undefined): string {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return d;
  }
}

function gradeColor(grade: string): string {
  switch (grade) {
    case 'A': return 'text-emerald-400 bg-emerald-400/10 border-emerald-400/30';
    case 'B': return 'text-blue-400 bg-blue-400/10 border-blue-400/30';
    case 'C': return 'text-yellow-400 bg-yellow-400/10 border-yellow-400/30';
    case 'D': return 'text-orange-400 bg-orange-400/10 border-orange-400/30';
    case 'F': return 'text-red-400 bg-red-400/10 border-red-400/30';
    default:  return 'text-zinc-400 bg-zinc-400/10 border-zinc-400/30';
  }
}

function agingBarColor(bucket: 'current' | '30' | '60' | '90'): string {
  switch (bucket) {
    case 'current': return 'bg-emerald-500';
    case '30':      return 'bg-yellow-500';
    case '60':      return 'bg-orange-500';
    case '90':      return 'bg-red-500';
  }
}

// ── Sub-components ────────────────────────────────────────────

function SectionCard({
  title,
  icon: Icon,
  children,
  className = '',
}: {
  title: string;
  icon: typeof Users;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`bg-[#18181B] border border-[#27272A] rounded-lg overflow-hidden ${className}`}>
      <div className="flex items-center gap-2.5 px-5 py-3.5 border-b border-[#27272A]">
        <Icon size={15} className="text-[#FE5000] shrink-0" />
        <span className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-widest">{title}</span>
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
  accent = false,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] text-[#71717A] uppercase tracking-widest">{label}</span>
      <span className={`text-lg font-bold tabular-nums ${accent ? 'text-[#FE5000]' : 'text-white'}`}>
        {value}
      </span>
      {sub && <span className="text-[11px] text-[#52525B]">{sub}</span>}
    </div>
  );
}

function SkeletonLine({ w = 'w-full', h = 'h-4' }: { w?: string; h?: string }) {
  return <div className={`${w} ${h} rounded bg-[#27272A] animate-pulse`} />;
}

// ── Data fetcher ──────────────────────────────────────────────

async function fetchCustomer360(name: string): Promise<Partial<Customer360State>> {
  const encoded = encodeURIComponent(name);

  const REVENUE_SQL = `
    SELECT
      b.CustomerName,
      b.CustType,
      b.StandardAcctNo,
      SUM(i.Qty * i.UnitPrice) AS RevenueYTD,
      SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost, 0))) AS GPYTD
    FROM DF_PBI_BillingChartQuery b
    JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
    WHERE b.Year >= ${new Date().getFullYear()}
      AND b.CustomerName LIKE '${name.replace(/'/g, "''")}%'
    GROUP BY b.CustomerName, b.CustType, b.StandardAcctNo
  `;

  const INVOICES_SQL = `
    SELECT TOP 10
      b.SysTrxNo AS InvoiceNo,
      b.InvoiceDate,
      SUM(i.Qty * i.UnitPrice) AS Amount
    FROM DF_PBI_BillingChartQuery b
    JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
    WHERE b.CustomerName LIKE '${name.replace(/'/g, "''")}%'
    GROUP BY b.SysTrxNo, b.InvoiceDate
    ORDER BY b.InvoiceDate DESC
  `;

  const SF_SOQL = `
    SELECT Id, Name, Title, Phone, Email, Account.Name
    FROM Contact
    WHERE Account.Name LIKE '${name.replace(/'/g, "\\'")}%'
    LIMIT 20
  `;

  const SF_OPP_SOQL = `
    SELECT Id, Name, StageName, Amount, CloseDate
    FROM Opportunity
    WHERE Account.Name LIKE '${name.replace(/'/g, "\\'")}%'
      AND IsClosed = false
    ORDER BY CloseDate ASC
    LIMIT 10
  `;

  const SF_ACT_SOQL = `
    SELECT Id, Subject, Type, ActivityDate
    FROM Activity
    WHERE Account.Name LIKE '${name.replace(/'/g, "\\'")}%'
    ORDER BY ActivityDate DESC
    LIMIT 10
  `;

  const SITES_SQL = `
    SELECT TOP 50
      s.ShipToId,
      s.ShipToName,
      s.Address1,
      s.City,
      s.State,
      s.Zip
    FROM ShipTo s
    JOIN Customer c ON c.CustId = s.CustId
    WHERE c.CustomerName LIKE '${name.replace(/'/g, "''")}%'
    ORDER BY s.ShipToName
  `;

  const [revenueRes, invoicesRes, arAgingRes, sfContactsRes, sfOppRes, sfActRes, sitesRes, healthRes] =
    await Promise.allSettled([
      fetch('/api/gateway/ascend/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: REVENUE_SQL }),
      }).then((r) => r.json()),
      fetch('/api/gateway/ascend/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: INVOICES_SQL }),
      }).then((r) => r.json()),
      fetch(`/api/gateway/ascend/ar/aging?customer=${encoded}`).then((r) => r.json()),
      fetch('/api/gateway/salesforce/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soql: SF_SOQL }),
      }).then((r) => r.json()),
      fetch('/api/gateway/salesforce/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soql: SF_OPP_SOQL }),
      }).then((r) => r.json()),
      fetch('/api/gateway/salesforce/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ soql: SF_ACT_SOQL }),
      }).then((r) => r.json()),
      fetch('/api/gateway/ascend/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sql: SITES_SQL }),
      }).then((r) => r.json()),
      fetch(`/api/customers/health?customer=${encoded}`).then((r) => r.json()),
    ]);

  // ── Financial summary ───────────────────────────────────────
  let financial: FinancialSummary | null = null;
  if (revenueRes.status === 'fulfilled' && revenueRes.value?.success) {
    const rows = (revenueRes.value.data ?? []) as Array<{
      CustomerName?: string;
      CustType?: string;
      StandardAcctNo?: string;
      RevenueYTD?: number;
      GPYTD?: number;
    }>;
    const row = rows[0];
    if (row) {
      const revenue = row.RevenueYTD ?? 0;
      const gp = row.GPYTD ?? 0;
      financial = {
        revenueYTD: revenue,
        gpYTD: gp,
        gpMarginPct: revenue > 0 ? (gp / revenue) * 100 : 0,
        arOutstanding: 0, // filled from AR aging below
        custType: row.CustType,
        standardAcctNo: row.StandardAcctNo,
      };
    }
  }

  // ── AR aging ────────────────────────────────────────────────
  let aging: ArAging | null = null;
  if (arAgingRes.status === 'fulfilled' && arAgingRes.value?.success) {
    const rows = (arAgingRes.value.data ?? []) as Array<{
      CustomerName?: string;
      Current?: number;
      Over30?: number;
      Over60?: number;
      Over90?: number;
    }>;
    const row = rows.find(
      (r) => (r.CustomerName ?? '').toLowerCase() === name.toLowerCase()
    ) ?? rows[0];
    if (row) {
      aging = {
        current: row.Current ?? 0,
        over30: row.Over30 ?? 0,
        over60: row.Over60 ?? 0,
        over90: row.Over90 ?? 0,
      };
      const total = aging.current + aging.over30 + aging.over60 + aging.over90;
      if (financial) {
        financial = { ...financial, arOutstanding: total };
      }
    }
  }

  // ── Invoices ────────────────────────────────────────────────
  const invoices: Invoice[] = [];
  if (invoicesRes.status === 'fulfilled' && invoicesRes.value?.success) {
    const rows = (invoicesRes.value.data ?? []) as Array<{
      InvoiceNo?: string | number;
      InvoiceDate?: string;
      Amount?: number;
    }>;
    for (const r of rows) {
      invoices.push({
        invoiceNo: String(r.InvoiceNo ?? ''),
        date: r.InvoiceDate ?? '',
        amount: r.Amount ?? 0,
      });
    }
  }

  // ── Salesforce ───────────────────────────────────────────────
  const contacts: SfContact[] = [];
  if (sfContactsRes.status === 'fulfilled' && sfContactsRes.value?.success) {
    const rows = (sfContactsRes.value.data ?? sfContactsRes.value.records ?? []) as Array<{
      Id?: string;
      Name?: string;
      Title?: string;
      Phone?: string;
      Email?: string;
    }>;
    for (const r of rows) {
      contacts.push({
        id: r.Id ?? '',
        name: r.Name ?? '',
        title: r.Title,
        phone: r.Phone,
        email: r.Email,
      });
    }
  }

  const opportunities: SfOpportunity[] = [];
  if (sfOppRes.status === 'fulfilled' && sfOppRes.value?.success) {
    const rows = (sfOppRes.value.data ?? sfOppRes.value.records ?? []) as Array<{
      Id?: string;
      Name?: string;
      StageName?: string;
      Amount?: number;
      CloseDate?: string;
    }>;
    for (const r of rows) {
      opportunities.push({
        id: r.Id ?? '',
        name: r.Name ?? '',
        stage: r.StageName ?? '',
        amount: r.Amount,
        closeDate: r.CloseDate,
      });
    }
  }

  const activities: SfActivity[] = [];
  if (sfActRes.status === 'fulfilled' && sfActRes.value?.success) {
    const rows = (sfActRes.value.data ?? sfActRes.value.records ?? []) as Array<{
      Id?: string;
      Subject?: string;
      Type?: string;
      ActivityDate?: string;
    }>;
    for (const r of rows) {
      activities.push({
        id: r.Id ?? '',
        subject: r.Subject ?? '',
        type: r.Type,
        date: r.ActivityDate,
      });
    }
  }

  // ── Delivery sites ────────────────────────────────────────────
  const sites: DeliverySite[] = [];
  if (sitesRes.status === 'fulfilled' && sitesRes.value?.success) {
    const rows = (sitesRes.value.data ?? []) as Array<{
      ShipToId?: string | number;
      ShipToName?: string;
      Address1?: string;
      City?: string;
      State?: string;
      Zip?: string;
    }>;
    for (const r of rows) {
      sites.push({
        id: String(r.ShipToId ?? ''),
        name: r.ShipToName ?? '',
        address: r.Address1,
        city: r.City,
        state: r.State,
        zip: r.Zip,
      });
    }
  }

  // ── Health ────────────────────────────────────────────────────
  let health: HealthData | null = null;
  if (healthRes.status === 'fulfilled' && healthRes.value?.success) {
    const customers = (healthRes.value.customers ?? []) as HealthData[];
    health = customers[0] ?? null;
  }

  return { financial, aging, invoices, salesforce: { contacts, opportunities, activities }, sites, health };
}

// ── Page ──────────────────────────────────────────────────────

function Customer360Inner() {
  const density = useDensity();
  const searchParams = useSearchParams();
  const router = useRouter();
  const customerName = searchParams.get('name') ?? '';
  const [searchInput, setSearchInput] = useState(customerName);

  const [state, setState] = useState<Customer360State>({
    loading: false,
    error: null,
    financial: null,
    aging: null,
    invoices: [],
    salesforce: null,
    sites: [],
    health: null,
  });

  const load = useCallback(
    async (name: string) => {
      if (!name.trim()) return;
      setState((prev) => ({ ...prev, loading: true, error: null }));
      try {
        const data = await fetchCustomer360(name.trim());
        setState((prev) => ({ ...prev, loading: false, ...data }));
      } catch (err) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: err instanceof Error ? err.message : 'Failed to load customer data',
        }));
      }
    },
    []
  );

  useEffect(() => {
    if (customerName) {
      setSearchInput(customerName);
      void load(customerName);
    }
  }, [customerName, load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = searchInput.trim();
    if (!trimmed) return;
    router.push(`/customer?name=${encodeURIComponent(trimmed)}`);
  };

  const { loading, error, financial, aging, invoices, salesforce, sites, health } = state;

  const agingTotal =
    (aging?.current ?? 0) +
    (aging?.over30 ?? 0) +
    (aging?.over60 ?? 0) +
    (aging?.over90 ?? 0);

  const agingBuckets: { label: string; value: number; bucket: 'current' | '30' | '60' | '90' }[] = [
    { label: 'Current', value: aging?.current ?? 0, bucket: 'current' },
    { label: '30 Days', value: aging?.over30 ?? 0, bucket: '30' },
    { label: '60 Days', value: aging?.over60 ?? 0, bucket: '60' },
    { label: '90+ Days', value: aging?.over90 ?? 0, bucket: '90' },
  ];

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white">
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-6 space-y-4">

        <AIInsightsBanner module="customer" compact />

        {/* Search bar — always visible */}
        <form onSubmit={handleSearch} className="flex items-center gap-3">
          <div className="relative flex-1 max-w-lg">
            <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#52525B]" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Enter customer name..."
              className="w-full pl-9 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] focus:outline-none focus:border-[#FE5000]/50 transition-colors"
            />
          </div>
          <button
            type="submit"
            className="flex items-center gap-2 px-4 py-2.5 bg-[#FE5000] hover:bg-[#CC4000] rounded-lg text-xs font-semibold text-white transition-colors"
          >
            <ArrowUpRight size={14} />
            Look Up
          </button>
          {customerName && (
            <button
              type="button"
              onClick={() => void load(customerName)}
              className="flex items-center gap-2 px-3 py-2.5 bg-[#27272A] hover:bg-[#3F3F46] rounded-lg text-sm text-[#A1A1AA] transition-colors"
              title="Refresh"
            >
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            </button>
          )}
        </form>

        {/* Empty state */}
        {!customerName && (
          <div className="flex flex-col items-center justify-center py-24 gap-3">
            <div className="w-14 h-14 rounded-2xl bg-[#18181B] border border-[#27272A] flex items-center justify-center">
              <Users size={24} className="text-[#3F3F46]" />
            </div>
            <div className="text-center">
              <p className="text-sm font-medium text-[#A1A1AA]">Customer 360</p>
              <p className="text-xs text-[#52525B] mt-0.5">Enter a customer name to load their full profile</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && (
          <div className="flex items-start gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
            <AlertTriangle size={16} className="text-red-400 shrink-0 mt-0.5" />
            <p className="text-sm text-red-300">{error}</p>
          </div>
        )}

        {/* Content — only shown when a name is set */}
        {customerName && (
          <>
            {/* ── Section 1: Header ─────────────────────────────── */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-lg bg-[#FE5000]/10 border border-[#FE5000]/20 flex items-center justify-center shrink-0">
                  <Building2 size={22} className="text-[#FE5000]" />
                </div>
                <div>
                  {loading && !financial ? (
                    <div className="space-y-2">
                      <SkeletonLine w="w-48" h="h-6" />
                      <SkeletonLine w="w-32" h="h-4" />
                    </div>
                  ) : (
                    <>
                      <h1 className="text-lg font-bold text-white">{customerName}</h1>
                      <div className="flex items-center gap-3 mt-0.5 flex-wrap">
                        {financial?.custType && (
                          <span className="text-xs text-[#71717A] bg-[#27272A] px-2 py-0.5 rounded">
                            {financial.custType}
                          </span>
                        )}
                        {financial?.standardAcctNo && (
                          <span className="text-xs font-mono text-[#52525B]">
                            Acct #{financial.standardAcctNo}
                          </span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Health grade */}
              <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                <span className="text-[10px] text-[#52525B] uppercase tracking-widest">Health Score</span>
                {loading && !health ? (
                  <SkeletonLine w="w-16" h="h-10" />
                ) : health ? (
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-3xl font-black w-12 h-12 flex items-center justify-center rounded-lg border ${gradeColor(health.grade)}`}
                    >
                      {health.grade}
                    </span>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white tabular-nums">{health.score}</div>
                      <div className="text-[10px] text-[#52525B]">/ 100</div>
                    </div>
                  </div>
                ) : (
                  <span className="text-sm text-[#52525B]">—</span>
                )}
              </div>
            </div>

            {/* ── 2-column grid ─────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

              {/* ── Section 2: Financial Summary ──────────────────── */}
              <SectionCard title="Financial Summary" icon={DollarSign}>
                {loading && !financial ? (
                  <div className="grid grid-cols-2 gap-5">
                    {[...Array(4)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <SkeletonLine w="w-20" h="h-3" />
                        <SkeletonLine w="w-32" h="h-6" />
                      </div>
                    ))}
                  </div>
                ) : density === 'operator' ? (
                  <div className="flex items-center gap-5 text-xs flex-wrap">
                    <span><span className="text-zinc-500">Rev:</span> <span className="font-mono text-[#FE5000] font-bold">{fmt(financial?.revenueYTD)}</span></span>
                    <span className="text-zinc-700">|</span>
                    <span><span className="text-zinc-500">GP:</span> <span className="font-mono text-white font-bold">{fmt(financial?.gpYTD)}</span></span>
                    <span className="text-zinc-700">|</span>
                    <span><span className="text-zinc-500">Margin:</span> <span className="font-mono text-white font-bold">{fmtPct(financial?.gpMarginPct)}</span></span>
                    <span className="text-zinc-700">|</span>
                    <span><span className="text-zinc-500">AR:</span> <span className="font-mono text-white font-bold">{fmt(financial?.arOutstanding)}</span></span>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-x-6 gap-y-5">
                    <StatTile
                      label="Revenue YTD"
                      value={fmt(financial?.revenueYTD)}
                      accent
                    />
                    <StatTile
                      label="GP YTD"
                      value={fmt(financial?.gpYTD)}
                    />
                    <StatTile
                      label="GP Margin"
                      value={fmtPct(financial?.gpMarginPct)}
                      sub="Gross profit margin"
                    />
                    <StatTile
                      label="AR Outstanding"
                      value={fmt(financial?.arOutstanding)}
                      sub="Total open balance"
                    />
                  </div>
                )}
              </SectionCard>

              {/* ── Section 3: AR Aging ───────────────────────────── */}
              <SectionCard title="AR Aging" icon={AlertTriangle}>
                {loading && !aging ? (
                  <div className="space-y-3">
                    {[...Array(4)].map((_, i) => (
                      <SkeletonLine key={i} h="h-8" />
                    ))}
                  </div>
                ) : aging ? (
                  <div className="space-y-3">
                    {agingBuckets.map((b) => {
                      const pct = agingTotal > 0 ? (b.value / agingTotal) * 100 : 0;
                      return (
                        <div key={b.label} className="space-y-1">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-[#A1A1AA]">{b.label}</span>
                            <div className="flex items-center gap-3">
                              <span className="font-mono text-white tabular-nums">{fmt(b.value)}</span>
                              <span className="text-[#52525B] w-10 text-right tabular-nums">
                                {typeof pct === 'number' && !Number.isNaN(pct) ? pct.toFixed(0) : '0'}%
                              </span>
                            </div>
                          </div>
                          <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${agingBarColor(b.bucket)}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                    <div className="pt-2 border-t border-[#27272A] flex justify-between text-xs">
                      <span className="text-[#71717A]">Total Outstanding</span>
                      <span className="font-bold text-white tabular-nums">{fmt(agingTotal)}</span>
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-[#52525B]">No AR aging data available</p>
                )}
              </SectionCard>

              {/* ── Section 4: Recent Invoices ────────────────────── */}
              <SectionCard title="Recent Invoices" icon={FileText} className="lg:col-span-2">
                {loading && invoices.length === 0 ? (
                  <div className="space-y-2">
                    {[...Array(5)].map((_, i) => (
                      <SkeletonLine key={i} h="h-9" />
                    ))}
                  </div>
                ) : invoices.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-[#27272A]">
                          <th className="pb-2.5 text-left text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                            Invoice #
                          </th>
                          <th className="pb-2.5 text-left text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                            Date
                          </th>
                          <th className="pb-2.5 text-right text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                            Amount
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {invoices.map((inv, idx) => (
                          <tr
                            key={inv.invoiceNo || idx}
                            className="border-b border-[#27272A]/50 hover:bg-[#27272A]/30 transition-colors"
                          >
                            <td className="py-2.5 font-mono text-[#A1A1AA]">{inv.invoiceNo || '—'}</td>
                            <td className="py-2.5 text-[#71717A]">{fmtDate(inv.date)}</td>
                            <td className="py-2.5 text-right font-semibold text-white tabular-nums">
                              {fmt(inv.amount)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-[#52525B]">No invoice history found</p>
                )}
              </SectionCard>

              {/* ── Section 5: Salesforce ─────────────────────────── */}
              <SectionCard title="Salesforce" icon={Briefcase} className="lg:col-span-2">
                {loading && !salesforce ? (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="space-y-2">
                        <SkeletonLine w="w-24" h="h-3" />
                        {[...Array(3)].map((_, j) => (
                          <SkeletonLine key={j} h="h-10" />
                        ))}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">

                    {/* Contacts */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Users size={12} className="text-[#52525B]" />
                        <span className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                          Contacts ({salesforce?.contacts.length ?? 0})
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {(salesforce?.contacts ?? []).length > 0 ? (
                          (salesforce?.contacts ?? []).map((c) => (
                            <div
                              key={c.id}
                              className="p-3 bg-[#27272A]/50 rounded-lg space-y-1"
                            >
                              <div className="text-sm font-medium text-white">{c.name}</div>
                              {c.title && (
                                <div className="text-[11px] text-[#71717A]">{c.title}</div>
                              )}
                              <div className="flex flex-col gap-0.5 mt-0.5">
                                {c.phone && (
                                  <a
                                    href={`tel:${c.phone}`}
                                    className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA] hover:text-[#FE5000] transition-colors"
                                  >
                                    <Phone size={10} />
                                    {c.phone}
                                  </a>
                                )}
                                {c.email && (
                                  <a
                                    href={`mailto:${c.email}`}
                                    className="flex items-center gap-1.5 text-[11px] text-[#A1A1AA] hover:text-[#FE5000] transition-colors"
                                  >
                                    <Mail size={10} />
                                    {c.email}
                                  </a>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#52525B]">No contacts found</p>
                        )}
                      </div>
                    </div>

                    {/* Opportunities */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <TrendingUp size={12} className="text-[#52525B]" />
                        <span className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                          Open Opportunities ({salesforce?.opportunities.length ?? 0})
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {(salesforce?.opportunities ?? []).length > 0 ? (
                          (salesforce?.opportunities ?? []).map((opp) => (
                            <div
                              key={opp.id}
                              className="p-3 bg-[#27272A]/50 rounded-lg"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="text-sm font-medium text-white leading-tight">
                                  {opp.name}
                                </div>
                                {opp.amount != null && (
                                  <span className="text-xs font-semibold text-[#FE5000] tabular-nums shrink-0">
                                    {fmt(opp.amount)}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 mt-1.5">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-400/10 text-blue-400 border border-blue-400/20">
                                  {opp.stage}
                                </span>
                                {opp.closeDate && (
                                  <span className="text-[10px] text-[#71717A]">
                                    Close {fmtDate(opp.closeDate)}
                                  </span>
                                )}
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#52525B]">No open opportunities</p>
                        )}
                      </div>
                    </div>

                    {/* Recent Activities */}
                    <div>
                      <div className="flex items-center gap-1.5 mb-2">
                        <Activity size={12} className="text-[#52525B]" />
                        <span className="text-[10px] font-semibold text-[#52525B] uppercase tracking-wider">
                          Recent Activities ({salesforce?.activities.length ?? 0})
                        </span>
                      </div>
                      <div className="space-y-2.5">
                        {(salesforce?.activities ?? []).length > 0 ? (
                          (salesforce?.activities ?? []).map((act) => (
                            <div
                              key={act.id}
                              className="flex items-start gap-2.5 p-3 bg-[#27272A]/50 rounded-lg"
                            >
                              <Clock size={12} className="text-[#52525B] mt-0.5 shrink-0" />
                              <div>
                                <div className="text-xs text-white">{act.subject}</div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  {act.type && (
                                    <span className="text-[10px] text-[#71717A]">{act.type}</span>
                                  )}
                                  {act.date && (
                                    <span className="text-[10px] text-[#52525B]">
                                      {fmtDate(act.date)}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-[#52525B]">No recent activities</p>
                        )}
                      </div>
                    </div>

                  </div>
                )}
              </SectionCard>

              {/* ── Section 6: Delivery Sites ─────────────────────── */}
              <SectionCard title="Delivery Sites" icon={MapPin} className="lg:col-span-2">
                {loading && sites.length === 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {[...Array(6)].map((_, i) => (
                      <SkeletonLine key={i} h="h-16" />
                    ))}
                  </div>
                ) : sites.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {sites.map((site) => (
                      <div
                        key={site.id || site.name}
                        className="p-3 bg-[#27272A]/50 rounded-lg hover:bg-[#27272A] transition-colors group"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-white truncate">{site.name}</div>
                            {(site.address || site.city) && (
                              <div className="text-[11px] text-[#71717A] mt-0.5 leading-relaxed">
                                {[site.address, site.city, site.state, site.zip]
                                  .filter(Boolean)
                                  .join(', ')}
                              </div>
                            )}
                          </div>
                          <ChevronRight
                            size={12}
                            className="text-[#3F3F46] group-hover:text-[#FE5000] shrink-0 mt-0.5 transition-colors"
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#52525B]">No delivery sites found</p>
                )}
              </SectionCard>

              {/* ── Health Factors (if available) ─────────────────── */}
              {health && (
                <SectionCard title="Health Factors" icon={Activity} className="lg:col-span-2">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {(Object.entries(health.factors) as [string, { score: number; detail: string }][]).map(
                      ([key, factor]) => (
                        <div key={key} className="space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] text-[#52525B] uppercase tracking-wider capitalize">
                              {key}
                            </span>
                            <span className="text-xs font-bold text-white tabular-nums">
                              {factor.score}
                            </span>
                          </div>
                          <div className="h-1.5 bg-[#27272A] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full bg-[#FE5000] transition-all"
                              style={{ width: `${Math.min(factor.score, 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-[#52525B] leading-relaxed">{factor.detail}</p>
                        </div>
                      )
                    )}
                  </div>
                </SectionCard>
              )}

            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default function Customer360Page() {
  return (
    <Suspense
      fallback={
        <div className="h-full flex items-center justify-center bg-[#09090B]">
          <div className="flex items-center gap-3 text-[#52525B]">
            <RefreshCw size={16} className="animate-spin" />
            <span className="text-sm">Loading...</span>
          </div>
        </div>
      }
    >
      <Customer360Inner />
    </Suspense>
  );
}
