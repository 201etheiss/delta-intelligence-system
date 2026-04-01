'use client';

import { useDensity } from '@/components/density/DensityProvider';

interface WorkspaceProps {
  chatOpen: boolean;
  children: React.ReactNode;
}

export default function Workspace({ chatOpen, children }: WorkspaceProps) {
  const density = useDensity();

  return (
    <div className={`flex-1 min-w-0 overflow-y-auto bg-[#0f0f11] p-6 density-${density}`}>
      {children}
    </div>
  );
}
