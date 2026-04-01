'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface BriefingAlertItem {
  id: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  module: string;
  actionUrl?: string;
  actionLabel?: string;
  timestamp: string;
}

const PRIORITY_STYLES: Record<BriefingAlertItem['priority'], React.CSSProperties> = {
  critical: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  high: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  medium: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' },
  low: { background: 'rgba(161,161,170,0.12)', color: '#a1a1aa', border: '1px solid rgba(161,161,170,0.2)' },
};

interface AlertPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function AlertPopover({ open, onClose, triggerRef }: AlertPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [items, setItems] = useState<BriefingAlertItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;

    fetch('/api/nova/briefing')
      .then((r) => r.json())
      .then((data: unknown) => {
        const d = data as {
          success: boolean;
          data?: { items?: Array<{
            id: string;
            priority: string;
            title: string;
            description: string;
            module: string;
            actionUrl?: string;
            actionLabel?: string;
            timestamp: string;
          }> };
        };

        if (d.success && d.data?.items) {
          // Show critical + high + medium; sort by priority
          const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
          const filtered = d.data.items
            .filter((i) => i.priority !== 'low')
            .sort((a, b) => (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3))
            .slice(0, 8)
            .map((i) => ({
              ...i,
              priority: i.priority as BriefingAlertItem['priority'],
            }));

          setItems(filtered.length > 0 ? filtered : [{
            id: 'all-ok',
            priority: 'medium' as const,
            title: 'All clear',
            description: 'No active alerts at this time',
            module: 'System',
            timestamp: new Date().toISOString(),
          }]);
        } else {
          setItems([{
            id: 'all-ok',
            priority: 'medium' as const,
            title: 'All clear',
            description: 'No active alerts at this time',
            module: 'System',
            timestamp: new Date().toISOString(),
          }]);
        }
        setLoaded(true);
      })
      .catch(() => {
        setItems([{
          id: 'err',
          priority: 'high' as const,
          title: 'Briefing Unavailable',
          description: 'Could not reach the Nova briefing service',
          module: 'System',
          timestamp: new Date().toISOString(),
        }]);
        setLoaded(true);
      });
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

  const urgentCount = items.filter(
    (i) => i.priority === 'critical' || i.priority === 'high'
  ).length;

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
        <AlertCircle size={14} color="#FE5000" />
        <span style={{ color: '#e4e4e7', fontSize: '13px', fontWeight: 600 }}>
          Nova Alerts
        </span>
        {urgentCount > 0 && (
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
            {urgentCount} urgent
          </span>
        )}
      </div>

      <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
        {!loaded && (
          <div style={{ padding: '16px', color: '#52525b', fontSize: '12px', textAlign: 'center' }}>
            Loading briefing...
          </div>
        )}
        {items.map((item) => (
          <div
            key={item.id}
            style={{
              padding: '10px 16px',
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
                  ...PRIORITY_STYLES[item.priority],
                }}
              >
                {item.priority}
              </span>
              <span style={{ color: '#52525b', fontSize: '10px', marginLeft: 'auto' }}>
                {item.module}
              </span>
            </div>
            <span style={{ color: '#e4e4e7', fontSize: '12px', fontWeight: 500 }}>
              {item.title}
            </span>
            <span
              style={{
                color: '#71717a',
                fontSize: '11px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {item.description}
            </span>
            {item.actionUrl && (
              <Link
                href={item.actionUrl}
                onClick={onClose}
                style={{ fontSize: '11px', color: '#FE5000', textDecoration: 'none', fontWeight: 500, marginTop: '2px' }}
              >
                {item.actionLabel ?? 'View'} →
              </Link>
            )}
          </div>
        ))}
      </div>

      <div
        style={{
          padding: '10px 16px',
          borderTop: '1px solid #27272a',
          textAlign: 'center',
        }}
      >
        <Link
          href="/"
          onClick={onClose}
          style={{ fontSize: '12px', color: '#FE5000', textDecoration: 'none', fontWeight: 500 }}
        >
          View Full Briefing →
        </Link>
      </div>
    </div>
  );
}
