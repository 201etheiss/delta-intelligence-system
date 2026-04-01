/**
 * Feedback Loop Integration
 *
 * Tracks AI suggestion acceptance/dismissal, feeds acceptance rates back
 * into smart-suggestions for improved ranking, tracks verification gate
 * failure patterns to prioritize fixes, and learns from anomaly dismissals
 * to reduce alert fatigue.
 *
 * Stored in data/feedback-loop.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────

export interface SuggestionFeedback {
  id: string;
  suggestionText: string;
  category: string;
  action: 'accepted' | 'dismissed' | 'modified';
  userEmail: string;
  timestamp: string;
  context?: string;
}

export interface GateFailureRecord {
  id: string;
  gate: string;
  checkName: string;
  severity: 'info' | 'warn' | 'error';
  message: string;
  timestamp: string;
  resolved: boolean;
  resolvedAt?: string;
}

export interface AnomalyFeedback {
  id: string;
  anomalyId: string;
  metric: string;
  action: 'acknowledged' | 'dismissed' | 'escalated';
  userEmail: string;
  timestamp: string;
  reason?: string;
}

export interface AutomationEffectiveness {
  id: string;
  ruleId: string;
  ruleName: string;
  executionCount: number;
  successCount: number;
  failCount: number;
  lastRun: string;
  userOverrides: number;
  effectivenessScore: number; // 0-1
}

export interface FeedbackLoopData {
  suggestions: SuggestionFeedback[];
  gateFailures: GateFailureRecord[];
  anomalyFeedback: AnomalyFeedback[];
  automationStats: AutomationEffectiveness[];
  lastUpdated: string;
}

export interface SuggestionWeight {
  category: string;
  text: string;
  acceptanceRate: number;
  totalInteractions: number;
  weight: number; // computed: higher = more likely to recommend
}

// ── File I/O ─────────────────────────────────────────────────

function getFilePath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/feedback-loop.json';
  }
  return join(process.cwd(), 'data', 'feedback-loop.json');
}

function readData(): FeedbackLoopData {
  const filePath = getFilePath();
  if (!existsSync(filePath)) {
    return { suggestions: [], gateFailures: [], anomalyFeedback: [], automationStats: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as FeedbackLoopData;
    return {
      suggestions: data.suggestions ?? [],
      gateFailures: data.gateFailures ?? [],
      anomalyFeedback: data.anomalyFeedback ?? [],
      automationStats: data.automationStats ?? [],
      lastUpdated: data.lastUpdated ?? new Date().toISOString(),
    };
  } catch {
    return { suggestions: [], gateFailures: [], anomalyFeedback: [], automationStats: [], lastUpdated: new Date().toISOString() };
  }
}

function writeData(data: FeedbackLoopData): void {
  const filePath = getFilePath();
  try {
    const dir = join(filePath, '..');
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    // Cap arrays to prevent unbounded growth
    const trimmed: FeedbackLoopData = {
      suggestions: (data.suggestions ?? []).slice(-5000),
      gateFailures: (data.gateFailures ?? []).slice(-2000),
      anomalyFeedback: (data.anomalyFeedback ?? []).slice(-3000),
      automationStats: (data.automationStats ?? []).slice(-500),
      lastUpdated: new Date().toISOString(),
    };
    writeFileSync(filePath, JSON.stringify(trimmed, null, 2));
  } catch {
    // Silent fail
  }
}

function generateId(): string {
  return `fl_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ── Suggestion Tracking ──────────────────────────────────────

export function trackSuggestion(
  suggestionText: string,
  category: string,
  action: SuggestionFeedback['action'],
  userEmail: string,
  context?: string,
): SuggestionFeedback {
  const data = readData();
  const entry: SuggestionFeedback = {
    id: generateId(),
    suggestionText,
    category,
    action,
    userEmail,
    timestamp: new Date().toISOString(),
    context,
  };
  data.suggestions.push(entry);
  writeData(data);
  return entry;
}

export function getSuggestionWeights(): SuggestionWeight[] {
  const data = readData();
  const suggestions = data.suggestions ?? [];

  // Group by category + text
  const grouped: Record<string, { accepted: number; total: number }> = {};
  for (const s of suggestions) {
    const key = `${s.category}::${s.suggestionText}`;
    if (!grouped[key]) grouped[key] = { accepted: 0, total: 0 };
    grouped[key].total++;
    if (s.action === 'accepted' || s.action === 'modified') {
      grouped[key].accepted++;
    }
  }

  return Object.entries(grouped).map(([key, stats]) => {
    const [category, ...textParts] = key.split('::');
    const text = textParts.join('::');
    const acceptanceRate = stats.total > 0 ? stats.accepted / stats.total : 0;
    // Weight: acceptance rate boosted by interaction count (more data = more confident)
    const confidenceMultiplier = Math.min(1, stats.total / 10); // caps at 10 interactions
    const weight = acceptanceRate * confidenceMultiplier;
    return {
      category,
      text,
      acceptanceRate: Math.round(acceptanceRate * 100) / 100,
      totalInteractions: stats.total,
      weight: Math.round(weight * 100) / 100,
    };
  }).sort((a, b) => b.weight - a.weight);
}

// ── Gate Failure Tracking ────────────────────────────────────

export function recordGateFailure(
  gate: string,
  checkName: string,
  severity: GateFailureRecord['severity'],
  message: string,
): GateFailureRecord {
  const data = readData();
  const entry: GateFailureRecord = {
    id: generateId(),
    gate,
    checkName,
    severity,
    message,
    timestamp: new Date().toISOString(),
    resolved: false,
  };
  data.gateFailures.push(entry);
  writeData(data);
  return entry;
}

export function resolveGateFailure(failureId: string): boolean {
  const data = readData();
  const idx = (data.gateFailures ?? []).findIndex(f => f.id === failureId);
  if (idx < 0) return false;

  const updated = { ...data.gateFailures[idx], resolved: true, resolvedAt: new Date().toISOString() };
  const newFailures = [...data.gateFailures];
  newFailures[idx] = updated;
  writeData({ ...data, gateFailures: newFailures });
  return true;
}

export function getOpenGateFailures(): GateFailureRecord[] {
  const data = readData();
  return (data.gateFailures ?? []).filter(f => !f.resolved).sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  );
}

export function getGateFailurePatterns(): Array<{ gate: string; checkName: string; count: number; lastSeen: string }> {
  const data = readData();
  const failures = data.gateFailures ?? [];
  const patterns: Record<string, { count: number; lastSeen: string }> = {};

  for (const f of failures) {
    const key = `${f.gate}::${f.checkName}`;
    if (!patterns[key]) {
      patterns[key] = { count: 0, lastSeen: f.timestamp };
    }
    patterns[key].count++;
    if (new Date(f.timestamp).getTime() > new Date(patterns[key].lastSeen).getTime()) {
      patterns[key].lastSeen = f.timestamp;
    }
  }

  return Object.entries(patterns)
    .map(([key, stats]) => {
      const [gate, checkName] = key.split('::');
      return { gate, checkName, ...stats };
    })
    .sort((a, b) => b.count - a.count);
}

// ── Anomaly Feedback ─────────────────────────────────────────

export function trackAnomalyFeedback(
  anomalyId: string,
  metric: string,
  action: AnomalyFeedback['action'],
  userEmail: string,
  reason?: string,
): AnomalyFeedback {
  const data = readData();
  const entry: AnomalyFeedback = {
    id: generateId(),
    anomalyId,
    metric,
    action,
    userEmail,
    timestamp: new Date().toISOString(),
    reason,
  };
  data.anomalyFeedback.push(entry);
  writeData(data);
  return entry;
}

export function getAnomalyDismissalRate(metric?: string): { metric: string; dismissals: number; total: number; rate: number }[] {
  const data = readData();
  const feedback = data.anomalyFeedback ?? [];

  const grouped: Record<string, { dismissed: number; total: number }> = {};
  for (const f of feedback) {
    if (metric && f.metric !== metric) continue;
    if (!grouped[f.metric]) grouped[f.metric] = { dismissed: 0, total: 0 };
    grouped[f.metric].total++;
    if (f.action === 'dismissed') grouped[f.metric].dismissed++;
  }

  return Object.entries(grouped)
    .map(([m, stats]) => ({
      metric: m,
      dismissals: stats.dismissed,
      total: stats.total,
      rate: stats.total > 0 ? Math.round((stats.dismissed / stats.total) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate);
}

// ── Automation Effectiveness ─────────────────────────────────

export function recordAutomationRun(ruleId: string, ruleName: string, success: boolean, userOverride: boolean): void {
  const data = readData();
  const stats = data.automationStats ?? [];
  const idx = stats.findIndex(s => s.ruleId === ruleId);

  if (idx >= 0) {
    const existing = stats[idx];
    const updated: AutomationEffectiveness = {
      ...existing,
      executionCount: existing.executionCount + 1,
      successCount: existing.successCount + (success ? 1 : 0),
      failCount: existing.failCount + (success ? 0 : 1),
      lastRun: new Date().toISOString(),
      userOverrides: existing.userOverrides + (userOverride ? 1 : 0),
      effectivenessScore: 0, // recalculated below
    };
    // Effectiveness = success rate * (1 - override rate)
    const successRate = updated.executionCount > 0 ? updated.successCount / updated.executionCount : 0;
    const overrideRate = updated.executionCount > 0 ? updated.userOverrides / updated.executionCount : 0;
    updated.effectivenessScore = Math.round(successRate * (1 - overrideRate) * 100) / 100;

    const newStats = [...stats];
    newStats[idx] = updated;
    writeData({ ...data, automationStats: newStats });
  } else {
    const newEntry: AutomationEffectiveness = {
      id: generateId(),
      ruleId,
      ruleName,
      executionCount: 1,
      successCount: success ? 1 : 0,
      failCount: success ? 0 : 1,
      lastRun: new Date().toISOString(),
      userOverrides: userOverride ? 1 : 0,
      effectivenessScore: success && !userOverride ? 1 : 0,
    };
    writeData({ ...data, automationStats: [...stats, newEntry] });
  }
}

export function getLowValueAutomations(threshold: number = 0.3): AutomationEffectiveness[] {
  const data = readData();
  return (data.automationStats ?? [])
    .filter(s => s.effectivenessScore < threshold && s.executionCount >= 5)
    .sort((a, b) => a.effectivenessScore - b.effectivenessScore);
}

// ── Summary ──────────────────────────────────────────────────

export interface FeedbackLoopSummary {
  totalSuggestionInteractions: number;
  overallAcceptanceRate: number;
  topAcceptedCategories: Array<{ category: string; rate: number }>;
  openGateFailures: number;
  topFailurePatterns: Array<{ gate: string; checkName: string; count: number }>;
  anomalyDismissalRate: number;
  lowValueAutomations: number;
}

export function getFeedbackLoopSummary(): FeedbackLoopSummary {
  const data = readData();
  const suggestions = data.suggestions ?? [];
  const accepted = suggestions.filter(s => s.action === 'accepted' || s.action === 'modified').length;

  // Category acceptance rates
  const catMap: Record<string, { accepted: number; total: number }> = {};
  for (const s of suggestions) {
    if (!catMap[s.category]) catMap[s.category] = { accepted: 0, total: 0 };
    catMap[s.category].total++;
    if (s.action === 'accepted' || s.action === 'modified') catMap[s.category].accepted++;
  }
  const topAcceptedCategories = Object.entries(catMap)
    .map(([category, stats]) => ({
      category,
      rate: stats.total > 0 ? Math.round((stats.accepted / stats.total) * 100) / 100 : 0,
    }))
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 5);

  const openFailures = (data.gateFailures ?? []).filter(f => !f.resolved);
  const failurePatterns = getGateFailurePatterns().slice(0, 5);

  const anomalyFb = data.anomalyFeedback ?? [];
  const dismissedAnomalies = anomalyFb.filter(f => f.action === 'dismissed').length;

  const lowValueAutomations = getLowValueAutomations();

  return {
    totalSuggestionInteractions: suggestions.length,
    overallAcceptanceRate: suggestions.length > 0 ? Math.round((accepted / suggestions.length) * 100) / 100 : 0,
    topAcceptedCategories,
    openGateFailures: openFailures.length,
    topFailurePatterns: failurePatterns,
    anomalyDismissalRate: anomalyFb.length > 0 ? Math.round((dismissedAnomalies / anomalyFb.length) * 100) / 100 : 0,
    lowValueAutomations: lowValueAutomations.length,
  };
}
