/**
 * Plugin Router — Weighted scoring engine for capability-based plugin selection.
 *
 * Score formula:
 *   score = (qualityScore * 0.4)
 *         + (reliabilityScore * 0.2)
 *         + ((1 - normalizedCost) * 0.2)
 *         + ((1 - normalizedLatency) * 0.2)
 *
 * Normalization uses min-max across the candidate set so that the cheapest
 * plugin scores 1.0 on cost and the fastest scores 1.0 on latency.
 */

import {
  getPluginsByCapability,
  updatePluginWeights,
  getPlugin,
} from '@/lib/plugins/registry';
import type {
  PluginCapability,
  PluginConfig,
  PluginRouteResult,
} from '@/lib/plugins/types';

/** Exponential moving average alpha for feedback reweighting */
const EMA_ALPHA = 0.3;

// ---------------------------------------------------------------------------
// Routing options
// ---------------------------------------------------------------------------

export interface RouteOptions {
  /** Prefer a specific provider (exact match on PluginConfig.provider) */
  preferProvider?: string;
  /** Maximum acceptable cost per call (USD) */
  maxCost?: number;
  /** Team role of the requesting user — must appear in plugin.teamAccess */
  teamRole?: string;
}

// ---------------------------------------------------------------------------
// Scoring helpers
// ---------------------------------------------------------------------------

/**
 * Normalize a value within a [min, max] range to [0, 1].
 * Returns 0 when min === max (all candidates equal).
 */
function normalize(value: number, min: number, max: number): number {
  if (max === min) return 0;
  return (value - min) / (max - min);
}

/**
 * Compute the composite routing score for a single plugin given
 * the min/max cost and latency across the candidate set.
 */
function computeScore(
  plugin: PluginConfig,
  costMin: number,
  costMax: number,
  latencyMin: number,
  latencyMax: number,
): number {
  const normalizedCost = normalize(plugin.costPerCall, costMin, costMax);
  const normalizedLatency = normalize(plugin.latencyP95Ms, latencyMin, latencyMax);

  return (
    plugin.qualityScore * 0.4 +
    plugin.reliabilityScore * 0.2 +
    (1 - normalizedCost) * 0.2 +
    (1 - normalizedLatency) * 0.2
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Select the best plugin for a given capability.
 *
 * Filters by:
 *   1. status === 'active'
 *   2. teamAccess includes the caller's role (when provided)
 *   3. costPerCall <= maxCost (when provided)
 *
 * Returns the highest-scored plugin, a human-readable reason, and
 * up to 3 ranked alternatives. Returns null when no candidate qualifies.
 */
export function routeToPlugin(
  capability: PluginCapability,
  options: RouteOptions = {},
): PluginRouteResult | null {
  const { preferProvider, maxCost, teamRole } = options;

  // 1. Gather candidates
  let candidates = getPluginsByCapability(capability).filter(
    (p) => p.status === 'active',
  );

  // 2. Filter by team role
  if (teamRole) {
    candidates = candidates.filter(
      (p) => p.teamAccess.includes(teamRole) || p.teamAccess.includes('*'),
    );
  }

  // 3. Filter by max cost
  if (maxCost !== undefined) {
    candidates = candidates.filter((p) => p.costPerCall <= maxCost);
  }

  if (candidates.length === 0) return null;

  // 4. Compute min/max for normalization
  const costs = candidates.map((p) => p.costPerCall);
  const latencies = candidates.map((p) => p.latencyP95Ms);
  const costMin = Math.min(...costs);
  const costMax = Math.max(...costs);
  const latencyMin = Math.min(...latencies);
  const latencyMax = Math.max(...latencies);

  // 5. Score each candidate
  const scored = candidates
    .map((plugin) => ({
      plugin,
      score: computeScore(plugin, costMin, costMax, latencyMin, latencyMax),
    }))
    .sort((a, b) => b.score - a.score);

  // 6. Apply provider preference boost (+0.05)
  if (preferProvider) {
    const preferred = scored.find((s) => s.plugin.provider === preferProvider);
    if (preferred) {
      preferred.score = Math.min(1, preferred.score + 0.05);
      scored.sort((a, b) => b.score - a.score);
    }
  }

  const best = scored[0];
  const alternatives = scored.slice(1, 4);

  const reason = [
    `Selected ${best.plugin.name} (${best.plugin.provider})`,
    `for "${capability}" capability.`,
    `Quality=${best.plugin.qualityScore.toFixed(2)},`,
    `Reliability=${best.plugin.reliabilityScore.toFixed(2)},`,
    `Cost=$${best.plugin.costPerCall.toFixed(4)}/call,`,
    `Latency=${best.plugin.latencyP95Ms}ms p95.`,
    alternatives.length > 0
      ? `${alternatives.length} alternative(s) available.`
      : 'No alternatives available.',
  ].join(' ');

  return {
    plugin: best.plugin,
    score: best.score,
    reason,
    alternatives,
  };
}

/**
 * Update a plugin's quality and rating scores using exponential moving average.
 *
 * newQuality  = alpha * (rating / 5) + (1 - alpha) * existingQuality
 * newAvgRating = alpha * rating + (1 - alpha) * existingAvgRating
 *
 * @param pluginId - The plugin to reweight
 * @param rating   - User rating (1-5)
 */
export function reweightFromFeedback(pluginId: string, rating: number): void {
  const plugin = getPlugin(pluginId);
  if (!plugin) return;

  const clampedRating = Math.max(1, Math.min(5, rating));
  const normalizedRating = clampedRating / 5;

  const newQualityScore =
    EMA_ALPHA * normalizedRating + (1 - EMA_ALPHA) * plugin.qualityScore;
  const newAvgRating =
    EMA_ALPHA * clampedRating + (1 - EMA_ALPHA) * plugin.avgRating;

  updatePluginWeights(pluginId, {
    qualityScore: parseFloat(newQualityScore.toFixed(4)),
    avgRating: parseFloat(newAvgRating.toFixed(2)),
  });
}
