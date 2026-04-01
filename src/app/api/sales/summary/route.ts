import { NextResponse } from 'next/server';
import { gatewayFetch } from '@/lib/gateway';

function safeNumber(v: unknown): number {
  if (typeof v === 'number' && !Number.isNaN(v)) return v;
  return 0;
}

export async function GET() {
  try {
    // Pull from Salesforce via gateway
    const [opps, accounts] = await Promise.all([
      gatewayFetch('/salesforce/query', 'admin', {
        method: 'POST',
        body: { soql: "SELECT SUM(Amount) total, COUNT(Id) cnt, StageName FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY StageName" },
        timeout: 15000,
      }).catch(() => ({ success: false, records: [] } as Record<string, unknown>)),
      gatewayFetch('/salesforce/query', 'admin', {
        method: 'POST',
        body: { soql: "SELECT COUNT(Id) cnt FROM Account WHERE IsDeleted = false" },
        timeout: 15000,
      }).catch(() => ({ success: false, records: [] } as Record<string, unknown>)),
    ]);

    const pipeline = Array.isArray((opps as Record<string, unknown>).records)
      ? (opps as Record<string, unknown>).records as Array<Record<string, unknown>>
      : [];
    const totalPipeline = pipeline.reduce((s: number, r: Record<string, unknown>) => s + safeNumber(r.total), 0);
    const totalOpps = pipeline.reduce((s: number, r: Record<string, unknown>) => s + safeNumber(r.cnt), 0);

    const accountRecords = Array.isArray((accounts as Record<string, unknown>).records)
      ? (accounts as Record<string, unknown>).records as Array<Record<string, unknown>>
      : [];
    const accountCount = safeNumber(accountRecords[0]?.cnt);

    return NextResponse.json({
      success: true,
      data: {
        pipeline: { total: totalPipeline, count: totalOpps, byStage: pipeline },
        accountCount,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
