/**
 * Automated Email Digest Generator
 *
 * Pulls live data from the unified data gateway, formats into branded
 * HTML emails, and sends via Microsoft Graph (sendMail) through the
 * gateway's /microsoft/write endpoint.
 *
 * Digest types:
 *   weekly_kpi     - Salesforce activity vs KPI targets per rep
 *   daily_ar       - AR aging with 90+ day flags
 *   weekly_pipeline - Opportunity pipeline grouped by stage
 *   daily_fleet    - Fleet status and delivery summary
 */

import { gatewayGet, gatewayPost } from '@/lib/gateway';
import { cronMatches } from '@/lib/cron-scheduler';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import path from 'path';

// ── Types ─────────────────────────────────────────────────────

export type DigestType = 'weekly_kpi' | 'daily_ar' | 'weekly_pipeline' | 'daily_fleet' | 'daily_executive';

export interface DigestConfig {
  id: string;
  name: string;
  recipients: string[];
  schedule: string;
  type: DigestType;
  enabled: boolean;
  lastSentAt: string | null;
}

export interface DigestResult {
  digestId: string;
  type: DigestType;
  subject: string;
  recipientCount: number;
  sentAt: string;
  status: 'sent' | 'error';
  error?: string;
}

// ── Default Configs ───────────────────────────────────────────

export const DEFAULT_DIGESTS: DigestConfig[] = [
  {
    id: 'weekly_kpi',
    name: 'Weekly Sales KPI Report',
    recipients: ['etheiss@delta360.energy', 'avegas@delta360.energy'],
    schedule: '0 9 * * 1',
    type: 'weekly_kpi',
    enabled: true,
    lastSentAt: null,
  },
  {
    id: 'daily_ar',
    name: 'Daily AR Aging Alert',
    recipients: ['etheiss@delta360.energy'],
    schedule: '0 8 * * *',
    type: 'daily_ar',
    enabled: true,
    lastSentAt: null,
  },
  {
    id: 'weekly_pipeline',
    name: 'Weekly Pipeline Summary',
    recipients: ['etheiss@delta360.energy', 'avegas@delta360.energy'],
    schedule: '0 9 * * 5',
    type: 'weekly_pipeline',
    enabled: true,
    lastSentAt: null,
  },
  {
    id: 'daily_executive',
    name: 'Daily Executive Briefing',
    recipients: ['etheiss@delta360.energy'],
    schedule: '0 7 * * 1-5',
    type: 'daily_executive',
    enabled: true,
    lastSentAt: null,
  },
  {
    id: 'daily_fleet',
    name: 'Daily Fleet Status',
    recipients: ['etheiss@delta360.energy'],
    schedule: '0 6 * * 1-5',
    type: 'daily_fleet',
    enabled: false,
    lastSentAt: null,
  },
];

// ── Persistence ───────────────────────────────────────────────

function getDigestConfigPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/email-digest-configs.json';
  }
  return path.join(process.cwd(), 'data', 'email-digest-configs.json');
}

function getDigestLogPath(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/email-digest-log.json';
  }
  return path.join(process.cwd(), 'data', 'email-digest-log.json');
}

export function loadDigestConfigs(): DigestConfig[] {
  const filePath = getDigestConfigPath();
  if (!existsSync(filePath)) return [...DEFAULT_DIGESTS];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(raw) as DigestConfig[];
    return parsed.length > 0 ? parsed : [...DEFAULT_DIGESTS];
  } catch {
    return [...DEFAULT_DIGESTS];
  }
}

function saveDigestConfigs(configs: DigestConfig[]): void {
  const filePath = getDigestConfigPath();
  writeFileSync(filePath, JSON.stringify(configs, null, 2), 'utf-8');
}

function appendDigestLog(result: DigestResult): void {
  const filePath = getDigestLogPath();
  let logs: DigestResult[] = [];
  if (existsSync(filePath)) {
    try {
      logs = JSON.parse(readFileSync(filePath, 'utf-8')) as DigestResult[];
    } catch {
      logs = [];
    }
  }
  const updated = [result, ...logs];
  const capped = updated.length > 100 ? updated.slice(0, 100) : updated;
  writeFileSync(filePath, JSON.stringify(capped, null, 2), 'utf-8');
}

export function getDigestLogs(): DigestResult[] {
  const filePath = getDigestLogPath();
  if (!existsSync(filePath)) return [];
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as DigestResult[];
  } catch {
    return [];
  }
}

// ── HTML Template Helpers ─────────────────────────────────────

const BRAND_ORANGE = '#FE5000';
const BRAND_BLACK = '#000000';

function wrapHtml(title: string, bodyContent: string): string {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f4;font-family:Inter,Arial,Helvetica,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f4;padding:24px 0;">
    <tr>
      <td align="center">
        <table width="640" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:${BRAND_BLACK};padding:20px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="color:${BRAND_ORANGE};font-size:20px;font-weight:700;letter-spacing:0.5px;">
                    DELTA<span style="color:#ffffff;">360</span>
                  </td>
                  <td align="right" style="color:#999999;font-size:12px;">
                    ${escapeHtml(title)}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:32px;">
              ${bodyContent}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background:#fafafa;padding:16px 32px;border-top:1px solid #eee;">
              <p style="margin:0;font-size:11px;color:#999;text-align:center;">
                This is an automated report from Delta360 Intelligence. Do not reply to this email.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function complianceColor(value: number, target: number): string {
  const ratio = value / target;
  if (ratio >= 1.0) return '#16a34a'; // green
  if (ratio >= 0.75) return '#ca8a04'; // yellow
  return '#dc2626'; // red
}

function formatCurrency(amount: number): string {
  if (Math.abs(amount) >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(amount) >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function tableHeader(columns: string[]): string {
  const cells = columns
    .map(
      (col) =>
        `<th style="padding:8px 12px;text-align:left;font-size:12px;font-weight:600;color:#666;border-bottom:2px solid ${BRAND_ORANGE};text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(col)}</th>`
    )
    .join('');
  return `<tr>${cells}</tr>`;
}

function tableRow(cells: Array<{ text: string; align?: string; color?: string }>, even: boolean): string {
  const bg = even ? '#fafafa' : '#ffffff';
  const tds = cells
    .map(
      (c) =>
        `<td style="padding:8px 12px;font-size:13px;color:${c.color ?? '#333'};text-align:${c.align ?? 'left'};background:${bg};border-bottom:1px solid #eee;">${escapeHtml(c.text)}</td>`
    )
    .join('');
  return `<tr>${tds}</tr>`;
}

function sectionTitle(text: string): string {
  return `<h2 style="margin:24px 0 12px;font-size:16px;font-weight:600;color:${BRAND_BLACK};border-bottom:2px solid ${BRAND_ORANGE};padding-bottom:6px;">${escapeHtml(text)}</h2>`;
}

// ── Digest Generators ─────────────────────────────────────────

interface DigestOutput {
  subject: string;
  html: string;
}

async function generateWeeklyKPI(): Promise<DigestOutput> {
  const now = new Date();
  const weekStr = `Week of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const subject = `Weekly Sales KPI Report - ${weekStr}`;

  // Pull Salesforce activity counts per rep
  const sfResponse = await gatewayGet(
    '/salesforce/query?q=' +
      encodeURIComponent(
        "SELECT Owner.Name, COUNT(Id) cnt FROM Task WHERE CreatedDate = THIS_WEEK AND Status = 'Completed' GROUP BY Owner.Name ORDER BY COUNT(Id) DESC"
      ),
    'admin'
  );

  // KPI targets per week
  const KPI_TARGETS: Record<string, number> = {
    'Calls': 25,
    'Meetings': 5,
    'Activities': 30,
  };

  interface SfActivityRecord {
    'Owner.Name'?: string;
    Owner?: { Name?: string };
    cnt?: number;
    expr0?: number;
  }

  const records = (
    sfResponse.success && sfResponse.data
      ? (sfResponse.data as { records?: SfActivityRecord[] }).records ?? []
      : []
  ) as SfActivityRecord[];

  let tableRows = '';
  if (records.length > 0) {
    records.forEach((rec, i) => {
      const name = rec['Owner.Name'] ?? rec.Owner?.Name ?? 'Unknown';
      const count = typeof rec.cnt === 'number' ? rec.cnt : (typeof rec.expr0 === 'number' ? rec.expr0 : 0);
      const target = KPI_TARGETS['Activities'] ?? 30;
      const color = complianceColor(count, target);
      const pct = target > 0 ? Math.round((count / target) * 100) : 0;
      tableRows += tableRow(
        [
          { text: name },
          { text: String(count), align: 'right' },
          { text: String(target), align: 'right' },
          { text: `${pct}%`, align: 'right', color },
        ],
        i % 2 === 0
      );
    });
  } else {
    tableRows = `<tr><td colspan="4" style="padding:16px;text-align:center;color:#999;font-size:13px;">No Salesforce activity data available. Gateway may be offline or credentials not configured.</td></tr>`;
  }

  const body = `
    <p style="margin:0 0 8px;font-size:14px;color:#666;">${escapeHtml(weekStr)}</p>
    <h1 style="margin:0 0 24px;font-size:22px;color:${BRAND_BLACK};">Weekly Sales KPI Report</h1>

    ${sectionTitle('Activity Compliance by Rep')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Rep', 'Actual', 'Target', 'Compliance'])}
      ${tableRows}
    </table>

    <p style="margin:16px 0 0;font-size:11px;color:#999;">
      Green = 100%+ | Yellow = 75-99% | Red = below 75%. Target: ${KPI_TARGETS['Activities']} activities/week.
    </p>
  `;

  return { subject, html: wrapHtml(subject, body) };
}

async function generateDailyAR(): Promise<DigestOutput> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `Daily AR Aging Alert - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Pull AR aging from gateway
  const arResponse = await gatewayGet('/ascend/ar/aging', 'admin');

  interface ArAgingRecord {
    customer?: string;
    CustomerName?: string;
    name?: string;
    total?: number;
    balance?: number;
    amount?: number;
    current?: number;
    days_30?: number;
    days_60?: number;
    days_90?: number;
    over_90?: number;
    'over90'?: number;
  }

  const arData = (
    arResponse.success && arResponse.data
      ? Array.isArray(arResponse.data)
        ? (arResponse.data as ArAgingRecord[])
        : (arResponse.data as { records?: ArAgingRecord[] }).records ?? []
      : []
  ) as ArAgingRecord[];

  // Flag customers with >$100K in 90+ days
  const flagged = arData
    .map((rec) => {
      const name = rec.customer ?? rec.CustomerName ?? rec.name ?? 'Unknown';
      const over90 = rec.over_90 ?? rec['over90'] ?? rec.days_90 ?? 0;
      const total = rec.total ?? rec.balance ?? rec.amount ?? 0;
      return { name, over90, total };
    })
    .filter((r) => r.over90 > 100_000)
    .sort((a, b) => b.over90 - a.over90);

  // Top 10 overdue overall
  const topOverdue = arData
    .map((rec) => {
      const name = rec.customer ?? rec.CustomerName ?? rec.name ?? 'Unknown';
      const total = rec.total ?? rec.balance ?? rec.amount ?? 0;
      const current = rec.current ?? 0;
      const overdue = total - current;
      return { name, total, overdue };
    })
    .filter((r) => r.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 10);

  let flaggedRows = '';
  if (flagged.length > 0) {
    flagged.forEach((rec, i) => {
      flaggedRows += tableRow(
        [
          { text: rec.name },
          { text: formatCurrency(rec.over90), align: 'right', color: '#dc2626' },
          { text: formatCurrency(rec.total), align: 'right' },
        ],
        i % 2 === 0
      );
    });
  } else {
    flaggedRows = `<tr><td colspan="3" style="padding:12px;text-align:center;color:#16a34a;font-size:13px;">No customers exceed $100K in 90+ days.</td></tr>`;
  }

  let overdueRows = '';
  if (topOverdue.length > 0) {
    topOverdue.forEach((rec, i) => {
      overdueRows += tableRow(
        [
          { text: rec.name },
          { text: formatCurrency(rec.overdue), align: 'right', color: '#ca8a04' },
          { text: formatCurrency(rec.total), align: 'right' },
        ],
        i % 2 === 0
      );
    });
  } else {
    overdueRows = `<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;font-size:13px;">No AR data available. Gateway may be offline.</td></tr>`;
  }

  const body = `
    <p style="margin:0 0 8px;font-size:14px;color:#666;">${escapeHtml(dateStr)}</p>
    <h1 style="margin:0 0 24px;font-size:22px;color:${BRAND_BLACK};">Daily AR Aging Alert</h1>

    ${sectionTitle('90+ Day Balances Over $100K')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Customer', '90+ Balance', 'Total AR'])}
      ${flaggedRows}
    </table>

    ${sectionTitle('Top 10 Overdue Accounts')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Customer', 'Overdue', 'Total AR'])}
      ${overdueRows}
    </table>
  `;

  return { subject, html: wrapHtml(subject, body) };
}

async function generateWeeklyPipeline(): Promise<DigestOutput> {
  const now = new Date();
  const weekStr = `Week of ${now.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`;
  const subject = `Weekly Pipeline Summary - ${weekStr}`;

  // Pull opportunity data from Salesforce
  const pipelineResponse = await gatewayGet(
    '/salesforce/query?q=' +
      encodeURIComponent(
        'SELECT StageName, COUNT(Id) cnt, SUM(Amount) total FROM Opportunity WHERE IsClosed = false GROUP BY StageName ORDER BY SUM(Amount) DESC'
      ),
    'admin'
  );

  // New opps this week
  const newOppsResponse = await gatewayGet(
    '/salesforce/query?q=' +
      encodeURIComponent(
        'SELECT Name, Amount, StageName, Owner.Name FROM Opportunity WHERE CreatedDate = THIS_WEEK ORDER BY Amount DESC LIMIT 10'
      ),
    'admin'
  );

  // Closed this week
  const closedResponse = await gatewayGet(
    '/salesforce/query?q=' +
      encodeURIComponent(
        "SELECT Name, Amount, StageName FROM Opportunity WHERE CloseDate = THIS_WEEK AND IsClosed = true ORDER BY Amount DESC LIMIT 10"
      ),
    'admin'
  );

  interface PipelineRecord {
    StageName?: string;
    cnt?: number;
    expr0?: number;
    total?: number;
    expr1?: number;
  }

  interface OppRecord {
    Name?: string;
    Amount?: number;
    StageName?: string;
    Owner?: { Name?: string };
    'Owner.Name'?: string;
  }

  const stages = (
    pipelineResponse.success && pipelineResponse.data
      ? (pipelineResponse.data as { records?: PipelineRecord[] }).records ?? []
      : []
  ) as PipelineRecord[];

  const newOpps = (
    newOppsResponse.success && newOppsResponse.data
      ? (newOppsResponse.data as { records?: OppRecord[] }).records ?? []
      : []
  ) as OppRecord[];

  const closedOpps = (
    closedResponse.success && closedResponse.data
      ? (closedResponse.data as { records?: OppRecord[] }).records ?? []
      : []
  ) as OppRecord[];

  // Weighted pipeline value (simple weights by stage)
  const STAGE_WEIGHTS: Record<string, number> = {
    'Prospecting': 0.10,
    'Qualification': 0.25,
    'Needs Analysis': 0.40,
    'Proposal/Price Quote': 0.60,
    'Negotiation/Review': 0.80,
    'Closed Won': 1.00,
  };

  let stageRows = '';
  let totalPipeline = 0;
  let totalWeighted = 0;
  if (stages.length > 0) {
    stages.forEach((rec, i) => {
      const stage = rec.StageName ?? 'Unknown';
      const count = rec.cnt ?? rec.expr0 ?? 0;
      const amount = rec.total ?? rec.expr1 ?? 0;
      const weight = STAGE_WEIGHTS[stage] ?? 0.50;
      const weighted = amount * weight;
      totalPipeline += amount;
      totalWeighted += weighted;
      stageRows += tableRow(
        [
          { text: stage },
          { text: String(count), align: 'right' },
          { text: formatCurrency(amount), align: 'right' },
          { text: `${Math.round(weight * 100)}%`, align: 'right' },
          { text: formatCurrency(weighted), align: 'right' },
        ],
        i % 2 === 0
      );
    });
    // Totals row
    stageRows += `<tr style="font-weight:600;"><td style="padding:8px 12px;border-top:2px solid ${BRAND_ORANGE};">Total</td><td style="padding:8px 12px;border-top:2px solid ${BRAND_ORANGE};"></td><td style="padding:8px 12px;text-align:right;border-top:2px solid ${BRAND_ORANGE};">${formatCurrency(totalPipeline)}</td><td style="padding:8px 12px;border-top:2px solid ${BRAND_ORANGE};"></td><td style="padding:8px 12px;text-align:right;border-top:2px solid ${BRAND_ORANGE};">${formatCurrency(totalWeighted)}</td></tr>`;
  } else {
    stageRows = `<tr><td colspan="5" style="padding:16px;text-align:center;color:#999;font-size:13px;">No pipeline data available.</td></tr>`;
  }

  let newOppRows = '';
  if (newOpps.length > 0) {
    newOpps.forEach((rec, i) => {
      const name = rec.Name ?? 'Unnamed';
      const amount = typeof rec.Amount === 'number' ? rec.Amount : 0;
      const stage = rec.StageName ?? '-';
      const owner = rec['Owner.Name'] ?? rec.Owner?.Name ?? '-';
      newOppRows += tableRow(
        [
          { text: name },
          { text: formatCurrency(amount), align: 'right' },
          { text: stage },
          { text: owner },
        ],
        i % 2 === 0
      );
    });
  } else {
    newOppRows = `<tr><td colspan="4" style="padding:12px;text-align:center;color:#999;font-size:13px;">No new opportunities this week.</td></tr>`;
  }

  let closedRows = '';
  if (closedOpps.length > 0) {
    closedOpps.forEach((rec, i) => {
      const name = rec.Name ?? 'Unnamed';
      const amount = typeof rec.Amount === 'number' ? rec.Amount : 0;
      const stage = rec.StageName ?? '-';
      const isWon = stage.toLowerCase().includes('won');
      closedRows += tableRow(
        [
          { text: name },
          { text: formatCurrency(amount), align: 'right' },
          { text: stage, color: isWon ? '#16a34a' : '#dc2626' },
        ],
        i % 2 === 0
      );
    });
  } else {
    closedRows = `<tr><td colspan="3" style="padding:12px;text-align:center;color:#999;font-size:13px;">No deals closed this week.</td></tr>`;
  }

  const body = `
    <p style="margin:0 0 8px;font-size:14px;color:#666;">${escapeHtml(weekStr)}</p>
    <h1 style="margin:0 0 24px;font-size:22px;color:${BRAND_BLACK};">Weekly Pipeline Summary</h1>

    ${sectionTitle('Pipeline by Stage (Weighted)')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Stage', 'Deals', 'Value', 'Weight', 'Weighted'])}
      ${stageRows}
    </table>

    ${sectionTitle('New Opportunities This Week')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Opportunity', 'Amount', 'Stage', 'Owner'])}
      ${newOppRows}
    </table>

    ${sectionTitle('Closed This Week')}
    <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
      ${tableHeader(['Opportunity', 'Amount', 'Result'])}
      ${closedRows}
    </table>
  `;

  return { subject, html: wrapHtml(subject, body) };
}

async function generateDailyFleet(): Promise<DigestOutput> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `Daily Fleet Status - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;

  // Pull fleet data
  const fleetResponse = await gatewayGet('/samsara/fleet/vehicles', 'admin');

  interface VehicleRecord {
    name?: string;
    status?: string;
    engineState?: string;
    location?: string;
  }

  const vehicles = (
    fleetResponse.success && fleetResponse.data
      ? Array.isArray(fleetResponse.data)
        ? (fleetResponse.data as VehicleRecord[])
        : (fleetResponse.data as { vehicles?: VehicleRecord[] }).vehicles ?? []
      : []
  ) as VehicleRecord[];

  const activeCount = vehicles.filter((v) => v.engineState === 'On' || v.status === 'active').length;
  const totalCount = vehicles.length;

  const body = `
    <p style="margin:0 0 8px;font-size:14px;color:#666;">${escapeHtml(dateStr)}</p>
    <h1 style="margin:0 0 24px;font-size:22px;color:${BRAND_BLACK};">Daily Fleet Status</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>
        <td width="50%" style="padding:16px;background:#f9fafb;border-radius:6px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:${BRAND_ORANGE};">${totalCount}</div>
          <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Total Vehicles</div>
        </td>
        <td width="16"></td>
        <td width="50%" style="padding:16px;background:#f9fafb;border-radius:6px;text-align:center;">
          <div style="font-size:32px;font-weight:700;color:#16a34a;">${activeCount}</div>
          <div style="font-size:12px;color:#666;text-transform:uppercase;letter-spacing:0.5px;">Active Now</div>
        </td>
      </tr>
    </table>

    ${totalCount === 0 ? '<p style="text-align:center;color:#999;font-size:13px;">No fleet data available. Samsara integration may need API key refresh.</p>' : ''}
  `;

  return { subject, html: wrapHtml(subject, body) };
}

async function generateDailyExecutive(): Promise<DigestOutput> {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
  const subject = `Executive Briefing - ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  const year = now.getFullYear();

  // Pull live data from the daily digest module
  const { generateDigest } = await import('@/lib/daily-digest');
  const digest = await generateDigest('admin');

  // Build sections from live digest data
  const sectionBlocks = digest.sections.map((section) => {
    const rows = section.items.map((item, i) => {
      const trendIcon = item.trend === 'up' ? '▲' : item.trend === 'down' ? '▼' : '–';
      const trendColor = item.trend === 'up' ? '#16a34a' : item.trend === 'down' ? '#dc2626' : '#999';
      return tableRow(
        [
          { text: item.label },
          { text: item.value, align: 'right' },
          { text: trendIcon, align: 'center', color: trendColor },
        ],
        i % 2 === 0
      );
    }).join('');

    return `
      ${sectionTitle(section.title)}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${tableHeader(['Metric', 'Value', 'Trend'])}
        ${rows}
      </table>
    `;
  }).join('');

  // Highlights
  const highlightBlocks = digest.highlights.map((h) => {
    const colors: Record<string, string> = { orange: BRAND_ORANGE, green: '#16a34a', red: '#dc2626', blue: '#3B82F6', yellow: '#EAB308' };
    const color = colors[h.color] ?? '#999';
    return `
      <td width="33%" style="padding:12px;vertical-align:top;">
        <div style="border-left:3px solid ${color};padding-left:12px;">
          <div style="font-size:13px;font-weight:600;color:${BRAND_BLACK};">${escapeHtml(h.title)}</div>
          <div style="font-size:12px;color:#666;margin-top:4px;">${escapeHtml(h.detail)}</div>
        </div>
      </td>
    `;
  }).join('');

  // Anomalies
  let anomalyBlock = '';
  if (digest.anomalies.length > 0) {
    const anomalyRows = digest.anomalies.map((a, i) => {
      const sevColor = a.severity === 'critical' ? '#dc2626' : a.severity === 'warning' ? '#ca8a04' : '#3B82F6';
      return tableRow(
        [
          { text: a.severity.toUpperCase(), color: sevColor },
          { text: a.metric },
          { text: a.description },
        ],
        i % 2 === 0
      );
    }).join('');

    anomalyBlock = `
      ${sectionTitle('Detected Anomalies')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
        ${tableHeader(['Severity', 'Metric', 'Description'])}
        ${anomalyRows}
      </table>
    `;
  }

  const body = `
    <p style="margin:0 0 8px;font-size:14px;color:#666;">${escapeHtml(dateStr)}</p>
    <h1 style="margin:0 0 24px;font-size:22px;color:${BRAND_BLACK};">Executive Daily Briefing</h1>

    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:24px;">
      <tr>${highlightBlocks}</tr>
    </table>

    ${anomalyBlock}
    ${sectionBlocks}

    <p style="margin:24px 0 0;font-size:11px;color:#999;text-align:center;">
      Data sourced live from Ascend GL, Salesforce, and Samsara at ${now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}.
    </p>
  `;

  return { subject, html: wrapHtml(subject, body) };
}

// ── Generator Dispatch ────────────────────────────────────────

const GENERATORS: Record<DigestType, () => Promise<DigestOutput>> = {
  weekly_kpi: generateWeeklyKPI,
  daily_ar: generateDailyAR,
  weekly_pipeline: generateWeeklyPipeline,
  daily_fleet: generateDailyFleet,
  daily_executive: generateDailyExecutive,
};

export async function generateDigestEmail(type: DigestType): Promise<DigestOutput> {
  const generator = GENERATORS[type];
  if (!generator) {
    throw new Error(`Unknown digest type: ${type}`);
  }
  return generator();
}

// ── Email Sending ─────────────────────────────────────────────

const SENDER_EMAIL = process.env.DIGEST_SENDER_EMAIL ?? 'etheiss@delta360.energy';

async function sendDigestEmail(
  recipients: string[],
  subject: string,
  htmlBody: string
): Promise<{ success: boolean; error?: string }> {
  // Build the Graph API sendMail payload
  const mailPayload = {
    message: {
      subject,
      body: {
        contentType: 'HTML',
        content: htmlBody,
      },
      toRecipients: recipients.map((email) => ({
        emailAddress: { address: email },
      })),
      from: {
        emailAddress: { address: SENDER_EMAIL },
      },
    },
    saveToSentItems: true,
  };

  try {
    const response = await gatewayPost(
      '/microsoft/write?path=/me/sendMail',
      'admin',
      mailPayload
    );

    if (!response.success) {
      return { success: false, error: response.error ?? 'Gateway sendMail failed' };
    }
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Email send failed',
    };
  }
}

// ── Public: Send a Digest Now ─────────────────────────────────

export async function sendDigest(digestId: string): Promise<DigestResult> {
  const configs = loadDigestConfigs();
  const config = configs.find((c) => c.id === digestId);
  if (!config) {
    return {
      digestId,
      type: 'weekly_kpi',
      subject: '',
      recipientCount: 0,
      sentAt: new Date().toISOString(),
      status: 'error',
      error: `Digest config not found: ${digestId}`,
    };
  }

  try {
    const output = await generateDigestEmail(config.type);
    const sendResult = await sendDigestEmail(config.recipients, output.subject, output.html);

    const result: DigestResult = {
      digestId: config.id,
      type: config.type,
      subject: output.subject,
      recipientCount: config.recipients.length,
      sentAt: new Date().toISOString(),
      status: sendResult.success ? 'sent' : 'error',
      error: sendResult.error,
    };

    appendDigestLog(result);

    // Update lastSentAt
    if (sendResult.success) {
      const allConfigs = loadDigestConfigs();
      const idx = allConfigs.findIndex((c) => c.id === digestId);
      if (idx !== -1) {
        const updated = [...allConfigs];
        updated[idx] = { ...updated[idx], lastSentAt: new Date().toISOString() };
        saveDigestConfigs(updated);
      }
    }

    return result;
  } catch (err) {
    const result: DigestResult = {
      digestId: config.id,
      type: config.type,
      subject: '',
      recipientCount: config.recipients.length,
      sentAt: new Date().toISOString(),
      status: 'error',
      error: err instanceof Error ? err.message : 'Unknown error generating digest',
    };
    appendDigestLog(result);
    return result;
  }
}

// ── Public: Update Config ─────────────────────────────────────

export function updateDigestConfig(
  digestId: string,
  updates: Partial<Pick<DigestConfig, 'enabled' | 'recipients' | 'schedule'>>
): DigestConfig | null {
  const configs = loadDigestConfigs();
  const idx = configs.findIndex((c) => c.id === digestId);
  if (idx === -1) return null;

  const updated = [...configs];
  updated[idx] = { ...updated[idx], ...updates };
  saveDigestConfigs(updated);
  return updated[idx];
}

// ── Cron Integration: Check Due Digests ───────────────────────

export async function checkDueDigests(): Promise<number> {
  const now = new Date();
  const configs = loadDigestConfigs();
  const enabled = configs.filter((c) => c.enabled);

  let sent = 0;

  for (const config of enabled) {
    if (!cronMatches(config.schedule, now)) continue;

    console.info(`[email-digest] Sending scheduled digest: ${config.name}`);
    const result = await sendDigest(config.id);

    if (result.status === 'sent') {
      sent += 1;
      console.info(`[email-digest] Sent: ${config.name} to ${config.recipients.join(', ')}`);
    } else {
      console.error(`[email-digest] Failed: ${config.name} - ${result.error}`);
    }
  }

  return sent;
}
