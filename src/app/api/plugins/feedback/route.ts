import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getPlugin } from '@/lib/plugins/registry';
import { reweightFromFeedback } from '@/lib/plugins/router';

// ── POST: Rate a plugin call ─────────────────────────────────

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const email = session?.user?.email ?? 'dev@delta360.energy';
  // Validate authenticated
  getUserRole(email);

  try {
    const body = (await request.json()) as Record<string, unknown>;
    const pluginId = body.pluginId;
    const rating = body.rating;
    const comment = typeof body.comment === 'string' ? body.comment : undefined;

    if (typeof pluginId !== 'string') {
      return NextResponse.json(
        { success: false, error: 'Missing required field: pluginId' },
        { status: 400 }
      );
    }

    if (typeof rating !== 'number' || rating < 1 || rating > 5) {
      return NextResponse.json(
        { success: false, error: 'Rating must be a number between 1 and 5' },
        { status: 400 }
      );
    }

    // Verify plugin exists
    const plugin = getPlugin(pluginId);
    if (!plugin) {
      return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
    }

    // Update quality score and avg rating via EMA
    reweightFromFeedback(pluginId, rating);

    // Re-read to get updated values
    const updated = getPlugin(pluginId);

    return NextResponse.json({
      success: true,
      data: {
        pluginId,
        rating,
        comment: comment ?? null,
        newQualityScore: updated?.qualityScore ?? plugin.qualityScore,
        newAvgRating: updated?.avgRating ?? plugin.avgRating,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to submit feedback';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
