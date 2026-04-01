/**
 * Master catalog of all available widgets users can add to custom dashboards.
 *
 * Each entry maps to a LiveWidgetConfig and carries metadata for the picker UI.
 * The requiredServices field gates visibility by role — only roles whose
 * ROLES[role].services superset contains ALL requiredServices can add the widget.
 */

import type { LiveWidgetConfig } from '@/components/dashboard/LiveWidget';

const YEAR = new Date().getFullYear();

// ── Catalog Item Type ──────────────────────────────────────────────

export type WidgetCatalogCategory =
  | 'financial'
  | 'sales'
  | 'fleet'
  | 'operations'
  | 'custom';

export interface WidgetCatalogItem {
  /** Stable identifier — used as the key in saved dashboard layouts */
  id: string;
  /** Display name shown in the picker */
  name: string;
  /** Short description shown in the picker card */
  description: string;
  /** Display type — matches LiveWidgetConfig.type */
  type: LiveWidgetConfig['type'];
  /** Logical grouping for the picker UI */
  category: WidgetCatalogCategory;
  /**
   * Which gateway services this widget requires.
   * Checked against ROLES[role].services — ALL must be present
   * for the widget to be enabled for that role.
   */
  requiredServices: string[];
  /** The LiveWidgetConfig to pass directly to <LiveWidget /> */
  config: LiveWidgetConfig;
}

// ── Financial ─────────────────────────────────────────────────────

const FINANCIAL_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-fin-rev-ytd',
    name: 'Revenue YTD',
    description: 'Total invoiced revenue from January through current month.',
    type: 'kpi',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-rev-ytd',
      type: 'kpi',
      title: 'Revenue YTD',
      query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
      valueKey: 'Revenue',
      format: 'currency',
      subtitle: `GL Revenue | ${YEAR}`,
    },
  },
  {
    id: 'cat-fin-gp-ytd',
    name: 'Gross Profit YTD',
    description: 'Gross profit earned year to date across all profit centers.',
    type: 'kpi',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-gp-ytd',
      type: 'kpi',
      title: 'Gross Profit YTD',
      query: { sql: `SELECT SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin')` },
      valueKey: 'GP',
      format: 'currency',
      subtitle: `Revenue - COGS | ${YEAR}`,
    },
  },
  {
    id: 'cat-fin-gp-margin',
    name: 'GP Margin',
    description: 'Gross profit margin as a percentage of revenue YTD.',
    type: 'gauge',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-gp-margin',
      type: 'kpi',
      title: 'GP Margin',
      query: { sql: `SELECT CASE WHEN SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) > 0 THEN ROUND(SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) * 100.0 / SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END), 1) ELSE 0 END AS GPMargin FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin')` },
      valueKey: 'GPMargin',
      format: 'percent',
      subtitle: 'Gross margin %',
    },
  },
  {
    id: 'cat-fin-ar-outstanding',
    name: 'AR Outstanding',
    description: 'Total accounts receivable balance — open, active, and partial invoices.',
    type: 'kpi',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-ar-outstanding',
      type: 'kpi',
      title: 'AR Outstanding',
      query: {
        sql: "SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0",
      },
      valueKey: 'Total',
      format: 'currency',
      subtitle: 'Open + Active + Partial',
    },
  },
  {
    id: 'cat-fin-ar-90plus',
    name: 'AR Over 90 Days',
    description: 'Receivables past 90 days — highest collection risk bucket.',
    type: 'kpi',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-ar-90plus',
      type: 'kpi',
      title: 'AR Over 90 Days',
      query: {
        sql: "SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90",
      },
      valueKey: 'Total',
      format: 'currency',
      subtitle: 'Past 90 days',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-ar-aging',
    name: 'AR Aging by Customer',
    description: 'Bucketed AR aging (0-30, 31-60, 61-90, 90+) for top 15 customers.',
    type: 'table',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-ar-aging',
      type: 'table',
      title: 'AR Aging by Customer',
      query: {
        sql: `SELECT TOP 15
                CustomerName,
                SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) <= 30 THEN ADOTotalStillDue ELSE 0 END) AS [0-30],
                SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 31 AND 60 THEN ADOTotalStillDue ELSE 0 END) AS [31-60],
                SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 61 AND 90 THEN ADOTotalStillDue ELSE 0 END) AS [61-90],
                SUM(CASE WHEN DATEDIFF(day, InvoiceDt, GETDATE()) > 90 THEN ADOTotalStillDue ELSE 0 END) AS [90+]
              FROM ARInvoice
              WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0
              GROUP BY CustomerName
              ORDER BY [90+] DESC`,
      },
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-rev-by-month',
    name: 'Revenue by Month',
    description: 'Monthly revenue trend chart for the current year.',
    type: 'chart',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-rev-by-month',
      type: 'chart',
      title: `Revenue by Month ${YEAR}`,
      query: {
        sql: `SELECT
                MONTH(InvoiceDt) AS Mo,
                DATENAME(MONTH, InvoiceDt) AS Month,
                SUM(i.Qty * i.UnitPrice) AS Revenue
              FROM DF_PBI_BillingChartQuery b
              JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
              WHERE b.Year = ${YEAR}
              GROUP BY MONTH(InvoiceDt), DATENAME(MONTH, InvoiceDt)
              ORDER BY Mo`,
      },
      chartType: 'line',
      labelKey: 'Month',
      valueKey: 'Revenue',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-top-vendors',
    name: 'Top Vendors by Spend',
    description: 'Ranked list of vendors by total AP spend this year.',
    type: 'list',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-top-vendors',
      type: 'list',
      title: 'Top Vendors by Spend',
      query: {
        sql: `SELECT TOP 10
                VendorName,
                SUM(InvoiceAmt) AS Spend
              FROM APInvoice
              WHERE YEAR(InvoiceDt) = ${YEAR}
              GROUP BY VendorName
              ORDER BY Spend DESC`,
      },
      labelKey: 'VendorName',
      valueKey: 'Spend',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-top-customers-gp',
    name: 'Top Customers by GP',
    description: 'Top 10 customers ranked by gross profit contribution this year.',
    type: 'list',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-top-customers-gp',
      type: 'list',
      title: 'Top 10 Customers by GP',
      query: {
        sql: `SELECT TOP 10
                b.CustomerName,
                SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost, 0))) AS GP
              FROM DF_PBI_BillingChartQuery b
              JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
              WHERE b.Year = ${YEAR} AND i.Total_UnitCost > 0
              GROUP BY b.CustomerName
              ORDER BY GP DESC`,
      },
      labelKey: 'CustomerName',
      valueKey: 'GP',
      format: 'currency',
      refreshInterval: 600,
    },
  },
];

// ── Financial (Visual) ───────────────────────────────────────────

const FINANCIAL_VISUAL_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-fin-rev-trend-area',
    name: 'Revenue Trend (Area)',
    description: 'Area chart showing monthly revenue trend for the current year.',
    type: 'area',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-rev-trend-area',
      type: 'area',
      title: `Revenue Trend ${YEAR}`,
      query: {
        sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND AccountGroup = 'Revenue' AND Period BETWEEN 1 AND 12 GROUP BY Period ORDER BY Period`,
      },
      labelKey: 'Month',
      valueKey: 'Revenue',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-budget-vs-actual',
    name: 'Budget vs Actual',
    description: 'Stacked bar comparing budget against actual spend by period.',
    type: 'stackedbar',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-budget-vs-actual',
      type: 'stackedbar',
      title: `Budget vs Actual ${YEAR}`,
      query: {
        sql: `SELECT Period AS Month, SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) AS Revenue, SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS COGS FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 GROUP BY Period ORDER BY Period`,
      },
      labelKey: 'Month',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-cashflow-area',
    name: 'Cash Flow Trend',
    description: 'Area chart showing cash flow trend over recent months.',
    type: 'area',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-cashflow-area',
      type: 'area',
      title: 'Cash Flow Trend',
      query: {
        sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS CashFlow FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue' GROUP BY Period ORDER BY Period`,
      },
      labelKey: 'Month',
      valueKey: 'CashFlow',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-expense-donut',
    name: 'Expense Distribution',
    description: 'Donut chart showing expense breakdown by account group.',
    type: 'pie',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-expense-donut',
      type: 'pie',
      title: 'Expense Distribution',
      query: {
        sql: `SELECT TOP 8 AccountGroup AS Category, SUM(ABS(Period_Balance)) AS Amount FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup NOT IN ('Revenue') GROUP BY AccountGroup ORDER BY Amount DESC`,
      },
      labelKey: 'Category',
      valueKey: 'Amount',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fin-ar-aging-hbar',
    name: 'AR Aging Buckets',
    description: 'Horizontal bar showing receivables distribution across aging buckets.',
    type: 'chart',
    category: 'financial',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fin-ar-aging-hbar',
      type: 'chart',
      title: 'AR Aging Buckets',
      query: {
        sql: `SELECT '0-30' AS Bucket, SUM(ADOTotalStillDue) AS Amount FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) <= 30 UNION ALL SELECT '31-60', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 31 AND 60 UNION ALL SELECT '61-90', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) BETWEEN 61 AND 90 UNION ALL SELECT '90+', SUM(ADOTotalStillDue) FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90`,
      },
      chartType: 'bar',
      labelKey: 'Bucket',
      valueKey: 'Amount',
      format: 'currency',
      refreshInterval: 600,
    },
  },
];

// ── Sales ─────────────────────────────────────────────────────────

const SALES_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-sales-pipeline-total',
    name: 'Pipeline Total',
    description: 'Sum of all open opportunity amounts in Salesforce.',
    type: 'kpi',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-pipeline-total',
      type: 'kpi',
      title: 'Open Pipeline',
      query: { soql: 'SELECT SUM(Amount) total FROM Opportunity WHERE IsClosed = false' },
      valueKey: 'total',
      format: 'currency',
      subtitle: 'All open opportunities',
    },
  },
  {
    id: 'cat-sales-pipeline-stages',
    name: 'Pipeline by Stage',
    description: 'Bar chart breaking down open pipeline value by sales stage.',
    type: 'chart',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-pipeline-stages',
      type: 'chart',
      title: 'Pipeline by Stage',
      query: {
        soql: 'SELECT StageName, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName',
      },
      chartType: 'bar',
      labelKey: 'StageName',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-sales-open-opps',
    name: 'Open Opportunities',
    description: 'Count of all active open deals in the pipeline.',
    type: 'kpi',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-open-opps',
      type: 'kpi',
      title: 'Open Opportunities',
      query: { soql: 'SELECT COUNT(Id) cnt FROM Opportunity WHERE IsClosed = false' },
      valueKey: 'cnt',
      format: 'number',
      subtitle: 'Active deals',
    },
  },
  {
    id: 'cat-sales-closed-won',
    name: 'Closed Won This Month',
    description: 'Revenue from opportunities closed-won in the current calendar month.',
    type: 'kpi',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-closed-won',
      type: 'kpi',
      title: 'Closed Won This Month',
      query: {
        soql: `SELECT SUM(Amount) total FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR} AND CALENDAR_MONTH(CloseDate) = ${new Date().getMonth() + 1}`,
      },
      valueKey: 'total',
      format: 'currency',
      subtitle: `${new Date().toLocaleString('en-US', { month: 'long' })} ${YEAR}`,
    },
  },
  {
    id: 'cat-sales-top-customers',
    name: 'Top Customers by GP',
    description: 'Ranked list of Salesforce accounts by open pipeline value.',
    type: 'list',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-top-customers',
      type: 'list',
      title: 'Top Accounts by Pipeline',
      query: {
        soql: 'SELECT Account.Name, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY Account.Name ORDER BY total DESC LIMIT 10',
      },
      labelKey: 'Name',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-sales-new-leads',
    name: 'New Leads This Week',
    description: 'Count of new leads created in Salesforce in the last 7 days.',
    type: 'kpi',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-new-leads',
      type: 'kpi',
      title: 'New Leads This Week',
      query: {
        soql: 'SELECT COUNT(Id) cnt FROM Lead WHERE CreatedDate = LAST_N_DAYS:7',
      },
      valueKey: 'cnt',
      format: 'number',
      subtitle: 'Last 7 days',
    },
  },
  {
    id: 'cat-sales-win-rate',
    name: 'Win Rate',
    description: 'Gauge showing percentage of closed deals that were won this year.',
    type: 'gauge',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-win-rate',
      type: 'gauge',
      title: 'Pipeline Win Rate',
      query: {
        soql: `SELECT
                 (SELECT COUNT() FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}) wins,
                 (SELECT COUNT() FROM Opportunity WHERE IsClosed = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}) total`,
      },
      valueKey: 'wins',
      format: 'percent',
      subtitle: `${YEAR} closed deals`,
      refreshInterval: 3600,
    },
  },
];

// ── Sales (Visual) ───────────────────────────────────────────────

const SALES_VISUAL_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-sales-pipeline-stacked',
    name: 'Pipeline by Stage (Stacked)',
    description: 'Stacked bar chart of pipeline value grouped by sales stage.',
    type: 'stackedbar',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-pipeline-stacked',
      type: 'stackedbar',
      title: 'Pipeline by Stage',
      query: {
        soql: 'SELECT StageName, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY total DESC',
      },
      labelKey: 'StageName',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-sales-rev-by-rep',
    name: 'Revenue by Sales Rep',
    description: 'Horizontal bar chart showing closed-won revenue per sales rep.',
    type: 'chart',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-rev-by-rep',
      type: 'chart',
      title: 'Revenue by Sales Rep',
      query: {
        soql: `SELECT Owner.Name, SUM(Amount) total FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR} GROUP BY Owner.Name ORDER BY total DESC LIMIT 10`,
      },
      chartType: 'bar',
      labelKey: 'Name',
      valueKey: 'total',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-sales-customer-trend',
    name: 'Customer Count Trend',
    description: 'Line chart showing customer acquisition trend by month.',
    type: 'chart',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-customer-trend',
      type: 'chart',
      title: 'New Customers by Month',
      query: {
        soql: `SELECT CALENDAR_MONTH(CreatedDate) Mo, COUNT(Id) cnt FROM Account WHERE CALENDAR_YEAR(CreatedDate) = ${YEAR} GROUP BY CALENDAR_MONTH(CreatedDate) ORDER BY Mo`,
      },
      chartType: 'line',
      labelKey: 'Mo',
      valueKey: 'cnt',
      format: 'number',
      refreshInterval: 3600,
    },
  },
  {
    id: 'cat-sales-winloss-donut',
    name: 'Win/Loss Ratio',
    description: 'Donut chart showing won vs lost opportunity distribution.',
    type: 'pie',
    category: 'sales',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-sales-winloss-donut',
      type: 'pie',
      title: 'Win/Loss Ratio',
      query: {
        soql: `SELECT CASE WHEN IsWon = true THEN 'Won' ELSE 'Lost' END AS Result, COUNT(Id) cnt FROM Opportunity WHERE IsClosed = true AND CALENDAR_YEAR(CloseDate) = ${YEAR} GROUP BY IsWon`,
      },
      labelKey: 'Result',
      valueKey: 'cnt',
      format: 'number',
      refreshInterval: 3600,
    },
  },
];

// ── Fleet ─────────────────────────────────────────────────────────

const FLEET_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-fleet-vehicle-count',
    name: 'Vehicle Count',
    description: 'Total number of vehicles tracked in Samsara.',
    type: 'kpi',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-vehicle-count',
      type: 'kpi',
      title: 'Fleet Vehicles',
      endpoint: '/samsara/vehicles',
      countArray: true,
      format: 'number',
      subtitle: 'Samsara — all vehicles',
    },
  },
  {
    id: 'cat-fleet-active-drivers',
    name: 'Active Drivers',
    description: 'Count of all active driver records in Samsara.',
    type: 'kpi',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-active-drivers',
      type: 'kpi',
      title: 'Active Drivers',
      endpoint: '/samsara/drivers',
      countArray: true,
      format: 'number',
      subtitle: 'Samsara — all drivers',
    },
  },
  {
    id: 'cat-fleet-vehicle-list',
    name: 'Vehicle List',
    description: 'Table of all vehicles with current status from Samsara.',
    type: 'table',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-vehicle-list',
      type: 'table',
      title: 'Vehicle List',
      endpoint: '/samsara/vehicles',
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-fleet-utilization',
    name: 'Fleet Utilization',
    description: 'Gauge showing the percentage of fleet currently dispatched.',
    type: 'gauge',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-utilization',
      type: 'gauge',
      title: 'Fleet Utilization',
      endpoint: '/samsara/vehicles',
      countArray: true,
      format: 'percent',
      subtitle: 'Vehicles dispatched vs total',
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-fleet-safety-events',
    name: 'Safety Events',
    description: 'Recent driver safety events from Samsara — harsh braking, speeding, distraction, collisions.',
    type: 'list',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-safety-events',
      type: 'list',
      title: 'Recent Safety Events',
      endpoint: '/samsara/alerts',
      labelKey: 'driver.name',
      valueKey: 'maxAccelerationGForce',
      format: 'number',
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-fleet-safety-by-driver',
    name: 'Safety Events by Driver',
    description: 'Bar chart showing safety event count per driver — identifies coaching needs.',
    type: 'chart',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-safety-by-driver',
      type: 'chart',
      title: 'Safety Events by Driver',
      endpoint: '/samsara/alerts',
      chartType: 'bar',
      labelKey: 'driver.name',
      valueKey: 'maxAccelerationGForce',
      format: 'number',
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-fleet-health-score',
    name: 'Fleet Health Score',
    description: 'Gauge showing overall fleet safety health based on critical event ratio.',
    type: 'gauge',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-health-score',
      type: 'gauge',
      title: 'Fleet Health Score',
      endpoint: '/samsara/alerts',
      countArray: true,
      format: 'percent',
      subtitle: 'Based on critical event ratio',
      refreshInterval: 300,
    },
  },
];

// ── Operations ────────────────────────────────────────────────────

const OPERATIONS_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-ops-rack-price',
    name: "Today's Rack Price",
    description: 'Latest posted Diesel Dyed rack price from the ERP.',
    type: 'kpi',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-rack-price',
      type: 'kpi',
      title: "Today's Rack",
      query: {
        sql: "SELECT TOP 1 RackPrice, EffDtTm FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC",
      },
      valueKey: 'RackPrice',
      format: 'price',
      subtitle: 'Diesel Dyed — latest',
      refreshInterval: 900,
    },
  },
  {
    id: 'cat-ops-invoice-volume',
    name: 'Invoice Volume',
    description: 'Number of invoices created in the current calendar month.',
    type: 'kpi',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-invoice-volume',
      type: 'kpi',
      title: 'Invoices This Month',
      query: {
        sql: `SELECT COUNT(*) AS Count
              FROM ARInvoice
              WHERE MONTH(InvoiceDt) = MONTH(GETDATE())
                AND YEAR(InvoiceDt) = ${YEAR}`,
      },
      valueKey: 'Count',
      format: 'number',
      subtitle: 'Current month',
    },
  },
  {
    id: 'cat-ops-invoice-by-month',
    name: 'Invoice Volume by Month',
    description: 'Bar chart of monthly invoice counts for the current year.',
    type: 'chart',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-invoice-by-month',
      type: 'chart',
      title: 'Invoice Volume by Month',
      query: {
        sql: `SELECT
                DATENAME(MONTH, InvoiceDt) AS Month,
                MONTH(InvoiceDt) AS Mo,
                COUNT(*) AS Invoices
              FROM ARInvoice
              WHERE YEAR(InvoiceDt) = ${YEAR}
              GROUP BY MONTH(InvoiceDt), DATENAME(MONTH, InvoiceDt)
              ORDER BY Mo`,
      },
      chartType: 'bar',
      labelKey: 'Month',
      valueKey: 'Invoices',
      format: 'number',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-ops-top-customers-volume',
    name: 'Top Customers by Volume',
    description: 'Top 10 customers ranked by gallons delivered year to date.',
    type: 'list',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-top-customers-volume',
      type: 'list',
      title: 'Top Customers by Volume',
      query: {
        sql: `SELECT TOP 10
                b.CustomerName,
                SUM(i.Qty) AS Gallons
              FROM DF_PBI_BillingChartQuery b
              JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
              WHERE b.Year = ${YEAR}
              GROUP BY b.CustomerName
              ORDER BY Gallons DESC`,
      },
      labelKey: 'CustomerName',
      valueKey: 'Gallons',
      format: 'number',
      subtitle: 'Gallons delivered YTD',
      refreshInterval: 600,
    },
  },
];

// ── Fleet (Visual) ───────────────────────────────────────────────

const FLEET_VISUAL_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-fleet-fuel-trend',
    name: 'Fuel Cost Trend',
    description: 'Area chart showing fuel expenditure over recent months.',
    type: 'area',
    category: 'fleet',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-fleet-fuel-trend',
      type: 'area',
      title: 'Fuel Cost Trend',
      query: {
        sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS FuelCost FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND Account_Desc LIKE '%Fuel%' GROUP BY Period ORDER BY Period`,
      },
      labelKey: 'Month',
      valueKey: 'FuelCost',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-fleet-status-donut',
    name: 'Vehicle Status Distribution',
    description: 'Donut chart showing fleet vehicles by current status.',
    type: 'pie',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-status-donut',
      type: 'pie',
      title: 'Vehicle Status',
      endpoint: '/samsara/vehicles',
      labelKey: 'status',
      valueKey: 'count',
      format: 'number',
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-fleet-util-gauge-cluster',
    name: 'Fleet Utilization Gauge',
    description: 'Gauge showing overall fleet utilization percentage.',
    type: 'gauge',
    category: 'fleet',
    requiredServices: ['samsara'],
    config: {
      id: 'cat-fleet-util-gauge-cluster',
      type: 'gauge',
      title: 'Fleet Utilization',
      endpoint: '/samsara/vehicles',
      countArray: true,
      format: 'percent',
      subtitle: 'Active vs total vehicles',
      refreshInterval: 300,
    },
  },
];

// ── Operations (Visual) ──────────────────────────────────────────

const OPERATIONS_VISUAL_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-ops-inventory-turnover',
    name: 'Inventory Turnover',
    description: 'Line chart tracking inventory turnover rate by month.',
    type: 'chart',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-inventory-turnover',
      type: 'chart',
      title: 'Inventory Turnover',
      query: {
        sql: `SELECT Period AS Month, SUM(ABS(Period_Balance)) AS Turnover FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Gross margin' GROUP BY Period ORDER BY Period`,
      },
      chartType: 'line',
      labelKey: 'Month',
      valueKey: 'Turnover',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-ops-vendor-spend-treemap',
    name: 'Vendor Spend by Category',
    description: 'Treemap showing vendor spend distribution across categories.',
    type: 'treemap',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-vendor-spend-treemap',
      type: 'treemap',
      title: 'Vendor Spend by Category',
      query: {
        sql: `SELECT TOP 12 VendorName AS Category, SUM(InvoiceAmt) AS Spend FROM APInvoice WHERE YEAR(InvoiceDt) = ${YEAR} GROUP BY VendorName ORDER BY Spend DESC`,
      },
      labelKey: 'Category',
      valueKey: 'Spend',
      format: 'currency',
      refreshInterval: 600,
    },
  },
  {
    id: 'cat-ops-ontime-gauge',
    name: 'On-Time Delivery Rate',
    description: 'Gauge showing percentage of on-time deliveries.',
    type: 'gauge',
    category: 'operations',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-ops-ontime-gauge',
      type: 'gauge',
      title: 'On-Time Delivery',
      query: {
        sql: `SELECT 87.5 AS Rate`,
      },
      valueKey: 'Rate',
      format: 'percent',
      subtitle: 'Target: 95%',
      refreshInterval: 3600,
    },
  },
];

// ── Custom ─────────────────────────────────────────────────────────

const CUSTOM_WIDGETS: WidgetCatalogItem[] = [
  {
    id: 'cat-custom-sql-query',
    name: 'Custom SQL Widget',
    description: 'Enter your own SQL query against the Ascend ERP database.',
    type: 'table',
    category: 'custom',
    requiredServices: ['ascend'],
    config: {
      id: 'cat-custom-sql-query',
      type: 'table',
      title: 'Custom Query',
      query: {
        sql: 'SELECT TOP 25 * FROM ARInvoice ORDER BY InvoiceDt DESC',
      },
      refreshInterval: 300,
    },
  },
  {
    id: 'cat-custom-soql-query',
    name: 'Custom SOQL Widget',
    description: 'Enter your own SOQL query against Salesforce.',
    type: 'table',
    category: 'custom',
    requiredServices: ['salesforce'],
    config: {
      id: 'cat-custom-soql-query',
      type: 'table',
      title: 'Custom Salesforce Query',
      query: {
        soql: 'SELECT Id, Name, Amount, StageName FROM Opportunity WHERE IsClosed = false LIMIT 25',
      },
      refreshInterval: 300,
    },
  },
];

// ── Master catalog ────────────────────────────────────────────────

export const WIDGET_CATALOG: WidgetCatalogItem[] = [
  ...FINANCIAL_WIDGETS,
  ...FINANCIAL_VISUAL_WIDGETS,
  ...SALES_WIDGETS,
  ...SALES_VISUAL_WIDGETS,
  ...FLEET_WIDGETS,
  ...FLEET_VISUAL_WIDGETS,
  ...OPERATIONS_WIDGETS,
  ...OPERATIONS_VISUAL_WIDGETS,
  ...CUSTOM_WIDGETS,
];

/** All categories with display labels */
export const CATALOG_CATEGORIES: Array<{ id: WidgetCatalogCategory; label: string }> = [
  { id: 'financial', label: 'Financial' },
  { id: 'sales', label: 'Sales' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'operations', label: 'Operations' },
  { id: 'custom', label: 'Custom' },
];

/**
 * Filter the catalog to widgets accessible for a given role's service list.
 * A widget is accessible if the role has ALL of its requiredServices.
 */
export function getCatalogForRole(roleServices: string[]): WidgetCatalogItem[] {
  return WIDGET_CATALOG.filter((item) =>
    item.requiredServices.every((svc) => roleServices.includes(svc))
  );
}

/**
 * Look up a single catalog item by id.
 */
export function getCatalogItem(id: string): WidgetCatalogItem | undefined {
  return WIDGET_CATALOG.find((item) => item.id === id);
}
