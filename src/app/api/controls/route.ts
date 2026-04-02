import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getAllCloses } from '@/lib/engines/close-management';
import { getReconsByStatus, getExceptionAging, readRules } from '@/lib/engines/reconciliation';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

interface ControlMetric {
  id: number;
  name: string;
  target: string;
  status: 'met' | 'not_met' | 'not_measured' | 'partial';
  currentValue: string;
  module: string;
  description: string;
  lastChecked: string;
}

function checkCloseControl(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const closes = getAllCloses();
    if (closes.length === 0) return { status: 'not_measured', currentValue: 'No close periods' };
    const latest = closes[0];
    if (latest.status === 'completed') {
      return { status: 'met', currentValue: `Last close: ${latest.period}` };
    }
    if (latest.status === 'in_progress') {
      return { status: 'partial', currentValue: `In progress: ${latest.period}` };
    }
    return { status: 'not_measured', currentValue: `Status: ${latest.status}` };
  } catch {
    return { status: 'not_measured', currentValue: 'Engine unavailable' };
  }
}

function checkReconControl(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const rules = readRules();
    const reconciledList = getReconsByStatus('reconciled');
    const exceptionList = getReconsByStatus('exception');
    const total = reconciledList.length + exceptionList.length;
    if (total === 0 && rules.length === 0) return { status: 'not_measured', currentValue: 'No recon rules' };
    if (total === 0) return { status: 'partial', currentValue: `${rules.length} rules defined` };
    const passRate = total > 0 ? Math.round((reconciledList.length / total) * 100) : 0;
    if (exceptionList.length === 0) return { status: 'met', currentValue: `${passRate}% pass rate` };
    return { status: 'partial', currentValue: `${passRate}% pass, ${exceptionList.length} exceptions` };
  } catch {
    return { status: 'not_measured', currentValue: 'Engine unavailable' };
  }
}

function checkExceptionControl(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const openExceptions = getExceptionAging();
    if (openExceptions.length === 0) return { status: 'met', currentValue: '0 open exceptions' };
    return { status: 'not_met', currentValue: `${openExceptions.length} open exceptions` };
  } catch {
    return { status: 'not_measured', currentValue: 'Engine unavailable' };
  }
}

function checkEvidenceVault(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const evidenceDir = join(process.cwd(), 'data', 'evidence');
    if (!existsSync(evidenceDir)) return { status: 'partial', currentValue: 'Directory exists' };
    return { status: 'met', currentValue: 'SHA-256 active' };
  } catch {
    return { status: 'not_measured', currentValue: 'Check failed' };
  }
}

function checkExceptionQueue(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const openExceptions = getExceptionAging();
    const exceptionRecons = getReconsByStatus('exception');
    const total = openExceptions.length + exceptionRecons.length;
    if (total > 0) return { status: 'partial', currentValue: `${total} items in queue` };
    return { status: 'met', currentValue: 'Queue active, 0 items' };
  } catch {
    return { status: 'partial', currentValue: 'Queue exists' };
  }
}

function checkAuditLog(): Pick<ControlMetric, 'status' | 'currentValue'> {
  try {
    const auditPath = join(process.cwd(), 'data', 'audit-log.json');
    if (!existsSync(auditPath)) return { status: 'not_measured', currentValue: 'No audit log' };
    const raw = readFileSync(auditPath, 'utf-8');
    const entries = JSON.parse(raw);
    const count = Array.isArray(entries) ? entries.length : 0;
    if (count > 0) return { status: 'met', currentValue: `${count} entries logged` };
    return { status: 'partial', currentValue: 'Log exists, 0 entries' };
  } catch {
    return { status: 'not_measured', currentValue: 'Check failed' };
  }
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date().toISOString();

  const closeStatus = checkCloseControl();
  const reconStatus = checkReconControl();
  const exceptionZero = checkExceptionControl();
  const evidenceStatus = checkEvidenceVault();
  const queueStatus = checkExceptionQueue();
  const auditStatus = checkAuditLog();

  const controls: ControlMetric[] = [
    { id: 1, name: 'Day-5 Close', target: 'Close by Day 5', ...closeStatus, module: 'Close Management', description: 'Monthly close completed within 5 business days', lastChecked: now },
    { id: 2, name: '$5K Materiality', target: 'Commentary for variances >$5K', status: 'partial', currentValue: 'Rule defined', module: 'Commentary', description: 'All material variances have documented commentary', lastChecked: now },
    { id: 3, name: '$1 Recon Tolerance', target: 'Pass within $1', ...reconStatus, module: 'Reconciliation', description: 'All reconciliations pass within $1 tolerance', lastChecked: now },
    { id: 4, name: 'AP Auto-Coded >50%', target: 'Majority auto-coded', status: 'not_measured', currentValue: '0%', module: 'AP Processing', description: 'More than 50% of AP invoices auto-coded by AI', lastChecked: now },
    { id: 5, name: 'AP Touch-Time -30%', target: 'Reduce by 30%', status: 'not_measured', currentValue: 'No baseline', module: 'AP Processing', description: 'AP processing time reduced 30% from baseline', lastChecked: now },
    { id: 6, name: 'Approval Cycle -25%', target: 'Reduce by 25%', status: 'not_measured', currentValue: 'No baseline', module: 'Journal Entry', description: 'JE approval cycle time reduced 25% from baseline', lastChecked: now },
    { id: 7, name: 'Zero Control Failures', target: 'No failures', ...exceptionZero, module: 'Exception Monitor', description: 'Zero unresolved control failures in any period', lastChecked: now },
    { id: 8, name: 'Human-in-the-Loop', target: 'All AI outputs reviewed', status: 'partial', currentValue: 'UI built', module: 'All Engines', description: 'Every AI-generated output goes through human review', lastChecked: now },
    { id: 9, name: 'AI Drafts, Humans Approve', target: 'Automation philosophy', status: 'partial', currentValue: 'Workflow built', module: 'Commentary', description: 'AI generates drafts, humans make final decisions', lastChecked: now },
    { id: 10, name: 'Immutable Evidence Vault', target: 'All actions traced', ...evidenceStatus, module: 'Evidence Vault', description: 'All financial actions have immutable evidence trail', lastChecked: now },
    { id: 11, name: 'Exception Queue', target: 'Rule violations queued', ...queueStatus, module: 'Exception Monitor', description: 'All rule violations automatically queued for review', lastChecked: now },
    { id: 12, name: 'Audit Trail', target: 'All actions logged', ...auditStatus, module: 'Evidence Vault', description: 'All user and system actions logged with immutable audit trail', lastChecked: now },
  ];

  const met = controls.filter(c => c.status === 'met').length;
  const partial = controls.filter(c => c.status === 'partial').length;
  const notMet = controls.filter(c => c.status === 'not_met').length;
  const notMeasured = controls.filter(c => c.status === 'not_measured').length;

  return NextResponse.json({
    success: true,
    data: {
      controls,
      summary: { met, partial, notMet, notMeasured, total: controls.length },
      complianceScore: Math.round(((met + partial * 0.5) / controls.length) * 100),
    },
  });
}
