/**
 * Intelligence Brief Generator
 *
 * Pulls KPIs from the data bridge and assembles a structured brief
 * for executive consumption (daily / weekly / flash).
 */

import {
  fetchRevenueByPeriod,
  fetchCOGSByPeriod,
  fetchCashPosition,
  fetchARAging,
} from '@/lib/engines/data-bridge';

// ── Helpers ──────────────────────────────────────────────────

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

function fmt(n: number): string {
  if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
  if (Math.abs(n) >= 1e3) return `$${(n / 1e3).toFixed(0)}K`;
  return `$${n.toFixed(0)}`;
}

// ── Types ────────────────────────────────────────────────────

export interface BriefSection {
  title: string;
  content: string;
  severity?: 'info' | 'warning' | 'critical';
  metrics?: { label: string; value: string; change?: string }[];
}

export interface IntelligenceBrief {
  id: string;
  type: 'daily' | 'weekly' | 'flash';
  period: string;
  generatedAt: string;
  sections: BriefSection[];
  summary: string;
}

// ── Generator ────────────────────────────────────────────────

export async function generateBrief(
  type: 'daily' | 'weekly' | 'flash' = 'daily',
): Promise<IntelligenceBrief> {
  const year = new Date().getFullYear();
  const month = new Date().getMonth() + 1;
  const period = `${year}-${String(month).padStart(2, '0')}`;

  const [revenue, cogs, cash, aging] = await Promise.all([
    fetchRevenueByPeriod(year).catch(() => []),
    fetchCOGSByPeriod(year).catch(() => []),
    fetchCashPosition().catch(() => ({
      cashBalance: 0,
      locBalance: 0,
      locAvailable: 0,
      rackPrice: 0,
      rackProduct: 'N/A',
    })),
    fetchARAging().catch(() => []),
  ]);

  const revenueYTD = (revenue ?? []).reduce(
    (s, r) => s + safeNumber(r.revenue),
    0,
  );
  const cogsYTD = (cogs ?? []).reduce((s, r) => s + safeNumber(r.cogs), 0);
  const gpYTD = revenueYTD - cogsYTD;
  const gpMargin = revenueYTD > 0 ? (gpYTD / revenueYTD) * 100 : 0;
  const arTotal = (aging ?? []).reduce((s, r) => s + safeNumber(r.total), 0);
  const arPastDue = (aging ?? []).reduce(
    (s, r) =>
      s +
      safeNumber(r.past30) +
      safeNumber(r.past60) +
      safeNumber(r.past90) +
      safeNumber(r.past90Plus),
    0,
  );

  const sections: BriefSection[] = [
    {
      title: 'Executive Summary',
      content: `Delta360 YTD revenue is ${fmt(revenueYTD)} with gross profit of ${fmt(gpYTD)} (${gpMargin.toFixed(1)}% margin). Cash position stands at ${fmt(cash.cashBalance)} with ${fmt(Math.max(0, cash.locAvailable))} available on the line of credit. Current rack price for ${cash.rackProduct} is $${typeof cash.rackPrice === 'number' ? cash.rackPrice.toFixed(4) : '0.0000'}/gal.`,
      severity: gpMargin < 10 ? 'warning' : 'info',
      metrics: [
        { label: 'Revenue YTD', value: fmt(revenueYTD) },
        { label: 'Gross Profit', value: fmt(gpYTD) },
        { label: 'GP Margin', value: `${gpMargin.toFixed(1)}%` },
        { label: 'Cash Position', value: fmt(cash.cashBalance) },
      ],
    },
    {
      title: 'AR & Collections',
      content: `Total AR outstanding: ${fmt(arTotal)}. Past due: ${fmt(arPastDue)} (${arTotal > 0 ? ((arPastDue / arTotal) * 100).toFixed(0) : '0'}% of total).`,
      severity: arPastDue > arTotal * 0.3 ? 'warning' : 'info',
      metrics: [
        { label: 'AR Total', value: fmt(arTotal) },
        { label: 'Past Due', value: fmt(arPastDue) },
        {
          label: 'Past Due %',
          value:
            arTotal > 0
              ? `${((arPastDue / arTotal) * 100).toFixed(0)}%`
              : '0%',
        },
      ],
    },
    {
      title: 'Cash & Liquidity',
      content: `Bank balance: ${fmt(cash.cashBalance)}. LOC drawn: ${fmt(cash.locBalance)}. LOC available: ${fmt(Math.max(0, cash.locAvailable))}. Rack price: $${typeof cash.rackPrice === 'number' ? cash.rackPrice.toFixed(4) : '0.0000'}/gal.`,
      severity: cash.locAvailable < 0 ? 'critical' : 'info',
    },
    {
      title: 'Revenue Trend',
      content: `Monthly revenue trend shows ${(revenue ?? []).length} periods tracked. ${(revenue ?? []).length >= 2 ? `Latest month: ${fmt(safeNumber(revenue[revenue.length - 1]?.revenue))}.` : ''}`,
      severity: 'info',
    },
  ];

  return {
    id: `brief-${Date.now()}`,
    type,
    period,
    generatedAt: new Date().toISOString(),
    sections,
    summary: sections[0].content,
  };
}
