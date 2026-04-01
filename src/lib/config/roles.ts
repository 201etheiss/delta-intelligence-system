export type UserRole = 'admin' | 'accounting' | 'sales' | 'operations' | 'hr' | 'readonly';

export type ToolPermission =
  | 'query_gateway'
  | 'generate_workbook'
  | 'salesforce_create'
  | 'salesforce_update'
  | 'create_calendar_event'
  | 'check_availability'
  | 'read_email'
  | 'send_email'
  | 'manage_email'
  | 'export_data'
  | 'generate_report'
  | 'manage_users'
  | 'view_audit_log'
  | 'approve_entries'
  | 'create_entries'
  | 'manage_close'
  | 'view_financials'
  | 'view_fleet'
  | 'view_hr'
  | 'configure_system';

/** Granular endpoint access per service — keys are service IDs, values are allowed endpoint patterns */
export type EndpointPermissions = Record<string, string[]>;

/** List of dashboard page paths this role can access */
export type ModulePermissions = string[];

/** All capability permissions available for assignment */
export const ALL_CAPABILITIES: ToolPermission[] = [
  'query_gateway',
  'generate_workbook',
  'salesforce_create',
  'salesforce_update',
  'create_calendar_event',
  'check_availability',
  'read_email',
  'send_email',
  'manage_email',
  'export_data',
  'generate_report',
  'manage_users',
  'view_audit_log',
  'approve_entries',
  'create_entries',
  'manage_close',
  'view_financials',
  'view_fleet',
  'view_hr',
  'configure_system',
];

/** Known gateway endpoints per service (128 total across 8 services) */
export const SERVICE_ENDPOINTS: Record<string, { path: string; label: string; methods: string[] }[]> = {
  ascend: [
    { path: '/customers', label: 'Customers', methods: ['GET'] },
    { path: '/customers/:id', label: 'Customer Detail', methods: ['GET'] },
    { path: '/gl-balances', label: 'GL Balances', methods: ['GET'] },
    { path: '/gl-accounts', label: 'GL Accounts', methods: ['GET'] },
    { path: '/gl-transactions', label: 'GL Transactions', methods: ['GET'] },
    { path: '/invoices', label: 'Invoices', methods: ['GET', 'POST'] },
    { path: '/invoices/:id', label: 'Invoice Detail', methods: ['GET', 'PUT'] },
    { path: '/journal-entries', label: 'Journal Entries', methods: ['GET', 'POST'] },
    { path: '/journal-entries/:id', label: 'JE Detail', methods: ['GET', 'PUT'] },
    { path: '/vendors', label: 'Vendors', methods: ['GET'] },
    { path: '/purchase-orders', label: 'Purchase Orders', methods: ['GET'] },
    { path: '/payments', label: 'Payments', methods: ['GET'] },
    { path: '/ar-aging', label: 'AR Aging', methods: ['GET'] },
    { path: '/ap-aging', label: 'AP Aging', methods: ['GET'] },
    { path: '/cost-centers', label: 'Cost Centers', methods: ['GET'] },
    { path: '/departments', label: 'Departments', methods: ['GET'] },
    { path: '/fixed-assets', label: 'Fixed Assets', methods: ['GET'] },
    { path: '/inventory', label: 'Inventory', methods: ['GET'] },
    { path: '/tax-codes', label: 'Tax Codes', methods: ['GET'] },
    { path: '/query', label: 'SQL Query', methods: ['POST'] },
  ],
  salesforce: [
    { path: '/accounts', label: 'Accounts', methods: ['GET', 'POST', 'PUT'] },
    { path: '/accounts/:id', label: 'Account Detail', methods: ['GET', 'PUT'] },
    { path: '/opportunities', label: 'Opportunities', methods: ['GET', 'POST', 'PUT'] },
    { path: '/opportunities/:id', label: 'Opportunity Detail', methods: ['GET', 'PUT'] },
    { path: '/contacts', label: 'Contacts', methods: ['GET', 'POST', 'PUT'] },
    { path: '/contacts/:id', label: 'Contact Detail', methods: ['GET', 'PUT'] },
    { path: '/leads', label: 'Leads', methods: ['GET', 'POST'] },
    { path: '/tasks', label: 'Tasks', methods: ['GET', 'POST'] },
    { path: '/events', label: 'Events', methods: ['GET', 'POST'] },
    { path: '/cases', label: 'Cases', methods: ['GET', 'POST'] },
    { path: '/reports', label: 'Reports', methods: ['GET'] },
    { path: '/dashboards', label: 'Dashboards', methods: ['GET'] },
    { path: '/query', label: 'SOQL Query', methods: ['POST'] },
  ],
  powerbi: [
    { path: '/reports', label: 'Reports', methods: ['GET'] },
    { path: '/reports/:id', label: 'Report Detail', methods: ['GET'] },
    { path: '/datasets', label: 'Datasets', methods: ['GET'] },
    { path: '/datasets/:id/refresh', label: 'Dataset Refresh', methods: ['POST'] },
    { path: '/dashboards', label: 'Dashboards', methods: ['GET'] },
    { path: '/groups', label: 'Workspaces', methods: ['GET'] },
    { path: '/embed-token', label: 'Embed Token', methods: ['POST'] },
  ],
  samsara: [
    { path: '/vehicles', label: 'Vehicles', methods: ['GET'] },
    { path: '/vehicles/:id', label: 'Vehicle Detail', methods: ['GET'] },
    { path: '/vehicles/locations', label: 'Vehicle Locations', methods: ['GET'] },
    { path: '/vehicles/stats', label: 'Vehicle Stats', methods: ['GET'] },
    { path: '/drivers', label: 'Drivers', methods: ['GET'] },
    { path: '/drivers/:id', label: 'Driver Detail', methods: ['GET'] },
    { path: '/fleet/hos', label: 'HOS Logs', methods: ['GET'] },
    { path: '/alerts', label: 'Alerts', methods: ['GET'] },
    { path: '/tags', label: 'Tags', methods: ['GET'] },
    { path: '/diagnostics/faults', label: 'Diagnostic Faults', methods: ['GET'] },
  ],
  fleetpanda: [
    { path: '/orders', label: 'Orders', methods: ['GET'] },
    { path: '/orders/:id', label: 'Order Detail', methods: ['GET'] },
    { path: '/deliveries', label: 'Deliveries', methods: ['GET'] },
    { path: '/tanks', label: 'Tanks', methods: ['GET'] },
    { path: '/tanks/:id', label: 'Tank Detail', methods: ['GET'] },
    { path: '/drivers', label: 'Drivers', methods: ['GET'] },
    { path: '/customers', label: 'Customers', methods: ['GET'] },
    { path: '/products', label: 'Products', methods: ['GET'] },
    { path: '/routes', label: 'Routes', methods: ['GET'] },
  ],
  microsoft: [
    { path: '/users', label: 'Users', methods: ['GET'] },
    { path: '/users/:id', label: 'User Detail', methods: ['GET'] },
    { path: '/mail', label: 'Mail', methods: ['GET', 'POST'] },
    { path: '/calendar', label: 'Calendar', methods: ['GET', 'POST'] },
    { path: '/calendar/availability', label: 'Availability', methods: ['POST'] },
    { path: '/teams/channels', label: 'Teams Channels', methods: ['GET'] },
    { path: '/teams/messages', label: 'Teams Messages', methods: ['GET', 'POST'] },
    { path: '/sharepoint/sites', label: 'SharePoint Sites', methods: ['GET'] },
    { path: '/query', label: 'Graph Query', methods: ['POST'] },
  ],
  vroozi: [
    { path: '/purchase-requests', label: 'Purchase Requests', methods: ['GET', 'POST'] },
    { path: '/purchase-orders', label: 'Purchase Orders', methods: ['GET'] },
    { path: '/invoices', label: 'Invoices', methods: ['GET'] },
    { path: '/catalogs', label: 'Catalogs', methods: ['GET'] },
    { path: '/suppliers', label: 'Suppliers', methods: ['GET'] },
    { path: '/budgets', label: 'Budgets', methods: ['GET'] },
    { path: '/approvals', label: 'Approvals', methods: ['GET', 'POST'] },
  ],
  paylocity: [
    { path: '/employees', label: 'Employees', methods: ['GET'] },
    { path: '/employees/:id', label: 'Employee Detail', methods: ['GET'] },
    { path: '/payroll', label: 'Payroll', methods: ['GET'] },
    { path: '/payroll/history', label: 'Payroll History', methods: ['GET'] },
    { path: '/time-off', label: 'Time Off', methods: ['GET'] },
    { path: '/benefits', label: 'Benefits', methods: ['GET'] },
    { path: '/deductions', label: 'Deductions', methods: ['GET'] },
    { path: '/departments', label: 'Departments', methods: ['GET'] },
    { path: '/positions', label: 'Positions', methods: ['GET'] },
    { path: '/tax-forms', label: 'Tax Forms', methods: ['GET'] },
  ],
};

/** All dashboard modules grouped by category */
export const ALL_MODULES: { category: string; pages: { path: string; label: string }[] }[] = [
  {
    category: 'Core',
    pages: [
      { path: '/cockpit', label: 'Cockpit' },
      { path: '/chat', label: 'AI Chat' },
      { path: '/assistant', label: 'AI Assistant' },
      { path: '/brief', label: 'Daily Brief' },
      { path: '/digest', label: 'Digest' },
      { path: '/search', label: 'Search' },
      { path: '/dashboards', label: 'Dashboards' },
    ],
  },
  {
    category: 'Financial',
    pages: [
      { path: '/financial-statements', label: 'Financial Statements' },
      { path: '/journal-entries', label: 'Journal Entries' },
      { path: '/cash-flow', label: 'Cash Flow' },
      { path: '/reconciliations', label: 'Reconciliations' },
      { path: '/close-tracker', label: 'Close Tracker' },
      { path: '/budgets', label: 'Budgets' },
      { path: '/tax', label: 'Tax' },
      { path: '/late-posted', label: 'Late Posted' },
      { path: '/exceptions', label: 'Exceptions' },
      { path: '/controls', label: 'Controls' },
      { path: '/commentary', label: 'Commentary' },
    ],
  },
  {
    category: 'Accounts Payable / Receivable',
    pages: [
      { path: '/ap/invoices', label: 'AP Invoices' },
      { path: '/ar/collections', label: 'AR Collections' },
      { path: '/expenses', label: 'Expenses' },
      { path: '/contracts', label: 'Contracts' },
    ],
  },
  {
    category: 'Assets & Inventory',
    pages: [
      { path: '/assets/fixed', label: 'Fixed Assets' },
      { path: '/inventory', label: 'Inventory' },
      { path: '/otc', label: 'Order-to-Cash' },
    ],
  },
  {
    category: 'Sales & CRM',
    pages: [
      { path: '/sales', label: 'Sales' },
      { path: '/customer', label: 'Customer' },
      { path: '/market', label: 'Market' },
    ],
  },
  {
    category: 'Operations & Fleet',
    pages: [
      { path: '/fleet', label: 'Fleet' },
      { path: '/fleet-map', label: 'Fleet Map' },
    ],
  },
  {
    category: 'People',
    pages: [
      { path: '/hr', label: 'HR' },
      { path: '/people', label: 'People' },
    ],
  },
  {
    category: 'Analytics & Reports',
    pages: [
      { path: '/analytics', label: 'Analytics' },
      { path: '/reports', label: 'Reports' },
      { path: '/reports/templates', label: 'Report Templates' },
      { path: '/executive', label: 'Executive' },
    ],
  },
  {
    category: 'Platform',
    pages: [
      { path: '/platform', label: 'Platform' },
      { path: '/integrations', label: 'Integrations' },
      { path: '/sources', label: 'Sources' },
      { path: '/documents', label: 'Documents' },
      { path: '/vault', label: 'Evidence Vault' },
      { path: '/audit', label: 'Audit' },
      { path: '/glossary', label: 'Glossary' },
      { path: '/automations', label: 'Automations' },
      { path: '/packages', label: 'Packages' },
      { path: '/workspaces', label: 'Workspaces' },
      { path: '/workstreams', label: 'Workstreams' },
      { path: '/api-docs', label: 'API Docs' },
      { path: '/settings', label: 'Settings' },
      { path: '/history', label: 'History' },
      { path: '/onboarding', label: 'Onboarding' },
      { path: '/shared', label: 'Shared' },
    ],
  },
  {
    category: 'Admin',
    pages: [
      { path: '/admin/users', label: 'User Management' },
      { path: '/admin/permissions', label: 'Permissions' },
      { path: '/admin/usage', label: 'Usage' },
      { path: '/admin/health', label: 'Health' },
      { path: '/admin/audit', label: 'Admin Audit' },
      { path: '/admin/integrations', label: 'Admin Integrations' },
    ],
  },
];

/** Flat list of all module paths */
export const ALL_MODULE_PATHS: string[] = ALL_MODULES.flatMap((g) => g.pages.map((p) => p.path));

export interface RoleConfig {
  role: UserRole;
  name: string;
  services: string[];
  gatewayKeyEnv: string;
  dashboardWidgets: string[];
  /** Which chat tools / capabilities this role can use */
  tools: ToolPermission[];
  /** Granular endpoint access per service */
  endpoints: EndpointPermissions;
  /** Dashboard modules this role can access */
  modules: ModulePermissions;
  /** Can read other users' mailboxes */
  crossMailboxAccess: boolean;
  /** Can create SF records */
  sfWriteAccess: boolean;
  /** Can send email as other users */
  sendAsOthers: boolean;
  /** Can view financial data (revenue, GP, AR, AP) */
  financialAccess: boolean;
  /** Can view fleet/driver data */
  fleetAccess: boolean;
}

export const ROLES: Record<UserRole, RoleConfig> = {
  admin: {
    role: 'admin',
    name: 'Admin (Full Access)',
    services: ['ascend', 'salesforce', 'powerbi', 'samsara', 'fleetpanda', 'microsoft', 'vroozi', 'paylocity'],
    gatewayKeyEnv: 'GATEWAY_ADMIN_KEY',
    dashboardWidgets: ['ar-aging', 'revenue-trend', 'top-customers', 'pipeline', 'fleet-map', 'system-health', 'usage-stats'],
    tools: [...ALL_CAPABILITIES],
    endpoints: { ascend: ['*'], salesforce: ['*'], powerbi: ['*'], samsara: ['*'], fleetpanda: ['*'], microsoft: ['*'], vroozi: ['*'], paylocity: ['*'] },
    modules: [...ALL_MODULE_PATHS],
    crossMailboxAccess: true,
    sfWriteAccess: true,
    sendAsOthers: true,
    financialAccess: true,
    fleetAccess: true,
  },
  accounting: {
    role: 'accounting',
    name: 'Accounting (ERP + Power BI)',
    services: ['ascend', 'powerbi', 'vroozi'],
    gatewayKeyEnv: 'GATEWAY_ACCTG_KEY',
    dashboardWidgets: ['ar-aging', 'revenue-trend', 'top-customers', 'recent-invoices', 'ap-summary'],
    tools: ['query_gateway', 'generate_workbook', 'create_calendar_event', 'check_availability', 'read_email', 'send_email', 'export_data', 'generate_report', 'view_audit_log', 'approve_entries', 'create_entries', 'manage_close', 'view_financials'],
    endpoints: {
      ascend: ['/customers', '/gl-*', '/invoices', '/invoices/:id', '/journal-entries', '/journal-entries/:id', '/vendors', '/purchase-orders', '/payments', '/ar-aging', '/ap-aging', '/cost-centers', '/departments', '/fixed-assets', '/inventory', '/tax-codes', '/query'],
      powerbi: ['*'],
      vroozi: ['*'],
    },
    modules: ['/cockpit', '/chat', '/assistant', '/brief', '/digest', '/search', '/dashboards', '/financial-statements', '/journal-entries', '/cash-flow', '/reconciliations', '/close-tracker', '/budgets', '/tax', '/late-posted', '/exceptions', '/controls', '/commentary', '/ap/invoices', '/ar/collections', '/expenses', '/contracts', '/assets/fixed', '/inventory', '/otc', '/analytics', '/reports', '/reports/templates', '/vault', '/audit', '/glossary', '/documents', '/history', '/settings'],
    crossMailboxAccess: false,
    sfWriteAccess: false,
    sendAsOthers: false,
    financialAccess: true,
    fleetAccess: false,
  },
  sales: {
    role: 'sales',
    name: 'Sales (CRM + Power BI + Pricing)',
    services: ['salesforce', 'powerbi', 'ascend'],
    gatewayKeyEnv: 'GATEWAY_SALES_KEY',
    dashboardWidgets: ['pipeline', 'recent-opportunities', 'lead-count', 'account-activity'],
    tools: ['query_gateway', 'generate_workbook', 'salesforce_create', 'salesforce_update', 'create_calendar_event', 'check_availability', 'read_email', 'send_email', 'export_data', 'generate_report'],
    endpoints: {
      salesforce: ['*'],
      powerbi: ['/reports', '/reports/:id', '/dashboards', '/embed-token'],
      ascend: ['/customers', '/customers/:id', '/invoices', '/ar-aging'],
    },
    modules: ['/cockpit', '/chat', '/assistant', '/brief', '/digest', '/search', '/dashboards', '/sales', '/customer', '/market', '/analytics', '/reports', '/reports/templates', '/executive', '/documents', '/history', '/settings'],
    crossMailboxAccess: false,
    sfWriteAccess: true,
    sendAsOthers: false,
    financialAccess: false,
    fleetAccess: false,
  },
  operations: {
    role: 'operations',
    name: 'Operations (Fleet + ERP + Logistics)',
    services: ['ascend', 'samsara', 'fleetpanda'],
    gatewayKeyEnv: 'GATEWAY_OPS_KEY',
    dashboardWidgets: ['fleet-map', 'vehicle-status', 'equipment-summary', 'tank-assignments'],
    tools: ['query_gateway', 'generate_workbook', 'create_calendar_event', 'check_availability', 'read_email', 'send_email', 'export_data', 'view_fleet'],
    endpoints: {
      ascend: ['/customers', '/inventory', '/cost-centers', '/departments'],
      samsara: ['*'],
      fleetpanda: ['*'],
    },
    modules: ['/cockpit', '/chat', '/assistant', '/brief', '/digest', '/search', '/dashboards', '/fleet', '/fleet-map', '/inventory', '/otc', '/analytics', '/reports', '/documents', '/history', '/settings'],
    crossMailboxAccess: false,
    sfWriteAccess: false,
    sendAsOthers: false,
    financialAccess: false,
    fleetAccess: true,
  },
  hr: {
    role: 'hr',
    name: 'HR (Paylocity + Fleet + ERP)',
    services: ['paylocity', 'ascend', 'samsara'],
    gatewayKeyEnv: 'GATEWAY_ADMIN_KEY',
    dashboardWidgets: ['headcount', 'departments', 'cost-centers', 'fleet-status'],
    tools: ['query_gateway', 'generate_workbook', 'create_calendar_event', 'check_availability', 'read_email', 'send_email', 'export_data', 'view_hr', 'view_fleet'],
    endpoints: {
      paylocity: ['*'],
      ascend: ['/departments', '/cost-centers', '/customers'],
      samsara: ['/drivers', '/drivers/:id', '/vehicles', '/vehicles/:id'],
    },
    modules: ['/cockpit', '/chat', '/assistant', '/brief', '/digest', '/search', '/dashboards', '/hr', '/people', '/fleet', '/analytics', '/reports', '/documents', '/history', '/settings'],
    crossMailboxAccess: false,
    sfWriteAccess: false,
    sendAsOthers: false,
    financialAccess: false,
    fleetAccess: true,
  },
  readonly: {
    role: 'readonly',
    name: 'Read-Only (All Sources)',
    services: ['ascend', 'salesforce', 'powerbi', 'samsara', 'fleetpanda', 'microsoft', 'vroozi', 'paylocity'],
    gatewayKeyEnv: 'GATEWAY_READONLY_KEY',
    dashboardWidgets: ['ar-aging', 'revenue-trend', 'pipeline', 'fleet-map'],
    tools: ['query_gateway', 'generate_workbook', 'read_email', 'view_financials', 'view_fleet', 'view_hr'],
    endpoints: { ascend: ['*'], salesforce: ['*'], powerbi: ['*'], samsara: ['*'], fleetpanda: ['*'], microsoft: ['*'], vroozi: ['*'], paylocity: ['*'] },
    modules: ['/cockpit', '/chat', '/assistant', '/brief', '/digest', '/search', '/dashboards', '/financial-statements', '/journal-entries', '/cash-flow', '/reconciliations', '/sales', '/customer', '/fleet', '/fleet-map', '/hr', '/analytics', '/reports', '/executive', '/history'],
    crossMailboxAccess: false,
    sfWriteAccess: false,
    sendAsOthers: false,
    financialAccess: true,
    fleetAccess: true,
  },
};

/**
 * User→Role mapping
 * Admin-editable via /admin/users. Stored in data/users.json at runtime.
 * This is the static fallback for known users.
 */
export const USER_ROLES: Record<string, UserRole> = {
  // Admins — full suite
  'etheiss@delta360.energy': 'admin',
  'kmaples@delta360.energy': 'admin',
  'avegas@delta360.energy': 'admin',
  'mlong@delta360.energy': 'admin',

  // Accounting
  'esmith@delta360.energy': 'accounting',
  'hburns@delta360.energy': 'accounting',
  'blasseigne@delta360.energy': 'accounting',
  'lcowan@delta360.energy': 'accounting',
  'hpasupu@delta360.energy': 'accounting',
  'tveazey@delta360.energy': 'accounting',
  'ypatel@delta360.energy': 'accounting',

  // Sales — Commercial
  'ahadwin@delta360.energy': 'sales',
  'staylor@delta360.energy': 'sales',
  'mowen@delta360.energy': 'sales',
  'bthornton@delta360.energy': 'sales',
  'bmccaskill@delta360.energy': 'sales',
  'ngreen@delta360.energy': 'sales',
  'cmclelland@delta360.energy': 'sales',
  'pbooysen@delta360.energy': 'sales',
  'adeaton@delta360.energy': 'sales',
  // Sales — Contractor
  'lmccall@delta360.energy': 'sales',
  'rmason@delta360.energy': 'sales',
  'csheppard@delta360.energy': 'sales',
  'sferguson@delta360.energy': 'sales',
  'wtramel@delta360.energy': 'sales',
  // Sales — Industrial
  'gleiato@delta360.energy': 'sales',
  'lwhisenhant@delta360.energy': 'sales',
  'biseminger@delta360.energy': 'sales',
  // Sales — O&G
  'ahey@delta360.energy': 'sales',
  'phill@delta360.energy': 'sales',
  'asnodgrass@delta360.energy': 'sales',
  'mgulledge@delta360.energy': 'sales',

  // Operations
  'rstewart@delta360.energy': 'operations',
  'jwood@delta360.energy': 'operations',
  'cgreer@delta360.energy': 'operations',

  // Other staff — pricing, admin support
  'amarks@delta360.energy': 'accounting',
  'cmaples@delta360.energy': 'admin',
  'jdavies@delta360.energy': 'operations',
};

export function getUserRole(email: string): UserRole {
  const normalizedEmail = email.toLowerCase();
  // Check static mapping first
  if (USER_ROLES[normalizedEmail]) return USER_ROLES[normalizedEmail];

  // Try loading dynamic mapping from data/users.json
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const users = require('../../../data/users.json') as { users?: Array<{ email: string; role: string }> };
    const match = (users.users ?? []).find(u => u.email.toLowerCase() === normalizedEmail);
    if (match && ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'].includes(match.role)) {
      return match.role as UserRole;
    }
  } catch {
    // data/users.json not available — use static only
  }

  return 'readonly';
}

export function getGatewayKey(role: UserRole): string {
  const config = ROLES[role];
  return process.env[config.gatewayKeyEnv] ?? '';
}

/**
 * Check if a role has permission to use a specific tool
 */
export function canUseTool(role: UserRole, tool: ToolPermission): boolean {
  return ROLES[role].tools.includes(tool);
}

/**
 * Get the list of tools available for a role
 */
export function getToolsForRole(role: UserRole): ToolPermission[] {
  return ROLES[role].tools;
}

/**
 * Service → admin role mapping.
 * Maps each gateway service to the role(s) that administrate it.
 * Used as fallback when dynamic Graph manager lookup isn't available.
 */
export const SERVICE_ADMIN_ROLES: Record<string, UserRole> = {
  ascend:     'admin',
  salesforce: 'admin',
  samsara:    'operations',
  fleetpanda: 'operations',
  powerbi:    'admin',
  microsoft:  'admin',
  vroozi:     'accounting',
  paylocity:  'hr',
};

/**
 * Cached org directory from Microsoft Graph.
 * Populated by resolveServiceAdmin() on first call, refreshed every 30 min.
 */
export interface OrgUser {
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  managerId: string | null;
  managerName: string | null;
  managerEmail: string | null;
}

let orgCache: OrgUser[] | null = null;
let orgCacheExpiresAt = 0;

/**
 * Pull the org directory from Microsoft Graph with manager relationships.
 * Uses the gateway's /microsoft/query passthrough to call Graph API.
 * Caches for 30 minutes.
 */
export async function loadOrgDirectory(): Promise<OrgUser[]> {
  if (orgCache && Date.now() < orgCacheExpiresAt) return orgCache;

  try {
    const gatewayBase = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
    const apiKey = process.env[ROLES.admin.gatewayKeyEnv] ?? '';

    // Fetch users with manager expansion
    const res = await fetch(`${gatewayBase}/microsoft/query`, {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        path: '/users?$top=999&$select=id,displayName,mail,jobTitle,department&$expand=manager($select=id,displayName,mail)',
      }),
      signal: AbortSignal.timeout(15000),
    });

    const data = await res.json() as {
      success: boolean;
      value?: Array<{
        displayName?: string;
        mail?: string;
        jobTitle?: string;
        department?: string;
        manager?: { id?: string; displayName?: string; mail?: string };
      }>;
    };

    if (!data.success || !Array.isArray(data.value)) {
      orgCache = [];
      orgCacheExpiresAt = Date.now() + 60_000; // retry in 1 min on failure
      return orgCache;
    }

    orgCache = data.value.map((u) => ({
      displayName: u.displayName ?? '',
      mail: (u.mail ?? '').toLowerCase(),
      jobTitle: u.jobTitle ?? null,
      department: u.department ?? null,
      managerId: u.manager?.id ?? null,
      managerName: u.manager?.displayName ?? null,
      managerEmail: u.manager?.mail?.toLowerCase() ?? null,
    }));
    orgCacheExpiresAt = Date.now() + 30 * 60_000; // 30 min cache
    return orgCache;
  } catch {
    orgCache = [];
    orgCacheExpiresAt = Date.now() + 60_000;
    return orgCache;
  }
}

/**
 * Find the admin for a service by looking up who manages users with that
 * service's admin role. Falls back to static lookup if Graph is unavailable.
 */
export async function resolveServiceAdmin(
  service: string,
  userEmail?: string
): Promise<{ name: string; email: string; title: string }> {
  const fallback = { name: 'System Administrator', email: 'etheiss@delta360.energy', title: 'System Administrator' };

  // Try to get the user's manager from Graph
  if (userEmail) {
    const org = await loadOrgDirectory();
    const user = org.find((u) => u.mail === userEmail.toLowerCase());
    if (user?.managerName && user?.managerEmail) {
      return {
        name: user.managerName,
        email: user.managerEmail,
        title: user.jobTitle ? `Manager (${user.jobTitle}'s manager)` : 'Manager',
      };
    }
  }

  // Fall back to finding any admin-role user for this service
  const adminRole = SERVICE_ADMIN_ROLES[service] ?? 'admin';
  const adminEmails = Object.entries(USER_ROLES)
    .filter(([, role]) => role === adminRole)
    .map(([email]) => email);

  if (adminEmails.length > 0) {
    const org = await loadOrgDirectory();
    const adminUser = org.find((u) => adminEmails.includes(u.mail));
    if (adminUser) {
      return {
        name: adminUser.displayName,
        email: adminUser.mail,
        title: adminUser.jobTitle ?? ROLES[adminRole].name,
      };
    }
    // Graph unavailable — use first admin email from static mapping
    return { name: adminEmails[0].split('@')[0], email: adminEmails[0], title: ROLES[adminRole].name };
  }

  return fallback;
}

/**
 * Check if a role has access to a specific data service.
 * Returns { allowed: true } if access is granted, or { allowed: false, message }
 * with the service admin's contact info (from MS Graph org hierarchy) if not.
 */
export function checkServiceAccess(
  role: UserRole,
  service: string,
  userEmail?: string
): { allowed: true } | { allowed: false; message: string } {
  const config = ROLES[role];
  if (config.services.includes(service)) {
    return { allowed: true };
  }

  const serviceName = service.charAt(0).toUpperCase() + service.slice(1);

  // Build the message synchronously with a placeholder; the async admin lookup
  // happens at the gateway/chat layer which can await resolveServiceAdmin().
  // For the sync check, we use the static role-based admin mapping.
  const adminRole = SERVICE_ADMIN_ROLES[service] ?? 'admin';
  const adminEmails = Object.entries(USER_ROLES)
    .filter(([, r]) => r === adminRole)
    .map(([email]) => email);
  const adminContact = adminEmails.length > 0
    ? adminEmails[0]
    : 'etheiss@delta360.energy';

  return {
    allowed: false,
    message: `You don't have access to ${serviceName} data with your current role (${config.name}). To request access, contact your manager or the ${serviceName} administrator at ${adminContact}.`,
  };
}

/**
 * Check if a role has access to a specific endpoint on a service.
 * Supports wildcard '*' patterns and glob-style prefix matching (e.g., '/gl-*').
 */
export function checkEndpointAccess(role: UserRole, service: string, endpoint: string): boolean {
  const config = ROLES[role];
  const allowedEndpoints = config.endpoints[service] ?? [];
  if (allowedEndpoints.length === 0) return false;

  return allowedEndpoints.some((pattern) => {
    if (pattern === '*') return true;
    if (pattern.endsWith('*')) {
      const prefix = pattern.slice(0, -1);
      return endpoint.startsWith(prefix);
    }
    return pattern === endpoint;
  });
}

/**
 * Check if a role has access to a specific dashboard module/page.
 */
export function checkModuleAccess(role: UserRole, modulePath: string): boolean {
  const config = ROLES[role];
  return config.modules.includes(modulePath);
}

/**
 * Check if a role has a specific capability.
 */
export function hasCapability(role: UserRole, capability: ToolPermission): boolean {
  return ROLES[role].tools.includes(capability);
}
