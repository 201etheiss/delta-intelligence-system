/**
 * Nova Proactive Alert System
 *
 * Runs periodic checks against live data sources and returns BriefingItems
 * when conditions are met. Each check is independent with its own interval.
 * startProactiveLoop() is designed to be called once from a server-side
 * context (e.g., app initialization or a background route).
 */

import type { BriefingItem } from './briefing-engine';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ─────────────────────────────────────────────────────

export interface ProactiveCheck {
  id: string;
  name: string;
  description: string;
  check: () => Promise<BriefingItem | null>;
  interval: number; // seconds
}

// ── Helpers ───────────────────────────────────────────────────

function makeId(): string {
  return `pc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function safeCount(data: unknown): number {
  if (typeof data === 'number') return data;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object' && 'count' in data) {
    const c = (data as { count: unknown }).count;
    return typeof c === 'number' ? c : 0;
  }
  return 0;
}

async function ascendCount(sql: string): Promise<number> {
  try {
    const result = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: { sql },
      timeout: 8000,
    });
    const rows = Array.isArray(result.data) ? result.data : [];
    return rows.length > 0 ? safeCount(rows[0]) : 0;
  } catch {
    return 0;
  }
}

// ── Proactive Checks ──────────────────────────────────────────

export const PROACTIVE_CHECKS: ProactiveCheck[] = [
  {
    id: 'ap-overdue',
    name: 'AP Overdue Invoices',
    description: 'Check for invoices past their payment terms',
    interval: 3600, // hourly
    check: async (): Promise<BriefingItem | null> => {
      const count = await ascendCount(
        `SELECT COUNT(*) as count FROM APInvoice WHERE DueDate < GETDATE() AND PaidDate IS NULL AND Status != 'Void'`
      );
      if (count === 0) return null;
      return {
        id: makeId(),
        type: 'action',
        priority: count > 10 ? 'critical' : count > 5 ? 'high' : 'medium',
        title: `${count} AP invoice${count !== 1 ? 's' : ''} past due`,
        description: `${count} vendor payment${count !== 1 ? 's' : ''} are overdue. Review and process to maintain vendor relationships.`,
        module: 'Accounts Payable',
        actionUrl: '/ap?filter=overdue',
        actionLabel: 'Review Overdue AP',
        timestamp: new Date().toISOString(),
        metadata: { count },
      };
    },
  },

  {
    id: 'ar-aging-spike',
    name: 'AR Aging Spike',
    description: 'Detect sudden increases in AR aging buckets',
    interval: 3600, // hourly
    check: async (): Promise<BriefingItem | null> => {
      // Compare AR 60+ day bucket vs last week
      const currentCount = await ascendCount(
        `SELECT COUNT(*) as count FROM ARInvoice WHERE DueDate < DATEADD(day, -60, GETDATE()) AND PaidDate IS NULL AND Status != 'Void'`
      );
      if (currentCount === 0) return null;
      // Flag if 60+ day bucket has any entries (simple threshold for now)
      if (currentCount < 5) return null;
      return {
        id: makeId(),
        type: 'alert',
        priority: currentCount > 20 ? 'critical' : 'high',
        title: `${currentCount} AR invoice${currentCount !== 1 ? 's' : ''} 60+ days outstanding`,
        description: `${currentCount} customer invoice${currentCount !== 1 ? 's' : ''} in 60+ day aging bucket. Collections action may be needed.`,
        module: 'Accounts Receivable',
        actionUrl: '/ar?filter=60plus',
        actionLabel: 'View AR Aging',
        timestamp: new Date().toISOString(),
        metadata: { count: currentCount },
      };
    },
  },

  {
    id: 'rack-price-movement',
    name: 'DTN Rack Price Movement',
    description: 'Alert on significant fuel price changes',
    interval: 1800, // 30 min
    check: async (): Promise<BriefingItem | null> => {
      try {
        const result = await gatewayFetch('/ascend/query', 'admin', {
          method: 'POST',
          body: {
            sql: `SELECT TOP 2 vRackPrice, PriceDate FROM DTNRackPrices ORDER BY PriceDate DESC`,
          },
          timeout: 8000,
        });
        const rows = Array.isArray(result.data) ? result.data : [];
        if (rows.length < 2) return null;

        const latest = rows[0] as { vRackPrice?: number; PriceDate?: string };
        const prior = rows[1] as { vRackPrice?: number };

        if (!latest.vRackPrice || !prior.vRackPrice || prior.vRackPrice === 0) return null;

        const changePct = ((latest.vRackPrice - prior.vRackPrice) / prior.vRackPrice) * 100;
        if (Math.abs(changePct) < 5) return null;

        const direction = changePct > 0 ? 'up' : 'down';
        return {
          id: makeId(),
          type: 'alert',
          priority: Math.abs(changePct) > 10 ? 'high' : 'medium',
          title: `Rack price moved ${direction} ${Math.abs(changePct).toFixed(1)}%`,
          description: `DTN rack price ${direction} to $${latest.vRackPrice.toFixed(3)}/gal from $${prior.vRackPrice.toFixed(3)}/gal.`,
          module: 'Fuel Pricing',
          actionUrl: '/cockpit',
          actionLabel: 'View Pricing',
          timestamp: new Date().toISOString(),
          metadata: { latest: latest.vRackPrice, prior: prior.vRackPrice, changePct },
        };
      } catch {
        return null;
      }
    },
  },

  {
    id: 'fleet-anomaly',
    name: 'Fleet Anomaly',
    description: 'Vehicles outside expected locations or patterns',
    interval: 900, // 15 min
    check: async (): Promise<BriefingItem | null> => {
      try {
        const result = await gatewayFetch('/samsara/vehicles', 'admin', {
          method: 'GET',
          timeout: 8000,
        });

        if (!result.success || !result.data) return null;

        const vehicles = Array.isArray(result.data) ? result.data : [];
        const offlineVehicles = vehicles.filter(
          (v: unknown) =>
            v &&
            typeof v === 'object' &&
            'status' in v &&
            (v as { status: string }).status === 'offline'
        );

        if (offlineVehicles.length === 0) return null;

        return {
          id: makeId(),
          type: 'alert',
          priority: offlineVehicles.length > 5 ? 'high' : 'medium',
          title: `${offlineVehicles.length} vehicle${offlineVehicles.length !== 1 ? 's' : ''} offline`,
          description: `${offlineVehicles.length} fleet vehicle${offlineVehicles.length !== 1 ? 's' : ''} showing as offline in Samsara. Check connectivity or driver status.`,
          module: 'Fleet',
          actionUrl: '/fleet',
          actionLabel: 'View Fleet',
          timestamp: new Date().toISOString(),
          metadata: { offlineCount: offlineVehicles.length },
        };
      } catch {
        return null;
      }
    },
  },

  {
    id: 'close-deadline',
    name: 'Close Deadline Approaching',
    description: 'Month-end close tasks not yet completed',
    interval: 3600, // hourly
    check: async (): Promise<BriefingItem | null> => {
      const now = new Date();
      const dayOfMonth = now.getDate();
      const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const daysLeft = daysInMonth - dayOfMonth;

      // Only alert in the last 5 business days of the month
      if (daysLeft > 5) return null;

      // Check if close is already done via event store
      try {
        const res = await fetch(
          `/api/events?type=close.completed&limit=1`,
          { signal: AbortSignal.timeout(5000) }
        );
        if (res.ok) {
          const json = await res.json() as { data?: unknown[] };
          const events = json.data ?? [];
          if (events.length > 0) {
            // Close event found — period already closed
            return null;
          }
        }
      } catch {
        // Event store unavailable — still surface deadline warning
      }

      const monthName = now.toLocaleString('default', { month: 'long' });
      return {
        id: makeId(),
        type: 'action',
        priority: daysLeft <= 2 ? 'critical' : 'high',
        title: `${monthName} close: ${daysLeft} day${daysLeft !== 1 ? 's' : ''} remaining`,
        description: `Month-end close for ${monthName} must be completed. Verify all journal entries, reconciliations, and approvals.`,
        module: 'Close Tracker',
        actionUrl: '/close',
        actionLabel: 'Open Close Tracker',
        timestamp: new Date().toISOString(),
        metadata: { daysLeft, month: monthName },
      };
    },
  },
];

// ── Loop State ────────────────────────────────────────────────

interface CheckTimer {
  id: string;
  timer: ReturnType<typeof setInterval>;
}

const activeTimers: CheckTimer[] = [];
let triggeredCallback: ((items: BriefingItem[]) => void) | null = null;

/**
 * Run all proactive checks once and return triggered items.
 */
export async function runProactiveChecks(): Promise<BriefingItem[]> {
  const results = await Promise.allSettled(
    PROACTIVE_CHECKS.map((c) => c.check())
  );

  return results
    .filter(
      (r): r is PromiseFulfilledResult<BriefingItem> =>
        r.status === 'fulfilled' && r.value !== null
    )
    .map((r) => r.value);
}

/**
 * Start the proactive check loop. Calls onTriggered callback when items fire.
 * Safe to call multiple times — will not create duplicate timers.
 */
export function startProactiveLoop(
  onTriggered?: (items: BriefingItem[]) => void
): void {
  if (activeTimers.length > 0) return; // Already running

  if (onTriggered) {
    triggeredCallback = onTriggered;
  }

  for (const check of PROACTIVE_CHECKS) {
    const timer = setInterval(async () => {
      try {
        const result = await check.check();
        if (result && triggeredCallback) {
          triggeredCallback([result]);
        }
      } catch {
        // Check failed silently
      }
    }, check.interval * 1000);

    activeTimers.push({ id: check.id, timer });
  }
}

/**
 * Stop all proactive check loops.
 */
export function stopProactiveLoop(): void {
  for (const { timer } of activeTimers) {
    clearInterval(timer);
  }
  activeTimers.length = 0;
  triggeredCallback = null;
}
