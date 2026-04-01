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

  // Gateway/Feed events
  GATEWAY_QUERY: 'gateway.query',
  ASCEND_SYNC: 'ascend.sync',
  SALESFORCE_SYNC: 'salesforce.sync',
  SAMSARA_SYNC: 'samsara.sync',
  POWERBI_SYNC: 'powerbi.sync',
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
