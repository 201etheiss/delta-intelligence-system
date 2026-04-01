import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/config/roles';
import { addLearning, getAssistantForRole } from '@/lib/assistants';

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      const headerRole = request.headers.get('x-user-role') ?? 'admin';
      const valid: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];
      role = valid.includes(headerRole as UserRole) ? (headerRole as UserRole) : 'admin';
    }

    const assistant = getAssistantForRole(role);
    if (!assistant) {
      return NextResponse.json({ learnings: [] });
    }

    return NextResponse.json({ learnings: assistant.learnings });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      const headerRole = request.headers.get('x-user-role') ?? 'admin';
      const valid: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];
      role = valid.includes(headerRole as UserRole) ? (headerRole as UserRole) : 'admin';
    }

    const body = (await request.json()) as { learning?: string };

    if (!body.learning || typeof body.learning !== 'string') {
      return NextResponse.json({ error: 'learning string is required' }, { status: 400 });
    }

    if (body.learning.length > 1000) {
      return NextResponse.json({ error: 'learning must be under 1000 characters' }, { status: 400 });
    }

    const updated = addLearning(role, body.learning);
    if (!updated) {
      return NextResponse.json({ error: 'No assistant found for this role' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      totalLearnings: updated.learnings.length,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
