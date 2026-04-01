'use client';

import { useState, useEffect } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  ExternalLink,
  AlertCircle,
  BarChart3,
  Fuel,
  Flame,
  Zap,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ────────────────────────────────────────────────────

interface KpiCard {
  label: string;
  value: string;
  change: string;
  direction: 'up' | 'down' | 'flat';
  icon: typeof TrendingUp;
}

type FeedStatus = 'connected' | 'degraded' | 'offline';

interface FeedIndicator {
  name: string;
  status: FeedStatus;
}

interface DashboardResponse {
  success: boolean;
  kpis?: {
    customerCount: number;
    pipelineTotal: number;
    vehicleCount: number;
    arTotal: number;
    revenueYTD: number;
    grossProfitYTD: number;
    openOpportunities: number;
    activeDrivers: number;
  };
  rackPrice?: {
    product: string;
    price: number;
    date: string;
  } | null;
  fetchedAt?: string;
  error?: string;
}

function formatCurrency(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${n.toFixed(2)}`;
}

// ── Placeholder Data (fallback) ──────────────────────────────

const FALLBACK_KPI_CARDS: KpiCard[] = [
  { label: 'Diesel Rack Price', value: '$2.847', change: '+0.023', direction: 'up', icon: Fuel },
  { label: 'WTI Crude', value: '$78.42', change: '-1.15', direction: 'down', icon: Flame },
  { label: 'Natural Gas', value: '$3.21', change: '+0.08', direction: 'up', icon: Zap },
  { label: 'S&P 500', value: '5,234.18', change: '+12.44', direction: 'up', icon: BarChart3 },
];

const FEEDS: FeedIndicator[] = [
  { name: 'Yahoo Finance', status: 'offline' },
  { name: 'FRED', status: 'offline' },
  { name: 'Finnhub', status: 'offline' },
  { name: 'CoinGecko', status: 'offline' },
  { name: 'DeFi Llama', status: 'offline' },
  { name: 'CFTC', status: 'offline' },
  { name: 'Treasury', status: 'offline' },
];

const STATUS_COLORS: Record<FeedStatus, string> = {
  connected: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  offline: 'bg-zinc-600',
};

const STATUS_LABELS: Record<FeedStatus, string> = {
  connected: 'Connected',
  degraded: 'Degraded',
  offline: 'Offline',
};

// ── Components ───────────────────────────────────────────────

function KpiCardComponent({ card }: { card: KpiCard }) {
  const Icon = card.icon;
  const isUp = card.direction === 'up';
  const ChangeIcon = isUp ? TrendingUp : TrendingDown;
  const changeColor = isUp ? 'text-emerald-400' : 'text-red-400';

  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-[#71717A] font-medium uppercase tracking-wide">
          {card.label}
        </span>
        <Icon size={16} className="text-[#A1A1AA]" />
      </div>
      <div className="text-lg font-bold text-[#09090B] dark:text-white tabular-nums">{card.value}</div>
      <div className={`flex items-center gap-1 mt-0.5 text-xs ${changeColor}`}>
        <ChangeIcon size={12} />
        <span>{card.change}</span>
      </div>
    </div>
  );
}

function FeedStatusRow({ feed }: { feed: FeedIndicator }) {
  return (
    <div className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-[#27272A]/50 transition-colors">
      <span className="text-sm text-zinc-300">{feed.name}</span>
      <div className="flex items-center gap-2">
        <span className="text-xs text-zinc-500">{STATUS_LABELS[feed.status]}</span>
        <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[feed.status]}`} />
      </div>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function MarketIntelligencePage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpiCards, setKpiCards] = useState<KpiCard[]>(FALLBACK_KPI_CARDS);
  const [rackPrice, setRackPrice] = useState<{ product: string; price: number; date: string } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [commodities] = useState([
    { name: 'ULSD', price: '$2.847/gal', change: '+0.8%' },
    { name: 'Gasoline RBOB', price: '$2.412/gal', change: '-0.3%' },
    { name: 'Brent Crude', price: '$82.15/bbl', change: '-1.2%' },
    { name: 'WTI Crude', price: '$78.42/bbl', change: '-1.5%' },
    { name: 'Henry Hub NG', price: '$3.21/MMBtu', change: '+2.5%' },
    { name: 'Propane', price: '$0.847/gal', change: '+0.4%' },
  ]);

  useEffect(() => {
    let cancelled = false;
    async function fetchMarketData() {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/dashboard');
        const data: DashboardResponse = await res.json();
        if (cancelled) return;

        if (!res.ok || !data.success) {
          setError(data.error ?? 'Failed to fetch market data');
          setLoading(false);
          return;
        }

        const kpis = data.kpis;
        if (kpis) {
          const cards: KpiCard[] = [
            {
              label: 'Revenue YTD',
              value: formatCurrency(kpis.revenueYTD),
              change: formatCurrency(kpis.grossProfitYTD) + ' GP',
              direction: kpis.grossProfitYTD > 0 ? 'up' : 'down',
              icon: BarChart3,
            },
            {
              label: 'AR Outstanding',
              value: formatCurrency(kpis.arTotal),
              change: `${typeof kpis.customerCount === 'number' ? kpis.customerCount : 0} customers`,
              direction: 'flat',
              icon: Fuel,
            },
            {
              label: 'Pipeline',
              value: formatCurrency(kpis.pipelineTotal),
              change: `${typeof kpis.openOpportunities === 'number' ? kpis.openOpportunities : 0} open`,
              direction: kpis.pipelineTotal > 0 ? 'up' : 'flat',
              icon: Flame,
            },
            {
              label: 'Fleet',
              value: `${typeof kpis.vehicleCount === 'number' ? kpis.vehicleCount : 0} vehicles`,
              change: `${typeof kpis.activeDrivers === 'number' ? kpis.activeDrivers : 0} active drivers`,
              direction: 'flat',
              icon: Zap,
            },
          ];
          setKpiCards(cards);
        }

        if (data.rackPrice) {
          setRackPrice(data.rackPrice);
        }
        if (data.fetchedAt) {
          setFetchedAt(data.fetchedAt);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Network error');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    fetchMarketData();
    return () => { cancelled = true; };
  }, []);

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B] text-zinc-800 dark:text-zinc-100">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-semibold text-[#09090B] dark:text-white">Market Intelligence</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            {fetchedAt
              ? `Last updated ${new Date(fetchedAt).toLocaleTimeString()}`
              : 'Powered by Rift Market Engine'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href="http://localhost:3000"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-[#FE5000] hover:text-[#FF7A33] transition-colors border border-[#FE5000]/30 rounded-md px-3 py-1.5"
          >
            Open Rift Terminal
            <ExternalLink size={12} />
          </a>
        </div>
      </div>

      <AIInsightsBanner module="market" compact />

      {/* Error banner */}
      {error && (
        <div className="mb-2.5 rounded-md border border-red-800 bg-red-950/40 px-3 py-2 text-sm text-red-400 flex items-center gap-2">
          <AlertCircle size={14} />
          {error}
        </div>
      )}

      {/* Rack Price banner */}
      {rackPrice && typeof rackPrice.price === 'number' && rackPrice.price > 0 && (
        <div className="mb-2.5 rounded-lg border border-[#FE5000]/20 bg-[#FE5000]/5 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Fuel size={14} className="text-[#FE5000]" />
            <span className="text-sm text-zinc-300">{rackPrice.product}</span>
          </div>
          <span className="text-sm font-bold text-white tabular-nums">
            ${rackPrice.price.toFixed(4)}/gal
          </span>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 animate-pulse">
              <div className="h-3 w-24 bg-[#27272A] rounded mb-2" />
              <div className="h-7 w-20 bg-[#27272A] rounded mb-1" />
              <div className="h-3 w-16 bg-[#27272A] rounded" />
            </div>
          ))
        ) : (
          kpiCards.map((card) => (
            <KpiCardComponent key={card.label} card={card} />
          ))
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        {/* Commodity Prices */}
        <div className="lg:col-span-2 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5">
          <h2 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2.5">Commodity Prices</h2>
          <div className="space-y-1">
            {commodities.map((c) => (
              <div
                key={c.name}
                className="flex items-center justify-between py-2.5 px-3 rounded-md hover:bg-[#27272A]/50 transition-colors"
              >
                <span className="text-sm text-zinc-300">{c.name}</span>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-[#09090B] dark:text-white tabular-nums">
                    {c.price}
                  </span>
                  <span
                    className={`text-xs tabular-nums ${
                      c.change.startsWith('+') ? 'text-emerald-400' : 'text-red-400'
                    }`}
                  >
                    {c.change}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Feed Status */}
        <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5">
          <h2 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2.5">Feed Status</h2>
          <div className="space-y-1">
            {FEEDS.map((feed) => (
              <FeedStatusRow key={feed.name} feed={feed} />
            ))}
          </div>
          <div className="mt-4 pt-3 border-t border-[#27272A]">
            <div className="flex items-center gap-2 text-xs text-zinc-500">
              <AlertCircle size={12} />
              <span>Feeds disconnected. Connect Rift Market Engine for live data.</span>
            </div>
          </div>
        </div>
      </div>

      {/* Price Trend Placeholder */}
      <div className="mt-6 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3.5">
        <h2 className="text-xs font-semibold text-[#09090B] dark:text-white mb-2.5">Price Trends</h2>
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <Activity size={32} className="text-zinc-700 mb-2" />
          <p className="text-sm text-zinc-500">
            Connect Rift Market Engine for live feeds
          </p>
          <p className="text-xs text-zinc-600 mt-0.5">
            28+ data feeds including Yahoo Finance, FRED, Finnhub, CoinGecko, and more
          </p>
        </div>
      </div>

      {/* Quick Links */}
      <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 hover:border-[#FE5000]/40 transition-colors group"
        >
          <ExternalLink size={16} className="text-zinc-600 group-hover:text-[#FE5000] transition-colors" />
          <div>
            <div className="text-sm font-medium text-[#09090B] dark:text-white">Open Rift Terminal</div>
            <div className="text-xs text-zinc-500">Full Bloomberg-style terminal</div>
          </div>
        </a>
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 hover:border-[#FE5000]/40 transition-colors group"
        >
          <Activity size={16} className="text-zinc-600 group-hover:text-[#FE5000] transition-colors" />
          <div>
            <div className="text-sm font-medium text-[#09090B] dark:text-white">View Feed Health</div>
            <div className="text-xs text-zinc-500">53 feeds, 44 active</div>
          </div>
        </a>
        <a
          href="http://localhost:3000"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-4 hover:border-[#FE5000]/40 transition-colors group"
        >
          <AlertCircle size={16} className="text-zinc-600 group-hover:text-[#FE5000] transition-colors" />
          <div>
            <div className="text-sm font-medium text-[#09090B] dark:text-white">Market Alerts</div>
            <div className="text-xs text-zinc-500">Price alerts and notifications</div>
          </div>
        </a>
      </div>
    </div>
  );
}
