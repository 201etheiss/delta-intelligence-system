'use client';

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { useSession } from 'next-auth/react';
import type { UserRole } from '@/lib/config/roles';

export type DensityMode = 'executive' | 'operator';

const STORAGE_KEY = 'di_density_mode';

const ROLE_DEFAULTS: Record<UserRole, DensityMode> = {
  admin: 'executive',
  accounting: 'operator',
  sales: 'executive',
  operations: 'operator',
  hr: 'executive',
  readonly: 'executive',
};

interface DensityContextValue {
  mode: DensityMode;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue | null>(null);

function getDefaultMode(role: UserRole | undefined): DensityMode {
  if (role && role in ROLE_DEFAULTS) {
    return ROLE_DEFAULTS[role];
  }
  return 'executive';
}

export function DensityProvider({ children }: { children: React.ReactNode }) {
  const { data: session } = useSession();
  const role = session?.user?.role as UserRole | undefined;

  const [mode, setMode] = useState<DensityMode>(() => {
    // Initial value is the role default; localStorage is applied in useEffect
    // to avoid SSR/hydration mismatch.
    return getDefaultMode(role);
  });

  // On mount: apply localStorage override if present, otherwise derive from role.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as DensityMode | null;
    if (stored === 'executive' || stored === 'operator') {
      setMode(stored);
    } else {
      setMode(getDefaultMode(role));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run once on mount only — intentionally ignoring role here.

  // When role changes (e.g. session loads after mount) and no user override
  // is stored, update to role default.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(STORAGE_KEY) as DensityMode | null;
    if (stored !== 'executive' && stored !== 'operator') {
      setMode(getDefaultMode(role));
    }
  }, [role]);

  const toggle = useCallback(() => {
    setMode((prev) => {
      const next: DensityMode = prev === 'executive' ? 'operator' : 'executive';
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(STORAGE_KEY, next);
      }
      return next;
    });
  }, []);

  return (
    <DensityContext.Provider value={{ mode, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityMode {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    throw new Error('useDensity must be used within a DensityProvider');
  }
  return ctx.mode;
}

export function useDensityToggle(): () => void {
  const ctx = useContext(DensityContext);
  if (!ctx) {
    throw new Error('useDensityToggle must be used within a DensityProvider');
  }
  return ctx.toggle;
}
