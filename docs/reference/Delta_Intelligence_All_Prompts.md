# Delta Intelligence — Complete Claude Prompt Library

**Generated:** 2026-03-31
**Total Prompts:** 20 (12 core + 8 advanced) + 2 meta loaders

Copy-paste any prompt below into a new Claude session. Each is self-contained with all context needed.

---

## META: Session Context Loaders

### Quick Loader (6 files)

```
I'm working on the Delta Intelligence System v2 for Delta360 Energy. Before we start, read these context files from my Desktop/Delta-Intelligence-Docs folder:

1. PROJECT_STATUS.md — current state of everything
2. ARCHITECTURE.md — system architecture and stack
3. CHANGELOG.md — what's been built and changed
4. OPTIMIZATIONS.md — known gaps and fixes needed
5. USE_CASES.md — all features and expansion opportunities
6. ROADMAP.md — prioritized development path

After reading all 6 files, give me a brief summary of where we are and what the highest-priority next action is. Then I'll tell you what I want to work on.
```

### Full Architecture Loader (13 files)

```
I'm building Delta Intelligence System v2 — a corporate controller operating platform for Delta360 Energy (fuel distribution company, 17 people mapped, 10+ systems).

Before we start, read ALL files in ~/Desktop/Delta-Intelligence-Docs/:
1. PROJECT_STATUS.md — current state
2. ARCHITECTURE.md — system components
3. CHANGELOG.md — what's been built
4. OPTIMIZATIONS.md — known gaps
5. USE_CASES.md — all features (30 use cases)
6. ROADMAP.md — 6-wave development plan
7. INTEGRATIONS.md — 16 system integration plans
8. DATA_MAPPINGS.md — field-level source→target mappings
9. DATABASE_SCHEMA.md — 24 Supabase tables + SQLite views
10. NEO4J_SCHEMA.md — 13 node types, 23 relationship types
11. AGENT_CONFIGS.md — 9 WorkflowOS AI agents
12. PROMPTS_ADVANCED.md — deep implementation prompts
13. UNIFIED_DATA_ARCHITECTURE.md — Vector + Graph + Time-Series + RAG + Data Lake

After reading all 13 files, give me:
1. A 3-sentence status summary
2. The single highest-value next action
3. Any blocking issues I should resolve first

Then I'll tell you what I want to work on.
```

---

## WAVE 0: Foundation Prompts

### Prompt 1: Git Init & GitHub Push

```
I'm working on the Delta Intelligence System v2 for Delta360 Energy. The project is running locally on localhost:3004 but has NEVER been pushed to GitHub.

The GitHub repo is already created: https://github.com/201etheiss/delta-intelligence-system.git (private)
PAT: REDACTED_GITHUB_PAT

I need you to:
1. Navigate to my project folder (it's running on localhost:3004)
2. Initialize git if not already done
3. Create a proper .gitignore (exclude node_modules, .env, __pycache__, .sqlite, etc.)
4. Stage all files
5. Create initial commit
6. Set remote origin using the PAT for authentication
7. Push to main branch
8. Verify the push succeeded

Do NOT include .env files, credentials, or database files in the commit.
```

### Prompt 2: Supabase Schema Deployment

```
I need to deploy the Supabase schema for Delta Intelligence System v2.

Supabase project: https://ohbqjralhrjqoftkkety.supabase.co
DB connection: postgresql://postgres:tmvlsu80800@db.ohbqjralhrjqoftkkety.supabase.co:5432/postgres

The schema should create 24 tables with RLS policies. The v2 app has these engines that need tables:
- Journal Entries: templates, drafts, approvals, posted entries
- Reconciliations: rules, runs, exceptions, evidence
- Close Management: templates, checklists, timeline, dependencies
- Cash Flow: forecasts, actuals, borrowing base
- Reporting: packages, integrity scans, commentary
- Insights: briefs, analytics, patterns
- Auth: users, roles, sessions
- Source Files: imports, parse results, mappings

The app uses JWT auth with roles: Admin, Controller, Analyst, Viewer.

Please:
1. Read the existing supabase_migration.sql in the project if it exists
2. Verify it covers all 24 tables
3. Run it against the Supabase instance
4. Verify all tables created
5. Test RLS policies
6. Report any errors
```

### Prompt 3: Neo4j Seeding

```
I need to seed the Neo4j Aura instance for Delta Intelligence System v2.

Neo4j connection:
- URI: neo4j+s://2b6eeb9d.databases.neo4j.io
- Username: 2b6eeb9d
- Password: b0rioWSy8m6fl4akYbwbEAKRz0yMXtjhE3KZ2rKWx9o

The graph schema has 13 node types and 23 relationship types covering:
- Organization structure (17 people, roles, reporting lines)
- Account relationships (71 accounts, GL hierarchy)
- Close dependencies (47 templates, sequencing, blockers)
- Entity structures (Delta Fuel Company, divisions)
- System integrations (10 systems mapped)
- Workstream relationships (10 workstreams, 20 modules)
- JE family dependencies (12 JE families, source→template→posting chains)

Please:
1. Read seed_neo4j.py in the project
2. Verify it covers all 13 node types
3. Run the seeder
4. Verify nodes and relationships created
5. Run sample Cypher queries to validate the graph
6. Report counts for each node type
```

### Prompt 12: Full System Health Check

```
I need a comprehensive health check of the Delta Intelligence System v2 running on localhost:3004.

Please:
1. Navigate to the project directory
2. Read the package.json, requirements.txt/pyproject.toml, and .env file
3. Check all dependencies are installed
4. Verify the backend starts and all 101 API endpoints respond
5. Verify the frontend builds and renders all 13 pages
6. Test the database connections: SQLite (should work), Supabase (check if schema exists), Neo4j (check if seeded)
7. Run through each of the 6 engines and test a basic operation
8. Check for console errors, unhandled exceptions, and broken routes
9. Verify the auth flow works (login, JWT, role check)
10. Generate a health report with: what works, what's broken, what's missing, what needs configuration

I need this to establish a clean baseline before starting the next phase of development. Be thorough — I want to know the exact state of every component.
```

---

## WAVE 1: Core Value Prompts

### Prompt 6: Controller Cockpit Build

```
I need to build the Controller Cockpit for Delta Intelligence v2 — Taylor Veazey's single-pane-of-glass view.

This is a new dashboard page that consolidates ALL operational KPIs:

1. Close Progress — visual timeline showing close tasks by day (target: Day 5), with green/yellow/red status
2. Exception Aging — count and aging of open exceptions across all engines
3. JE Status — pipeline view: pending drafts, in review, approved, posted, rejected (with counts and amounts)
4. Recon Status — completed/in-progress/overdue reconciliations with heatmap
5. Audit/PBC Aging — open auditor requests with SLA countdown
6. Cash Flow Status — current position, forecast vs actual, borrowing base utilization

Design requirements:
- Single page, no scrolling for the top-level KPIs
- Click-through to detail pages
- Navy/blue theme matching existing Delta360 branding
- Recharts for visualizations
- Auto-refresh every 5 minutes
- Pull from all 6 engines via existing API endpoints

The existing React frontend has 13 pages. This would be page 14, but should replace the current Dashboard as the default home page for Controller role users.
```

### Prompt 8: Delta Intelligence Brief

```
Build the Delta Intelligence Brief feature for Delta Intelligence v2. This is an automated daily/weekly brief for the Controller and CFO.

Brief structure (from the Delta Daily Intelligence Brief v1.0 framework):
1. Executive Summary — 3-5 sentence overview of where things stand
2. Today's Priorities — ranked list with owners and deadlines
3. Confirmed Findings — data-backed observations from overnight processing
4. Open Reconciliation Issues — aged exceptions with amounts and owners
5. Risks & Controls — any control failures, threshold breaches, or emerging risks
6. AI/System Opportunities — automation candidates the system identified
7. Decisions Needed — items requiring Taylor's or leadership's input
8. Deliverables Due — upcoming deadlines (close dates, audit requests, filings)
9. Assumptions & Caveats — what the brief is based on and its limitations
10. Next Actions — specific next steps with assignments

Implementation:
- API endpoint that generates the brief on demand
- Scheduled generation (daily at 6am, weekly on Monday)
- Pull data from all 6 engines
- AI-assisted narrative generation using Claude API
- Store generated briefs with version history
- Display in UI as dedicated page with archive
- Email distribution option (Taylor, Adam, Mike)

The WorkflowOS config module has a Claude API wrapper with model selection (Haiku for simple, Sonnet for analysis). Use that pattern.
```

---

## WAVE 2: Data Pipeline Prompts

### Prompt 7: Ascend Integration Pipeline

```
I need to build the Ascend integration pipeline for Delta Intelligence v2. Ascend (PDI Ascend) is our ERP — the source of truth for all GL data.

Architecture: Ascend → ETL Pipeline → Supabase + Neo4j → Delta Intelligence UI

I need to determine the best data access method. The options are:
1. REST API (if Ascend exposes one)
2. Direct database connection via SSMS (SQL Server)
3. Automated file exports (CSV/Excel on a schedule)

For whichever method we use, I need:
1. Connection setup and authentication
2. Data extraction for: GL transactions, trial balance, chart of accounts, AP transactions, AR aging
3. Transformation layer: map Ascend fields to Delta Intelligence schema
4. Dual-load into both Supabase (structured tables) and Neo4j (relationship graph)
5. Near-real-time sync (ideally every 15 minutes, minimum daily)
6. Error handling, retry logic, and sync status monitoring
7. Historical backfill capability

The Supabase instance is at ohbqjralhrjqoftkkety.supabase.co
Neo4j is at neo4j+s://2b6eeb9d.databases.neo4j.io

Start by researching what data access methods PDI Ascend supports, then propose the architecture.
```

### Prompt 5: Source File Parser Hardening

```
I'm hardening the 7 source file parsers in Delta Intelligence v2 for Delta360 Energy. The parsers exist but most expect clean CSVs. Real exports from our systems have messy formats.

The 7 parsers and their source systems:
1. Ascend (PDI Ascend ERP) — GL transactions, trial balance, chart of accounts
2. Paylocity — payroll registers, accrual reports, benefit deductions
3. Vroozi — AP invoices, POs, receipt matching
4. StoneX — hedging statements, commission reports, position summaries
5. Bank (JPM) — bank statements, cleared checks, wire transfers
6. Generic CSV — configurable column mapping
7. FAP — fixed asset detail, depreciation schedules

For each parser, I need you to:
1. Read the existing parser code
2. Identify assumptions about file format
3. Add robust error handling for: missing columns, extra columns, different date formats, currency formatting, encoding issues, blank rows, merged cells
4. Add validation that flags suspicious data (negative amounts where unexpected, dates out of range, duplicate entries)
5. Add a "preview" mode that shows parsed output before committing to database
6. Test with the 18 CSV template files already in the project

If you need sample files from any system, tell me what format you need and I'll export them.
```

---

## WAVE 3: JE Production Prompts

### Prompt 4: JE Template Hardening (12 Families)

```
I'm hardening the Journal Entry templates in Delta Intelligence System v2 for Delta360 Energy. Currently 43 templates exist across 12 JE families, but many are placeholder-level and lack production-grade calculation logic.

The 12 JE families are:
1. Depreciation — needs accounts by entity, straight-line calc from FAP export
2. Payroll accrual/reversal — needs Paylocity data mapping, pay period calculations
3. Internal billings — intercompany allocation logic
4. StoneX hedging — needs StoneX statement parsing, realized/unrealized split, account 10345 (Broker-FC Stone), 68115 (commission), 80200 (Hedging Gain/Loss)
5. Health insurance/HSA — needs admin-fee GL mapping, account 22630 (HSA liability)
6. Tax — needs tax account structure from Bill Didsbury
7. Prepaid amortization — straight-line over term
8. Interest allocation — needs payable by note mapping
9. Fixed assets/FAP — needs FAP export parser, account 17200 (Vehicles), 17800 (CIP)
10. Overhead allocation — needs allocation methodology
11. Inventory reserves — needs reserve calculation logic
12. Weekly cash-flow/borrowing base — needs JPM LOC (25100) tracking

For each family, I need you to:
1. Read the existing template code
2. Identify what's placeholder vs production-ready
3. Build production-grade calculation logic
4. Wire it to the appropriate source file parser
5. Add validation rules and error handling
6. Test with sample data

Start with families 1, 2, and 5 (Depreciation, Payroll, Health Insurance) as they have the most complete source data. Flag any gaps that need my input.
```

---

## WAVE 4: Reporting & Audit Prompts

### Prompt 9: Financial Package Production

```
Build the end-to-end Financial Package Production pipeline for Delta Intelligence v2.

Current state: The Reporting Control Center can analyze packages and scan for integrity issues. The 2025-12-31 package had 8 integrity issues and the flash report was anchored to the wrong month.

I need a production pipeline that:
1. Pulls trial balance from Ascend (or latest import)
2. Generates financial statements: Income Statement, Balance Sheet, Cash Flow
3. Performs automated tie-out checks (BS balances to TB, IS flows to BS changes, CF reconciles to cash)
4. Runs integrity scanning (the 8 issue types found in 2025-12-31 plus any others)
5. Flags formula errors, broken links, inconsistencies
6. Generates flash report (revenue, EBITDA, cash position) by Day 2
7. Generates commentary templates for each material variance
8. Commentary drafting workflow: AI drafts → analyst reviews → controller approves
9. Package assembly: combines all components with table of contents
10. Publish-readiness gate: must pass all checks before distribution
11. Distribution tracking: who received what version when

Controls:
- $5K materiality threshold for variance commentary
- Package can't publish with unresolved integrity issues
- All commentary requires signoff
- Version history maintained
```

### Prompt 10: Evidence Vault & Audit Readiness

```
Build the Immutable Evidence Vault for Delta Intelligence v2.

Every action in the system should be evidence-traced. This means:
1. Every JE (draft, review, approve, post, reject) stores: who, when, what changed, supporting docs
2. Every reconciliation run stores: inputs, matching results, exceptions, resolution, attachments
3. Every close task stores: completion evidence, reviewer sign-off, blocking issues
4. Every source file import stores: original file, parse results, error log, who uploaded

Technical implementation:
- Use Supabase Storage for document/attachment storage
- Immutability: once evidence is created, it can never be modified or deleted (append-only)
- Timestamps from server, not client
- User identification via JWT, not self-reported
- Hash/checksum on stored documents to detect tampering
- Retention policies: 7 years minimum for financial records

Audit readiness features:
- PBC (Prepared by Client) request tracker
- Auditor can submit requests through a portal
- System auto-pulls matching evidence from the vault
- Aging dashboard for open audit requests
- Export capability for auditor consumption (PDF package)
```

---

## WAVE 5: Multi-User & AI Prompts

### Prompt 11: Multi-User Rollout

```
Enable multi-user access for Delta Intelligence v2 via Supabase auth and RLS.

The 17 people mapped in the system need role-based access:

ADMIN role (full access):
- Evan Theiss (system builder)

CONTROLLER role (everything except system config):
- Taylor Veazey (Corporate Controller)
- Lea Centanni (Controller)

ANALYST role (view + edit within their workstreams):
- David Carmichael (Director of Accounting)
- Bill Didsbury (Tax Manager)

EXECUTIVE role (read-only dashboards, briefs, flash reports):
- Adam Vegas (President/CEO)
- Mike Long (Finance executive)
- Robert Stewart (VP Sales)
- Sam Taylor (VP Oil & Gas)

VIEWER role (read-only specific pages):
- Brad Vencil (VP Technology)
- Operations managers, sales team

Implementation:
1. Supabase Auth with email/password (no SSO needed initially)
2. RLS policies on all 24 tables enforcing role-based access
3. UI adapts to show/hide features based on role
4. Invitation flow: admin sends invite, user sets password
5. Session management with JWT refresh
6. Audit log of all login/logout events

Start by setting up the auth flow, then apply RLS policies, then update the frontend routing.
```

---

## ADVANCED PROMPTS

### A1: Ascend Database Migration & Live Connection

```
I have a 167GB Ascend (PDI) SQL Server backup at ~/Desktop/Ascend-021826.bak and a complete migration toolkit at ~/Desktop/ascend-migration/.

The toolkit has 5 steps:
1. step1-setup-sqlserver.sh — Pulls SQL Server Docker image
2. step2-restore-bak.sh — Restores the .bak into Docker SQL Server
3. step3-export-schema.sh — Exports schema inventory to CSV
4. step4-export-to-postgres.py — Migrates all tables to local PostgreSQL (pymssql → psycopg2)
5. step5-cleanup.sh — Removes Docker SQL Server after migration

Prerequisites already installed:
- Postgres.app v18 (running)
- Docker Desktop (needs to be started)

SQL Server credentials: sa / Ascend2026!
PostgreSQL: localhost:5432, user: evantheiss, database: ascend

I need you to:
1. Verify Docker Desktop is running (if not, tell me to start it)
2. Run the full migration pipeline (run-all.sh or steps individually)
3. After migration completes, inventory the PostgreSQL 'ascend' database:
   - List all schemas and table counts
   - List tables with row counts, sorted by size
   - Identify the GL transaction tables, AP tables, AR tables, Chart of Accounts
   - Export the schema inventory to a CSV
4. Build a mapping document: Ascend table names → Delta Intelligence target tables
5. Create initial ETL queries that extract what the 6 Delta Intelligence engines need

The type mapping is already handled in step4 (see TYPE_MAP dict). The script handles schemas, primary keys, and foreign keys.

Report the full inventory when done — I need to know exactly what's in this 167GB database.
```

### A2: Salesforce Data Pull & Neo4j Sync

```
I have Salesforce connected via MCP with full SOQL query access. I need to pull key data and sync it into Neo4j.

Salesforce org has 1,806 objects including these key custom objects:
- Credit_Application__c — credit decisions
- Check_In__c — field check-ins
- FRAC__c — frac operations
- Permit__c — operational permits
- Sales_To_Do__c — sales tasks
- Terminals_and_Refineries__c — supply locations
- Well__c — well tracking
- Zip5Assignment__c — territory mapping

Plus standard objects: Account, Contact, Opportunity, Lead, Case
Plus installed packages: D&B (DNBI), ZoomInfo (DOZISF), DocuSign (dfsle), Salesforce Maps (maps), Pardot (pi), Formstack (VisualAntidote), PMT (inov8)

Neo4j connection:
- URI: neo4j+s://2b6eeb9d.databases.neo4j.io
- Username: 2b6eeb9d
- Password: b0rioWSy8m6fl4akYbwbEAKRz0yMXtjhE3KZ2rKWx9o

I need you to:
1. Query each key Salesforce object — describe fields, get record counts
2. Pull all Account records with credit-relevant fields
3. Pull all Opportunity records (pipeline for revenue forecasting)
4. Pull all Credit_Application__c records
5. Pull Terminals_and_Refineries__c, Well__c (operations data)
6. For each pulled dataset, create Neo4j nodes with appropriate labels
7. Create relationships:
   - Account → Credit_Application (HAS_CREDIT_APP)
   - Account → Opportunity (HAS_OPPORTUNITY)
   - Account → Contact (HAS_CONTACT)
   - Terminal → geographic relationships
   - Well → Entity relationships
8. Build SOQL queries that can run on schedule for ongoing sync
9. Report: total nodes created, relationships created, any data quality issues
```

### A3: Samsara Fleet → Equipment Tracker → Depreciation Pipeline

```
I have 178 vehicles in Samsara and an Ascend equipment master list with matching equipment. I need to:

1. Build the Samsara Vehicle ID → Ascend Equipment ID crosswalk
   - Samsara vehicles are in ~/Desktop/Delta360_Master_Asset_Index.xlsx (sheet: "Samsara Vehicles")
   - Ascend equipment is in ~/Desktop/Ascend Project.xlsx (sheet: "Ascend Master List")
   - Match by: vehicle name/code, VIN where available, make/model/year

2. For each matched pair, create a unified record with:
   - Samsara: vehicle_id, name, vin, make, model, year, license_plate, lat, lon, odometer, engine_hours
   - Ascend: equipment_id, code, standard_acct_no, description, type, ownership, tank_size, barcode

3. Store the crosswalk in Supabase (fleet_vehicles table)

4. Build the depreciation calculation pipeline:
   - For each vehicle, get Ascend cost basis from GL
   - Get current odometer and engine hours from Samsara
   - Calculate depreciation using straight-line method (standard) and/or mileage-based (if applicable)
   - Generate depreciation JE draft for Family 1

5. Create a Neo4j graph: Vehicle → OWNED_BY → Entity, Vehicle → GL_ACCOUNT → Account, Vehicle → ASSIGNED_TO → Department

Supabase: https://ohbqjralhrjqoftkkety.supabase.co
```

### A4: Unified Data Architecture — Vector + Graph + Time-Series + RAG

```
I'm building the unified data architecture for Delta Intelligence that ties together:

1. Supabase PostgreSQL — structured relational data (24 tables, all financial engines)
2. Supabase Vector (pgvector) — embeddings for RAG, semantic search over documents/JEs/commentary
3. Neo4j Aura — entity relationship graph (people, accounts, systems, dependencies)
4. TigerGraph — time-series graph linking, temporal pattern detection, causal chain analysis
5. Data Lake — unified ingestion/egress layer for all source systems

Current infrastructure:
- Supabase: https://ohbqjralhrjqoftkkety.supabase.co (PostgreSQL 15 with pgvector extension)
- Neo4j: neo4j+s://2b6eeb9d.databases.neo4j.io
- TimescaleDB: Already has hypertables for fleet data (gps_readings, engine_readings, hos_logs)

Design and document:

A) VECTOR LAYER (Supabase pgvector):
   - Enable pgvector extension
   - Create embedding tables for: JE descriptions, recon notes, variance commentary, intelligence briefs, source documents
   - Vector similarity search functions for RAG queries

B) RAG PIPELINE:
   - Ingest flow: document → chunk → embed → store in pgvector
   - Query flow: user question → embed → vector search → context assembly → Claude API → response
   - Hybrid retrieval: vector similarity + keyword + metadata filters

C) TIGERGRAPH TIME-SERIES GRAPH:
   - Schema for temporal relationships
   - Causal chain analysis and temporal pattern detection
   - GSQL queries for close velocity, late-posting patterns, cash flow cycles

D) DATA LAKE LAYER:
   - Architecture: landing zone → raw → curated → serving
   - CDC strategy for incremental loads

E) UNIFIED QUERY LAYER:
   - Single API across all stores
   - GraphQL or REST that joins relational + graph + temporal + semantic
```

### A5: Power BI Integration with Live Data

```
I have Power BI MCP connected with full tool access. My Supabase instance has financial data.

Supabase connection:
- Host: db.ohbqjralhrjqoftkkety.supabase.co
- Port: 5432
- Database: postgres
- User: postgres
- Password: tmvlsu80800

I need you to:
1. List my current Power BI workspaces
2. Create a workspace called "Delta360 Intelligence" if it doesn't exist
3. Create a push dataset with these tables:
   - close_progress (period, day, target_tasks, completed_tasks, pct_complete)
   - je_pipeline (period, status, count, total_amount)
   - exception_aging (engine, age_bucket, count, total_amount)
   - cash_position (date, available_cash, loc_outstanding, loc_remaining)
   - flash_summary (period, revenue, cogs, gross_margin, ebitda, cash)

4. Push sample data to validate the dataset works
5. Build an executive dashboard with KPI cards, charts, and trend lines
6. Set up scheduled refresh from Supabase (every 15 minutes during business hours)
7. Generate embed URL for the dashboard to display within Delta Intelligence UI
```

### A6: Full Agent Deployment — WorkflowOS

```
I'm deploying the WorkflowOS AI agent system for Delta Intelligence. The config module was built in a previous session with these components:
- SecretsManager (encrypted credential storage)
- Settings module (YAML-based config)
- Setup wizard (interactive first-run)
- Validation module
- Supabase client wrapper
- Claude API wrapper (model selection: Haiku/Sonnet/Opus)

I need you to build and deploy all 9 agents defined in AGENT_CONFIGS.md:

1. Close Management Agent — monitors close progress, flags blockers
2. Journal Entry Agent — auto-generates JE drafts from source data
3. Reconciliation Agent — runs scheduled recons, flags exceptions
4. Intelligence Brief Agent — generates daily/weekly briefs
5. AP Intelligence Agent — auto-codes invoices, detects duplicates
6. Cash Flow Agent — tracks position, forecasts, calculates borrowing base
7. Reporting/Package Agent — assembles financial packages
8. Exception Monitor Agent — continuous exception monitoring with aging
9. Audit Readiness Agent — monitors PBC requests, auto-pulls evidence

For each agent, I need:
- Python module with the agent logic
- Cron schedule configuration
- Database queries it runs
- Output targets (Supabase tables, notifications)
- Error handling and retry logic
- Logging to audit_log table

Start with agents 1, 2, and 4 (Close, JE, Brief) as they provide the most immediate value to Taylor.

Claude API key is in ~/.zshrc as ANTHROPIC_API_KEY.
Supabase credentials are in the project .env file.
```

### A7: Supabase Vector + RAG Pipeline

```
I need to set up the RAG pipeline in Supabase for Delta Intelligence.

Supabase: https://ohbqjralhrjqoftkkety.supabase.co
DB: postgresql://postgres:tmvlsu80800@db.ohbqjralhrjqoftkkety.supabase.co:5432/postgres

Step 1 — Enable pgvector:
Run: CREATE EXTENSION IF NOT EXISTS vector;

Step 2 — Create embedding tables:
- document_embeddings (for uploaded documents, reports, policies)
- je_embeddings (for journal entry descriptions and patterns)
- commentary_embeddings (for variance commentary and explanations)
- brief_embeddings (for intelligence brief sections)
- context_embeddings (for the 134 master context records)

Each table needs: id, content (text), embedding (vector(1536)), metadata (jsonb), created_at

Step 3 — Build the embedding pipeline:
- Use Anthropic's embedding model or OpenAI ada-002
- Chunking strategy: 500 tokens with 50 token overlap
- Metadata: source_type, source_id, period, account_number, entity, tags

Step 4 — Build RAG query function:
- Input: user question (natural language)
- Process: embed question → vector similarity search → assemble context → call Claude
- Output: grounded answer with source citations

Step 5 — Seed with initial data:
- Embed all 134 master context records
- Embed all 43 JE template descriptions
- Embed all 37 recon rule descriptions
- Embed all 47 close template descriptions
- Embed the 12 control/metric definitions

Step 6 — Build a test endpoint:
- POST /api/rag/query with body: { "question": "What's the HSA liability account and how do we calculate the accrual?" }
- Should return answer grounded in the embedded context

Build this step by step and test each stage.
```

### A8: TigerGraph Time-Series Graph Setup

```
I need to set up TigerGraph for temporal graph analytics in Delta Intelligence.

TigerGraph will handle what Neo4j and TimescaleDB can't do well alone: time-linked graph traversal — tracing causal chains through time across entity relationships.

Use cases:
1. "What caused the $50K variance in account 80200 this month?" → Trace: variance → JE posted → StoneX settlement → hedging position opened 3 months ago
2. "Show me the close velocity trend over the last 6 months" → Time-series graph of close tasks completing over Days 1-10
3. "Which vendor invoices are consistently late?" → Temporal pattern across AP aging nodes
4. "Predict next month's cash position" → Graph-based forecast using historical cash flow nodes

Schema design needed:
- Vertex types: Account, JournalEntry, SourceTransaction, Person, Period, Exception, CashFlow
- Edge types: POSTED_TO (JE→Account), SOURCED_FROM (JE→SourceTransaction), OCCURRED_IN (→Period), CAUSED_BY (Exception→JE), APPROVED_BY (JE→Person)
- Temporal properties: All vertices and edges have timestamp attributes

GSQL queries to build:
1. Causal chain traversal (n-hop with time ordering)
2. Close velocity calculation (tasks/day over periods)
3. Late-posting pattern detection (transactions where post_date >> transaction_date)
4. Cash flow cycle detection (periodic patterns in inflows/outflows)
5. Anomaly detection (deviations from historical patterns)

Either use TigerGraph Cloud (tgcloud.io) or self-hosted Docker.
Design the schema, write the GSQL, and provide the loading scripts.
```

---

## PROMPT SELECTION GUIDE

| What You Want To Do | Use Prompt | Wave |
|--------------------|-----------:|------|
| Push code to GitHub | 1 | 0 |
| Deploy cloud database schema | 2 | 0 |
| Seed the graph database | 3 | 0 |
| Run a full system health check | 12 | 0 |
| Build Taylor's cockpit dashboard | 6 | 1 |
| Build AI-generated intelligence brief | 8 | 1 |
| Connect to Ascend ERP | 7 | 2 |
| Harden file parsers for real data | 5 | 2 |
| Make JE templates production-grade | 4 | 3 |
| Build end-to-end financial packages | 9 | 4 |
| Build immutable audit trail | 10 | 4 |
| Enable multi-user access | 11 | 5 |
| Migrate 167GB Ascend backup | A1 | Advanced |
| Pull Salesforce data into graph | A2 | Advanced |
| Build fleet depreciation pipeline | A3 | Advanced |
| Design unified data architecture | A4 | Advanced |
| Deploy Power BI dashboards | A5 | Advanced |
| Deploy all 9 AI agents | A6 | Advanced |
| Build RAG semantic search | A7 | Advanced |
| Set up temporal graph analytics | A8 | Advanced |
| Start any new session (quick) | Meta: Quick Loader | — |
| Start any new session (full) | Meta: Full Loader | — |
