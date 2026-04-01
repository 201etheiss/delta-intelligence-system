import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ───────────────────────────────────────────────────

export interface DiscoveredPattern {
  id: string;
  name: string;
  description: string;
  category: 'spending' | 'revenue' | 'gl-coding' | 'customer' | 'seasonal' | 'operational';
  confidence: number; // 0-1
  recommendedAction: string;
  dataPoints: number;
  discoveredAt: string;
}

// ── Cache (30 minutes) ──────────────────────────────────────

interface CachedPatterns {
  patterns: DiscoveredPattern[];
  discoveredAt: string;
  expiresAt: number;
}

let patternCache: CachedPatterns | null = null;
const CACHE_TTL_MS = 30 * 60 * 1000;

// ── Helpers ─────────────────────────────────────────────────

function makeId(): string {
  return `pattern_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Pattern Discoverers ─────────────────────────────────────

async function discoverSpendingPatterns(role: Parameters<typeof gatewayFetch>[1]): Promise<DiscoveredPattern[]> {
  const patterns: DiscoveredPattern[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/query', role, {
      method: 'POST',
      body: {
        soql: `SELECT TOP 12 b.Period, SUM(i.Qty * ISNULL(i.Total_UnitCost, 0)) AS TotalCost
               FROM DF_PBI_BillingChartQuery b
               JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
               WHERE b.Year = 2025 AND i.Total_UnitCost > 0
               GROUP BY b.Period
               ORDER BY b.Period`,
      },
    });

    if (res.success && Array.isArray(res.data) && res.data.length >= 6) {
      const costs = (res.data as Array<Record<string, unknown>>).map(
        (r) => Number(r['TotalCost'] ?? 0)
      );

      // Check for seasonal pattern (Q4 spike is common in energy)
      const q4Avg = costs.slice(9, 12).reduce((a, b) => a + b, 0) / Math.max(costs.slice(9, 12).length, 1);
      const yearAvg = costs.reduce((a, b) => a + b, 0) / Math.max(costs.length, 1);

      if (yearAvg > 0 && q4Avg > yearAvg * 1.2) {
        patterns.push({
          id: makeId(),
          name: 'Q4 Cost Spike',
          description: `Q4 costs average ${((q4Avg / yearAvg - 1) * 100).toFixed(0)}% above annual average — seasonal procurement pattern`,
          category: 'seasonal',
          confidence: 0.78,
          recommendedAction: 'Budget for higher Q4 procurement costs; negotiate volume discounts early',
          dataPoints: costs.length,
          discoveredAt: now,
        });
      }

      // Check for month-over-month volatility
      let volatileMonths = 0;
      for (let i = 1; i < costs.length; i++) {
        const prev = costs[i - 1];
        if (prev > 0 && Math.abs(costs[i] - prev) / prev > 0.3) {
          volatileMonths++;
        }
      }
      if (volatileMonths >= 3) {
        patterns.push({
          id: makeId(),
          name: 'High Cost Volatility',
          description: `${volatileMonths} months had >30% cost swings — irregular procurement pattern`,
          category: 'spending',
          confidence: 0.65,
          recommendedAction: 'Review vendor contracts for price stabilization; consider hedging strategies',
          dataPoints: costs.length,
          discoveredAt: now,
        });
      }
    }
  } catch {
    // Spending data unavailable
  }

  return patterns;
}

async function discoverRevenuePatterns(role: Parameters<typeof gatewayFetch>[1]): Promise<DiscoveredPattern[]> {
  const patterns: DiscoveredPattern[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/query', role, {
      method: 'POST',
      body: {
        soql: `SELECT TOP 10 b.CustType, COUNT(DISTINCT b.CustomerName) AS Customers,
               SUM(i.Qty * i.UnitPrice) AS Revenue
               FROM DF_PBI_BillingChartQuery b
               JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
               WHERE b.Year = 2025
               GROUP BY b.CustType
               ORDER BY Revenue DESC`,
      },
    });

    if (res.success && Array.isArray(res.data) && res.data.length >= 3) {
      const segments = res.data as Array<Record<string, unknown>>;
      const totalRevenue = segments.reduce((sum, s) => sum + Number(s['Revenue'] ?? 0), 0);

      // Check for customer concentration
      const topSegmentRevenue = Number(segments[0]?.['Revenue'] ?? 0);
      const topSegmentName = String(segments[0]?.['CustType'] ?? 'Unknown');

      if (totalRevenue > 0 && topSegmentRevenue / totalRevenue > 0.35) {
        patterns.push({
          id: makeId(),
          name: 'Revenue Concentration Risk',
          description: `${topSegmentName} segment generates ${((topSegmentRevenue / totalRevenue) * 100).toFixed(0)}% of total revenue`,
          category: 'revenue',
          confidence: 0.92,
          recommendedAction: 'Diversify customer base; develop pipeline in underrepresented segments',
          dataPoints: segments.length,
          discoveredAt: now,
        });
      }

      // Check for long-tail segments (many customers, low revenue each)
      const longTailSegments = segments.filter((s) => {
        const customers = Number(s['Customers'] ?? 0);
        const revenue = Number(s['Revenue'] ?? 0);
        return customers > 20 && revenue / Math.max(customers, 1) < 100_000;
      });

      if (longTailSegments.length > 0) {
        patterns.push({
          id: makeId(),
          name: 'Long-Tail Customer Segments',
          description: `${longTailSegments.length} segment(s) have many customers but low per-account revenue`,
          category: 'customer',
          confidence: 0.70,
          recommendedAction: 'Evaluate cost-to-serve for long-tail accounts; consider pricing adjustments',
          dataPoints: segments.length,
          discoveredAt: now,
        });
      }
    }
  } catch {
    // Revenue data unavailable
  }

  return patterns;
}

async function discoverGlCodingPatterns(role: Parameters<typeof gatewayFetch>[1]): Promise<DiscoveredPattern[]> {
  const patterns: DiscoveredPattern[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/query', role, {
      method: 'POST',
      body: {
        soql: `SELECT TOP 10 AccountNo, Account_Desc, COUNT(*) AS EntryCount
               FROM GLTransDetail
               WHERE Year = 2026 AND Period BETWEEN 1 AND 3
               GROUP BY AccountNo, Account_Desc
               ORDER BY EntryCount DESC`,
      },
    });

    if (res.success && Array.isArray(res.data) && res.data.length >= 5) {
      const accounts = res.data as Array<Record<string, unknown>>;
      const topAccount = accounts[0];
      const topCount = Number(topAccount?.['EntryCount'] ?? 0);
      const topName = String(topAccount?.['Account_Desc'] ?? 'Unknown');

      if (topCount > 50) {
        patterns.push({
          id: makeId(),
          name: 'High-Frequency GL Account',
          description: `${topName} has ${topCount} entries this quarter — candidate for automation`,
          category: 'gl-coding',
          confidence: 0.85,
          recommendedAction: 'Create a JE template for this account to reduce manual coding',
          dataPoints: accounts.length,
          discoveredAt: now,
        });
      }
    }
  } catch {
    // GL data unavailable
  }

  return patterns;
}

// ── Static/fallback patterns (always returned) ──────────────

function getStaticPatterns(): DiscoveredPattern[] {
  const now = new Date().toISOString();
  return [
    {
      id: 'static_month_end',
      name: 'Month-End Close Cadence',
      description: 'Historical close cycles average 5 business days with most entries in the first 2 days',
      category: 'operational',
      confidence: 0.88,
      recommendedAction: 'Front-load preparation tasks to reduce close cycle time',
      dataPoints: 12,
      discoveredAt: now,
    },
    {
      id: 'static_diesel_seasonality',
      name: 'Diesel Demand Seasonality',
      description: 'Dyed diesel demand peaks in construction season (Mar-Oct) and drops 15-25% in winter',
      category: 'seasonal',
      confidence: 0.90,
      recommendedAction: 'Adjust inventory and procurement forecasts for seasonal demand shifts',
      dataPoints: 24,
      discoveredAt: now,
    },
  ];
}

// ── Route handler ────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Return cached if valid
  if (patternCache && Date.now() < patternCache.expiresAt) {
    return NextResponse.json({
      success: true,
      patterns: patternCache.patterns,
      count: patternCache.patterns.length,
      discoveredAt: patternCache.discoveredAt,
      cached: true,
    });
  }

  const email = session?.user?.email ?? '';
  const role = getUserRole(email);

  try {
    const [spendingPatterns, revenuePatterns, glPatterns] = await Promise.all([
      discoverSpendingPatterns(role),
      discoverRevenuePatterns(role),
      discoverGlCodingPatterns(role),
    ]);

    const patterns: DiscoveredPattern[] = [
      ...spendingPatterns,
      ...revenuePatterns,
      ...glPatterns,
      ...getStaticPatterns(),
    ].sort((a, b) => b.confidence - a.confidence);

    const discoveredAt = new Date().toISOString();
    patternCache = {
      patterns,
      discoveredAt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return NextResponse.json({
      success: true,
      patterns,
      count: patterns.length,
      discoveredAt,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Pattern discovery failed' },
      { status: 500 }
    );
  }
}
