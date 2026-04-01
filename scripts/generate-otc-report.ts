/**
 * Generate OTC Flash Report PDF
 *
 * Usage: npx tsx scripts/generate-otc-report.ts [weekendEnding]
 * Example: npx tsx scripts/generate-otc-report.ts 2026-03-31
 *
 * Seeds from the flash report data if no snapshots exist,
 * then generates a branded PDF to ~/Downloads/
 */

import { writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import {
  seedFromFlashReport,
  getLatestSnapshot,
  formatOTCMarkdownReport,
  getOTCStats,
} from '../src/lib/engines/order-to-cash';

async function main() {
  const weekendEnding = process.argv[2] ?? '2026-03-31';

  // Seed if needed
  let snapshot = getLatestSnapshot();
  if (!snapshot) {
    console.log('No existing snapshots — seeding from 3/31/2026 flash report...');
    snapshot = seedFromFlashReport();
  }

  const stats = getOTCStats(snapshot);
  const markdown = formatOTCMarkdownReport(snapshot);

  // Generate HTML for PDF
  const wow = stats.weekOverWeekChange;
  const fmtChange = (n: number) => (n > 0 ? `+${n}` : `${n}`);

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
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
</style>
</head>
<body>

<div class="header">
  <div>
    <h1>Order To Cash Progress Report</h1>
    <div class="date">Weekend Ending: ${snapshot.weekendEnding}</div>
  </div>
  <div style="font-size: 9pt; text-align: right;">
    <div style="color: #FE5000; font-weight: bold;">DELTA 360</div>
    <div style="color: #999;">Delta Intelligence</div>
  </div>
</div>
<div class="orange-bar"></div>

<!-- KPIs -->
<div class="kpi-row">
  <div class="kpi">
    <div class="value">${stats.totalOrdersPendingInvoice.toLocaleString()}</div>
    <div class="label">Pending Invoice</div>
    ${wow ? `<div class="change ${wow.pendingInvoice > 0 ? 'positive' : 'negative'}">${fmtChange(wow.pendingInvoice)} WoW</div>` : ''}
  </div>
  <div class="kpi">
    <div class="value">${stats.totalBOLUnresolved.toLocaleString()}</div>
    <div class="label">BOL Unresolved</div>
    ${wow ? `<div class="change ${wow.bolUnresolved > 0 ? 'positive' : 'negative'}">${fmtChange(wow.bolUnresolved)} WoW</div>` : ''}
  </div>
  <div class="kpi">
    <div class="value">${stats.totalMissingLoads.toLocaleString()}</div>
    <div class="label">Missing Loads</div>
    ${wow ? `<div class="change ${wow.missingLoads > 0 ? 'positive' : 'negative'}">${fmtChange(wow.missingLoads)} WoW</div>` : ''}
  </div>
  <div class="kpi">
    <div class="value">${stats.totalPendingRigStamps.toLocaleString()}</div>
    <div class="label">Pending Rig Stamps</div>
  </div>
  <div class="kpi">
    <div class="value">${stats.totalOpenInternalOrders.toLocaleString()}</div>
    <div class="label">Open Internal</div>
  </div>
</div>

<!-- Order Counts -->
<div class="section">
  <h2>Order Counts</h2>
  <table>
    <tr><th>Month</th><th>Orders (Sales)</th></tr>
    <tr><td>January</td><td>${snapshot.orderCounts.january.toLocaleString()}</td></tr>
    <tr><td>February</td><td>${snapshot.orderCounts.february.toLocaleString()}</td></tr>
    <tr><td>March</td><td>${snapshot.orderCounts.march.toLocaleString()}</td></tr>
  </table>
</div>

<!-- Unbilled Orders by Month -->
${(snapshot.unbilledByMonth ?? []).map(m => `
<div class="section">
  <h2>${m.month} — Unbilled Orders</h2>
  <table>
    <tr><th>Category</th><th>Total</th><th>Commercial/Industrial</th><th>Oil & Gas</th></tr>
    <tr><td>Dispatch</td><td>${m.dispatch.total}</td><td>${m.dispatch.commercialIndustrial}</td><td>${m.dispatch.oilAndGas}</td></tr>
    <tr><td>Dispatch — Contractors</td><td>${m.dispatchContractors.total}</td><td>${m.dispatchContractors.commercialIndustrial}</td><td>${m.dispatchContractors.oilAndGas}</td></tr>
    <tr><td>Billing</td><td>${m.billing.total}</td><td>${m.billing.commercialIndustrial}</td><td>${m.billing.oilAndGas}</td></tr>
    <tr><td>Billing — Contractors</td><td>${m.billingContractors.total}</td><td>${m.billingContractors.commercialIndustrial}</td><td>${m.billingContractors.oilAndGas}</td></tr>
    <tr class="total-row"><td>Orders Pending Invoice</td><td>${m.ordersPendingInvoice}</td><td></td><td class="pct">${m.ordersPendingInvoicePct}%</td></tr>
    <tr><td>Pending PO/Stamp/Pricing</td><td>${m.pendingPOStampPricing}</td><td></td><td>${m.pendingPOStampPricingPct}%</td></tr>
  </table>
  ${m.bolUnresolved.total > 0 ? `
  <h3>BOL — Unresolved</h3>
  <table>
    <tr><th>Type</th><th>Count</th></tr>
    <tr><td>Contractors</td><td>${m.bolUnresolved.contractors}</td></tr>
    <tr><td>Non-Contractors</td><td>${m.bolUnresolved.nonContractors}</td></tr>
    <tr class="total-row"><td>Total</td><td>${m.bolUnresolved.total}</td></tr>
  </table>
  ` : ''}
</div>
`).join('')}

<!-- Bottom Grid -->
<div class="grid-3">
  <div class="mini-table">
    <h4>Open Internal Orders</h4>
    ${(snapshot.openInternalOrders ?? []).map(o => `<div class="row"><span>${o.month}</span><span>${o.count}</span></div>`).join('')}
    <div class="row total"><span>Total</span><span>${snapshot.openInternalOrdersTotal}</span></div>
  </div>
  <div class="mini-table">
    <h4>Pending Rig Stamps/POs</h4>
    ${(snapshot.pendingRigStamps ?? []).map(r => `<div class="row"><span>${r.month}</span><span>${r.count}</span></div>`).join('')}
    <div class="row total"><span>Total</span><span>${snapshot.pendingRigStampsTotal}</span></div>
  </div>
  <div class="mini-table">
    <h4>Missing Loads — Open</h4>
    ${(snapshot.missingLoads ?? []).map(m => `<div class="row"><span>${m.month}</span><span>${m.count}</span></div>`).join('')}
    <div class="row total"><span>Total</span><span>${snapshot.missingLoadsTotal}</span></div>
  </div>
</div>

<div class="footer">
  <span>Delta Intelligence — Order-to-Cash Automation Engine</span>
  <span>Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</span>
</div>

</body>
</html>`;

  // Write HTML
  const htmlPath = join(homedir(), 'Downloads', `OTC_Flash_Report_${snapshot.weekendEnding}.html`);
  writeFileSync(htmlPath, html, 'utf-8');
  console.log(`HTML report saved: ${htmlPath}`);

  // Also save the markdown version
  const mdPath = join(homedir(), 'Downloads', `OTC_Flash_Report_${snapshot.weekendEnding}.md`);
  writeFileSync(mdPath, markdown, 'utf-8');
  console.log(`Markdown report saved: ${mdPath}`);

  // Print summary
  console.log('\n--- OTC Summary ---');
  console.log(`Orders Pending Invoice: ${stats.totalOrdersPendingInvoice}`);
  console.log(`BOL Unresolved: ${stats.totalBOLUnresolved}`);
  console.log(`Missing Loads: ${stats.totalMissingLoads}`);
  console.log(`Pending Rig Stamps: ${stats.totalPendingRigStamps}`);
  console.log(`Open Internal Orders: ${stats.totalOpenInternalOrders}`);
}

main().catch(console.error);
