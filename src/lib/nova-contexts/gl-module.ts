/**
 * Nova Context: GL Module
 * Detailed context for the native General Ledger module.
 * Used when user is on GL-related pages (/journal-entries, /financial-statements,
 * /close-tracker, /reconciliations).
 */

import type { NovaContext } from './finance';

export const GL_MODULE_CONTEXT: NovaContext = {
  domain: 'gl',

  vocabulary: [
    'Chart of Accounts — complete list of GL accounts with types, balances, and department assignments',
    'Journal Entry (JE) — debit/credit transaction record posted to GL accounts; must balance (debits = credits)',
    'Trial Balance — summary of all account balances as of a date; totalDebits must equal totalCredits',
    'Posting — moving a JE from pending to posted status, making it affect account balances permanently',
    'Normal balance — asset/expense accounts carry debit balances; liability/equity/revenue carry credit balances',
    'Account type — asset | liability | equity | revenue | expense; determines balance sheet vs. income statement placement',
    'Period lock — after close, posted JEs cannot be reversed without an adjusting entry',
    'Adjusting entry — JE created to correct a prior posting without reversing it',
    'Reconciliation — matching GL account balance to an external source (bank, sub-ledger, vendor statement)',
    'Close checklist — sequence: reconcile → review pending JEs → post approved JEs → lock period',
    'Debit — left-side entry; increases asset/expense accounts, decreases liability/equity/revenue',
    'Credit — right-side entry; increases liability/equity/revenue accounts, decreases asset/expense',
    'Account balance — net of all posted debits and credits for an account across all periods',
    'Sub-ledger — detailed ledger for AP (by vendor) or AR (by customer) that rolls up to a GL control account',
  ],

  keyTables: [
    'GLAccount — chart of accounts: accountNo, accountName, accountType, balance, priorBalance, department',
    'JournalEntry — JE header: id, date, description, status (posted|pending|rejected), createdBy, createdAt',
    'JournalEntryLine — JE lines: accountNo, accountName, debit, credit, department, memo',
    'TrialBalance — computed view: accounts[], totalDebits, totalCredits, isBalanced, asOfDate',
    'AccountBalance — single-account view: balance, history (date + balance per period)',
  ],

  queryPatterns: [
    'What is the balance in account 1010?',
    'Show me the trial balance for March 2026',
    'List all pending journal entries',
    'Create a JE debiting 5010 and crediting 2010 for $5,000',
    'Post journal entry JE-12345',
    'Show the chart of accounts for expense accounts',
    'What JEs were posted in February 2026?',
    'Is the trial balance balanced as of 2026-03-31?',
    'Show the balance history for account 2000 over the last 6 months',
    'List all journal entries created by Taylor this month',
    'Which accounts have a prior-period variance greater than 10%?',
  ],

  availableActions: [
    'Get chart of accounts — full list with types and balances via GET /api/modules/gl',
    'Get trial balance — summary as of a date via GET /api/modules/gl?action=trial-balance&date=YYYY-MM-DD',
    'List journal entries — filtered by date range or status via GET /api/modules/gl?action=journal-entries',
    'Create journal entry — new pending JE via POST /api/modules/gl',
    'Post journal entry — move pending JE to posted status via POST /api/modules/gl/[id]/post',
    'Get account balance — single account with history via GET /api/modules/gl/[accountNo]',
  ],

  gatewayEndpoints: [
    'GET /ascend/gl/chart-of-accounts',
    'GET /ascend/gl/trial-balance?date=YYYY-MM-DD',
    'GET /ascend/gl/journal-entries',
    'GET /ascend/gl/journal-entries?from=&to=&status=',
    'POST /ascend/gl/journal-entries/[id]/post',
    'GET /ascend/gl/accounts/[accountNo]/balance',
  ],
};
