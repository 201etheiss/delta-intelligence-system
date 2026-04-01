'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ParsedTable } from '@/lib/chart-detector';
import { parseNumericValue } from '@/lib/chart-detector';
import InlineChart from './InlineChart';
import type { ChartSuggestion } from '@/lib/chart-detector';

type ChartMode = 'table' | 'bar' | 'horizontal-bar' | 'line' | 'donut' | 'stacked-bar';

interface InteractiveTableProps {
  table: ParsedTable;
  onOpenInPanel?: (table: ParsedTable) => void;
  onExport?: (table: ParsedTable) => void;
}

type SortDirection = 'asc' | 'desc' | null;

export default function InteractiveTable({ table, onOpenInPanel, onExport }: InteractiveTableProps) {
  const [sortCol, setSortCol] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>(null);
  const [filterText, setFilterText] = useState('');
  const [page, setPage] = useState(0);
  const [chartMode, setChartMode] = useState<ChartMode>('table');

  const pageSize = 15;
  const showFilter = table.rows.length > 5;
  const showPagination = table.rows.length > pageSize;
  const hasNumericCols = table.numericColumns.length > 0;

  // Build chart suggestion for the selected chart mode
  const chartSuggestion: ChartSuggestion | null = useMemo(() => {
    if (chartMode === 'table' || !hasNumericCols) return null;
    const labelCol = table.headers.findIndex((_, i) => !table.numericColumns.includes(i));
    if (labelCol === -1) return null;
    return {
      type: chartMode,
      table,
      labelColumn: labelCol,
      valueColumns: table.numericColumns,
    };
  }, [chartMode, table, hasNumericCols]);

  const CHART_OPTIONS: Array<{ mode: ChartMode; label: string }> = [
    { mode: 'table', label: 'Table' },
    ...(hasNumericCols ? [
      { mode: 'bar' as ChartMode, label: 'Bar' },
      { mode: 'horizontal-bar' as ChartMode, label: 'H-Bar' },
      { mode: 'line' as ChartMode, label: 'Line' },
      { mode: 'donut' as ChartMode, label: 'Donut' },
      ...(table.numericColumns.length >= 2 ? [{ mode: 'stacked-bar' as ChartMode, label: 'Stacked' }] : []),
    ] : []),
  ];

  const handleSort = useCallback((colIdx: number) => {
    if (sortCol === colIdx) {
      if (sortDir === 'asc') setSortDir('desc');
      else if (sortDir === 'desc') { setSortCol(null); setSortDir(null); }
      else setSortDir('asc');
    } else {
      setSortCol(colIdx);
      setSortDir('asc');
    }
    setPage(0);
  }, [sortCol, sortDir]);

  const filteredRows = useMemo(() => {
    if (!filterText.trim()) return table.rows;
    const lower = filterText.toLowerCase();
    return table.rows.filter((row) =>
      row.some((cell) => cell.toLowerCase().includes(lower))
    );
  }, [table.rows, filterText]);

  const sortedRows = useMemo(() => {
    if (sortCol === null || sortDir === null) return filteredRows;
    const isNumeric = table.numericColumns.includes(sortCol);

    return [...filteredRows].sort((a, b) => {
      const va = a[sortCol] ?? '';
      const vb = b[sortCol] ?? '';
      let cmp: number;

      if (isNumeric) {
        const na = parseFloat(va.replace(/[$,%()]/g, '').replace(/,/g, '')) || 0;
        const nb = parseFloat(vb.replace(/[$,%()]/g, '').replace(/,/g, '')) || 0;
        cmp = na - nb;
      } else {
        cmp = va.localeCompare(vb);
      }
      return sortDir === 'desc' ? -cmp : cmp;
    });
  }, [filteredRows, sortCol, sortDir, table.numericColumns]);

  const pagedRows = showPagination
    ? sortedRows.slice(page * pageSize, (page + 1) * pageSize)
    : sortedRows;

  const totalPages = Math.ceil(sortedRows.length / pageSize);

  return (
    <div className="my-3 border border-zinc-200 dark:border-zinc-700 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-800/50 border-b border-zinc-200 dark:border-zinc-700">
        {/* View mode toggle */}
        <div className="flex items-center gap-0.5 bg-zinc-200/50 dark:bg-zinc-700/50 rounded-md p-0.5">
          {CHART_OPTIONS.map((opt) => (
            <button
              key={opt.mode}
              onClick={() => setChartMode(opt.mode)}
              className={`text-[10px] px-2 py-1 rounded transition-colors font-medium ${
                chartMode === opt.mode
                  ? 'bg-white dark:bg-zinc-600 text-zinc-900 dark:text-white shadow-sm'
                  : 'text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {showFilter && chartMode === 'table' && (
          <input
            type="text"
            value={filterText}
            onChange={(e) => { setFilterText(e.target.value); setPage(0); }}
            placeholder="Filter..."
            className="text-[11px] px-2 py-1 border border-zinc-200 dark:border-zinc-600 rounded bg-white dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 placeholder-zinc-400 focus:outline-none focus:border-[#FF5C00]/40 w-32"
          />
        )}
        <span className="text-[10px] text-zinc-400 tabular-nums">
          {filteredRows.length === table.rows.length
            ? `${table.rows.length} rows`
            : `${filteredRows.length}/${table.rows.length}`}
        </span>
        <div className="ml-auto flex items-center gap-1">
          {onOpenInPanel && (
            <button
              onClick={() => onOpenInPanel(table)}
              className="text-[10px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-600 text-zinc-500 dark:text-zinc-400 hover:border-[#FF5C00]/40 hover:text-[#FF5C00] transition-colors"
            >
              Expand
            </button>
          )}
        </div>
      </div>

      {/* Chart view */}
      {chartMode !== 'table' && chartSuggestion && (
        <div className="bg-white dark:bg-[#18181B]">
          <InlineChart suggestion={chartSuggestion} table={table} bare />
        </div>
      )}

      {/* Table view */}
      {chartMode === 'table' && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm min-w-[400px]">
              <thead>
                <tr>
                  {table.headers.map((h, i) => (
                    <th
                      key={i}
                      onClick={() => handleSort(i)}
                      className="px-3 py-2 text-left text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border-b border-zinc-200 dark:border-zinc-700 whitespace-nowrap cursor-pointer hover:bg-zinc-200/70 dark:hover:bg-zinc-700/70 transition-colors select-none"
                    >
                      <span className="inline-flex items-center gap-1">
                        {h}
                        {sortCol === i ? (
                          <span className="text-[#FF5C00]">
                            {sortDir === 'asc' ? '\u2191' : '\u2193'}
                          </span>
                        ) : (
                          <span className="text-zinc-300 dark:text-zinc-600">{'\u2195'}</span>
                        )}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {pagedRows.map((row, ri) => (
                  <tr key={ri} className={ri % 2 === 1 ? 'bg-zinc-50 dark:bg-zinc-800/30' : 'bg-white dark:bg-[#18181B]'}>
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

          {/* Pagination */}
          {showPagination && totalPages > 1 && (
            <div className="flex items-center justify-between px-3 py-2 border-t border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/30">
              <button
                onClick={() => setPage(Math.max(0, page - 1))}
                disabled={page === 0}
                className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
              >
                Previous
              </button>
              <span className="text-[10px] text-zinc-400 tabular-nums">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages - 1, page + 1))}
                disabled={page >= totalPages - 1}
                className="text-[10px] text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 disabled:opacity-30 transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
