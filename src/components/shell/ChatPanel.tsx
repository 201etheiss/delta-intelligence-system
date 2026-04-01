'use client';

import { useState, useEffect, Suspense } from 'react';
import ChatInterface from '@/components/chat/ChatInterface';

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

interface Bot {
  id: string;
  name: string;
  schedule: string;
  status: 'active' | 'paused' | 'failed';
  description: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | 'never' | null;
}

interface HistoryItem {
  id: string;
  title: string;
  preview: string;
  timestamp: Date;
  messageCount: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function statusColor(status: Bot['status']): string {
  switch (status) {
    case 'active':
      return '#22c55e';
    case 'paused':
      return '#71717a';
    case 'failed':
      return '#ef4444';
  }
}

function statusLabel(status: Bot['status']): string {
  switch (status) {
    case 'active':
      return 'Active';
    case 'paused':
      return 'Paused';
    case 'failed':
      return 'Failed';
  }
}

function deriveBotStatus(enabled: boolean, lastRunStatus: string | null): Bot['status'] {
  if (!enabled) return 'paused';
  if (lastRunStatus === 'error') return 'failed';
  return 'active';
}

function deriveTriggerLabel(trigger: { type: string; config: { cron?: string; frequency?: string } }): string {
  if (trigger.type === 'schedule') {
    return trigger.config.cron ?? trigger.config.frequency ?? 'Scheduled';
  }
  if (trigger.type === 'threshold') return 'Threshold';
  return 'Manual';
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
// Chat mode — embeds the full ChatInterface in compact mode
// ---------------------------------------------------------------------------

function ChatMode({ moduleContext }: { moduleContext?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <Suspense
        fallback={
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: '#71717a', fontSize: 13 }}>
            Loading chat...
          </div>
        }
      >
        <ChatInterface isAdmin compact moduleContext={moduleContext} />
      </Suspense>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Bots mode
// ---------------------------------------------------------------------------

function BotsMode() {
  const [bots, setBots] = useState<Bot[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningId, setRunningId] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/automations')
      .then((r) => r.json())
      .then((data: unknown) => {
        const raw = (data as { automations?: unknown[] })?.automations ?? [];
        const mapped: Bot[] = (raw as Array<{
          id: string;
          name: string;
          description: string;
          enabled: boolean;
          trigger: { type: string; config: { cron?: string; frequency?: string } };
          lastRunAt: string | null;
          lastRunStatus: 'success' | 'error' | 'never' | null;
        }>).map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          status: deriveBotStatus(a.enabled, a.lastRunStatus),
          schedule: deriveTriggerLabel(a.trigger),
          lastRunAt: a.lastRunAt,
          lastRunStatus: a.lastRunStatus,
        }));
        setBots(mapped);
      })
      .catch(() => setBots([]))
      .finally(() => setLoading(false));
  }, []);

  const handleRunNow = (botId: string) => {
    setRunningId(botId);
    fetch('/api/automations/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ automationId: botId }),
    })
      .catch(() => {/* silent — optimistic UI */})
      .finally(() => setRunningId(null));
  };

  const activeCount = bots.filter((b) => b.status === 'active').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      {/* Count badge */}
      {!loading && bots.length > 0 && (
        <div style={{ padding: '6px 12px 0', flexShrink: 0 }}>
          <span style={{ fontSize: 11, color: '#71717a' }}>
            {activeCount} active / {bots.length} total
          </span>
        </div>
      )}

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
        {loading && (
          <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
            Loading automations...
          </div>
        )}
        {!loading && bots.length === 0 && (
          <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
            No automations configured
          </div>
        )}
        {bots.map((bot) => (
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
                disabled={runningId === bot.id}
                onClick={() => handleRunNow(bot.id)}
                style={{
                  fontSize: 11,
                  color: runningId === bot.id ? '#52525b' : '#FE5000',
                  background: 'rgba(254,80,0,0.08)',
                  border: '1px solid rgba(254,80,0,0.3)',
                  borderRadius: 5,
                  padding: '3px 10px',
                  cursor: runningId === bot.id ? 'not-allowed' : 'pointer',
                }}
              >
                {runningId === bot.id ? 'Running...' : 'Run Now'}
              </button>
            </div>
            {bot.lastRunAt && (
              <div style={{ fontSize: 10, color: '#3f3f46', marginTop: 4 }}>
                Last run: {formatRelativeTime(new Date(bot.lastRunAt))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Create Bot */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #27272a', flexShrink: 0 }}>
        <a
          href="/automations"
          style={{
            display: 'block',
            width: '100%',
            padding: '9px 0',
            borderRadius: 8,
            background: 'transparent',
            border: '1px dashed #3f3f46',
            color: '#71717a',
            fontSize: 13,
            cursor: 'pointer',
            textAlign: 'center',
            textDecoration: 'none',
          }}
        >
          + Create Bot
        </a>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// History mode
// ---------------------------------------------------------------------------

function HistoryMode({ onSwitchToChat }: { onSwitchToChat?: () => void }) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [confirmClear, setConfirmClear] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem('di_conversations');
      if (!raw) return;
      const convos = JSON.parse(raw) as Array<{
        id: string;
        messages: Array<{ role: string; content: string; timestamp: string }>;
        createdAt: string;
        updatedAt: string;
      }>;
      const items: HistoryItem[] = convos
        .slice()
        .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
        .map((c) => {
          const firstUser = c.messages.find((m) => m.role === 'user');
          const preview = firstUser?.content ?? 'Empty conversation';
          return {
            id: c.id,
            title: preview.length > 40 ? preview.slice(0, 40) + '\u2026' : preview,
            preview: preview,
            timestamp: new Date(c.updatedAt),
            messageCount: c.messages.length,
          };
        });
      setHistory(items);
    } catch {
      setHistory([]);
    }
  }, []);

  const handleClearHistory = () => {
    if (!confirmClear) {
      setConfirmClear(true);
      setTimeout(() => setConfirmClear(false), 3000);
      return;
    }
    localStorage.removeItem('di_conversations');
    localStorage.removeItem('di_active_conversation');
    setHistory([]);
    setConfirmClear(false);
  };

  const handleSelectConversation = (id: string) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('di_active_conversation', id);
    }
    onSwitchToChat?.();
  };

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
          gap: 2,
        }}
      >
        {history.length === 0 && (
          <div style={{ color: '#52525b', fontSize: 12, textAlign: 'center', paddingTop: 24 }}>
            No conversation history
          </div>
        )}
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => handleSelectConversation(item.id)}
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
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ fontSize: 11, color: '#71717a', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {item.preview.length > 60 ? item.preview.slice(0, 60) + '\u2026' : item.preview}
              </div>
              <span style={{ fontSize: 10, color: '#3f3f46', flexShrink: 0, marginLeft: 8 }}>
                {item.messageCount} msg
              </span>
            </div>
          </button>
        ))}
      </div>

      {history.length > 0 && (
        <div style={{ padding: '10px 12px', borderTop: '1px solid #27272a', flexShrink: 0 }}>
          <button
            onClick={handleClearHistory}
            style={{
              width: '100%',
              padding: '7px 0',
              borderRadius: 6,
              background: 'transparent',
              border: `1px solid ${confirmClear ? 'rgba(239,68,68,0.5)' : '#3f3f46'}`,
              color: confirmClear ? '#ef4444' : '#71717a',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            {confirmClear ? 'Click again to confirm clear' : 'Clear History'}
          </button>
        </div>
      )}
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
  const switchToChat = () => setMode('chat');

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
              padding: '10px 14px',
              flexShrink: 0,
              borderBottom: '1px solid #27272a',
              background: 'linear-gradient(90deg, #111113 0%, #18181b 100%)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
              <div
                style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #FE5000 0%, #ff8c42 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#fff',
                  boxShadow: '0 0 6px rgba(254,80,0,0.4)',
                  flexShrink: 0,
                }}
              >
                N
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#FE5000', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                Nova
              </span>
            </div>
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
          {mode === 'chat' && <ChatMode moduleContext={currentModule ?? undefined} />}
          {mode === 'bots' && <BotsMode />}
          {mode === 'history' && <HistoryMode onSwitchToChat={switchToChat} />}
        </>
      )}
    </div>
  );
}
