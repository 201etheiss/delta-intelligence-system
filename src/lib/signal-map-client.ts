/**
 * Signal Map Client — queries OTED operator profiles from the shared Supabase instance.
 *
 * Signal Map tables (persons, profiles, assessment_sessions, reports) live in the same
 * Supabase database as Delta Intelligence. Identity bridging: persons.email = DI mail field.
 */

import { getSupabase } from '@/lib/supabase';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Archetype {
  readonly id: string;
  readonly weight: number;
}

interface Confidence {
  readonly overall: number;
  readonly [key: string]: unknown;
}

interface PsychometricXref {
  readonly mbti?: string;
  readonly disc?: string;
  readonly [key: string]: unknown;
}

interface RoleFit {
  readonly bestRoles?: readonly string[];
  readonly [key: string]: unknown;
}

interface NarrativeCache {
  readonly operatingSignature?: string;
  readonly executiveSummary?: string;
  readonly deepDive?: string;
  readonly psychometricXref?: PsychometricXref;
  readonly roleFit?: RoleFit;
  readonly counterbalances?: unknown;
  readonly fullReport?: string;
}

export interface SignalMapProfile {
  readonly personId: string;
  readonly email: string;
  readonly name: string;
  readonly sessionId: string;
  readonly completedAt: string;
  readonly hybridClassification: string | null;
  readonly archetypePortfolio: readonly Archetype[];
  readonly confidence: Confidence | null;
  readonly lensProfile: Record<string, unknown> | null;
  readonly seatOverlays: readonly Record<string, unknown>[];
  readonly pressureTransforms: Record<string, unknown> | null;
  readonly failureModes: readonly Record<string, unknown>[];
  readonly installBundles: readonly Record<string, unknown>[];
  readonly narrativeCache: NarrativeCache | null;
}

export interface SignalMapSummary {
  readonly email: string;
  readonly name: string;
  readonly operatingSignature: string | null;
  readonly topArchetypes: readonly Archetype[];
  readonly confidenceOverall: number | null;
  readonly hybridClassification: string | null;
  readonly mbti: string | null;
  readonly disc: string | null;
  readonly bestRoles: readonly string[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function parseArchetypes(raw: unknown): readonly Archetype[] {
  if (!raw || !Array.isArray(raw)) return [];
  return (raw as Array<Record<string, unknown>>)
    .filter((a) => typeof a.id === 'string' && typeof a.weight === 'number')
    .map((a) => ({ id: a.id as string, weight: a.weight as number }));
}

function parseJsonField<T>(raw: unknown, fallback: T): T {
  if (raw === null || raw === undefined) return fallback;
  if (typeof raw === 'object') return raw as T;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  return fallback;
}

function toProfile(row: Record<string, unknown>): SignalMapProfile {
  const narrative = parseJsonField<NarrativeCache | null>(row.narrative_cache, null);
  const archetypes = parseArchetypes(
    parseJsonField<unknown[]>(row.archetype_portfolio, []),
  );

  return {
    personId: String(row.person_id ?? ''),
    email: String(row.email ?? ''),
    name: String(row.name ?? ''),
    sessionId: String(row.session_id ?? ''),
    completedAt: String(row.completed_at ?? ''),
    hybridClassification: row.hybrid_classification ? String(row.hybrid_classification) : null,
    archetypePortfolio: archetypes,
    confidence: parseJsonField<Confidence | null>(row.confidence, null),
    lensProfile: parseJsonField<Record<string, unknown> | null>(row.lens_profile, null),
    seatOverlays: parseJsonField<readonly Record<string, unknown>[]>(row.seat_overlays, []),
    pressureTransforms: parseJsonField<Record<string, unknown> | null>(row.pressure_transforms, null),
    failureModes: parseJsonField<readonly Record<string, unknown>[]>(row.failure_modes, []),
    installBundles: parseJsonField<readonly Record<string, unknown>[]>(row.install_bundles, []),
    narrativeCache: narrative,
  };
}

function toSummary(profile: SignalMapProfile): SignalMapSummary {
  const narrative = profile.narrativeCache;
  const xref = narrative?.psychometricXref;
  const roleFit = narrative?.roleFit;

  return {
    email: profile.email,
    name: profile.name,
    operatingSignature: narrative?.operatingSignature ?? null,
    topArchetypes: [...profile.archetypePortfolio]
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3),
    confidenceOverall: profile.confidence?.overall ?? null,
    hybridClassification: profile.hybridClassification,
    mbti: xref?.mbti ?? null,
    disc: xref?.disc ?? null,
    bestRoles: (roleFit?.bestRoles ?? []) as readonly string[],
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns the most recent enriched profile for a person by email.
 * Joins persons + profiles + assessment_sessions, filtering for profiles
 * where narrative_cache.fullReport is not null.
 */
export async function getProfileByEmail(
  email: string,
): Promise<SignalMapProfile | null> {
  const client = getSupabase();
  if (!client) return null;

  const { data, error } = await client
    .from('profiles')
    .select(`
      *,
      persons!inner(email, name),
      assessment_sessions!inner(completed_at, status)
    `)
    .eq('persons.email', email.toLowerCase().trim())
    .eq('assessment_sessions.status', 'completed')
    .not('narrative_cache->fullReport', 'is', null)
    .order('assessment_sessions(completed_at)', { ascending: false })
    .limit(1)
    .single();

  if (error || !data) return null;

  const row = {
    ...data,
    email: (data as Record<string, unknown>).persons
      ? ((data as Record<string, unknown>).persons as Record<string, unknown>).email
      : email,
    name: (data as Record<string, unknown>).persons
      ? ((data as Record<string, unknown>).persons as Record<string, unknown>).name
      : '',
    completed_at: (data as Record<string, unknown>).assessment_sessions
      ? ((data as Record<string, unknown>).assessment_sessions as Record<string, unknown>).completed_at
      : null,
  };

  return toProfile(row as Record<string, unknown>);
}

/**
 * Lighter version returning summary fields only.
 */
export async function getProfileSummary(
  email: string,
): Promise<SignalMapSummary | null> {
  const profile = await getProfileByEmail(email);
  if (!profile) return null;
  return toSummary(profile);
}

/**
 * Batch lookup for team composition view.
 */
export async function getTeamProfiles(
  emails: readonly string[],
): Promise<readonly SignalMapSummary[]> {
  if ((emails ?? []).length === 0) return [];

  const results = await Promise.all(
    emails.map((e) => getProfileSummary(e)),
  );

  return results.filter((r): r is SignalMapSummary => r !== null);
}

/**
 * Boolean check: does this person have a completed assessment?
 */
export async function hasAssessment(email: string): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const { data, error } = await client
    .from('profiles')
    .select('id, persons!inner(email)')
    .eq('persons.email', email.toLowerCase().trim())
    .not('narrative_cache->fullReport', 'is', null)
    .limit(1);

  if (error) return false;
  return (data ?? []).length > 0;
}
