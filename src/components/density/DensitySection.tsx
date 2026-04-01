'use client';

import React from 'react';
import { useDensity } from '@/components/density/DensityProvider';

interface DensitySectionProps {
  title: string;
  children: React.ReactNode;
}

export function DensitySection({ title, children }: DensitySectionProps) {
  const mode = useDensity();

  if (mode === 'executive') {
    return (
      <div
        style={{
          background: '#18181b',
          border: '1px solid #27272a',
          borderRadius: '8px',
          padding: '20px',
        }}
      >
        <div
          style={{
            fontSize: '13px',
            fontWeight: 600,
            color: '#e4e4e7',
            marginBottom: '16px',
            letterSpacing: '0.02em',
          }}
        >
          {title}
        </div>
        {children}
      </div>
    );
  }

  // Operator mode — section header row + children below
  return (
    <div>
      <div
        style={{
          background: '#0f0f11',
          width: '100%',
          padding: '6px 8px',
          fontSize: '10px',
          fontWeight: 700,
          color: '#a1a1aa',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          borderBottom: '1px solid #27272a',
          borderTop: '1px solid #27272a',
        }}
      >
        {title}
      </div>
      <div>{children}</div>
    </div>
  );
}
