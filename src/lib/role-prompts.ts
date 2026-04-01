/**
 * Role-Based Prompt Training
 *
 * Maps each user role to their real-world job context, the questions they ask,
 * and the data paths that answer them. Injected into the system prompt to give
 * the AI deep understanding of WHY users ask what they ask.
 */

import { type UserRole } from '@/lib/config/roles';

interface RoleContext {
  role: UserRole;
  persona: string;
  jobFunction: string;
  dailyChallenges: string[];
  topQueries: Array<{ question: string; dataSources: string; hint: string }>;
  samplePrompts: string[];
}

export const ROLE_CONTEXTS: Record<UserRole, RoleContext> = {
  admin: {
    role: 'admin',
    persona: 'Executive / Owner / IT Admin',
    jobFunction: 'Full visibility across all operations. Makes strategic decisions about pricing, fleet, personnel, and growth. Needs cross-domain synthesis — connecting financial performance to operational execution. Evaluates sales team against division-specific KPIs.',
    dailyChallenges: [
      'Pricing decisions: setting competitive fuel prices while maintaining margins',
      'Cash flow: monitoring AR collections and AP obligations',
      'Fleet utilization: are trucks running efficiently across all branches?',
      'Sales performance: which reps are producing, which accounts are growing/declining? Are they hitting division KPIs?',
      'Compliance: are drivers HOS-compliant, are orders being fulfilled on time?',
      'Strategic planning: YoY trends, market position, expansion opportunities',
      'Sales KPI oversight: Commercial (60 activities/week, $20K-$40K new GP/month), Industrial (50/week, $250K GP/account), O&G Field (60/week, 30 rig check-ins/week), O&G Corporate (60/week, 2 RFP/month), Contractor (60/week, $5K-$10K new GP/month)',
    ],
    topQueries: [
      { question: 'What are our margins by customer and how do they compare to rack pricing?', dataSources: 'BillingChartQuery + ARInvoiceItem (GP) + vRackPrice (rack)', hint: 'Cross-reference invoice unit price vs current DTN rack to show margin per customer' },
      { question: 'Which profit centers are underperforming and why?', dataSources: '/ascend/gp/by-pc + /ascend/costs/by-pc + vPurchaseJournal', hint: 'Compare GP by PC, then drill into cost categories for low-margin PCs' },
      { question: 'How is revenue trending vs last year?', dataSources: 'BillingChartQuery (monthly aggregation, YoY)', hint: 'Group by Year+Period, compare 2025 vs 2024 with customer count' },
      { question: 'Who are our biggest risks in AR right now?', dataSources: '/ascend/ar/aging', hint: 'Sort by 90+ days, flag customers with >$1M past due' },
      { question: 'Give me a complete pricing quote for a customer delivery', dataSources: 'Rack prices + historical invoices + tank inventory + site lookup', hint: 'Multi-step: rack price → recent comparable invoices → tank availability → freight estimate' },
      { question: 'What happened with a specific customer account?', dataSources: 'Ascend (revenue, invoices, AR) + Salesforce (opportunities, contacts, cases) + SharePoint (documents)', hint: 'Pull from all sources — financial history, CRM activity, and any related documents' },
      { question: 'Are my sales reps hitting their KPIs?', dataSources: '/salesforce/tasks + /salesforce/events + /salesforce/opportunities + Ascend revenue', hint: 'Pull SF activity counts per rep per week, compare against division targets. Commercial: 60/week, 5+15 visits, 4 opps/month, $20K-$40K GP. Industrial: 50/week, 3 visits, 3 RFQ/month. O&G Field: 60/week, 30 rig check-ins, 4 opps/month. O&G Corporate: 60/week, 6 visits, 2 RFP/month. Contractor: 60/week, 5 visits, 2 opps/month.' },
    ],
    samplePrompts: [
      'Compare our top 10 customers by gross profit and flag any with declining margins',
      'Are my sales reps hitting their KPIs this month? Break down by division',
      'Show me revenue by month for 2025 vs 2024 — highlight where we grew and where we lost',
      'Which vendors are we spending the most with? Break down by category',
      'List all journal entries posted by esmith in 2026 with account details',
      'What does our fleet utilization look like across all branches?',
    ],
  },

  accounting: {
    role: 'accounting',
    persona: 'Controller / AP-AR Clerk / Staff Accountant',
    jobFunction: 'Manages the books — AR collections, AP payments, GL reconciliation, month-end close, tax compliance. Needs precise financial data with audit trail.',
    dailyChallenges: [
      'AR collections: who owes what, how old, which customers are disputes',
      'AP processing: vendor invoices to pay, recurring obligations, check runs',
      'Month-end close: trial balance, journal entries, accruals, reconciliation',
      'Tax reporting: sales tax collected by jurisdiction, fuel tax by state',
      'Revenue recognition: proper period assignment, deferred revenue',
      'Audit prep: supporting documentation for transactions',
    ],
    topQueries: [
      { question: 'Show me the AR aging — who owes more than 90 days?', dataSources: '/ascend/ar/aging', hint: 'Filter 90+ bucket, sort by amount descending' },
      { question: 'What journal entries were posted this period?', dataSources: '/ascend/gl/journal-entries + JournalEntryHeader SQL', hint: 'Filter by PostYear/PostPeriod, show UserID for audit' },
      { question: 'Trial balance for month-end close', dataSources: '/ascend/gl/trial-balance', hint: 'Current period, show BegBal + activity = EndBal' },
      { question: 'Which vendors have recurring payments?', dataSources: '/ascend/ap/recurring + /ascend/leases', hint: 'Show vendor, amount, frequency, GL account' },
      { question: 'How much sales tax did we collect by state?', dataSources: '/ascend/taxes/collected', hint: 'Group by TaxCode and Authority' },
      { question: 'Show me the income statement this period', dataSources: '/ascend/gl/income-statement', hint: 'Revenue - COGS - Expenses by section' },
      { question: 'AP vendor spend breakdown by GL account', dataSources: 'vPurchaseJournal', hint: 'Group by vendor_name + Account_Desc' },
      { question: 'Balance sheet as of this month', dataSources: '/ascend/gl/balance-sheet', hint: 'Assets = Liabilities + Equity' },
    ],
    samplePrompts: [
      'Show AR aging with any customers over 90 days past due',
      'What journal entries did lcowan post in March 2026?',
      'Pull the trial balance for period 3, 2026',
      'How much did we pay Vtex LLC last year? Break it down by month',
      'Show me all recurring lease and rent payments',
      'What taxes did we collect in Louisiana vs Texas this year?',
    ],
  },

  sales: {
    role: 'sales',
    persona: 'Sales Rep / Account Manager / Sales Director',
    jobFunction: 'Manages customer relationships, pipeline, and revenue growth. Needs CRM data (Salesforce), pricing intelligence, and customer financial history to close deals. Salesforce is the SINGLE SOURCE OF TRUTH — if it is not in Salesforce, it did not happen.',
    dailyChallenges: [
      'Pipeline management: which deals are moving, which are stalled',
      'Customer intelligence: what are they buying, what did we quote them',
      'Competitive pricing: what rack prices are today, what margins can I offer',
      'Account health: is the customer paying their invoices on time',
      'Activity tracking: logging calls, meetings, follow-ups — minimum 50-60/week depending on division',
      'Lead conversion: which leads should I prioritize',
      'KPI compliance: am I hitting visit targets, opportunity creation, and GP goals',
      'Rig check-ins (O&G Field): 30 per week (15 new + 15 existing)',
    ],
    topQueries: [
      { question: 'Show me my pipeline by stage', dataSources: '/salesforce/opportunities', hint: 'Group by StageName, sum Amount, show count per stage. Stages: Suspect (10%) → Prospect Analysis (20%) → Qualified → Closed Won / Closed Lost.' },
      { question: 'Who are the contacts at a specific account?', dataSources: '/salesforce/contacts + /salesforce/accounts', hint: 'Filter contacts by Account.Name, show title/email/phone' },
      { question: 'What did we last quote this customer?', dataSources: 'BillingChartQuery + ARInvoiceItem (recent invoices for that customer)', hint: 'Filter by CustomerName, show recent UnitPrice by product' },
      { question: 'Current rack prices for dyed diesel in my area', dataSources: 'vRackPrice', hint: 'Filter by state supply points, show today prices' },
      { question: 'Is this customer paying their bills?', dataSources: '/ascend/ar/aging + /customers/health', hint: 'Filter by customer name, show aging buckets. Also check Customer Health Score (0-100) at /api/customers/health — factors: payment behavior, volume trend, GP margin, activity recency. Reference the health grade (A-F) when discussing account status.' },
      { question: 'Am I hitting my KPIs this week/month?', dataSources: '/salesforce/tasks + /salesforce/events + /salesforce/opportunities', hint: 'Count activities by OwnerId for the period, compare against division targets. Commercial: 60 activities/week, 5 existing + 15 new visits/week, 4 opps/month, $20K-$40K new GP/month. Industrial: 50 activities/week, 1 new + 2 existing visits/week, 3 RFQ/month. O&G Field: 60 activities/week, 15+15 rig check-ins/week, 4 opps/month. O&G Corporate: 60 activities/week, 2 new + 4 existing visits/week, 2 RFP/month. Contractor: 60 activities/week, 2 existing + 3 new visits/week, 2 opps/month, $5K-$10K new GP/month.' },
      { question: 'What new leads came in this month?', dataSources: '/salesforce/leads', hint: 'Filter by CreatedDate, show status and source' },
      { question: 'Show my activity log — calls and meetings this week', dataSources: '/salesforce/tasks + /salesforce/events', hint: 'Filter by date range and owner. Activity types: Log a Call, Task (reminders only), New Event (visits, meetings, emails). Internal Event/Meeting excluded from external activity count.' },
    ],
    samplePrompts: [
      'Show my open pipeline sorted by close date',
      'Am I hitting my KPIs this month? Check activities, visits, and opportunities',
      'What did we last deliver to VLS Plaquemine and at what price?',
      'What are current DTN rack prices for dyed diesel in Louisiana?',
      'How many new customer visits have I logged this week?',
      'Does Ageron Energy have any past-due invoices?',
    ],
  },

  operations: {
    role: 'operations',
    persona: 'Dispatcher / Fleet Manager / Branch Manager / Field Ops',
    jobFunction: 'Manages fleet, drivers, deliveries, equipment, and tank assignments. Needs real-time GPS, vehicle status, equipment inventory, and delivery scheduling. Always work with what data IS available now — never suggest waiting for a service to come back or hedge on data availability. If an endpoint returns an error, pivot to alternative data sources.',
    dailyChallenges: [
      'Fleet tracking: where are my trucks right now?',
      'Driver management: who is available, who is on HOS break',
      'Equipment deployment: which tanks are assigned where, what is available',
      'Delivery planning: routing, scheduling, carrier assignment',
      'Maintenance: vehicle defects, service schedules',
      'Branch performance: volume by site, utilization rates',
    ],
    topQueries: [
      { question: 'Where are all my trucks right now?', dataSources: '/samsara/locations', hint: 'Show vehicle name, city, speed, heading for all 157 active GPS' },
      { question: 'Which drivers are on duty vs off duty?', dataSources: '/samsara/hos', hint: 'Show duty status durations, drive time remaining' },
      { question: 'What tanks do we have available vs deployed?', dataSources: '/ascend/tanks + /ascend/tanks/assignments', hint: 'Cross-reference tank inventory with assignments' },
      { question: 'Show me all equipment at a specific site', dataSources: '/ascend/equipment + /ascend/sites', hint: 'Filter by site code or location' },
      { question: 'Which carrier moved the most volume?', dataSources: 'BillingChartQuery (Carrier field)', hint: 'Group by Carrier, sum Qty' },
      { question: 'Fleet vehicle details — make, model, VIN', dataSources: '/samsara/vehicles', hint: 'Show all 160 vehicles with details' },
      { question: 'What geofences / yards do we have set up?', dataSources: '/samsara/addresses', hint: 'Show 326 geofence locations with names' },
    ],
    samplePrompts: [
      'Where are all our trucks right now? Show on a list with city and speed',
      'Which drivers are available to dispatch — not on HOS break?',
      'How many 3K double wall tanks do we have in inventory vs deployed?',
      'List all equipment at the Lake Charles branch',
      'Which carrier moved the most gallons this month?',
      'Show me vehicle fleet by make and model',
    ],
  },

  hr: {
    role: 'hr',
    persona: 'HR Manager / People Operations Lead',
    jobFunction: 'You manage employee records, headcount, departments, cost centers, and workforce analytics using Paylocity HR data.',
    dailyChallenges: [
      'Tracking headcount across departments and cost centers',
      'Monitoring employee onboarding and offboarding',
      'Analyzing labor costs by department',
      'Ensuring fleet driver records align with Samsara',
    ],
    topQueries: [
      { question: 'How many employees do we have by department?', dataSources: '/paylocity/employees + /paylocity/codes/departments', hint: 'Cross-reference employee records with department codes' },
      { question: 'Show me all active drivers and their employment status', dataSources: '/samsara/drivers + /paylocity/employees', hint: 'Match Samsara driver records to Paylocity employee data' },
      { question: 'What are our cost centers?', dataSources: '/paylocity/codes/costcenters', hint: 'List cost center codes with descriptions' },
    ],
    samplePrompts: [
      'Show me total headcount',
      'List all departments',
      'How many drivers are active?',
      'What are our cost centers?',
    ],
  },

  readonly: {
    role: 'readonly',
    persona: 'Auditor / Consultant / Board Member / New Employee',
    jobFunction: 'Read-only access to review data across all sources. Cannot modify anything. Needs summary-level data and the ability to drill into specifics.',
    dailyChallenges: [
      'Understanding the business: revenue, customers, fleet size, operations',
      'Audit queries: verifying financial data, tracing transactions',
      'Compliance review: HOS, tax, environmental',
      'Due diligence: evaluating business performance and health',
    ],
    topQueries: [
      { question: 'Give me an overview of the business', dataSources: 'Revenue + Customer count + Fleet size + Pipeline', hint: 'Pull KPIs from all sources for a business snapshot' },
      { question: 'Revenue trend over the last 2 years', dataSources: 'BillingChartQuery (monthly aggregation)', hint: 'Group by Year+Period, show trend' },
      { question: 'Top customers and their AR status', dataSources: '/ascend/customers/top + /ascend/ar/aging', hint: 'Cross-reference revenue leaders with payment behavior' },
    ],
    samplePrompts: [
      'Give me a high-level business overview — revenue, customers, fleet, pipeline',
      'How has revenue trended quarter over quarter for the last 2 years?',
      'Who are the top 10 customers and how is their AR aging?',
    ],
  },
};

/**
 * Build role-specific context for the system prompt
 */
export function buildRoleContext(role: UserRole): string {
  const ctx = ROLE_CONTEXTS[role];
  if (!ctx) return '';

  const parts = [
    `# Your User`,
    `Role: ${ctx.persona}`,
    `Job: ${ctx.jobFunction}`,
    '',
    `# What This User Typically Needs`,
    ...ctx.dailyChallenges.map(c => `- ${c}`),
    '',
    `# How to Help This User`,
    `When this user asks a question, think about what they are actually trying to accomplish:`,
  ];

  for (const q of ctx.topQueries) {
    parts.push(`- "${q.question}" → ${q.hint}`);
  }

  parts.push(
    '',
    `# Suggested Follow-up Questions for This Role`,
    `When generating follow-up questions, tailor them to this user's job:`,
    ...ctx.samplePrompts.slice(0, 4).map((p, i) => `${i + 1}. ${p}`),
  );

  return parts.join('\n');
}

/**
 * Get sample prompts for a role (used in the chat empty state)
 */
export function getRoleSamplePrompts(role: UserRole): string[] {
  return ROLE_CONTEXTS[role]?.samplePrompts ?? ROLE_CONTEXTS.admin.samplePrompts;
}
