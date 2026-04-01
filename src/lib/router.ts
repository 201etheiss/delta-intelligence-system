/**
 * Multi-Model Routing Algorithm
 *
 * Routes queries to the optimal model based on:
 * 1. Query complexity (simple → expert-level)
 * 2. Estimated input size (token count)
 * 3. Required capabilities (tool use, long context, deep reasoning)
 * 4. Cost optimization (cheapest model that meets the requirement)
 *
 * Model Tiers:
 *   Tier 1 (Haiku)    — fast lookups, formatting, simple Q&A         ($0.80/M in)
 *   Tier 2 (Sonnet)   — analysis, multi-step reasoning, tool chains   ($3/M in)
 *   Tier 3 (Opus)     — deep strategy, cross-domain synthesis, expert  ($15/M in)
 *   Alt-1  (GPT-4o)   — alternative reasoning, second opinion          ($2.50/M in)
 *   Alt-2  (Gemini)   — bulk processing, 1M context window             ($0.075/M in)
 */

export type ModelId = 'haiku' | 'sonnet' | 'opus' | 'gpt4o' | 'gemini-flash';

export interface ModelConfig {
  id: ModelId;
  name: string;
  provider: 'anthropic' | 'openai' | 'google';
  model: string;
  costPer1kInput: number;
  costPer1kOutput: number;
  maxTokens: number;
  contextWindow: number;
  tier: number;
  capabilities: string[];
  description: string;
}

export const MODELS: Record<ModelId, ModelConfig> = {
  haiku: {
    id: 'haiku',
    name: 'Haiku',
    provider: 'anthropic',
    model: 'claude-haiku-4-5-20251001',
    costPer1kInput: 0.0008,
    costPer1kOutput: 0.004,
    maxTokens: 8192,
    contextWindow: 200000,
    tier: 1,
    capabilities: ['tool_use', 'fast'],
    description: 'Fast, cheap — simple lookups and formatting',
  },
  sonnet: {
    id: 'sonnet',
    name: 'Sonnet',
    provider: 'anthropic',
    model: 'claude-sonnet-4-6',
    costPer1kInput: 0.003,
    costPer1kOutput: 0.015,
    maxTokens: 16384,
    contextWindow: 200000,
    tier: 2,
    capabilities: ['tool_use', 'analysis', 'multi_step', 'code'],
    description: 'Best coding model — analysis and multi-step reasoning',
  },
  opus: {
    id: 'opus',
    name: 'Opus',
    provider: 'anthropic',
    model: 'claude-opus-4-6',
    costPer1kInput: 0.015,
    costPer1kOutput: 0.075,
    maxTokens: 32768,
    contextWindow: 200000,
    tier: 3,
    capabilities: ['tool_use', 'deep_reasoning', 'strategy', 'synthesis', 'expert'],
    description: 'Deepest reasoning — strategy, cross-domain synthesis, expert analysis',
  },
  gpt4o: {
    id: 'gpt4o',
    name: 'GPT-4o',
    provider: 'openai',
    model: 'gpt-4o',
    costPer1kInput: 0.0025,
    costPer1kOutput: 0.01,
    maxTokens: 16384,
    contextWindow: 128000,
    tier: 2,
    capabilities: ['tool_use', 'analysis', 'alternative_perspective'],
    description: 'OpenAI — alternative reasoning and formatting',
  },
  'gemini-flash': {
    id: 'gemini-flash',
    name: 'Gemini Flash',
    provider: 'google',
    model: 'gemini-2.0-flash',
    costPer1kInput: 0.000075,
    costPer1kOutput: 0.0003,
    maxTokens: 8192,
    contextWindow: 1000000,
    tier: 1,
    capabilities: ['long_context', 'bulk', 'fast'],
    description: 'Ultra-cheap, 1M context — bulk data processing',
  },
};

// ─── Complexity Classification ─────────────────────────────────────────

type QueryComplexity = 'simple' | 'moderate' | 'complex' | 'expert' | 'bulk';

interface ComplexitySignals {
  complexity: QueryComplexity;
  score: number;         // 0-100
  reasons: string[];
  requiredCapabilities: string[];
}

function classifyQuery(query: string, contextTokens: number): ComplexitySignals {
  const lower = query.toLowerCase();
  let score = 0;
  const reasons: string[] = [];
  const capabilities: string[] = ['tool_use'];

  // ── Context size scoring ──────────────────────────────────────────
  if (contextTokens > 100000) {
    score += 30;
    reasons.push('very large context');
    capabilities.push('long_context');
  } else if (contextTokens > 50000) {
    score += 20;
    reasons.push('large context');
    capabilities.push('long_context');
  } else if (contextTokens > 10000) {
    score += 10;
    reasons.push('moderate context');
  }

  // ── Expert-level patterns (Opus territory) ────────────────────────
  const expertPatterns = /\b(strateg|recommend.*(approach|plan|framework)|what\s*should\s*(we|i)\s*(do|prioritize|focus)|action\s*plan|roadmap|risk\s*assess|due\s*diligence|evaluate\s*option|trade.?off|scenario\s*analy|competitive\s*position|market\s*entry|portfolio\s*optim|capital\s*allocat|restructur|merger|acquisition|investment\s*thesis)\b/i;
  if (expertPatterns.test(lower)) {
    score += 40;
    reasons.push('strategic/expert reasoning');
    capabilities.push('deep_reasoning', 'strategy');
  }

  // ── Cross-domain synthesis (Opus territory) ───────────────────────
  const crossDomainPatterns = /\b(across\s*all|combine.*(data|source|system)|cross.?referenc|correlat.*(between|across)|holistic|comprehensive\s*view|big\s*picture|connect.*(dot|data)|synthesiz|integrat.*(all|multiple)|full\s*picture)\b/i;
  if (crossDomainPatterns.test(lower)) {
    score += 30;
    reasons.push('cross-domain synthesis');
    capabilities.push('synthesis');
  }

  // ── Multi-step analysis (Sonnet territory) ────────────────────────
  const complexPatterns = /\b(why|explain|analyze|compare|trend|forecast|predict|correlat|suggest|optimize|what.*(would|could)|how.*(impact|affect|change)|break\s*down|deep\s*dive|root\s*cause)\b/i;
  if (complexPatterns.test(lower)) {
    score += 20;
    reasons.push('analytical reasoning');
    capabilities.push('analysis');
  }

  // ── Multi-step / chained queries ──────────────────────────────────
  const multiStepPatterns = /\b(then|also|and\s*also|additionally|plus|as\s*well\s*as|along\s*with|including|both.*(and)|not\s*only.*(but)|first.*(then)|after\s*that)\b/i;
  const conjunctionCount = (lower.match(/\b(and|then|also|plus)\b/g) ?? []).length;
  if (conjunctionCount >= 3 || multiStepPatterns.test(lower)) {
    score += 15;
    reasons.push('multi-step query');
    capabilities.push('multi_step');
  }

  // ── Pricing / quoting (needs multi-source) ────────────────────────
  const pricingPatterns = /\b(price|pricing|quote|bid|rate\s*card|cost\s*to\s*deliver)\b/i;
  if (pricingPatterns.test(lower)) {
    score += 15;
    reasons.push('pricing query');
    capabilities.push('multi_step');
  }

  // ── Simple lookups ────────────────────────────────────────────────
  const simplePatterns = /\b(list|show|get|what\s*is|how\s*many|count|who\s*is|where\s*is)\b/i;
  if (simplePatterns.test(lower) && score < 15) {
    reasons.push('simple lookup');
  }

  // ── Moderate patterns ─────────────────────────────────────────────
  const moderatePatterns = /\b(summarize|breakdown|calculate|total|average|group\s*by|top\s*\d+|rank|sort|filter|between|during)\b/i;
  if (moderatePatterns.test(lower)) {
    score += 10;
    reasons.push('aggregation/filtering');
  }

  // ── Query length as signal ────────────────────────────────────────
  const wordCount = lower.split(/\s+/).length;
  if (wordCount > 50) {
    score += 10;
    reasons.push('long query');
  } else if (wordCount > 25) {
    score += 5;
  }

  // ── Map score to complexity ───────────────────────────────────────
  let complexity: QueryComplexity;
  if (capabilities.includes('long_context') && contextTokens > 100000) {
    complexity = 'bulk';
  } else if (score >= 60) {
    complexity = 'expert';
  } else if (score >= 30) {
    complexity = 'complex';
  } else if (score >= 15) {
    complexity = 'moderate';
  } else {
    complexity = 'simple';
  }

  return { complexity, score, reasons, requiredCapabilities: capabilities };
}

// ─── Model Selection ───────────────────────────────────────────────────

export interface RoutingDecision {
  modelId: ModelId;
  complexity: QueryComplexity;
  score: number;
  reasons: string[];
  estimatedCost: { input: number; output: number };
}

export function routeQuery(query: string, contextTokens: number = 0): ModelId {
  return routeQueryDetailed(query, contextTokens).modelId;
}

export function routeQueryDetailed(query: string, contextTokens: number = 0): RoutingDecision {
  const signals = classifyQuery(query, contextTokens);

  let modelId: ModelId;
  switch (signals.complexity) {
    case 'simple':
      modelId = 'haiku';
      break;
    case 'moderate':
      modelId = 'haiku';
      break;
    case 'complex':
      modelId = 'sonnet';
      break;
    case 'expert':
      modelId = 'opus';
      break;
    case 'bulk':
      modelId = 'gemini-flash';
      break;
  }

  // Capability check: if the selected model doesn't have a required capability, upgrade
  const config = MODELS[modelId];
  for (const cap of signals.requiredCapabilities) {
    if (!config.capabilities.includes(cap)) {
      // Find cheapest model with the capability
      const candidates = Object.values(MODELS)
        .filter(m => m.capabilities.includes(cap) && m.provider === 'anthropic')
        .sort((a, b) => a.costPer1kInput - b.costPer1kInput);
      if (candidates.length > 0 && candidates[0].tier > config.tier) {
        modelId = candidates[0].id;
      }
    }
  }

  const finalConfig = MODELS[modelId];
  const estInputTokens = contextTokens + (query.length / 4);
  const estOutputTokens = finalConfig.maxTokens * 0.3; // assume 30% of max used

  return {
    modelId,
    complexity: signals.complexity,
    score: signals.score,
    reasons: signals.reasons,
    estimatedCost: {
      input: (estInputTokens / 1000) * finalConfig.costPer1kInput,
      output: (estOutputTokens / 1000) * finalConfig.costPer1kOutput,
    },
  };
}

export function getModelConfig(id: ModelId): ModelConfig {
  return MODELS[id];
}

export function estimateCost(inputTokens: number, outputTokens: number, model: ModelId): number {
  const config = MODELS[model];
  return (inputTokens / 1000) * config.costPer1kInput + (outputTokens / 1000) * config.costPer1kOutput;
}

export function listModels(): ModelConfig[] {
  return Object.values(MODELS).sort((a, b) => a.tier - b.tier);
}
