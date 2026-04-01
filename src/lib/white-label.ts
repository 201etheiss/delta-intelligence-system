/**
 * White-Label Configuration
 *
 * Loads branding/config from data/white-label.json.
 * Defaults to Delta360 if the file is missing or unreadable.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// ── Types ────────────────────────────────────────────────────

export interface WhiteLabelConfig {
  companyName: string;
  platformName: string;
  primaryColor: string;
  logoUrl: string;
  logoMarkUrl: string;
  domain: string;
  supportEmail: string;
}

// ── Defaults ─────────────────────────────────────────────────

const DEFAULT_CONFIG: WhiteLabelConfig = {
  companyName: 'Delta360',
  platformName: 'Delta Intelligence',
  primaryColor: '#FE5000',
  logoUrl: '/brand/@2x/delta-dark-360@2x.png',
  logoMarkUrl: '/brand/delta logo mark.png',
  domain: 'intelligence.delta360.energy',
  supportEmail: 'etheiss@delta360.energy',
};

// ── File I/O ─────────────────────────────────────────────────

function getFilePath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/white-label.json';
  }
  return path.join(process.cwd(), 'data', 'white-label.json');
}

export function getWhiteLabelConfig(): WhiteLabelConfig {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { ...DEFAULT_CONFIG };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<WhiteLabelConfig>;
    return { ...DEFAULT_CONFIG, ...parsed };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function updateWhiteLabelConfig(
  patch: Partial<WhiteLabelConfig>
): WhiteLabelConfig {
  const current = getWhiteLabelConfig();
  const updated: WhiteLabelConfig = { ...current, ...patch };
  const filePath = getFilePath();
  writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf-8');
  return updated;
}
