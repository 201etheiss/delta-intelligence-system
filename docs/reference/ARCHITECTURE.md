# Delta Intelligence System — Architecture

**Last Updated:** 2026-03-31

---

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    REACT FRONTEND                        │
│  13 Pages · Tailwind · Recharts · Delta360 Branding     │
│  Dashboard · Close · JE · Recon · Reporting · Insights   │
└──────────────────────┬──────────────────────────────────┘
                       │ REST API (localhost:3004)
┌──────────────────────▼──────────────────────────────────┐
│                  FASTAPI BACKEND                         │
│  101 Endpoints · JWT Auth · 6 Engines · 7 Parsers       │
└──┬──────────────────┬──────────────────┬────────────────┘
   │                  │                  │
   ▼                  ▼                  ▼
┌────────┐    ┌────────────┐    ┌────────────┐
│ SQLite │    │  Supabase  │    │   Neo4j    │
│ LOCAL  │    │   CLOUD    │    │   GRAPH    │
│ Fast   │    │  Multi-user│    │ Relations  │
│ Offline│    │  RLS/Auth  │    │ 13 nodes   │
│ 9 views│    │  24 tables │    │ 23 rels    │
└────────┘    └────────────┘    └────────────┘
```

---

## Triple-Database Strategy

### SQLite (Local-First)
- **Purpose:** Immediate availability, offline capability, fast queries
- **Contains:** Preloaded Delta data (71 accounts, 43 JE templates, 37 recon rules, 47 close templates)
- **Views:** 9 dashboard-optimized views
- **Design:** Source of truth for single-user local work

### Supabase (Cloud)
- **Purpose:** Multi-user collaboration, real-time sync, auth/RLS
- **Project:** ohbqjralhrjqoftkkety.supabase.co
- **Schema:** 24 tables with Row Level Security policies
- **Auth:** JWT tokens, role-based access (Admin, Controller, Analyst, Viewer)
- **Status:** Project created, schema SQL written but not yet run

### Neo4j Aura (Graph)
- **Purpose:** Relationship mapping, entity intelligence, graph insights
- **Instance:** "Controller Co-Pilot" at neo4j+s://2b6eeb9d.databases.neo4j.io
- **Schema:** 13 node types, 23 relationship types
- **Use Cases:** Account relationships, close dependency chains, entity structures, audit trails
- **Status:** Instance created, needs seeding

---

## Six Engines

### 1. Journal Entry Engine
- Template types: Fixed, Source-Balance, Allocation
- Auto-reversal support
- Workflow: Draft → Review → Approve → Post
- 43 templates covering 12 JE families
- Human-in-the-loop approvals (no direct ERP posting)

### 2. Reconciliation Engine
- Balance compare + detail matching
- Heatmap visualization
- Exception workflows
- $1 tolerance threshold
- Evidence linkage (planned)

### 3. Close Management Engine
- Checklist generation from 47 templates
- Timeline tracking (Day-5 close target)
- Dependency chains
- Progress tracking by day

### 4. Cash Flow Engine
- Weekly cash flow forecasting
- Borrowing base calculation
- JPM LOC tracking (account 25100)

### 5. Reporting Control Center
- Financial package analysis
- JE baseline comparison
- Integrity scanning
- Commentary drafting/signoff (planned)

### 6. Insights Engine
- Daily intelligence brief
- Analytics dashboard
- AI-driven pattern detection
- Graph-powered relationship queries

---

## Seven Source File Parsers

| Parser | Source System | Data Type |
|--------|-------------|-----------|
| Ascend | PDI Ascend ERP | GL transactions, trial balance |
| Paylocity | Paylocity | Payroll data, accruals |
| Vroozi | Vroozi Procurement | AP invoices, POs |
| StoneX | StoneX/FC Stone | Hedging positions, commissions |
| Bank | JPM, other banks | Bank statements, transactions |
| Generic | Any CSV | Configurable mapping |
| CSV | Template files | 18 template formats |

---

## Planned Integrations

### Ascend Accounting System (Priority)
- **Architecture:** Ascend → ETL Pipeline → Supabase + Neo4j → Delta Intelligence UI
- **Access Method:** TBD (API, direct DB via SSMS, or file export)
- **Goal:** Near-real-time data sync
- **Status:** Architecture designed, connector not built

### Power BI (Visualization Layer)
- **MCP Servers:** Remote PBI, Modeling, Semantic Model
- **Config:** Setup scripts and env templates built
- **Status:** Keys gathered, not yet deployed

### WorkflowOS (AI Agent Layer)
- **Purpose:** AI-driven automation on top of Delta Intelligence
- **Stack:** Claude API (Haiku/Sonnet/Opus by task), Supabase, macOS Keychain
- **Config Module:** Built (10 files), needs integration
- **Phases:** 1-9 development plan + Phase 9+ multi-user scaling

---

## 10 Workstreams

1. Finance/Accounting
2. Audit/Lender Compliance
3. Systems Transformation
4. AI Strategy
5. Operational Workflows
6. Margin Analytics
7. CFO/Controller Decision Support
8. AP Automation Pilot
9. Close Management
10. Treasury/Borrowing Base

---

## 12 JE Families

1. Depreciation
2. Payroll accrual/reversal
3. Internal billings
4. StoneX hedging
5. Health insurance/HSA
6. Tax
7. Prepaid amortization
8. Interest allocation
9. Fixed assets/FAP
10. Overhead allocation
11. Inventory reserves
12. Weekly cash-flow/borrowing-base

---

## Key Design Principles

- **Local-first:** SQLite ensures offline capability
- **Human-in-the-loop:** AI drafts, humans approve
- **Audit-traceable:** Immutable evidence vault
- **Exception queue:** Rule violations flagged, not silently passed
- **No direct ERP posting:** All changes go through approval workflow
- **Phased automation:** Gated by KPI thresholds
- **Multi-user ready:** Supabase RLS when Taylor and team are onboarded
- **Closed system:** Built to Taylor's exact specifications
