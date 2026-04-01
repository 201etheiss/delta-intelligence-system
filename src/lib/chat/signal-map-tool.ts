/**
 * Signal Map chat tool for Nova.
 *
 * Lets users ask about someone's OTED operator profile, leadership style,
 * decision patterns, team composition, or psychometric estimates.
 */

import Anthropic from '@anthropic-ai/sdk';
import {
  getProfileByEmail,
  getProfileSummary,
  type SignalMapProfile,
  type SignalMapSummary,
} from '@/lib/signal-map-client';

// ---------------------------------------------------------------------------
// Tool definition
// ---------------------------------------------------------------------------

export const signalMapTool: Anthropic.Tool = {
  name: 'lookup_signal_map',
  description:
    "Look up a person's OTED operator profile from Signal Map. Returns their operating signature, archetype portfolio, decision style, psychometric estimates, failure modes, and role fit. Use when asked about someone's leadership style, decision patterns, team composition, or operator profile.",
  input_schema: {
    type: 'object' as const,
    properties: {
      email: {
        type: 'string',
        description: 'The email address of the person to look up.',
      },
      detail_level: {
        type: 'string',
        enum: ['summary', 'full'],
        description:
          'Level of detail. "summary" returns key metrics; "full" includes narratives and failure modes. Defaults to "summary".',
      },
    },
    required: ['email'],
  },
};

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function formatSummary(s: SignalMapSummary): string {
  const lines: string[] = [];

  lines.push(`Signal Map Profile: ${s.name} (${s.email})`);
  lines.push('');

  if (s.operatingSignature) {
    lines.push(`Operating Signature: ${s.operatingSignature}`);
  }

  if (s.hybridClassification) {
    lines.push(`Classification: ${s.hybridClassification}`);
  }

  const archetypes = s.topArchetypes ?? [];
  if (archetypes.length > 0) {
    const formatted = archetypes
      .map((a) => `${a.id} (${Math.round(a.weight * 100)}%)`)
      .join(', ');
    lines.push(`Top Archetypes: ${formatted}`);
  }

  if (s.confidenceOverall !== null) {
    lines.push(`Confidence: ${Math.round(s.confidenceOverall * 100)}%`);
  }

  if (s.mbti) lines.push(`MBTI Estimate: ${s.mbti}`);
  if (s.disc) lines.push(`DISC Style: ${s.disc}`);

  const roles = s.bestRoles ?? [];
  if (roles.length > 0) {
    lines.push(`Best-Fit Roles: ${roles.join(', ')}`);
  }

  return lines.join('\n');
}

function formatFull(p: SignalMapProfile): string {
  const lines: string[] = [];

  lines.push(`Signal Map Profile: ${p.name} (${p.email})`);
  lines.push(`Session: ${p.sessionId} | Completed: ${p.completedAt}`);
  lines.push('');

  if (p.hybridClassification) {
    lines.push(`Classification: ${p.hybridClassification}`);
  }

  const narrative = p.narrativeCache;

  if (narrative?.operatingSignature) {
    lines.push(`Operating Signature: ${narrative.operatingSignature}`);
  }

  if (narrative?.executiveSummary) {
    lines.push('');
    lines.push('--- Executive Summary ---');
    lines.push(narrative.executiveSummary);
  }

  const archetypes = p.archetypePortfolio ?? [];
  if (archetypes.length > 0) {
    lines.push('');
    lines.push('Archetype Portfolio:');
    [...archetypes]
      .sort((a, b) => b.weight - a.weight)
      .forEach((a) => {
        lines.push(`  ${a.id}: ${Math.round(a.weight * 100)}%`);
      });
  }

  if (p.confidence?.overall !== undefined) {
    lines.push(`\nConfidence: ${Math.round(p.confidence.overall * 100)}%`);
  }

  const xref = narrative?.psychometricXref;
  if (xref?.mbti) lines.push(`MBTI Estimate: ${xref.mbti}`);
  if (xref?.disc) lines.push(`DISC Style: ${xref.disc}`);

  const roles = (narrative?.roleFit?.bestRoles ?? []) as readonly string[];
  if (roles.length > 0) {
    lines.push(`Best-Fit Roles: ${roles.join(', ')}`);
  }

  const failures = p.failureModes ?? [];
  if (failures.length > 0) {
    lines.push('');
    lines.push('Failure Modes:');
    failures.forEach((fm) => {
      const label = (fm as Record<string, unknown>).label ?? (fm as Record<string, unknown>).id ?? 'unknown';
      const desc = (fm as Record<string, unknown>).description ?? '';
      lines.push(`  - ${label}${desc ? ': ' + String(desc) : ''}`);
    });
  }

  if (narrative?.deepDive) {
    lines.push('');
    lines.push('--- Deep Dive ---');
    lines.push(narrative.deepDive);
  }

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handleSignalMapTool(
  input: { email: string; detail_level?: string },
): Promise<string> {
  const email = (input.email ?? '').trim();
  if (!email) {
    return 'Error: No email address provided.';
  }

  const detailLevel = input.detail_level === 'full' ? 'full' : 'summary';

  try {
    if (detailLevel === 'full') {
      const profile = await getProfileByEmail(email);
      if (!profile) {
        return `No Signal Map assessment found for ${email}.`;
      }
      return formatFull(profile);
    }

    const summary = await getProfileSummary(email);
    if (!summary) {
      return `No Signal Map assessment found for ${email}.`;
    }
    return formatSummary(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return `Failed to look up Signal Map profile: ${message}`;
  }
}
