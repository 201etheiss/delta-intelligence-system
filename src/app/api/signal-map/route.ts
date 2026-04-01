/**
 * API route: /api/signal-map
 *
 * Exposes Signal Map operator profiles within Delta Intelligence.
 *
 * Query params:
 *   GET ?email=X           — single profile summary
 *   GET ?email=X&full=true — full profile with narratives
 *   GET ?emails=X,Y,Z      — team profiles (summaries)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { z } from 'zod';
import { authOptions } from '@/lib/auth';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  getProfileByEmail,
  getProfileSummary,
  getTeamProfiles,
} from '@/lib/signal-map-client';

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const EmailSchema = z.string().email().max(320);
const EmailsSchema = z.string().max(3200);

const SIGNAL_MAP_LIMIT = { maxRequests: 30, windowMs: 60_000 };

// ---------------------------------------------------------------------------
// GET handler
// ---------------------------------------------------------------------------

export async function GET(req: NextRequest) {
  // Auth
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json(
      { error: 'Authentication required.' },
      { status: 401 },
    );
  }

  // Rate limit
  const rl = checkRateLimit(`signal-map:${session.user.email}`, SIGNAL_MAP_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again in a moment.' },
      { status: 429 },
    );
  }

  const params = req.nextUrl.searchParams;
  const emailRaw = params.get('email');
  const emailsRaw = params.get('emails');
  const full = params.get('full') === 'true';

  // ── Team profiles ─────────────────────────────────────────────
  if (emailsRaw) {
    const parsed = EmailsSchema.safeParse(emailsRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid emails parameter.' },
        { status: 400 },
      );
    }

    const emails = parsed.data
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);

    // Validate each email
    const invalid = emails.filter((e) => !EmailSchema.safeParse(e).success);
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: `Invalid email addresses: ${invalid.join(', ')}` },
        { status: 400 },
      );
    }

    if (emails.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 emails per request.' },
        { status: 400 },
      );
    }

    try {
      const profiles = await getTeamProfiles(emails);
      return NextResponse.json({ data: profiles });
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch team profiles.' },
        { status: 500 },
      );
    }
  }

  // ── Single profile ────────────────────────────────────────────
  if (emailRaw) {
    const parsed = EmailSchema.safeParse(emailRaw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid email address.' },
        { status: 400 },
      );
    }

    try {
      if (full) {
        const profile = await getProfileByEmail(parsed.data);
        if (!profile) {
          return NextResponse.json(
            { data: null, message: 'No assessment on file.' },
            { status: 200 },
          );
        }
        return NextResponse.json({ data: profile });
      }

      const summary = await getProfileSummary(parsed.data);
      if (!summary) {
        return NextResponse.json(
          { data: null, message: 'No assessment on file.' },
          { status: 200 },
        );
      }
      return NextResponse.json({ data: summary });
    } catch {
      return NextResponse.json(
        { error: 'Failed to fetch profile.' },
        { status: 500 },
      );
    }
  }

  return NextResponse.json(
    { error: 'Provide either ?email= or ?emails= query parameter.' },
    { status: 400 },
  );
}
