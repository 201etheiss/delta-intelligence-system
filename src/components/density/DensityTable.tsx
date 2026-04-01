'use client';

import React from 'react';
import { useDensity } from '@/components/density/DensityProvider';

interface Column {
  key: string;
  label: string;
  align?: 'left' | 'right';
  summaryOnly?: boolean;
}

interface DensityTableProps {
  columns: Column[];
  data: Record<string, unknown>[];
  sectionGroupBy?: string;
}

export function DensityTable({ columns, data, sectionGroupBy }: DensityTableProps) {
  const mode = useDensity();

  if (mode === 'executive') {
    const visibleColumns = columns.filter((c) => c.summaryOnly !== false);

    return (
      <div
        style={{
          background: '#0f0f11',
          border: '1px solid #27272a',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              {visibleColumns.map((col) => (
                <th
                  key={col.key}
                  style={{
                    padding: '12px 16px',
                    textAlign: col.align ?? 'left',
                    fontSize: '11px',
                    fontWeight: 600,
                    letterSpacing: '0.06em',
                    textTransform: 'uppercase',
                    color: '#71717a',
                  }}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr
                key={i}
                style={{
                  height: '48px',
                  borderBottom: i < data.length - 1 ? '1px solid #1f1f23' : undefined,
                }}
              >
                {visibleColumns.map((col) => (
                  <td
                    key={col.key}
                    style={{
                      padding: '0 16px',
                      textAlign: col.align ?? 'left',
                      fontSize: '14px',
                      color: '#e4e4e7',
                    }}
                  >
                    {String(row[col.key] ?? '')}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Operator mode — full table, compact, monospace numbers, section groups
  const groupedRows: { section?: string; rows: Record<string, unknown>[] }[] = [];

  if (sectionGroupBy) {
    const sections = new Map<string, Record<string, unknown>[]>();
    for (const row of data) {
      const key = String(row[sectionGroupBy] ?? '');
      const existing = sections.get(key);
      if (existing) {
        existing.push(row);
      } else {
        sections.set(key, [row]);
      }
    }
    for (const [section, rows] of Array.from(sections.entries())) {
      groupedRows.push({ section, rows });
    }
  } else {
    groupedRows.push({ rows: data });
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        <thead
          style={{
            position: 'sticky',
            top: 0,
            background: '#0f0f11',
            zIndex: 1,
          }}
        >
          <tr style={{ borderBottom: '1px solid #27272a' }}>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  padding: '4px 8px',
                  textAlign: col.align ?? 'left',
                  fontSize: '9px',
                  fontWeight: 600,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#71717a',
                  whiteSpace: 'nowrap',
                }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groupedRows.map(({ section, rows }, gi) => (
            <React.Fragment key={gi}>
              {section !== undefined && (
                <tr style={{ background: '#0f0f11' }}>
                  <td
                    colSpan={columns.length}
                    style={{
                      padding: '6px 8px',
                      fontSize: '10px',
                      fontWeight: 700,
                      color: '#a1a1aa',
                      letterSpacing: '0.04em',
                    }}
                  >
                    {section}
                  </td>
                </tr>
              )}
              {rows.map((row, i) => (
                <tr
                  key={i}
                  style={{ height: '28px', cursor: 'default', background: i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent' }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = '#18181b';
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background = i % 2 === 1 ? 'rgba(255,255,255,0.02)' : 'transparent';
                  }}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: '0 8px',
                        textAlign: col.align ?? 'left',
                        fontSize: '11px',
                        fontFamily: 'monospace',
                        color: '#e4e4e7',
                        borderBottom: '1px solid #1a1a1e',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {String(row[col.key] ?? '')}
                    </td>
                  ))}
                </tr>
              ))}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
