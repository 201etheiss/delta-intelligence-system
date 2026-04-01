import { NextResponse } from 'next/server';

/**
 * Workstream definitions with module mappings.
 * Each workstream maps to platform modules and their health can be
 * aggregated from /api/system/health or engine status checks.
 */

interface WorkstreamModule {
  name: string;
  route: string | null;
  status: 'operational' | 'degraded' | 'offline' | 'planned';
}

interface WorkstreamDef {
  id: string;
  name: string;
  owner: string;
  description: string;
  modules: WorkstreamModule[];
}

const WORKSTREAM_DEFS: WorkstreamDef[] = [
  {
    id: 'record-to-report',
    name: 'Record to Report',
    owner: 'Taylor Veazey',
    description: 'Journal entries, GL, financial statements, close management, reconciliations',
    modules: [
      { name: 'Journal Entries', route: '/accounting/journal-entries', status: 'operational' },
      { name: 'General Ledger', route: '/accounting/gl', status: 'operational' },
      { name: 'Financial Statements', route: '/accounting/financial-statements', status: 'operational' },
      { name: 'Close Tracker', route: '/accounting/close', status: 'operational' },
      { name: 'Reconciliations', route: '/accounting/reconciliation', status: 'operational' },
      { name: 'Commentary', route: '/accounting/commentary', status: 'operational' },
    ],
  },
  {
    id: 'procure-to-pay',
    name: 'Procure to Pay',
    owner: 'Lea Centanni',
    description: 'AP invoices, vendor management, purchase orders, payment processing',
    modules: [
      { name: 'AP Invoices', route: '/accounting/ap', status: 'operational' },
      { name: 'Vendor Management', route: null, status: 'planned' },
      { name: 'Expenses', route: '/accounting/expenses', status: 'operational' },
      { name: 'Contracts', route: '/accounting/contracts', status: 'operational' },
    ],
  },
  {
    id: 'order-to-cash',
    name: 'Order to Cash',
    owner: 'David Carmichael',
    description: 'AR invoicing, customer billing, cash application, collections',
    modules: [
      { name: 'AR Aging', route: '/accounting/ar', status: 'operational' },
      { name: 'Inventory / Margin', route: '/accounting/inventory', status: 'operational' },
      { name: 'Customer Billing', route: null, status: 'planned' },
    ],
  },
  {
    id: 'hire-to-retire',
    name: 'Hire to Retire',
    owner: 'HR',
    description: 'Payroll, benefits, time-off, onboarding, org management',
    modules: [
      { name: 'HR Dashboard', route: '/hr', status: 'operational' },
      { name: 'People Directory', route: '/people', status: 'operational' },
      { name: 'Payroll Processing', route: null, status: 'planned' },
      { name: 'Benefits Enrollment', route: null, status: 'planned' },
    ],
  },
  {
    id: 'asset-management',
    name: 'Asset Management',
    owner: 'Brian Kooy',
    description: 'Fixed assets, depreciation, fleet equipment tracking',
    modules: [
      { name: 'Fixed Assets', route: '/accounting/fixed-assets', status: 'operational' },
      { name: 'Equipment Tracker', route: null, status: 'operational' },
      { name: 'Fleet Map', route: '/fleet', status: 'operational' },
    ],
  },
  {
    id: 'treasury',
    name: 'Treasury',
    owner: 'Mike Long',
    description: 'Cash flow forecasting, bank reconciliation, LOC management',
    modules: [
      { name: 'Cash Flow', route: '/accounting/cash-flow', status: 'operational' },
      { name: 'Bank Reconciliation', route: null, status: 'planned' },
      { name: 'LOC Tracking', route: null, status: 'planned' },
    ],
  },
  {
    id: 'tax-compliance',
    name: 'Tax & Compliance',
    owner: 'Bill Didsbury',
    description: 'Tax calculations, filings, compliance monitoring',
    modules: [
      { name: 'Tax Engine', route: '/accounting/tax', status: 'operational' },
      { name: 'Compliance Dashboard', route: null, status: 'planned' },
    ],
  },
  {
    id: 'audit-controls',
    name: 'Audit & Controls',
    owner: 'Taylor Veazey',
    description: 'Audit portal, evidence vault, controls matrix, SOX compliance',
    modules: [
      { name: 'Audit Portal', route: '/accounting/audit', status: 'operational' },
      { name: 'Evidence Vault', route: '/accounting/evidence-vault', status: 'operational' },
      { name: 'Controls Matrix', route: null, status: 'planned' },
    ],
  },
  {
    id: 'business-intelligence',
    name: 'Business Intelligence',
    owner: 'Adam Vegas',
    description: 'Executive dashboards, daily briefings, KPIs, scenario modeling',
    modules: [
      { name: 'Executive Dashboard', route: '/admin', status: 'operational' },
      { name: 'AI Chat', route: '/chat', status: 'operational' },
      { name: 'Plugin Framework', route: null, status: 'operational' },
      { name: 'Budgeting', route: '/accounting/budgeting', status: 'operational' },
      { name: 'Data Bridge', route: null, status: 'operational' },
    ],
  },
  {
    id: 'fleet-operations',
    name: 'Fleet Operations',
    owner: 'Brian Kooy',
    description: 'Vehicle tracking, driver management, dispatch, fuel logistics',
    modules: [
      { name: 'Fleet Map', route: '/fleet', status: 'operational' },
      { name: 'Samsara Integration', route: null, status: 'operational' },
      { name: 'Fleet Panda', route: null, status: 'degraded' },
      { name: 'Dispatch Optimization', route: null, status: 'planned' },
    ],
  },
];

export async function GET() {
  try {
    const workstreams = WORKSTREAM_DEFS.map((ws) => {
      const totalModules = ws.modules.length;
      const operationalModules = ws.modules.filter((m) => m.status === 'operational').length;
      const degradedModules = ws.modules.filter((m) => m.status === 'degraded').length;
      const plannedModules = ws.modules.filter((m) => m.status === 'planned').length;
      const completionPct = totalModules > 0
        ? Math.round(((operationalModules + degradedModules * 0.5) / totalModules) * 100)
        : 0;

      const health: 'healthy' | 'degraded' | 'critical' =
        degradedModules === 0 && plannedModules < totalModules
          ? 'healthy'
          : degradedModules > 0
            ? 'degraded'
            : 'critical';

      return {
        ...ws,
        totalModules,
        operationalModules,
        degradedModules,
        plannedModules,
        completionPct,
        health,
        lastUpdated: new Date().toISOString(),
      };
    });

    const totalModules = workstreams.reduce((s, w) => s + w.totalModules, 0);
    const operationalTotal = workstreams.reduce((s, w) => s + w.operationalModules, 0);
    const avgCompletion = workstreams.length > 0
      ? Math.round(workstreams.reduce((s, w) => s + w.completionPct, 0) / workstreams.length)
      : 0;

    return NextResponse.json({
      success: true,
      data: {
        workstreams,
        summary: {
          totalWorkstreams: workstreams.length,
          totalModules,
          operationalModules: operationalTotal,
          avgCompletion,
        },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
