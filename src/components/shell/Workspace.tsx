'use client';

import { useDensity } from '@/components/density/DensityProvider';
import SubNavTabs from '@/components/common/SubNavTabs';

interface WorkspaceProps {
  chatOpen: boolean;
  children: React.ReactNode;
}

export default function Workspace({ chatOpen, children }: WorkspaceProps) {
  const density = useDensity();

  return (
    <div className={`flex-1 min-w-0 overflow-y-auto bg-[#0f0f11] density-${density}`}>
      <SubNavTabs />
      <div className="p-6">
        {children}
      </div>
    </div>
  );
}
