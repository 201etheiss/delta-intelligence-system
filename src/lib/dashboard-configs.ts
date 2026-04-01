/**
 * Pre-built dashboard widget configurations per role.
 * Each entry maps to a LiveWidgetConfig consumed by <LiveWidget />.
 *
 * Query contract:
 *  - endpoint: gateway GET path routed through /api/widget-query/gateway
 *  - query.sql: posted to /api/widget-query/ascend  → /ascend/query
 *  - query.soql: posted to /api/widget-query/salesforce → /salesforce/query
 */

import type { LiveWidgetConfig } from '@/components/dashboard/LiveWidget';

const YEAR = new Date().getFullYear();

// ── Admin ──────────────────────────────────────────────────────────
// Full visibility: revenue, GP, pipeline, AR, fleet, rack price, top customers

export const ADMIN_WIDGETS: LiveWidgetConfig[] = [
  {
    id: 'admin-rev-ytd',
    type: 'kpi',
    title: `Revenue YTD`,
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
    valueKey: 'Revenue',
    format: 'currency',
    subtitle: `GL Revenue | ${YEAR}`,
  },
  {
    id: 'admin-cogs-ytd',
    type: 'kpi',
    title: `COGS YTD`,
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS COGS FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Gross margin'` },
    valueKey: 'COGS',
    format: 'currency',
    subtitle: `Cost of Goods Sold | ${YEAR}`,
  },
  {
    id: 'admin-gp-ytd',
    type: 'kpi',
    title: `Gross Profit YTD`,
    query: { sql: `SELECT SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin')` },
    valueKey: 'GP',
    format: 'currency',
    subtitle: `Revenue - COGS | ${YEAR}`,
  },
  {
    id: 'admin-pipeline',
    type: 'kpi',
    title: 'Open Pipeline',
    query: { soql: 'SELECT SUM(Amount) total FROM Opportunity WHERE IsClosed = false' },
    valueKey: 'total',
    format: 'currency',
    subtitle: 'Salesforce open opportunities',
  },
  {
    id: 'admin-ar',
    type: 'kpi',
    title: 'AR Outstanding',
    query: { sql: "SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0" },
    valueKey: 'Total',
    format: 'currency',
    subtitle: 'Open, Active, Partial',
  },
  {
    id: 'admin-fleet',
    type: 'kpi',
    title: 'Fleet Vehicles',
    endpoint: '/samsara/vehicles',
    countArray: true,
    format: 'number',
    subtitle: 'Samsara — all vehicles',
  },
  {
    id: 'admin-rack',
    type: 'kpi',
    title: "Today's Rack",
    query: { sql: "SELECT TOP 1 RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC" },
    valueKey: 'RackPrice',
    format: 'price',
    subtitle: 'Diesel Dyed',
  },
  {
    id: 'admin-top-customers',
    type: 'list',
    title: `Top 10 Customers by GP (${YEAR})`,
    query: {
      sql: `SELECT TOP 10 b.CustomerName, SUM(i.Qty * (i.UnitPrice - ISNULL(i.Total_UnitCost, 0))) AS GP FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE b.Year = ${YEAR} AND i.Total_UnitCost > 0 GROUP BY b.CustomerName ORDER BY GP DESC`,
    },
    labelKey: 'CustomerName',
    valueKey: 'GP',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'admin-pipeline-stages',
    type: 'chart',
    title: 'Pipeline by Stage',
    query: {
      soql: 'SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName',
    },
    chartType: 'bar',
    labelKey: 'StageName',
    valueKey: 'total',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'admin-rev-by-month',
    type: 'chart',
    title: `Revenue by Month ${YEAR}`,
    query: { sql: `SELECT Period, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND AccountGroup = 'Revenue' GROUP BY Period ORDER BY Period` },
    chartType: 'bar',
    labelKey: 'Period',
    valueKey: 'Revenue',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'admin-ar-aging',
    type: 'table',
    title: 'AR Aging Summary',
    endpoint: '/ascend/ar/aging',
    refreshInterval: 600,
    sortByKey: 'TotalOutstanding',
    displayColumns: ['CustomerName', 'Current_AR', 'Past1_30', 'Past31_60', 'Past61_90', 'Past90Plus'],
    limit: 10,
  },
  {
    id: 'admin-active-drivers',
    type: 'kpi',
    title: 'Active Drivers',
    endpoint: '/samsara/drivers',
    countArray: true,
    filterKey: 'driverActivationStatus',
    filterValue: 'active',
    format: 'number',
    subtitle: 'Samsara — active drivers only',
  },
  {
    id: 'admin-customer-count',
    type: 'kpi',
    title: 'Customer Count',
    endpoint: '/ascend/customers',
    countArray: true,
    format: 'number',
    subtitle: 'Total Ascend customers',
  },
  {
    id: 'admin-invoices-month',
    type: 'kpi',
    title: 'Invoices This Month',
    query: {
      sql: `SELECT COUNT(*) AS Count FROM ARInvoice WHERE MONTH(InvoiceDt) = MONTH(GETDATE()) AND YEAR(InvoiceDt) = ${YEAR}`,
    },
    valueKey: 'Count',
    format: 'number',
    subtitle: 'Current month',
  },
  {
    id: 'admin-gp-by-month',
    type: 'chart',
    title: `Gross Profit by Month ${YEAR}`,
    query: { sql: `SELECT Period, SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY Period ORDER BY Period` },
    chartType: 'line',
    labelKey: 'Period',
    valueKey: 'GP',
    format: 'currency',
    refreshInterval: 600,
  },
];

// ── Sales ──────────────────────────────────────────────────────────
// Pipeline-focused: opportunities, stage distribution, top accounts, activity

export const SALES_WIDGETS: LiveWidgetConfig[] = [
  {
    id: 'sales-pipeline',
    type: 'kpi',
    title: 'Open Pipeline',
    query: { soql: 'SELECT SUM(Amount) total FROM Opportunity WHERE IsClosed = false' },
    valueKey: 'total',
    format: 'currency',
    subtitle: 'All open opportunities',
  },
  {
    id: 'sales-open-opps',
    type: 'kpi',
    title: 'Open Opportunities',
    query: { soql: 'SELECT COUNT(Id) cnt FROM Opportunity WHERE IsClosed = false' },
    valueKey: 'cnt',
    format: 'number',
    subtitle: 'Active deals',
  },
  {
    id: 'sales-closed-won-ytd',
    type: 'kpi',
    title: 'Closed Won YTD',
    query: {
      soql: `SELECT SUM(Amount) total FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}`,
    },
    valueKey: 'total',
    format: 'currency',
    subtitle: `${YEAR} closed-won revenue`,
  },
  {
    id: 'sales-avg-deal',
    type: 'kpi',
    title: 'Avg Deal Size',
    query: { soql: 'SELECT AVG(Amount) avg FROM Opportunity WHERE IsClosed = false AND Amount > 0' },
    valueKey: 'avg',
    format: 'currency',
    subtitle: 'Open pipeline average',
  },
  {
    id: 'sales-pipeline-stages',
    type: 'chart',
    title: 'Pipeline by Stage',
    query: {
      soql: 'SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName',
    },
    chartType: 'bar',
    labelKey: 'StageName',
    valueKey: 'total',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'sales-top-accounts',
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
  {
    id: 'sales-recent-opps',
    type: 'table',
    title: 'Recent Opportunities',
    query: {
      soql: 'SELECT Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false ORDER BY LastModifiedDate DESC LIMIT 10',
    },
    refreshInterval: 300,
  },
  {
    id: 'sales-close-rate',
    type: 'kpi',
    title: 'Closed Won Count',
    query: {
      soql: `SELECT COUNT(Id) cnt FROM Opportunity WHERE IsWon = true AND CALENDAR_YEAR(CloseDate) = ${YEAR}`,
    },
    valueKey: 'cnt',
    format: 'number',
    subtitle: `${YEAR} deals won`,
    refreshInterval: 3600,
  },
  {
    id: 'sales-rev-ytd',
    type: 'kpi',
    title: 'Company Revenue YTD',
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
    valueKey: 'Revenue',
    format: 'currency',
    subtitle: `GL Revenue | ${YEAR}`,
    refreshInterval: 600,
  },
  {
    id: 'sales-closing-soon',
    type: 'table',
    title: 'Closing This Month',
    query: {
      soql: `SELECT Name, StageName, Amount, CloseDate FROM Opportunity WHERE IsClosed = false AND CloseDate = THIS_MONTH ORDER BY Amount DESC LIMIT 10`,
    },
    refreshInterval: 600,
  },
];

// ── Accounting ────────────────────────────────────────────────────
// AR/AP/GL: balances, aging, invoice volume, rack price

export const ACCOUNTING_WIDGETS: LiveWidgetConfig[] = [
  {
    id: 'acct-ar-total',
    type: 'kpi',
    title: 'AR Outstanding',
    query: { sql: "SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0" },
    valueKey: 'Total',
    format: 'currency',
    subtitle: 'Open + Active + Partial',
  },
  {
    id: 'acct-ar-90plus',
    type: 'kpi',
    title: 'AR Over 90 Days',
    query: {
      sql: "SELECT SUM(ADOTotalStillDue) AS Total FROM ARInvoice WHERE Status IN ('O','A','P') AND ADOTotalStillDue > 0 AND DATEDIFF(day, InvoiceDt, GETDATE()) > 90",
    },
    valueKey: 'Total',
    format: 'currency',
    subtitle: 'Past 90 days — collection risk',
  },
  {
    id: 'acct-rev-ytd',
    type: 'kpi',
    title: 'Revenue YTD',
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
    valueKey: 'Revenue',
    format: 'currency',
    subtitle: `GL Revenue | ${YEAR}`,
  },
  {
    id: 'acct-gp-ytd',
    type: 'kpi',
    title: 'Gross Profit YTD',
    query: { sql: `SELECT SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin')` },
    valueKey: 'GP',
    format: 'currency',
    subtitle: `Revenue - COGS | ${YEAR}`,
  },
  {
    id: 'acct-rack',
    type: 'kpi',
    title: "Today's Rack",
    query: { sql: "SELECT TOP 1 RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC" },
    valueKey: 'RackPrice',
    format: 'price',
    subtitle: 'Diesel Dyed',
  },
  {
    id: 'acct-ar-aging',
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
  {
    id: 'acct-rev-by-month',
    type: 'chart',
    title: `Monthly Revenue ${YEAR}`,
    query: {
      sql: `SELECT Period AS Mo, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND AccountGroup = 'Revenue' GROUP BY Period ORDER BY Period`,
    },
    chartType: 'bar',
    labelKey: 'Mo',
    valueKey: 'Revenue',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'acct-top-customers-rev',
    type: 'list',
    title: 'Top Customers by Revenue',
    query: {
      sql: `SELECT TOP 10
              b.CustomerName,
              SUM(i.Qty * i.UnitPrice) AS Revenue
            FROM DF_PBI_BillingChartQuery b
            JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
            WHERE b.Year = ${YEAR}
            GROUP BY b.CustomerName
            ORDER BY Revenue DESC`,
    },
    labelKey: 'CustomerName',
    valueKey: 'Revenue',
    format: 'currency',
    refreshInterval: 600,
  },
  {
    id: 'acct-invoices-month',
    type: 'kpi',
    title: 'Invoices This Month',
    query: {
      sql: `SELECT COUNT(*) AS Count FROM ARInvoice WHERE MONTH(InvoiceDt) = MONTH(GETDATE()) AND YEAR(InvoiceDt) = ${YEAR}`,
    },
    valueKey: 'Count',
    format: 'number',
    subtitle: 'Current month',
  },
  {
    id: 'acct-gp-by-month',
    type: 'chart',
    title: `Monthly Gross Profit ${YEAR}`,
    query: {
      sql: `SELECT Period AS Mo, SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin') GROUP BY Period ORDER BY Period`,
    },
    chartType: 'line',
    labelKey: 'Mo',
    valueKey: 'GP',
    format: 'currency',
    refreshInterval: 600,
  },
];

// ── Operations ────────────────────────────────────────────────────
// Fleet, dispatch, drivers, route health, rack price

export const OPERATIONS_WIDGETS: LiveWidgetConfig[] = [
  {
    id: 'ops-fleet-count',
    type: 'kpi',
    title: 'Fleet Vehicles',
    endpoint: '/samsara/vehicles',
    countArray: true,
    format: 'number',
    subtitle: 'Total active in Samsara',
  },
  {
    id: 'ops-active-drivers',
    type: 'kpi',
    title: 'Active Drivers',
    endpoint: '/samsara/drivers',
    countArray: true,
    filterKey: 'driverActivationStatus',
    filterValue: 'active',
    format: 'number',
    subtitle: 'Samsara — active drivers only',
  },
  {
    id: 'ops-rack',
    type: 'kpi',
    title: "Today's Rack",
    query: { sql: "SELECT TOP 1 RackPrice, EffDtTm FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC" },
    valueKey: 'RackPrice',
    format: 'price',
    subtitle: 'Diesel Dyed — latest posted price',
    refreshInterval: 900,
  },
  {
    id: 'ops-invoice-volume',
    type: 'kpi',
    title: `Invoices This Month`,
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
  {
    id: 'ops-vehicles-list',
    type: 'table',
    title: 'Vehicle List',
    endpoint: '/samsara/vehicles',
    refreshInterval: 300,
  },
  {
    id: 'ops-top-customers-vol',
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
  {
    id: 'ops-monthly-invoices',
    type: 'chart',
    title: `Invoice Volume by Month`,
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
  {
    id: 'ops-fleet-util',
    type: 'gauge',
    title: 'Fleet Utilization',
    endpoint: '/samsara/vehicles',
    countArray: true,
    format: 'percent',
    subtitle: 'Vehicles dispatched vs total',
    refreshInterval: 300,
  },
  {
    id: 'ops-safety-events',
    type: 'list',
    title: 'Recent Safety Events',
    endpoint: '/samsara/alerts',
    labelKey: 'driver.name',
    valueKey: 'maxAccelerationGForce',
    format: 'number',
    refreshInterval: 300,
  },
  {
    id: 'ops-rev-ytd',
    type: 'kpi',
    title: 'Revenue YTD',
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
    valueKey: 'Revenue',
    format: 'currency',
    subtitle: `GL Revenue | ${YEAR}`,
    refreshInterval: 600,
  },
  {
    id: 'ops-gallons-by-month',
    type: 'chart',
    title: `Gallons by Month ${YEAR}`,
    query: {
      sql: `SELECT
              DATENAME(MONTH, InvoiceDt) AS Month,
              MONTH(InvoiceDt) AS Mo,
              SUM(i.Qty) AS Gallons
            FROM DF_PBI_BillingChartQuery b
            JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo
            WHERE b.Year = ${YEAR}
            GROUP BY MONTH(InvoiceDt), DATENAME(MONTH, InvoiceDt)
            ORDER BY Mo`,
    },
    chartType: 'bar',
    labelKey: 'Month',
    valueKey: 'Gallons',
    format: 'number',
    refreshInterval: 600,
  },
];

// ── HR / Paylocity ──────────────────────────────────────────────
// Employee headcount, department breakdown, cost centers

export const HR_WIDGETS: LiveWidgetConfig[] = [
  {
    id: 'hr-headcount',
    type: 'kpi',
    title: 'Employee Headcount',
    endpoint: '/paylocity/employees',
    countArray: true,
    format: 'number',
    subtitle: 'Total active employees',
  },
  {
    id: 'hr-departments',
    type: 'chart',
    title: 'Employees by Department',
    endpoint: '/paylocity/codes/departments',
    chartType: 'bar',
    labelKey: 'description',
    valueKey: 'code',
    format: 'number',
    refreshInterval: 3600,
  },
  {
    id: 'hr-cost-centers',
    type: 'list',
    title: 'Cost Centers',
    endpoint: '/paylocity/codes/costcenters',
    labelKey: 'description',
    valueKey: 'code',
    format: 'number',
    refreshInterval: 3600,
  },
  {
    id: 'hr-positions',
    type: 'table',
    title: 'Position Types',
    endpoint: '/paylocity/codes/positions',
    refreshInterval: 3600,
  },
  {
    id: 'hr-rev-ytd',
    type: 'kpi',
    title: 'Revenue YTD',
    query: { sql: `SELECT SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue'` },
    valueKey: 'Revenue',
    format: 'currency',
    subtitle: `GL Revenue | ${YEAR}`,
    refreshInterval: 600,
  },
  {
    id: 'hr-gp-ytd',
    type: 'kpi',
    title: 'Gross Profit YTD',
    query: { sql: `SELECT SUM(CASE WHEN AccountGroup = 'Revenue' THEN ABS(Period_Balance) ELSE 0 END) - SUM(CASE WHEN AccountGroup = 'Gross margin' THEN ABS(Period_Balance) ELSE 0 END) AS GP FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${YEAR} AND Period BETWEEN 1 AND 12 AND AccountGroup IN ('Revenue','Gross margin')` },
    valueKey: 'GP',
    format: 'currency',
    subtitle: `Revenue - COGS | ${YEAR}`,
    refreshInterval: 600,
  },
  {
    id: 'hr-fleet',
    type: 'kpi',
    title: 'Fleet Vehicles',
    endpoint: '/samsara/vehicles',
    countArray: true,
    format: 'number',
    subtitle: 'Samsara — all vehicles',
  },
  {
    id: 'hr-active-drivers',
    type: 'kpi',
    title: 'Active Drivers',
    endpoint: '/samsara/drivers',
    countArray: true,
    filterKey: 'driverActivationStatus',
    filterValue: 'active',
    format: 'number',
    subtitle: 'Samsara — active drivers only',
  },
];

// ── Role map ───────────────────────────────────────────────────────

export const ROLE_WIDGET_MAP: Record<string, LiveWidgetConfig[]> = {
  admin: ADMIN_WIDGETS,
  sales: SALES_WIDGETS,
  accounting: ACCOUNTING_WIDGETS,
  operations: OPERATIONS_WIDGETS,
  hr: HR_WIDGETS,
};

export function getWidgetsForRole(role: string): LiveWidgetConfig[] {
  return ROLE_WIDGET_MAP[role] ?? ADMIN_WIDGETS;
}
