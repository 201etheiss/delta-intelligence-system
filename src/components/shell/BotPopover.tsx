'use client';

import { useEffect, useRef } from 'react';
import { Bot } from 'lucide-react';

interface BotItem {
  id: string;
  name: string;
  description: string;
  status: 'running' | 'idle' | 'failed';
  uptime: string;
}

const PLACEHOLDER_BOTS: BotItem[] = [
  {
    id: '1',
    name: 'Nova Core',
    description: 'Main intelligence orchestrator',
    status: 'running',
    uptime: '14h 22m',
  },
  {
    id: '2',
    name: 'Data Sync Agent',
    description: 'Ascend → DI pipeline sync',
    status: 'running',
    uptime: '6h 08m',
  },
  {
    id: '3',
    name: 'Report Generator',
    description: 'Automated financial reporting',
    status: 'idle',
    uptime: '—',
  },
  {
    id: '4',
    name: 'Anomaly Detector',
    description: 'GL anomaly scanning',
    status: 'failed',
    uptime: 'Crashed 3m ago',
  },
];

const STATUS_STYLES: Record<BotItem['status'], React.CSSProperties> = {
  running: { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  idle: { background: 'rgba(161,161,170,0.15)', color: '#a1a1aa', border: '1px solid rgba(161,161,170,0.3)' },
  failed: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
};

const STATUS_DOT: Record<BotItem['status'], string> = {
  running: '#4ade80',
  idle: '#a1a1aa',
  failed: '#f87171',
};

interface BotPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function BotPopover({ open, onClose, triggerRef }: BotPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node) &&
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose, triggerRef]);

  if (!open) return null;

  const runningCount = PLACEHOLDER_BOTS.filter((b) => b.status === 'running').length;

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '8px',
        width: '300px',
        background: '#18181b',
        border: '1px solid #27272a',
        borderRadius: '8px',
        zIndex: 1000,
        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '12px 16px',
          borderBottom: '1px solid #27272a',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
        }}
      >
        <Bot size={14} color="#a78bfa" />
        <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
          Active Bots
        </span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'rgba(167,139,250,0.2)',
            color: '#a78bfa',
            borderRadius: '10px',
            padding: '1px 7px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {runningCount} running
        </span>
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {PLACEHOLDER_BOTS.map((bot) => (
          <div
            key={bot.id}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
            }}
          >
            <div
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: STATUS_DOT[bot.status],
                marginTop: '4px',
                flexShrink: 0,
                boxShadow: bot.status === 'running' ? `0 0 6px ${STATUS_DOT[bot.status]}` : 'none',
              }}
            />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                  {bot.name}
                </span>
                <span
                  style={{
                    marginLeft: 'auto',
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '4px',
                    textTransform: 'uppercase',
                    letterSpacing: '0.05em',
                    ...STATUS_STYLES[bot.status],
                  }}
                >
                  {bot.status}
                </span>
              </div>
              <span style={{ color: '#71717a', fontSize: '12px' }}>{bot.description}</span>
              <div style={{ color: '#52525b', fontSize: '11px', marginTop: '2px' }}>
                Uptime: {bot.uptime}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
