/**
 * Role-based routing and module visibility for the DataOS shell.
 * Determines which modules/pages each role can see and which cockpit they land on.
 */

import type { UserRole } from '@/lib/config/roles';
import type { ModuleGroup } from './module-registry';
import { MODULE_GROUPS, SPOKE_MODULES } from './module-registry';

/** Maps each role to their home/cockpit page */
export const ROLE_HOME_MAP: Record<UserRole, string> = {
  admin: '/',           // Home Grid (sees everything)
  accounting: '/cockpit',  // Controller cockpit (month-end, JE pipeline, recon)
  sales: '/sales',      // Sales console (pipeline, CRM, customer profitability)
  operations: '/fleet-map', // Fleet map (dispatch, equipment, GPS)
  hr: '/hr',            // HR console (people, org chart, hiring)
  readonly: '/',        // Home Grid (read-only)
};

/** Module groups each role can access */
const ROLE_MODULE_ACCESS: Record<UserRole, string[]> = {
  admin: ['finance', 'operations', 'intelligence', 'organization', 'compliance', 'admin', 'platform', 'erp'],
  accounting: ['finance', 'compliance', 'platform', 'erp'],
  sales: ['intelligence', 'platform'],
  operations: ['operations', 'platform'],
  hr: ['organization', 'platform'],
  readonly: ['intelligence', 'platform'],
};

/** Get the cockpit/home page for a role */
export function getRoleHome(role: UserRole): string {
  return ROLE_HOME_MAP[role] ?? '/';
}

/** Filter module groups to only those the role can access */
export function getModulesForRole(role: UserRole): ModuleGroup[] {
  const allowedIds = ROLE_MODULE_ACCESS[role] ?? ROLE_MODULE_ACCESS.readonly;
  return MODULE_GROUPS.filter((m) => allowedIds.includes(m.id));
}

/** Get spoke modules — all roles see spokes (they're external apps) */
export function getSpokesForRole(_role: UserRole): ModuleGroup[] {
  return [...SPOKE_MODULES];
}

/** Get all modules (internal + spokes) filtered by role */
export function getAllModulesForRole(role: UserRole): ModuleGroup[] {
  return [...getModulesForRole(role), ...getSpokesForRole(role)];
}

/** Check if a role can access a specific page path */
export function canAccessPath(role: UserRole, path: string): boolean {
  if (role === 'admin') return true;

  const modules = getModulesForRole(role);
  for (const mod of modules) {
    for (const page of mod.pages) {
      if (page.href === path || path.startsWith(page.href + '/')) {
        return true;
      }
    }
  }

  // Also check spoke hub pages (everyone can see these)
  for (const spoke of SPOKE_MODULES) {
    for (const page of spoke.pages) {
      if (page.href === path) return true;
    }
  }

  // Root always accessible
  if (path === '/') return true;

  return false;
}

/**
 * Get the role's cockpit description for display in the Home Grid.
 * Returns a label and short description for the role's primary workspace.
 */
export function getRoleCockpitInfo(role: UserRole): { label: string; description: string; path: string; icon: string } {
  switch (role) {
    case 'admin':
      return { label: 'Admin Console', description: 'Full platform access — all modules, all data', path: '/', icon: 'Shield' };
    case 'accounting':
      return { label: 'Controller Cockpit', description: 'Month-end close, JE pipeline, reconciliations, AP/AR', path: '/cockpit', icon: 'Gauge' };
    case 'sales':
      return { label: 'Sales Console', description: 'Pipeline, CRM, customer profitability, market intelligence', path: '/sales', icon: 'TrendingUp' };
    case 'operations':
      return { label: 'Operations Center', description: 'Fleet map, dispatch, equipment, GPS tracking', path: '/fleet-map', icon: 'Truck' };
    case 'hr':
      return { label: 'HR Console', description: 'People, org chart, hiring, workstreams', path: '/hr', icon: 'Users' };
    case 'readonly':
      return { label: 'Dashboard', description: 'Read-only view of intelligence and reports', path: '/', icon: 'BarChart3' };
  }
}
