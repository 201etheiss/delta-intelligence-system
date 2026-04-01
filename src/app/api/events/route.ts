import { NextRequest, NextResponse } from 'next/server';
import { EmitEventSchema } from '@/lib/events/event-schema';
import { emitEvent, replayEvents } from '@/lib/events/event-store';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = EmitEventSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid event', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const event = await emitEvent(parsed.data);

    if (!event) {
      return NextResponse.json(
        { success: false, error: 'Failed to emit event — event store may be unavailable' },
        { status: 503 }
      );
    }

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = request.nextUrl;
    const fromSequence = searchParams.get('from_sequence');
    const type = searchParams.get('type');
    const limit = searchParams.get('limit');
    const stream = searchParams.get('stream');

    const options = {
      fromSequence: fromSequence ? parseInt(fromSequence, 10) : undefined,
      type: type ?? undefined,
      limit: limit ? parseInt(limit, 10) : 100,
    };

    // SSE streaming mode
    if (stream === 'true') {
      const encoder = new TextEncoder();
      const readable = new ReadableStream({
        async start(controller) {
          const events = await replayEvents(options);
          for (const event of events) {
            const data = `data: ${JSON.stringify(event)}\n\n`;
            controller.enqueue(encoder.encode(data));
          }
          controller.close();
        },
      });

      return new Response(readable, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
      });
    }

    // Standard JSON response
    const events = await replayEvents(options);
    return NextResponse.json({ success: true, data: events, meta: { count: events.length } });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal error' },
      { status: 500 }
    );
  }
}
