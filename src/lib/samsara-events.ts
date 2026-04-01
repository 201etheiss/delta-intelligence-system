/**
 * Samsara Event Processing
 *
 * Fetches, processes, and categorizes fleet safety events, defects, and diagnostics
 * from the Samsara gateway endpoint. Classifies severity by g-force thresholds
 * and aggregates stats by driver, vehicle, and behavior type.
 */

import { gatewayGet } from '@/lib/gateway';
import type { UserRole } from '@/lib/config/roles';

// ── Types ────────────────────────────────────────────────────

export interface SafetyEvent {
  readonly id: string;
  readonly driverName: string;
  readonly driverId: string;
  readonly vehicleName: string;
  readonly vehicleId: string;
  readonly time: string;
  readonly gForce: number;
  readonly location: string;
  readonly coachingState: string;
  readonly behaviors: readonly string[];
  readonly forwardVideoUrl?: string;
  readonly inwardVideoUrl?: string;
  readonly severity: 'critical' | 'warning' | 'info';
}

export interface SafetyStats {
  readonly totalEvents: number;
  readonly byDriver: Readonly<Record<string, number>>;
  readonly byVehicle: Readonly<Record<string, number>>;
  readonly byBehavior: Readonly<Record<string, number>>;
  readonly criticalCount: number;
  readonly averageGForce: number;
}

export interface DefectRecord {
  readonly id: string;
  readonly vehicleName: string;
  readonly vehicleId: string;
  readonly defectType: string;
  readonly severity: string;
  readonly reportedAt: string;
  readonly resolvedAt?: string;
  readonly isResolved: boolean;
}

// ── Raw Samsara response shapes ──────────────────────────────

interface RawSamsaraAlert {
  id?: string;
  driver?: { id?: string; name?: string };
  vehicle?: { id?: string; name?: string };
  time?: string;
  maxAccelerationGForce?: number;
  location?: { formattedLocation?: string; latitude?: number; longitude?: number };
  coachingState?: string;
  behaviorLabels?: string[];
  forwardVideoUrl?: string;
  inwardVideoUrl?: string;
  [key: string]: unknown;
}

interface RawSamsaraDefect {
  id?: string;
  vehicle?: { id?: string; name?: string };
  defectType?: string;
  severity?: string;
  createdAtTime?: string;
  resolvedAtTime?: string;
  isResolved?: boolean;
  [key: string]: unknown;
}

// ── Severity classification ──────────────────────────────────

function classifySeverity(gForce: number): 'critical' | 'warning' | 'info' {
  if (gForce > 0.5) return 'critical';
  if (gForce > 0.3) return 'warning';
  return 'info';
}

// ── Behavior label normalization ─────────────────────────────

const BEHAVIOR_MAP: Readonly<Record<string, string>> = {
  harshBraking: 'Harsh Braking',
  harshAcceleration: 'Harsh Acceleration',
  harshTurn: 'Harsh Turn',
  speeding: 'Speeding',
  distractedDriving: 'Distracted Driving',
  drowsyDriving: 'Drowsy Driving',
  closeFollowing: 'Close Following',
  seatbeltViolation: 'Seatbelt Violation',
  rollingStop: 'Rolling Stop',
  laneDeviation: 'Lane Deviation',
  collision: 'Collision',
  nearCollision: 'Near Collision',
};

function normalizeBehavior(label: string): string {
  return BEHAVIOR_MAP[label] ?? label;
}

// ── Parsing ──────────────────────────────────────────────────

function parseAlert(raw: RawSamsaraAlert): SafetyEvent {
  const gForce = raw.maxAccelerationGForce ?? 0;
  const behaviors = (raw.behaviorLabels ?? []).map(normalizeBehavior);

  return {
    id: raw.id ?? `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    driverName: raw.driver?.name ?? 'Unknown Driver',
    driverId: raw.driver?.id ?? '',
    vehicleName: raw.vehicle?.name ?? 'Unknown Vehicle',
    vehicleId: raw.vehicle?.id ?? '',
    time: raw.time ?? new Date().toISOString(),
    gForce,
    location: raw.location?.formattedLocation ?? 'Unknown Location',
    coachingState: raw.coachingState ?? 'unknown',
    behaviors,
    forwardVideoUrl: raw.forwardVideoUrl ?? undefined,
    inwardVideoUrl: raw.inwardVideoUrl ?? undefined,
    severity: classifySeverity(gForce),
  };
}

function parseDefect(raw: RawSamsaraDefect): DefectRecord {
  return {
    id: raw.id ?? `def-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    vehicleName: raw.vehicle?.name ?? 'Unknown Vehicle',
    vehicleId: raw.vehicle?.id ?? '',
    defectType: raw.defectType ?? 'Unknown',
    severity: raw.severity ?? 'unknown',
    reportedAt: raw.createdAtTime ?? new Date().toISOString(),
    resolvedAt: raw.resolvedAtTime ?? undefined,
    isResolved: raw.isResolved ?? false,
  };
}

// ── Fetch functions ──────────────────────────────────────────

/**
 * Fetch safety events from the Samsara gateway alerts endpoint.
 * Optionally filter to events within the last N days.
 */
export async function fetchSafetyEvents(
  role: UserRole = 'admin',
  days?: number
): Promise<readonly SafetyEvent[]> {
  const response = await gatewayGet('/samsara/alerts', role);

  if (!response.success || !response.data) {
    console.error('[SamsaraEvents] Failed to fetch safety events:', response.error);
    return [];
  }

  const rawAlerts = Array.isArray(response.data) ? response.data : [];
  const events = rawAlerts.map((raw: RawSamsaraAlert) => parseAlert(raw));

  if (days !== undefined && days > 0) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffMs = cutoff.getTime();
    return events.filter((e) => new Date(e.time).getTime() >= cutoffMs);
  }

  return events;
}

/**
 * Fetch vehicle defects from the Samsara gateway.
 */
export async function fetchDefects(
  role: UserRole = 'admin'
): Promise<readonly DefectRecord[]> {
  const response = await gatewayGet('/samsara/defects', role);

  if (!response.success || !response.data) {
    console.error('[SamsaraEvents] Failed to fetch defects:', response.error);
    return [];
  }

  const rawDefects = Array.isArray(response.data) ? response.data : [];
  return rawDefects.map((raw: RawSamsaraDefect) => parseDefect(raw));
}

// ── Stats aggregation ────────────────────────────────────────

/**
 * Compute aggregate safety statistics from a list of events.
 */
export function computeSafetyStats(events: readonly SafetyEvent[]): SafetyStats {
  const byDriver: Record<string, number> = {};
  const byVehicle: Record<string, number> = {};
  const byBehavior: Record<string, number> = {};
  let criticalCount = 0;
  let totalGForce = 0;

  for (const event of events) {
    byDriver[event.driverName] = (byDriver[event.driverName] ?? 0) + 1;
    byVehicle[event.vehicleName] = (byVehicle[event.vehicleName] ?? 0) + 1;

    for (const behavior of event.behaviors) {
      byBehavior[behavior] = (byBehavior[behavior] ?? 0) + 1;
    }

    if (event.severity === 'critical') {
      criticalCount++;
    }

    totalGForce += event.gForce;
  }

  return {
    totalEvents: events.length,
    byDriver,
    byVehicle,
    byBehavior,
    criticalCount,
    averageGForce: events.length > 0 ? totalGForce / events.length : 0,
  };
}

/**
 * Convenience: fetch events and compute stats in one call.
 */
export async function getSafetyStats(
  role: UserRole = 'admin',
  days?: number
): Promise<SafetyStats> {
  const events = await fetchSafetyEvents(role, days);
  return computeSafetyStats(events);
}

// ── Critical event detection (for alerting) ──────────────────

/**
 * Returns critical safety events (gForce > 0.5) from the last N hours.
 * Used by the anomaly alerter to route urgent notifications.
 */
export async function getCriticalEventsInWindow(
  role: UserRole = 'admin',
  hoursBack: number = 1
): Promise<readonly SafetyEvent[]> {
  const events = await fetchSafetyEvents(role);
  const cutoff = Date.now() - hoursBack * 60 * 60 * 1000;

  return events.filter(
    (e) => e.severity === 'critical' && new Date(e.time).getTime() >= cutoff
  );
}
