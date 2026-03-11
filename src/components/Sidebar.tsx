'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CalendarCheck,
  BookOpen,
  GitCompareArrows,
  Banknote,
  Building2,
  FolderKanban,
  Shield,
  Upload,
  Sparkles,
  Settings,
  LogOut,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  user: {
    name: string;
    email: string;
    role: string;
  };
  onLogout: () => void;
}

const navGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'FINANCIAL CLOSE',
    items: [
      { name: 'Close Tracker', href: '/close', icon: CalendarCheck },
      { name: 'Journal Entries', href: '/journals', icon: BookOpen },
      { name: 'Reconciliation', href: '/recon', icon: GitCompareArrows },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Cash Flow', href: '/cashflow', icon: Banknote },
      { name: 'Entities', href: '/reporting', icon: Building2 },
      { name: 'Projects', href: '/projects', icon: FolderKanban },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'Audit Trail', href: '/audit', icon: Shield },
      { name: 'Data Imports', href: '/imports', icon: Upload },
      { name: 'Insights', href: '/insights', icon: Sparkles },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ user, onLogout }: SidebarProps) {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/';
    return pathname.startsWith(href);
  };

  return (
    <aside
      className="flex flex-col w-[260px] h-screen fixed left-0 top-0 z-40"
      style={{ background: '#0C2833' }}
    >
      {/* Logo */}
      <div className="px-5 pt-5 pb-4">
        <div className="flex items-center gap-2">
          <Image
            src="/logo/delta-light-360.png"
            alt="Delta360"
            width={140}
            height={40}
            className="object-contain"
            priority
          />
        </div>
        <p className="text-[10px] font-medium mt-1.5 px-0.5" style={{ color: 'rgba(140, 174, 193, 0.5)' }}>
          Intelligence System
        </p>
      </div>

      <div className="mx-5 h-px" style={{ background: 'rgba(140, 174, 193, 0.12)' }} />

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-3 pt-4 pb-4">
        {navGroups.map((group) => (
          <div key={group.label} className="mb-5">
            <div className="px-3 mb-2">
              <span
                className="text-[10px] font-bold tracking-[0.1em]"
                style={{ color: 'rgba(140, 174, 193, 0.4)' }}
              >
                {group.label}
              </span>
            </div>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group relative"
                    style={{
                      background: active ? 'rgba(255, 92, 0, 0.1)' : 'transparent',
                      color: active ? '#FFFFFF' : '#8CAEC1',
                    }}
                  >
                    {active && (
                      <div
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-5 rounded-r-full"
                        style={{ background: '#FF5C00' }}
                      />
                    )}
                    <item.icon
                      className="h-[18px] w-[18px] flex-shrink-0"
                      style={{ color: active ? '#FF5C00' : '#8CAEC1' }}
                    />
                    <span className="flex-1">{item.name}</span>
                    {active && (
                      <ChevronRight className="h-3.5 w-3.5 opacity-40" />
                    )}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="px-4 pb-5">
        <div className="mx-1 mb-3 h-px" style={{ background: 'rgba(140, 174, 193, 0.12)' }} />
        <div className="flex items-center gap-3 px-2">
          <div
            className="h-9 w-9 rounded-lg flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
            style={{ background: 'rgba(255, 92, 0, 0.2)' }}
          >
            {user.name?.charAt(0) || 'U'}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate leading-tight">
              {user.name || 'User'}
            </p>
            <p className="text-[11px] truncate" style={{ color: 'rgba(140, 174, 193, 0.5)' }}>
              {user.role || 'user'}
            </p>
          </div>
          <button
            onClick={onLogout}
            className="p-1.5 rounded-md transition-colors hover:bg-white/5"
            style={{ color: '#8CAEC1' }}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
