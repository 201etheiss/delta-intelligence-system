/**
 * Automation Engine — Data Model & Persistence
 *
 * Types and file-based storage for automations and their run history.
 * Automations define trigger → condition → action chains that can be
 * scheduled, threshold-driven, or manually triggered.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Trigger Types ────────────────────────────────────────────

export type TriggerType = 'schedule' | 'threshold' | 'manual';

export type ComparisonOperator = '>' | '<' | '=' | '!=' | '>=' | '<=';

export interface Trigger {
  type: TriggerType;
  config: {
    // schedule
    cron?: string;
    frequency?: string;
    // threshold
    endpoint?: string;
    field?: string;
    operator?: ComparisonOperator;
    value?: number | string;
    // manual — no config needed
  };
}

// ── Action Types ─────────────────────────────────────────────

export type ActionType =
  | 'query'           // Read data from gateway
  | 'report'          // Generate AI report
  | 'email'           // Send email via Microsoft Graph
  | 'webhook'         // POST to any URL (Slack, n8n, Zapier, etc.)
  | 'workbook'        // Generate Excel workbook
  | 'n8n'             // Trigger n8n workflow
  | 'sf_create'       // Create Salesforce record
  | 'sf_update'       // Update Salesforce record
  | 'sharepoint'      // Upload/move file in SharePoint
  | 'teams'           // Post to Microsoft Teams channel
  | 'ai_action';      // Ask the AI to decide what to do based on data

export interface Action {
  id: string;
  type: ActionType;
  name: string;
  config: {
    // query
    endpoint?: string;
    method?: string;
    body?: Record<string, unknown>;
    // report
    reportTemplate?: string;
    reportFormat?: string;
    // email
    to?: string[];
    subject?: string;
    bodyTemplate?: string;
    attachReport?: boolean;
    // webhook / n8n
    url?: string;
    headers?: Record<string, string>;
    payload?: Record<string, unknown>;
    // workbook
    workbookTemplate?: string;
    workbookParams?: Record<string, string>;
    // sf_create / sf_update
    sfObject?: string;             // e.g. "Task", "Opportunity", "Case"
    sfFields?: Record<string, unknown>;  // field values to set
    sfRecordId?: string;           // for updates
    sfSoql?: string;               // SOQL to find record to update
    // sharepoint
    spSiteId?: string;
    spDriveId?: string;
    spFolderPath?: string;
    spFileName?: string;
    // teams
    teamsChannelId?: string;
    teamsMessage?: string;
    // ai_action
    aiPrompt?: string;             // "Based on this data, decide next step"
    aiModel?: string;              // haiku | sonnet | opus
  };
}

// ── Conditions ───────────────────────────────────────────────

export interface Condition {
  field: string;
  operator: ComparisonOperator;
  value: number | string;
}

// ── Automation ───────────────────────────────────────────────

export interface Automation {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  trigger: Trigger;
  conditions: Condition[];
  actions: Action[];
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  lastRunAt: string | null;
  lastRunStatus: 'success' | 'error' | 'never' | null;
  runCount: number;
  errorCount: number;
}

// ── Run History ──────────────────────────────────────────────

export interface ActionRunResult {
  actionId: string;
  actionType: string;
  status: 'success' | 'error';
  result?: string;
  error?: string;
  durationMs: number;
}

export interface AutomationRun {
  id: string;
  automationId: string;
  startedAt: string;
  completedAt: string;
  status: 'success' | 'error';
  triggerType: string;
  actions: ActionRunResult[];
}

// ── Persistence ──────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const AUTOMATIONS_PATH = join(DATA_DIR, 'automations.json');
const RUNS_PATH = join(DATA_DIR, 'automation-runs.json');
const MAX_RUN_HISTORY = 100;

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadAutomations(): Automation[] {
  if (!existsSync(AUTOMATIONS_PATH)) return [];
  try {
    const raw = readFileSync(AUTOMATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as Automation[];
  } catch {
    return [];
  }
}

export function saveAutomations(automations: Automation[]): void {
  ensureDataDir();
  writeFileSync(AUTOMATIONS_PATH, JSON.stringify(automations, null, 2), 'utf-8');
}

export function loadRunHistory(): AutomationRun[] {
  if (!existsSync(RUNS_PATH)) return [];
  try {
    const raw = readFileSync(RUNS_PATH, 'utf-8');
    const runs = JSON.parse(raw) as AutomationRun[];
    return runs.slice(-MAX_RUN_HISTORY);
  } catch {
    return [];
  }
}

export function appendRun(run: AutomationRun): void {
  ensureDataDir();
  const runs = loadRunHistory();
  const updated = [...runs, run].slice(-MAX_RUN_HISTORY);
  writeFileSync(RUNS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}
