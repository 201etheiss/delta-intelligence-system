import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import Anthropic from '@anthropic-ai/sdk';
import { getModelConfig, type ModelId } from '@/lib/router';
import { validateResponse } from '@/lib/response-validator';
import { getUserRole, type UserRole } from '@/lib/config/roles';
import { authOptions } from '@/lib/auth';
import { appendUsage, estimateCost } from '@/lib/usage-logger';
import { runAgenticLoop, queryGatewayTool } from '@/lib/agentic-loop';
import { checkRateLimit, REPORT_LIMIT } from '@/lib/rate-limit';
import { ReportGenerateSchema, validateRequest } from '@/lib/validation';

const VALID_ROLES: UserRole[] = ['admin', 'accounting', 'sales', 'operations', 'hr', 'readonly'];

function parseRole(raw: string | null): UserRole {
  if (raw && VALID_ROLES.includes(raw as UserRole)) {
    return raw as UserRole;
  }
  return 'readonly';
}

type ReportType = 'analysis' | 'operator_brief' | 'decision_memo' | 'status_report' | 'diagnostic' | 'sop' | 'metric_spec' | 'comparison' | 'auto';

interface ReportRequest {
  prompt: string;
  previousReport?: string;
  refinement?: string;
  reportType?: ReportType;
  documents?: Array<{ name: string; content: string }>; // ingested document context
}

const REPORT_TYPE_TEMPLATES: Record<ReportType, string> = {
  auto: 'Choose the most appropriate report format based on the request.',
  analysis: `ANALYSIS report format:
## Header: ANALYSIS tag, declarative title, scope/date context line
## Answer Block: Lead with the conclusion in 1-3 sentences
## Body: Data tables, metrics, evidence
## Actions: Numbered next steps with owner format
## Risks: Risk factors with severity tags (LOW/MEDIUM/HIGH)`,

  operator_brief: `OPERATOR BRIEF format (short, 3-8 lines):
Answer first, then minimum executable steps.
Format: 1. [Action] — [Owner] — [Deadline]
Include assumptions with confidence labels.`,

  decision_memo: `DECISION MEMO format:
## Executive Summary (recommendation upfront)
## Objective, Current State
## Options with advantages/disadvantages/cost/risk
## Comparative Matrix table with weighted criteria
## Recommendation with cause → action → outcome
## Execution Plan, Risks, Assumptions`,

  status_report: `STATUS REPORT format:
## Summary (2-3 sentences, trajectory: on track/at risk/off track)
## Key Metrics table (Actual | Target | vs. Target | Trend)
## Highlights (quantified wins)
## Issues & Blockers (severity, owner, ETA)
## Next Period Actions`,

  diagnostic: `DIAGNOSTIC format:
## Finding (core diagnosis upfront, 1-3 sentences)
## Evidence table (Signal | Observation | Implication)
## Root Cause Chain: Symptom ← Proximate ← Structural ← Root
## Intervention Options table (Addresses | Effort | Impact | Risk)
## Recommendation with traceability`,

  sop: `SOP format:
## Purpose, Scope, Inputs
## Procedure steps with Action/Tool/Acceptance Criteria per step
## Quality Controls checklist
## Metrics table (Formula | Target | Cadence | Owner)
## Failure Modes table (Detection | Response)`,

  metric_spec: `METRIC SPEC format:
Table with: Definition, Formula, Unit, Target, Red Threshold, Cadence, Owner, Data Source, Failure Modes`,

  comparison: `COMPARISON format:
Always use a comparison matrix table.
Every criterion must have a weight or stated priority.
Include both absolute and relative changes.
Recommendation must reference the matrix.`,
};

const REPORT_SYSTEM_PROMPT = `You are an enterprise report generator for Delta360.
Generate structured reports in markdown following these rules:

1. NEVER use emojis or decorative unicode symbols
2. Lead with the answer — headline number or key finding first
3. Use markdown tables with proper alignment for all data
4. Right-align numeric columns, left-align text columns
5. Format currency as $X,XXX or $X.XM, percentages as X.X%
6. Quantify everything — no "significant" or "various"
7. Headings are noun phrases, never questions
8. If data is unavailable, note it clearly — never fabricate numbers
9. Include confidence labels: [Explicit] [Inferred] [Unspecified]
10. Action items: [Number]. [Verb-led action] — [Owner] — [Deadline]

You have access to the Delta360 unified data gateway via the query_gateway tool.
Use it to fetch real data from ERP (Ascend), CRM (Salesforce), fleet, DTN rack pricing, and financial systems.

When refining a report, preserve the overall structure and only modify what the user asked to change.`;

async function generateReport(
  prompt: string,
  previousReport: string | undefined,
  refinement: string | undefined,
  role: UserRole,
  reportType: ReportType = 'auto',
  documents?: Array<{ name: string; content: string }>
): Promise<{ report: string; title: string; model: string; tokensUsed: number }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const client = new Anthropic({ apiKey });

  // Choose model: Sonnet for analysis/complex, Haiku for simple lists
  const isComplex = prompt.length > 100 || /analys|compar|trend|forecast|review|decision|diagnostic|strateg/i.test(prompt);
  const modelId: ModelId = isComplex ? 'sonnet' : 'haiku';
  const modelConfig = getModelConfig(modelId);

  // Build report type instructions
  const typeTemplate = REPORT_TYPE_TEMPLATES[reportType] ?? REPORT_TYPE_TEMPLATES.auto;

  // Build document context if provided
  const docContext = documents && documents.length > 0
    ? '\n\n# Ingested Documents\nThe user has uploaded these documents for context:\n' +
      documents.map(d => `## ${d.name}\n${d.content.substring(0, 5000)}`).join('\n\n')
    : '';

  const systemPrompt = REPORT_SYSTEM_PROMPT + '\n\n# Report Format\n' + typeTemplate + docContext;

  const messages: Anthropic.MessageParam[] = [];

  if (previousReport && refinement) {
    messages.push({
      role: 'user',
      content: `Here is the current report:\n\n${previousReport}\n\nPlease refine it with this instruction: ${refinement}`,
    });
  } else {
    messages.push({
      role: 'user',
      content: `Generate a report: ${prompt}`,
    });
  }

  const loopResult = await runAgenticLoop({
    client,
    model: modelConfig.model,
    maxTokens: modelConfig.maxTokens,
    systemPrompt,
    messages,
    tools: [queryGatewayTool],
    role,
  });

  let finalContent = loopResult.content;

  if (!finalContent) {
    finalContent = '# Report Generation Incomplete\n\nThe report could not be fully generated. Please try again with a more specific prompt.';
  }

  // Post-process: validate and clean the response
  finalContent = validateResponse(finalContent);

  // Extract title from the first H1
  const titleMatch = finalContent.match(/^#\s+(.+)$/m);
  const title = titleMatch ? titleMatch[1].trim() : 'Untitled Report';

  return {
    report: finalContent,
    title,
    model: modelConfig.model,
    tokensUsed: loopResult.inputTokens + loopResult.outputTokens,
  };
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const raw = await request.json();
    const validated = validateRequest(ReportGenerateSchema, raw);
    if (!validated.success) {
      return NextResponse.json({ error: validated.error }, { status: 400 });
    }
    const body = validated.data as ReportRequest;

    // Auth: session or dev fallback
    const session = await getServerSession(authOptions);
    let role: UserRole;
    if (session?.user?.email) {
      role = getUserRole(session.user.email);
    } else {
      role = parseRole(request.headers.get('x-user-role') ?? 'admin');
    }

    // Rate limiting
    const userEmail = session?.user?.email ?? 'anonymous';
    const rl = checkRateLimit(`report:${userEmail}`, REPORT_LIMIT);
    if (!rl.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again in a moment.' },
        { status: 429 }
      );
    }

    const result = await generateReport(
      body.prompt,
      body.previousReport,
      body.refinement,
      role,
      body.reportType ?? 'auto',
      body.documents
    );

    // Log usage
    try {
      appendUsage({
        timestamp: new Date().toISOString(),
        userEmail,
        model: result.model,
        inputTokens: Math.round(result.tokensUsed * 0.6),
        outputTokens: Math.round(result.tokensUsed * 0.4),
        estimatedCost: estimateCost(result.model, Math.round(result.tokensUsed * 0.6), Math.round(result.tokensUsed * 0.4)),
      });
    } catch (logErr) {
      console.error('[usage-logger] Failed to log report usage:', logErr);
    }

    return NextResponse.json(result);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : 'Internal server error';
    console.error('[reports/generate] Error:', errMsg);
    return NextResponse.json({ error: errMsg }, { status: 500 });
  }
}
