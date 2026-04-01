/**
 * Nova Context: Intelligence
 * Vocabulary, schema, and query capabilities for the Intelligence / Analytics domain.
 * Covers: executive dashboard, cross-module analytics, anomaly detection, proactive briefing.
 */

import type { NovaContext } from './finance';

export const INTELLIGENCE_CONTEXT: NovaContext = {
  domain: 'intelligence',

  vocabulary: [
    'Executive dashboard — unified KPI view across Finance, Operations, Sales, and HR',
    'Market intelligence — external pricing, competitor, and commodity data surfaced in context',
    'Sales command — real-time pipeline, quota attainment, and rep performance view',
    'Customer 360 — single view of a customer across Ascend (billing), Salesforce (CRM), and Samsara (sites)',
    'Anomaly detection — automated pattern scanning across modules to surface outliers',
    'Proactive briefing — Nova-generated daily summary of what needs attention before user asks',
    'YoY (Year-over-Year) — period comparison to same period in prior fiscal year',
    'KPI — Key Performance Indicator; tracked with target, actual, and variance',
    'Trend — directional movement of a metric over time; up/down/flat',
    'Cross-module signal — an insight derived by joining data from two or more services',
    'Plugin — one of 86 weighted routing plugins in the DI chat system',
    'Gateway — 5-service API gateway at port 3847; the single source of truth for all live data',
    'EMA reweighting — exponential moving average applied to plugin performance scores',
    'Role-based view — dashboard and data filtered by MS SSO role (admin, sales, accounting, ops, hr, readonly)',
    'Permission boundary — data access enforced at gateway + chat + plugin layers',
  ],

  keyTables: [],

  queryPatterns: [
    'What needs my attention today?',
    'Show revenue trend for the last 6 months',
    'Compare sales performance YoY',
    'Which customers have the highest churn risk?',
    'Give me an executive summary of this week',
    'What anomalies were detected in the last 24 hours?',
    'Show me the top 10 customers by revenue',
    'Where are we vs. budget this quarter?',
    'What is the pipeline coverage ratio?',
    'Summarize the close checklist status',
    'Show cross-module activity for customer X',
    'Which modules have data quality issues?',
    'What is the rolling 12-month GP trend?',
    'Highlight anything that needs a decision today',
  ],

  availableActions: [
    'generate-executive-briefing — produce a structured daily summary across all modules',
    'run-anomaly-scan — check all data services for outliers vs. rolling baseline',
    'pull-customer-360 — assemble full customer profile from Ascend + Salesforce + Samsara',
    'view-kpi-dashboard — open the real-time KPI dashboard with drill-down',
    'compare-periods — run YoY or QoQ comparison for any metric',
    'export-management-report — package selected KPIs into a PDF briefing',
    'escalate-anomaly — flag a detected anomaly for human review with context',
    'run-plugin-analysis — invoke a specific DI plugin for targeted analysis',
  ],

  gatewayEndpoints: [
    'GET /ascend/revenue',
    'GET /ascend/gp/by-pc',
    'GET /ascend/customers/top',
    'GET /salesforce/opportunities',
    'GET /salesforce/accounts',
    'GET /samsara/locations',
    'GET /powerbi/reports',
    'POST /powerbi/query',
    'GET /microsoft/users',
    'POST /ascend/query',
    'POST /salesforce/query',
  ],
};
