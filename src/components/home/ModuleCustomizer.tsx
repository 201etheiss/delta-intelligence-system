'use client';

import React from 'react';
import { Star, ChevronUp, ChevronDown, X, Eye, EyeOff } from 'lucide-react';
import { getSessionState, saveSessionState } from '@/lib/shell/session-state';
import type { ModuleGroup } from '@/lib/shell/module-registry';

interface ModuleCustomizerProps {
  modules: ModuleGroup[];
  onClose: () => void;
}

interface ModuleUIState {
  id: string;
  label: string;
  pinned: boolean;
  hidden: boolean;
}

export function ModuleCustomizer({ modules, onClose }: ModuleCustomizerProps) {
  const [items, setItems] = React.useState<ModuleUIState[]>(() => {
    const session = getSessionState();
    const pinned = new Set(session?.pinnedModules ?? []);
    const orderMap = new Map((session?.moduleOrder ?? []).map((id, i) => [id, i]));

    const sorted = [...modules].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? 999;
      const ib = orderMap.get(b.id) ?? 999;
      return ia - ib;
    });

    return sorted.map((m) => ({
      id: m.id,
      label: m.label,
      pinned: pinned.has(m.id),
      hidden: false,
    }));
  });

  function move(index: number, direction: 'up' | 'down') {
    const next = [...items];
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= next.length) return;
    const temp = next[index];
    next[index] = next[swapWith];
    next[swapWith] = temp;
    setItems(next);
  }

  function togglePin(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, pinned: !item.pinned } : item
      )
    );
  }

  function toggleHidden(id: string) {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, hidden: !item.hidden } : item
      )
    );
  }

  function save() {
    saveSessionState({
      pinnedModules: items.filter((i) => i.pinned).map((i) => i.id),
      moduleOrder: items.map((i) => i.id),
    });
    onClose();
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(0,0,0,0.7)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: '#18181B',
          border: '1px solid #27272A',
          borderRadius: '10px',
          width: '440px',
          maxHeight: '80vh',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 20px',
            borderBottom: '1px solid #27272A',
          }}
        >
          <div>
            <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#E4E4E7', margin: 0 }}>
              Customize Modules
            </h2>
            <p style={{ fontSize: '11px', color: '#71717A', margin: '2px 0 0' }}>
              Reorder, pin, or hide modules from the home grid
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#71717A', padding: '4px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* List */}
        <div style={{ overflowY: 'auto', padding: '12px 20px', flex: 1 }}>
          {items.map((item, index) => (
            <div
              key={item.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 0',
                borderBottom: index < items.length - 1 ? '1px solid #27272A' : 'none',
                opacity: item.hidden ? 0.4 : 1,
              }}
            >
              {/* Label */}
              <span style={{ flex: 1, fontSize: '13px', color: '#D4D4D8', fontWeight: 500 }}>
                {item.label}
              </span>

              {/* Controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {/* Pin */}
                <button
                  type="button"
                  onClick={() => togglePin(item.id)}
                  title={item.pinned ? 'Unpin' : 'Pin'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: item.pinned ? '#FE5000' : '#52525B',
                    transition: 'color 0.15s',
                  }}
                >
                  <Star size={13} fill={item.pinned ? '#FE5000' : 'none'} />
                </button>

                {/* Show/hide */}
                <button
                  type="button"
                  onClick={() => toggleHidden(item.id)}
                  title={item.hidden ? 'Show' : 'Hide'}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: '4px',
                    color: '#52525B',
                    transition: 'color 0.15s',
                  }}
                >
                  {item.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>

                {/* Move up */}
                <button
                  type="button"
                  onClick={() => move(index, 'up')}
                  disabled={index === 0}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: index === 0 ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    color: index === 0 ? '#3F3F46' : '#71717A',
                  }}
                >
                  <ChevronUp size={13} />
                </button>

                {/* Move down */}
                <button
                  type="button"
                  onClick={() => move(index, 'down')}
                  disabled={index === items.length - 1}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: index === items.length - 1 ? 'not-allowed' : 'pointer',
                    padding: '4px',
                    color: index === items.length - 1 ? '#3F3F46' : '#71717A',
                  }}
                >
                  <ChevronDown size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '8px',
            padding: '14px 20px',
            borderTop: '1px solid #27272A',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              background: 'none',
              border: '1px solid #3F3F46',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              color: '#A1A1AA',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            style={{
              background: '#FE5000',
              border: 'none',
              borderRadius: '6px',
              padding: '6px 14px',
              fontSize: '12px',
              fontWeight: 600,
              color: '#fff',
              cursor: 'pointer',
            }}
          >
            Save
          </button>
        </div>
      </div>
    </div>
  );
}
