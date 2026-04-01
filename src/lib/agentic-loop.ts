/**
 * Shared agentic tool loop for Anthropic API calls.
 * Used by chat/route.ts and reports/generate/route.ts to avoid duplicated tool-call logic.
 */

import Anthropic from '@anthropic-ai/sdk';
import { gatewayFetch } from '@/lib/gateway';
import { compressGatewayResult } from '@/lib/token-optimizer';
import { generateWorkbook, generateWorkbookTool as generateWorkbookToolDef } from '@/lib/workbook-generator';
import { createCalendarEvent, parseTime, findUserEmail, KNOWN_EMPLOYEES } from '@/lib/calendar';
import type { UserRole, ToolPermission } from '@/lib/config/roles';
import { canUseTool, ROLES, checkServiceAccess, resolveServiceAdmin } from '@/lib/config/roles';
import { logAudit } from '@/lib/audit-log';
import { signalMapTool, handleSignalMapTool } from '@/lib/chat/signal-map-tool';

const queryGatewayTool: Anthropic.Tool = {
  name: 'query_gateway',
  description: 'Fetch data from the Delta360 unified data gateway. Use this to answer questions about ERP, CRM, fleet, or financial data.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: {
        type: 'string',
        description: 'The endpoint path (e.g. /ascend/ar/aging or /salesforce/opportunities)',
      },
      method: {
        type: 'string',
        enum: ['GET', 'POST'],
        description: 'HTTP method',
      },
      body: {
        type: 'object',
        description: 'Request body for POST requests (e.g. { sql: "SELECT ..." } for query endpoints)',
      },
    },
    required: ['path', 'method'],
  },
};

const sfCreateTool: Anthropic.Tool = {
  name: 'salesforce_create',
  description: 'Create a new record in Salesforce. Use for: creating Tasks (follow-ups), logging Activities, creating Cases, adding Contacts, or creating Opportunities. Always confirm with the user before creating records.',
  input_schema: {
    type: 'object' as const,
    properties: {
      object: { type: 'string', description: 'Salesforce object name: Task, Event, Case, Contact, Opportunity, Lead, Account, Note' },
      fields: { type: 'object', description: 'Field values. For Task: {Subject, Status, Priority, ActivityDate, WhoId, WhatId, OwnerId, Description}. For Contact: {FirstName, LastName, Email, Phone, AccountId}. For Opportunity: {Name, StageName, Amount, CloseDate, AccountId}.' },
    },
    required: ['object', 'fields'],
  },
};

const sfUpdateTool: Anthropic.Tool = {
  name: 'salesforce_update',
  description: 'Update an existing Salesforce record. Use for: updating Opportunity stage, changing Task status, modifying Contact info, updating Account details. Always confirm with the user before updating.',
  input_schema: {
    type: 'object' as const,
    properties: {
      object: { type: 'string', description: 'Salesforce object name' },
      id: { type: 'string', description: 'The Salesforce record ID (18-char)' },
      fields: { type: 'object', description: 'Fields to update with new values' },
    },
    required: ['object', 'id', 'fields'],
  },
};

const calendarCreateTool: Anthropic.Tool = {
  name: 'create_calendar_event',
  description: 'Create a Microsoft Teams calendar event. Use when the user asks to schedule a meeting, call, or calendar event. Always confirm the details with the user before creating. Supports natural language time parsing (e.g. "tomorrow at 2 PM", "next Thursday at 10 AM").',
  input_schema: {
    type: 'object' as const,
    properties: {
      subject: { type: 'string', description: 'Meeting title/subject' },
      time: { type: 'string', description: 'Natural language time (e.g. "tomorrow at 2 PM", "next Monday at 10 AM for 30 minutes")' },
      attendees: {
        type: 'array',
        items: { type: 'string' },
        description: 'Attendee names or emails. Names are auto-resolved to @delta360.energy emails. Known employees: evan, adam vegas, courtney, anna snodgrass, ashlee hey, etc.',
      },
      body: { type: 'string', description: 'Optional meeting description/agenda (HTML supported)' },
      location: { type: 'string', description: 'Optional location (defaults to Teams meeting)' },
      includeTeamsLink: { type: 'boolean', description: 'Whether to include a Teams meeting link (default: true)' },
    },
    required: ['subject', 'time', 'attendees'],
  },
};

const readEmailTool: Anthropic.Tool = {
  name: 'read_email',
  description: 'Read emails from any Delta360 user\'s Microsoft 365 mailbox. Use when the user asks to check emails, search inbox, find messages, or review correspondence. Requires the user\'s email address.',
  input_schema: {
    type: 'object' as const,
    properties: {
      userEmail: { type: 'string', description: 'The email address of the user whose mailbox to read (e.g. etheiss@delta360.energy, avegas@delta360.energy)' },
      search: { type: 'string', description: 'Optional search query to filter emails (e.g. "pricing", "invoice", "meeting")' },
      count: { type: 'number', description: 'Number of emails to return (default: 5, max: 20)' },
      unreadOnly: { type: 'boolean', description: 'If true, only return unread emails' },
    },
    required: ['userEmail'],
  },
};

const sendEmailTool: Anthropic.Tool = {
  name: 'send_email',
  description: 'Send an email from a Delta360 user\'s Microsoft 365 account. Use when the user asks to "send an email", "email someone", "draft and send", or "notify by email". Always confirm the content with the user before sending.',
  input_schema: {
    type: 'object' as const,
    properties: {
      from: { type: 'string', description: 'Sender email (default: etheiss@delta360.energy). Must be a @delta360.energy address.' },
      to: { type: 'array', items: { type: 'string' }, description: 'Recipient email addresses' },
      cc: { type: 'array', items: { type: 'string' }, description: 'CC recipients (optional)' },
      subject: { type: 'string', description: 'Email subject line' },
      body: { type: 'string', description: 'Email body content (HTML supported)' },
      importance: { type: 'string', enum: ['low', 'normal', 'high'], description: 'Email importance (default: normal)' },
    },
    required: ['to', 'subject', 'body'],
  },
};

const manageEmailTool: Anthropic.Tool = {
  name: 'manage_email',
  description: 'Manage emails in a Delta360 user\'s mailbox — flag, unflag, mark read/unread, move to folder, create mail rules, or create folders. Use when the user asks to "flag emails", "move to folder", "mark as read", "create a rule", "prioritize inbox", "organize emails", or "set up email rules".',
  input_schema: {
    type: 'object' as const,
    properties: {
      userEmail: { type: 'string', description: 'The mailbox to manage (e.g. amarks@delta360.energy)' },
      action: {
        type: 'string',
        enum: ['flag', 'unflag', 'markRead', 'markUnread', 'move', 'createFolder', 'createRule', 'listFolders', 'categorize'],
        description: 'The action to perform',
      },
      messageIds: {
        type: 'array',
        items: { type: 'string' },
        description: 'Message IDs to act on (for flag/unflag/markRead/markUnread/move/categorize)',
      },
      folderName: { type: 'string', description: 'Target folder name (for move or createFolder)' },
      folderId: { type: 'string', description: 'Target folder ID (for move — use listFolders to get IDs)' },
      category: { type: 'string', description: 'Category to apply (Red, Orange, Yellow, Green, Blue, Purple)' },
      rule: {
        type: 'object',
        description: 'Mail rule definition (for createRule). Properties: displayName, conditions (senderContains, subjectContains, fromAddresses), actions (moveToFolder, flagMessage, markImportance)',
      },
    },
    required: ['userEmail', 'action'],
  },
};

const checkAvailabilityTool: Anthropic.Tool = {
  name: 'check_availability',
  description: 'Check free/busy status for Delta360 users before scheduling. Shows busy/free for a date range. ALWAYS call this BEFORE create_calendar_event to confirm attendees are available.',
  input_schema: {
    type: 'object' as const,
    properties: {
      emails: { type: 'array', items: { type: 'string' }, description: 'Email addresses to check' },
      date: { type: 'string', description: 'Date (YYYY-MM-DD). Default: tomorrow.' },
      startHour: { type: 'number', description: 'Start hour 24h (default 8)' },
      endHour: { type: 'number', description: 'End hour 24h (default 17)' },
    },
    required: ['emails'],
  },
};

export { queryGatewayTool, sfCreateTool, sfUpdateTool, calendarCreateTool, readEmailTool, sendEmailTool, manageEmailTool, checkAvailabilityTool };

export interface AgenticLoopConfig {
  client: Anthropic;
  model: string;
  maxTokens: number;
  systemPrompt: string | Anthropic.TextBlockParam[];
  messages: Anthropic.MessageParam[];
  tools?: Anthropic.Tool[];
  role: UserRole;
  /** The authenticated user's email. Used to enforce per-user mailbox scoping. */
  userEmail?: string;
  maxRounds?: number;
  onToolCall?: (name: string, input: unknown) => Promise<string>;
}

export interface AgenticLoopResult {
  content: string;
  inputTokens: number;
  outputTokens: number;
}

/**
 * Run the agentic tool loop: send messages to Anthropic, handle tool_use rounds,
 * and return the final text content with token counts.
 */
export async function runAgenticLoop(config: AgenticLoopConfig): Promise<AgenticLoopResult> {
  const {
    client,
    model,
    maxTokens,
    systemPrompt,
    messages,
    role,
    maxRounds = 12,
    onToolCall,
  } = config;

  const tools = config.tools ?? [queryGatewayTool, generateWorkbookToolDef, sfCreateTool, sfUpdateTool, calendarCreateTool, checkAvailabilityTool, readEmailTool, sendEmailTool, manageEmailTool, signalMapTool];

  // Filter tools by role permissions
  const filteredTools = tools.filter(tool => {
    // If no role specified (e.g. reports), allow all tools
    if (!config.role) return true;
    return canUseTool(config.role, tool.name as ToolPermission);
  });

  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let finalContent = '';

  const currentMessages = [...messages];
  let round = 0;

  while (round < maxRounds) {
    round++;
    const response = await client.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: filteredTools,
      messages: currentMessages,
    });

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    if (response.stop_reason === 'end_turn') {
      finalContent = response.content
        .filter((block): block is Anthropic.TextBlock => block.type === 'text')
        .map(block => block.text)
        .join('\n');
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
      );

      currentMessages.push({ role: 'assistant', content: response.content });

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (toolUse) => {
          // Custom tool handler takes priority
          if (onToolCall) {
            try {
              const result = await onToolCall(toolUse.name, toolUse.input);
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: result,
              };
            } catch {
              // Fall through to built-in handlers
            }
          }

          // Built-in: generate_workbook
          if (toolUse.name === 'generate_workbook') {
            const input = toolUse.input as {
              title: string;
              sheets: Array<{
                name: string;
                endpoint: string;
                method: 'GET' | 'POST';
                body?: Record<string, unknown>;
                description?: string;
              }>;
            };
            try {
              const result = await generateWorkbook(input, role);
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'workbook', detail: input.title, tool: 'generate_workbook', success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              };
            } catch (err) {
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'workbook', detail: input.title, tool: 'generate_workbook', success: false });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Workbook generation failed' }),
              };
            }
          }

          // Built-in: salesforce_create
          if (toolUse.name === 'salesforce_create') {
            const input = toolUse.input as { object: string; fields: Record<string, unknown> };
            try {
              const result = await gatewayFetch('/salesforce/create', role, {
                method: 'POST',
                body: { object: input.object, fields: input.fields },
              });
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'sf_create', detail: input.object, tool: 'salesforce_create', target: input.object, success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              };
            } catch (err) {
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'sf_create', detail: input.object, tool: 'salesforce_create', target: input.object, success: false });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Salesforce create failed' }),
              };
            }
          }

          // Built-in: salesforce_update
          if (toolUse.name === 'salesforce_update') {
            const input = toolUse.input as { object: string; id: string; fields: Record<string, unknown> };
            try {
              const result = await gatewayFetch('/salesforce/update', role, {
                method: 'POST',
                body: { object: input.object, id: input.id, fields: input.fields },
              });
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'sf_update', detail: `${input.object}/${input.id}`, tool: 'salesforce_update', target: input.object, success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify(result),
              };
            } catch (err) {
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'sf_update', detail: `${input.object}/${input.id}`, tool: 'salesforce_update', target: input.object, success: false });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Salesforce update failed' }),
              };
            }
          }

          // Built-in: check_availability
          if (toolUse.name === 'check_availability') {
            const input = toolUse.input as {
              emails: string[];
              date?: string;
              startHour?: number;
              endHour?: number;
            };

            try {
              const tomorrow = new Date();
              tomorrow.setDate(tomorrow.getDate() + 1);
              const dateStr = input.date ?? tomorrow.toISOString().slice(0, 10);
              const startH = input.startHour ?? 8;
              const endH = input.endHour ?? 17;

              // Resolve names to emails
              const resolvedEmails = input.emails.map(e => {
                if (e.includes('@')) return e;
                const known = KNOWN_EMPLOYEES[e.toLowerCase()];
                return known ?? `${e.toLowerCase().replace(/\s+/g, '')}@delta360.energy`;
              });

              const graphPayload = {
                schedules: resolvedEmails,
                startTime: { dateTime: `${dateStr}T${String(startH).padStart(2, '0')}:00:00`, timeZone: 'Central Standard Time' },
                endTime: { dateTime: `${dateStr}T${String(endH).padStart(2, '0')}:00:00`, timeZone: 'Central Standard Time' },
                availabilityViewInterval: 30,
              };

              const organizer = config.userEmail ?? resolvedEmails[0] ?? 'etheiss@delta360.energy';
              const result = await gatewayFetch('/microsoft/write', role, {
                method: 'POST',
                body: { path: `/users/${organizer}/calendar/getSchedule`, body: graphPayload },
              });

              const data = result as Record<string, unknown>;
              const schedules = ((data.value ?? []) as Array<Record<string, unknown>>).map(s => {
                const items = (s.scheduleItems ?? []) as Array<Record<string, unknown>>;
                return {
                  email: s.scheduleId,
                  availability: s.availabilityView, // 0=free, 1=tentative, 2=busy, 3=oof, 4=working elsewhere
                  busySlots: items.map(item => ({
                    status: item.status,
                    subject: (item.subject ?? '(private)') as string,
                    start: ((item.start as Record<string, string>)?.dateTime ?? '').slice(0, 16),
                    end: ((item.end as Record<string, string>)?.dateTime ?? '').slice(0, 16),
                  })),
                  freeSlots: [] as string[],
                };
              });

              // Parse availability string to find free 30-min slots
              for (const sched of schedules) {
                const av = String(sched.availability ?? '');
                for (let i = 0; i < av.length; i++) {
                  if (av[i] === '0') {
                    const slotHour = startH + Math.floor(i / 2);
                    const slotMin = (i % 2) * 30;
                    sched.freeSlots.push(`${String(slotHour).padStart(2, '0')}:${String(slotMin).padStart(2, '0')}`);
                  }
                }
              }

              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'calendar_check', detail: `Checked ${resolvedEmails.length} users for ${dateStr}`, tool: 'check_availability', target: resolvedEmails.join(', '), success: true });

              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  success: true,
                  date: dateStr,
                  range: `${startH}:00 - ${endH}:00 CT`,
                  schedules,
                }),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Availability check failed' }),
              };
            }
          }

          // Built-in: create_calendar_event
          if (toolUse.name === 'create_calendar_event') {
            const input = toolUse.input as {
              subject: string;
              time: string;
              attendees: string[];
              body?: string;
              location?: string;
              includeTeamsLink?: boolean;
            };

            try {
              // Parse the natural language time
              const parsed = parseTime(input.time);
              if (!parsed) {
                return {
                  type: 'tool_result' as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify({ success: false, error: `Could not parse time: "${input.time}". Try formats like "tomorrow at 2 PM" or "next Monday at 10 AM for 30 minutes".` }),
                };
              }

              // Resolve attendee names to emails
              const resolvedAttendees: string[] = [];
              for (const attendee of input.attendees) {
                if (attendee.includes('@')) {
                  resolvedAttendees.push(attendee);
                } else {
                  const known = KNOWN_EMPLOYEES[attendee.toLowerCase()];
                  if (known) {
                    resolvedAttendees.push(known);
                  } else {
                    const found = await findUserEmail(attendee);
                    if (found) {
                      resolvedAttendees.push(found);
                    } else {
                      resolvedAttendees.push(`${attendee.toLowerCase().replace(/\s+/g, '')}@delta360.energy`);
                    }
                  }
                }
              }

              const result = await createCalendarEvent({
                subject: input.subject,
                start: parsed.start,
                end: parsed.end,
                attendees: resolvedAttendees,
                body: input.body,
                location: input.location,
                isOnlineMeeting: input.includeTeamsLink !== false,
                organizer: config.userEmail ?? 'etheiss@delta360.energy',
              });

              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'calendar_create', detail: input.subject, tool: 'create_calendar_event', success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  ...result,
                  scheduledStart: parsed.start,
                  scheduledEnd: parsed.end,
                  resolvedAttendees,
                }),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Calendar event creation failed' }),
              };
            }
          }

          // Built-in: send_email
          if (toolUse.name === 'send_email') {
            const input = toolUse.input as {
              from?: string;
              to: string[];
              cc?: string[];
              subject: string;
              body: string;
              importance?: string;
            };

            // Enforce send-as scoping: non-admins can only send as themselves (immutable copy)
            const scopedInput = (!ROLES[role].sendAsOthers && config.userEmail)
              ? { ...input, from: config.userEmail }
              : input;

            const sender = scopedInput.from ?? 'etheiss@delta360.energy';
            const graphPayload = {
              message: {
                subject: scopedInput.subject,
                body: { contentType: 'HTML', content: scopedInput.body },
                toRecipients: scopedInput.to.map(email => ({ emailAddress: { address: email } })),
                ...(scopedInput.cc ? { ccRecipients: scopedInput.cc.map(email => ({ emailAddress: { address: email } })) } : {}),
                importance: scopedInput.importance ?? 'normal',
              },
              saveToSentItems: true,
            };

            try {
              await gatewayFetch('/microsoft/write', role, {
                method: 'POST',
                body: { path: `/users/${sender}/sendMail`, body: graphPayload },
              });

              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'email_send', detail: 'To: ' + input.to.join(', '), tool: 'send_email', target: input.to[0], success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  success: true,
                  message: `Email sent from ${sender} to ${input.to.join(', ')}`,
                  subject: input.subject,
                }),
              };
            } catch {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: 'Failed to send email' }),
              };
            }
          }

          // Built-in: manage_email (flag, move, rules, folders, categories)
          if (toolUse.name === 'manage_email') {
            const input = toolUse.input as {
              userEmail: string;
              action: string;
              messageIds?: string[];
              folderName?: string;
              folderId?: string;
              category?: string;
              rule?: Record<string, unknown>;
            };

            // Enforce email scoping: non-admins can only manage their own mailbox (immutable copy)
            const scopedInput = (!ROLES[role].crossMailboxAccess && config.userEmail)
              ? { ...input, userEmail: config.userEmail }
              : input;

            const user = scopedInput.userEmail;
            const results: Array<{ action: string; success: boolean; detail?: string }> = [];

            try {
              switch (input.action) {
                case 'listFolders': {
                  const res = await gatewayFetch('/microsoft/query', role, {
                    method: 'POST',
                    body: { path: `/users/${user}/mailFolders?$top=50` },
                  });
                  const folders = ((res as Record<string, unknown>).value ?? []) as Array<Record<string, unknown>>;
                  return {
                    type: 'tool_result' as const,
                    tool_use_id: toolUse.id,
                    content: JSON.stringify({
                      success: true,
                      folders: folders.map(f => ({ id: f.id, name: f.displayName, unread: f.unreadItemCount, total: f.totalItemCount })),
                    }),
                  };
                }

                case 'createFolder': {
                  const res = await gatewayFetch('/microsoft/write', role, {
                    method: 'POST',
                    body: { path: `/users/${user}/mailFolders`, body: { displayName: input.folderName ?? 'Priority' } },
                  });
                  results.push({ action: 'createFolder', success: true, detail: `Created folder: ${input.folderName}` });
                  break;
                }

                case 'flag':
                case 'unflag': {
                  for (const msgId of (input.messageIds ?? [])) {
                    await gatewayFetch('/microsoft/write', role, {
                      method: 'POST',
                      body: {
                        path: `/users/${user}/messages/${msgId}`,
                        method: 'PATCH',
                        body: { flag: { flagStatus: input.action === 'flag' ? 'flagged' : 'notFlagged' } },
                      },
                    });
                  }
                  results.push({ action: input.action, success: true, detail: `${input.action}ged ${(input.messageIds ?? []).length} messages` });
                  break;
                }

                case 'markRead':
                case 'markUnread': {
                  for (const msgId of (input.messageIds ?? [])) {
                    await gatewayFetch('/microsoft/write', role, {
                      method: 'POST',
                      body: {
                        path: `/users/${user}/messages/${msgId}`,
                        method: 'PATCH',
                        body: { isRead: input.action === 'markRead' },
                      },
                    });
                  }
                  results.push({ action: input.action, success: true, detail: `Marked ${(input.messageIds ?? []).length} messages` });
                  break;
                }

                case 'move': {
                  let targetId = input.folderId;
                  if (!targetId && input.folderName) {
                    const fRes = await gatewayFetch('/microsoft/query', role, {
                      method: 'POST',
                      body: { path: `/users/${user}/mailFolders?$filter=displayName eq '${input.folderName}'` },
                    });
                    const folders = ((fRes as Record<string, unknown>).value ?? []) as Array<Record<string, unknown>>;
                    targetId = folders[0]?.id as string | undefined;
                    if (!targetId) {
                      const cRes = await gatewayFetch('/microsoft/write', role, {
                        method: 'POST',
                        body: { path: `/users/${user}/mailFolders`, body: { displayName: input.folderName } },
                      });
                      targetId = (cRes as Record<string, unknown>).id as string;
                    }
                  }
                  if (targetId) {
                    for (const msgId of (input.messageIds ?? [])) {
                      await gatewayFetch('/microsoft/write', role, {
                        method: 'POST',
                        body: { path: `/users/${user}/messages/${msgId}/move`, body: { destinationId: targetId } },
                      });
                    }
                    results.push({ action: 'move', success: true, detail: `Moved ${(input.messageIds ?? []).length} messages to ${input.folderName ?? targetId}` });
                  }
                  break;
                }

                case 'categorize': {
                  const cat = input.category ?? 'Red category';
                  for (const msgId of (input.messageIds ?? [])) {
                    await gatewayFetch('/microsoft/write', role, {
                      method: 'POST',
                      body: {
                        path: `/users/${user}/messages/${msgId}`,
                        method: 'PATCH',
                        body: { categories: [cat] },
                      },
                    });
                  }
                  results.push({ action: 'categorize', success: true, detail: `Applied "${cat}" to ${(input.messageIds ?? []).length} messages` });
                  break;
                }

                case 'createRule': {
                  if (input.rule) {
                    await gatewayFetch('/microsoft/write', role, {
                      method: 'POST',
                      body: { path: `/users/${user}/mailFolders/inbox/messageRules`, body: input.rule },
                    });
                    results.push({ action: 'createRule', success: true, detail: `Created rule: ${(input.rule as Record<string, unknown>).displayName ?? 'unnamed'}` });
                  }
                  break;
                }
              }

              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'email_manage', detail: input.action + ' on ' + scopedInput.userEmail, tool: 'manage_email', target: scopedInput.userEmail, success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: true, results }),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Email management failed', results }),
              };
            }
          }

          // Built-in: read_email
          if (toolUse.name === 'read_email') {
            const input = toolUse.input as {
              userEmail: string;
              search?: string;
              count?: number;
              unreadOnly?: boolean;
            };

            try {
              // Enforce email scoping: non-admins can only read their own mailbox (immutable copy)
              const scopedInput = (!ROLES[role].crossMailboxAccess && config.userEmail)
                ? { ...input, userEmail: config.userEmail }
                : input;

              const count = Math.min(scopedInput.count ?? 5, 20);
              let path = `/users/${scopedInput.userEmail}/messages?$top=${count}&$select=subject,from,receivedDateTime,bodyPreview,isRead,importance&$orderby=receivedDateTime desc`;

              if (scopedInput.search) {
                path += `&$search="${encodeURIComponent(scopedInput.search)}"`;
              }
              if (scopedInput.unreadOnly) {
                path += `&$filter=isRead eq false`;
              }

              const result = await gatewayFetch('/microsoft/query', role, {
                method: 'POST',
                body: { path },
              });

              const data = result as Record<string, unknown>;
              const emailMessages = (data.value ?? []) as Array<Record<string, unknown>>;

              const formatted = emailMessages.map((m) => ({
                id: String(m.id ?? ''),
                subject: m.subject ?? '(no subject)',
                from: (m.from as Record<string, Record<string, string>>)?.emailAddress?.name ?? '?',
                fromEmail: (m.from as Record<string, Record<string, string>>)?.emailAddress?.address ?? '?',
                date: String(m.receivedDateTime ?? '').slice(0, 16),
                preview: String(m.bodyPreview ?? '').slice(0, 200),
                isRead: m.isRead ?? true,
                importance: m.importance ?? 'normal',
              }));

              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'email_read', detail: scopedInput.userEmail, tool: 'read_email', target: scopedInput.userEmail, success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({
                  success: true,
                  mailbox: scopedInput.userEmail,
                  count: formatted.length,
                  messages: formatted,
                }),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Email read failed' }),
              };
            }
          }

          // Built-in: query_gateway
          if (toolUse.name === 'query_gateway') {
            const input = toolUse.input as { path: string; method: 'GET' | 'POST'; body?: object };

            try {
              // Extract service from path (e.g. "/ascend/query" → "ascend")
              const pathService = input.path.replace(/^\//, '').split('/')[0];
              const serviceAccess = checkServiceAccess(role, pathService);
              if (!serviceAccess.allowed) {
                // Enrich with dynamic admin from MS Graph org hierarchy
                const admin = await resolveServiceAdmin(pathService, config.userEmail);
                const svcName = pathService.charAt(0).toUpperCase() + pathService.slice(1);
                const denyMsg = `You don't have access to ${svcName} data with your current role (${ROLES[role].name}). To request access, contact ${admin.name} (${admin.email}) — ${admin.title}.`;
                return {
                  type: 'tool_result' as const,
                  tool_use_id: toolUse.id,
                  content: JSON.stringify({ success: false, error: denyMsg }),
                };
              }

              const result = await gatewayFetch(input.path, role, {
                method: input.method,
                body: input.body,
              });
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'query', detail: input.path, tool: 'query_gateway', target: input.path, success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: compressGatewayResult(result),
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Gateway query failed' }),
              };
            }
          }

          // Built-in: lookup_signal_map
          if (toolUse.name === 'lookup_signal_map') {
            const input = toolUse.input as { email: string; detail_level?: string };
            try {
              const result = await handleSignalMapTool(input);
              logAudit({ userEmail: config.userEmail ?? 'system', role, action: 'query', detail: `signal-map:${input.email}`, tool: 'lookup_signal_map', success: true });
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: result,
              };
            } catch (err) {
              return {
                type: 'tool_result' as const,
                tool_use_id: toolUse.id,
                content: JSON.stringify({ success: false, error: err instanceof Error ? err.message : 'Signal Map lookup failed' }),
              };
            }
          }

          // Unknown tool
          return {
            type: 'tool_result' as const,
            tool_use_id: toolUse.id,
            content: JSON.stringify({ error: `Unknown tool: ${toolUse.name}` }),
          };
        })
      );

      currentMessages.push({ role: 'user', content: toolResults });

      // On last allowed round, tell the model to wrap up
      if (round === maxRounds - 1) {
        currentMessages.push({
          role: 'user',
          content: 'You have used many tool calls. Please synthesize all the data you have collected so far and provide your final answer now. Do not make any more tool calls.',
        });
      }

      continue;
    }

    // Other stop reasons (max_tokens, etc.)
    finalContent = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === 'text')
      .map(block => block.text)
      .join('\n');
    break;
  }

  // If loop exhausted without final content
  if (!finalContent && currentMessages.length > 0) {
    finalContent = 'I gathered data from multiple sources but ran out of processing rounds. Here is what I found — please ask a more specific follow-up for details.';
  }

  return {
    content: finalContent,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  };
}
