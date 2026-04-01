'use client';

import { useEffect, useState } from 'react';

interface DataTableProps {
  title: string;
  endpoint: string;
  columns: string[];
}

type Row = Record<string, unknown>;

function getCellValue(row: Row, col: string): string {
  const val = row[col];
  if (val === null || val === undefined) return '—';
  if (typeof val === 'object') return JSON.stringify(val);
  return String(val);
}

export default function DataTable({ title, endpoint, columns }: DataTableProps) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/gateway/${endpoint}`, {
          headers: { 'x-user-role': 'admin' },
        });
        const json = await res.json() as { success: boolean; data?: unknown; error?: string };
        if (!cancelled) {
          if (json.success && Array.isArray(json.data)) {
            setRows(json.data as Row[]);
          } else {
            setError(json.error ?? 'Unexpected response format');
          }
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load data');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [endpoint]);

  const visible = rows.slice(0, 10);

  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] shadow-sm overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-[#E4E4E7] dark:border-[#27272A]">
        <h3 className="text-sm font-semibold text-[#09090B] dark:text-white">{title}</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        {loading ? (
          <div className="p-5 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-5 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <div className="px-5 py-8 text-center text-sm text-red-500">{error}</div>
        ) : rows.length === 0 ? (
          <div className="px-5 py-8 text-center text-sm text-[#A1A1AA]">No data available</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#FAFAFA] dark:bg-[#09090B] border-b border-[#E4E4E7] dark:border-[#27272A]">
                {columns.map((col) => (
                  <th
                    key={col}
                    className="px-4 py-3 text-left text-xs font-semibold text-[#71717A] dark:text-[#A1A1AA] uppercase tracking-wide whitespace-nowrap"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F4F4F5]">
              {visible.map((row, idx) => (
                <tr key={idx} className="hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] dark:bg-[#09090B] transition-colors">
                  {columns.map((col) => (
                    <td
                      key={col}
                      className="px-4 py-3 text-[#3F3F46] whitespace-nowrap max-w-[200px] truncate"
                      title={getCellValue(row, col)}
                    >
                      {getCellValue(row, col)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Footer */}
      {!loading && !error && rows.length > 10 && (
        <div className="px-5 py-3 border-t border-[#E4E4E7] dark:border-[#27272A] bg-[#FAFAFA] dark:bg-[#09090B]">
          <span className="text-xs text-[#A1A1AA]">
            Showing 10 of {rows.length} rows.{' '}
            <a
              href={`/api/gateway/${endpoint}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#FE5000] hover:underline font-medium"
            >
              View all
            </a>
          </span>
        </div>
      )}
    </div>
  );
}
