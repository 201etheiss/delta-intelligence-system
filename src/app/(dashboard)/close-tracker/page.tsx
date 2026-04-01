'use client';

import { useState, useEffect, useCallback } from 'react';
import {
  CheckSquare,
  RefreshCw,
  ChevronDown,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Circle,
  Loader2,
  ArrowRight,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CloseItemStatus = 'pending' | 'in_progress' | 'completed' | 'blocked';
type CloseStatus = 'open' | 'in_progress' | 'completed';

interface CloseItem {
  id: string;
  task: string;
  day: number;
  owner: string;
  status: CloseItemStatus;
  dependency: string | null;
  completedAt: string | null;
  completedBy: string | null;
  notes: string;
  evidence: string | null;
}

interface CloseChecklist {
  id: string;
  period: string;
  status: CloseStatus;
  items: CloseItem[];
  createdAt: string;
  completedAt: string | null;
  targetDay: number;
}

interface DayProgress {
  day: number;
  totalItems: number;
  completed: number;
  percentComplete: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getPeriodOptions(): { value: string; label: string }[] {
  const options: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    const label = d.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
    options.push({ value, label });
  }
  return options;
}

function statusIcon(status: CloseItemStatus) {
  switch (status) {
    case 'completed':
      return <CheckCircle2 className="w-4 h-4 text-green-400" />;
    case 'in_progress':
      return <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />;
    case 'blocked':
      return <AlertTriangle className="w-4 h-4 text-red-400" />;
    default:
      return <Circle className="w-4 h-4 text-zinc-600" />;
  }
}

function statusBadgeClass(status: CloseItemStatus): string {
  switch (status) {
    case 'completed':
      return 'text-green-400 bg-green-900/30';
    case 'in_progress':
      return 'text-blue-400 bg-blue-900/30';
    case 'blocked':
      return 'text-red-400 bg-red-900/30';
    default:
      return 'text-zinc-400 bg-zinc-800';
  }
}

function statusLabel(status: CloseItemStatus): string {
  switch (status) {
    case 'completed': return 'Complete';
    case 'in_progress': return 'In Progress';
    case 'blocked': return 'Blocked';
    default: return 'Not Started';
  }
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Skeleton({ className }: { className?: string }) {
  return <div className={`rounded bg-[#27272A] animate-pulse ${className ?? ''}`} />;
}

function DayTimeline({ dayProgress, targetDay }: { dayProgress: DayProgress[]; targetDay: number }) {
  const days = Array.from({ length: targetDay }, (_, i) => i + 1);

  return (
    <div className="flex items-stretch gap-2 mb-6">
      {days.map((day) => {
        const dp = (dayProgress ?? []).find((d) => d.day === day);
        const total = dp?.totalItems ?? 0;
        const completed = dp?.completed ?? 0;
        const pct = dp?.percentComplete ?? 0;
        const isFullyDone = total > 0 && pct === 100;

        return (
          <div key={day} className="flex-1">
            <div
              className={`border rounded-lg p-3 text-center transition-colors ${
                isFullyDone
                  ? 'border-green-600 bg-green-900/20'
                  : total > 0 && completed > 0
                    ? 'border-blue-600 bg-blue-900/10'
                    : 'border-zinc-700 bg-zinc-900'
              }`}
            >
              <div className="text-xs text-zinc-400 mb-1">Day {day}</div>
              <div className="text-lg font-bold text-white">{total}</div>
              <div className="text-[10px] text-zinc-500">tasks</div>
              {total > 0 && (
                <>
                  <div className="h-1.5 bg-zinc-800 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full ${isFullyDone ? 'bg-green-500' : 'bg-orange-500'}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <div className="text-[10px] mt-0.5 font-mono">
                    <span className={isFullyDone ? 'text-green-400' : 'text-zinc-400'}>
                      {typeof pct === 'number' ? pct.toFixed(0) : '0'}%
                    </span>
                  </div>
                </>
              )}
            </div>
            {day < targetDay && (
              <div className="flex justify-center py-1">
                <ArrowRight className="w-3 h-3 text-zinc-700" />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function CloseTrackerPage() {
  const periods = getPeriodOptions();
  const [period, setPeriod] = useState(periods[0]?.value ?? '2026-03');
  const [periodOpen, setPeriodOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [checklist, setChecklist] = useState<CloseChecklist | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/close?status=`);
      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? 'Failed to load');
        return;
      }
      // Find the checklist matching the selected period
      const all: CloseChecklist[] = json.data ?? [];
      const match = all.find((c) => c.period === period) ?? null;
      setChecklist(match);
    } catch {
      setError('Failed to fetch close data');
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Compute progress
  const items = checklist?.items ?? [];
  const totalItems = items.length;
  const completedCount = items.filter((i) => i.status === 'completed').length;
  const blockedCount = items.filter((i) => i.status === 'blocked').length;
  const inProgressCount = items.filter((i) => i.status === 'in_progress').length;
  const overallPct = totalItems > 0 ? Math.round((completedCount / totalItems) * 100) : 0;

  // Day progress
  const dayNumbers = Array.from(new Set(items.map((i) => i.day))).sort((a, b) => a - b);
  const dayProgress: DayProgress[] = dayNumbers.map((day) => {
    const dayItems = items.filter((i) => i.day === day);
    const dayCompleted = dayItems.filter((i) => i.status === 'completed').length;
    return {
      day,
      totalItems: dayItems.length,
      completed: dayCompleted,
      percentComplete: dayItems.length > 0 ? Math.round((dayCompleted / dayItems.length) * 100) : 0,
    };
  });

  // Days remaining (from current date to target day of the close month)
  const targetDay = checklist?.targetDay ?? 5;
  const now = new Date();
  const periodDate = period ? new Date(`${period}-01`) : now;
  const closeDeadline = new Date(periodDate.getFullYear(), periodDate.getMonth() + 1, targetDay);
  const daysRemaining = Math.max(0, Math.ceil((closeDeadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

  const periodLabel = periods.find((p) => p.value === period)?.label ?? period;

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <CheckSquare className="w-6 h-6 text-orange-500" />
          <h1 className="text-lg font-bold text-white">Close Tracker</h1>
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
        </div>
      </div>

      <AIInsightsBanner module="close-tracker" compact />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-6">
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Total Tasks</div>
          <div className="text-lg font-bold text-white">{totalItems}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Completed</div>
          <div className="text-lg font-bold text-green-400">{completedCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Blocked</div>
          <div className="text-lg font-bold text-red-400">{blockedCount}</div>
        </div>
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-4">
          <div className="text-xs text-zinc-400 uppercase tracking-wider mb-1">Days Remaining</div>
          <div className={`text-lg font-bold ${daysRemaining <= 1 ? 'text-red-400' : daysRemaining <= 3 ? 'text-yellow-400' : 'text-white'}`}>
            {daysRemaining}
          </div>
        </div>
      </div>

      {/* Overall Progress Bar */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 mb-6">
        <div className="flex justify-between items-center mb-2">
          <span className="text-sm text-zinc-300">Overall Close Progress</span>
          <span className="text-sm font-mono font-bold text-white">{overallPct}%</span>
        </div>
        <div className="h-3 bg-zinc-800 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              overallPct === 100 ? 'bg-green-500' : 'bg-orange-500'
            }`}
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      {/* Content */}
      <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg px-5 py-4">
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

        {error !== null && !loading ? (
          <div className="bg-red-900/20 border border-red-800 rounded-lg p-4 text-red-400 text-sm">
            {String(error)}
          </div>
        ) : null}

        {!loading && !error && !checklist && (
          <div className="text-center text-zinc-500 py-12">
            <CheckSquare className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p>No close checklist for {periodLabel}</p>
            <p className="text-xs mt-0.5">Create a close period from the API or admin panel to begin tracking.</p>
          </div>
        )}

        {!loading && !error && checklist && (
          <>
            {/* Day Timeline */}
            <DayTimeline dayProgress={dayProgress} targetDay={targetDay} />

            {/* Task Table */}
            <table className="w-full">
              <thead>
                <tr className="border-b border-zinc-700 text-xs text-zinc-400 uppercase tracking-wider">
                  <th className="py-2 text-left w-8" />
                  <th className="py-2 text-left">Task</th>
                  <th className="py-2 text-left w-28">Owner</th>
                  <th className="py-2 text-center w-16">Day</th>
                  <th className="py-2 text-left w-28">Status</th>
                  <th className="py-2 text-left w-36">Dependencies</th>
                  <th className="py-2 text-right w-36">Completed</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                {(items ?? []).map((item) => {
                  const depItem = item.dependency
                    ? items.find((i) => i.id === item.dependency)
                    : null;
                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-zinc-800 hover:bg-zinc-800/50 ${
                        item.status === 'blocked' ? 'bg-red-900/5' : ''
                      }`}
                    >
                      <td className="py-2.5">{statusIcon(item.status)}</td>
                      <td className="py-2.5 text-zinc-200">{item.task}</td>
                      <td className="py-2.5 text-zinc-400">{item.owner}</td>
                      <td className="py-2.5 text-center">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full bg-zinc-800 text-xs font-mono text-zinc-300">
                          {item.day}
                        </span>
                      </td>
                      <td className="py-2.5">
                        <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium ${statusBadgeClass(item.status)}`}>
                          {statusLabel(item.status)}
                        </span>
                      </td>
                      <td className="py-2.5 text-xs text-zinc-500">
                        {depItem ? (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {depItem.task.length > 25 ? `${depItem.task.slice(0, 25)}...` : depItem.task}
                          </span>
                        ) : (
                          <span className="text-zinc-700">--</span>
                        )}
                      </td>
                      <td className="py-2.5 text-right text-xs text-zinc-500">
                        {item.completedAt
                          ? new Date(item.completedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                          : '--'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {items.length === 0 && (
              <div className="text-center text-zinc-500 py-8">
                No tasks in this close checklist.
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
