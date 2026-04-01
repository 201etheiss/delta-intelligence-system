'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useRef, useEffect } from 'react';

interface TabGroup {
  label: string;
  tabs: Array<{ href: string; label: string }>;
}

const TAB_GROUPS: TabGroup[] = [
  {
    label: 'Finance',
    tabs: [
      { href: '/financial-statements', label: 'Financials' },
      { href: '/journal-entries', label: 'Journal Entries' },
      { href: '/close-tracker', label: 'Close Tracker' },
      { href: '/cash-flow', label: 'Cash Flow' },
      { href: '/budgets', label: 'Budgets' },
      { href: '/reconciliations', label: 'Recon' },
      { href: '/ap/invoices', label: 'AP' },
      { href: '/ar/collections', label: 'AR' },
      { href: '/expenses', label: 'Expenses' },
      { href: '/tax', label: 'Tax' },
      { href: '/commentary', label: 'Commentary' },
      { href: '/otc', label: 'OTC' },
      { href: '/late-posted', label: 'Late-Posted' },
      { href: '/packages', label: 'Packages' },
    ],
  },
  {
    label: 'Operations',
    tabs: [
      { href: '/fleet-map', label: 'Fleet Map' },
      { href: '/fleet', label: 'Fleet' },
      { href: '/inventory', label: 'Margin Analytics' },
      { href: '/assets/fixed', label: 'Fixed Assets' },
      { href: '/contracts', label: 'Contracts' },
    ],
  },
  {
    label: 'Intelligence',
    tabs: [
      { href: '/executive', label: 'Executive' },
      { href: '/market', label: 'Market' },
      { href: '/sales', label: 'Sales' },
      { href: '/customer', label: 'Customer 360' },
      { href: '/analytics', label: 'Analytics' },
      { href: '/reports', label: 'Reports' },
      { href: '/dashboards', label: 'Dashboards' },
    ],
  },
  {
    label: 'Organization',
    tabs: [
      { href: '/people', label: 'People' },
      { href: '/hr', label: 'HR' },
      { href: '/workstreams', label: 'Workstreams' },
      { href: '/integrations', label: 'Integrations' },
    ],
  },
  {
    label: 'Compliance',
    tabs: [
      { href: '/vault', label: 'Evidence Vault' },
      { href: '/audit', label: 'Audit Portal' },
      { href: '/controls', label: 'Controls' },
      { href: '/exceptions', label: 'Exceptions' },
    ],
  },
  {
    label: 'Admin',
    tabs: [
      { href: '/admin/users', label: 'Users' },
      { href: '/admin/integrations', label: 'Integrations' },
      { href: '/admin/audit', label: 'Audit Log' },
      { href: '/admin/event-monitor', label: 'Events' },
      { href: '/admin/ingestion', label: 'Ingestion' },
      { href: '/settings', label: 'Settings' },
      { href: '/platform', label: 'Platform' },
      { href: '/api-docs', label: 'API Docs' },
    ],
  },
  {
    label: 'Equipment',
    tabs: [
      { href: '/equipment-hub', label: 'Equipment Hub' },
    ],
  },
  {
    label: 'Portal',
    tabs: [
      { href: '/portal-hub', label: 'Portal Hub' },
    ],
  },
  {
    label: 'Signal Map',
    tabs: [
      { href: '/signal-map-hub', label: 'Signal Map Hub' },
    ],
  },
];

function isTabActive(href: string, pathname: string): boolean {
  if (href === pathname) return true;
  if (pathname.startsWith(href + '/')) return true;
  return false;
}

function findActiveGroup(pathname: string): TabGroup | null {
  for (const group of TAB_GROUPS) {
    for (const tab of group.tabs) {
      if (isTabActive(tab.href, pathname)) {
        return group;
      }
    }
  }
  return null;
}

interface SubNavTabsProps {
  /** When provided, filter TAB_GROUPS to only show this group's tabs. */
  group?: string;
}

export default function SubNavTabs({ group }: SubNavTabsProps = {}) {
  const pathname = usePathname();
  const scrollRef = useRef<HTMLDivElement>(null);
  const activeTabRef = useRef<HTMLAnchorElement>(null);

  const activeGroup = group
    ? TAB_GROUPS.find((g) => g.label === group) ?? null
    : pathname
      ? findActiveGroup(pathname)
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
        {activeGroup.tabs.map((tab) => {
          const active = pathname ? isTabActive(tab.href, pathname) : false;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              ref={active ? activeTabRef : undefined}
              className={[
                'relative shrink-0 px-3 py-2 text-xs font-medium transition-colors whitespace-nowrap',
                active
                  ? 'text-[#FE5000]'
                  : 'text-[#71717A] hover:text-[#A1A1AA]',
              ].join(' ')}
            >
              {tab.label}
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
