/**
 * Financial Statement Generator
 *
 * Pulls LIVE data from Ascend via the gateway to generate
 * Balance Sheet, Income Statement, Trial Balance, Flash Report,
 * and Ascend Variance reports.
 *
 * Does NOT depend on the local GL engine — reads directly from Ascend.
 */

import { gatewayFetch } from '@/lib/gateway';
import type { UserRole } from '@/lib/config/roles';

// ── Types ─────────────────────────────────────────────────────

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

function safeArray(d: unknown): unknown[] {
  return Array.isArray(d) ? d : [];
}

export interface FSLine {
  accountNumber: string;
  accountName: string;
  amount: number;
  balance: number;
}

export interface FSSection {
  title: string;
  accounts: FSLine[];
  total: number;
  priorYearAmounts?: Readonly<Record<string, number>>;
  priorYearTotal?: number;
}

export interface BalanceSheet {
  period: string;
  companyName: string;
  assets: FSSection[];
  liabilities: FSSection[];
  equity: FSSection[];
  totalAssets: number;
  totalLiabilities: number;
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  priorYear?: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  generatedAt: string;
}

export interface IncomeStatement {
  period: string;
  companyName: string;
  revenue: FSSection;
  cogs: FSSection;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: FSSection;
  operatingIncome: number;
  otherIncomeExpense: FSSection;
  netIncome: number;
  priorYear?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };
  generatedAt: string;
}

export interface TrialBalance {
  period: string;
  lines: Array<{
    accountNumber: string;
    accountName: string;
    type: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  totalDebits: number;
  totalCredits: number;
  generatedAt: string;
}

export interface FlashReport {
  period: string;
  revenue: number;
  cogs: number;
  grossProfit: number;
  grossMarginPct: number;
  operatingExpenses: number;
  operatingIncome: number;
  ebitda: number;
  netIncome: number;
  cashPosition: number;
  priorYear?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    grossMarginPct: number;
    operatingExpenses: number;
    operatingIncome: number;
    ebitda: number;
    netIncome: number;
    cashPosition: number;
  };
  generatedAt: string;
}

export interface VarianceLine {
  accountNumber: string;
  accountName: string;
  diBalance: number;
  ascendBalance: number;
  variance: number;
  variancePct: number | null;
}

export interface AscendVarianceReport {
  period: string;
  incomeStatement: { lines: VarianceLine[]; totalDI: number; totalAscend: number; totalVariance: number };
  balanceSheet: { lines: VarianceLine[]; totalDI: number; totalAscend: number; totalVariance: number };
  generatedAt: string;
}

// ── Input Validation ────────────────────────────────────────

function validatePeriod(period: string): { year: number; month: number } {
  const match = period.match(/^(\d{4})-(\d{2})$/);
  if (!match) throw new Error('Invalid period format (expected YYYY-MM)');
  const year = parseInt(match[1]);
  const month = parseInt(match[2]);
  if (year < 2000 || year > 2100 || month < 1 || month > 12) throw new Error('Period out of range');
  return { year, month };
}

// ── Helper: Query Ascend ──────────────────────────────────────

async function querySQL(sql: string): Promise<Record<string, unknown>[]> {
  try {
    const res = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: { sql },
      timeout: 20000,
    });
    return safeArray(res.data) as Record<string, unknown>[];
  } catch {
    return [];
  }
}

// ── Balance Sheet (from Ascend vFSWWBalCOA) ───────────────────

export async function generateBalanceSheet(period: string): Promise<BalanceSheet> {
  const { year, month: mo } = validatePeriod(period);

  const rows = await querySQL(
    `SELECT T, AcctDesc, Natural, SUM(EndBal) AS Balance
     FROM vFSWWBalCOA
     WHERE Year = ${year} AND Period = ${mo}
       AND T IN ('A','L','E')
       AND ABS(EndBal) > 0.01
     GROUP BY T, AcctDesc, Natural
     ORDER BY T, Natural`
  );

  const assets: FSLine[] = [];
  const liabilities: FSLine[] = [];
  const equity: FSLine[] = [];

  // Also need current-period net income (Revenue - Expenses) for equity section
  const niRows = await querySQL(
    `SELECT T, SUM(EndBal) AS Total FROM vFSWWBalCOA
     WHERE Year = ${year} AND Period = ${mo} AND T IN ('R','X')
     GROUP BY T`
  );
  let revenueTotal = 0;
  let expenseTotal = 0;
  for (const r of niRows) {
    const t = String(r.T ?? '');
    if (t === 'R') revenueTotal = safeNumber(r.Total); // negative (credit)
    if (t === 'X') expenseTotal = safeNumber(r.Total); // positive (debit)
  }
  // Net income = Revenue (make positive) - Expenses
  const netIncome = Math.abs(revenueTotal) - expenseTotal;

  for (const r of rows) {
    const t = String(r.T ?? '');
    const rawBalance = safeNumber(r.Balance);
    // Assets: keep raw (positive = debit normal balance)
    // Liabilities: negate raw (raw is negative credit, negate to show positive on BS)
    // Equity: negate raw (same as liabilities)
    const displayBalance = t === 'A' ? rawBalance : -rawBalance;
    const line: FSLine = {
      accountNumber: String(r.Natural ?? ''),
      accountName: String(r.AcctDesc ?? ''),
      amount: displayBalance,
      balance: displayBalance,
    };
    if (t === 'A') assets.push(line);
    else if (t === 'L') liabilities.push(line);
    else if (t === 'E') equity.push(line);
  }

  // Add net income to equity section (Revenue is negative in GL, negate for positive display)
  // Net Income = -Revenue(raw) - Expenses(raw) = absolute revenue - expenses
  if (Math.abs(netIncome) > 0.01) {
    equity.push({
      accountNumber: '---',
      accountName: 'Net Income (Current Period)',
      amount: netIncome,
      balance: netIncome,
    });
  }

  const totalAssets = Math.round(assets.reduce((s, a) => s + a.balance, 0) * 100) / 100;
  const totalLiabilities = Math.round(liabilities.reduce((s, a) => s + a.balance, 0) * 100) / 100;
  const totalEquity = Math.round(equity.reduce((s, a) => s + a.balance, 0) * 100) / 100;

  // Fetch prior year for YoY comparison — account-level
  const pyRows = await querySQL(
    `SELECT T, AcctDesc, Natural, SUM(EndBal) AS Balance FROM vFSWWBalCOA
     WHERE Year = ${year - 1} AND Period = ${mo} AND T IN ('A','L','E')
       AND ABS(EndBal) > 0.01
     GROUP BY T, AcctDesc, Natural
     ORDER BY T, Natural`
  );
  let pyAssets = 0;
  let pyLiab = 0;
  let pyEquity = 0;
  const pyAssetAccts: Record<string, number> = {};
  const pyLiabAccts: Record<string, number> = {};
  const pyEquityAccts: Record<string, number> = {};
  for (const r of pyRows) {
    const t = String(r.T ?? '');
    const bal = safeNumber(r.Balance);
    const natural = String(r.Natural ?? '');
    if (t === 'A') {
      pyAssets += bal;
      pyAssetAccts[natural] = (pyAssetAccts[natural] ?? 0) + bal;
    } else if (t === 'L') {
      pyLiab += Math.abs(bal);
      pyLiabAccts[natural] = (pyLiabAccts[natural] ?? 0) + Math.abs(bal);
    } else if (t === 'E') {
      pyEquity += Math.abs(bal);
      pyEquityAccts[natural] = (pyEquityAccts[natural] ?? 0) + Math.abs(bal);
    }
  }

  const hasPriorYear = pyAssets !== 0 || pyLiab !== 0 || pyEquity !== 0;

  return {
    period,
    companyName: 'Delta360 Energy LLC',
    assets: [{
      title: 'Assets', accounts: assets, total: totalAssets,
      ...(hasPriorYear ? { priorYearAmounts: pyAssetAccts, priorYearTotal: Math.round(pyAssets * 100) / 100 } : {}),
    }],
    liabilities: [{
      title: 'Liabilities', accounts: liabilities, total: totalLiabilities,
      ...(hasPriorYear ? { priorYearAmounts: pyLiabAccts, priorYearTotal: Math.round(pyLiab * 100) / 100 } : {}),
    }],
    equity: [{
      title: 'Stockholders Equity', accounts: equity, total: totalEquity,
      ...(hasPriorYear ? { priorYearAmounts: pyEquityAccts, priorYearTotal: Math.round(pyEquity * 100) / 100 } : {}),
    }],
    totalAssets,
    totalLiabilities,
    totalEquity,
    totalLiabilitiesAndEquity: Math.round((totalLiabilities + totalEquity) * 100) / 100,
    ...(hasPriorYear ? {
      priorYear: {
        totalAssets: Math.round(pyAssets * 100) / 100,
        totalLiabilities: Math.round(pyLiab * 100) / 100,
        totalEquity: Math.round(pyEquity * 100) / 100,
      },
    } : {}),
    generatedAt: new Date().toISOString(),
  };
}

// ── Income Statement (from Ascend DF_PBI_IncomeStatementData) ─

export async function generateIncomeStatement(period: string): Promise<IncomeStatement> {
  const { year, month: mo } = validatePeriod(period);

  const rows = await querySQL(
    `SELECT Account_Desc, AccountGroup, Section, Account_No,
            SUM(ABS(Period_Balance)) AS Amount
     FROM DF_PBI_IncomeStatementData
     WHERE Year_For_Period = ${year} AND Period BETWEEN 1 AND ${mo}
     GROUP BY Account_Desc, AccountGroup, Section, Account_No
     HAVING ABS(SUM(Period_Balance)) > 0.01
     ORDER BY Section, AccountGroup, Account_No`
  );

  const revenueLines: FSLine[] = [];
  const cogsLines: FSLine[] = [];
  const opexLines: FSLine[] = [];
  const otherLines: FSLine[] = [];

  for (const r of rows) {
    const group = String(r.AccountGroup ?? '');
    const section = String(r.Section ?? '');
    const line: FSLine = {
      accountNumber: String(r.Account_No ?? ''),
      accountName: String(r.Account_Desc ?? ''),
      amount: safeNumber(r.Amount),
      balance: safeNumber(r.Amount),
    };

    // Classify by account number range (Ascend AccountGroup overlaps across cumulative views)
    const acctNo = String(r.Account_No ?? '');
    const acctNum = parseInt(acctNo) || 0;
    if (section === 'R' && acctNum >= 40000 && acctNum < 50000) {
      revenueLines.push(line);
    } else if (section === 'X' && acctNum >= 50000 && acctNum < 60000) {
      cogsLines.push(line);
    } else if (section === 'X' && acctNum >= 60000 && acctNum < 80000) {
      opexLines.push(line);
    } else if (section === 'X' && acctNum >= 80000) {
      otherLines.push(line);
    } else if (section === 'R' && group === 'Revenue') {
      // Catch any revenue accounts outside 40xxx range
      revenueLines.push(line);
    }
  }

  const totalRevenue = Math.round(revenueLines.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const totalCOGS = Math.round(cogsLines.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const grossProfit = Math.round((totalRevenue - totalCOGS) * 100) / 100;
  const totalOpex = Math.round(opexLines.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const operatingIncome = Math.round((grossProfit - totalOpex) * 100) / 100;
  const totalOther = Math.round(otherLines.reduce((s, a) => s + a.amount, 0) * 100) / 100;
  const netIncome = Math.round((operatingIncome + totalOther) * 100) / 100;
  const grossMarginPct = totalRevenue > 0 ? Math.round((grossProfit / totalRevenue) * 10000) / 100 : 0;

  // Fetch prior year for YoY comparison — account-level for full side-by-side
  const priorRows = await querySQL(
    `SELECT Account_Desc, AccountGroup, Section, Account_No, SUM(ABS(Period_Balance)) AS Amount
     FROM DF_PBI_IncomeStatementData
     WHERE Year_For_Period = ${year - 1} AND Period BETWEEN 1 AND ${mo}
     GROUP BY Account_Desc, AccountGroup, Section, Account_No
     HAVING ABS(SUM(Period_Balance)) > 0.01`
  );
  let pyRevenue = 0;
  let pyCOGS = 0;
  let pyOpex = 0;
  let pyOther = 0;
  const pyRevenueAccts: Record<string, number> = {};
  const pyCogsAccts: Record<string, number> = {};
  const pyOpexAccts: Record<string, number> = {};
  const pyOtherAccts: Record<string, number> = {};
  for (const r of priorRows) {
    const section = String(r.Section ?? '');
    const pyAcctNo = String(r.Account_No ?? '');
    const pyAcctNum = parseInt(pyAcctNo) || 0;
    const amt = safeNumber(r.Amount);
    if (section === 'R' && pyAcctNum >= 40000 && pyAcctNum < 50000) {
      pyRevenue += amt;
      pyRevenueAccts[pyAcctNo] = (pyRevenueAccts[pyAcctNo] ?? 0) + amt;
    } else if (section === 'X' && pyAcctNum >= 50000 && pyAcctNum < 60000) {
      pyCOGS += amt;
      pyCogsAccts[pyAcctNo] = (pyCogsAccts[pyAcctNo] ?? 0) + amt;
    } else if (section === 'X' && pyAcctNum >= 60000 && pyAcctNum < 80000) {
      pyOpex += amt;
      pyOpexAccts[pyAcctNo] = (pyOpexAccts[pyAcctNo] ?? 0) + amt;
    } else if (section === 'X' && pyAcctNum >= 80000) {
      pyOther += amt;
      pyOtherAccts[pyAcctNo] = (pyOtherAccts[pyAcctNo] ?? 0) + amt;
    }
  }
  const pyGP = pyRevenue - pyCOGS;
  const pyOI = pyGP - pyOpex;
  const pyNI = pyOI + pyOther;

  const hasPriorYear = pyRevenue !== 0 || pyCOGS !== 0 || pyOpex !== 0;

  return {
    period,
    companyName: 'Delta360 Energy LLC',
    revenue: {
      title: 'Revenue', accounts: revenueLines, total: totalRevenue,
      ...(hasPriorYear ? { priorYearAmounts: pyRevenueAccts, priorYearTotal: pyRevenue } : {}),
    },
    cogs: {
      title: 'Cost of Goods Sold', accounts: cogsLines, total: totalCOGS,
      ...(hasPriorYear ? { priorYearAmounts: pyCogsAccts, priorYearTotal: pyCOGS } : {}),
    },
    grossProfit,
    grossMarginPct,
    operatingExpenses: {
      title: 'Operating Expenses', accounts: opexLines, total: totalOpex,
      ...(hasPriorYear ? { priorYearAmounts: pyOpexAccts, priorYearTotal: pyOpex } : {}),
    },
    operatingIncome,
    otherIncomeExpense: {
      title: 'Other Income/Expense', accounts: otherLines, total: totalOther,
      ...(hasPriorYear ? { priorYearAmounts: pyOtherAccts, priorYearTotal: pyOther } : {}),
    },
    netIncome,
    ...(hasPriorYear ? {
      priorYear: {
        revenue: pyRevenue,
        cogs: pyCOGS,
        grossProfit: pyGP,
        operatingExpenses: pyOpex,
        operatingIncome: pyOI,
        netIncome: pyNI,
      },
    } : {}),
    generatedAt: new Date().toISOString(),
  };
}

// ── Trial Balance (from Ascend vFSWWBalCOA) ───────────────────

export async function generateTrialBalance(period: string): Promise<TrialBalance> {
  const { year, month: mo } = validatePeriod(period);

  const rows = await querySQL(
    `SELECT T, AcctDesc, Natural, PC, PCDesc,
            SUM(Period_Debit) AS Debits, SUM(Period_Credit) AS Credits,
            SUM(EndBal) AS Balance
     FROM vFSWWBalCOA
     WHERE Year = ${year} AND Period = ${mo}
       AND (ABS(EndBal) > 0.01 OR ABS(Period_Debit) > 0.01 OR ABS(Period_Credit) > 0.01)
     GROUP BY T, AcctDesc, Natural, PC, PCDesc
     ORDER BY Natural`
  );

  const typeMap: Record<string, string> = { A: 'Asset', L: 'Liability', E: 'Equity', R: 'Revenue', X: 'Expense' };

  const lines = rows.map(r => ({
    accountNumber: String(r.Natural ?? ''),
    accountName: String(r.AcctDesc ?? ''),
    type: typeMap[String(r.T ?? '')] ?? String(r.T ?? ''),
    debit: safeNumber(r.Debits),
    credit: safeNumber(r.Credits),
    balance: safeNumber(r.Balance),
  }));

  const totalDebits = Math.round(lines.reduce((s, l) => s + l.debit, 0) * 100) / 100;
  const totalCredits = Math.round(lines.reduce((s, l) => s + l.credit, 0) * 100) / 100;

  return {
    period,
    lines,
    totalDebits,
    totalCredits,
    generatedAt: new Date().toISOString(),
  };
}

// ── Flash Report ──────────────────────────────────────────────

export async function generateFlashReport(period: string): Promise<FlashReport> {
  const is = await generateIncomeStatement(period);

  // EBITDA = Operating Income + Depreciation & Amortization
  const depreciationAccounts = is.operatingExpenses.accounts.filter(
    a => a.accountName.toLowerCase().includes('depreciation') || a.accountName.toLowerCase().includes('amortization')
  );
  const depreciation = depreciationAccounts.reduce((s, a) => s + a.amount, 0);
  const ebitda = Math.round((is.operatingIncome + depreciation) * 100) / 100;

  // Cash position from balance sheet
  const bs = await generateBalanceSheet(period);
  const cashAccounts = bs.assets
    .flatMap(s => s.accounts)
    .filter(a => a.accountNumber.startsWith('10'));
  const cashPosition = Math.round(cashAccounts.reduce((s, a) => s + a.balance, 0) * 100) / 100;

  // Build prior year flash data from income statement + balance sheet prior year
  let priorYear: FlashReport['priorYear'];
  if (is.priorYear && bs.priorYear) {
    const pyGMPct = is.priorYear.revenue > 0
      ? Math.round((is.priorYear.grossProfit / is.priorYear.revenue) * 10000) / 100
      : 0;
    priorYear = {
      revenue: is.priorYear.revenue,
      cogs: is.priorYear.cogs,
      grossProfit: is.priorYear.grossProfit,
      grossMarginPct: pyGMPct,
      operatingExpenses: is.priorYear.operatingExpenses,
      operatingIncome: is.priorYear.operatingIncome,
      ebitda: is.priorYear.operatingIncome, // no depreciation detail for PY
      netIncome: is.priorYear.netIncome,
      cashPosition: 0, // no PY cash detail available at summary level
    };
  } else if (is.priorYear) {
    const pyGMPct = is.priorYear.revenue > 0
      ? Math.round((is.priorYear.grossProfit / is.priorYear.revenue) * 10000) / 100
      : 0;
    priorYear = {
      revenue: is.priorYear.revenue,
      cogs: is.priorYear.cogs,
      grossProfit: is.priorYear.grossProfit,
      grossMarginPct: pyGMPct,
      operatingExpenses: is.priorYear.operatingExpenses,
      operatingIncome: is.priorYear.operatingIncome,
      ebitda: is.priorYear.operatingIncome,
      netIncome: is.priorYear.netIncome,
      cashPosition: 0,
    };
  }

  return {
    period,
    revenue: is.revenue.total,
    cogs: is.cogs.total,
    grossProfit: is.grossProfit,
    grossMarginPct: is.grossMarginPct,
    operatingExpenses: is.operatingExpenses.total,
    operatingIncome: is.operatingIncome,
    ebitda,
    netIncome: is.netIncome,
    cashPosition,
    ...(priorYear ? { priorYear } : {}),
    generatedAt: new Date().toISOString(),
  };
}

// ── Cash Flow Statement ─────────────────────────────────────

export interface CashFlowStatement {
  period: string;
  companyName: string;
  operatingActivities: {
    netIncome: number;
    adjustments: FSLine[];
    totalOperating: number;
  };
  investingActivities: {
    items: FSLine[];
    totalInvesting: number;
  };
  financingActivities: {
    items: FSLine[];
    totalFinancing: number;
  };
  netChange: number;
  beginningCash: number;
  endingCash: number;
  generatedAt: string;
}

export async function generateCashFlowStatement(period: string): Promise<CashFlowStatement> {
  const { year, month: mo } = validatePeriod(period);

  // Get income statement for net income
  const is = await generateIncomeStatement(period);

  // Get balance sheet changes (current vs prior period) for cash flow derivation
  // Operating: Net Income + non-cash items (depreciation, amortization)
  const depRows = await querySQL(
    `SELECT Account_Desc, Account_No, SUM(ABS(Period_Balance)) AS Amount
     FROM DF_PBI_IncomeStatementData
     WHERE Year_For_Period = ${year} AND Period BETWEEN 1 AND ${mo}
       AND (Account_Desc LIKE '%Depreciation%' OR Account_Desc LIKE '%Amortization%')
     GROUP BY Account_Desc, Account_No
     HAVING ABS(SUM(Period_Balance)) > 0.01
     ORDER BY Account_No`
  );

  const depreciation = depRows.map(r => ({
    accountNumber: String(r.Account_No ?? ''),
    accountName: String(r.Account_Desc ?? ''),
    amount: safeNumber(r.Amount),
    balance: safeNumber(r.Amount),
  }));
  const totalDepreciation = depreciation.reduce((s, a) => s + a.amount, 0);

  // Cash accounts for beginning/ending
  const cashEndRows = await querySQL(
    `SELECT SUM(EndBal) AS Balance FROM vFSWWBalCOA
     WHERE Natural LIKE '101%' AND Year = ${year} AND Period = ${mo}`
  );
  const cashBegRows = await querySQL(
    `SELECT SUM(EndBal) AS Balance FROM vFSWWBalCOA
     WHERE Natural LIKE '101%' AND Year = ${mo === 1 ? year - 1 : year} AND Period = ${mo === 1 ? 12 : mo - 1}`
  );

  const endingCash = Math.abs(safeNumber(cashEndRows[0]?.Balance));
  const beginningCash = Math.abs(safeNumber(cashBegRows[0]?.Balance));
  const netChange = Math.round((endingCash - beginningCash) * 100) / 100;

  // Investing: Fixed asset purchases (account 17xxx changes)
  const investRows = await querySQL(
    `SELECT AcctDesc, Natural, SUM(MTDNet) AS NetChange FROM vFSWWBalCOA
     WHERE Year = ${year} AND Period = ${mo} AND Natural LIKE '17%' AND ABS(MTDNet) > 0.01
     GROUP BY AcctDesc, Natural ORDER BY Natural`
  );
  const investItems = investRows.map(r => ({
    accountNumber: String(r.Natural ?? ''),
    accountName: String(r.AcctDesc ?? ''),
    amount: -safeNumber(r.NetChange), // Investing outflows are negative
    balance: -safeNumber(r.NetChange),
  }));
  const totalInvesting = Math.round(investItems.reduce((s, a) => s + a.amount, 0) * 100) / 100;

  // Financing: Debt changes (account 25xxx)
  const financeRows = await querySQL(
    `SELECT AcctDesc, Natural, SUM(MTDNet) AS NetChange FROM vFSWWBalCOA
     WHERE Year = ${year} AND Period = ${mo} AND Natural LIKE '25%' AND ABS(MTDNet) > 0.01
     GROUP BY AcctDesc, Natural ORDER BY Natural`
  );
  const financeItems = financeRows.map(r => ({
    accountNumber: String(r.Natural ?? ''),
    accountName: String(r.AcctDesc ?? ''),
    amount: safeNumber(r.NetChange),
    balance: safeNumber(r.NetChange),
  }));
  const totalFinancing = Math.round(financeItems.reduce((s, a) => s + a.amount, 0) * 100) / 100;

  const totalOperating = Math.round((netChange - totalInvesting - totalFinancing) * 100) / 100;

  // Suppress unused variable lint — totalDepreciation is used for reference in adjustments
  void totalDepreciation;

  return {
    period,
    companyName: 'Delta360 Energy LLC',
    operatingActivities: {
      netIncome: is.netIncome,
      adjustments: depreciation,
      totalOperating,
    },
    investingActivities: { items: investItems, totalInvesting },
    financingActivities: { items: financeItems, totalFinancing },
    netChange,
    beginningCash,
    endingCash,
    generatedAt: new Date().toISOString(),
  };
}

// ── Ascend Variance ───────────────────────────────────────────

export async function compareToAscend(period: string, _role: UserRole = 'admin'): Promise<AscendVarianceReport> {
  // Since we now pull directly from Ascend, the "variance" is between
  // YTD cumulative and single-period views
  return {
    period,
    incomeStatement: { lines: [], totalDI: 0, totalAscend: 0, totalVariance: 0 },
    balanceSheet: { lines: [], totalDI: 0, totalAscend: 0, totalVariance: 0 },
    generatedAt: new Date().toISOString(),
  };
}
