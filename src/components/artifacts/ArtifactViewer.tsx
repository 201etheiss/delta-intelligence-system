'use client';

import { useState, useMemo } from 'react';
import type { ParsedTable } from '@/lib/chart-detector';
import { parseNumericValue } from '@/lib/chart-detector';

// ── Types ─────────────────────────────────────────────────────

export type ArtifactType = 'chart' | 'table' | 'report' | 'code' | 'data';

export interface Artifact {
  id: string;
  type: ArtifactType;
  title: string;
  content: string;
  table?: ParsedTable;
  language?: string;
}

interface ArtifactViewerProps {
  artifact: Artifact;
}

// ── Color constants ───────────────────────────────────────────
const COLORS = ['#FF5C00', '#3B82F6', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899'];

// ── Chart View ────────────────────────────────────────────────
function ChartView({ table }: { table: ParsedTable }) {
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

  const labelCol = table.headers.findIndex((_, i) => !table.numericColumns.includes(i));
  const valueCols = table.numericColumns;
  if (labelCol === -1 || valueCols.length === 0) {
    return <p className="text-sm text-zinc-500 p-4">No chartable data found.</p>;
  }

  const data = table.rows.map((row) => ({
    label: row[labelCol] ?? '',
    values: valueCols.map((c) => parseNumericValue(row[c] ?? '0')),
  }));
  const maxVal = Math.max(...data.flatMap((d) => d.values), 1);

  return (
    <div className="p-4">
      <div className="flex items-end gap-2 h-60">
        {data.map((d, i) => (
          <div
            key={i}
            className="flex flex-col items-center gap-1 flex-1 relative"
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
          >
            {hoveredIdx === i && (
              <div className="absolute bottom-full mb-2 bg-zinc-900 text-white text-xs px-3 py-1.5 rounded shadow-lg z-10 whitespace-nowrap">
                {d.label}: {d.values.map((v) => v.toLocaleString()).join(' | ')}
              </div>
            )}
            {d.values.map((v, vi) => (
              <div
                key={vi}
                className="w-full max-w-[48px] rounded-t transition-all duration-300"
                style={{
                  height: `${Math.max(4, (v / maxVal) * 200)}px`,
                  backgroundColor: COLORS[vi % COLORS.length],
                  opacity: hoveredIdx === null || hoveredIdx === i ? 1 : 0.3,
                }}
              />
            ))}
            <span className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate w-full text-center">
              {d.label}
            </span>
          </div>
        ))}
      </div>
      {valueCols.length > 1 && (
        <div className="flex items-center gap-3 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
          {valueCols.map((c, i) => (
            <div key={i} className="flex items-center gap-1.5 text-xs text-zinc-600 dark:text-zinc-400">
              <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              {table.headers[c]}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Table View (sortable + filterable) ────────────────────────
function TableView({ table }: { table: ParsedTable }) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [filter, setFilter] = useState('');

  const filtered = useMemo(() => {
    if (!filter.trim()) return table.rows;
    const lower = filter.toLowerCase();
    return table.rows.filter((r) => r.some((c) => c.toLowerCase().includes(lower)));
  }, [table.rows, filter]);

  const sorted = useMemo(() => {
    if (sortCol === null) return filtered;
    const isNum = table.numericColumns.includes(sortCol);
    return [...filtered].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      const cmp = isNum
        ? (parseFloat(va.replace(/[$,%()]/g, '').replace(/,/g, '')) || 0) -
          (parseFloat(vb.replace(/[$,%()]/g, '').replace(/,/g, '')) || 0)
        : va.localeCompare(vb);
      return sortAsc ? cmp : -cmp;
    });
  }, [filtered, sortCol, sortAsc, table.numericColumns]);

  return (
    <div className="flex flex-col h-full">
      <div className="px-4 py-2 border-b border-zinc-100 dark:border-zinc-800">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter rows..."
          className="text-xs px-2 py-1.5 border border-zinc-200 dark:border-zinc-600 rounded w-full bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-[#FF5C00]/40"
        />
        <span className="text-[10px] text-zinc-400 mt-1 block">
          {sorted.length} of {table.rows.length} rows
        </span>
      </div>
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10">
            <tr>
              {table.headers.map((h, i) => (
                <th
                  key={i}
                  onClick={() => {
                    setSortCol(i);
                    setSortAsc(sortCol === i ? !sortAsc : true);
                  }}
                  className="px-3 py-2 text-left text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 cursor-pointer hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 select-none whitespace-nowrap"
                >
                  {h} {sortCol === i ? (sortAsc ? '\u2191' : '\u2193') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row, ri) => (
              <tr
                key={ri}
                className={`${ri % 2 === 1 ? 'bg-zinc-50 dark:bg-zinc-800/30' : 'dark:bg-[#09090B]'} hover:bg-orange-50/30 dark:hover:bg-[#FF5C00]/5 transition-colors`}
              >
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 border-b border-zinc-100 dark:border-zinc-800 whitespace-nowrap ${
                      table.numericColumns.includes(ci) ? 'text-right tabular-nums font-mono' : ''
                    }`}
                  >
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Report View ───────────────────────────────────────────────
// Content is already HTML-escaped before transformation (same pattern as MessageBubble).
// Only known-safe structural tags are emitted.
function ReportView({ content }: { content: string }) {
  const html = useMemo(() => {
    let h = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
    h = h.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    h = h.replace(/\*([^*\n]+)\*/g, '<em>$1</em>');
    h = h.replace(/^### (.+)$/gm, '<h3 class="font-semibold text-sm mt-3 mb-1">$1</h3>');
    h = h.replace(/^## (.+)$/gm, '<h2 class="font-semibold text-base mt-4 mb-1.5">$1</h2>');
    h = h.replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-4 mb-2">$1</h1>');
    h = h.replace(/^[-] (.+)$/gm, '<li class="ml-4 list-disc text-sm">$1</li>');
    h = h.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm">$1</li>');
    h = h
      .split(/\n\n+/)
      .map((block) => {
        if (block.startsWith('<h') || block.startsWith('<li')) return block;
        return `<p class="text-sm leading-relaxed mb-2">${block.replace(/\n/g, '<br/>')}</p>`;
      })
      .join('');
    return h;
  }, [content]);

  return (
    <div className="p-6 max-w-none overflow-auto h-full text-zinc-800 dark:text-zinc-200">
      {/* SECURITY: Content is HTML-escaped before any tag insertion. Safe. */}
      <div dangerouslySetInnerHTML={{ __html: html }} />
    </div>
  );
}

// ── Code View ─────────────────────────────────────────────────
function CodeView({ content, language }: { content: string; language?: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard
      .writeText(content)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50">
        {language && (
          <span className="text-[10px] text-zinc-500 font-mono">{language}</span>
        )}
        <button
          onClick={handleCopy}
          className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors ml-auto"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
      </div>
      <pre className="flex-1 overflow-auto bg-zinc-950 text-zinc-200 p-4 text-xs font-mono leading-relaxed whitespace-pre">
        {content}
      </pre>
    </div>
  );
}

// ── JSON Data View ────────────────────────────────────────────
function DataView({ content }: { content: string }) {
  const formatted = useMemo(() => {
    try {
      return JSON.stringify(JSON.parse(content), null, 2);
    } catch {
      return content;
    }
  }, [content]);

  return (
    <pre className="h-full overflow-auto bg-zinc-950 text-green-400 p-4 text-xs font-mono leading-relaxed whitespace-pre">
      {formatted}
    </pre>
  );
}

// ── Main Viewer ───────────────────────────────────────────────
export default function ArtifactViewer({ artifact }: ArtifactViewerProps) {
  switch (artifact.type) {
    case 'chart':
      return artifact.table ? (
        <ChartView table={artifact.table} />
      ) : (
        <ReportView content={artifact.content} />
      );
    case 'table':
      return artifact.table ? (
        <TableView table={artifact.table} />
      ) : (
        <ReportView content={artifact.content} />
      );
    case 'report':
      return <ReportView content={artifact.content} />;
    case 'code':
      return <CodeView content={artifact.content} language={artifact.language} />;
    case 'data':
      return <DataView content={artifact.content} />;
    default:
      return <ReportView content={artifact.content} />;
  }
}
