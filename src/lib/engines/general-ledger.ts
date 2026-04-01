/**
 * General Ledger Engine
 *
 * Own chart of accounts, GL transaction posting from journal entries,
 * trial balance, balance sheet, and income statement generation.
 * File persistence to data/gl-accounts.json and data/gl-transactions.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { getJEById, type JournalEntry } from './journal-entry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type GLAccountType = 'asset' | 'liability' | 'equity' | 'revenue' | 'expense';
export type NormalBalance = 'debit' | 'credit';

export interface GLAccount {
  readonly id: string;
  readonly number: string;
  readonly name: string;
  readonly type: GLAccountType;
  readonly parentId: string | null;
  readonly profitCenter: string;
  readonly entityId: string;
  readonly active: boolean;
  readonly normalBalance: NormalBalance;
}

export interface GLTransaction {
  readonly id: string;
  readonly date: string;
  readonly jeId: string;
  readonly accountId: string;
  readonly debit: number;
  readonly credit: number;
  readonly profitCenter: string;
  readonly entityId: string;
  readonly description: string;
  readonly period: string;
  readonly postedAt: string;
}

export interface TrialBalanceLine {
  readonly accountNumber: string;
  readonly accountName: string;
  readonly type: GLAccountType;
  readonly debit: number;
  readonly credit: number;
  readonly balance: number;
}

export interface TrialBalance {
  readonly period: string;
  readonly accounts: readonly TrialBalanceLine[];
  readonly totalDebit: number;
  readonly totalCredit: number;
}

export interface BalanceSheetSection {
  readonly label: string;
  readonly accounts: readonly { accountNumber: string; accountName: string; balance: number }[];
  readonly total: number;
}

export interface BalanceSheet {
  readonly period: string;
  readonly assets: readonly BalanceSheetSection[];
  readonly totalAssets: number;
  readonly liabilities: readonly BalanceSheetSection[];
  readonly totalLiabilities: number;
  readonly equity: readonly BalanceSheetSection[];
  readonly totalEquity: number;
  readonly totalLiabilitiesAndEquity: number;
  readonly generatedAt: string;
}

export interface IncomeStatementSection {
  readonly label: string;
  readonly accounts: readonly { accountNumber: string; accountName: string; amount: number }[];
  readonly total: number;
}

export interface IncomeStatement {
  readonly period: string;
  readonly revenue: IncomeStatementSection;
  readonly cogs: IncomeStatementSection;
  readonly grossProfit: number;
  readonly operatingExpenses: IncomeStatementSection;
  readonly operatingIncome: number;
  readonly otherIncomeExpense: IncomeStatementSection;
  readonly netIncome: number;
  readonly generatedAt: string;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const ACCOUNTS_FILE = join(DATA_DIR, 'gl-accounts.json');
const TRANSACTIONS_FILE = join(DATA_DIR, 'gl-transactions.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readAccounts(): readonly GLAccount[] {
  ensureDataDir();
  if (!existsSync(ACCOUNTS_FILE)) return [];
  try {
    const raw = readFileSync(ACCOUNTS_FILE, 'utf-8');
    return JSON.parse(raw) as GLAccount[];
  } catch {
    return [];
  }
}

function writeAccounts(accounts: readonly GLAccount[]): void {
  ensureDataDir();
  writeFileSync(ACCOUNTS_FILE, JSON.stringify(accounts, null, 2), 'utf-8');
}

function readTransactions(): readonly GLTransaction[] {
  ensureDataDir();
  if (!existsSync(TRANSACTIONS_FILE)) return [];
  try {
    const raw = readFileSync(TRANSACTIONS_FILE, 'utf-8');
    return JSON.parse(raw) as GLTransaction[];
  } catch {
    return [];
  }
}

function writeTransactions(txns: readonly GLTransaction[]): void {
  ensureDataDir();
  writeFileSync(TRANSACTIONS_FILE, JSON.stringify(txns, null, 2), 'utf-8');
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
// Chart of Accounts CRUD
// ---------------------------------------------------------------------------

export function getChartOfAccounts(): readonly GLAccount[] {
  return readAccounts();
}

export function getAccount(idOrNumber: string): GLAccount | undefined {
  const accounts = readAccounts();
  return accounts.find((a) => a.id === idOrNumber || a.number === idOrNumber);
}

export function getAccountByNumber(number: string): GLAccount | undefined {
  return readAccounts().find((a) => a.number === number);
}

export interface CreateAccountInput {
  readonly number: string;
  readonly name: string;
  readonly type: GLAccountType;
  readonly parentId?: string | null;
  readonly profitCenter: string;
  readonly entityId: string;
  readonly normalBalance: NormalBalance;
}

export function createAccount(input: CreateAccountInput): GLAccount {
  const accounts = readAccounts();

  const existing = accounts.find((a) => a.number === input.number);
  if (existing) {
    throw new Error(`Account ${input.number} already exists: ${existing.name}`);
  }

  const account: GLAccount = {
    id: `GL-${input.number}`,
    number: input.number,
    name: input.name,
    type: input.type,
    parentId: input.parentId ?? null,
    profitCenter: input.profitCenter,
    entityId: input.entityId,
    active: true,
    normalBalance: input.normalBalance,
  };

  writeAccounts([...accounts, account]);
  return account;
}

export function updateAccount(
  idOrNumber: string,
  patch: Partial<Pick<GLAccount, 'name' | 'parentId' | 'profitCenter' | 'active'>>
): GLAccount {
  const accounts = [...readAccounts()];
  const idx = accounts.findIndex((a) => a.id === idOrNumber || a.number === idOrNumber);
  if (idx === -1) throw new Error(`Account ${idOrNumber} not found`);

  const existing = accounts[idx];
  const merged: GLAccount = {
    ...existing,
    name: patch.name ?? existing.name,
    parentId: patch.parentId !== undefined ? patch.parentId : existing.parentId,
    profitCenter: patch.profitCenter ?? existing.profitCenter,
    active: patch.active !== undefined ? patch.active : existing.active,
  };

  const updated = [...accounts.slice(0, idx), merged, ...accounts.slice(idx + 1)];
  writeAccounts(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// GL Posting — reads JE from journal-entry engine
// ---------------------------------------------------------------------------

export function postJEToGL(jeId: string): readonly GLTransaction[] {
  const je: JournalEntry | undefined = getJEById(jeId);
  if (!je) throw new Error(`Journal entry ${jeId} not found`);
  if (je.status !== 'posted') {
    throw new Error(`Journal entry ${jeId} is not posted (status: ${je.status})`);
  }

  const existingTxns = readTransactions();
  const alreadyPosted = existingTxns.some((t) => t.jeId === jeId);
  if (alreadyPosted) {
    throw new Error(`Journal entry ${jeId} has already been posted to GL`);
  }

  const period = je.date.slice(0, 7); // YYYY-MM
  const now = new Date().toISOString();
  const accounts = readAccounts();

  const newTxns: GLTransaction[] = je.entries.map((line) => {
    const acct = accounts.find((a) => a.number === line.account);
    if (!acct) {
      throw new Error(
        `Account ${line.account} (${line.accountName}) not found in chart of accounts`
      );
    }

    return {
      id: generateId('GLT'),
      date: je.date,
      jeId: je.id,
      accountId: acct.id,
      debit: Math.round(line.debit * 100) / 100,
      credit: Math.round(line.credit * 100) / 100,
      profitCenter: line.profitCenter || acct.profitCenter,
      entityId: line.entityId || acct.entityId,
      description: line.description || je.description,
      period,
      postedAt: now,
    };
  });

  writeTransactions([...existingTxns, ...newTxns]);
  return newTxns;
}

// ---------------------------------------------------------------------------
// Balance queries
// ---------------------------------------------------------------------------

export function getAccountBalance(
  accountIdOrNumber: string,
  period?: string
): { debit: number; credit: number; balance: number } {
  const acct = getAccount(accountIdOrNumber);
  if (!acct) throw new Error(`Account ${accountIdOrNumber} not found`);

  const txns = readTransactions().filter((t) => {
    if (t.accountId !== acct.id) return false;
    if (period) return t.period === period;
    return true;
  });

  const totalDebit = txns.reduce((sum, t) => sum + t.debit, 0);
  const totalCredit = txns.reduce((sum, t) => sum + t.credit, 0);

  // Balance depends on normal balance direction
  const balance =
    acct.normalBalance === 'debit'
      ? totalDebit - totalCredit
      : totalCredit - totalDebit;

  return {
    debit: Math.round(totalDebit * 100) / 100,
    credit: Math.round(totalCredit * 100) / 100,
    balance: Math.round(balance * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Trial Balance
// ---------------------------------------------------------------------------

export function getTrialBalance(period: string): TrialBalance {
  const accounts = readAccounts().filter((a) => a.active);
  const txns = readTransactions().filter((t) => t.period === period);

  const lines: TrialBalanceLine[] = [];

  for (const acct of accounts) {
    const acctTxns = txns.filter((t) => t.accountId === acct.id);
    if (acctTxns.length === 0) continue;

    const totalDebit = acctTxns.reduce((sum, t) => sum + t.debit, 0);
    const totalCredit = acctTxns.reduce((sum, t) => sum + t.credit, 0);
    const balance =
      acct.normalBalance === 'debit'
        ? totalDebit - totalCredit
        : totalCredit - totalDebit;

    lines.push({
      accountNumber: acct.number,
      accountName: acct.name,
      type: acct.type,
      debit: Math.round(totalDebit * 100) / 100,
      credit: Math.round(totalCredit * 100) / 100,
      balance: Math.round(balance * 100) / 100,
    });
  }

  // Sort by account number
  const sorted = [...lines].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));

  return {
    period,
    accounts: sorted,
    totalDebit: Math.round(sorted.reduce((s, l) => s + l.debit, 0) * 100) / 100,
    totalCredit: Math.round(sorted.reduce((s, l) => s + l.credit, 0) * 100) / 100,
  };
}

// ---------------------------------------------------------------------------
// Balance Sheet
// ---------------------------------------------------------------------------

function groupAccountsByRange(
  txns: readonly GLTransaction[],
  accounts: readonly GLAccount[],
  type: GLAccountType,
  ranges: readonly { label: string; from: string; to: string }[]
): readonly BalanceSheetSection[] {
  const sections: BalanceSheetSection[] = [];

  for (const range of ranges) {
    const rangeAccounts = accounts.filter(
      (a) =>
        a.type === type &&
        a.active &&
        a.number >= range.from &&
        a.number <= range.to
    );

    const acctLines: { accountNumber: string; accountName: string; balance: number }[] = [];
    for (const acct of rangeAccounts) {
      const acctTxns = txns.filter((t) => t.accountId === acct.id);
      if (acctTxns.length === 0) continue;
      const totalDebit = acctTxns.reduce((s, t) => s + t.debit, 0);
      const totalCredit = acctTxns.reduce((s, t) => s + t.credit, 0);
      const balance =
        acct.normalBalance === 'debit'
          ? totalDebit - totalCredit
          : totalCredit - totalDebit;
      acctLines.push({
        accountNumber: acct.number,
        accountName: acct.name,
        balance: Math.round(balance * 100) / 100,
      });
    }

    if (acctLines.length > 0) {
      const sorted = [...acctLines].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
      sections.push({
        label: range.label,
        accounts: sorted,
        total: Math.round(sorted.reduce((s, l) => s + l.balance, 0) * 100) / 100,
      });
    }
  }

  return sections;
}

export function getBalanceSheet(period: string): BalanceSheet {
  const accounts = readAccounts();
  // Balance sheet uses cumulative balances up to and including the period
  const txns = readTransactions().filter((t) => t.period <= period);

  const assetSections = groupAccountsByRange(txns, accounts, 'asset', [
    { label: 'Current Assets', from: '10000', to: '15999' },
    { label: 'Fixed Assets', from: '16000', to: '19999' },
  ]);

  const liabilitySections = groupAccountsByRange(txns, accounts, 'liability', [
    { label: 'Current Liabilities', from: '20000', to: '23999' },
    { label: 'Long-Term Liabilities', from: '24000', to: '29999' },
  ]);

  const equitySections = groupAccountsByRange(txns, accounts, 'equity', [
    { label: 'Stockholders Equity', from: '30000', to: '39999' },
  ]);

  // Net income for the period goes into equity
  const revenueTxns = txns.filter((t) => {
    const acct = accounts.find((a) => a.id === t.accountId);
    return acct?.type === 'revenue';
  });
  const expenseTxns = txns.filter((t) => {
    const acct = accounts.find((a) => a.id === t.accountId);
    return acct?.type === 'expense';
  });

  const totalRevenue =
    revenueTxns.reduce((s, t) => s + t.credit, 0) -
    revenueTxns.reduce((s, t) => s + t.debit, 0);
  const totalExpense =
    expenseTxns.reduce((s, t) => s + t.debit, 0) -
    expenseTxns.reduce((s, t) => s + t.credit, 0);
  const netIncome = Math.round((totalRevenue - totalExpense) * 100) / 100;

  // Add net income as a line in equity
  const equityWithNI: BalanceSheetSection[] = [
    ...(equitySections.length > 0
      ? equitySections.map((s) => ({
          ...s,
          accounts: [
            ...s.accounts,
            { accountNumber: '---', accountName: 'Net Income (Current Period)', balance: netIncome },
          ],
          total: Math.round((s.total + netIncome) * 100) / 100,
        }))
      : [
          {
            label: 'Stockholders Equity',
            accounts: [
              { accountNumber: '---', accountName: 'Net Income (Current Period)', balance: netIncome },
            ],
            total: netIncome,
          },
        ]),
  ];

  const totalAssets = Math.round(assetSections.reduce((s, sec) => s + sec.total, 0) * 100) / 100;
  const totalLiabilities = Math.round(
    liabilitySections.reduce((s, sec) => s + sec.total, 0) * 100
  ) / 100;
  const totalEquity = Math.round(equityWithNI.reduce((s, sec) => s + sec.total, 0) * 100) / 100;

  return {
    period,
    assets: assetSections,
    totalAssets,
    liabilities: liabilitySections,
    totalLiabilities,
    equity: equityWithNI,
    totalEquity,
    totalLiabilitiesAndEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
    generatedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Income Statement
// ---------------------------------------------------------------------------

function buildSection(
  txns: readonly GLTransaction[],
  accounts: readonly GLAccount[],
  type: GLAccountType,
  label: string,
  from: string,
  to: string
): IncomeStatementSection {
  const rangeAccounts = accounts.filter(
    (a) => a.type === type && a.active && a.number >= from && a.number <= to
  );

  const lines: { accountNumber: string; accountName: string; amount: number }[] = [];

  for (const acct of rangeAccounts) {
    const acctTxns = txns.filter((t) => t.accountId === acct.id);
    if (acctTxns.length === 0) continue;

    const totalDebit = acctTxns.reduce((s, t) => s + t.debit, 0);
    const totalCredit = acctTxns.reduce((s, t) => s + t.credit, 0);

    // Revenue: credit - debit (positive = income)
    // Expense: debit - credit (positive = expense)
    const amount =
      acct.normalBalance === 'credit'
        ? totalCredit - totalDebit
        : totalDebit - totalCredit;

    lines.push({
      accountNumber: acct.number,
      accountName: acct.name,
      amount: Math.round(amount * 100) / 100,
    });
  }

  const sorted = [...lines].sort((a, b) => a.accountNumber.localeCompare(b.accountNumber));
  return {
    label,
    accounts: sorted,
    total: Math.round(sorted.reduce((s, l) => s + l.amount, 0) * 100) / 100,
  };
}

export function getIncomeStatement(period: string): IncomeStatement {
  const accounts = readAccounts();
  const txns = readTransactions().filter((t) => t.period === period);

  const revenue = buildSection(txns, accounts, 'revenue', 'Revenue', '40000', '49999');
  const cogs = buildSection(txns, accounts, 'expense', 'Cost of Goods Sold', '50000', '59999');
  const grossProfit = Math.round((revenue.total - cogs.total) * 100) / 100;

  const operatingExpenses = buildSection(
    txns,
    accounts,
    'expense',
    'Operating Expenses',
    '60000',
    '69999'
  );
  const operatingIncome = Math.round((grossProfit - operatingExpenses.total) * 100) / 100;

  // Other income/expense: 80000-89999
  const otherExpense = buildSection(
    txns,
    accounts,
    'expense',
    'Other Income / Expense',
    '80000',
    '89999'
  );
  // Interest income is revenue in 81xxx range
  const otherRevenue = buildSection(
    txns,
    accounts,
    'revenue',
    'Other Revenue',
    '81000',
    '81999'
  );

  const otherNet = Math.round((otherRevenue.total - otherExpense.total) * 100) / 100;
  const otherIncomeExpense: IncomeStatementSection = {
    label: 'Other Income / Expense',
    accounts: [
      ...otherRevenue.accounts.map((a) => ({ ...a, amount: a.amount })),
      ...otherExpense.accounts.map((a) => ({ ...a, amount: -a.amount })),
    ],
    total: otherNet,
  };

  const netIncome = Math.round((operatingIncome + otherNet) * 100) / 100;

  return {
    period,
    revenue,
    cogs,
    grossProfit,
    operatingExpenses,
    operatingIncome,
    otherIncomeExpense,
    netIncome,
    generatedAt: new Date().toISOString(),
  };
}
