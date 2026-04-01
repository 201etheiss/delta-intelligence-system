import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { loadAutomations } from '@/lib/automations';
import { executeAutomation } from '@/lib/automation-executor';

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.role || session.user.role !== 'admin') {
    return NextResponse.json(
      { error: 'Admin access required' },
      { status: 403 }
    );
  }

  let body: { automationId: string };
  try {
    body = (await request.json()) as { automationId: string };
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!body.automationId) {
    return NextResponse.json(
      { error: 'automationId is required' },
      { status: 400 }
    );
  }

  const automations = loadAutomations();
  const automation = automations.find((a) => a.id === body.automationId);
  if (!automation) {
    return NextResponse.json(
      { error: 'Automation not found' },
      { status: 404 }
    );
  }

  try {
    const run = await executeAutomation(automation);
    return NextResponse.json({ run });
  } catch (err) {
    return NextResponse.json(
      {
        error: `Execution failed: ${err instanceof Error ? err.message : 'unknown error'}`,
      },
      { status: 500 }
    );
  }
}
