/**
 * Nova Context: ERP
 * Vocabulary, schema, and query capabilities for the ERP replacement module.
 * Covers: AP, procurement, inventory, contracts, rack pricing, vendor management.
 */

import type { NovaContext } from './finance';

export const ERP_CONTEXT: NovaContext = {
  domain: 'erp',

  vocabulary: [
    'AP aging — vendor invoice aging buckets: Current, 1–30, 31–60, 61–90, 90+ days',
    'Vendor spend — total payments by vendor from vPurchaseJournal',
    'Purchase journal — GL debit entries by vendor, 680 GL account categories',
    'Invoice matching — 3-way: purchase order vs goods receipt vs vendor invoice',
    'Payment run — batch vendor payment processing',
    'Vroozi procurement — 25 suppliers, 889 GL accounts, 2,605 catalog items',
    'Purchase order workflow — draft → approved → sent → received → closed',
    'Inventory valuation — FIFO, weighted average, standard cost',
    'Contract lifecycle — draft → active → renewal → expired → terminated',
    'GP calculation — Revenue minus COGS; AccountGroup="Gross margin" is COGS in Ascend, NOT GP',
    'MasterProdID — product identifier; key diesel: 4399=Dyed Short Truck, 1096=Dyed Transport, 4503=Dyed Counter Sale',
    'Period filtering — always filter Period BETWEEN 1 AND 12',
    'Vendor display ID — links Vroozi to Ascend (externalId/vendorId = vendor_display_id)',
    'DTN rack pricing — daily from vRackPrice: Vendor_Name, SupplyPoint, ProductDescr, RackPrice',
    'GL account categories — 680 unique Account_Desc values in vPurchaseJournal',
  ],

  keyTables: [
    'vPurchaseJournal — vendor_name, Account_Desc, debit, Year_For_Period; 680 GL categories',
    'APInvoice — vendor invoices, payment status, GL coding',
    'Vendor — vendor master data with terms and display ID',
    'InventoryItem — stock items and valuation method',
    'PurchaseOrder — procurement workflow with status tracking',
    'Contract — Salesforce: Id, ContractNumber, Account.Name, Status, StartDate, EndDate',
    'Opportunity — Salesforce: pipeline, Amount, StageName, CloseDate',
    'DF_PBI_BillingChartQuery — AR/pricing data for billing analysis',
    'vRackPrice — daily DTN rack prices: Vendor_Name, SupplyPoint, ProductDescr, RackPrice',
  ],

  queryPatterns: [
    "What's total AP aging over 90 days?",
    'Top 10 vendors by spend this quarter',
    'Show open POs for site 14',
    'What contracts expire in the next 60 days?',
    "What's the total Vroozi catalog spend YTD?",
    'Show GL account breakdown for fuel purchases',
    'Which vendors have Net-60 terms?',
    "What's the payment run schedule?",
    'Show inventory valuation by product type',
    'Compare rack prices across supply points',
  ],

  availableActions: [
    'view-ap-aging — AP aging report by vendor with bucket breakdown',
    'query-vendor-spend — vendor spend by GL category from vPurchaseJournal',
    'check-po-status — purchase order status and workflow stage',
    'review-expiring-contracts — contracts approaching expiration within N days',
    'browse-vroozi-catalog — search Vroozi catalog items by supplier or GL account',
    'view-inventory-levels — inventory valuation by product type and method',
    'monitor-rack-prices — DTN rack price trends across supply points',
    'track-payment-schedules — upcoming payment runs and vendor payment terms',
  ],

  gatewayEndpoints: [
    'POST /ascend/query — vPurchaseJournal, APInvoice, InventoryItem, PurchaseOrder, vRackPrice',
    'GET /vroozi/suppliers — Vroozi supplier list',
    'GET /vroozi/catalogs — Vroozi catalog items',
    'GET /vroozi/gl-accounts — Vroozi GL account mappings',
    'POST /salesforce/query — Contract, Opportunity',
    'GET /ascend/ar/aging — AR aging buckets',
    'GET /ascend/revenue — revenue summary',
  ],
};
