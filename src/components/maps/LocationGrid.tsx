'use client';

import { useState, useMemo } from 'react';
import { MapPin, Search, Truck } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────

export interface LocationItem {
  name: string;
  lat: number;
  lng: number;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  region: string;
  detail?: string;
}

interface LocationGridProps {
  locations: LocationItem[];
}

// ── Helpers ───────────────────────────────────────────────────

const STATUS_COLORS: Record<LocationItem['status'], string> = {
  active: '#22C55E',
  idle: '#EAB308',
  maintenance: '#F97316',
  offline: '#EF4444',
};

const STATUS_LABELS: Record<LocationItem['status'], string> = {
  active: 'Active',
  idle: 'Idle',
  maintenance: 'Maintenance',
  offline: 'Offline',
};

// ── Component ─────────────────────────────────────────────────

export default function LocationGrid({ locations }: LocationGridProps) {
  const [filter, setFilter] = useState('');
  const [regionFilter, setRegionFilter] = useState<string>('all');

  const regions = useMemo(() => {
    const set = new Set(locations.map((l) => l.region));
    return Array.from(set).sort();
  }, [locations]);

  const filtered = useMemo(() => {
    let result = locations;
    if (regionFilter !== 'all') {
      result = result.filter((l) => l.region === regionFilter);
    }
    if (filter.trim()) {
      const q = filter.toLowerCase();
      result = result.filter(
        (l) => l.name.toLowerCase().includes(q) || l.region.toLowerCase().includes(q)
      );
    }
    return result;
  }, [locations, filter, regionFilter]);

  const grouped = useMemo(() => {
    const map: Record<string, LocationItem[]> = {};
    for (const loc of filtered) {
      const key = loc.region;
      if (!map[key]) map[key] = [];
      map[key].push(loc);
    }
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5 bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-2.5 py-1.5 flex-1 max-w-xs">
          <Search size={14} className="text-[#71717A] shrink-0" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search vehicles..."
            className="bg-transparent text-sm text-[#09090B] dark:text-white placeholder-[#A1A1AA] outline-none w-full"
          />
        </div>
        <select
          value={regionFilter}
          onChange={(e) => setRegionFilter(e.target.value)}
          className="bg-white dark:bg-[#18181B] border border-[#E4E4E7] dark:border-[#27272A] rounded-lg px-3 py-1.5 text-sm text-[#09090B] dark:text-white outline-none"
        >
          <option value="all">All Regions</option>
          {regions.map((r) => (
            <option key={r} value={r}>{r}</option>
          ))}
        </select>
      </div>

      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs text-[#71717A]">
        <span>{filtered.length} vehicle{filtered.length !== 1 ? 's' : ''}</span>
        {(['active', 'idle', 'maintenance', 'offline'] as const).map((s) => {
          const count = filtered.filter((l) => l.status === s).length;
          if (count === 0) return null;
          return (
            <span key={s} className="flex items-center gap-1">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: STATUS_COLORS[s] }} />
              {count} {STATUS_LABELS[s]}
            </span>
          );
        })}
      </div>

      {/* Grid grouped by region */}
      {grouped.length === 0 ? (
        <div className="text-center py-12 text-sm text-[#71717A]">
          No vehicles match your filters.
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(([region, items]) => (
            <div key={region}>
              <h3 className="text-xs font-semibold text-[#09090B] dark:text-white uppercase tracking-wide mb-2 flex items-center gap-1.5">
                <MapPin size={12} className="text-[#FE5000]" />
                {region}
                <span className="text-[#A1A1AA] font-normal">({items.length})</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
                {items.map((loc) => (
                  <div
                    key={`${loc.name}-${loc.lat}-${loc.lng}`}
                    className="flex items-start gap-3 rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3 hover:border-[#FE5000]/30 transition-colors"
                  >
                    <Truck size={16} className="text-[#71717A] shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#09090B] dark:text-white truncate">{loc.name}</span>
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: STATUS_COLORS[loc.status] }}
                          title={STATUS_LABELS[loc.status]}
                        />
                      </div>
                      <p className="text-[10px] text-[#A1A1AA] font-mono mt-0.5">
                        {loc.lat.toFixed(4)}, {loc.lng.toFixed(4)}
                      </p>
                      {loc.detail && (
                        <p className="text-[10px] text-[#71717A] mt-0.5">{loc.detail}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
