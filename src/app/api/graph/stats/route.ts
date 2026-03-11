import { NextResponse } from 'next/server';
import { getGraphStats } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const stats = await getGraphStats();
    return NextResponse.json({ success: true, data: stats });
  } catch (error) {
    console.error('Graph stats error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch graph stats' },
      { status: 500 }
    );
  }
}
