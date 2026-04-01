'use client';

import { useState, useCallback } from 'react';
import ArtifactViewer, { type Artifact } from './ArtifactViewer';
import ExportBar from '../common/ExportBar';

interface ArtifactPanelProps {
  artifact: Artifact;
  onClose: () => void;
  onMaximize?: () => void;
}

export default function ArtifactPanel({ artifact, onClose, onMaximize }: ArtifactPanelProps) {
  const [isMaximized, setIsMaximized] = useState(false);

  const handleMaximize = useCallback(() => {
    setIsMaximized((prev) => !prev);
    onMaximize?.();
  }, [onMaximize]);

  const typeLabel = (() => {
    switch (artifact.type) {
      case 'chart': return 'Chart';
      case 'table': return 'Table';
      case 'report': return 'Report';
      case 'code': return 'Code';
      case 'data': return 'Data';
      default: return 'Artifact';
    }
  })();

  const panelWidth = isMaximized ? 'w-[60vw]' : 'w-[400px]';

  return (
    <div
      className={`${panelWidth} h-full border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-[#09090B] flex flex-col shrink-0 transition-all duration-300 shadow-[-4px_0_12px_rgba(0,0,0,0.1)]`}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/80 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded border border-[#FF5C00]/30 bg-[#FF5C00]/10 text-[#FF5C00] uppercase tracking-wide shrink-0">
            {typeLabel}
          </span>
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white truncate">
            {artifact.title}
          </h3>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {/* Print button for reports */}
          {artifact.type === 'report' && (
            <button
              onClick={() => window.print()}
              className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Print"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0110.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0l.229 2.523a1.125 1.125 0 01-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0021 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 00-1.913-.247M6.34 18H5.25A2.25 2.25 0 013 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 011.913-.247m10.5 0a48.536 48.536 0 00-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5zm-3 0h.008v.008H15V10.5z" />
              </svg>
            </button>
          )}
          {/* Maximize toggle */}
          <button
            onClick={handleMaximize}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>
          {/* Close */}
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
            title="Close panel"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <ArtifactViewer artifact={artifact} />
      </div>

      {/* Footer: Export bar */}
      <div className="px-4 py-2 border-t border-zinc-200 dark:border-zinc-700 bg-zinc-50/80 dark:bg-zinc-800/50 shrink-0">
        <ExportBar content={artifact.content} title={artifact.title} compact />
      </div>
    </div>
  );
}
