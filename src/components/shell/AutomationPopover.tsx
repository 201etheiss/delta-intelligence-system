'use client';

import { useEffect, useRef, useState } from 'react';
import { Zap } from 'lucide-react';

interface AutomationItem {
  id: string;
  name: string;
  description: string;
  lastRun: string;
  status: 'success' | 'pending' | 'failed';
}

const STATUS_STYLES: Record<AutomationItem['status'], React.CSSProperties> = {
  success: { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  pending: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  failed: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
};

function deriveStatus(enabled: boolean, lastRunStatus: string | null): AutomationItem['status'] {
  if (!enabled) return 'pending';
  if (lastRunStatus === 'error') return 'failed';
  if (lastRunStatus === 'success') return 'success';
  return 'pending';
}

function formatRelative(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.floor(diffHr / 24)}d ago`;
}

interface AutomationPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function AutomationPopover({ open, onClose, triggerRef }: AutomationPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch('/api/automations')
      .then((r) => r.json())
      .then((data: unknown) => {
        const raw = (data as { automations?: Array<{ id: string; name: string; description: string; enabled: boolean; lastRunStatus: string | null; lastRunAt: string | null }> })?.automations ?? [];
        setAutomations(raw.map((a) => ({
          id: a.id,
          name: a.name,
          description: a.description,
          lastRun: formatRelative(a.lastRunAt),
          status: deriveStatus(a.enabled, a.lastRunStatus),
        })));
        setLoaded(true);
      })
      .catch(() => setLoaded(true));
  }, [open, loaded]);

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

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '8px',
        width: '340px',
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
        <Zap size={14} color="#4ade80" />
        <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
          Automations
        </span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'rgba(74,222,128,0.15)',
            color: '#4ade80',
            borderRadius: '10px',
            padding: '1px 7px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {automations.length} total
        </span>
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {!loaded && (
          <div style={{ padding: '16px', color: '#52525b', fontSize: '12px', textAlign: 'center' }}>
            Loading...
          </div>
        )}
        {loaded && automations.length === 0 && (
          <div style={{ padding: '16px', color: '#52525b', fontSize: '12px', textAlign: 'center' }}>
            No automations configured
          </div>
        )}
        {automations.map((automation) => (
          <div
            key={automation.id}
            style={{
              padding: '10px 16px',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              flexDirection: 'column',
              gap: '3px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
                {automation.name}
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
                  flexShrink: 0,
                  ...STATUS_STYLES[automation.status],
                }}
              >
                {automation.status}
              </span>
            </div>
            <span style={{ color: '#71717a', fontSize: '12px' }}>{automation.description}</span>
            <span style={{ color: '#52525b', fontSize: '11px' }}>
              Last: {automation.lastRun}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
