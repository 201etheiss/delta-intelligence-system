'use client';

import { useState, useEffect, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Search as SearchIcon, Calendar, Cpu, ExternalLink } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────
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

interface SearchResult {
  conversationId: string;
  title: string;
  matchedSnippet: string;
  matchedRole: 'user' | 'assistant';
  timestamp: string;
  model?: string;
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

function extractTitle(convo: StoredConversation): string {
  const firstUser = (convo.messages ?? []).find((m) => m.role === 'user');
  if (!firstUser) return 'Untitled conversation';
  const text = firstUser.content.trim();
  return text.length > 80 ? text.slice(0, 80) + '...' : text;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false,
  });
}

function getSnippet(content: string, query: string): string {
  const lower = content.toLowerCase();
  const qLower = query.toLowerCase();
  const idx = lower.indexOf(qLower);
  if (idx === -1) return content.slice(0, 150);
  const start = Math.max(0, idx - 60);
  const end = Math.min(content.length, idx + query.length + 60);
  let snippet = content.slice(start, end);
  if (start > 0) snippet = '...' + snippet;
  if (end < content.length) snippet = snippet + '...';
  return snippet;
}

// ── Highlighted Text ──────────────────────────────────────────
function HighlightedText({ text, query }: { text: string; query: string }) {
  if (!query.trim()) return <span>{text}</span>;

  const parts: { text: string; highlighted: boolean }[] = [];
  const lower = text.toLowerCase();
  const qLower = query.toLowerCase();
  let lastIndex = 0;

  let searchStart = 0;
  while (searchStart < lower.length) {
    const idx = lower.indexOf(qLower, searchStart);
    if (idx === -1) break;
    if (idx > lastIndex) {
      parts.push({ text: text.slice(lastIndex, idx), highlighted: false });
    }
    parts.push({ text: text.slice(idx, idx + query.length), highlighted: true });
    lastIndex = idx + query.length;
    searchStart = lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push({ text: text.slice(lastIndex), highlighted: false });
  }

  if (parts.length === 0) return <span>{text}</span>;

  return (
    <span>
      {parts.map((part, i) =>
        part.highlighted ? (
          <mark key={i} className="bg-[#FE5000]/20 text-[#FE5000] rounded px-0.5">{part.text}</mark>
        ) : (
          <span key={i}>{part.text}</span>
        )
      )}
    </span>
  );
}

// ── Main Page ─────────────────────────────────────────────────
export default function SearchPageWrapper() {
  return (
    <Suspense fallback={<div className="px-5 py-4 text-sm text-zinc-400 text-center py-20">Loading search...</div>}>
      <SearchPageContent />
    </Suspense>
  );
}

function SearchPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get('q') ?? '';

  const [query, setQuery] = useState(initialQuery);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [modelFilter, setModelFilter] = useState('');
  const [conversations, setConversations] = useState<StoredConversation[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setConversations(loadConversations());
    setMounted(true);
  }, []);

  // Sync URL query param
  useEffect(() => {
    const urlQ = searchParams.get('q');
    if (urlQ && urlQ !== query) setQuery(urlQ);
  }, [searchParams]); // eslint-disable-line react-hooks/exhaustive-deps

  // Get all unique models for filter dropdown
  const availableModels = useMemo(() => {
    const models = new Set<string>();
    for (const convo of conversations) {
      for (const msg of convo.messages ?? []) {
        if (msg.model) models.add(msg.model);
      }
    }
    return Array.from(models).sort();
  }, [conversations]);

  // Search
  const results = useMemo((): SearchResult[] => {
    if (!query.trim()) return [];
    const qLower = query.toLowerCase();
    const out: SearchResult[] = [];

    for (const convo of conversations) {
      // Date filter
      if (dateFrom && convo.updatedAt < dateFrom) continue;
      if (dateTo && convo.updatedAt > dateTo + 'T23:59:59') continue;

      // Model filter
      if (modelFilter) {
        const hasModel = (convo.messages ?? []).some((m) => m.model === modelFilter);
        if (!hasModel) continue;
      }

      const title = extractTitle(convo);

      for (const msg of convo.messages ?? []) {
        if (msg.content.toLowerCase().includes(qLower)) {
          out.push({
            conversationId: convo.id,
            title,
            matchedSnippet: getSnippet(msg.content, query),
            matchedRole: msg.role,
            timestamp: msg.timestamp ?? convo.updatedAt,
            model: msg.model,
          });
        }
      }
    }

    return out.slice(0, 50);
  }, [query, conversations, dateFrom, dateTo, modelFilter]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        router.replace(`/search?q=${encodeURIComponent(query)}`);
      }
    },
    [query, router]
  );

  if (!mounted) {
    return (
      <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
        <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Search</h2>
        <div className="text-sm text-zinc-400 text-center py-20">Loading...</div>
      </div>
    );
  }

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      <div className="mb-6">
        <h2 className="text-lg font-bold text-[#09090B] dark:text-white">Search Conversations</h2>
        <p className="mt-0.5 text-sm text-[#71717A] dark:text-[#A1A1AA]">
          Search across all saved chat conversations
        </p>
      </div>

      {/* Search Input */}
      <div className="max-w-3xl space-y-3 mb-6">
        <div className="flex items-center gap-2 bg-white dark:bg-[#18181B] border border-[#D4D4D8] dark:border-[#3F3F46] rounded-lg px-4 py-2.5 focus-within:border-[#FE5000] focus-within:ring-1 focus-within:ring-[#FE5000]/20 shadow-sm">
          <SearchIcon size={18} className="text-[#A1A1AA] shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search messages..."
            className="flex-1 bg-transparent text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] outline-none"
            autoFocus
          />
          {query && (
            <button onClick={() => setQuery('')} className="text-[#A1A1AA] hover:text-[#09090B] dark:text-white">
              &times;
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1.5">
            <Calendar size={14} className="text-[#A1A1AA]" />
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FE5000]"
            />
            <span className="text-xs text-[#A1A1AA]">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FE5000]"
            />
          </div>
          {availableModels.length > 0 && (
            <div className="flex items-center gap-1.5">
              <Cpu size={14} className="text-[#A1A1AA]" />
              <select
                value={modelFilter}
                onChange={(e) => setModelFilter(e.target.value)}
                className="text-xs border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2 py-1.5 focus:outline-none focus:border-[#FE5000] bg-white dark:bg-[#18181B]"
              >
                <option value="">All models</option>
                {availableModels.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Results */}
      {query.trim() ? (
        results.length === 0 ? (
          <div className="text-center py-16">
            <SearchIcon size={32} className="mx-auto text-[#D4D4D8] mb-2" />
            <p className="text-sm text-[#71717A] dark:text-[#A1A1AA]">No results for &quot;{query}&quot;</p>
          </div>
        ) : (
          <div className="max-w-3xl space-y-2">
            <p className="text-xs text-[#A1A1AA] mb-2">
              {results.length} result{results.length !== 1 ? 's' : ''}
            </p>
            {results.map((r, i) => (
              <div
                key={`${r.conversationId}-${i}`}
                className="group rounded-lg border border-[#E4E4E7] dark:border-[#27272A] px-3 py-2 bg-white dark:bg-[#18181B] hover:border-[#FE5000]/30 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] transition-colors cursor-pointer"
                onClick={() => router.push(`/chat?id=${r.conversationId}`)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === 'Enter') router.push(`/chat?id=${r.conversationId}`); }}
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-medium text-[#09090B] dark:text-white truncate flex-1">{r.title}</p>
                  <ExternalLink size={14} className="text-[#A1A1AA] opacity-0 group-hover:opacity-100 shrink-0 ml-2" />
                </div>
                <p className="text-xs text-[#52525B] leading-relaxed">
                  <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F4F4F5] dark:bg-[#27272A] text-[#71717A] dark:text-[#A1A1AA] mr-1.5 uppercase">
                    {r.matchedRole}
                  </span>
                  <HighlightedText text={r.matchedSnippet} query={query} />
                </p>
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-[10px] text-[#A1A1AA] tabular-nums">{formatDate(r.timestamp)}</span>
                  {r.model && (
                    <span className="text-[10px] text-[#A1A1AA]">{r.model}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )
      ) : (
        <div className="max-w-3xl">
          <div className="text-center py-10">
            <SearchIcon size={32} className="mx-auto text-[#D4D4D8] mb-2" />
            <p className="text-sm text-[#71717A] dark:text-[#A1A1AA]">Type a query to search across all conversations</p>
          </div>

          {/* Suggested Searches */}
          <div className="mt-4">
            <p className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wide mb-2">Suggested searches</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'AR aging',
                'diesel pricing',
                'revenue by customer',
                'fleet vehicles',
                'gross profit',
                'pipeline opportunities',
              ].map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => {
                    setQuery(suggestion);
                    router.replace(`/search?q=${encodeURIComponent(suggestion)}`);
                  }}
                  className="text-left px-3 py-2.5 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] text-sm text-[#52525B] dark:text-[#A1A1AA] hover:border-[#FE5000]/40 hover:text-[#09090B] dark:hover:text-white hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] transition-colors"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>

          {/* Recent conversations as search suggestions */}
          {conversations.length > 0 && (
            <div className="mt-6">
              <p className="text-xs font-medium text-[#A1A1AA] uppercase tracking-wide mb-2">Recent conversations</p>
              <div className="space-y-1.5">
                {conversations.slice(0, 5).map((convo) => {
                  const title = extractTitle(convo);
                  return (
                    <button
                      key={convo.id}
                      onClick={() => router.push(`/chat?id=${convo.id}`)}
                      className="w-full text-left px-3 py-2 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] hover:border-[#FE5000]/30 hover:bg-[#FAFAFA] dark:hover:bg-[#27272A] transition-colors"
                    >
                      <p className="text-sm text-[#09090B] dark:text-white truncate">{title}</p>
                      <p className="text-[10px] text-[#A1A1AA] mt-0.5">{formatDate(convo.updatedAt)}</p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
