'use client';

import { useState, useCallback, useMemo, useRef } from 'react';
import { detectChartableData } from '@/lib/chart-detector';
import type { ParsedTable } from '@/lib/chart-detector';
import InlineChart from './InlineChart';
import InteractiveTable from './InteractiveTable';
import DataActions from './DataActions';
import ExportBar from '../common/ExportBar';
import type { Artifact } from '../artifacts/ArtifactViewer';

// ── Share Button ──────────────────────────────────────────────
function ShareButton({ content }: { content: string }) {
  const [status, setStatus] = useState<'idle' | 'sharing' | 'done' | 'error'>('idle');
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const handleShare = useCallback(async () => {
    setStatus('sharing');
    try {
      const titleMatch = content.match(/^#\s+(.+)$/m) ?? content.match(/^\*\*(.+?)\*\*/m);
      const title = titleMatch ? titleMatch[1].replace(/\*\*/g, '').trim() : 'Shared Result';

      const res = await fetch('/api/shared', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content }),
      });

      if (!res.ok) throw new Error('Share failed');
      const data = await res.json() as { result?: { id?: string } };
      const id = data.result?.id ?? '';
      const link = `${window.location.origin}/shared?id=${id}`;
      setShareUrl(link);
      setStatus('done');
      setTimeout(() => { setStatus('idle'); setShareUrl(null); }, 4000);
    } catch {
      setStatus('error');
      setTimeout(() => setStatus('idle'), 2000);
    }
  }, [content]);

  return (
    <span className="relative inline-block">
      <button
        onClick={handleShare}
        disabled={status === 'sharing'}
        className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors disabled:opacity-50"
        title="Share this result"
      >
        {status === 'sharing' ? '...' : status === 'done' ? 'Shared' : status === 'error' ? 'Failed' : 'Share'}
      </button>
      {shareUrl && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 whitespace-nowrap rounded bg-zinc-900 text-white text-[10px] px-2 py-1 shadow-lg z-20">
          <button
            onClick={() => { navigator.clipboard.writeText(shareUrl).catch(() => {}); }}
            className="hover:underline"
          >
            Copy link
          </button>
        </span>
      )}
    </span>
  );
}

// ── Pin / Favorite Button ─────────────────────────────────────
function PinButton({ query }: { query: string }) {
  const [pinned, setPinned] = useState(false);
  const title = query.slice(0, 80);
  const [saving, setSaving] = useState(false);

  const handlePin = useCallback(async () => {
    if (pinned || saving) return;
    setSaving(true);
    try {
      const title = query.length > 60 ? query.slice(0, 57) + '...' : query;
      const res = await fetch('/api/favorites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, title, category: 'general' }),
      });
      if (res.ok) setPinned(true);
    } catch {
      // silent
    } finally {
      setSaving(false);
    }
  }, [query, pinned, saving]);

  return (
    <button
      onClick={handlePin}
      disabled={saving}
      className={`text-[10px] transition-colors ${
        pinned ? 'text-yellow-500' : 'text-zinc-400 hover:text-yellow-500'
      }`}
      title={pinned ? 'Pinned' : 'Pin this query'}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill={pinned ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
      </svg>
    </button>
  );
}

// Security note: renderContent() builds HTML exclusively from plain-text input.
// All special characters are HTML-escaped before any transformation is applied.
// No raw user HTML or external markup is ever passed to the DOM.

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  model?: string;
  inputTokens?: number;
  outputTokens?: number;
  conversationId?: string;
}

interface MessageBubbleProps {
  message: Message;
  isStreaming?: boolean;
  onFollowUp?: (question: string) => void;
  precedingUserQuery?: string;
  onOpenArtifact?: (artifact: Artifact) => void;
}

const MODEL_BADGE_COLORS: Record<string, string> = {
  haiku: 'bg-violet-900/60 text-violet-300 border-violet-700/50',
  sonnet: 'bg-orange-900/60 text-orange-300 border-orange-700/50',
  gpt4o: 'bg-green-900/60 text-green-300 border-green-700/50',
  'gemini-flash': 'bg-blue-900/60 text-blue-300 border-blue-700/50',
  auto: 'bg-zinc-800 text-zinc-400 border-zinc-700/50',
};

const MODEL_DISPLAY_NAMES: Record<string, string> = {
  haiku: 'Haiku',
  sonnet: 'Sonnet',
  gpt4o: 'GPT-4o',
  'gemini-flash': 'Gemini Flash',
  auto: 'Auto',
};

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

/**
 * Sanitizes plain-text markdown to safe HTML.
 *
 * SECURITY: All input is HTML-escaped in Step 1, neutralizing any injection vectors.
 * Step 2 applies structural transforms only on the already-escaped string, emitting
 * a fixed set of known-safe HTML tags. No raw user HTML ever reaches the DOM.
 */
function renderContent(raw: string): string {
  // Step 1 — escape all HTML so raw user text can never introduce tags
  let html = raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  // Step 2 — structured transforms on the now-safe escaped string

  // Fenced code blocks (``` ... ```) — with copy button wrapper
  html = html.replace(
    /```(\w*)\n?([\s\S]*?)```/g,
    (_m, lang: string, code: string) => {
      const langLabel = lang
        ? `<span class="absolute top-2 left-3 text-[10px] text-zinc-500 font-mono select-none">${lang}</span>`
        : '';
      const trimmedCode = code.trim();
      const plainCode = trimmedCode
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'");
      const encodedCode = encodeURIComponent(plainCode);
      return `<div class="relative group my-2">${langLabel}<button data-copy-code="${encodedCode}" class="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-[10px] px-2 py-1 rounded border border-zinc-700 cursor-pointer z-10" onclick="(function(btn){var t=decodeURIComponent(btn.getAttribute('data-copy-code'));navigator.clipboard.writeText(t).then(function(){btn.textContent='Copied!';setTimeout(function(){btn.textContent='Copy'},1500)})['catch'](function(){})})(this)">Copy</button><pre class="bg-zinc-950 border border-zinc-800 rounded p-3 ${lang ? 'pt-7' : ''} overflow-x-auto text-xs font-mono text-zinc-200 whitespace-pre">${trimmedCode}</pre></div>`;
    }
  );

  // Inline code
  html = html.replace(
    /`([^`\n]+)`/g,
    '<code class="bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200 px-1 py-0.5 rounded text-xs font-mono">$1</code>'
  );

  // Bold (**text**) — use font-bold (700) for visible weight difference
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="font-bold text-zinc-900 dark:text-white">$1</strong>');

  // Italic (*text*)
  html = html.replace(/\*([^*\n]+)\*/g, '<em class="italic">$1</em>');

  // Links [text](url) — only allow http/https URLs
  html = html.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-[#FE5000] hover:underline">$1</a>'
  );

  // Unordered list items (supports -, *, and •)
  html = html.replace(/^[-*•] (.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

  // Ordered list items
  html = html.replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal">$1</li>');

  // Horizontal rule (--- or ***)
  html = html.replace(/^[-*]{3,}$/gm, '<hr class="my-3 border-zinc-200 dark:border-zinc-700" />');

  // Headings — bold + distinct sizes + dark mode colors
  html = html.replace(/^### (.+)$/gm, '<h3 class="font-bold text-sm mt-3 mb-1 text-zinc-900 dark:text-white">$1</h3>');
  html = html.replace(/^## (.+)$/gm, '<h2 class="font-bold text-base mt-4 mb-1.5 text-zinc-900 dark:text-white">$1</h2>');
  html = html.replace(/^# (.+)$/gm, '<h1 class="font-bold text-lg mt-4 mb-2 text-zinc-900 dark:text-white">$1</h1>');

  // Tables: detect lines with | delimiters — wrap in scrollable container
  html = html.replace(
    /(?:^|\n)((?:\|.+\|\n?)+)/gm,
    (_m, tableBlock: string) => {
      const rows = tableBlock.trim().split('\n').filter(Boolean);
      if (rows.length < 2) return tableBlock;
      const isSeparator = /^\|[\s\-:]+(\|[\s\-:]+)+\|?$/.test(rows[1]);
      const dataRows = isSeparator ? [rows[0], ...rows.slice(2)] : rows;
      const renderRow = (row: string, isHeader: boolean) => {
        const cells = row.split('|').slice(1, -1).map(c => c.trim());
        const tag = isHeader ? 'th' : 'td';
        const cellClass = isHeader
          ? 'px-3 py-1.5 text-left text-xs font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap'
          : 'px-3 py-1.5 text-xs text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 whitespace-nowrap';
        return `<tr>${cells.map(c => `<${tag} class="${cellClass}">${c}</${tag}>`).join('')}</tr>`;
      };
      const headerRow = isSeparator ? renderRow(dataRows[0], true) : '';
      const bodyRows = (isSeparator ? dataRows.slice(1) : dataRows)
        .map((r, i) => {
          const rowHtml = renderRow(r, false);
          return i % 2 === 1 ? rowHtml.replace('<tr>', '<tr class="bg-zinc-50 dark:bg-zinc-800/50">') : rowHtml;
        })
        .join('');
      return `<div class="overflow-x-auto -mx-1 my-2"><table class="w-full border-collapse text-sm min-w-[400px]"><thead>${headerRow}</thead><tbody>${bodyRows}</tbody></table></div>`;
    }
  );

  // Block split: double newline = paragraph boundary
  const blocks = html.split(/\n\n+/);

  // Merge consecutive list item blocks into single lists
  const merged: string[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const isOL = block.startsWith('<li class="ml-4 list-decimal"');
    const isUL = block.startsWith('<li class="ml-4 list-disc"');

    if (isOL || isUL) {
      // Look ahead and merge all consecutive blocks of the same list type
      let combined = block;
      while (i + 1 < blocks.length) {
        const next = blocks[i + 1];
        const nextIsOL = next.startsWith('<li class="ml-4 list-decimal"');
        const nextIsUL = next.startsWith('<li class="ml-4 list-disc"');
        if ((isOL && nextIsOL) || (isUL && nextIsUL)) {
          combined += next;
          i++;
        } else {
          break;
        }
      }
      if (isOL) {
        merged.push('<ol class="my-2 pl-4 space-y-1">' + combined + '</ol>');
      } else {
        merged.push('<ul class="my-2 pl-4 space-y-1">' + combined + '</ul>');
      }
    } else {
      merged.push(block);
    }
  }

  html = merged
    .map((block) => {
      if (
        block.startsWith('<pre') ||
        block.startsWith('<div class="relative') ||
        block.startsWith('<div class="overflow') ||
        block.startsWith('<ul') ||
        block.startsWith('<ol') ||
        block.startsWith('<h') ||
        block.startsWith('<hr') ||
        block.startsWith('<table')
      ) {
        return block;
      }
      const inner = block.replace(/\n/g, '<br/>');
      return `<p class="mb-1 last:mb-0">${inner}</p>`;
    })
    .join('');

  return html;
}

function CopyMessageButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }).catch(() => {});
  }, [text]);

  return (
    <button
      onClick={handleCopy}
      className="text-[10px] text-zinc-400 hover:text-zinc-600 transition-colors"
      title="Copy message"
    >
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function FeedbackButtons({ message }: { message: Message }) {
  const [feedback, setFeedback] = useState<'up' | 'down' | null>(null);
  const [showThanks, setShowThanks] = useState(false);

  const handleFeedback = useCallback(async (rating: 'up' | 'down') => {
    if (feedback) return;
    setFeedback(rating);
    setShowThanks(true);
    setTimeout(() => setShowThanks(false), 1500);

    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messageId: message.id,
          conversationId: message.conversationId ?? '',
          rating,
          model: message.model ?? '',
          query: '',
        }),
      });
    } catch {
      // Silent fail
    }
  }, [feedback, message.id, message.conversationId, message.model]);

  if (showThanks) {
    return <span className="text-[10px] text-zinc-400">Thanks!</span>;
  }

  return (
    <span className="inline-flex items-center gap-1">
      <button
        onClick={() => handleFeedback('up')}
        className={`text-[10px] transition-colors ${
          feedback === 'up' ? 'text-green-500' : 'text-zinc-400 hover:text-zinc-600'
        }`}
        title="Helpful"
        disabled={feedback !== null}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" />
        </svg>
      </button>
      <button
        onClick={() => handleFeedback('down')}
        className={`text-[10px] transition-colors ${
          feedback === 'down' ? 'text-red-500' : 'text-zinc-400 hover:text-zinc-600'
        }`}
        title="Not helpful"
        disabled={feedback !== null}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" />
        </svg>
      </button>
    </span>
  );
}

// Extract numbered follow-up questions from end of content
function extractFollowUps(content: string): { mainContent: string; followUps: string[] } {
  if (!content) return { mainContent: content, followUps: [] };

  const followUpPattern = /(?:\n---\n|\n\n)\*?\*?Follow[- ]?up:?\*?\*?\n((?:\d+\.\s+.+\n?)+)$/i;
  const match = content.match(followUpPattern);

  if (!match) {
    const lines = content.trim().split('\n');
    const followUps: string[] = [];
    let i = lines.length - 1;

    while (i >= 0 && /^\d+\.\s+/.test(lines[i].trim())) {
      followUps.unshift(lines[i].trim().replace(/^\d+\.\s+/, ''));
      i--;
    }

    const hasQuestions = followUps.some(q => q.includes('?'));
    if (followUps.length >= 2 && followUps.length <= 5 && hasQuestions) {
      const headerLine = i >= 0 ? lines[i].trim() : '';
      const isFollowUpHeader = /^(\*?\*?follow|next\s*step|---|\*?\*?suggested)/i.test(headerLine);
      const cutIndex = isFollowUpHeader ? i : i + 1;
      const mainContent = lines.slice(0, cutIndex).join('\n').trim();
      return { mainContent, followUps };
    }

    return { mainContent: content, followUps: [] };
  }

  const mainContent = content.substring(0, match.index).trim();
  const followUps = match[1]
    .trim()
    .split('\n')
    .map(line => line.trim().replace(/^\d+\.\s+/, ''))
    .filter(Boolean);

  return { mainContent, followUps };
}

export default function MessageBubble({
  message,
  isStreaming = false,
  onFollowUp,
  precedingUserQuery,
  onOpenArtifact,
}: MessageBubbleProps) {
  const isUser = message.role === 'user';
  const contentRef = useRef<HTMLDivElement>(null);
  const badgeClass =
    message.model && MODEL_BADGE_COLORS[message.model]
      ? MODEL_BADGE_COLORS[message.model]
      : MODEL_BADGE_COLORS['auto'];
  const badgeLabel =
    message.model && MODEL_DISPLAY_NAMES[message.model]
      ? MODEL_DISPLAY_NAMES[message.model]
      : (message.model ?? 'Auto');

  // Detect chartable data from the raw markdown
  const chartData = useMemo(() => {
    if (isUser || isStreaming || !message.content) return null;
    const result = detectChartableData(message.content);
    return result.suggestions.length > 0 ? result : null;
  }, [message.content, isUser, isStreaming]);

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-fade-in">
        <div className="max-w-[72%]">
          <div className="flex items-end justify-end gap-2 mb-1">
            <span className="text-xs text-zinc-500">{formatTime(message.timestamp)}</span>
          </div>
          <div className="bg-[#FE5000] text-white rounded-2xl rounded-tr-sm px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap break-words">
            {message.content}
          </div>
        </div>
      </div>
    );
  }

  const { mainContent, followUps } = isStreaming
    ? { mainContent: message.content, followUps: [] }
    : extractFollowUps(message.content);

  const renderedHtml = mainContent ? renderContent(mainContent) : '';

  // Note: we keep HTML tables in renderedHtml for context (headings above tables, etc.)
  // Interactive charts/tables render BELOW the message as enhanced replacements
  // The chart toggle "View as chart" gives users the option to visualize

  const handleOpenInPanel = useCallback((table: ParsedTable) => {
    if (!onOpenArtifact) return;
    onOpenArtifact({
      id: `table_${message.id}_${Date.now()}`,
      type: 'table',
      title: 'Table Data',
      content: message.content,
      table,
    });
  }, [onOpenArtifact, message.id, message.content]);

  const handleOpenReport = useCallback(() => {
    if (!onOpenArtifact) return;
    onOpenArtifact({
      id: `report_${message.id}`,
      type: 'report',
      title: 'Response',
      content: message.content,
    });
  }, [onOpenArtifact, message.id, message.content]);

  const handleDataAction = useCallback((prompt: string) => {
    onFollowUp?.(prompt);
  }, [onFollowUp]);

  return (
    <div className="flex justify-start mb-4 animate-fade-in">
      <div className="max-w-[78%]">
        <div className="flex items-center gap-2 mb-1">
          <div className="w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center flex-shrink-0">
            <svg
              className="w-3.5 h-3.5 text-[#FE5000]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z"
              />
            </svg>
          </div>
          {message.model && (
            <span
              className={`text-[10px] font-medium px-1.5 py-0.5 rounded border ${badgeClass}`}
            >
              {badgeLabel}
            </span>
          )}
          <span className="text-xs text-zinc-500">{formatTime(message.timestamp)}</span>
          {message.content && !isStreaming && (
            <>
              <CopyMessageButton text={message.content} />
              <ShareButton content={message.content} />
              {precedingUserQuery && <PinButton query={precedingUserQuery} />}
              <FeedbackButtons message={message} />
              {onOpenArtifact && message.content.length > 100 && (
                <button
                  onClick={handleOpenReport}
                  className="text-[10px] text-zinc-400 hover:text-[#FE5000] transition-colors"
                  title="Open in panel"
                >
                  Open in panel
                </button>
              )}
            </>
          )}
        </div>
        <div
          ref={contentRef}
          className={`relative bg-white dark:bg-[#18181B] border rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed text-zinc-800 dark:text-zinc-200 ${isStreaming ? 'border-[#FE5000]/30' : 'border-zinc-200 dark:border-[#27272A]'}`}
        >
          {message.content ? (
            <>
              {/* SECURITY: renderedHtml is built from HTML-escaped input. Safe. */}
              <div
                className="max-w-none"
                dangerouslySetInnerHTML={{ __html: renderedHtml }}
              />
              {isStreaming && (
                <span className="inline-block w-0.5 h-4 bg-[#FE5000] animate-blink ml-0.5 align-text-bottom" />
              )}
            </>
          ) : isStreaming ? (
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-[#A1A1AA] animate-bounce" />
            </div>
          ) : null}

          {/* Interactive tables with integrated chart picker (sort/filter/visualize) */}
          {chartData && !isStreaming && (() => {
            const seen = new Set<string>();
            return chartData.tables
              .filter(t => t.rows.length >= 3) // Only for tables with enough data
              .map((table, idx) => {
                const key = table.headers.join('|');
                if (seen.has(key)) return null;
                seen.add(key);
                return (
                  <InteractiveTable
                    key={`itbl_${idx}`}
                    table={table}
                    onOpenInPanel={onOpenArtifact ? handleOpenInPanel : undefined}
                  />
                );
              });
          })()}

          {/* Data actions (hover tooltips on numbers/currencies) */}
          {!isStreaming && message.content && onFollowUp && (
            <DataActions containerRef={contentRef} onAction={handleDataAction} />
          )}
        </div>

        {/* Export bar — show on any response with data */}
        {message.content && !isStreaming && message.content.length > 200 && (
          <div className="mt-3">
            <ExportBar content={message.content} />
          </div>
        )}

        {/* Follow-up question buttons */}
        {followUps.length > 0 && onFollowUp && !isStreaming && (
          <div className="mt-3 flex flex-col gap-1.5">
            {followUps.map((q, i) => {
              const clean = q
                .replace(/\*\*(.+?)\*\*/g, '$1')
                .replace(/\*(.+?)\*/g, '$1')
                .replace(/`([^`]+)`/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
                .trim();
              return (
                <button
                  key={i}
                  onClick={() => onFollowUp(clean)}
                  className="text-left flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl border border-[#FE5000]/20 bg-[#FE5000]/5 text-sm font-medium text-[#09090B] dark:text-white hover:border-[#FE5000]/50 hover:bg-[#FE5000]/10 hover:shadow-sm transition-all"
                >
                  <span className="shrink-0 w-6 h-6 rounded-full bg-[#FE5000] text-white flex items-center justify-center text-xs font-bold mt-0.5">
                    {i + 1}
                  </span>
                  <span className="leading-relaxed font-semibold">{clean}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
