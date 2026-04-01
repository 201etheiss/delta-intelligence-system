import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { getConversation } from '@/lib/conversations';

/**
 * GET /api/conversations/:id
 * Load a specific conversation with full message history.
 * User must own the conversation or be admin.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';
    const { id } = await params;

    if (!id) {
      return NextResponse.json({ error: 'Conversation ID is required' }, { status: 400 });
    }

    const conversation = getConversation(id);
    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Authorization: owner or admin
    const role = session?.user?.email ? getUserRole(session.user.email) : 'readonly';
    if (conversation.userEmail !== userEmail && role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    return NextResponse.json({ conversation });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[conversations/[id]/GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
