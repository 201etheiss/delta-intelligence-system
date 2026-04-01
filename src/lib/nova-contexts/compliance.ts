/**
 * Nova Context: Compliance
 * Vocabulary, schema, and query capabilities for the Compliance domain.
 * Covers: evidence vault, audit trail, controls, exceptions, SOX, reconciliation.
 */

import type { NovaContext } from './finance';

export const COMPLIANCE_CONTEXT: NovaContext = {
  domain: 'compliance',

  vocabulary: [
    'Evidence vault — immutable, SHA-256-checksummed storage for audit evidence; no overwrite or delete',
    'Audit trail — chronological log of every action taken in a module with user, timestamp, and before/after state',
    'Control — a defined procedure that must be executed and documented in a period',
    'Exception — a control failure or deviation flagged for remediation',
    'SOX — Sarbanes-Oxley compliance requirements; internal controls over financial reporting',
    'Reconciliation — formal matching of two data sources to confirm they agree (e.g., GL to bank)',
    'Close checklist — ordered list of period-end tasks with completion status and owner',
    'Immutable entry — evidence record that cannot be modified after creation; enforced in code',
    'Checksum — SHA-256 hash stored with each evidence file to detect tampering',
    'Source module — the DI module that generated the evidence: je, recon, close, report, audit, tax',
    'Control test — documented procedure verifying a control operated effectively',
    'Segregation of duties — no single user should be able to initiate AND approve the same transaction',
    'Materiality threshold — dollar amount above which an exception triggers escalation',
    'Working paper — structured documentation of an audit procedure and its conclusion',
  ],

  keyTables: [
    'EvidenceEntry — id, sourceModule, sourceId, fileName, checksumSha256, uploadedBy, uploadedAt, tags, description',
    'ControlChecklist — close tasks with owner, due date, completed flag, and evidence link',
    'AuditLog — system-level action log across all modules',
    'ReconciliationRecord — GL-to-bank or sub-ledger match results with variance detail',
  ],

  queryPatterns: [
    'Show all evidence uploaded this period',
    'What controls are incomplete for the current close?',
    'List exceptions flagged in period 4',
    'Who approved the last batch of journal entries?',
    'Show reconciliation status for all bank accounts',
    'What evidence exists for the Q1 audit?',
    'Are there any missing control sign-offs?',
    'Show the audit trail for invoice INV-0042',
    'Which exceptions are past their remediation deadline?',
    'Generate a controls summary report',
  ],

  availableActions: [
    'upload-evidence — attach a file to an evidence entry with source module tagging',
    'verify-evidence-integrity — re-compute SHA-256 checksums and flag any tampered files',
    'run-control-checklist — step through open close tasks and track completions',
    'flag-exception — create an exception record linked to a control failure',
    'resolve-exception — mark an exception as remediated with supporting evidence',
    'export-audit-package — bundle evidence and working papers into a zip for auditor delivery',
    'pull-audit-trail — retrieve full action log for a specific transaction or module',
    'generate-sox-summary — produce a period summary of control status and exception counts',
  ],

  gatewayEndpoints: [
    'POST /ascend/query',
    'GET /ascend/gl/journal-entries',
    'GET /ascend/gl/trial-balance',
    'GET /ascend/taxes/collected',
    'GET /ascend/assets/fixed',
  ],
};
