/**
 * GET  /api/journal-entries/templates  — List all JE templates
 * POST /api/journal-entries/templates  — Create a new template
 * PATCH /api/journal-entries/templates — Update a template
 * DELETE /api/journal-entries/templates — Delete a template
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  readTemplates,
  writeTemplates,
  type JETemplate,
  type JEFamily,
  type JETemplateType,
} from '@/lib/engines/journal-entry';

async function getUser() {
  const session = await getServerSession(authOptions);
  if (session?.user?.email) {
    const role = getUserRole(session.user.email);
    return { email: session.user.email, role };
  }
  if (process.env.NODE_ENV === 'development') {
    return { email: 'dev@delta360.energy', role: 'admin' as const };
  }
  return null;
}

export async function GET(): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const templates = readTemplates();
    return NextResponse.json({ success: true, data: templates, count: templates.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to list templates';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as {
      name: string;
      family: JEFamily;
      type: JETemplateType;
      lines: JETemplate['lines'];
      autoReverse?: boolean;
      frequency?: string;
      sourceParser?: string | null;
    };

    if (!body.name || !body.family || !body.type || !body.lines) {
      return NextResponse.json(
        { success: false, error: 'name, family, type, and lines are required' },
        { status: 400 }
      );
    }

    const ts = Date.now().toString(36);
    const rand = Math.random().toString(36).slice(2, 8);
    const id = `JET-${ts}-${rand}`;

    const template: JETemplate = {
      id,
      name: body.name,
      family: body.family,
      type: body.type,
      lines: [...body.lines],
      autoReverse: body.autoReverse ?? false,
      frequency: body.frequency ?? 'monthly',
      sourceParser: body.sourceParser ?? null,
    };

    const all = [...readTemplates(), template];
    writeTemplates(all);

    return NextResponse.json({ success: true, data: template }, { status: 201 });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to create template';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const body = (await req.json()) as { id: string } & Partial<Omit<JETemplate, 'id'>>;
    if (!body.id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const all = [...readTemplates()];
    const idx = all.findIndex((t) => t.id === body.id);
    if (idx === -1) {
      return NextResponse.json({ success: false, error: `Template ${body.id} not found` }, { status: 404 });
    }

    const existing = all[idx];
    const updated: JETemplate = {
      ...existing,
      name: body.name ?? existing.name,
      family: body.family ?? existing.family,
      type: body.type ?? existing.type,
      lines: body.lines ? [...body.lines] : existing.lines,
      autoReverse: body.autoReverse ?? existing.autoReverse,
      frequency: body.frequency ?? existing.frequency,
      sourceParser: body.sourceParser !== undefined ? body.sourceParser : existing.sourceParser,
    };

    const result = [...all.slice(0, idx), updated, ...all.slice(idx + 1)];
    writeTemplates(result);

    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to update template';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest): Promise<NextResponse> {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }
    if (user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Admin access required' }, { status: 403 });
    }

    const { id } = (await req.json()) as { id: string };
    if (!id) {
      return NextResponse.json({ success: false, error: 'id is required' }, { status: 400 });
    }

    const all = readTemplates();
    if (!all.find((t) => t.id === id)) {
      return NextResponse.json({ success: false, error: `Template ${id} not found` }, { status: 404 });
    }

    writeTemplates(all.filter((t) => t.id !== id));
    return NextResponse.json({ success: true, message: `Template ${id} deleted` });
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to delete template';
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
