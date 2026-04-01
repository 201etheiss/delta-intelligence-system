'use client';

import React from 'react';
import { useDensity } from '@/components/density/DensityProvider';

interface DensityKPIProps {
  label: string;
  value: string;
  delta?: string;
  deltaDirection?: 'up' | 'down' | 'neutral';
}

function getDeltaColor(direction: 'up' | 'down' | 'neutral' | undefined): string {
  if (direction === 'up') return '#22c55e';
  if (direction === 'down') return '#ef4444';
  return '#a1a1aa';
}

function getDeltaArrow(direction: 'up' | 'down' | 'neutral' | undefined): string {
  if (direction === 'up') return '▲';
  if (direction === 'down') return '▼';
  return '—';
}

export function DensityKPI({ label, value, delta, deltaDirection }: DensityKPIProps) {
  const mode = useDensity();

  if (mode === 'executive') {
    return (
      <div
        style={{
          background: '#0f0f11',
          border: '1px solid #27272a',
          borderRadius: '12px',
          padding: '16px',
        }}
      >
        <div
          style={{
            fontSize: '10px',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: '#71717a',
            marginBottom: '8px',
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: '28px',
            fontWeight: 700,
            color: '#ffffff',
            lineHeight: 1,
            marginBottom: delta ? '6px' : 0,
          }}
        >
          {value}
        </div>
        {delta && (
          <div
            style={{
              fontSize: '12px',
              fontWeight: 500,
              color: getDeltaColor(deltaDirection),
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            <span>{getDeltaArrow(deltaDirection)}</span>
            <span>{delta}</span>
          </div>
        )}
      </div>
    );
  }

  // Operator mode — compact inline cell
  return (
    <div
      style={{
        padding: '6px 8px',
        textAlign: 'center',
        display: 'inline-block',
      }}
    >
      <div
        style={{
          fontSize: '9px',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: '#71717a',
          marginBottom: '2px',
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: '14px',
          fontWeight: 700,
          fontFamily: 'monospace',
          color: '#ffffff',
          lineHeight: 1,
        }}
      >
        {value}
      </div>
      {delta && (
        <div
          style={{
            fontSize: '10px',
            fontWeight: 500,
            color: getDeltaColor(deltaDirection),
            marginTop: '2px',
          }}
        >
          {getDeltaArrow(deltaDirection)} {delta}
        </div>
      )}
    </div>
  );
}
