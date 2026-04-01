/**
 * Favorites / Pinned Queries
 *
 * Users can pin frequently used queries for quick access
 * from the chat empty state, assistant quick actions, and dashboard.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ──────────────────────────────────────────────────────

export interface Favorite {
  id: string;
  query: string;
  title: string;
  category: string;
  userEmail: string;
  createdAt: string;
}

// ── Persistence ────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const FAVORITES_PATH = join(DATA_DIR, 'favorites.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function loadFavorites(): Favorite[] {
  if (!existsSync(FAVORITES_PATH)) return [];
  try {
    const raw = readFileSync(FAVORITES_PATH, 'utf-8');
    return JSON.parse(raw) as Favorite[];
  } catch {
    return [];
  }
}

function saveFavorites(favs: Favorite[]): void {
  ensureDataDir();
  writeFileSync(FAVORITES_PATH, JSON.stringify(favs, null, 2), 'utf-8');
}

// ── CRUD ───────────────────────────────────────────────────────

export function getUserFavorites(userEmail: string): Favorite[] {
  return loadFavorites()
    .filter(f => f.userEmail === userEmail)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

export function addFavorite(
  data: Omit<Favorite, 'id' | 'createdAt'>
): Favorite {
  const favs = loadFavorites();
  const newFav: Favorite = {
    ...data,
    id: `fav_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
  };
  saveFavorites([...favs, newFav]);
  return newFav;
}

export function deleteFavorite(id: string, userEmail: string): boolean {
  const favs = loadFavorites();
  const filtered = favs.filter(f => !(f.id === id && f.userEmail === userEmail));
  if (filtered.length === favs.length) return false;
  saveFavorites(filtered);
  return true;
}

export function getAllFavorites(): Favorite[] {
  return loadFavorites();
}
