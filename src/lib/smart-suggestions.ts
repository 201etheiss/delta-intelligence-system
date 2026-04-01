/**
 * Smart Suggestions Engine
 *
 * Generates contextual prompt suggestions based on:
 * 1. User's role
 * 2. Current conversation context
 * 3. Time of day / business cycle
 * 4. Common workflows and their next steps
 *
 * Goal: Lower the effort threshold so every user can be a power user.
 */

import { type UserRole } from '@/lib/config/roles';

export interface SmartSuggestion {
  text: string;
  category: 'quick-action' | 'analysis' | 'report' | 'workflow' | 'follow-up';
  icon?: string;
  description?: string;
  priority: number; // 0 = highest
}

/**
 * Role-specific quick actions — the most common things each role does daily
 */
const ROLE_QUICK_ACTIONS: Record<UserRole, SmartSuggestion[]> = {
  admin: [
    { text: 'Show me the full pipeline with stage breakdown and weighted value', category: 'analysis', priority: 0, description: 'Pipeline health check' },
    { text: 'Are any sales reps below KPI targets this month?', category: 'analysis', priority: 1, description: 'KPI compliance check' },
    { text: 'What does our AR aging look like? Flag anything over 90 days', category: 'analysis', priority: 2, description: 'Collections risk' },
    { text: 'Compare revenue this quarter vs same quarter last year', category: 'report', priority: 3, description: 'YoY performance' },
    { text: 'Show fleet utilization — how many trucks are active vs parked right now', category: 'analysis', priority: 4, description: 'Fleet efficiency' },
    { text: 'Generate a weekly executive summary report', category: 'report', priority: 5, description: 'Auto-generated brief' },
    { text: 'Schedule a meeting with the sales team for tomorrow at 10 AM', category: 'workflow', priority: 6, description: 'Calendar action' },
    { text: 'What are current rack prices for dyed diesel in Louisiana?', category: 'quick-action', priority: 7, description: 'Live pricing' },
  ],
  sales: [
    { text: 'Show my open pipeline sorted by close date', category: 'quick-action', priority: 0, description: 'Your active deals' },
    { text: 'Am I hitting my KPIs this week? Check activities, visits, and opportunities', category: 'analysis', priority: 1, description: 'Personal scorecard' },
    { text: 'What did we last deliver to [customer] and at what price?', category: 'quick-action', priority: 2, description: 'Pricing lookup' },
    { text: 'Any new leads this week? Show company, source, and status', category: 'quick-action', priority: 3, description: 'Lead review' },
    { text: 'Create a follow-up task for [account] — call next week about pricing', category: 'workflow', priority: 4, description: 'SF task creation' },
    { text: 'What are current rack prices for dyed diesel in my area?', category: 'quick-action', priority: 5, description: 'Competitive pricing' },
    { text: 'Does [customer] have any past-due invoices?', category: 'analysis', priority: 6, description: 'Account health' },
    { text: 'Schedule a site visit with [contact] for Thursday at 2 PM', category: 'workflow', priority: 7, description: 'Calendar action' },
  ],
  accounting: [
    { text: 'Show AR aging with customers over 90 days past due', category: 'quick-action', priority: 0, description: 'Collections priority' },
    { text: 'Pull the trial balance for the current period', category: 'quick-action', priority: 1, description: 'Month-end close' },
    { text: 'What journal entries were posted this period? Show by user', category: 'analysis', priority: 2, description: 'GL audit' },
    { text: 'Show income statement for the current year', category: 'report', priority: 3, description: 'P&L review' },
    { text: 'How much did we pay [vendor] this year? Break down by month', category: 'analysis', priority: 4, description: 'Vendor spend' },
    { text: 'Show all recurring lease and rent payments', category: 'quick-action', priority: 5, description: 'AP recurring' },
    { text: 'What taxes did we collect in Louisiana vs Texas?', category: 'analysis', priority: 6, description: 'Tax compliance' },
    { text: 'Generate balance sheet for period 12', category: 'report', priority: 7, description: 'Financial statement' },
  ],
  operations: [
    { text: 'Where are all our trucks right now?', category: 'quick-action', priority: 0, description: 'Live fleet map' },
    { text: 'Which drivers are available to dispatch — not on HOS break?', category: 'quick-action', priority: 1, description: 'Driver availability' },
    { text: 'How many tanks do we have in inventory vs deployed?', category: 'analysis', priority: 2, description: 'Equipment utilization' },
    { text: 'Show all equipment at the Lake Charles branch', category: 'quick-action', priority: 3, description: 'Branch inventory' },
    { text: 'Which carrier moved the most gallons this month?', category: 'analysis', priority: 4, description: 'Carrier performance' },
    { text: 'Show fleet breakdown by make and model with counts', category: 'analysis', priority: 5, description: 'Fleet composition' },
    { text: 'Any vehicle defects reported this week?', category: 'quick-action', priority: 6, description: 'DVIR check' },
    { text: 'Show me odometer readings for all Freightliner trucks', category: 'analysis', priority: 7, description: 'Mileage tracking' },
  ],
  hr: [
    { text: 'Show me total headcount by department', category: 'analysis', priority: 0, description: 'Department breakdown' },
    { text: 'What are our cost centers?', category: 'analysis', priority: 1, description: 'Cost center listing' },
    { text: 'How many active drivers do we have in Samsara?', category: 'analysis', priority: 2, description: 'Driver count' },
    { text: 'List all position types', category: 'report', priority: 3, description: 'Position catalog' },
    { text: 'Show me fleet vehicle count and driver status', category: 'analysis', priority: 4, description: 'Fleet + HR crossover' },
  ],
  readonly: [
    { text: 'Give me a high-level business overview — revenue, customers, fleet, pipeline', category: 'report', priority: 0, description: 'Business snapshot' },
    { text: 'How has revenue trended quarter over quarter?', category: 'analysis', priority: 1, description: 'Trend analysis' },
    { text: 'Who are the top 10 customers and how is their AR aging?', category: 'analysis', priority: 2, description: 'Customer analysis' },
    { text: 'Show the current sales pipeline by stage', category: 'quick-action', priority: 3, description: 'Pipeline view' },
  ],
};

/**
 * Contextual next-step suggestions based on what was just discussed
 */
const CONTEXT_PATTERNS: Array<{
  pattern: RegExp;
  suggestions: SmartSuggestion[];
}> = [
  {
    pattern: /\b(pipeline|opportunit|deal|stage|funnel)\b/i,
    suggestions: [
      { text: 'Break down the pipeline by salesperson', category: 'follow-up', priority: 0 },
      { text: 'Which deals are closing this month?', category: 'follow-up', priority: 1 },
      { text: 'Show win/loss rate by stage', category: 'follow-up', priority: 2 },
    ],
  },
  {
    pattern: /\b(ar\s*aging|past\s*due|overdue|collect)\b/i,
    suggestions: [
      { text: 'Create follow-up tasks for the top 5 overdue accounts', category: 'workflow', priority: 0 },
      { text: 'What is the total disputed amount?', category: 'follow-up', priority: 1 },
      { text: 'Export AR aging to Excel', category: 'follow-up', priority: 2 },
    ],
  },
  {
    pattern: /\b(truck|vehicle|fleet|driver|samsara)\b/i,
    suggestions: [
      { text: 'Show vehicles grouped by regional tag', category: 'follow-up', priority: 0 },
      { text: 'Which drivers have the most drive hours this week?', category: 'follow-up', priority: 1 },
      { text: 'Calculate total fleet mileage from odometer data', category: 'follow-up', priority: 2 },
    ],
  },
  {
    pattern: /\b(revenue|gross\s*profit|gp|margin|customer.*profit)\b/i,
    suggestions: [
      { text: 'Show GP trend by month for the last 12 months', category: 'follow-up', priority: 0 },
      { text: 'Which customer types generate the highest margins?', category: 'follow-up', priority: 1 },
      { text: 'Compare top 10 customers by GP vs revenue', category: 'follow-up', priority: 2 },
    ],
  },
  {
    pattern: /\b(kpi|scorecard|activit|visit|salesforce\s*log)\b/i,
    suggestions: [
      { text: 'Show KPI compliance by division', category: 'follow-up', priority: 0 },
      { text: 'Which reps have the most Closed Won deals this quarter?', category: 'follow-up', priority: 1 },
      { text: 'Generate a weekly sales activity report', category: 'report', priority: 2 },
    ],
  },
  {
    pattern: /\b(schedule|meeting|calendar|event)\b/i,
    suggestions: [
      { text: 'Show my upcoming meetings this week', category: 'follow-up', priority: 0 },
      { text: 'Schedule a follow-up meeting for next week', category: 'workflow', priority: 1 },
    ],
  },
  {
    pattern: /\b(rack\s*price|dtn|pricing|quote|bid)\b/i,
    suggestions: [
      { text: 'Compare rack prices across all supply points', category: 'follow-up', priority: 0 },
      { text: 'What did we invoice vs rack for the last 10 deliveries?', category: 'follow-up', priority: 1 },
      { text: 'Generate a pricing comparison workbook', category: 'report', priority: 2 },
    ],
  },
];

/**
 * Time-based suggestions — certain queries are more relevant at certain times
 */
function getTimeSuggestions(): SmartSuggestion[] {
  const hour = new Date().getHours();
  const day = new Date().getDay();
  const suggestions: SmartSuggestion[] = [];

  // Monday morning — week kickoff
  if (day === 1 && hour < 12) {
    suggestions.push({
      text: 'What happened last week? Show key metrics and any anomalies',
      category: 'report',
      priority: 0,
      description: 'Weekly recap',
    });
  }

  // Friday afternoon — week wrap
  if (day === 5 && hour >= 14) {
    suggestions.push({
      text: 'Generate an end-of-week summary with KPIs and pipeline changes',
      category: 'report',
      priority: 0,
      description: 'Week wrap-up',
    });
  }

  // End of month (last 3 days)
  const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
  if (new Date().getDate() >= daysInMonth - 2) {
    suggestions.push({
      text: 'Month-end close: pull trial balance, income statement, and AR summary',
      category: 'report',
      priority: 0,
      description: 'Month-end close',
    });
  }

  // Morning (before 10 AM) — daily briefing
  if (hour < 10) {
    suggestions.push({
      text: 'Good morning brief — what do I need to know today?',
      category: 'quick-action',
      priority: 1,
      description: 'Daily digest',
    });
  }

  return suggestions;
}

/**
 * Get smart suggestions for a user based on role, context, and time
 */
export function getSmartSuggestions(
  role: UserRole,
  lastMessage?: string,
  maxResults = 6,
): SmartSuggestion[] {
  const results: SmartSuggestion[] = [];

  // 1. Time-based suggestions (highest priority)
  results.push(...getTimeSuggestions());

  // 2. Context-based suggestions (if there's conversation history)
  if (lastMessage) {
    for (const cp of CONTEXT_PATTERNS) {
      if (cp.pattern.test(lastMessage)) {
        results.push(...cp.suggestions);
      }
    }
  }

  // 3. Role-based quick actions (fill remaining slots)
  const roleActions = ROLE_QUICK_ACTIONS[role] ?? ROLE_QUICK_ACTIONS.readonly;
  results.push(...roleActions);

  // Deduplicate by text
  const seen = new Set<string>();
  const unique = results.filter(s => {
    if (seen.has(s.text)) return false;
    seen.add(s.text);
    return true;
  });

  // Sort by priority and return top N
  return unique
    .sort((a, b) => a.priority - b.priority)
    .slice(0, maxResults);
}

/**
 * Get workflow templates — guided multi-step processes
 */
export interface WorkflowTemplate {
  id: string;
  name: string;
  description: string;
  role: UserRole | 'all';
  steps: string[];
}

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'wf_new_customer',
    name: 'New Customer Setup',
    description: 'Full onboarding: create account, add contacts, set pricing, assign equipment',
    role: 'sales',
    steps: [
      'Create the account in Salesforce with full company details',
      'Add primary contact with email and phone',
      'Look up current rack pricing for their delivery area',
      'Create an opportunity with estimated volume and GP',
      'Schedule a follow-up visit for next week',
    ],
  },
  {
    id: 'wf_month_end',
    name: 'Month-End Close',
    description: 'Financial close checklist: TB, BS, IS, AR reconciliation',
    role: 'accounting',
    steps: [
      'Pull trial balance for the current period',
      'Review journal entries posted this period by user',
      'Check AR aging for any disputed or 90+ day balances',
      'Generate income statement and balance sheet',
      'Export all reports to Excel for filing',
    ],
  },
  {
    id: 'wf_fleet_review',
    name: 'Fleet Status Review',
    description: 'Weekly fleet check: GPS, HOS compliance, defects, utilization',
    role: 'operations',
    steps: [
      'Check live GPS positions — any vehicles outside expected zones?',
      'Review HOS compliance for the past 7 days — any violations?',
      'Check for open vehicle defects (DVIR)',
      'Show fleet mileage from odometer data for the week',
      'Review driver availability by tag/region',
    ],
  },
  {
    id: 'wf_pricing_quote',
    name: 'Generate Pricing Quote',
    description: 'Build a competitive quote: rack check, margin calc, delivery estimate',
    role: 'all',
    steps: [
      'Check current DTN rack prices for the product and supply point',
      'Look up recent invoice prices for similar deliveries',
      'Check tank/equipment availability at the customer site',
      'Calculate margin vs rack at target pricing',
      'Generate a pricing workbook with all comparisons',
    ],
  },
  {
    id: 'wf_sales_review',
    name: 'Weekly Sales Review',
    description: 'Pipeline health, rep KPIs, new leads, closed deals',
    role: 'admin',
    steps: [
      'Show full pipeline by stage with weighted value',
      'Check each rep against their division KPI targets',
      'Review new leads created this week by source',
      'List deals closed (won and lost) with amounts',
      'Identify stalled opportunities with no activity in 30+ days',
    ],
  },
];

/**
 * Get workflow templates for a role
 */
export function getWorkflowsForRole(role: UserRole): WorkflowTemplate[] {
  return WORKFLOW_TEMPLATES.filter(w => w.role === role || w.role === 'all');
}
