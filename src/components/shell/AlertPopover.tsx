'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';

interface AlertItem {
  id: string;
  title: string;
  description: string;
  severity: 'critical' | 'warning' | 'info';
  time: string;
}

const PLACEHOLDER_ALERTS: AlertItem[] = [
  {
    id: '1',
    title: 'Pipeline Latency High',
    description: 'Data ingestion latency exceeded 5s threshold',
    severity: 'critical',
    time: '2m ago',
  },
  {
    id: '2',
    title: 'Supabase Connection Pool',
    description: 'Connection pool at 87% capacity',
    severity: 'warning',
    time: '15m ago',
  },
  {
    id: '3',
    title: 'Scheduled Sync Complete',
    description: 'Ascend sync completed successfully',
    severity: 'info',
    time: '1h ago',
  },
];

const SEVERITY_STYLES: Record<AlertItem['severity'], string> = {
  critical: 'background: rgba(239,68,68,0.15); color: #f87171; border: 1px solid rgba(239,68,68,0.3);',
  warning: 'background: rgba(251,191,36,0.15); color: #fbbf24; border: 1px solid rgba(251,191,36,0.3);',
  info: 'background: rgba(96,165,250,0.15); color: #60a5fa; border: 1px solid rgba(96,165,250,0.3);',
};

interface AlertPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function AlertPopover({ open, onClose, triggerRef }: AlertPopoverProps) {
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

  return (
    <div
      ref={popoverRef}
      style={{
        position: 'absolute',
        top: '100%',
        left: 0,
        marginTop: '8px',
        width: '320px',
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
        <AlertCircle size={14} color="#FE5000" />
        <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
          Active Alerts
        </span>
        <span
          style={{
            marginLeft: 'auto',
            background: 'rgba(254,80,0,0.2)',
            color: '#FE5000',
            borderRadius: '10px',
            padding: '1px 7px',
            fontSize: '11px',
            fontWeight: 700,
          }}
        >
          {PLACEHOLDER_ALERTS.length}
        </span>
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {PLACEHOLDER_ALERTS.map((alert) => (
          <div
            key={alert.id}
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid #27272a',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span
                style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 6px',
                  borderRadius: '4px',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  ...(Object.fromEntries(
                    SEVERITY_STYLES[alert.severity]
                      .split(';')
                      .filter(Boolean)
                      .map((s) => {
                        const [k, v] = s.split(':').map((x) => x.trim());
                        return [
                          k
                            .replace(/-([a-z])/g, (_, c) => c.toUpperCase())
                            .trim(),
                          v,
                        ];
                      })
                  ) as React.CSSProperties),
                }}
              >
                {alert.severity}
              </span>
              <span
                style={{ marginLeft: 'auto', color: '#71717a', fontSize: '11px' }}
              >
                {alert.time}
              </span>
            </div>
            <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 500 }}>
              {alert.title}
            </span>
            <span style={{ color: '#71717a', fontSize: '12px' }}>
              {alert.description}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
