'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  FileText,
  Sparkles,
  CheckCircle2,
  XCircle,
  Clock,
  RefreshCw,
  Edit3,
  TrendingUp,
  TrendingDown,
  Minus,
  Loader2,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

interface Commentary {
  id: string;
  packageId: string | null;
  period: string;
  accountNumber: string;
  accountName: string;
  varianceType: string;
  varianceAmount: number;
  variancePct: number;
  draftText: string;
  finalText: string | null;
  draftedBy: string;
  reviewedBy: string | null;
  approvedBy: string | null;
  status: string;
  aiGenerated: boolean;
  createdAt: string;
  updatedAt: string;
}

interface CommentarySummary {
  totalAccounts: number;
  drafted: number;
  inReview: number;
  approved: number;
  remaining: number;
  aiGenerated: number;
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

function varianceIcon(type: string) {
  if (type === 'favorable') return <TrendingUp size={14} className="text-green-400" />;
  if (type === 'unfavorable') return <TrendingDown size={14} className="text-red-400" />;
  return <Minus size={14} className="text-zinc-500" />;
}

function varianceColor(type: string): string {
  if (type === 'favorable') return 'text-green-400';
  if (type === 'unfavorable') return 'text-red-400';
  return 'text-zinc-500';
}

function statusBadge(status: string): string {
  switch (status) {
    case 'draft': return 'text-zinc-400 bg-zinc-800';
    case 'review': return 'text-yellow-400 bg-yellow-900/30';
    case 'approved': return 'text-green-400 bg-green-900/30';
    default: return 'text-zinc-400 bg-zinc-800';
  }
}

// ── Component ─────────────────────────────────────────────────

export default function CommentaryPage() {
  const [items, setItems] = useState<Commentary[]>([]);
  const [summary, setSummary] = useState<CommentarySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [period, setPeriod] = useState(() => new Date().toISOString().slice(0, 7));
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes] = await Promise.all([
        fetch(`/api/commentary?period=${period}`),
        fetch(`/api/commentary?period=${period}&summary=true`),
      ]);
      const itemsData = await itemsRes.json();
      const summaryData = await summaryRes.json();
      setItems(itemsData.data ?? []);
      setSummary(summaryData.data ?? null);
    } catch {
      setItems([]);
      setSummary(null);
    }
    setLoading(false);
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleGenerateAll = async () => {
    setGenerating(true);
    try {
      await fetch(`/api/commentary?period=${period}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: 5000 }),
      });
      await fetchData();
    } catch {
      // silent
    }
    setGenerating(false);
  };

  const handleAction = async (id: string, action: string, text?: string) => {
    try {
      await fetch('/api/commentary', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action, text }),
      });
      setEditingId(null);
      setEditText('');
      fetchData();
    } catch {
      // silent
    }
  };

  const startEdit = (item: Commentary) => {
    setEditingId(item.id);
    setEditText(item.draftText);
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-lg font-bold">Commentary Manager</h1>
          <p className="text-sm text-zinc-500 mt-0.5">AI-assisted variance commentary for close packages</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="month"
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="bg-[#18181B] border border-zinc-700 rounded-lg px-3 py-2 text-sm text-zinc-300"
          />
          <button onClick={fetchData} className="p-2 rounded-lg border border-zinc-700 hover:border-zinc-600 transition-colors">
            <RefreshCw size={16} className="text-zinc-400" />
          </button>
          <button
            onClick={handleGenerateAll}
            disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#FE5000] text-white text-sm font-medium hover:bg-[#CC4000] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
            Generate All Drafts
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-6">
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Total Accounts</div>
          <div className="text-lg font-bold text-white">{summary?.totalAccounts ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Drafted</div>
          <div className="text-lg font-bold text-zinc-400">{summary?.drafted ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">In Review</div>
          <div className="text-lg font-bold text-yellow-400">{summary?.inReview ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Approved</div>
          <div className="text-lg font-bold text-green-400">{summary?.approved ?? 0}</div>
        </div>
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg p-4">
          <div className="text-zinc-500 text-xs mb-1">Remaining</div>
          <div className="text-lg font-bold text-[#FE5000]">{summary?.remaining ?? 0}</div>
        </div>
      </div>

      {/* Commentary table */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw size={20} className="animate-spin text-zinc-500" />
        </div>
      ) : (items ?? []).length === 0 ? (
        <div className="text-center py-20 text-zinc-600">
          <FileText size={40} className="mx-auto mb-2 opacity-50" />
          <p>No commentary for {period}</p>
          <p className="text-xs mt-0.5">Click &quot;Generate All Drafts&quot; to create AI-powered commentary</p>
        </div>
      ) : (
        <div className="bg-[#18181B] border border-zinc-800 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500 text-xs">
                <th className="text-left px-3 py-2">Account</th>
                <th className="text-right px-3 py-2">Variance</th>
                <th className="text-right px-3 py-2">Var %</th>
                <th className="text-left px-3 py-2">Commentary</th>
                <th className="text-left px-3 py-2">Status</th>
                <th className="text-right px-3 py-2">Actions</th>
              </tr>
            </thead>
            <tbody>
              {(items ?? []).map((item) => (
                <tr key={item.id} className={`border-b border-zinc-800/50 hover:bg-zinc-800/30 transition-colors ${Math.abs(item.varianceAmount) >= 5000 ? 'border-l-2 border-l-[#FE5000]' : ''}`}>
                  <td className="px-3 py-2">
                    <div className="font-mono text-xs text-zinc-500">{item.accountNumber}</div>
                    <div className="text-sm">{item.accountName}</div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {varianceIcon(item.varianceType)}
                      <span className={`font-mono ${varianceColor(item.varianceType)}`}>
                        {fmtAmount(item.varianceAmount)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <span className={`font-mono text-xs ${varianceColor(item.varianceType)}`}>
                      {item.variancePct >= 0 ? '+' : ''}{typeof item.variancePct === 'number' ? item.variancePct.toFixed(1) : '0.0'}%
                    </span>
                  </td>
                  <td className="px-3 py-2 max-w-md">
                    {editingId === item.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={3}
                          className="w-full bg-zinc-900 border border-zinc-700 rounded-lg px-3 py-2 text-xs text-white resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAction(item.id, 'update', editText)}
                            className="px-2 py-1 text-xs bg-[#FE5000] text-white rounded hover:bg-[#CC4000]"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => { setEditingId(null); setEditText(''); }}
                            className="px-2 py-1 text-xs text-zinc-400 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2">
                        <p className="text-xs text-zinc-300 line-clamp-3">
                          {item.finalText ?? item.draftText}
                        </p>
                        {item.aiGenerated && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium text-purple-400 bg-purple-900/30">
                            <Sparkles size={8} /> AI
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadge(item.status)}`}>
                      {item.status === 'draft' && <Clock size={10} />}
                      {item.status === 'review' && <Edit3 size={10} />}
                      {item.status === 'approved' && <CheckCircle2 size={10} />}
                      {item.status}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex items-center justify-end gap-1">
                      {item.status !== 'approved' && editingId !== item.id && (
                        <button
                          onClick={() => startEdit(item)}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-zinc-400 hover:text-white hover:bg-zinc-800 rounded transition-colors"
                        >
                          <Edit3 size={12} />
                        </button>
                      )}
                      {item.status !== 'approved' && (
                        <button
                          onClick={() => handleAction(item.id, 'approve')}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-green-400 hover:bg-green-900/20 rounded transition-colors"
                        >
                          <CheckCircle2 size={12} />
                        </button>
                      )}
                      {item.status === 'review' && (
                        <button
                          onClick={() => handleAction(item.id, 'reject')}
                          className="flex items-center gap-1 px-2 py-1 text-xs text-red-400 hover:bg-red-900/20 rounded transition-colors"
                        >
                          <XCircle size={12} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
