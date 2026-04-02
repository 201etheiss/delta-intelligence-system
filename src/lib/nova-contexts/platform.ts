/**
 * Nova Context: Platform
 * Vocabulary, schema, and query capabilities for the Platform domain.
 * Covers: Nova AI, workspaces, automations, cockpit, chat, reports, documents, glossary.
 */

import type { NovaContext } from './finance';

export const PLATFORM_CONTEXT: NovaContext = {
  domain: 'platform',
  vocabulary: [
    'Nova AI — Delta360 platform AI assistant with multi-model routing (Haiku/Sonnet/Opus/GPT-4o/Gemini)',
    'Workspaces — custom dashboards with widget builder and sharing',
    'Automations — trigger/condition/action engine with 11 action types and cron scheduling',
    'Cockpit — role-specific command center (Controller Cockpit for accounting, Sales Console, Ops Center)',
    'Chat — full-page AI interface with model selection, markdown rendering, artifacts, tool use',
    'Assistant — role-based AI assistant with reminders, learning, action detection',
    'Search — cross-chat search with suggested queries and recent conversations',
    'Reports — 9 export formats (Excel, CSV, Word, PDF, Markdown, JSON, HTML, XML, YAML)',
    'Sources — data source status, schema registry, re-index capability',
    'Documents — upload and analysis (PDF, DOCX, XLSX, CSV, PPTX, images)',
    'Shared results — team-visible query results with copy-link sharing',
    'Glossary — domain term definitions injected into Nova system prompt',
    'Density modes — Executive (summary) vs Operator (detail) UI toggle',
    'Module Grid OS — DataOS shell with NovaBar, StatusRail, ModuleTabs, Workspace',
  ],
  keyTables: [
    'conversations (localStorage — chat history, active conversation)',
    'workspaces (custom dashboards with widgets)',
    'automations (trigger/condition/action engine)',
    'reports (generated reports with templates and schedules)',
    'shared_results (team-visible query results)',
    'favorites (pinned queries)',
    'glossary (domain terms for system prompt injection)',
    'notifications (in-app inbox with multi-channel dispatch)',
  ],
  queryPatterns: [
    'What automations are active?',
    'Show my recent conversations',
    'What reports are scheduled?',
    'Show the data source health status',
    'What documents have been uploaded?',
    'List shared results from this week',
    'What glossary terms are defined?',
    'Show notification preferences',
  ],
  availableActions: [
    'Start a new chat conversation',
    'Create a custom dashboard',
    'Schedule a recurring report',
    'Upload and analyze a document',
    'Share query results with the team',
    'Define glossary terms',
    'Configure notification preferences',
    'Toggle density mode (Executive/Operator)',
  ],
  gatewayEndpoints: [
    '/api/chat',
    '/api/chat/stream',
    '/api/automations',
    '/api/reports',
    '/api/shared',
    '/api/favorites',
    '/api/glossary',
    '/api/notifications',
    '/api/sources',
    '/api/documents',
  ],
} as const;
