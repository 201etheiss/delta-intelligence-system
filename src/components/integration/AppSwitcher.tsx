'use client';

import { useState, useEffect, useRef } from 'react';
import {
  LayoutGrid,
  ExternalLink,
  Brain,
  ShoppingCart,
  MapPin,
  Radar,
  X,
} from 'lucide-react';
import {
  getAllApps,
  getAllAppHealth,
  type AppInfo,
  type AppHealth,
} from '@/lib/integration/app-registry';
import { getRelatedApps, type RelatedApp } from '@/lib/integration/cross-app-nav';

// Icon mapping keyed by Lucide icon name in app-registry
const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Brain,
  ShoppingCart,
  MapPin,
  Radar,
};

const STATUS_DOTS: Readonly<Record<AppHealth, string>> = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500 animate-pulse',
  down: 'bg-red-500',
  unknown: 'bg-zinc-600',
};

const STATUS_BADGES: Readonly<Record<AppInfo['status'], string>> = {
  live: 'text-emerald-400 bg-emerald-400/10',
  dev: 'text-amber-400 bg-amber-400/10',
  deployed: 'text-blue-400 bg-blue-400/10',
  planned: 'text-zinc-400 bg-zinc-400/10',
};

interface AppSwitcherProps {
  readonly currentApp?: string;
  readonly currentPath?: string;
}

export default function AppSwitcher({
  currentApp = 'delta-intelligence',
  currentPath,
}: AppSwitcherProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [health, setHealth] = useState<Record<string, AppHealth>>({});
  const [related, setRelated] = useState<readonly RelatedApp[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const apps = getAllApps();

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;

    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [isOpen]);

  // Fetch health on open
  useEffect(() => {
    if (!isOpen) return;

    let cancelled = false;

    async function checkHealth() {
      const results = await getAllAppHealth();
      if (!cancelled) {
        setHealth(results);
      }
    }

    checkHealth();
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  // Resolve related apps when path changes
  useEffect(() => {
    if (currentPath) {
      setRelated(getRelatedApps(currentPath));
    } else {
      setRelated([]);
    }
  }, [currentPath]);

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`p-1.5 rounded-md transition-colors ${
          isOpen
            ? 'bg-zinc-700 text-white'
            : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800'
        }`}
        title="Switch between Delta360 apps"
        aria-label="App switcher"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-zinc-900 border border-zinc-700 rounded-lg shadow-2xl z-50 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <span className="text-sm font-medium text-zinc-200">
              Delta360 Platform
            </span>
            <button
              onClick={() => setIsOpen(false)}
              className="text-zinc-500 hover:text-zinc-300"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* App grid — 2x2 */}
          <div className="grid grid-cols-2 gap-px bg-zinc-800 p-px">
            {apps.map((app) => {
              const IconComponent = ICON_MAP[app.icon] ?? Brain;
              const isCurrent = app.id === currentApp;
              const appHealth = health[app.id] ?? 'unknown';

              return (
                <a
                  key={app.id}
                  href={isCurrent ? undefined : app.url}
                  target={isCurrent ? undefined : '_blank'}
                  rel="noopener noreferrer"
                  onClick={isCurrent ? (e) => e.preventDefault() : undefined}
                  className={`flex flex-col gap-2 p-4 transition-colors ${
                    isCurrent
                      ? 'bg-zinc-800/80 cursor-default'
                      : 'bg-zinc-900 hover:bg-zinc-800/60 cursor-pointer'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <IconComponent
                        className={`h-4 w-4 ${
                          isCurrent ? 'text-orange-500' : 'text-zinc-400'
                        }`}
                      />
                      <span
                        className={`inline-block rounded-full h-2 w-2 ${STATUS_DOTS[appHealth]}`}
                      />
                    </div>
                    {!isCurrent && (
                      <ExternalLink className="h-3 w-3 text-zinc-600" />
                    )}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isCurrent ? 'text-orange-400' : 'text-zinc-200'
                        }`}
                      >
                        {app.shortName}
                      </span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_BADGES[app.status]}`}
                      >
                        {app.status}
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-500 mt-0.5 leading-tight">
                      {app.description}
                    </p>
                  </div>
                </a>
              );
            })}
          </div>

          {/* Related pages for current context */}
          {related.length > 0 && (
            <div className="px-4 py-2.5 border-t border-zinc-800">
              <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                Related pages
              </span>
              <div className="mt-1.5 flex flex-col gap-1">
                {related.map((r) => {
                  const Icon = ICON_MAP[r.app.icon] ?? Brain;
                  return (
                    <a
                      key={`${r.app.id}-${r.path}`}
                      href={r.fullUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 text-[11px] text-zinc-400 hover:text-zinc-200 py-0.5 transition-colors"
                    >
                      <Icon className="h-3 w-3 shrink-0" />
                      <span className="truncate">{r.label}</span>
                      <span className="text-zinc-600 ml-auto text-[10px]">
                        {r.app.shortName}
                      </span>
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {/* Footer */}
          <div className="px-4 py-2.5 border-t border-zinc-800 text-[10px] text-zinc-600">
            {apps.length} repos &middot; 201etheiss on GitHub
          </div>
        </div>
      )}
    </div>
  );
}
