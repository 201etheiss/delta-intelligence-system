'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  Package,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Loader2,
  RefreshCw,
  FileSpreadsheet,
  TrendingUp,
  Clock,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface IntegrityIssue {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
}

interface FinancialPackage {
  id: string;
  period: string;
  status: string;
  components: {
    balanceSheet: string;
    incomeStatement: string;
    trialBalance: string;
    flashReport: string;
  };
  integrityScore: number;
  issues: IntegrityIssue[];
  generatedAt: string;
  flash: {
    revenue: number;
    cogs: number;
    grossProfit: number;
    netIncome: number;
  } | null;
}

// ── Helpers ───────────────────────────────────────────────────

function fmtAmount(n: number): string {
  if (typeof n !== 'number' || Number.isNaN(n)) return '$0';
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function scoreColor(score: number): string {
  if (score > 80) return 'text-green-400';
  if (score >= 50) return 'text-yellow-400';
  return 'text-red-400';
}

function scoreBgColor(score: number): string {
  if (score > 80) return 'bg-green-900/30 border-green-800';
  if (score >= 50) return 'bg-yellow-900/30 border-yellow-800';
  return 'bg-red-900/30 border-red-800';
}

function severityIcon(severity: string) {
  if (severity === 'critical') return <XCircle size={14} className="text-red-400 shrink-0" />;
  if (severity === 'warning') return <AlertTriangle size={14} className="text-yellow-400 shrink-0" />;
  return <Info size={14} className="text-blue-400 shrink-0" />;
}

function severityBadge(severity: string): string {
  if (severity === 'critical') return 'text-red-400 bg-red-900/30';
  if (severity === 'warning') return 'text-yellow-400 bg-yellow-900/30';
  return 'text-blue-400 bg-blue-900/30';
}

function componentStatus(status: string) {
  if (status === 'generated') {
    return <CheckCircle2 size={14} className="text-green-400" />;
  }
  return <XCircle size={14} className="text-red-400" />;
}

const STORAGE_KEY = 'di_package_history';

function loadHistory(): FinancialPackage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as FinancialPackage[]) : [];
  } catch {
    return [];
  }
}

function saveHistory(packages: FinancialPackage[]) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(packages.slice(0, 50)));
}

// ── Component ─────────────────────────────────────────────────

export default function PackagesPage() {
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [generating, setGenerating] = useState(false);
  const [current, setCurrent] = useState<FinancialPackage | null>(null);
  const [history, setHistory] = useState<FinancialPackage[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setHistory(loadHistory());
  }, []);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setCurrent(null);
    setError(null);
    try {
      const res = await fetch('/api/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        const pkg = json.data as FinancialPackage;
        setCurrent(pkg);
        setHistory((prev) => {
          const updated = [pkg, ...prev.filter((p) => p.id !== pkg.id)];
          saveHistory(updated);
          return updated;
        });
      }
    } catch {
      setError('Failed to generate financial package');
    }
    setGenerating(false);
  }, [period]);

  const tieoutChecks = current
    ? [
        {
          label: 'Balance Sheet balances',
          pass: !(current.issues ?? []).some((i) => i.type === 'BS_IMBALANCE'),
        },
        {
          label: 'Trial Balance balances',
          pass: !(current.issues ?? []).some((i) => i.type === 'TB_IMBALANCE'),
        },
        {
          label: 'IS to BS tie-out verified',
          pass: (current.issues ?? []).some((i) => i.type === 'IS_BS_TIEOUT'),
        },
        {
          label: 'Commentary complete',
          pass: false, // placeholder until commentary integration
        },
      ]
    : [];

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">Financial Package Production</h1>
          <p className="text-sm text-zinc-500 mt-0.5">
            Generate and validate close packages with integrity checks
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#18181B] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          />
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FE5000] text-white text-sm font-medium hover:bg-[#CC4000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <Loader2 size={16} className="animate-spin" />
            ) : (
              <Package size={16} />
            )}
            Generate Package
          </button>
        </div>
      </div>

      {/* Current package results */}
      {generating && (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={28} className="animate-spin text-[#FE5000]" />
            <p className="text-sm text-zinc-500">
              Generating financial package for {period}...
            </p>
          </div>
        </div>
      )}

      {error && !generating && (
        <div className="rounded-lg bg-red-900/20 border border-red-800 p-4 text-red-400 text-sm">
          {error}
        </div>
      )}

      {current && !generating && (
        <div className="space-y-4">
          {/* Status + Score row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Package status */}
            <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-3.5">
              <div className="text-zinc-500 text-xs mb-2">Package Status</div>
              <div className="flex items-center gap-2">
                {current.status === 'ready' ? (
                  <CheckCircle2 size={20} className="text-green-400" />
                ) : (
                  <XCircle size={20} className="text-red-400" />
                )}
                <span
                  className={`text-lg font-bold uppercase ${
                    current.status === 'ready' ? 'text-green-400' : 'text-red-400'
                  }`}
                >
                  {current.status}
                </span>
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                {new Date(current.generatedAt).toLocaleString()}
              </div>
            </div>

            {/* Integrity score */}
            <div
              className={`border rounded-lg p-3.5 ${scoreBgColor(current.integrityScore)}`}
            >
              <div className="text-zinc-500 text-xs mb-2">Integrity Score</div>
              <div className={`text-3xl font-bold ${scoreColor(current.integrityScore)}`}>
                {current.integrityScore}
              </div>
              <div className="text-[10px] text-zinc-500 mt-0.5">out of 100</div>
            </div>

            {/* Flash summary */}
            {current.flash && (
              <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-3.5">
                <div className="text-zinc-500 text-xs mb-2">Flash Summary</div>
                <div className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">Revenue</span>
                    <span className="text-white font-mono">
                      {fmtAmount(current.flash.revenue)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-500">COGS</span>
                    <span className="text-white font-mono">
                      {fmtAmount(current.flash.cogs)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs border-t border-zinc-800 pt-1">
                    <span className="text-zinc-400">Gross Profit</span>
                    <span className="text-green-400 font-mono font-medium">
                      {fmtAmount(current.flash.grossProfit)}
                    </span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-zinc-400">Net Income</span>
                    <span
                      className={`font-mono font-medium ${
                        current.flash.netIncome >= 0 ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {fmtAmount(current.flash.netIncome)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Components grid */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 mb-2">Components</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {(
                [
                  ['Balance Sheet', current.components.balanceSheet],
                  ['Income Statement', current.components.incomeStatement],
                  ['Trial Balance', current.components.trialBalance],
                  ['Flash Report', current.components.flashReport],
                ] as const
              ).map(([name, status]) => (
                <div
                  key={name}
                  className="bg-[#18181B] border border-zinc-800 rounded-lg p-3 flex items-center gap-2"
                >
                  {componentStatus(status)}
                  <div>
                    <div className="text-xs font-medium">{name}</div>
                    <div
                      className={`text-[10px] ${
                        status === 'generated' ? 'text-green-400' : 'text-red-400'
                      }`}
                    >
                      {status}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Issues list */}
          {(current.issues ?? []).length > 0 && (
            <div>
              <h2 className="text-xs font-semibold text-zinc-400 mb-2">Issues</h2>
              <div className="space-y-2">
                {(current.issues ?? []).map((issue, idx) => (
                  <div
                    key={`${issue.type}-${idx}`}
                    className="bg-[#18181B] border border-zinc-800 rounded-lg px-3 py-2 flex items-start gap-3"
                  >
                    {severityIcon(issue.severity)}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-mono text-zinc-500">
                          {issue.type}
                        </span>
                        <span
                          className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium ${severityBadge(issue.severity)}`}
                        >
                          {issue.severity}
                        </span>
                      </div>
                      <p className="text-xs text-zinc-300 mt-0.5">{issue.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tie-out checklist */}
          <div>
            <h2 className="text-xs font-semibold text-zinc-400 mb-2">Tie-Out Checklist</h2>
            <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4 space-y-2">
              {tieoutChecks.map((check) => (
                <div key={check.label} className="flex items-center gap-2">
                  {check.pass ? (
                    <CheckCircle2 size={14} className="text-green-400" />
                  ) : (
                    <XCircle size={14} className="text-zinc-600" />
                  )}
                  <span
                    className={`text-xs ${
                      check.pass ? 'text-zinc-300' : 'text-zinc-600'
                    }`}
                  >
                    {check.label}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Empty state */}
      {!current && !generating && (
        <div className="text-center py-20 text-zinc-600">
          <FileSpreadsheet size={40} className="mx-auto mb-2 opacity-50" />
          <p>No package generated yet</p>
          <p className="text-xs mt-0.5">
            Select a period and click &quot;Generate Package&quot; to create a financial close
            package
          </p>
        </div>
      )}

      {/* Package history */}
      {(history ?? []).length > 0 && (
        <div className="mt-8">
          <h2 className="text-xs font-semibold text-zinc-400 mb-2">Package History</h2>
          <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                  <th className="text-left px-3 py-2">Period</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Score</th>
                  <th className="text-right px-3 py-2">Issues</th>
                  <th className="text-right px-3 py-2">Generated</th>
                </tr>
              </thead>
              <tbody>
                {(history ?? []).map((pkg) => (
                  <tr
                    key={pkg.id}
                    className="border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors cursor-pointer"
                    onClick={() => setCurrent(pkg)}
                  >
                    <td className="px-3 py-2 font-mono text-xs">{pkg.period}</td>
                    <td className="px-3 py-2">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${
                          pkg.status === 'ready'
                            ? 'text-green-400 bg-green-900/30'
                            : 'text-red-400 bg-red-900/30'
                        }`}
                      >
                        {pkg.status === 'ready' ? (
                          <CheckCircle2 size={10} />
                        ) : (
                          <XCircle size={10} />
                        )}
                        {pkg.status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className={`font-mono font-bold ${scoreColor(pkg.integrityScore)}`}>
                        {pkg.integrityScore}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right">
                      <span className="text-xs text-zinc-500">
                        {(pkg.issues ?? []).filter((i) => i.severity === 'critical').length > 0 && (
                          <span className="text-red-400 mr-1">
                            {(pkg.issues ?? []).filter((i) => i.severity === 'critical').length}C
                          </span>
                        )}
                        {(pkg.issues ?? []).filter((i) => i.severity === 'warning').length > 0 && (
                          <span className="text-yellow-400 mr-1">
                            {(pkg.issues ?? []).filter((i) => i.severity === 'warning').length}W
                          </span>
                        )}
                        {(pkg.issues ?? []).filter((i) => i.severity === 'info').length > 0 && (
                          <span className="text-blue-400">
                            {(pkg.issues ?? []).filter((i) => i.severity === 'info').length}I
                          </span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right text-xs text-zinc-500">
                      {new Date(pkg.generatedAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
