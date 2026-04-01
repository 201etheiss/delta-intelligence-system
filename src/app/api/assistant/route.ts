import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { authOptions } from '@/lib/auth';
import { getUserRole, type UserRole } from '@/lib/config/roles';
import {
  getAssistantForRole,
  addLearning,
  addReminder,
  detectActions,
  type AssistantAction,
} from '@/lib/assistants';
import { getModelConfig, routeQueryDetailed, type ModelId } from '@/lib/router';
import { compactConversation, buildStaticSystemPrompt } from '@/lib/token-optimizer';
import { runAgenticLoop } from '@/lib/agentic-loop';
import { appendUsage, estimateCost } from '@/lib/usage-logger';
import { createCalendarEvent, parseTime, resolveEmail, findUserEmail } from '@/lib/calendar';
import { notify } from '@/lib/notifications';
import { validateResponse } from '@/lib/response-validator';
import { AssistantRequestSchema, validateRequest } from '@/lib/validation';

interface AssistantChatRequest {
  messages: Array<{ role: string; content: string }>;
  model?: string;
}

interface AssistantChatResponse {
  content: string;
  model: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  actions: AssistantAction[];
  assistantName: string;
}

function parseRole(raw: string | null): UserRole {
  const valid: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];
  if (raw && valid.includes(raw as UserRole)) return raw as UserRole;
  return 'readonly';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.json();
    const validated = validateRequest(AssistantRequestSchema, raw);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data as AssistantChatRequest;

    // Determine role
    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      role = parseRole(request.headers.get('x-user-role') ?? 'readonly');
    }
    const userEmail = session?.user?.email ?? 'anonymous';

    // Get assistant for this role
    const assistant = getAssistantForRole(role);
    if (!assistant) {
      return NextResponse.json(
        { error: 'No assistant configured for this role' },
        { status: 404 }
      );
    }

    // Detect actions from the user's last message
    const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
    const userContent = lastUserMsg?.content ?? '';
    const detectedActions = detectActions(userContent);

    // Build assistant-specific system prompt
    const assistantContext = [
      assistant.systemPrompt,
      '',
      '# Your Learnings',
      'Things you have learned from past interactions with this user:',
      ...(assistant.learnings.length > 0
        ? assistant.learnings.map(l => `- ${l}`)
        : ['- No learnings yet. Pay attention to user preferences and save them.']),
      '',
      '# User Preferences',
      ...Object.entries(assistant.preferences).map(([k, v]) => `- ${k}: ${v}`),
      '',
      '# Active Actions Detected',
      detectedActions.length > 0
        ? `The user's message appears to contain these intents: ${detectedActions.map(a => a.type).join(', ')}. Address them directly.`
        : 'No special action intents detected.',
    ].join('\n');

    // Model routing
    const totalChars = body.messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);
    let modelId: ModelId;
    const validModels: ModelId[] = ['haiku', 'sonnet', 'opus', 'gpt4o', 'gemini-flash'];
    if (body.model && validModels.includes(body.model as ModelId)) {
      modelId = body.model as ModelId;
    } else {
      const routing = routeQueryDetailed(userContent, estimatedTokens);
      modelId = routing.modelId;
    }

    // Compact conversation
    const compacted = compactConversation(body.messages);

    const modelConfig = getModelConfig(modelId);

    // Only Anthropic supported currently
    if (modelConfig.provider !== 'anthropic') {
      return NextResponse.json(
        { error: `Provider ${modelConfig.provider} not yet implemented for assistant` },
        { status: 501 }
      );
    }

    const apiKey = process.env.ANTHROPIC_API_KEY;
    const client = new Anthropic({ apiKey });

    const anthropicMessages: Anthropic.MessageParam[] = compacted.map(m => ({
      role: m.role === 'assistant' ? 'assistant' : 'user',
      content: m.content,
    }));

    // Use the full agentic loop with all 8 tools (same as /api/chat)
    // This gives the assistant access to email, calendar, Salesforce, data queries, etc.
    const fullSystemPrompt = `${buildStaticSystemPrompt()}\n\n${assistantContext}`;

    const loopResult = await runAgenticLoop({
      client,
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens,
      systemPrompt: fullSystemPrompt,
      messages: anthropicMessages,
      role,
      userEmail: session?.user?.email ?? undefined,
    });

    let content = validateResponse(loopResult.content);

    const inputTokens = loopResult.inputTokens;
    const outputTokens = loopResult.outputTokens;

    // Auto-process detected actions with real integrations
    const processedActions: AssistantAction[] = [];
    for (const action of detectedActions) {
      if (action.type === 'reminder') {
        const timeInfo = parseTime(userContent);
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + 1);
        dueDate.setHours(9, 0, 0, 0);
        const dueAt = timeInfo?.start ?? dueDate.toISOString();
        addReminder({ userEmail, role, message: userContent.slice(0, 200), dueAt });
        processedActions.push({ ...action, description: 'Reminder created' });
      } else if (action.type === 'calendar') {
        const timeInfo = parseTime(userContent);
        if (timeInfo) {
          const namePattern = /with\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/g;
          const names: string[] = [];
          let m;
          while ((m = namePattern.exec(userContent)) !== null) names.push(m[1]);
          const emails = [userEmail, ...names.map(n => resolveEmail(n))].filter(Boolean);
          const titleMatch = userContent.match(/(?:called|titled|about|for)\s+["']?([^"'\n,]+)/i);
          const title = titleMatch?.[1]?.trim() ?? 'Meeting';
          const isOnline = /teams|online|virtual|link/i.test(userContent);
          const calResult = await createCalendarEvent({ subject: title, start: timeInfo.start, end: timeInfo.end, attendees: emails, isOnlineMeeting: isOnline });
          processedActions.push({ ...action, description: calResult.success ? `Event created: ${title}${calResult.meetingLink ? ' | Teams: ' + calResult.meetingLink : ''}` : `Calendar failed: ${calResult.error}. Need Calendars.ReadWrite permission on Azure AD app.` });
        } else {
          processedActions.push({ ...action, description: 'Calendar detected but could not parse time' });
        }
      } else if (action.type === 'email_draft') {
        processedActions.push({ ...action, description: 'Email draft — configure Resend/Graph in Admin > Integrations' });
      } else if (action.type === 'note') {
        addLearning(role, userContent.slice(0, 500));
        processedActions.push({ ...action, description: 'Learning saved' });
      } else {
        processedActions.push(action);
      }
    }

    // Log usage
    try {
      appendUsage({
        timestamp: new Date().toISOString(),
        userEmail,
        model: modelConfig.model,
        inputTokens,
        outputTokens,
        estimatedCost: estimateCost(modelConfig.model, inputTokens, outputTokens),
      });
    } catch (logErr) {
      console.error('[assistant/route] Failed to log usage:', logErr);
    }

    const result: AssistantChatResponse = {
      content,
      model: modelConfig.model,
      tokensUsed: inputTokens + outputTokens,
      inputTokens,
      outputTokens,
      actions: processedActions,
      assistantName: assistant.name,
    };

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[assistant/route] Error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
