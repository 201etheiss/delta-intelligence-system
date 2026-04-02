export interface ModulePage {
  href: string;
  label: string;
}

export interface ModuleGroup {
  id: string;
  label: string;
  icon: string;
  defaultPagePath: string;
  pages: ModulePage[];
  /** If true, this is an external spoke module (opens in new tab) */
  isSpoke?: boolean;
  /** External URL for spoke modules */
  externalUrl?: string;
  /** Description shown on module tile */
  description?: string;
  /** Deployment status */
  status?: 'live' | 'dev' | 'deployed' | 'planned';
}

export const MODULE_GROUPS: ModuleGroup[] = [
  {
    id: 'finance',
    label: 'Finance',
    icon: 'DollarSign',
    defaultPagePath: '/finance',
    pages: [
      { href: '/finance', label: 'Finance' },
      { href: '/financial-statements', label: 'Financial Statements' },
      { href: '/journal-entries', label: 'Journal Entries' },
      { href: '/close-tracker', label: 'Close Tracker' },
      { href: '/cash-flow', label: 'Cash Flow' },
      { href: '/budgets', label: 'Budgets' },
      { href: '/reconciliations', label: 'Reconciliations' },
      { href: '/ap/invoices', label: 'AP Invoices' },
      { href: '/ar/collections', label: 'AR Collections' },
      { href: '/tax', label: 'Tax' },
      { href: '/commentary', label: 'Commentary' },
      { href: '/expenses', label: 'Expenses' },
      { href: '/otc', label: 'OTC' },
      { href: '/late-posted', label: 'Late Posted' },
      { href: '/packages', label: 'Packages' },
      { href: '/brief', label: 'Brief' },
    ],
  },
  {
    id: 'operations',
    label: 'Operations',
    icon: 'Truck',
    defaultPagePath: '/fleet',
    pages: [
      { href: '/fleet-map', label: 'Fleet Map' },
      { href: '/fleet', label: 'Fleet' },
      { href: '/assets/fixed', label: 'Fixed Assets' },
      { href: '/inventory', label: 'Inventory' },
      { href: '/contracts', label: 'Contracts' },
    ],
  },
  {
    id: 'intelligence',
    label: 'Intelligence',
    icon: 'BarChart3',
    defaultPagePath: '/executive',
    pages: [
      { href: '/executive', label: 'Executive' },
      { href: '/market', label: 'Market' },
      { href: '/sales', label: 'Sales' },
      { href: '/customer', label: 'Customer' },
      { href: '/analytics', label: 'Analytics' },
      { href: '/analytics/visualizations', label: 'Visualizations' },
      { href: '/reports', label: 'Reports' },
      { href: '/reports/templates', label: 'Report Templates' },
      { href: '/digest', label: 'Digest' },
    ],
  },
  {
    id: 'organization',
    label: 'Organization',
    icon: 'Users',
    defaultPagePath: '/people',
    pages: [
      { href: '/people', label: 'People' },
      { href: '/hr', label: 'HR' },
      { href: '/workstreams', label: 'Workstreams' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    id: 'compliance',
    label: 'Compliance',
    icon: 'Shield',
    defaultPagePath: '/vault',
    pages: [
      { href: '/vault', label: 'Vault' },
      { href: '/audit', label: 'Audit' },
      { href: '/controls', label: 'Controls' },
      { href: '/exceptions', label: 'Exceptions' },
    ],
  },
  {
    id: 'admin',
    label: 'Admin',
    icon: 'Settings',
    defaultPagePath: '/admin/users',
    pages: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/permissions', label: 'Permissions' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/health', label: 'Health' },
      { href: '/admin/audit', label: 'Audit' },
      { href: '/admin/usage', label: 'Usage' },
      { href: '/admin/team-intelligence', label: 'Team Intelligence' },
      { href: '/admin/event-monitor', label: 'Event Monitor' },
      { href: '/admin/ingestion', label: 'Ingestion' },
      { href: '/settings', label: 'Settings' },
      { href: '/api-docs', label: 'API Docs' },
    ],
  },
  {
    id: 'nova',
    label: 'Nova',
    icon: 'MessageSquare',
    defaultPagePath: '/chat',
    description: 'AI chat, assistant, search, and conversation history',
    pages: [
      { href: '/chat', label: 'Chat' },
      { href: '/assistant', label: 'Assistant' },
      { href: '/search', label: 'Search' },
      { href: '/history', label: 'History' },
      { href: '/documents', label: 'Documents' },
    ],
  },
  {
    id: 'platform',
    label: 'Platform',
    icon: 'Layers',
    defaultPagePath: '/platform',
    pages: [
      { href: '/platform', label: 'Platform' },
      { href: '/automations', label: 'Automations' },
      { href: '/cockpit', label: 'Cockpit' },
      { href: '/dashboards', label: 'Dashboards' },
      { href: '/dashboards/[id]', label: 'Dashboard' },
      { href: '/workspaces', label: 'Workspaces' },
      { href: '/sources', label: 'Sources' },
      { href: '/glossary', label: 'Glossary' },
      { href: '/shared', label: 'Shared' },
      { href: '/shared/[id]', label: 'Shared Item' },
      { href: '/onboarding', label: 'Onboarding' },
    ],
  },
  {
    id: 'erp',
    label: 'ERP',
    icon: 'Database',
    defaultPagePath: '/erp',
    pages: [
      { href: '/erp', label: 'ERP Hub' },
      { href: '/erp/ap', label: 'Accounts Payable' },
      { href: '/erp/ar', label: 'Accounts Receivable' },
      { href: '/erp/inventory', label: 'Inventory' },
      { href: '/erp/contracts', label: 'Contracts' },
      { href: '/erp/purchasing', label: 'Purchasing' },
    ],
    description: 'Ascend ERP replacement — AP, AR, inventory, contracts, procurement',
    status: 'dev',
  },
];

// ---------------------------------------------------------------------------
// Spoke Modules — external applications connected to the DI hub
// ---------------------------------------------------------------------------

export const SPOKE_MODULES: ModuleGroup[] = [
  {
    id: 'delta-portal',
    label: 'Delta Portal',
    icon: 'Globe',
    defaultPagePath: '/portal-hub',
    pages: [{ href: '/portal-hub', label: 'Portal Hub' }],
    isSpoke: false,
    externalUrl: 'http://localhost:3000', // Delta Portal dev server
    description: 'Customer orders, product catalog, delivery tracking, invoices',
    status: 'dev',
  },
  {
    id: 'equipment-tracker',
    label: 'Equipment Tracker',
    icon: 'Wrench',
    defaultPagePath: '/equipment-hub',
    pages: [{ href: '/equipment-hub', label: 'Equipment Hub' }],
    isSpoke: false,
    externalUrl: 'https://equipment-tracker-tau.vercel.app',
    description: 'Asset management, maintenance scheduling, GPS tracking',
    status: 'deployed',
  },
  {
    id: 'signal-map',
    label: 'Signal Map',
    icon: 'Radar',
    defaultPagePath: '/signal-map-hub',
    pages: [{ href: '/signal-map-hub', label: 'Signal Map Hub' }],
    isSpoke: false,
    externalUrl: 'http://localhost:3000/admin', // OTED assessment platform
    description: 'OTED assessment platform, reports, scoring',
    status: 'deployed',
  },
];

/** All modules — internal + spoke */
export const ALL_MODULES: ModuleGroup[] = [...MODULE_GROUPS, ...SPOKE_MODULES];

/**
 * Matches a pathname to its module group.
 *
 * Strategy:
 * 1. Check exact matches first against all registered hrefs.
 * 2. For dynamic segments (hrefs containing [param]), convert the pattern to a
 *    prefix-style check so /dashboards/abc matches /dashboards/[id].
 * 3. Fall back to longest-prefix match across all static hrefs to handle nested
 *    routes not explicitly listed (e.g. /admin/audit/detail → admin group).
 */
export function findModuleForPath(pathname: string): ModuleGroup | undefined {
  // Normalise: strip trailing slash except for root "/"
  const normalised = pathname.length > 1 ? pathname.replace(/\/$/, '') : pathname;

  // 1. Exact match
  for (const group of MODULE_GROUPS) {
    for (const page of group.pages) {
      if (page.href === normalised) {
        return group;
      }
    }
  }

  // 2. Dynamic segment match — convert [param] patterns to prefix check
  for (const group of MODULE_GROUPS) {
    for (const page of group.pages) {
      if (page.href.includes('[')) {
        // Build prefix from the static part before the dynamic segment
        const prefix = page.href.replace(/\/\[[^\]]+\].*$/, '');
        if (prefix && normalised.startsWith(prefix + '/')) {
          return group;
        }
      }
    }
  }

  // 3. Longest static prefix match for unlisted nested routes
  let bestMatch: ModuleGroup | undefined;
  let bestLength = 0;

  for (const group of MODULE_GROUPS) {
    for (const page of group.pages) {
      if (page.href.includes('[')) continue; // skip dynamic entries here
      if (normalised.startsWith(page.href + '/') || normalised === page.href) {
        if (page.href.length > bestLength) {
          bestLength = page.href.length;
          bestMatch = group;
        }
      }
    }
  }

  return bestMatch;
}
