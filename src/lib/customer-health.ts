/**
 * Customer Health Score Engine
 *
 * Computes a 0-100 health score per customer based on:
 * - Payment behavior (AR aging)
 * - Volume trend (growing vs declining)
 * - GP margin percentage
 * - Activity recency (last invoice date)
 *
 * Uses gateway data when available, falls back to mock scores.
 */

// ── Types ─────────────────────────────────────────────────────

export interface HealthFactor {
  name: string;
  score: number;  // 0-100
  weight: number; // 0-1
  detail: string;
}

export interface CustomerHealth {
  customer: string;
  customerId: string;
  score: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: {
    payment: HealthFactor;
    volume: HealthFactor;
    margin: HealthFactor;
    recency: HealthFactor;
  };
  trend: 'improving' | 'stable' | 'declining';
}

interface CustomerInput {
  name: string;
  id: string;
  arCurrent?: number;
  ar30?: number;
  ar60?: number;
  ar90Plus?: number;
  revenueThisPeriod?: number;
  revenuePriorPeriod?: number;
  gpMarginPct?: number;
  lastInvoiceDate?: string;
}

// ── Score Calculation ─────────────────────────────────────────

const WEIGHTS = {
  payment: 0.35,
  volume: 0.25,
  margin: 0.25,
  recency: 0.15,
} as const;

function scorePayment(input: CustomerInput): HealthFactor {
  const total = (input.arCurrent ?? 0) + (input.ar30 ?? 0) + (input.ar60 ?? 0) + (input.ar90Plus ?? 0);
  if (total === 0) {
    return { name: 'Payment', score: 100, weight: WEIGHTS.payment, detail: 'No outstanding AR' };
  }

  const pct90 = (input.ar90Plus ?? 0) / total;
  const pct60 = (input.ar60 ?? 0) / total;

  let score = 100;
  score -= pct90 * 80;  // Heavy penalty for 90+
  score -= pct60 * 30;  // Moderate penalty for 60+
  score = Math.max(0, Math.min(100, Math.round(score)));

  let detail = 'Pays on time';
  if (score < 40) detail = 'Severe collection risk — 90+ days significant';
  else if (score < 60) detail = 'Aging concerns — monitor collections';
  else if (score < 80) detail = 'Some aging but generally current';

  return { name: 'Payment', score, weight: WEIGHTS.payment, detail };
}

function scoreVolume(input: CustomerInput): HealthFactor {
  const current = input.revenueThisPeriod ?? 0;
  const prior = input.revenuePriorPeriod ?? 0;

  if (prior === 0 && current === 0) {
    return { name: 'Volume', score: 50, weight: WEIGHTS.volume, detail: 'No volume data' };
  }
  if (prior === 0) {
    return { name: 'Volume', score: 90, weight: WEIGHTS.volume, detail: 'New customer — growing' };
  }

  const growth = (current - prior) / prior;
  let score: number;
  if (growth >= 0.2) score = 100;
  else if (growth >= 0.05) score = 85;
  else if (growth >= -0.05) score = 70;
  else if (growth >= -0.2) score = 45;
  else score = 20;

  let detail: string;
  if (growth > 0) detail = `Volume up ${(growth * 100).toFixed(0)}%`;
  else if (growth === 0) detail = 'Volume flat';
  else detail = `Volume down ${Math.abs(growth * 100).toFixed(0)}%`;

  return { name: 'Volume', score, weight: WEIGHTS.volume, detail };
}

function scoreMargin(input: CustomerInput): HealthFactor {
  const margin = input.gpMarginPct ?? 0;
  let score: number;
  if (margin >= 15) score = 100;
  else if (margin >= 10) score = 85;
  else if (margin >= 7) score = 65;
  else if (margin >= 5) score = 45;
  else score = 20;

  return {
    name: 'Margin',
    score,
    weight: WEIGHTS.margin,
    detail: `GP margin: ${margin.toFixed(1)}%`,
  };
}

function scoreRecency(input: CustomerInput): HealthFactor {
  if (!input.lastInvoiceDate) {
    return { name: 'Recency', score: 30, weight: WEIGHTS.recency, detail: 'No recent invoice data' };
  }

  const daysSince = Math.floor((Date.now() - new Date(input.lastInvoiceDate).getTime()) / (1000 * 60 * 60 * 24));
  let score: number;
  if (daysSince <= 14) score = 100;
  else if (daysSince <= 30) score = 85;
  else if (daysSince <= 60) score = 60;
  else if (daysSince <= 90) score = 35;
  else score = 10;

  return {
    name: 'Recency',
    score,
    weight: WEIGHTS.recency,
    detail: daysSince <= 7 ? 'Active this week' : `Last invoice ${daysSince} days ago`,
  };
}

function computeGrade(score: number): CustomerHealth['grade'] {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  if (score >= 40) return 'D';
  return 'F';
}

function computeTrend(volume: HealthFactor, payment: HealthFactor): CustomerHealth['trend'] {
  const avg = (volume.score + payment.score) / 2;
  if (avg >= 75) return 'improving';
  if (avg >= 45) return 'stable';
  return 'declining';
}

export function computeHealthScore(input: CustomerInput): CustomerHealth {
  const payment = scorePayment(input);
  const volume = scoreVolume(input);
  const margin = scoreMargin(input);
  const recency = scoreRecency(input);

  const score = Math.round(
    payment.score * payment.weight +
    volume.score * volume.weight +
    margin.score * margin.weight +
    recency.score * recency.weight
  );

  return {
    customer: input.name,
    customerId: input.id,
    score,
    grade: computeGrade(score),
    factors: { payment, volume, margin, recency },
    trend: computeTrend(volume, payment),
  };
}

// ── Mock Data ─────────────────────────────────────────────────

export function getMockHealthScores(): CustomerHealth[] {
  const mockCustomers: CustomerInput[] = [
    { name: 'ConocoPhillips', id: 'C001', arCurrent: 180000, ar30: 45000, ar60: 0, ar90Plus: 0, revenueThisPeriod: 520000, revenuePriorPeriod: 480000, gpMarginPct: 11.2, lastInvoiceDate: '2026-03-25' },
    { name: 'ExxonMobil Supply', id: 'C002', arCurrent: 220000, ar30: 60000, ar60: 15000, ar90Plus: 0, revenueThisPeriod: 410000, revenuePriorPeriod: 430000, gpMarginPct: 9.8, lastInvoiceDate: '2026-03-24' },
    { name: 'Ageron Energy', id: 'C003', arCurrent: 95000, ar30: 40000, ar60: 35000, ar90Plus: 120000, revenueThisPeriod: 180000, revenuePriorPeriod: 250000, gpMarginPct: 6.4, lastInvoiceDate: '2026-03-10' },
    { name: 'VLS Environmental', id: 'C004', arCurrent: 75000, ar30: 10000, ar60: 0, ar90Plus: 0, revenueThisPeriod: 310000, revenuePriorPeriod: 280000, gpMarginPct: 14.1, lastInvoiceDate: '2026-03-27' },
    { name: 'Plaquemine Refining', id: 'C005', arCurrent: 140000, ar30: 35000, ar60: 20000, ar90Plus: 5000, revenueThisPeriod: 290000, revenuePriorPeriod: 300000, gpMarginPct: 10.5, lastInvoiceDate: '2026-03-22' },
    { name: 'Gulf Coast Petro', id: 'C006', arCurrent: 60000, ar30: 25000, ar60: 10000, ar90Plus: 80000, revenueThisPeriod: 120000, revenuePriorPeriod: 200000, gpMarginPct: 4.8, lastInvoiceDate: '2026-02-15' },
    { name: 'Marathon Petroleum', id: 'C007', arCurrent: 310000, ar30: 50000, ar60: 0, ar90Plus: 0, revenueThisPeriod: 680000, revenuePriorPeriod: 650000, gpMarginPct: 12.3, lastInvoiceDate: '2026-03-26' },
    { name: 'Delek US Holdings', id: 'C008', arCurrent: 110000, ar30: 30000, ar60: 15000, ar90Plus: 10000, revenueThisPeriod: 240000, revenuePriorPeriod: 260000, gpMarginPct: 8.9, lastInvoiceDate: '2026-03-20' },
    { name: 'Par Pacific', id: 'C009', arCurrent: 45000, ar30: 5000, ar60: 0, ar90Plus: 0, revenueThisPeriod: 190000, revenuePriorPeriod: 150000, gpMarginPct: 15.2, lastInvoiceDate: '2026-03-27' },
    { name: 'Calumet Specialty', id: 'C010', arCurrent: 88000, ar30: 22000, ar60: 8000, ar90Plus: 45000, revenueThisPeriod: 160000, revenuePriorPeriod: 185000, gpMarginPct: 7.1, lastInvoiceDate: '2026-03-05' },
    { name: 'Motiva Enterprises', id: 'C011', arCurrent: 270000, ar30: 40000, ar60: 5000, ar90Plus: 0, revenueThisPeriod: 550000, revenuePriorPeriod: 520000, gpMarginPct: 11.8, lastInvoiceDate: '2026-03-26' },
    { name: 'Citgo Petroleum', id: 'C012', arCurrent: 195000, ar30: 55000, ar60: 20000, ar90Plus: 15000, revenueThisPeriod: 380000, revenuePriorPeriod: 400000, gpMarginPct: 9.2, lastInvoiceDate: '2026-03-18' },
  ];

  return mockCustomers.map(computeHealthScore).sort((a, b) => b.score - a.score);
}
