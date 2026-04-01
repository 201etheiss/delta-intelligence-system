import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { routeQueryDetailed, getModelConfig, type ModelId } from '@/lib/router';
import { ROLES, getUserRole, type UserRole } from '@/lib/config/roles';
import {
  buildStaticSystemPrompt,
  buildDynamicContext,
  compactConversation,
} from '@/lib/token-optimizer';
import { orchestrateQuery } from '@/lib/orchestrator';
import { authOptions } from '@/lib/auth';
import { appendUsage, estimateCost } from '@/lib/usage-logger';
import { validateResponse } from '@/lib/response-validator';
import { runAgenticLoop } from '@/lib/agentic-loop';
import { getPreferences } from '@/lib/user-preferences';
import { checkRateLimit, CHAT_LIMIT } from '@/lib/rate-limit';
import { ChatRequestSchema, validateRequest } from '@/lib/validation';
import { saveConversation, type ConversationMessage } from '@/lib/conversations';
import { buildNovaPromptSection } from '@/lib/nova-contexts';

const VALID_ROLES: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];

function parseRole(raw: string | null): UserRole {
  if (raw && VALID_ROLES.includes(raw as UserRole)) {
    return raw as UserRole;
  }
  return 'readonly';
}

interface ChatMessage {
  role: string;
  content: string;
}

interface ChatRequest {
  messages: ChatMessage[];
  model?: string;
  conversationId?: string;
  workspaceId?: string;
  workspacePrompt?: string;
  preferredModel?: string;
  dataSources?: string[];
  documents?: Array<{ name: string; content: string }>;
  moduleContext?: string;
}

interface ChatResponse {
  content: string;
  model: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.json();
    const validated = validateRequest(ChatRequestSchema, raw);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data as ChatRequest;

    // Determine role from SSO session, fall back to header, then default to admin for dev
    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      // Fallback: check header (dev mode) or default to admin
      role = parseRole(request.headers.get('x-user-role') ?? 'readonly');
    }

    // Determine user email and preferences
    const userEmail = session?.user?.email ?? 'anonymous';

    // Rate limiting
    const rl = checkRateLimit(`chat:${userEmail}`, CHAT_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a moment.' },
        { status: 429 }
      );
    }

    const userPrefs = getPreferences(userEmail);

    // Token estimation: ~4 chars per token
    const totalChars = body.messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    // Model routing — algorithmic selection based on complexity scoring
    let modelId: ModelId;
    const validModels: ModelId[] = ['haiku', 'sonnet', 'opus', 'gpt4o', 'gemini-flash'];
    if (body.model && validModels.includes(body.model as ModelId)) {
      modelId = body.model as ModelId;
    } else if (body.preferredModel && body.preferredModel !== 'auto' && validModels.includes(body.preferredModel as ModelId)) {
      // Workspace preferred model (used when user hasn't manually selected)
      modelId = body.preferredModel as ModelId;
      console.log(`[ROUTER] Using workspace preferred model: ${modelId}`);
    } else if (userPrefs.defaultModel !== 'auto' && validModels.includes(userPrefs.defaultModel as ModelId)) {
      // User preference model (when no explicit model or workspace override)
      modelId = userPrefs.defaultModel as ModelId;
      console.log(`[ROUTER] Using user preferred model: ${modelId}`);
    } else {
      const lastMsg = [...body.messages].reverse().find(m => m.role === 'user');
      const routing = routeQueryDetailed(lastMsg?.content ?? '', estimatedTokens);
      modelId = routing.modelId;
      console.log(`[ROUTER] Score: ${routing.score} | Complexity: ${routing.complexity} | Model: ${routing.modelId} | Reasons: ${routing.reasons.join(', ')}`);
    }

    // Layer 4: Compact conversation history
    body.messages = compactConversation(body.messages);

    // Try orchestrated multi-model path for complex queries (only on auto-routing)
    if (!body.model) {
      const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
      const orchestrated = await orchestrateQuery(lastUserMsg?.content ?? '', body.messages, role);
      if (orchestrated) {
        console.log(`[ORCHESTRATOR] Planner: ${orchestrated.plannerTokens} tokens | Data steps: ${orchestrated.dataSteps} | Synthesizer: ${orchestrated.synthesizerTokens} tokens | Total: ${orchestrated.tokensUsed}`);
        return NextResponse.json(orchestrated);
      }
    }

    // Fallback: single-model path
    const roleConfig = ROLES[role];
    const lastUserMessage = [...body.messages].reverse().find(m => m.role === 'user');
    // If workspace provides dataSources, scope the services list
    const services = (body.dataSources && body.dataSources.length > 0)
      ? roleConfig.services.filter((s: string) => body.dataSources!.includes(s))
      : roleConfig.services;

    // Build split system prompt for Anthropic prompt caching
    const staticPrompt = buildStaticSystemPrompt();
    const dynamicPrompt = buildDynamicContext(
      roleConfig.name,
      services.length > 0 ? services : roleConfig.services,
      lastUserMessage?.content,
      role
    );

    // Inject user date range preference into dynamic context
    const dateRangeLabels: Record<string, string> = {
      this_month: 'current month',
      this_quarter: 'current quarter',
      this_year: 'current year',
      last_30_days: 'last 30 days',
    };
    const dateRangeNote = userPrefs.defaultDateRange !== 'this_month'
      ? `\nUser default date range: ${dateRangeLabels[userPrefs.defaultDateRange] ?? userPrefs.defaultDateRange}. Use this when no explicit date range is specified.`
      : '';

    // Build document context block if documents are attached
    let documentContext = '';
    if (body.documents && body.documents.length > 0) {
      const docSections = body.documents.map((doc) => {
        const truncated = doc.content.length > 10000 ? doc.content.slice(0, 10000) + '\n[...truncated]' : doc.content;
        return `## ${doc.name}\n${truncated}`;
      }).join('\n\n');
      documentContext = `\n\n# Uploaded Documents\nThe user has attached these documents. Use them to answer questions.\n${docSections}`;
      console.log(`[CHAT] ${body.documents.length} document(s) attached: ${body.documents.map((d) => d.name).join(', ')}`);
    }

    // Build Nova domain context section (module-specific or full cross-domain)
    const novaContextSection = buildNovaPromptSection(body.moduleContext);

    // Use array format with cache_control for Anthropic prompt caching
    const systemPromptBlocks: Anthropic.TextBlockParam[] = [
      {
        type: 'text' as const,
        text: body.workspacePrompt
          ? `${body.workspacePrompt}\n\n${staticPrompt}`
          : staticPrompt,
        cache_control: { type: 'ephemeral' as const },
      },
      {
        type: 'text' as const,
        text: dynamicPrompt + dateRangeNote + documentContext + novaContextSection,
      },
    ];

    const modelConfig = getModelConfig(modelId);
    let result: ChatResponse;

    switch (modelConfig.provider) {
      case 'anthropic': {
        const apiKey = process.env.ANTHROPIC_API_KEY;
        const client = new Anthropic({ apiKey });
        const anthropicMessages: Anthropic.MessageParam[] = body.messages.map(m => ({
          role: m.role === 'assistant' ? 'assistant' : 'user',
          content: m.content,
        }));
        const loopResult = await runAgenticLoop({
          client,
          model: modelConfig.model,
          maxTokens: modelConfig.maxTokens,
          systemPrompt: systemPromptBlocks,
          messages: anthropicMessages,
          role,
          userEmail: session?.user?.email ?? undefined,
        });
        result = {
          content: loopResult.content,
          model: modelConfig.model,
          tokensUsed: loopResult.inputTokens + loopResult.outputTokens,
          inputTokens: loopResult.inputTokens,
          outputTokens: loopResult.outputTokens,
        };
        break;
      }

      case 'openai':
        return NextResponse.json({ error: 'OpenAI provider not yet implemented' }, { status: 501 });

      case 'google':
        return NextResponse.json({ error: 'Google provider not yet implemented' }, { status: 501 });

      default:
        return NextResponse.json({ error: `Unknown provider: ${modelConfig.provider}` }, { status: 500 });
    }

    // Post-process: validate and clean the response
    result.content = validateResponse(result.content);

    // Log usage
    try {
      appendUsage({
        timestamp: new Date().toISOString(),
        userEmail,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        estimatedCost: estimateCost(result.model, result.inputTokens, result.outputTokens),
      });
    } catch (logErr) {
      console.error('[usage-logger] Failed to log usage:', logErr);
    }

    // Auto-save conversation server-side
    try {
      const convId = body.conversationId ?? crypto.randomUUID();
      const now = new Date().toISOString();

      // Build message list from request + new assistant response
      const convMessages: ConversationMessage[] = body.messages.map((m, i) => ({
        id: `${convId}-${i}`,
        role: m.role === 'assistant' ? 'assistant' as const : 'user' as const,
        content: m.content,
        timestamp: now,
      }));

      // Append the new assistant response
      convMessages.push({
        id: `${convId}-${convMessages.length}`,
        role: 'assistant',
        content: result.content,
        timestamp: now,
        model: result.model,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
      });

      saveConversation({
        id: convId,
        userEmail,
        title: 'New Conversation',
        messages: convMessages,
        createdAt: now,
        updatedAt: now,
        workspaceId: body.workspaceId,
      });
    } catch (saveErr) {
      console.error('[conversation-save] Failed to persist conversation:', saveErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[chat/route] Error:', errMsg);

    if (errMsg.includes('prompt is too long') || errMsg.includes('context length exceeded')) {
      return NextResponse.json(
        { error: 'Your conversation has grown too large. Please start a new chat to continue.' },
        { status: 413 }
      );
    }

    // Handle Anthropic API auth errors cleanly
    if (errMsg.includes('authentication_error') || errMsg.includes('invalid x-api-key') || errMsg.includes('401')) {
      return NextResponse.json(
        { error: 'AI service authentication failed. Please check the API key configuration.' },
        { status: 503 }
      );
    }

    // Handle rate limiting from Anthropic
    if (errMsg.includes('rate_limit') || errMsg.includes('429')) {
      return NextResponse.json(
        { error: 'AI service is temporarily busy. Please try again in a moment.' },
        { status: 429 }
      );
    }

    // Handle connection/timeout errors
    if (errMsg.includes('timeout') || errMsg.includes('ECONNREFUSED') || errMsg.includes('fetch failed')) {
      return NextResponse.json(
        { error: 'Unable to reach the AI service. Please try again.' },
        { status: 503 }
      );
    }

    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
