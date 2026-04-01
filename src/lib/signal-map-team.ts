/**
 * Signal Map Team Analytics
 *
 * Team-level analysis functions built on top of signal-map-client.ts.
 * Provides archetype distribution, gap analysis, complementary pair detection,
 * and risk factor identification for team composition.
 */

import { getSupabase } from '@/lib/supabase';
import type { SignalMapSummary } from '@/lib/signal-map-client';
import { getProfileSummary } from '@/lib/signal-map-client';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

export const ARCHETYPE_NAMES: Readonly<Record<string, string>> = {
  'AT-01': 'Systems Cartographer',
  'AT-02': 'Evidence Gatekeeper',
  'AT-03': 'Mechanism Engineer',
  'AT-04': 'Scenario Compiler',
  'AT-05': 'Compounding Librarian',
  'AT-06': 'Executive Synthesis Writer',
  'AT-07': 'Execution Driver',
  'AT-08': 'Constraint-First Strategist',
  'AT-09': 'Opportunity Scout',
  'AT-10': 'Commercial Synthesizer',
  'AT-11': 'Interface Broker',
  'AT-12': 'People Stabilizer',
  'AT-13': 'Learning Loop Optimizer',
  'AT-14': 'Decision Rights Architect',
} as const;

const ALL_ARCHETYPE_IDS = Object.keys(ARCHETYPE_NAMES);

const GAP_THRESHOLD = 5; // average weight < 5% = gap
const STRENGTH_THRESHOLD = 12; // average weight > 12% = strength

/** Pairs of archetypes that complement each other */
const COMPLEMENTARY_PAIRS: readonly [string, string][] = [
  ['AT-07', 'AT-08'], // Execution Driver + Constraint-First Strategist
  ['AT-01', 'AT-03'], // Systems Cartographer + Mechanism Engineer
  ['AT-09', 'AT-02'], // Opportunity Scout + Evidence Gatekeeper
  ['AT-06', 'AT-04'], // Executive Synthesis Writer + Scenario Compiler
  ['AT-11', 'AT-12'], // Interface Broker + People Stabilizer
  ['AT-10', 'AT-14'], // Commercial Synthesizer + Decision Rights Architect
  ['AT-05', 'AT-13'], // Compounding Librarian + Learning Loop Optimizer
];

/** Risk factor templates keyed by archetype ID */
const RISK_TEMPLATES: Readonly<Record<string, string>> = {
  'AT-11': 'No Interface Broker — cross-team communication may suffer',
  'AT-12': 'No People Stabilizer — team cohesion risks under pressure',
  'AT-02': 'No Evidence Gatekeeper — decisions may lack rigorous validation',
  'AT-08': 'No Constraint-First Strategist — team may overcommit or ignore limits',
  'AT-14': 'No Decision Rights Architect — unclear ownership may stall progress',
  'AT-01': 'No Systems Cartographer — structural blind spots likely',
};

const CONCENTRATION_TEMPLATES: Readonly<Record<string, string>> = {
  'AT-07': 'Heavy Execution Driver concentration — may rush past analysis',
  'AT-09': 'Heavy Opportunity Scout concentration — risk of chasing too many ideas',
  'AT-02': 'Heavy Evidence Gatekeeper concentration — may slow decision velocity',
  'AT-04': 'Heavy Scenario Compiler concentration — analysis paralysis risk',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EnrichedProfile {
  readonly email: string;
  readonly name: string;
  readonly topArchetypes: readonly {
    readonly id: string;
    readonly name: string;
    readonly weight: number;
  }[];
  readonly operatingSignature: string | null;
  readonly confidenceOverall: number | null;
  readonly hybridClassification: string | null;
  readonly mbti: string | null;
  readonly disc: string | null;
  readonly bestRoles: readonly string[];
}

export interface ArchetypeDistEntry {
  readonly id: string;
  readonly name: string;
  readonly count: number;
  readonly averageWeight: number;
}

export interface ComplementaryPair {
  readonly memberA: string;
  readonly memberB: string;
  readonly archetypeA: { readonly id: string; readonly name: string };
  readonly archetypeB: { readonly id: string; readonly name: string };
}

export interface TeamComposition {
  readonly members: readonly EnrichedProfile[];
  readonly archetypeDistribution: readonly ArchetypeDistEntry[];
  readonly gaps: readonly ArchetypeDistEntry[];
  readonly strengths: readonly ArchetypeDistEntry[];
  readonly complementaryPairs: readonly ComplementaryPair[];
  readonly riskFactors: readonly string[];
}

export interface HeatmapCell {
  readonly department: string;
  readonly archetypeId: string;
  readonly archetypeName: string;
  readonly averageWeight: number;
  readonly count: number;
}

export interface OrgHeatmap {
  readonly departments: readonly string[];
  readonly archetypes: readonly { readonly id: string; readonly name: string }[];
  readonly cells: readonly HeatmapCell[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function enrichProfile(summary: SignalMapSummary): EnrichedProfile {
  return {
    email: summary.email,
    name: summary.name,
    topArchetypes: (summary.topArchetypes ?? []).map((a) => ({
      id: a.id,
      name: ARCHETYPE_NAMES[a.id] ?? a.id,
      weight: a.weight,
    })),
    operatingSignature: summary.operatingSignature,
    confidenceOverall:
      typeof summary.confidenceOverall === 'number'
        ? summary.confidenceOverall
        : null,
    hybridClassification: summary.hybridClassification,
    mbti: summary.mbti,
    disc: summary.disc,
    bestRoles: summary.bestRoles ?? [],
  };
}

function buildArchetypeDistribution(
  profiles: readonly SignalMapSummary[],
): readonly ArchetypeDistEntry[] {
  const totals: Record<string, { sum: number; count: number }> = {};
  for (const id of ALL_ARCHETYPE_IDS) {
    totals[id] = { sum: 0, count: 0 };
  }

  for (const profile of profiles) {
    for (const arch of profile.topArchetypes ?? []) {
      if (totals[arch.id]) {
        totals[arch.id] = {
          sum: totals[arch.id].sum + arch.weight,
          count: totals[arch.id].count + 1,
        };
      }
    }
  }

  const totalProfiles = profiles.length || 1;
  return ALL_ARCHETYPE_IDS.map((id) => ({
    id,
    name: ARCHETYPE_NAMES[id] ?? id,
    count: totals[id]?.count ?? 0,
    averageWeight:
      totals[id] && totals[id].count > 0
        ? totals[id].sum / totalProfiles
        : 0,
  }));
}

function findComplementaryPairs(
  profiles: readonly EnrichedProfile[],
): readonly ComplementaryPair[] {
  const pairs: ComplementaryPair[] = [];

  for (const [idA, idB] of COMPLEMENTARY_PAIRS) {
    const membersA = profiles.filter((p) =>
      (p.topArchetypes ?? []).some((a) => a.id === idA),
    );
    const membersB = profiles.filter((p) =>
      (p.topArchetypes ?? []).some((a) => a.id === idB),
    );

    for (const mA of membersA) {
      for (const mB of membersB) {
        if (mA.email !== mB.email) {
          pairs.push({
            memberA: mA.name,
            memberB: mB.name,
            archetypeA: { id: idA, name: ARCHETYPE_NAMES[idA] ?? idA },
            archetypeB: { id: idB, name: ARCHETYPE_NAMES[idB] ?? idB },
          });
        }
      }
    }
  }

  return pairs;
}

function identifyRiskFactors(
  distribution: readonly ArchetypeDistEntry[],
): readonly string[] {
  const risks: string[] = [];

  // Missing archetype risks
  for (const entry of distribution) {
    if (entry.averageWeight < GAP_THRESHOLD && RISK_TEMPLATES[entry.id]) {
      risks.push(RISK_TEMPLATES[entry.id]);
    }
  }

  // Concentration risks
  for (const entry of distribution) {
    if (
      entry.averageWeight > 25 &&
      CONCENTRATION_TEMPLATES[entry.id]
    ) {
      risks.push(CONCENTRATION_TEMPLATES[entry.id]);
    }
  }

  return risks;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns all enriched profiles (persons with a completed assessment and fullReport).
 */
export async function getAllAssessedProfiles(): Promise<
  readonly EnrichedProfile[]
> {
  const client = getSupabase();
  if (!client) return [];

  const { data, error } = await client
    .from('profiles')
    .select(
      `
      *,
      persons!inner(email, name),
      assessment_sessions!inner(completed_at, status)
    `,
    )
    .eq('assessment_sessions.status', 'completed')
    .not('narrative_cache->fullReport', 'is', null)
    .order('assessment_sessions(completed_at)', { ascending: false });

  if (error || !data) return [];

  // Deduplicate by email — keep latest session per person
  const seen = new Set<string>();
  const summaries: SignalMapSummary[] = [];

  for (const row of data ?? []) {
    const persons = row.persons as
      | { email?: string; name?: string }
      | null;
    const email = (persons?.email ?? '').toLowerCase();
    if (!email || seen.has(email)) continue;
    seen.add(email);

    const sessions = row.assessment_sessions as
      | { completed_at?: string }
      | null;

    const narrative = typeof row.narrative_cache === 'string'
      ? (() => {
          try {
            return JSON.parse(row.narrative_cache);
          } catch {
            return null;
          }
        })()
      : row.narrative_cache ?? null;

    const rawPortfolio =
      typeof row.archetype_portfolio === 'string'
        ? (() => {
            try {
              return JSON.parse(row.archetype_portfolio);
            } catch {
              return [];
            }
          })()
        : row.archetype_portfolio ?? [];

    const archetypes = (Array.isArray(rawPortfolio) ? rawPortfolio : [])
      .filter(
        (a: Record<string, unknown>) =>
          typeof a.id === 'string' && typeof a.weight === 'number',
      )
      .map((a: { id: string; weight: number }) => ({
        id: a.id,
        weight: a.weight,
      }));

    const xref = narrative?.psychometricXref ?? {};
    const roleFit = narrative?.roleFit ?? {};

    summaries.push({
      email,
      name: persons?.name ?? '',
      operatingSignature: narrative?.operatingSignature ?? null,
      topArchetypes: [...archetypes]
        .sort((a, b) => b.weight - a.weight)
        .slice(0, 3),
      confidenceOverall:
        typeof row.confidence === 'object' && row.confidence !== null
          ? (row.confidence as Record<string, unknown>).overall as number ?? null
          : null,
      hybridClassification: row.hybrid_classification
        ? String(row.hybrid_classification)
        : null,
      mbti: xref.mbti ?? null,
      disc: xref.disc ?? null,
      bestRoles: (roleFit.bestRoles ?? []) as readonly string[],
    });

    void sessions; // used for ordering
  }

  return summaries.map(enrichProfile);
}

/**
 * Returns team composition analysis for a set of emails.
 */
export async function getTeamComposition(
  emails: readonly string[],
): Promise<TeamComposition> {
  if ((emails ?? []).length === 0) {
    return {
      members: [],
      archetypeDistribution: [],
      gaps: [],
      strengths: [],
      complementaryPairs: [],
      riskFactors: [],
    };
  }

  const results = await Promise.all(
    emails.map((e) => getProfileSummary(e)),
  );
  const validSummaries = results.filter(
    (r): r is SignalMapSummary => r !== null,
  );

  const members = validSummaries.map(enrichProfile);
  const distribution = buildArchetypeDistribution(validSummaries);
  const gaps = distribution.filter((d) => d.averageWeight < GAP_THRESHOLD);
  const strengths = distribution.filter(
    (d) => d.averageWeight > STRENGTH_THRESHOLD,
  );
  const complementary = findComplementaryPairs(members);
  const risks = identifyRiskFactors(distribution);

  return {
    members,
    archetypeDistribution: distribution,
    gaps,
    strengths,
    complementaryPairs: complementary,
    riskFactors: risks,
  };
}

/**
 * Returns a departments x archetypes heatmap for the org.
 * Uses MS Graph org directory for department data, joined with Signal Map profiles.
 */
export async function getOrgArchetypeHeatmap(): Promise<OrgHeatmap> {
  const emptyResult: OrgHeatmap = {
    departments: [],
    archetypes: ALL_ARCHETYPE_IDS.map((id) => ({
      id,
      name: ARCHETYPE_NAMES[id] ?? id,
    })),
    cells: [],
  };

  // Get all assessed profiles
  const profiles = await getAllAssessedProfiles();
  if ((profiles ?? []).length === 0) return emptyResult;

  // Get department mapping from people API (MS Graph cached data)
  let deptMap: Record<string, string> = {};
  try {
    const { loadOrgDirectory } = await import('@/lib/config/roles');
    const org = await loadOrgDirectory();
    for (const user of org ?? []) {
      if (user.mail && user.department) {
        deptMap = { ...deptMap, [user.mail.toLowerCase()]: user.department };
      }
    }
  } catch {
    // Org directory unavailable — use fallback
  }

  // If org directory is empty, try to infer from static mapping
  if (Object.keys(deptMap).length === 0) {
    // Use a basic fallback — profiles without department info
    // will be grouped under "Unassigned"
  }

  // Group profiles by department
  const byDept: Record<string, EnrichedProfile[]> = {};
  for (const profile of profiles) {
    const dept = deptMap[profile.email.toLowerCase()] ?? 'Unassigned';
    byDept[dept] = [...(byDept[dept] ?? []), profile];
  }

  const departments = Object.keys(byDept).sort();
  const cells: HeatmapCell[] = [];

  for (const dept of departments) {
    const deptProfiles = byDept[dept] ?? [];
    const deptCount = deptProfiles.length || 1;

    for (const arcId of ALL_ARCHETYPE_IDS) {
      let weightSum = 0;
      let matchCount = 0;

      for (const p of deptProfiles) {
        const match = (p.topArchetypes ?? []).find((a) => a.id === arcId);
        if (match) {
          weightSum += match.weight;
          matchCount += 1;
        }
      }

      cells.push({
        department: dept,
        archetypeId: arcId,
        archetypeName: ARCHETYPE_NAMES[arcId] ?? arcId,
        averageWeight: matchCount > 0 ? weightSum / deptCount : 0,
        count: matchCount,
      });
    }
  }

  return {
    departments,
    archetypes: ALL_ARCHETYPE_IDS.map((id) => ({
      id,
      name: ARCHETYPE_NAMES[id] ?? id,
    })),
    cells,
  };
}
