// ── Navigation Configuration ─────────────────────────────────
// Central nav structure for all Delta360 Intelligence pages.
// Consumed by layout sidebar and command palette.

export interface NavItem {
  label: string;
  href: string;
  icon: string; // lucide icon name
  roles: string[]; // which roles see this
  badge?: string; // optional badge text
  children?: NavItem[];
}

export const NAV_ITEMS: NavItem[] = [
  // Main
  { label: 'Dashboard', href: '/', icon: 'LayoutDashboard', roles: ['admin','sales','accounting','operations','hr','readonly'] },
  { label: 'Controller Cockpit', href: '/cockpit', icon: 'Gauge', roles: ['admin','accounting'] },
  { label: 'AI Chat', href: '/chat', icon: 'MessageSquare', roles: ['admin','sales','accounting','operations','hr','readonly'] },
  { label: 'Daily Brief', href: '/digest', icon: 'Sunrise', roles: ['admin','sales','accounting','operations','hr','readonly'] },

  // Accounting
  { label: 'Journal Entries', href: '/journal-entries', icon: 'FileSpreadsheet', roles: ['admin','accounting'] },
  { label: 'Reconciliations', href: '/reconciliations', icon: 'GitCompare', roles: ['admin','accounting'] },
  { label: 'Close Tracker', href: '/close-tracker', icon: 'CalendarCheck', roles: ['admin','accounting'] },
  { label: 'Cash Flow', href: '/cash-flow', icon: 'Wallet', roles: ['admin','accounting'] },

  // Operations
  { label: 'Fleet Map', href: '/fleet-map', icon: 'MapPin', roles: ['admin','operations'] },
  { label: 'Customer 360', href: '/customer', icon: 'Users', roles: ['admin','sales','accounting'] },

  // Analytics
  { label: 'Reports', href: '/reports', icon: 'BarChart3', roles: ['admin','sales','accounting','operations','hr'] },
  { label: 'Workspaces', href: '/workspaces', icon: 'FolderOpen', roles: ['admin','sales','accounting','operations','hr'] },
  { label: 'Analytics', href: '/analytics', icon: 'TrendingUp', roles: ['admin'] },

  // Platform
  { label: 'Platform Hub', href: '/platform', icon: 'Globe', roles: ['admin'] },
  { label: 'Automations', href: '/automations', icon: 'Zap', roles: ['admin'] },

  // Admin
  { label: 'Admin', href: '/admin/users', icon: 'Shield', roles: ['admin'], children: [
    { label: 'Users', href: '/admin/users', icon: 'Users', roles: ['admin'] },
    { label: 'Permissions', href: '/admin/permissions', icon: 'Lock', roles: ['admin'] },
    { label: 'Integrations', href: '/admin/integrations', icon: 'Plug', roles: ['admin'] },
    { label: 'Health', href: '/admin/health', icon: 'Activity', roles: ['admin'] },
    { label: 'Audit Log', href: '/admin/audit', icon: 'FileText', roles: ['admin'] },
    { label: 'Usage', href: '/admin/usage', icon: 'BarChart', roles: ['admin'] },
  ]},

  // Settings
  { label: 'Settings', href: '/settings', icon: 'Settings', roles: ['admin','sales','accounting','operations','hr','readonly'] },
  { label: 'Glossary', href: '/glossary', icon: 'BookOpen', roles: ['admin','sales','accounting','operations','hr','readonly'] },
];

/** Filter nav items by user role */
export function getNavForRole(role: string): NavItem[] {
  return NAV_ITEMS.filter((item) => item.roles.includes(role)).map((item) => ({
    ...item,
    children: item.children?.filter((child) => child.roles.includes(role)),
  }));
}
