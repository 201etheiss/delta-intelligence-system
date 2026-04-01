/**
 * Microsoft Teams Bot — receives messages from Teams chats and channels,
 * processes them through the DI chat engine, and responds.
 *
 * Registration: Azure Bot Service -> Messaging endpoint = https://intelligence.delta360.energy/api/teams/bot
 * App ID and Password from Azure Bot registration stored in env vars.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { getUserRole, ROLES } from '@/lib/config/roles';
import { runAgenticLoop } from '@/lib/agentic-loop';
import { buildStaticSystemPrompt, buildDynamicContext } from '@/lib/token-optimizer';
import { logAudit } from '@/lib/audit-log';
import { checkRateLimit, CHAT_LIMIT } from '@/lib/rate-limit';
import {
  type TeamsActivity,
  formatForTeams,
  buildAdaptiveCard,
  validateBotFrameworkAuth,
  resolveEmailFromAadId,
  saveConversationReference,
  buildConversationReference,
} from '@/lib/teams-bot';

// ── Reply Helper ─────────────────────────────────────────────

async function sendReply(
  serviceUrl: string,
  conversationId: string,
  activityId: string,
  reply: { text?: string; attachments?: Array<Record<string, unknown>> }
): Promise<void> {
  const appId = process.env.TEAMS_BOT_APP_ID;
  const appPassword = process.env.TEAMS_BOT_APP_PASSWORD;

  if (!appId || !appPassword) {
    console.warn('[teams-bot] No bot credentials — cannot send reply');
    return;
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
    console.error('[teams-bot] Failed to get bot token:', tokenResponse.status);
    return;
  }

  const tokenData = (await tokenResponse.json()) as { access_token?: string };
  if (!tokenData.access_token) return;

  const activity: Record<string, unknown> = {
    type: 'message',
    replyToId: activityId,
    ...reply,
  };

  if (reply.text) {
    activity.textFormat = 'markdown';
  }

  const url = `${serviceUrl.replace(/\/$/, '')}/v3/conversations/${encodeURIComponent(conversationId)}/activities`;

  const sendResponse = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${tokenData.access_token}`,
    },
    body: JSON.stringify(activity),
  });

  if (!sendResponse.ok) {
    const errBody = await sendResponse.text();
    console.error(`[teams-bot] Reply failed (${sendResponse.status}):`, errBody);
  }
}

// ── Detect if response has table data ────────────────────────

function detectTableInResponse(content: string): Array<Record<string, string | number>> | null {
  // Look for markdown table pattern: | col | col |
  const lines = content.split('\n');
  const tableLines = lines.filter((l) => l.trim().startsWith('|') && l.trim().endsWith('|'));

  if (tableLines.length < 3) return null; // Need header + separator + at least 1 row

  // Check for separator row (| --- | --- |)
  const hasSeparator = tableLines.some((l) => /\|\s*-{2,}\s*\|/.test(l));
  if (!hasSeparator) return null;

  // Parse the table
  const headerLine = tableLines[0];
  const headers = headerLine
    .split('|')
    .map((h) => h.trim())
    .filter(Boolean);

  const rows: Array<Record<string, string | number>> = [];
  for (let i = 2; i < tableLines.length; i++) {
    const cells = tableLines[i]
      .split('|')
      .map((c) => c.trim())
      .filter(Boolean);

    if (cells.length === headers.length) {
      const row: Record<string, string | number> = {};
      headers.forEach((h, idx) => {
        const val = cells[idx];
        const num = Number(val.replace(/[,$%]/g, ''));
        row[h] = !isNaN(num) && val.length > 0 ? num : val;
      });
      rows.push(row);
    }
  }

  return rows.length > 0 ? rows : null;
}

// ── POST: Receive Teams Bot Framework Activity ───────────────

export async function POST(request: NextRequest): Promise<Response> {
  // Validate Bot Framework auth token
  const authResult = validateBotFrameworkAuth(
    request.headers.get('authorization')
  );
  if (!authResult.valid) {
    console.warn('[teams-bot] Auth failed:', authResult.reason);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let activity: TeamsActivity;
  try {
    activity = (await request.json()) as TeamsActivity;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  // Handle conversationUpdate (bot added to team, new member, etc.)
  if (activity.type === 'conversationUpdate') {
    const botId = activity.recipient?.id;
    const added = activity.membersAdded ?? [];
    const botAdded = added.some((m) => m.id === botId);

    if (botAdded && activity.serviceUrl && activity.conversation?.id) {
      // Bot was added — save the conversation reference for proactive messaging
      const ref = buildConversationReference(activity);
      saveConversationReference(activity.conversation.id, ref);

      await sendReply(
        activity.serviceUrl,
        activity.conversation.id,
        activity.id ?? '',
        {
          text: '**Delta Intelligence** is ready. Ask me anything about your ERP, CRM, fleet, or financial data.\n\nExamples:\n- "Show AR aging over 90 days"\n- "What are my top 10 customers by revenue?"\n- "Check fleet utilization this week"',
        }
      );
    }
    return new Response('', { status: 200 });
  }

  // Handle invoke (adaptive card actions, etc.) — acknowledge
  if (activity.type === 'invoke') {
    return NextResponse.json({ status: 200, body: {} }, { status: 200 });
  }

  // Only process message activities from here
  if (activity.type !== 'message') {
    return new Response('', { status: 200 });
  }

  // Strip @mention tags to get the actual user query
  const rawText = activity.text ?? '';
  const text = rawText.replace(/<at>.*?<\/at>/g, '').trim();

  if (!text) {
    return new Response('', { status: 200 });
  }

  // For channel messages, only respond when the bot was @mentioned
  const isChannel = activity.conversation?.conversationType === 'channel';
  if (isChannel) {
    const botMentioned = (activity.entities ?? []).some(
      (e) => e.type === 'mention' && (e as Record<string, unknown>).mentioned &&
        ((e as Record<string, Record<string, string>>).mentioned?.id === activity.recipient?.id)
    );
    if (!botMentioned) {
      return new Response('', { status: 200 });
    }
  }

  // Save conversation reference for proactive messaging
  if (activity.serviceUrl && activity.conversation?.id) {
    const ref = buildConversationReference(activity);
    const refKey = isChannel
      ? `channel:${activity.conversation.id}`
      : `user:${activity.from?.aadObjectId ?? activity.from?.id ?? 'unknown'}`;
    saveConversationReference(refKey, ref);
  }

  // Resolve sender email and role
  let senderEmail = 'unknown';
  if (activity.from?.aadObjectId) {
    senderEmail = await resolveEmailFromAadId(activity.from.aadObjectId);
  } else if (activity.from?.email) {
    senderEmail = activity.from.email;
  }

  const role = getUserRole(senderEmail);
  const roleConfig = ROLES[role];

  // Rate limiting
  const rl = checkRateLimit(`teams:${senderEmail}`, CHAT_LIMIT);
  if (!rl.allowed) {
    if (activity.serviceUrl && activity.conversation?.id) {
      await sendReply(
        activity.serviceUrl,
        activity.conversation.id,
        activity.id ?? '',
        { text: 'You have sent too many messages. Please wait a moment before trying again.' }
      );
    }
    return new Response('', { status: 200 });
  }

  // Audit log
  logAudit({
    userEmail: senderEmail,
    role,
    action: 'teams_message',
    detail: text.slice(0, 200),
    tool: 'teams_bot',
    success: true,
  });

  // Process through the DI agentic loop
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      if (activity.serviceUrl && activity.conversation?.id) {
        await sendReply(
          activity.serviceUrl,
          activity.conversation.id,
          activity.id ?? '',
          { text: 'Delta Intelligence is not fully configured yet. Please contact your administrator.' }
        );
      }
      return new Response('', { status: 200 });
    }

    const client = new Anthropic({ apiKey });

    // Build system prompt (same as chat route)
    const staticPrompt = buildStaticSystemPrompt();
    const dynamicPrompt = buildDynamicContext(
      roleConfig.name,
      roleConfig.services,
      text,
      role
    );

    const systemPromptBlocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text' as const,
        text: staticPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
      {
        type: 'text' as const,
        text: dynamicPrompt + '\n\nYou are responding via Microsoft Teams. Keep responses concise and well-formatted for Teams. Use bold for headers, bullet lists, and short paragraphs. If data has a table, format it as a markdown table.',
      },
    ];

    const messages: Anthropic.MessageParam[] = [
      { role: 'user', content: text },
    ];

    const loopResult = await runAgenticLoop({
      client,
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      systemPrompt: systemPromptBlocks,
      messages,
      role,
      userEmail: senderEmail,
      maxRounds: 8, // Fewer rounds for Teams (keep response times reasonable)
    });

    // Format response for Teams
    const formattedText = formatForTeams(loopResult.content);

    // Check if response contains a table — send as adaptive card if so
    const tableRows = detectTableInResponse(loopResult.content);
    const replyPayload: { text?: string; attachments?: Array<Record<string, unknown>> } = {};

    if (tableRows && tableRows.length > 0) {
      // Send both text summary and adaptive card
      const nonTableText = loopResult.content
        .split('\n')
        .filter((l) => !l.trim().startsWith('|'))
        .join('\n')
        .trim();

      if (nonTableText) {
        replyPayload.text = formatForTeams(nonTableText);
      }

      const card = buildAdaptiveCard({
        title: 'Delta Intelligence',
        rows: tableRows,
      });

      replyPayload.attachments = [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ];
    } else {
      replyPayload.text = formattedText;
    }

    // Send the reply
    if (activity.serviceUrl && activity.conversation?.id) {
      await sendReply(
        activity.serviceUrl,
        activity.conversation.id,
        activity.id ?? '',
        replyPayload
      );
    }

    console.log(`[teams-bot] Replied to ${senderEmail} (${role}) — ${loopResult.inputTokens + loopResult.outputTokens} tokens`);

    // Return 200 to acknowledge receipt (reply sent separately)
    return new Response('', { status: 200 });
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Unknown error';
    console.error('[teams-bot] Error processing message:', errMsg);

    // Try to send an error message back to the user
    if (activity.serviceUrl && activity.conversation?.id) {
      await sendReply(
        activity.serviceUrl,
        activity.conversation.id,
        activity.id ?? '',
        { text: 'Sorry, I encountered an error processing your request. Please try again.' }
      );
    }

    return new Response('', { status: 200 });
  }
}
