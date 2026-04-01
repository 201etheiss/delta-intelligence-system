import { NextRequest, NextResponse } from 'next/server';
import { getPreferences, updatePreferences } from '@/lib/user-preferences';
import type {
  ModelPreference,
  DigestFrequency,
  ExportFormat,
  DateRangeDefault,
} from '@/lib/user-preferences';

export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get('userId');
    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const preferences = getPreferences(userId);
    return NextResponse.json({ preferences });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to load preferences' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      userId: string;
      defaultModel?: ModelPreference;
      defaultProfitCenter?: string;
      defaultDateRange?: DateRangeDefault;
      timezone?: string;
      emailDigest?: DigestFrequency;
      preferredFormat?: ExportFormat;
      darkMode?: boolean;
    };

    if (!body.userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const { userId, ...patch } = body;
    const updated = updatePreferences(userId, patch);
    return NextResponse.json({ preferences: updated });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to update preferences' },
      { status: 500 }
    );
  }
}
