'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { Activity, RefreshCw, Trash2, Radio } from 'lucide-react';
import type { DomainEvent } from '@/lib/events/event-schema';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface EventsResponse {
  success: boolean;
  data?: DomainEvent[];
  meta?: { count: number };
  error?: string;
}

interface SpokeHealth {
  id: string;
  label: string;
  status: 'live' | 'dev' | 'deployed' | 'planned';
  url?: string;
}

interface SpokesResponse {
  success: boolean;
  data?: SpokeHealth[];
  error?: string;
}

// ---------------------------------------------------------------------------
// Domain colour mapping
// ---------------------------------------------------------------------------

const DOMAIN_COLORS: Record<string, { bg: string; text: string; dot: string }> = {
  finance:    { bg: 'bg-green-950',  text: 'text-green-400',  dot: 'bg-green-400'  },
  operations: { bg: 'bg-blue-950',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  portal:     { bg: 'bg-orange-950', text: 'text-orange-400', dot: 'bg-orange-400' },
  equipment:  { bg: 'bg-zinc-800',   text: 'text-zinc-300',   dot: 'bg-zinc-400'   },
  'signal-map':{ bg: 'bg-teal-950',  text: 'text-teal-400',   dot: 'bg-teal-400'   },
  gateway:    { bg: 'bg-violet-950', text: 'text-violet-400', dot: 'bg-violet-400' },
  nova:       { bg: 'bg-amber-950',  text: 'text-amber-400',  dot: 'bg-amber-400'  },
  order:      { bg: 'bg-green-950',  text: 'text-green-400',  dot: 'bg-green-400'  },
  invoice:    { bg: 'bg-green-950',  text: 'text-green-400',  dot: 'bg-green-400'  },
  feed:       { bg: 'bg-blue-950',   text: 'text-blue-400',   dot: 'bg-blue-400'   },
  alert:      { bg: 'bg-orange-950', text: 'text-orange-400', dot: 'bg-orange-400' },
  module:     { bg: 'bg-zinc-800',   text: 'text-zinc-300',   dot: 'bg-zinc-400'   },
  session:    { bg: 'bg-zinc-800',   text: 'text-zinc-300',   dot: 'bg-zinc-400'   },
  bot:        { bg: 'bg-violet-950', text: 'text-violet-400', dot: 'bg-violet-400' },
  automation: { bg: 'bg-violet-950', text: 'text-violet-400', dot: 'bg-violet-400' },
  anomaly:    { bg: 'bg-red-950',    text: 'text-red-400',    dot: 'bg-red-400'    },
};

const DEFAULT_DOMAIN_COLOR = { bg: 'bg-zinc-800', text: 'text-zinc-300', dot: 'bg-zinc-400' };

function getDomainColor(eventType: string) {
  const domain = eventType.split('.')[0] ?? '';
  return DOMAIN_COLORS[domain] ?? DEFAULT_DOMAIN_COLOR;
}

function isErrorEvent(type: string): boolean {
  return type.includes('error') || type.includes('failed');
}

// ---------------------------------------------------------------------------
// Formatters
// ---------------------------------------------------------------------------

function fmtTimestamp(ts: string | undefined): string {
  if (!ts) return '--';
  try {
    return new Date(ts).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
  } catch {
    return ts;
  }
}

function fmtFullTimestamp(ts: string | undefined): string {
  if (!ts) return '--';
  try {
    return new Date(ts).toISOString().replace('T', ' ').slice(0, 23);
  } catch {
    return ts ?? '--';
  }
}

function extractService(event: DomainEvent): string {
  const payload = event.payload as Record<string, unknown> | undefined;
  if (payload?.service && typeof payload.service === 'string') return payload.service;
  const parts = event.type.split('.');
  return parts[0] ?? '--';
}

// ---------------------------------------------------------------------------
// KPI Card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  value,
  color,
  loading,
}: {
  label: string;
  value: number | string;
  color?: string;
  loading: boolean;
}) {
  return (
    <div className="rounded-lg border border-[#27272A] bg-[#18181B] p-4">
      <p className="text-[10px] font-medium text-[#71717A] uppercase tracking-wide mb-1.5">{label}</p>
      {loading ? (
        <div className="h-7 w-12 rounded bg-[#27272A] animate-pulse" />
      ) : (
        <span className="text-lg font-bold font-mono" style={{ color: color ?? '#FAFAFA' }}>
          {value}
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function EventMonitorPage() {
  const [events, setEvents] = useState<DomainEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [spokes, setSpokes] = useState<SpokeHealth[]>([]);
  const [filterType, setFilterType] = useState('');
  const [filterService, setFilterService] = useState('');
  const [filterActor, setFilterActor] = useState('');
  const lastSeqRef = useRef<number>(0);
  const streamRef = useRef<HTMLDivElement>(null);

  const fetchEvents = useCallback(async (cursor?: number) => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor !== undefined && cursor > 0) {
        params.set('from_sequence', String(cursor));
      }
      const res = await fetch(`/api/events?${params.toString()}`);
      const data: EventsResponse = await res.json();
      if (!data.success || !Array.isArray(data.data)) return;

      const incoming = data.data;
      if (incoming.length === 0) return;

      const maxSeq = incoming.reduce((max, ev) => {
        const seq = ev.sequence_number ?? 0;
        return seq > max ? seq : max;
      }, lastSeqRef.current);
      lastSeqRef.current = maxSeq;

      if (cursor !== undefined && cursor > 0) {
        // Incremental update — prepend new events
        setEvents((prev) => [...incoming, ...prev].slice(0, 500));
      } else {
        setEvents(incoming);
      }
    } catch {
      // Silent — never crash the monitor
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSpokes = useCallback(async () => {
    try {
      const res = await fetch('/api/spokes?check=true');
      const data: SpokesResponse = await res.json();
      if (data.success && Array.isArray(data.data)) {
        setSpokes(data.data);
      }
    } catch {
      // Non-critical
    }
  }, []);

  // Initial load
  useEffect(() => {
    fetchEvents();
    fetchSpokes();
  }, [fetchEvents, fetchSpokes]);

  // Auto-refresh polling every 5 seconds
  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(() => {
      fetchEvents(lastSeqRef.current > 0 ? lastSeqRef.current : undefined);
    }, 5000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchEvents]);

  const handleClear = () => {
    setEvents([]);
    lastSeqRef.current = 0;
  };

  // Derived stats
  const totalEvents = events.length;
  const errorEvents = events.filter((e) => isErrorEvent(e.type)).length;

  // Events/hour: count events in last 60 minutes
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const eventsPerHour = events.filter((e) => {
    if (!e.timestamp) return false;
    return new Date(e.timestamp).getTime() > oneHourAgo;
  }).length;

  // Active consumers: unique actors in last 15 min
  const fifteenMinAgo = Date.now() - 15 * 60 * 1000;
  const activeConsumers = new Set(
    events
      .filter((e) => e.timestamp && new Date(e.timestamp).getTime() > fifteenMinAgo)
      .map((e) => e.actor_id)
      .filter(Boolean)
  ).size;

  // Build filter options
  const allTypes = Array.from(new Set(events.map((e) => e.type))).sort();
  const allServices = Array.from(
    new Set(events.map((e) => extractService(e)))
  ).sort();
  const allActors = Array.from(
    new Set(events.map((e) => e.actor_id ?? '').filter(Boolean))
  ).sort();

  // Apply filters
  const filtered = events.filter((e) => {
    if (filterType && e.type !== filterType) return false;
    if (filterService && extractService(e) !== filterService) return false;
    if (filterActor && (e.actor_id ?? '') !== filterActor) return false;
    return true;
  });

  const spokeStatusStyles: Record<string, string> = {
    live:     'text-green-400',
    deployed: 'text-green-400',
    dev:      'text-yellow-400',
    planned:  'text-zinc-500',
  };

  return (
    <div className="px-5 py-4 space-y-4 overflow-y-auto h-full bg-[#09090B] text-[#FAFAFA]">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Activity size={20} className="text-[#FE5000]" />
          <div>
            <h2 style={{ fontFamily: 'Georgia, serif' }} className="text-lg font-bold text-[#FAFAFA]">
              Event Monitor
            </h2>
            <p className="text-xs text-[#71717A] mt-0.5">Real-time event activity across the platform</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setAutoRefresh((v) => !v)}
            className={[
              'flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors',
              autoRefresh
                ? 'border-[#FE5000] text-[#FE5000] bg-[#FE5000]/10'
                : 'border-[#27272A] text-[#71717A] hover:text-[#A1A1AA]',
            ].join(' ')}
          >
            <Radio size={12} className={autoRefresh ? 'animate-pulse' : ''} />
            {autoRefresh ? 'Live' : 'Paused'}
          </button>
          <button
            onClick={() => fetchEvents()}
            className="flex items-center gap-1.5 rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-[#A1A1AA] hover:text-[#FAFAFA] transition-colors"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <button
            onClick={handleClear}
            className="flex items-center gap-1.5 rounded-md border border-[#27272A] px-3 py-1.5 text-xs font-medium text-[#A1A1AA] hover:text-red-400 transition-colors"
          >
            <Trash2 size={12} />
            Clear
          </button>
        </div>
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiCard label="Total Events" value={totalEvents} loading={loading} color="#FAFAFA" />
        <KpiCard label="Events / Hour" value={eventsPerHour} loading={loading} color="#22C55E" />
        <KpiCard label="Active Consumers" value={activeConsumers} loading={loading} color="#60A5FA" />
        <KpiCard label="Error Events" value={errorEvents} loading={loading} color={errorEvents > 0 ? '#EF4444' : '#71717A'} />
      </div>

      {/* Main area: stream + spoke health */}
      <div className="flex flex-col lg:flex-row gap-4">
        {/* Event Stream */}
        <div className="flex-1 rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
          {/* Filter bar */}
          <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b border-[#27272A] bg-[#09090B]">
            <span className="text-xs font-medium text-[#71717A]">Filter:</span>
            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-[#18181B] border border-[#27272A] text-xs text-[#A1A1AA] rounded px-2 py-1 focus:outline-none focus:border-[#52525B]"
            >
              <option value="">All types</option>
              {allTypes.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            <select
              value={filterService}
              onChange={(e) => setFilterService(e.target.value)}
              className="bg-[#18181B] border border-[#27272A] text-xs text-[#A1A1AA] rounded px-2 py-1 focus:outline-none focus:border-[#52525B]"
            >
              <option value="">All services</option>
              {allServices.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
            <select
              value={filterActor}
              onChange={(e) => setFilterActor(e.target.value)}
              className="bg-[#18181B] border border-[#27272A] text-xs text-[#A1A1AA] rounded px-2 py-1 focus:outline-none focus:border-[#52525B]"
            >
              <option value="">All actors</option>
              {allActors.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
            <span className="ml-auto text-[10px] text-[#52525B] font-mono">
              {filtered.length} events
            </span>
          </div>

          {/* Table */}
          <div ref={streamRef} className="overflow-y-auto max-h-[480px]">
            <table className="w-full text-xs">
              <thead className="sticky top-0 bg-[#09090B] z-10">
                <tr className="border-b border-[#27272A]">
                  <th className="text-left px-3 py-2 font-medium text-[#71717A] whitespace-nowrap">Timestamp</th>
                  <th className="text-left px-3 py-2 font-medium text-[#71717A]">Type</th>
                  <th className="text-left px-3 py-2 font-medium text-[#71717A]">Actor</th>
                  <th className="text-left px-3 py-2 font-medium text-[#71717A]">Service</th>
                  <th className="text-right px-3 py-2 font-medium text-[#71717A]">Seq</th>
                  <th className="text-left px-3 py-2 font-medium text-[#71717A]">Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[#52525B]">
                      Loading events...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-10 text-center text-[#52525B]">
                      No events yet. Events will appear here as platform activity is recorded.
                    </td>
                  </tr>
                ) : (
                  filtered.map((event, idx) => {
                    const domainColor = getDomainColor(event.type);
                    const isError = isErrorEvent(event.type);
                    const payload = event.payload as Record<string, unknown> | undefined;
                    const httpStatus = payload?.status as number | undefined;
                    const service = extractService(event);

                    return (
                      <tr
                        key={event.id ?? `evt-${idx}`}
                        className="border-b border-[#1F1F22] hover:bg-[#1F1F22] transition-colors"
                      >
                        <td className="px-3 py-2 font-mono text-[#52525B] whitespace-nowrap" title={fmtFullTimestamp(event.timestamp)}>
                          {fmtTimestamp(event.timestamp)}
                        </td>
                        <td className="px-3 py-2">
                          <span
                            className={[
                              'inline-flex items-center gap-1 rounded px-1.5 py-0.5 font-mono text-[10px]',
                              domainColor.bg,
                              domainColor.text,
                            ].join(' ')}
                          >
                            <span className={['w-1 h-1 rounded-full shrink-0', domainColor.dot].join(' ')} />
                            {event.type}
                          </span>
                        </td>
                        <td className="px-3 py-2 text-[#A1A1AA] font-mono truncate max-w-[140px]">
                          {event.actor_id ?? '--'}
                        </td>
                        <td className="px-3 py-2 text-[#A1A1AA]">{service}</td>
                        <td className="px-3 py-2 text-right font-mono text-[#52525B]">
                          {event.sequence_number ?? '--'}
                        </td>
                        <td className="px-3 py-2">
                          {isError ? (
                            <span className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] bg-red-950 text-red-400">
                              error
                            </span>
                          ) : httpStatus ? (
                            <span
                              className={[
                                'inline-flex items-center rounded px-1.5 py-0.5 font-mono text-[10px]',
                                httpStatus >= 200 && httpStatus < 300
                                  ? 'bg-green-950 text-green-400'
                                  : httpStatus >= 400
                                  ? 'bg-red-950 text-red-400'
                                  : 'bg-zinc-800 text-zinc-300',
                              ].join(' ')}
                            >
                              {httpStatus}
                            </span>
                          ) : (
                            <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] bg-green-950 text-green-400">
                              ok
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Spoke Health Panel */}
        <div className="lg:w-64 shrink-0 rounded-lg border border-[#27272A] bg-[#18181B] overflow-hidden">
          <div className="px-3 py-2 border-b border-[#27272A] bg-[#09090B]">
            <h3 className="text-xs font-semibold text-[#FAFAFA]">Spoke Health</h3>
          </div>
          <div className="p-3 space-y-2">
            {spokes.length === 0 ? (
              <p className="text-xs text-[#52525B] py-4 text-center">No spoke data</p>
            ) : (
              spokes.map((spoke) => (
                <div key={spoke.id} className="flex items-center justify-between rounded border border-[#27272A] px-3 py-2">
                  <span className="text-xs text-[#A1A1AA]">{spoke.label}</span>
                  <span className={['text-[10px] font-medium uppercase', spokeStatusStyles[spoke.status] ?? 'text-zinc-500'].join(' ')}>
                    {spoke.status}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
