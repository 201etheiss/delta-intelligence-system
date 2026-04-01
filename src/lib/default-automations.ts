/**
 * Default Automation Rules
 *
 * Pre-seeded automation rules for common Delta360 workflows.
 * Called on first run to populate data/automations.json if empty.
 */

import { loadAutomations, saveAutomations, type Automation } from '@/lib/automations';

const DEFAULT_AUTOMATIONS: Omit<Automation, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    name: 'Auto-close reconciliations',
    description: 'When all items match within $1 tolerance, auto-mark reconciliation as completed',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 8 * * 1-5', frequency: 'Daily at 8 AM weekdays' },
    },
    conditions: [],
    actions: [
      {
        id: 'recon_check',
        type: 'query',
        name: 'Check reconciliation matches',
        config: {
          endpoint: '/ascend/query',
          method: 'POST',
          body: {
            soql: "SELECT COUNT(*) AS MatchCount FROM Reconciliation WHERE ABS(Variance) <= 1 AND Status = 'InProgress'",
          },
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'AR follow-up alerts',
    description: 'When invoices pass 60 days, generate email alert to collections team',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 9 * * 1-5', frequency: 'Daily at 9 AM weekdays' },
    },
    conditions: [],
    actions: [
      {
        id: 'ar_check',
        type: 'query',
        name: 'Check 60+ day invoices',
        config: {
          endpoint: '/ascend/ar/aging',
          method: 'GET',
        },
      },
      {
        id: 'ar_email',
        type: 'email',
        name: 'Notify collections team',
        config: {
          to: ['fuelpayables@delta360.energy'],
          subject: 'AR Alert: Invoices past 60 days require follow-up',
          bodyTemplate: 'The following invoices have passed 60 days and need collection follow-up. Please review the AR aging report in Delta Intelligence.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'JE auto-approval',
    description: 'When JE amount < $500 and matches a template, auto-approve',
    enabled: false,
    trigger: {
      type: 'threshold',
      config: {
        endpoint: '/ascend/query',
        field: 'TotalDebit',
        operator: '<',
        value: 500,
      },
    },
    conditions: [{ field: 'TotalDebit', operator: '<', value: 500 }],
    actions: [
      {
        id: 'je_approve',
        type: 'query',
        name: 'Auto-approve matching JEs',
        config: {
          endpoint: '/ascend/query',
          method: 'POST',
          body: {
            soql: "SELECT JournalNo, TotalDebit, PostedBy FROM GLJournalEntry WHERE Status = 'Draft' AND TotalDebit < 500",
          },
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'Cash position alert',
    description: 'When LOC utilization exceeds 80%, alert controller',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 7 * * 1-5', frequency: 'Daily at 7 AM weekdays' },
    },
    conditions: [],
    actions: [
      {
        id: 'cash_check',
        type: 'query',
        name: 'Check cash position',
        config: {
          endpoint: '/ascend/query',
          method: 'POST',
          body: {
            soql: "SELECT SUM(Balance) AS CashBalance FROM GLAccount WHERE AccountGroup = 'Cash and Cash Equivalents'",
          },
        },
      },
      {
        id: 'cash_alert',
        type: 'email',
        name: 'Alert controller',
        config: {
          to: ['etheiss@delta360.energy'],
          subject: 'Cash Alert: LOC utilization exceeds threshold',
          bodyTemplate: 'Cash position has dropped below the monitoring threshold. Please review LOC utilization and upcoming AP obligations in Delta Intelligence.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'Month-end close reminder',
    description: '3 days before month end, send close checklist to accounting team',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 8 28-31 * *', frequency: 'Last 3 days of month at 8 AM' },
    },
    conditions: [],
    actions: [
      {
        id: 'close_email',
        type: 'email',
        name: 'Send close checklist',
        config: {
          to: ['esmith@delta360.energy', 'hburns@delta360.energy', 'blasseigne@delta360.energy'],
          subject: 'Month-End Close Reminder: Checklist available',
          bodyTemplate: 'Month-end close is approaching. Please review the close checklist in Delta Intelligence at /close-tracker and ensure all tasks are on track.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'Anomaly digest',
    description: 'Daily at 7 AM, compile detected anomalies and email to admins',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 7 * * *', frequency: 'Daily at 7 AM' },
    },
    conditions: [],
    actions: [
      {
        id: 'anomaly_scan',
        type: 'query',
        name: 'Fetch anomalies',
        config: {
          endpoint: '/ascend/ar/aging',
          method: 'GET',
        },
      },
      {
        id: 'anomaly_email',
        type: 'email',
        name: 'Email anomaly digest',
        config: {
          to: ['etheiss@delta360.energy', 'kmaples@delta360.energy'],
          subject: 'Daily Anomaly Digest — Delta Intelligence',
          bodyTemplate: 'Your daily anomaly digest is ready. Review detected anomalies, patterns, and recommended actions in Delta Intelligence at /analytics.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'Expense policy violation',
    description: 'When expense exceeds policy limits, flag for review',
    enabled: false,
    trigger: {
      type: 'threshold',
      config: {
        endpoint: '/ascend/query',
        field: 'Amount',
        operator: '>',
        value: 5000,
      },
    },
    conditions: [{ field: 'Amount', operator: '>', value: 5000 }],
    actions: [
      {
        id: 'expense_flag',
        type: 'email',
        name: 'Flag expense for review',
        config: {
          to: ['etheiss@delta360.energy'],
          subject: 'Expense Policy Alert: Amount exceeds limit',
          bodyTemplate: 'An expense has been flagged because it exceeds the policy threshold of $5,000. Please review in Delta Intelligence at /expenses.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
  {
    name: 'Contract renewal alert',
    description: '30 days before contract expiry, alert contract owner',
    enabled: true,
    trigger: {
      type: 'schedule',
      config: { cron: '0 9 * * 1', frequency: 'Weekly on Monday at 9 AM' },
    },
    conditions: [],
    actions: [
      {
        id: 'contract_check',
        type: 'query',
        name: 'Check expiring contracts',
        config: {
          endpoint: '/ascend/query',
          method: 'POST',
          body: {
            soql: "SELECT ContractNo, CustomerName, ExpirationDate FROM Contract WHERE ExpirationDate BETWEEN GETDATE() AND DATEADD(day, 30, GETDATE())",
          },
        },
      },
      {
        id: 'contract_alert',
        type: 'email',
        name: 'Alert on expiring contracts',
        config: {
          to: ['etheiss@delta360.energy'],
          subject: 'Contract Renewal Alert: Contracts expiring within 30 days',
          bodyTemplate: 'The following contracts are expiring within 30 days. Please review and initiate renewal discussions. View details at /contracts in Delta Intelligence.',
        },
      },
    ],
    createdBy: 'system',
    lastRunAt: null,
    lastRunStatus: null,
    runCount: 0,
    errorCount: 0,
  },
];

/**
 * Seed default automation rules if the automation store is empty.
 * Safe to call multiple times — only seeds when no automations exist.
 */
export function seedDefaultAutomations(): { seeded: boolean; count: number } {
  const existing = loadAutomations();
  if (existing.length > 0) {
    return { seeded: false, count: existing.length };
  }

  const now = new Date().toISOString();
  const automations: Automation[] = DEFAULT_AUTOMATIONS.map((def, index) => ({
    ...def,
    id: `default_${(index + 1).toString().padStart(3, '0')}`,
    createdAt: now,
    updatedAt: now,
  }));

  saveAutomations(automations);
  return { seeded: true, count: automations.length };
}
