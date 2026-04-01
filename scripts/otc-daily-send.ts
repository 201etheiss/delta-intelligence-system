/**
 * OTC Daily Send Pipeline — Tony Johnson
 *
 * Full verified pipeline:
 * 1. Verify gateway + Ascend connectivity
 * 2. Pull live OTC data from Ascend
 * 3. Validate snapshot (non-zero order counts)
 * 4. Generate branded HTML report
 * 5. Convert to PDF via puppeteer
 * 6. Verify PDF exists and is > 50KB
 * 7. Base64-encode and attach to email
 * 8. Send via MS Graph with correct signature (Delta360, NOT Delta360 Energy)
 * 9. Save to Sent Items
 *
 * Usage: npx tsx scripts/otc-daily-send.ts [--dry-run]
 */

import { readFileSync, writeFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';
// Types inlined — the engine runs inside Next.js, we call it via HTTP API
interface OTCSnapshot {
  id: string;
  weekendEnding: string;
  generatedAt: string;
  orderCounts: { january: number; february: number; march: number };
  unbilledByMonth: Array<{
    month: string;
    dispatch: { total: number; commercialIndustrial: number; oilAndGas: number };
    dispatchContractors: { total: number; commercialIndustrial: number; oilAndGas: number };
    billing: { total: number; commercialIndustrial: number; oilAndGas: number };
    billingContractors: { total: number; commercialIndustrial: number; oilAndGas: number };
    ordersPendingInvoice: number;
    ordersPendingInvoicePct: number;
    pendingPOStampPricing: number;
    pendingPOStampPricingPct: number;
    bolUnresolved: { contractors: number; nonContractors: number; total: number };
  }>;
  openInternalOrders: Array<{ month: string; count: number }>;
  openInternalOrdersTotal: number;
  pendingRigStamps: Array<{ month: string; count: number }>;
  pendingRigStampsTotal: number;
  missingLoads: Array<{ month: string; count: number }>;
  missingLoadsTotal: number;
}

interface OTCStats {
  totalOrdersPendingInvoice: number;
  totalUnbilledOrders: number;
  totalBOLUnresolved: number;
  totalMissingLoads: number;
  totalPendingRigStamps: number;
  totalOpenInternalOrders: number;
  weekOverWeekChange: { pendingInvoice: number; bolUnresolved: number; missingLoads: number } | null;
}

const DI_APP = process.env.DI_APP_URL ?? 'http://127.0.0.1:3004';

const GATEWAY = process.env.GATEWAY_BASE_URL ?? 'http://127.0.0.1:3847';
const ADMIN_KEY = 'df360-admin-c67f1da4ddb3bb32aa4fde80';
const DRY_RUN = process.argv.includes('--dry-run');
const DOWNLOADS = join(process.env.HOME ?? '/tmp', 'Downloads');

function log(step: string, msg: string) {
  const ts = new Date().toLocaleTimeString('en-US', { hour12: false });
  console.log(`[${ts}] [${step}] ${msg}`);
}

function fail(step: string, msg: string): never {
  log(step, `FAILED: ${msg}`);
  process.exit(1);
}

// ── Step 1: Verify Gateway + Ascend ─────────────────────────

async function verifyConnectivity(): Promise<void> {
  log('1-VERIFY', 'Checking gateway + Ascend connectivity...');

  try {
    const res = await fetch(`${GATEWAY}/ascend/query`, {
      method: 'POST',
      headers: { 'x-api-key': ADMIN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sql: 'SELECT TOP 1 Name FROM Address' }),
    });
    const data = await res.json() as { success: boolean; data?: unknown[] };
    if (!data.success || !data.data?.length) {
      fail('1-VERIFY', 'Ascend query returned no data');
    }
    log('1-VERIFY', 'Gateway + Ascend connected');
  } catch (err) {
    fail('1-VERIFY', `Gateway unreachable: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── Step 2-3: Generate + Validate Snapshot ──────────────────

async function generateAndValidate(): Promise<{ snapshot: OTCSnapshot; stats: OTCStats }> {
  log('2-GENERATE', 'Pulling live OTC data from Ascend via DI API...');

  const today = new Date().toISOString().slice(0, 10);
  const res = await fetch(`${DI_APP}/api/otc`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'generate', weekendEnding: today }),
  });
  const json = await res.json() as { success: boolean; data?: { snapshot: OTCSnapshot; stats: OTCStats }; error?: string };
  if (!json.success || !json.data) {
    fail('2-GENERATE', `API error: ${json.error ?? 'no data returned'}`);
  }

  const { snapshot, stats } = json.data;
  log('2-GENERATE', `Snapshot ${snapshot.id} generated`);

  log('3-VALIDATE', 'Validating snapshot data...');
  const { january, february, march } = snapshot.orderCounts;
  if (january === 0 && february === 0 && march === 0) {
    fail('3-VALIDATE', 'All order counts are zero — Ascend data may be stale');
  }

  log('3-VALIDATE', `Orders Pending: ${stats.totalOrdersPendingInvoice} | BOL: ${stats.totalBOLUnresolved} | Internal: ${stats.totalOpenInternalOrders}`);

  return { snapshot, stats };
}

// ── Step 4-6: Generate HTML + PDF + Verify ──────────────────

function generatePDF(snapshot: OTCSnapshot, stats: OTCStats): string {
  log('4-HTML', 'Building branded HTML report...');

  const html = buildHTML(snapshot, stats);
  const htmlPath = join(DOWNLOADS, `OTC_Flash_Report_${snapshot.weekendEnding}.html`);
  writeFileSync(htmlPath, html, 'utf-8');
  log('4-HTML', `HTML saved: ${htmlPath}`);

  log('5-PDF', 'Converting to PDF via puppeteer...');
  const pdfPath = join(DOWNLOADS, `OTC_Flash_Report_${snapshot.weekendEnding}.pdf`);

  const puppeteerScript = `
    const puppeteer = require('puppeteer');
    (async () => {
      const browser = await puppeteer.launch({ headless: 'new' });
      const page = await browser.newPage();
      await page.goto(process.argv[1], { waitUntil: 'networkidle0' });
      await page.pdf({
        path: process.argv[2],
        format: 'Letter',
        printBackground: true,
        margin: { top: '0.5in', right: '0.5in', bottom: '0.5in', left: '0.5in' }
      });
      await browser.close();
    })();
  `;

  try {
    execFileSync('node', ['-e', puppeteerScript, `file://${htmlPath}`, pdfPath], { timeout: 30000 });
  } catch (err) {
    fail('5-PDF', `Puppeteer failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  log('6-VERIFY-PDF', 'Verifying PDF...');
  if (!existsSync(pdfPath)) {
    fail('6-VERIFY-PDF', 'PDF file does not exist');
  }
  const size = statSync(pdfPath).size;
  if (size < 50000) {
    fail('6-VERIFY-PDF', `PDF too small (${size} bytes) — likely corrupt`);
  }
  log('6-VERIFY-PDF', `PDF verified: ${(size / 1024).toFixed(0)}KB`);

  return pdfPath;
}

// ── Step 7-9: Encode + Send Email ───────────────────────────

async function sendEmail(pdfPath: string, snapshot: OTCSnapshot, stats: OTCStats): Promise<void> {
  log('7-ENCODE', 'Base64-encoding PDF...');
  const pdfBytes = readFileSync(pdfPath);
  const pdfB64 = pdfBytes.toString('base64');
  log('7-ENCODE', `Encoded ${(pdfB64.length / 1024).toFixed(0)}KB`);

  if (DRY_RUN) {
    log('8-SEND', 'DRY RUN — skipping email send');
    log('DONE', 'Pipeline complete (dry run)');
    return;
  }

  log('8-SEND', 'Sending to tjohnson@delta360.energy via MS Graph...');
  const today = new Date().toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });

  const emailBody = {
    path: '/users/etheiss@delta360.energy/sendMail',
    body: {
      message: {
        subject: `Daily OTC Flash Report — ${snapshot.weekendEnding}`,
        body: {
          contentType: 'HTML',
          content: `<div style="font-family: Georgia, serif; color: #1a1a1a;">
<p>Good morning Tony,</p>
<p>Attached is today's Order-to-Cash progress report pulled live from Ascend.</p>
<p><b>Key Metrics (${today}):</b></p>
<ul>
<li><b>Orders Pending Invoice:</b> ${stats.totalOrdersPendingInvoice.toLocaleString()}</li>
<li><b>Open Internal Orders:</b> ${stats.totalOpenInternalOrders.toLocaleString()}</li>
<li><b>Pending Rig Stamps/POs:</b> ${stats.totalPendingRigStamps.toLocaleString()}</li>
<li><b>Order Counts:</b> Jan ${snapshot.orderCounts.january.toLocaleString()} / Feb ${snapshot.orderCounts.february.toLocaleString()} / Mar ${snapshot.orderCounts.march.toLocaleString()}</li>
</ul>
<p>The full PDF report is attached.</p>
<p>Best,<br>Evan Theiss<br>Delta360</p>
</div>`,
        },
        toRecipients: [
          { emailAddress: { address: 'tjohnson@delta360.energy', name: 'Tony Johnson' } },
        ],
        attachments: [
          {
            '@odata.type': '#microsoft.graph.fileAttachment',
            name: `OTC_Flash_Report_${snapshot.weekendEnding}.pdf`,
            contentType: 'application/pdf',
            contentBytes: pdfB64,
          },
        ],
      },
      saveToSentItems: true,
    },
  };

  try {
    const res = await fetch(`${GATEWAY}/microsoft/write`, {
      method: 'POST',
      headers: { 'x-api-key': ADMIN_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(emailBody),
    });
    const data = await res.json() as { success: boolean; status?: number; error?: string };
    if (!data.success) {
      fail('8-SEND', `MS Graph error: ${data.error ?? 'unknown'}`);
    }
    log('8-SEND', `Email sent (status ${data.status ?? 202})`);
    log('9-SENT-ITEMS', 'Saved to Sent Items');
  } catch (err) {
    fail('8-SEND', `Send failed: ${err instanceof Error ? err.message : String(err)}`);
  }
}

// ── HTML Builder ────────────────────────────────────────────

function buildHTML(snapshot: OTCSnapshot, stats: OTCStats): string {
  const wow = stats.weekOverWeekChange;
  const fmtChange = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8">
<title>Order To Cash Progress Report — ${snapshot.weekendEnding}</title>
<style>
  @page { size: letter; margin: 0.75in; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', Georgia, serif; color: #1a1a1a; font-size: 11pt; line-height: 1.4; }
  .header { background: #000; color: #fff; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
  .header h1 { font-family: Georgia, serif; font-size: 18pt; font-weight: bold; }
  .header .date { font-size: 10pt; color: #ccc; }
  .orange-bar { height: 4px; background: #FE5000; margin-bottom: 16px; }
  .section { margin-bottom: 16px; }
  .section h2 { font-family: Georgia, serif; font-size: 13pt; color: #000; border-bottom: 2px solid #FE5000; padding-bottom: 4px; margin-bottom: 8px; }
  .section h3 { font-family: Georgia, serif; font-size: 11pt; color: #333; margin-bottom: 6px; }
  .kpi-row { display: flex; gap: 12px; margin-bottom: 16px; flex-wrap: wrap; }
  .kpi { flex: 1; min-width: 120px; border: 1px solid #ddd; border-radius: 4px; padding: 10px; text-align: center; }
  .kpi .value { font-size: 20pt; font-weight: bold; color: #000; }
  .kpi .label { font-size: 8pt; text-transform: uppercase; color: #666; letter-spacing: 0.5px; }
  .kpi .change { font-size: 8pt; margin-top: 2px; }
  .kpi .change.positive { color: #dc2626; }
  .kpi .change.negative { color: #16a34a; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 12px; font-size: 10pt; }
  th { background: #f5f5f5; text-align: left; padding: 6px 8px; font-weight: bold; border: 1px solid #ddd; }
  td { padding: 5px 8px; border: 1px solid #ddd; }
  tr:nth-child(even) { background: #fafafa; }
  .total-row { font-weight: bold; background: #f0f0f0 !important; }
  .pct { color: #FE5000; font-weight: bold; }
  .footer { margin-top: 24px; padding-top: 12px; border-top: 2px solid #000; font-size: 8pt; color: #666; display: flex; justify-content: space-between; }
  .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 16px; }
  .mini-table { border: 1px solid #ddd; border-radius: 4px; overflow: hidden; }
  .mini-table h4 { background: #f5f5f5; padding: 6px 8px; font-size: 9pt; text-transform: uppercase; color: #333; border-bottom: 1px solid #ddd; }
  .mini-table .row { display: flex; justify-content: space-between; padding: 4px 8px; font-size: 10pt; border-bottom: 1px solid #eee; }
  .mini-table .row:last-child { border-bottom: none; }
  .mini-table .row.total { font-weight: bold; background: #f0f0f0; color: #FE5000; }
</style></head><body>
<div class="header">
  <div><h1>Order To Cash Progress Report</h1><div class="date">Weekend Ending: ${snapshot.weekendEnding}</div></div>
  <div style="font-size: 9pt; text-align: right;"><div style="color: #FE5000; font-weight: bold;">DELTA 360</div><div style="color: #999;">Delta Intelligence</div></div>
</div>
<div class="orange-bar"></div>
<div class="kpi-row">
  <div class="kpi"><div class="value">${stats.totalOrdersPendingInvoice.toLocaleString()}</div><div class="label">Pending Invoice</div>${wow ? `<div class="change ${wow.pendingInvoice > 0 ? 'positive' : 'negative'}">${fmtChange(wow.pendingInvoice)} WoW</div>` : ''}</div>
  <div class="kpi"><div class="value">${stats.totalBOLUnresolved.toLocaleString()}</div><div class="label">BOL Unresolved</div>${wow ? `<div class="change ${wow.bolUnresolved > 0 ? 'positive' : 'negative'}">${fmtChange(wow.bolUnresolved)} WoW</div>` : ''}</div>
  <div class="kpi"><div class="value">${stats.totalMissingLoads.toLocaleString()}</div><div class="label">Missing Loads</div>${wow ? `<div class="change ${wow.missingLoads > 0 ? 'positive' : 'negative'}">${fmtChange(wow.missingLoads)} WoW</div>` : ''}</div>
  <div class="kpi"><div class="value">${stats.totalPendingRigStamps.toLocaleString()}</div><div class="label">Pending Rig Stamps</div></div>
  <div class="kpi"><div class="value">${stats.totalOpenInternalOrders.toLocaleString()}</div><div class="label">Open Internal</div></div>
</div>
<div class="section"><h2>Order Counts</h2>
<table><tr><th>Month</th><th>Orders (Sales)</th></tr>
<tr><td>January</td><td>${snapshot.orderCounts.january.toLocaleString()}</td></tr>
<tr><td>February</td><td>${snapshot.orderCounts.february.toLocaleString()}</td></tr>
<tr><td>March</td><td>${snapshot.orderCounts.march.toLocaleString()}</td></tr></table></div>
${(snapshot.unbilledByMonth ?? []).map(m => `
<div class="section"><h2>${m.month} — Unbilled Orders</h2>
<table><tr><th>Category</th><th>Total</th><th>Commercial/Industrial</th><th>Oil & Gas</th></tr>
<tr><td>Dispatch</td><td>${m.dispatch.total}</td><td>${m.dispatch.commercialIndustrial}</td><td>${m.dispatch.oilAndGas}</td></tr>
<tr><td>Dispatch — Contractors</td><td>${m.dispatchContractors.total}</td><td>${m.dispatchContractors.commercialIndustrial}</td><td>${m.dispatchContractors.oilAndGas}</td></tr>
<tr><td>Billing</td><td>${m.billing.total}</td><td>${m.billing.commercialIndustrial}</td><td>${m.billing.oilAndGas}</td></tr>
<tr><td>Billing — Contractors</td><td>${m.billingContractors.total}</td><td>${m.billingContractors.commercialIndustrial}</td><td>${m.billingContractors.oilAndGas}</td></tr>
<tr class="total-row"><td>Orders Pending Invoice</td><td>${m.ordersPendingInvoice}</td><td></td><td class="pct">${m.ordersPendingInvoicePct}%</td></tr>
<tr><td>Pending PO/Stamp/Pricing</td><td>${m.pendingPOStampPricing}</td><td></td><td>${m.pendingPOStampPricingPct}%</td></tr></table>
${m.bolUnresolved.total > 0 ? `<h3>BOL — Unresolved</h3><table><tr><th>Type</th><th>Count</th></tr><tr><td>Contractors</td><td>${m.bolUnresolved.contractors}</td></tr><tr><td>Non-Contractors</td><td>${m.bolUnresolved.nonContractors}</td></tr><tr class="total-row"><td>Total</td><td>${m.bolUnresolved.total}</td></tr></table>` : ''}
</div>`).join('')}
<div class="grid-3">
  <div class="mini-table"><h4>Open Internal Orders</h4>${(snapshot.openInternalOrders ?? []).map(o => `<div class="row"><span>${o.month}</span><span>${o.count}</span></div>`).join('')}<div class="row total"><span>Total</span><span>${snapshot.openInternalOrdersTotal}</span></div></div>
  <div class="mini-table"><h4>Pending Rig Stamps/POs</h4>${(snapshot.pendingRigStamps ?? []).map(r => `<div class="row"><span>${r.month}</span><span>${r.count}</span></div>`).join('')}<div class="row total"><span>Total</span><span>${snapshot.pendingRigStampsTotal}</span></div></div>
  <div class="mini-table"><h4>Missing Loads — Open</h4>${(snapshot.missingLoads ?? []).map(m => `<div class="row"><span>${m.month}</span><span>${m.count}</span></div>`).join('')}<div class="row total"><span>Total</span><span>${snapshot.missingLoadsTotal}</span></div></div>
</div>
<div class="footer"><span>Delta Intelligence — Order-to-Cash Automation Engine</span><span>Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span></div>
</body></html>`;
}

// ── Main ────────────────────────────────────────────────────

async function main() {
  log('START', `OTC Daily Pipeline ${DRY_RUN ? '(DRY RUN)' : ''}`);

  await verifyConnectivity();
  const { snapshot, stats } = await generateAndValidate();
  const pdfPath = generatePDF(snapshot, stats);
  await sendEmail(pdfPath, snapshot, stats);

  log('DONE', 'Pipeline complete');
}

main().catch(err => {
  console.error('Pipeline crashed:', err);
  process.exit(1);
});
