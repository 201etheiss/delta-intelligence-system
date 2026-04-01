'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';

interface PaletteItem {
  id: string;
  label: string;
  category: 'recent' | 'action' | 'core' | 'finance' | 'operations' | 'intelligence' | 'organization' | 'compliance' | 'admin' | 'more' | 'workspace' | 'conversation' | 'glossary';
  description?: string;
  href?: string;
  action?: () => void;
  shortcut?: string;
}

// All 55+ pages grouped by domain
const ALL_PAGES: PaletteItem[] = [
  // Core
  { id: 'p-dash', label: 'Dashboard', category: 'core', description: 'Command center', href: '/', shortcut: '' },
  { id: 'p-chat', label: 'Chat', category: 'core', description: 'AI assistant', href: '/chat', shortcut: '\u2318K' },
  { id: 'p-cockpit', label: 'Controller Cockpit', category: 'core', description: 'Financial control center', href: '/cockpit' },
  { id: 'p-digest', label: 'Daily Briefing', category: 'core', description: 'Today\'s summary', href: '/digest' },
  { id: 'p-search', label: 'Search', category: 'core', description: 'Search conversations', href: '/search' },

  // Finance
  { id: 'p-financials', label: 'Financial Statements', category: 'finance', description: 'P&L, Balance Sheet, Cash Flow', href: '/financial-statements' },
  { id: 'p-je', label: 'Journal Entries', category: 'finance', description: 'Create and review JEs', href: '/journal-entries' },
  { id: 'p-close', label: 'Close Tracker', category: 'finance', description: 'Month-end close progress', href: '/close-tracker' },
  { id: 'p-cashflow', label: 'Cash Flow', category: 'finance', description: 'Cash flow analysis', href: '/cash-flow' },
  { id: 'p-budgets', label: 'Budgets', category: 'finance', description: 'Budget vs actuals', href: '/budgets' },
  { id: 'p-recon', label: 'Reconciliations', category: 'finance', description: 'Account reconciliations', href: '/reconciliations' },
  { id: 'p-ap', label: 'AP Invoices', category: 'finance', description: 'Accounts payable', href: '/ap/invoices' },
  { id: 'p-ar', label: 'AR Collections', category: 'finance', description: 'Accounts receivable', href: '/ar/collections' },
  { id: 'p-tax', label: 'Tax', category: 'finance', description: 'Tax compliance', href: '/tax' },
  { id: 'p-commentary', label: 'Commentary', category: 'finance', description: 'Financial commentary', href: '/commentary' },
  { id: 'p-expenses', label: 'Expenses', category: 'finance', description: 'Expense tracking', href: '/expenses' },
  { id: 'p-otc', label: 'Order to Cash', category: 'finance', description: 'OTC pipeline', href: '/otc' },
  { id: 'p-lateposted', label: 'Late-Posted Queue', category: 'finance', description: 'Late-posted entries', href: '/late-posted' },
  { id: 'p-packages', label: 'Packages', category: 'finance', description: 'Report packages', href: '/packages' },

  // Operations
  { id: 'p-fleetmap', label: 'Fleet Map', category: 'operations', description: 'Vehicle locations', href: '/fleet-map' },
  { id: 'p-fleet', label: 'Fleet', category: 'operations', description: 'Fleet management', href: '/fleet' },
  { id: 'p-inventory', label: 'Margin Analytics', category: 'operations', description: 'Inventory and margins', href: '/inventory' },
  { id: 'p-assets', label: 'Fixed Assets', category: 'operations', description: 'Asset register', href: '/assets/fixed' },
  { id: 'p-contracts', label: 'Contracts', category: 'operations', description: 'Contract management', href: '/contracts' },

  // Intelligence
  { id: 'p-executive', label: 'Executive Snapshot', category: 'intelligence', description: 'Executive dashboard', href: '/executive' },
  { id: 'p-market', label: 'Market', category: 'intelligence', description: 'Market intelligence', href: '/market' },
  { id: 'p-sales', label: 'Sales', category: 'intelligence', description: 'Sales performance', href: '/sales' },
  { id: 'p-customer360', label: 'Customer 360', category: 'intelligence', description: 'Full customer profile', href: '/customer' },
  { id: 'p-analytics', label: 'Analytics', category: 'intelligence', description: 'Usage analytics', href: '/analytics' },
  { id: 'p-reports', label: 'Reports', category: 'intelligence', description: 'Generated reports', href: '/reports' },
  { id: 'p-dashboards', label: 'Dashboards', category: 'intelligence', description: 'Custom dashboards', href: '/dashboards' },

  // Organization
  { id: 'p-people', label: 'People', category: 'organization', description: 'People directory', href: '/people' },
  { id: 'p-hr', label: 'HR', category: 'organization', description: 'Human resources', href: '/hr' },
  { id: 'p-workstreams', label: 'Workstreams', category: 'organization', description: 'Active workstreams', href: '/workstreams' },
  { id: 'p-integrations', label: 'Integrations', category: 'organization', description: 'Connected services', href: '/integrations' },

  // Compliance
  { id: 'p-vault', label: 'Evidence Vault', category: 'compliance', description: 'Audit evidence', href: '/vault' },
  { id: 'p-audit', label: 'Audit Portal', category: 'compliance', description: 'Audit management', href: '/audit' },
  { id: 'p-controls', label: 'Controls', category: 'compliance', description: 'Internal controls', href: '/controls' },
  { id: 'p-exceptions', label: 'Exceptions', category: 'compliance', description: 'Policy exceptions', href: '/exceptions' },

  // Admin
  { id: 'p-admin-users', label: 'Admin Users', category: 'admin', description: 'User management', href: '/admin/users' },
  { id: 'p-admin-integrations', label: 'Admin Integrations', category: 'admin', description: 'Integration settings', href: '/admin/integrations' },
  { id: 'p-admin-audit', label: 'Audit Log', category: 'admin', description: 'System audit trail', href: '/admin/audit' },
  { id: 'p-settings', label: 'Settings', category: 'admin', description: 'Account settings', href: '/settings' },
  { id: 'p-platform', label: 'Platform Hub', category: 'admin', description: 'Platform management', href: '/platform' },
  { id: 'p-apidocs', label: 'API Docs', category: 'admin', description: 'API documentation', href: '/api-docs' },
  { id: 'p-automations', label: 'Automations', category: 'admin', description: 'Workflow automation', href: '/automations' },
  { id: 'p-shared', label: 'Shared', category: 'admin', description: 'Shared resources', href: '/shared' },

  // More
  { id: 'p-assistant', label: 'Assistant', category: 'more', description: 'Guided assistant', href: '/assistant' },
  { id: 'p-workspaces', label: 'Workspaces', category: 'more', description: 'Domain-specific assistants', href: '/workspaces' },
  { id: 'p-brief', label: 'Intelligence Brief', category: 'more', description: 'Strategic briefing', href: '/brief' },
  { id: 'p-history', label: 'History', category: 'more', description: 'Chat history', href: '/history' },
  { id: 'p-documents', label: 'Documents', category: 'more', description: 'Uploaded documents', href: '/documents' },
  { id: 'p-sources', label: 'Data Sources', category: 'more', description: 'Connected data', href: '/sources' },
  { id: 'p-glossary-page', label: 'Glossary', category: 'more', description: 'Term definitions', href: '/glossary' },
  { id: 'p-onboarding', label: 'Onboarding', category: 'more', description: 'Setup wizard', href: '/onboarding' },
];

const ACTIONS: PaletteItem[] = [
  { id: 'a-new-chat', label: 'New Chat', category: 'action', description: 'Start a fresh conversation', shortcut: '\u2318N' },
  { id: 'a-dark', label: 'Toggle Dark Mode', category: 'action', description: 'Switch theme', shortcut: '\u2318/' },
];

const CATEGORY_LABELS: Record<string, string> = {
  recent: 'Recent',
  action: 'Actions',
  core: 'Core',
  finance: 'Finance',
  operations: 'Operations',
  intelligence: 'Intelligence',
  organization: 'Organization',
  compliance: 'Compliance',
  admin: 'Admin',
  more: 'More',
  workspace: 'Workspaces',
  conversation: 'Conversations',
  glossary: 'Glossary',
};

// Category display order
const CATEGORY_ORDER = [
  'recent', 'action', 'core', 'finance', 'operations', 'intelligence',
  'organization', 'compliance', 'admin', 'more', 'conversation', 'glossary',
];

// ---------------------------------------------------------------------------
// Recent pages — localStorage
// ---------------------------------------------------------------------------

const RECENT_KEY = 'di_recent_pages';
const MAX_RECENT = 5;

function loadRecent(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function recordPageVisit(href: string): void {
  if (typeof window === 'undefined') return;
  try {
    const current = loadRecent();
    const updated = [href, ...current.filter((h) => h !== href)].slice(0, MAX_RECENT);
    localStorage.setItem(RECENT_KEY, JSON.stringify(updated));
  } catch {
    // silent
  }
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export default function CommandPalette({ open, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [glossaryItems, setGlossaryItems] = useState<PaletteItem[]>([]);
  const [conversationItems, setConversationItems] = useState<PaletteItem[]>([]);
  const [loadingData, setLoadingData] = useState(false);
  const [recentHrefs, setRecentHrefs] = useState<string[]>([]);

  // Record current page visit when palette opens
  useEffect(() => {
    if (open) {
      setRecentHrefs(loadRecent());
    }
  }, [open]);

  // Load glossary and conversations on open
  useEffect(() => {
    if (!open) return;

    setLoadingData(true);

    fetch('/api/glossary')
      .then((r) => r.json())
      .then((data: { entries?: Array<{ id: string; term: string; definition: string }> }) => {
        if (data.entries) {
          setGlossaryItems(
            data.entries.slice(0, 50).map((e) => ({
              id: `g-${e.id}`,
              label: e.term,
              category: 'glossary' as const,
              description: e.definition.slice(0, 80),
              href: '/glossary',
            }))
          );
        }
      })
      .catch(() => {})
      .finally(() => setLoadingData(false));

    try {
      const raw = localStorage.getItem('di_conversations');
      if (raw) {
        const convos = JSON.parse(raw) as Array<{
          id: string;
          messages: Array<{ role: string; content: string }>;
          updatedAt: string;
        }>;
        setConversationItems(
          convos.slice(0, 10).map((c) => {
            const firstUser = c.messages.find((m) => m.role === 'user');
            return {
              id: `c-${c.id}`,
              label: firstUser?.content.slice(0, 60) ?? 'Untitled',
              category: 'conversation' as const,
              href: `/chat?id=${c.id}`,
            };
          })
        );
      }
    } catch {
      // silent
    }
  }, [open]);

  // Focus input on open
  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  // Build recent items
  const recentItems: PaletteItem[] = recentHrefs.reduce<PaletteItem[]>((acc, href) => {
    const page = ALL_PAGES.find((p) => p.href === href);
    if (page) {
      acc.push({ ...page, id: `recent-${page.id}`, category: 'recent' });
    }
    return acc;
  }, []);

  // Build filtered results
  const allItems: PaletteItem[] = [
    ...recentItems,
    ...ACTIONS,
    ...ALL_PAGES,
    ...conversationItems,
    ...glossaryItems,
  ];

  const filtered = query.trim()
    ? allItems.filter((item) => {
        // Exclude recent items from search results (they'll show as their actual category)
        if (item.id.startsWith('recent-')) return false;
        const q = query.toLowerCase();
        return (
          item.label.toLowerCase().includes(q) ||
          (item.description?.toLowerCase().includes(q) ?? false) ||
          item.category.toLowerCase().includes(q)
        );
      })
    : [
        ...recentItems,
        ...ACTIONS,
        ...ALL_PAGES.slice(0, 8), // Show first 8 pages when no query
      ];

  // Group by category in display order
  const grouped: Array<[string, PaletteItem[]]> = [];
  const seen = new Set<string>();
  for (const cat of CATEGORY_ORDER) {
    const items = filtered.filter((item) => item.category === cat);
    if (items.length > 0) {
      grouped.push([cat, items]);
      for (const item of items) seen.add(item.id);
    }
  }
  // Any remaining categories not in order
  const remaining = filtered.filter((item) => !seen.has(item.id));
  if (remaining.length > 0) {
    const byCategory: Record<string, PaletteItem[]> = {};
    for (const item of remaining) {
      if (!byCategory[item.category]) byCategory[item.category] = [];
      byCategory[item.category].push(item);
    }
    for (const [cat, items] of Object.entries(byCategory)) {
      grouped.push([cat, items]);
    }
  }

  // Flat list for arrow navigation
  const flatItems = grouped.flatMap(([, items]) => items);

  const handleSelect = useCallback((item: PaletteItem) => {
    onClose();
    if (item.action) {
      item.action();
      return;
    }
    if (item.id === 'a-new-chat') {
      localStorage.removeItem('di_active_conversation');
      router.push('/chat');
      return;
    }
    if (item.id === 'a-dark') {
      document.documentElement.classList.toggle('dark');
      return;
    }
    if (item.href) {
      recordPageVisit(item.href);
      router.push(item.href);
    }
  }, [onClose, router]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = flatItems[selectedIndex];
      if (item) handleSelect(item);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  }, [flatItems, selectedIndex, handleSelect, onClose]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-index="${selectedIndex}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  if (!open) return null;

  let flatIndex = -1;

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="fixed z-50 top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <div className="bg-[#18181B] border border-[#27272A] rounded-xl shadow-2xl overflow-hidden">
          {/* Search input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[#27272A]">
            <svg className="w-4 h-4 text-[#52525B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="11" cy="11" r="8" />
              <path strokeLinecap="round" d="M21 21l-4.35-4.35" />
            </svg>
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search pages, actions, conversations..."
              className="flex-1 bg-transparent text-sm text-white placeholder-[#52525B] outline-none"
            />
            <kbd className="text-[9px] font-mono text-[#52525B] bg-[#27272A] border border-[#3F3F46] rounded px-1.5 py-0.5">
              esc
            </kbd>
          </div>

          {/* Results */}
          <div ref={listRef} className="max-h-96 overflow-y-auto py-2">
            {loadingData && flatItems.length <= ALL_PAGES.length + ACTIONS.length + recentItems.length ? (
              <div className="px-4 py-6 text-center">
                <div className="inline-flex items-center gap-2 text-xs text-[#52525B]">
                  <svg className="animate-spin h-3.5 w-3.5 text-[#FF5C00]" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Loading...
                </div>
              </div>
            ) : flatItems.length === 0 ? (
              <div className="px-4 py-8 text-center text-xs text-[#52525B]">
                No results for &ldquo;{query}&rdquo;
              </div>
            ) : (
              grouped.map(([category, items]) => (
                <div key={category}>
                  <p className="px-4 py-1.5 text-[9px] font-semibold text-[#52525B] uppercase tracking-widest">
                    {CATEGORY_LABELS[category] ?? category}
                  </p>
                  {items.map((item) => {
                    flatIndex++;
                    const idx = flatIndex;
                    const isSelected = idx === selectedIndex;
                    return (
                      <button
                        key={item.id}
                        data-index={idx}
                        onClick={() => handleSelect(item)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        className={`w-full flex items-center gap-3 px-4 py-2 text-left transition-colors ${
                          isSelected ? 'bg-[#FF5C00]/10 text-white' : 'text-[#A1A1AA] hover:bg-[#27272A]'
                        }`}
                      >
                        <span className="text-sm flex-1 truncate">{item.label}</span>
                        {item.description && (
                          <span className="text-[10px] text-[#52525B] truncate max-w-40">
                            {item.description}
                          </span>
                        )}
                        {item.shortcut && (
                          <kbd className="text-[9px] font-mono text-[#52525B] bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0.5 shrink-0">
                            {item.shortcut}
                          </kbd>
                        )}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[#27272A] text-[9px] text-[#52525B]">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0.5 font-mono">&#8593;&#8595;</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className="bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0.5 font-mono">&#8629;</kbd> select
              </span>
            </div>
            <span>{flatItems.length} result{flatItems.length !== 1 ? 's' : ''}</span>
          </div>
        </div>
      </div>
    </>
  );
}
