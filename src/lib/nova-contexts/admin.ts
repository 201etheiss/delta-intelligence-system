/**
 * Nova Context: Admin
 * Vocabulary, schema, and query capabilities for the Admin domain.
 * Covers: users, permissions, audit, usage, health, automations, event monitoring.
 */

import type { NovaContext } from './finance';

export const ADMIN_CONTEXT: NovaContext = {
  domain: 'admin',
  vocabulary: [
    'User roles — admin, accounting, sales, operations, hr, readonly',
    'Permissions — tool-level (query_gateway, generate_workbook, etc.) and endpoint-level access control',
    'Usage tracking — token consumption per user, model usage breakdown, cost estimation',
    'Health monitoring — gateway service status (Ascend, Salesforce, Samsara, Power BI, Fleet Panda, Vroozi)',
    'Audit log — timestamped record of user actions, API calls, permission changes',
    'Team intelligence — 38-person roster with departments, managers, MS Graph hierarchy',
    'Event monitor — real-time event stream from DataOS event store (CQRS pattern)',
    'Ingestion pipeline — Ascend table sync status, feed health, schema registry',
    'API documentation — 124 routes, 8 services, role-based API key system',
    'Session management — user sessions, conversation history, active connections',
    'Automation engine — 11 action types, cron scheduler, trigger/condition/action rules',
    'Integration status — spoke health (Portal, Equipment Tracker, Signal Map), gateway uptime',
  ],
  keyTables: [
    'users (38 active — admin:5, accounting:7, sales:21, operations:4, hr:1, readonly:83)',
    'audit_log (user actions, API calls, permission changes)',
    'usage_log (token consumption, model routing, cost per query)',
    'sessions (active user sessions with conversation state)',
    'automations (trigger/condition/action rules with cron scheduling)',
    'event_store (CQRS event stream — orders, invoices, alerts, module opens)',
  ],
  queryPatterns: [
    'How many active users by role?',
    'Show token usage for this month by model',
    'Which API routes have the most errors?',
    'What is the gateway health status?',
    'Show the audit log for today',
    'Which automations ran in the last 24 hours?',
    'Who has admin permissions?',
    'What is the average query cost per user?',
  ],
  availableActions: [
    'View user list and role assignments',
    'Check gateway service health',
    'View audit log and usage statistics',
    'Monitor automation execution status',
    'Check event store activity',
    'View API documentation',
  ],
  gatewayEndpoints: [
    '/api/admin/users',
    '/api/admin/health',
    '/api/admin/audit',
    '/api/admin/usage',
    '/api/admin/permissions',
    '/api/automations',
    '/api/admin/event-monitor',
  ],
} as const;
