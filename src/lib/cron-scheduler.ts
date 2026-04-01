/**
 * Cron Scheduler
 *
 * In-memory interval-based scheduler that checks enabled automations
 * with schedule triggers every 60 seconds. When a cron expression matches
 * the current time, the automation is executed.
 */

import { loadAutomations } from '@/lib/automations';
import { executeAutomation } from '@/lib/automation-executor';
import { checkDueReminders } from '@/lib/assistants';
import { checkDueReportSchedules } from '@/lib/scheduled-report-runner';
import { checkDueDigests } from '@/lib/email-digest';

// ── Cron Evaluator ───────────────────────────────────────────

function fieldMatches(field: string, value: number): boolean {
  if (field === '*') return true;

  // Step: */5 means "every 5"
  if (field.includes('/')) {
    const step = parseInt(field.split('/')[1], 10);
    if (isNaN(step) || step <= 0) return false;
    return value % step === 0;
  }

  // List: 1,3,5
  if (field.includes(',')) {
    return field.split(',').map(Number).includes(value);
  }

  // Range: 1-5
  if (field.includes('-')) {
    const [lo, hi] = field.split('-').map(Number);
    return value >= lo && value <= hi;
  }

  // Exact match
  return parseInt(field, 10) === value;
}

export function cronMatches(cron: string, date: Date): boolean {
  const parts = cron.trim().split(/\s+/);
  if (parts.length !== 5) return false;

  const [min, hour, dayOfMonth, month, dayOfWeek] = parts;
  const checks = [
    { field: min, value: date.getMinutes() },
    { field: hour, value: date.getHours() },
    { field: dayOfMonth, value: date.getDate() },
    { field: month, value: date.getMonth() + 1 },
    { field: dayOfWeek, value: date.getDay() },
  ];

  return checks.every(({ field, value }) => fieldMatches(field, value));
}

// ── Scheduler State ──────────────────────────────────────────

interface SchedulerState {
  running: boolean;
  intervalId: ReturnType<typeof setInterval> | null;
  lastCheckAt: string | null;
  runsTriggered: number;
}

const state: SchedulerState = {
  running: false,
  intervalId: null,
  lastCheckAt: null,
  runsTriggered: 0,
};

// ── Log ──────────────────────────────────────────────────────

interface SchedulerLog {
  timestamp: string;
  automationId: string;
  automationName: string;
  result: 'triggered' | 'error';
  error?: string;
}

const recentLogs: SchedulerLog[] = [];
const MAX_LOGS = 50;

function appendLog(log: SchedulerLog): void {
  recentLogs.push(log);
  if (recentLogs.length > MAX_LOGS) {
    recentLogs.splice(0, recentLogs.length - MAX_LOGS);
  }
}

// ── Tick ─────────────────────────────────────────────────────

async function tick(): Promise<void> {
  const now = new Date();
  state.lastCheckAt = now.toISOString();

  // Check for due reminders every tick (every 60s)
  try {
    const reminderCount = await checkDueReminders();
    if (reminderCount > 0) {
      console.log(`[cron-scheduler] Sent ${reminderCount} due reminder(s)`);
    }
  } catch (err) {
    console.error('[cron-scheduler] Reminder check error:', err);
  }

  // Check for due scheduled reports every tick
  try {
    const reportCount = await checkDueReportSchedules();
    if (reportCount > 0) {
      state.runsTriggered += reportCount;
      console.log(`[cron-scheduler] Generated ${reportCount} scheduled report(s)`);
    }
  } catch (err) {
    console.error('[cron-scheduler] Report schedule check error:', err);
  }

  // Check for due email digests every tick
  try {
    const digestCount = await checkDueDigests();
    if (digestCount > 0) {
      state.runsTriggered += digestCount;
      console.log(`[cron-scheduler] Sent ${digestCount} email digest(s)`);
    }
  } catch (err) {
    console.error('[cron-scheduler] Email digest check error:', err);
  }

  const automations = loadAutomations();
  const scheduled = automations.filter(
    (a) => a.enabled && a.trigger.type === 'schedule' && a.trigger.config.cron
  );

  for (const automation of scheduled) {
    const cron = automation.trigger.config.cron;
    if (!cron || !cronMatches(cron, now)) continue;

    try {
      await executeAutomation(automation);
      state.runsTriggered += 1;
      appendLog({
        timestamp: now.toISOString(),
        automationId: automation.id,
        automationName: automation.name,
        result: 'triggered',
      });
      console.log(`[cron-scheduler] Triggered: ${automation.name}`);
    } catch (err) {
      appendLog({
        timestamp: now.toISOString(),
        automationId: automation.id,
        automationName: automation.name,
        result: 'error',
        error: err instanceof Error ? err.message : 'unknown',
      });
      console.error(`[cron-scheduler] Error running ${automation.name}:`, err);
    }
  }
}

// ── Scheduled Runs Preview ───────────────────────────────────

export interface ScheduledRunPreview {
  automationId: string;
  automationName: string;
  cron: string;
}

function getScheduledAutomations(): ScheduledRunPreview[] {
  const automations = loadAutomations();
  return automations
    .filter(
      (a) => a.enabled && a.trigger.type === 'schedule' && a.trigger.config.cron
    )
    .map((a) => ({
      automationId: a.id,
      automationName: a.name,
      cron: a.trigger.config.cron!,
    }));
}

// ── Public API ───────────────────────────────────────────────

export function startScheduler(): { started: boolean; message: string } {
  if (state.running) {
    return { started: false, message: 'Scheduler is already running' };
  }

  state.running = true;
  state.intervalId = setInterval(() => {
    tick().catch((err) =>
      console.error('[cron-scheduler] Tick error:', err)
    );
  }, 60_000);

  // Run once immediately
  tick().catch((err) =>
    console.error('[cron-scheduler] Initial tick error:', err)
  );

  return { started: true, message: 'Scheduler started (60s interval)' };
}

export function stopScheduler(): { stopped: boolean; message: string } {
  if (!state.running || !state.intervalId) {
    return { stopped: false, message: 'Scheduler is not running' };
  }

  clearInterval(state.intervalId);
  state.running = false;
  state.intervalId = null;

  return { stopped: true, message: 'Scheduler stopped' };
}

export function getSchedulerStatus(): {
  running: boolean;
  lastCheckAt: string | null;
  runsTriggered: number;
  scheduledAutomations: ScheduledRunPreview[];
  recentLogs: SchedulerLog[];
} {
  return {
    running: state.running,
    lastCheckAt: state.lastCheckAt,
    runsTriggered: state.runsTriggered,
    scheduledAutomations: getScheduledAutomations(),
    recentLogs: [...recentLogs],
  };
}
