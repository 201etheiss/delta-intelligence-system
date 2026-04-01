import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { authOptions } from '@/lib/auth';

interface TemplateParam {
  name: string;
  type: string;
  default?: string | number;
}

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  prompt: string;
  params: TemplateParam[];
}

function getTemplatesPath(): string {
  return path.join(process.cwd(), 'data', 'report-templates.json');
}

function readTemplates(): ReportTemplate[] {
  const filePath = getTemplatesPath();
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ReportTemplate[];
  } catch {
    return [];
  }
}

function writeTemplates(templates: ReportTemplate[]): void {
  const filePath = getTemplatesPath();
  writeFileSync(filePath, JSON.stringify(templates, null, 2), 'utf-8');
}

export async function GET(): Promise<NextResponse> {
  // Auth: session or dev fallback
  const session = await getServerSession(authOptions);
  if (!session && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const templates = readTemplates();
  return NextResponse.json({ templates });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json();

    if (!body.name || !body.prompt) {
      return NextResponse.json(
        { error: 'name and prompt are required' },
        { status: 400 }
      );
    }

    const templates = readTemplates();

    const newTemplate: ReportTemplate = {
      id: body.id || `custom-${Date.now()}`,
      name: body.name,
      description: body.description || '',
      prompt: body.prompt,
      params: body.params || [],
    };

    // Replace if same ID exists, otherwise append
    const existingIdx = templates.findIndex(t => t.id === newTemplate.id);
    if (existingIdx >= 0) {
      templates[existingIdx] = newTemplate;
    } else {
      templates.push(newTemplate);
    }

    writeTemplates(templates);

    return NextResponse.json({ success: true, template: newTemplate });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to save template';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session && process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'id query param is required' }, { status: 400 });
    }

    const templates = readTemplates();
    const filtered = templates.filter(t => t.id !== id);

    if (filtered.length === templates.length) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    writeTemplates(filtered);

    return NextResponse.json({ success: true });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Failed to delete template';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
