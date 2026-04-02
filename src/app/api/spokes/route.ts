import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
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

export async function GET(request: Request): Promise<NextResponse<SpokeResponse | { success: false; error: string }>> {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ success: false as const, error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const shouldCheck = searchParams.get('check') === 'true';

  if (shouldCheck) {
    const healthResults = await checkAllSpokeHealth();
    return NextResponse.json({ spokes: SPOKE_REGISTRY, healthResults });
  }

  return NextResponse.json({ spokes: SPOKE_REGISTRY });
}
