import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getRawEntries } from '@/lib/usage-logger';

async function requireAdmin(request: NextRequest): Promise<NextResponse | null> {
  if (process.env.NODE_ENV === 'development') {
    return null;
  }
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }
  const role = getUserRole(session.user.email);
  if (role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Forbidden: admin role required' }, { status: 403 });
  }
  return null;
}

function escapeCsvField(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = await requireAdmin(request);
    if (authError) return authError;

    const entries = getRawEntries();

    const header = 'timestamp,user,model,inputTokens,outputTokens,cost';
    const rows = entries.map((e) =>
      [
        escapeCsvField(e.timestamp),
        escapeCsvField(e.userEmail || 'anonymous'),
        escapeCsvField(e.model),
        String(e.inputTokens),
        String(e.outputTokens),
        e.estimatedCost.toFixed(6),
      ].join(',')
    );

    const csv = [header, ...rows].join('\n');

    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename=usage-export.csv',
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
