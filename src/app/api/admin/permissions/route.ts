import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import path from 'path';
import { authOptions } from '@/lib/auth';
import {
  getUserRole,
  ROLES,
  SERVICE_ENDPOINTS,
  ALL_MODULES,
  ALL_CAPABILITIES,
  ALL_MODULE_PATHS,
  type ToolPermission,
} from '@/lib/config/roles';

interface CustomRoleConfig {
  role: string;
  name: string;
  services: string[];
  isCustom: boolean;
}

interface PermissionsOverrides {
  endpoints: Record<string, Record<string, string[]>>;
  capabilities: Record<string, string[]>;
  modules: Record<string, string[]>;
}

interface CustomRolesFile {
  overrides: Record<string, string[]>;
  customRoles: CustomRoleConfig[];
}

function getCustomRolesPath(): string {
  return path.join(process.cwd(), 'data', 'custom-roles.json');
}

function getPermissionsPath(): string {
  return path.join(process.cwd(), 'data', 'permissions.json');
}

function readCustomRoles(): CustomRolesFile {
  const filePath = getCustomRolesPath();
  if (!existsSync(filePath)) {
    return { overrides: {}, customRoles: [] };
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as CustomRolesFile;
  } catch {
    return { overrides: {}, customRoles: [] };
  }
}

function readPermissionsOverrides(): PermissionsOverrides {
  const filePath = getPermissionsPath();
  if (!existsSync(filePath)) {
    return { endpoints: {}, capabilities: {}, modules: {} };
  }
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as PermissionsOverrides;
  } catch {
    return { endpoints: {}, capabilities: {}, modules: {} };
  }
}

function writeCustomRoles(data: CustomRolesFile): void {
  const dir = path.dirname(getCustomRolesPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getCustomRolesPath(), JSON.stringify(data, null, 2), 'utf-8');
}

function writePermissionsOverrides(data: PermissionsOverrides): void {
  const dir = path.dirname(getPermissionsPath());
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(getPermissionsPath(), JSON.stringify(data, null, 2), 'utf-8');
}

interface MergedRole {
  role: string;
  name: string;
  services: string[];
  endpoints: Record<string, string[]>;
  capabilities: string[];
  modules: string[];
  isCustom?: boolean;
}

function getMergedRoles(): MergedRole[] {
  const custom = readCustomRoles();
  const perms = readPermissionsOverrides();

  const builtIn: MergedRole[] = Object.values(ROLES).map((r) => ({
    role: r.role,
    name: r.name,
    services: custom.overrides[r.role] ?? [...r.services],
    endpoints: perms.endpoints[r.role] ?? { ...r.endpoints },
    capabilities: perms.capabilities[r.role] ?? [...r.tools],
    modules: perms.modules[r.role] ?? [...r.modules],
    isCustom: false,
  }));

  const customEntries: MergedRole[] = custom.customRoles.map((r) => ({
    role: r.role,
    name: r.name,
    services: [...r.services],
    endpoints: perms.endpoints[r.role] ?? {},
    capabilities: perms.capabilities[r.role] ?? [],
    modules: perms.modules[r.role] ?? [],
    isCustom: true,
  }));

  return [...builtIn, ...customEntries];
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

  const { searchParams } = new URL(request.url);
  const section = searchParams.get('section');

  // Return available endpoints catalog
  if (section === 'endpoints') {
    return NextResponse.json({ endpoints: SERVICE_ENDPOINTS });
  }

  // Return available modules catalog
  if (section === 'modules') {
    return NextResponse.json({ modules: ALL_MODULES, allPaths: ALL_MODULE_PATHS });
  }

  // Return available capabilities catalog
  if (section === 'capabilities') {
    return NextResponse.json({ capabilities: ALL_CAPABILITIES });
  }

  const roles = getMergedRoles();
  return NextResponse.json({ roles });
}

export async function PATCH(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const incoming = body.roles as MergedRole[] | undefined;
    if (!Array.isArray(incoming)) {
      return NextResponse.json({ error: 'roles array required' }, { status: 400 });
    }

    const custom = readCustomRoles();
    const perms = readPermissionsOverrides();
    const builtInKeys = new Set(Object.keys(ROLES));

    for (const entry of incoming) {
      // Admin always gets full access — skip overrides for admin
      if (entry.role === 'admin') continue;

      if (builtInKeys.has(entry.role)) {
        // Service overrides
        if (entry.services) {
          custom.overrides[entry.role] = [...entry.services];
        }
        // Endpoint overrides
        if (entry.endpoints) {
          perms.endpoints[entry.role] = { ...entry.endpoints };
        }
        // Capability overrides
        if (entry.capabilities) {
          perms.capabilities[entry.role] = [...entry.capabilities] as ToolPermission[];
        }
        // Module overrides
        if (entry.modules) {
          perms.modules[entry.role] = [...entry.modules];
        }
      } else {
        const idx = custom.customRoles.findIndex((r) => r.role === entry.role);
        if (idx >= 0) {
          custom.customRoles[idx] = {
            ...custom.customRoles[idx],
            services: [...(entry.services ?? [])],
          };
          if (entry.endpoints) perms.endpoints[entry.role] = { ...entry.endpoints };
          if (entry.capabilities) perms.capabilities[entry.role] = [...entry.capabilities];
          if (entry.modules) perms.modules[entry.role] = [...entry.modules];
        }
      }
    }

    writeCustomRoles(custom);
    writePermissionsOverrides(perms);
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authError = await requireAdmin(request);
  if (authError) return authError;

  try {
    const body = await request.json();
    const { role, name, services } = body as { role: string; name: string; services: string[] };

    if (!role || !name) {
      return NextResponse.json({ error: 'role and name are required' }, { status: 400 });
    }

    const custom = readCustomRoles();
    const builtInKeys = new Set(Object.keys(ROLES));

    if (builtInKeys.has(role)) {
      return NextResponse.json({ error: 'Cannot create role with a built-in role name' }, { status: 409 });
    }

    const exists = custom.customRoles.some((r) => r.role === role);
    if (exists) {
      return NextResponse.json({ error: 'Custom role already exists' }, { status: 409 });
    }

    custom.customRoles.push({
      role,
      name,
      services: Array.isArray(services) ? services : [],
      isCustom: true,
    });

    writeCustomRoles(custom);
    return NextResponse.json({ success: true, role }, { status: 201 });
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }
}
