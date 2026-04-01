'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileSpreadsheet,
  Download,
  RefreshCw,
  ChevronDown,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';
import { DensityKPI } from '@/components/density/DensityKPI';
import { DensityTable } from '@/components/density/DensityTable';
import { DensityChart } from '@/components/density/DensityChart';
import { DensityInsight } from '@/components/density/DensityInsight';
import { DensitySection } from '@/components/density/DensitySection';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type TabId = 'balance-sheet' | 'income-statement' | 'trial-balance' | 'flash' | 'variance' | 'cash-flow-statement';

interface BSSection {
  label?: string;
  title?: string;
  accounts: { accountNumber: string; accountName: string; balance: number }[];
  total: number;
  priorYearAmounts?: Readonly<Record<string, number>>;
  priorYearTotal?: number;
}

interface BalanceSheetData {
  period: string;
  assets: BSSection[];
  totalAssets: number;
  liabilities: BSSection[];
  totalLiabilities: number;
  equity: BSSection[];
  totalEquity: number;
  totalLiabilitiesAndEquity: number;
  priorYear?: {
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
}

interface ISSection {
  label?: string;
  title?: string;
  accounts: { accountNumber: string; accountName: string; amount: number }[];
  total: number;
  priorYearAmounts?: Readonly<Record<string, number>>;
  priorYearTotal?: number;
}

interface IncomeStatementData {
  period: string;
  revenue: ISSection;
  cogs: ISSection;
  grossProfit: number;
  operatingExpenses: ISSection;
  operatingIncome: number;
  otherIncomeExpense: ISSection;
  netIncome: number;
  priorYear?: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    operatingExpenses: number;
    operatingIncome: number;
    netIncome: number;
  };
}

interface TBLine {
  accountNumber: string;
  accountName: string;
  type: string;
  debit: number;
  credit: number;
  balance: number;
}

interface TrialBalanceData {
  period: string;
  accounts: TBLine[];
  totalDebit: number;
  totalCredit: number;
}

interface FlashReportData {
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
}

interface VarianceLine {
  accountNumber: string;
  accountName: string;
  diBalance: number;
  ascendBalance: number;
  variance: number;
  variancePct: number | null;
}

interface CashFlowData {
  period: string;
  operatingActivities: {
    netIncome: number;
    adjustments: { accountNumber: string; accountName: string; amount: number }[];
    totalOperating: number;
  };
  investingActivities: {
    items: { accountNumber: string; accountName: string; amount: number }[];
    totalInvesting: number;
  };
  financingActivities: {
    items: { accountNumber: string; accountName: string; amount: number }[];
    totalFinancing: number;
  };
  netChange: number;
  beginningCash: number;
  endingCash: number;
}

interface VarianceSection {
  lines: VarianceLine[];
  totalDI: number;
  totalAscend: number;
  totalVariance: number;
}

interface VarianceData {
  period: string;
  incomeStatement: VarianceSection;
  balanceSheet: VarianceSection;
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtAcct(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0.00';
  const abs = Math.abs(n);
  const formatted = abs.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return n < 0 ? `($${formatted})` : `$${formatted}`;
}

function fmtPct(n: number | null): string {
  if (n === null || typeof n !== 'number' || Number.isNaN(n)) return '--';
  return `${n >= 0 ? '+' : ''}${n.toFixed(1)}%`;
}

function fmtCompact(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  let formatted: string;
  if (abs >= 1_000_000_000) formatted = `$${(abs / 1_000_000_000).toFixed(1)}B`;
  else if (abs >= 1_000_000) formatted = `$${(abs / 1_000_000).toFixed(1)}M`;
  else if (abs >= 1_000) formatted = `$${(abs / 1_000).toFixed(1)}K`;
  else formatted = `$${abs.toFixed(0)}`;
  return n < 0 ? `(${formatted})` : formatted;
}

// ---------------------------------------------------------------------------
// YoY helpers
// ---------------------------------------------------------------------------

function yoyChange(current: number, prior: number): number {
  return current - prior;
}

function yoyPct(current: number, prior: number): number | null {
  if (prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

function YoYComparisonTable({
  comparisons,
}: {
  comparisons: { label: string; current: number; prior: number }[];
}) {
  return (
    <div className="mt-8 border-t border-zinc-700 pt-6">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2">
        Year-over-Year Comparison
      </h3>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-700 text-sm text-zinc-400">
            <th className="py-2 text-left">Metric</th>
            <th className="py-2 text-right w-36">Current YTD</th>
            <th className="py-2 text-right w-36">Prior Year YTD</th>
            <th className="py-2 text-right w-28">$ Change</th>
            <th className="py-2 text-right w-20">% Change</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {comparisons.map((c) => {
            const change = yoyChange(c.current, c.prior);
            const pct = yoyPct(c.current, c.prior);
            return (
              <tr key={c.label} className="border-b border-zinc-800 hover:bg-zinc-800/50">
                <td className="py-2 text-zinc-300">{c.label}</td>
                <td className="py-2 text-right text-white">{fmtAcct(c.current)}</td>
                <td className="py-2 text-right text-zinc-400">{fmtAcct(c.prior)}</td>
                <td className={`py-2 text-right font-semibold ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {fmtAcct(change)}
                </td>
                <td className={`py-2 text-right ${pct !== null && pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {pct !== null ? `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%` : '--'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Period helpers
// ---------------------------------------------------------------------------

function getPeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 24; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}

// ---------------------------------------------------------------------------
// Tab config
// ---------------------------------------------------------------------------

const TABS: { id: TabId; label: string }[] = [
  { id: 'balance-sheet', label: 'Balance Sheet' },
  { id: 'income-statement', label: 'Income Statement' },
  { id: 'trial-balance', label: 'Trial Balance' },
  { id: 'flash', label: 'Flash Report' },
  { id: 'cash-flow-statement', label: 'Cash Flow' },
  { id: 'variance', label: 'Ascend Variance' },
];

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function SectionTable({
  section,
  valueKey,
  showYoY,
}: {
  section: BSSection | ISSection;
  valueKey: 'balance' | 'amount';
  showYoY?: boolean;
}) {
  const pyAmounts = section.priorYearAmounts ?? {};
  const hasPY = showYoY && (section.priorYearTotal !== undefined || Object.keys(pyAmounts).length > 0);

  return (
    <div className="mb-6">
      <h3 className="text-xs font-semibold text-zinc-300 uppercase tracking-wider mb-2 border-b border-zinc-700 pb-1">
        {section.title ?? section.label ?? ''}
      </h3>
      <table className="w-full">
        {hasPY && (
          <thead>
            <tr className="text-xs text-zinc-500 uppercase tracking-wider">
              <th className="py-1 text-left w-20" />
              <th className="py-1 text-left" />
              <th className="py-1 text-right w-32">Current</th>
              <th className="py-1 text-right w-32">Prior Yr</th>
              <th className="py-1 text-right w-28">YoY Change</th>
              <th className="py-1 text-right w-20">YoY %</th>
            </tr>
          </thead>
        )}
        <tbody className="font-mono text-sm">
          {(section.accounts ?? []).map((acct, i) => {
            const current = (acct as unknown as Record<string, number>)[valueKey] ?? 0;
            const prior = hasPY ? (pyAmounts[acct.accountNumber] ?? 0) : 0;
            const change = current - prior;
            const pct = prior !== 0 ? ((current - prior) / Math.abs(prior)) * 100 : null;
            return (
              <tr key={`${acct.accountNumber}-${i}`} className="hover:bg-zinc-800/50">
                <td className="py-1 pr-4 text-zinc-500 w-20">{acct.accountNumber}</td>
                <td className="py-1 text-zinc-300">{acct.accountName}</td>
                <td className="py-1 text-right w-32 text-zinc-200">
                  {fmtAcct(current)}
                </td>
                {hasPY && (
                  <>
                    <td className="py-1 text-right w-32 text-zinc-500">{fmtAcct(prior)}</td>
                    <td className={`py-1 text-right w-28 ${change >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {fmtAcct(change)}
                    </td>
                    <td className={`py-1 text-right w-20 text-xs ${pct !== null && pct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {pct !== null ? `${pct >= 0 ? '+' : ''}${typeof pct === 'number' && !Number.isNaN(pct) ? pct.toFixed(1) : '0.0'}%` : '--'}
                    </td>
                  </>
                )}
              </tr>
            );
          })}
          <tr className="border-t border-zinc-600 font-semibold">
            <td className="py-2" />
            <td className="py-2 text-zinc-200">Total {section.title ?? section.label ?? ''}</td>
            <td className="py-2 text-right w-32 text-white">{fmtAcct(section.total)}</td>
            {hasPY && (() => {
              const pyTotal = section.priorYearTotal ?? 0;
              const totalChange = section.total - pyTotal;
              const totalPct = pyTotal !== 0 ? ((section.total - pyTotal) / Math.abs(pyTotal)) * 100 : null;
              return (
                <>
                  <td className="py-2 text-right w-32 text-zinc-400">{fmtAcct(pyTotal)}</td>
                  <td className={`py-2 text-right w-28 ${totalChange >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {fmtAcct(totalChange)}
                  </td>
                  <td className={`py-2 text-right w-20 text-xs ${totalPct !== null && totalPct >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {totalPct !== null ? `${totalPct >= 0 ? '+' : ''}${typeof totalPct === 'number' && !Number.isNaN(totalPct) ? totalPct.toFixed(1) : '0.0'}%` : '--'}
                  </td>
                </>
              );
            })()}
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function BalanceSheetView({ data }: { data: BalanceSheetData }) {
  const hasPY = !!data.priorYear;
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Assets</h2>
        {(data.assets ?? []).map((s, i) => (
          <SectionTable key={i} section={s} valueKey="balance" showYoY={hasPY} />
        ))}
        <div className="border-t-2 border-zinc-500 pt-2 font-mono font-bold text-white flex justify-between">
          <span>Total Assets</span>
          <span>{fmtAcct(data.totalAssets ?? 0)}</span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Liabilities</h2>
        {(data.liabilities ?? []).map((s, i) => (
          <SectionTable key={i} section={s} valueKey="balance" showYoY={hasPY} />
        ))}
        <div className="border-t border-zinc-600 pt-2 font-mono font-semibold text-zinc-200 flex justify-between">
          <span>Total Liabilities</span>
          <span>{fmtAcct(data.totalLiabilities ?? 0)}</span>
        </div>
      </div>

      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Stockholders Equity</h2>
        {(data.equity ?? []).map((s, i) => (
          <SectionTable key={i} section={s} valueKey="balance" showYoY={hasPY} />
        ))}
        <div className="border-t border-zinc-600 pt-2 font-mono font-semibold text-zinc-200 flex justify-between">
          <span>Total Equity</span>
          <span>{fmtAcct(data.totalEquity ?? 0)}</span>
        </div>
      </div>

      <div className="border-t-2 border-white pt-3 font-mono font-bold text-white flex justify-between text-lg">
        <span>Total Liabilities & Equity</span>
        <span>{fmtAcct(data.totalLiabilitiesAndEquity ?? 0)}</span>
      </div>

      {data.priorYear && (
        <YoYComparisonTable
          comparisons={[
            { label: 'Total Assets', current: data.totalAssets ?? 0, prior: data.priorYear.totalAssets ?? 0 },
            { label: 'Total Liabilities', current: data.totalLiabilities ?? 0, prior: data.priorYear.totalLiabilities ?? 0 },
            { label: 'Total Equity', current: data.totalEquity ?? 0, prior: data.priorYear.totalEquity ?? 0 },
          ]}
        />
      )}
    </div>
  );
}

function IncomeStatementView({ data }: { data: IncomeStatementData }) {
  const emptySection: ISSection = { accounts: [], total: 0 };
  const revenue = data.revenue ?? emptySection;
  const cogs = data.cogs ?? emptySection;
  const opex = data.operatingExpenses ?? emptySection;
  const other = data.otherIncomeExpense ?? emptySection;
  const hasPY = !!data.priorYear;

  return (
    <div className="space-y-4">
      <SectionTable section={revenue} valueKey="amount" showYoY={hasPY} />
      <SectionTable section={cogs} valueKey="amount" showYoY={hasPY} />

      {hasPY ? (
        <table className="w-full">
          <tbody className="font-mono text-sm">
            <tr className="border-t-2 border-zinc-500 font-bold">
              <td className="py-2 text-white" colSpan={2}>Gross Profit</td>
              <td className="py-2 text-right w-32 text-white">{fmtAcct(data.grossProfit ?? 0)}</td>
              <td className="py-2 text-right w-32 text-zinc-400">{fmtAcct(data.priorYear?.grossProfit ?? 0)}</td>
              <td className={`py-2 text-right w-28 ${yoyChange(data.grossProfit ?? 0, data.priorYear?.grossProfit ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtAcct(yoyChange(data.grossProfit ?? 0, data.priorYear?.grossProfit ?? 0))}
              </td>
              <td className={`py-2 text-right w-20 text-xs ${(() => { const p = yoyPct(data.grossProfit ?? 0, data.priorYear?.grossProfit ?? 0); return p !== null && p >= 0 ? 'text-green-400' : 'text-red-400'; })()}`}>
                {fmtPct(yoyPct(data.grossProfit ?? 0, data.priorYear?.grossProfit ?? 0))}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="border-t-2 border-zinc-500 pt-2 font-mono font-bold text-white flex justify-between">
          <span>Gross Profit</span>
          <span>{fmtAcct(data.grossProfit ?? 0)}</span>
        </div>
      )}

      <SectionTable section={opex} valueKey="amount" showYoY={hasPY} />

      {hasPY ? (
        <table className="w-full">
          <tbody className="font-mono text-sm">
            <tr className="border-t-2 border-zinc-500 font-bold">
              <td className="py-2 text-white" colSpan={2}>Operating Income</td>
              <td className="py-2 text-right w-32 text-white">{fmtAcct(data.operatingIncome ?? 0)}</td>
              <td className="py-2 text-right w-32 text-zinc-400">{fmtAcct(data.priorYear?.operatingIncome ?? 0)}</td>
              <td className={`py-2 text-right w-28 ${yoyChange(data.operatingIncome ?? 0, data.priorYear?.operatingIncome ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtAcct(yoyChange(data.operatingIncome ?? 0, data.priorYear?.operatingIncome ?? 0))}
              </td>
              <td className={`py-2 text-right w-20 text-xs ${(() => { const p = yoyPct(data.operatingIncome ?? 0, data.priorYear?.operatingIncome ?? 0); return p !== null && p >= 0 ? 'text-green-400' : 'text-red-400'; })()}`}>
                {fmtPct(yoyPct(data.operatingIncome ?? 0, data.priorYear?.operatingIncome ?? 0))}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="border-t-2 border-zinc-500 pt-2 font-mono font-bold text-white flex justify-between">
          <span>Operating Income</span>
          <span>{fmtAcct(data.operatingIncome ?? 0)}</span>
        </div>
      )}

      {(other.accounts ?? []).length > 0 && (
        <SectionTable section={other} valueKey="amount" showYoY={hasPY} />
      )}

      {hasPY ? (
        <table className="w-full">
          <tbody className="font-mono text-sm">
            <tr className="border-t-2 border-white font-bold text-lg">
              <td className="py-3 text-white" colSpan={2}>Net Income</td>
              <td className={`py-3 text-right w-32 ${(data.netIncome ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtAcct(data.netIncome ?? 0)}
              </td>
              <td className="py-3 text-right w-32 text-zinc-400">{fmtAcct(data.priorYear?.netIncome ?? 0)}</td>
              <td className={`py-3 text-right w-28 ${yoyChange(data.netIncome ?? 0, data.priorYear?.netIncome ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                {fmtAcct(yoyChange(data.netIncome ?? 0, data.priorYear?.netIncome ?? 0))}
              </td>
              <td className={`py-3 text-right w-20 text-xs ${(() => { const p = yoyPct(data.netIncome ?? 0, data.priorYear?.netIncome ?? 0); return p !== null && p >= 0 ? 'text-green-400' : 'text-red-400'; })()}`}>
                {fmtPct(yoyPct(data.netIncome ?? 0, data.priorYear?.netIncome ?? 0))}
              </td>
            </tr>
          </tbody>
        </table>
      ) : (
        <div className="border-t-2 border-white pt-3 font-mono font-bold text-white flex justify-between text-lg">
          <span>Net Income</span>
          <span className={(data.netIncome ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}>
            {fmtAcct(data.netIncome ?? 0)}
          </span>
        </div>
      )}
    </div>
  );
}

function TrialBalanceView({ data }: { data: TrialBalanceData }) {
  return (
    <div>
      <table className="w-full">
        <thead>
          <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
            <th className="py-2 text-left w-20">Acct #</th>
            <th className="py-2 text-left">Account Name</th>
            <th className="py-2 text-left w-20">Type</th>
            <th className="py-2 text-right w-32">Debit</th>
            <th className="py-2 text-right w-32">Credit</th>
            <th className="py-2 text-right w-32">Balance</th>
          </tr>
        </thead>
        <tbody className="font-mono text-sm">
          {(data.accounts ?? []).map((line, i) => (
            <tr key={`${line.accountNumber}-${i}`} className="hover:bg-zinc-800/50 border-b border-zinc-800">
              <td className="py-1.5 text-zinc-500">{line.accountNumber}</td>
              <td className="py-1.5 text-zinc-300">{line.accountName}</td>
              <td className="py-1.5 text-zinc-500 capitalize">{line.type}</td>
              <td className="py-1.5 text-right text-zinc-200">{line.debit > 0 ? fmtAcct(line.debit) : ''}</td>
              <td className="py-1.5 text-right text-zinc-200">{line.credit > 0 ? fmtAcct(line.credit) : ''}</td>
              <td className="py-1.5 text-right text-white font-semibold">{fmtAcct(line.balance)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="border-t-2 border-zinc-500 font-semibold">
            <td className="py-2" colSpan={3}>Totals</td>
            <td className="py-2 text-right text-white font-mono">{fmtAcct(data.totalDebit)}</td>
            <td className="py-2 text-right text-white font-mono">{fmtAcct(data.totalCredit)}</td>
            <td className="py-2 text-right text-white font-mono">
              {fmtAcct(Math.round((data.totalDebit - data.totalCredit) * 100) / 100)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

function FlashReportView({ data }: { data: FlashReportData }) {
  const py = data.priorYear;

  const metrics: { label: string; value: number; format: 'currency' | 'pct'; priorValue?: number; priorFormat?: 'currency' | 'pct' }[] = [
    { label: 'Revenue', value: data.revenue, format: 'currency', priorValue: py?.revenue },
    { label: 'COGS', value: data.cogs, format: 'currency', priorValue: py?.cogs },
    { label: 'Gross Profit', value: data.grossProfit, format: 'currency', priorValue: py?.grossProfit },
    { label: 'Gross Margin', value: data.grossMarginPct, format: 'pct', priorValue: py?.grossMarginPct, priorFormat: 'pct' },
    { label: 'Operating Expenses', value: data.operatingExpenses, format: 'currency', priorValue: py?.operatingExpenses },
    { label: 'Operating Income', value: data.operatingIncome, format: 'currency', priorValue: py?.operatingIncome },
    { label: 'EBITDA', value: data.ebitda, format: 'currency', priorValue: py?.ebitda },
    { label: 'Net Income', value: data.netIncome, format: 'currency', priorValue: py?.netIncome },
    { label: 'Cash Position', value: data.cashPosition, format: 'currency', priorValue: py?.cashPosition },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {metrics.map((m) => {
        const isPositive = m.value >= 0;
        const hasPrior = m.priorValue !== undefined && m.priorValue !== null;
        const priorFmt = m.priorFormat ?? m.format;
        let changeText = '';
        let changeColor = 'text-zinc-500';
        if (hasPrior && priorFmt === 'currency' && m.priorValue !== 0) {
          const pct = yoyPct(m.value, m.priorValue as number);
          if (pct !== null) {
            changeText = `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}% YoY`;
            changeColor = pct >= 0 ? 'text-green-400' : 'text-red-400';
          }
        } else if (hasPrior && priorFmt === 'pct') {
          const diff = m.value - (m.priorValue as number);
          changeText = `${!Number.isNaN(diff) && diff >= 0 ? '+' : ''}${typeof diff === 'number' && !Number.isNaN(diff) ? diff.toFixed(1) : '0.0'}pp YoY`;
          changeColor = diff >= 0 ? 'text-green-400' : 'text-red-400';
        }
        return (
          <div
            key={m.label}
            className="bg-zinc-900 border border-zinc-700 rounded-lg p-4"
          >
            <div className="text-sm text-zinc-400 mb-1">{m.label}</div>
            <div className={`text-lg font-mono font-bold ${
              m.label === 'Net Income' || m.label === 'Operating Income' || m.label === 'EBITDA'
                ? isPositive ? 'text-green-400' : 'text-red-400'
                : 'text-white'
            }`}>
              {m.format === 'pct' ? `${typeof m.value === 'number' && !Number.isNaN(m.value) ? m.value.toFixed(1) : '0.0'}%` : fmtCompact(m.value)}
            </div>
            {hasPrior && (
              <div className="mt-0.5 text-xs">
                <span className="text-zinc-500">
                  PY: {priorFmt === 'pct'
                    ? `${typeof m.priorValue === 'number' && !Number.isNaN(m.priorValue) ? m.priorValue.toFixed(1) : '0.0'}%`
                    : fmtCompact(m.priorValue as number)}
                </span>
                {changeText && (
                  <span className={`ml-2 ${changeColor}`}>{changeText}</span>
                )}
              </div>
            )}
            {!hasPrior && (m.label === 'Net Income' || m.label === 'Gross Profit') && (
              <div className="mt-0.5">
                {isPositive ? (
                  <TrendingUp className="w-4 h-4 text-green-400 inline" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-red-400 inline" />
                )}
              </div>
            )}
          </div>
        );
      })}
      {py && (
        <div className="col-span-1 md:col-span-3">
          <YoYComparisonTable
            comparisons={[
              { label: 'Revenue', current: data.revenue, prior: py.revenue },
              { label: 'COGS', current: data.cogs, prior: py.cogs },
              { label: 'Gross Profit', current: data.grossProfit, prior: py.grossProfit },
              { label: 'Operating Expenses', current: data.operatingExpenses, prior: py.operatingExpenses },
              { label: 'Operating Income', current: data.operatingIncome, prior: py.operatingIncome },
              { label: 'EBITDA', current: data.ebitda, prior: py.ebitda },
              { label: 'Net Income', current: data.netIncome, prior: py.netIncome },
              { label: 'Cash Position', current: data.cashPosition, prior: py.cashPosition },
            ]}
          />
        </div>
      )}
    </div>
  );
}

function CashFlowView({ data }: { data: CashFlowData }) {
  const op = data.operatingActivities ?? { netIncome: 0, adjustments: [], totalOperating: 0 };
  const inv = data.investingActivities ?? { items: [], totalInvesting: 0 };
  const fin = data.financingActivities ?? { items: [], totalFinancing: 0 };

  return (
    <div className="space-y-8">
      {/* Operating Activities */}
      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Operating Activities</h2>
        <div className="font-mono text-sm space-y-1">
          <div className="flex justify-between py-1">
            <span className="text-zinc-300">Net Income</span>
            <span className="text-white">{fmtAcct(op.netIncome ?? 0)}</span>
          </div>
          <div className="text-sm text-zinc-400 uppercase tracking-wider mt-3 mb-1">Adjustments for non-cash items:</div>
          {(op.adjustments ?? []).map((adj, i) => (
            <div key={i} className="flex justify-between py-0.5 hover:bg-zinc-800/50 px-2 rounded">
              <span className="text-zinc-400">{adj.accountName}</span>
              <span className="text-zinc-200">{fmtAcct(adj.amount ?? 0)}</span>
            </div>
          ))}
          <div className="border-t-2 border-zinc-500 pt-2 mt-2 flex justify-between font-bold">
            <span className="text-zinc-200">Net Cash from Operations</span>
            <span className="text-white">{fmtAcct(op.totalOperating ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Investing Activities */}
      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Investing Activities</h2>
        <div className="font-mono text-sm space-y-1">
          {(inv.items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between py-0.5 hover:bg-zinc-800/50 px-2 rounded">
              <span className="text-zinc-400">{item.accountName}</span>
              <span className="text-zinc-200">{fmtAcct(item.amount ?? 0)}</span>
            </div>
          ))}
          {(inv.items ?? []).length === 0 && (
            <div className="text-zinc-500 italic">No investing activity this period</div>
          )}
          <div className="border-t-2 border-zinc-500 pt-2 mt-2 flex justify-between font-bold">
            <span className="text-zinc-200">Net Cash from Investing</span>
            <span className="text-white">{fmtAcct(inv.totalInvesting ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Financing Activities */}
      <div>
        <h2 className="text-lg font-bold text-white mb-2.5">Financing Activities</h2>
        <div className="font-mono text-sm space-y-1">
          {(fin.items ?? []).map((item, i) => (
            <div key={i} className="flex justify-between py-0.5 hover:bg-zinc-800/50 px-2 rounded">
              <span className="text-zinc-400">{item.accountName}</span>
              <span className="text-zinc-200">{fmtAcct(item.amount ?? 0)}</span>
            </div>
          ))}
          {(fin.items ?? []).length === 0 && (
            <div className="text-zinc-500 italic">No financing activity this period</div>
          )}
          <div className="border-t-2 border-zinc-500 pt-2 mt-2 flex justify-between font-bold">
            <span className="text-zinc-200">Net Cash from Financing</span>
            <span className="text-white">{fmtAcct(fin.totalFinancing ?? 0)}</span>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="border-t-2 border-white pt-4 space-y-2 font-mono">
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Net Change in Cash</span>
          <span className={`font-semibold ${(data.netChange ?? 0) >= 0 ? 'text-green-400' : 'text-red-400'}`}>
            {fmtAcct(data.netChange ?? 0)}
          </span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-zinc-400">Beginning Cash</span>
          <span className="text-zinc-200">{fmtAcct(data.beginningCash ?? 0)}</span>
        </div>
        <div className="flex justify-between text-lg font-bold">
          <span className="text-white">Ending Cash</span>
          <span className="text-white">{fmtAcct(data.endingCash ?? 0)}</span>
        </div>
      </div>
    </div>
  );
}

function VarianceView({ data }: { data: VarianceData }) {
  const emptyVarianceSection: VarianceSection = { lines: [], totalDI: 0, totalAscend: 0, totalVariance: 0 };

  function VarianceTable({ section, title }: { section: VarianceSection | undefined; title: string }) {
    const s = section ?? emptyVarianceSection;
    return (
      <div className="mb-8">
        <h3 className="text-lg font-bold text-white mb-2">{title}</h3>
        <table className="w-full">
          <thead>
            <tr className="border-b border-zinc-600 text-sm text-zinc-400 font-semibold">
              <th className="py-2 text-left w-20">Acct #</th>
              <th className="py-2 text-left">Account</th>
              <th className="py-2 text-right w-32">DI GL</th>
              <th className="py-2 text-right w-32">Ascend GL</th>
              <th className="py-2 text-right w-28">Variance</th>
              <th className="py-2 text-right w-20">%</th>
            </tr>
          </thead>
          <tbody className="font-mono text-sm">
            {(s.lines ?? []).map((line, i) => {
              const hasVariance = Math.abs(line.variance ?? 0) > 0.01;
              return (
                <tr
                  key={`${line.accountNumber}-${i}`}
                  className={`border-b border-zinc-800 ${hasVariance ? 'bg-yellow-900/10' : 'hover:bg-zinc-800/50'}`}
                >
                  <td className="py-1.5 text-zinc-500">{line.accountNumber}</td>
                  <td className="py-1.5 text-zinc-300">{line.accountName}</td>
                  <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.diBalance)}</td>
                  <td className="py-1.5 text-right text-zinc-200">{fmtAcct(line.ascendBalance)}</td>
                  <td className={`py-1.5 text-right font-semibold ${
                    hasVariance ? 'text-yellow-400' : 'text-zinc-500'
                  }`}>
                    {fmtAcct(line.variance)}
                    {hasVariance && <AlertTriangle className="w-3 h-3 inline ml-1" />}
                  </td>
                  <td className="py-1.5 text-right text-zinc-500">{fmtPct(line.variancePct)}</td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-zinc-500 font-semibold">
              <td className="py-2" colSpan={2}>Totals</td>
              <td className="py-2 text-right text-white font-mono">{fmtAcct(s.totalDI ?? 0)}</td>
              <td className="py-2 text-right text-white font-mono">{fmtAcct(s.totalAscend ?? 0)}</td>
              <td className={`py-2 text-right font-mono ${
                Math.abs(s.totalVariance ?? 0) > 0.01 ? 'text-yellow-400' : 'text-green-400'
              }`}>
                {fmtAcct(s.totalVariance ?? 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    );
  }

  return (
    <div>
      <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4 mb-6">
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <AlertTriangle className="w-4 h-4" />
          <span>
            Comparing Delta Intelligence GL to Ascend ERP for period {data.period}.
            Variances indicate differences that need reconciliation.
          </span>
        </div>
      </div>
      <VarianceTable section={data.incomeStatement} title="Income Statement Variance" />
      <VarianceTable section={data.balanceSheet} title="Balance Sheet Variance" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Density-aware views
// ---------------------------------------------------------------------------

function ExecutiveBalanceSheetView({ data }: { data: BalanceSheetData }) {
  const totalAssets = data.totalAssets ?? 0;
  const totalLiabilities = data.totalLiabilities ?? 0;
  const totalEquity = data.totalEquity ?? 0;
  const currentRatio =
    totalLiabilities > 0
      ? parseFloat((totalAssets / totalLiabilities).toFixed(2))
      : 0;

  const pyAssets = data.priorYear?.totalAssets ?? 0;
  const pyLiab = data.priorYear?.totalLiabilities ?? 0;
  const pyEquity = data.priorYear?.totalEquity ?? 0;

  const assetDelta = pyAssets > 0 ? yoyPct(totalAssets, pyAssets) : null;
  const liabDelta = pyLiab > 0 ? yoyPct(totalLiabilities, pyLiab) : null;
  const equityDelta = pyEquity > 0 ? yoyPct(totalEquity, pyEquity) : null;

  // Build asset composition chart data from asset sections
  const assetSections = data.assets ?? [];
  const chartData = assetSections.map((s) => ({
    label: (s.title ?? s.label ?? 'Other').replace('ASSETS', '').trim() || 'Assets',
    value: Math.abs(s.total ?? 0),
  }));

  // Anomaly insight: liabilities growing faster than assets
  let insightText = 'Balance sheet is balanced.';
  if (data.priorYear) {
    const assetGrowth = pyAssets > 0 ? (totalAssets - pyAssets) / Math.abs(pyAssets) : 0;
    const liabGrowth = pyLiab > 0 ? (totalLiabilities - pyLiab) / Math.abs(pyLiab) : 0;
    if (liabGrowth > assetGrowth + 0.05) {
      insightText = 'Liabilities are growing faster than assets YoY — monitor leverage ratio.';
    } else if (equityDelta !== null && equityDelta < -10) {
      insightText = 'Equity declined more than 10% YoY — review retained earnings and distributions.';
    } else if (assetDelta !== null && assetDelta > 10) {
      insightText = `Total assets grew ${assetDelta.toFixed(1)}% YoY — strong asset base expansion.`;
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <DensityKPI
          label="Total Assets"
          value={fmtCompact(totalAssets)}
          delta={assetDelta !== null ? `${assetDelta >= 0 ? '+' : ''}${assetDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={assetDelta !== null ? (assetDelta >= 0 ? 'up' : 'down') : undefined}
        />
        <DensityKPI
          label="Total Liabilities"
          value={fmtCompact(totalLiabilities)}
          delta={liabDelta !== null ? `${liabDelta >= 0 ? '+' : ''}${liabDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={liabDelta !== null ? (liabDelta >= 0 ? 'down' : 'up') : undefined}
        />
        <DensityKPI
          label="Net Equity"
          value={fmtCompact(totalEquity)}
          delta={equityDelta !== null ? `${equityDelta >= 0 ? '+' : ''}${equityDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={equityDelta !== null ? (equityDelta >= 0 ? 'up' : 'down') : undefined}
        />
        <DensityKPI
          label="Current Ratio"
          value={currentRatio.toFixed(2)}
          delta={currentRatio >= 1.5 ? 'Healthy' : currentRatio >= 1.0 ? 'Adequate' : 'Low'}
          deltaDirection={currentRatio >= 1.5 ? 'up' : currentRatio >= 1.0 ? 'neutral' : 'down'}
        />
      </div>

      {chartData.length > 0 && (
        <DensitySection title="Asset Composition">
          <DensityChart type="bar" data={chartData} height={160} title="Asset Sections" />
        </DensitySection>
      )}

      <DensityInsight text={insightText} />
    </div>
  );
}

function ExecutiveIncomeStatementView({ data }: { data: IncomeStatementData }) {
  const revenue = data.revenue?.total ?? 0;
  const grossProfit = data.grossProfit ?? 0;
  const operatingIncome = data.operatingIncome ?? 0;
  const netIncome = data.netIncome ?? 0;

  const pyRevenue = data.priorYear?.revenue ?? 0;
  const pyGross = data.priorYear?.grossProfit ?? 0;
  const pyOp = data.priorYear?.operatingIncome ?? 0;
  const pyNet = data.priorYear?.netIncome ?? 0;

  const revDelta = pyRevenue > 0 ? yoyPct(revenue, pyRevenue) : null;
  const grossDelta = pyGross > 0 ? yoyPct(grossProfit, pyGross) : null;
  const opDelta = pyOp !== 0 ? yoyPct(operatingIncome, pyOp) : null;
  const netDelta = pyNet !== 0 ? yoyPct(netIncome, pyNet) : null;

  const grossMarginPct = revenue > 0 ? (grossProfit / revenue) * 100 : 0;

  // Waterfall chart data
  const chartData = [
    { label: 'Revenue', value: Math.abs(revenue) },
    { label: 'Gross', value: Math.abs(grossProfit) },
    { label: 'Op Income', value: Math.abs(operatingIncome) },
    { label: 'Net Income', value: Math.abs(netIncome) },
  ];

  let insightText = `Gross margin: ${grossMarginPct.toFixed(1)}%.`;
  if (netIncome < 0) {
    insightText = `Net loss of ${fmtCompact(Math.abs(netIncome))} this period. Review operating expenses.`;
  } else if (revDelta !== null && revDelta < -5) {
    insightText = `Revenue declined ${Math.abs(revDelta).toFixed(1)}% YoY — investigate demand or pricing changes.`;
  } else if (grossMarginPct < 15) {
    insightText = `Gross margin at ${grossMarginPct.toFixed(1)}% — below typical threshold. COGS pressure may need attention.`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <DensityKPI
          label="Revenue"
          value={fmtCompact(revenue)}
          delta={revDelta !== null ? `${revDelta >= 0 ? '+' : ''}${revDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={revDelta !== null ? (revDelta >= 0 ? 'up' : 'down') : undefined}
        />
        <DensityKPI
          label="Gross Profit"
          value={fmtCompact(grossProfit)}
          delta={grossDelta !== null ? `${grossDelta >= 0 ? '+' : ''}${grossDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={grossDelta !== null ? (grossDelta >= 0 ? 'up' : 'down') : undefined}
        />
        <DensityKPI
          label="Operating Income"
          value={fmtCompact(operatingIncome)}
          delta={opDelta !== null ? `${opDelta >= 0 ? '+' : ''}${opDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={opDelta !== null ? (opDelta >= 0 ? 'up' : 'down') : undefined}
        />
        <DensityKPI
          label="Net Income"
          value={fmtCompact(netIncome)}
          delta={netDelta !== null ? `${netDelta >= 0 ? '+' : ''}${netDelta.toFixed(1)}% YoY` : undefined}
          deltaDirection={netDelta !== null ? (netIncome >= 0 ? 'up' : 'down') : undefined}
        />
      </div>

      <DensitySection title="P&L Waterfall">
        <DensityChart type="bar" data={chartData} height={140} title="Revenue to Net Income" />
      </DensitySection>

      <DensityInsight text={insightText} />
    </div>
  );
}

function ExecutiveGenericView({ title, summary }: { title: string; summary: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <DensityInsight text={`${title}: ${summary}`} />
    </div>
  );
}

// Operator ledger view for balance sheet (dense table with section headers)
function OperatorBalanceSheetLedger({ data }: { data: BalanceSheetData }) {
  type LedgerRow = Record<string, unknown>;

  const buildRows = (): LedgerRow[] => {
    const rows: LedgerRow[] = [];
    const addSection = (section: BSSection, sectionLabel: string) => {
      for (const acct of section.accounts ?? []) {
        const pyBalance = section.priorYearAmounts?.[acct.accountNumber] ?? 0;
        const variance = acct.balance - pyBalance;
        const variancePct = pyBalance !== 0 ? (variance / Math.abs(pyBalance)) * 100 : null;
        rows.push({
          section: sectionLabel.toUpperCase(),
          acct: acct.accountNumber,
          name: acct.accountName,
          balance: fmtAcct(acct.balance),
          prior: fmtAcct(pyBalance),
          variance: fmtAcct(variance),
          variancePct: variancePct !== null ? `${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%` : '--',
        });
      }
      rows.push({
        section: sectionLabel.toUpperCase(),
        acct: '',
        name: `Total ${section.title ?? section.label ?? ''}`,
        balance: fmtAcct(section.total),
        prior: fmtAcct(section.priorYearTotal ?? 0),
        variance: fmtAcct(section.total - (section.priorYearTotal ?? 0)),
        variancePct: '--',
      });
    };

    for (const s of data.assets ?? []) addSection(s, s.title ?? s.label ?? 'ASSETS');
    for (const s of data.liabilities ?? []) addSection(s, s.title ?? s.label ?? 'LIABILITIES');
    for (const s of data.equity ?? []) addSection(s, s.title ?? s.label ?? 'EQUITY');
    return rows;
  };

  const columns = [
    { key: 'acct', label: 'Acct #', align: 'left' as const },
    { key: 'name', label: 'Account Name', align: 'left' as const },
    { key: 'balance', label: 'Balance', align: 'right' as const },
    { key: 'prior', label: 'Prior Yr', align: 'right' as const },
    { key: 'variance', label: 'Variance', align: 'right' as const },
    { key: 'variancePct', label: 'YoY %', align: 'right' as const },
  ];

  return (
    <DensityTable
      columns={columns}
      data={buildRows()}
      sectionGroupBy="section"
    />
  );
}

function OperatorIncomeStatementLedger({ data }: { data: IncomeStatementData }) {
  type LedgerRow = Record<string, unknown>;

  const buildRows = (): LedgerRow[] => {
    const rows: LedgerRow[] = [];
    const addSection = (section: ISSection, sectionLabel: string) => {
      for (const acct of section.accounts ?? []) {
        const pyAmount = section.priorYearAmounts?.[acct.accountNumber] ?? 0;
        const variance = acct.amount - pyAmount;
        const variancePct = pyAmount !== 0 ? (variance / Math.abs(pyAmount)) * 100 : null;
        rows.push({
          section: sectionLabel.toUpperCase(),
          acct: acct.accountNumber,
          name: acct.accountName,
          amount: fmtAcct(acct.amount),
          prior: fmtAcct(pyAmount),
          variance: fmtAcct(variance),
          variancePct: variancePct !== null ? `${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%` : '--',
        });
      }
      rows.push({
        section: sectionLabel.toUpperCase(),
        acct: '',
        name: `Total ${section.title ?? section.label ?? ''}`,
        amount: fmtAcct(section.total),
        prior: fmtAcct(section.priorYearTotal ?? 0),
        variance: fmtAcct(section.total - (section.priorYearTotal ?? 0)),
        variancePct: '--',
      });
    };

    const emptySection: ISSection = { accounts: [], total: 0 };
    addSection(data.revenue ?? emptySection, data.revenue?.title ?? 'REVENUE');
    addSection(data.cogs ?? emptySection, data.cogs?.title ?? 'COST OF GOODS SOLD');
    addSection(data.operatingExpenses ?? emptySection, data.operatingExpenses?.title ?? 'OPERATING EXPENSES');
    if ((data.otherIncomeExpense?.accounts ?? []).length > 0) {
      addSection(data.otherIncomeExpense ?? emptySection, data.otherIncomeExpense?.title ?? 'OTHER INCOME/EXPENSE');
    }
    return rows;
  };

  const columns = [
    { key: 'acct', label: 'Acct #', align: 'left' as const },
    { key: 'name', label: 'Account Name', align: 'left' as const },
    { key: 'amount', label: 'Amount', align: 'right' as const },
    { key: 'prior', label: 'Prior Yr', align: 'right' as const },
    { key: 'variance', label: 'Variance', align: 'right' as const },
    { key: 'variancePct', label: 'YoY %', align: 'right' as const },
  ];

  return (
    <DensityTable
      columns={columns}
      data={buildRows()}
      sectionGroupBy="section"
    />
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function FinancialStatementsPage() {
  const density = useDensity();
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [activeTab, setActiveTab] = useState<TabId>('balance-sheet');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<unknown>(null);
  const [periodOpen, setPeriodOpen] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const res = await fetch(
        `/api/financial-statements?type=${activeTab}&period=${period}`
      );
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load');
        return;
      }
      setData(json.data);
    } catch {
      setError('Failed to fetch financial statement');
    } finally {
      setLoading(false);
    }
  }, [activeTab, period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileSpreadsheet className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Financial Statements</h1>
        </div>
        <div className="flex items-center gap-3">
          {/* Period selector */}
          <div className="relative">
            <button
              onClick={() => setPeriodOpen(!periodOpen)}
              className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors"
            >
              {periodLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
            {periodOpen && (
              <div className="absolute right-0 mt-0.5 w-56 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 max-h-72 overflow-y-auto">
                {periods.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => {
                      setPeriod(p.value);
                      setPeriodOpen(false);
                    }}
                    className={`block w-full text-left px-4 py-2 text-sm hover:bg-zinc-700 transition-colors ${
                      p.value === period ? 'text-orange-400 bg-zinc-700/50' : 'text-zinc-300'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 bg-zinc-800 border border-zinc-700 rounded-lg px-4 py-2 text-sm text-zinc-200 hover:bg-zinc-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          <button
            className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700 rounded-lg px-4 py-2 text-sm text-white transition-colors"
          >
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      <AIInsightsBanner module="financial-statements" compact />

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? 'border-orange-500 text-orange-400'
                : 'border-transparent text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-5 py-4">
        {/* Header line */}
        <div className="text-center mb-6">
          <div className="text-lg font-bold text-white">Delta360 Energy LLC</div>
          <div className="text-sm text-zinc-400">
            {activeTab === 'balance-sheet' && `Balance Sheet as of ${periodLabel}`}
            {activeTab === 'income-statement' && `Income Statement for ${periodLabel}`}
            {activeTab === 'trial-balance' && `Trial Balance for ${periodLabel}`}
            {activeTab === 'flash' && `Flash Report for ${periodLabel}`}
            {activeTab === 'cash-flow-statement' && `Cash Flow Statement for ${periodLabel}`}
            {activeTab === 'variance' && `Ascend Variance Report for ${periodLabel}`}
          </div>
        </div>

        {loading && (
          <div className="space-y-3">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-6 w-3/4" />
            <Skeleton className="h-6 w-5/6" />
            <Skeleton className="h-6 w-2/3" />
            <Skeleton className="h-6 w-4/5" />
            <Skeleton className="h-8 w-full" />
          </div>
        )}

        {error !== null ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {String(error)}
          </div>
        ) : null}

        {!loading && !error && data !== null ? (
          <>
            {density === 'executive' ? (
              <>
                {activeTab === 'balance-sheet' && (
                  <ExecutiveBalanceSheetView data={data as BalanceSheetData} />
                )}
                {activeTab === 'income-statement' && (
                  <ExecutiveIncomeStatementView data={data as IncomeStatementData} />
                )}
                {activeTab === 'trial-balance' && (
                  <ExecutiveGenericView
                    title="Trial Balance"
                    summary={`${((data as TrialBalanceData).accounts ?? []).length} accounts. Total debits: ${fmtCompact((data as TrialBalanceData).totalDebit ?? 0)}.`}
                  />
                )}
                {activeTab === 'flash' && <FlashReportView data={data as FlashReportData} />}
                {activeTab === 'cash-flow-statement' && (
                  <ExecutiveGenericView
                    title="Cash Flow"
                    summary={`Ending cash: ${fmtCompact((data as CashFlowData).endingCash ?? 0)}. Net change: ${fmtCompact((data as CashFlowData).netChange ?? 0)}.`}
                  />
                )}
                {activeTab === 'variance' && (
                  <ExecutiveGenericView
                    title="Ascend Variance"
                    summary={`IS variance: ${fmtCompact((data as VarianceData).incomeStatement?.totalVariance ?? 0)}. BS variance: ${fmtCompact((data as VarianceData).balanceSheet?.totalVariance ?? 0)}.`}
                  />
                )}
              </>
            ) : (
              <>
                {activeTab === 'balance-sheet' && (
                  <>
                    <OperatorBalanceSheetLedger data={data as BalanceSheetData} />
                    <div className="mt-4 border-t border-zinc-700 pt-3 flex justify-between font-mono text-sm font-bold text-white">
                      <span>Total Assets</span>
                      <span>{fmtAcct((data as BalanceSheetData).totalAssets ?? 0)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-sm font-semibold text-zinc-200 mt-1">
                      <span>Total Liabilities</span>
                      <span>{fmtAcct((data as BalanceSheetData).totalLiabilities ?? 0)}</span>
                    </div>
                    <div className="flex justify-between font-mono text-sm font-semibold text-zinc-200 mt-1">
                      <span>Total Equity</span>
                      <span>{fmtAcct((data as BalanceSheetData).totalEquity ?? 0)}</span>
                    </div>
                  </>
                )}
                {activeTab === 'income-statement' && (
                  <>
                    <OperatorIncomeStatementLedger data={data as IncomeStatementData} />
                    <div className="mt-4 border-t border-zinc-700 pt-3 flex justify-between font-mono text-sm font-bold text-white">
                      <span>Net Income</span>
                      <span className={(data as IncomeStatementData).netIncome >= 0 ? 'text-green-400' : 'text-red-400'}>
                        {fmtAcct((data as IncomeStatementData).netIncome ?? 0)}
                      </span>
                    </div>
                  </>
                )}
                {activeTab === 'trial-balance' && <TrialBalanceView data={data as TrialBalanceData} />}
                {activeTab === 'flash' && <FlashReportView data={data as FlashReportData} />}
                {activeTab === 'cash-flow-statement' && <CashFlowView data={data as CashFlowData} />}
                {activeTab === 'variance' && <VarianceView data={data as VarianceData} />}
              </>
            )}
          </>
        ) : null}

        {!loading && !error && !data && (
          <div className="text-center text-zinc-500 py-12">
            No data available for this period. Post journal entries to the GL to generate statements.
          </div>
        )}
      </div>
    </div>
  );
}
