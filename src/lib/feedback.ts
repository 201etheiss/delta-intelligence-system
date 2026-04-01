/**
 * Feedback System
 *
 * Collects user feedback (thumbs up/down + optional comments) on
 * assistant responses. Persists to data/feedback.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────

export type FeedbackRating = 'up' | 'down' | 1 | 2 | 3 | 4 | 5;

export interface FeedbackEntry {
  id: string;
  messageId: string;
  conversationId: string;
  rating: FeedbackRating;
  comment: string;
  model: string;
  query: string;
  userEmail: string;
  createdAt: string;
}

interface FeedbackFile {
  entries: FeedbackEntry[];
}

// ── File I/O ─────────────────────────────────────────────────

function getFilePath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/feedback.json';
  }
  return path.join(process.cwd(), 'data', 'feedback.json');
}

function readFile(): FeedbackFile {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { entries: [] };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as FeedbackFile;
  } catch {
    return { entries: [] };
  }
}

function writeFile(data: FeedbackFile): void {
  const filePath = getFilePath();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Operations ───────────────────────────────────────────────

export function addFeedback(
  entry: Omit<FeedbackEntry, 'id' | 'createdAt'>
): FeedbackEntry {
  const data = readFile();
  const feedback: FeedbackEntry = {
    ...entry,
    id: `fb-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };

  const updated: FeedbackFile = {
    entries: [...(data.entries ?? []), feedback],
  };

  // Cap at 10,000 entries
  if (updated.entries.length > 10_000) {
    updated.entries = updated.entries.slice(-10_000);
  }

  writeFile(updated);
  return feedback;
}

export function listFeedback(): FeedbackEntry[] {
  const data = readFile();
  return [...(data.entries ?? [])].reverse();
}

export interface FeedbackStats {
  total: number;
  thumbsUp: number;
  thumbsDown: number;
  byModel: Record<string, { up: number; down: number; total: number }>;
  recentEntries: FeedbackEntry[];
}

export function getFeedbackStats(): FeedbackStats {
  const entries = readFile().entries ?? [];
  let thumbsUp = 0;
  let thumbsDown = 0;
  const byModel: Record<string, { up: number; down: number; total: number }> = {};

  for (const entry of entries) {
    const isPositive = entry.rating === 'up' || (typeof entry.rating === 'number' && entry.rating >= 4);
    const isNegative = entry.rating === 'down' || (typeof entry.rating === 'number' && entry.rating <= 2);

    if (isPositive) thumbsUp++;
    if (isNegative) thumbsDown++;

    const model = entry.model || 'unknown';
    if (!byModel[model]) {
      byModel[model] = { up: 0, down: 0, total: 0 };
    }
    byModel[model].total++;
    if (isPositive) byModel[model].up++;
    if (isNegative) byModel[model].down++;
  }

  return {
    total: entries.length,
    thumbsUp,
    thumbsDown,
    byModel,
    recentEntries: entries.slice(-20).reverse(),
  };
}
