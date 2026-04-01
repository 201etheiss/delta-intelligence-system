/**
 * Plugin Registry — CRUD operations with file-based persistence.
 *
 * Data files:
 *   data/plugins.json        — array of PluginConfig
 *   data/plugin-call-log.json — array of PluginCallLog (max 500 entries)
 *
 * All mutations produce new objects (immutable pattern).
 */

import * as fs from 'fs';
import * as path from 'path';
import type {
  PluginCallLog,
  PluginCapability,
  PluginCategory,
  PluginConfig,
} from '@/lib/plugins/types';

/** Maximum number of call-log entries retained on disk */
const MAX_LOG_ENTRIES = 500;

/** Resolve a path relative to the project data/ directory */
function dataPath(filename: string): string {
  return path.join(process.cwd(), 'data', filename);
}

// ---------------------------------------------------------------------------
// Persistence helpers
// ---------------------------------------------------------------------------

/**
 * Load all registered plugins from data/plugins.json.
 * Returns an empty array if the file does not exist or is malformed.
 */
export function loadPlugins(): PluginConfig[] {
  try {
    const raw = fs.readFileSync(dataPath('plugins.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PluginConfig[];
  } catch {
    return [];
  }
}

/**
 * Persist the full plugin list to data/plugins.json.
 * Creates the data/ directory if it does not exist.
 */
export function savePlugins(plugins: readonly PluginConfig[]): void {
  const dir = dataPath('');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dataPath('plugins.json'), JSON.stringify(plugins, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// Read helpers
// ---------------------------------------------------------------------------

/**
 * Retrieve a single plugin by its unique ID.
 * Returns null when not found.
 */
export function getPlugin(id: string): PluginConfig | null {
  const plugins = loadPlugins();
  return plugins.find((p) => p.id === id) ?? null;
}

/**
 * Return all plugins that declare the given capability.
 */
export function getPluginsByCapability(cap: PluginCapability): PluginConfig[] {
  const plugins = loadPlugins();
  return plugins.filter((p) => p.capabilities.includes(cap));
}

/**
 * Return all plugins in a given category.
 */
export function getPluginsByCategory(cat: PluginCategory): PluginConfig[] {
  const plugins = loadPlugins();
  return plugins.filter((p) => p.category === cat);
}

/**
 * Return only plugins whose status is 'active'.
 */
export function getActivePlugins(): PluginConfig[] {
  const plugins = loadPlugins();
  return plugins.filter((p) => p.status === 'active');
}

// ---------------------------------------------------------------------------
// Write helpers
// ---------------------------------------------------------------------------

/**
 * Update routing-weight fields for a specific plugin.
 * Only qualityScore, reliabilityScore, and avgRating may be patched.
 * Produces a new plugin object (immutable).
 */
export function updatePluginWeights(
  id: string,
  updates: Partial<Pick<PluginConfig, 'qualityScore' | 'reliabilityScore' | 'avgRating'>>,
): void {
  const plugins = loadPlugins();
  const idx = plugins.findIndex((p) => p.id === id);
  if (idx === -1) return;

  const existing = plugins[idx];
  const updated: PluginConfig = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  const next = [...plugins.slice(0, idx), updated, ...plugins.slice(idx + 1)];
  savePlugins(next);
}

// ---------------------------------------------------------------------------
// Call logging
// ---------------------------------------------------------------------------

/** Load raw call-log entries from disk */
function loadCallLogRaw(): PluginCallLog[] {
  try {
    const raw = fs.readFileSync(dataPath('plugin-call-log.json'), 'utf-8');
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed as PluginCallLog[];
  } catch {
    return [];
  }
}

/** Persist call-log entries to disk */
function saveCallLog(logs: readonly PluginCallLog[]): void {
  const dir = dataPath('');
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(dataPath('plugin-call-log.json'), JSON.stringify(logs, null, 2), 'utf-8');
}

/**
 * Append a call-log entry. Trims oldest entries when the log exceeds MAX_LOG_ENTRIES.
 * Also increments the plugin's totalCalls and totalCost counters.
 */
export function logPluginCall(log: PluginCallLog): void {
  // Append to call log (immutable — new array)
  const existing = loadCallLogRaw();
  const updated = [...existing, log];
  const trimmed = updated.length > MAX_LOG_ENTRIES
    ? updated.slice(updated.length - MAX_LOG_ENTRIES)
    : updated;
  saveCallLog(trimmed);

  // Update plugin counters
  const plugins = loadPlugins();
  const idx = plugins.findIndex((p) => p.id === log.pluginId);
  if (idx === -1) return;

  const plugin = plugins[idx];
  const patched: PluginConfig = {
    ...plugin,
    totalCalls: plugin.totalCalls + 1,
    totalCost: plugin.totalCost + log.estimatedCost,
    updatedAt: new Date().toISOString(),
  };

  const next = [...plugins.slice(0, idx), patched, ...plugins.slice(idx + 1)];
  savePlugins(next);
}

/**
 * Retrieve call-log entries, optionally filtered by pluginId.
 * Returns newest-first, capped by limit (default 50).
 */
export function getPluginLogs(pluginId?: string, limit = 50): PluginCallLog[] {
  const all = loadCallLogRaw();
  const filtered = pluginId ? all.filter((l) => l.pluginId === pluginId) : all;
  return filtered.slice(-limit).reverse();
}
