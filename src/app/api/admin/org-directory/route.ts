import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole, USER_ROLES, loadOrgDirectory, type UserRole, type OrgUser } from '@/lib/config/roles';

export interface OrgDirectoryUser {
  displayName: string;
  email: string;
  jobTitle: string | null;
  department: string | null;
  role: UserRole;
  manager: string | null;
  managerEmail: string | null;
  status: 'active' | 'inactive';
  phone: string | null;
}

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const role = getUserRole(session.user.email);
  if (role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    // Load org directory from MS Graph
    const orgUsers: OrgUser[] = await loadOrgDirectory();

    // Build a set of all known emails from USER_ROLES
    const allEmails = new Set<string>(
      Object.keys(USER_ROLES).map((e) => e.toLowerCase())
    );

    // Also add any org users from Graph
    for (const u of orgUsers) {
      if (u.mail) {
        allEmails.add(u.mail.toLowerCase());
      }
    }

    // Build lookup from Graph data
    const graphLookup = new Map<string, OrgUser>();
    for (const u of orgUsers) {
      if (u.mail) {
        graphLookup.set(u.mail.toLowerCase(), u);
      }
    }

    // Merge into directory users
    const users: OrgDirectoryUser[] = Array.from(allEmails).map((email) => {
      const graphUser = graphLookup.get(email);
      const role = getUserRole(email);

      // Derive display name from email if Graph unavailable
      const fallbackName = email
        .split('@')[0]
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .replace(/^./, (c) => c.toUpperCase());

      return {
        displayName: graphUser?.displayName || fallbackName,
        email,
        jobTitle: graphUser?.jobTitle ?? null,
        department: graphUser?.department ?? null,
        role,
        manager: graphUser?.managerName ?? null,
        managerEmail: graphUser?.managerEmail ?? null,
        status: 'active' as const,
        phone: null, // Graph basic query doesn't include phone; extend if needed
      };
    });

    // Sort by display name
    users.sort((a, b) => a.displayName.localeCompare(b.displayName));

    return NextResponse.json({ users });
  } catch {
    return NextResponse.json({ error: 'Failed to load org directory' }, { status: 500 });
  }
}
