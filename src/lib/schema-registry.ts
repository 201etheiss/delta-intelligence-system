/**
 * Schema Registry + Query Learning Layer
 *
 * Crawls all data sources, indexes their structure, and learns from queries.
 * Persists to a local JSON file so it survives restarts and serves as
 * a reference DB for all models and use cases.
 *
 * Architecture:
 * - SchemaRegistry: discovers and caches table/column structure from all sources
 * - QueryLog: records successful queries + result shapes for future reference
 * - DataIndex: pre-built indexes of products, customers, locations for fast lookup
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ─── Types ─────────────────────────────────────────────────────────────

interface TableSchema {
  source: string;
  table: string;
  columns: ColumnDef[];
  rowCountEstimate?: number;
  lastCrawled: string;
}

interface ColumnDef {
  name: string;
  type: string;
  nullable: boolean;
}

interface QueryLogEntry {
  timestamp: string;
  query: string;
  endpoint: string;
  resultShape: {
    rowCount: number;
    columns: string[];
    sampleValues?: Record<string, unknown>;
  };
  durationMs: number;
  success: boolean;
}

interface ProductEntry {
  prodId: string;
  code: string;
  description: string;
  type: string;
}

interface LocationEntry {
  id: string;
  name: string;
  city: string;
  state: string;
  zip: string;
  isCustomer: boolean;
}

interface RegistryData {
  version: number;
  lastFullCrawl: string | null;
  tables: TableSchema[];
  queryLog: QueryLogEntry[];
  products: ProductEntry[];
  locations: LocationEntry[];
  learnings: string[];
}

// ─── Registry ──────────────────────────────────────────────────────────

const REGISTRY_PATH = process.env.NODE_ENV === 'production'
  ? join('/tmp', 'schema-registry.json')
  : join(process.cwd(), 'data', 'schema-registry.json');
const MAX_QUERY_LOG = 500;

function getDefaultRegistry(): RegistryData {
  return {
    version: 1,
    lastFullCrawl: null,
    tables: [],
    queryLog: [],
    products: [],
    locations: [],
    learnings: [],
  };
}

export function loadRegistry(): RegistryData {
  try {
    if (existsSync(REGISTRY_PATH)) {
      const raw = readFileSync(REGISTRY_PATH, 'utf-8');
      return JSON.parse(raw) as RegistryData;
    }
  } catch {
    // Corrupted file — start fresh
  }
  return getDefaultRegistry();
}

export function saveRegistry(data: RegistryData): void {
  try {
    // Ensure data directory exists
    const dir = process.env.NODE_ENV === 'production'
      ? '/tmp'
      : join(process.cwd(), 'data');
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    writeFileSync(REGISTRY_PATH, JSON.stringify(data, null, 2));
  } catch (err) {
    console.error('[schema-registry] Failed to save:', err);
  }
}

// ─── Schema Discovery ──────────────────────────────────────────────────

export function registerTable(source: string, table: string, columns: ColumnDef[]): void {
  const registry = loadRegistry();
  const existing = registry.tables.findIndex(t => t.source === source && t.table === table);
  const entry: TableSchema = {
    source,
    table,
    columns,
    lastCrawled: new Date().toISOString(),
  };

  if (existing >= 0) {
    registry.tables[existing] = entry;
  } else {
    registry.tables.push(entry);
  }
  saveRegistry(registry);
}

export function getTableSchema(source: string, table: string): TableSchema | undefined {
  const registry = loadRegistry();
  return registry.tables.find(t => t.source === source && t.table === table);
}

export function searchTables(keyword: string): TableSchema[] {
  const registry = loadRegistry();
  const lower = keyword.toLowerCase();
  return registry.tables.filter(t =>
    t.table.toLowerCase().includes(lower) ||
    t.columns.some(c => c.name.toLowerCase().includes(lower))
  );
}

// ─── Query Learning ────────────────────────────────────────────────────

export function logQuery(entry: Omit<QueryLogEntry, 'timestamp'>): void {
  const registry = loadRegistry();
  registry.queryLog.push({
    ...entry,
    timestamp: new Date().toISOString(),
  });

  // Cap log size
  if (registry.queryLog.length > MAX_QUERY_LOG) {
    registry.queryLog = registry.queryLog.slice(-MAX_QUERY_LOG);
  }
  saveRegistry(registry);
}

export function findSimilarQueries(pattern: string, limit: number = 5): QueryLogEntry[] {
  const registry = loadRegistry();
  const lower = pattern.toLowerCase();
  return registry.queryLog
    .filter(q => q.success && q.query.toLowerCase().includes(lower))
    .slice(-limit);
}

// ─── Product Index ─────────────────────────────────────────────────────

export function indexProducts(products: ProductEntry[]): void {
  const registry = loadRegistry();
  registry.products = products;
  saveRegistry(registry);
}

export function searchProducts(keyword: string): ProductEntry[] {
  const registry = loadRegistry();
  const lower = keyword.toLowerCase();
  return registry.products.filter(p =>
    p.description.toLowerCase().includes(lower) ||
    p.code.toLowerCase().includes(lower)
  );
}

// ─── Location Index ────────────────────────────────────────────────────

export function indexLocations(locations: LocationEntry[]): void {
  const registry = loadRegistry();
  registry.locations = locations;
  saveRegistry(registry);
}

export function searchLocations(city?: string, state?: string): LocationEntry[] {
  const registry = loadRegistry();
  return registry.locations.filter(l => {
    if (city && !l.city.toLowerCase().includes(city.toLowerCase())) return false;
    if (state && l.state.toLowerCase() !== state.toLowerCase()) return false;
    return true;
  });
}

// ─── Learnings ─────────────────────────────────────────────────────────

export function addLearning(insight: string): void {
  const registry = loadRegistry();
  // Dedup
  if (!registry.learnings.includes(insight)) {
    registry.learnings.push(insight);
    saveRegistry(registry);
  }
}

export function getLearnings(): string[] {
  const registry = loadRegistry();
  return registry.learnings;
}

// ─── Build Context for System Prompt ───────────────────────────────────
// Generates a compact reference from the registry for injection into prompts

export function buildRegistryContext(): string {
  const registry = loadRegistry();

  if (registry.tables.length === 0 && registry.products.length === 0) {
    return '(Schema registry not yet populated — run /api/registry/crawl to index data sources)';
  }

  const parts: string[] = [];

  // Table summary
  if (registry.tables.length > 0) {
    parts.push(`## Indexed Tables (${registry.tables.length})`);
    const bySource = registry.tables.reduce<Record<string, string[]>>((acc, t) => {
      const list = acc[t.source] ?? [];
      list.push(`${t.table} (${t.columns.length} cols)`);
      acc[t.source] = list;
      return acc;
    }, {});
    for (const [source, tables] of Object.entries(bySource)) {
      parts.push(`${source}: ${tables.join(', ')}`);
    }
  }

  // Product index
  if (registry.products.length > 0) {
    parts.push(`\n## Product Index (${registry.products.length} products)`);
    // Group by type
    const byType = registry.products.reduce<Record<string, number>>((acc, p) => {
      acc[p.type] = (acc[p.type] ?? 0) + 1;
      return acc;
    }, {});
    for (const [type, count] of Object.entries(byType)) {
      parts.push(`- ${type}: ${count} products`);
    }
  }

  // Location index
  if (registry.locations.length > 0) {
    const states = new Set(registry.locations.map(l => l.state));
    parts.push(`\n## Location Index (${registry.locations.length} locations across ${states.size} states)`);
  }

  // Recent learnings
  if (registry.learnings.length > 0) {
    parts.push('\n## Learnings');
    registry.learnings.slice(-10).forEach(l => parts.push(`- ${l}`));
  }

  return parts.join('\n');
}
