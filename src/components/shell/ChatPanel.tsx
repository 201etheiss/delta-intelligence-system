'use client';

import { useRef, useState, useEffect, useCallback } from 'react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ChatPanelProps {
  isOpen: boolean;
  currentModule: string | null;
  currentPage: string;
  onClose: () => void;
}

type PanelMode = 'chat' | 'bots' | 'history';

interface Message {
  id: string;
  role: 'nova' | 'user';
  content: string;
  timestamp: Date;
}

interface Bot {
  id: string;
  name: string;
  schedule: string;
  status: 'running' | 'idle' | 'failed';
  description: string;
}

interface HistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
}

// ---------------------------------------------------------------------------
// Static placeholder data
// ---------------------------------------------------------------------------

const WELCOME_MESSAGE: Message = {
  id: 'nova-welcome',
  role: 'nova',
  content:
    "Hello, I'm Nova. I can help you analyze data, navigate modules, run queries, and surface insights across the Delta Intelligence platform. What do you need?",
  timestamp: new Date(),
};

const PLACEHOLDER_BOTS: Bot[] = [
  {
    id: 'bot-1',
    name: 'Daily Financials',
    schedule: '0 7 * * 1-5',
    status: 'running',
    description: 'Pulls GL summary and flags anomalies',
  },
  {
    id: 'bot-2',
    name: 'Fuel Cost Monitor',
    schedule: '*/30 * * * *',
    status: 'idle',
    description: 'Watches margin thresholds across fuel accounts',
  },
  {
    id: 'bot-3',
    name: 'AR Aging Alert',
    schedule: '0 8 * * 1',
    status: 'failed',
    description: 'Weekly AR aging digest to accounting',
  },
  {
    id: 'bot-4',
    name: 'Equipment Sync',
    schedule: '0 */6 * * *',
    status: 'idle',
    description: 'Syncs Samsara asset data to equipment module',
  },
];

const PLACEHOLDER_HISTORY: HistoryItem[] = [
  {
    id: 'h-1',
    title: 'Q1 Revenue Analysis',
    preview: 'Reviewed GP trends for January through March...',
    timestamp: new Date(Date.now() - 1000 * 60 * 30),
  },
  {
    id: 'h-2',
    title: 'Fuel Cost Breakdown',
    preview: 'Queried GL accounts for Comdata and direct...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 3),
  },
  {
    id: 'h-3',
    title: 'Fleet Utilization Report',
    preview: 'Pulled Samsara asset hours vs budget...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24),
  },
  {
    id: 'h-4',
    title: 'AR Outstanding Customers',
    preview: 'Listed top 10 overdue balances...',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48),
  },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: Bot['status']): string {
  switch (status) {
    case 'running':
      return '#22c55e';
    case 'idle':
      return '#71717a';
    case 'failed':
      return '#ef4444';
  }
}

function statusLabel(status: Bot['status']): string {
  switch (status) {
    case 'running':
      return 'Running';
    case 'idle':
      return 'Idle';
    case 'failed':
      return 'Failed';
  }
}

function formatRelativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function NovaAvatar() {
  return (
    <div
      style={{
        width: 28,
        height: 28,
        borderRadius: '50%',
        background: 'linear-gradient(135deg, #FE5000 0%, #ff8040 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 700,
        color: '#fff',
        letterSpacing: '0.03em',
      }}
    >
      N
    </div>
  );
}

function ModePills({
  mode,
  onChange,
}: {
  mode: PanelMode;
  onChange: (m: PanelMode) => void;
}) {
  const pills: { key: PanelMode; label: string }[] = [
    { key: 'chat', label: 'Chat' },
    { key: 'bots', label: 'Bots' },
    { key: 'history', label: 'History' },
  ];

  return (
    <div
      style={{
        display: 'flex',
        gap: 6,
        padding: '10px 14px',
        borderBottom: '1px solid #27272a',
      }}
    >
      {pills.map(({ key, label }) => {
        const active = mode === key;
        return (
          <button
            key={key}
            onClick={() => onChange(key)}
            style={{
              padding: '4px 12px',
              borderRadius: 9999,
              fontSize: 12,
              fontWeight: 500,
              cursor: 'pointer',
              border: active ? '1px solid #FE5000' : '1px solid #3f3f46',
              background: active ? 'rgba(254,80,0,0.1)' : 'transparent',
              color: active ? '#FE5000' : '#a1a1aa',
              transition: 'all 0.15s ease',
            }}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// localStorage helpers for chat panel conversation
// ---------------------------------------------------------------------------

const PANEL_STORAGE_KEY = 'di_chat_panel_conversation';

interface StoredPanelMessage {
  id: string;
  role: 'nova' | 'user';
  content: string;
  timestamp: string;
}

function loadPanelConversation(): Message[] {
  if (typeof window === 'undefined') return [WELCOME_MESSAGE];
  try {
    const raw = localStorage.getItem(PANEL_STORAGE_KEY);
    if (!raw) return [WELCOME_MESSAGE];
    const stored = JSON.parse(raw) as StoredPanelMessage[];
    return stored.map((m) => ({ ...m, timestamp: new Date(m.timestamp) }));
  } catch {
    return [WELCOME_MESSAGE];
  }
}

function savePanelConversation(messages: Message[]): void {
  if (typeof window === 'undefined') return;
  try {
    const serialized: StoredPanelMessage[] = messages.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : String(m.timestamp),
    }));
    localStorage.setItem(PANEL_STORAGE_KEY, JSON.stringify(serialized));
  } catch {
    // silent fail
  }
}

// ---------------------------------------------------------------------------
// Chat mode
// ---------------------------------------------------------------------------

function ChatMode({
  currentModule,
  currentPage,
}: {
  currentModule: string | null;
  currentPage: string;
}) {
  const [messages, setMessages] = useState<Message[]>([WELCOME_MESSAGE]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingId, setStreamingId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(false);

  // Load persisted conversation on mount
  useEffect(() => {
    const stored = loadPanelConversation();
    setMessages(stored);
    mountedRef.current = true;
  }, []);

  // Persist conversation whenever messages change (skip initial render)
  useEffect(() => {
    if (!mountedRef.current) return;
    savePanelConversation(messages);
  }, [messages]);

  // Auto-scroll when messages change
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isStreaming]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    // Build API message history (exclude welcome message, map roles)
    const contextNote = currentModule
      ? `[Context: ${currentModule} > ${currentPage}]`
      : `[Context: ${currentPage}]`;

    const apiMessages = messages
      .filter((m) => m.id !== 'nova-welcome')
      .map((m) => ({
        role: m.role === 'user' ? 'user' : 'assistant',
        content: m.content,
      }));

    // Append the new user message with context prefix on first message
    apiMessages.push({
      role: 'user',
      content: messages.length <= 1
        ? `${contextNote} ${text}`
        : text,
    });

    const novaId = `nova-${Date.now()}`;

    setMessages((prev) => [...prev, userMsg, {
      id: novaId,
      role: 'nova',
      content: '',
      timestamp: new Date(),
    }]);
    setInput('');
    setIsStreaming(true);
    setStreamingId(novaId);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Try streaming endpoint first
      const streamRes = await fetch('/api/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (streamRes.ok && streamRes.body) {
        const reader = streamRes.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let accumulated = '';
        let currentEvent = '';

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = '';

          for (const line of lines) {
            if (line.startsWith('event: ')) {
              currentEvent = line.slice(7).trim();
            } else if (line.startsWith('data: ')) {
              const dataStr = line.slice(6);
              try {
                const data = JSON.parse(dataStr) as Record<string, unknown>;
                if (currentEvent === 'delta') {
                  accumulated += data.text as string;
                  setMessages((prev) =>
                    prev.map((m) => m.id === novaId ? { ...m, content: accumulated } : m)
                  );
                } else if (currentEvent === 'error') {
                  throw new Error(data.message as string ?? 'Stream error');
                }
              } catch {
                // partial or non-JSON line — continue
              }
            }
          }
        }
        return;
      }

      // Fallback to non-streaming endpoint
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => 'Unknown error');
        throw new Error(`API error ${res.status}: ${errText}`);
      }

      const data = await res.json() as {
        content?: string;
        error?: string;
      };

      if (data.error) throw new Error(data.error);

      setMessages((prev) =>
        prev.map((m) => m.id === novaId ? { ...m, content: data.content ?? '' } : m)
      );
    } catch (err) {
      if ((err as { name?: string }).name === 'AbortError') return;
      const errMsg = err instanceof Error ? err.message : 'Something went wrong. Please try again.';
      setMessages((prev) =>
        prev.map((m) =>
          m.id === novaId
            ? { ...m, content: `Error: ${errMsg}` }
            : m
        )
      );
    } finally {
      setIsStreaming(false);
      setStreamingId(null);
      abortRef.current = null;
    }
  }, [input, isStreaming, messages, currentModule, currentPage]);

  const contextChips: string[] = [];
  if (currentModule) contextChips.push(currentModule);
  if (currentPage) contextChips.push(currentPage);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          padding: '12px 16px',
          borderBottom: '1px solid #27272a',
          flexShrink: 0,
        }}
      >
        <NovaAvatar />
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>Nova</div>
          <div style={{ fontSize: 11, color: '#71717a', marginTop: 1 }}>
            {currentModule ? `${currentModule} · ${currentPage}` : currentPage}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '14px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {messages.map((msg) => {
          const isUser = msg.role === 'user';
          const isTyping = !isUser && msg.id === streamingId && msg.content === '';
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                flexDirection: isUser ? 'row-reverse' : 'row',
                alignItems: 'flex-start',
                gap: 8,
              }}
            >
              {!isUser && <NovaAvatar />}
              <div
                style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: isUser ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  fontSize: 13,
                  lineHeight: 1.5,
                  color: '#e4e4e7',
                  background: isUser ? '#27272a' : 'rgba(254,80,0,0.08)',
                  border: isUser ? 'none' : '1px solid rgba(254,80,0,0.2)',
                }}
              >
                {isTyping ? (
                  <span style={{ display: 'inline-flex', gap: 3, alignItems: 'center', height: 18 }}>
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        style={{
                          width: 5,
                          height: 5,
                          borderRadius: '50%',
                          background: '#FE5000',
                          opacity: 0.7,
                          animation: `novaDot 1.2s ease-in-out ${i * 0.2}s infinite`,
                        }}
                      />
                    ))}
                    <style>{`
                      @keyframes novaDot {
                        0%, 80%, 100% { transform: scale(0.7); opacity: 0.4; }
                        40% { transform: scale(1); opacity: 1; }
                      }
                    `}</style>
                  </span>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Context bar */}
      {contextChips.length > 0 && (
        <div
          style={{
            padding: '6px 12px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            flexWrap: 'wrap',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: 10, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Context
          </span>
          {contextChips.map((chip) => (
            <span
              key={chip}
              style={{
                fontSize: 11,
                color: '#a1a1aa',
                background: '#1c1c1f',
                border: '1px solid #3f3f46',
                borderRadius: 4,
                padding: '2px 7px',
              }}
            >
              {chip}
            </span>
          ))}
          <button
            style={{
              marginLeft: 'auto',
              fontSize: 11,
              color: '#71717a',
              background: 'transparent',
              border: '1px solid #3f3f46',
              borderRadius: 4,
              padding: '2px 8px',
              cursor: 'pointer',
            }}
          >
            Attach
          </button>
        </div>
      )}

      {/* Input area */}
      <div
        style={{
          padding: '10px 12px',
          borderTop: '1px solid #27272a',
          display: 'flex',
          gap: 8,
          alignItems: 'flex-end',
          flexShrink: 0,
        }}
      >
        <input
          type="text"
          value={input}
          disabled={isStreaming}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder={isStreaming ? 'Nova is thinking...' : 'Ask Nova about this module...'}
          style={{
            flex: 1,
            background: '#1c1c1f',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            padding: '8px 12px',
            fontSize: 13,
            color: '#e4e4e7',
            outline: 'none',
            opacity: isStreaming ? 0.6 : 1,
          }}
        />
        <button
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: isStreaming || !input.trim() ? '#3f3f46' : '#FE5000',
            border: 'none',
            cursor: isStreaming || !input.trim() ? 'not-allowed' : 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            transition: 'background 0.15s ease',
          }}
          aria-label="Send"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M7 1L13 7L7 13M13 7H1"
              stroke="white"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bots mode
// ---------------------------------------------------------------------------

function BotsMode() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: 'auto',
          padding: '10px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        {PLACEHOLDER_BOTS.map((bot) => (
          <div
            key={bot.id}
            style={{
              background: '#18181b',
              border: '1px solid #27272a',
              borderRadius: 8,
              padding: '10px 12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#f4f4f5' }}>{bot.name}</span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 600,
                  color: statusColor(bot.status),
                  background: `${statusColor(bot.status)}18`,
                  border: `1px solid ${statusColor(bot.status)}40`,
                  borderRadius: 4,
                  padding: '2px 7px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                {statusLabel(bot.status)}
              </span>
            </div>
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 8 }}>{bot.description}</div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <code style={{ fontSize: 10, color: '#52525b', background: '#09090b', borderRadius: 3, padding: '2px 5px' }}>
                {bot.schedule}
              </code>
              <button
                style={{
                  fontSize: 11,
                  color: '#FE5000',
                  background: 'rgba(254,80,0,0.08)',
                  border: '1px solid rgba(254,80,0,0.3)',
                  borderRadius: 5,
                  padding: '3px 10px',
                  cursor: 'pointer',
                }}
              >
                Run Now
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Create Bot */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #27272a', flexShrink: 0 }}>
        <button
          style={{
            width: '100%',
            padding: '9px 0',
            borderRadius: 8,
            background: 'transparent',
            border: '1px dashed #3f3f46',
            color: '#71717a',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          + Create Bot
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History mode
// ---------------------------------------------------------------------------

function HistoryMode() {
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        overflowY: 'auto',
        padding: '10px 12px',
        display: 'flex',
        flexDirection: 'column',
        gap: 2,
      }}
    >
      {PLACEHOLDER_HISTORY.map((item) => (
        <button
          key={item.id}
          style={{
            width: '100%',
            textAlign: 'left',
            padding: '10px 12px',
            borderRadius: 8,
            background: 'transparent',
            border: '1px solid transparent',
            cursor: 'pointer',
            transition: 'background 0.1s ease',
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = '#18181b';
            (e.currentTarget as HTMLButtonElement).style.borderColor = '#27272a';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.background = 'transparent';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'transparent';
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 13, fontWeight: 500, color: '#e4e4e7' }}>{item.title}</span>
            <span style={{ fontSize: 10, color: '#52525b', flexShrink: 0, marginLeft: 8 }}>
              {formatRelativeTime(item.timestamp)}
            </span>
          </div>
          <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {item.preview}
          </div>
        </button>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ChatPanel
// ---------------------------------------------------------------------------

export default function ChatPanel({
  isOpen,
  currentModule,
  currentPage,
  onClose,
}: ChatPanelProps) {
  const [mode, setMode] = useState<PanelMode>('chat');

  return (
    <div
      style={{
        width: isOpen ? 380 : 0,
        minWidth: isOpen ? 380 : 0,
        maxWidth: isOpen ? 380 : 0,
        height: '100%',
        background: '#111113',
        borderLeft: isOpen ? '1px solid #27272a' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width 0.2s ease, min-width 0.2s ease',
        flexShrink: 0,
      }}
    >
      {isOpen && (
        <>
          {/* Top bar — close button */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 14px 0',
              flexShrink: 0,
            }}
          >
            <span style={{ fontSize: 11, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Nova
            </span>
            <button
              onClick={onClose}
              aria-label="Close chat panel"
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#52525b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 4,
                borderRadius: 4,
              }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M1 1L13 13M13 1L1 13" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          {/* Mode pills */}
          <ModePills mode={mode} onChange={setMode} />

          {/* Mode content */}
          {mode === 'chat' && (
            <ChatMode currentModule={currentModule} currentPage={currentPage} />
          )}
          {mode === 'bots' && <BotsMode />}
          {mode === 'history' && <HistoryMode />}
        </>
      )}
    </div>
  );
}
