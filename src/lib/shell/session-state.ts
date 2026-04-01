import type { TabState } from './tab-manager';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GatewaySnapshot {
  timestamp: string;
  counts: {
    apInvoices: number;
    arInvoices: number;
    deliveries: number;
    automationRuns: number;
    alerts: number;
  };
}

export interface SessionState {
  lastModule: string;
  lastPage: string;
  lastPageContext: string;
  scrollPosition: number;
  activeFilters: Record<string, string>;
  timestamp: string;
  openTabs: TabState[];
  densityMode: 'executive' | 'operator';
  pinnedModules: string[];
  moduleOrder: string[];
}

export interface ModuleUsageEntry {
  openCount: number;
  lastOpened: string;
}

// ─── Storage Keys ─────────────────────────────────────────────────────────────

const KEYS = {
  SESSION_STATE: 'di_session_state',
  GATEWAY_SNAPSHOT: 'di_gateway_snapshot',
  MODULE_USAGE: 'di_module_usage',
} as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJson<T>(key: string): T | null {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(key);
    if (raw === null) return null;
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

function writeJson<T>(key: string, value: T): void {
  try {
    if (typeof window === 'undefined') return;
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Silently ignore quota errors or SSR
  }
}

// ─── SessionState ─────────────────────────────────────────────────────────────

export function getSessionState(): SessionState | null {
  return readJson<SessionState>(KEYS.SESSION_STATE);
}

export function saveSessionState(state: Partial<SessionState>): void {
  const existing = getSessionState();
  const defaults: SessionState = {
    lastModule: '',
    lastPage: '',
    lastPageContext: '',
    scrollPosition: 0,
    activeFilters: {},
    timestamp: '',
    openTabs: [],
    densityMode: 'operator',
    pinnedModules: [],
    moduleOrder: [],
  };
  const merged: SessionState = {
    ...defaults,
    ...(existing ?? {}),
    ...state,
    timestamp: new Date().toISOString(),
  };
  writeJson(KEYS.SESSION_STATE, merged);
}

// ─── GatewaySnapshot ──────────────────────────────────────────────────────────

export function getGatewaySnapshot(): GatewaySnapshot | null {
  return readJson<GatewaySnapshot>(KEYS.GATEWAY_SNAPSHOT);
}

export function saveGatewaySnapshot(snapshot: GatewaySnapshot): void {
  writeJson(KEYS.GATEWAY_SNAPSHOT, snapshot);
}

// ─── Module Usage ─────────────────────────────────────────────────────────────

export function getModuleUsage(): Record<string, ModuleUsageEntry> {
  return readJson<Record<string, ModuleUsageEntry>>(KEYS.MODULE_USAGE) ?? {};
}

export function recordModuleOpen(moduleId: string): void {
  const existing = getModuleUsage();
  const current = existing[moduleId];
  const updated: Record<string, ModuleUsageEntry> = {
    ...existing,
    [moduleId]: {
      openCount: (current?.openCount ?? 0) + 1,
      lastOpened: new Date().toISOString(),
    },
  };
  writeJson(KEYS.MODULE_USAGE, updated);
}
