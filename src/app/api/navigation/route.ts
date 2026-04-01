import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

interface NavPage {
  href: string;
  label: string;
  description: string;
  icon: string;
  group: 'main' | 'intelligence' | 'data' | 'admin';
  adminOnly: boolean;
}

interface NavGroup {
  id: string;
  label: string;
  pages: NavPage[];
}

const PAGES: NavPage[] = [
  // Main
  {
    href: '/',
    label: 'Dashboard',
    description: 'Role-based landing page with auto-refreshing KPI widgets',
    icon: 'LayoutDashboard',
    group: 'main',
    adminOnly: false,
  },
  {
    href: '/customer',
    label: 'Customer 360',
    description: 'Full customer profile: financials, AR aging, invoices, Salesforce, and delivery sites',
    icon: 'Users',
    group: 'main',
    adminOnly: false,
  },
  {
    href: '/chat',
    label: 'Chat',
    description: 'AI chat with streaming, multi-model routing, tool use, and document context',
    icon: 'MessageSquare',
    group: 'main',
    adminOnly: false,
  },
  {
    href: '/workspaces',
    label: 'Workspaces',
    description: 'Pre-built and custom AI workspace marketplace with specialized system prompts',
    icon: 'Briefcase',
    group: 'main',
    adminOnly: false,
  },
  // Intelligence
  {
    href: '/reports',
    label: 'Reports',
    description: 'AI report builder with 9 report types, iterative refinement, and multi-format export',
    icon: 'FileBarChart',
    group: 'intelligence',
    adminOnly: false,
  },
  {
    href: '/reports/templates',
    label: 'Report Templates',
    description: 'Saved report configurations with parameters and scheduled execution',
    icon: 'FileBarChart',
    group: 'intelligence',
    adminOnly: false,
  },
  {
    href: '/dashboards',
    label: 'Dashboards',
    description: 'Custom dashboard builder with configurable widgets connected to live data',
    icon: 'PanelLeft',
    group: 'intelligence',
    adminOnly: false,
  },
  {
    href: '/search',
    label: 'Search',
    description: 'Full-text search across all saved conversations',
    icon: 'Search',
    group: 'intelligence',
    adminOnly: false,
  },
  {
    href: '/history',
    label: 'History',
    description: 'Browse and resume previous conversations',
    icon: 'History',
    group: 'intelligence',
    adminOnly: false,
  },
  // Data
  {
    href: '/documents',
    label: 'Documents',
    description: 'Upload documents for AI analysis (PDF, DOCX, XLSX, CSV, images)',
    icon: 'FileText',
    group: 'data',
    adminOnly: false,
  },
  {
    href: '/sources',
    label: 'Data Sources',
    description: 'Data source connectivity status, endpoint counts, and schema registry',
    icon: 'Database',
    group: 'data',
    adminOnly: false,
  },
  {
    href: '/api-docs',
    label: 'API Docs',
    description: 'Interactive API documentation with try-it-out functionality',
    icon: 'Code',
    group: 'data',
    adminOnly: false,
  },
  // Admin
  {
    href: '/admin/users',
    label: 'User Management',
    description: 'Add, edit, and deactivate users with role assignment',
    icon: 'Users',
    group: 'admin',
    adminOnly: true,
  },
  {
    href: '/admin/permissions',
    label: 'Permissions',
    description: 'Role-to-service permission grid with custom role creation',
    icon: 'Shield',
    group: 'admin',
    adminOnly: true,
  },
  {
    href: '/admin/usage',
    label: 'Usage',
    description: 'Query volume, token consumption, and cost breakdown analytics',
    icon: 'BarChart3',
    group: 'admin',
    adminOnly: true,
  },
  {
    href: '/admin/health',
    label: 'System Health',
    description: 'Gateway service connectivity, response times, and error tracking',
    icon: 'Activity',
    group: 'admin',
    adminOnly: true,
  },
];

const GROUPS: NavGroup[] = [
  { id: 'main', label: '', pages: PAGES.filter((p) => p.group === 'main') },
  { id: 'intelligence', label: 'Intelligence', pages: PAGES.filter((p) => p.group === 'intelligence') },
  { id: 'data', label: 'Data', pages: PAGES.filter((p) => p.group === 'data') },
  { id: 'admin', label: 'System', pages: PAGES.filter((p) => p.group === 'admin') },
];

export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    return NextResponse.json({
      success: true,
      data: {
        platform: 'Delta Intelligence',
        version: '0.1.0',
        groups: GROUPS,
        pages: PAGES,
        totalPages: PAGES.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
