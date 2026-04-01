import { NextResponse } from 'next/server';
import { getExceptionAging, getReconsByStatus } from '@/lib/engines/reconciliation';

interface ExceptionItem {
  id: string;
  engine: string;
  type: string;
  description: string;
  amount: number | null;
  severity: 'low' | 'medium' | 'high' | 'critical';
  status: 'open' | 'investigating' | 'resolved' | 'waived';
  createdAt: string;
  agingDays: number;
  assignedTo: string | null;
}

function severityFromAging(days: number): ExceptionItem['severity'] {
  if (days > 30) return 'critical';
  if (days > 14) return 'high';
  if (days > 7) return 'medium';
  return 'low';
}

export async function GET() {
  const allExceptions: ExceptionItem[] = [];

  // 1. Pull open exceptions from reconciliation engine
  try {
    const reconExceptions = getExceptionAging();
    for (const re of reconExceptions) {
      allExceptions.push({
        id: re.exception.id,
        engine: 'Reconciliation',
        type: 'Recon Variance',
        description: re.exception.description || `Account ${re.accountNumber} recon exception`,
        amount: typeof re.exception.amount === 'number' ? re.exception.amount : null,
        severity: severityFromAging(re.exception.ageInDays),
        status: re.exception.status === 'open' ? 'open' : re.exception.status === 'waived' ? 'waived' : 'resolved',
        createdAt: new Date(Date.now() - re.exception.ageInDays * 86400000).toISOString(),
        agingDays: re.exception.ageInDays,
        assignedTo: re.exception.resolvedBy,
      });
    }
  } catch {
    // reconciliation engine not available
  }

  // 2. Pull recons in 'exception' status
  try {
    const exceptionRecons = getReconsByStatus('exception');
    for (const recon of exceptionRecons) {
      // Avoid duplicates from the aging query above
      const existingIds = new Set(allExceptions.map(e => e.id));
      for (const ex of recon.exceptions ?? []) {
        if (!existingIds.has(ex.id)) {
          const ageDays = typeof ex.ageInDays === 'number' ? ex.ageInDays : 0;
          allExceptions.push({
            id: ex.id,
            engine: 'Reconciliation',
            type: 'Recon Exception',
            description: ex.description || `${recon.accountName} (${recon.accountNumber}) - variance $${typeof recon.difference === 'number' ? Math.abs(recon.difference).toFixed(2) : '0.00'}`,
            amount: typeof ex.amount === 'number' ? ex.amount : typeof recon.difference === 'number' ? recon.difference : null,
            severity: severityFromAging(ageDays),
            status: ex.status === 'open' ? 'open' : ex.status === 'waived' ? 'waived' : 'resolved',
            createdAt: recon.createdAt,
            agingDays: ageDays,
            assignedTo: ex.resolvedBy,
          });
        }
      }
    }
  } catch {
    // reconciliation engine not available
  }

  // Sort by severity (critical first), then by aging days
  const severityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  allExceptions.sort((a, b) => {
    const sevDiff = (severityOrder[a.severity] ?? 3) - (severityOrder[b.severity] ?? 3);
    if (sevDiff !== 0) return sevDiff;
    return b.agingDays - a.agingDays;
  });

  // Compute aging buckets
  const aging = {
    '0-7': allExceptions.filter(e => e.agingDays <= 7).length,
    '8-14': allExceptions.filter(e => e.agingDays > 7 && e.agingDays <= 14).length,
    '15-30': allExceptions.filter(e => e.agingDays > 14 && e.agingDays <= 30).length,
    '30+': allExceptions.filter(e => e.agingDays > 30).length,
  };

  // Compute by-engine counts
  const byEngine: Record<string, number> = {};
  for (const e of allExceptions) {
    byEngine[e.engine] = (byEngine[e.engine] ?? 0) + 1;
  }

  // Compute by-severity counts
  const bySeverity = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const e of allExceptions) {
    bySeverity[e.severity] = (bySeverity[e.severity] ?? 0) + 1;
  }

  return NextResponse.json({
    success: true,
    data: {
      exceptions: allExceptions,
      totalCount: allExceptions.length,
      aging,
      byEngine,
      bySeverity,
    },
  });
}
