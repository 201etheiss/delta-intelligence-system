/**
 * Bidirectional Route Map
 * Maps DI module pages to their counterparts in Portal, Equipment Tracker, and Signal Map.
 * Used by CrossAppBreadcrumb and AppSwitcher to show related pages.
 */

export interface RouteMapping {
  /** DI module group ID */
  readonly diModule: string;
  /** DI page path */
  readonly diPath: string;
  /** External app ID (from app-registry) */
  readonly externalApp: string;
  /** Path in the external app */
  readonly externalPath: string;
  /** Human-readable label for the link */
  readonly label: string;
  /** Data flow direction */
  readonly dataFlow: 'di-to-app' | 'app-to-di' | 'bidirectional';
}

const ROUTE_MAPPINGS: readonly RouteMapping[] = [
  // Finance ↔ Portal
  { diModule: 'finance', diPath: '/ap', externalApp: 'delta-portal', externalPath: '/admin/purchasing', label: 'Portal Purchasing', dataFlow: 'bidirectional' },
  { diModule: 'finance', diPath: '/ar', externalApp: 'delta-portal', externalPath: '/admin/invoices', label: 'Portal Invoices', dataFlow: 'bidirectional' },
  { diModule: 'finance', diPath: '/financial-statements', externalApp: 'delta-portal', externalPath: '/insights/analytics', label: 'Portal Analytics', dataFlow: 'di-to-app' },
  { diModule: 'finance', diPath: '/finance', externalApp: 'delta-portal', externalPath: '/admin/dashboard', label: 'Portal Admin', dataFlow: 'di-to-app' },

  // Sales ↔ Portal CRM
  { diModule: 'intelligence', diPath: '/sales', externalApp: 'delta-portal', externalPath: '/admin/crm', label: 'Portal CRM', dataFlow: 'bidirectional' },
  { diModule: 'intelligence', diPath: '/market', externalApp: 'delta-portal', externalPath: '/insights/prices', label: 'Portal Prices', dataFlow: 'di-to-app' },

  // Operations ↔ Equipment Tracker
  { diModule: 'operations', diPath: '/fleet', externalApp: 'equipment-tracker', externalPath: '/', label: 'Equipment Tracker', dataFlow: 'bidirectional' },
  { diModule: 'operations', diPath: '/fleet-map', externalApp: 'equipment-tracker', externalPath: '/fleet-map', label: 'ET Fleet Map', dataFlow: 'bidirectional' },

  // Spoke Hub pages
  { diModule: 'platform', diPath: '/equipment-hub', externalApp: 'equipment-tracker', externalPath: '/', label: 'Equipment Tracker', dataFlow: 'bidirectional' },
  { diModule: 'platform', diPath: '/portal-hub', externalApp: 'delta-portal', externalPath: '/admin/dashboard', label: 'Portal Admin', dataFlow: 'bidirectional' },
  { diModule: 'platform', diPath: '/signal-map-hub', externalApp: 'signal-map', externalPath: '/', label: 'Signal Map', dataFlow: 'bidirectional' },

  // ERP ↔ Portal
  { diModule: 'erp', diPath: '/erp/ap', externalApp: 'delta-portal', externalPath: '/admin/purchasing', label: 'Portal Purchasing', dataFlow: 'bidirectional' },
  { diModule: 'erp', diPath: '/erp/ar', externalApp: 'delta-portal', externalPath: '/admin/invoices', label: 'Portal Invoices', dataFlow: 'bidirectional' },
  { diModule: 'erp', diPath: '/erp/inventory', externalApp: 'delta-portal', externalPath: '/admin/products', label: 'Portal Products', dataFlow: 'bidirectional' },
  { diModule: 'erp', diPath: '/erp/contracts', externalApp: 'delta-portal', externalPath: '/account/contracts', label: 'Portal Contracts', dataFlow: 'bidirectional' },
  { diModule: 'erp', diPath: '/erp/purchasing', externalApp: 'delta-portal', externalPath: '/admin/purchasing', label: 'Portal Purchasing', dataFlow: 'di-to-app' },

  // Portal ↔ Equipment Tracker (via DI hub)
  { diModule: 'operations', diPath: '/fleet', externalApp: 'delta-portal', externalPath: '/tracking/assets', label: 'Portal Assets', dataFlow: 'app-to-di' },

  // Signal Map ↔ DI
  { diModule: 'intelligence', diPath: '/executive', externalApp: 'signal-map', externalPath: '/assessments', label: 'OTED Assessments', dataFlow: 'app-to-di' },

  // Customer views
  { diModule: 'finance', diPath: '/customer', externalApp: 'delta-portal', externalPath: '/admin/customers', label: 'Portal Customers', dataFlow: 'bidirectional' },
  { diModule: 'finance', diPath: '/customer', externalApp: 'equipment-tracker', externalPath: '/customers', label: 'ET Customers', dataFlow: 'bidirectional' },
] as const;

// --- Public API ---

/** Find all external routes linked to a DI page */
export function getExternalRoutes(diPath: string): readonly RouteMapping[] {
  return ROUTE_MAPPINGS.filter((m) => m.diPath === diPath);
}

/** Find the DI page for an external app page */
export function getDIRoute(appId: string, appPath: string): RouteMapping | null {
  return ROUTE_MAPPINGS.find(
    (m) => m.externalApp === appId && m.externalPath === appPath
  ) ?? null;
}

/** Get all route mappings for a specific external app */
export function getAllMappingsForApp(appId: string): readonly RouteMapping[] {
  return ROUTE_MAPPINGS.filter((m) => m.externalApp === appId);
}

/** Get all route mappings for a DI module */
export function getMappingsForModule(diModule: string): readonly RouteMapping[] {
  return ROUTE_MAPPINGS.filter((m) => m.diModule === diModule);
}

/** Get all unique external apps that have mappings */
export function getLinkedApps(): readonly string[] {
  return Array.from(new Set(ROUTE_MAPPINGS.map((m) => m.externalApp)));
}
