'use client';

import React, { useState } from 'react';
import { useDensity } from '@/components/density/DensityProvider';

interface DensityInsightProps {
  text: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function DensityInsight({ text, actionLabel, onAction }: DensityInsightProps) {
  const mode = useDensity();
  const [tooltipVisible, setTooltipVisible] = useState(false);

  if (mode === 'executive') {
    return (
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(254,80,0,0.07) 0%, rgba(254,80,0,0.03) 100%)',
          border: '1px solid transparent',
          backgroundClip: 'padding-box',
          backgroundOrigin: 'border-box',
          borderRadius: '8px',
          padding: '12px 16px',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '10px',
          boxShadow: 'inset 0 0 0 1px rgba(254,80,0,0.25)',
          position: 'relative',
        }}
      >
        <div
          style={{
            fontSize: '16px',
            flexShrink: 0,
            lineHeight: 1,
            marginTop: '1px',
          }}
          aria-hidden="true"
        >
          💡
        </div>
        <div style={{ flex: 1, fontSize: '13px', color: '#d4d4d8', lineHeight: 1.5 }}>
          {text}
        </div>
        {actionLabel && onAction && (
          <button
            onClick={onAction}
            style={{
              flexShrink: 0,
              background: 'rgba(254, 80, 0, 0.15)',
              border: '1px solid rgba(254, 80, 0, 0.3)',
              borderRadius: '6px',
              color: '#fe5000',
              fontSize: '11px',
              fontWeight: 600,
              padding: '4px 10px',
              cursor: 'pointer',
              letterSpacing: '0.04em',
            }}
          >
            {actionLabel}
          </button>
        )}
      </div>
    );
  }

  // Operator mode — dot with tooltip on hover
  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#fe5000',
          cursor: 'default',
          flexShrink: 0,
        }}
        aria-label={text}
        role="img"
      />
      {tooltipVisible && (
        <div
          style={{
            position: 'absolute',
            bottom: '14px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#18181b',
            border: '1px solid #27272a',
            borderRadius: '6px',
            padding: '6px 10px',
            fontSize: '11px',
            color: '#d4d4d8',
            maxWidth: '240px',
            whiteSpace: 'normal',
            zIndex: 50,
            boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
            lineHeight: 1.4,
            pointerEvents: 'none',
          }}
        >
          {text}
        </div>
      )}
    </div>
  );
}
