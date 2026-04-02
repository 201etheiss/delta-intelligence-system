/**
 * Nova Context: Portal
 * Vocabulary, schema, and query capabilities for the Delta Portal consumer platform.
 * Covers: orders, pricing, delivery, invoices, leasing, KYC, payments, catalog.
 */

import type { NovaContext } from './finance';

export const PORTAL_CONTEXT: NovaContext = {
  domain: 'portal',

  vocabulary: [
    'Order (D360-YYYY-NNNN) — unique order identifier with year and sequence number',
    'Order lifecycle — created → confirmed → dispatched → in_transit → delivered → completed',
    'Cart — temporary collection of products before checkout with quantity and delivery preferences',
    'Checkout — cart finalization with payment method, delivery window, and ship-to site selection',
    'Purchase order (PO) — formalized order submitted for fulfillment and invoicing',
    'Recurring order — scheduled repeat delivery on a fixed cadence (weekly, biweekly, monthly)',
    'Auto-refill — tank-level triggered reorder when inventory drops below threshold',
    'Rack pricing — DTN daily base rate by supply point, product, and vendor',
    'Margin pricing — rack + margin + excise tax + sales tax = customer delivered price',
    'Tiered lube pricing — standard / premium / synthetic tiers with volume discount brackets',
    'Leasing — tank configurator with DocuSign MSA and Samsara GPS tracking',
    'KYC (Know Your Customer) — application, credit check, and verification workflow',
    'Payment methods — ACH via Stripe, credit/debit card via Stripe, Net-30/Net-60 terms',
    'Delivery tracking — Uber-style real-time GPS position and ETA for active deliveries',
    'Delivery window — scheduled time slot for fuel drop (will call or keep full)',
    'Ship-to site — physical delivery location with tank specs and access instructions',
    'Will call vs keep full — customer-initiated order vs automated level-based dispatch',
    'Price alert — notification when rack price crosses a user-defined threshold',
    'Invoice aging — Current, 1–30 days, 31–60 days, 61–90 days, 90+ days buckets',
  ],

  keyTables: [
    'DF_PBI_BillingChartQuery — current AR and pricing data through 2026',
    'ARInvoiceItem — invoice line items, join on SysTrxNo for header details',
    'vRackPrice — Vendor_Name, SupplyPoint, ProductDescr, RackPrice (live daily DTN)',
    'Customer — StandardAcctNo, CustomerName, CustType, Salesperson',
    'vBOLHdrInfo — bill of lading (always use this, NOT BOLHdr.FromSiteID)',
    'Opportunity — Salesforce CRM pipeline and deal tracking',
    'Account — Salesforce CRM customer accounts and contacts',
  ],

  queryPatterns: [
    "What's the status of order D360-2026-1234?",
    'Show rack prices for ULSD at Shreveport',
    'Which customers have overdue invoices?',
    "What's the delivery ETA for site 47?",
    'Show top 20 customers by revenue this year',
    "What's the total AR aging over 90 days?",
    'List open quotes pending approval',
    'What products does customer ABC order most?',
    'Show pricing history for dyed diesel',
    'Which sites have auto-refill enabled?',
    'What is the current rack price for premium diesel?',
    'How many orders were delivered this week?',
  ],

  availableActions: [
    'track-delivery — track delivery status in real-time with GPS position and ETA',
    'view-invoices — view and pay invoices with aging breakdown',
    'request-quote — request a new quote with product, volume, and delivery details',
    'browse-catalog — browse product catalog with live rack-based pricing',
    'create-order — create an order with delivery scheduling and ship-to site selection',
    'view-ar-aging — view AR aging by customer with collection priority',
    'check-credit — check credit status and available credit limit for a customer',
    'monitor-price-alerts — monitor and manage price alert thresholds',
  ],

  gatewayEndpoints: [
    'GET /ascend/customers',
    'GET /ascend/invoices',
    'GET /ascend/ar/aging',
    'GET /ascend/sites',
    'GET /ascend/tanks',
    'GET /ascend/revenue',
    'GET /ascend/revenue/by-customer',
    'POST /ascend/query',
    'POST /salesforce/query',
  ],
};
