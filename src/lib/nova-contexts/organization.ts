/**
 * Nova Context: Organization
 * Vocabulary, schema, and query capabilities for the Organization / HR domain.
 * Covers: org chart, people directory, Paylocity HR data, MS Graph, workstreams.
 */

import type { NovaContext } from './finance';

export const ORGANIZATION_CONTEXT: NovaContext = {
  domain: 'organization',

  vocabulary: [
    'Org chart — manager hierarchy sourced from MS Graph Azure AD',
    'MS Graph — Microsoft identity and directory service; provides user profiles and reporting lines',
    'Paylocity — HR and payroll platform; source of employee records, time-off, and compensation',
    'People directory — unified employee list combining MS Graph (identity) and Paylocity (HR data)',
    'Workstream — a named operational function with an owner and associated team members',
    'Department — organizational grouping in Azure AD aligned to business function',
    'Manager hierarchy — chain of reporting from individual contributor to CEO',
    'Headcount — total active employee count; currently 37 employees',
    'Direct reports — employees who report to a given manager',
    'Role — job title or functional role assigned in Azure AD',
    'HR KPI — key metrics: headcount, turnover rate, time-to-hire, open positions',
    'Turnover — number of departures in a period; tracked as voluntary vs. involuntary',
    'Time-off — PTO, sick leave, and other leave types tracked in Paylocity',
    'Payroll period — bi-weekly or semi-monthly pay cycle managed in Paylocity',
    'Onboarding — new hire process tracked against a checklist with completion milestones',
  ],

  keyTables: [
    'MSGraphUser — id, displayName, mail, jobTitle, department, managerId, officeLocation',
    'PaylocityEmployee — employeeId, firstName, lastName, department, hireDate, status, payRate',
    'OrgNode — derived org chart node with manager chain computed from MS Graph',
  ],

  queryPatterns: [
    'Who reports to Adam Vegas?',
    'Show the full org chart',
    'How many employees do we have?',
    'Who is in the accounting department?',
    'Show HR KPIs for this quarter',
    'What is the headcount by department?',
    'Who is the manager for person X?',
    'List all employees hired in the last 6 months',
    'Show open positions',
    'What is the current turnover rate?',
    "Who is on leave this week?",
    'Show payroll summary for the last period',
    'What workstreams does the ops team own?',
  ],

  availableActions: [
    'view-org-chart — render interactive org chart from MS Graph hierarchy',
    'pull-employee-profile — retrieve full profile combining MS Graph + Paylocity for one person',
    'run-headcount-report — aggregate headcount by department and compare to prior period',
    'check-open-positions — list unfilled roles with days-open and hiring owner',
    'export-directory — generate a people directory export with contact info and roles',
    'view-hr-kpis — display headcount, turnover, time-to-hire, and retention on dashboard',
    'check-leave-calendar — show who is on leave for a given date range',
  ],

  gatewayEndpoints: [
    'GET /microsoft/users',
    'GET /microsoft/sites',
    'GET /microsoft/search',
    'GET /paylocity/employees',
    'GET /paylocity/timeoff',
    'GET /paylocity/payroll',
  ],
};
