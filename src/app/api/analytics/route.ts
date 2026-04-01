import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getEnhancedUsageStats } from '@/lib/usage-logger';
import { getErrorStats } from '@/lib/usage-logger';
import { getFeedbackStats } from '@/lib/feedback';
import { loadRunHistory } from '@/lib/automations';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

// ── Types ─────────────────────────────────────────────────────

interface WorkspaceData {
  id: string;
  name: string;
  usageCount: number;
  rating?: number;
  ratingCount?: number;
  category: string;
}

interface AutomationRun {
  automationId: string;
  status: 'success' | 'error' | 'skipped';
  startedAt: string;
  completedAt?: string;
  error?: string;
}

interface AnalyticsResponse {
  success: boolean;
  cachedAt: string;
  usage: ReturnType<typeof getEnhancedUsageStats>;
  feedback: ReturnType<typeof getFeedbackStats>;
  errors: ReturnType<typeof getErrorStats>;
  workspaces: {
    total: number;
    items: WorkspaceData[];
  };
  automations: {
    totalRuns: number;
    successCount: number;
    errorCount: number;
    successRate: number;
    recentRuns: AutomationRun[];
  };
}

// ── Cache ─────────────────────────────────────────────────────

let cachedResponse: AnalyticsResponse | null = null;
let cachedAt = 0;
const CACHE_TTL_MS = 2 * 60 * 1000; // 2 minutes

// ── Helpers ───────────────────────────────────────────────────

function loadWorkspacesData(): WorkspaceData[] {
  const filePath = join(process.cwd(), 'data', 'workspaces.json');
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const workspaces = JSON.parse(raw) as WorkspaceData[];
    return (workspaces ?? []).map((w) => ({
      id: w.id,
      name: w.name,
      usageCount: w.usageCount ?? 0,
      rating: w.rating,
      ratingCount: w.ratingCount,
      category: w.category ?? 'custom',
    }));
  } catch {
    return [];
  }
}

function getAutomationStats(): AnalyticsResponse['automations'] {
  try {
    const runs = loadRunHistory() as AutomationRun[];
    const totalRuns = runs.length;
    const successCount = runs.filter((r) => r.status === 'success').length;
    const errorCount = runs.filter((r) => r.status === 'error').length;
    const successRate = totalRuns > 0 ? Math.round((successCount / totalRuns) * 100) : 0;
    const recentRuns = [...runs].reverse().slice(0, 10);
    return { totalRuns, successCount, errorCount, successRate, recentRuns };
  } catch {
    return { totalRuns: 0, successCount: 0, errorCount: 0, successRate: 0, recentRuns: [] };
  }
}

// ── Route Handler ─────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  // Auth: any authenticated user (or dev mode)
  if (process.env.NODE_ENV !== 'development') {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  }

  // Return cached if fresh
  if (cachedResponse && Date.now() - cachedAt < CACHE_TTL_MS) {
    return NextResponse.json(cachedResponse);
  }

  const usage = getEnhancedUsageStats();
  const feedback = getFeedbackStats();
  const errors = getErrorStats();
  const workspacesData = loadWorkspacesData();
  const automations = getAutomationStats();

  const response: AnalyticsResponse = {
    success: true,
    cachedAt: new Date().toISOString(),
    usage,
    feedback,
    errors,
    workspaces: {
      total: workspacesData.length,
      items: workspacesData,
    },
    automations,
  };

  cachedResponse = response;
  cachedAt = Date.now();

  return NextResponse.json(response);
}
