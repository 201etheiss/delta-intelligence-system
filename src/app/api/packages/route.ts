import { NextResponse } from 'next/server';
import {
  generateBalanceSheet,
  generateIncomeStatement,
  generateTrialBalance,
  generateFlashReport,
} from '@/lib/engines/financial-statements';

interface IntegrityIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

export async function GET() {
  return NextResponse.json({ success: true, data: { packages: [] } });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const period = body.period as string;
    if (!period || !/^\d{4}-\d{2}$/.test(period)) {
      return NextResponse.json(
        { success: false, error: 'period required (YYYY-MM)' },
        { status: 400 },
      );
    }

    const [bs, is, tb, flash] = await Promise.all([
      generateBalanceSheet(period).catch(() => null),
      generateIncomeStatement(period).catch(() => null),
      generateTrialBalance(period).catch(() => null),
      generateFlashReport(period).catch(() => null),
    ]);

    const issues: IntegrityIssue[] = [];

    if (bs) {
      const diff = Math.abs((bs.totalAssets ?? 0) - (bs.totalLiabilitiesAndEquity ?? 0));
      if (diff > 1) {
        issues.push({
          type: 'BS_IMBALANCE',
          severity: 'critical',
          description: `Balance sheet out of balance by $${diff.toFixed(2)}`,
        });
      }
    }

    if (tb) {
      const diff = Math.abs((tb.totalDebits ?? 0) - (tb.totalCredits ?? 0));
      if (diff > 1) {
        issues.push({
          type: 'TB_IMBALANCE',
          severity: 'critical',
          description: `Trial balance debits/credits differ by $${diff.toFixed(2)}`,
        });
      }
    }

    if (is && bs) {
      issues.push({
        type: 'IS_BS_TIEOUT',
        severity: 'info',
        description: `IS Net Income: $${(is.netIncome ?? 0).toFixed(2)}. Verify it flows to BS retained earnings.`,
      });
    }

    const criticalCount = issues.filter((i) => i.severity === 'critical').length;
    const warningCount = issues.filter((i) => i.severity === 'warning').length;

    const pkg = {
      id: `pkg-${period}-${Date.now()}`,
      period,
      status: criticalCount > 0 ? 'failed' : 'ready',
      components: {
        balanceSheet: bs ? 'generated' : 'failed',
        incomeStatement: is ? 'generated' : 'failed',
        trialBalance: tb ? 'generated' : 'failed',
        flashReport: flash ? 'generated' : 'failed',
      },
      integrityScore: Math.max(0, 100 - criticalCount * 30 - warningCount * 10),
      issues,
      generatedAt: new Date().toISOString(),
      flash: flash
        ? {
            revenue: flash.revenue,
            cogs: flash.cogs,
            grossProfit: flash.grossProfit,
            netIncome: flash.netIncome,
          }
        : null,
    };

    return NextResponse.json({ success: true, data: pkg });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
