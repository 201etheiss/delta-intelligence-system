/**
 * Nova Report Insights
 *
 * Generates institutional-quality narrative sections for DOCX reports.
 * Uses Claude claude-opus-4-5 for maximum analytical depth. Embedded as the
 * "Nova Analysis" section in comprehensive exports.
 *
 * Called only when depth === 'comprehensive' — deliberately high token load.
 */

import Anthropic from '@anthropic-ai/sdk';

export interface ReportInsightParams {
  template: string;
  dateRange: { from: string; to: string };
  data: Record<string, unknown>;
}

const TEMPLATE_SYSTEM_PROMPTS: Record<string, string> = {
  'executive-summary': `You are Nova, Delta360's enterprise AI analyst. Write a concise executive summary analysis in professional business prose. Structure your response as:

1. SITUATION OVERVIEW (2–3 sentences): Current state and context.
2. KEY FINDINGS (numbered list, 3–5 items): Most significant data points with specific numbers where available.
3. RECOMMENDATIONS (numbered list, 2–4 items): Clear, actionable next steps with owners and timelines where inferrable.
4. RISK FACTORS (bulleted list, 2–3 items): Top risks to monitor.

Write in third person. Use precise language. No filler. No hedging. Quantify every claim that has supporting data. Flag assumptions explicitly.`,

  'financial-analysis': `You are Nova, Delta360's enterprise AI analyst. Write a financial analysis narrative in professional accounting prose. Structure your response as:

1. PERIOD OVERVIEW (2–3 sentences): Period covered, key context, comparison basis.
2. PERFORMANCE SUMMARY (numbered list): Revenue, margin, cost drivers — with YoY or period comparisons where data supports.
3. VARIANCE ANALYSIS (narrative paragraph): Explain material variances. Separate volume vs. rate effects where inferrable.
4. NOTES AND ASSUMPTIONS (bulleted list): Data limitations, accounting treatment flags, assumptions made.

Use financial terminology correctly. Round numbers to 2 decimal places. Cite the data source when referencing figures. Flag missing data explicitly rather than omitting.`,

  'operations': `You are Nova, Delta360's enterprise AI analyst. Write an operations report narrative in precise operational prose. Structure your response as:

1. OPERATIONAL STATUS (2–3 sentences): Fleet, delivery, and utilization state summary.
2. PERFORMANCE METRICS (numbered list): Key throughput and efficiency metrics with targets vs. actuals.
3. ALERT SUMMARY (bulleted list): Outstanding issues by severity — critical first.
4. OUTLOOK (1–2 sentences): Near-term trajectory and recommended monitoring focus.

Be specific. Use operational vocabulary. If a metric lacks a benchmark, note it. Do not fabricate benchmarks.`,

  'intelligence-briefing': `You are Nova, Delta360's enterprise AI analyst. Write an intelligence briefing in structured analytical prose. Structure your response as:

1. CLASSIFICATION: [INTERNAL — DELTA360 CONFIDENTIAL]
2. SITUATION OVERVIEW (2–3 sentences): What changed, what is the significance.
3. KEY CHANGES SINCE LAST BRIEFING (numbered list): Specific delta items only — not static background.
4. ACTION ITEMS (numbered list with owner field): Format as "ACTION: [description] | OWNER: [role] | BY: [date or 'ASAP']".
5. RISK FACTORS (bulleted list): Threats with probability and impact labels (H/M/L).
6. OUTLOOK (1–2 sentences): 30-day forward view.

Be direct. Separate confirmed facts from inferences. Label inferences with "(inferred)".`,
};

const DEFAULT_SYSTEM_PROMPT = `You are Nova, Delta360's enterprise AI analyst. Analyze the provided report data and write a concise, institutional-quality executive summary. Include: situation overview, key findings, and actionable recommendations. Use professional business prose. Quantify claims. Flag assumptions.`;

/**
 * Generate Nova-authored narrative insights for a report.
 *
 * Returns formatted markdown that gets embedded in the DOCX Nova Analysis section.
 * Returns empty string on failure — caller handles gracefully.
 */
export async function generateReportInsights(params: ReportInsightParams): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return '';

  const systemPrompt = TEMPLATE_SYSTEM_PROMPTS[params.template] ?? DEFAULT_SYSTEM_PROMPT;

  const dateContext = params.dateRange.from
    ? `Reporting period: ${params.dateRange.from} to ${params.dateRange.to}.`
    : `Report date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}.`;

  const userMessage = `${dateContext}

Report template: ${params.template}
Report title: ${String(params.data.title ?? 'Untitled')}

Report data and content:
${String(params.data.content ?? '')}

Write the analysis now. Return only the analysis text — no preamble, no "here is the analysis" wrapper. Begin directly with the first section heading.`;

  try {
    const client = new Anthropic({ apiKey });

    const response = await client.messages.create({
      model: 'claude-opus-4-5',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    const textBlock = response.content.find(b => b.type === 'text');
    return textBlock?.type === 'text' ? textBlock.text.trim() : '';
  } catch {
    return '';
  }
}
