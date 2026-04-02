import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { fetchMS365Users, fetchMS365Org } from '@/lib/engines/data-bridge';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [users, org] = await Promise.all([
      fetchMS365Users(),
      fetchMS365Org(),
    ]);

    // Build manager map from org data
    const managerMap = new Map<string, string>();
    for (const entry of org) {
      for (const reportId of entry.directReports ?? []) {
        managerMap.set(reportId, entry.displayName);
      }
    }

    // Enrich users with manager info
    const enriched = users.map((u) => ({
      ...u,
      managerName: u.managerName ?? managerMap.get(u.id) ?? null,
    }));

    // Department breakdown
    const departments = new Set<string>();
    for (const u of enriched) {
      if (u.department) departments.add(u.department);
    }

    return NextResponse.json({
      success: true,
      data: {
        users: enriched,
        departments: Array.from(departments).sort(),
        totalCount: enriched.length,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed' },
      { status: 500 },
    );
  }
}
