'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Link from 'next/link';
import { ArrowLeft, Share2, Eye, Clock, Copy, Check, Send } from 'lucide-react';

interface Comment {
  id: string;
  author: string;
  text: string;
  createdAt: string;
}

interface SharedResult {
  id: string;
  title: string;
  content: string;
  sharedBy: string;
  sharedAt: string;
  visibility: 'link' | 'team' | 'role';
  allowedRoles?: string[];
  comments: Comment[];
  views: number;
}

function formatDate(dateStr: string): string {
  try {
    return new Date(dateStr).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export default function SharedResultDetailPage() {
  const params = useParams();
  const id = params?.id as string;
  const { data: session } = useSession();

  const [result, setResult] = useState<SharedResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [commentText, setCommentText] = useState('');
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchResult = useCallback(async () => {
    if (!id) return;
    try {
      const res = await fetch(`/api/shared/${id}`);
      if (!res.ok) {
        setResult(null);
        return;
      }
      const data = await res.json();
      setResult(data.result ?? null);
    } catch {
      console.error('Failed to fetch shared result');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchResult();
  }, [fetchResult]);

  const handleCopyLink = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleAddComment = async () => {
    if (!commentText.trim() || !id) return;
    setSubmitting(true);
    try {
      await fetch(`/api/shared/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: commentText.trim() }),
      });
      setCommentText('');
      fetchResult();
    } catch {
      console.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-[#09090B]">
        <p className="text-sm text-[#52525B]">Loading...</p>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="h-full flex flex-col items-center justify-center bg-[#09090B] gap-3">
        <p className="text-sm text-[#52525B]">Shared result not found or access denied.</p>
        <Link href="/shared" className="text-sm text-[#FF5C00] hover:underline">Back to Shared</Link>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-white">
      <div className="max-w-3xl mx-auto px-6 py-8">
        {/* Back link */}
        <Link href="/shared" className="inline-flex items-center gap-1.5 text-xs text-[#71717A] dark:text-[#A1A1AA] hover:text-white mb-6">
          <ArrowLeft size={14} /> Back to Shared
        </Link>

        {/* Header */}
        <div className="mb-6">
          <h1 className="text-lg font-semibold mb-2">{result.title}</h1>
          <div className="flex items-center gap-3 text-xs text-[#52525B]">
            <span className="flex items-center gap-1"><Share2 size={12} /> {result.sharedBy.split('@')[0]}</span>
            <span className="flex items-center gap-1"><Clock size={12} /> {formatDate(result.sharedAt)}</span>
            <span className="flex items-center gap-1"><Eye size={12} /> {result.views} views</span>
            <span className="px-2 py-0.5 text-[10px] rounded bg-[#27272A] text-[#A1A1AA] border border-[#3F3F46] capitalize">
              {result.visibility}
            </span>
          </div>
        </div>

        {/* Copy Link */}
        <button
          onClick={handleCopyLink}
          className="flex items-center gap-1.5 mb-6 px-3 py-1.5 text-xs text-[#71717A] dark:text-[#A1A1AA] bg-[#18181B] border border-[#27272A] rounded-lg hover:text-white transition-colors"
        >
          {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
          {copied ? 'Copied' : 'Copy Link'}
        </button>

        {/* Content */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5 mb-8">
          <div className="prose prose-invert prose-sm max-w-none text-[#D4D4D8] whitespace-pre-wrap">
            {result.content}
          </div>
        </div>

        {/* Comments */}
        <div>
          <h2 className="text-xs font-semibold mb-2.5">Comments ({result.comments.length})</h2>

          {result.comments.length > 0 && (
            <div className="space-y-3 mb-6">
              {result.comments.map(comment => (
                <div key={comment.id} className="bg-[#18181B] border border-[#27272A] rounded-lg p-3">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xs font-medium text-[#A1A1AA]">{comment.author.split('@')[0]}</span>
                    <span className="text-[10px] text-[#52525B]">{formatDate(comment.createdAt)}</span>
                  </div>
                  <p className="text-sm text-[#D4D4D8]">{comment.text}</p>
                </div>
              ))}
            </div>
          )}

          {/* Add comment */}
          {session?.user?.email && (
            <div className="flex gap-2">
              <input
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleAddComment(); } }}
                placeholder="Add a comment..."
                className="flex-1 px-3 py-2.5 bg-[#18181B] border border-[#27272A] rounded-lg text-sm text-white placeholder-[#52525B] outline-none focus:border-[#FF5C00]/50"
              />
              <button
                onClick={handleAddComment}
                disabled={!commentText.trim() || submitting}
                className="px-3 py-2.5 bg-[#FF5C00] text-white rounded-lg hover:bg-[#E54800] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                <Send size={16} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
