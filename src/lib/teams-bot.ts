/**
 * Microsoft Teams Bot — Helper functions for formatting, adaptive cards,
 * proactive messaging, and Azure AD user resolution.
 *
 * This module is a thin adapter layer. It does NOT contain business logic —
 * all intelligence routes through the existing DI agentic loop.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ── Types ────────────────────────────────────────────────────

export interface ConversationReference {
  activityId: string;
  user: { id: string; name?: string; aadObjectId?: string };
  bot: { id: string; name?: string };
  conversation: { id: string; conversationType?: string; tenantId?: string };
  channelId: string;
  serviceUrl: string;
  savedAt: string;
}

export interface AdaptiveCard {
  type: 'AdaptiveCard';
  $schema: string;
  version: string;
  body: Array<Record<string, unknown>>;
  actions?: Array<Record<string, unknown>>;
}

export interface TeamsActivity {
  type: string;
  id?: string;
  timestamp?: string;
  serviceUrl?: string;
  channelId?: string;
  from?: {
    id?: string;
    name?: string;
    aadObjectId?: string;
    email?: string;
  };
  conversation?: {
    id?: string;
    conversationType?: string;
    tenantId?: string;
    isGroup?: boolean;
  };
  recipient?: { id?: string; name?: string };
  text?: string;
  textFormat?: string;
  attachments?: Array<Record<string, unknown>>;
  entities?: Array<Record<string, unknown>>;
  value?: Record<string, unknown>;
  membersAdded?: Array<{ id?: string; name?: string }>;
}

// ── Conversation Reference Storage ───────────────────────────

const DATA_DIR = join(process.cwd(), 'data');
const CONVERSATIONS_PATH = join(DATA_DIR, 'teams-conversations.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

export function loadConversationReferences(): Record<string, ConversationReference> {
  if (!existsSync(CONVERSATIONS_PATH)) return {};
  try {
    const raw = readFileSync(CONVERSATIONS_PATH, 'utf-8');
    return JSON.parse(raw) as Record<string, ConversationReference>;
  } catch {
    return {};
  }
}

export function saveConversationReference(key: string, ref: ConversationReference): void {
  ensureDataDir();
  const refs = loadConversationReferences();
  const updated = { ...refs, [key]: ref };
  writeFileSync(CONVERSATIONS_PATH, JSON.stringify(updated, null, 2), 'utf-8');
}

export function buildConversationReference(activity: TeamsActivity): ConversationReference {
  return {
    activityId: activity.id ?? '',
    user: {
      id: activity.from?.id ?? '',
      name: activity.from?.name,
      aadObjectId: activity.from?.aadObjectId,
    },
    bot: {
      id: activity.recipient?.id ?? '',
      name: activity.recipient?.name,
    },
    conversation: {
      id: activity.conversation?.id ?? '',
      conversationType: activity.conversation?.conversationType,
      tenantId: activity.conversation?.tenantId,
    },
    channelId: activity.channelId ?? 'msteams',
    serviceUrl: activity.serviceUrl ?? '',
    savedAt: new Date().toISOString(),
  };
}

// ── Markdown → Teams Formatting ──────────────────────────────

/**
 * Convert standard markdown to Teams-compatible format.
 * Teams supports a subset of markdown but has quirks:
 *  - Bold: **text** works
 *  - Italic: _text_ works (not *text*)
 *  - Code blocks: ```lang ... ``` works
 *  - Tables: NOT natively supported in text — use adaptive cards instead
 *  - Headers: # works but renders large
 */
export function formatForTeams(markdown: string): string {
  let result = markdown;

  // Convert h1-h3 to bold text (Teams headers are oversized)
  result = result.replace(/^### (.+)$/gm, '**$1**');
  result = result.replace(/^## (.+)$/gm, '**$1**');
  result = result.replace(/^# (.+)$/gm, '**$1**');

  // Ensure bullet lists use - (Teams prefers this)
  result = result.replace(/^\* /gm, '- ');

  // Collapse excessive blank lines (Teams renders them all)
  result = result.replace(/\n{3,}/g, '\n\n');

  // Trim to Teams message limit (28KB text, but keep reasonable)
  if (result.length > 25000) {
    result = result.slice(0, 25000) + '\n\n_(Response truncated due to length)_';
  }

  return result;
}

// ── Adaptive Card Builder ────────────────────────────────────

/**
 * Build an adaptive card for structured data (tables, KPIs, summaries).
 * Used when the AI response contains tabular data that does not render
 * well in plain Teams text.
 */
export function buildAdaptiveCard(data: {
  title?: string;
  summary?: string;
  rows?: Array<Record<string, string | number>>;
  kpis?: Array<{ label: string; value: string | number; color?: string }>;
}): AdaptiveCard {
  const body: Array<Record<string, unknown>> = [];

  // Title
  if (data.title) {
    body.push({
      type: 'TextBlock',
      text: data.title,
      weight: 'Bolder',
      size: 'Large',
      wrap: true,
    });
  }

  // KPI row
  if (data.kpis && data.kpis.length > 0) {
    body.push({
      type: 'ColumnSet',
      columns: data.kpis.map((kpi) => ({
        type: 'Column',
        width: 'stretch',
        items: [
          { type: 'TextBlock', text: kpi.label, size: 'Small', isSubtle: true, wrap: true },
          {
            type: 'TextBlock',
            text: String(kpi.value),
            size: 'ExtraLarge',
            weight: 'Bolder',
            color: kpi.color ?? 'Default',
          },
        ],
      })),
    });
  }

  // Summary text
  if (data.summary) {
    body.push({
      type: 'TextBlock',
      text: data.summary,
      wrap: true,
      spacing: 'Medium',
    });
  }

  // Table rows as fact sets
  if (data.rows && data.rows.length > 0) {
    const keys = Object.keys(data.rows[0]);
    // Header
    body.push({
      type: 'ColumnSet',
      columns: keys.map((key) => ({
        type: 'Column',
        width: 'stretch',
        items: [
          { type: 'TextBlock', text: key, weight: 'Bolder', size: 'Small', wrap: true },
        ],
      })),
    });

    // Data rows (limit to 20 to keep card size reasonable)
    const displayRows = data.rows.slice(0, 20);
    for (const row of displayRows) {
      body.push({
        type: 'ColumnSet',
        separator: true,
        columns: keys.map((key) => ({
          type: 'Column',
          width: 'stretch',
          items: [
            { type: 'TextBlock', text: String(row[key] ?? ''), wrap: true, size: 'Small' },
          ],
        })),
      });
    }

    if (data.rows.length > 20) {
      body.push({
        type: 'TextBlock',
        text: `_Showing 20 of ${data.rows.length} rows_`,
        isSubtle: true,
        size: 'Small',
      });
    }
  }

  return {
    type: 'AdaptiveCard',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    version: '1.5',
    body,
  };
}

// ── Proactive Messaging ──────────────────────────────────────

/**
 * Send a proactive message to a Teams conversation using a stored reference.
 * Requires TEAMS_BOT_APP_ID and TEAMS_BOT_APP_PASSWORD env vars.
 */
export async function sendTeamsMessage(
  conversationRef: ConversationReference,
  message: string | AdaptiveCard
): Promise<{ success: boolean; error?: string }> {
  const appId = process.env.TEAMS_BOT_APP_ID;
  const appPassword = process.env.TEAMS_BOT_APP_PASSWORD;

  if (!appId || !appPassword) {
    return { success: false, error: 'TEAMS_BOT_APP_ID or TEAMS_BOT_APP_PASSWORD not configured' };
  }

  // Get Bot Framework token
  const tokenResponse = await fetch(
    'https://login.microsoftonline.com/botframework.com/oauth2/v2.0/token',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'client_credentials',
        client_id: appId,
        client_secret: appPassword,
        scope: 'https://api.botframework.com/.default',
      }),
    }
  );

  if (!tokenResponse.ok) {
    return { success: false, error: `Token request failed: ${tokenResponse.status}` };
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  const token = tokenData.access_token;
  if (!token) {
    return { success: false, error: 'No access token in response' };
  }

  // Build the activity payload
  const activity: Record<string, unknown> = {
    type: 'message',
    from: conversationRef.bot,
    conversation: { id: conversationRef.conversation.id },
    recipient: conversationRef.user,
  };

  if (typeof message === 'string') {
    activity.text = message;
    activity.textFormat = 'markdown';
  } else {
    // Adaptive card
    activity.attachments = [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: message,
      },
    ];
  }

  // Send via Bot Framework
  const serviceUrl = conversationRef.serviceUrl.replace(/\/$/, '');
  const conversationId = conversationRef.conversation.id;
  const sendUrl = `${serviceUrl}/v3/conversations/${encodeURIComponent(conversationId)}/activities`;

  const sendResponse = await fetch(sendUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(activity),
  });

  if (!sendResponse.ok) {
    const errBody = await sendResponse.text();
    return { success: false, error: `Send failed (${sendResponse.status}): ${errBody}` };
  }

  return { success: true };
}

// ── Azure AD User Resolution ─────────────────────────────────

/**
 * Resolve an Azure AD object ID to a user email.
 * Falls back to the Microsoft Graph API if we have app credentials.
 *
 * In dev mode (no credentials), returns a placeholder so the bot
 * still functions with the readonly role.
 */
export async function resolveEmailFromAadId(aadObjectId: string): Promise<string> {
  const appId = process.env.TEAMS_BOT_APP_ID;
  const appPassword = process.env.TEAMS_BOT_APP_PASSWORD;
  const tenantId = process.env.AZURE_AD_TENANT_ID;

  if (!appId || !appPassword || !tenantId) {
    return 'unknown';
  }

  try {
    // Get app-only token for Graph API
    const tokenResponse = await fetch(
      `https://login.microsoftonline.com/${tenantId}/oauth2/v2.0/token`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'client_credentials',
          client_id: appId,
          client_secret: appPassword,
          scope: 'https://graph.microsoft.com/.default',
        }),
      }
    );

    if (!tokenResponse.ok) return 'unknown';

    const tokenData = (await tokenResponse.json()) as { access_token?: string };
    if (!tokenData.access_token) return 'unknown';

    // Look up user by AAD object ID
    const userResponse = await fetch(
      `https://graph.microsoft.com/v1.0/users/${aadObjectId}?$select=mail,userPrincipalName`,
      {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      }
    );

    if (!userResponse.ok) return 'unknown';

    const userData = (await userResponse.json()) as {
      mail?: string;
      userPrincipalName?: string;
    };

    return userData.mail ?? userData.userPrincipalName ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

// ── Bot Framework Token Validation ───────────────────────────

/**
 * Validate the Bot Framework JWT token from the Authorization header.
 * In production, this should verify the JWT signature against Microsoft's
 * OpenID metadata keys. For initial deployment, we do a lightweight check
 * and allow skipping in dev mode.
 */
export function validateBotFrameworkAuth(
  authHeader: string | null
): { valid: boolean; reason?: string } {
  // Dev mode: skip validation if no bot credentials configured
  if (!process.env.TEAMS_BOT_APP_ID) {
    return { valid: true, reason: 'dev-mode-skip' };
  }

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { valid: false, reason: 'Missing or malformed Authorization header' };
  }

  const token = authHeader.slice(7);
  if (!token || token.length < 50) {
    return { valid: false, reason: 'Token too short' };
  }

  // Decode JWT payload (no signature verification — add JWKS validation for production)
  try {
    const parts = token.split('.');
    if (parts.length !== 3) {
      return { valid: false, reason: 'Invalid JWT structure' };
    }

    const payload = JSON.parse(
      Buffer.from(parts[1], 'base64url').toString('utf-8')
    ) as { aud?: string; iss?: string; exp?: number };

    // Check audience matches our bot app ID
    if (payload.aud && payload.aud !== process.env.TEAMS_BOT_APP_ID) {
      return { valid: false, reason: 'Audience mismatch' };
    }

    // Check token expiry
    if (payload.exp && payload.exp * 1000 < Date.now()) {
      return { valid: false, reason: 'Token expired' };
    }

    // Check issuer is from Microsoft
    if (payload.iss && !payload.iss.includes('microsoftonline.com') && !payload.iss.includes('sts.windows.net')) {
      return { valid: false, reason: 'Invalid issuer' };
    }

    return { valid: true };
  } catch {
    return { valid: false, reason: 'Failed to decode token' };
  }
}
