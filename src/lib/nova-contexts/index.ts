/**
 * Nova Contexts — Aggregated index
 * Merges all domain contexts into ALL_NOVA_CONTEXTS.
 * Inject into Nova's system prompt via buildNovaSystemContext().
 */

import { FINANCE_CONTEXT } from './finance';
import { OPERATIONS_CONTEXT } from './operations';
import { INTELLIGENCE_CONTEXT } from './intelligence';
import { COMPLIANCE_CONTEXT } from './compliance';
import { ORGANIZATION_CONTEXT } from './organization';

export { FINANCE_CONTEXT } from './finance';
export { OPERATIONS_CONTEXT } from './operations';
export { INTELLIGENCE_CONTEXT } from './intelligence';
export { COMPLIANCE_CONTEXT } from './compliance';
export { ORGANIZATION_CONTEXT } from './organization';
export type { NovaContext } from './finance';

export const ALL_NOVA_CONTEXTS = {
  finance: FINANCE_CONTEXT,
  operations: OPERATIONS_CONTEXT,
  intelligence: INTELLIGENCE_CONTEXT,
  compliance: COMPLIANCE_CONTEXT,
  organization: ORGANIZATION_CONTEXT,
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
export function buildNovaSystemContext(): string {
  return Object.values(ALL_NOVA_CONTEXTS)
    .map((ctx) => {
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
    })
    .join('\n---\n\n');
}
