'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { Share2, Search, X, MessageSquare, Eye, Clock } from 'lucide-react';

interface SharedResult {
  id: string;
  title: string;
  content: string;
  sharedBy: string;
  sharedAt: string;
  visibility: 'link' | 'team' | 'role';
  allowedRoles?: string[];
  comments: { id: string; author: string; text: string; createdAt: string }[];
  views: number;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function SharedResultsPage() {
  const { data: session } = useSession();
  const [results, setResults] = useState<SharedResult[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchResults = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      const res = await fetch(`/api/shared?${params}`);
      const data = await res.json();
      setResults(data.results ?? []);
    } catch {
      console.error('Failed to fetch shared results');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchResults();
  }, [fetchResults]);

  const handleShare = async () => {
    const title = prompt('Title for the shared result:');
    if (!title) return;
    const content = prompt('Content (markdown):');
    if (!content) return;

    await fetch('/api/shared', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, visibility: 'team' }),
    });
    fetchResults();
  };

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white">
      <div className="max-w-4xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Share2 size={24} className="text-[#FE5000]" />
            <div>
              <h1 className="text-lg font-semibold">Shared Results</h1>
              <p className="text-sm text-[#71717A] dark:text-[#A1A1AA]">
                AI insights shared by your team ({results.length} results)
              </p>
            </div>
          </div>
          {session?.user?.email && (
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-[#FE5000] text-white text-sm font-medium hover:bg-[#CC4000] transition-colors"
            >
              <Share2 size={16} />
              Share Result
            </button>
          )}
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#52525B]" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search shared results..."
            className="w-full pl-10 pr-4 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FE5000]/50"
          />
          {search && (
            <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#52525B] hover:text-white">
              <X size={14} />
            </button>
          )}
        </div>

        {/* Results Grid */}
        {loading ? (
          <div className="text-center py-12 text-[#52525B] text-sm">Loading shared results...</div>
        ) : results.length === 0 ? (
          <div className="text-center py-16">
            <Share2 size={40} className="mx-auto mb-2 text-[#27272A]" />
            <p className="text-[#52525B] text-sm">
              {search ? 'No matching results found.' : 'No shared results yet. Share your first AI insight with the team.'}
            </p>
          </div>
        ) : (
          <div className="grid gap-3">
            {results.map(result => (
              <Link
                key={result.id}
                href={`/shared/${result.id}`}
                className="block bg-[#18181B] border border-[#27272A] rounded-lg p-4 hover:border-[#3F3F46] transition-colors"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xs font-semibold text-white truncate">{result.title}</h3>
                    <p className="text-xs text-[#71717A] dark:text-[#A1A1AA] mt-0.5 line-clamp-2">
                      {result.content.slice(0, 200)}
                    </p>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-medium rounded bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46] capitalize shrink-0">
                    {result.visibility}
                  </span>
                </div>

                <div className="flex items-center gap-3 mt-3 text-[10px] text-[#52525B]">
                  <span className="flex items-center gap-1">
                    <Clock size={10} />
                    {timeAgo(result.sharedAt)}
                  </span>
                  <span>by {result.sharedBy.split('@')[0]}</span>
                  <span className="flex items-center gap-1">
                    <Eye size={10} />
                    {result.views}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare size={10} />
                    {result.comments.length}
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
