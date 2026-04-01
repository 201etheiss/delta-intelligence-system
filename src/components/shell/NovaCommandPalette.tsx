'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { MODULE_GROUPS } from '@/lib/shell/module-registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface NovaCommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon?: string;
  section: 'modules' | 'recent' | 'actions' | 'shortcuts';
  action: () => void;
}

// ---------------------------------------------------------------------------
// Module icon map (lucide name → unicode glyph or text fallback)
// We render text icons to avoid bundling extra lucide icons here.
// ---------------------------------------------------------------------------

const MODULE_ICON_CHARS: Record<string, string> = {
  DollarSign: '$',
  Truck: '⊡',
  BarChart3: '⋮',
  Users: '⊛',
  Shield: '◈',
  Settings: '⚙',
  Layers: '⊞',
};

const MODULE_DESCRIPTIONS: Record<string, string> = {
  finance: 'GL, AP/AR, budgets, close tracker, cash flow',
  operations: 'Fleet, fixed assets, inventory, contracts',
  intelligence: 'Executive dashboards, market, analytics, reports',
  organization: 'People, HR, workstreams, integrations',
  compliance: 'Vault, audit, controls, exceptions',
  admin: 'Users, permissions, system health, settings',
  platform: 'Dashboards, workspaces, sources, glossary',
};

// ---------------------------------------------------------------------------
// NovaCommandPalette
// ---------------------------------------------------------------------------

export function NovaCommandPalette({ isOpen, onClose }: NovaCommandPaletteProps) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // -------------------------------------------------------------------------
  // Reset query and selection on open
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      // Defer focus to next tick so the modal is rendered
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // -------------------------------------------------------------------------
  // Build full item list
  // -------------------------------------------------------------------------
  const allItems: PaletteItem[] = [
    // Modules
    ...MODULE_GROUPS.map((g) => ({
      id: `module-${g.id}`,
      label: g.label,
      description: MODULE_DESCRIPTIONS[g.id],
      icon: MODULE_ICON_CHARS[g.icon] ?? '·',
      section: 'modules' as const,
      action: () => {
        router.push(g.defaultPagePath);
        onClose();
      },
    })),
    // Recent (placeholder)
    ...[
      { label: 'Financial Statements', path: '/financial-statements' },
      { label: 'Fleet Map', path: '/fleet-map' },
      { label: 'Executive Dashboard', path: '/executive' },
      { label: 'AP Invoices', path: '/ap/invoices' },
      { label: 'Audit Log', path: '/audit' },
    ].map((r, i) => ({
      id: `recent-${i}`,
      label: r.label,
      description: r.path,
      icon: '↩',
      section: 'recent' as const,
      action: () => {
        router.push(r.path);
        onClose();
      },
    })),
    // Quick Actions (placeholder)
    ...[
      { label: 'New Chat', description: 'Open Nova chat panel' },
      { label: 'Run Automation', description: 'Trigger an automation workflow' },
      { label: 'Export Report', description: 'Export current view to PDF' },
      { label: 'Toggle Density', description: 'Switch between Executive and Operator density' },
    ].map((a, i) => ({
      id: `action-${i}`,
      label: a.label,
      description: a.description,
      icon: '⚡',
      section: 'actions' as const,
      action: () => onClose(),
    })),
    // Keyboard shortcuts (display-only — Enter still closes)
    ...[
      { label: 'Cmd+P', description: 'Open command palette' },
      { label: 'Cmd+K', description: 'Open Nova chat' },
      { label: 'Cmd+/', description: 'Toggle dark mode' },
    ].map((s, i) => ({
      id: `shortcut-${i}`,
      label: s.label,
      description: s.description,
      icon: '⌘',
      section: 'shortcuts' as const,
      action: () => onClose(),
    })),
  ];

  // -------------------------------------------------------------------------
  // Filter by query (fuzzy: every char in query appears in label in order)
  // -------------------------------------------------------------------------
  const filtered = query.trim()
    ? allItems.filter((item) => {
        const q = query.toLowerCase();
        const label = item.label.toLowerCase();
        const desc = (item.description ?? '').toLowerCase();
        // Simple substring match on label or description
        return label.includes(q) || desc.includes(q);
      })
    : allItems;

  // -------------------------------------------------------------------------
  // Group filtered items by section
  // -------------------------------------------------------------------------
  const sections: { key: PaletteItem['section']; label: string }[] = [
    { key: 'modules', label: 'Modules' },
    { key: 'recent', label: 'Recent' },
    { key: 'actions', label: 'Quick Actions' },
    { key: 'shortcuts', label: 'Keyboard Shortcuts' },
  ];

  // Build flat list in section order (for keyboard nav)
  const orderedFiltered: PaletteItem[] = sections.flatMap(({ key }) =>
    filtered.filter((i) => i.section === key),
  );

  // Clamp selectedIndex
  const clampedIndex = Math.min(selectedIndex, Math.max(0, orderedFiltered.length - 1));

  // -------------------------------------------------------------------------
  // Keyboard navigation
  // -------------------------------------------------------------------------
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.min(prev + 1, orderedFiltered.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = orderedFiltered[clampedIndex];
        if (item) item.action();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    },
    [orderedFiltered, clampedIndex, onClose],
  );

  // Reset selection on query change
  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setSelectedIndex(0);
  };

  // -------------------------------------------------------------------------
  // Render nothing when closed
  // -------------------------------------------------------------------------
  if (!isOpen) return null;

  // -------------------------------------------------------------------------
  // Compute running index offset per section for keyboard nav highlighting
  // -------------------------------------------------------------------------
  let runningIndex = 0;

  return (
    /* Overlay */
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Command Palette"
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9000,
        padding: '60px 16px',
      }}
    >
      {/* Modal */}
      <div
        role="presentation"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '640px',
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '12px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          maxHeight: 'calc(100vh - 120px)',
        }}
      >
        {/* Search input */}
        <div
          style={{
            padding: '0 16px',
            borderBottom: '1px solid #27272a',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
          }}
        >
          <span style={{ color: '#52525b', fontSize: '16px', flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            placeholder="Search modules, actions, pages..."
            style={{
              flex: 1,
              height: '52px',
              background: 'transparent',
              border: 'none',
              outline: 'none',
              color: '#e4e4e7',
              fontSize: '18px',
              caretColor: '#FE5000',
            }}
          />
          <kbd
            style={{
              flexShrink: 0,
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: '4px',
              padding: '2px 6px',
              color: '#71717a',
              fontSize: '11px',
              fontFamily: 'monospace',
            }}
          >
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div style={{ overflowY: 'auto', flex: 1 }}>
          {orderedFiltered.length === 0 ? (
            <div
              style={{
                padding: '32px 16px',
                textAlign: 'center',
                color: '#52525b',
                fontSize: '14px',
              }}
            >
              No results for &ldquo;{query}&rdquo;
            </div>
          ) : (
            sections.map(({ key, label: sectionLabel }) => {
              const sectionItems = orderedFiltered.filter((i) => i.section === key);
              if (sectionItems.length === 0) return null;

              const sectionStartIndex = runningIndex;
              runningIndex += sectionItems.length;

              return (
                <div key={key}>
                  {/* Section header */}
                  <div
                    style={{
                      padding: '10px 16px 4px',
                      color: '#52525b',
                      fontSize: '11px',
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      textTransform: 'uppercase',
                    }}
                  >
                    {sectionLabel}
                  </div>

                  {/* Section items */}
                  {sectionItems.map((item, localIdx) => {
                    const globalIdx = sectionStartIndex + localIdx;
                    const isSelected = globalIdx === clampedIndex;

                    return (
                      <button
                        key={item.id}
                        onClick={item.action}
                        onMouseEnter={() => setSelectedIndex(globalIdx)}
                        style={{
                          width: '100%',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '12px',
                          padding: '10px 16px',
                          background: isSelected
                            ? 'rgba(254,80,0,0.1)'
                            : 'transparent',
                          border: 'none',
                          borderLeft: isSelected
                            ? '2px solid #FE5000'
                            : '2px solid transparent',
                          cursor: 'pointer',
                          textAlign: 'left',
                          transition: 'background 0.08s',
                        }}
                      >
                        {/* Icon */}
                        <span
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '6px',
                            background: isSelected
                              ? 'rgba(254,80,0,0.15)'
                              : '#27272a',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '14px',
                            color: isSelected ? '#FE5000' : '#71717a',
                            flexShrink: 0,
                            fontFamily: 'monospace',
                          }}
                        >
                          {item.icon ?? '·'}
                        </span>

                        {/* Label + description */}
                        <span style={{ flex: 1, minWidth: 0 }}>
                          <span
                            style={{
                              display: 'block',
                              color: isSelected ? '#e4e4e7' : '#a1a1aa',
                              fontSize: '14px',
                              fontWeight: isSelected ? 600 : 400,
                              whiteSpace: 'nowrap',
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                            }}
                          >
                            {item.label}
                          </span>
                          {item.description && (
                            <span
                              style={{
                                display: 'block',
                                color: '#52525b',
                                fontSize: '12px',
                                marginTop: '1px',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                              }}
                            >
                              {item.description}
                            </span>
                          )}
                        </span>

                        {/* Shortcut badge for keyboard shortcuts section */}
                        {item.section === 'shortcuts' && (
                          <kbd
                            style={{
                              flexShrink: 0,
                              background: '#27272a',
                              border: '1px solid #3f3f46',
                              borderRadius: '4px',
                              padding: '2px 7px',
                              color: '#71717a',
                              fontSize: '11px',
                              fontFamily: 'monospace',
                            }}
                          >
                            {item.label}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '8px 16px',
            borderTop: '1px solid #27272a',
            display: 'flex',
            gap: '16px',
            color: '#52525b',
            fontSize: '11px',
          }}
        >
          <span><kbd style={{ fontFamily: 'monospace' }}>↑↓</kbd> navigate</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>↵</kbd> select</span>
          <span><kbd style={{ fontFamily: 'monospace' }}>ESC</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
