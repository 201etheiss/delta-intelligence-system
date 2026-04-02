import { NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { routeQueryDetailed, getModelConfig, type ModelId } from '@/lib/router';
import { ROLES, getUserRole, type UserRole, canUseTool, type ToolPermission } from '@/lib/config/roles';
import {
  buildStaticSystemPrompt,
  buildDynamicContext,
  compactConversation,
} from '@/lib/token-optimizer';
import { orchestrateQueryStreaming } from '@/lib/orchestrator-stream';
import { authOptions } from '@/lib/auth';
import { checkRateLimit, CHAT_LIMIT } from '@/lib/rate-limit';
import {
  queryGatewayTool,
  sfCreateTool,
  sfUpdateTool,
  calendarCreateTool,
  readEmailTool,
  sendEmailTool,
  manageEmailTool,
  checkAvailabilityTool,
  runAgenticLoop,
} from '@/lib/agentic-loop';
import { generateWorkbookTool as generateWorkbookToolDef } from '@/lib/workbook-generator';
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
  workspacePrompt?: string;
  preferredModel?: string;
  dataSources?: string[];
  documents?: Array<{ name: string; content: string }>;
  moduleContext?: string;
}

/** All available tools for the streaming endpoint */
const ALL_STREAM_TOOLS: Anthropic.Tool[] = [
  queryGatewayTool,
  generateWorkbookToolDef,
  sfCreateTool,
  sfUpdateTool,
  calendarCreateTool,
  checkAvailabilityTool,
  readEmailTool,
  sendEmailTool,
  manageEmailTool,
];

function sseEncode(event: string, data: unknown): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

async function streamAnthropicWithTools(
  modelConfig: ReturnType<typeof getModelConfig>,
  systemPrompt: string | Anthropic.TextBlockParam[],
  messages: ChatMessage[],
  role: UserRole,
  userEmail: string | undefined,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder
): Promise<void> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey });

  const anthropicMessages: Anthropic.MessageParam[] = messages.map(m => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  // Filter tools by role permissions
  const filteredTools = ALL_STREAM_TOOLS.filter(tool =>
    canUseTool(role, tool.name as ToolPermission)
  );

  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const currentMessages = [...anthropicMessages];
  const MAX_TOOL_ROUNDS = 8;
  let round = 0;

  while (round < MAX_TOOL_ROUNDS) {
    round++;

    const stream = client.messages.stream({
      model: modelConfig.model,
      max_tokens: modelConfig.maxTokens,
      system: systemPrompt,
      tools: filteredTools,
      messages: currentMessages,
    });

    let hasToolUse = false;

    for await (const event of stream) {
      if (event.type === 'content_block_start') {
        if (event.content_block.type === 'tool_use') {
          hasToolUse = true;
        }
      }
      if (event.type === 'content_block_delta') {
        if (event.delta.type === 'text_delta') {
          await writer.write(encoder.encode(sseEncode('delta', { text: event.delta.text })));
        }
      }
    }

    const finalMessage = await stream.finalMessage();
    totalInputTokens += finalMessage.usage.input_tokens;
    totalOutputTokens += finalMessage.usage.output_tokens;

    if (finalMessage.stop_reason === 'end_turn' || !hasToolUse) {
      await writer.write(encoder.encode(sseEncode('done', {
        model: modelConfig.model,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      })));
      return;
    }

    // Has tool use — delegate to runAgenticLoop for tool execution,
    // then stream the final synthesis.
    // We switch to non-streaming agentic loop to handle all 9 tools properly.
    const toolUseBlocks = finalMessage.content.filter(
      (block): block is Anthropic.ToolUseBlock => block.type === 'tool_use'
    );

    const toolNames = toolUseBlocks.map(t => t.name);
    await writer.write(encoder.encode(sseEncode('status', {
      text: `Processing ${toolNames.join(', ')}...`,
    })));

    // Use the full agentic loop for remaining rounds (handles all 9 tools)
    // Pass the current state so it continues from where streaming left off
    const loopMessages: Anthropic.MessageParam[] = [
      ...currentMessages,
      { role: 'assistant', content: finalMessage.content },
    ];

    const loopResult = await runAgenticLoop({
      client,
      model: modelConfig.model,
      maxTokens: modelConfig.maxTokens,
      systemPrompt,
      messages: loopMessages,
      tools: filteredTools,
      role,
      userEmail,
      maxRounds: MAX_TOOL_ROUNDS - round,
    });

    totalInputTokens += loopResult.inputTokens;
    totalOutputTokens += loopResult.outputTokens;

    // Stream the final synthesized content
    if (loopResult.content) {
      await writer.write(encoder.encode(sseEncode('delta', { text: loopResult.content })));
    }

    await writer.write(encoder.encode(sseEncode('done', {
      model: modelConfig.model,
      inputTokens: totalInputTokens,
      outputTokens: totalOutputTokens,
    })));
    return;
  }

  // Exhausted rounds
  await writer.write(encoder.encode(sseEncode('delta', {
    text: '\n\nI gathered data from multiple sources but ran out of processing rounds. Please ask a more specific follow-up.',
  })));
  await writer.write(encoder.encode(sseEncode('done', {
    model: modelConfig.model,
    inputTokens: totalInputTokens,
    outputTokens: totalOutputTokens,
  })));
}

export async function POST(request: NextRequest): Promise<Response> {
  try {
    const body = (await request.json()) as ChatRequest;

    if (!body.messages || !Array.isArray(body.messages) || body.messages.length === 0) {
      return new Response(JSON.stringify({ error: 'messages array is required and must be non-empty' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    for (const msg of body.messages) {
      if (typeof msg.role !== 'string' || typeof msg.content !== 'string') {
        return new Response(JSON.stringify({ error: 'Each message must have string role and content fields' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    }

    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      role = parseRole(request.headers.get('x-user-role') ?? 'admin');
    }

    // Rate limiting
    const userEmail = session?.user?.email ?? 'anonymous';
    const rl = checkRateLimit(`chat:${userEmail}`, CHAT_LIMIT);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: 'Rate limit exceeded. Try again in a moment.' }), {
        status: 429,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const totalChars = body.messages.reduce((sum, m) => sum + m.content.length, 0);
    const estimatedTokens = Math.ceil(totalChars / 4);

    let modelId: ModelId;
    const validModels: ModelId[] = ['haiku', 'sonnet', 'opus', 'gpt4o', 'gemini-flash'];
    if (body.model && validModels.includes(body.model as ModelId)) {
      modelId = body.model as ModelId;
    } else if (body.preferredModel && body.preferredModel !== 'auto' && validModels.includes(body.preferredModel as ModelId)) {
      modelId = body.preferredModel as ModelId;
    } else {
      const lastMsg = [...body.messages].reverse().find(m => m.role === 'user');
      const routing = routeQueryDetailed(lastMsg?.content ?? '', estimatedTokens);
      modelId = routing.modelId;
    }

    body.messages = compactConversation(body.messages);

    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();
    const encoder = new TextEncoder();

    // Run the streaming in background, return the readable stream immediately
    const streamPromise = (async () => {
      try {
        // Try orchestrated path for complex queries (auto-routing only)
        if (!body.model) {
          const lastUserMsg = [...body.messages].reverse().find(m => m.role === 'user');
          const orchestrated = await orchestrateQueryStreaming(
            lastUserMsg?.content ?? '',
            body.messages,
            role,
            writer,
            encoder,
            sseEncode
          );
          if (orchestrated) {
            await writer.close();
            return;
          }
        }

        // Single-model streaming path
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

        // Build document context block if documents are attached
        let documentContext = '';
        if (body.documents && body.documents.length > 0) {
          const docSections = body.documents.map((doc) => {
            const truncated = doc.content.length > 10000 ? doc.content.slice(0, 10000) + '\n[...truncated]' : doc.content;
            return `## ${doc.name}\n${truncated}`;
          }).join('\n\n');
          documentContext = `\n\n# Uploaded Documents\nThe user has attached these documents. Use them to answer questions.\n${docSections}`;
        }

        // Build Nova domain context section (module-specific or full cross-domain)
        const novaContextSection = buildNovaPromptSection(body.moduleContext);

        const systemPrompt: Anthropic.TextBlockParam[] = [
          {
            type: 'text' as const,
            text: body.workspacePrompt
              ? `${body.workspacePrompt}\n\n${staticPrompt}`
              : staticPrompt,
            cache_control: { type: 'ephemeral' as const },
          },
          {
            type: 'text' as const,
            text: dynamicPrompt + documentContext + novaContextSection,
          },
        ];

        const modelConfig = getModelConfig(modelId);

        if (modelConfig.provider !== 'anthropic') {
          await writer.write(encoder.encode(sseEncode('error', {
            message: `${modelConfig.provider} streaming not yet implemented`,
          })));
          await writer.close();
          return;
        }

        await streamAnthropicWithTools(modelConfig, systemPrompt, body.messages, role, session?.user?.email ?? undefined, writer, encoder);
        await writer.close();
      } catch (error) {
        const errMsg = error instanceof Error ? error.message : 'Internal server error';
        console.error('[chat/stream] Error:', errMsg);

        try {
          if (errMsg.includes('prompt is too long') || errMsg.includes('context length exceeded')) {
            await writer.write(encoder.encode(sseEncode('error', {
              message: 'Your conversation has grown too large. Please start a new chat to continue.',
            })));
          } else {
            await writer.write(encoder.encode(sseEncode('error', { message: errMsg })));
          }
          await writer.close();
        } catch {
          // Writer may already be closed
        }
      }
    })();

    // Don't await — let the stream flow
    void streamPromise;

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return new Response(JSON.stringify({ error: 'Invalid JSON in request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    return new Response(JSON.stringify({ error: errMsg }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
