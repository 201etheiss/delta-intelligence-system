import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/config/roles';
import { getSmartSuggestions, type SmartSuggestion } from '@/lib/smart-suggestions';
import { logUsageEvent } from '@/lib/usage-logger';

// ── Page-specific intelligence suggestions ──────────────────

interface IntelligenceSuggestion {
  text: string;
  category: string;
  description: string;
  priority: number;
  source: 'anomaly' | 'pattern' | 'context' | 'usage';
}

const PAGE_SUGGESTIONS: Record<string, (role: UserRole) => IntelligenceSuggestion[]> = {
  '/financial-statements': () => [
    { text: 'Revenue is tracking against budget — review variance analysis', category: 'analysis', description: 'Budget variance check', priority: 0, source: 'context' },
    { text: 'Compare income statement YoY for margin trends', category: 'analysis', description: 'Margin analysis', priority: 1, source: 'context' },
    { text: 'Check for any late-posted entries affecting this period', category: 'workflow', description: 'Close integrity', priority: 2, source: 'context' },
  ],
  '/reconciliations': () => [
    { text: 'Review exceptions past 30 days — prioritize resolution', category: 'workflow', description: 'Exception aging', priority: 0, source: 'anomaly' },
    { text: 'Auto-close reconciliations where all items match within $1', category: 'workflow', description: 'Automation opportunity', priority: 1, source: 'pattern' },
    { text: 'Export unresolved exceptions for team review', category: 'workflow', description: 'Team coordination', priority: 2, source: 'context' },
  ],
  '/cockpit': () => [
    { text: 'LOC utilization trending — review borrowing base calculation', category: 'analysis', description: 'Cash management', priority: 0, source: 'anomaly' },
    { text: 'Month-end close is approaching — check task completion', category: 'workflow', description: 'Close readiness', priority: 1, source: 'context' },
    { text: 'Review JE pipeline for any stuck approvals', category: 'workflow', description: 'Approval backlog', priority: 2, source: 'pattern' },
  ],
  '/journal-entries': () => [
    { text: 'Flag journal entries over $100K for additional review', category: 'analysis', description: 'Large JE review', priority: 0, source: 'anomaly' },
    { text: 'Check for template matches to auto-approve recurring entries', category: 'workflow', description: 'Automation suggestion', priority: 1, source: 'pattern' },
    { text: 'Review entries by poster for segregation of duties', category: 'analysis', description: 'SOD compliance', priority: 2, source: 'context' },
  ],
  '/cash-flow': () => [
    { text: 'Cash position requires monitoring — check LOC draw schedule', category: 'analysis', description: 'Liquidity check', priority: 0, source: 'anomaly' },
    { text: 'Review upcoming AP obligations against cash forecast', category: 'analysis', description: 'Cash planning', priority: 1, source: 'context' },
    { text: 'Compare actual vs forecast cash flow for variance', category: 'analysis', description: 'Forecast accuracy', priority: 2, source: 'pattern' },
  ],
  '/ar/collections': () => [
    { text: 'Customers with 90+ day balances need collection follow-up', category: 'workflow', description: 'Collections priority', priority: 0, source: 'anomaly' },
    { text: 'Generate aging report for weekly collections meeting', category: 'report', description: 'Team reporting', priority: 1, source: 'usage' },
    { text: 'Review disputed invoices — some may be resolvable', category: 'workflow', description: 'Dispute resolution', priority: 2, source: 'context' },
  ],
  '/sales': (role: UserRole) => {
    if (role === 'sales') {
      return [
        { text: 'Check your pipeline — deals closing this month need attention', category: 'workflow', description: 'Pipeline health', priority: 0, source: 'context' },
        { text: 'Review stalled opportunities with no activity in 30+ days', category: 'analysis', description: 'Deal velocity', priority: 1, source: 'pattern' },
        { text: 'Compare your KPIs against targets for the week', category: 'analysis', description: 'Performance check', priority: 2, source: 'usage' },
      ];
    }
    return [
      { text: 'Pipeline value has changed — review stage distribution', category: 'analysis', description: 'Pipeline shift', priority: 0, source: 'anomaly' },
      { text: 'Compare rep performance against division targets', category: 'analysis', description: 'Team performance', priority: 1, source: 'context' },
    ];
  },
  '/fleet': () => [
    { text: 'Check vehicle maintenance schedules for upcoming service', category: 'workflow', description: 'Maintenance planning', priority: 0, source: 'context' },
    { text: 'Review driver HOS compliance for the past week', category: 'analysis', description: 'Compliance check', priority: 1, source: 'context' },
    { text: 'Fleet utilization report — identify underused vehicles', category: 'analysis', description: 'Efficiency review', priority: 2, source: 'pattern' },
  ],
  '/executive': () => [
    { text: 'Revenue and GP trends show movement — review executive summary', category: 'analysis', description: 'Performance overview', priority: 0, source: 'anomaly' },
    { text: 'Customer concentration risk — top 5 customers drive majority of revenue', category: 'analysis', description: 'Risk assessment', priority: 1, source: 'pattern' },
    { text: 'Generate weekly executive briefing with KPIs and anomalies', category: 'report', description: 'Auto-briefing', priority: 2, source: 'context' },
  ],
};

// ── Route handler ────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const email = session?.user?.email ?? '';
  const role = getUserRole(email);

  const { searchParams } = new URL(request.url);
  const page = searchParams.get('page') ?? '/';
  const lastMessage = searchParams.get('context') ?? undefined;

  // Log this suggestions fetch for usage analytics
  logUsageEvent({
    type: 'suggestion_request',
    page,
    role,
    userEmail: email,
  });

  // Get page-specific intelligence suggestions
  const pageKey = Object.keys(PAGE_SUGGESTIONS).find((key) => page.startsWith(key));
  const pageSuggestions = pageKey
    ? PAGE_SUGGESTIONS[pageKey](role)
    : [];

  // Get role-based smart suggestions from the engine
  const smartSuggestions: SmartSuggestion[] = getSmartSuggestions(role, lastMessage, 3);

  // Merge: page-specific first, then smart suggestions to fill remaining slots
  const merged: IntelligenceSuggestion[] = [
    ...pageSuggestions,
    ...smartSuggestions.map((s) => ({
      text: s.text,
      category: s.category,
      description: s.description ?? '',
      priority: s.priority + 10, // lower priority than page-specific
      source: 'context' as const,
    })),
  ];

  // Deduplicate and limit to 5
  const seen = new Set<string>();
  const unique = merged.filter((s) => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });

  const suggestions = unique
    .sort((a, b) => a.priority - b.priority)
    .slice(0, 5);

  return NextResponse.json({
    success: true,
    suggestions,
    page,
    role,
    count: suggestions.length,
  });
}
