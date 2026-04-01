/**
 * Cash Flow Engine
 *
 * Weekly cash flow forecasting, borrowing base calculations,
 * and LOC status monitoring via the Ascend gateway.
 * File persistence to data/cash-flow-forecasts.json.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';
import { gatewayFetch } from '@/lib/gateway';

// ── Types ────────────────────────────────────────────────────

export interface CashFlowForecast {
  id: string;
  weekStarting: string; // YYYY-MM-DD (Monday)
  operatingReceipts: number;
  operatingDisbursements: number;
  netOperating: number;
  investingCF: number;
  financingCF: number;
  netChange: number;
  openingBalance: number;
  closingBalance: number;
  borrowingBaseUtilization: number; // percentage 0-100
  locAvailable: number;
  createdAt: string;
}

export interface BorrowingBase {
  id: string;
  date: string;
  eligibleAR: number;
  eligibleInventory: number;
  totalBase: number;
  advanceRate: number; // percentage, e.g. 80
  maxBorrowing: number;
  currentDrawn: number;
  available: number;
  createdAt: string;
}

export interface CashPosition {
  bankBalance: number;
  arTotal: number;
  apTotal: number;
  locDrawn: number;
  locAvailable: number;
  netWorkingCapital: number;
  asOf: string;
}

interface ForecastsFile {
  forecasts: CashFlowForecast[];
  borrowingBases: BorrowingBase[];
  lastUpdated: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getDataPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/cash-flow-forecasts.json';
  }
  return path.join(process.cwd(), 'data', 'cash-flow-forecasts.json');
}

function readData(): ForecastsFile {
  const filePath = getDataPath();
  if (!existsSync(filePath)) {
    return { forecasts: [], borrowingBases: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(filePath, 'utf-8');
    return JSON.parse(raw) as ForecastsFile;
  } catch {
    return { forecasts: [], borrowingBases: [], lastUpdated: new Date().toISOString() };
  }
}

function writeData(data: ForecastsFile): void {
  const filePath = getDataPath();
  writeFileSync(filePath, JSON.stringify({ ...data, lastUpdated: new Date().toISOString() }, null, 2), 'utf-8');
}

function generateId(): string {
  return `cf-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

// ── Gateway Helpers ──────────────────────────────────────────

async function queryAscend(sql: string): Promise<Array<Record<string, unknown>>> {
  const query = encodeURIComponent(sql);
  const result = await gatewayFetch(`/ascend/query?sql=${query}`, 'admin', { timeout: 20000 });
  if (!result.success || !result.data) return [];
  return result.data as Array<Record<string, unknown>>;
}

// ── Core Functions ───────────────────────────────────────────

export async function getCashPosition(): Promise<CashPosition> {
  // Bank balance from Cash account 10100
  const cashRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '10100'"
  );
  const bankBalance = Number(cashRows[0]?.Balance ?? 0);

  // Total AR from account 12000
  const arRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '12000'"
  );
  const arTotal = Number(arRows[0]?.Balance ?? 0);

  // Total AP from account 20000
  const apRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '20000'"
  );
  const apTotal = Math.abs(Number(apRows[0]?.Balance ?? 0));

  // LOC from account 25100 (JPM Chase)
  const locRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '25100'"
  );
  const locDrawn = Math.abs(Number(locRows[0]?.Balance ?? 0));

  // Estimate LOC limit at $5M (typical for Delta360 fuel distribution)
  const locLimit = 5_000_000;
  const locAvailable = Math.max(0, locLimit - locDrawn);

  return {
    bankBalance: Math.round(bankBalance * 100) / 100,
    arTotal: Math.round(arTotal * 100) / 100,
    apTotal: Math.round(apTotal * 100) / 100,
    locDrawn: Math.round(locDrawn * 100) / 100,
    locAvailable: Math.round(locAvailable * 100) / 100,
    netWorkingCapital: Math.round((bankBalance + arTotal - apTotal) * 100) / 100,
    asOf: new Date().toISOString(),
  };
}

export async function calculateBorrowingBase(): Promise<BorrowingBase> {
  // Eligible AR: current + 0-30 days (exclude 90+ days)
  const arAgingRows = await queryAscend(
    "SELECT SUM(Balance) as Total FROM ARAgingSummary WHERE AgingBucket IN ('Current', '1-30')"
  );
  const eligibleAR = Number(arAgingRows[0]?.Total ?? 0);

  // Eligible Inventory from account 14000
  const invRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account LIKE '14%'"
  );
  const eligibleInventory = Number(invRows[0]?.Balance ?? 0);

  // Standard advance rates: 85% AR, 50% Inventory
  const arAdvanceRate = 0.85;
  const invAdvanceRate = 0.50;
  const totalBase = (eligibleAR * arAdvanceRate) + (eligibleInventory * invAdvanceRate);
  const advanceRate = eligibleAR + eligibleInventory > 0
    ? Math.round((totalBase / (eligibleAR + eligibleInventory)) * 100)
    : 0;

  // Current LOC drawn
  const locRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '25100'"
  );
  const currentDrawn = Math.abs(Number(locRows[0]?.Balance ?? 0));
  const maxBorrowing = Math.round(totalBase * 100) / 100;
  const available = Math.max(0, Math.round((maxBorrowing - currentDrawn) * 100) / 100);

  const base: BorrowingBase = {
    id: generateId(),
    date: new Date().toISOString().split('T')[0],
    eligibleAR: Math.round(eligibleAR * 100) / 100,
    eligibleInventory: Math.round(eligibleInventory * 100) / 100,
    totalBase: Math.round(totalBase * 100) / 100,
    advanceRate,
    maxBorrowing,
    currentDrawn: Math.round(currentDrawn * 100) / 100,
    available,
    createdAt: new Date().toISOString(),
  };

  // Persist
  const data = readData();
  const updatedBases = [...data.borrowingBases, base];
  writeData({ ...data, borrowingBases: updatedBases });

  return base;
}

export async function getLocStatus(): Promise<{
  accountNumber: string;
  bank: string;
  drawn: number;
  limit: number;
  available: number;
  utilization: number;
}> {
  const locRows = await queryAscend(
    "SELECT SUM(Amount) as Balance FROM GLDetail WHERE Account = '25100'"
  );
  const drawn = Math.abs(Number(locRows[0]?.Balance ?? 0));
  const limit = 5_000_000; // JPM Chase LOC limit
  const available = Math.max(0, limit - drawn);
  const utilization = limit > 0 ? Math.round((drawn / limit) * 10000) / 100 : 0;

  return {
    accountNumber: '25100',
    bank: 'JPMorgan Chase',
    drawn: Math.round(drawn * 100) / 100,
    limit,
    available: Math.round(available * 100) / 100,
    utilization,
  };
}

function getNextMonday(from: Date): Date {
  const d = new Date(from);
  const day = d.getDay();
  const diff = day === 0 ? 1 : (day === 1 ? 0 : 8 - day);
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

export async function generateWeeklyForecast(weeksAhead: number): Promise<CashFlowForecast[]> {
  if (weeksAhead < 1 || weeksAhead > 52) {
    throw new Error('weeksAhead must be between 1 and 52');
  }

  const position = await getCashPosition();
  const locStatus = await getLocStatus();

  // Pull recent AR collections (last 4 weeks avg) for receipt estimation
  const arCollections = await queryAscend(
    "SELECT SUM(Amount) as Total FROM ARPayment WHERE PaymentDate >= DATEADD(day, -28, GETDATE())"
  );
  const avgWeeklyReceipts = Math.abs(Number(arCollections[0]?.Total ?? 0)) / 4;

  // Pull recent AP payments (last 4 weeks avg) for disbursement estimation
  const apPayments = await queryAscend(
    "SELECT SUM(Amount) as Total FROM APPayment WHERE PaymentDate >= DATEADD(day, -28, GETDATE())"
  );
  const avgWeeklyDisbursements = Math.abs(Number(apPayments[0]?.Total ?? 0)) / 4;

  const forecasts: CashFlowForecast[] = [];
  let runningBalance = position.bankBalance;
  const startMonday = getNextMonday(new Date());

  for (let week = 0; week < weeksAhead; week++) {
    const weekStart = new Date(startMonday);
    weekStart.setDate(weekStart.getDate() + (week * 7));
    const weekStartStr = weekStart.toISOString().split('T')[0];

    // Apply slight decay for uncertainty further out
    const uncertaintyFactor = 1 - (week * 0.02); // 2% uncertainty per week
    const operatingReceipts = Math.round(avgWeeklyReceipts * uncertaintyFactor * 100) / 100;
    const operatingDisbursements = Math.round(avgWeeklyDisbursements * uncertaintyFactor * 100) / 100;
    const netOperating = Math.round((operatingReceipts - operatingDisbursements) * 100) / 100;

    // Investing and financing assumed minimal for weekly forecast
    const investingCF = 0;
    const financingCF = 0;
    const netChange = Math.round((netOperating + investingCF + financingCF) * 100) / 100;

    const openingBalance = Math.round(runningBalance * 100) / 100;
    const closingBalance = Math.round((openingBalance + netChange) * 100) / 100;
    runningBalance = closingBalance;

    const borrowingBaseUtilization = locStatus.limit > 0
      ? Math.round((locStatus.drawn / locStatus.limit) * 10000) / 100
      : 0;

    const forecast: CashFlowForecast = {
      id: generateId(),
      weekStarting: weekStartStr,
      operatingReceipts,
      operatingDisbursements,
      netOperating,
      investingCF,
      financingCF,
      netChange,
      openingBalance,
      closingBalance,
      borrowingBaseUtilization,
      locAvailable: locStatus.available,
      createdAt: new Date().toISOString(),
    };

    forecasts.push(forecast);
  }

  // Persist
  const data = readData();
  const updatedForecasts = [...data.forecasts, ...forecasts];
  writeData({ ...data, forecasts: updatedForecasts });

  return forecasts;
}

export function getLatestForecast(): CashFlowForecast[] {
  const data = readData();
  if (data.forecasts.length === 0) return [];

  // Return the most recent batch (same createdAt timestamp prefix)
  const sorted = [...data.forecasts].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  const latestTimestamp = sorted[0].createdAt;
  // Forecasts generated in same batch share same second
  const latestSecond = latestTimestamp.slice(0, 19);
  return sorted.filter((f) => f.createdAt.startsWith(latestSecond));
}

export function getLatestBorrowingBase(): BorrowingBase | null {
  const data = readData();
  if (data.borrowingBases.length === 0) return null;
  const sorted = [...data.borrowingBases].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
  return sorted[0];
}
