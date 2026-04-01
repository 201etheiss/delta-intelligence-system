'use client';

import { Briefcase } from 'lucide-react';
import { ICON_MAP } from './types';

export function WorkspaceIcon({ icon, color, size = 20 }: { icon: string; color: string; size?: number }) {
  const Icon = ICON_MAP[icon] ?? Briefcase;
  return (
    <div
      className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
      style={{ backgroundColor: `${color}15` }}
    >
      <Icon size={size} color={color} />
    </div>
  );
}
