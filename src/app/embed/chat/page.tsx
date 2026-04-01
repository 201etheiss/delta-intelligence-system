'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

// ── Types ────────────────────────────────────────────────────

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// ── Helpers ──────────────────────────────────────────────────

function generateId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// ── Main Component ───────────────────────────────────────────

function EmbedChatContent() {
  const params = useSearchParams();
  const theme = params.get('theme') ?? 'dark';
  const workspace = params.get('workspace') ?? '';

  const isDark = theme === 'dark';
  const bg = isDark ? '#09090B' : '#FFFFFF';
  const textColor = isDark ? '#FAFAFA' : '#09090B';
  const borderColor = isDark ? '#27272A' : '#E4E4E7';
  const inputBg = isDark ? '#18181B' : '#F4F4F5';
  const mutedText = isDark ? '#71717A' : '#A1A1AA';
  const accentColor = '#FF5C00';

  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: ChatMessage = { id: generateId(), role: 'user', content: text };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const apiMessages = newMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const body: Record<string, unknown> = { messages: apiMessages };
      if (workspace) {
        body.workspacePrompt = `You are operating in the ${workspace} workspace.`;
      }

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      const assistantMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: data.content ?? data.error ?? 'No response',
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      const errorMsg: ChatMessage = {
        id: generateId(),
        role: 'assistant',
        content: `Error: ${err instanceof Error ? err.message : 'Failed to send message'}`,
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages, workspace]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <div
      className="flex flex-col h-full"
      style={{ backgroundColor: bg, color: textColor }}
    >
      {/* Header */}
      <div
        className="flex items-center gap-2 px-4 py-3 shrink-0"
        style={{ borderBottom: `1px solid ${borderColor}` }}
      >
        <div
          className="w-2 h-2 rounded-full"
          style={{ backgroundColor: accentColor }}
        />
        <span className="text-sm font-semibold">Delta Intelligence</span>
        {workspace && (
          <span
            className="text-xs px-1.5 py-0.5 rounded"
            style={{ backgroundColor: inputBg, color: mutedText }}
          >
            {workspace}
          </span>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && (
          <div
            className="text-center text-xs py-8"
            style={{ color: mutedText }}
          >
            Ask anything about your business data.
          </div>
        )}
        {messages.map((msg) => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className="max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap"
              style={{
                backgroundColor:
                  msg.role === 'user' ? accentColor : inputBg,
                color: msg.role === 'user' ? '#FFFFFF' : textColor,
              }}
            >
              {msg.content}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div
              className="rounded-lg px-3 py-2 text-sm"
              style={{ backgroundColor: inputBg, color: mutedText }}
            >
              Thinking...
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div
        className="px-4 py-3 shrink-0"
        style={{ borderTop: `1px solid ${borderColor}` }}
      >
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            disabled={loading}
            className="flex-1 text-sm rounded-lg px-3 py-2 outline-none"
            style={{
              backgroundColor: inputBg,
              color: textColor,
              border: `1px solid ${borderColor}`,
            }}
          />
          <button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-40"
            style={{ backgroundColor: accentColor }}
          >
            Send
          </button>
        </div>
        <div
          className="text-center text-[10px] mt-1.5"
          style={{ color: mutedText }}
        >
          Powered by Delta Intelligence
        </div>
      </div>
    </div>
  );
}

export default function EmbedChatPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-full text-sm text-zinc-400">
          Loading...
        </div>
      }
    >
      <EmbedChatContent />
    </Suspense>
  );
}
