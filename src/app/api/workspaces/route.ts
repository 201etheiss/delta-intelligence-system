import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────
interface Workspace {
  id: string;
  name: string;
  description: string;
  longDescription?: string;
  color: string;
  icon: string;
  dataSources: string[];
  enabledEndpoints?: string[];
  systemPrompt: string;
  temperature?: number;
  preferredModel?: string;
  maxToolRounds?: number;
  visibility: 'private' | 'team' | 'public';
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  tags: string[];
  category: 'operations' | 'finance' | 'sales' | 'compliance' | 'analytics' | 'custom';
  samplePrompts: string[];
  responseFormat?: string;
  includeDocuments?: string[];
}

const WORKSPACES_PATH = join(process.cwd(), 'data', 'workspaces.json');

function loadWorkspaces(): Workspace[] {
  if (!existsSync(WORKSPACES_PATH)) return [];
  try {
    const raw = readFileSync(WORKSPACES_PATH, 'utf-8');
    return JSON.parse(raw) as Workspace[];
  } catch {
    return [];
  }
}

function saveWorkspaces(workspaces: Workspace[]): void {
  writeFileSync(WORKSPACES_PATH, JSON.stringify(workspaces, null, 2), 'utf-8');
}

function generateId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    + '-' + Date.now().toString(36);
}

function getUserEmail(session: { user?: { email?: string | null } } | null): string {
  return session?.user?.email ?? 'anonymous';
}

// ── GET: list workspaces with filters ─────────────────────────
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const visibility = searchParams.get('visibility');
  const category = searchParams.get('category');
  const search = searchParams.get('search');
  const tag = searchParams.get('tag');

  let workspaces = loadWorkspaces();

  if (visibility) {
    workspaces = workspaces.filter((w) => w.visibility === visibility);
  }
  if (category) {
    workspaces = workspaces.filter((w) => w.category === category);
  }
  if (tag) {
    const tagLower = tag.toLowerCase();
    workspaces = workspaces.filter((w) =>
      (w.tags ?? []).some((t) => t.toLowerCase() === tagLower)
    );
  }
  if (search) {
    const q = search.toLowerCase();
    workspaces = workspaces.filter((w) =>
      w.name.toLowerCase().includes(q) ||
      w.description.toLowerCase().includes(q) ||
      (w.longDescription ?? '').toLowerCase().includes(q) ||
      (w.tags ?? []).some((t) => t.toLowerCase().includes(q))
    );
  }

  return NextResponse.json({ success: true, workspaces });
}

// ── POST: create workspace ────────────────────────────────────
export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as Partial<Workspace>;
  if (!body.name || !body.description || !body.systemPrompt) {
    return NextResponse.json(
      { error: 'name, description, and systemPrompt are required' },
      { status: 400 }
    );
  }

  const now = new Date().toISOString();
  const workspaces = loadWorkspaces();
  const newWorkspace: Workspace = {
    id: generateId(body.name),
    name: body.name,
    description: body.description,
    longDescription: body.longDescription,
    color: body.color ?? '#FF5C00',
    icon: body.icon ?? 'briefcase',
    dataSources: body.dataSources ?? [],
    enabledEndpoints: body.enabledEndpoints,
    systemPrompt: body.systemPrompt,
    temperature: body.temperature ?? 0.7,
    preferredModel: body.preferredModel ?? 'auto',
    maxToolRounds: body.maxToolRounds ?? 8,
    visibility: body.visibility ?? 'private',
    createdBy: getUserEmail(session),
    createdAt: now,
    updatedAt: now,
    usageCount: 0,
    rating: undefined,
    ratingCount: undefined,
    tags: body.tags ?? [],
    category: body.category ?? 'custom',
    samplePrompts: body.samplePrompts ?? [],
    responseFormat: body.responseFormat,
    includeDocuments: body.includeDocuments,
  };

  workspaces.push(newWorkspace);
  saveWorkspaces(workspaces);

  return NextResponse.json({ success: true, workspace: newWorkspace }, { status: 201 });
}

// ── PATCH: update workspace / increment usage / rate ──────────
export async function PATCH(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = (await request.json()) as Partial<Workspace> & {
    id: string;
    ratingValue?: number;
  };
  if (!body.id) {
    return NextResponse.json({ error: 'id is required' }, { status: 400 });
  }

  const workspaces = loadWorkspaces();
  const idx = workspaces.findIndex((w) => w.id === body.id);
  if (idx === -1) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  const existing = workspaces[idx];

  // Handle rating separately: compute running average
  if (body.ratingValue != null) {
    const currentRating = existing.rating ?? 0;
    const currentCount = existing.ratingCount ?? 0;
    const newCount = currentCount + 1;
    const newRating = (currentRating * currentCount + body.ratingValue) / newCount;
    const updated: Workspace = {
      ...existing,
      rating: Math.round(newRating * 10) / 10,
      ratingCount: newCount,
      updatedAt: new Date().toISOString(),
    };
    const newWorkspaces = [...workspaces];
    newWorkspaces[idx] = updated;
    saveWorkspaces(newWorkspaces);
    return NextResponse.json({ success: true, workspace: updated });
  }

  const updated: Workspace = {
    ...existing,
    ...(body.name != null && { name: body.name }),
    ...(body.description != null && { description: body.description }),
    ...(body.longDescription !== undefined && { longDescription: body.longDescription }),
    ...(body.color != null && { color: body.color }),
    ...(body.icon != null && { icon: body.icon }),
    ...(body.dataSources != null && { dataSources: body.dataSources }),
    ...(body.enabledEndpoints !== undefined && { enabledEndpoints: body.enabledEndpoints }),
    ...(body.systemPrompt != null && { systemPrompt: body.systemPrompt }),
    ...(body.temperature != null && { temperature: body.temperature }),
    ...(body.preferredModel != null && { preferredModel: body.preferredModel }),
    ...(body.maxToolRounds != null && { maxToolRounds: body.maxToolRounds }),
    ...(body.visibility != null && { visibility: body.visibility }),
    ...(body.tags != null && { tags: body.tags }),
    ...(body.category != null && { category: body.category }),
    ...(body.samplePrompts != null && { samplePrompts: body.samplePrompts }),
    ...(body.responseFormat !== undefined && { responseFormat: body.responseFormat }),
    ...(body.includeDocuments !== undefined && { includeDocuments: body.includeDocuments }),
    ...(body.usageCount != null && { usageCount: body.usageCount }),
    updatedAt: new Date().toISOString(),
  };

  const newWorkspaces = [...workspaces];
  newWorkspaces[idx] = updated;
  saveWorkspaces(newWorkspaces);

  return NextResponse.json({ success: true, workspace: updated });
}

// ── DELETE: remove workspace ──────────────────────────────────
export async function DELETE(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');
  if (!id) {
    return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
  }

  const workspaces = loadWorkspaces();
  const filtered = workspaces.filter((w) => w.id !== id);
  if (filtered.length === workspaces.length) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  saveWorkspaces(filtered);
  return NextResponse.json({ success: true });
}
