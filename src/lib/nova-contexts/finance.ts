/**
 * Nova Context: Finance
 * Vocabulary, schema, and query capabilities for the Finance domain.
 * Covers: GL, AP, AR, JE, close cycle, financial statements, tax.
 */

export interface NovaContext {
  readonly domain: string;
  readonly vocabulary: readonly string[];
  readonly keyTables: readonly string[];
  readonly queryPatterns: readonly string[];
  readonly availableActions: readonly string[];
  readonly gatewayEndpoints: readonly string[];
}

export const FINANCE_CONTEXT: NovaContext = {
  domain: 'finance',

  vocabulary: [
    'GL (General Ledger) — chart of accounts, journal entries, trial balance',
    'AP (Accounts Payable) — vendor invoices, payment scheduling, aging',
    'AR (Accounts Receivable) — customer invoices, collections, aging buckets',
    'JE (Journal Entry) — debit/credit postings, period close adjustments',
    'Close cycle — period-end checklist: reconcile → review JEs → post → lock',
    'Aging buckets — Current, 1–30 days, 31–60 days, 61–90 days, 90+ days',
    'Net-30 / Net-60 — standard payment terms by customer or vendor',
    'COGS — Cost of Goods Sold; maps to AccountGroup="Gross margin" in Ascend',
    'GP (Gross Profit) — Revenue minus COGS; NOT the "Gross margin" account group label',
    'Margin % — GP / Revenue * 100; tracked by profit center and product type',
    'Profit center — one of 43 operational units in Ascend',
    'Period — Ascend accounting period 1–12; always filter Period BETWEEN 1 AND 12',
    'Trial balance — debit/credit summary before financial statement generation',
    'Balance sheet — Assets = Liabilities + Equity snapshot at period end',
    'Income statement — Revenue − COGS − OpEx = Net Income for a period range',
    'Reconciliation — matching GL balances to bank statements or sub-ledgers',
    'Variance — actual vs. budget or prior-year comparison',
    'Diesel margin — revenue from diesel sales minus diesel COGS per gallon',
    'WACC — Weighted Average Cost of Capital; used in capital allocation decisions',
  ],

  keyTables: [
    'Customer — customer master with type, billing, and payment terms',
    'APInvoice — vendor invoices with status, GL coding, and approval chain',
    'ARInvoice — customer invoices with aging and collection status',
    'JournalEntryHeader — JE headers with period, description, posted flag',
    'JournalEntryLine — debit/credit lines linked to GL accounts',
    'vPurchaseJournal — purchase journal view ranked by amount',
    'vRackPrice — fuel rack price data for margin calculations',
    'DF_PBI_BillingChartQuery — billing chart data used in Power BI reports',
    'GLAccount — chart of accounts with AccountGroup classifications',
    'ProfitCenter — 43 profit centers with name and region',
    'TaxCode — tax codes with authority mappings',
    'FixedAsset — fixed asset register with depreciation schedules',
  ],

  queryPatterns: [
    "What's our diesel margin this month?",
    'Show AP aging over 60 days',
    'Revenue by profit center YTD',
    'Which vendors have recurring monthly payments?',
    'What journal entries posted in period 3?',
    'Compare this year revenue to prior year',
    'Show the current trial balance',
    'What invoices are past due?',
    'Break down COGS by product line',
    'What is our current AR balance?',
    'Show me the income statement for Q1',
    'Which profit centers are below margin target?',
    'List fixed assets acquired this year',
    'What taxes did we collect in period 6?',
  ],

  availableActions: [
    'run-close-checklist — step through period-end close tasks with status tracking',
    'generate-financial-report — produce Income Statement, Balance Sheet, or Trial Balance as PDF',
    'check-reconciliation-status — compare GL to bank or sub-ledger and surface gaps',
    'approve-je — review and approve pending journal entries',
    'export-ap-aging — export AP aging report with payment recommendations',
    'export-ar-aging — export AR aging with collections priority ranking',
    'flag-variance — mark an account variance for investigation',
    'lock-period — mark a period as closed to prevent further postings',
  ],

  gatewayEndpoints: [
    'GET /ascend/gl/income-statement',
    'GET /ascend/gl/balance-sheet',
    'GET /ascend/gl/trial-balance',
    'GET /ascend/gl/journal-entries',
    'GET /ascend/gl/pl-by-pc',
    'GET /ascend/ar/aging',
    'GET /ascend/ar/summary',
    'GET /ascend/ap/purchases',
    'GET /ascend/ap/recurring',
    'GET /ascend/revenue',
    'GET /ascend/revenue/by-customer',
    'GET /ascend/gp/by-pc',
    'GET /ascend/taxes/collected',
    'GET /ascend/assets/fixed',
    'POST /ascend/query',
  ],
};
