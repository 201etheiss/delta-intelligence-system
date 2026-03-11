import { NextResponse } from 'next/server';
import { getEntityAccountRelations, getAccountHierarchy } from '@/lib/neo4j';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [relations, hierarchy] = await Promise.all([
      getEntityAccountRelations(),
      getAccountHierarchy(),
    ]);
    return NextResponse.json({ success: true, data: { relations, hierarchy } });
  } catch (error) {
    console.error('Entity relations error:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch entity relations' },
      { status: 500 }
    );
  }
}
