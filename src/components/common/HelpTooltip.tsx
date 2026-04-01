'use client';

import { useState, useRef, useEffect } from 'react';

interface HelpTooltipProps {
  text: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
}

export default function HelpTooltip({ text, position = 'top' }: HelpTooltipProps) {
  const [visible, setVisible] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!visible) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setVisible(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [visible]);

  const positionClasses: Record<string, string> = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <span className="relative inline-flex items-center">
      <button
        ref={triggerRef}
        type="button"
        onMouseEnter={() => setVisible(true)}
        onMouseLeave={() => setVisible(false)}
        onFocus={() => setVisible(true)}
        onBlur={() => setVisible(false)}
        className="inline-flex items-center justify-center w-4 h-4 rounded-full border border-[#3F3F46] text-[#71717A] hover:text-[#A1A1AA] hover:border-[#52525B] transition-colors text-[9px] font-bold leading-none cursor-help"
        aria-label="Help"
      >
        ?
      </button>
      {visible && (
        <div
          ref={tooltipRef}
          role="tooltip"
          className={`absolute z-50 ${positionClasses[position]} pointer-events-none`}
        >
          <div className="bg-[#18181B] border border-[#3F3F46] text-[#E4E4E7] text-[11px] leading-relaxed rounded-lg px-3 py-2 shadow-lg max-w-56 whitespace-normal">
            {text}
          </div>
        </div>
      )}
    </span>
  );
}
