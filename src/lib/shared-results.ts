/**
 * Shared Results — Collaboration Engine
 *
 * Allows users to share AI-generated results with teammates,
 * control visibility by role, and add comments.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

export interface SharedResult {
  id: string;
  title: string;
  content: string;          // markdown
  sharedBy: string;         // email
  sharedAt: string;
  visibility: 'link' | 'team' | 'role';
  allowedRoles?: string[];
  comments: Comment[];
  views: number;
}

// ── Persistence ────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const SHARED_PATH = join(DATA_DIR, 'shared-results.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadSharedResults(): SharedResult[] {
  if (!existsSync(SHARED_PATH)) return [];
  try {
    const raw = readFileSync(SHARED_PATH, 'utf-8');
    return JSON.parse(raw) as SharedResult[];
  } catch {
    return [];
  }
}

export function saveSharedResults(results: SharedResult[]): void {
  ensureDataDir();
  writeFileSync(SHARED_PATH, JSON.stringify(results, null, 2), 'utf-8');
}

// ── CRUD ───────────────────────────────────────────────────────

export function getSharedResult(id: string): SharedResult | undefined {
  return loadSharedResults().find(r => r.id === id);
}

export function listSharedResults(
  userRole?: string,
  search?: string
): SharedResult[] {
  let results = loadSharedResults();

  // Filter by visibility
  if (userRole) {
    results = results.filter(r => {
      if (r.visibility === 'team') return true;
      if (r.visibility === 'link') return true;
      if (r.visibility === 'role' && r.allowedRoles) {
        return r.allowedRoles.includes(userRole);
      }
      return true;
    });
  }

  if (search) {
    const q = search.toLowerCase();
    results = results.filter(
      r =>
        r.title.toLowerCase().includes(q) ||
        r.content.toLowerCase().includes(q)
    );
  }

  return results.sort(
    (a, b) => new Date(b.sharedAt).getTime() - new Date(a.sharedAt).getTime()
  );
}

export function createSharedResult(
  data: Omit<SharedResult, 'id' | 'sharedAt' | 'comments' | 'views'>
): SharedResult {
  const results = loadSharedResults();
  const newResult: SharedResult = {
    ...data,
    id: `sr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    sharedAt: new Date().toISOString(),
    comments: [],
    views: 0,
  };
  saveSharedResults([...results, newResult]);
  return newResult;
}

export function incrementViews(id: string): SharedResult | undefined {
  const results = loadSharedResults();
  const idx = results.findIndex(r => r.id === id);
  if (idx === -1) return undefined;

  const updated: SharedResult = {
    ...results[idx],
    views: results[idx].views + 1,
  };
  const next = [...results];
  next[idx] = updated;
  saveSharedResults(next);
  return updated;
}

export function addComment(
  resultId: string,
  author: string,
  text: string
): Comment | undefined {
  const results = loadSharedResults();
  const idx = results.findIndex(r => r.id === resultId);
  if (idx === -1) return undefined;

  const comment: Comment = {
    id: `cmt_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    author,
    text,
    createdAt: new Date().toISOString(),
  };

  const updated: SharedResult = {
    ...results[idx],
    comments: [...results[idx].comments, comment],
  };
  const next = [...results];
  next[idx] = updated;
  saveSharedResults(next);
  return comment;
}

export function updateVisibility(
  id: string,
  visibility: SharedResult['visibility'],
  allowedRoles?: string[]
): SharedResult | undefined {
  const results = loadSharedResults();
  const idx = results.findIndex(r => r.id === id);
  if (idx === -1) return undefined;

  const updated: SharedResult = {
    ...results[idx],
    visibility,
    allowedRoles: allowedRoles ?? results[idx].allowedRoles,
  };
  const next = [...results];
  next[idx] = updated;
  saveSharedResults(next);
  return updated;
}

export function deleteSharedResult(id: string): boolean {
  const results = loadSharedResults();
  const filtered = results.filter(r => r.id !== id);
  if (filtered.length === results.length) return false;
  saveSharedResults(filtered);
  return true;
}
