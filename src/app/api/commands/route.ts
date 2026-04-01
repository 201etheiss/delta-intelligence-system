import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { executeCommand, getRegisteredCommands } from '@/lib/cqrs/command-bus';

const CommandRequestSchema = z.object({
  type: z.string().min(1),
  payload: z.record(z.string(), z.unknown()).default({}),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = CommandRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid command', details: parsed.error.issues },
        { status: 400 }
      );
    }

    const events = await executeCommand(parsed.data.type, parsed.data.payload);

    return NextResponse.json(
      { success: true, data: { events_emitted: events.length, events } },
      { status: 200 }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal error';
    const status = message.startsWith('No handler registered') ? 404 : 500;

    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function GET() {
  const commands = getRegisteredCommands();
  return NextResponse.json({ success: true, data: { commands } });
}
