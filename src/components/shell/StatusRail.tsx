'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  DollarSign,
  Truck,
  BarChart3,
  Users,
  Shield,
  Settings,
  Layers,
  MessageSquare,
  Search,
} from 'lucide-react';

interface StatusRailProps {
  activeModule: string | null;
  chatOpen: boolean;
  onModuleClick: (id: string) => void;
  onChatToggle: () => void;
  onSearchClick: () => void;
  onHomeClick?: () => void;
}

interface ServiceHealth {
  name: string;
  status: 'connected' | 'degraded' | 'error';
}

interface HealthResponse {
  success: boolean;
  services: ServiceHealth[];
}

const MODULE_ICONS = [
  { id: 'home', label: 'Home', Icon: LayoutDashboard },
  { id: 'finance', label: 'Finance', Icon: DollarSign },
  { id: 'operations', label: 'Operations', Icon: Truck },
  { id: 'intelligence', label: 'Intelligence', Icon: BarChart3 },
  { id: 'organization', label: 'Organization', Icon: Users },
  { id: 'compliance', label: 'Compliance', Icon: Shield },
  { id: 'admin', label: 'Admin', Icon: Settings },
  { id: 'platform', label: 'Platform', Icon: Layers },
] as const;

function statusColor(status: ServiceHealth['status']): string {
  if (status === 'connected') return 'bg-green-500';
  if (status === 'degraded') return 'bg-yellow-400';
  return 'bg-red-500';
}

export default function StatusRail({
  activeModule,
  chatOpen,
  onModuleClick,
  onChatToggle,
  onSearchClick,
  onHomeClick,
}: StatusRailProps) {
  const pathname = usePathname();
  const [services, setServices] = useState<ServiceHealth[]>([]);

  useEffect(() => {
    async function fetchHealth() {
      try {
        const res = await fetch('/api/admin/health');
        if (!res.ok) return;
        const data: HealthResponse = await res.json();
        if (data.success && Array.isArray(data.services)) {
          setServices(data.services);
        }
      } catch {
        // silently ignore — health dots are best-effort
      }
    }

    void fetchHealth();
    const interval = setInterval(() => void fetchHealth(), 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <aside
      className="flex h-full w-12 flex-col items-center border-r border-[#27272a] bg-[#111113] py-3"
      style={{ width: 48 }}
    >
      {/* Module group icons */}
      <nav className="flex flex-col items-center gap-1">
        {MODULE_ICONS.map(({ id, label, Icon }) => {
          const isHome = id === 'home';
          const isActive = isHome
            ? (activeModule === null && pathname === '/')
            : activeModule === id;
          return (
            <button
              key={id}
              title={label}
              onClick={() => isHome && onHomeClick ? onHomeClick() : onModuleClick(id)}
              className="relative flex items-center justify-center rounded-[8px] transition-colors"
              style={{
                width: 34,
                height: 34,
                background: isActive ? 'rgba(254, 80, 0, 0.12)' : 'transparent',
                color: isActive ? '#FE5000' : '#71717a',
                borderLeft: isActive ? '2px solid #FE5000' : '2px solid transparent',
              }}
            >
              <Icon size={16} strokeWidth={1.75} />
            </button>
          );
        })}
      </nav>

      {/* Divider */}
      <div className="my-3 h-px w-8 bg-[#27272a]" />

      {/* Chat toggle */}
      <button
        title="Chat"
        onClick={onChatToggle}
        className="flex items-center justify-center rounded-[8px] transition-colors"
        style={{
          width: 34,
          height: 34,
          background: chatOpen ? 'rgba(254, 80, 0, 0.12)' : 'transparent',
          color: chatOpen ? '#FE5000' : '#71717a',
          filter: chatOpen ? 'drop-shadow(0 0 6px #FE5000)' : 'none',
        }}
      >
        <MessageSquare size={16} strokeWidth={1.75} />
      </button>

      {/* Search */}
      <button
        title="Search"
        onClick={onSearchClick}
        className="mt-1 flex items-center justify-center rounded-[8px] transition-colors hover:bg-white/5"
        style={{ width: 34, height: 34, color: '#71717a' }}
      >
        <Search size={16} strokeWidth={1.75} />
      </button>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Health dots */}
      {services.length > 0 && (
        <div className="mb-2 flex flex-col items-center gap-1.5">
          {services.map((svc) => (
            <div
              key={svc.name}
              title={`${svc.name}: ${svc.status}`}
              className={`h-2 w-2 rounded-full ${statusColor(svc.status)}`}
            />
          ))}
        </div>
      )}
    </aside>
  );
}
