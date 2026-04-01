/**
 * Commentary Manager Engine
 * AI-assisted variance commentary generation for close packages.
 * File persistence to data/commentary.json.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VarianceType = 'favorable' | 'unfavorable' | 'neutral';
export type CommentaryStatus = 'draft' | 'review' | 'approved';

export interface Commentary {
  readonly id: string;
  readonly packageId: string | null;
  readonly period: string; // YYYY-MM
  readonly accountNumber: string;
  readonly accountName: string;
  readonly varianceType: VarianceType;
  readonly varianceAmount: number;
  readonly variancePct: number;
  readonly draftText: string;
  readonly finalText: string | null;
  readonly draftedBy: string;
  readonly reviewedBy: string | null;
  readonly approvedBy: string | null;
  readonly status: CommentaryStatus;
  readonly aiGenerated: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

// ---------------------------------------------------------------------------
// File persistence
// ---------------------------------------------------------------------------

const DATA_DIR = join(process.cwd(), 'data');
const COMMENTARY_FILE = join(DATA_DIR, 'commentary.json');

function ensureDataDir(): void {
  if (!existsSync(DATA_DIR)) {
    mkdirSync(DATA_DIR, { recursive: true });
  }
}

function readCommentary(): readonly Commentary[] {
  ensureDataDir();
  if (!existsSync(COMMENTARY_FILE)) return [];
  try {
    const raw = readFileSync(COMMENTARY_FILE, 'utf-8');
    return JSON.parse(raw) as Commentary[];
  } catch {
    return [];
  }
}

function writeCommentary(items: readonly Commentary[]): void {
  ensureDataDir();
  writeFileSync(COMMENTARY_FILE, JSON.stringify(items, null, 2), 'utf-8');
}

// ---------------------------------------------------------------------------
// ID generation
// ---------------------------------------------------------------------------

function generateId(prefix: string): string {
  const ts = Date.now().toString(36);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}-${ts}-${rand}`;
}

// ---------------------------------------------------------------------------
// AI draft generation
// ---------------------------------------------------------------------------

const COMMENTARY_SYSTEM_PROMPT =
  'You are a corporate controller writing variance commentary for Delta360 Energy. ' +
  'Write factual, concise explanations in 2-3 sentences. ' +
  'Focus on what caused the variance and any action items.';

function buildCommentaryPrompt(accountName: string, varianceAmount: number, variancePct: number, varianceType: VarianceType): string {
  const direction = varianceType === 'favorable' ? 'favorable' : varianceType === 'unfavorable' ? 'unfavorable' : 'flat';
  return (
    `Account: ${accountName}\n` +
    `Variance: $${Math.abs(varianceAmount).toLocaleString()} (${variancePct >= 0 ? '+' : ''}${variancePct.toFixed(1)}%) — ${direction}\n` +
    `Explain the variance in 2-3 sentences, factual and concise.`
  );
}

/**
 * Generate AI draft commentary via the gateway (Claude API).
 * Falls back to a template if the API is unavailable.
 */
export async function generateDraftCommentary(
  period: string,
  accountNumber: string,
  accountName: string,
  varianceAmount: number,
  variancePct: number,
  draftedBy: string
): Promise<Commentary> {
  const varianceType: VarianceType =
    varianceAmount > 0 ? 'favorable' : varianceAmount < 0 ? 'unfavorable' : 'neutral';

  let draftText: string;
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY ?? process.env.GATEWAY_ADMIN_KEY;
    if (!apiKey) throw new Error('No API key available');

    const prompt = buildCommentaryPrompt(accountName, varianceAmount, variancePct, varianceType);

    // Try Claude API directly
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20250414',
        max_tokens: 300,
        system: COMMENTARY_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) throw new Error(`API returned ${res.status}`);
    const data = await res.json();
    const content = data?.content?.[0];
    draftText = content?.text ?? generateFallbackText(accountName, varianceAmount, variancePct, varianceType);
  } catch {
    draftText = generateFallbackText(accountName, varianceAmount, variancePct, varianceType);
  }

  const now = new Date().toISOString();
  const commentary: Commentary = {
    id: generateId('CMT'),
    packageId: null,
    period,
    accountNumber,
    accountName,
    varianceType,
    varianceAmount,
    variancePct,
    draftText,
    finalText: null,
    draftedBy,
    reviewedBy: null,
    approvedBy: null,
    status: 'draft',
    aiGenerated: true,
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readCommentary(), commentary];
  writeCommentary(all);
  return commentary;
}

function generateFallbackText(
  accountName: string,
  varianceAmount: number,
  variancePct: number,
  varianceType: VarianceType
): string {
  const direction = varianceType === 'favorable' ? 'favorable' : varianceType === 'unfavorable' ? 'unfavorable' : 'flat';
  const absAmt = Math.abs(varianceAmount).toLocaleString();
  return (
    `${accountName} shows a ${direction} variance of $${absAmt} (${Math.abs(variancePct).toFixed(1)}%) against budget. ` +
    `Further analysis is needed to determine root cause drivers. ` +
    `Management should review this account during the close meeting.`
  );
}

// ---------------------------------------------------------------------------
// Manual creation (non-AI)
// ---------------------------------------------------------------------------

export interface CreateCommentaryInput {
  readonly period: string;
  readonly accountNumber: string;
  readonly accountName: string;
  readonly varianceAmount: number;
  readonly variancePct: number;
  readonly draftText: string;
  readonly draftedBy: string;
  readonly packageId?: string | null;
}

export function createCommentary(input: CreateCommentaryInput): Commentary {
  const varianceType: VarianceType =
    input.varianceAmount > 0 ? 'favorable' : input.varianceAmount < 0 ? 'unfavorable' : 'neutral';

  const now = new Date().toISOString();
  const commentary: Commentary = {
    id: generateId('CMT'),
    packageId: input.packageId ?? null,
    period: input.period,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    varianceType,
    varianceAmount: input.varianceAmount,
    variancePct: input.variancePct,
    draftText: input.draftText,
    finalText: null,
    draftedBy: input.draftedBy,
    reviewedBy: null,
    approvedBy: null,
    status: 'draft',
    aiGenerated: false,
    createdAt: now,
    updatedAt: now,
  };

  const all = [...readCommentary(), commentary];
  writeCommentary(all);
  return commentary;
}

// ---------------------------------------------------------------------------
// Workflow transitions
// ---------------------------------------------------------------------------

export function updateCommentaryText(id: string, text: string, editedBy: string): Commentary {
  const all = [...readCommentary()];
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Commentary ${id} not found`);

  const existing = all[idx];
  const merged: Commentary = {
    ...existing,
    draftText: text,
    reviewedBy: editedBy,
    status: 'review',
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeCommentary(updated);
  return merged;
}

export function approveCommentary(id: string, approvedBy: string): Commentary {
  const all = [...readCommentary()];
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Commentary ${id} not found`);

  const existing = all[idx];
  const merged: Commentary = {
    ...existing,
    status: 'approved',
    finalText: existing.draftText,
    approvedBy,
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeCommentary(updated);
  return merged;
}

export function rejectCommentary(id: string): Commentary {
  const all = [...readCommentary()];
  const idx = all.findIndex((c) => c.id === id);
  if (idx === -1) throw new Error(`Commentary ${id} not found`);

  const existing = all[idx];
  const merged: Commentary = {
    ...existing,
    status: 'draft',
    updatedAt: new Date().toISOString(),
  };

  const updated = [...all.slice(0, idx), merged, ...all.slice(idx + 1)];
  writeCommentary(updated);
  return merged;
}

// ---------------------------------------------------------------------------
// Query helpers
// ---------------------------------------------------------------------------

export function getCommentaryByPeriod(period: string): readonly Commentary[] {
  return readCommentary().filter((c) => c.period === period);
}

export function getCommentaryByStatus(status: CommentaryStatus): readonly Commentary[] {
  return readCommentary().filter((c) => c.status === status);
}

export function getAllCommentary(filters?: {
  period?: string;
  status?: CommentaryStatus;
}): readonly Commentary[] {
  let results = [...readCommentary()];
  if (filters?.period) {
    results = results.filter((c) => c.period === filters.period);
  }
  if (filters?.status) {
    results = results.filter((c) => c.status === filters.status);
  }
  return results;
}

export function getCommentaryById(id: string): Commentary | undefined {
  return readCommentary().find((c) => c.id === id);
}

// ---------------------------------------------------------------------------
// Bulk generation
// ---------------------------------------------------------------------------

/** Mock account variance data — in production, this would pull from Ascend */
function getMockVarianceData(period: string): Array<{
  accountNumber: string;
  accountName: string;
  varianceAmount: number;
  variancePct: number;
}> {
  return [
    { accountNumber: '4000', accountName: 'Revenue - Fuel Sales', varianceAmount: 125000, variancePct: 8.2 },
    { accountNumber: '4100', accountName: 'Revenue - Delivery Fees', varianceAmount: -15000, variancePct: -4.1 },
    { accountNumber: '5000', accountName: 'COGS - Fuel Purchases', varianceAmount: -85000, variancePct: -6.3 },
    { accountNumber: '5100', accountName: 'COGS - Transportation', varianceAmount: 12000, variancePct: 3.5 },
    { accountNumber: '6000', accountName: 'SG&A - Payroll', varianceAmount: -22000, variancePct: -5.8 },
    { accountNumber: '6100', accountName: 'SG&A - Insurance', varianceAmount: -8500, variancePct: -12.1 },
    { accountNumber: '6200', accountName: 'SG&A - Travel & Entertainment', varianceAmount: 6200, variancePct: 15.3 },
    { accountNumber: '6300', accountName: 'SG&A - Utilities', varianceAmount: -3200, variancePct: -7.4 },
    { accountNumber: '7000', accountName: 'Depreciation', varianceAmount: 0, variancePct: 0.0 },
    { accountNumber: '8000', accountName: 'Interest Expense', varianceAmount: -5800, variancePct: -9.6 },
  ];
}

export async function bulkGenerateCommentary(
  period: string,
  draftedBy: string,
  varianceThreshold: number = 5000
): Promise<readonly Commentary[]> {
  const existing = getCommentaryByPeriod(period);
  const existingAccounts = new Set(existing.map((c) => c.accountNumber));

  const variances = getMockVarianceData(period).filter(
    (v) => Math.abs(v.varianceAmount) >= varianceThreshold && !existingAccounts.has(v.accountNumber)
  );

  const generated: Commentary[] = [];
  for (const v of variances) {
    const commentary = await generateDraftCommentary(
      period,
      v.accountNumber,
      v.accountName,
      v.varianceAmount,
      v.variancePct,
      draftedBy
    );
    generated.push(commentary);
  }

  return generated;
}

// ---------------------------------------------------------------------------
// Summary
// ---------------------------------------------------------------------------

export interface CommentarySummary {
  readonly totalAccounts: number;
  readonly drafted: number;
  readonly inReview: number;
  readonly approved: number;
  readonly remaining: number;
  readonly aiGenerated: number;
}

export function getCommentarySummary(period: string): CommentarySummary {
  const items = getCommentaryByPeriod(period);
  const drafted = items.filter((c) => c.status === 'draft').length;
  const inReview = items.filter((c) => c.status === 'review').length;
  const approved = items.filter((c) => c.status === 'approved').length;
  const aiGenerated = items.filter((c) => c.aiGenerated).length;

  return {
    totalAccounts: items.length,
    drafted,
    inReview,
    approved,
    remaining: drafted + inReview,
    aiGenerated,
  };
}
