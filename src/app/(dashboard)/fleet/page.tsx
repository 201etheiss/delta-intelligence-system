'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Truck,
  Users,
  Fuel,
  Wrench,
  MapPin,
  ExternalLink,
  RefreshCw,
  AlertCircle,
  ArrowRight,
  ShieldCheck,
  Route,
  CalendarClock,
  Activity,
} from 'lucide-react';
import { AIInsightsBanner } from '@/components/common/AIInsightsBanner';
import { useDensity } from '@/components/density/DensityProvider';
import { DensityKPI } from '@/components/density/DensityKPI';
import { DensityTable } from '@/components/density/DensityTable';
import { DensityChart } from '@/components/density/DensityChart';
import { DensitySection } from '@/components/density/DensitySection';

// ── Types ────────────────────────────────────────────────────

interface VehicleItem {
  name: string;
  status: 'active' | 'idle' | 'maintenance' | 'offline';
  lat: number;
  lng: number;
}

interface FleetKpi {
  label: string;
  value: string | number;
  subtext?: string;
  icon: typeof Truck;
  color: string;
}

// ── Status Helpers ───────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; text: string; dot: string }> = {
  active: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', dot: 'bg-emerald-500' },
  idle: { bg: 'bg-amber-500/10', text: 'text-amber-400', dot: 'bg-amber-500' },
  maintenance: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
  offline: { bg: 'bg-zinc-500/10', text: 'text-zinc-500', dot: 'bg-zinc-600' },
};

// ── Skeleton ─────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4 animate-pulse">
      <div className="h-3 w-20 bg-zinc-800 rounded mb-2" />
      <div className="h-7 w-16 bg-zinc-800 rounded mb-2" />
      <div className="h-2.5 w-24 bg-zinc-800 rounded" />
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────

export default function OpsConsolePage() {
  const density = useDensity();
  const [vehicles, setVehicles] = useState<VehicleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/fleet/locations');
      const json = await res.json();
      if (!json.success || !Array.isArray(json.data)) {
        setError(json.error ?? 'Failed to load fleet data');
        setVehicles([]);
        return;
      }
      const mapped: VehicleItem[] = (json.data as Array<Record<string, unknown>>).map((v) => ({
        name: String(v.name ?? 'Unknown'),
        status: (['active', 'idle', 'maintenance', 'offline'].includes(String(v.status ?? ''))
          ? String(v.status) as VehicleItem['status']
          : 'active'),
        lat: typeof v.lat === 'number' ? v.lat : 0,
        lng: typeof v.lng === 'number' ? v.lng : 0,
      }));
      setVehicles(mapped);
      setLastRefresh(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load fleet data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 3 * 60 * 1000);
    return () => clearInterval(interval);
  }, [loadData]);

  const counts = {
    total: vehicles.length,
    active: vehicles.filter((v) => v.status === 'active').length,
    idle: vehicles.filter((v) => v.status === 'idle').length,
    maintenance: vehicles.filter((v) => v.status === 'maintenance').length,
    offline: vehicles.filter((v) => v.status === 'offline').length,
  };

  const utilizationPct = counts.total > 0
    ? ((counts.active / counts.total) * 100)
    : 0;

  const kpis: FleetKpi[] = [
    {
      label: 'Active Fleet',
      value: `${counts.active} / ${counts.total}`,
      subtext: `${typeof utilizationPct === 'number' ? utilizationPct.toFixed(0) : '0'}% utilization`,
      icon: Truck,
      color: 'text-[#FF5C00]',
    },
    {
      label: 'Idle Vehicles',
      value: counts.idle,
      subtext: counts.idle > 0 ? 'May need dispatch' : 'All dispatched',
      icon: Activity,
      color: counts.idle > 3 ? 'text-amber-400' : 'text-emerald-400',
    },
    {
      label: 'Maintenance Alerts',
      value: counts.maintenance,
      subtext: counts.maintenance > 0 ? 'Needs attention' : 'All clear',
      icon: Wrench,
      color: counts.maintenance > 0 ? 'text-red-400' : 'text-emerald-400',
    },
    {
      label: 'Avg Fuel Efficiency',
      value: '--',
      subtext: 'Awaiting Samsara fuel data',
      icon: Fuel,
      color: 'text-blue-400',
    },
  ];

  // ── Executive density view ────────────────────────────────────
  if (density === 'executive') {
    const statusChartData = [
      { label: 'Active', value: counts.active, color: '#22c55e' },
      { label: 'Idle', value: counts.idle, color: '#eab308' },
      { label: 'Maint.', value: counts.maintenance, color: '#3b82f6' },
      { label: 'Offline', value: counts.offline, color: '#52525b' },
    ];

    return (
      <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
        <div className="max-w-7xl mx-auto space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-white">Operations Console</h1>
              <p className="text-xs text-zinc-500 mt-0.5">
                Executive view — fleet KPIs and status summary
                {lastRefresh && (
                  <span className="ml-3">
                    Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                )}
              </p>
            </div>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Refresh
            </button>
          </div>

          <AIInsightsBanner module="fleet" compact />

          {/* Fleet KPI Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <DensityKPI
              label="Active Fleet"
              value={`${counts.active} / ${counts.total}`}
              delta={`${typeof utilizationPct === 'number' ? utilizationPct.toFixed(0) : '0'}% utilization`}
              deltaDirection={utilizationPct >= 75 ? 'up' : utilizationPct >= 50 ? 'neutral' : 'down'}
            />
            <DensityKPI
              label="Idle Vehicles"
              value={String(counts.idle)}
              delta={counts.idle > 0 ? 'May need dispatch' : 'All dispatched'}
              deltaDirection={counts.idle > 3 ? 'down' : 'neutral'}
            />
            <DensityKPI
              label="Maintenance"
              value={String(counts.maintenance)}
              delta={counts.maintenance > 0 ? 'Needs attention' : 'All clear'}
              deltaDirection={counts.maintenance > 0 ? 'down' : 'up'}
            />
            <DensityKPI
              label="Avg Fuel Efficiency"
              value="--"
              delta="Awaiting Samsara"
              deltaDirection="neutral"
            />
          </div>

          {/* Fleet map placeholder */}
          <DensitySection title="Fleet Map">
            <div className="flex items-center justify-center h-32 rounded-lg border border-dashed border-[#27272A] text-zinc-600 text-sm">
              <MapPin size={16} className="mr-2" />
              Live map — connect Samsara gateway on port 3847
            </div>
          </DensitySection>

          {/* Delivery Status Chart */}
          {counts.total > 0 && (
            <DensitySection title="Fleet Status Distribution">
              <DensityChart type="bar" data={statusChartData} height={120} title="Vehicle Status" />
            </DensitySection>
          )}

          {error && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
              <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-300">{error}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Operator density view (full dispatch table) ────────────────

  return (
    <div className="h-full overflow-y-auto bg-[#09090B] text-zinc-100 px-5 py-4">
      <div className="max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-white">Operations Console</h1>
            <p className="text-xs text-zinc-500 mt-0.5">
              Samsara Fleet + Equipment Tracker
              {lastRefresh && (
                <span className="ml-3">
                  Updated {lastRefresh.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </p>
          </div>
          <button
            onClick={loadData}
            disabled={loading}
            className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white border border-[#27272A] rounded-md px-3 py-1.5 transition-colors disabled:opacity-50"
          >
            <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>

        <AIInsightsBanner module="fleet" compact />

        {/* Quick Actions Bar */}
        <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-4">
          <div className="flex items-center flex-wrap gap-3">
            <Link
              href="/fleet-map"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FF5C00] hover:border-[#FF5C00]/30 transition-colors"
            >
              <MapPin size={14} />
              View Map
              <ArrowRight size={10} className="ml-1" />
            </Link>
            <button
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FF5C00] hover:border-[#FF5C00]/30 transition-colors cursor-not-allowed opacity-60"
              title="Maintenance scheduling coming soon"
            >
              <CalendarClock size={14} />
              Schedule Maintenance
            </button>
            <button
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FF5C00] hover:border-[#FF5C00]/30 transition-colors cursor-not-allowed opacity-60"
              title="Route optimization coming soon"
            >
              <Route size={14} />
              Run Route Optimization
            </button>
            <a
              href="https://equipment-tracker-tau.vercel.app"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-xs text-zinc-400 border border-[#27272A] rounded-lg hover:text-[#FF5C00] hover:border-[#FF5C00]/30 transition-colors"
            >
              <ExternalLink size={14} />
              Equipment Tracker
            </a>
          </div>
        </div>

        {/* Operator Dispatch Table */}
        {vehicles.length > 0 && (
          <DensitySection title="Dispatch Queue">
            <DensityTable
              columns={[
                { key: 'vehicle', label: 'Vehicle' },
                { key: 'driver', label: 'Driver' },
                { key: 'route', label: 'Route' },
                { key: 'status', label: 'Status' },
                { key: 'eta', label: 'ETA' },
              ]}
              data={vehicles.map((v) => ({
                vehicle: v.name,
                driver: '--',
                route: '--',
                status: v.status.charAt(0).toUpperCase() + v.status.slice(1),
                eta: '--',
              }))}
              sectionGroupBy="status"
            />
          </DensitySection>
        )}

        {/* KPI Cards */}
        {loading && vehicles.length === 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {kpis.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div key={kpi.label} className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[11px] text-zinc-500 font-medium uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <Icon size={14} className="text-zinc-600" />
                  </div>
                  <div className={`text-lg font-bold tabular-nums ${kpi.color}`}>
                    {kpi.value}
                  </div>
                  {kpi.subtext && (
                    <p className="text-[11px] text-zinc-500 mt-0.5">{kpi.subtext}</p>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Fleet Utilization Gauge */}
        {vehicles.length > 0 && (
          <div className="bg-[#18181B] border border-[#27272A] rounded-lg p-3.5">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-white">Fleet Utilization</h3>
              <span className="text-xs text-zinc-500 tabular-nums">
                {counts.active} active / {counts.total} total
              </span>
            </div>
            <div className="w-full h-3 bg-[#27272A] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{
                  width: `${utilizationPct}%`,
                  backgroundColor: utilizationPct > 75 ? '#22c55e' : utilizationPct > 50 ? '#eab308' : '#ef4444',
                }}
              />
            </div>
            <div className="flex items-center gap-3 mt-2">
              {[
                { label: 'Active', count: counts.active, color: 'bg-emerald-500' },
                { label: 'Idle', count: counts.idle, color: 'bg-amber-500' },
                { label: 'Maintenance', count: counts.maintenance, color: 'bg-blue-500' },
                { label: 'Offline', count: counts.offline, color: 'bg-zinc-600' },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${s.color}`} />
                  <span className="text-[10px] text-zinc-500">{s.label}: {s.count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 flex items-start gap-3">
            <AlertCircle size={16} className="text-amber-400 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm text-amber-300">{error}</p>
              <p className="text-xs text-zinc-500 mt-0.5">
                Ensure the Samsara gateway is running on port 3847.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* Vehicle Status Grid */}
          <div className="lg:col-span-2 rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
            <h2 className="text-xs font-semibold text-white mb-2.5">
              Vehicle Locations
              {counts.total > 0 && (
                <span className="ml-2 text-xs text-zinc-500 font-normal">
                  ({counts.total} vehicles)
                </span>
              )}
            </h2>
            {loading && vehicles.length === 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="animate-pulse rounded-md border border-[#27272A] bg-[#09090B] p-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-zinc-800 rounded-md" />
                      <div className="flex-1">
                        <div className="h-3 w-24 bg-zinc-800 rounded mb-1.5" />
                        <div className="h-2 w-16 bg-zinc-800 rounded" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : vehicles.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-32 text-center">
                <Truck size={24} className="text-zinc-700 mb-2" />
                <p className="text-sm text-zinc-500">No vehicles found</p>
                <p className="text-xs text-zinc-600 mt-0.5">Connect Samsara gateway for live fleet data</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {vehicles.map((v, i) => {
                  const style = STATUS_STYLES[v.status] ?? STATUS_STYLES.offline;
                  return (
                    <div
                      key={`${v.name}-${i}`}
                      className="flex items-center gap-3 rounded-md border border-[#27272A] bg-[#09090B] p-3 hover:border-[#FF5C00]/20 transition-colors"
                    >
                      <div className={`w-8 h-8 rounded-md flex items-center justify-center ${style.bg}`}>
                        <Truck size={14} className={style.text} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-white truncate">{v.name}</div>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} />
                          <span className={`text-xs capitalize ${style.text}`}>{v.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-4">
            {/* Driver Compliance */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5 flex items-center gap-2">
                <ShieldCheck size={14} className="text-emerald-400" />
                Driver Compliance
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">HOS Compliant</span>
                  <span className="text-sm text-emerald-400 font-medium">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">HOS Violations</span>
                  <span className="text-sm text-zinc-500 font-medium">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">DVIR Pending</span>
                  <span className="text-sm text-zinc-500 font-medium">--</span>
                </div>
                <p className="text-[10px] text-zinc-600 pt-1 border-t border-[#27272A]">
                  Awaiting Samsara driver/compliance data
                </p>
              </div>
            </div>

            {/* Fuel Efficiency */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5 flex items-center gap-2">
                <Fuel size={14} className="text-blue-400" />
                Fuel Metrics
              </h2>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Avg MPG</span>
                  <span className="text-sm text-zinc-500 font-medium">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Fuel Cost/Mile</span>
                  <span className="text-sm text-zinc-500 font-medium">--</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-zinc-500">Idle Fuel Waste</span>
                  <span className="text-sm text-zinc-500 font-medium">--</span>
                </div>
                <p className="text-[10px] text-zinc-600 pt-1 border-t border-[#27272A]">
                  Awaiting Samsara fuel consumption data
                </p>
              </div>
            </div>

            {/* Equipment Placeholder */}
            <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-3.5">
              <h2 className="text-xs font-semibold text-white mb-2.5">Equipment (Ascend)</h2>
              <div className="flex flex-col items-center justify-center h-20 text-center">
                <Wrench size={18} className="text-zinc-700 mb-2" />
                <p className="text-xs text-zinc-500">
                  Connect Ascend gateway for equipment data
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div className="space-y-2">
              <Link
                href="/fleet-map"
                className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#18181B] p-3 hover:border-[#FF5C00]/40 transition-colors group"
              >
                <MapPin size={14} className="text-zinc-600 group-hover:text-[#FF5C00] transition-colors" />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                  Fleet Map
                </span>
                <ArrowRight size={12} className="ml-auto text-zinc-700 group-hover:text-[#FF5C00] transition-colors" />
              </Link>
              <a
                href="https://equipment-tracker-tau.vercel.app"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 rounded-lg border border-[#27272A] bg-[#18181B] p-3 hover:border-[#FF5C00]/40 transition-colors group"
              >
                <ExternalLink size={14} className="text-zinc-600 group-hover:text-[#FF5C00] transition-colors" />
                <span className="text-sm text-zinc-300 group-hover:text-white transition-colors">
                  Equipment Tracker
                </span>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
