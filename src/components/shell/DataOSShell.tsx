'use client';

import { useCallback, useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { DensityProvider, useDensity, useDensityToggle } from '@/components/density/DensityProvider';
import { NovaBar } from '@/components/shell/NovaBar';
import { NovaCommandPalette } from '@/components/shell/NovaCommandPalette';
import StatusRail from '@/components/shell/StatusRail';
import { ModuleTabs } from '@/components/shell/ModuleTabs';
import Workspace from '@/components/shell/Workspace';
import ChatPanel from '@/components/shell/ChatPanel';
import LoadingBar from '@/components/common/LoadingBar';
import CrossAppBreadcrumb from '@/components/integration/CrossAppBreadcrumb';
import { findModuleForPath, MODULE_GROUPS } from '@/lib/shell/module-registry';
import { getModulesForRole } from '@/lib/shell/role-routing';
import type { UserRole } from '@/lib/config/roles';
import type { ModuleGroup } from '@/lib/shell/module-registry';
import {
  getTabs,
  openTab,
  closeTab,
  setActiveTab,
  updateTabPath,
} from '@/lib/shell/tab-manager';
import type { TabState } from '@/lib/shell/tab-manager';
import { saveSessionState, recordModuleOpen } from '@/lib/shell/session-state';

// ---------------------------------------------------------------------------
// Inner shell — requires DensityProvider to be an ancestor
// ---------------------------------------------------------------------------

function ShellInner({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const densityMode = useDensity();
  const densityToggle = useDensityToggle();

  // Role-filtered modules for StatusRail
  // In dev mode without session, default to admin (sees everything)
  const userRole: UserRole = 'admin'; // TODO: wire to useSession().data?.user?.role when auth is live
  const filteredModules = getModulesForRole(userRole);

  // Derived active module
  const [activeModule, setActiveModule] = useState<ModuleGroup | undefined>(() => {
    if (typeof window === 'undefined') return undefined;
    return pathname ? findModuleForPath(pathname) : undefined;
  });

  // Tab state
  const [tabs, setTabs] = useState<TabState[]>(() => {
    if (typeof window === 'undefined') return [];
    return getTabs();
  });
  const [activeTabId, setActiveTabId] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const mod = pathname ? findModuleForPath(pathname) : undefined;
    return mod?.id ?? null;
  });

  // Chat panel toggle (placeholder — wired in Task 11)
  const [chatOpen, setChatOpen] = useState(false);

  // Command palette toggle (placeholder — wired in Task 12)
  const [paletteOpen, setPaletteOpen] = useState(false);

  // -----------------------------------------------------------------------
  // On pathname change: update module, tabs, session state
  // -----------------------------------------------------------------------
  useEffect(() => {
    if (!pathname) return;

    const mod = findModuleForPath(pathname);
    setActiveModule(mod);

    if (mod) {
      // Open or update tab for this module
      const updated = openTab(mod.id, mod.label, mod.icon, pathname);
      setTabs(updated);
      setActiveTabId(mod.id);
      recordModuleOpen(mod.id);
    } else {
      // Update active tab path if it exists
      if (activeTabId) {
        const updated = updateTabPath(activeTabId, pathname);
        setTabs(updated);
      }
    }

    // Persist session state
    saveSessionState({
      lastModule: mod?.id ?? '',
      lastPage: pathname,
    });
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // -----------------------------------------------------------------------
  // Save state on beforeunload
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = () => {
      saveSessionState({
        lastModule: activeModule?.id ?? '',
        lastPage: pathname ?? '',
      });
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [activeModule, pathname]);

  // -----------------------------------------------------------------------
  // Keyboard shortcuts
  // -----------------------------------------------------------------------
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Cmd+K — toggle chat panel
      if (meta && e.key === 'k') {
        e.preventDefault();
        setChatOpen((prev) => !prev);
      }

      // Cmd+P — toggle command palette
      if (meta && e.key === 'p') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }

      // Cmd+/ — toggle dark mode
      if (meta && e.key === '/') {
        e.preventDefault();
        const html = document.documentElement;
        const isDark = html.classList.toggle('dark');
        localStorage.setItem('di_dark_mode', String(isDark));
      }

      // Escape — close palette and chat
      if (e.key === 'Escape') {
        setPaletteOpen(false);
        setChatOpen(false);
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // -----------------------------------------------------------------------
  // StatusRail handlers
  // -----------------------------------------------------------------------
  const handleModuleClick = useCallback(
    (moduleId: string) => {
      const group = MODULE_GROUPS.find((g) => g.id === moduleId);
      if (!group) return;

      const updated = openTab(group.id, group.label, group.icon, group.defaultPagePath);
      setTabs(updated);
      setActiveTabId(group.id);
      router.push(group.defaultPagePath);
    },
    [router],
  );

  const handleChatToggle = useCallback(() => {
    setChatOpen((prev) => !prev);
  }, []);

  const handleSearchClick = useCallback(() => {
    setPaletteOpen((prev) => !prev);
  }, []);

  // -----------------------------------------------------------------------
  // ModuleTabs handlers
  // -----------------------------------------------------------------------
  const handleTabClick = useCallback(
    (tabId: string) => {
      const tab = tabs.find((t) => t.id === tabId);
      if (!tab) return;
      setActiveTab(tabId);
      setActiveTabId(tabId);
      router.push(tab.activePath);
    },
    [tabs, router],
  );

  const handleTabClose = useCallback(
    (tabId: string) => {
      const updated = closeTab(tabId);
      setTabs(updated);

      // If we closed the active tab, switch to the last remaining or go home
      if (tabId === activeTabId) {
        if (updated.length > 0) {
          const last = updated[updated.length - 1];
          setActiveTabId(last.id);
          router.push(last.activePath);
        } else {
          setActiveTabId(null);
          router.push('/');
        }
      }
    },
    [activeTabId, router],
  );

  const handleNewTab = useCallback(() => {
    router.push('/');
  }, [router]);

  // -----------------------------------------------------------------------
  // Current page label for NovaBar
  // -----------------------------------------------------------------------
  const currentPage = (() => {
    if (!pathname) return 'Home';
    if (activeModule) {
      const page = activeModule.pages.find((p) => p.href === pathname);
      if (page) return page.label;
    }
    // Fallback: derive from pathname
    const segments = pathname.split('/').filter(Boolean);
    if (segments.length === 0) return 'Home';
    return segments[segments.length - 1]
      .replace(/-/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase());
  })();

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------
  return (
    <div className="flex flex-col h-screen overflow-hidden bg-[#09090B]">
      <LoadingBar />

      {/* NovaBar — top */}
      <NovaBar
        currentModule={activeModule?.id ?? null}
        currentPage={currentPage}
        densityMode={densityMode}
        onDensityToggle={densityToggle}
        onNovaClick={() => setPaletteOpen(prev => !prev)}
      />

      {/* Below NovaBar */}
      <div className="flex flex-1 min-h-0">
        {/* StatusRail — left */}
        <StatusRail
          modules={filteredModules}
          activeModule={activeModule?.id ?? null}
          chatOpen={chatOpen}
          onModuleClick={handleModuleClick}
          onChatToggle={handleChatToggle}
          onSearchClick={handleSearchClick}
          onHomeClick={() => router.push('/')}
        />

        {/* Right of rail */}
        <div className="flex flex-col flex-1 min-w-0">
          {/* ModuleTabs — tab bar */}
          <ModuleTabs
            tabs={tabs}
            activeTabId={activeTabId}
            onTabClick={handleTabClick}
            onTabClose={handleTabClose}
            onNewTab={handleNewTab}
          />

          {/* Cross-app breadcrumb */}
          <CrossAppBreadcrumb currentPath={pathname} currentModule={activeModule?.id ?? null} />

          {/* Workspace — content area */}
          <Workspace chatOpen={chatOpen}>
            {children}
          </Workspace>
        </div>

        {/* ChatPanel — right slide-out */}
        <ChatPanel
          isOpen={chatOpen}
          currentModule={activeModule?.id ?? null}
          currentPage={currentPage}
          onClose={handleChatToggle}
        />
      </div>

      {/* NovaCommandPalette — full-screen overlay */}
      <NovaCommandPalette
        isOpen={paletteOpen}
        onClose={() => setPaletteOpen(false)}
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// DataOSShell — wraps everything with DensityProvider
// ---------------------------------------------------------------------------

export default function DataOSShell({ children }: { children: React.ReactNode }) {
  return (
    <DensityProvider>
      <ShellInner>{children}</ShellInner>
    </DensityProvider>
  );
}
