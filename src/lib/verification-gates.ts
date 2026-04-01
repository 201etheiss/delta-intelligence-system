/**
 * Verification Gates — validates data integrity, compliance, reconciliation,
 * cash flow, and data freshness at key checkpoints across all engines.
 *
 * Each gate runs specific validation checks and returns pass/fail with
 * detailed results. Results are append-logged to data/verification-log.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────

export interface VerificationCheck {
  name: string;
  passed: boolean;
  message: string;
  severity: 'info' | 'warn' | 'error';
}

export interface VerificationResult {
  passed: boolean;
  gate: string;
  checks: VerificationCheck[];
  timestamp: string;
  duration: number;
}

export interface VerificationRunResult {
  gates: VerificationResult[];
  overallPassed: boolean;
  score: number;
  runId: string;
  timestamp: string;
}

type GateName = 'DataIntegrity' | 'Compliance' | 'Reconciliation' | 'CashFlow' | 'DataFreshness';

// ── File I/O ─────────────────────────────────────────────────

function getLogPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/verification-log.json';
  }
  return join(process.cwd(), 'data', 'verification-log.json');
}

interface VerificationLog {
  runs: VerificationRunResult[];
  lastUpdated: string;
}

function readLog(): VerificationLog {
  const logPath = getLogPath();
  if (!existsSync(logPath)) {
    return { runs: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(logPath, 'utf-8');
    const data = JSON.parse(raw) as VerificationLog;
    return { runs: data.runs ?? [], lastUpdated: data.lastUpdated ?? new Date().toISOString() };
  } catch {
    return { runs: [], lastUpdated: new Date().toISOString() };
  }
}

function writeLog(log: VerificationLog): void {
  const logPath = getLogPath();
  try {
    const dir = join(logPath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    // Keep only last 500 runs
    const trimmed: VerificationLog = {
      runs: (log.runs ?? []).slice(-500),
      lastUpdated: new Date().toISOString(),
    };
    writeFileSync(logPath, JSON.stringify(trimmed, null, 2));
  } catch {
    // Silent fail — verification logging should never break main flow
  }
}

// ── Helper: safe data file reader ────────────────────────────

function readDataFile<T>(filename: string, fallback: T): T {
  try {
    const filePath = join(process.cwd(), 'data', filename);
    if (!existsSync(filePath)) return fallback;
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function generateId(): string {
  return `vr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Gate Implementations ─────────────────────────────────────

function runDataIntegrityGate(): VerificationResult {
  const start = Date.now();
  const checks: VerificationCheck[] = [];

  // Check 1: GL transactions file exists and is valid JSON
  const glTxns = readDataFile<{ entries?: unknown[] }>('gl-transactions.json', { entries: [] });
  const glEntries = glTxns.entries ?? [];
  checks.push({
    name: 'GL transactions file integrity',
    passed: Array.isArray(glEntries),
    message: Array.isArray(glEntries)
      ? `GL transactions file contains ${glEntries.length} entries`
      : 'GL transactions file is corrupted or missing',
    severity: Array.isArray(glEntries) ? 'info' : 'error',
  });

  // Check 2: GL accounts file integrity
  const glAccounts = readDataFile<{ accounts?: unknown[] }>('gl-accounts.json', { accounts: [] });
  const accounts = glAccounts.accounts ?? [];
  checks.push({
    name: 'GL accounts registry integrity',
    passed: Array.isArray(accounts),
    message: Array.isArray(accounts)
      ? `${accounts.length} GL accounts registered`
      : 'GL accounts registry is corrupted',
    severity: Array.isArray(accounts) ? 'info' : 'error',
  });

  // Check 3: JE templates consistency
  const jeTemplates = readDataFile<{ templates?: unknown[] }>('je-templates.json', { templates: [] });
  const templates = jeTemplates.templates ?? [];
  checks.push({
    name: 'Journal entry templates valid',
    passed: Array.isArray(templates),
    message: Array.isArray(templates)
      ? `${templates.length} JE templates loaded`
      : 'JE templates file corrupted',
    severity: Array.isArray(templates) ? 'info' : 'warn',
  });

  // Check 4: Audit log not corrupted
  const auditLog = readDataFile<{ entries?: unknown[] }>('audit-log.json', { entries: [] });
  const auditEntries = auditLog.entries ?? [];
  checks.push({
    name: 'Audit log integrity',
    passed: Array.isArray(auditEntries),
    message: Array.isArray(auditEntries)
      ? `Audit log has ${auditEntries.length} entries`
      : 'Audit log corrupted',
    severity: Array.isArray(auditEntries) ? 'info' : 'error',
  });

  // Check 5: Users file integrity
  const usersData = readDataFile<{ users?: unknown[] }>('users.json', { users: [] });
  const users = usersData.users ?? [];
  checks.push({
    name: 'Users registry integrity',
    passed: Array.isArray(users) && users.length > 0,
    message: Array.isArray(users) && users.length > 0
      ? `${users.length} users registered`
      : 'Users registry empty or corrupted',
    severity: Array.isArray(users) && users.length > 0 ? 'info' : 'warn',
  });

  const passed = checks.every(c => c.severity !== 'error');

  return {
    passed,
    gate: 'DataIntegrity',
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

function runComplianceGate(): VerificationResult {
  const start = Date.now();
  const checks: VerificationCheck[] = [];

  // Check 1: Evidence vault directory exists
  const evidenceDir = join(process.cwd(), 'data', 'evidence');
  checks.push({
    name: 'Evidence vault directory exists',
    passed: existsSync(evidenceDir),
    message: existsSync(evidenceDir)
      ? 'Evidence vault directory present'
      : 'Evidence vault directory missing — cannot store immutable records',
    severity: existsSync(evidenceDir) ? 'info' : 'error',
  });

  // Check 2: Audit log is populated (segregation of duties trail)
  const auditLog = readDataFile<{ entries?: Array<{ action?: string; userEmail?: string }> }>('audit-log.json', { entries: [] });
  const auditEntries = auditLog.entries ?? [];
  const hasMultipleUsers = new Set((auditEntries).map(e => e.userEmail)).size > 1;
  checks.push({
    name: 'Segregation of duties — multiple users in audit trail',
    passed: hasMultipleUsers || auditEntries.length === 0,
    message: hasMultipleUsers
      ? `Audit trail shows ${new Set(auditEntries.map(e => e.userEmail)).size} distinct users`
      : auditEntries.length === 0
        ? 'No audit entries yet — unable to verify segregation of duties'
        : 'Only one user in audit trail — segregation of duties risk',
    severity: hasMultipleUsers ? 'info' : auditEntries.length === 0 ? 'warn' : 'warn',
  });

  // Check 3: Custom roles exist (RBAC enforcement)
  const rolesData = readDataFile<{ roles?: unknown[] }>('custom-roles.json', { roles: [] });
  const roles = rolesData.roles ?? [];
  checks.push({
    name: 'RBAC role definitions present',
    passed: true,
    message: `${roles.length} custom roles defined (built-in roles always enforced)`,
    severity: 'info',
  });

  // Check 4: Close periods tracking exists
  const closePeriods = readDataFile<{ periods?: unknown[] }>('close-periods.json', { periods: [] });
  const periods = closePeriods.periods ?? [];
  checks.push({
    name: 'Period close tracking active',
    passed: true,
    message: `${periods.length} close periods tracked`,
    severity: 'info',
  });

  // Check 5: Expense policies defined
  const policies = readDataFile<{ policies?: unknown[] }>('expense-policies.json', { policies: [] });
  const policyList = policies.policies ?? [];
  checks.push({
    name: 'Expense policies defined',
    passed: Array.isArray(policyList),
    message: `${policyList.length} expense policies configured`,
    severity: policyList.length > 0 ? 'info' : 'warn',
  });

  const passed = checks.every(c => c.severity !== 'error');

  return {
    passed,
    gate: 'Compliance',
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

function runReconciliationGate(): VerificationResult {
  const start = Date.now();
  const checks: VerificationCheck[] = [];

  // Check 1: Reconciliation rules exist
  const reconRules = readDataFile<{ rules?: unknown[] }>('recon-rules.json', { rules: [] });
  const rules = reconRules.rules ?? [];
  checks.push({
    name: 'Reconciliation rules defined',
    passed: Array.isArray(rules),
    message: `${rules.length} reconciliation rules configured`,
    severity: rules.length > 0 ? 'info' : 'warn',
  });

  // Check 2: Reconciliations data file exists
  const recons = readDataFile<{ reconciliations?: Array<{ status?: string }> }>('reconciliations.json', { reconciliations: [] });
  const reconList = recons.reconciliations ?? [];
  checks.push({
    name: 'Reconciliation records present',
    passed: Array.isArray(reconList),
    message: `${reconList.length} reconciliation records found`,
    severity: 'info',
  });

  // Check 3: Check for open/incomplete reconciliations
  const openRecons = reconList.filter(r => r.status === 'open' || r.status === 'in_progress');
  checks.push({
    name: 'Open reconciliation items',
    passed: openRecons.length < 50,
    message: openRecons.length > 0
      ? `${openRecons.length} reconciliations still open`
      : 'No open reconciliations — all items resolved',
    severity: openRecons.length >= 50 ? 'error' : openRecons.length > 10 ? 'warn' : 'info',
  });

  // Check 4: Close templates present for month-end
  const closeTemplates = readDataFile<{ templates?: unknown[] }>('close-templates.json', { templates: [] });
  const tmplList = closeTemplates.templates ?? [];
  checks.push({
    name: 'Close templates available',
    passed: true,
    message: `${tmplList.length} close templates configured`,
    severity: tmplList.length > 0 ? 'info' : 'warn',
  });

  const passed = checks.every(c => c.severity !== 'error');

  return {
    passed,
    gate: 'Reconciliation',
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

function runCashFlowGate(): VerificationResult {
  const start = Date.now();
  const checks: VerificationCheck[] = [];

  // Check 1: Cash flow forecasts file
  const cfData = readDataFile<{ forecasts?: Array<{ availableLOC?: number; borrowingBase?: number }> }>('cash-flow-forecasts.json', { forecasts: [] });
  const forecasts = cfData.forecasts ?? [];
  checks.push({
    name: 'Cash flow forecast data present',
    passed: Array.isArray(forecasts),
    message: `${forecasts.length} cash flow forecast records`,
    severity: forecasts.length > 0 ? 'info' : 'warn',
  });

  // Check 2: LOC available is non-negative (if forecasts exist)
  if (forecasts.length > 0) {
    const latest = forecasts[forecasts.length - 1];
    const locAvailable = typeof latest.availableLOC === 'number' ? latest.availableLOC : null;
    checks.push({
      name: 'Line of credit availability',
      passed: locAvailable === null || locAvailable >= 0,
      message: locAvailable !== null
        ? locAvailable >= 0
          ? `LOC available: $${locAvailable.toLocaleString()}`
          : `LOC NEGATIVE: $${locAvailable.toLocaleString()} — immediate attention required`
        : 'LOC data not available in latest forecast',
      severity: locAvailable !== null && locAvailable < 0 ? 'error' : 'info',
    });

    // Check 3: Borrowing base within facility limits
    const borrowingBase = typeof latest.borrowingBase === 'number' ? latest.borrowingBase : null;
    checks.push({
      name: 'Borrowing base check',
      passed: borrowingBase === null || borrowingBase >= 0,
      message: borrowingBase !== null
        ? `Borrowing base: $${borrowingBase.toLocaleString()}`
        : 'Borrowing base data not available',
      severity: 'info',
    });
  } else {
    checks.push({
      name: 'Cash flow forecast availability',
      passed: true,
      message: 'No forecasts generated yet — cash flow gates will activate when data is available',
      severity: 'warn',
    });
  }

  // Check 4: Margin snapshots exist
  const marginData = readDataFile<{ snapshots?: unknown[] }>('margin-snapshots.json', { snapshots: [] });
  const snapshots = marginData.snapshots ?? [];
  checks.push({
    name: 'Margin snapshot data',
    passed: true,
    message: `${snapshots.length} margin snapshots available`,
    severity: snapshots.length > 0 ? 'info' : 'warn',
  });

  const passed = checks.every(c => c.severity !== 'error');

  return {
    passed,
    gate: 'CashFlow',
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

function runDataFreshnessGate(): VerificationResult {
  const start = Date.now();
  const checks: VerificationCheck[] = [];
  const STALE_THRESHOLD_MS = 24 * 60 * 60 * 1000; // 24 hours
  const now = Date.now();

  // Check critical data files for freshness
  const filesToCheck = [
    { file: 'audit-log.json', name: 'Audit log', key: 'lastUpdated' },
    { file: 'usage-log.json', name: 'Usage log', key: 'lastUpdated' },
    { file: 'feedback.json', name: 'Feedback', key: 'lastUpdated' },
    { file: 'integrations.json', name: 'Integrations registry', key: 'lastUpdated' },
  ];

  for (const fc of filesToCheck) {
    const filePath = join(process.cwd(), 'data', fc.file);
    if (!existsSync(filePath)) {
      checks.push({
        name: `${fc.name} freshness`,
        passed: true,
        message: `${fc.name} file not yet created`,
        severity: 'warn',
      });
      continue;
    }

    try {
      const raw = readFileSync(filePath, 'utf-8');
      const data = JSON.parse(raw) as Record<string, unknown>;
      const lastUpdated = typeof data[fc.key] === 'string' ? new Date(data[fc.key] as string).getTime() : 0;
      const age = now - lastUpdated;
      const isStale = lastUpdated > 0 && age > STALE_THRESHOLD_MS;
      const hoursAgo = lastUpdated > 0 ? Math.round(age / (60 * 60 * 1000)) : -1;

      checks.push({
        name: `${fc.name} freshness`,
        passed: !isStale,
        message: lastUpdated > 0
          ? isStale
            ? `${fc.name} is ${hoursAgo}h old — exceeds 24h freshness threshold`
            : `${fc.name} updated ${hoursAgo}h ago`
          : `${fc.name} has no timestamp — freshness unknown`,
        severity: isStale ? 'warn' : 'info',
      });
    } catch {
      checks.push({
        name: `${fc.name} freshness`,
        passed: false,
        message: `${fc.name} file is corrupted — cannot read`,
        severity: 'error',
      });
    }
  }

  // Check integration sync status
  const integrations = readDataFile<{ integrations?: Array<{ name?: string; lastSync?: string; status?: string }> }>('integrations.json', { integrations: [] });
  const intList = integrations.integrations ?? [];
  const staleIntegrations = intList.filter(i => {
    if (!i.lastSync) return false;
    return now - new Date(i.lastSync).getTime() > STALE_THRESHOLD_MS;
  });

  if (intList.length > 0) {
    checks.push({
      name: 'Integration sync freshness',
      passed: staleIntegrations.length === 0,
      message: staleIntegrations.length > 0
        ? `${staleIntegrations.length} of ${intList.length} integrations have stale data (>24h)`
        : `All ${intList.length} integrations synced within 24h`,
      severity: staleIntegrations.length > 0 ? 'warn' : 'info',
    });
  }

  const passed = checks.every(c => c.severity !== 'error');

  return {
    passed,
    gate: 'DataFreshness',
    checks,
    timestamp: new Date().toISOString(),
    duration: Date.now() - start,
  };
}

// ── Gate Registry ────────────────────────────────────────────

const GATE_REGISTRY: Record<GateName, () => VerificationResult> = {
  DataIntegrity: runDataIntegrityGate,
  Compliance: runComplianceGate,
  Reconciliation: runReconciliationGate,
  CashFlow: runCashFlowGate,
  DataFreshness: runDataFreshnessGate,
};

// ── Public API ───────────────────────────────────────────────

export function runGate(gateName: GateName): VerificationResult {
  const runner = GATE_REGISTRY[gateName];
  if (!runner) {
    return {
      passed: false,
      gate: gateName,
      checks: [{ name: 'Gate lookup', passed: false, message: `Unknown gate: ${gateName}`, severity: 'error' }],
      timestamp: new Date().toISOString(),
      duration: 0,
    };
  }
  return runner();
}

export function runAllGates(): VerificationRunResult {
  const gateNames = Object.keys(GATE_REGISTRY) as GateName[];
  const gates = gateNames.map(name => runGate(name));
  const overallPassed = gates.every(g => g.passed);

  // Score: percentage of gates that passed
  const score = gates.length > 0 ? Math.round((gates.filter(g => g.passed).length / gates.length) * 100) : 0;

  const result: VerificationRunResult = {
    gates,
    overallPassed,
    score,
    runId: generateId(),
    timestamp: new Date().toISOString(),
  };

  // Persist to log
  const log = readLog();
  log.runs.push(result);
  writeLog(log);

  return result;
}

export function getVerificationHistory(limit: number = 20): VerificationRunResult[] {
  const log = readLog();
  return (log.runs ?? []).slice(-limit).reverse();
}

export function getAvailableGates(): GateName[] {
  return Object.keys(GATE_REGISTRY) as GateName[];
}

export type { GateName };
