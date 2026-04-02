/**
 * Delta360 App Registry
 * Central registry of all platform apps for cross-app integration.
 * Used by AppSwitcher, data bridge, and route mapping.
 */

export interface AppModule {
  readonly id: string;
  readonly label: string;
  readonly path: string;
}

export interface AppInfo {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly description: string;
  readonly icon: string;           // Lucide icon name
  readonly url: string;            // Base URL
  readonly healthPath: string;     // Health check endpoint path
  readonly spokeId: string | null; // Matching spoke ID in spoke-registry, null for DI itself
  readonly githubRepo: string;     // GitHub repo slug (owner/repo)
  readonly modules: readonly AppModule[];
  readonly capabilities: readonly string[];
  readonly status: 'live' | 'dev' | 'deployed' | 'planned';
}

export type AppHealth = 'healthy' | 'degraded' | 'down' | 'unknown';

const APPS: readonly AppInfo[] = [
  {
    id: 'delta-intelligence',
    name: 'Delta Intelligence',
    shortName: 'DI',
    description: 'Enterprise AI + ERP platform — the DataOS hub',
    icon: 'Brain',
    url: process.env.NEXT_PUBLIC_DI_URL || 'http://localhost:3004',
    healthPath: '/api/admin/health',
    spokeId: null,
    githubRepo: '201etheiss/delta-intelligence-system',
    modules: [
      { id: 'finance', label: 'Finance', path: '/finance' },
      { id: 'operations', label: 'Operations', path: '/fleet-map' },
      { id: 'intelligence', label: 'Intelligence', path: '/executive' },
      { id: 'organization', label: 'Organization', path: '/people' },
      { id: 'compliance', label: 'Compliance', path: '/vault' },
      { id: 'admin', label: 'Admin', path: '/admin/users' },
      { id: 'platform', label: 'Platform', path: '/platform' },
      { id: 'erp', label: 'ERP', path: '/erp' },
    ],
    capabilities: ['analytics', 'ai-chat', 'reporting', 'automations', 'erp', 'dashboards'],
    status: 'dev',
  },
  {
    id: 'delta-portal',
    name: 'Delta Portal',
    shortName: 'Portal',
    description: 'Customer-facing ordering, tracking, and account management',
    icon: 'ShoppingCart',
    url: process.env.NEXT_PUBLIC_PORTAL_URL || 'http://localhost:3000',
    healthPath: '/api/health',
    spokeId: 'delta-portal',
    githubRepo: '201etheiss/delta-portal',
    modules: [
      { id: 'dashboard', label: 'Dashboard', path: '/dashboard' },
      { id: 'orders', label: 'Orders', path: '/orders' },
      { id: 'products', label: 'Products', path: '/products' },
      { id: 'invoices', label: 'Invoices', path: '/invoices' },
      { id: 'tracking', label: 'Tracking', path: '/tracking' },
      { id: 'leasing', label: 'Leasing', path: '/leasing' },
      { id: 'insights', label: 'Insights', path: '/insights' },
      { id: 'account', label: 'Account', path: '/account' },
      { id: 'quotes', label: 'Quotes', path: '/quotes' },
      { id: 'admin', label: 'Admin', path: '/admin' },
    ],
    capabilities: ['orders', 'invoices', 'tracking', 'pricing', 'leasing', 'kyc', 'payments'],
    status: 'dev',
  },
  {
    id: 'equipment-tracker',
    name: 'Equipment Tracker',
    shortName: 'ET',
    description: 'Multi-tier asset tracking for 7,613 field equipment units',
    icon: 'MapPin',
    url: process.env.NEXT_PUBLIC_ET_URL || 'https://equipment-tracker-tau.vercel.app',
    healthPath: '/api/gateway/status',
    spokeId: 'equipment-tracker',
    githubRepo: '201etheiss/delta360-equipment-tracker',
    modules: [
      { id: 'dashboard', label: 'Dashboard', path: '/' },
      { id: 'equipment', label: 'Equipment', path: '/equipment' },
      { id: 'fleet-map', label: 'Fleet Map', path: '/fleet-map' },
      { id: 'alerts', label: 'Alerts', path: '/alerts' },
      { id: 'dispatch', label: 'Dispatch', path: '/dispatch' },
      { id: 'analytics', label: 'Analytics', path: '/analytics' },
      { id: 'reports', label: 'Reports', path: '/reports' },
    ],
    capabilities: ['asset-tracking', 'geofencing', 'alerts', 'dispatch', 'fleet-gps', 'fuel-monitoring'],
    status: 'live',
  },
  {
    id: 'signal-map',
    name: 'Signal Map',
    shortName: 'SM',
    description: 'OTED assessment platform — psychometric profiling and organizational diagnostics',
    icon: 'Radar',
    url: process.env.NEXT_PUBLIC_SM_URL || 'http://localhost:3002',
    healthPath: '/api/health',
    spokeId: 'signal-map',
    githubRepo: '201etheiss/oted-system',
    modules: [
      { id: 'assessments', label: 'Assessments', path: '/assessments' },
      { id: 'profiles', label: 'Profiles', path: '/profiles' },
      { id: 'reports', label: 'Reports', path: '/reports' },
      { id: 'admin', label: 'Admin', path: '/admin' },
    ],
    capabilities: ['assessments', 'psychometrics', 'profiling', 'reporting', 'archetypes'],
    status: 'deployed',
  },
] as const;

// --- Public API ---

export function getApp(id: string): AppInfo | undefined {
  return APPS.find((a) => a.id === id);
}

export function getAllApps(): readonly AppInfo[] {
  return APPS;
}

export function getAppByRepo(repo: string): AppInfo | undefined {
  return APPS.find((a) => a.githubRepo === repo);
}

export function getAppBySpokeId(spokeId: string): AppInfo | undefined {
  return APPS.find((a) => a.spokeId === spokeId);
}

/**
 * Check app health with timeout.
 * Returns 'unknown' if the app URL is not reachable.
 */
export async function getAppHealth(id: string): Promise<AppHealth> {
  const app = getApp(id);
  if (!app) return 'unknown';

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(`${app.url}${app.healthPath}`, {
      signal: controller.signal,
      cache: 'no-store',
    });

    clearTimeout(timeout);

    if (res.ok) {
      const body = await res.json().catch(() => null);
      if (body?.status === 'degraded') return 'degraded';
      return 'healthy';
    }
    return 'degraded';
  } catch {
    return 'down';
  }
}

/**
 * Check health of all apps. Returns a map of appId → health status.
 */
export async function getAllAppHealth(): Promise<Record<string, AppHealth>> {
  const results = await Promise.allSettled(
    APPS.map(async (app) => ({
      id: app.id,
      health: await getAppHealth(app.id),
    }))
  );

  const health: Record<string, AppHealth> = {};
  for (const result of results) {
    if (result.status === 'fulfilled') {
      health[result.value.id] = result.value.health;
    }
  }
  return health;
}
