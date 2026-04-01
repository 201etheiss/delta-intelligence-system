/**
 * Multi-Model Orchestrator
 *
 * Architecture:
 *   1. PLANNER (Haiku) — Analyzes the query, identifies which data sources to call,
 *      creates an execution plan with specific endpoints + SQL queries
 *   2. WORKERS (parallel) — Execute each data pull (gateway calls, no LLM needed)
 *   3. SYNTHESIZER (Sonnet/Opus) — Takes the plan + gathered data, produces final answer
 *
 * This saves tokens by:
 *   - Using Haiku (~$0.80/M) for planning instead of Sonnet ($3/M) or Opus ($15/M)
 *   - Executing data pulls as direct HTTP calls (zero LLM tokens)
 *   - Only sending the synthesizer the compressed results (not raw gateway dumps)
 *
 * Cost comparison for a pricing query:
 *   Single-model (Sonnet): ~55K tokens × $3/M = $0.165
 *   Orchestrated: Plan (2K×$0.80/M) + Synth (8K×$3/M) = $0.026 — 84% savings
 */

import Anthropic from '@anthropic-ai/sdk';
import { gatewayFetch } from '@/lib/gateway';
import { type UserRole } from '@/lib/config/roles';
import { compressGatewayResult, buildOptimizedSystemPrompt } from '@/lib/token-optimizer';
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

interface OrchestratedResponse {
  content: string;
  model: string;
  tokensUsed: number;
  inputTokens: number;
  outputTokens: number;
  plannerTokens: number;
  synthesizerTokens: number;
  dataSteps: number;
  orchestrated: true;
}

const PLANNER_SYSTEM = `You are a query planner for Delta360's data gateway. Given a user question, output a JSON execution plan.

Endpoints: POST /ascend/query {"sql":"..."}, GET /ascend/ar/aging, /ascend/customers/top, /ascend/gl/balance-sheet, /ascend/gp/by-pc, /ascend/gl/journal-entries, /salesforce/opportunities, /salesforce/accounts, /samsara/vehicles, /samsara/locations, /samsara/drivers, /microsoft/search?q=, /vroozi/purchase-orders, /vroozi/suppliers

Verified SQL patterns:
- Billing+Pricing: SELECT b.CustomerName, b.ShipToDescr, b.InvoiceDt, i.UnitPrice, i.Qty, i.MasterProdID FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo = i.SysTrxNo WHERE ...
- GP by customer: SELECT b.CustomerName, SUM(i.Qty*i.UnitPrice) AS Revenue, SUM(i.Qty*ISNULL(i.Total_UnitCost,0)) AS COGS, SUM(i.Qty*i.UnitPrice)-SUM(i.Qty*ISNULL(i.Total_UnitCost,0)) AS GP FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo=i.SysTrxNo WHERE b.Year=2025 AND i.Total_UnitCost>0 GROUP BY b.CustomerName ORDER BY GP DESC
- Rack prices: SELECT Vendor_Name, SupplyPoint, ProductDescr, EffDtTm, RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel%' ORDER BY EffDtTm DESC
- Salesperson: SELECT b.Salesperson, SUM(i.Qty*i.UnitPrice) AS Revenue FROM DF_PBI_BillingChartQuery b JOIN ARInvoiceItem i ON b.SysTrxNo=i.SysTrxNo WHERE b.Year=2025 GROUP BY b.Salesperson ORDER BY Revenue DESC
- Journal entries: SELECT h.UserID, COUNT(DISTINCT h.JournalEntryID) AS JournalCount, SUM(l.AmountDebit) AS TotalDebits FROM JournalEntryHeader h JOIN JournalEntryLine l ON h.JournalEntryID=l.JournalEntryID WHERE h.PostYear=2026 GROUP BY h.UserID ORDER BY JournalCount DESC

Respond with ONLY valid JSON:
{"steps":[{"id":"step1","description":"...","endpoint":"/path","method":"GET|POST","body":{"sql":"..."}}],"synthesisModel":"haiku|sonnet|opus","synthesisPrompt":"..."}

Rules: Use "haiku" for simple summaries, "sonnet" for analysis, "opus" for strategic. Max 5 steps. Use exact SQL patterns above.`;

export async function orchestrateQuery(
  query: string,
  messages: Array<{ role: string; content: string }>,
  role: UserRole
): Promise<OrchestratedResponse | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const client = new Anthropic({ apiKey });
  const routing = routeQueryDetailed(query, 0);

  // Only orchestrate for complex+ queries (score >= 30)
  // Simple queries go straight through the single-model path
  if (routing.score < 30) return null;

  let plannerInputTokens = 0;
  let plannerOutputTokens = 0;
  let synthInputTokens = 0;
  let synthOutputTokens = 0;

  // ── Step 1: Plan (Haiku) ──────────────────────────────────────────
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

    // Extract JSON from the response (handle markdown code blocks)
    const jsonMatch = planText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    plan = JSON.parse(jsonMatch[0]) as ExecutionPlan;
    if (!plan.steps || plan.steps.length === 0) return null;
  } catch {
    return null; // Fall back to single-model
  }

  // ── Step 2: Execute data pulls (parallel, no LLM) ────────────────
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

  // ── Step 3: Synthesize (Sonnet/Opus) ──────────────────────────────
  // Override: upgrade to Opus for high-complexity queries (score 50+)
  // This gives strategic/cross-domain queries deeper reasoning
  let synthModel = plan.synthesisModel as ModelId;
  if (routing.score >= 50 && synthModel !== 'opus') {
    synthModel = 'opus';
  }
  const validSynthModels: Record<string, number> = { haiku: 1, sonnet: 1, opus: 1 };
  const synthConfig = getModelConfig(synthModel in validSynthModels ? synthModel : 'sonnet');

  // Build synthesis context with compressed data
  const dataContext = gathered.map(g =>
    `## ${g.description} (${g.success ? 'OK' : 'FAILED'})\n${g.result}`
  ).join('\n\n');

  const synthMessages: Anthropic.MessageParam[] = [
    {
      role: 'user',
      content: `User question: ${query}\n\n# Gathered Data\n${dataContext}\n\n# Instructions\n${plan.synthesisPrompt}\n\nRespond directly to the user's question using the data above. Format with markdown tables where appropriate. Be concise and factual.`,
    },
  ];

  // Include conversation context if there are prior messages
  if (messages.length > 1) {
    const priorContext = messages.slice(0, -1)
      .map(m => `${m.role}: ${m.content.substring(0, 200)}`)
      .join('\n');
    synthMessages[0] = {
      role: 'user',
      content: `[Prior conversation context]\n${priorContext}\n\n[Current question]\n${query}\n\n# Gathered Data\n${dataContext}\n\n# Instructions\n${plan.synthesisPrompt}\n\nRespond directly to the user's question using the data above.`,
    };
  }

  try {
    const synthResponse = await client.messages.create({
      model: synthConfig.model,
      max_tokens: synthConfig.maxTokens,
      system: `You are Delta Intelligence, an AI assistant for Delta360. You have been given pre-fetched data to answer the user's question. Use ONLY the provided data — do not fabricate numbers. NEVER use emojis or decorative unicode symbols. Keep responses direct, structured, and professional. Use markdown tables for data. End with exactly 3 numbered follow-up questions after a --- separator.`,
      messages: synthMessages,
    });

    synthInputTokens = synthResponse.usage.input_tokens;
    synthOutputTokens = synthResponse.usage.output_tokens;

    const content = synthResponse.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map(b => b.text)
      .join('\n');

    return {
      content,
      model: synthConfig.model,
      tokensUsed: plannerInputTokens + plannerOutputTokens + synthInputTokens + synthOutputTokens,
      inputTokens: plannerInputTokens + synthInputTokens,
      outputTokens: plannerOutputTokens + synthOutputTokens,
      plannerTokens: plannerInputTokens + plannerOutputTokens,
      synthesizerTokens: synthInputTokens + synthOutputTokens,
      dataSteps: gathered.length,
      orchestrated: true,
    };
  } catch {
    return null; // Fall back to single-model
  }
}
