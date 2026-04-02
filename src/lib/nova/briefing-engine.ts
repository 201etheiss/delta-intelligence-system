/**
 * Nova Briefing Engine
 *
 * Generates proactive daily briefings by aggregating data from the gateway,
 * event store, anomaly detector, and automation system. Falls back gracefully
 * if any source is unavailable.
 */

import { gatewayFetch } from '@/lib/gateway';
import { getMockAnomalies } from '@/lib/anomaly-detector';

// ── Types ─────────────────────────────────────────────────────

export interface BriefingItem {
  id: string;
  type: 'anomaly' | 'change' | 'action' | 'insight' | 'alert' | 'milestone';
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  module: string;
  actionUrl?: string;
  actionLabel?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
  isMock?: boolean;
}

export interface DailyBriefing {
  generatedAt: string;
  greeting: string;
  summary: string;
  items: BriefingItem[];
  stats: {
    totalChanges: number;
    criticalActions: number;
    automationRuns: number;
    anomaliesDetected: number;
  };
  hasMockData?: boolean;
}

// ── In-memory cache ───────────────────────────────────────────

interface CachedBriefing {
  briefing: DailyBriefing;
  cachedAt: number;
}

// Cache TTL: 10 minutes
const CACHE_TTL_MS = 10 * 60 * 1000;
let briefingCache: CachedBriefing | null = null;

function isCacheValid(): boolean {
  if (!briefingCache) return false;
  return Date.now() - briefingCache.cachedAt < CACHE_TTL_MS;
}

// ── Helpers ───────────────────────────────────────────────────

function generateItemId(): string {
  return `brf_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getYesterday(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().split('T')[0] ?? '';
}

function safeCount(data: unknown): number {
  if (typeof data === 'number') return data;
  if (Array.isArray(data)) return data.length;
  if (data && typeof data === 'object' && 'count' in data) {
    return typeof (data as { count: unknown }).count === 'number'
      ? (data as { count: number }).count
      : 0;
  }
  return 0;
}

// ── Data Fetchers ─────────────────────────────────────────────

export async function getRecentChanges(since: string): Promise<BriefingItem[]> {
  const items: BriefingItem[] = [];
  const yesterday = since || getYesterday();

  try {
    const apResult = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: {
        sql: `SELECT COUNT(*) as count FROM APInvoice WHERE DateCreated > '${yesterday}'`,
      },
      timeout: 8000,
    });

    const apRows = Array.isArray(apResult.data) ? apResult.data : [];
    const apCount = apRows.length > 0 ? safeCount(apRows[0]) : 0;

    if (apCount > 0) {
      items.push({
        id: generateItemId(),
        type: 'change',
        priority: 'medium',
        title: `${apCount} new AP invoice${apCount !== 1 ? 's' : ''} since yesterday`,
        description: `${apCount} vendor invoice${apCount !== 1 ? 's' : ''} posted overnight. Review in AP module.`,
        module: 'Accounts Payable',
        actionUrl: '/ap',
        actionLabel: 'View AP',
        timestamp: new Date().toISOString(),
        metadata: { count: apCount },
      });
    }
  } catch {
    // Gateway unavailable — skip AP change
  }

  try {
    const arResult = await gatewayFetch('/ascend/query', 'admin', {
      method: 'POST',
      body: {
        sql: `SELECT COUNT(*) as count FROM ARInvoice WHERE DateCreated > '${yesterday}'`,
      },
      timeout: 8000,
    });

    const arRows = Array.isArray(arResult.data) ? arResult.data : [];
    const arCount = arRows.length > 0 ? safeCount(arRows[0]) : 0;

    if (arCount > 0) {
      items.push({
        id: generateItemId(),
        type: 'change',
        priority: 'low',
        title: `${arCount} new AR invoice${arCount !== 1 ? 's' : ''} since yesterday`,
        description: `${arCount} customer invoice${arCount !== 1 ? 's' : ''} created. Check receivables aging.`,
        module: 'Accounts Receivable',
        actionUrl: '/ar',
        actionLabel: 'View AR',
        timestamp: new Date().toISOString(),
        metadata: { count: arCount },
      });
    }
  } catch {
    // Gateway unavailable — skip AR change
  }

  return items;
}

export async function getActionItems(role: string): Promise<BriefingItem[]> {
  const items: BriefingItem[] = [];

  // Role-scoped action items — accounting/admin get AP overdue check
  if (role === 'admin' || role === 'accounting') {
    try {
      const result = await gatewayFetch('/ascend/query', 'admin', {
        method: 'POST',
        body: {
          sql: `SELECT COUNT(*) as count FROM APInvoice WHERE DueDate < GETDATE() AND PaidDate IS NULL AND Status != 'Void'`,
        },
        timeout: 8000,
      });

      const rows = Array.isArray(result.data) ? result.data : [];
      const overdueCount = rows.length > 0 ? safeCount(rows[0]) : 0;

      if (overdueCount > 0) {
        items.push({
          id: generateItemId(),
          type: 'action',
          priority: overdueCount > 10 ? 'critical' : overdueCount > 5 ? 'high' : 'medium',
          title: `${overdueCount} AP invoice${overdueCount !== 1 ? 's' : ''} past due`,
          description: `${overdueCount} vendor payment${overdueCount !== 1 ? 's' : ''} overdue. Vendor relationships may be at risk.`,
          module: 'Accounts Payable',
          actionUrl: '/ap?filter=overdue',
          actionLabel: 'Review Overdue AP',
          timestamp: new Date().toISOString(),
          metadata: { count: overdueCount },
        });
      }
    } catch {
      // Gateway unavailable
    }
  }

  // Check automation run status for all roles
  try {
    const autoResult = await fetch('/api/automations', { signal: AbortSignal.timeout(5000) });
    if (autoResult.ok) {
      const autoData = await autoResult.json() as {
        automations?: Array<{ name: string; enabled: boolean; lastRunStatus: string | null }>;
      };
      const failed = (autoData.automations ?? []).filter(
        (a) => a.enabled && a.lastRunStatus === 'error'
      );
      if (failed.length > 0) {
        items.push({
          id: generateItemId(),
          type: 'alert',
          priority: 'high',
          title: `${failed.length} automation${failed.length !== 1 ? 's' : ''} failed`,
          description: `Failed: ${failed.map((a) => a.name).slice(0, 3).join(', ')}${failed.length > 3 ? ` +${failed.length - 3} more` : ''}`,
          module: 'Automations',
          actionUrl: '/automations',
          actionLabel: 'Review Automations',
          timestamp: new Date().toISOString(),
          metadata: { failedNames: failed.map((a) => a.name) },
        });
      }
    }
  } catch {
    // Automations API unavailable
  }

  return items;
}

export async function getAnomalies(): Promise<BriefingItem[]> {
  // Try event store first, fall back to the anomaly detector mock
  try {
    const res = await fetch('/api/events?type=anomaly.detected&limit=10', {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      const json = await res.json() as {
        success: boolean;
        data?: Array<{
          id?: string;
          type: string;
          timestamp?: string;
          payload?: { description?: string; severity?: string; metric?: string; category?: string };
        }>;
      };

      const events = json.data ?? [];
      if (events.length > 0) {
        return events.map((ev) => ({
          id: generateItemId(),
          type: 'anomaly' as const,
          priority: ev.payload?.severity === 'critical' ? 'critical' as const
            : ev.payload?.severity === 'warning' ? 'high' as const
            : 'medium' as const,
          title: ev.payload?.metric ? `Anomaly: ${ev.payload.metric}` : 'Anomaly Detected',
          description: ev.payload?.description ?? 'Metric deviation detected',
          module: ev.payload?.category ?? 'Analytics',
          actionUrl: '/analytics',
          actionLabel: 'View Analytics',
          timestamp: ev.timestamp ?? new Date().toISOString(),
          metadata: ev.payload,
        }));
      }
    }
  } catch {
    // Event store unavailable
  }

  // Fall back to anomaly detector (uses mock data when gateway is absent)
  const detected = getMockAnomalies();
  return detected.map((a) => ({
    id: generateItemId(),
    type: 'anomaly' as const,
    priority: a.severity === 'critical' ? 'critical' as const
      : a.severity === 'warning' ? 'high' as const
      : 'low' as const,
    title: `Anomaly: ${a.metric}`,
    description: a.description,
    module: a.category.charAt(0).toUpperCase() + a.category.slice(1),
    actionUrl: '/analytics',
    actionLabel: 'View Analytics',
    timestamp: a.detectedAt,
    metadata: {
      currentValue: a.currentValue,
      baseline: a.baseline,
      deviation: a.deviation,
    },
    isMock: true,
  }));
}

export async function getCrossModuleInsights(): Promise<BriefingItem[]> {
  const items: BriefingItem[] = [];

  try {
    // Check service health for cross-module insight
    const healthRes = await fetch('/api/admin/health', { signal: AbortSignal.timeout(5000) });
    if (healthRes.ok) {
      const health = await healthRes.json() as {
        services?: Array<{ name: string; status: string; error?: string }>;
      };
      const degraded = (health.services ?? []).filter(
        (s) => s.status === 'degraded' || s.status === 'error'
      );
      if (degraded.length > 0) {
        items.push({
          id: generateItemId(),
          type: 'insight',
          priority: 'medium',
          title: `${degraded.length} data service${degraded.length !== 1 ? 's' : ''} degraded`,
          description: `Affected: ${degraded.map((s) => s.name).join(', ')}. Data freshness may be impacted across modules.`,
          module: 'System',
          actionUrl: '/admin/health',
          actionLabel: 'View Health',
          timestamp: new Date().toISOString(),
          metadata: { services: degraded.map((s) => s.name) },
        });
      }
    }
  } catch {
    // Health check unavailable
  }

  return items;
}

// ── Main Briefing Generator ───────────────────────────────────

export async function generateBriefing(userEmail: string, role: string): Promise<DailyBriefing> {
  // Return cached briefing if still valid
  if (isCacheValid() && briefingCache) {
    return briefingCache.briefing;
  }

  const yesterday = getYesterday();
  const now = new Date().toISOString();

  // Fetch all sources in parallel with graceful degradation
  const [changes, actions, anomalies, insights] = await Promise.allSettled([
    getRecentChanges(yesterday),
    getActionItems(role),
    getAnomalies(),
    getCrossModuleInsights(),
  ]);

  const allItems: BriefingItem[] = [
    ...(changes.status === 'fulfilled' ? changes.value : []),
    ...(actions.status === 'fulfilled' ? actions.value : []),
    ...(anomalies.status === 'fulfilled' ? anomalies.value : []),
    ...(insights.status === 'fulfilled' ? insights.value : []),
  ];

  // Sort by priority: critical → high → medium → low
  const priorityOrder: Record<BriefingItem['priority'], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
  };
  const sortedItems = [...allItems].sort(
    (a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]
  );

  // Compute stats
  const changeItems = sortedItems.filter((i) => i.type === 'change');
  const criticalItems = sortedItems.filter(
    (i) => i.priority === 'critical' || i.priority === 'high'
  );
  const anomalyItems = sortedItems.filter((i) => i.type === 'anomaly');

  // Automation run count
  let automationRuns = 0;
  try {
    const autoRes = await fetch('/api/automations', { signal: AbortSignal.timeout(5000) });
    if (autoRes.ok) {
      const autoData = await autoRes.json() as {
        automations?: Array<{ lastRunStatus: string | null }>;
      };
      automationRuns = (autoData.automations ?? []).filter(
        (a) => a.lastRunStatus !== null
      ).length;
    }
  } catch {
    // ignore
  }

  const stats = {
    totalChanges: changeItems.length,
    criticalActions: criticalItems.length,
    automationRuns,
    anomaliesDetected: anomalyItems.length,
  };

  // Build summary sentence
  const parts: string[] = [];
  if (stats.criticalActions > 0) {
    parts.push(`${stats.criticalActions} item${stats.criticalActions !== 1 ? 's' : ''} need${stats.criticalActions === 1 ? 's' : ''} attention`);
  }
  if (stats.totalChanges > 0) {
    parts.push(`${stats.totalChanges} overnight change${stats.totalChanges !== 1 ? 's' : ''}`);
  }
  if (stats.anomaliesDetected > 0) {
    parts.push(`${stats.anomaliesDetected} anomal${stats.anomaliesDetected !== 1 ? 'ies' : 'y'} detected`);
  }
  if (parts.length === 0) {
    parts.push('All systems normal');
  }

  const hasMockData = sortedItems.some((item) => item.isMock === true);

  const briefing: DailyBriefing = {
    generatedAt: now,
    greeting: getGreeting(),
    summary: parts.join(', '),
    items: sortedItems,
    stats,
    hasMockData,
  };

  // Store in cache
  briefingCache = { briefing, cachedAt: Date.now() };

  return briefing;
}

/**
 * Force-invalidate the briefing cache and regenerate.
 */
export async function refreshBriefing(userEmail: string, role: string): Promise<DailyBriefing> {
  briefingCache = null;
  return generateBriefing(userEmail, role);
}
