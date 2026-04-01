/**
 * Scheduled Report Runner
 *
 * Reads report-schedules.json, checks cron matches on each tick,
 * generates reports via the agentic loop, stores results, and
 * pushes a notification to the owner's inbox.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import { cronMatches } from '@/lib/cron-scheduler';
import { runAgenticLoop, queryGatewayTool } from '@/lib/agentic-loop';
import { validateResponse } from '@/lib/response-validator';
import { addNotification } from '@/lib/notifications-inbox';
import { getModelConfig } from '@/lib/router';
import type { UserRole } from '@/lib/config/roles';

// ── Types ────────────────────────────────────────────────────

export interface ReportSchedule {
  id: string;
  name: string;
  prompt: string;
  type: string;
  schedule: string;
  timezone: string;
  owner: string;
  role: UserRole;
  enabled: boolean;
  lastRun: string | null;
  nextRun: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduledReportResult {
  scheduleId: string;
  scheduleName: string;
  report: string;
  title: string;
  model: string;
  tokensUsed: number;
  generatedAt: string;
  durationMs: number;
  status: 'success' | 'error';
  error?: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getSchedulesPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/report-schedules.json';
  }
  return path.join(process.cwd(), 'data', 'report-schedules.json');
}

function getResultsPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/report-results.json';
  }
  return path.join(process.cwd(), 'data', 'report-results.json');
}

export function loadSchedules(): ReportSchedule[] {
  const filePath = getSchedulesPath();
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ReportSchedule[];
  } catch {
    return [];
  }
}

function saveSchedules(schedules: ReportSchedule[]): void {
  const filePath = getSchedulesPath();
  writeFileSync(filePath, JSON.stringify(schedules, null, 2), 'utf-8');
}

function loadResults(): ScheduledReportResult[] {
  const filePath = getResultsPath();
  if (!existsSync(filePath)) return [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ScheduledReportResult[];
  } catch {
    return [];
  }
}

function appendResult(result: ScheduledReportResult): void {
  const results = loadResults();
  const updated = [result, ...results];
  // Keep last 200 results max
  const capped = updated.length > 200 ? updated.slice(0, 200) : updated;
  const filePath = getResultsPath();
  writeFileSync(filePath, JSON.stringify(capped, null, 2), 'utf-8');
}

// ── Report System Prompt ─────────────────────────────────────

const SCHEDULED_REPORT_SYSTEM_PROMPT = `You are an enterprise report generator for Delta360.
Generate structured reports in markdown following these rules:

1. NEVER use emojis or decorative unicode symbols
2. Lead with the answer — headline number or key finding first
3. Use markdown tables with proper alignment for all data
4. Right-align numeric columns, left-align text columns
5. Format currency as $X,XXX or $X.XM, percentages as X.X%
6. Quantify everything — no "significant" or "various"
7. Headings are noun phrases, never questions
8. If data is unavailable, note it clearly — never fabricate numbers
9. Include confidence labels: [Explicit] [Inferred] [Unspecified]
10. Action items: [Number]. [Verb-led action] — [Owner] — [Deadline]

You have access to the Delta360 unified data gateway via the query_gateway tool.
Use it to fetch real data from ERP (Ascend), CRM (Salesforce), fleet, DTN rack pricing, and financial systems.

This is a scheduled report running automatically. Be thorough and self-contained.`;

// ── Single Report Generation ─────────────────────────────────

async function generateScheduledReport(
  schedule: ReportSchedule
): Promise<ScheduledReportResult> {
  const start = Date.now();
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      report: '',
      title: schedule.name,
      model: 'none',
      tokensUsed: 0,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'error',
      error: 'ANTHROPIC_API_KEY not configured',
    };
  }

  try {
    const client = new Anthropic({ apiKey });
    const isComplex =
      schedule.prompt.length > 100 ||
      /analys|compar|trend|forecast|review|decision|diagnostic|strateg/i.test(schedule.prompt);
    const modelId = isComplex ? 'sonnet' as const : 'haiku' as const;
    const modelConfig = getModelConfig(modelId);

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: `Generate a report: ${schedule.prompt}` },
    ];

    const loopResult = await runAgenticLoop({
      client,
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens,
      systemPrompt: SCHEDULED_REPORT_SYSTEM_PROMPT,
      messages,
      tools: [queryGatewayTool],
      role: schedule.role,
    });

    const report = loopResult.content
      ? validateResponse(loopResult.content)
      : '# Report Generation Incomplete\n\nNo content was returned. The data sources may be temporarily unavailable.';

    const titleMatch = report.match(/^#\s+(.+)$/m);
    const title = titleMatch ? titleMatch[1].trim() : schedule.name;

    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      report,
      title,
      model: modelConfig.model,
      tokensUsed: loopResult.inputTokens + loopResult.outputTokens,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'success',
    };
  } catch (err) {
    return {
      scheduleId: schedule.id,
      scheduleName: schedule.name,
      report: '',
      title: schedule.name,
      model: 'unknown',
      tokensUsed: 0,
      generatedAt: new Date().toISOString(),
      durationMs: Date.now() - start,
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
    };
  }
}

// ── Tick: Check Due Schedules ────────────────────────────────

export async function checkDueReportSchedules(): Promise<number> {
  const now = new Date();
  const schedules = loadSchedules();
  const enabled = schedules.filter((s) => s.enabled);

  let triggered = 0;

  for (const schedule of enabled) {
    if (!cronMatches(schedule.schedule, now)) continue;

    console.log(`[report-scheduler] Running scheduled report: ${schedule.name}`);
    triggered += 1;

    const result = await generateScheduledReport(schedule);

    // Store the result
    appendResult(result);

    // Update lastRun on the schedule
    const allSchedules = loadSchedules();
    const idx = allSchedules.findIndex((s) => s.id === schedule.id);
    if (idx !== -1) {
      const updated = [...allSchedules];
      updated[idx] = {
        ...updated[idx],
        lastRun: now.toISOString(),
        updatedAt: now.toISOString(),
      };
      saveSchedules(updated);
    }

    // Push notification to owner's inbox
    if (result.status === 'success') {
      addNotification({
        title: `Scheduled Report: ${schedule.name}`,
        body: `Report "${result.title}" generated successfully (${result.tokensUsed} tokens, ${result.durationMs}ms).`,
        type: 'success',
        userEmail: schedule.owner,
        actionUrl: '/reports',
      });
    } else {
      addNotification({
        title: `Scheduled Report Failed: ${schedule.name}`,
        body: `Error: ${result.error ?? 'Unknown error'}`,
        type: 'alert',
        userEmail: schedule.owner,
        actionUrl: '/reports',
      });
    }

    console.log(
      `[report-scheduler] ${result.status === 'success' ? 'Completed' : 'Failed'}: ${schedule.name} (${result.durationMs}ms)`
    );
  }

  return triggered;
}

// ── Public: Get Results ──────────────────────────────────────

export function getReportResults(scheduleId?: string): ScheduledReportResult[] {
  const results = loadResults();
  if (!scheduleId) return results;
  return results.filter((r) => r.scheduleId === scheduleId);
}
