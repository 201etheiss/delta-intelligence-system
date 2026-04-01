/**
 * Domain Glossary — Delta360-specific terminology
 *
 * Provides CRUD for glossary entries and a compact representation
 * for injection into the AI system prompt.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface GlossaryEntry {
  id: string;
  term: string;
  definition: string;
  category: string;   // operations, finance, sales, fleet, general
  aliases: string[];
  examples?: string[];
  updatedBy: string;
  updatedAt: string;
}

export type GlossaryCategory = 'operations' | 'finance' | 'sales' | 'fleet' | 'general';

// ── Persistence ────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const GLOSSARY_PATH = join(DATA_DIR, 'glossary.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadGlossary(): GlossaryEntry[] {
  if (!existsSync(GLOSSARY_PATH)) return [];
  try {
    const raw = readFileSync(GLOSSARY_PATH, 'utf-8');
    return JSON.parse(raw) as GlossaryEntry[];
  } catch {
    return [];
  }
}

export function saveGlossary(entries: GlossaryEntry[]): void {
  ensureDataDir();
  writeFileSync(GLOSSARY_PATH, JSON.stringify(entries, null, 2), 'utf-8');
}

// ── CRUD ───────────────────────────────────────────────────────

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return loadGlossary().find(e => e.id === id);
}

export function searchGlossary(
  query?: string,
  category?: string
): GlossaryEntry[] {
  let entries = loadGlossary();

  if (category) {
    entries = entries.filter(e => e.category === category);
  }

  if (query) {
    const q = query.toLowerCase();
    entries = entries.filter(
      e =>
        e.term.toLowerCase().includes(q) ||
        e.definition.toLowerCase().includes(q) ||
        e.aliases.some(a => a.toLowerCase().includes(q))
    );
  }

  return entries.sort((a, b) => a.term.localeCompare(b.term));
}

export function addGlossaryEntry(
  entry: Omit<GlossaryEntry, 'id' | 'updatedAt'>
): GlossaryEntry {
  const entries = loadGlossary();
  const newEntry: GlossaryEntry = {
    ...entry,
    id: `gl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    updatedAt: new Date().toISOString(),
  };
  saveGlossary([...entries, newEntry]);
  return newEntry;
}

export function updateGlossaryEntry(
  id: string,
  updates: Partial<Omit<GlossaryEntry, 'id'>>
): GlossaryEntry | undefined {
  const entries = loadGlossary();
  const idx = entries.findIndex(e => e.id === id);
  if (idx === -1) return undefined;

  const updated: GlossaryEntry = {
    ...entries[idx],
    ...updates,
    id: entries[idx].id,
    updatedAt: new Date().toISOString(),
  };
  const next = [...entries];
  next[idx] = updated;
  saveGlossary(next);
  return updated;
}

export function deleteGlossaryEntry(id: string): boolean {
  const entries = loadGlossary();
  const filtered = entries.filter(e => e.id !== id);
  if (filtered.length === entries.length) return false;
  saveGlossary(filtered);
  return true;
}

// ── System Prompt Injection ────────────────────────────────────

/**
 * Build a compact glossary string for inclusion in the AI system prompt.
 * Format: "TERM (alias1, alias2): definition"
 * Kept concise to minimize token usage.
 */
export function buildGlossaryPromptSection(): string {
  const entries = loadGlossary();
  if (entries.length === 0) return '';

  const lines = entries.map(e => {
    const aliasStr = e.aliases.length > 0 ? ` (${e.aliases.join(', ')})` : '';
    return `- ${e.term}${aliasStr}: ${e.definition}`;
  });

  return [
    '# Delta360 Domain Glossary',
    'Use these definitions when interpreting user queries:',
    ...lines,
  ].join('\n');
}
