'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useEffect } from 'react';
import { ALL_MODULES, findModuleForPath } from '@/lib/shell/module-registry';
import type { ModuleGroup } from '@/lib/shell/module-registry';

function isTabActive(href: string, pathname: string): boolean {
  // Skip dynamic-segment hrefs (e.g. /dashboards/[id]) for active checks
  if (href.includes('[')) return false;
  if (href === pathname) return true;
  if (pathname.startsWith(href + '/')) return true;
  return false;
}

interface SubNavTabsProps {
  /** When provided, filter to only show this module group's tabs (by label or id). */
  group?: string;
}

export default function SubNavTabs({ group }: SubNavTabsProps = {}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  // Resolve active module group from the registry (single source of truth)
  const activeGroup: ModuleGroup | null = group
    ? ALL_MODULES.find((g) => g.label === group || g.id === group) ?? null
    : pathname
      ? findModuleForPath(pathname) ?? null
      : null;

  // Scroll active tab into view on mount/change
  useEffect(() => {
    if (activeTabRef.current && scrollRef.current) {
      const container = scrollRef.current;
      const tab = activeTabRef.current;
      const containerRect = container.getBoundingClientRect();
      const tabRect = tab.getBoundingClientRect();
      if (tabRect.left < containerRect.left || tabRect.right > containerRect.right) {
        tab.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      }
    }
  }, [pathname]);

  if (!activeGroup) return null;

  return (
    <div className="border-b border-[#27272A] bg-[#09090B]">
      <div
        ref={scrollRef}
        className="flex items-center gap-0.5 px-6 overflow-x-auto scrollbar-hide"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {activeGroup.pages
          .filter((page) => !page.href.includes('['))
          .map((page) => {
            const active = pathname ? isTabActive(page.href, pathname) : false;
            return (
              <Link
                key={page.href}
                href={page.href}
                ref={active ? activeTabRef : undefined}
                className={[
                  'relative shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                  active
                    ? 'text-[#FE5000]'
                    : 'text-[#71717A] hover:text-[#A1A1AA]',
                ].join(' ')}
              >
                {page.label}
                {active && (
                  <span className="absolute bottom-0 left-1 right-1 h-[2px] bg-[#FE5000] rounded-t" />
                )}
              </Link>
            );
          })}
      </div>
    </div>
  );
}
