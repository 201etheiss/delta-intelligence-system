import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { gatewayFetch } from '@/lib/gateway';
import { getUserRole } from '@/lib/config/roles';
import { routeAnomalyAlerts } from '@/lib/anomaly-alerter';
import type { AnomalySeverity } from '@/lib/anomaly-detector';

// ── Response shape ───────────────────────────────────────────

export interface AnomalyResult {
  id: string;
  metric: string;
  description: string;
  severity: AnomalySeverity;
  category: string;
  value: number;
  threshold: number;
  recommendedAction: string;
  detectedAt: string;
}

// ── Cache (15 minutes) ──────────────────────────────────────

interface CachedResult {
  anomalies: AnomalyResult[];
  scannedAt: string;
  expiresAt: number;
}

let anomalyCache: CachedResult | null = null;
const CACHE_TTL_MS = 15 * 60 * 1000; // 15 minutes

// ── Helpers ──────────────────────────────────────────────────

function makeId(): string {
  return `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Data-source scanners (each independent, each try/caught) ─

async function scanArAging(role: Parameters<typeof gatewayFetch>[1]): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/ar/aging', role);
    if (!res.success || !res.data) return anomalies;

    const data = res.data as Record<string, unknown>;
    const buckets = data.buckets ?? data.agingBuckets ?? data;

    const entries = Array.isArray(buckets) ? buckets : [];
    const THRESHOLD = 500_000;

    for (const entry of entries) {
      const record = entry as Record<string, unknown>;
      const over90 = Number(record['over90'] ?? record['90_plus'] ?? record['ninetyPlus'] ?? 0);
      const customer = String(record['customer'] ?? record['customerName'] ?? record['name'] ?? 'Unknown');

      if (over90 > THRESHOLD) {
        anomalies.push({
          id: makeId(),
          metric: 'AR Aging 90+ Days',
          description: `${customer} has $${(over90 / 1000).toFixed(0)}K outstanding 90+ days`,
          severity: over90 > 1_000_000 ? 'critical' : 'warning',
          category: 'ar',
          value: over90,
          threshold: THRESHOLD,
          recommendedAction: 'Review collections status and escalate to AR team',
          detectedAt: now,
        });
      }
    }
  } catch {
    // AR aging unavailable -- skip silently
  }

  return anomalies;
}

async function scanRevenueTrend(role: Parameters<typeof gatewayFetch>[1]): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  try {
    const [res2026, res2025] = await Promise.all([
      gatewayFetch('/ascend/revenue?year=2026', role),
      gatewayFetch('/ascend/revenue?year=2025', role),
    ]);

    if (!res2026.success || !res2025.success || !res2026.data || !res2025.data) return anomalies;

    const current = res2026.data as Record<string, unknown>;
    const prior = res2025.data as Record<string, unknown>;

    const currentMonths = (current.months ?? current.monthly ?? []) as Array<Record<string, unknown>>;
    const priorMonths = (prior.months ?? prior.monthly ?? []) as Array<Record<string, unknown>>;

    const DROP_THRESHOLD = 0.15;

    for (const cm of currentMonths) {
      const month = String(cm['month'] ?? cm['period'] ?? '');
      const currentRev = Number(cm['revenue'] ?? cm['amount'] ?? 0);

      const pm = priorMonths.find(
        (p) => String(p['month'] ?? p['period'] ?? '') === month
      );
      if (!pm) continue;

      const priorRev = Number(pm['revenue'] ?? pm['amount'] ?? 0);
      if (priorRev <= 0) continue;

      const dropPct = (priorRev - currentRev) / priorRev;
      if (dropPct > DROP_THRESHOLD) {
        anomalies.push({
          id: makeId(),
          metric: 'Revenue YoY',
          description: `${month} revenue dropped ${(dropPct * 100).toFixed(1)}% vs 2025`,
          severity: dropPct > 0.25 ? 'critical' : 'warning',
          category: 'revenue',
          value: currentRev,
          threshold: priorRev * (1 - DROP_THRESHOLD),
          recommendedAction: 'Investigate revenue variance and review customer pipeline',
          detectedAt: now,
        });
      }
    }
  } catch {
    // Revenue data unavailable -- skip silently
  }

  return anomalies;
}

async function scanFleetCount(role: Parameters<typeof gatewayFetch>[1]): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/samsara/vehicles', role);
    if (!res.success || !res.data) return anomalies;

    const data = res.data as Record<string, unknown>;
    const vehicles = Array.isArray(data) ? data : (data.vehicles ?? data.data ?? []);
    const count = Array.isArray(vehicles) ? vehicles.length : 0;

    const EXPECTED_MIN = 150;
    const NORMAL_COUNT = 160;

    if (count > 0 && count < EXPECTED_MIN) {
      anomalies.push({
        id: makeId(),
        metric: 'Fleet Count',
        description: `Fleet at ${count} vehicles (expected ~${NORMAL_COUNT})`,
        severity: count < 140 ? 'critical' : 'warning',
        category: 'fleet',
        value: count,
        threshold: EXPECTED_MIN,
        recommendedAction: 'Check vehicle maintenance status and deployment schedule',
        detectedAt: now,
      });
    }
  } catch {
    // Fleet data unavailable -- skip silently
  }

  return anomalies;
}

async function scanJeAmounts(role: Parameters<typeof gatewayFetch>[1]): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/query', role, {
      method: 'POST',
      body: {
        soql: `SELECT TOP 5 JournalNo, TotalDebit, PostedBy, PostDt
               FROM GLJournalEntry
               WHERE Year = 2026 AND TotalDebit > 100000
               ORDER BY TotalDebit DESC`,
      },
    });

    if (!res.success || !res.data) return anomalies;
    const rows = Array.isArray(res.data) ? res.data : [];

    const THRESHOLD = 500_000;
    for (const row of rows) {
      const record = row as Record<string, unknown>;
      const amount = Number(record['TotalDebit'] ?? 0);
      if (amount > THRESHOLD) {
        anomalies.push({
          id: makeId(),
          metric: 'Unusual JE Amount',
          description: `JE #${String(record['JournalNo'] ?? 'unknown')} for $${(amount / 1000).toFixed(0)}K — verify approval`,
          severity: amount > 1_000_000 ? 'critical' : 'warning',
          category: 'journal-entry',
          value: amount,
          threshold: THRESHOLD,
          recommendedAction: 'Verify journal entry has proper approval and supporting documentation',
          detectedAt: now,
        });
      }
    }
  } catch {
    // JE data unavailable -- skip silently
  }

  return anomalies;
}

async function scanCashPosition(role: Parameters<typeof gatewayFetch>[1]): Promise<AnomalyResult[]> {
  const anomalies: AnomalyResult[] = [];
  const now = new Date().toISOString();

  try {
    const res = await gatewayFetch('/ascend/query', role, {
      method: 'POST',
      body: {
        soql: `SELECT SUM(Balance) AS CashBalance
               FROM GLAccount
               WHERE AccountGroup = 'Cash and Cash Equivalents'`,
      },
    });

    if (!res.success || !res.data) return anomalies;
    const rows = Array.isArray(res.data) ? res.data : [];
    if (rows.length === 0) return anomalies;

    const record = rows[0] as Record<string, unknown>;
    const cashBalance = Number(record['CashBalance'] ?? 0);
    const LOW_THRESHOLD = 500_000;

    if (cashBalance > 0 && cashBalance < LOW_THRESHOLD) {
      anomalies.push({
        id: makeId(),
        metric: 'Cash Position',
        description: `Cash balance at $${(cashBalance / 1000).toFixed(0)}K — below $500K threshold`,
        severity: cashBalance < 250_000 ? 'critical' : 'warning',
        category: 'cash',
        value: cashBalance,
        threshold: LOW_THRESHOLD,
        recommendedAction: 'Review LOC utilization and upcoming AP obligations',
        detectedAt: now,
      });
    }
  } catch {
    // Cash data unavailable -- skip silently
  }

  return anomalies;
}

// ── Route handler ────────────────────────────────────────────

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // Return cached result if still valid
  if (anomalyCache && Date.now() < anomalyCache.expiresAt) {
    return NextResponse.json({
      success: true,
      anomalies: anomalyCache.anomalies,
      count: anomalyCache.anomalies.length,
      scannedAt: anomalyCache.scannedAt,
      cached: true,
    });
  }

  const email = session?.user?.email ?? '';
  const role = getUserRole(email);

  try {
    const [arAnomalies, revenueAnomalies, fleetAnomalies, jeAnomalies, cashAnomalies] = await Promise.all([
      scanArAging(role),
      scanRevenueTrend(role),
      scanFleetCount(role),
      scanJeAmounts(role),
      scanCashPosition(role),
    ]);

    const anomalies: AnomalyResult[] = [
      ...arAnomalies,
      ...revenueAnomalies,
      ...fleetAnomalies,
      ...jeAnomalies,
      ...cashAnomalies,
    ].sort((a, b) => {
      const sev: Record<AnomalySeverity, number> = { critical: 0, warning: 1, info: 2 };
      return sev[a.severity] - sev[b.severity];
    });

    // Route critical/warning anomalies to the notification inbox
    const alertResult = routeAnomalyAlerts(anomalies);

    // Cache the result
    const scannedAt = new Date().toISOString();
    anomalyCache = {
      anomalies,
      scannedAt,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return NextResponse.json({
      success: true,
      anomalies,
      count: anomalies.length,
      alerts: alertResult,
      scannedAt,
      cached: false,
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Anomaly scan failed' },
      { status: 500 }
    );
  }
}
