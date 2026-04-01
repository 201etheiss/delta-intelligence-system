/**
 * Contract Management Engine
 * Core logic for contract lifecycle, renewal alerts, and value tracking.
 * File persistence to data/contracts.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ContractType = 'customer' | 'vendor' | 'employment' | 'lease' | 'service';
export type ContractStatus = 'draft' | 'negotiation' | 'active' | 'expired' | 'terminated';
export type ContractAlertType = 'renewal_due' | 'expiring' | 'review_due';

export interface ContractAlert {
  readonly type: ContractAlertType;
  readonly date: string;
  readonly acknowledged: boolean;
}

export interface Contract {
  readonly id: string;
  readonly title: string;
  readonly counterparty: string;
  readonly type: ContractType;
  readonly status: ContractStatus;
  readonly startDate: string;
  readonly endDate: string;
  readonly value: number;
  readonly renewalDate: string | null;
  readonly autoRenew: boolean;
  readonly signedBy: string | null;
  readonly documentEvidence: string | null;
  readonly keyTerms: readonly string[];
  readonly alerts: readonly ContractAlert[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const CONTRACTS_FILE = join(DATA_DIR, 'contracts.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readContracts(): readonly Contract[] {
  ensureDataDir();
  if (!existsSync(CONTRACTS_FILE)) return [];
  try {
    const raw = readFileSync(CONTRACTS_FILE, 'utf-8');
    return JSON.parse(raw) as Contract[];
  } catch {
    return [];
  }
}

function writeContracts(contracts: readonly Contract[]): void {
  ensureDataDir();
  writeFileSync(CONTRACTS_FILE, JSON.stringify(contracts, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// Date helpers
// ---------------------------------------------------------------------------

function daysUntil(dateStr: string): number {
  const target = new Date(dateStr);
  const now = new Date();
  const diff = target.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// ---------------------------------------------------------------------------
// CRUD operations
// ---------------------------------------------------------------------------

export interface CreateContractInput {
  readonly title: string;
  readonly counterparty: string;
  readonly type: ContractType;
  readonly startDate: string;
  readonly endDate: string;
  readonly value: number;
  readonly renewalDate?: string | null;
  readonly autoRenew?: boolean;
  readonly signedBy?: string | null;
  readonly documentEvidence?: string | null;
  readonly keyTerms?: readonly string[];
}

export function createContract(input: CreateContractInput): Contract {
  if (!input.title || !input.counterparty) {
    throw new Error('Title and counterparty are required');
  }
  if (!input.startDate || !input.endDate) {
    throw new Error('Start date and end date are required');
  }

  const now = new Date().toISOString();
  const contract: Contract = {
    id: generateId('CTR'),
    title: input.title,
    counterparty: input.counterparty,
    type: input.type,
    status: 'draft',
    startDate: input.startDate,
    endDate: input.endDate,
    value: input.value,
    renewalDate: input.renewalDate ?? null,
    autoRenew: input.autoRenew ?? false,
    signedBy: input.signedBy ?? null,
    documentEvidence: input.documentEvidence ?? null,
    keyTerms: [...(input.keyTerms ?? [])],
    alerts: [],
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readContracts(), contract];
  writeContracts(all);
  return contract;
}

export function updateContract(
  id: string,
  patch: Partial<Omit<Contract, 'id' | 'createdAt'>>
): Contract {
  const all = [...readContracts()];
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Contract ${id} not found`);

  const existing = all[idx];
  const merged: Contract = {
    ...existing,
    ...patch,
    id: existing.id,
    createdAt: existing.createdAt,
    keyTerms: patch.keyTerms ? [...patch.keyTerms] : existing.keyTerms,
    alerts: patch.alerts ? [...patch.alerts] : existing.alerts,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeContracts(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getContracts(filters?: {
  type?: ContractType;
  status?: ContractStatus;
  expiring?: number; // days ahead
}): readonly Contract[] {
  let results = [...readContracts()];

  if (filters?.type) {
    results = results.filter((c) => c.type === filters.type);
  }
  if (filters?.status) {
    results = results.filter((c) => c.status === filters.status);
  }
  if (filters?.expiring !== undefined) {
    const threshold = filters.expiring;
    results = results.filter((c) => {
      const days = daysUntil(c.endDate);
      return days >= 0 && days <= threshold;
    });
  }

  return results;
}

export function getContractById(id: string): Contract | undefined {
  return readContracts().find((c) => c.id === id);
}

export function getExpiringContracts(daysAhead: number = 90): readonly Contract[] {
  return readContracts().filter((c) => {
    if (c.status !== 'active') return false;
    const days = daysUntil(c.endDate);
    return days >= 0 && days <= daysAhead;
  });
}

export function getRenewalQueue(): readonly Contract[] {
  return readContracts().filter((c) => {
    if (c.status !== 'active') return false;
    if (!c.renewalDate) return false;
    const days = daysUntil(c.renewalDate);
    return days >= 0 && days <= 90;
  });
}

export function getContractValue(type?: ContractType): number {
  const contracts = readContracts().filter(
    (c) => c.status === 'active' && (!type || c.type === type)
  );
  return Math.round(contracts.reduce((sum, c) => sum + c.value, 0) * 100) / 100;
}

// ---------------------------------------------------------------------------
// Alert generation
// ---------------------------------------------------------------------------

export function generateRenewalAlerts(): readonly Contract[] {
  const all = [...readContracts()];
  const updated: Contract[] = [];

  for (let i = 0; i < all.length; i++) {
    const contract = all[i];
    if (contract.status !== 'active') continue;

    const days = daysUntil(contract.endDate);
    const newAlerts: ContractAlert[] = [...contract.alerts];
    let changed = false;

    const thresholds: Array<{ days: number; type: ContractAlertType }> = [
      { days: 90, type: 'review_due' },
      { days: 60, type: 'renewal_due' },
      { days: 30, type: 'expiring' },
    ];

    for (const threshold of thresholds) {
      if (days <= threshold.days && days >= 0) {
        const exists = newAlerts.some(
          (a) => a.type === threshold.type
        );
        if (!exists) {
          newAlerts.push({
            type: threshold.type,
            date: new Date().toISOString(),
            acknowledged: false,
          });
          changed = true;
        }
      }
    }

    if (changed) {
      const merged: Contract = {
        ...contract,
        alerts: newAlerts,
        updatedAt: new Date().toISOString(),
      };
      all[i] = merged;
      updated.push(merged);
    }
  }

  if (updated.length > 0) {
    writeContracts(all);
  }

  return updated;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface ContractSummary {
  readonly activeCount: number;
  readonly expiringIn90: number;
  readonly totalActiveValue: number;
  readonly renewalsDue: number;
  readonly byType: Readonly<Record<string, number>>;
}

export function getContractSummary(): ContractSummary {
  const all = readContracts();
  const active = all.filter((c) => c.status === 'active');

  const byType: Record<string, number> = {};
  for (const c of active) {
    byType[c.type] = (byType[c.type] ?? 0) + 1;
  }

  return {
    activeCount: active.length,
    expiringIn90: getExpiringContracts(90).length,
    totalActiveValue: Math.round(active.reduce((sum, c) => sum + c.value, 0) * 100) / 100,
    renewalsDue: getRenewalQueue().length,
    byType,
  };
}
