'use client';

import AuthProvider from '@/components/auth/AuthProvider';
import DataOSShell from '@/components/shell/DataOSShell';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DataOSShell>
        {children}
      </DataOSShell>
    </AuthProvider>
  );
}
