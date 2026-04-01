'use client';

import { useState, useEffect, useCallback } from 'react';
import { RefreshCw, Play, Square, Database, Clock, AlertTriangle, CheckCircle2, Loader2 } from 'lucide-react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TableStatus {
  tableName: string;
  eventType: string;
  interval: number;
  lastRunAt: string | null;
  lastRecordCount: number;
  lastError: string | null;
  running: boolean;
}

interface StatusResponse {
  loopActive: boolean;
  tables: TableStatus[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function relativeTime(iso: string | null): string {
  if (!iso) return 'Never';
  const diff = Date.now() - new Date(iso).getTime();
  if (diff < 60_000) return `${Math.round(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.round(diff / 60_000)}m ago`;
  return `${Math.round(diff / 3_600_000)}h ago`;
}

function intervalLabel(seconds: number): string {
  if (seconds >= 3600) return `${seconds / 3600}h`;
  if (seconds >= 60) return `${seconds / 60}m`;
  return `${seconds}s`;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IngestionPage() {
  const [data, setData] = useState<StatusResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/ingestion');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as StatusResponse;
      setData(json);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch status');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchStatus();
    const id = setInterval(() => void fetchStatus(), 10_000);
    return () => clearInterval(id);
  }, [fetchStatus]);

  const handleToggle = async () => {
    if (!data) return;
    const action = data.loopActive ? 'stop' : 'start';
    setActionLoading(action);
    try {
      await fetch('/api/ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      await fetchStatus();
    } catch {
      // swallow — next poll will update
    } finally {
      setActionLoading(null);
    }
  };

  const handleRunNow = async (tableName: string) => {
    setActionLoading(tableName);
    try {
      await fetch('/api/ingestion', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tableName }),
      });
      await fetchStatus();
    } catch {
      // swallow
    } finally {
      setActionLoading(null);
    }
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-[#71717A]">
        <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading ingestion status...
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="p-6 text-red-400">
        <AlertTriangle className="inline w-4 h-4 mr-2" />
        {error}
      </div>
    );
  }

  const tables = data?.tables ?? [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-white">Ascend Ingestion</h1>
          <p className="text-sm text-[#71717A] mt-1">
            Event pipeline from Ascend ERP &mdash; {tables.length} tables configured
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => void fetchStatus()}
            className="p-2 rounded-lg border border-[#27272A] hover:border-[#3F3F46] text-[#A1A1AA] hover:text-white transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          <button
            onClick={() => void handleToggle()}
            disabled={actionLoading !== null}
            className={[
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              data?.loopActive
                ? 'bg-red-500/10 text-red-400 border border-red-500/30 hover:bg-red-500/20'
                : 'bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20',
            ].join(' ')}
          >
            {data?.loopActive ? (
              <>
                <Square className="w-4 h-4" /> Stop Loop
              </>
            ) : (
              <>
                <Play className="w-4 h-4" /> Start Loop
              </>
            )}
          </button>
        </div>
      </div>

      {/* Table Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {tables.map((t) => (
          <div
            key={t.tableName}
            className="rounded-xl border border-[#27272A] bg-[#18181B] p-4 space-y-3"
          >
            {/* Card header */}
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-[#FE5000]" />
                <span className="text-sm font-medium text-white">{t.tableName}</span>
              </div>
              <StatusBadge running={t.running} hasError={t.lastError !== null} />
            </div>

            {/* Event type */}
            <p className="text-xs text-[#71717A] font-mono">{t.eventType}</p>

            {/* Stats row */}
            <div className="flex items-center gap-4 text-xs text-[#A1A1AA]">
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {relativeTime(t.lastRunAt)}
              </span>
              <span>{t.lastRecordCount} records</span>
              <span className="ml-auto text-[#71717A]">every {intervalLabel(t.interval)}</span>
            </div>

            {/* Error */}
            {t.lastError && (
              <p className="text-xs text-red-400 truncate" title={t.lastError}>
                <AlertTriangle className="inline w-3 h-3 mr-1" />
                {t.lastError}
              </p>
            )}

            {/* Run now */}
            <button
              onClick={() => void handleRunNow(t.tableName)}
              disabled={actionLoading === t.tableName}
              className="w-full py-1.5 text-xs font-medium rounded-lg border border-[#27272A] text-[#A1A1AA] hover:text-white hover:border-[#3F3F46] transition-colors flex items-center justify-center gap-1.5"
            >
              {actionLoading === t.tableName ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <Play className="w-3 h-3" />
              )}
              Run Now
            </button>
          </div>
        ))}
      </div>

      {/* Status footer */}
      {error && (
        <p className="text-xs text-red-400">
          <AlertTriangle className="inline w-3 h-3 mr-1" />
          Polling error: {error}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ running, hasError }: { running: boolean; hasError: boolean }) {
  if (hasError) {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-red-500/10 text-red-400">
        <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
        Error
      </span>
    );
  }

  if (running) {
    return (
      <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-400">
        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
        Running
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-[#27272A] text-[#71717A]">
      <span className="w-1.5 h-1.5 rounded-full bg-[#52525B]" />
      Idle
    </span>
  );
}
