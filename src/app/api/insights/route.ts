import { NextRequest, NextResponse } from 'next/server';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Insight {
  id: string;
  type: 'info' | 'warning' | 'critical' | 'trend';
  severity: 'info' | 'warn' | 'critical';
  title: string;
  description: string;
  action?: string;
  actionUrl?: string;
  dismissible: boolean;
}

// ---------------------------------------------------------------------------
// Cache — 5 min per module
// ---------------------------------------------------------------------------

const cache = new Map<string, { insights: Insight[]; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

// ---------------------------------------------------------------------------
// Insight generators per module
// ---------------------------------------------------------------------------

function generateInsights(mod: string): Insight[] {
  const now = new Date();
  const period = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  switch (mod) {
    case 'journal-entries':
      return [
        {
          id: `je-pending-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '5 journal entries pending review for 3+ days',
          description: 'Unposted JEs aging past SLA — review or escalate.',
          action: 'Review',
          actionUrl: '/journal-entries?status=pending',
          dismissible: true,
        },
        {
          id: `je-highval-${period}`,
          type: 'critical',
          severity: 'critical',
          title: '2 high-value JEs need secondary approval',
          description: 'Entries above $10K require dual sign-off per SOX controls.',
          action: 'Approve',
          actionUrl: '/journal-entries?status=pending',
          dismissible: true,
        },
        {
          id: `je-template-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Fuel purchase JE template matches 80% of recent entries',
          description: 'Consider enabling auto-coding to reduce manual entry.',
          action: 'Templates',
          actionUrl: '/journal-entries?tab=templates',
          dismissible: true,
        },
      ];

    case 'reconciliations':
      return [
        {
          id: `recon-exception-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '3 reconciliation exceptions past 30 days',
          description: 'Aging exceptions require escalation per close policy.',
          action: 'View',
          actionUrl: '/reconciliations?filter=exceptions',
          dismissible: true,
        },
        {
          id: `recon-completion-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Bank recon is 92% complete — 4 items remaining',
          description: 'On track for close deadline. 4 unmatched items need manual review.',
          dismissible: true,
        },
        {
          id: `recon-automatch-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Auto-matching resolved 85% of items this period',
          description: 'Match rate improved 3 points from prior month.',
          dismissible: true,
        },
      ];

    case 'cash-flow':
      return [
        {
          id: `cf-loc-${period}`,
          type: 'critical',
          severity: 'critical',
          title: 'Borrowing base utilization at 332% — review with treasury',
          description: 'LOC draw exceeds covenant threshold. Escalate immediately.',
          action: 'Review',
          actionUrl: '/cash-flow',
          dismissible: false,
        },
        {
          id: `cf-trend-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Cash balance down 15% from last month',
          description: 'Driven by large vendor payments and seasonal volume increase.',
          dismissible: true,
        },
        {
          id: `cf-upcoming-${period}`,
          type: 'info',
          severity: 'info',
          title: '3 large vendor payments due in next 7 days totaling $450K',
          description: 'Ensure adequate liquidity for upcoming disbursements.',
          action: 'View AP',
          actionUrl: '/ap/invoices',
          dismissible: true,
        },
      ];

    case 'financial-statements':
      return [
        {
          id: `fs-rev-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Revenue up 12% YoY — strongest quarter in 3 years',
          description: 'Driven by increased fuel volumes and higher rack prices.',
          dismissible: true,
        },
        {
          id: `fs-gp-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Gross margin declined 2.3 points from prior year',
          description: 'COGS growth outpacing revenue — review fuel cost structure.',
          action: 'View COGS',
          actionUrl: '/financial-statements?tab=income-statement',
          dismissible: true,
        },
        {
          id: `fs-unusual-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Account 67200 has unusual activity this period',
          description: 'Variance exceeds 2 standard deviations from 12-month average.',
          action: 'Investigate',
          actionUrl: '/financial-statements?tab=trial-balance',
          dismissible: true,
        },
      ];

    case 'close-tracker':
      return [
        {
          id: `close-progress-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Day 3 tasks are 60% complete — behind schedule',
          description: 'Bank recon and AP accruals still in progress.',
          action: 'View Tasks',
          actionUrl: '/close-tracker',
          dismissible: true,
        },
        {
          id: `close-blocker-${period}`,
          type: 'critical',
          severity: 'critical',
          title: 'Bank reconciliation is blocking 4 downstream tasks',
          description: 'Complete bank recon to unblock trial balance review and adjustments.',
          action: 'Unblock',
          actionUrl: '/reconciliations',
          dismissible: false,
        },
        {
          id: `close-pace-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Current close is 1 day ahead of last month\'s pace',
          description: 'Automation improvements reduced manual steps by 20%.',
          dismissible: true,
        },
      ];

    case 'ap-invoices':
      return [
        {
          id: `ap-aging-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '12 invoices past 60 days totaling $125K',
          description: 'Aging past payment terms — risk of late fees and vendor disputes.',
          action: 'View Aging',
          actionUrl: '/ap/invoices?filter=aging',
          dismissible: true,
        },
        {
          id: `ap-coding-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Auto-coding confidence is 94% this month',
          description: 'AI-driven GL coding accuracy continues to improve.',
          dismissible: true,
        },
        {
          id: `ap-dup-${period}`,
          type: 'critical',
          severity: 'critical',
          title: 'Potential duplicate: Invoice #4521 from Vendor X matches #4519',
          description: 'Same amount, vendor, and date range detected.',
          action: 'Review',
          actionUrl: '/ap/invoices',
          dismissible: true,
        },
      ];

    case 'ar-collections':
      return [
        {
          id: `ar-priority-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Top 3 past-due accounts represent 65% of outstanding AR',
          description: 'Concentration risk — prioritize collection efforts.',
          action: 'View',
          actionUrl: '/ar/collections',
          dismissible: true,
        },
        {
          id: `ar-trend-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'AR aging improved 8% from last month',
          description: 'Collection rate improving due to automated reminders.',
          dismissible: true,
        },
        {
          id: `ar-contact-${period}`,
          type: 'info',
          severity: 'info',
          title: '5 accounts have no follow-up contact in 30+ days',
          description: 'Stale collection efforts — schedule outreach.',
          action: 'Schedule',
          actionUrl: '/ar/collections',
          dismissible: true,
        },
      ];

    case 'fleet':
    case 'fleet-map':
      return [
        {
          id: `fleet-util-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Fleet utilization at 78% — 8 vehicles idle',
          description: 'Review idle vehicles for reassignment or disposition.',
          action: 'View Fleet',
          actionUrl: '/fleet',
          dismissible: true,
        },
        {
          id: `fleet-maint-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '3 vehicles are past scheduled maintenance date',
          description: 'Overdue maintenance increases breakdown risk and compliance issues.',
          action: 'Schedule',
          actionUrl: '/fleet',
          dismissible: true,
        },
        {
          id: `fleet-mpg-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Average MPG down 5% from last quarter',
          description: 'May indicate mechanical issues or route inefficiencies.',
          dismissible: true,
        },
      ];

    case 'hr':
      return [
        {
          id: `hr-turnover-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '2 departures this month — both in Operations',
          description: 'Operations department showing elevated turnover.',
          dismissible: true,
        },
        {
          id: `hr-headcount-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Headcount at 42, up 3 from start of quarter',
          description: 'Net growth driven by field services hiring.',
          dismissible: true,
        },
        {
          id: `hr-compliance-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '4 employees have incomplete onboarding documents',
          description: 'Missing I-9 or W-4 forms — compliance risk.',
          action: 'Review',
          actionUrl: '/hr',
          dismissible: true,
        },
      ];

    case 'cockpit':
      return [
        {
          id: `cockpit-critical-${period}`,
          type: 'critical',
          severity: 'critical',
          title: 'Borrowing base utilization exceeds covenant — immediate review needed',
          description: 'LOC draw at 332% of available base. Treasury action required.',
          action: 'Cash Flow',
          actionUrl: '/cash-flow',
          dismissible: false,
        },
        {
          id: `cockpit-close-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Month-end close: bank recon blocking 4 tasks',
          description: 'Complete reconciliation to unblock downstream close tasks.',
          action: 'Close Tracker',
          actionUrl: '/close-tracker',
          dismissible: true,
        },
        {
          id: `cockpit-automation-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Automation executed 23 tasks this period — 100% success rate',
          description: 'All scheduled workflows completed without errors.',
          dismissible: true,
        },
      ];

    case 'executive':
      return [
        {
          id: `exec-revenue-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Revenue up 12% YoY — strongest quarter in 3 years',
          description: 'Volume growth and favorable pricing driving outperformance.',
          dismissible: true,
        },
        {
          id: `exec-margin-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Gross margin declined 2.3 points — monitor COGS trend',
          description: 'Fuel costs rising faster than revenue adjustments.',
          action: 'View Financials',
          actionUrl: '/financial-statements',
          dismissible: true,
        },
        {
          id: `exec-loc-${period}`,
          type: 'critical',
          severity: 'critical',
          title: 'LOC utilization at critical level — covenant risk',
          description: 'Borrowing base needs immediate treasury review.',
          action: 'Cash Flow',
          actionUrl: '/cash-flow',
          dismissible: false,
        },
        {
          id: `exec-ar-${period}`,
          type: 'info',
          severity: 'info',
          title: 'AR aging improved 8% — collection automation working',
          description: 'Automated reminders reducing days outstanding.',
          dismissible: true,
        },
        {
          id: `exec-headcount-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Headcount at 42 — 3 new hires this quarter in field services',
          description: 'On track with hiring plan for seasonal ramp.',
          dismissible: true,
        },
      ];

    case 'budgets':
      return [
        {
          id: `budget-var-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Fuel expense trending 8% over budget',
          description: 'Rack price increases not fully reflected in current budget.',
          action: 'View',
          actionUrl: '/budgets',
          dismissible: true,
        },
        {
          id: `budget-util-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Overall budget utilization at 72% through Q1',
          description: 'On pace for year-end target.',
          dismissible: true,
        },
      ];

    case 'fixed-assets':
      return [
        {
          id: `fa-depr-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Monthly depreciation of $45K posted automatically',
          description: 'All fixed asset schedules current through this period.',
          dismissible: true,
        },
        {
          id: `fa-disposal-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '2 fully depreciated assets still in service',
          description: 'Review for disposal or impairment assessment.',
          action: 'Review',
          actionUrl: '/assets/fixed',
          dismissible: true,
        },
      ];

    case 'inventory':
      return [
        {
          id: `inv-margin-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Fuel margin per gallon up 2 cents from prior period',
          description: 'Pricing adjustments taking effect.',
          dismissible: true,
        },
        {
          id: `inv-variance-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Tank variance exceeds 0.5% at Location 3',
          description: 'Physical vs. book inventory discrepancy needs investigation.',
          action: 'Investigate',
          actionUrl: '/inventory',
          dismissible: true,
        },
      ];

    case 'expenses':
      return [
        {
          id: `exp-pending-${period}`,
          type: 'info',
          severity: 'info',
          title: '8 expense reports pending approval totaling $12K',
          description: 'Average processing time: 2.3 days.',
          action: 'Approve',
          actionUrl: '/expenses',
          dismissible: true,
        },
        {
          id: `exp-policy-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '2 expense reports flagged for policy violations',
          description: 'Meals exceeding per diem limits detected.',
          action: 'Review',
          actionUrl: '/expenses',
          dismissible: true,
        },
      ];

    case 'tax':
      return [
        {
          id: `tax-filing-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Quarterly fuel tax filing due in 15 days',
          description: 'Data collection 90% complete. Remaining: terminal rack reconciliation.',
          action: 'View',
          actionUrl: '/tax',
          dismissible: true,
        },
        {
          id: `tax-rate-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'State tax rate change effective next period',
          description: 'Update tax tables before next billing cycle.',
          dismissible: true,
        },
      ];

    case 'vault':
      return [
        {
          id: `vault-coverage-${period}`,
          type: 'info',
          severity: 'info',
          title: '142 evidence items linked across 23 assertions',
          description: 'Audit evidence coverage at 89%.',
          dismissible: true,
        },
        {
          id: `vault-gap-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '3 assertions missing supporting evidence',
          description: 'Revenue recognition and inventory valuation need documentation.',
          action: 'Add Evidence',
          actionUrl: '/vault',
          dismissible: true,
        },
      ];

    case 'audit':
      return [
        {
          id: `audit-findings-${period}`,
          type: 'info',
          severity: 'info',
          title: '2 open audit findings from Q4 — both medium risk',
          description: 'Remediation in progress. Target completion: end of month.',
          dismissible: true,
        },
        {
          id: `audit-control-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Internal control testing 95% pass rate this quarter',
          description: 'Up from 88% in prior quarter.',
          dismissible: true,
        },
      ];

    case 'controls':
      return [
        {
          id: `ctrl-violation-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '1 segregation of duties violation detected',
          description: 'Same user created and approved JE-2024-0342.',
          action: 'Investigate',
          actionUrl: '/controls',
          dismissible: true,
        },
        {
          id: `ctrl-health-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Control framework health: 94% — up 3 points',
          description: 'Continuous monitoring catching issues earlier.',
          dismissible: true,
        },
      ];

    case 'exceptions':
      return [
        {
          id: `exc-open-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '7 open exceptions requiring resolution',
          description: '3 are past 30-day SLA — escalation recommended.',
          action: 'View',
          actionUrl: '/exceptions',
          dismissible: true,
        },
        {
          id: `exc-trend-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Exception volume down 15% from prior period',
          description: 'Process improvements reducing recurring exception types.',
          dismissible: true,
        },
      ];

    case 'sales':
      return [
        {
          id: `sales-pipeline-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Pipeline value up 22% — 3 deals in final stage',
          description: 'Expected close within 30 days totaling $180K ARR.',
          dismissible: true,
        },
        {
          id: `sales-activity-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Sales team logged 45 activities this week',
          description: 'Above target of 40. Focus: new prospect outreach.',
          dismissible: true,
        },
      ];

    case 'customer':
      return [
        {
          id: `cust-churn-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '2 customers flagged as churn risk',
          description: 'Volume declined 30%+ over 3 months. Outreach recommended.',
          action: 'View',
          actionUrl: '/customer',
          dismissible: true,
        },
        {
          id: `cust-growth-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Customer base grew 5% this quarter',
          description: '3 new fuel delivery accounts onboarded.',
          dismissible: true,
        },
      ];

    case 'market':
      return [
        {
          id: `mkt-rack-${period}`,
          type: 'info',
          severity: 'info',
          title: 'Rack prices up 4 cents from last week',
          description: 'Seasonal demand increase driving wholesale prices higher.',
          dismissible: true,
        },
        {
          id: `mkt-spread-${period}`,
          type: 'trend',
          severity: 'info',
          title: 'Crack spread widening — favorable for margins',
          description: 'Refinery margins improving across Gulf Coast terminals.',
          dismissible: true,
        },
      ];

    case 'contracts':
      return [
        {
          id: `contract-expiring-${period}`,
          type: 'warning',
          severity: 'warn',
          title: '4 contracts expiring within 60 days',
          description: 'Renewal negotiations should begin. Total value: $320K.',
          action: 'View',
          actionUrl: '/contracts',
          dismissible: true,
        },
        {
          id: `contract-compliance-${period}`,
          type: 'info',
          severity: 'info',
          title: 'All active contracts in compliance',
          description: '100% SLA adherence across 18 active agreements.',
          dismissible: true,
        },
      ];

    case 'dashboard':
      return [
        {
          id: `dash-sources-${period}`,
          type: 'info',
          severity: 'info',
          title: '7 of 8 data sources connected and syncing',
          description: 'Fleet Panda awaiting API key refresh.',
          action: 'Sources',
          actionUrl: '/sources',
          dismissible: true,
        },
        {
          id: `dash-anomaly-${period}`,
          type: 'warning',
          severity: 'warn',
          title: 'Anomaly detected: GL account 51100 variance exceeds threshold',
          description: 'Auto-flagged by anomaly detector. Investigation recommended.',
          action: 'View',
          actionUrl: '/exceptions',
          dismissible: true,
        },
      ];

    default:
      return [
        {
          id: `generic-freshness-${mod}-${period}`,
          type: 'info',
          severity: 'info',
          title: `Data last refreshed ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`,
          description: 'All metrics current for this period.',
          dismissible: true,
        },
      ];
  }
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const mod = req.nextUrl.searchParams.get('module') ?? 'dashboard';

  // Check cache
  const cached = cache.get(mod);
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return NextResponse.json({ insights: cached.insights });
  }

  const insights = generateInsights(mod);
  cache.set(mod, { insights, ts: Date.now() });

  return NextResponse.json({ insights });
}
