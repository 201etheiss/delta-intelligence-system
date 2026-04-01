'use client';

import { useEffect, useRef } from 'react';
import { Zap } from 'lucide-react';

interface AutomationItem {
  id: string;
  name: string;
  description: string;
  lastRun: string;
  nextRun: string;
  status: 'success' | 'pending' | 'failed';
}

const PLACEHOLDER_AUTOMATIONS: AutomationItem[] = [
  {
    id: '1',
    name: 'Daily GL Sync',
    description: 'Pull GL data from Ascend',
    lastRun: '6:00 AM',
    nextRun: 'Tomorrow 6:00 AM',
    status: 'success',
  },
  {
    id: '2',
    name: 'Weekly AR Aging',
    description: 'Generate AR aging report',
    lastRun: 'Mon 8:00 AM',
    nextRun: 'Mon 8:00 AM',
    status: 'success',
  },
  {
    id: '3',
    name: 'Salesforce CRM Sync',
    description: 'Sync contacts and opportunities',
    lastRun: '2h ago',
    nextRun: 'In 4h',
    status: 'success',
  },
  {
    id: '4',
    name: 'Payroll Export',
    description: 'Paylocity payroll data export',
    lastRun: 'Pending',
    nextRun: 'Fri 5:00 PM',
    status: 'pending',
  },
  {
    id: '5',
    name: 'Inventory Margin Calc',
    description: 'Recalculate product margins',
    lastRun: 'Yesterday',
    nextRun: 'Tonight 11:00 PM',
    status: 'success',
  },
  {
    id: '6',
    name: 'Fleet Data Refresh',
    description: 'Samsara fleet telemetry pull',
    lastRun: '15m ago',
    nextRun: 'In 45m',
    status: 'success',
  },
  {
    id: '7',
    name: 'Budget Variance Alert',
    description: 'Check budget vs actuals',
    lastRun: '1h ago',
    nextRun: 'In 23h',
    status: 'failed',
  },
  {
    id: '8',
    name: 'Evidence Vault Backup',
    description: 'Archive audit evidence',
    lastRun: '3h ago',
    nextRun: 'In 21h',
    status: 'success',
  },
];

const STATUS_STYLES: Record<AutomationItem['status'], React.CSSProperties> = {
  success: { background: 'rgba(34,197,94,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.3)' },
  pending: { background: 'rgba(251,191,36,0.15)', color: '#fbbf24', border: '1px solid rgba(251,191,36,0.3)' },
  failed: { background: 'rgba(239,68,68,0.15)', color: '#f87171', border: '1px solid rgba(239,68,68,0.3)' },
};

interface AutomationPopoverProps {
  open: boolean;
  onClose: () => void;
  triggerRef: React.RefObject<HTMLElement | null>;
}

export function AutomationPopover({ open, onClose, triggerRef }: AutomationPopoverProps) {
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
          {PLACEHOLDER_AUTOMATIONS.length} total
        </span>
      </div>

      <div style={{ maxHeight: '320px', overflowY: 'auto' }}>
        {PLACEHOLDER_AUTOMATIONS.map((automation) => (
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
            <div style={{ display: 'flex', gap: '12px', marginTop: '2px' }}>
              <span style={{ color: '#52525b', fontSize: '11px' }}>
                Last: {automation.lastRun}
              </span>
              <span style={{ color: '#52525b', fontSize: '11px' }}>
                Next: {automation.nextRun}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
