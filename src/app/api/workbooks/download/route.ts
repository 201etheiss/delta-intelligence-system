import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const EXPORT_DIR = join('/tmp', 'di-exports');

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
    }

    const fileId = request.nextUrl.searchParams.get('id');
    if (!fileId || !/^[a-zA-Z0-9_.-]+\.xlsx$/.test(fileId)) {
      return NextResponse.json({ success: false, error: 'Invalid file ID' }, { status: 400 });
    }

    const filePath = resolve(EXPORT_DIR, fileId);
    if (!filePath.startsWith(EXPORT_DIR)) {
      return NextResponse.json({ success: false, error: 'Invalid file path' }, { status: 400 });
    }

    if (!existsSync(filePath)) {
      return NextResponse.json({ success: false, error: 'File not found' }, { status: 404 });
    }

    const buffer = readFileSync(filePath);
    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${fileId}"`,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
