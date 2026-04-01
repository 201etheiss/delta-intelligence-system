'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface DataActionsProps {
  containerRef: React.RefObject<HTMLDivElement | null>;
  onAction: (prompt: string) => void;
}

interface ActionPopup {
  x: number;
  y: number;
  text: string;
  type: 'number' | 'currency' | 'customer';
}

/**
 * Adds contextual hover actions on data patterns inside rendered chat HTML.
 * Detects: dollar amounts, large numbers, and potential customer/company names.
 */
export default function DataActions({ containerRef, onAction }: DataActionsProps) {
  const [popup, setPopup] = useState<ActionPopup | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleMouseOver = useCallback((e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (!target || target.tagName === 'BUTTON' || target.closest('button')) return;

    const text = target.textContent?.trim() ?? '';
    if (!text || text.length > 60) return;

    // Detect currency amounts like $1,234.56 or $1.2M
    const currencyMatch = text.match(/\$[\d,]+\.?\d*[KMBkmb]?/);
    if (currencyMatch) {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      timeoutRef.current = setTimeout(() => {
        const rect = target.getBoundingClientRect();
        const containerRect = containerRef.current?.getBoundingClientRect();
        if (!containerRect) return;
        setPopup({
          x: rect.left - containerRect.left + rect.width / 2,
          y: rect.top - containerRect.top - 4,
          text: currencyMatch[0],
          type: 'currency',
        });
      }, 400);
      return;
    }

    // Detect standalone numbers (>100)
    const numMatch = text.match(/^[\d,]+\.?\d*%?$/);
    if (numMatch) {
      const num = parseFloat(text.replace(/[,%]/g, ''));
      if (num > 100) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        timeoutRef.current = setTimeout(() => {
          const rect = target.getBoundingClientRect();
          const containerRect = containerRef.current?.getBoundingClientRect();
          if (!containerRect) return;
          setPopup({
            x: rect.left - containerRect.left + rect.width / 2,
            y: rect.top - containerRect.top - 4,
            text: text,
            type: 'number',
          });
        }, 400);
        return;
      }
    }
  }, [containerRef]);

  const handleMouseOut = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    // Delayed hide so user can click the action
    setTimeout(() => setPopup(null), 200);
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('mouseover', handleMouseOver);
    container.addEventListener('mouseout', handleMouseOut);

    return () => {
      container.removeEventListener('mouseover', handleMouseOver);
      container.removeEventListener('mouseout', handleMouseOut);
    };
  }, [containerRef, handleMouseOver, handleMouseOut]);

  if (!popup) return null;

  const actions = (() => {
    switch (popup.type) {
      case 'currency':
        return [
          { label: 'Compare', prompt: `Compare ${popup.text} to historical values and industry benchmarks` },
          { label: 'Trend', prompt: `Show me the trend for this ${popup.text} amount over the past 12 months` },
        ];
      case 'number':
        return [
          { label: 'Trend', prompt: `Show me how ${popup.text} has changed over time` },
          { label: 'Breakdown', prompt: `Break down ${popup.text} by category or segment` },
        ];
      case 'customer':
        return [
          { label: 'View Account', prompt: `Show me full account details for ${popup.text}` },
          { label: 'History', prompt: `Show transaction history for ${popup.text}` },
        ];
    }
  })();

  return (
    <div
      className="absolute z-30 pointer-events-auto"
      style={{ left: popup.x, top: popup.y, transform: 'translate(-50%, -100%)' }}
      onMouseEnter={() => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }}
      onMouseLeave={() => setPopup(null)}
    >
      <div className="flex items-center gap-1 bg-zinc-900 rounded-lg shadow-lg px-1.5 py-1 border border-zinc-700">
        {actions.map((action) => (
          <button
            key={action.label}
            onClick={() => {
              onAction(action.prompt);
              setPopup(null);
            }}
            className="text-[10px] text-zinc-300 hover:text-white hover:bg-zinc-700 px-2 py-0.5 rounded transition-colors whitespace-nowrap"
          >
            {action.label}
          </button>
        ))}
      </div>
      <div className="w-2 h-2 bg-zinc-900 border-r border-b border-zinc-700 rotate-45 mx-auto -mt-1" />
    </div>
  );
}
