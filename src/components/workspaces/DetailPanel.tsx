'use client';

import { X, Copy, Settings, ChevronRight } from 'lucide-react';
import type { Workspace } from './types';
import { CATEGORY_COLORS } from './types';
import { WorkspaceIcon } from './WorkspaceIcon';

export function DetailPanel({
  workspace: ws,
  onClose,
  onOpen,
  onDuplicate,
  onEdit,
}: {
  workspace: Workspace;
  onClose: () => void;
  onOpen: () => void;
  onDuplicate: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-[#18181B] rounded-xl shadow-xl max-w-xl w-full max-h-[85vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-zinc-200 dark:border-zinc-700">
          <div className="flex items-center gap-3">
            <WorkspaceIcon icon={ws.icon} color={ws.color} />
            <div>
              <h3 className="text-base font-semibold text-zinc-900 dark:text-white">{ws.name}</h3>
              <span
                className="inline-block mt-0.5 px-2 py-0.5 rounded text-[10px] font-medium text-white"
                style={{ backgroundColor: CATEGORY_COLORS[ws.category] ?? '#71717A' }}
              >
                {ws.category}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {ws.longDescription ?? ws.description}
          </p>

          <div>
            <h4 className="text-xs font-medium text-zinc-500 mb-2">Data Sources</h4>
            <div className="flex flex-wrap gap-1.5">
              {ws.dataSources.map((ds) => (
                <span
                  key={ds}
                  className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 uppercase tracking-wide"
                >
                  {ds}
                </span>
              ))}
            </div>
          </div>

          {(ws.samplePrompts ?? []).length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-zinc-500 mb-2">Suggested Questions</h4>
              <div className="space-y-1.5">
                {(ws.samplePrompts ?? []).map((p, i) => (
                  <button
                    key={i}
                    onClick={onOpen}
                    className="w-full text-left px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs text-zinc-600 dark:text-zinc-400 hover:border-orange-300 hover:text-zinc-900 dark:hover:text-white hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-colors"
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 text-xs text-zinc-500 dark:text-zinc-400">
            <div>Model: <span className="text-zinc-900 dark:text-white font-medium">{ws.preferredModel ?? 'auto'}</span></div>
            <div>Temperature: <span className="text-zinc-900 dark:text-white font-medium">{ws.temperature ?? 0.7}</span></div>
            <div>Uses: <span className="text-zinc-900 dark:text-white font-medium">{ws.usageCount}</span></div>
            <div>Visibility: <span className="text-zinc-900 dark:text-white font-medium">{ws.visibility}</span></div>
          </div>
        </div>

        <div className="flex items-center gap-3 p-5 border-t border-zinc-200 dark:border-zinc-700">
          <button
            onClick={onOpen}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium bg-[#FE5000] text-white rounded-lg hover:bg-[#CC4000] transition-colors"
          >
            Open Chat <ChevronRight size={16} />
          </button>
          <button
            onClick={onDuplicate}
            className="px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Duplicate"
          >
            <Copy size={16} />
          </button>
          <button
            onClick={onEdit}
            className="px-3 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition-colors"
            title="Edit"
          >
            <Settings size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
