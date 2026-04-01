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
} as const;

export type EventType = (typeof EVENT_TYPES)[keyof typeof EVENT_TYPES];
