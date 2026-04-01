import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { generateBriefing, refreshBriefing } from '@/lib/nova/briefing-engine';
import { authOptions } from '@/lib/auth';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'unknown';
    const role = (session?.user as { role?: string })?.role ?? 'readonly';

    const briefing = await generateBriefing(userEmail, role);
    return NextResponse.json({ success: true, data: briefing });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to generate briefing',
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({})) as { refresh?: boolean };

    if (!body.refresh) {
      return NextResponse.json(
        { success: false, error: 'POST body must include { refresh: true }' },
        { status: 400 }
      );
    }

    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'unknown';
    const role = (session?.user as { role?: string })?.role ?? 'readonly';

    const briefing = await refreshBriefing(userEmail, role);
    return NextResponse.json({ success: true, data: briefing });
  } catch (error) {
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh briefing',
      },
      { status: 500 }
    );
  }
}
