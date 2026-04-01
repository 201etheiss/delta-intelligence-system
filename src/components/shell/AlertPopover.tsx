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

const SEVERITY_STYLES: Record<AlertItem['severity'], React.CSSProperties> = {
  critical: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
  warning: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  info: { background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)' },
};

interface AlertPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function AlertPopover({ open, onClose, triggerRef }: AlertPopoverProps) {
  const popoverRef = useRef<HTMLDivElement>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!open || loaded) return;
    fetch('/api/admin/health')
      .then((r) => r.json())
      .then((data: unknown) => {
        const services = (data as { services?: Array<{ name: string; status: string; error?: string; responseTime?: number }> })?.services ?? [];
        const derived: AlertItem[] = services
          .filter((s) => s.status === 'error' || s.status === 'degraded')
          .map((s, i) => ({
            id: `svc-${i}`,
            title: `${s.name} ${s.status === 'error' ? 'Unreachable' : 'Degraded'}`,
            description: s.error ?? (s.status === 'degraded' ? `Response time: ${s.responseTime ?? '?'}ms` : 'Service unavailable'),
            severity: s.status === 'error' ? 'critical' as const : 'warning' as const,
            time: 'just now',
          }));
        setAlerts(derived.length > 0 ? derived : [
          {
            id: 'all-ok',
            title: 'All Services Healthy',
            description: 'No active alerts at this time',
            severity: 'info',
            time: 'just now',
          },
        ]);
        setLoaded(true);
      })
      .catch(() => {
        setAlerts([
          {
            id: 'err',
            title: 'Health Check Unavailable',
            description: 'Could not reach health endpoint',
            severity: 'warning',
            time: 'just now',
          },
        ]);
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
          {alerts.filter((a) => a.severity !== 'info').length || alerts.length}
        </span>
      </div>

      <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
        {!loaded && (
          <div style={{ padding: '16px', color: '#52525b', fontSize: '12px', textAlign: 'center' }}>
            Checking services...
          </div>
        )}
        {alerts.map((alert) => (
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
                  ...SEVERITY_STYLES[alert.severity],
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
