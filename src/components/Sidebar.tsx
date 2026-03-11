'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  LayoutDashboard,
  ClipboardCheck,
  GitBranch,
  FileText,
  Scale,
  DollarSign,
  BarChart3,
  FolderKanban,
  Shield,
  Upload,
  Brain,
  Settings,
  LogOut,
} from 'lucide-react';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

interface SidebarProps {
  user: User;
  currentPath: string;
}

const navigationGroups = [
  {
    label: 'OVERVIEW',
    items: [
      { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    ],
  },
  {
    label: 'CLOSE',
    items: [
      { name: 'Close Tracker', href: '/close', icon: ClipboardCheck },
      { name: 'Timeline', href: '/close/timeline', icon: GitBranch },
    ],
  },
  {
    label: 'FINANCIAL',
    items: [
      { name: 'Journal Entries', href: '/journals', icon: FileText },
      { name: 'Recon', href: '/recon', icon: Scale },
      { name: 'Cash Flow', href: '/cashflow', icon: DollarSign },
    ],
  },
  {
    label: 'REPORTING',
    items: [
      { name: 'Reports', href: '/reporting', icon: BarChart3 },
    ],
  },
  {
    label: 'OPERATIONS',
    items: [
      { name: 'Projects', href: '/projects', icon: FolderKanban },
      { name: 'Audit', href: '/audit', icon: Shield },
      { name: 'Imports', href: '/imports', icon: Upload },
    ],
  },
  {
    label: 'INTELLIGENCE',
    items: [
      { name: 'Insights', href: '/insights', icon: Brain },
    ],
  },
  {
    label: 'SYSTEM',
    items: [
      { name: 'Settings', href: '/settings', icon: Settings },
    ],
  },
];

export default function Sidebar({ user, currentPath }: SidebarProps) {
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const router = useRouter();

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const isItemActive = (href: string): boolean => {
    if (href === '/') {
      return currentPath === '/';
    }
    return currentPath.startsWith(href);
  };

  const userInitial = user.name.charAt(0).toUpperCase();

  return (
    <aside className="w-60 bg-slate-900 flex flex-col overflow-hidden">
      {/* Logo section */}
      <div className="px-6 py-6 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center flex-shrink-0">
            <span className="text-sm font-bold text-white">D</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-white truncate">D360 Intelligence</div>
            <div className="text-xs text-slate-400 truncate">Corporate Controller</div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-6 space-y-8">
        {navigationGroups.map((group) => (
          <div key={group.label}>
            <div className="px-4 mb-3">
              <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                {group.label}
              </h3>
            </div>
            <ul className="space-y-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = isItemActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                        active
                          ? 'bg-slate-800 text-white border-l-4 border-l-blue-400'
                          : 'text-slate-300 hover:bg-slate-800/50 border-l-4 border-l-transparent'
                      }`}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span className="truncate">{item.name}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User section */}
      <div className="border-t border-slate-800 px-4 py-4 space-y-3">
        <div className="flex items-center gap-3 px-4 py-3 rounded-lg bg-slate-800">
          <div className="h-8 w-8 rounded-full bg-blue-500 flex items-center justify-center flex-shrink-0">
            <span className="text-xs font-bold text-white">{userInitial}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium text-white truncate">{user.name}</div>
            <div className="text-xs text-slate-400 truncate capitalize">{user.role}</div>
          </div>
        </div>
        <button
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium text-slate-300 hover:bg-slate-800/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogOut className="h-5 w-5 flex-shrink-0" />
          <span>{isLoggingOut ? 'Logging out...' : 'Logout'}</span>
        </button>
      </div>
    </aside>
  );
}
