'use client';

import { Play, Pencil, Trash2, Clock, AlertTriangle, Zap, Settings } from 'lucide-react';
import type { Automation } from '@/lib/automations';

interface AutomationCardProps {
  automation: Automation;
  onToggle: (id: string, enabled: boolean) => void;
  onRunNow: (id: string) => void;
  onEdit: (automation: Automation) => void;
  onDelete: (id: string) => void;
  running?: boolean;
}

const TRIGGER_BADGES: Record<string, { label: string; color: string }> = {
  schedule: { label: 'Schedule', color: 'bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700' },
  threshold: { label: 'Threshold', color: 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-700' },
  manual: { label: 'Manual', color: 'bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border-zinc-200 dark:border-zinc-700' },
};

function formatTimeAgo(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(ms / 60000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function AutomationCard({
  automation,
  onToggle,
  onRunNow,
  onEdit,
  onDelete,
  running,
}: AutomationCardProps) {
  const badge = TRIGGER_BADGES[automation.trigger.type] ?? TRIGGER_BADGES.manual;
  const statusDot = automation.enabled ? 'bg-green-500' : 'bg-zinc-400';

  return (
    <div className="bg-white dark:bg-[#18181B] border border-zinc-200 dark:border-zinc-700 rounded-lg p-4 hover:shadow-sm transition-shadow">
      <div className="flex items-start justify-between gap-3">
        {/* Left: status + info */}
        <div className="flex items-start gap-3 min-w-0">
          <span className={`mt-1.5 w-2.5 h-2.5 rounded-full shrink-0 ${statusDot}`} />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
              {automation.name}
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-0.5 line-clamp-2">
              {automation.description}
            </p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span
                className={`inline-flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-medium border ${badge.color}`}
              >
                {automation.trigger.type === 'schedule' && <Clock size={10} />}
                {automation.trigger.type === 'threshold' && <AlertTriangle size={10} />}
                {automation.trigger.type === 'manual' && <Settings size={10} />}
                {badge.label}
              </span>
              {automation.trigger.config.frequency && (
                <span className="text-[10px] text-zinc-400">
                  {automation.trigger.config.frequency}
                </span>
              )}
              {automation.lastRunAt && (
                <span className="text-[10px] text-zinc-400">
                  Last run: {formatTimeAgo(automation.lastRunAt)}
                </span>
              )}
              {automation.lastRunStatus === 'error' && (
                <span className="text-[10px] text-red-500 font-medium">Failed</span>
              )}
              {automation.lastRunStatus === 'success' && (
                <span className="text-[10px] text-green-600 font-medium">Success</span>
              )}
              <span className="text-[10px] text-zinc-400">
                {automation.runCount} runs
              </span>
            </div>
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Toggle */}
          <button
            onClick={() => onToggle(automation.id, !automation.enabled)}
            className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
              automation.enabled ? 'bg-[#FE5000]' : 'bg-zinc-300 dark:bg-zinc-600'
            }`}
            title={automation.enabled ? 'Disable' : 'Enable'}
          >
            <span
              className={`inline-block h-3.5 w-3.5 rounded-full bg-white dark:bg-[#18181B] transition-transform ${
                automation.enabled ? 'translate-x-4' : 'translate-x-1'
              }`}
            />
          </button>

          <button
            onClick={() => onRunNow(automation.id)}
            disabled={running}
            className="p-1.5 text-zinc-400 hover:text-[#FE5000] hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors disabled:opacity-50"
            title="Run Now"
          >
            {running ? (
              <Zap size={14} className="animate-pulse text-[#FE5000]" />
            ) : (
              <Play size={14} />
            )}
          </button>

          <button
            onClick={() => onEdit(automation)}
            className="p-1.5 text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors"
            title="Edit"
          >
            <Pencil size={14} />
          </button>

          <button
            onClick={() => onDelete(automation.id)}
            className="p-1.5 text-zinc-400 hover:text-red-500 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded transition-colors"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </div>
  );
}
