/**
 * Simple in-memory rate limiter for API routes.
 * Tracks requests per user (email) with sliding window.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

// Clean up expired entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of Array.from(store)) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 300_000);

export interface RateLimitConfig {
  maxRequests: number;  // max requests per window
  windowMs: number;     // window size in ms
}

export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): { allowed: boolean; remaining: number; resetAt: number } {
  const now = Date.now();
  const key = identifier;
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, resetAt: now + config.windowMs };
  }

  entry.count++;
  const allowed = entry.count <= config.maxRequests;
  return { allowed, remaining: Math.max(0, config.maxRequests - entry.count), resetAt: entry.resetAt };
}

// Pre-configured limits
export const CHAT_LIMIT: RateLimitConfig = { maxRequests: 30, windowMs: 60_000 };     // 30/min
export const REPORT_LIMIT: RateLimitConfig = { maxRequests: 5, windowMs: 60_000 };     // 5/min
export const EXPORT_LIMIT: RateLimitConfig = { maxRequests: 10, windowMs: 60_000 };    // 10/min
export const GATEWAY_LIMIT: RateLimitConfig = { maxRequests: 60, windowMs: 60_000 };   // 60/min
