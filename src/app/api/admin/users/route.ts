import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { authOptions } from '@/lib/auth';
import { getUserRole, USER_ROLES, type UserRole } from '@/lib/config/roles';

interface StoredUser {
  email: string;
  role: UserRole;
  status: 'active' | 'inactive';
  addedAt: string;
}

interface UsersFile {
  users: StoredUser[];
}

const VALID_ROLES: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];

function getUsersPath(): string {
  return path.join(process.cwd(), 'data', 'users.json');
}

function readUsers(): UsersFile {
  const filePath = getUsersPath();
  if (!existsSync(filePath)) {
    return { users: [] };
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as UsersFile;
  } catch {
    return { users: [] };
  }
}

function writeUsers(data: UsersFile): void {
  writeFileSync(getUsersPath(), JSON.stringify(data, null, 2), 'utf-8');
}

function mergeUsers(stored: UsersFile): StoredUser[] {
  const map = new Map<string, StoredUser>();

  // Add hardcoded users from USER_ROLES
  for (const [email, role] of Object.entries(USER_ROLES)) {
    map.set(email.toLowerCase(), {
      email,
      role,
      status: 'active',
      addedAt: '2026-01-01T00:00:00Z',
    });
  }

  // Overlay stored users (stored takes precedence for role/status)
  for (const user of stored.users) {
    map.set(user.email.toLowerCase(), user);
  }

  return Array.from(map.values());
}

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null; // Allow in dev
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

  const stored = readUsers();
  const merged = mergeUsers(stored);
  return NextResponse.json({ users: merged });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role as UserRole;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    const stored = readUsers();
    const existing = stored.users.find((u) => u.email.toLowerCase() === email);
    if (existing) {
      return NextResponse.json({ error: 'User already exists' }, { status: 409 });
    }

    const newUser: StoredUser = {
      email,
      role,
      status: 'active',
      addedAt: new Date().toISOString(),
    };

    stored.users.push(newUser);
    writeUsers(stored);

    return NextResponse.json({ user: newUser }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
    const role = body.role as UserRole;

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }
    if (!VALID_ROLES.includes(role)) {
      return NextResponse.json({ error: `Invalid role. Must be one of: ${VALID_ROLES.join(', ')}` }, { status: 400 });
    }

    const stored = readUsers();
    const idx = stored.users.findIndex((u) => u.email.toLowerCase() === email);
    if (idx >= 0) {
      stored.users[idx] = { ...stored.users[idx], role };
    } else {
      // User exists in hardcoded map but not in file — add to file with new role
      stored.users.push({
        email,
        role,
        status: 'active',
        addedAt: new Date().toISOString(),
      });
    }

    writeUsers(stored);
    return NextResponse.json({ success: true, email, role });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';

    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 });
    }

    const stored = readUsers();
    const idx = stored.users.findIndex((u) => u.email.toLowerCase() === email);
    if (idx >= 0) {
      stored.users[idx] = { ...stored.users[idx], status: 'inactive' };
    } else {
      stored.users.push({
        email,
        role: 'readonly',
        status: 'inactive',
        addedAt: new Date().toISOString(),
      });
    }

    writeUsers(stored);
    return NextResponse.json({ success: true, email, status: 'inactive' });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
