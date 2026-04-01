# Delta Intelligence System — Claude Prompts

**Last Updated:** 2026-03-31

Ready-to-use prompts for planning and building every component of Delta Intelligence. Copy-paste into Claude Code or Cowork sessions. Each prompt includes the context Claude needs to pick up where the last session left off.

---

## How to Use These Prompts

1. **Start a new Claude session**
2. **Copy the prompt for the workstream you want to tackle**
3. **Paste it as your first message**
4. **Claude will have full context and can begin immediately**

For best results, also share the relevant .md files from this documentation folder so Claude has the latest project state.

---

## PROMPT 1: Git Init & GitHub Push

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

---

## PROMPT 2: Supabase Schema Deployment

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

---

## PROMPT 3: Neo4j Seeding

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

---

## PROMPT 4: JE Template Hardening (12 Families)

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

## PROMPT 5: Source File Parser Hardening

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

## PROMPT 6: Controller Cockpit Build

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

---

## PROMPT 7: Ascend Integration Pipeline

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

---

## PROMPT 8: Delta Intelligence Brief

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

## PROMPT 9: Financial Package Production

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

This builds on the existing Reporting Control Center (which already has analysis and baseline comparison) and the Commentary Manager concept.
```

---

## PROMPT 10: Evidence Vault & Audit Readiness

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

This supports the "zero control failures" and "audit-traceable" design principles.
```

---

## PROMPT 11: Multi-User Rollout

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

## PROMPT 12: Full System Health Check & Alignment

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

## META PROMPT: Session Context Loader

Use this at the start of ANY new Claude session to load full project context:

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
