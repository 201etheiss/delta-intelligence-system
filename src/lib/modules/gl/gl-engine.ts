/**
 * GL Module Engine
 *
 * Clean interface for GL operations, abstracting over Ascend (current data source)
 * and the Event Store (future native GL). All functions emit domain events
 * fire-and-forget — they never block the caller.
 */

import { gatewayFetch } from '@/lib/gateway';
import { emitEvent } from '@/lib/events/event-store';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GLAccount {
  readonly accountNo: string;
  readonly accountName: string;
  readonly accountType: 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
  readonly balance: number;
  readonly priorBalance: number;
  readonly department?: string;
}

export interface JournalEntryLine {
  readonly accountNo: string;
  readonly accountName: string;
  readonly debit: number;
  readonly credit: number;
  readonly department?: string;
  readonly memo?: string;
}

export interface JournalEntry {
  readonly id: string;
  readonly date: string;
  readonly description: string;
  readonly status: 'posted' | 'pending' | 'rejected';
  readonly lines: readonly JournalEntryLine[];
  readonly createdBy: string;
  readonly createdAt: string;
}

export interface TrialBalance {
  readonly accounts: readonly GLAccount[];
  readonly totalDebits: number;
  readonly totalCredits: number;
  readonly isBalanced: boolean;
  readonly asOfDate: string;
}

export interface AccountBalance {
  readonly balance: number;
  readonly history: readonly { date: string; balance: number }[];
}

export interface JournalEntryFilters {
  readonly from?: string;
  readonly to?: string;
  readonly status?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function emitGLEvent(type: string, payload: Record<string, unknown>): void {
  emitEvent({
    type,
    tenant_id: 'delta360',
    version: 1,
    actor_id: 'system',
    payload,
    metadata: {},
  }).catch(() => {});
}

function normaliseAccountType(raw: string): GLAccount['accountType'] {
  const lower = (raw ?? '').toLowerCase();
  if (lower.includes('asset')) return 'asset';
  if (lower.includes('liab')) return 'liability';
  if (lower.includes('equity')) return 'equity';
  if (lower.includes('revenue') || lower.includes('income')) return 'revenue';
  return 'expense';
}

function normaliseJEStatus(raw: string): JournalEntry['status'] {
  if (raw === 'posted') return 'posted';
  if (raw === 'rejected') return 'rejected';
  return 'pending';
}

// ---------------------------------------------------------------------------
// Chart of Accounts
// ---------------------------------------------------------------------------

export async function getChartOfAccounts(): Promise<readonly GLAccount[]> {
  try {
    const res = await gatewayFetch('/ascend/gl/chart-of-accounts', 'accounting');
    if (!res.success) {
      emitGLEvent('gl.chart_of_accounts.error', { error: res.error });
      return [];
    }

    const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
    const accounts: GLAccount[] = rows.map((r) => ({
      accountNo: String(r.Account_No ?? r.accountNo ?? r.account_no ?? ''),
      accountName: String(r.Account_Desc ?? r.accountName ?? r.account_name ?? ''),
      accountType: normaliseAccountType(String(r.Account_Type ?? r.accountType ?? '')),
      balance: Number(r.balance ?? r.Balance ?? 0),
      priorBalance: Number(r.prior_balance ?? r.priorBalance ?? 0),
      department: r.department ? String(r.department) : undefined,
    }));

    emitGLEvent('gl.chart_of_accounts.fetched', { count: accounts.length });
    return accounts;
  } catch (err) {
    emitGLEvent('gl.chart_of_accounts.error', {
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Trial Balance
// ---------------------------------------------------------------------------

export async function getTrialBalance(asOfDate: string): Promise<TrialBalance> {
  const fallback: TrialBalance = {
    accounts: [],
    totalDebits: 0,
    totalCredits: 0,
    isBalanced: true,
    asOfDate,
  };

  try {
    const res = await gatewayFetch(`/ascend/gl/trial-balance?date=${encodeURIComponent(asOfDate)}`, 'accounting');
    if (!res.success) {
      emitGLEvent('gl.trial_balance.error', { asOfDate, error: res.error });
      return fallback;
    }

    const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
    const accounts: GLAccount[] = rows.map((r) => ({
      accountNo: String(r.Account_No ?? r.accountNo ?? ''),
      accountName: String(r.Account_Desc ?? r.accountName ?? ''),
      accountType: normaliseAccountType(String(r.Account_Type ?? r.accountType ?? '')),
      balance: Number(r.balance ?? r.Balance ?? 0),
      priorBalance: Number(r.prior_balance ?? r.priorBalance ?? 0),
      department: r.department ? String(r.department) : undefined,
    }));

    const totalDebits = accounts.reduce((sum, a) => sum + (a.balance > 0 ? a.balance : 0), 0);
    const totalCredits = accounts.reduce((sum, a) => sum + (a.balance < 0 ? Math.abs(a.balance) : 0), 0);
    const isBalanced = Math.abs(totalDebits - totalCredits) < 0.01;

    const tb: TrialBalance = { accounts, totalDebits, totalCredits, isBalanced, asOfDate };
    emitGLEvent('gl.trial_balance.fetched', { asOfDate, accountCount: accounts.length, isBalanced });
    return tb;
  } catch (err) {
    emitGLEvent('gl.trial_balance.error', {
      asOfDate,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return fallback;
  }
}

// ---------------------------------------------------------------------------
// Journal Entries
// ---------------------------------------------------------------------------

export async function getJournalEntries(
  filters?: JournalEntryFilters
): Promise<readonly JournalEntry[]> {
  try {
    const params = new URLSearchParams();
    if (filters?.from) params.set('from', filters.from);
    if (filters?.to) params.set('to', filters.to);
    if (filters?.status) params.set('status', filters.status);

    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await gatewayFetch(`/ascend/gl/journal-entries${qs}`, 'accounting');

    if (!res.success) {
      emitGLEvent('gl.journal_entries.error', { filters, error: res.error });
      return [];
    }

    const rows = Array.isArray(res.data) ? (res.data as Record<string, unknown>[]) : [];
    const entries: JournalEntry[] = rows.map((r) => {
      const rawLines = Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [];
      const lines: JournalEntryLine[] = rawLines.map((l) => ({
        accountNo: String(l.accountNo ?? l.Account_No ?? ''),
        accountName: String(l.accountName ?? l.Account_Desc ?? ''),
        debit: Number(l.debit ?? l.Debit ?? 0),
        credit: Number(l.credit ?? l.Credit ?? 0),
        department: l.department ? String(l.department) : undefined,
        memo: l.memo ? String(l.memo) : undefined,
      }));

      return {
        id: String(r.id ?? r.JEId ?? ''),
        date: String(r.date ?? r.Date ?? ''),
        description: String(r.description ?? r.Description ?? ''),
        status: normaliseJEStatus(String(r.status ?? '')),
        lines,
        createdBy: String(r.createdBy ?? r.Created_By ?? 'system'),
        createdAt: String(r.createdAt ?? r.Created_At ?? new Date().toISOString()),
      };
    });

    emitGLEvent('gl.journal_entries.fetched', { count: entries.length, filters });
    return entries;
  } catch (err) {
    emitGLEvent('gl.journal_entries.error', {
      filters,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Create Journal Entry (CQRS command — writes to native JE engine)
// ---------------------------------------------------------------------------

export async function createJournalEntry(
  entry: Omit<JournalEntry, 'id' | 'createdAt'>
): Promise<JournalEntry> {
  const createdAt = new Date().toISOString();
  const id = `je-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  const created: JournalEntry = { ...entry, id, createdAt };

  emitGLEvent('gl.journal_entry.created', {
    id,
    date: entry.date,
    description: entry.description,
    status: entry.status,
    lineCount: entry.lines.length,
    createdBy: entry.createdBy,
  });

  return created;
}

// ---------------------------------------------------------------------------
// Post Journal Entry
// ---------------------------------------------------------------------------

export async function postJournalEntry(id: string): Promise<JournalEntry | null> {
  try {
    const res = await gatewayFetch(`/ascend/gl/journal-entries/${encodeURIComponent(id)}/post`, 'accounting', {
      method: 'POST',
    });

    if (!res.success) {
      emitGLEvent('gl.journal_entry.post_failed', { id, error: res.error });
      return null;
    }

    const r = (Array.isArray(res.data) ? res.data[0] : res.data) as Record<string, unknown>;
    if (!r) return null;

    const rawLines = Array.isArray(r.lines) ? (r.lines as Record<string, unknown>[]) : [];
    const posted: JournalEntry = {
      id,
      date: String(r.date ?? ''),
      description: String(r.description ?? ''),
      status: 'posted',
      lines: rawLines.map((l) => ({
        accountNo: String(l.accountNo ?? ''),
        accountName: String(l.accountName ?? ''),
        debit: Number(l.debit ?? 0),
        credit: Number(l.credit ?? 0),
        department: l.department ? String(l.department) : undefined,
        memo: l.memo ? String(l.memo) : undefined,
      })),
      createdBy: String(r.createdBy ?? 'system'),
      createdAt: String(r.createdAt ?? new Date().toISOString()),
    };

    emitGLEvent('gl.journal_entry.posted', { id });
    return posted;
  } catch (err) {
    emitGLEvent('gl.journal_entry.post_failed', {
      id,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return null;
  }
}

// ---------------------------------------------------------------------------
// Account Balance + History
// ---------------------------------------------------------------------------

export async function getAccountBalance(accountNo: string): Promise<AccountBalance> {
  const fallback: AccountBalance = { balance: 0, history: [] };

  try {
    const res = await gatewayFetch(
      `/ascend/gl/accounts/${encodeURIComponent(accountNo)}/balance`,
      'accounting'
    );

    if (!res.success) {
      emitGLEvent('gl.account_balance.error', { accountNo, error: res.error });
      return fallback;
    }

    const d = res.data as Record<string, unknown>;
    const balance = Number(d?.balance ?? 0);
    const rawHistory = Array.isArray(d?.history) ? (d.history as Record<string, unknown>[]) : [];
    const history = rawHistory.map((h) => ({
      date: String(h.date ?? ''),
      balance: Number(h.balance ?? 0),
    }));

    emitGLEvent('gl.account_balance.fetched', { accountNo, balance });
    return { balance, history };
  } catch (err) {
    emitGLEvent('gl.account_balance.error', {
      accountNo,
      error: err instanceof Error ? err.message : 'Unknown error',
    });
    return fallback;
  }
}
