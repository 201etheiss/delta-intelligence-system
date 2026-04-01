'use client';

import {
  Globe,
  ExternalLink,
  ShoppingCart,
  Package,
  Truck,
  FileText,
  CreditCard,
  LayoutDashboard,
  Server,
  GitBranch,
  KeyRound,
} from 'lucide-react';

const ACCENT = '#FE5000';

interface KPICard {
  label: string;
  value: string;
  sub?: string;
}

const KPI_CARDS: KPICard[] = [
  { label: 'Portal Pages Built', value: '32', sub: '20 portal + 9 admin + 3 other' },
  { label: 'API Routes', value: '32', sub: '14 live gateway + 18 mock/portal' },
  { label: 'UI Components', value: '58', sub: '20 domain directories' },
  { label: 'DB Migrations', value: '8', sub: 'Supabase + packages/db' },
];

type FeatureStatus = 'built' | 'in-progress' | 'planned';

interface Feature {
  icon: React.ElementType;
  title: string;
  description: string;
  status: FeatureStatus;
}

const FEATURES: Feature[] = [
  {
    icon: LayoutDashboard,
    title: 'Customer Dashboard',
    description: '/dashboard — stat cards, quick actions, recent orders, insights preview',
    status: 'built',
  },
  {
    icon: Package,
    title: 'Product Catalog',
    description: '/products — searchable/filterable catalog with category grid, product detail pages',
    status: 'built',
  },
  {
    icon: ShoppingCart,
    title: 'Cart & Checkout',
    description: '/cart + /checkout — cart state via Zustand, tax breakdown, payment method selector',
    status: 'built',
  },
  {
    icon: FileText,
    title: 'Orders',
    description: '/orders — order list with tab filters, detail page, create page, recurring orders',
    status: 'built',
  },
  {
    icon: FileText,
    title: 'Invoices',
    description: '/invoices — aging summary, tab filters (unpaid/paid/overdue), invoice detail + pay page',
    status: 'built',
  },
  {
    icon: Truck,
    title: 'Delivery Tracking',
    description: '/tracking — active deliveries, mock map, tank gauges, asset pages; Samsara not yet wired',
    status: 'in-progress',
  },
  {
    icon: CreditCard,
    title: 'Insights & Analytics',
    description: '/insights — price charts (Recharts), spend pie/bar, budget cards, recommendations; data is mock',
    status: 'in-progress',
  },
  {
    icon: Package,
    title: 'Tank Leasing',
    description: '/leasing — tank catalog cards, lease-vs-buy feature list; configure page built',
    status: 'in-progress',
  },
  {
    icon: KeyRound,
    title: 'Account & KYC',
    description: '/account — profile page, contracts list with signature timeline, KYC onboarding form',
    status: 'built',
  },
  {
    icon: FileText,
    title: 'Quotes',
    description: '/quotes — quote builder with line items, customer search, quote detail page',
    status: 'built',
  },
  {
    icon: GitBranch,
    title: 'Notifications',
    description: '/notifications — notification card list; no push subscription wired yet',
    status: 'in-progress',
  },
  {
    icon: LayoutDashboard,
    title: 'Admin Panel',
    description: '/admin — dashboard, customers (list + detail), orders, invoices, pricing, products, reports',
    status: 'built',
  },
  {
    icon: Server,
    title: 'Live Gateway API Routes',
    description: '14 /api/live/* routes hitting DI gateway at :3847 — revenue, customers, pricing, CRM, tanks, AR',
    status: 'built',
  },
  {
    icon: CreditCard,
    title: 'Payment Processing',
    description: 'ACH form, card form, payment method selector components built; Stripe not wired',
    status: 'in-progress',
  },
];

const STATUS_CONFIG: Record<FeatureStatus, { label: string; color: string; bg: string }> = {
  built: { label: 'Built', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' },
  'in-progress': { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  planned: { label: 'Planned', color: '#71717A', bg: 'rgba(113,113,122,0.1)' },
};

interface ArchNote {
  icon: React.ElementType;
  text: string;
}

const ARCH_NOTES: ArchNote[] = [
  { icon: Server, text: 'Turborepo monorepo: apps/web + packages/shared + packages/ui + packages/db' },
  { icon: GitBranch, text: '14 live API routes proxy to DI gateway (:3847) with mock fallback' },
  { icon: KeyRound, text: 'Next.js 14 App Router — (portal), (admin), (auth) route groups' },
  { icon: LayoutDashboard, text: 'State: Zustand (cart/auth) + TanStack Query + Supabase Realtime (planned)' },
  { icon: Package, text: 'All pricing stored as cents integers; Zod validation on all API inputs' },
  { icon: CreditCard, text: 'Supabase (auth/db/storage) + Stripe (ACH/card) + Samsara (tracking) — integrations scaffolded' },
];

export default function PortalHubPage() {
  return (
    <div className="min-h-screen bg-[#0f0f11] text-[#FAFAFA] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}33` }}
          >
            <Globe className="w-5 h-5" style={{ color: ACCENT }} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-[#FAFAFA]">Delta Portal — Customer Platform</h1>
              <span
                className="px-2 py-0.5 rounded text-xs font-semibold"
                style={{ color: '#F59E0B', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.25)' }}
              >
                IN DEVELOPMENT
              </span>
            </div>
            <p className="text-xs text-[#71717A]">Consumer-facing app for Delta360 customers — orders, catalog, tracking, invoices</p>
          </div>
        </div>
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm font-medium transition-colors shrink-0"
          style={{ background: ACCENT }}
          onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.background = '#e54800'; }}
          onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.background = ACCENT; }}
        >
          Open Portal
          <ExternalLink className="w-4 h-4" />
        </a>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {KPI_CARDS.map((card) => (
          <div
            key={card.label}
            className="rounded-xl bg-[#18181b] border border-[#27272a] px-5 py-4"
          >
            <p className="text-xs text-[#71717A] mb-1">{card.label}</p>
            <p className="text-2xl font-bold text-[#FAFAFA]">{card.value}</p>
            {card.sub && <p className="text-xs text-[#52525B] mt-1">{card.sub}</p>}
          </div>
        ))}
      </div>

      {/* Feature Status Grid */}
      <div>
        <h2 className="text-sm font-medium text-[#A1A1AA] mb-3 uppercase tracking-wide">Feature Status</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => {
            const Icon = feature.icon;
            const badge = STATUS_CONFIG[feature.status];
            return (
              <div
                key={feature.title}
                className="rounded-xl bg-[#18181b] border border-[#27272a] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#27272a] flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-[#A1A1AA]" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#FAFAFA]">{feature.title}</p>
                      <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed">{feature.description}</p>
                    </div>
                  </div>
                  <span
                    className="px-2 py-0.5 rounded text-xs font-medium whitespace-nowrap mt-0.5"
                    style={{ color: badge.color, background: badge.bg }}
                  >
                    {badge.label}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Architecture Notes */}
      <div className="rounded-xl bg-[#18181b] border border-[#27272a] p-5">
        <h2 className="text-sm font-medium text-[#A1A1AA] mb-4 uppercase tracking-wide">Architecture Notes</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {ARCH_NOTES.map((note) => {
            const Icon = note.icon;
            return (
              <div key={note.text} className="flex items-center gap-3">
                <div
                  className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                  style={{ background: `${ACCENT}1A`, border: `1px solid ${ACCENT}22` }}
                >
                  <Icon className="w-4 h-4" style={{ color: ACCENT }} />
                </div>
                <p className="text-sm text-[#D4D4D8]">{note.text}</p>
              </div>
            );
          })}
        </div>
      </div>

    </div>
  );
}
