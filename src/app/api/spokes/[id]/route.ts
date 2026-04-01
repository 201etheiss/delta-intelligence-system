import { NextResponse } from 'next/server';
import { getSpokeById, checkSpokeHealth, type SpokeHealthResult } from '@/lib/spoke-registry';

interface SpokeDetailResponse {
  spoke: ReturnType<typeof getSpokeById>;
  health?: SpokeHealthResult;
  error?: string;
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse<SpokeDetailResponse>> {
  const spoke = getSpokeById(params.id);

  if (!spoke) {
    return NextResponse.json(
      { spoke: undefined, error: `Spoke '${params.id}' not found` },
      { status: 404 }
    );
  }

  const health = await checkSpokeHealth(spoke);

  return NextResponse.json({ spoke, health });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  const spoke = getSpokeById(params.id);

  if (!spoke) {
    return NextResponse.json(
      { error: `Spoke '${params.id}' not found` },
      { status: 404 }
    );
  }

  // Admin-only: in production, verify session has admin role
  // For now, accept any authenticated request
  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return NextResponse.json(
      { error: 'Invalid JSON body' },
      { status: 400 }
    );
  }

  const eventType = body.eventType;
  const payload = body.payload ?? {};

  if (typeof eventType !== 'string' || eventType.length === 0) {
    return NextResponse.json(
      { error: 'eventType is required' },
      { status: 400 }
    );
  }

  // Verify the spoke actually emits this event type
  const emits = spoke.eventEmissions as readonly string[];
  if (!emits.includes(eventType)) {
    return NextResponse.json(
      { error: `Spoke '${spoke.id}' does not emit event type '${eventType}'` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    event: {
      type: eventType,
      spoke_id: spoke.id,
      payload,
      emitted_at: new Date().toISOString(),
    },
  });
}
