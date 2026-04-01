'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  DollarSign,
  Building2,
  Landmark,
  Receipt,
  CreditCard,
  RefreshCw,
  FileSpreadsheet,
  Fuel,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Types ─────────────────────────────────────────────────────

interface TaxProvision {
  id: string;
  period: string;
  federalTaxable: number;
  stateTaxable: number;
  federalRate: number;
  stateRate: number;
  federalTax: number;
  stateTax: number;
  totalProvision: number;
  estimatedPayments: number;
  netDue: number;
  preparedBy: string;
  status: 'draft' | 'review' | 'final';
  createdAt: string;
  updatedAt: string;
}

interface FuelTaxReturn {
  id: string;
  period: string;
  state: string;
  gallonsDelivered: number;
  taxRate: number;
  taxDue: number;
  exemptGallons: number;
  netTax: number;
}

interface TaxCollectedSummary {
  year: number;
  totalCollected: number;
  byType: Array<{ type: string; amount: number }>;
}

interface TaxJE {
  id: string;
  period: string;
  description: string;
  lines: Array<{ account: string; accountName: string; debit: number; credit: number }>;
  createdAt: string;
}

// ── Helpers ───────────────────────────────────────────────────

function fmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function pctFmt(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '0%';
  return `${(n * 100).toFixed(1)}%`;
}

function currentPeriod(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

// ── Component ─────────────────────────────────────────────────

export default function TaxPage() {
  const [period, setPeriod] = useState(currentPeriod());
  const [provision, setProvision] = useState<TaxProvision | null>(null);
  const [fuelTax, setFuelTax] = useState<FuelTaxReturn[]>([]);
  const [collected, setCollected] = useState<TaxCollectedSummary | null>(null);
  const [taxJE, setTaxJE] = useState<TaxJE | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [generatingJE, setGeneratingJE] = useState(false);
  const [showJE, setShowJE] = useState(false);
  const [pretaxIncome, setPretaxIncome] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [provResp, fuelResp, collResp] = await Promise.all([
        fetch(`/api/tax?period=${period}`),
        fetch(`/api/tax?type=fuel&period=${period}`),
        fetch(`/api/tax?type=collected&year=${period.slice(0, 4)}`),
      ]);

      if (provResp.ok) {
        const data = await provResp.json();
        setProvision(data.provision ?? null);
      } else {
        setProvision(null);
      }

      if (fuelResp.ok) {
        const data = await fuelResp.json();
        setFuelTax(data.fuelTax ?? []);
      }

      if (collResp.ok) {
        const data = await collResp.json();
        setCollected(data.collected ?? null);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load tax data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const handleCalculate = async () => {
    setCalculating(true);
    setError(null);
    try {
      const body: Record<string, unknown> = { period };
      if (pretaxIncome) body.pretaxIncome = parseFloat(pretaxIncome);

      const resp = await fetch('/api/tax', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const data = await resp.json();
        throw new Error(data.error ?? 'Calculation failed');
      }

      await fetchData();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Calculation failed');
    } finally {
      setCalculating(false);
    }
  };

  const handleGenerateJE = async () => {
    setGeneratingJE(true);
    try {
      const resp = await fetch(`/api/tax?type=je&period=${period}`);
      if (resp.ok) {
        const data = await resp.json();
        setTaxJE(data.journalEntry ?? null);
        setShowJE(true);
      }
    } catch {
      // silent
    } finally {
      setGeneratingJE(false);
    }
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-white">Tax Management</h1>
          <p className="text-sm text-zinc-400 mt-0.5">
            Federal &amp; state provisions, fuel tax, and estimated payments
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm"
          />
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white px-3 py-2 text-sm transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <AIInsightsBanner module="tax" compact />

      {error && (
        <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Calculate Provision */}
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3.5">
        <h2 className="text-xs font-semibold text-zinc-300 mb-2">Calculate Provision</h2>
        <div className="flex items-end gap-3">
          <div>
            <label className="block text-xs text-zinc-500 mb-1">Pretax Income (optional)</label>
            <input
              type="number"
              value={pretaxIncome}
              onChange={(e) => setPretaxIncome(e.target.value)}
              placeholder="Pulls from Ascend GL if blank"
              className="rounded-lg bg-zinc-800 border border-zinc-700 text-white px-3 py-2 text-sm w-64"
            />
          </div>
          <button
            onClick={() => void handleCalculate()}
            disabled={calculating}
            className="flex items-center gap-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
          >
            {calculating ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <DollarSign className="h-4 w-4" />
            )}
            Calculate
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {provision && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <SummaryCard
            icon={Landmark}
            label="Federal Provision"
            value={fmt(provision.federalTax)}
            sub={pctFmt(provision.federalRate)}
            color="blue"
          />
          <SummaryCard
            icon={Building2}
            label="State Provision"
            value={fmt(provision.stateTax)}
            sub={pctFmt(provision.stateRate)}
            color="purple"
          />
          <SummaryCard
            icon={DollarSign}
            label="Total Provision"
            value={fmt(provision.totalProvision)}
            sub={`Period: ${provision.period}`}
            color="orange"
          />
          <SummaryCard
            icon={CreditCard}
            label="Estimated Payments"
            value={fmt(provision.estimatedPayments)}
            sub="YTD"
            color="green"
          />
          <SummaryCard
            icon={Receipt}
            label="Net Due"
            value={fmt(provision.netDue)}
            sub={provision.netDue > 0 ? 'Payment needed' : 'Overpaid'}
            color={provision.netDue > 0 ? 'red' : 'green'}
          />
        </div>
      )}

      {/* Generate Tax JE */}
      {provision && (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3.5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-xs font-semibold text-zinc-300">Tax Journal Entry</h2>
            <button
              onClick={() => void handleGenerateJE()}
              disabled={generatingJE}
              className="flex items-center gap-2 rounded-lg bg-zinc-800 border border-zinc-700 text-zinc-300 hover:text-white px-3 py-2 text-sm transition-colors"
            >
              <FileSpreadsheet className="h-4 w-4" />
              {generatingJE ? 'Generating...' : 'Generate Tax JE'}
            </button>
          </div>

          {showJE && taxJE && (
            <div className="mt-3">
              <p className="text-xs text-zinc-500 mb-2">{taxJE.description}</p>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800">
                    <th className="text-left py-2 text-zinc-500 font-medium">Account</th>
                    <th className="text-left py-2 text-zinc-500 font-medium">Name</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">Debit</th>
                    <th className="text-right py-2 text-zinc-500 font-medium">Credit</th>
                  </tr>
                </thead>
                <tbody>
                  {(taxJE.lines ?? []).map((line, i) => (
                    <tr key={i} className="border-b border-zinc-800/50">
                      <td className="py-2 text-zinc-300 font-mono text-xs">{line.account}</td>
                      <td className="py-2 text-zinc-300">{line.accountName}</td>
                      <td className="py-2 text-right text-zinc-300">
                        {line.debit > 0 ? fmt(line.debit) : ''}
                      </td>
                      <td className="py-2 text-right text-zinc-300">
                        {line.credit > 0 ? fmt(line.credit) : ''}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Fuel Tax by State */}
      <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3.5">
        <div className="flex items-center gap-2 mb-2.5">
          <Fuel className="h-5 w-5 text-orange-500" />
          <h2 className="text-xs font-semibold text-zinc-300">Fuel Tax by State</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800">
                <th className="text-left py-2 text-zinc-500 font-medium">State</th>
                <th className="text-right py-2 text-zinc-500 font-medium">Gallons Delivered</th>
                <th className="text-right py-2 text-zinc-500 font-medium">Tax Rate</th>
                <th className="text-right py-2 text-zinc-500 font-medium">Tax Due</th>
                <th className="text-right py-2 text-zinc-500 font-medium">Exempt Gallons</th>
                <th className="text-right py-2 text-zinc-500 font-medium">Net Tax</th>
              </tr>
            </thead>
            <tbody>
              {(fuelTax ?? []).length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-4 text-center text-zinc-600">
                    No fuel tax data for this period
                  </td>
                </tr>
              ) : (
                (fuelTax ?? []).map((ft) => (
                  <tr key={ft.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                    <td className="py-2 text-zinc-300 font-medium">{ft.state}</td>
                    <td className="py-2 text-right text-zinc-300">
                      {typeof ft.gallonsDelivered === 'number' ? ft.gallonsDelivered.toLocaleString() : '0'}
                    </td>
                    <td className="py-2 text-right text-zinc-300 font-mono text-xs">
                      {typeof ft.taxRate === 'number' ? ft.taxRate.toFixed(4) : '0'}
                    </td>
                    <td className="py-2 text-right text-zinc-300">{fmt(ft.taxDue)}</td>
                    <td className="py-2 text-right text-zinc-400">
                      {typeof ft.exemptGallons === 'number' ? ft.exemptGallons.toLocaleString() : '0'}
                    </td>
                    <td className="py-2 text-right text-white font-medium">{fmt(ft.netTax)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tax Collected */}
      {collected && (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-3.5">
          <h2 className="text-xs font-semibold text-zinc-300 mb-2">
            Tax Collected — {collected.year}
          </h2>
          <p className="text-lg font-bold text-white mb-2">{fmt(collected.totalCollected)}</p>
          {(collected.byType ?? []).length > 0 && (
            <div className="space-y-2">
              {(collected.byType ?? []).map((t, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-zinc-400">{t.type}</span>
                  <span className="text-zinc-300">{fmt(t.amount)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* All Provisions History */}
      {!loading && !provision && (
        <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-8 text-center">
          <DollarSign className="h-12 w-12 text-zinc-700 mx-auto mb-2" />
          <p className="text-zinc-400 text-sm">
            No provision calculated for {period}. Enter pretax income above and click Calculate.
          </p>
        </div>
      )}
    </div>
  );
}

// ── Summary Card ──────────────────────────────────────────────

function SummaryCard({
  icon: Icon,
  label,
  value,
  sub,
  color,
}: {
  icon: typeof DollarSign;
  label: string;
  value: string;
  sub: string;
  color: string;
}) {
  const colorMap: Record<string, string> = {
    blue: 'text-blue-400',
    purple: 'text-purple-400',
    orange: 'text-orange-400',
    green: 'text-green-400',
    red: 'text-red-400',
  };

  return (
    <div className="rounded-lg bg-zinc-900 border border-zinc-800 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`h-4 w-4 ${colorMap[color] ?? 'text-zinc-400'}`} />
        <span className="text-xs text-zinc-500">{label}</span>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-xs text-zinc-500 mt-0.5">{sub}</p>
    </div>
  );
}
