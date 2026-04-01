'use client';

import React from 'react';
import {
  LayoutDashboard,
  DollarSign,
  Truck,
  BarChart3,
  Users,
  Shield,
  Settings,
  Layers,
  type LucideProps,
} from 'lucide-react';
import type { TabState } from '@/lib/shell/tab-manager';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ICON_MAP: Record<string, React.ComponentType<LucideProps>> = {
  LayoutDashboard,
  DollarSign,
  Truck,
  BarChart3,
  Users,
  Shield,
  Settings,
  Layers,
};

interface ModuleTabsProps {
  tabs: TabState[];
  activeTabId: string | null;
  onTabClick: (id: string) => void;
  onTabClose: (id: string) => void;
  onNewTab: () => void;
}

export function ModuleTabs({
  tabs,
  activeTabId,
  onTabClick,
  onTabClose,
  onNewTab,
}: ModuleTabsProps) {
  const maxTabsReached = tabs.length >= 8;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        height: '34px',
        background: '#111113',
        borderBottom: '1px solid #27272a',
        overflowX: 'auto',
        overflowY: 'hidden',
        flexShrink: 0,
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTabId;
        const IconComponent = tab.icon ? ICON_MAP[tab.icon] : undefined;

        return (
          <button
            key={tab.id}
            onClick={() => onTabClick(tab.id)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '100%',
              padding: '0 10px',
              border: 'none',
              borderBottom: isActive ? '2px solid #FE5000' : '2px solid transparent',
              background: isActive ? 'rgba(254, 80, 0, 0.04)' : 'transparent',
              color: isActive ? '#e4e4e7' : '#71717a',
              cursor: 'pointer',
              fontSize: '12px',
              fontWeight: isActive ? 500 : 400,
              whiteSpace: 'nowrap',
              flexShrink: 0,
              transition: 'color 0.15s, background 0.15s',
            }}
          >
            {IconComponent && <IconComponent size={13} />}
            <span>{tab.label}</span>
            <span
              role="button"
              aria-label={`Close ${tab.label}`}
              onClick={(e) => {
                e.stopPropagation();
                onTabClose(tab.id);
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '14px',
                height: '14px',
                marginLeft: '2px',
                borderRadius: '2px',
                color: '#52525b',
                fontSize: '11px',
                lineHeight: 1,
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLSpanElement).style.color = '#e4e4e7';
                (e.currentTarget as HTMLSpanElement).style.background = 'rgba(255,255,255,0.08)';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLSpanElement).style.color = '#52525b';
                (e.currentTarget as HTMLSpanElement).style.background = 'transparent';
              }}
            >
              ×
            </span>
          </button>
        );
      })}

      <button
        onClick={maxTabsReached ? undefined : onNewTab}
        disabled={maxTabsReached}
        title={maxTabsReached ? 'Close a tab to open another' : 'New tab'}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '24px',
          height: '24px',
          margin: '0 4px',
          border: 'none',
          borderRadius: '3px',
          background: 'transparent',
          color: '#71717a',
          cursor: maxTabsReached ? 'not-allowed' : 'pointer',
          opacity: maxTabsReached ? 0.3 : 1,
          fontSize: '16px',
          lineHeight: 1,
          flexShrink: 0,
          transition: 'opacity 0.15s',
        }}
      >
        +
      </button>
    </div>
  );
}

export default ModuleTabs;
