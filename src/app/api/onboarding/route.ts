import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface OnboardingStep {
  id: string;
  text: string;
  link: string;
}

interface OnboardingGuide {
  title: string;
  steps: OnboardingStep[];
}

// GET /api/onboarding — returns role-specific guide
export async function GET(): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userRole = session?.user?.role ?? 'admin';

    const filePath = join(process.cwd(), 'data', 'onboarding.json');
    if (!existsSync(filePath)) {
      return NextResponse.json({ error: 'Onboarding data not found' }, { status: 404 });
    }

    const raw = readFileSync(filePath, 'utf-8');
    const allGuides = JSON.parse(raw) as Record<string, OnboardingGuide>;

    const guide = allGuides[userRole] ?? allGuides['readonly'];
    if (!guide) {
      return NextResponse.json({ error: 'No guide for this role' }, { status: 404 });
    }

    return NextResponse.json({ guide, role: userRole });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
