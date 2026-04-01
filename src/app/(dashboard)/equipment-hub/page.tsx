'use client';

import {
  Wrench,
  Database,
  Truck,
  ClipboardList,
  BarChart3,
  DollarSign,
  ExternalLink,
  CheckCircle2,
} from 'lucide-react';

const BASE_URL = 'https://equipment-tracker-tau.vercel.app';

interface KPICard {
  label: string;
  value: string;
  sub?: string;
}

const KPI_CARDS: KPICard[] = [
  { label: 'Total Equipment', value: '7,613', sub: 'All assets' },
  { label: 'Active', value: '6,842', sub: '89.9% utilization' },
  { label: 'In Maintenance', value: '412', sub: '5.4% of fleet' },
  { label: 'Rental Fleet', value: '359', sub: '4.7% of fleet' },
];

interface QuickLink {
  icon: React.ElementType;
  title: string;
  description: string;
  path: string;
}

const QUICK_LINKS: QuickLink[] = [
  {
    icon: Database,
    title: 'Equipment Inventory',
    description: 'Browse, search, and manage all 7,613 asset records',
    path: '/equipment',
  },
  {
    icon: Truck,
    title: 'Tank Records',
    description: 'Frac tanks, storage tanks, and portable units',
    path: '/equipment?tab=tanks',
  },
  {
    icon: ClipboardList,
    title: 'Dispatch',
    description: 'Active jobs, yard transfers, and driver assignments',
    path: '/dispatch',
  },
  {
    icon: Wrench,
    title: 'Maintenance & Tickets',
    description: 'Open work orders, PM schedules, and repair history',
    path: '/tickets',
  },
  {
    icon: BarChart3,
    title: 'Analytics & Reports',
    description: 'Utilization trends, fleet health, and cost analysis',
    path: '/analytics',
  },
  {
    icon: DollarSign,
    title: 'Billing & Rentals',
    description: 'Rental contracts, daily rates, and invoice generation',
    path: '/billing',
  },
];

interface RecentEvent {
  id: number;
  text: string;
  time: string;
}

const RECENT_EVENTS: RecentEvent[] = [
  { id: 1, text: 'Tank T-4421 delivered to ConocoPhillips — Permian Basin', time: '2h ago' },
  { id: 2, text: 'Equipment #EQ-7612 checked in at Midland yard', time: '4h ago' },
  { id: 3, text: 'PM ticket #MX-1103 closed — Unit EQ-3305 cleared for dispatch', time: '5h ago' },
  { id: 4, text: 'Rental contract RC-0882 renewed — 30-day extension approved', time: '8h ago' },
  { id: 5, text: 'Tank T-2987 flagged for inspection at Odessa yard', time: '11h ago' },
];

interface IntegrationStatus {
  label: string;
  status: 'connected' | 'degraded' | 'offline';
}

const INTEGRATIONS: IntegrationStatus[] = [
  { label: 'Supabase', status: 'connected' },
  { label: 'Samsara GPS', status: 'connected' },
  { label: 'Fleet Panda', status: 'connected' },
];

const STATUS_COLORS: Record<IntegrationStatus['status'], string> = {
  connected: '#22C55E',
  degraded: '#F59E0B',
  offline: '#EF4444',
};

export default function EquipmentHubPage() {
  function openApp(path: string = '') {
    window.open(BASE_URL + path, '_blank');
  }

  return (
    <div className="min-h-screen bg-[#0f0f11] text-[#FAFAFA] p-6 space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#FE5000]/10 border border-[#FE5000]/20 flex items-center justify-center">
            <Wrench className="w-5 h-5 text-[#FE5000]" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-[#FAFAFA]">Equipment Tracker</h1>
            <p className="text-xs text-[#71717A]">Asset management, maintenance, and rental operations</p>
          </div>
        </div>
        <button
          onClick={() => openApp()}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FE5000] hover:bg-[#e54800] text-white text-sm font-medium transition-colors"
        >
          Open Full App
          <ExternalLink className="w-4 h-4" />
        </button>
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

      {/* Quick Links Grid */}
      <div>
        <h2 className="text-sm font-medium text-[#A1A1AA] mb-3 uppercase tracking-wide">Quick Links</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((link) => {
            const Icon = link.icon;
            return (
              <button
                key={link.title}
                onClick={() => openApp(link.path)}
                className="group text-left rounded-xl bg-[#18181b] border border-[#27272a] p-4 hover:border-[#FE5000]/40 hover:bg-[#1f1f22] transition-all"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#27272a] flex items-center justify-center shrink-0 group-hover:bg-[#FE5000]/10 transition-colors">
                      <Icon className="w-4 h-4 text-[#A1A1AA] group-hover:text-[#FE5000] transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-[#FAFAFA] group-hover:text-[#FE5000] transition-colors">
                        {link.title}
                      </p>
                      <p className="text-xs text-[#71717A] mt-0.5 leading-relaxed">{link.description}</p>
                    </div>
                  </div>
                  <span className="text-xs text-[#52525B] group-hover:text-[#FE5000] transition-colors whitespace-nowrap mt-0.5">
                    Open →
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Bottom row: Recent Activity + Integration Status */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">

        {/* Recent Activity */}
        <div className="lg:col-span-2 rounded-xl bg-[#18181b] border border-[#27272a] p-5">
          <h2 className="text-sm font-medium text-[#A1A1AA] mb-4 uppercase tracking-wide">Recent Activity</h2>
          <ul className="space-y-3">
            {RECENT_EVENTS.map((event) => (
              <li key={event.id} className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-2">
                  <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#FE5000] shrink-0" />
                  <span className="text-sm text-[#D4D4D8]">{event.text}</span>
                </div>
                <span className="text-xs text-[#52525B] whitespace-nowrap">{event.time}</span>
              </li>
            ))}
          </ul>
          <p className="mt-4 text-xs text-[#3F3F46] italic">
            Placeholder data — live feed from Supabase in next iteration.
          </p>
        </div>

        {/* Integration Status */}
        <div className="rounded-xl bg-[#18181b] border border-[#27272a] p-5">
          <h2 className="text-sm font-medium text-[#A1A1AA] mb-4 uppercase tracking-wide">Integration Status</h2>
          <ul className="space-y-3">
            {INTEGRATIONS.map((item) => (
              <li key={item.label} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4" style={{ color: STATUS_COLORS[item.status] }} />
                  <span className="text-sm text-[#D4D4D8]">{item.label}</span>
                </div>
                <span
                  className="text-xs font-medium capitalize"
                  style={{ color: STATUS_COLORS[item.status] }}
                >
                  {item.status}
                </span>
              </li>
            ))}
          </ul>
        </div>

      </div>
    </div>
  );
}
