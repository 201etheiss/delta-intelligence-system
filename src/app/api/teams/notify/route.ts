/**
 * Proactive Teams Messaging — send messages to Teams channels/users
 * without waiting for them to message first.
 *
 * Used by: anomaly alerts, scheduled digests, automation results.
 *
 * POST /api/teams/notify
 * Body: { channelId?: string, userId?: string, message: string, card?: object }
 * Auth: Internal API key (TEAMS_NOTIFY_SECRET) or valid session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import {
  loadConversationReferences,
  sendTeamsMessage,
  buildAdaptiveCard,
  type AdaptiveCard,
} from '@/lib/teams-bot';
import { logAudit } from '@/lib/audit-log';

interface NotifyRequest {
  channelId?: string;
  userId?: string;
  message?: string;
  card?: {
    title?: string;
    summary?: string;
    rows?: Array<Record<string, string | number>>;
    kpis?: Array<{ label: string; value: string | number; color?: string }>;
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // Auth: check for internal secret or valid session
  const secret = request.headers.get('x-notify-secret');
  const session = await getServerSession(authOptions);

  const isInternalCall = secret && secret === process.env.TEAMS_NOTIFY_SECRET;
  const isAdminSession = session?.user?.role === 'admin';

  if (!isInternalCall && !isAdminSession) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: NotifyRequest;
  try {
    body = (await request.json()) as NotifyRequest;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.message && !body.card) {
    return NextResponse.json(
      { error: 'Either message or card is required' },
      { status: 400 }
    );
  }

  if (!body.channelId && !body.userId) {
    return NextResponse.json(
      { error: 'Either channelId or userId is required' },
      { status: 400 }
    );
  }

  // Look up the conversation reference
  const refs = loadConversationReferences();
  const refKey = body.channelId
    ? `channel:${body.channelId}`
    : `user:${body.userId}`;
  const ref = refs[refKey] ?? refs[body.channelId ?? ''] ?? refs[body.userId ?? ''];

  if (!ref) {
    // List available keys for debugging
    const availableKeys = Object.keys(refs);
    return NextResponse.json(
      {
        error: 'No conversation reference found for the specified target',
        hint: 'The bot must have received at least one message from this channel/user first.',
        availableTargets: availableKeys.length > 0 ? availableKeys : undefined,
      },
      { status: 404 }
    );
  }

  // Build the payload
  let payload: string | AdaptiveCard;
  if (body.card) {
    payload = buildAdaptiveCard(body.card);
  } else {
    payload = body.message ?? '';
  }

  // Send it
  const result = await sendTeamsMessage(ref, payload);

  logAudit({
    userEmail: session?.user?.email ?? 'system',
    role: session?.user?.role ?? 'admin',
    action: 'teams_notify',
    detail: `Target: ${refKey} | Success: ${result.success}`,
    tool: 'teams_notify',
    success: result.success,
  });

  if (!result.success) {
    return NextResponse.json(
      { error: result.error ?? 'Failed to send message' },
      { status: 502 }
    );
  }

  return NextResponse.json({ success: true, target: refKey });
}

// GET: List stored conversation references (admin only)
export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') {
    return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
  }

  const refs = loadConversationReferences();
  const entries = Object.entries(refs).map(([key, ref]) => ({
    key,
    conversationType: ref.conversation.conversationType ?? 'personal',
    userName: ref.user.name ?? 'unknown',
    savedAt: ref.savedAt,
  }));

  return NextResponse.json({ conversations: entries, count: entries.length });
}
