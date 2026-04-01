import { NextRequest, NextResponse } from 'next/server';
import { generateBrief } from '@/lib/engines/intelligence-brief';

export async function GET(req: NextRequest) {
  try {
    const params = req.nextUrl.searchParams;
    const rawType = params.get('type') ?? 'daily';
    const type =
      rawType === 'weekly' ? 'weekly' : rawType === 'flash' ? 'flash' : 'daily';

    const brief = await generateBrief(type);

    return NextResponse.json({ success: true, brief });
  } catch (err) {
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to generate brief',
      },
      { status: 500 },
    );
  }
}
