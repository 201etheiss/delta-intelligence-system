/**
 * Streaming wrapper for the multi-model orchestrator.
 *
 * Reuses the same planner/worker/synthesizer architecture as orchestrator.ts,
 * but streams the synthesizer output via SSE instead of waiting for completion.
 */

import Anthropic from '@anthropic-ai/sdk';
import { gatewayFetch } from '@/lib/gateway';
import { type UserRole } from '@/lib/config/roles';
import { compressGatewayResult } from '@/lib/token-optimizer';
import { getModelConfig, type ModelId, routeQueryDetailed } from '@/lib/router';

interface DataStep {
  id: string;
  description: string;
  endpoint: string;
  method: 'GET' | 'POST';
  body?: Record<string, unknown>;
}

interface ExecutionPlan {
  steps: DataStep[];
  synthesisModel: ModelId;
  synthesisPrompt: string;
}

interface GatheredData {
  stepId: string;
  description: string;
  result: string;
  success: boolean;
}

const PLANNER_SYSTEM = `You are a query planner for Delta360's data gateway. Given a user question, output a JSON execution plan.

Available data sources:
- POST /ascend/query with {"sql":"SELECT ..."} — for any Ascend ERP data
- GET /ascend/ar/aging, /ascend/customers/top, /ascend/gl/balance-sheet, /ascend/gp/by-pc, /ascend/gl/journal-entries (pre-built endpoints with ?year=&period= params)
- GET /salesforce/opportunities, /salesforce/accounts, /salesforce/contacts
- GET /samsara/vehicles, /samsara/locations, /samsara/drivers
- GET /microsoft/search?q=keywords
- GET /vroozi/purchase-orders, /vroozi/suppliers

Key SQL patterns:
- Billing+Pricing: SELECT b.CustomerName, b.ShipToDescr, b.InvoiceDt, i.UnitPrice, i.Qty, i.MasterProdID FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE ...
- GP by customer: SELECT b.CustomerName, SUM(i.Qty*i.UnitPrice) AS Revenue, SUM(i.Qty*ISNULL(i.Total_UnitCost,0)) AS COGS, SUM(i.Qty*i.UnitPrice)-SUM(i.Qty*ISNULL(i.Total_UnitCost,0)) AS GP FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo=i.SysTrxNo WHERE b.Year=2025 AND i.Total_UnitCost>0 GROUP BY b.CustomerName ORDER BY GP DESC
- Rack prices: SELECT Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%' ORDER BY EffDtTm DESC

Respond with ONLY valid JSON:
{
  "steps": [
    {"id": "step1", "description": "what this fetches", "endpoint": "/path", "method": "GET|POST", "body": {"sql": "..."}}
  ],
  "synthesisModel": "haiku|sonnet|opus",
  "synthesisPrompt": "instructions for the synthesizer on how to combine the data"
}

Rules:
- Use "haiku" for simple summaries, "sonnet" for analysis, "opus" for strategic recommendations
- Keep steps to 2-5 max
- The synthesizer will receive compressed results from each step`;

export async function orchestrateQueryStreaming(
  query: string,
  messages: Array<{ role: string; content: string }>,
  role: UserRole,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  encoder: TextEncoder,
  sseEncode: (event: string, data: unknown) => string
): Promise<boolean> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return false;

  const client = new Anthropic({ apiKey });
  const routing = routeQueryDetailed(query, 0);

  // Only orchestrate for complex+ queries
  if (routing.score < 30) return false;

  let plannerInputTokens = 0;
  let plannerOutputTokens = 0;

  // ── Step 1: Plan (Haiku) — send "thinking" status ──
  await writer.write(encoder.encode(sseEncode('status', { text: 'Planning query...' })));

  let plan: ExecutionPlan;
  try {
    const planResponse = await client.messages.create({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 2048,
      system: PLANNER_SYSTEM,
      messages: [{ role: 'user', content: query }],
    });

    plannerInputTokens = planResponse.usage.input_tokens;
    plannerOutputTokens = planResponse.usage.output_tokens;

    const planText = planResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('');

    const jsonMatch = planText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return false;

    plan = JSON.parse(jsonMatch[0]) as ExecutionPlan;
    if (!plan.steps || plan.steps.length === 0) return false;
  } catch {
    return false;
  }

  // ── Step 2: Execute data pulls ──
  await writer.write(encoder.encode(sseEncode('status', {
    text: `Fetching data (${plan.steps.length} source${plan.steps.length !== 1 ? 's' : ''})...`,
  })));

  const gathered: GatheredData[] = await Promise.all(
    plan.steps.slice(0, 5).map(async (step) => {
      try {
        const result = await gatewayFetch(step.endpoint, role, {
          method: step.method,
          body: step.body,
        });
        return {
          stepId: step.id,
          description: step.description,
          result: compressGatewayResult(result),
          success: true,
        };
      } catch (err) {
        return {
          stepId: step.id,
          description: step.description,
          result: JSON.stringify({ error: err instanceof Error ? err.message : 'Failed' }),
          success: false,
        };
      }
    })
  );

  // ── Step 3: Synthesize (stream) ──
  await writer.write(encoder.encode(sseEncode('status', { text: 'Analyzing results...' })));

  let synthModel = plan.synthesisModel as ModelId;
  if (routing.score >= 50 && synthModel !== 'opus') {
    synthModel = 'opus';
  }
  const validSynthModels: Record<string, number> = { haiku: 1, sonnet: 1, opus: 1 };
  const synthConfig = getModelConfig(synthModel in validSynthModels ? synthModel : 'sonnet');

  const dataContext = gathered.map(g =>
    `## ${g.description} (${g.success ? 'OK' : 'FAILED'})\n${g.result}`
  ).join('\n\n');

  let userContent = `User question: ${query}\n\n# Gathered Data\n${dataContext}\n\n# Instructions\n${plan.synthesisPrompt}\n\nRespond directly to the user's question using the data above. Format with markdown tables where appropriate. Be concise and factual.`;

  if (messages.length > 1) {
    const priorContext = messages.slice(0, -1)
      .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
      .join('\n');
    userContent = `[Prior conversation context]\n${priorContext}\n\n[Current question]\n${query}\n\n# Gathered Data\n${dataContext}\n\n# Instructions\n${plan.synthesisPrompt}\n\nRespond directly to the user's question using the data above.`;
  }

  try {
    const stream = client.messages.stream({
      model: synthConfig.model,
      max_tokens: synthConfig.maxTokens,
      system: 'You are Delta Intelligence, an AI assistant for Delta360. You have been given pre-fetched data to answer the user\'s question. Use ONLY the provided data \u2014 do not fabricate numbers. NEVER use emojis or decorative unicode symbols. Keep responses direct, structured, and professional. Use markdown tables for data. End with exactly 3 numbered follow-up questions after a --- separator.',
      messages: [{ role: 'user', content: userContent }],
    });

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        await writer.write(encoder.encode(sseEncode('delta', { text: event.delta.text })));
      }
    }

    const final = await stream.finalMessage();
    const synthInputTokens = final.usage.input_tokens;
    const synthOutputTokens = final.usage.output_tokens;

    await writer.write(encoder.encode(sseEncode('done', {
      model: synthConfig.model,
      inputTokens: plannerInputTokens + synthInputTokens,
      outputTokens: plannerOutputTokens + synthOutputTokens,
      orchestrated: true,
      dataSteps: gathered.length,
    })));

    return true;
  } catch {
    return false;
  }
}
