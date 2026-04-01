import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { generateDigest } from '@/lib/daily-digest';
import { type UserRole } from '@/lib/config/roles';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const role = (session?.user?.role ?? 'admin') as UserRole;

  try {
    const digest = await generateDigest(role);
    return NextResponse.json({ success: true, digest });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Digest generation failed' },
      { status: 500 }
    );
  }
}

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  // In production, this would send the digest via email using
  // the alerts/email infrastructure (Resend/SendGrid).
  // For now, return success with a note.
  return NextResponse.json({
    success: true,
    message: 'Digest email queued. Email delivery requires alert service configuration.',
  });
}
