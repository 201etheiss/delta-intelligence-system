import { NextResponse } from 'next/server';

export async function GET() {
  try {
    if (process.env.NODE_ENV !== 'development') {
      return NextResponse.json({ success: false, error: 'Not available' }, { status: 404 });
    }
    return NextResponse.json({
      success: true,
      hasKey: !!process.env.ANTHROPIC_API_KEY,
      gatewayUrl: process.env.GATEWAY_BASE_URL ?? 'MISSING',
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
