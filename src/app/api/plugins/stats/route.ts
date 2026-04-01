import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getUserRole } from '@/lib/config/roles';
import { loadPlugins, getPlugin, getPluginLogs } from '@/lib/plugins/registry';

// ── Stats computation ────────────────────────────────────────

interface PluginStats {
  readonly pluginId: string;
  readonly pluginName: string;
  readonly totalCalls: number;
  readonly avgRating: number;
  readonly totalCost: number;
  readonly avgLatencyMs: number;
  readonly errorCount: number;
  readonly reliability: number;
}

function computeStats(pluginId: string, pluginName: string): PluginStats {
  const logs = getPluginLogs(pluginId, 500);

  if (logs.length === 0) {
    // Fall back to plugin-level counters
    const plugin = getPlugin(pluginId);
    return {
      pluginId,
      pluginName,
      totalCalls: plugin?.totalCalls ?? 0,
      avgRating: plugin?.avgRating ?? 0,
      totalCost: plugin?.totalCost ?? 0,
      avgLatencyMs: 0,
      errorCount: 0,
      reliability: plugin?.reliabilityScore ?? 1,
    };
  }

  const totalCalls = logs.length;
  const ratedLogs = logs.filter((l) => l.userRating != null);
  const avgRating = ratedLogs.length > 0
    ? ratedLogs.reduce((sum, l) => sum + (l.userRating ?? 0), 0) / ratedLogs.length
    : 0;

  const totalCost = logs.reduce((sum, l) => sum + l.estimatedCost, 0);
  const avgLatencyMs = logs.reduce((sum, l) => sum + l.latencyMs, 0) / totalCalls;
  const errorCount = logs.filter((l) => l.responseStatus !== 'success').length;
  const reliability = (totalCalls - errorCount) / totalCalls;

  return {
    pluginId,
    pluginName,
    totalCalls,
    avgRating: Math.round(avgRating * 100) / 100,
    totalCost: Math.round(totalCost * 10000) / 10000,
    avgLatencyMs: Math.round(avgLatencyMs),
    errorCount,
    reliability: Math.round(reliability * 1000) / 1000,
  };
}

// ── GET: Plugin analytics ────────────────────────────────────

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email && process.env.NODE_ENV !== 'development') {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  const email = session?.user?.email ?? 'dev@delta360.energy';
  const role = getUserRole(email);
  if (!role) {
    return NextResponse.json({ success: false, error: 'Authentication required' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const pluginId = searchParams.get('pluginId');

    // Single plugin stats
    if (pluginId) {
      const plugin = getPlugin(pluginId);
      if (!plugin) {
        return NextResponse.json({ success: false, error: 'Plugin not found' }, { status: 404 });
      }
      const stats = computeStats(pluginId, plugin.name);
      return NextResponse.json({ success: true, data: stats });
    }

    // Aggregated stats for all plugins
    const plugins = loadPlugins();
    const allStats = plugins.map((p) => computeStats(p.id, p.name));

    return NextResponse.json({
      success: true,
      data: allStats,
      count: allStats.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to compute stats';
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
