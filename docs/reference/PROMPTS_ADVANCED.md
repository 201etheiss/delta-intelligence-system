# Delta Intelligence System — Advanced Implementation Prompts

**Last Updated:** 2026-03-31

Deep implementation prompts for each integration, data pipeline, and agent. These go beyond the basic prompts in PROMPTS.md — each one is self-contained with all context needed.

---

## PROMPT A1: Ascend Database Migration & Live Connection

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

---

## PROMPT A2: Salesforce Data Pull & Neo4j Sync

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

---

## PROMPT A3: Samsara Fleet → Equipment Tracker → Depreciation Pipeline

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

---

## PROMPT A4: Unified Data Architecture — Vector + Graph + Time-Series + RAG

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

I need you to design and document:

A) VECTOR LAYER (Supabase pgvector):
   - Enable pgvector extension
   - Create embedding tables for: JE descriptions, recon notes, variance commentary, intelligence briefs, source documents
   - Embedding model selection (OpenAI ada-002 vs Anthropic embeddings vs open-source)
   - Vector similarity search functions for RAG queries
   - Example: "Find similar JEs to this payroll accrual" → returns semantically similar entries

B) RAG PIPELINE:
   - Ingest flow: document → chunk → embed → store in pgvector
   - Query flow: user question → embed → vector search → context assembly → Claude API → response
   - Sources to embed: all 134 master context records, all JE templates, all recon rules, all close templates, historical JEs, compliance documents
   - Retrieval strategy: hybrid (vector similarity + keyword + metadata filters)

C) TIGERGRAPH TIME-SERIES GRAPH:
   - Schema design for temporal relationships (account balance over time, JE chains, close velocity)
   - Causal chain analysis: "What caused this variance?" → trace back through JE → source data → system
   - Temporal pattern detection: recurring anomalies, seasonal trends, late-posting patterns
   - GSQL queries for: close velocity trending, exception aging patterns, cash flow cycles

D) DATA LAKE LAYER:
   - Architecture: landing zone → raw → curated → serving
   - Ingestion from all sources: Ascend, Paylocity, Vroozi, StoneX, JPM, Samsara, Salesforce
   - Format: Parquet on object storage (Supabase Storage or S3)
   - Catalog: table of contents for all datasets with schema, freshness, lineage
   - CDC (Change Data Capture) strategy for incremental loads

E) UNIFIED QUERY LAYER:
   - Single API that can query across all stores
   - GraphQL or REST endpoint that: joins Supabase relational + Neo4j graph + TigerGraph temporal + pgvector semantic
   - Example query: "Show me all late-posted JEs for account 10345, similar historical patterns, causal chain, and related entity relationships"

Build this as a comprehensive architecture document with diagrams, schema definitions, and implementation steps.
```

---

## PROMPT A5: Power BI Integration with Live Data

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
5. Build an executive dashboard with:
   - KPI cards: Close Day, Exception Count, Cash Position, JE Pipeline
   - Close progress bar chart (by day)
   - Exception aging donut chart
   - Cash flow trend line (13-week)
   - Flash summary comparison (current vs prior period)

6. Set up scheduled refresh from Supabase (every 15 minutes during business hours)
7. Generate embed URL for the dashboard to display within Delta Intelligence UI
```

---

## PROMPT A6: Full Agent Deployment — WorkflowOS

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

---

## PROMPT A7: Supabase Vector + RAG Pipeline

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

---

## PROMPT A8: TigerGraph Time-Series Graph Setup

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

## META PROMPT: Full Architecture Session Loader

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
