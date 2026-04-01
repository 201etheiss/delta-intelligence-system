/**
 * API Response Cache — In-memory TTL cache for API route responses.
 *
 * Use in API route handlers to cache full JSON responses and avoid
 * redundant data-bridge / gateway calls on rapid page loads.
 *
 * Default TTL: 60 seconds (tunable per key).
 */

interface CacheEntry<T> {
  readonly data: T;
  readonly expiresAt: number;
}

const responseCache = new Map<string, CacheEntry<unknown>>();

const DEFAULT_TTL_MS = 60 * 1000; // 60 seconds

/**
 * Get a cached response by key.
 * Returns null if missing or expired.
 */
export function getCachedResponse<T>(key: string): T | null {
  const entry = responseCache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    responseCache.delete(key);
    return null;
  }
  return entry.data as T;
}

/**
 * Store a response in the cache.
 * Returns the data for chaining convenience.
 */
export function setCachedResponse<T>(key: string, data: T, ttlMs?: number): T {
  responseCache.set(key, {
    data,
    expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL_MS),
  });
  return data;
}

/**
 * Clear a specific key or all cached responses.
 */
export function clearResponseCache(key?: string): void {
  if (key) {
    responseCache.delete(key);
  } else {
    responseCache.clear();
  }
}

/**
 * Wrap an async fetcher with caching.
 * Returns cached data if available, otherwise calls fetcher and caches result.
 */
export async function withCache<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlMs?: number,
): Promise<T> {
  const cached = getCachedResponse<T>(key);
  if (cached !== null) return cached;
  const data = await fetcher();
  return setCachedResponse(key, data, ttlMs);
}
