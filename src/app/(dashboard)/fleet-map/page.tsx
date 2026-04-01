'use client';

import { useState, useEffect, useCallback } from 'react';
import { MapPin, AlertTriangle, RefreshCw } from 'lucide-react';
import LocationGrid, { type LocationItem } from '@/components/maps/LocationGrid';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';

// ── Data Fetcher ─────────────────────────────────────────────

async function fetchLocations(): Promise<LocationItem[]> {
  const res = await fetch('/api/fleet/locations');
  const json = await res.json();
  if (!json.success || !Array.isArray(json.data)) return [];

  return (json.data as Array<{
    name?: string;
    lat?: number;
    lng?: number;
    status?: string;
    region?: string;
    detail?: string;
  }>).map((v) => ({
    name: v.name ?? 'Unknown',
    lat: typeof v.lat === 'number' ? v.lat : 0,
    lng: typeof v.lng === 'number' ? v.lng : 0,
    status: (['active', 'idle', 'maintenance', 'offline'].includes(v.status ?? '')
      ? v.status as LocationItem['status']
      : 'active'),
    region: v.region ?? '',
    detail: v.detail ?? '',
  }));
}

// ── Page ──────────────────────────────────────────────────────

export default function FleetMapPage() {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<string>('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLocations();
      setLocations(data);
      setLastRefresh(new Date().toLocaleTimeString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet locations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const stats = {
    total: locations.length,
    active: locations.filter((l) => l.status === 'active').length,
    idle: locations.filter((l) => l.status === 'idle').length,
    maintenance: locations.filter((l) => l.status === 'maintenance').length,
    offline: locations.filter((l) => l.status === 'offline').length,
    regions: new Set(locations.map((l) => l.region).filter(Boolean)).size,
  };

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-white dark:bg-[#09090B]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#09090B] dark:text-white flex items-center gap-2">
            <MapPin size={20} className="text-[#FE5000]" />
            Fleet Map
          </h2>
          <p className="mt-0.5 text-sm text-[#71717A]">
            Vehicle positions across all regions
            {lastRefresh && <span className="ml-2 text-[#A1A1AA]">Last refresh: {lastRefresh}</span>}
          </p>
        </div>
        <button
          onClick={loadData}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#FE5000]/40 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <AIInsightsBanner module="fleet-map" compact />

      {/* Error Banner */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-400">{error}</span>
          <button onClick={loadData} className="ml-auto text-xs text-red-400 hover:text-red-300 underline">
            Retry
          </button>
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <StatCard label="Total Vehicles" value={stats.total} color="#FE5000" loading={loading} />
        <StatCard label="Active" value={stats.active} color="#22C55E" loading={loading} />
        <StatCard label="Idle" value={stats.idle} color="#EAB308" loading={loading} />
        <StatCard label="Maintenance" value={stats.maintenance} color="#F97316" loading={loading} />
        <StatCard label="Offline" value={stats.offline} color="#EF4444" loading={loading} />
        <StatCard label="Regions" value={stats.regions} color="#3B82F6" loading={loading} />
      </div>

      {/* Offline Alert */}
      {stats.offline > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2">
          <AlertTriangle size={16} className="text-red-500 shrink-0" />
          <span className="text-sm text-red-400">
            {stats.offline} vehicle{stats.offline > 1 ? 's' : ''} offline — no GPS signal
          </span>
        </div>
      )}

      {/* No Data Fallback */}
      {!loading && locations.length === 0 && !error && (
        <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-8 text-center">
          <MapPin size={32} className="text-[#52525B] mx-auto mb-2" />
          <p className="text-sm text-[#71717A]">No vehicle locations available.</p>
          <p className="text-xs text-[#52525B] mt-0.5">Check that the Samsara gateway connection is active.</p>
        </div>
      )}

      {/* Location Grid */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 rounded-lg bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
          ))}
        </div>
      ) : locations.length > 0 ? (
        <LocationGrid locations={locations} />
      ) : null}
    </div>
  );
}

function StatCard({ label, value, color, loading }: { label: string; value: number; color: string; loading: boolean }) {
  return (
    <div className="rounded-lg border border-[#E4E4E7] dark:border-[#27272A] bg-white dark:bg-[#18181B] p-3 shadow-sm">
      <div className="flex items-center gap-1.5 mb-1">
        <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
        <p className="text-[10px] font-medium text-[#A1A1AA] uppercase tracking-wide">{label}</p>
      </div>
      {loading ? (
        <div className="h-6 w-10 rounded bg-[#F4F4F5] dark:bg-[#27272A] animate-pulse" />
      ) : (
        <span className="text-lg font-bold text-[#09090B] dark:text-white font-mono">{value}</span>
      )}
    </div>
  );
}
