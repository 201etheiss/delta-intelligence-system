'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LayoutGrid, List, SlidersHorizontal, Plus } from 'lucide-react';
import { MODULE_GROUPS, SPOKE_MODULES, ALL_MODULES } from '@/lib/shell/module-registry';
import { getSessionState, getModuleUsage, saveSessionState } from '@/lib/shell/session-state';
import { IntelligenceSummary } from './IntelligenceSummary';
import { ActivityTimeline } from './ActivityTimeline';
import { ModuleTile } from './ModuleTile';
import { ModuleCustomizer } from './ModuleCustomizer';
import type { ModuleGroup } from '@/lib/shell/module-registry';

// Stats per module id
const MODULE_STATS: Record<string, string> = {
  finance: '16 pages · AP, AR, GL, Close',
  operations: '5 pages · Fleet, Assets, Inventory',
  intelligence: '9 pages · Executive, Sales, Analytics',
  organization: '4 pages · People, HR, Integrations',
  compliance: '4 pages · Vault, Audit, Controls',
  admin: '8 pages · Users, Permissions, Health',
  platform: '10 pages · Dashboards, Sources, Docs',
  'delta-portal': 'Spoke · Orders, Tracking, Invoices',
  'equipment-tracker': 'Spoke · Assets, Maintenance, GPS',
  'signal-map': 'Spoke · OTED Assessment, Reports',
};

// Alert counts per module id
const MODULE_ALERTS: Record<string, number> = {
  finance: 4,
  operations: 0,
  intelligence: 0,
  organization: 0,
  compliance: 1,
  admin: 2,
  platform: 0,
  'delta-portal': 0,
  'equipment-tracker': 0,
  'signal-map': 0,
};

// Module status
const MODULE_STATUS: Record<string, 'live' | 'dev' | 'deployed' | 'planned'> = {
  finance: 'live',
  operations: 'live',
  intelligence: 'live',
  organization: 'live',
  compliance: 'live',
  admin: 'live',
  platform: 'live',
  'delta-portal': 'dev',
  'equipment-tracker': 'deployed',
  'signal-map': 'deployed',
};

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontSize: '10px',
        fontWeight: 700,
        color: '#52525B',
        textTransform: 'uppercase',
        letterSpacing: '0.07em',
        margin: '0 0 10px',
      }}
    >
      {children}
    </p>
  );
}

function ModuleGrid({
  modules,
  pinnedIds,
  onNavigate,
  onPin,
  viewMode,
}: {
  modules: ModuleGroup[];
  pinnedIds: Set<string>;
  onNavigate: (path: string) => void;
  onPin: (id: string) => void;
  viewMode: 'grid' | 'list';
}) {
  return (
    <div
      style={
        viewMode === 'grid'
          ? {
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
              gap: '10px',
            }
          : {
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }
      }
    >
      {modules.map((m) => (
        <ModuleTile
          key={m.id}
          module={m}
          isPinned={pinnedIds.has(m.id)}
          alertCount={MODULE_ALERTS[m.id] ?? 0}
          stats={MODULE_STATS[m.id] ?? (m.description ?? '')}
          status={m.status ?? MODULE_STATUS[m.id] ?? 'live'}
          onClick={() => {
            if (m.isSpoke && m.externalUrl) {
              window.open(m.externalUrl, '_blank', 'noopener');
            } else {
              onNavigate(m.defaultPagePath);
            }
          }}
          onPin={() => onPin(m.id)}
        />
      ))}
    </div>
  );
}

export function HomeGrid() {
  const router = useRouter();
  const [pinnedIds, setPinnedIds] = useState<Set<string>>(new Set());
  const [moduleOrder, setModuleOrder] = useState<string[]>([]);
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    const session = getSessionState();
    if (session?.pinnedModules) setPinnedIds(new Set(session.pinnedModules));
    if (session?.moduleOrder?.length) setModuleOrder(session.moduleOrder);
  }, []);

  function handlePin(moduleId: string) {
    const next = new Set(pinnedIds);
    if (next.has(moduleId)) {
      next.delete(moduleId);
    } else {
      next.add(moduleId);
    }
    setPinnedIds(next);
    saveSessionState({ pinnedModules: Array.from(next) });
  }

  function handleNavigate(path: string) {
    router.push(path);
  }

  function handleCustomizerClose() {
    // Re-read from session after save
    const session = getSessionState();
    if (session?.pinnedModules) setPinnedIds(new Set(session.pinnedModules));
    if (session?.moduleOrder?.length) setModuleOrder(session.moduleOrder);
    setCustomizerOpen(false);
  }

  // Sort modules by order, then usage frequency
  const usage = getModuleUsage();
  const orderedModules: ModuleGroup[] = (() => {
    if (moduleOrder.length > 0) {
      const orderMap = new Map(moduleOrder.map((id, i) => [id, i]));
      return [...ALL_MODULES].sort((a, b) => {
        const ia = orderMap.get(a.id) ?? 999;
        const ib = orderMap.get(b.id) ?? 999;
        return ia - ib;
      });
    }
    // Internal modules sorted by usage, then spokes at the end
    const internal = [...MODULE_GROUPS].sort((a, b) => {
      const ua = usage[a.id]?.openCount ?? 0;
      const ub = usage[b.id]?.openCount ?? 0;
      return ub - ua;
    });
    return [...internal, ...SPOKE_MODULES];
  })();

  const pinnedModules = orderedModules.filter((m) => pinnedIds.has(m.id));
  const unpinnedModules = orderedModules.filter((m) => !pinnedIds.has(m.id));

  return (
    <div
      style={{
        padding: '20px 24px',
        overflowY: 'auto',
        height: '100%',
        background: '#09090B',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      }}
    >
      {/* Page title */}
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 700, color: '#E4E4E7', margin: 0 }}>
          Delta Intelligence
        </h1>
        <p style={{ fontSize: '12px', color: '#71717A', margin: '3px 0 0' }}>
          Your command center across ERP, CRM, fleet, and analytics
        </p>
      </div>

      {/* Intelligence Summary */}
      <IntelligenceSummary />

      {/* Activity Timeline */}
      <div>
        <SectionLabel>Recent Activity</SectionLabel>
        <ActivityTimeline />
      </div>

      {/* Module Grid Header */}
      <div>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
          }}
        >
          <SectionLabel>Your Modules</SectionLabel>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* Grid/List toggle */}
            <div
              style={{
                display: 'flex',
                border: '1px solid #27272A',
                borderRadius: '6px',
                overflow: 'hidden',
              }}
            >
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                title="Grid view"
                style={{
                  background: viewMode === 'grid' ? '#27272A' : 'none',
                  border: 'none',
                  cursor: 'pointer',
                  padding: '5px 8px',
                  color: viewMode === 'grid' ? '#E4E4E7' : '#71717A',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <LayoutGrid size={13} />
              </button>
              <button
                type="button"
                onClick={() => setViewMode('list')}
                title="List view"
                style={{
                  background: viewMode === 'list' ? '#27272A' : 'none',
                  border: 'none',
                  borderLeft: '1px solid #27272A',
                  cursor: 'pointer',
                  padding: '5px 8px',
                  color: viewMode === 'list' ? '#E4E4E7' : '#71717A',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <List size={13} />
              </button>
            </div>

            {/* Customize button */}
            <button
              type="button"
              onClick={() => setCustomizerOpen(true)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                background: 'none',
                border: '1px solid #27272A',
                borderRadius: '6px',
                padding: '5px 10px',
                fontSize: '11px',
                fontWeight: 500,
                color: '#A1A1AA',
                cursor: 'pointer',
                transition: 'border-color 0.15s, color 0.15s',
              }}
            >
              <SlidersHorizontal size={11} />
              Customize
            </button>
          </div>
        </div>

        {/* Pinned section */}
        {pinnedModules.length > 0 && (
          <div style={{ marginBottom: '20px' }}>
            <SectionLabel>Pinned</SectionLabel>
            <ModuleGrid
              modules={pinnedModules}
              pinnedIds={pinnedIds}
              onNavigate={handleNavigate}
              onPin={handlePin}
              viewMode={viewMode}
            />
          </div>
        )}

        {/* All modules */}
        <div>
          {pinnedModules.length > 0 && <SectionLabel>All Modules</SectionLabel>}
          <ModuleGrid
            modules={unpinnedModules}
            pinnedIds={pinnedIds}
            onNavigate={handleNavigate}
            onPin={handlePin}
            viewMode={viewMode}
          />

          {/* Add Module tile */}
          <div
            style={{
              marginTop: '10px',
              padding: '16px',
              borderRadius: '8px',
              border: '1px dashed #3F3F46',
              background: 'transparent',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              cursor: 'pointer',
              transition: 'border-color 0.15s',
            }}
            role="button"
            tabIndex={0}
            onClick={() => router.push('/platform')}
            onKeyDown={(e) => e.key === 'Enter' && router.push('/platform')}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px dashed #3F3F46',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}
            >
              <Plus size={16} color="#52525B" />
            </div>
            <div>
              <p style={{ fontSize: '13px', fontWeight: 500, color: '#52525B', margin: 0 }}>
                Add Module
              </p>
              <p style={{ fontSize: '10px', color: '#3F3F46', margin: '2px 0 0' }}>
                Marketplace
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Customizer modal */}
      {customizerOpen && (
        <ModuleCustomizer modules={ALL_MODULES} onClose={handleCustomizerClose} />
      )}
    </div>
  );
}
