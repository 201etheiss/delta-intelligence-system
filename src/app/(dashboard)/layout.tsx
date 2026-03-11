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

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50">
        <Loader className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-slate-50">
      {/* Sidebar */}
      <Sidebar user={user} currentPath={pathname} />

      {/* Main content */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 border-b border-slate-200 bg-white flex items-center px-8">
          <h1 className="text-lg font-semibold text-slate-900">
            {getPageTitle(pathname)}
          </h1>
        </header>

        {/* Content area */}
        <main className="flex-1 overflow-y-auto bg-slate-50">
          <div className="p-8">
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
