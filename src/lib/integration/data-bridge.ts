/**
 * Data Bridge
 * Gateway-backed cross-app data fetching with local caching.
 * All data flows through the unified gateway at :3847.
 * When Supabase/Neo4j are ready, swap the implementation to query
 * local DB first and fall back to gateway for live data.
 */

export type BridgeSource = 'ascend' | 'salesforce' | 'samsara' | 'fleetpanda' | 'vroozi';

export interface BridgeQuery {
  readonly source: BridgeSource;
  readonly endpoint: string;
  readonly params?: Record<string, string>;
  readonly sql?: string;
  readonly cacheTTL?: number;  // milliseconds, default 300000 (5 min)
}

export interface BridgeResult<T = Record<string, unknown>> {
  readonly success: boolean;
  readonly source: string;
  readonly data: T[];
  readonly cached: boolean;
  readonly fetchedAt: string;
  readonly error?: string;
}

const GATEWAY_BASE_URL = process.env.GATEWAY_BASE_URL || process.env.NEXT_PUBLIC_GATEWAY_URL || 'http://127.0.0.1:3847';
const GATEWAY_API_KEY = process.env.GATEWAY_API_KEY || '';
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const CACHE_PREFIX = 'di_bridge_';

// --- Cache helpers (localStorage, browser only) ---

interface CacheEntry<T> {
  data: T[];
  source: string;
  fetchedAt: string;
  expiresAt: number;
}

function getCacheKey(query: BridgeQuery): string {
  const parts = [query.source, query.endpoint];
  if (query.sql) parts.push(query.sql);
  if (query.params) parts.push(JSON.stringify(query.params));
  return CACHE_PREFIX + btoa(parts.join('|')).slice(0, 64);
}

function readCache<T>(key: string): CacheEntry<T> | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() > entry.expiresAt) {
      localStorage.removeItem(key);
      return null;
    }
    return entry;
  } catch {
    return null;
  }
}

function writeCache<T>(key: string, data: T[], source: string, ttl: number): void {
  if (typeof window === 'undefined') return;
  try {
    const entry: CacheEntry<T> = {
      data,
      source,
      fetchedAt: new Date().toISOString(),
      expiresAt: Date.now() + ttl,
    };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {
    // localStorage full or unavailable — skip cache
  }
}

// --- Core fetch ---

/**
 * Fetch data from the gateway with caching.
 */
export async function fetchBridgeData<T = Record<string, unknown>>(
  query: BridgeQuery
): Promise<BridgeResult<T>> {
  const cacheKey = getCacheKey(query);
  const ttl = query.cacheTTL ?? DEFAULT_CACHE_TTL;

  // Check cache first
  const cached = readCache<T>(cacheKey);
  if (cached) {
    return {
      success: true,
      source: cached.source,
      data: cached.data,
      cached: true,
      fetchedAt: cached.fetchedAt,
    };
  }

  // Fetch from gateway
  try {
    const isSQL = query.sql && query.endpoint === '/ascend/query';
    const url = new URL(query.endpoint, GATEWAY_BASE_URL);

    if (!isSQL && query.params) {
      for (const [key, value] of Object.entries(query.params)) {
        url.searchParams.set(key, value);
      }
    }

    const res = await fetch(url.toString(), {
      method: isSQL ? 'POST' : 'GET',
      headers: {
        'x-api-key': GATEWAY_API_KEY,
        'Content-Type': 'application/json',
      },
      body: isSQL ? JSON.stringify({ sql: query.sql }) : undefined,
      signal: AbortSignal.timeout(15000),
    });

    if (!res.ok) {
      return {
        success: false,
        source: query.source,
        data: [],
        cached: false,
        fetchedAt: new Date().toISOString(),
        error: `Gateway ${res.status}: ${res.statusText}`,
      };
    }

    const json = await res.json();
    const data: T[] = json.data ?? json.rows ?? json.records ?? [];

    // Write to cache
    writeCache(cacheKey, data, query.source, ttl);

    return {
      success: true,
      source: query.source,
      data,
      cached: false,
      fetchedAt: new Date().toISOString(),
    };
  } catch (err) {
    return {
      success: false,
      source: query.source,
      data: [],
      cached: false,
      fetchedAt: new Date().toISOString(),
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// --- Convenience helpers ---

/**
 * Fetch data from a Portal /api/live/* endpoint.
 */
export async function fetchPortalData<T = Record<string, unknown>>(
  endpoint: string,
  params?: Record<string, string>
): Promise<BridgeResult<T>> {
  return fetchBridgeData<T>({
    source: 'ascend',
    endpoint,
    params,
  });
}

/**
 * Fetch equipment data from the gateway.
 */
export async function fetchEquipmentData<T = Record<string, unknown>>(
  endpoint: string,
  params?: Record<string, string>
): Promise<BridgeResult<T>> {
  return fetchBridgeData<T>({
    source: 'samsara',
    endpoint,
    params,
  });
}

/**
 * Run a raw SQL query against Ascend via the gateway.
 */
export async function queryAscend<T = Record<string, unknown>>(
  sql: string,
  cacheTTL?: number
): Promise<BridgeResult<T>> {
  return fetchBridgeData<T>({
    source: 'ascend',
    endpoint: '/ascend/query',
    sql,
    cacheTTL,
  });
}

/**
 * Run a SOQL query against Salesforce via the gateway.
 */
export async function querySalesforce<T = Record<string, unknown>>(
  soql: string,
  cacheTTL?: number
): Promise<BridgeResult<T>> {
  return fetchBridgeData<T>({
    source: 'salesforce',
    endpoint: '/salesforce/query',
    sql: soql,
    cacheTTL,
  });
}

/**
 * Clear bridge cache. If source is specified, only clear entries for that source.
 */
export function invalidateCache(source?: string): void {
  if (typeof window === 'undefined') return;

  const keysToRemove: string[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key?.startsWith(CACHE_PREFIX)) {
      if (!source) {
        keysToRemove.push(key);
      } else {
        try {
          const entry = JSON.parse(localStorage.getItem(key) ?? '{}');
          if (entry.source === source) keysToRemove.push(key);
        } catch {
          keysToRemove.push(key);
        }
      }
    }
  }

  for (const key of keysToRemove) {
    localStorage.removeItem(key);
  }
}
