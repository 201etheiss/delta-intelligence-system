import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addFeedback, listFeedback, getFeedbackStats } from '@/lib/feedback';
import { FeedbackSchema, validateRequest } from '@/lib/validation';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  try {
    const raw = await req.json();
    const validated = validateRequest(FeedbackSchema, raw);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data;

    const entry = addFeedback({
      messageId: body.messageId,
      conversationId: body.conversationId ?? '',
      rating: body.rating,
      comment: body.comment ?? '',
      model: body.model ?? '',
      query: body.query ?? '',
      userEmail: body.userEmail ?? '',
    });

    return NextResponse.json({ feedback: entry }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to save feedback' },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  try {
    const mode = req.nextUrl.searchParams.get('mode');

    if (mode === 'stats') {
      const stats = getFeedbackStats();
      return NextResponse.json(stats);
    }

    const entries = listFeedback();
    return NextResponse.json({ entries });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load feedback' },
      { status: 500 }
    );
  }
}
