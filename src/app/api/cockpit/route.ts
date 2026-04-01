/**
 * GET /api/cockpit — Aggregated cockpit data (KPIs, cash position, rack price)
 *
 * Pulls live data from the Ascend data bridge:
 *   - Revenue YTD, COGS YTD, Gross Profit YTD
 *   - AR Outstanding (sum of aging totals)
 *   - Cash balance, LOC available, borrowing base utilization
 *   - Latest rack price
 */

import { NextResponse } from 'next/server';
import {
  fetchRevenueByPeriod,
  fetchCOGSByPeriod,
  fetchCashPosition,
  fetchARAging,
} from '@/lib/engines/data-bridge';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    const data = await withCache('cockpit', async () => {
      const year = new Date().getFullYear();

      const [revenue, cogs, cash, aging] = await Promise.allSettled([
        fetchRevenueByPeriod(year),
        fetchCOGSByPeriod(year),
        fetchCashPosition(),
        fetchARAging(),
      ]);

      const revenueData = revenue.status === 'fulfilled' ? (revenue.value ?? []) : [];
      const cogsData = cogs.status === 'fulfilled' ? (cogs.value ?? []) : [];
      const cashData = cash.status === 'fulfilled' ? cash.value : { cashBalance: 0, locAvailable: 0, locBalance: 0, rackPrice: 0, rackProduct: 'Diesel Dyed' };
      const agingData = aging.status === 'fulfilled' ? (aging.value ?? []) : [];

      const revenueYTD = revenueData.reduce((s, r) => s + r.revenue, 0);
      const cogsYTD = cogsData.reduce((s, r) => s + r.cogs, 0);
      const grossProfitYTD = revenueYTD - cogsYTD;
      const arOutstanding = agingData.reduce((s, r) => s + r.total, 0);

      return {
        kpis: { revenueYTD, cogsYTD, grossProfitYTD, arOutstanding },
        cash: {
          currentCash: cashData.cashBalance,
          locAvailable: cashData.locAvailable,
          borrowingBaseUtil:
            cashData.locBalance > 0
              ? Math.min(Math.round((cashData.locBalance / 15_000_000) * 100), 999)
              : 0,
        },
        rackPrice: { product: cashData.rackProduct, price: cashData.rackPrice },
      };
    }, 60_000);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to fetch cockpit data',
      },
      { status: 500 },
    );
  }
}
