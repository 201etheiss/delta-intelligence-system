import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

export interface UsageEntry {
  timestamp: string;
  userEmail: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
  estimatedCost: number;
  endpoints?: string[];
}

interface UsageLog {
  entries: UsageEntry[];
}

// Cost per 1K tokens by model family
const COST_PER_1K: Record<string, { input: number; output: number }> = {
  'claude-3-5-haiku': { input: 0.001, output: 0.005 },
  'claude-3-5-sonnet': { input: 0.003, output: 0.015 },
  'claude-3-opus': { input: 0.015, output: 0.075 },
  'claude-sonnet-4': { input: 0.003, output: 0.015 },
  'claude-haiku': { input: 0.001, output: 0.005 },
};

function getLogPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/usage-log.json';
  }
  return path.join(process.cwd(), 'data', 'usage-log.json');
}

function readLog(): UsageLog {
  const logPath = getLogPath();
  if (!existsSync(logPath)) {
    return { entries: [] };
  }
  try {
    const raw = readFileSync(logPath, 'utf-8');
    return JSON.parse(raw) as UsageLog;
  } catch {
    return { entries: [] };
  }
}

function writeLog(log: UsageLog): void {
  const logPath = getLogPath();
  writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf-8');
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const key = Object.keys(COST_PER_1K).find((k) => model.toLowerCase().includes(k));
  const rates = key ? COST_PER_1K[key] : { input: 0.003, output: 0.015 };
  return (inputTokens / 1000) * rates.input + (outputTokens / 1000) * rates.output;
}

export function appendUsage(entry: UsageEntry): void {
  const log = readLog();
  log.entries.push(entry);
  // Keep only last 10,000 entries to prevent unbounded growth
  if (log.entries.length > 10_000) {
    log.entries = log.entries.slice(-10_000);
  }
  writeLog(log);
}

export interface UsageStats {
  today: { queries: number; inputTokens: number; outputTokens: number; cost: number };
  thisWeek: { queries: number; inputTokens: number; outputTokens: number; cost: number };
  thisMonth: { queries: number; inputTokens: number; outputTokens: number; cost: number };
  allTime: { queries: number; inputTokens: number; outputTokens: number; cost: number };
  byModel: Record<string, { queries: number; inputTokens: number; outputTokens: number; cost: number }>;
  recentEntries: UsageEntry[];
}

function sumEntries(entries: UsageEntry[]) {
  return entries.reduce(
    (acc, e) => ({
      queries: acc.queries + 1,
      inputTokens: acc.inputTokens + e.inputTokens,
      outputTokens: acc.outputTokens + e.outputTokens,
      cost: acc.cost + e.estimatedCost,
    }),
    { queries: 0, inputTokens: 0, outputTokens: 0, cost: 0 }
  );
}

export function getUsageStats(): UsageStats {
  const log = readLog();
  const now = new Date();

  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayOfWeek = now.getDay();
  const startOfWeek = new Date(startOfDay);
  startOfWeek.setDate(startOfWeek.getDate() - dayOfWeek);
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const todayEntries = log.entries.filter((e) => new Date(e.timestamp) >= startOfDay);
  const weekEntries = log.entries.filter((e) => new Date(e.timestamp) >= startOfWeek);
  const monthEntries = log.entries.filter((e) => new Date(e.timestamp) >= startOfMonth);

  const byModel: Record<string, { queries: number; inputTokens: number; outputTokens: number; cost: number }> = {};
  for (const entry of log.entries) {
    const modelKey = normalizeModelName(entry.model);
    if (!byModel[modelKey]) {
      byModel[modelKey] = { queries: 0, inputTokens: 0, outputTokens: 0, cost: 0 };
    }
    byModel[modelKey].queries += 1;
    byModel[modelKey].inputTokens += entry.inputTokens;
    byModel[modelKey].outputTokens += entry.outputTokens;
    byModel[modelKey].cost += entry.estimatedCost;
  }

  return {
    today: sumEntries(todayEntries),
    thisWeek: sumEntries(weekEntries),
    thisMonth: sumEntries(monthEntries),
    allTime: sumEntries(log.entries),
    byModel,
    recentEntries: log.entries.slice(-50).reverse(),
  };
}

function normalizeModelName(model: string): string {
  const lower = model.toLowerCase();
  if (lower.includes('haiku')) return 'Haiku';
  if (lower.includes('opus')) return 'Opus';
  if (lower.includes('sonnet')) return 'Sonnet';
  if (lower.includes('gpt')) return 'GPT-4o';
  if (lower.includes('gemini')) return 'Gemini Flash';
  return model;
}

// --- Error logging ---

export interface ErrorEntry {
  timestamp: string;
  endpoint: string;
  error: string;
  statusCode?: number;
}

interface ErrorLog {
  entries: ErrorEntry[];
}

function getErrorLogPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/error-log.json';
  }
  return path.join(process.cwd(), 'data', 'error-log.json');
}

function readErrorLog(): ErrorLog {
  const logPath = getErrorLogPath();
  if (!existsSync(logPath)) {
    return { entries: [] };
  }
  try {
    const raw = readFileSync(logPath, 'utf-8');
    return JSON.parse(raw) as ErrorLog;
  } catch {
    return { entries: [] };
  }
}

function writeErrorLog(log: ErrorLog): void {
  const logPath = getErrorLogPath();
  writeFileSync(logPath, JSON.stringify(log, null, 2), 'utf-8');
}

export function logError(entry: ErrorEntry): void {
  const log = readErrorLog();
  log.entries.push(entry);
  if (log.entries.length > 5_000) {
    log.entries = log.entries.slice(-5_000);
  }
  writeErrorLog(log);
}

export interface ErrorStats {
  total: number;
  last24h: number;
  byEndpoint: Record<string, number>;
  recentErrors: ErrorEntry[];
}

export function getErrorStats(): ErrorStats {
  const log = readErrorLog();
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;

  const last24h = log.entries.filter((e) => new Date(e.timestamp).getTime() >= oneDayAgo).length;

  const byEndpoint: Record<string, number> = {};
  for (const entry of log.entries) {
    byEndpoint[entry.endpoint] = (byEndpoint[entry.endpoint] ?? 0) + 1;
  }

  return {
    total: log.entries.length,
    last24h,
    byEndpoint,
    recentErrors: log.entries.slice(-20).reverse(),
  };
}

// --- Enhanced usage stats ---

export interface TopUser {
  email: string;
  queries: number;
  tokens: number;
  cost: number;
}

export interface TopEndpoint {
  endpoint: string;
  calls: number;
}

export interface EnhancedUsageStats extends UsageStats {
  topUsers: TopUser[];
  topEndpoints: TopEndpoint[];
}

export function getEnhancedUsageStats(): EnhancedUsageStats {
  const base = getUsageStats();
  const log = readLog();

  const userMap: Record<string, { queries: number; tokens: number; cost: number }> = {};
  const endpointMap: Record<string, number> = {};

  for (const entry of log.entries) {
    const email = entry.userEmail || 'anonymous';
    if (!userMap[email]) {
      userMap[email] = { queries: 0, tokens: 0, cost: 0 };
    }
    userMap[email].queries += 1;
    userMap[email].tokens += entry.inputTokens + entry.outputTokens;
    userMap[email].cost += entry.estimatedCost;

    for (const ep of entry.endpoints ?? []) {
      endpointMap[ep] = (endpointMap[ep] ?? 0) + 1;
    }
  }

  const topUsers: TopUser[] = Object.entries(userMap)
    .map(([email, data]) => ({ email, ...data }))
    .sort((a, b) => b.queries - a.queries);

  const topEndpoints: TopEndpoint[] = Object.entries(endpointMap)
    .map(([endpoint, calls]) => ({ endpoint, calls }))
    .sort((a, b) => b.calls - a.calls);

  return { ...base, topUsers, topEndpoints };
}

export function getRawEntries(): UsageEntry[] {
  const log = readLog();
  return log.entries;
}

// ── Intelligence Usage Events ───────────────────────────────
// Tracks page visits, chat queries, report gen, data source usage
// for the smart suggestions engine. Stored in a separate file.

import type { UserRole } from '@/lib/config/roles';

export interface IntelligenceUsageEvent {
  type: 'page_visit' | 'chat_query' | 'report_generated' | 'data_source_query' | 'suggestion_request' | 'automation_triggered';
  page?: string;
  query?: string;
  dataSource?: string;
  reportType?: string;
  role: UserRole;
  userEmail?: string;
  timestamp?: string;
}

interface StoredIntelligenceEvent extends IntelligenceUsageEvent {
  id: string;
  timestamp: string;
}

interface IntelligenceUsageLog {
  events: StoredIntelligenceEvent[];
}

const INTEL_LOG_PATH = path.join(process.cwd(), 'data', 'intelligence-usage.json');
const MAX_INTEL_EVENTS = 5000;
const INTEL_WINDOW_DAYS = 30;

function readIntelLog(): IntelligenceUsageLog {
  if (!existsSync(INTEL_LOG_PATH)) return { events: [] };
  try {
    const raw = readFileSync(INTEL_LOG_PATH, 'utf-8');
    return JSON.parse(raw) as IntelligenceUsageLog;
  } catch {
    return { events: [] };
  }
}

function writeIntelLog(log: IntelligenceUsageLog): void {
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INTEL_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString();

  const pruned = log.events
    .filter((e) => e.timestamp >= cutoffStr)
    .slice(-MAX_INTEL_EVENTS);

  writeFileSync(INTEL_LOG_PATH, JSON.stringify({ events: pruned }, null, 2), 'utf-8');
}

export function logUsageEvent(event: IntelligenceUsageEvent): void {
  const log = readIntelLog();
  const stored: StoredIntelligenceEvent = {
    ...event,
    id: `intel_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: event.timestamp ?? new Date().toISOString(),
  };

  try {
    writeIntelLog({ events: [...log.events, stored] });
  } catch {
    // Usage logging is non-critical — never block the main flow
  }
}

export interface IntelligenceAnalytics {
  topPages: Array<{ page: string; count: number }>;
  topQueries: Array<{ query: string; count: number }>;
  topDataSources: Array<{ source: string; count: number }>;
  topReports: Array<{ report: string; count: number }>;
  byRole: Record<string, number>;
  totalEvents: number;
  windowDays: number;
}

export function getIntelligenceAnalytics(filterRole?: UserRole): IntelligenceAnalytics {
  const log = readIntelLog();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - INTEL_WINDOW_DAYS);
  const cutoffStr = cutoff.toISOString();

  let events = log.events.filter((e) => e.timestamp >= cutoffStr);
  if (filterRole) {
    events = events.filter((e) => e.role === filterRole);
  }

  const pageCounts: Record<string, number> = {};
  const queryCounts: Record<string, number> = {};
  const sourceCounts: Record<string, number> = {};
  const reportCounts: Record<string, number> = {};
  const byRole: Record<string, number> = {};

  for (const e of events) {
    byRole[e.role] = (byRole[e.role] ?? 0) + 1;

    if (e.type === 'page_visit' && e.page) {
      pageCounts[e.page] = (pageCounts[e.page] ?? 0) + 1;
    }
    if (e.type === 'chat_query' && e.query) {
      const normalized = e.query.toLowerCase().trim().slice(0, 80);
      queryCounts[normalized] = (queryCounts[normalized] ?? 0) + 1;
    }
    if (e.type === 'data_source_query' && e.dataSource) {
      sourceCounts[e.dataSource] = (sourceCounts[e.dataSource] ?? 0) + 1;
    }
    if (e.type === 'report_generated' && e.reportType) {
      reportCounts[e.reportType] = (reportCounts[e.reportType] ?? 0) + 1;
    }
  }

  const toSorted = (map: Record<string, number>, limit: number) =>
    Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit);

  return {
    topPages: toSorted(pageCounts, 10).map(([page, count]) => ({ page, count })),
    topQueries: toSorted(queryCounts, 10).map(([query, count]) => ({ query, count })),
    topDataSources: toSorted(sourceCounts, 10).map(([source, count]) => ({ source, count })),
    topReports: toSorted(reportCounts, 10).map(([report, count]) => ({ report, count })),
    byRole,
    totalEvents: events.length,
    windowDays: INTEL_WINDOW_DAYS,
  };
}

/**
 * Get suggestions based on what similar roles do most.
 */
export function getRoleBasedSuggestions(role: UserRole): Array<{ action: string; frequency: number }> {
  const analytics = getIntelligenceAnalytics(role);
  const suggestions: Array<{ action: string; frequency: number }> = [];

  for (const page of analytics.topPages.slice(0, 3)) {
    suggestions.push({
      action: `Visit ${page.page} — used ${page.count} times by ${role} users`,
      frequency: page.count,
    });
  }

  for (const query of analytics.topQueries.slice(0, 3)) {
    suggestions.push({
      action: `"${query.query}" — asked ${query.count} times`,
      frequency: query.count,
    });
  }

  return suggestions.sort((a, b) => b.frequency - a.frequency).slice(0, 5);
}
