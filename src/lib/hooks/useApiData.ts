/**
 * useApiData — Shared client-side data fetching hook with SWR-style caching.
 *
 * Features:
 *  - Module-level Map cache shared across all components
 *  - Stale-while-revalidate: returns cached data immediately, refetches in background
 *  - Deduplicates concurrent requests to the same URL
 *  - Configurable refresh interval
 *  - Fallback value while loading
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface CacheEntry<T> {
  readonly data: T;
  readonly fetchedAt: number;
}

// Module-level cache — shared across all hook instances
const dataCache = new Map<string, CacheEntry<unknown>>();

// In-flight request deduplication
const inflightRequests = new Map<string, Promise<unknown>>();

const STALE_TTL_MS = 30_000; // Consider data stale after 30s

interface UseApiDataOptions<T> {
  /** Auto-refresh interval in ms. 0 = disabled. */
  refreshInterval?: number;
  /** Fallback value while loading (before first successful fetch). */
  fallback?: T;
  /** Whether to fetch immediately on mount. Default true. */
  enabled?: boolean;
}

interface UseApiDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

async function fetchWithDedup<T>(url: string): Promise<T> {
  // If there is already an in-flight request for this URL, reuse it
  const existing = inflightRequests.get(url);
  if (existing) return existing as Promise<T>;

  const promise = fetch(url)
    .then(async (res) => {
      const json = await res.json();
      if (!res.ok || json.success === false) {
        throw new Error(json.error ?? `Request failed: ${res.status}`);
      }
      // Unwrap: if the response has a `.data` property, return that
      const payload = json.data !== undefined ? json.data : json;
      // Cache the result
      dataCache.set(url, { data: payload, fetchedAt: Date.now() });
      return payload as T;
    })
    .finally(() => {
      inflightRequests.delete(url);
    });

  inflightRequests.set(url, promise);
  return promise;
}

export function useApiData<T>(
  url: string,
  options?: UseApiDataOptions<T>,
): UseApiDataReturn<T> {
  const { refreshInterval = 0, fallback, enabled = true } = options ?? {};

  const cached = dataCache.get(url) as CacheEntry<T> | undefined;
  const isStale = cached ? Date.now() - cached.fetchedAt > STALE_TTL_MS : true;

  const [data, setData] = useState<T | null>(cached?.data ?? fallback ?? null);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const doFetch = useCallback(async () => {
    if (!enabled) return;
    try {
      // If we have cached data, show it and fetch in background (SWR)
      if (!dataCache.has(url)) {
        setLoading(true);
      }
      const result = await fetchWithDedup<T>(url);
      if (mountedRef.current) {
        setData(result);
        setError(null);
        setLoading(false);
      }
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err.message : 'Fetch failed');
        setLoading(false);
      }
    }
  }, [url, enabled]);

  // Initial fetch + refetch when stale
  useEffect(() => {
    mountedRef.current = true;
    if (enabled && isStale) {
      doFetch();
    }
    return () => {
      mountedRef.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, enabled]);

  // Refresh interval
  useEffect(() => {
    if (!enabled || refreshInterval <= 0) return;
    const interval = setInterval(doFetch, refreshInterval);
    return () => clearInterval(interval);
  }, [doFetch, refreshInterval, enabled]);

  const refresh = useCallback(() => {
    // Invalidate cache entry so next fetch is treated as fresh
    dataCache.delete(url);
    doFetch();
  }, [url, doFetch]);

  return { data, loading, error, refresh };
}
