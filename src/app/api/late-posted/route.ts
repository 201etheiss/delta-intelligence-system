import { NextRequest, NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway';

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  if (typeof v === 'string') {
    const p = parseFloat(v.replace(/[,$]/g, ''));
    if (!Number.isNaN(p)) return p;
  }
  return 0;
}

interface LatePostedLine {
  account: string;
  desc: string;
  debit: number;
  credit: number;
}

interface LatePostedEntry {
  id: string;
  transDate: string;
  postDate: string;
  description: string;
  source: string;
  daysLate: number;
  lines: LatePostedLine[];
}

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const days = parseInt(params.get('days') ?? '30') || 30;

    const res = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: {
        sql: `SELECT TOP 500 j.JournalEntryID, j.TransactionDate, j.PostDate, j.Description, j.Source,
                     l.Account_No, l.Description AS LineDesc, l.Debit, l.Credit
              FROM JournalEntryHeader j
              JOIN JournalEntryLine l ON j.JournalEntryID = l.JournalEntryID
              WHERE DATEDIFF(day, j.TransactionDate, j.PostDate) > ${days}
              ORDER BY j.PostDate DESC`,
      },
      timeout: 20000,
    });

    const rows = Array.isArray(res.data) ? res.data : [];
    const rowRecords = rows as Record<string, unknown>[];

    const grouped = new Map<string, LatePostedEntry>();

    for (const r of rowRecords) {
      const id = String(r.JournalEntryID ?? '');
      if (!grouped.has(id)) {
        const transDate = String(r.TransactionDate ?? '');
        const postDate = String(r.PostDate ?? '');
        const daysLate =
          transDate && postDate
            ? Math.round(
                (new Date(postDate).getTime() -
                  new Date(transDate).getTime()) /
                  86400000,
              )
            : 0;
        grouped.set(id, {
          id,
          transDate,
          postDate,
          description: String(r.Description ?? ''),
          source: String(r.Source ?? ''),
          daysLate,
          lines: [],
        });
      }
      const entry = grouped.get(id);
      if (entry) {
        entry.lines.push({
          account: String(r.Account_No ?? ''),
          desc: String(r.LineDesc ?? ''),
          debit: safeNumber(r.Debit),
          credit: safeNumber(r.Credit),
        });
      }
    }

    const entries = Array.from(grouped.values()).sort(
      (a, b) => b.daysLate - a.daysLate,
    );

    return NextResponse.json({
      success: true,
      data: {
        entries,
        totalCount: entries.length,
        avgDaysLate:
          entries.length > 0
            ? Math.round(
                entries.reduce((s, e) => s + e.daysLate, 0) / entries.length,
              )
            : 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed',
      },
      { status: 500 },
    );
  }
}
