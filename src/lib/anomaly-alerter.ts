/**
 * Anomaly Alert Router
 *
 * Connects anomaly detection to the notification system.
 * Deduplicates alerts within a 4-hour window to avoid spam.
 *
 * Severity routing:
 *   critical -> inbox notification to admin users (email when Mail.Send is granted)
 *   warning  -> inbox notification to admin users
 *   info     -> log only, no notification
 */

import type { AnomalySeverity } from '@/lib/anomaly-detector';
import { addNotification } from '@/lib/notifications-inbox';
import type { NotificationType } from '@/lib/notifications-inbox';
import { getCriticalEventsInWindow } from '@/lib/samsara-events';

// ── Types ────────────────────────────────────────────────────

/** Minimal shape the alerter needs -- works with both Anomaly and AnomalyResult. */
interface AlertableAnomaly {
  readonly id: string;
  readonly metric: string;
  readonly description: string;
  readonly severity: AnomalySeverity;
}

interface AlertRecord {
  readonly anomalyId: string;
  readonly alertedAt: number;
}

interface RouteResult {
  readonly alerted: number;
  readonly skipped: number;
}

// ── Dedup store (in-memory, 4-hour window) ───────────────────

const alertHistory: AlertRecord[] = [];
const DEDUP_WINDOW_MS = 4 * 60 * 60 * 1000;

function wasRecentlyAlerted(anomalyId: string): boolean {
  const cutoff = Date.now() - DEDUP_WINDOW_MS;
  // Prune expired entries from the front
  while (alertHistory.length > 0 && alertHistory[0].alertedAt < cutoff) {
    alertHistory.shift();
  }
  return alertHistory.some((r) => r.anomalyId === anomalyId);
}

function recordAlert(anomalyId: string): void {
  alertHistory.push({ anomalyId, alertedAt: Date.now() });
}

// ── Severity -> NotificationType mapping ─────────────────────

function severityToNotificationType(severity: AnomalySeverity): NotificationType {
  switch (severity) {
    case 'critical':
      return 'alert';
    case 'warning':
      return 'warning';
    default:
      return 'info';
  }
}

// ── Admin list (in production, pull from user store) ─────────

const ADMIN_EMAILS: readonly string[] = ['etheiss@delta360.energy'];

// ── Main router ──────────────────────────────────────────────

/**
 * Process anomalies and route alerts to the notification inbox.
 * Call this after anomaly detection runs.
 */
export function routeAnomalyAlerts(anomalies: readonly AlertableAnomaly[]): RouteResult {
  let alerted = 0;
  let skipped = 0;

  for (const anomaly of anomalies) {
    // Info-level: log only
    if (anomaly.severity === 'info') {
      skipped++;
      continue;
    }

    // Dedup check
    if (wasRecentlyAlerted(anomaly.id)) {
      skipped++;
      continue;
    }

    const title =
      anomaly.severity === 'critical'
        ? `CRITICAL: ${anomaly.metric}`
        : `Warning: ${anomaly.metric}`;

    try {
      for (const email of ADMIN_EMAILS) {
        addNotification({
          title,
          body: anomaly.description,
          type: severityToNotificationType(anomaly.severity),
          actionUrl: '/analytics',
          userEmail: email,
        });
      }

      recordAlert(anomaly.id);
      alerted++;
    } catch (err) {
      console.error(
        `[AnomalyAlerter] Failed to route alert for ${anomaly.id}:`,
        err instanceof Error ? err.message : err,
      );
      skipped++;
    }
  }

  return { alerted, skipped };
}

// ── Samsara Safety Event Alerting ────────────────────────────

/**
 * Check for critical Samsara safety events (gForce > 0.5) in the last hour.
 * Routes them as alert-type notifications to admin users.
 */
export async function routeSafetyEventAlerts(): Promise<RouteResult> {
  let alerted = 0;
  let skipped = 0;

  try {
    const criticalEvents = await getCriticalEventsInWindow('admin', 1);

    for (const event of criticalEvents) {
      const alertId = `safety-${event.id}`;

      if (wasRecentlyAlerted(alertId)) {
        skipped++;
        continue;
      }

      const title = `CRITICAL: Safety Event — ${event.driverName}`;
      const body = [
        `Vehicle: ${event.vehicleName}`,
        `G-Force: ${event.gForce.toFixed(2)}`,
        `Behaviors: ${event.behaviors.join(', ') || 'Unknown'}`,
        `Location: ${event.location}`,
        `Time: ${event.time}`,
        event.forwardVideoUrl ? `Video available` : '',
      ]
        .filter(Boolean)
        .join(' | ');

      try {
        for (const email of ADMIN_EMAILS) {
          addNotification({
            title,
            body,
            type: 'alert' as NotificationType,
            actionUrl: '/fleet/events',
            userEmail: email,
          });
        }

        recordAlert(alertId);
        alerted++;
      } catch (err) {
        console.error(
          `[AnomalyAlerter] Failed to route safety alert for ${event.id}:`,
          err instanceof Error ? err.message : err,
        );
        skipped++;
      }
    }
  } catch (err) {
    console.error(
      '[AnomalyAlerter] Failed to fetch Samsara safety events:',
      err instanceof Error ? err.message : err,
    );
  }

  return { alerted, skipped };
}
