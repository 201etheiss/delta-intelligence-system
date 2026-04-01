export interface EndpointDef {
  method: 'GET' | 'POST';
  path: string;
  service: string;
  description: string;
  params?: string[];
}

export const ENDPOINTS: EndpointDef[] = [
  // Ascend SQL - ERP
  { method: 'POST', path: '/ascend/query', service: 'ascend', description: 'Execute raw SQL SELECT query against Ascend ERP' },
  { method: 'GET', path: '/ascend/tables', service: 'ascend', description: 'List all tables in Ascend ERP database' },
  { method: 'GET', path: '/ascend/schema/{table}', service: 'ascend', description: 'Get column definitions for a specific table', params: ['table'] },
  { method: 'GET', path: '/ascend/customers', service: 'ascend', description: 'All customers with invoice counts since 2024' },
  { method: 'GET', path: '/ascend/customers/top', service: 'ascend', description: 'Top customers ranked by revenue', params: ['year'] },
  { method: 'GET', path: '/ascend/ar/aging', service: 'ascend', description: 'AR aging by customer (current, 1-30, 31-60, 61-90, 90+ days)' },
  { method: 'GET', path: '/ascend/ar/summary', service: 'ascend', description: 'AR summary grouped by customer type' },
  { method: 'GET', path: '/ascend/invoices', service: 'ascend', description: 'List invoices with filters', params: ['year', 'period', 'limit'] },
  { method: 'GET', path: '/ascend/invoices/detail/{sysTrxNo}', service: 'ascend', description: 'Line items for a specific invoice', params: ['sysTrxNo'] },
  { method: 'GET', path: '/ascend/gl/chart-of-accounts', service: 'ascend', description: 'Full chart of accounts' },
  { method: 'GET', path: '/ascend/gl/trial-balance', service: 'ascend', description: 'Trial balance by period', params: ['year', 'period'] },
  { method: 'GET', path: '/ascend/gl/balance-sheet', service: 'ascend', description: 'Balance sheet (Assets, Liabilities, Equity)', params: ['year', 'period'] },
  { method: 'GET', path: '/ascend/gl/income-statement', service: 'ascend', description: 'Income statement by section and account group', params: ['year', 'period'] },
  { method: 'GET', path: '/ascend/gl/pl-by-pc', service: 'ascend', description: 'Profit and loss by profit center', params: ['year'] },
  { method: 'GET', path: '/ascend/gl/journal-entries', service: 'ascend', description: 'Journal entries with line detail', params: ['year', 'period'] },
  { method: 'GET', path: '/ascend/gl/equity', service: 'ascend', description: 'Equity account movements by period', params: ['year'] },
  { method: 'GET', path: '/ascend/revenue', service: 'ascend', description: 'Revenue by account and period', params: ['year'] },
  { method: 'GET', path: '/ascend/revenue/by-customer', service: 'ascend', description: 'Revenue ranked by customer with units', params: ['year'] },
  { method: 'GET', path: '/ascend/gp/by-pc', service: 'ascend', description: 'Gross profit by profit center', params: ['year', 'period', 'posted'] },
  { method: 'GET', path: '/ascend/vendors', service: 'ascend', description: 'All vendors with transaction counts' },
  { method: 'GET', path: '/ascend/ap/purchases', service: 'ascend', description: 'Purchase journal entries ranked by amount', params: ['year', 'period'] },
  { method: 'GET', path: '/ascend/ap/recurring', service: 'ascend', description: 'Recurring vendor payments appearing 3+ months' },
  { method: 'GET', path: '/ascend/assets/fixed', service: 'ascend', description: 'Fixed asset movements', params: ['year'] },
  { method: 'GET', path: '/ascend/equipment', service: 'ascend', description: 'All equipment by asset type' },
  { method: 'GET', path: '/ascend/tanks', service: 'ascend', description: 'Tank equipment only' },
  { method: 'GET', path: '/ascend/tanks/assignments', service: 'ascend', description: 'Tank-to-customer assignments' },
  { method: 'GET', path: '/ascend/sites', service: 'ascend', description: 'All sites with GPS coordinates' },
  { method: 'GET', path: '/ascend/profit-centers', service: 'ascend', description: 'All 43 profit centers' },
  { method: 'GET', path: '/ascend/taxes', service: 'ascend', description: 'Tax codes with authorities' },
  { method: 'GET', path: '/ascend/taxes/collected', service: 'ascend', description: 'Taxes collected by code and authority', params: ['year'] },
  { method: 'GET', path: '/ascend/leases', service: 'ascend', description: 'Recurring lease/rent/storage payments' },
  { method: 'GET', path: '/ascend/commissions', service: 'ascend', description: 'Commission entries by profit center', params: ['year'] },
  { method: 'GET', path: '/ascend/costs/by-pc', service: 'ascend', description: 'Cost breakdown by profit center', params: ['year'] },

  // Salesforce - CRM
  { method: 'POST', path: '/salesforce/query', service: 'salesforce', description: 'Execute raw SOQL query' },
  { method: 'GET', path: '/salesforce/accounts', service: 'salesforce', description: 'All accounts with industry, type, billing address' },
  { method: 'GET', path: '/salesforce/contacts', service: 'salesforce', description: 'All contacts with account association' },
  { method: 'GET', path: '/salesforce/opportunities', service: 'salesforce', description: 'Pipeline with stage, amount, close date' },
  { method: 'GET', path: '/salesforce/leads', service: 'salesforce', description: 'Leads by created date' },
  { method: 'GET', path: '/salesforce/cases', service: 'salesforce', description: 'Support cases with status and priority' },
  { method: 'GET', path: '/salesforce/users', service: 'salesforce', description: 'Users with roles and departments' },
  { method: 'GET', path: '/salesforce/products', service: 'salesforce', description: 'Product catalog' },
  { method: 'GET', path: '/salesforce/tasks', service: 'salesforce', description: 'Activity tasks' },
  { method: 'GET', path: '/salesforce/events', service: 'salesforce', description: 'Calendar events' },

  // Power BI
  { method: 'GET', path: '/powerbi/workspaces', service: 'powerbi', description: 'List all Power BI workspaces' },
  { method: 'GET', path: '/powerbi/datasets', service: 'powerbi', description: 'List all datasets' },
  { method: 'GET', path: '/powerbi/reports', service: 'powerbi', description: 'List all reports' },
  { method: 'POST', path: '/powerbi/query', service: 'powerbi', description: 'Execute DAX query on a dataset' },

  // Samsara - Fleet
  { method: 'GET', path: '/samsara/vehicles', service: 'samsara', description: 'All vehicles with VIN, make, model' },
  { method: 'GET', path: '/samsara/drivers', service: 'samsara', description: 'All 237 drivers with usernames' },
  { method: 'GET', path: '/samsara/locations', service: 'samsara', description: 'Live GPS for all vehicles' },
  { method: 'GET', path: '/samsara/stats', service: 'samsara', description: 'Vehicle stats (odometer, engine hours)', params: ['types', 'after'] },
  { method: 'GET', path: '/samsara/fuel', service: 'samsara', description: 'Fuel level percentages', params: ['after'] },
  { method: 'GET', path: '/samsara/addresses', service: 'samsara', description: 'All geofence addresses' },
  { method: 'GET', path: '/samsara/tags', service: 'samsara', description: 'Fleet tags and groups' },

  // Fleet Panda
  { method: 'GET', path: '/fleetpanda/assets', service: 'fleetpanda', description: 'All Fleet Panda assets (trucks and tanks)' },
  { method: 'GET', path: '/fleetpanda/assets/trucks', service: 'fleetpanda', description: 'Truck assets only' },
  { method: 'GET', path: '/fleetpanda/assets/tanks', service: 'fleetpanda', description: 'Tank assets only' },
  { method: 'GET', path: '/fleetpanda/customers', service: 'fleetpanda', description: 'Fleet Panda customers' },

  // Microsoft Graph
  { method: 'GET', path: '/microsoft/sites', service: 'microsoft', description: 'All SharePoint sites' },
  { method: 'GET', path: '/microsoft/search', service: 'microsoft', description: 'Search across all SharePoint and OneDrive', params: ['q'] },
  { method: 'GET', path: '/microsoft/users', service: 'microsoft', description: 'All Microsoft 365 users' },
  { method: 'POST', path: '/microsoft/query', service: 'microsoft', description: 'Custom Microsoft Graph API query' },

  // Vroozi - Procurement
  { method: 'GET', path: '/vroozi/purchase-orders', service: 'vroozi', description: 'All purchase orders (paginated)', params: ['page', 'pageSize'] },
  { method: 'GET', path: '/vroozi/invoices', service: 'vroozi', description: 'All Vroozi invoices', params: ['page', 'pageSize'] },
  { method: 'GET', path: '/vroozi/suppliers', service: 'vroozi', description: 'All suppliers', params: ['page', 'pageSize'] },
  { method: 'GET', path: '/vroozi/users', service: 'vroozi', description: 'Vroozi users' },
  { method: 'GET', path: '/vroozi/cost-centers', service: 'vroozi', description: 'Cost centers' },
  { method: 'GET', path: '/vroozi/gl-accounts', service: 'vroozi', description: 'GL accounts in Vroozi' },
  { method: 'GET', path: '/vroozi/catalogs', service: 'vroozi', description: 'Product catalogs' },
];

export function getEndpointsForServices(services: string[]): EndpointDef[] {
  return ENDPOINTS.filter(e => services.includes(e.service));
}

// Keyword clusters that map user intent to endpoint domains
const DOMAIN_KEYWORDS: Record<string, string[]> = {
  financial: ['ar', 'aging', 'revenue', 'income', 'balance sheet', 'p&l', 'profit', 'loss', 'gl', 'general ledger', 'trial balance', 'equity', 'journal', 'financial', 'fiscal', 'accounting', 'chart of accounts'],
  customers: ['customer', 'client', 'account', 'top customer', 'revenue by customer'],
  invoices: ['invoice', 'billing', 'payment', 'receivable', 'payable', 'ap', 'ar'],
  sales: ['opportunity', 'pipeline', 'lead', 'deal', 'prospect', 'salesforce', 'crm', 'contact', 'case', 'support'],
  fleet: ['vehicle', 'truck', 'driver', 'fleet', 'gps', 'location', 'fuel', 'samsara', 'odometer', 'engine hours'],
  equipment: ['equipment', 'tank', 'asset', 'fixed asset', 'site', 'assignment'],
  procurement: ['purchase order', 'po', 'vroozi', 'supplier', 'vendor', 'procurement', 'catalog', 'cost center'],
  reports: ['report', 'dashboard', 'power bi', 'dataset', 'workspace', 'dax'],
  microsoft: ['sharepoint', 'onedrive', 'microsoft', 'search', 'document', 'file'],
  costs: ['cost', 'expense', 'commission', 'lease', 'rent', 'tax', 'profit center'],
};

// Map domain keywords to the endpoint paths they should select
const DOMAIN_PATH_PATTERNS: Record<string, RegExp> = {
  financial: /\/(gl|revenue|balance|income|trial|equity|journal|gp)\//,
  customers: /\/customer/,
  invoices: /\/(invoice|ar|ap)\//,
  sales: /\/salesforce\//,
  fleet: /\/samsara\//,
  equipment: /\/(equipment|tank|asset|site|fleetpanda)\//,
  procurement: /\/vroozi\//,
  reports: /\/powerbi\//,
  microsoft: /\/microsoft\//,
  costs: /\/(cost|commission|lease|tax|profit-center)\//,
};

// Always-included endpoints (raw query capabilities)
const ALWAYS_INCLUDE_PATHS = ['/ascend/query', '/ascend/tables', '/ascend/schema/{table}', '/salesforce/query'];

function scoreEndpointRelevance(query: string, services: string[]): EndpointDef[] {
  const lower = query.toLowerCase();
  const allEndpoints = getEndpointsForServices(services);

  // Find which domains match the query
  const matchedDomains = new Set<string>();
  for (const [domain, keywords] of Object.entries(DOMAIN_KEYWORDS)) {
    if (keywords.some(kw => lower.includes(kw))) {
      matchedDomains.add(domain);
    }
  }

  // If no specific domains matched or query is very broad, include all
  if (matchedDomains.size === 0 || lower.includes('everything') || lower.includes('comprehensive') || lower.includes('all data')) {
    return allEndpoints;
  }

  // Select endpoints matching the identified domains + always-include
  const selected = allEndpoints.filter(ep => {
    if (ALWAYS_INCLUDE_PATHS.includes(ep.path)) return true;
    for (const domain of Array.from(matchedDomains)) {
      const pattern = DOMAIN_PATH_PATTERNS[domain];
      if (pattern && pattern.test(ep.path)) return true;
    }
    // Also check if endpoint description matches any query words
    const descWords = ep.description.toLowerCase();
    const queryWords = lower.split(/\s+/).filter(w => w.length > 3);
    if (queryWords.some(w => descWords.includes(w))) return true;
    return false;
  });

  return selected.length > 0 ? selected : allEndpoints;
}

export function buildEndpointContext(services: string[], query?: string): string {
  const endpoints = query ? scoreEndpointRelevance(query, services) : getEndpointsForServices(services);
  const grouped = endpoints.reduce<Record<string, EndpointDef[]>>((acc, e) => {
    const group = acc[e.service] ?? [];
    group.push(e);
    acc[e.service] = group;
    return acc;
  }, {});

  const contextLines = Object.entries(grouped)
    .map(([service, eps]) =>
      `## ${service}\n${eps.map(e => `- ${e.method} ${e.path}: ${e.description}`).join('\n')}`
    )
    .join('\n\n');

  const totalAvailable = getEndpointsForServices(services).length;
  if (endpoints.length < totalAvailable) {
    return `${contextLines}\n\n_Showing ${endpoints.length}/${totalAvailable} endpoints relevant to this query. Use /ascend/query or /salesforce/query for anything not listed._`;
  }

  return contextLines;
}
