'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

interface StoredMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  model?: string;
}

interface StoredConversation {
  id: string;
  messages: StoredMessage[];
  createdAt: string;
  updatedAt: string;
}

interface ServerConversation {
  id: string;
  title: string;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
  workspaceId?: string;
}

const STORAGE_KEY = 'di_conversations';

function loadConversations(): StoredConversation[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredConversation[]) : [];
  } catch {
    return [];
  }
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function extractTitle(convo: StoredConversation): string {
  const firstUser = (convo.messages ?? []).find((m) => m.role === 'user');
  if (!firstUser) return 'Untitled conversation';
  const text = firstUser.content.trim();
  return text.length > 80 ? text.slice(0, 80) + '...' : text;
}

export default function HistoryPage() {
  const router = useRouter();
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [serverConversations, setServerConversations] = useState<ServerConversation[]>([]);
  const [mounted, setMounted] = useState(false);
  const [serverLoading, setServerLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setConversations(loadConversations());
    setMounted(true);

    // Also fetch from server API
    let cancelled = false;
    async function fetchServerConversations() {
      try {
        setServerLoading(true);
        setServerError(null);
        const res = await fetch('/api/conversations?limit=100');
        const data = await res.json() as { conversations?: ServerConversation[]; error?: string };
        if (cancelled) return;

        if (!res.ok) {
          setServerError(data.error ?? 'Failed to fetch conversations');
          setServerLoading(false);
          return;
        }

        setServerConversations(data.conversations ?? []);
      } catch (err) {
        if (!cancelled) {
          setServerError(err instanceof Error ? err.message : 'Network error');
        }
      } finally {
        if (!cancelled) setServerLoading(false);
      }
    }
    fetchServerConversations();
    return () => { cancelled = true; };
  }, []);

  const deleteConversation = useCallback((id: string) => {
    // Delete from localStorage
    const updated = loadConversations().filter((c) => c.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    setConversations(updated);
    // Also delete from server (fire-and-forget)
    fetch(`/api/conversations?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {});
    setServerConversations((prev) => prev.filter((c) => c.id !== id));
  }, []);

  const openConversation = useCallback(
    (id: string) => {
      router.push(`/chat?id=${id}`);
    },
    [router]
  );

  if (!mounted) {
    return (
      <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
        <div className="mb-6">
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Chat History</h2>
          <p className="mt-0.5 text-sm text-[#71717A]">Past conversations and saved queries</p>
        </div>
        <div className="text-sm text-zinc-400 text-center py-20">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Chat History</h2>
          <p className="mt-0.5 text-sm text-[#71717A]">
            Past conversations and saved queries
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-1.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] focus:outline-none focus:border-[#FE5000]/50 w-48"
          />
          {(conversations.length + serverConversations.length) > 0 && (
            <span className="text-xs text-[#A1A1AA] tabular-nums">
              {conversations.length + serverConversations.length} total
            </span>
          )}
        </div>
      </div>

      {/* Server-saved conversations */}
      {serverLoading ? (
        <div className="mb-2.5 space-y-2 max-w-3xl">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-3 py-2 bg-white dark:bg-[#18181B] animate-pulse">
              <div className="h-4 w-3/4 bg-[#27272A] rounded mb-2" />
              <div className="h-3 w-1/3 bg-[#27272A] rounded" />
            </div>
          ))}
        </div>
      ) : serverError ? (
        <div className="mb-2.5 rounded-md border border-amber-800 bg-amber-950/40 px-3 py-2 text-sm text-amber-400">
          Server conversations unavailable: {serverError}
        </div>
      ) : (serverConversations ?? []).length > 0 ? (
        <div className="mb-6">
          <h3 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
            Server-Saved ({serverConversations.length})
          </h3>
          <div className="space-y-2 max-w-3xl">
            {(serverConversations ?? [])
              .filter((c) => !searchQuery || (c.title ?? '').toLowerCase().includes(searchQuery.toLowerCase()))
              .map((convo) => (
              <div
                key={convo.id}
                className="group flex items-center justify-between border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-3 py-2 bg-white dark:bg-[#18181B] hover:border-[#FE5000]/30 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] hover:shadow-md transition-all cursor-pointer"
                onClick={() => openConversation(convo.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openConversation(convo.id); }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium text-[#09090B] dark:text-white truncate">
                    {convo.title ?? 'Untitled'}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">
                      {formatDate(convo.updatedAt)}
                    </span>
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">
                      {typeof convo.messageCount === 'number' ? convo.messageCount : 0} msg{convo.messageCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(convo.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#A1A1AA] hover:text-red-500 hover:bg-red-50 transition-all"
                  aria-label="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {/* Local conversations header */}
      {conversations.length > 0 && serverConversations.length > 0 && (
        <h3 className="text-xs font-semibold text-[#A1A1AA] uppercase tracking-wide mb-2">
          Local ({conversations.length})
        </h3>
      )}

      {conversations.length === 0 && serverConversations.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="w-12 h-12 rounded-2xl bg-[#F4F4F5] dark:bg-[#27272A] flex items-center justify-center mb-2.5">
            <svg className="w-6 h-6 text-[#A1A1AA]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h3 className="text-xs font-semibold text-[#09090B] dark:text-white mb-1">No saved conversations yet</h3>
          <p className="text-xs text-[#A1A1AA] max-w-sm">
            Start a chat and your conversations will be saved automatically.
          </p>
        </div>
      ) : (
        <div className="space-y-2 max-w-3xl">
          {conversations.map((convo) => {
            const msgCount = (convo.messages ?? []).length;
            return (
              <div
                key={convo.id}
                className="group flex items-center justify-between border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-3 py-2 bg-white dark:bg-[#18181B] hover:border-[#FE5000]/30 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] hover:shadow-md transition-all cursor-pointer"
                onClick={() => openConversation(convo.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') openConversation(convo.id); }}
              >
                <div className="flex-1 min-w-0 mr-4">
                  <p className="text-sm font-medium text-[#09090B] dark:text-white truncate">
                    {extractTitle(convo)}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">
                      {formatDate(convo.updatedAt)}
                    </span>
                    <span className="text-[10px] text-[#A1A1AA] tabular-nums">
                      {msgCount} msg{msgCount !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteConversation(convo.id);
                  }}
                  className="opacity-0 group-hover:opacity-100 shrink-0 w-7 h-7 rounded-md flex items-center justify-center text-[#A1A1AA] hover:text-red-500 hover:bg-red-50 transition-all"
                  aria-label="Delete conversation"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
                  </svg>
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
