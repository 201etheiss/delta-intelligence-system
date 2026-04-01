'use client';

import React from 'react';
import {
  DollarSign,
  Truck,
  BarChart3,
  Users,
  Shield,
  Settings,
  Layers,
  Star,
  Globe,
  Wrench,
  Radar,
  ExternalLink,
  type LucideProps,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  DollarSign,
  Truck,
  BarChart3,
  Users,
  Shield,
  Settings,
  Layers,
  Globe,
  Wrench,
  Radar,
};

const DOMAIN_COLORS: Record<string, string> = {
  finance: '#22C55E',
  operations: '#3B82F6',
  intelligence: '#8B5CF6',
  'delta-portal': '#FE5000',
  'equipment-tracker': '#71717A',
  'signal-map': '#06B6D4',
  organization: '#F59E0B',
  compliance: '#EF4444',
  admin: '#6B7280',
  platform: '#FE5000',
};

const STATUS_CONFIG = {
  live: { label: 'LIVE', bg: 'rgba(34,197,94,0.12)', color: '#22C55E', border: 'rgba(34,197,94,0.3)' },
  deployed: { label: 'DEPLOYED', bg: 'rgba(107,114,128,0.12)', color: '#9CA3AF', border: 'rgba(107,114,128,0.3)' },
  dev: { label: 'IN DEV', bg: 'rgba(234,179,8,0.12)', color: '#EAB308', border: 'rgba(234,179,8,0.3)' },
  planned: { label: 'PLANNED', bg: 'rgba(63,63,70,0.4)', color: '#52525B', border: 'rgba(63,63,70,0.5)' },
} as const;

export interface ModuleTileModule {
  id: string;
  label: string;
  icon: string;
  defaultPagePath: string;
}

export interface ModuleTileProps {
  module: ModuleTileModule;
  isPinned: boolean;
  alertCount: number;
  stats: string;
  status: 'live' | 'dev' | 'deployed' | 'planned';
  onClick: () => void;
  onPin: () => void;
}

export function ModuleTile({
  module,
  isPinned,
  alertCount,
  stats,
  status,
  onClick,
  onPin,
}: ModuleTileProps) {
  const IconComponent = ICON_MAP[module.icon] ?? DollarSign;
  const domainColor = DOMAIN_COLORS[module.id] ?? '#FE5000';
  const statusCfg = STATUS_CONFIG[status];
  const [hovered, setHovered] = React.useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => e.key === 'Enter' && onClick()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        padding: '16px',
        borderRadius: '8px',
        border: hovered ? '1px solid #FE5000' : '1px solid #27272A',
        background: '#18181B',
        cursor: 'pointer',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'border-color 0.15s, transform 0.15s, box-shadow 0.15s',
        boxShadow: hovered ? '0 4px 12px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.2)',
        outline: 'none',
      }}
    >
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        {/* Icon + name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: `${domainColor}18`,
              border: `1px solid ${domainColor}30`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <IconComponent size={18} color={domainColor} />
          </div>
          <div>
            <p style={{ fontSize: '13px', fontWeight: 600, color: '#E4E4E7', margin: 0 }}>
              {module.label}
            </p>
            <p style={{ fontSize: '10px', color: '#71717A', margin: 0, marginTop: '1px' }}>
              {stats}
            </p>
          </div>
        </div>

        {/* Alert badge + pin */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
          {alertCount > 0 && (
            <span
              style={{
                fontSize: '9px',
                fontWeight: 700,
                background: '#EF444420',
                color: '#EF4444',
                border: '1px solid #EF444440',
                borderRadius: '9999px',
                padding: '1px 6px',
              }}
            >
              {alertCount}
            </span>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onPin();
            }}
            title={isPinned ? 'Unpin module' : 'Pin module'}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: '2px',
              color: isPinned ? '#FE5000' : '#52525B',
              transition: 'color 0.15s',
              lineHeight: 1,
            }}
          >
            <Star size={13} fill={isPinned ? '#FE5000' : 'none'} />
          </button>
        </div>
      </div>

      {/* Status badge */}
      <div>
        <span
          style={{
            fontSize: '9px',
            fontWeight: 700,
            letterSpacing: '0.05em',
            background: statusCfg.bg,
            color: statusCfg.color,
            border: `1px solid ${statusCfg.border}`,
            borderRadius: '4px',
            padding: '2px 7px',
            display: 'inline-block',
          }}
        >
          {statusCfg.label}
        </span>
      </div>
    </div>
  );
}
