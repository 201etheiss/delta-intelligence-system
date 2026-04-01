/**
 * Data Bridge — Unified cached data layer for all engines.
 *
 * All engines should import from here instead of calling gatewayFetch directly.
 * Provides a 5-minute in-memory cache per query to avoid hammering the gateway.
 */

import { gatewayFetch } from '@/lib/gateway';

// ── Cache ─────────────────────────────────────────────────────

interface CacheEntry<T> {
  data: T;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry<unknown>>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function getCached<T>(key: string): T | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.data as T;
}

function setCache<T>(key: string, data: T): T {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
  return data;
}

/** Clear all cached data (call after writes or manual refresh) */
export function clearCache(): void {
  cache.clear();
}

// ── Helpers ───────────────────────────────────────────────────

function safeArray(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}

function safeNumber(value: unknown): number {
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'string') {
    const parsed = parseFloat(value.replace(/[,$]/g, ''));
    if (!Number.isNaN(parsed)) return parsed;
  }
  return 0;
}

async function querySQL(sql: string): Promise<Record<string, unknown>[]> {
  const res = await gatewayFetch('/ascend/query', 'admin', {
    method: 'POST',
    body: { sql },
    timeout: 15000,
  });
  return safeArray(res.data) as Record<string, unknown>[];
}

async function querySOQL(soql: string): Promise<Record<string, unknown>[]> {
  const res = await gatewayFetch('/salesforce/query', 'admin', {
    method: 'POST',
    body: { soql },
    timeout: 15000,
  });
  const records = (res as Record<string, unknown>).records as Record<string, unknown>[] | undefined;
  return records ?? [];
}

async function getEndpoint(path: string): Promise<Record<string, unknown>[]> {
  const res = await gatewayFetch(path, 'admin', { timeout: 15000 });
  return safeArray(res.data) as Record<string, unknown>[];
}

// ── Types ─────────────────────────────────────────────────────

export interface TrialBalanceLine {
  accountDesc: string;
  natural: string;
  pc: string;
  pcDesc: string;
  begBal: number;
  periodDebit: number;
  periodCredit: number;
  mtdNet: number;
  endBal: number;
}

export interface ARAgingRecord {
  customerName: string;
  current: number;
  past30: number;
  past60: number;
  past90: number;
  past90Plus: number;
  total: number;
}

export interface RevenueRecord {
  period: number;
  revenue: number;
}

export interface COGSRecord {
  period: number;
  cogs: number;
}

export interface CashPositionRecord {
  cashBalance: number;
  locBalance: number;
  locAvailable: number;
  rackPrice: number;
  rackProduct: string;
}

export interface EquipmentRecord {
  equipmentId: string;
  code: string;
  description: string;
  assetType: string;
  active: boolean;
}

export interface CustomerRecord {
  name: string;
  code: string;
  [key: string]: unknown;
}

export interface VendorRecord {
  name: string;
  id: string;
  [key: string]: unknown;
}

export interface EmployeeRecord {
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
}

export interface VehicleRecord {
  id: string;
  name: string;
  [key: string]: unknown;
}

export interface DriverRecord {
  id: string;
  name: string;
  driverActivationStatus: string;
  [key: string]: unknown;
}

export interface OpportunityRecord {
  Name: string;
  Amount: number;
  StageName: string;
  CloseDate: string;
  [key: string]: unknown;
}

// ── Data Fetchers (cached) ────────────────────────────────────

const YEAR = new Date().getFullYear();

export async function fetchTrialBalance(period: string): Promise<TrialBalanceLine[]> {
  const key = `tb:${period}`;
  const cached = getCached<TrialBalanceLine[]>(key);
  if (cached) return cached;

  try {
    const [yearStr, moStr] = period.split('-');
    const year = parseInt(yearStr);
    const mo = parseInt(moStr);
    const rows = await querySQL(
      `SELECT AcctDesc, Natural, PC, PCDesc, BegBal, Period_Debit, Period_Credit, MTDNet, EndBal FROM vFSWWBalCOA WHERE Year = ${year} AND Period = ${mo} AND ABS(EndBal) > 0 ORDER BY Natural`
    );
    const result = rows.map(r => ({
      accountDesc: String(r.AcctDesc ?? ''),
      natural: String(r.Natural ?? ''),
      pc: String(r.PC ?? ''),
      pcDesc: String(r.PCDesc ?? ''),
      begBal: safeNumber(r.BegBal),
      periodDebit: safeNumber(r.Period_Debit),
      periodCredit: safeNumber(r.Period_Credit),
      mtdNet: safeNumber(r.MTDNet),
      endBal: safeNumber(r.EndBal),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchARAging(): Promise<ARAgingRecord[]> {
  const key = 'ar-aging';
  const cached = getCached<ARAgingRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/ascend/ar/aging');
    const result = rows.map(r => ({
      customerName: String(r.CustomerName ?? r.customer ?? ''),
      current: safeNumber(r.Current_AR ?? r.current ?? 0),
      past30: safeNumber(r.Past1_30 ?? r.days_30 ?? 0),
      past60: safeNumber(r.Past31_60 ?? r.days_60 ?? 0),
      past90: safeNumber(r.Past61_90 ?? r.days_90 ?? 0),
      past90Plus: safeNumber(r.Past90Plus ?? r.over_90 ?? r.over90 ?? 0),
      total: safeNumber(r.TotalOutstanding ?? r.total ?? r.balance ?? 0),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchRevenueByPeriod(year?: number): Promise<RevenueRecord[]> {
  const yr = year ?? YEAR;
  const key = `revenue:${yr}`;
  const cached = getCached<RevenueRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await querySQL(
      `SELECT Period, SUM(ABS(Period_Balance)) AS Revenue FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${yr} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Revenue' GROUP BY Period ORDER BY Period`
    );
    const result = rows.map(r => ({
      period: safeNumber(r.Period),
      revenue: safeNumber(r.Revenue),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchCOGSByPeriod(year?: number): Promise<COGSRecord[]> {
  const yr = year ?? YEAR;
  const key = `cogs:${yr}`;
  const cached = getCached<COGSRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await querySQL(
      `SELECT Period, SUM(ABS(Period_Balance)) AS COGS FROM DF_PBI_IncomeStatementData WHERE Year_For_Period = ${yr} AND Period BETWEEN 1 AND 12 AND AccountGroup = 'Gross margin' GROUP BY Period ORDER BY Period`
    );
    const result = rows.map(r => ({
      period: safeNumber(r.Period),
      cogs: safeNumber(r.COGS),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchCashPosition(): Promise<CashPositionRecord> {
  const key = 'cash-position';
  const cached = getCached<CashPositionRecord>(key);
  if (cached) return cached;

  try {
    const [cashRows, locRows, rackRows] = await Promise.all([
      querySQL("SELECT SUM(EndBal) AS Balance FROM vFSWWBalCOA WHERE Natural LIKE '101%' AND Year = " + YEAR + " AND Period = " + (new Date().getMonth() + 1)),
      querySQL("SELECT SUM(EndBal) AS Balance FROM vFSWWBalCOA WHERE Natural = '25100' AND Year = " + YEAR + " AND Period = " + (new Date().getMonth() + 1)),
      querySQL("SELECT TOP 1 ProductDescr, RackPrice FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC"),
    ]);

    const result: CashPositionRecord = {
      cashBalance: Math.abs(safeNumber(cashRows[0]?.Balance)),
      locBalance: Math.abs(safeNumber(locRows[0]?.Balance)),
      // TODO: $15M LOC facility limit should be configured via env/config, not hardcoded
      locAvailable: Math.max(0, 15000000 - Math.abs(safeNumber(locRows[0]?.Balance))),
      rackPrice: safeNumber(rackRows[0]?.RackPrice),
      rackProduct: String(rackRows[0]?.ProductDescr ?? 'Diesel Dyed'),
    };
    return setCache(key, result);
  } catch {
    return { cashBalance: 0, locBalance: 0, locAvailable: 0, rackPrice: 0, rackProduct: 'Diesel Dyed' };
  }
}

export async function fetchEquipment(): Promise<EquipmentRecord[]> {
  const key = 'equipment';
  const cached = getCached<EquipmentRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/ascend/equipment');
    const result = rows.map(r => ({
      equipmentId: String(r.EquipmentId ?? ''),
      code: String(r.Code ?? ''),
      description: String(r.Description ?? ''),
      assetType: String(r.AssetType ?? ''),
      active: r.Active === 'Y' || r.Active === true,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchCustomers(): Promise<CustomerRecord[]> {
  const key = 'customers';
  const cached = getCached<CustomerRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/ascend/customers');
    const result = rows.map(r => ({
      name: String(r.Name ?? r.CustomerName ?? ''),
      code: String(r.Code ?? r.CustomerCode ?? ''),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchVendors(): Promise<VendorRecord[]> {
  const key = 'vendors';
  const cached = getCached<VendorRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/vroozi/suppliers');
    const result = rows.map(r => ({
      name: String(r.name ?? r.vendor_name ?? ''),
      id: String(r.id ?? r.vendor_id ?? ''),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchPaylocityEmployees(): Promise<EmployeeRecord[]> {
  const key = 'paylocity-employees';
  const cached = getCached<EmployeeRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/paylocity/employees');
    const result = rows.map(r => ({
      displayName: String(r.displayName ?? (((r.firstName ?? '') + ' ' + (r.lastName ?? '')).trim() || 'Unknown')),
      mail: String(r.mail ?? r.email ?? ''),
      jobTitle: r.jobTitle ? String(r.jobTitle) : null,
      department: r.department ? String(r.department) : null,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchFleetVehicles(): Promise<VehicleRecord[]> {
  const key = 'fleet-vehicles';
  const cached = getCached<VehicleRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/samsara/vehicles');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchFleetDrivers(): Promise<DriverRecord[]> {
  const key = 'fleet-drivers';
  const cached = getCached<DriverRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/samsara/drivers');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? ''),
      driverActivationStatus: String(r.driverActivationStatus ?? ''),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchSalesforceOpportunities(): Promise<OpportunityRecord[]> {
  const key = 'sf-opportunities';
  const cached = getCached<OpportunityRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await querySOQL(
      `SELECT Name, Amount, StageName, CloseDate, Account.Name FROM Opportunity WHERE IsClosed = false ORDER BY Amount DESC LIMIT 50`
    );
    const result = rows.map(r => ({
      Name: String(r.Name ?? ''),
      Amount: safeNumber(r.Amount),
      StageName: String(r.StageName ?? ''),
      CloseDate: String(r.CloseDate ?? ''),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export async function fetchRackPrice(): Promise<{ product: string; price: number; date: string } | null> {
  const key = 'rack-price';
  const cached = getCached<{ product: string; price: number; date: string } | null>(key);
  if (cached !== null) return cached;

  try {
    const rows = await querySQL(
      "SELECT TOP 1 ProductDescr, RackPrice, EffDtTm FROM vRackPrice WHERE ProductDescr LIKE '%Diesel Dyed%' ORDER BY EffDtTm DESC"
    );
    if (rows.length === 0) return setCache(key, null);
    const r = rows[0];
    return setCache(key, {
      product: String(r.ProductDescr ?? 'Diesel Dyed'),
      price: safeNumber(r.RackPrice),
      date: String(r.EffDtTm ?? ''),
    });
  } catch {
    return null;
  }
}

// ── HR Extended Data ─────────────────────────────────────────

export interface HrExtendedRecord {
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  employeeType: string | null; // 'Employee' | 'Contractor' | null
  hireDate: string | null;
  terminationDate: string | null;
  status: string | null; // 'Active' | 'Terminated' | etc.
  manager: string | null;
  phone: string | null;
}

export async function fetchPaylocityEmployeesExtended(): Promise<HrExtendedRecord[]> {
  const key = 'paylocity-employees-extended';
  const cached = getCached<HrExtendedRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/paylocity/employees');
    const result = rows.map(r => ({
      displayName: String(r.displayName ?? (((r.firstName ?? '') + ' ' + (r.lastName ?? '')).trim() || 'Unknown')),
      mail: String(r.mail ?? r.email ?? ''),
      jobTitle: r.jobTitle ? String(r.jobTitle) : null,
      department: r.department ? String(r.department) : null,
      employeeType: r.employeeType ? String(r.employeeType) : (r.type ? String(r.type) : null),
      hireDate: r.hireDate ? String(r.hireDate) : (r.startDate ? String(r.startDate) : null),
      terminationDate: r.terminationDate ? String(r.terminationDate) : null,
      status: r.status ? String(r.status) : (r.employmentStatus ? String(r.employmentStatus) : null),
      manager: r.manager ? String(r.manager) : (r.managerName ? String(r.managerName) : null),
      phone: r.phone ? String(r.phone) : (r.workPhone ? String(r.workPhone) : null),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── MS365 People / Org ───────────────────────────────────────

export interface MS365UserRecord {
  id: string;
  displayName: string;
  mail: string;
  jobTitle: string | null;
  department: string | null;
  officeLocation: string | null;
  mobilePhone: string | null;
  businessPhones: string[];
  managerId: string | null;
  managerName: string | null;
}

export async function fetchMS365Users(): Promise<MS365UserRecord[]> {
  const key = 'ms365-users';
  const cached = getCached<MS365UserRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/microsoft/users');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      displayName: String(r.displayName ?? ''),
      mail: String(r.mail ?? r.userPrincipalName ?? ''),
      jobTitle: r.jobTitle ? String(r.jobTitle) : null,
      department: r.department ? String(r.department) : null,
      officeLocation: r.officeLocation ? String(r.officeLocation) : null,
      mobilePhone: r.mobilePhone ? String(r.mobilePhone) : null,
      businessPhones: Array.isArray(r.businessPhones) ? (r.businessPhones as unknown[]).map(String) : [],
      managerId: r.managerId ? String(r.managerId) : null,
      managerName: r.managerName ? String(r.managerName) : null,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

export interface MS365OrgEntry {
  id: string;
  displayName: string;
  jobTitle: string | null;
  department: string | null;
  directReports: string[]; // user ids
  managerId: string | null;
}

export async function fetchMS365Org(): Promise<MS365OrgEntry[]> {
  const key = 'ms365-org';
  const cached = getCached<MS365OrgEntry[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/microsoft/org');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      displayName: String(r.displayName ?? ''),
      jobTitle: r.jobTitle ? String(r.jobTitle) : null,
      department: r.department ? String(r.department) : null,
      directReports: Array.isArray(r.directReports) ? (r.directReports as unknown[]).map(String) : [],
      managerId: r.managerId ? String(r.managerId) : null,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── Paylocity: Time Off ─────────────────────────────────────

export interface TimeOffRecord {
  employeeName: string;
  type: string;
  startDate: string;
  endDate: string;
  status: string;
}

export async function fetchPaylocityTimeOff(): Promise<TimeOffRecord[]> {
  const key = 'paylocity-timeoff';
  const cached = getCached<TimeOffRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/paylocity/time-off');
    const result = rows.map(r => ({
      employeeName: String(r.employeeName ?? r.employee ?? ''),
      type: String(r.type ?? r.leaveType ?? ''),
      startDate: String(r.startDate ?? r.start ?? ''),
      endDate: String(r.endDate ?? r.end ?? ''),
      status: String(r.status ?? 'pending'),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── Vroozi: Purchase Orders ─────────────────────────────────

export interface PurchaseOrderRecord {
  poNumber: string;
  supplierName: string;
  amount: number;
  status: string;
  createdDate: string;
}

export async function fetchVrooziPurchaseOrders(): Promise<PurchaseOrderRecord[]> {
  const key = 'vroozi-pos';
  const cached = getCached<PurchaseOrderRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/vroozi/purchase-orders');
    const result = rows.map(r => ({
      poNumber: String(r.poNumber ?? r.number ?? r.id ?? ''),
      supplierName: String(r.supplierName ?? r.supplier ?? r.vendor ?? ''),
      amount: safeNumber(r.amount ?? r.total ?? 0),
      status: String(r.status ?? 'open'),
      createdDate: String(r.createdDate ?? r.created ?? r.date ?? ''),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── MS365: Calendar Events ──────────────────────────────────

export interface CalendarEventRecord {
  subject: string;
  start: string;
  end: string;
  organizer: string;
}

export async function fetchMS365Calendar(): Promise<CalendarEventRecord[]> {
  const key = 'ms365-calendar';
  const cached = getCached<CalendarEventRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/microsoft/calendar');
    const result = rows.map(r => ({
      subject: String(r.subject ?? ''),
      start: String(r.start ?? ''),
      end: String(r.end ?? ''),
      organizer: String(r.organizer ?? r.organizerName ?? ''),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── Power BI: Reports ───────────────────────────────────────

export interface PowerBIReportRecord {
  id: string;
  name: string;
  webUrl: string;
  datasetId: string;
}

export async function fetchPowerBIReports(): Promise<PowerBIReportRecord[]> {
  const key = 'powerbi-reports';
  const cached = getCached<PowerBIReportRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/powerbi/reports');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? r.title ?? ''),
      webUrl: String(r.webUrl ?? r.url ?? ''),
      datasetId: String(r.datasetId ?? ''),
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}

// ── Fleet Panda: Assets ─────────────────────────────────────

export interface FleetPandaAssetRecord {
  id: string;
  name: string;
  type: string;
  status: string;
  [key: string]: unknown;
}

export async function fetchFleetPandaAssets(): Promise<FleetPandaAssetRecord[]> {
  const key = 'fleetpanda-assets';
  const cached = getCached<FleetPandaAssetRecord[]>(key);
  if (cached) return cached;

  try {
    const rows = await getEndpoint('/fleetpanda/assets');
    const result = rows.map(r => ({
      id: String(r.id ?? ''),
      name: String(r.name ?? r.assetName ?? ''),
      type: String(r.type ?? r.assetType ?? ''),
      status: String(r.status ?? 'active'),
      ...r,
    }));
    return setCache(key, result);
  } catch {
    return [];
  }
}
