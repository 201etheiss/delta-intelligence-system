/**
 * Alert Rules Engine
 *
 * Evaluates configurable alert rules against metrics and dispatches
 * notifications via the unified notification service.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import type { UserRole } from '@/lib/config/roles';
import { addNotification } from '@/lib/notifications-inbox';
import { notify } from '@/lib/notifications';

// ── Types ────────────────────────────────────────────────────

export type AlertOperator = '>' | '<' | '>=' | '<=' | '==' | '!=';
export type AlertChannel = 'in-app' | 'email' | 'teams' | 'sms';

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  operator: AlertOperator;
  threshold: number;
  channel: AlertChannel;
  recipients: string[];
  role: UserRole;
  enabled: boolean;
  lastTriggered: string | null;
  snoozedUntil: string | null;
}

export interface AlertEvaluation {
  ruleId: string;
  ruleName: string;
  triggered: boolean;
  currentValue: number | null;
  threshold: number;
  operator: AlertOperator;
  timestamp: string;
}

interface AlertRulesFile {
  rules: AlertRule[];
}

// ── File I/O ─────────────────────────────────────────────────

function getRulesPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/alert-rules.json';
  }
  return path.join(process.cwd(), 'data', 'alert-rules.json');
}

export function readRules(): AlertRule[] {
  const filePath = getRulesPath();
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const data = JSON.parse(raw) as AlertRulesFile;
    return data.rules ?? [];
  } catch {
    return [];
  }
}

export function writeRules(rules: AlertRule[]): void {
  const filePath = getRulesPath();
  const data: AlertRulesFile = { rules };
  writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// ── CRUD ─────────────────────────────────────────────────────

export function getRuleById(id: string): AlertRule | undefined {
  return readRules().find((r) => r.id === id);
}

export function createRule(rule: AlertRule): AlertRule {
  const rules = readRules();
  const existing = rules.find((r) => r.id === rule.id);
  if (existing) {
    throw new Error(`Rule with id "${rule.id}" already exists`);
  }
  const updated = [...rules, rule];
  writeRules(updated);
  return rule;
}

export function updateRule(id: string, patch: Partial<AlertRule>): AlertRule {
  const rules = readRules();
  const idx = rules.findIndex((r) => r.id === id);
  if (idx === -1) {
    throw new Error(`Rule "${id}" not found`);
  }
  const updated = { ...rules[idx], ...patch, id };
  const newRules = [...rules.slice(0, idx), updated, ...rules.slice(idx + 1)];
  writeRules(newRules);
  return updated;
}

export function deleteRule(id: string): boolean {
  const rules = readRules();
  const filtered = rules.filter((r) => r.id !== id);
  if (filtered.length === rules.length) return false;
  writeRules(filtered);
  return true;
}

// ── Evaluation ───────────────────────────────────────────────

function evaluateCondition(value: number, operator: AlertOperator, threshold: number): boolean {
  switch (operator) {
    case '>': return value > threshold;
    case '<': return value < threshold;
    case '>=': return value >= threshold;
    case '<=': return value <= threshold;
    case '==': return value === threshold;
    case '!=': return value !== threshold;
    default: return false;
  }
}

export function evaluateRule(
  rule: AlertRule,
  currentValue: number | null
): AlertEvaluation {
  const now = new Date().toISOString();

  // Skip if snoozed
  if (rule.snoozedUntil && new Date(rule.snoozedUntil) > new Date()) {
    return {
      ruleId: rule.id,
      ruleName: rule.name,
      triggered: false,
      currentValue,
      threshold: rule.threshold,
      operator: rule.operator,
      timestamp: now,
    };
  }

  const triggered =
    currentValue !== null &&
    rule.enabled &&
    evaluateCondition(currentValue, rule.operator, rule.threshold);

  return {
    ruleId: rule.id,
    ruleName: rule.name,
    triggered,
    currentValue,
    threshold: rule.threshold,
    operator: rule.operator,
    timestamp: now,
  };
}

// ── Snooze / Acknowledge ─────────────────────────────────────

export function snoozeRule(id: string, durationMinutes: number): AlertRule {
  const until = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
  return updateRule(id, { snoozedUntil: until });
}

export function acknowledgeRule(id: string): AlertRule {
  return updateRule(id, { lastTriggered: new Date().toISOString() });
}

export function unsnoozeRule(id: string): AlertRule {
  return updateRule(id, { snoozedUntil: null });
}

// ── Alert Trigger → Notification Pipeline ───────────────────

export async function triggerAlert(
  rule: AlertRule,
  data: { currentValue: number | null; message?: string }
): Promise<void> {
  const body =
    data.message ??
    `Alert "${rule.name}": ${rule.metric} is ${data.currentValue} (threshold: ${rule.operator} ${rule.threshold})`;

  // 1. Create in-app notification
  addNotification({
    title: `Alert: ${rule.name}`,
    body,
    type: 'alert',
    actionUrl: `/chat?q=${encodeURIComponent(`Tell me about ${rule.metric}`)}`,
  });

  // 2. Dispatch via notification channel if not in-app only
  if (rule.channel !== 'in-app') {
    const channelMap: Record<string, 'email' | 'sms' | 'teams' | 'slack'> = {
      email: 'email',
      teams: 'teams',
      sms: 'sms',
    };
    const channel = channelMap[rule.channel];
    if (channel && rule.recipients.length > 0) {
      await notify({
        channel,
        to: rule.recipients,
        subject: `Delta Intelligence Alert: ${rule.name}`,
        body,
      });
    }
  }

  // 3. Mark as triggered
  updateRule(rule.id, { lastTriggered: new Date().toISOString() });
}
