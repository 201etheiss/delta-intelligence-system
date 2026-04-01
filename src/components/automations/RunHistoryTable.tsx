'use client';

import type { AutomationRun } from '@/lib/automations';

interface RunHistoryTableProps {
  runs: AutomationRun[];
  automationNames: Record<string, string>;
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTimestamp(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export default function RunHistoryTable({
  runs,
  automationNames,
}: RunHistoryTableProps) {
  if (runs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-zinc-400">
        <p className="text-sm">No run history yet.</p>
        <p className="text-xs mt-1">
          Run an automation to see results here.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-zinc-200 dark:border-zinc-700">
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Timestamp
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Automation
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Trigger
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Status
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Actions
            </th>
            <th className="text-left text-xs font-medium text-zinc-500 px-3 py-2">
              Duration
            </th>
          </tr>
        </thead>
        <tbody>
          {runs.map((run, idx) => {
            const totalMs = run.actions.reduce(
              (sum, a) => sum + a.durationMs,
              0
            );
            const actionSummary = run.actions
              .map(
                (a) =>
                  `${a.actionType} (${a.status})`
              )
              .join(', ');

            return (
              <tr
                key={run.id}
                className={`border-b border-zinc-100 dark:border-zinc-800 ${
                  idx % 2 === 1 ? 'bg-zinc-50 dark:bg-zinc-800/30' : ''
                }`}
              >
                <td className="px-3 py-2 text-xs text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                  {formatTimestamp(run.startedAt)}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-900 dark:text-white font-medium">
                  {automationNames[run.automationId] ?? run.automationId}
                </td>
                <td className="px-3 py-2">
                  <span className="inline-flex rounded px-2 py-0.5 text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700">
                    {run.triggerType}
                  </span>
                </td>
                <td className="px-3 py-2">
                  <span
                    className={`inline-flex rounded px-2 py-0.5 text-[10px] font-medium ${
                      run.status === 'success'
                        ? 'bg-green-50 text-green-700 border border-green-200'
                        : 'bg-red-50 text-red-700 border border-red-200'
                    }`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 max-w-xs truncate">
                  {actionSummary}
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500 tabular-nums">
                  {formatDuration(totalMs)}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
