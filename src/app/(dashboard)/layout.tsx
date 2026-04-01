'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  LayoutDashboard, MessageSquare, FileText, History, Database, FileBarChart,
  Plus, LogOut, Settings, Search, Briefcase, PanelLeft, Zap, Plug, Bot,
  BookOpen, Share2, Bell, UserCog, BarChart3, Code, MapPin, Sunrise,
  ChevronDown, ChevronRight, Users, FileSearch, Gauge, Globe, FileSpreadsheet,
  Receipt, DollarSign, Shield, ClipboardList, CreditCard, ScrollText,
  MessageCircle, Clock, AlertOctagon, CheckSquare, Network, Layers,
  TrendingUp, Truck, Target, Star,
} from 'lucide-react';
import { useSession, signOut } from 'next-auth/react';
import AuthProvider from '@/components/auth/AuthProvider';
import dynamic from 'next/dynamic';
const CommandPalette = dynamic(() => import('@/components/common/CommandPalette'), { ssr: false });
import LoadingBar from '@/components/common/LoadingBar';
import Breadcrumbs from '@/components/common/Breadcrumbs';
import SubNavTabs from '@/components/common/SubNavTabs';
import type { WhiteLabelConfig } from '@/lib/white-label';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface NavItem {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  adminOnly?: boolean;
}

interface NavGroup {
  key: string;
  label: string;
  items: NavItem[];
  adminOnly?: boolean;
  defaultCollapsed?: boolean;
}

// ---------------------------------------------------------------------------
// Navigation Structure — 7 collapsible groups + Core (always visible)
// ---------------------------------------------------------------------------

const NAV_GROUPS: NavGroup[] = [
  {
    key: 'core',
    label: 'Core',
    items: [
      { href: '/', label: 'Dashboard', icon: LayoutDashboard },
      { href: '/chat', label: 'Chat', icon: MessageSquare },
      { href: '/cockpit', label: 'Controller Cockpit', icon: Gauge },
      { href: '/digest', label: 'Daily Briefing', icon: Sunrise },
      { href: '/search', label: 'Search', icon: Search },
    ],
  },
  {
    key: 'finance',
    label: 'Finance',
    defaultCollapsed: true,
    items: [
      { href: '/financial-statements', label: 'Financials', icon: FileSpreadsheet },
      { href: '/journal-entries', label: 'Journal Entries', icon: FileText },
      { href: '/close-tracker', label: 'Close Tracker', icon: ClipboardList },
      { href: '/cash-flow', label: 'Cash Flow', icon: CreditCard },
      { href: '/budgets', label: 'Budgets', icon: DollarSign },
      { href: '/reconciliations', label: 'Reconciliations', icon: FileSearch },
      { href: '/ap/invoices', label: 'AP Invoices', icon: Receipt },
      { href: '/ar/collections', label: 'AR Collections', icon: Receipt },
      { href: '/tax', label: 'Tax', icon: DollarSign, adminOnly: true },
      { href: '/commentary', label: 'Commentary', icon: MessageCircle },
      { href: '/expenses', label: 'Expenses', icon: CreditCard },
      { href: '/otc', label: 'Order to Cash', icon: FileBarChart },
      { href: '/late-posted', label: 'Late-Posted Queue', icon: Clock, adminOnly: true },
      { href: '/packages', label: 'Packages', icon: FileSpreadsheet },
    ],
  },
  {
    key: 'operations',
    label: 'Operations',
    defaultCollapsed: true,
    items: [
      { href: '/fleet-map', label: 'Fleet Map', icon: MapPin },
      { href: '/fleet', label: 'Fleet', icon: Truck },
      { href: '/inventory', label: 'Margin Analytics', icon: DollarSign },
      { href: '/assets/fixed', label: 'Fixed Assets', icon: ClipboardList },
      { href: '/contracts', label: 'Contracts', icon: ScrollText },
    ],
  },
  {
    key: 'intelligence',
    label: 'Intelligence',
    defaultCollapsed: true,
    items: [
      { href: '/executive', label: 'Executive Snapshot', icon: BarChart3 },
      { href: '/market', label: 'Market', icon: TrendingUp },
      { href: '/sales', label: 'Sales', icon: Target },
      { href: '/customer', label: 'Customer 360', icon: Users },
      { href: '/analytics', label: 'Analytics', icon: BarChart3, adminOnly: true },
      { href: '/reports', label: 'Reports', icon: FileBarChart },
      { href: '/dashboards', label: 'Dashboards', icon: PanelLeft, adminOnly: true },
    ],
  },
  {
    key: 'organization',
    label: 'Organization',
    defaultCollapsed: true,
    items: [
      { href: '/people', label: 'People', icon: Users },
      { href: '/hr', label: 'HR', icon: Users },
      { href: '/workstreams', label: 'Workstreams', icon: Layers },
      { href: '/integrations', label: 'Integrations', icon: Network },
    ],
  },
  {
    key: 'compliance',
    label: 'Compliance',
    defaultCollapsed: true,
    adminOnly: true,
    items: [
      { href: '/vault', label: 'Evidence Vault', icon: Shield },
      { href: '/audit', label: 'Audit Portal', icon: ClipboardList },
      { href: '/controls', label: 'Controls', icon: CheckSquare },
      { href: '/exceptions', label: 'Exceptions', icon: AlertOctagon },
    ],
  },
  {
    key: 'admin',
    label: 'Admin',
    defaultCollapsed: true,
    adminOnly: true,
    items: [
      { href: '/admin/users', label: 'Users', icon: UserCog },
      { href: '/admin/integrations', label: 'Admin Integrations', icon: Plug },
      { href: '/admin/audit', label: 'Audit Log', icon: FileSearch },
      { href: '/settings', label: 'Settings', icon: Settings },
      { href: '/platform', label: 'Platform Hub', icon: Globe },
      { href: '/api-docs', label: 'API Docs', icon: Code },
      { href: '/automations', label: 'Automations', icon: Zap },
      { href: '/shared', label: 'Shared', icon: Share2 },
    ],
  },
];

// Items that don't belong in a domain group — accessible via "More" toggle
const EXTRA_ITEMS: NavItem[] = [
  { href: '/assistant', label: 'Assistant', icon: Bot },
  { href: '/workspaces', label: 'Workspaces', icon: Briefcase },
  { href: '/brief', label: 'Intelligence Brief', icon: FileText },
  { href: '/history', label: 'History', icon: History },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/sources', label: 'Data Sources', icon: Database },
  { href: '/glossary', label: 'Glossary', icon: BookOpen },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isActive(href: string, pathname: string | null): boolean {
  if (!pathname) return false;
  if (href === '/' && pathname === '/') return true;
  if (href === '/') return false;
  return (
    pathname === href ||
    pathname.startsWith(href + '/') ||
    (href === '/admin/users' &&
      pathname.startsWith('/admin') &&
      !pathname.startsWith('/admin/integrations') &&
      !pathname.startsWith('/admin/audit'))
  );
}

function groupContainsActive(items: NavItem[], pathname: string | null): boolean {
  if (!pathname) return false;
  return items.some((item) => isActive(item.href, pathname));
}

// ---------------------------------------------------------------------------
// Favorites — localStorage helpers
// ---------------------------------------------------------------------------

const FAVORITES_KEY = 'di_nav_favorites';
const MAX_FAVORITES = 8;

function loadFavorites(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveFavorites(favs: string[]): void {
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
}

// ---------------------------------------------------------------------------
// Collapse state — localStorage helpers
// ---------------------------------------------------------------------------

const COLLAPSE_PREFIX = 'di_nav_collapse_';

function loadCollapsed(key: string, fallback: boolean): boolean {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(COLLAPSE_PREFIX + key);
    if (raw === null) return fallback;
    return raw === 'true';
  } catch {
    return fallback;
  }
}

function saveCollapsed(key: string, val: boolean): void {
  localStorage.setItem(COLLAPSE_PREFIX + key, String(val));
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function HeaderClock() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const update = () => {
      setTime(
        new Date().toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      );
    };
    update();
    const interval = setInterval(update, 10_000);
    return () => clearInterval(interval);
  }, []);

  if (!time) return null;

  return (
    <span className="text-xs text-[#71717A] tabular-nums font-mono">
      {time}
    </span>
  );
}

function HeaderSearch({ onOpenPalette }: { onOpenPalette: () => void }) {
  return (
    <button
      onClick={onOpenPalette}
      className="flex items-center gap-1.5 bg-[#18181B] border border-[#27272A] rounded-lg px-2.5 py-1.5 hover:border-[#FF5C00]/50 transition-colors"
    >
      <Search size={14} className="text-[#52525B] shrink-0" />
      <span className="text-xs text-[#52525B] w-28 md:w-36 text-left">Search...</span>
      <kbd className="text-[9px] font-mono text-[#52525B] bg-[#27272A] border border-[#3F3F46] rounded px-1 py-0.5 ml-1">
        &#8984;P
      </kbd>
    </button>
  );
}

interface NotifItem {
  id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);

  const fetchNotifs = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications');
      const data = await res.json();
      if (data.notifications) {
        setNotifications(data.notifications.slice(0, 10));
        setUnread(data.unreadCount ?? 0);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    const timer = setTimeout(fetchNotifs, 2_000);
    const interval = setInterval(fetchNotifs, 30_000);
    return () => { clearTimeout(timer); clearInterval(interval); };
  }, [fetchNotifs]);

  const markRead = async (id: string) => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnread((prev) => Math.max(0, prev - 1));
  };

  const markAllRead = async () => {
    await fetch('/api/notifications', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    });
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnread(0);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative text-[#71717A] hover:text-white transition-colors"
      >
        <Bell size={18} />
        {unread > 0 && (
          <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 flex items-center justify-center rounded-full bg-red-500 text-white text-[9px] font-bold px-1">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-8 z-50 w-80 bg-[#18181B] border border-[#27272A] rounded-lg shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#27272A]">
              <span className="text-xs font-semibold text-white">Notifications</span>
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] text-[#FF5C00] hover:underline"
                >
                  Mark all read
                </button>
              )}
            </div>
            <div className="max-h-72 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-zinc-600">
                  No notifications
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    className={`px-4 py-2.5 border-b border-[#27272A] hover:bg-[#27272A]/50 cursor-pointer ${
                      !n.read ? 'bg-[#FF5C00]/5' : ''
                    }`}
                    onClick={() => {
                      if (!n.read) markRead(n.id);
                      if (n.actionUrl) window.location.href = n.actionUrl;
                    }}
                  >
                    <div className="flex items-start gap-2">
                      {!n.read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00] mt-1.5 shrink-0" />
                      )}
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium text-white truncate">{n.title}</div>
                        <div className="text-[10px] text-zinc-500 line-clamp-2">{n.body}</div>
                        <div className="text-[9px] text-zinc-600 mt-0.5">
                          {new Date(n.createdAt).toLocaleDateString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// NavLink with optional favorite star
// ---------------------------------------------------------------------------

function NavLink({
  href,
  label,
  icon: Icon,
  pathname,
  isFavorite,
  onToggleFavorite,
}: {
  href: string;
  label: string;
  icon: typeof LayoutDashboard;
  pathname: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: (href: string) => void;
}) {
  const active = isActive(href, pathname);
  return (
    <div className="group relative flex items-center">
      <Link
        href={href}
        className={[
          'relative flex items-center gap-3 rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex-1 min-w-0',
          active
            ? 'bg-[#FF5C00]/10 text-[#FF5C00]'
            : 'text-[#A1A1AA] hover:bg-[#18181B] hover:text-white',
        ].join(' ')}
      >
        {active && (
          <span className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-4 rounded-r bg-[#FF5C00]" />
        )}
        <Icon size={16} className="shrink-0" />
        <span className="hidden md:block truncate">{label}</span>
        {label === 'Chat' && (
          <kbd className="hidden md:inline-flex ml-auto text-[9px] text-[#52525B] bg-[#18181B] border border-[#27272A] rounded px-1 py-0.5 font-mono">
            &#8984;K
          </kbd>
        )}
      </Link>
      {onToggleFavorite && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite(href);
          }}
          className={[
            'hidden md:flex items-center justify-center w-5 h-5 shrink-0 mr-1 rounded transition-all',
            isFavorite
              ? 'text-[#FF5C00] opacity-100'
              : 'text-[#52525B] opacity-0 group-hover:opacity-100 hover:text-[#A1A1AA]',
          ].join(' ')}
          title={isFavorite ? 'Remove from favorites' : 'Add to favorites'}
        >
          <Star size={12} fill={isFavorite ? '#FF5C00' : 'none'} />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Collapsible nav group
// ---------------------------------------------------------------------------

function CollapsibleGroup({
  group,
  pathname,
  isAdmin,
  collapsed,
  onToggle,
  favorites,
  onToggleFavorite,
}: {
  group: NavGroup;
  pathname: string | null;
  isAdmin: boolean;
  collapsed: boolean;
  onToggle: () => void;
  favorites: string[];
  onToggleFavorite: (href: string) => void;
}) {
  const visibleItems = group.items.filter(
    (item) => !item.adminOnly || isAdmin
  );

  if (visibleItems.length === 0) return null;

  const hasActive = groupContainsActive(visibleItems, pathname);

  return (
    <div className="mt-3">
      <button
        onClick={onToggle}
        className="hidden md:flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-semibold text-[#52525B] uppercase tracking-widest hover:text-[#A1A1AA] transition-colors"
      >
        {collapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
        <span>{group.label}</span>
        {collapsed && (
          <span className="ml-auto flex items-center gap-1.5">
            {hasActive && (
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF5C00]" />
            )}
            <span className="text-[9px] text-[#3F3F46] font-normal normal-case tracking-normal">
              {visibleItems.length}
            </span>
          </span>
        )}
      </button>

      {/* Mobile: show first item icon when collapsed */}
      {collapsed && (
        <div className="md:hidden space-y-0.5 mt-0.5">
          {visibleItems.slice(0, 1).map((item) => (
            <NavLink
              key={item.href}
              {...item}
              pathname={pathname}
              isFavorite={favorites.includes(item.href)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      )}

      <div
        className={[
          'overflow-hidden transition-all duration-200',
          collapsed ? 'max-h-0 md:max-h-0' : 'max-h-[2000px]',
        ].join(' ')}
      >
        <div className="space-y-0.5 mt-0.5">
          {visibleItems.map((item) => (
            <NavLink
              key={item.href}
              {...item}
              pathname={pathname}
              isFavorite={favorites.includes(item.href)}
              onToggleFavorite={onToggleFavorite}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main layout content
// ---------------------------------------------------------------------------

function DashboardContent({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: session } = useSession();

  const userName = session?.user?.name ?? 'User';
  const userEmail = session?.user?.email ?? '';
  const userRole = session?.user?.role ?? 'admin';
  const isAdmin = userRole === 'admin';

  const [showShortcuts, setShowShortcuts] = useState(false);
  const [showCommandPalette, setShowCommandPalette] = useState(false);

  // Favorites
  const [favorites, setFavorites] = useState<string[]>(() => loadFavorites());

  const toggleFavorite = useCallback((href: string) => {
    setFavorites((prev) => {
      const next = prev.includes(href)
        ? prev.filter((f) => f !== href)
        : prev.length < MAX_FAVORITES
          ? [...prev, href]
          : prev;
      saveFavorites(next);
      return next;
    });
  }, []);

  // Collapse state per group
  const [collapseState, setCollapseState] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    for (const group of NAV_GROUPS) {
      if (group.key === 'core') continue;
      initial[group.key] = loadCollapsed(group.key, group.defaultCollapsed ?? false);
    }
    return initial;
  });

  // "More" section collapse
  const [showExtra, setShowExtra] = useState(false);

  // Auto-expand group containing active page
  const autoExpandedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!pathname) return;
    for (const group of NAV_GROUPS) {
      if (group.key === 'core') continue;
      const visible = group.items.filter((i) => !i.adminOnly || isAdmin);
      if (groupContainsActive(visible, pathname) && collapseState[group.key]) {
        const cacheKey = pathname + ':' + group.key;
        if (autoExpandedRef.current !== cacheKey) {
          autoExpandedRef.current = cacheKey;
          setCollapseState((prev) => {
            const next = { ...prev, [group.key]: false };
            saveCollapsed(group.key, false);
            return next;
          });
        }
      }
    }
    // Also auto-expand "More" if an extra item is active
    if (EXTRA_ITEMS.some((item) => isActive(item.href, pathname)) && !showExtra) {
      setShowExtra(true);
    }
  }, [pathname, collapseState, isAdmin, showExtra]);

  const toggleCollapse = useCallback((groupKey: string) => {
    setCollapseState((prev) => {
      const next = { ...prev, [groupKey]: !prev[groupKey] };
      saveCollapsed(groupKey, next[groupKey]);
      return next;
    });
  }, []);

  // White-label config — cached in localStorage
  const [wlConfig, setWlConfig] = useState<WhiteLabelConfig | null>(() => {
    if (typeof window === 'undefined') return null;
    try {
      const cached = localStorage.getItem('di_wl_config');
      if (cached) return JSON.parse(cached) as WhiteLabelConfig;
    } catch { /* ignore */ }
    return null;
  });
  useEffect(() => {
    fetch('/api/config')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.config) {
          setWlConfig(data.config);
          try { localStorage.setItem('di_wl_config', JSON.stringify(data.config)); } catch { /* ignore */ }
        }
      })
      .catch(() => {/* silent */});
  }, []);

  const platformName = wlConfig?.platformName ?? 'Delta Intelligence';
  const logoUrl = wlConfig?.logoUrl ?? '/brand/@2x/delta-dark-360@2x.png';
  const logoMarkUrl = wlConfig?.logoMarkUrl ?? '/brand/delta logo mark.png';

  const toggleDarkMode = useCallback(() => {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    localStorage.setItem('di_dark_mode', String(isDark));
  }, []);

  // Global keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
        e.preventDefault();
        setShowCommandPalette((prev) => !prev);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        if (pathname !== '/chat') router.push('/chat');
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
        e.preventDefault();
        toggleDarkMode();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
        e.preventDefault();
        localStorage.removeItem('di_active_conversation');
        router.push('/chat');
      }
      if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement)?.tagName)) {
        e.preventDefault();
        setShowShortcuts((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setShowShortcuts(false);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [pathname, toggleDarkMode, router]);

  // All-items lookup for favorites
  const allItemsMap = useRef(new Map<string, NavItem>());
  useEffect(() => {
    const map = new Map<string, NavItem>();
    for (const group of NAV_GROUPS) {
      for (const item of group.items) map.set(item.href, item);
    }
    for (const item of EXTRA_ITEMS) map.set(item.href, item);
    allItemsMap.current = map;
  }, []);

  // Split groups
  const coreGroup = NAV_GROUPS.find((g) => g.key === 'core')!;
  const collapsibleGroups = NAV_GROUPS.filter(
    (g) => g.key !== 'core' && (!g.adminOnly || isAdmin)
  );

  return (
    <div className="flex h-screen overflow-hidden bg-[#09090B]">
      <LoadingBar />

      {/* ----------------------------------------------------------------- */}
      {/* Sidebar                                                           */}
      {/* ----------------------------------------------------------------- */}
      <aside className="flex flex-col w-16 md:w-56 shrink-0 bg-[#09090B] border-r border-[#27272A]">
        {/* Logo */}
        <div className="flex items-center gap-3 px-4 py-5 border-b border-[#27272A]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoUrl}
            alt={wlConfig?.companyName ?? 'Delta360'}
            className="hidden md:block h-7 w-auto"
          />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logoMarkUrl}
            alt={wlConfig?.companyName ?? 'Delta360'}
            className="md:hidden w-8 h-auto object-contain"
          />
        </div>

        {/* New Chat */}
        <div className="px-2 pt-4 pb-2">
          <Link
            href="/chat"
            onClick={(e) => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('di_active_conversation');
              }
              if (pathname === '/chat' || pathname?.startsWith('/chat?')) {
                e.preventDefault();
                localStorage.removeItem('di_active_conversation');
                window.location.href = '/chat';
              }
            }}
            className="flex items-center justify-center gap-2 w-full rounded-md px-3 py-2.5 text-sm font-semibold bg-[#FF5C00] text-white hover:bg-[#E54800] transition-colors"
          >
            <Plus size={16} className="shrink-0" />
            <span className="hidden md:block">New Chat</span>
          </Link>
        </div>

        {/* Favorites */}
        {favorites.length > 0 && (
          <div className="px-2 pb-1">
            <p className="hidden md:block px-3 mb-1 text-[9px] font-semibold text-[#52525B] uppercase tracking-widest">
              <Star size={10} className="inline mr-1 -mt-0.5" />
              Favorites
            </p>
            <div className="space-y-0.5">
              {favorites.map((href) => {
                const item = allItemsMap.current.get(href);
                if (!item) return null;
                return (
                  <NavLink
                    key={`fav-${href}`}
                    {...item}
                    pathname={pathname}
                    isFavorite
                    onToggleFavorite={toggleFavorite}
                  />
                );
              })}
            </div>
            <div className="hidden md:block mx-3 mt-2 border-b border-[#27272A]/50" />
          </div>
        )}

        {/* Nav */}
        <nav className="flex-1 px-2 overflow-y-auto">
          {/* Core — always visible */}
          <div className="space-y-0.5">
            {coreGroup.items.map((item) => (
              <NavLink
                key={item.href}
                {...item}
                pathname={pathname}
                isFavorite={favorites.includes(item.href)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>

          {/* Collapsible domain groups */}
          {collapsibleGroups.map((group) => (
            <CollapsibleGroup
              key={group.key}
              group={group}
              pathname={pathname}
              isAdmin={isAdmin}
              collapsed={collapseState[group.key] ?? false}
              onToggle={() => toggleCollapse(group.key)}
              favorites={favorites}
              onToggleFavorite={toggleFavorite}
            />
          ))}

          {/* More — extra items */}
          <div className="mt-3">
            <button
              onClick={() => setShowExtra(!showExtra)}
              className="hidden md:flex items-center gap-2 w-full px-3 py-1.5 text-[10px] font-semibold text-[#52525B] uppercase tracking-widest hover:text-[#A1A1AA] transition-colors"
            >
              {showExtra ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
              <span>More</span>
              {!showExtra && (
                <span className="ml-auto text-[9px] text-[#3F3F46] font-normal normal-case tracking-normal">
                  {EXTRA_ITEMS.length}
                </span>
              )}
            </button>
            <div
              className={[
                'overflow-hidden transition-all duration-200',
                showExtra ? 'max-h-[500px]' : 'max-h-0',
              ].join(' ')}
            >
              <div className="space-y-0.5 mt-0.5">
                {EXTRA_ITEMS.map((item) => (
                  <NavLink
                    key={item.href}
                    {...item}
                    pathname={pathname}
                    isFavorite={favorites.includes(item.href)}
                    onToggleFavorite={toggleFavorite}
                  />
                ))}
              </div>
            </div>
          </div>
        </nav>

        {/* User info */}
        <div className="px-3 py-4 border-t border-[#27272A]">
          <div className="hidden md:flex flex-col gap-2">
            <div className="truncate text-xs text-[#A1A1AA]" title={userEmail}>
              {userName}
            </div>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center rounded px-2 py-0.5 text-xs font-medium bg-[#27272A] text-[#FF5C00] border border-[#3F3F46] uppercase tracking-wide">
                {userRole}
              </span>
              {session && (
                <button
                  onClick={() => signOut({ callbackUrl: '/login' })}
                  className="text-[#71717A] hover:text-white transition-colors"
                  title="Sign out"
                >
                  <LogOut size={14} />
                </button>
              )}
            </div>
          </div>
          <div className="md:hidden flex justify-center">
            <span className="w-2 h-2 rounded-full bg-[#FF5C00]" />
          </div>
        </div>
      </aside>

      {/* ----------------------------------------------------------------- */}
      {/* Main area                                                         */}
      {/* ----------------------------------------------------------------- */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Top header */}
        <header className="flex items-center justify-between shrink-0 h-14 px-6 bg-[#09090B] border-b border-[#27272A]">
          <h1 className="text-white font-semibold text-base tracking-wide">{platformName}</h1>
          <div className="flex items-center gap-4">
            <HeaderSearch onOpenPalette={() => setShowCommandPalette(true)} />
            <NotificationBell />
            <HeaderClock />
            <span className="inline-flex items-center rounded px-2.5 py-0.5 text-xs font-medium bg-[#27272A] text-[#FF5C00] border border-[#3F3F46] uppercase tracking-wide">
              {userRole}
            </span>
          </div>
        </header>

        {/* Breadcrumbs */}
        <Breadcrumbs />

        {/* Sub-navigation tabs */}
        <SubNavTabs />

        {/* Page content */}
        <main className="flex-1 overflow-hidden bg-white dark:bg-[#09090B]">
          {children}
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette
        open={showCommandPalette}
        onClose={() => setShowCommandPalette(false)}
      />

      {/* Keyboard Shortcuts Overlay */}
      {showShortcuts && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowShortcuts(false)} />
          <div className="fixed z-50 top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-xl shadow-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-[#09090B] dark:text-white">Keyboard Shortcuts</h3>
              <button onClick={() => setShowShortcuts(false)} className="text-[#A1A1AA] hover:text-[#09090B] dark:hover:text-white transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div className="space-y-2.5">
              {[
                { keys: '\u2318 P', desc: 'Command palette' },
                { keys: '\u2318 K', desc: 'Focus chat' },
                { keys: '\u2318 N', desc: 'New chat' },
                { keys: '\u2318 /', desc: 'Toggle dark mode' },
                { keys: '?', desc: 'Show shortcuts' },
                { keys: 'Esc', desc: 'Close panel / modal' },
              ].map((s) => (
                <div key={s.keys} className="flex items-center justify-between">
                  <span className="text-xs text-[#71717A] dark:text-[#A1A1AA]">{s.desc}</span>
                  <kbd className="text-[10px] font-mono bg-[#F4F4F5] dark:bg-[#27272A] text-[#09090B] dark:text-[#FAFAFA] border border-[#E4E4E7] dark:border-[#3F3F46] rounded px-2 py-1">{s.keys}</kbd>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardContent>{children}</DashboardContent>
    </AuthProvider>
  );
}
