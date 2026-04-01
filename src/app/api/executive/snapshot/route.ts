import { NextResponse } from 'next/server';
import {
  fetchRevenueByPeriod,
  fetchCOGSByPeriod,
  fetchCashPosition,
  fetchARAging,
} from '@/lib/engines/data-bridge';
import { generateFlashReport } from '@/lib/engines/financial-statements';
import { withCache } from '@/lib/api-cache';

export async function GET() {
  try {
    const year = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const period = `${year}-${String(month).padStart(2, '0')}`;

    const data = await withCache(`exec-snapshot:${period}`, async () => {
      const [revenueResult, cogsResult, cashResult, agingResult, flashResult] = await Promise.allSettled([
        fetchRevenueByPeriod(year),
        fetchCOGSByPeriod(year),
        fetchCashPosition(),
        fetchARAging(),
        generateFlashReport(period).catch(() => null),
      ]);

      const revenue = revenueResult.status === 'fulfilled' ? (revenueResult.value ?? []) : [];
      const cogs = cogsResult.status === 'fulfilled' ? (cogsResult.value ?? []) : [];
      const cash = cashResult.status === 'fulfilled' ? cashResult.value : { cashBalance: 0, locAvailable: 0, locBalance: 0, rackPrice: 0, rackProduct: 'Diesel Dyed' };
      const aging = agingResult.status === 'fulfilled' ? (agingResult.value ?? []) : [];
      const flash = flashResult.status === 'fulfilled' ? flashResult.value : null;

      const revenueYTD = revenue.reduce((s, r) => s + r.revenue, 0);
      const cogsYTD = cogs.reduce((s, r) => s + r.cogs, 0);
      const gpYTD = revenueYTD - cogsYTD;
      const arTotal = aging.reduce((s, r) => s + r.total, 0);
      const arPastDue = aging.reduce(
        (s, r) => s + r.past30 + r.past60 + r.past90 + r.past90Plus,
        0,
      );
      const arCurrent = aging.reduce((s, r) => s + r.current, 0);

      const monthlyRevenue = revenue.map((r) => ({
        month: r.period,
        revenue: r.revenue,
        cogs: cogs.find((c) => c.period === r.period)?.cogs ?? 0,
      }));

      const topAging = [...aging]
        .sort((a, b) => b.total - a.total)
        .slice(0, 10);

      return {
        period,
        kpis: {
          revenueYTD,
          cogsYTD,
          gpYTD,
          gpMarginPct: revenueYTD > 0 ? (gpYTD / revenueYTD) * 100 : 0,
          cashBalance: cash.cashBalance,
          locAvailable: cash.locAvailable,
          locBalance: cash.locBalance,
          rackPrice: cash.rackPrice,
          rackProduct: cash.rackProduct,
          arTotal,
          arPastDue,
          arCurrent,
          dso:
            arTotal > 0 && revenueYTD > 0
              ? Math.round((arTotal / (revenueYTD / (month * 30))) * 10) / 10
              : 0,
        },
        flash: flash
          ? {
              revenue: flash.revenue,
              cogs: flash.cogs,
              grossProfit: flash.grossProfit,
              grossMarginPct: flash.grossMarginPct,
              operatingExpenses: flash.operatingExpenses,
              operatingIncome: flash.operatingIncome,
              ebitda: flash.ebitda,
              netIncome: flash.netIncome,
              cashPosition: flash.cashPosition,
              priorYear: flash.priorYear ?? null,
            }
          : null,
        trends: { monthlyRevenue },
        arAging: {
          topCustomers: topAging,
          summary: { total: arTotal, pastDue: arPastDue, current: arCurrent },
        },
        dataFreshness: new Date().toISOString(),
      };
    }, 60_000);

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate snapshot',
      },
      { status: 500 },
    );
  }
}
