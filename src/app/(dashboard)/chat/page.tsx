'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import { useSearchParams, usePathname } from 'next/navigation';
import { MessageSquare, Plus, Trash2, Clock } from 'lucide-react';
import ChatInterface from '@/components/chat/ChatInterface';

// ---------------------------------------------------------------------------
// Module context derivation
// ---------------------------------------------------------------------------

const PATH_TO_MODULE: Record<string, string> = {
  finance: 'finance',
  accounting: 'finance',
  operations: 'operations',
  compliance: 'compliance',
  organization: 'organization',
  hr: 'organization',
  'signal-map': 'signal-map',
  gl: 'gl',
  portal: 'portal',
  'equipment-tracker': 'equipment-tracker',
  erp: 'erp',
  intelligence: 'intelligence',
};

function deriveModuleFromPath(pathname: string): string | undefined {
  const segments = pathname.split('/').filter(Boolean);
  for (const seg of segments) {
    if (PATH_TO_MODULE[seg]) return PATH_TO_MODULE[seg];
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface StoredConversation {
  id: string;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant';
    content: string;
    timestamp: string;
  }>;
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'di_conversations';
const ACTIVE_KEY = 'di_active_conversation';

// ---------------------------------------------------------------------------
// Sidebar
// ---------------------------------------------------------------------------

function ChatSidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
}: {
  conversations: StoredConversation[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onNew: () => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="flex flex-col h-full w-[260px] shrink-0 border-r border-[#27272A] bg-[#111113]">
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#27272A]">
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#FE5000] to-[#ff8c42] flex items-center justify-center text-white text-xs font-bold">
          N
        </div>
        <span className="text-sm font-semibold text-white">Nova</span>
      </div>

      {/* New Chat button */}
      <div className="px-3 py-2">
        <button
          onClick={onNew}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-xs font-medium text-white bg-[#FE5000] hover:bg-[#e04600] transition-colors"
        >
          <Plus size={14} />
          New Chat
        </button>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto px-2 py-1">
        {conversations.length === 0 && (
          <p className="text-xs text-[#52525B] text-center mt-8 px-4">
            No conversations yet. Start a new chat.
          </p>
        )}
        {conversations.map((convo) => {
          const isActive = convo.id === activeId;
          const firstUserMsg = convo.messages.find((m) => m.role === 'user');
          const title = firstUserMsg
            ? firstUserMsg.content.slice(0, 50) + (firstUserMsg.content.length > 50 ? '...' : '')
            : 'New Chat';
          const timeAgo = formatTimeAgo(convo.updatedAt);

          return (
            <button
              key={convo.id}
              onClick={() => onSelect(convo.id)}
              className={`group flex items-start gap-2 w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${
                isActive
                  ? 'bg-[#27272A] text-white'
                  : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-white'
              }`}
            >
              <MessageSquare size={14} className="mt-0.5 shrink-0 text-[#52525B]" />
              <div className="flex-1 min-w-0">
                <p className="text-xs truncate">{title}</p>
                <p className="text-[10px] text-[#52525B] mt-0.5 flex items-center gap-1">
                  <Clock size={9} />
                  {timeAgo}
                  <span className="text-[#3F3F46]">·</span>
                  {convo.messages.length} msgs
                </p>
              </div>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDelete(convo.id);
                }}
                className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-900/30 text-[#52525B] hover:text-red-400 transition-all"
                title="Delete conversation"
              >
                <Trash2 size={12} />
              </button>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-[#27272A] text-[10px] text-[#3F3F46]">
        {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'now';
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  return `${days}d`;
}

// ---------------------------------------------------------------------------
// Main Page
// ---------------------------------------------------------------------------

function ChatContent() {
  const { data: session } = useSession();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const isAdmin = session?.user?.role === 'admin' || !session;
  const moduleContext = searchParams.get('module') ?? deriveModuleFromPath(pathname) ?? undefined;

  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Load conversations from localStorage
  const loadConversations = useCallback(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const convos: StoredConversation[] = raw ? JSON.parse(raw) : [];
      convos.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
      setConversations(convos);

      const active = localStorage.getItem(ACTIVE_KEY);
      if (active && convos.some((c) => c.id === active)) {
        setActiveId(active);
      } else if (convos.length > 0) {
        setActiveId(convos[0].id);
      }
    } catch {
      setConversations([]);
    }
  }, []);

  useEffect(() => {
    loadConversations();
    // Poll for changes (ChatInterface writes to localStorage)
    const interval = setInterval(loadConversations, 2000);
    return () => clearInterval(interval);
  }, [loadConversations]);

  const handleSelect = (id: string) => {
    setActiveId(id);
    localStorage.setItem(ACTIVE_KEY, id);
    setRefreshKey((k) => k + 1);
  };

  const handleNew = () => {
    const newId = `conv-${Date.now()}`;
    const newConvo: StoredConversation = {
      id: newId,
      messages: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [newConvo, ...conversations];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    localStorage.setItem(ACTIVE_KEY, newId);
    setConversations(updated);
    setActiveId(newId);
    setRefreshKey((k) => k + 1);
  };

  const handleDelete = (id: string) => {
    const updated = conversations.filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setConversations(updated);
    if (activeId === id) {
      const next = updated[0]?.id ?? null;
      setActiveId(next);
      if (next) localStorage.setItem(ACTIVE_KEY, next);
      setRefreshKey((k) => k + 1);
    }
  };

  return (
    <div className="flex h-full bg-[#09090B]">
      {/* Left sidebar — conversation list */}
      <ChatSidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={handleSelect}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      {/* Right — full ChatInterface */}
      <div className="flex-1 min-w-0 h-full">
        <ChatInterface
          key={refreshKey}
          isAdmin={isAdmin}
          role={session?.user?.role ?? 'admin'}
          moduleContext={moduleContext}
        />
      </div>
    </div>
  );
}

export default function ChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-[#71717A]">
          Loading Nova...
        </div>
      }
    >
      <ChatContent />
    </Suspense>
  );
}
