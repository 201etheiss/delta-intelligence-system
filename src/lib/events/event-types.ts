// Event type constants following domain.action pattern
export const EVENT_TYPES = {
  // Orders
  ORDER_CREATED: 'order.created',
  ORDER_UPDATED: 'order.updated',
  ORDER_CANCELLED: 'order.cancelled',

  // Invoices
  INVOICE_CREATED: 'invoice.created',
  INVOICE_PAID: 'invoice.paid',
  INVOICE_OVERDUE: 'invoice.overdue',

  // Feed ingestion
  FEED_INGESTED: 'feed.ingested',
  FEED_ERROR: 'feed.error',

  // Alerts
  ALERT_TRIGGERED: 'alert.triggered',
  ALERT_RESOLVED: 'alert.resolved',

  // System
  MODULE_OPENED: 'module.opened',
  SESSION_STARTED: 'session.started',
  SESSION_ENDED: 'session.ended',

  // Nova AI
  NOVA_QUERY: 'nova.query',
  NOVA_RESPONSE: 'nova.response',
  ANOMALY_DETECTED: 'anomaly.detected',

  // Automation
  BOT_EXECUTED: 'bot.executed',
  BOT_FAILED: 'bot.failed',
  AUTOMATION_RAN: 'automation.ran',

  // Equipment Tracker events
  EQUIPMENT_CHECKED_IN: 'equipment.checked_in',
  EQUIPMENT_CHECKED_OUT: 'equipment.checked_out',
  EQUIPMENT_ALERT: 'equipment.alert',
  EQUIPMENT_MAINTENANCE: 'equipment.maintenance',
  TANK_DELIVERED: 'tank.delivered',
  TANK_LEVEL_UPDATE: 'tank.level_update',
  GEOFENCE_BREACH: 'geofence.breach',
  DISPATCH_ASSIGNED: 'dispatch.assigned',
  DISPATCH_COMPLETED: 'dispatch.completed',

  // Signal Map (OTED) events
  ASSESSMENT_STARTED: 'assessment.started',
  ASSESSMENT_COMPLETED: 'assessment.completed',
  PROFILE_GENERATED: 'profile.generated',
  ENRICHMENT_COMPLETED: 'enrichment.completed',
  REPORT_GENERATED: 'report.generated',

  // Portal events
  CUSTOMER_REGISTERED: 'customer.registered',
  PRODUCT_VIEWED: 'product.viewed',
  CART_UPDATED: 'cart.updated',
  CHECKOUT_STARTED: 'checkout.started',
  PAYMENT_PROCESSED: 'payment.processed',
  DELIVERY_SCHEDULED: 'delivery.scheduled',
  DELIVERY_COMPLETED: 'delivery.completed',
  QUOTE_REQUESTED: 'quote.requested',
  QUOTE_APPROVED: 'quote.approved',

  // GL Module events
  GL_CHART_OF_ACCOUNTS_FETCHED: 'gl.chart_of_accounts.fetched',
  GL_CHART_OF_ACCOUNTS_ERROR: 'gl.chart_of_accounts.error',
  GL_TRIAL_BALANCE_FETCHED: 'gl.trial_balance.fetched',
  GL_TRIAL_BALANCE_ERROR: 'gl.trial_balance.error',
  GL_JOURNAL_ENTRIES_FETCHED: 'gl.journal_entries.fetched',
  GL_JOURNAL_ENTRIES_ERROR: 'gl.journal_entries.error',
  GL_JOURNAL_ENTRY_CREATED: 'gl.journal_entry.created',
  GL_JOURNAL_ENTRY_POSTED: 'gl.journal_entry.posted',
  GL_JOURNAL_ENTRY_POST_FAILED: 'gl.journal_entry.post_failed',
  GL_ACCOUNT_BALANCE_FETCHED: 'gl.account_balance.fetched',
  GL_ACCOUNT_BALANCE_ERROR: 'gl.account_balance.error',

  // Gateway/Feed events
  GATEWAY_QUERY: 'gateway.query',
  ASCEND_SYNC: 'ascend.sync',
  ASCEND_AP_INVOICE_SYNC: 'ascend.ap_invoice_sync',
  ASCEND_AR_INVOICE_SYNC: 'ascend.ar_invoice_sync',
  ASCEND_CUSTOMER_SYNC: 'ascend.customer_sync',
  ASCEND_JOURNAL_ENTRY_SYNC: 'ascend.journal_entry_sync',
  ASCEND_RACK_PRICE_SYNC: 'ascend.rack_price_sync',
  SALESFORCE_SYNC: 'salesforce.sync',
  SAMSARA_SYNC: 'samsara.sync',
  POWERBI_SYNC: 'powerbi.sync',

  // ERP module events
  ERP_AP_VIEWED: 'erp.ap.viewed',
  ERP_AR_VIEWED: 'erp.ar.viewed',
  ERP_INVENTORY_VIEWED: 'erp.inventory.viewed',
  ERP_CONTRACT_VIEWED: 'erp.contract.viewed',
  ERP_PURCHASE_ORDER_CREATED: 'erp.purchase_order.created',
  ERP_VENDOR_PAYMENT_SCHEDULED: 'erp.vendor_payment.scheduled',

  // Cross-app integration events
  CROSS_APP_NAVIGATION: 'integration.navigation',
  SPOKE_HEALTH_CHECK: 'integration.spoke_health',
  DATA_BRIDGE_QUERY: 'integration.bridge_query',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
