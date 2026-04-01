/**
 * Sales Performance Knowledge Base
 *
 * Extracted from Delta360 Sales Performance Policy & KPI Standards,
 * Rep Activity Guide, and division-specific Salesforce Reporting Requirements.
 * Injected into the system prompt to teach the AI the sales process,
 * division KPIs, and how to evaluate rep performance.
 */

export interface DivisionKPIs {
  division: string;
  weeklyActivities: number;
  visits: { existing: number; new: number; unit: 'week' | 'month' };
  opportunities: { count: number; unit: 'month' | 'quarter'; type?: string };
  newAccounts: { count: number; unit: 'month' | 'quarter' };
  gpTarget: { min: number; max: number; unit: 'month' | 'account' };
  closeRate?: number;
  annualGPIncrease?: number;
  specialMetrics?: string[];
}

export const DIVISION_KPIS: Record<string, DivisionKPIs> = {
  commercial: {
    division: 'Commercial',
    weeklyActivities: 60,
    visits: { existing: 5, new: 15, unit: 'week' },
    opportunities: { count: 4, unit: 'month' },
    newAccounts: { count: 2, unit: 'month' },
    gpTarget: { min: 20000, max: 40000, unit: 'month' },
    closeRate: 0.35,
    annualGPIncrease: 20000,
    specialMetrics: [
      'Min $25K GP per account',
      '35% close rate target',
      'Must create 2 new customer accounts/month as Closed Won',
      'Visit notes required on all customer and prospect visits',
    ],
  },
  industrial: {
    division: 'Industrial',
    weeklyActivities: 50,
    visits: { existing: 2, new: 1, unit: 'week' },
    opportunities: { count: 3, unit: 'month', type: 'RFQ' },
    newAccounts: { count: 1, unit: 'quarter' },
    gpTarget: { min: 250000, max: 250000, unit: 'account' },
    specialMetrics: [
      'If <5 new prospects, expand to 10 total engagements/week',
      '4 new + 8 existing target accounts identified/month',
      '2 RFP opportunities/quarter',
      '3 RFQ opportunities/month',
      'Target accounts must be tagged in Salesforce',
    ],
  },
  ogField: {
    division: 'O&G Field',
    weeklyActivities: 60,
    visits: { existing: 15, new: 15, unit: 'week' },
    opportunities: { count: 4, unit: 'month' },
    newAccounts: { count: 1, unit: 'month' },
    gpTarget: { min: 328000, max: 328000, unit: 'account' },
    specialMetrics: [
      '15 new rig check-ins/week + 15 existing rig check-ins/week',
      'Rig check-ins logged separately from regular visits',
      'Must include supply opportunities and service needs in notes',
      'All field interactions at drilling/production sites individually documented',
    ],
  },
  ogCorporate: {
    division: 'O&G Corporate',
    weeklyActivities: 60,
    visits: { existing: 4, new: 2, unit: 'week' },
    opportunities: { count: 2, unit: 'month', type: 'RFP' },
    newAccounts: { count: 1, unit: 'month' },
    gpTarget: { min: 328000, max: 328000, unit: 'account' },
    specialMetrics: [
      '8 new customer visits/month + 16 existing customer visits/month',
      '2 RFP opportunities/month',
      '2 RFQ opportunities/quarter',
      '1 new account closed/quarter with full documentation',
    ],
  },
  contractor: {
    division: 'Contractor',
    weeklyActivities: 60,
    visits: { existing: 2, new: 3, unit: 'week' },
    opportunities: { count: 2, unit: 'month' },
    newAccounts: { count: 1, unit: 'month' },
    gpTarget: { min: 5000, max: 10000, unit: 'month' },
    annualGPIncrease: 10000,
    specialMetrics: [
      '$5K-$10K monthly new GP',
      '$10K annual GP increase YoY',
      '1 new customer opportunity as Closed Won/month',
    ],
  },
};

/**
 * Sales team roster with cross-system IDs.
 * sfId = Salesforce User ID, spId = Ascend SalespersonID, code = Ascend Salesperson Code.
 */
export const SALES_ROSTER: Array<{
  name: string;
  division: string;
  manager: string | null;
  sfId: string;
  spId: number | null;
  code: number | null;
}> = [
  // Commercial
  { name: 'Ashley Hadwin', division: 'commercial', manager: 'Robert Stewart', sfId: '005Hu00000S21e0IAB', spId: 1062, code: 159 },
  { name: 'Scott Taylor', division: 'commercial', manager: 'Carson Greer', sfId: '005Hu00000S21eoIAB', spId: 1114, code: 213 },
  { name: 'Megan Owen', division: 'commercial', manager: 'Carson Greer', sfId: '005cx000001YO5lAAG', spId: 1148, code: 237 },
  { name: 'Brandon Thornton', division: 'commercial', manager: 'Carson Greer', sfId: '005cx0000021WntAAE', spId: 1152, code: 241 },
  { name: 'Brian McCaskill', division: 'commercial', manager: 'Carson Greer', sfId: '005cx0000021cBlAAI', spId: 1153, code: 242 },
  { name: 'Nathan Green', division: 'commercial', manager: 'Carson Greer', sfId: '005cx000001f2gPAAQ', spId: 1149, code: 238 },
  { name: 'Cody McLelland', division: 'commercial', manager: 'Carson Greer', sfId: '005cx000002D7c1AAC', spId: 1155, code: 243 },
  { name: 'Peet Booysen', division: 'commercial', manager: 'Robert Stewart', sfId: '005Hu00000S21eUIAR', spId: 1008, code: 106 },
  { name: 'Alexis Deaton', division: 'commercial', manager: 'Carson Greer', sfId: '005cx000000zyAYAAY', spId: 1140, code: 232 },
  // Contractor
  { name: 'Layla McCall', division: 'contractor', manager: 'Russ Mason', sfId: '005cx0000024oEnAAI', spId: 1150, code: 239 },
  { name: 'Russ Mason', division: 'contractor', manager: 'Russ Mason', sfId: '005Hu00000S21eeIAB', spId: 1099, code: 191 },
  { name: 'Chad Sheppard', division: 'contractor', manager: 'Russ Mason', sfId: '005cx0000013cUnAAI', spId: 1017, code: 121 },
  { name: 'Sam Ferguson', division: 'contractor', manager: 'Russ Mason', sfId: '005Hu00000S2GVlIAN', spId: 1009, code: 107 },
  { name: 'Wayne Tramel', division: 'contractor', manager: 'Russ Mason', sfId: '005Hu00000S2G9GIAV', spId: 1109, code: 206 },
  // Industrial
  { name: 'George Leiato', division: 'industrial', manager: 'Adam Vegas', sfId: '005Hu00000S21eAIAR', spId: 1110, code: 208 },
  { name: 'Leslie Whisenhant', division: 'industrial', manager: 'Adam Vegas', sfId: '005Hu00000S21eFIAR', spId: 1095, code: 188 },
  { name: 'Barry Iseminger', division: 'industrial', manager: 'Adam Vegas', sfId: '005Hu00000S2FF5IAN', spId: 1029, code: 203 },
  // O&G Field
  { name: 'Ashlee Hey', division: 'ogField', manager: 'Matt Gulledge', sfId: '005Hu00000S1SXfIAN', spId: 1101, code: 193 },
  { name: 'Patience Hill', division: 'ogField', manager: 'Matt Gulledge', sfId: '005cx000004xgYnAAI', spId: 1159, code: 246 },
  { name: 'Anna Snodgrass', division: 'ogField', manager: 'Matt Gulledge', sfId: '005Hu00000S2EZPIA3', spId: 1126, code: 222 },
  // O&G Corporate
  { name: 'Matt Gulledge', division: 'ogCorporate', manager: 'Matt Gulledge', sfId: '005cx0000016HSDAA2', spId: 1139, code: 231 },
];

/**
 * Sales managers
 */
export const SALES_MANAGERS = [
  { name: 'Carson Greer', division: 'commercial', directReports: 7 },
  { name: 'Robert Stewart', division: 'commercial', directReports: 2 },
  { name: 'Russ Mason', division: 'contractor', directReports: 4 },
  { name: 'Adam Vegas', division: 'industrial', directReports: 3 },
  { name: 'Matt Gulledge', division: 'ogField + ogCorporate', directReports: 3 },
];

/**
 * Build the sales knowledge prompt section for system prompt injection.
 * This teaches the AI the complete sales process, KPIs by division,
 * and how to evaluate rep performance using Salesforce data.
 */
export function buildSalesKnowledgePrompt(): string {
  const parts = [
    `# Delta360 Sales Performance Standards`,
    ``,
    `## Core Principle`,
    `Salesforce is the SINGLE SOURCE OF TRUTH for all sales activity, pipeline, and customer development data. If it is not in Salesforce, it did not happen. Leadership evaluates performance, forecasts revenue, and makes operational decisions based on Salesforce data.`,
    ``,
    `## Division KPI Targets`,
    ``,
  ];

  for (const [, kpi] of Object.entries(DIVISION_KPIS)) {
    const gpStr = kpi.gpTarget.min === kpi.gpTarget.max
      ? `$${(kpi.gpTarget.min / 1000).toFixed(0)}K/${kpi.gpTarget.unit}`
      : `$${(kpi.gpTarget.min / 1000).toFixed(0)}K-$${(kpi.gpTarget.max / 1000).toFixed(0)}K/${kpi.gpTarget.unit}`;

    parts.push(`### ${kpi.division}`);
    parts.push(`- Weekly SF activities: ${kpi.weeklyActivities}`);
    parts.push(`- Visits/${kpi.visits.unit}: ${kpi.visits.existing} existing + ${kpi.visits.new} new`);
    parts.push(`- Opportunities: ${kpi.opportunities.count}/${kpi.opportunities.unit}${kpi.opportunities.type ? ` (${kpi.opportunities.type})` : ''}`);
    parts.push(`- New accounts: ${kpi.newAccounts.count}/${kpi.newAccounts.unit}`);
    parts.push(`- GP target: ${gpStr}`);
    if (kpi.closeRate) parts.push(`- Close rate: ${(kpi.closeRate * 100).toFixed(0)}%`);
    if (kpi.annualGPIncrease) parts.push(`- Annual GP increase: $${(kpi.annualGPIncrease / 1000).toFixed(0)}K YoY`);
    if (kpi.specialMetrics) {
      for (const m of kpi.specialMetrics) {
        parts.push(`- ${m}`);
      }
    }
    parts.push(``);
  }

  parts.push(`## Salesforce Activity Types`);
  parts.push(`- New Event: PRIMARY place to log visits, meetings, emails that HAVE taken place`);
  parts.push(`- Log a Call: phone calls (count toward activities, NOT visits)`);
  parts.push(`- Task: reminders/to-dos ONLY — never use to log past activities`);
  parts.push(`- Internal Event/Meeting: excluded from external activity count`);
  parts.push(`- Rig Check-In: O&G Field specific, tracked separately`);
  parts.push(``);
  parts.push(`## Opportunity Pipeline`);
  parts.push(`Stages: Suspect (10%) → Prospect Analysis (20%) → Qualified → Closed Won / Closed Lost`);
  parts.push(`Reps must update stage, expected close date, and estimated GP at each progression.`);
  parts.push(`Close rate = Closed Won / (Closed Won + Closed Lost)`);
  parts.push(``);
  parts.push(`## Sales Team Roster`);
  parts.push(`| Rep | Division | Manager | SF OwnerId | Ascend spId |`);
  parts.push(`|-----|----------|---------|------------|-------------|`);
  for (const rep of SALES_ROSTER) {
    parts.push(`| ${rep.name} | ${rep.division} | ${rep.manager ?? 'N/A'} | ${rep.sfId} | ${rep.spId ?? 'N/A'} |`);
  }
  parts.push(``);
  parts.push(`## Sales Managers`);
  for (const mgr of SALES_MANAGERS) {
    parts.push(`- ${mgr.name}: ${mgr.division} (${mgr.directReports} direct reports)`);
  }
  parts.push(``);
  parts.push(`## Evaluating Rep Performance`);
  parts.push(`When asked about KPIs or rep performance:`);
  parts.push(`1. Identify the rep's division from the roster above`);
  parts.push(`2. Pull their Salesforce activity count using OwnerId for the period (Events + Tasks + Calls)`);
  parts.push(`3. Pull their visit count (Events with visit-related subjects)`);
  parts.push(`4. Pull their opportunity count and stages`);
  parts.push(`5. Compare actual numbers against the division targets above`);
  parts.push(`6. Flag any metrics below target with specific shortfall amounts`);
  parts.push(`7. Cross-reference with Ascend revenue data using spId (Ascend Salesperson field in BillingChartQuery) for GP validation`);
  parts.push(`8. For rig check-ins (O&G Field only): query Check_In__c custom object`);
  parts.push(``);
  parts.push(`## Compliance Scoring`);
  parts.push(`Score each KPI as actual/target (capped at 1.0). For range KPIs (e.g. GP $20K-$40K):`);
  parts.push(`- Below min: score = actual/min * 0.5`);
  parts.push(`- Between min-max: score = 0.5 + 0.5*(actual-min)/(max-min)`);
  parts.push(`- At or above max: score = 1.0`);
  parts.push(`Overall compliance = average of all KPI scores.`);
  parts.push(`Status: Meeting Standards (>=85%), Close to Standards (50-84%), Below Standards (15-49%), Critical (<15%)`);
  parts.push(``);
  parts.push(`## Scorecard Cross-Reference`);
  parts.push(`The Delta360 Sales Scorecard app (~/delta360/scorecard, port 3005) uses the same KPI definitions and compliance thresholds. When users ask about scorecard data, the same formulas and targets apply. The scorecard pulls live from Salesforce and Ascend via the unified gateway.`);

  return parts.join('\n');
}
