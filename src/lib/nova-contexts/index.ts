/**
 * Nova Contexts — Aggregated index
 * Merges all domain contexts into ALL_NOVA_CONTEXTS.
 * Inject into Nova's system prompt via buildNovaSystemContext().
 */

import { FINANCE_CONTEXT, type NovaContext } from './finance';
import { OPERATIONS_CONTEXT } from './operations';
import { INTELLIGENCE_CONTEXT } from './intelligence';
import { COMPLIANCE_CONTEXT } from './compliance';
import { ORGANIZATION_CONTEXT } from './organization';
import { SIGNAL_MAP_CONTEXT } from './signal-map';
import { GL_MODULE_CONTEXT } from './gl-module';

export { FINANCE_CONTEXT } from './finance';
export { OPERATIONS_CONTEXT } from './operations';
export { INTELLIGENCE_CONTEXT } from './intelligence';
export { COMPLIANCE_CONTEXT } from './compliance';
export { ORGANIZATION_CONTEXT } from './organization';
export { SIGNAL_MAP_CONTEXT } from './signal-map';
export { GL_MODULE_CONTEXT } from './gl-module';
export type { NovaContext } from './finance';

export const ALL_NOVA_CONTEXTS = {
  finance: FINANCE_CONTEXT,
  operations: OPERATIONS_CONTEXT,
  intelligence: INTELLIGENCE_CONTEXT,
  compliance: COMPLIANCE_CONTEXT,
  organization: ORGANIZATION_CONTEXT,
  'signal-map': SIGNAL_MAP_CONTEXT,
  gl: GL_MODULE_CONTEXT,
} as const;

export type NovaModuleId = keyof typeof ALL_NOVA_CONTEXTS;

/**
 * Returns the context object for a given module ID, or null if not found.
 */
export function getContextForModule(moduleId: string) {
  return ALL_NOVA_CONTEXTS[moduleId as NovaModuleId] ?? null;
}

/**
 * Serialises all domain contexts into a compact string suitable for
 * injection into Nova's system prompt.
 */
/**
 * Serialises a single NovaContext into a compact string for system prompt injection.
 */
function serializeContext(ctx: NovaContext): string {
  const lines: string[] = [
    `## Domain: ${ctx.domain.toUpperCase()}`,
    '',
    '### Vocabulary',
    ...ctx.vocabulary.map((v) => `- ${v}`),
    '',
  ];

  if (ctx.keyTables.length > 0) {
    lines.push('### Key Tables / Data Objects');
    ctx.keyTables.forEach((t) => lines.push(`- ${t}`));
    lines.push('');
  }

  lines.push(
    '### Example Queries',
    ...ctx.queryPatterns.map((q) => `- "${q}"`),
    '',
    '### Available Actions',
    ...ctx.availableActions.map((a) => `- ${a}`),
    '',
  );

  return lines.join('\n');
}

/**
 * Serialises all domain contexts into a compact string suitable for
 * injection into Nova's system prompt.
 */
export function buildNovaSystemContext(): string {
  return Object.values(ALL_NOVA_CONTEXTS)
    .map(serializeContext)
    .join('\n---\n\n');
}

/**
 * Builds a domain-specific context string for a single module.
 * Returns the serialised context or null if the module is unknown.
 */
export function buildModuleContext(moduleId: string): string | null {
  const ctx = getContextForModule(moduleId);
  if (!ctx) return null;
  return serializeContext(ctx);
}

/**
 * Nova assistant capabilities description — injected into the system prompt
 * so the AI knows what actions it can offer the user.
 */
export const NOVA_ASSISTANT_ACTIONS = `
# Nova Assistant Capabilities

You are Nova, Delta360's AI assistant. In addition to answering questions and querying data, you can take the following actions on behalf of the user. When the user's intent matches one of these, confirm the details and execute.

## Available Actions

1. **Reminders** — Create reminders with optional recurrence.
   Examples: "Remind me to review AP aging on Friday", "Set a daily reminder to check fuel margins at 8am"
   Trigger: User says remind, reminder, don't forget, follow up

2. **Email Drafts** — Draft and send emails using the user's account.
   Examples: "Draft a follow-up to Magellan about their overdue invoices", "Send Taylor the monthly close summary"
   Trigger: User says draft email, write email, send email, compose email

3. **Report Scheduling** — Schedule recurring reports.
   Examples: "Run the monthly close report every first Monday", "Schedule a weekly AR aging digest"
   Trigger: User says schedule report, recurring report, report every

4. **Task Creation** — Create tasks and to-do items.
   Examples: "Add a task to review the reconciliation exceptions", "Create a to-do for the Q2 budget review"
   Trigger: User says create task, add task, new task, to-do

5. **Calendar Events** — Create meetings and calendar entries.
   Examples: "Schedule a meeting with Taylor at 3pm tomorrow", "Block 2 hours for month-end close prep"
   Trigger: User says calendar, meeting, schedule meeting, book time

6. **Data Alerts** — Set threshold-based alerts on live data.
   Examples: "Alert me when diesel margin drops below 8%", "Notify me if AR aging over 90 days exceeds $500K"
   Trigger: User says alert when, notify when, watch for, flag if

7. **Notes & Learnings** — Save contextual notes for future reference.
   Examples: "Remember that Magellan prefers Net-60 terms", "Note that PC-12 margins improved after the Q1 rate change"
   Trigger: User says add note, remember that, note that, save note

When you detect any of these intents, acknowledge the action, confirm the parameters with the user, and use the appropriate tool to execute.
`.trim();

/**
 * Builds the full Nova context block for system prompt injection.
 * If moduleId is provided, returns domain-specific context.
 * If absent, returns full cross-domain context.
 * Always appends assistant action capabilities.
 */
export function buildNovaPromptSection(moduleId?: string | null): string {
  const domainHeader = '\n\n# Nova Domain Context\n\n';
  const domainContent = moduleId
    ? (buildModuleContext(moduleId) ?? buildNovaSystemContext())
    : buildNovaSystemContext();

  return domainHeader + domainContent + '\n\n' + NOVA_ASSISTANT_ACTIONS;
}
