# Delta Intelligence — Full Buildout Schema

## Vision
Delta Intelligence replaces all fragmented tools (Ascend ERP UI, QuickBooks, spreadsheets, manual processes) with a single AI-powered operating platform for Delta360 Energy. Ascend remains the data backbone (read-only SQL); DI becomes the workflow, intelligence, and decision layer.

## Architecture

```
                    ┌─────────────────────────────────────┐
                    │      DELTA INTELLIGENCE PLATFORM     │
                    │    Next.js 14 · TypeScript · SSO     │
                    └──────────────┬──────────────────────┘
                                   │
          ┌────────────────────────┼────────────────────────┐
          │                        │                        │
    ┌─────▼─────┐          ┌──────▼──────┐          ┌──────▼──────┐
    │  FRONTEND │          │  API LAYER  │          │   AI LAYER  │
    │  40+ pages│          │  70+ routes │          │  86 plugins │
    │  Dark UI  │          │  Auth + RLS │          │  8 chat tools│
    └─────┬─────┘          └──────┬──────┘          └──────┬──────┘
          │                       │                        │
          └───────────────────────┼────────────────────────┘
                                  │
          ┌───────────────────────┼───────────────────────┐
          │                       │                       │
    ┌─────▼─────┐          ┌─────▼──────┐         ┌──────▼──────┐
    │ SUPABASE  │          │  GATEWAY   │         │   NEO4J     │
    │ Cloud DB  │          │ 128 routes │         │   Graph     │
    │ Own GL    │          │ 8 services │         │  Relations  │
    │ Auth/RLS  │          │ Read-only  │         │  13 nodes   │
    └───────────┘          └────────────┘         └─────────────┘
                                  │
    ┌──────┬──────┬──────┬───────┼───────┬──────┬──────┬──────┐
    │Ascend│  SF  │Samsara│Vroozi│  M365 │ PBI  │Payloc│FltPnd│
    │ ERP  │ CRM  │Fleet  │Procur│ Mail  │  BI  │  HR  │Logist│
    └──────┴──────┴──────┴──────┴───────┴──────┴──────┴──────┘
```

## Module Registry — 35 Modules Across 7 Domains

### Domain 1: ACCOUNTING & GL (8 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 1 | **Journal Entry Engine** | Building | /journal-entries, /journal-entries/[id] | /api/journal-entries | Supabase (write) + Ascend (read GL) | P0 |
| 2 | **Close Management** | Building | /close-tracker, /close-timeline | /api/close | Supabase | P0 |
| 3 | **Reconciliation Engine** | Building | /reconciliations, /reconciliations/[id] | /api/reconciliations | Ascend GL + Supabase | P0 |
| 4 | **Cash Flow & Treasury** | Building | /cash-flow | /api/cash-flow | Ascend AR/AP + bank data | P0 |
| 5 | **GL Write-Back** | Planned | — (integrated into JE) | /api/gl | Supabase (own GL ledger) | P1 |
| 6 | **Trial Balance & Financial Statements** | Planned | /financial-statements | /api/financial-statements | Ascend GL + Supabase GL | P1 |
| 7 | **Bank Reconciliation** | Planned | /bank-rec | /api/bank-rec | Plaid + Ascend GL | P2 |
| 8 | **Intercompany Eliminations** | Planned | /intercompany | /api/intercompany | Ascend multi-entity GL | P3 |

### Domain 2: ACCOUNTS PAYABLE (4 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 9 | **AP Invoice Processing** | Planned | /ap/invoices | /api/ap/invoices | Vroozi + OCR (Google Doc AI) | P1 |
| 10 | **AP Auto-Coding** | Planned | /ap/coding | /api/ap/coding | Vroozi + ML model | P2 |
| 11 | **Payment Scheduling** | Planned | /ap/payments | /api/ap/payments | Vroozi + bank integration | P2 |
| 12 | **Vendor Management** | Planned | /ap/vendors | /api/ap/vendors | Vroozi + Ascend vendors | P2 |

### Domain 3: ACCOUNTS RECEIVABLE (4 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 13 | **AR Aging & Collections** | Partial | /customer (exists) | /api/customers/health (exists) | Ascend AR | P1 |
| 14 | **Invoice Generation** | Planned | /ar/invoices | /api/ar/invoices | Ascend billing + Supabase | P2 |
| 15 | **Credit Management** | Planned | /ar/credit | /api/ar/credit | Ascend AR + D&B enrichment | P2 |
| 16 | **Borrowing Base Certificate** | Planned | /ar/borrowing-base | /api/cash-flow/borrowing-base | Ascend AR + inventory | P1 |

### Domain 4: TAX & COMPLIANCE (3 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 17 | **Tax Provision** | Planned | /tax/provision | /api/tax/provision | Ascend GL + tax accounts | P2 |
| 18 | **Fuel Tax (Multi-State)** | Planned | /tax/fuel | /api/tax/fuel | Avalara + Ascend billing | P2 |
| 19 | **Audit/PBC Portal** | Planned | /audit | /api/audit/pbc | Evidence Vault + all engines | P2 |

### Domain 5: OPERATIONS & ASSETS (5 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 20 | **Fleet Management** | Live | /fleet-map | /api/fleet | Samsara (13 endpoints) | Done |
| 21 | **Equipment Tracker** | Live (ext) | External app | — | Supabase (shared) | Done |
| 22 | **Fixed Asset Register** | Planned | /assets/fixed | /api/assets/fixed | Ascend FAP + Supabase | P2 |
| 23 | **Inventory & Margin** | Planned | /inventory | /api/inventory | Ascend billing + GL | P2 |
| 24 | **Commodity/Hedging (StoneX)** | Planned | /hedging | /api/hedging | StoneX parser + Ascend | P3 |

### Domain 6: SALES & REVENUE (4 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 25 | **Pipeline & CRM** | Live | /customer, widgets | /api/gateway/salesforce | Salesforce (16 endpoints) | Done |
| 26 | **Sales Scorecard** | Live (ext) | External app | — | Salesforce + Ascend | Done |
| 27 | **Proposal Generation** | Planned | /proposals | /api/proposals | PandaDoc + SF pipeline | P3 |
| 28 | **Revenue Analytics** | Partial | Dashboard widgets | /api/dashboard | Ascend GL (Revenue group) | P1 |

### Domain 7: PLATFORM & INTELLIGENCE (7 modules)

| # | Module | Status | Pages | API Routes | Data Source | Priority |
|---|--------|--------|-------|-----------|-------------|----------|
| 29 | **Controller Cockpit** | Building | /cockpit | — (aggregates other APIs) | All engines | P0 |
| 30 | **Platform Hub** | Building | /platform | — | All apps | P0 |
| 31 | **Plugin Registry** | Live | — | /api/plugins (5 routes) | data/plugins.json (86 plugins) | Done |
| 32 | **AI Chat (8 tools)** | Live | /chat | /api/chat/stream | All gateway services | Done |
| 33 | **Daily Brief** | Live | /digest | /api/digest | 24 live queries | Done |
| 34 | **Evidence Vault** | Planned | /vault | /api/vault | Supabase Storage (immutable) | P2 |
| 35 | **Signal Map (OTED)** | Live (ext) | External app | — | Supabase | Done |

## Supabase Schema — Full ERP Tables

### Core Accounting (deployed to Supabase)
```sql
-- Chart of Accounts (own GL)
accounts (id, number, name, type, parent_id, profit_center, entity_id, active)

-- Journal Entries
journal_entries (id, period, date, description, status, template_id, created_by, reviewed_by, approved_by, posted_by, auto_reverse, reversal_of, created_at)
journal_entry_lines (id, je_id, account_id, debit, credit, profit_center, entity_id, description)

-- Reconciliations
reconciliations (id, account_id, period, gl_balance, sub_balance, difference, status, prepared_by, reviewed_by, completed_at)
recon_exceptions (id, recon_id, description, amount, status, age_days, resolved_by, resolution)
recon_evidence (id, recon_id, file_path, file_name, uploaded_by, uploaded_at)

-- Close Management
close_periods (id, period, status, target_day, created_at, completed_at)
close_items (id, close_id, task, day, owner, status, dependency, completed_by, completed_at, evidence)

-- Cash Flow
cash_flow_forecasts (id, week_starting, receipts, disbursements, net_operating, investing, financing, opening, closing)
borrowing_base (id, date, eligible_ar, eligible_inventory, advance_rate, max_borrowing, current_drawn, available)

-- Financial Packages
report_packages (id, period, status, integrity_score, commentary_status, signoff_status, published_at)
commentary_items (id, package_id, account, variance_type, draft, final, drafted_by, approved_by)
```

### AP/AR
```sql
-- AP
ap_invoices (id, vendor_id, invoice_number, date, due_date, amount, status, gl_coding, auto_coded, approved_by)
ap_payments (id, invoice_id, amount, date, method, reference)

-- AR
ar_invoices (id, customer_id, invoice_number, date, due_date, amount, balance, status)
ar_payments (id, invoice_id, amount, date, method, reference)
credit_limits (id, customer_id, limit, utilization, last_reviewed, risk_score)
```

### Assets & Inventory
```sql
fixed_assets (id, code, description, category, cost, accumulated_depreciation, net_book_value, method, useful_life, in_service_date)
inventory_items (id, product_code, description, quantity, unit_cost, total_value, location, last_count_date)
hedging_positions (id, contract_id, commodity, volume, price, expiry, realized_gl, unrealized_gl)
```

### Audit & Evidence
```sql
evidence_vault (id, source_module, source_id, file_path, checksum_sha256, uploaded_by, uploaded_at, immutable)
audit_requests (id, auditor, request, status, due_date, evidence_ids, assigned_to, completed_at)
```

### Platform
```sql
plugins_usage (id, plugin_id, user_email, capability, latency_ms, cost, rating, timestamp)
automation_runs (id, automation_id, trigger, status, started_at, completed_at, result)
notifications (id, user_email, message, severity, read, created_at)
```

## Build Waves

### Wave 0 (NOW — agents running)
- Journal Entry Engine + templates
- Close Management Engine + checklist
- Reconciliation Engine + rules
- Cash Flow Engine + borrowing base
- Controller Cockpit page
- Platform Hub page
- Navigation config

### Wave 1 (Next session)
- GL Write-Back (own chart of accounts in Supabase)
- Trial Balance + Financial Statement generation
- AP Invoice Processing (Vroozi + OCR)
- AR Collections workflow
- Supabase schema deployment
- GitHub push

### Wave 2
- Bank Reconciliation (Plaid integration)
- Fixed Asset Register
- Tax Provision
- Evidence Vault (immutable storage)
- Commentary Manager
- Borrowing Base Certificate automation

### Wave 3
- AP Auto-Coding (ML model)
- Inventory & Margin Analytics
- StoneX Hedging Intelligence
- Intercompany Eliminations
- Audit/PBC Portal
- Proposal Generation (PandaDoc)

### Wave 4
- Fuel Tax (Avalara multi-state)
- Expense Management
- Contract Management
- Project Accounting
- Mobile companion app
- Custom dashboard builder (drag-and-drop)

## Metrics — Full Platform at Scale

| Metric | Current | Wave 0 | Wave 1 | Wave 2 | Full |
|--------|---------|--------|--------|--------|------|
| Pages | 32 | 38 | 44 | 50 | 55+ |
| API routes | 55+ | 70+ | 85+ | 100+ | 120+ |
| Lib modules | 55 | 62 | 70 | 80 | 90+ |
| Data services | 8 | 8 | 9 (Plaid) | 10 (Avalara) | 12+ |
| Plugins | 86 | 86 | 86 | 90+ | 100+ |
| Supabase tables | 0 | 0 | 20+ | 30+ | 40+ |
| Roles | 6 | 6 | 6 | 8 | 10+ |
| Users | 1 (dev) | 1 | 5-10 | 17 | 30+ |
