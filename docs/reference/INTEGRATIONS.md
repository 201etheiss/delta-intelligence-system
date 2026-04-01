# Delta Intelligence System — Integration Plans

**Last Updated:** 2026-03-31

System-by-system integration plans for every data source, with connection methods, data flows, sync strategies, and dependencies.

---

## Integration Architecture Overview

```
                    ┌─────────────────────────────────┐
                    │   Delta Intelligence System v2   │
                    │       (Next.js + FastAPI)        │
                    └──────────────┬──────────────────┘
                                   │
              ┌────────────────────┼────────────────────┐
              │                    │                     │
        ┌─────┴─────┐      ┌──────┴──────┐      ┌──────┴──────┐
        │  SQLite    │      │  Supabase   │      │   Neo4j     │
        │  (local)   │      │  (cloud)    │      │   (graph)   │
        └────────────┘      └─────────────┘      └─────────────┘
              ▲                    ▲                     ▲
              │                    │                     │
    ┌─────────┴────────────────────┴─────────────────────┴─────────┐
    │                      ETL / Integration Layer                  │
    └──┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬───┬──────┘
       │   │   │   │   │   │   │   │   │   │   │   │   │   │
       ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼   ▼
      PDI  PLC  VRZ  STX  JPM  SAM  SF   PBI  FS   DS   ZI  D&B
```

**Legend:** PDI=Ascend, PLC=Paylocity, VRZ=Vroozi, STX=StoneX, JPM=JPMorgan, SAM=Samsara, SF=Salesforce, PBI=Power BI, FS=Formstack, DS=DocuSign, ZI=ZoomInfo, D&B=Dun & Bradstreet

---

## TIER 1 — Core Financial Systems (Critical Path)

### 1. PDI Ascend (ERP)

**What it is:** Primary ERP for Delta Fuel Company. GL, AP, AR, inventory, fuel pricing, delivery scheduling. SQL Server database (167GB).

**Current state:**
- Ascend-021826.bak (167GB backup) exists on Desktop
- Migration toolkit built: `~/Desktop/ascend-migration/` (5-step pipeline SQL Server → PostgreSQL)
- Docker + SQL Server restore → PostgreSQL export via pymssql
- Type mapping complete (SQL Server types → PostgreSQL types)
- Migration NOT YET RUN (needs Docker Desktop installed + ~400GB free disk)

**Connection method:** SQL Server .bak restore → Docker → PostgreSQL local
- Server: localhost:1433 (via Docker)
- Credentials: sa / Ascend2026!
- Target: PostgreSQL `ascend` database on localhost:5432

**Data to extract:**
| Ascend Entity | Delta Intelligence Target | Sync Frequency |
|---------------|--------------------------|----------------|
| GL Transactions | `journal_entries`, `feed_timeseries` | Real-time (15 min) |
| Trial Balance | `reporting_packages`, flash reports | Daily (6am) |
| Chart of Accounts | `accounts` (Supabase), Account nodes (Neo4j) | Weekly |
| AP Transactions | `ap_invoices`, AP Intelligence module | Real-time (15 min) |
| AR Aging | `ar_aging`, borrowing base calculations | Daily |
| Inventory | `inventory_positions`, margin analytics | Daily |
| Equipment/Assets | `fixed_assets`, depreciation calculations | Weekly |
| Customer Master | Account nodes (Neo4j), Salesforce sync | Weekly |
| Vendor Master | Vendor nodes (Neo4j) | Weekly |
| Fuel Pricing | `margin_analytics`, flash reports | Real-time (15 min) |
| Delivery Scheduling | Operations dashboard | Real-time |

**Integration architecture:**
```
Ascend SQL Server (Docker)
    │
    ├── pymssql direct query (real-time)
    │   └── FastAPI background worker → Supabase + Neo4j
    │
    └── Batch export (daily)
        └── step4-export-to-postgres.py → Local PostgreSQL
            └── FastAPI reads from local PG for analytics
```

**Sync strategy:**
1. **Phase 1 (NOW):** Run migration toolkit, get Ascend into local PostgreSQL
2. **Phase 2:** Build incremental sync — query Ascend SQL Server for changes since last sync
3. **Phase 3:** Near-real-time — 15-minute polling loop with change detection

**Dependencies:**
- Docker Desktop installed and running
- ~400GB free disk space for restore
- Postgres.app running (v18 already installed)

**Blocking issues:** Ascend may need Brad Vencil's approval for recurring SQL Server access

---

### 2. Paylocity (Payroll/HR)

**What it is:** Payroll processor. Pay registers, benefit deductions, accrual reports, tax withholdings.

**Connection method:** CSV/Excel export (manual initially, API later)
- Paylocity has a REST API (developer.paylocity.com) — needs client registration
- Alternative: Automated SFTP pickup of scheduled exports

**Data to extract:**
| Paylocity Entity | Delta Intelligence Target | JE Family |
|-----------------|--------------------------|-----------|
| Pay Register | Payroll accrual JE template | Family 2 |
| Benefit Deductions | Health insurance/HSA JE template | Family 5 |
| Tax Withholdings | Tax JE template | Family 6 |
| PTO Balances | Accrual liability calculations | Family 2 |
| Headcount | People nodes (Neo4j), HR dashboard | — |
| Department Codes | Cost center mapping | — |

**Parser status:** `paylocity_parser` exists in v2, expects clean CSV. Needs hardening for real exports.

**Integration architecture:**
```
Paylocity
    │
    ├── Phase 1: Manual CSV upload → paylocity_parser → SQLite + Supabase
    │
    ├── Phase 2: Paylocity REST API → scheduled pull
    │   POST /api/v2/companies/{companyId}/employees → employee data
    │   GET  /api/v2/companies/{companyId}/employees/{employeeId}/paystatement → pay details
    │
    └── Phase 3: SFTP automated pickup → parser → dual-write
```

**Key field mappings needed:** Department codes → GL account mapping, benefit plan codes → GL codes, tax jurisdiction codes → tax account structure (needs Bill Didsbury input)

---

### 3. Vroozi (Procurement/AP)

**What it is:** Cloud-based procurement platform. Purchase orders, invoices, receipt matching, approval workflows.

**Connection method:** CSV export initially, Vroozi API later
- Vroozi has REST APIs for PO and invoice data
- May need Brad Vencil to provision API credentials

**Data to extract:**
| Vroozi Entity | Delta Intelligence Target | Purpose |
|--------------|--------------------------|---------|
| Purchase Orders | `purchase_orders`, AP matching | 3-way match |
| Invoices | `ap_invoices`, AP Intelligence | Auto-coding |
| Receipt Matching | `receipt_matches` | Exception detection |
| Approval Status | AP workflow tracking | Touch-time measurement |
| Vendor Master | Vendor nodes (Neo4j) | Vendor relationship graph |
| GL Coding | Auto-coding training data | ML model for >50% auto-code |

**Parser status:** `vroozi_parser` exists, basic. Needs multiline invoice support and coding intelligence.

**Key metric:** AP multiline auto-coded >50%, AP touch-time reduction >30%

---

### 4. StoneX (Hedging/Commodities)

**What it is:** Commodity hedging broker. Futures contracts, options, realized/unrealized gains, commissions.

**Connection method:** Statement parsing (PDF/CSV). StoneX sends monthly statements.

**Data to extract:**
| StoneX Entity | Delta Intelligence Target | Key Accounts |
|--------------|--------------------------|-------------|
| Open Positions | `hedging_positions` | 10345 (Broker-FC Stone) |
| Realized P&L | `hedging_realized` | 80200 (Hedging Gain/Loss) |
| Unrealized P&L | `hedging_unrealized` | 80200 |
| Commissions | `hedging_commissions` | 68115 (Commission Expense) |
| Contract Details | Position nodes (Neo4j) | — |

**Parser status:** `stonex_parser` exists, needs real statement samples to harden.

**JE Family 4 dependency:** StoneX hedging JE template needs: position identification, realized vs unrealized split, commission allocation, mark-to-market adjustments.

---

### 5. JPMorgan Chase (Banking)

**What it is:** Primary bank. Operating accounts, line of credit (LOC), wire transfers, ACH.

**Connection method:** Bank statement CSV/BAI2 download. JPM Access provides automated exports.

**Data to extract:**
| JPM Entity | Delta Intelligence Target | Key Accounts |
|-----------|--------------------------|-------------|
| Bank Statements | `bank_reconciliations` | Cash accounts |
| Cleared Checks | `cleared_transactions` | Recon matching |
| Wire Transfers | `wire_log` | Cash flow tracking |
| LOC Balance | `borrowing_base` | 25100 (JPM LOC) |
| Interest Charges | Interest allocation JE | Family 8 |

**Parser status:** `bank_parser` exists, needs BAI2 format support.

**Critical for:** Weekly cash-flow/borrowing base calculation (JE Family 12), bank reconciliations, Day-2 flash report cash position.

---

## TIER 2 — Operational Systems (High Value)

### 6. Samsara (Fleet/Telematics)

**What it is:** Fleet management. GPS tracking, vehicle diagnostics, driver behavior, fuel consumption, HOS compliance.

**Current state:**
- 178 vehicles tracked (from Delta360_Master_Asset_Index.xlsx)
- Samsara REST API available (api.samsara.com)
- Data already flowing for equipment tracking (separate project)
- TimescaleDB hypertables exist: `engine_readings`, `gps_readings`, `hos_logs`

**Connection method:** Samsara REST API (already have credentials from equipment tracker project)

**Data to extract:**
| Samsara Entity | Delta Intelligence Target | Frequency |
|---------------|--------------------------|-----------|
| Vehicle Locations | Operations map, delivery tracking | Real-time (5 min) |
| Fuel Consumption | Fuel cost analysis, margin impact | Hourly |
| Odometer/Engine Hours | Depreciation calculations (JE Family 1) | Daily |
| Driver HOS | Compliance dashboard | Real-time |
| Vehicle Diagnostics | Maintenance forecasting | Daily |
| Trip History | Delivery cost allocation | Daily |

**Integration architecture:**
```
Samsara API
    │
    ├── /fleet/vehicles/locations → GPS positions → TimescaleDB gps_readings
    ├── /fleet/vehicles/stats → Engine data → TimescaleDB engine_readings
    ├── /fleet/hos/logs → HOS compliance → TimescaleDB hos_logs
    │
    └── Delta Intelligence aggregation layer
        ├── Vehicle depreciation → JE Family 1, 9
        ├── Fuel cost → Margin analytics
        └── Fleet utilization → Operations dashboard
```

**Cross-reference:** Samsara Vehicle IDs ↔ Ascend Equipment IDs (needs mapping table). The Ascend Master List has EquipmentId, Code, standardAcctNo fields that need to map to Samsara Vehicle IDs.

---

### 7. Salesforce (CRM + Operations Platform)

**What it is:** Delta360's operational backbone. Not just CRM — handles credit applications, permits, wells, terminals, sales territories, field service, and project management.

**Current state:** LIVE and connected via MCP. 1,806 queryable objects.

**Key custom objects discovered:**
| Object | Purpose | Delta Intelligence Value |
|--------|---------|------------------------|
| `Account` | Customer master | AR/credit module, borrowing base |
| `Contact` | Customer contacts | Communication tracking |
| `Opportunity` | Sales pipeline | Revenue forecasting |
| `Credit_Application__c` | Credit decisions | AR/credit risk scoring |
| `Check_In__c` | Field check-ins | Operations tracking |
| `FRAC__c` | Frac operations | Division-specific analytics |
| `Permit__c` | Operational permits | Compliance tracking |
| `Sales_To_Do__c` | Sales tasks | Pipeline management |
| `Terminals_and_Refineries__c` | Supply locations | Inventory/margin analytics |
| `Well__c` | Well tracking | Oil & gas division analytics |
| `Zip5Assignment__c` | Territory mapping | Sales territory analytics |

**Installed packages:**
| Package | Purpose |
|---------|---------|
| DNBI (D&B) | Credit decisions, business verification |
| DOZISF (ZoomInfo) | Sales intelligence, intent data |
| dfsle (DocuSign) | Electronic signatures |
| FSL (Field Service Lightning) | Field service scheduling |
| maps (Salesforce Maps) | Territory planning, route optimization |
| pi (Pardot) | Marketing automation |
| inov8 (PMT) | Project management |
| joshdaymentlabs | IT asset management |
| VisualAntidote (Formstack) | Forms and submissions |
| dlrs | Declarative rollup summaries |

**Integration architecture:**
```
Salesforce (via MCP)
    │
    ├── sf_query → SOQL queries for bulk data pulls
    ├── sf_get_record → Real-time record lookups
    ├── sf_search → SOSL cross-object searches
    │
    └── Data flows TO Delta Intelligence:
        ├── Account → Customer master → Neo4j Account nodes
        ├── Credit_Application__c → AR/Credit risk module
        ├── Opportunity → Revenue forecast → Flash reports
        ├── Terminals_and_Refineries__c → Margin analytics
        ├── Well__c → Oil & Gas division reporting
        ├── DNBI Credit Decisions → Credit risk scoring
        │
    └── Data flows FROM Delta Intelligence:
        ├── Financial health scores → Account fields
        ├── AR aging alerts → Salesforce tasks/alerts
        └── Credit hold recommendations → Credit_Application__c
```

**Sync strategy:**
1. **Phase 1:** On-demand SOQL queries via MCP for ad-hoc analysis
2. **Phase 2:** Scheduled sync — pull Account, Opportunity, Credit changes daily
3. **Phase 3:** Bidirectional — push financial health scores back to Salesforce

---

### 8. Power BI (Analytics/Reporting)

**What it is:** Microsoft's BI platform. Executive dashboards, self-service analytics.

**Current state:**
- MCP server LIVE and connected (mcp__powerbi-mcp)
- Full tool suite available: list workspaces, execute DAX, refresh datasets, export reports
- MCP setup kit built (~/Desktop/powerbi-mcp-setup/)
- 6-tab index spreadsheet with 27 use cases mapped

**Integration architecture:**
```
Delta Intelligence Supabase
    │
    ├── Power BI Dataflow → connects to Supabase PostgreSQL
    │   └── Scheduled refresh every 15 min
    │
    ├── Power BI Semantic Model
    │   ├── Financial measures (DAX)
    │   ├── Close progress measures
    │   └── Exception aging measures
    │
    └── Power BI Reports
        ├── Executive Dashboard (Adam, Mike)
        ├── Controller Operations (Taylor)
        ├── Division Performance (Sam, Rodney)
        └── Sales Analytics (Robert, Tim, Natalie)
```

**Immediate actions:**
1. Create Power BI workspace "Delta360 Intelligence"
2. Connect Supabase as data source
3. Build executive dashboard
4. Set up scheduled refresh
5. Embed key visuals in Delta Intelligence UI

---

## TIER 3 — Supporting Systems

### 9. Formstack (Forms/Data Capture)

**What it is:** Form builder for field data capture, customer applications, internal checklists.

**Connection:** Already in Salesforce as VisualAntidote package. Forms submit to Salesforce records.

**Delta Intelligence value:**
- Credit application intake → Credit_Application__c → AR/Credit module
- Field check-in forms → Check_In__c → Operations tracking
- Internal checklists → Close management, audit readiness

### 10. DocuSign (E-Signatures)

**What it is:** Electronic signature platform for contracts, credit applications, internal approvals.

**Connection:** Already in Salesforce as dfsle package.

**Delta Intelligence value:**
- Envelope status tracking → Contract management
- Signature completion → Close task dependencies
- Audit trail → Evidence vault

### 11. D&B / Dun & Bradstreet (Credit Intelligence)

**What it is:** Business credit data, credit scoring, monitoring.

**Connection:** Already in Salesforce as DNBI package.

**Delta Intelligence value:**
- Credit scores → Customer risk scoring in AR module
- Credit decision history → AR/Credit risk module
- Business verification → New customer onboarding

### 12. ZoomInfo (Sales Intelligence)

**What it is:** B2B data platform for prospecting, contact info, intent signals.

**Connection:** Already in Salesforce as DOZISF package.

**Delta Intelligence value:**
- Intent data → Sales pipeline intelligence
- Company data enrichment → Account graph in Neo4j
- Competitor tracking → Market intelligence

### 13. Salesforce Maps (Territory Management)

**What it is:** Territory planning, route optimization, live asset tracking.

**Connection:** Already in Salesforce as maps package.

**Delta Intelligence value:**
- Territory assignments → Sales performance by territory
- Route optimization → Delivery cost analytics
- Live asset tracking → Fleet integration with Samsara

### 14. BizInsight / Solver (Legacy Reporting)

**What it is:** Current reporting tools. BizInsight is active; Solver is legacy.

**Status:** Being REPLACED by Delta Intelligence + Power BI. No new integration needed.

**Migration path:** Extract any saved report definitions/templates for reconstruction in Power BI.

### 15. NetSuite (Under Evaluation)

**What it is:** Cloud ERP being evaluated as potential Ascend replacement.

**Status:** Under evaluation. No integration now, but Delta Intelligence should be ERP-agnostic.

**Design principle:** All integrations go through the ETL/parser layer. If NetSuite replaces Ascend, only the parser changes — the rest of the system stays the same.

### 16. Avalara (Tax — Under Evaluation)

**What it is:** Automated tax calculation and compliance.

**Integration plan:** If adopted, replace manual tax JE templates (Family 6) with Avalara API calls. Bill Didsbury to decide.

---

## Integration Priority Matrix

| System | Tier | Data Value | Effort | Dependencies | Start |
|--------|------|-----------|--------|-------------|-------|
| Ascend (local PG) | 1 | Critical | Medium | Docker, disk space | Wave 0 |
| Salesforce (MCP) | 2 | High | Low | Already connected | Wave 1 |
| Power BI (MCP) | 2 | High | Low | Already connected | Wave 1 |
| Samsara (API) | 2 | High | Medium | API credentials | Wave 2 |
| Paylocity (CSV→API) | 1 | Critical | Medium | API registration | Wave 2 |
| Vroozi (CSV→API) | 1 | Critical | Medium | API credentials | Wave 2 |
| StoneX (parser) | 1 | High | Low | Sample statements | Wave 3 |
| JPMorgan (BAI2) | 1 | Critical | Low | BAI2 file access | Wave 2 |
| Formstack | 3 | Medium | Low | Via Salesforce | Wave 4 |
| DocuSign | 3 | Medium | Low | Via Salesforce | Wave 4 |
| D&B | 3 | Medium | Low | Via Salesforce | Wave 4 |
| ZoomInfo | 3 | Low | Low | Via Salesforce | Wave 5 |
| SF Maps | 3 | Medium | Low | Via Salesforce | Wave 5 |
| Avalara | 3 | Medium | High | Adoption decision | Wave 6 |
| NetSuite | 3 | N/A | High | Adoption decision | TBD |

---

## Cross-System Data Flow Map

```
Ascend (GL, AP, AR, Inventory)
    ↓
    ├──→ Supabase (structured tables for all 6 engines)
    ├──→ Neo4j (account relationships, entity structures)
    ├──→ Power BI (executive dashboards)
    └──→ TimescaleDB (time-series for trending)

Paylocity (Payroll, Benefits)
    ↓
    ├──→ JE Engine (accrual/reversal templates)
    └──→ Supabase (headcount, cost center data)

Vroozi (AP Invoices, POs)
    ↓
    ├──→ AP Intelligence (auto-coding, matching)
    └──→ Recon Engine (3-way match)

Salesforce (Customers, Credit, Sales)
    ↓
    ├──→ Neo4j (customer graph, territory map)
    ├──→ AR/Credit Module (risk scoring)
    └──→ Revenue forecasting (pipeline → flash)

Samsara (Fleet, GPS, Fuel)
    ↓
    ├──→ TimescaleDB (gps_readings, engine_readings)
    ├──→ JE Engine (depreciation calcs from odometer/hours)
    └──→ Operations dashboard (delivery tracking)

StoneX (Hedging Positions)
    ↓
    ├──→ JE Engine (hedging JE template)
    └──→ Risk Module (position tracking, P&L)

JPMorgan (Banking)
    ↓
    ├──→ Recon Engine (bank reconciliation)
    ├──→ Cash Flow Engine (borrowing base)
    └──→ Flash Report (Day-2 cash position)
```
