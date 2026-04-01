import { NextResponse } from 'next/server';
import {
  SPOKE_REGISTRY,
  checkAllSpokeHealth,
  type SpokeConfig,
  type SpokeHealthResult,
} from '@/lib/spoke-registry';

interface SpokeResponse {
  spokes: readonly SpokeConfig[];
  healthResults?: SpokeHealthResult[];
}

export async function GET(request: Request): Promise<NextResponse<SpokeResponse>> {
  const { searchParams } = new URL(request.url);
  const shouldCheck = searchParams.get('check') === 'true';

  if (shouldCheck) {
    const healthResults = await checkAllSpokeHealth();
    return NextResponse.json({ spokes: SPOKE_REGISTRY, healthResults });
  }

  return NextResponse.json({ spokes: SPOKE_REGISTRY });
}
