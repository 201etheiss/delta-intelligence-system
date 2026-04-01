import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import {
  getUserConversations,
  saveConversation,
  deleteConversation,
  searchConversations,
  type Conversation,
  type ConversationMessage,
} from '@/lib/conversations';

/**
 * GET /api/conversations
 * List the current user's conversations.
 * Optional query params: ?limit=50&search=keyword
 */
export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const url = new URL(request.url);
    const limitParam = url.searchParams.get('limit');
    const searchParam = url.searchParams.get('search');
    const limit = limitParam ? Math.min(Math.max(parseInt(limitParam, 10) || 50, 1), 200) : 50;

    let conversations;
    if (searchParam && searchParam.trim().length > 0) {
      conversations = searchConversations(userEmail, searchParam.trim());
    } else {
      conversations = getUserConversations(userEmail, limit);
    }

    // Return without full message bodies for list view (lighter payload)
    const summaries = conversations.map(c => ({
      id: c.id,
      title: c.title,
      messageCount: c.messages.length,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      workspaceId: c.workspaceId,
    }));

    return NextResponse.json({ conversations: summaries, total: summaries.length });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[conversations/GET]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * POST /api/conversations
 * Save or update a conversation.
 * Body: { id, title?, messages, workspaceId? }
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const body = await request.json() as {
      id?: string;
      title?: string;
      messages?: ConversationMessage[];
      workspaceId?: string;
    };

    if (!body.id || !Array.isArray(body.messages)) {
      return NextResponse.json(
        { error: 'id and messages[] are required' },
        { status: 400 }
      );
    }

    if (body.messages.length === 0) {
      return NextResponse.json(
        { error: 'messages array must not be empty' },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: body.id,
      userEmail,
      title: body.title ?? 'New Conversation',
      messages: body.messages,
      createdAt: now,
      updatedAt: now,
      workspaceId: body.workspaceId,
    };

    saveConversation(conversation);

    return NextResponse.json({ success: true, id: conversation.id });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[conversations/POST]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/**
 * DELETE /api/conversations?id=xxx
 * Delete a conversation. User must own it or be admin.
 */
export async function DELETE(request: NextRequest): Promise<NextResponse> {
  try {
    const session = await getServerSession(authOptions);
    const userEmail = session?.user?.email ?? 'anonymous';

    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
    }

    // Verify ownership or admin
    const { getConversation } = await import('@/lib/conversations');
    const existing = getConversation(id);
    if (!existing) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const role = session?.user?.email ? getUserRole(session.user.email) : 'readonly';
    if (existing.userEmail !== userEmail && role !== 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 });
    }

    const deleted = deleteConversation(id);
    if (!deleted) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[conversations/DELETE]', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
