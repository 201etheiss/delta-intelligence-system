/**
 * Cross-System Entity Resolution
 *
 * Matches customers across Ascend ERP and Salesforce CRM by name similarity.
 * Uses normalized string comparison with fuzzy matching.
 */

import { gatewayFetch } from '@/lib/gateway';

interface ResolvedEntity {
  ascendName: string | null;
  salesforceName: string | null;
  salesforceId: string | null;
  confidence: number; // 0-1
  matchType: 'exact' | 'normalized' | 'fuzzy' | 'unmatched';
}

/**
 * Normalize a company name for comparison.
 * Strips LLC, Inc, Co, LP, etc. and normalizes whitespace/case.
 */
function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.'"\-()]/g, '')
    .replace(/\b(llc|inc|corp|corporation|co|lp|ltd|company|llp|pllc|plc)\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Simple Levenshtein distance for fuzzy matching
 */
function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] = b[i - 1] === a[j - 1]
        ? matrix[i - 1][j - 1]
        : Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
    }
  }
  return matrix[b.length][a.length];
}

/**
 * Calculate similarity score between two names (0-1)
 */
function similarity(a: string, b: string): number {
  const normA = normalizeName(a);
  const normB = normalizeName(b);
  if (normA === normB) return 1.0;
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1.0;
  const dist = levenshtein(normA, normB);
  return 1.0 - dist / maxLen;
}

// Cache for resolved entities (TTL: 1 hour)
let cache: { entities: readonly ResolvedEntity[]; fetchedAt: number } | null = null;
const CACHE_TTL = 60 * 60 * 1000;

/**
 * Resolve a single customer name across systems
 */
export async function resolveCustomer(name: string): Promise<ResolvedEntity> {
  const entities = await resolveAllCustomers();

  // First try exact match
  const exact = entities.find(e =>
    (e.ascendName && normalizeName(e.ascendName) === normalizeName(name)) ||
    (e.salesforceName && normalizeName(e.salesforceName) === normalizeName(name))
  );
  if (exact) return exact;

  // Fuzzy match
  let bestMatch: ResolvedEntity | null = null;
  let bestScore = 0;
  for (const entity of entities) {
    const scoreA = entity.ascendName ? similarity(name, entity.ascendName) : 0;
    const scoreS = entity.salesforceName ? similarity(name, entity.salesforceName) : 0;
    const score = Math.max(scoreA, scoreS);
    if (score > bestScore && score >= 0.7) {
      bestScore = score;
      bestMatch = entity;
    }
  }

  if (bestMatch) return { ...bestMatch, confidence: bestScore, matchType: 'fuzzy' };

  return { ascendName: name, salesforceName: null, salesforceId: null, confidence: 0, matchType: 'unmatched' };
}

/**
 * Build the full entity resolution map across Ascend and Salesforce
 */
export async function resolveAllCustomers(): Promise<readonly ResolvedEntity[]> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.entities;
  }

  // Pull customer names from both systems in parallel
  const [ascendResult, sfResult] = await Promise.all([
    gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: { sql: "SELECT DISTINCT CustomerName FROM DF_PBI_BillingChartQuery WHERE Year >= 2024 AND CustomerName IS NOT NULL" },
    }).catch(() => ({ success: false as const, data: [] })),
    gatewayFetch('/salesforce/query', 'admin', {
      method: 'POST',
      body: { soql: "SELECT Id, Name FROM Account WHERE Type = 'Customer' ORDER BY Name LIMIT 2000" },
    }).catch(() => ({ success: false as const, records: [] })),
  ]);

  const ascendNames: string[] = (
    (ascendResult as Record<string, unknown>).data as Array<Record<string, string>> ?? []
  )
    .map(r => r.CustomerName)
    .filter(Boolean);

  const sfAccounts: Array<{ Id: string; Name: string }> =
    ((sfResult as Record<string, unknown>).records as Array<{ Id: string; Name: string }>) ?? [];

  // Build resolution map
  const entities: ResolvedEntity[] = [];
  const matchedSfIds = new Set<string>();

  for (const ascendName of ascendNames) {
    const normAscend = normalizeName(ascendName);

    // Try exact normalized match
    const exactMatch = sfAccounts.find(sf => normalizeName(sf.Name) === normAscend && !matchedSfIds.has(sf.Id));
    if (exactMatch) {
      matchedSfIds.add(exactMatch.Id);
      entities.push({
        ascendName,
        salesforceName: exactMatch.Name,
        salesforceId: exactMatch.Id,
        confidence: 1.0,
        matchType: normAscend === exactMatch.Name.toLowerCase() ? 'exact' : 'normalized',
      });
      continue;
    }

    // Fuzzy match
    let bestSf: typeof sfAccounts[0] | null = null;
    let bestScore = 0;
    for (const sf of sfAccounts) {
      if (matchedSfIds.has(sf.Id)) continue;
      const score = similarity(ascendName, sf.Name);
      if (score > bestScore && score >= 0.8) {
        bestScore = score;
        bestSf = sf;
      }
    }

    if (bestSf) {
      matchedSfIds.add(bestSf.Id);
      entities.push({
        ascendName,
        salesforceName: bestSf.Name,
        salesforceId: bestSf.Id,
        confidence: bestScore,
        matchType: 'fuzzy',
      });
    } else {
      entities.push({
        ascendName,
        salesforceName: null,
        salesforceId: null,
        confidence: 0,
        matchType: 'unmatched',
      });
    }
  }

  // Add SF-only accounts
  for (const sf of sfAccounts) {
    if (!matchedSfIds.has(sf.Id)) {
      entities.push({
        ascendName: null,
        salesforceName: sf.Name,
        salesforceId: sf.Id,
        confidence: 0,
        matchType: 'unmatched',
      });
    }
  }

  cache = { entities, fetchedAt: Date.now() };
  return entities;
}

/**
 * Get resolution statistics
 */
export async function getResolutionStats(): Promise<{
  total: number;
  matched: number;
  unmatched: number;
  matchRate: number;
  byType: Record<string, number>;
}> {
  const entities = await resolveAllCustomers();
  const matched = entities.filter(e => e.matchType !== 'unmatched').length;
  const byType: Record<string, number> = {};
  for (const e of entities) {
    byType[e.matchType] = (byType[e.matchType] ?? 0) + 1;
  }
  return {
    total: entities.length,
    matched,
    unmatched: entities.length - matched,
    matchRate: entities.length > 0 ? matched / entities.length : 0,
    byType,
  };
}
