import { NextRequest, NextResponse } from 'next/server';
import { getGraphNetwork } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '150', 10);
    const network = await getGraphNetwork(Math.min(limit, 300));
    return NextResponse.json({ success: true, data: network });
  } catch (error) {
    console.error('Graph network error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graph network' },
      { status: 500 }
    );
  }
}
