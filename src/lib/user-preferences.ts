/**
 * User Preferences
 *
 * Per-user settings for default model, date range, timezone, digest, etc.
 * Persists to data/user-preferences.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────

export type ModelPreference = 'auto' | 'haiku' | 'sonnet' | 'opus';
export type DigestFrequency = 'daily' | 'weekly' | 'none';
export type ExportFormat = 'xlsx' | 'csv' | 'pdf';
export type DateRangeDefault = 'this_month' | 'this_quarter' | 'this_year' | 'last_30_days';

export interface UserPreferences {
  userId: string;
  defaultModel: ModelPreference;
  defaultProfitCenter: string;
  defaultDateRange: DateRangeDefault;
  timezone: string;
  emailDigest: DigestFrequency;
  preferredFormat: ExportFormat;
  darkMode: boolean;
}

interface PreferencesFile {
  preferences: UserPreferences[];
}

// ── Defaults ─────────────────────────────────────────────────

export function getDefaultPreferences(userId: string): UserPreferences {
  return {
    userId,
    defaultModel: 'auto',
    defaultProfitCenter: '',
    defaultDateRange: 'this_month',
    timezone: 'America/Chicago',
    emailDigest: 'none',
    preferredFormat: 'xlsx',
    darkMode: false,
  };
}

// ── File I/O ─────────────────────────────────────────────────

function getFilePath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/user-preferences.json';
  }
  return path.join(process.cwd(), 'data', 'user-preferences.json');
}

function readFile(): PreferencesFile {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { preferences: [] };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as PreferencesFile;
  } catch {
    return { preferences: [] };
  }
}

function writeFile(data: PreferencesFile): void {
  const filePath = getFilePath();
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── Operations ───────────────────────────────────────────────

export function getPreferences(userId: string): UserPreferences {
  const data = readFile();
  const existing = (data.preferences ?? []).find((p) => p.userId === userId);
  return existing ?? getDefaultPreferences(userId);
}

export function updatePreferences(
  userId: string,
  patch: Partial<Omit<UserPreferences, 'userId'>>
): UserPreferences {
  const data = readFile();
  const prefs = data.preferences ?? [];
  const idx = prefs.findIndex((p) => p.userId === userId);

  const current = idx >= 0 ? prefs[idx] : getDefaultPreferences(userId);
  const updated: UserPreferences = { ...current, ...patch, userId };

  const newPrefs =
    idx >= 0
      ? [...prefs.slice(0, idx), updated, ...prefs.slice(idx + 1)]
      : [...prefs, updated];

  writeFile({ preferences: newPrefs });
  return updated;
}
