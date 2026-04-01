/**
 * API route: /api/team-intelligence
 *
 * Provides team-level Signal Map analytics for admin/HR users.
 *
 * GET  /api/team-intelligence              — all assessed profiles + org heatmap
 * GET  /api/team-intelligence?team=a,b,c   — team composition for specific emails
 * POST /api/team-intelligence              — deep team analysis with { action, emails }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  getAllAssessedProfiles,
  getTeamComposition,
  getOrgArchetypeHeatmap,
} from '@/lib/signal-map-team';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const TeamEmailsSchema = z.string().max(3200);

const PostBodySchema = z.object({
  action: z.literal('analyze'),
  emails: z.array(z.string().email().max(320)).min(1).max(50),
});

const RATE_LIMIT_CONFIG = { maxRequests: 10, windowMs: 60_000 };

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function requireAdminOrHr(
): Promise<
  | { email: string; allowed: true }
  | { error: NextResponse }
> {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Authentication required.' },
        { status: 401 },
      ),
    };
  }

  const role = getUserRole(session.user.email);
  if (role !== 'admin' && role !== 'hr') {
    return {
      error: NextResponse.json(
        { success: false, error: 'Insufficient permissions. Admin or HR role required.' },
        { status: 403 },
      ),
    };
  }

  const rl = checkRateLimit(
    `team-intel:${session.user.email}`,
    RATE_LIMIT_CONFIG,
  );
  if (!rl.allowed) {
    return {
      error: NextResponse.json(
        { success: false, error: 'Rate limit exceeded. Try again in a moment.' },
        { status: 429 },
      ),
    };
  }

  return { email: session.user.email, allowed: true };
}

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  const auth = await requireAdminOrHr();
  if ('error' in auth) return auth.error;

  const params = req.nextUrl.searchParams;
  const teamRaw = params.get('team');

  // ── Team composition for specific emails ──────────────────────
  if (teamRaw) {
    const parsed = TeamEmailsSchema.safeParse(teamRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid team parameter.' },
        { status: 400 },
      );
    }

    const emails = parsed.data
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0);

    if (emails.length === 0) {
      return NextResponse.json(
        { success: false, error: 'No valid emails provided.' },
        { status: 400 },
      );
    }

    if (emails.length > 50) {
      return NextResponse.json(
        { success: false, error: 'Maximum 50 emails per request.' },
        { status: 400 },
      );
    }

    try {
      const composition = await getTeamComposition(emails);
      return NextResponse.json({ success: true, data: composition });
    } catch {
      return NextResponse.json(
        { success: false, error: 'Failed to analyze team composition.' },
        { status: 500 },
      );
    }
  }

  // ── Org-wide overview ─────────────────────────────────────────
  try {
    const [profiles, heatmap] = await Promise.all([
      getAllAssessedProfiles(),
      getOrgArchetypeHeatmap(),
    ]);

    return NextResponse.json({
      success: true,
      data: {
        profiles,
        heatmap,
        assessedCount: (profiles ?? []).length,
      },
    });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to load team intelligence data.' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// POST handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
  const auth = await requireAdminOrHr();
  if ('error' in auth) return auth.error;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: 'Invalid JSON body.' },
      { status: 400 },
    );
  }

  const parsed = PostBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid request body.',
        details: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const composition = await getTeamComposition(parsed.data.emails);
    return NextResponse.json({ success: true, data: composition });
  } catch {
    return NextResponse.json(
      { success: false, error: 'Failed to analyze team.' },
      { status: 500 },
    );
  }
}
