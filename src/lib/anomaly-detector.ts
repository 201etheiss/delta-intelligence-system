/**
 * Anomaly Detection Engine
 *
 * Compares current period metrics to historical baselines and flags
 * significant deviations. Returns structured anomaly objects with
 * severity levels for dashboard display and digest integration.
 */

// ── Types ─────────────────────────────────────────────────────

export type AnomalySeverity = 'critical' | 'warning' | 'info';

export interface Anomaly {
  id: string;
  metric: string;
  description: string;
  currentValue: number;
  baseline: number;
  deviation: number;
  severity: AnomalySeverity;
  category: 'revenue' | 'ar' | 'ap' | 'fleet' | 'pipeline' | 'cost';
  detectedAt: string;
}

interface MetricSnapshot {
  revenue?: number;
  previousRevenue?: number;
  arTotal?: number;
  previousArTotal?: number;
  apTotal?: number;
  previousApTotal?: number;
  vehicleCount?: number;
  previousVehicleCount?: number;
  pipelineTotal?: number;
  previousPipelineTotal?: number;
  costTotal?: number;
  previousCostTotal?: number;
}

// ── Thresholds ────────────────────────────────────────────────

const THRESHOLDS = {
  revenueDrop: 0.15,     // 15% drop = warning
  revenueDropCrit: 0.25, // 25% drop = critical
  arIncrease: 0.20,      // 20% AR increase = warning
  arIncreaseCrit: 0.35,  // 35% AR increase = critical
  apSpike: 0.25,         // 25% AP spike = warning
  fleetChange: 0.10,     // 10% fleet count change = info
  pipelineDrop: 0.20,    // 20% pipeline drop = warning
  costSpike: 0.20,       // 20% cost spike = warning
} as const;

// ── Detection ─────────────────────────────────────────────────

function generateId(): string {
  return `anomaly_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function calcDeviation(current: number, baseline: number): number {
  if (baseline === 0) return current === 0 ? 0 : 1;
  return (current - baseline) / Math.abs(baseline);
}

export function detectAnomalies(snapshot: MetricSnapshot): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const now = new Date().toISOString();

  // Revenue drop
  if (snapshot.revenue != null && snapshot.previousRevenue != null && snapshot.previousRevenue > 0) {
    const dev = calcDeviation(snapshot.revenue, snapshot.previousRevenue);
    if (dev <= -THRESHOLDS.revenueDropCrit) {
      anomalies.push({
        id: generateId(),
        metric: 'Revenue',
        description: `Revenue dropped ${Math.abs(dev * 100).toFixed(1)}% vs prior period`,
        currentValue: snapshot.revenue,
        baseline: snapshot.previousRevenue,
        deviation: dev,
        severity: 'critical',
        category: 'revenue',
        detectedAt: now,
      });
    } else if (dev <= -THRESHOLDS.revenueDrop) {
      anomalies.push({
        id: generateId(),
        metric: 'Revenue',
        description: `Revenue declined ${Math.abs(dev * 100).toFixed(1)}% vs prior period`,
        currentValue: snapshot.revenue,
        baseline: snapshot.previousRevenue,
        deviation: dev,
        severity: 'warning',
        category: 'revenue',
        detectedAt: now,
      });
    }
  }

  // AR increase
  if (snapshot.arTotal != null && snapshot.previousArTotal != null && snapshot.previousArTotal > 0) {
    const dev = calcDeviation(snapshot.arTotal, snapshot.previousArTotal);
    if (dev >= THRESHOLDS.arIncreaseCrit) {
      anomalies.push({
        id: generateId(),
        metric: 'Accounts Receivable',
        description: `AR increased ${(dev * 100).toFixed(1)}% — potential collections issue`,
        currentValue: snapshot.arTotal,
        baseline: snapshot.previousArTotal,
        deviation: dev,
        severity: 'critical',
        category: 'ar',
        detectedAt: now,
      });
    } else if (dev >= THRESHOLDS.arIncrease) {
      anomalies.push({
        id: generateId(),
        metric: 'Accounts Receivable',
        description: `AR grew ${(dev * 100).toFixed(1)}% vs prior period`,
        currentValue: snapshot.arTotal,
        baseline: snapshot.previousArTotal,
        deviation: dev,
        severity: 'warning',
        category: 'ar',
        detectedAt: now,
      });
    }
  }

  // AP spike
  if (snapshot.apTotal != null && snapshot.previousApTotal != null && snapshot.previousApTotal > 0) {
    const dev = calcDeviation(snapshot.apTotal, snapshot.previousApTotal);
    if (dev >= THRESHOLDS.apSpike) {
      anomalies.push({
        id: generateId(),
        metric: 'Accounts Payable',
        description: `AP spiked ${(dev * 100).toFixed(1)}% — unusual vendor spend`,
        currentValue: snapshot.apTotal,
        baseline: snapshot.previousApTotal,
        deviation: dev,
        severity: 'warning',
        category: 'ap',
        detectedAt: now,
      });
    }
  }

  // Fleet count change
  if (snapshot.vehicleCount != null && snapshot.previousVehicleCount != null && snapshot.previousVehicleCount > 0) {
    const dev = calcDeviation(snapshot.vehicleCount, snapshot.previousVehicleCount);
    if (Math.abs(dev) >= THRESHOLDS.fleetChange) {
      anomalies.push({
        id: generateId(),
        metric: 'Fleet Count',
        description: dev > 0
          ? `Fleet grew by ${(dev * 100).toFixed(1)}%`
          : `Fleet reduced by ${Math.abs(dev * 100).toFixed(1)}%`,
        currentValue: snapshot.vehicleCount,
        baseline: snapshot.previousVehicleCount,
        deviation: dev,
        severity: 'info',
        category: 'fleet',
        detectedAt: now,
      });
    }
  }

  // Pipeline drop
  if (snapshot.pipelineTotal != null && snapshot.previousPipelineTotal != null && snapshot.previousPipelineTotal > 0) {
    const dev = calcDeviation(snapshot.pipelineTotal, snapshot.previousPipelineTotal);
    if (dev <= -THRESHOLDS.pipelineDrop) {
      anomalies.push({
        id: generateId(),
        metric: 'Sales Pipeline',
        description: `Pipeline shrank ${Math.abs(dev * 100).toFixed(1)}% — may need attention`,
        currentValue: snapshot.pipelineTotal,
        baseline: snapshot.previousPipelineTotal,
        deviation: dev,
        severity: 'warning',
        category: 'pipeline',
        detectedAt: now,
      });
    }
  }

  // Cost spike
  if (snapshot.costTotal != null && snapshot.previousCostTotal != null && snapshot.previousCostTotal > 0) {
    const dev = calcDeviation(snapshot.costTotal, snapshot.previousCostTotal);
    if (dev >= THRESHOLDS.costSpike) {
      anomalies.push({
        id: generateId(),
        metric: 'Operating Costs',
        description: `Costs up ${(dev * 100).toFixed(1)}% — review vendor spend`,
        currentValue: snapshot.costTotal,
        baseline: snapshot.previousCostTotal,
        deviation: dev,
        severity: 'warning',
        category: 'cost',
        detectedAt: now,
      });
    }
  }

  return anomalies.sort((a, b) => {
    const sev = { critical: 0, warning: 1, info: 2 };
    return sev[a.severity] - sev[b.severity];
  });
}

/**
 * Generate mock anomalies for development/demo
 */
export function getMockAnomalies(): Anomaly[] {
  return detectAnomalies({
    revenue: 4_200_000,
    previousRevenue: 5_100_000,
    arTotal: 3_800_000,
    previousArTotal: 3_000_000,
    apTotal: 1_500_000,
    previousApTotal: 1_100_000,
    vehicleCount: 157,
    previousVehicleCount: 160,
    pipelineTotal: 2_100_000,
    previousPipelineTotal: 2_800_000,
  });
}
