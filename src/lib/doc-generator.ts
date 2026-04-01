/**
 * Auto-Documentation Generator
 *
 * Generates and maintains process documentation from platform structure.
 * Produces data flow maps, API endpoint catalogs, integration specs,
 * workflow procedures, and verification reports.
 *
 * Generated docs are stored in data/generated-docs/ as JSON with markdown content.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { getAvailableGates, runAllGates } from './verification-gates';

// ── Types ────────────────────────────────────────────────────

export type DocCategory = 'workflow' | 'integration' | 'engine' | 'api' | 'data-flow';

export interface ProcessDoc {
  id: string;
  title: string;
  category: DocCategory;
  content: string; // markdown
  lastUpdated: string;
  generatedFrom: string;
  version: number;
}

interface DocRegistry {
  docs: ProcessDoc[];
  lastUpdated: string;
}

// ── File I/O ─────────────────────────────────────────────────

function getDocsDir(): string {
  if (process.env.NODE_ENV === 'production') {
    return '/tmp/generated-docs';
  }
  return join(process.cwd(), 'data', 'generated-docs');
}

function getRegistryPath(): string {
  return join(getDocsDir(), '_registry.json');
}

function ensureDocsDir(): void {
  const dir = getDocsDir();
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
}

function readRegistry(): DocRegistry {
  const regPath = getRegistryPath();
  if (!existsSync(regPath)) {
    return { docs: [], lastUpdated: new Date().toISOString() };
  }
  try {
    const raw = readFileSync(regPath, 'utf-8');
    const data = JSON.parse(raw) as DocRegistry;
    return { docs: data.docs ?? [], lastUpdated: data.lastUpdated ?? new Date().toISOString() };
  } catch {
    return { docs: [], lastUpdated: new Date().toISOString() };
  }
}

function writeRegistry(registry: DocRegistry): void {
  ensureDocsDir();
  const regPath = getRegistryPath();
  try {
    writeFileSync(regPath, JSON.stringify({ ...registry, lastUpdated: new Date().toISOString() }, null, 2));
  } catch {
    // Silent fail
  }
}

function generateId(): string {
  return `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function upsertDoc(registry: DocRegistry, doc: Omit<ProcessDoc, 'id' | 'version' | 'lastUpdated'>): DocRegistry {
  const existingIdx = registry.docs.findIndex(d => d.generatedFrom === doc.generatedFrom);
  const now = new Date().toISOString();

  if (existingIdx >= 0) {
    const existing = registry.docs[existingIdx];
    const updated: ProcessDoc = {
      ...existing,
      ...doc,
      id: existing.id,
      version: existing.version + 1,
      lastUpdated: now,
    };
    const newDocs = [...registry.docs];
    newDocs[existingIdx] = updated;
    return { ...registry, docs: newDocs };
  }

  const newDoc: ProcessDoc = {
    ...doc,
    id: generateId(),
    version: 1,
    lastUpdated: now,
  };
  return { ...registry, docs: [...registry.docs, newDoc] };
}

// ── Engine Documentation ─────────────────────────────────────

const ENGINE_DESCRIPTIONS: Record<string, { title: string; inputs: string; processing: string; outputs: string }> = {
  'journal-entry': {
    title: 'Journal Entry Engine',
    inputs: 'GL account codes, debit/credit amounts, period, memo, supporting documents',
    processing: 'Validates balanced entries (debits = credits), checks period status (open/closed), applies JE templates, enforces approval workflows',
    outputs: 'Posted GL transactions, audit trail entries, trial balance updates',
  },
  'general-ledger': {
    title: 'General Ledger Engine',
    inputs: 'Posted journal entries, account hierarchy, period definitions',
    processing: 'Aggregates transactions by account, computes running balances, generates trial balance, validates account classifications',
    outputs: 'Account balances, trial balance report, GL detail reports',
  },
  'reconciliation': {
    title: 'Reconciliation Engine',
    inputs: 'GL balances, bank statements, subledger totals, reconciliation rules',
    processing: 'Auto-matches transactions using rules, identifies exceptions, computes variances, tracks aging of open items',
    outputs: 'Reconciliation status per account, exception reports, aging analysis',
  },
  'cash-flow': {
    title: 'Cash Flow Engine',
    inputs: 'Bank balances, AR aging, AP aging, debt schedules, LOC facility data',
    processing: 'Projects cash position, calculates available borrowing, models payment scenarios, forecasts shortfalls',
    outputs: 'Cash flow forecasts, LOC utilization, liquidity analysis',
  },
  'close-management': {
    title: 'Close Management Engine',
    inputs: 'Close templates, task assignments, reconciliation status, JE posting status',
    processing: 'Orchestrates month-end close workflow, tracks task completion, validates pre-close checklist, enforces close sequence',
    outputs: 'Close status dashboard, task completion tracking, close timeline',
  },
  'financial-statements': {
    title: 'Financial Statements Engine',
    inputs: 'GL balances, account hierarchy, reporting period, prior period data',
    processing: 'Generates income statement, balance sheet, cash flow statement. Applies formatting rules, computes YoY variances',
    outputs: 'Formatted financial statements, variance analysis, period comparisons',
  },
  'ap-processing': {
    title: 'AP Processing Engine',
    inputs: 'Vendor invoices, PO data, approval workflows, payment terms',
    processing: 'Three-way match (PO, receipt, invoice), validates approval chain, schedules payments, tracks aging',
    outputs: 'AP aging report, payment schedule, vendor spend analysis',
  },
  'ar-collections': {
    title: 'AR Collections Engine',
    inputs: 'Customer invoices, payment receipts, credit terms, dunning rules',
    processing: 'Tracks receivables aging, generates dunning letters, applies cash receipts, flags delinquent accounts',
    outputs: 'AR aging report, collection actions, DSO metrics',
  },
  'fixed-assets': {
    title: 'Fixed Assets Engine',
    inputs: 'Asset register, depreciation schedules, disposal records',
    processing: 'Calculates depreciation (straight-line, MACRS), tracks asset lifecycle, generates depreciation JEs',
    outputs: 'Depreciation schedules, asset valuations, disposal gain/loss',
  },
  'inventory-margin': {
    title: 'Inventory & Margin Engine',
    inputs: 'Product costs, sales prices, delivery volumes, rack prices',
    processing: 'Calculates landed cost, computes margin by product/customer/location, tracks inventory turns',
    outputs: 'Margin analysis, inventory valuation, pricing recommendations',
  },
  'tax': {
    title: 'Tax Engine',
    inputs: 'Taxable transactions, jurisdiction rates, exemption certificates',
    processing: 'Applies tax rates by jurisdiction, tracks collections vs remittance, generates tax returns data',
    outputs: 'Tax liability by jurisdiction, filing summaries, exemption tracking',
  },
  'evidence-vault': {
    title: 'Evidence Vault Engine',
    inputs: 'Supporting documents, audit requests, compliance requirements',
    processing: 'Stores immutable records, links evidence to transactions, manages retention policies, serves audit requests',
    outputs: 'Audit-ready evidence packages, document retrieval, retention reports',
  },
  'audit-portal': {
    title: 'Audit Portal Engine',
    inputs: 'PBC (Provided by Client) requests, audit timelines, evidence vault links',
    processing: 'Manages audit workflow, tracks PBC item status, generates audit packages, coordinates evidence delivery',
    outputs: 'PBC status dashboard, audit packages, response tracking',
  },
  'budgeting': {
    title: 'Budgeting Engine',
    inputs: 'Historical actuals, budget assumptions, department allocations',
    processing: 'Creates budget templates, tracks budget vs actual, computes variances, supports rolling forecasts',
    outputs: 'Budget reports, variance analysis, forecast updates',
  },
  'expense-management': {
    title: 'Expense Management Engine',
    inputs: 'Expense reports, receipts, policies, approval chains',
    processing: 'Validates against policies, routes for approval, detects duplicates, categorizes expenses',
    outputs: 'Approved expense reports, policy violation alerts, spend reports',
  },
  'contracts': {
    title: 'Contracts Engine',
    inputs: 'Contract documents, terms, milestones, renewal dates',
    processing: 'Tracks contract lifecycle, alerts on renewals, monitors compliance with terms, manages amendments',
    outputs: 'Contract status, renewal alerts, compliance reports',
  },
  'commentary': {
    title: 'Commentary Engine',
    inputs: 'Financial results, prior period data, operational context',
    processing: 'Generates variance explanations, highlights significant changes, drafts management commentary',
    outputs: 'Variance narratives, management discussion drafts, key metrics commentary',
  },
  'data-bridge': {
    title: 'Data Bridge Engine',
    inputs: 'Gateway API responses (Ascend, Salesforce, Samsara, Fleet Panda, Power BI)',
    processing: 'Normalizes data across services, caches results, handles pagination, manages auth tokens',
    outputs: 'Unified data objects, cached query results, sync status',
  },
  'order-to-cash': {
    title: 'Order-to-Cash Engine',
    inputs: 'Orders, delivery tickets, invoices, payment receipts',
    processing: 'Tracks OTC pipeline from order through cash receipt, identifies bottlenecks, measures cycle time',
    outputs: 'OTC pipeline status, cycle time metrics, bottleneck analysis',
  },
  'intelligence-brief': {
    title: 'Intelligence Brief Engine',
    inputs: 'All engine outputs, anomaly detection results, KPI dashboards',
    processing: 'Synthesizes cross-engine data into executive summaries, prioritizes insights, generates daily/weekly briefs',
    outputs: 'Executive briefs, prioritized insights, action items',
  },
};

function generateEngineDoc(engineId: string, desc: { title: string; inputs: string; processing: string; outputs: string }): string {
  return [
    `# ${desc.title}`,
    '',
    `**Engine ID:** \`${engineId}\``,
    `**Last Generated:** ${new Date().toISOString()}`,
    '',
    '## Data Flow',
    '',
    '### Inputs',
    desc.inputs,
    '',
    '### Processing',
    desc.processing,
    '',
    '### Outputs',
    desc.outputs,
    '',
    '## Integration Points',
    '',
    `This engine is part of the Delta Intelligence platform's 20-engine accounting suite.`,
    `Source: \`src/lib/engines/${engineId}.ts\``,
  ].join('\n');
}

// ── API Documentation ────────────────────────────────────────

const API_CATEGORIES: Record<string, string[]> = {
  'Accounting': ['journal-entries', 'close', 'reconciliations', 'financial-statements', 'general-ledger'],
  'Finance': ['cash-flow', 'budgets', 'expenses', 'tax', 'inventory'],
  'Revenue': ['ar', 'ap', 'otc', 'contracts'],
  'Compliance': ['audit', 'vault', 'controls', 'exceptions'],
  'Operations': ['fleet', 'assets', 'scheduler'],
  'AI & Analytics': ['chat', 'analytics', 'anomalies', 'brief', 'digests'],
  'Platform': ['auth', 'config', 'settings', 'plugins', 'integrations', 'workspaces'],
  'Sales': ['sales', 'customers', 'people'],
  'System': ['system', 'gateway', 'webhooks', 'upload', 'embed'],
};

function generateApiCatalogDoc(): string {
  const lines = [
    '# API Endpoint Catalog',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Total Routes:** 104+`,
    '',
    '## Authentication',
    '',
    'All endpoints require Microsoft SSO authentication via NextAuth.',
    'Role-based access control enforces permissions per endpoint.',
    '',
    '## Endpoint Categories',
    '',
  ];

  for (const [category, routes] of Object.entries(API_CATEGORIES)) {
    lines.push(`### ${category}`);
    lines.push('');
    lines.push('| Route | Methods | Description |');
    lines.push('|-------|---------|-------------|');
    for (const route of routes) {
      lines.push(`| \`/api/${route}\` | GET, POST | ${category} operations |`);
    }
    lines.push('');
  }

  lines.push('## Response Format');
  lines.push('');
  lines.push('All endpoints return JSON. Error responses include an `error` field with a message string.');
  lines.push('Successful responses include the data payload directly or wrapped in a typed object.');

  return lines.join('\n');
}

// ── Integration Documentation ────────────────────────────────

function generateIntegrationDocs(): string {
  const integrations = [
    { name: 'Ascend ERP', endpoints: 128, refresh: 'On-demand via gateway', mapping: 'SQL queries via /ascend/* endpoints' },
    { name: 'Salesforce CRM', endpoints: 20, refresh: 'On-demand via gateway', mapping: 'SOQL queries via /salesforce/* endpoints' },
    { name: 'Samsara Fleet', endpoints: 15, refresh: 'Polling (5min)', mapping: 'REST API via /samsara/* endpoints' },
    { name: 'Microsoft 365', endpoints: 10, refresh: 'On-demand', mapping: 'Graph API for calendar, email, users' },
    { name: 'Power BI', endpoints: 8, refresh: 'On-demand', mapping: 'REST API for reports and datasets' },
    { name: 'Paylocity HR', endpoints: 5, refresh: 'Daily sync', mapping: 'REST API for employee data' },
    { name: 'Fleet Panda', endpoints: 5, refresh: 'Polling (15min)', mapping: 'REST API for fuel/fleet data' },
    { name: 'Vroozi Procurement', endpoints: 5, refresh: 'On-demand', mapping: 'REST API for PO/invoice data' },
  ];

  const lines = [
    '# Integration Specifications',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    `**Total Data Services:** ${integrations.length}`,
    `**Total Gateway Endpoints:** 128+`,
    '',
    '## Overview',
    '',
    'The Unified Data Gateway (port 3847) proxies all external service requests.',
    'Authentication uses role-based API keys. All responses are cached with configurable TTL.',
    '',
    '## Services',
    '',
  ];

  for (const svc of integrations) {
    lines.push(`### ${svc.name}`);
    lines.push('');
    lines.push(`- **Endpoints:** ${svc.endpoints}`);
    lines.push(`- **Refresh:** ${svc.refresh}`);
    lines.push(`- **Data Mapping:** ${svc.mapping}`);
    lines.push('');
  }

  return lines.join('\n');
}

// ── Workflow Documentation ───────────────────────────────────

function generateWorkflowDocs(): string {
  return [
    '# Workflow Procedures',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Month-End Close',
    '',
    '1. **Pre-close preparation** — Verify all transactions posted, reconciliation rules updated',
    '2. **Reconciliation** — Run all account reconciliations, resolve exceptions',
    '3. **Adjusting entries** — Post accruals, deferrals, and reclassifications',
    '4. **Financial statements** — Generate P&L, balance sheet, cash flow',
    '5. **Management review** — Generate commentary, variance analysis',
    '6. **Close period** — Lock period in close management engine',
    '',
    '## Daily Operations',
    '',
    '1. **Morning brief** — Auto-generated intelligence brief with overnight anomalies',
    '2. **AR monitoring** — Review new past-due items, trigger collection workflows',
    '3. **AP processing** — Process incoming invoices, route for approval',
    '4. **Cash position** — Update cash flow forecast with actual balances',
    '5. **Fleet tracking** — Monitor vehicle status, fuel consumption',
    '',
    '## Audit Response',
    '',
    '1. **PBC request received** — Log in audit portal, assign owner',
    '2. **Evidence gathering** — Pull from evidence vault, generate supporting docs',
    '3. **Review** — Manager reviews before delivery to auditors',
    '4. **Delivery** — Send via audit portal, track acknowledgment',
    '5. **Follow-up** — Track open items, respond to follow-up requests',
    '',
    '## Data Quality Monitoring',
    '',
    '1. **Verification gates** — Run all gates on schedule (DataIntegrity, Compliance, Reconciliation, CashFlow, DataFreshness)',
    '2. **Anomaly detection** — Continuous monitoring of KPIs against baselines',
    '3. **Optimization insights** — Review weekly performance report for degraded metrics',
    '4. **Feedback loop** — Track AI suggestion acceptance rates to improve recommendations',
  ].join('\n');
}

// ── Verification Report ──────────────────────────────────────

function generateVerificationReport(): string {
  const result = runAllGates();
  const lines = [
    '# Verification Report',
    '',
    `**Generated:** ${result.timestamp}`,
    `**Overall Status:** ${result.overallPassed ? 'PASSED' : 'FAILED'}`,
    `**Score:** ${result.score}%`,
    `**Run ID:** ${result.runId}`,
    '',
    '## Gate Results',
    '',
  ];

  for (const gate of result.gates) {
    lines.push(`### ${gate.gate} — ${gate.passed ? 'PASSED' : 'FAILED'} (${gate.duration}ms)`);
    lines.push('');
    lines.push('| Check | Status | Severity | Message |');
    lines.push('|-------|--------|----------|---------|');
    for (const check of gate.checks) {
      lines.push(`| ${check.name} | ${check.passed ? 'Pass' : 'Fail'} | ${check.severity} | ${check.message} |`);
    }
    lines.push('');
  }

  lines.push('## Available Gates');
  lines.push('');
  for (const gate of getAvailableGates()) {
    lines.push(`- ${gate}`);
  }

  return lines.join('\n');
}

// ── Public API ───────────────────────────────────────────────

export function regenerateDocs(category?: DocCategory): ProcessDoc[] {
  let registry = readRegistry();
  const generated: ProcessDoc[] = [];

  if (!category || category === 'engine') {
    for (const [engineId, desc] of Object.entries(ENGINE_DESCRIPTIONS)) {
      const content = generateEngineDoc(engineId, desc);
      registry = upsertDoc(registry, {
        title: desc.title,
        category: 'engine',
        content,
        generatedFrom: `engine:${engineId}`,
      });
    }
  }

  if (!category || category === 'api') {
    const content = generateApiCatalogDoc();
    registry = upsertDoc(registry, {
      title: 'API Endpoint Catalog',
      category: 'api',
      content,
      generatedFrom: 'api:catalog',
    });
  }

  if (!category || category === 'integration') {
    const content = generateIntegrationDocs();
    registry = upsertDoc(registry, {
      title: 'Integration Specifications',
      category: 'integration',
      content,
      generatedFrom: 'integration:all',
    });
  }

  if (!category || category === 'workflow') {
    const content = generateWorkflowDocs();
    registry = upsertDoc(registry, {
      title: 'Workflow Procedures',
      category: 'workflow',
      content,
      generatedFrom: 'workflow:all',
    });
  }

  if (!category || category === 'data-flow') {
    const content = generateVerificationReport();
    registry = upsertDoc(registry, {
      title: 'Verification Report',
      category: 'data-flow',
      content,
      generatedFrom: 'verification:report',
    });
  }

  writeRegistry(registry);

  // Return the docs that match the requested category (or all)
  if (category) {
    generated.push(...registry.docs.filter(d => d.category === category));
  } else {
    generated.push(...registry.docs);
  }

  return generated;
}

export function listDocs(category?: DocCategory): ProcessDoc[] {
  const registry = readRegistry();
  const docs = registry.docs ?? [];
  if (category) {
    return docs.filter(d => d.category === category);
  }
  return docs;
}

export function getDocById(id: string): ProcessDoc | null {
  const registry = readRegistry();
  return (registry.docs ?? []).find(d => d.id === id) ?? null;
}

export function getDocCategories(): DocCategory[] {
  return ['workflow', 'integration', 'engine', 'api', 'data-flow'];
}
