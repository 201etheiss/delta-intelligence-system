'use client';

/**
 * Amber banner shown when data comes from a mock/cached source
 * because the gateway is offline or unreachable.
 */
export function MockDataBanner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 mb-3 rounded-md bg-amber-900/20 border border-amber-700/30 text-amber-400 text-xs">
      <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 15.75h.007v.008H12v-.008z" />
      </svg>
      <span>
        {label ?? 'Gateway offline \u2014 showing cached data.'}{' '}
        <button className="underline hover:text-amber-300" onClick={() => window.location.reload()}>
          Retry
        </button>
      </span>
    </div>
  );
}
