'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Loader } from 'lucide-react';
import Sidebar from '@/components/Sidebar';

interface User {
  id: string;
  email: string;
  name: string;
  role: string;
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const response = await fetch('/api/auth/me');
        if (response.ok) {
          const data = await response.json();
          setUser(data.user);
        } else {
          router.push('/login');
        }
      } catch (error) {
        console.error('Error fetching user:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleLogout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
    } catch (error) {
      console.error('Error logging out:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-white">
        <Loader className="h-8 w-8 animate-spin text-[#8CAEC1]" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-white">
      {/* Sidebar - 260px fixed width */}
      <div className="w-[260px] flex-shrink-0">
        <Sidebar user={user} onLogout={handleLogout} />
      </div>

      {/* Main content area with ml offset */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header bar */}
        <header className="bg-white border-b border-[#DDE9EE] flex items-center justify-between px-8 py-4">
          <h1 className="text-lg font-semibold text-[#0C2833]">
            {getPageTitle(pathname)}
          </h1>
          <div className="text-sm text-[#8CAEC1]">
            Good {getGreeting()}, {user.name}
          </div>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-white">
          <div className="px-8 py-6">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}

function getPageTitle(pathname: string): string {
  const path = pathname.split('/')[1];

  const titles: Record<string, string> = {
    '': 'Dashboard',
    close: 'Close Tracker',
    timeline: 'Close Timeline',
    journals: 'Journal Entries',
    recon: 'Reconciliation',
    cashflow: 'Cash Flow',
    reporting: 'Reports',
    projects: 'Projects',
    audit: 'Audit',
    imports: 'Imports',
    insights: 'Intelligence',
    settings: 'Settings',
  };

  return titles[path] || 'Dashboard';
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 18) return 'afternoon';
  return 'evening';
}
