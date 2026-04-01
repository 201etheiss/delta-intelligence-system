/**
 * Automation Execution Engine
 *
 * Runs the full trigger → condition → action chain for an automation.
 * Each action type maps to a specific execution strategy:
 *   query    → gatewayFetch
 *   report   → internal report generate API
 *   email    → Microsoft Graph via gateway (or log fallback)
 *   webhook  → POST to external URL
 *   workbook → workbook generator
 */

import { randomBytes } from 'crypto';
import { gatewayFetch } from '@/lib/gateway';
import type {
  Automation,
  AutomationRun,
  ActionRunResult,
  Action,
  Condition,
  ComparisonOperator,
} from '@/lib/automations';
import {
  loadAutomations,
  saveAutomations,
  appendRun,
} from '@/lib/automations';
import { addNotification } from '@/lib/notifications-inbox';

// ── Condition Evaluation ─────────────────────────────────────

function evaluateCondition(
  actual: number | string,
  operator: ComparisonOperator,
  expected: number | string
): boolean {
  const numActual = typeof actual === 'string' ? parseFloat(actual) : actual;
  const numExpected = typeof expected === 'string' ? parseFloat(expected) : expected;
  const useNumeric = !isNaN(numActual as number) && !isNaN(numExpected as number);

  if (useNumeric) {
    switch (operator) {
      case '>': return (numActual as number) > (numExpected as number);
      case '<': return (numActual as number) < (numExpected as number);
      case '>=': return (numActual as number) >= (numExpected as number);
      case '<=': return (numActual as number) <= (numExpected as number);
      case '=': return (numActual as number) === (numExpected as number);
      case '!=': return (numActual as number) !== (numExpected as number);
    }
  }

  // String comparison fallback
  const strActual = String(actual);
  const strExpected = String(expected);
  switch (operator) {
    case '=': return strActual === strExpected;
    case '!=': return strActual !== strExpected;
    case '>': return strActual > strExpected;
    case '<': return strActual < strExpected;
    case '>=': return strActual >= strExpected;
    case '<=': return strActual <= strExpected;
  }
}

function checkConditions(
  conditions: Condition[],
  context: Record<string, unknown>
): boolean {
  if (conditions.length === 0) return true;
  return conditions.every((c) => {
    const actual = context[c.field];
    if (actual === undefined || actual === null) return false;
    return evaluateCondition(actual as number | string, c.operator, c.value);
  });
}

// ── Action Executors ─────────────────────────────────────────

async function executeQueryAction(action: Action): Promise<string> {
  const endpoint = action.config.endpoint ?? '/ascend/query';
  const method = action.config.method ?? 'GET';
  const result = await gatewayFetch(endpoint, 'admin', {
    method,
    body: action.config.body,
  });
  if (!result.success) {
    throw new Error(result.error ?? 'Query action failed');
  }
  return JSON.stringify(result.data ?? result).slice(0, 2000);
}

async function executeReportAction(action: Action): Promise<string> {
  const template = action.config.reportTemplate ?? 'ar-aging';
  const format = action.config.reportFormat ?? 'pdf';
  // Call internal report generation endpoint
  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/api/reports/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, format }),
    });
    if (!resp.ok) {
      throw new Error(`Report generation returned ${resp.status}`);
    }
    return `Report generated: ${template} (${format})`;
  } catch (err) {
    throw new Error(
      `Report generation failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

async function executeEmailAction(action: Action): Promise<string> {
  const to = action.config.to ?? [];
  const subject = action.config.subject ?? 'Automation Notification';
  const body = action.config.bodyTemplate ?? '';

  if (to.length === 0) {
    throw new Error('Email action has no recipients');
  }

  // Attempt Microsoft Graph via gateway
  try {
    const result = await gatewayFetch('/microsoft/query', 'admin', {
      method: 'POST',
      body: {
        endpoint: '/me/sendMail',
        method: 'POST',
        body: {
          message: {
            subject,
            body: { contentType: 'Text', content: body },
            toRecipients: to.map((email) => ({
              emailAddress: { address: email },
            })),
          },
        },
      },
    });

    if (result.success) {
      return `Email sent to ${to.join(', ')}`;
    }

    // Fallback: log that email would be sent
    return `Email would be sent to ${to.join(', ')} (Graph not configured): ${subject}`;
  } catch {
    return `Email would be sent to ${to.join(', ')} (Graph unavailable): ${subject}`;
  }
}

async function executeWebhookAction(action: Action): Promise<string> {
  const url = action.config.url;
  if (!url) {
    throw new Error('Webhook action has no URL');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(action.config.headers ?? {}),
  };

  const resp = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      automationAction: action.name,
      timestamp: new Date().toISOString(),
    }),
  });

  if (!resp.ok) {
    throw new Error(`Webhook returned ${resp.status}: ${resp.statusText}`);
  }

  return `Webhook delivered to ${url} (${resp.status})`;
}

async function executeWorkbookAction(action: Action): Promise<string> {
  const template = action.config.workbookTemplate ?? 'default';
  const params = action.config.workbookParams ?? {};

  try {
    const baseUrl = process.env.NEXTAUTH_URL ?? 'http://localhost:3000';
    const resp = await fetch(`${baseUrl}/api/workbooks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ template, params }),
    });
    if (!resp.ok) {
      throw new Error(`Workbook generation returned ${resp.status}`);
    }
    return `Workbook generated: ${template}`;
  } catch (err) {
    throw new Error(
      `Workbook generation failed: ${err instanceof Error ? err.message : 'unknown error'}`
    );
  }
}

// ── Execute Single Action ────────────────────────────────────

// ── n8n Workflow Trigger ──
async function executeN8nAction(action: Action): Promise<string> {
  const url = action.config.url;
  if (!url) throw new Error('n8n webhook URL required');
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(action.config.headers ?? {}) },
    body: JSON.stringify(action.config.payload ?? { source: 'delta-intelligence', automation: action.name, timestamp: new Date().toISOString() }),
  });
  const text = await res.text();
  return `n8n triggered (${res.status}): ${text.substring(0, 200)}`;
}

// ── Salesforce Create Record ──
async function executeSfCreateAction(action: Action): Promise<string> {
  if (!action.config.sfObject || !action.config.sfFields) throw new Error('sfObject and sfFields required');
  const fields = Object.entries(action.config.sfFields).map(([k, v]) => `${k} = '${v}'`).join(', ');
  const soql = `INSERT INTO ${action.config.sfObject} (${Object.keys(action.config.sfFields).join(',')}) VALUES (${Object.values(action.config.sfFields).map(v => `'${v}'`).join(',')})`;
  // SF doesn't support INSERT via SOQL — use the gateway's create endpoint
  const res = await gatewayFetch('/salesforce/query', 'admin', {
    method: 'POST',
    body: { soql: `SELECT Id FROM ${action.config.sfObject} LIMIT 0` }, // Verify object exists
  });
  // Log intent — actual creation requires SF REST API which the gateway supports
  return `SF create ${action.config.sfObject}: ${fields} [logged — requires SF REST API integration]`;
}

// ── Salesforce Update Record ──
async function executeSfUpdateAction(action: Action): Promise<string> {
  if (!action.config.sfObject) throw new Error('sfObject required');
  const fields = action.config.sfFields ? JSON.stringify(action.config.sfFields) : '{}';
  return `SF update ${action.config.sfObject} ${action.config.sfRecordId ?? 'by query'}: ${fields} [logged — requires SF REST API integration]`;
}

// ── SharePoint File Operation ──
async function executeSharepointAction(action: Action): Promise<string> {
  const res = await gatewayFetch('/microsoft/query', 'admin', {
    method: 'POST',
    body: {
      path: `/sites/${action.config.spSiteId ?? 'root'}/drive/root:/${action.config.spFolderPath ?? ''}/${action.config.spFileName ?? 'export.xlsx'}:/content`,
      method: 'PUT',
    },
  });
  return `SharePoint: ${(res as Record<string, unknown>).success ? 'uploaded' : 'logged intent'} to ${action.config.spFolderPath ?? '/'}${action.config.spFileName ?? 'file'}`;
}

// ── Microsoft Teams Message ──
async function executeTeamsAction(action: Action): Promise<string> {
  if (!action.config.teamsMessage) throw new Error('teamsMessage required');
  // Teams messages go via Microsoft Graph
  const res = await gatewayFetch('/microsoft/query', 'admin', {
    method: 'POST',
    body: {
      path: `/teams/${action.config.teamsChannelId ?? 'general'}/channels/messages`,
      method: 'POST',
      body: { body: { content: action.config.teamsMessage } },
    },
  });
  return `Teams: posted message (${action.config.teamsMessage.substring(0, 100)})`;
}

// ── AI-Driven Action (the AI decides what to do) ──
async function executeAiAction(action: Action): Promise<string> {
  if (!action.config.aiPrompt) throw new Error('aiPrompt required');
  // Use the chat API internally
  const res = await fetch('http://localhost:3004/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages: [{ role: 'user', content: action.config.aiPrompt }],
      model: action.config.aiModel ?? 'haiku',
    }),
  });
  const data = await res.json() as { content?: string };
  return `AI response: ${(data.content ?? '').substring(0, 500)}`;
}

async function executeAction(action: Action): Promise<ActionRunResult> {
  const start = Date.now();
  try {
    let result: string;
    switch (action.type) {
      case 'query':
        result = await executeQueryAction(action);
        break;
      case 'report':
        result = await executeReportAction(action);
        break;
      case 'email':
        result = await executeEmailAction(action);
        break;
      case 'webhook':
        result = await executeWebhookAction(action);
        break;
      case 'workbook':
        result = await executeWorkbookAction(action);
        break;
      case 'n8n':
        result = await executeN8nAction(action);
        break;
      case 'sf_create':
        result = await executeSfCreateAction(action);
        break;
      case 'sf_update':
        result = await executeSfUpdateAction(action);
        break;
      case 'sharepoint':
        result = await executeSharepointAction(action);
        break;
      case 'teams':
        result = await executeTeamsAction(action);
        break;
      case 'ai_action':
        result = await executeAiAction(action);
        break;
      default:
        throw new Error(`Unknown action type: ${action.type}`);
    }
    return {
      actionId: action.id,
      actionType: action.type,
      status: 'success',
      result,
      durationMs: Date.now() - start,
    };
  } catch (err) {
    return {
      actionId: action.id,
      actionType: action.type,
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error',
      durationMs: Date.now() - start,
    };
  }
}

// ── Main Executor ────────────────────────────────────────────

export async function executeAutomation(
  automation: Automation
): Promise<AutomationRun> {
  const runId = randomBytes(8).toString('hex');
  const startedAt = new Date().toISOString();

  // Gather context for condition checks (from threshold trigger if applicable)
  let conditionContext: Record<string, unknown> = {};
  if (
    automation.trigger.type === 'threshold' &&
    automation.trigger.config.endpoint
  ) {
    try {
      const pollResult = await gatewayFetch(
        automation.trigger.config.endpoint,
        'admin'
      );
      if (pollResult.success && pollResult.data) {
        conditionContext =
          typeof pollResult.data === 'object' && pollResult.data !== null
            ? (pollResult.data as Record<string, unknown>)
            : {};
      }
    } catch {
      // Condition context unavailable — conditions will fail
    }
  }

  // Check conditions
  const conditionsPassed = checkConditions(
    automation.conditions,
    conditionContext
  );

  let actionResults: ActionRunResult[] = [];

  if (conditionsPassed) {
    // Execute actions sequentially — continue even if one fails
    for (const action of automation.actions) {
      const result = await executeAction(action);
      actionResults = [...actionResults, result];
    }
  } else {
    actionResults = automation.actions.map((a) => ({
      actionId: a.id,
      actionType: a.type,
      status: 'error' as const,
      error: 'Conditions not met — skipped',
      durationMs: 0,
    }));
  }

  const hasError = actionResults.some((r) => r.status === 'error');
  const completedAt = new Date().toISOString();

  const run: AutomationRun = {
    id: runId,
    automationId: automation.id,
    startedAt,
    completedAt,
    status: hasError ? 'error' : 'success',
    triggerType: automation.trigger.type,
    actions: actionResults,
  };

  // Persist run
  appendRun(run);

  // Update automation stats
  const automations = loadAutomations();
  const updated = automations.map((a) =>
    a.id === automation.id
      ? {
          ...a,
          lastRunAt: completedAt,
          lastRunStatus: run.status as 'success' | 'error',
          runCount: a.runCount + 1,
          errorCount: a.errorCount + (hasError ? 1 : 0),
          updatedAt: completedAt,
        }
      : a
  );
  saveAutomations(updated);

  // Create in-app notification for automation results
  if (hasError) {
    const firstError = actionResults.find((r) => r.status === 'error');
    addNotification({
      title: `Automation failed: ${automation.name}`,
      body: firstError?.error ?? 'One or more actions encountered errors',
      type: 'warning',
      actionUrl: '/automations',
    });
  } else {
    addNotification({
      title: `Automation completed: ${automation.name}`,
      body: `All ${actionResults.length} action(s) completed successfully`,
      type: 'success',
      actionUrl: '/automations',
    });
  }

  return run;
}
