import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { fetchSafetyEvents, computeSafetyStats } from '@/lib/samsara-events';
import type { SafetyEvent } from '@/lib/samsara-events';

/**
 * GET /api/fleet/events
 *
 * Returns processed Samsara safety events with computed severity and stats.
 *
 * Query params:
 *   ?days=7        — filter to events within the last N days (default: all)
 *   ?driver=name   — filter by driver name (case-insensitive substring match)
 *   ?vehicle=name  — filter by vehicle name (case-insensitive substring match)
 *   ?severity=critical|warning|info — filter by severity level
 */
export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const userEmail = session?.user?.email ?? 'etheiss@delta360.energy';
  const role = getUserRole(userEmail);

  const searchParams = request.nextUrl.searchParams;
  const daysParam = searchParams.get('days');
  const driverFilter = searchParams.get('driver')?.toLowerCase() ?? null;
  const vehicleFilter = searchParams.get('vehicle')?.toLowerCase() ?? null;
  const severityFilter = searchParams.get('severity')?.toLowerCase() ?? null;

  // Validate severity param
  const validSeverities = ['critical', 'warning', 'info'];
  if (severityFilter && !validSeverities.includes(severityFilter)) {
    return NextResponse.json(
      { success: false, error: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` },
      { status: 400 }
    );
  }

  // Validate days param
  const days = daysParam ? parseInt(daysParam, 10) : undefined;
  if (daysParam && (isNaN(days as number) || (days as number) < 1)) {
    return NextResponse.json(
      { success: false, error: 'days must be a positive integer' },
      { status: 400 }
    );
  }

  try {
    const allEvents = await fetchSafetyEvents(role, days);

    // Apply filters immutably
    let filtered: readonly SafetyEvent[] = allEvents;

    if (driverFilter) {
      filtered = filtered.filter((e) =>
        e.driverName.toLowerCase().includes(driverFilter)
      );
    }

    if (vehicleFilter) {
      filtered = filtered.filter((e) =>
        e.vehicleName.toLowerCase().includes(vehicleFilter)
      );
    }

    if (severityFilter) {
      filtered = filtered.filter((e) => e.severity === severityFilter);
    }

    const stats = computeSafetyStats(filtered);

    return NextResponse.json({
      success: true,
      events: filtered,
      stats,
      count: filtered.length,
      filters: {
        days: days ?? null,
        driver: driverFilter,
        vehicle: vehicleFilter,
        severity: severityFilter,
      },
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('[FleetEvents] Error fetching safety events:', error);
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to fetch safety events',
      },
      { status: 500 }
    );
  }
}
