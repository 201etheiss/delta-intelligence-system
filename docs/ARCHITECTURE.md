# Delta Intelligence — Technical Architecture

## System Overview

Delta Intelligence is an enterprise AI platform built on Next.js 14, React 18, and TypeScript. It provides natural-language access to all Delta360 data sources through a multi-model AI router, an orchestrated query pipeline, and a unified data gateway.

**Stack:**
- Frontend: Next.js 14 / React 18 / TypeScript / Tailwind CSS / shadcn/ui
- AI Models: Anthropic Claude (Haiku/Sonnet/Opus), OpenAI GPT-4o, Google Gemini Flash
- Data Layer: Delta360 Unified Data Gateway (7 services, 78+ endpoints)
- Auth: Microsoft 365 SSO via NextAuth + MSAL
- Deployment: Vercel
- File Generation: docx, xlsx, jspdf, pptxgenjs, jszip

## Data Sources (via Unified Gateway)

| Service | Endpoints | Data |
|---------|-----------|------|
| Ascend SQL | 34 | Production ERP: customers, AR, AP, GL, revenue, invoices, equipment, taxes, sites, 5,105 SQL tables |
| Salesforce | 11 | CRM: 21,311 accounts, 2,185 contacts, 690 opportunities, 3,359 leads, 128 users |
| Samsara | 11 | Fleet: 160 vehicles, 237 drivers, GPS locations, HOS, geofences, tags |
| Power BI | 4 | 5 workspaces (datasets/reports app-restricted) |
| Microsoft 365 | 4 | SharePoint sites, document search, users, custom Graph queries |
| Vroozi | 7 | Procurement: 21K+ POs, 125 users, 889 GL accounts, 2,605 catalogs |
| Fleet Panda | 4 | Assets, trucks, tanks, customers |

Gateway base URL is configurable (Cloudflare tunnel or direct). Auth uses role-mapped API keys passed server-side (never exposed to client).

---

## Multi-Model Routing

The router (`src/lib/router.ts`) scores each query on a 0-100 complexity scale and routes to the cheapest model that meets the requirement.

### Model Tiers

| Tier | Model | Provider | Cost (per 1K input) | Context | Use Case |
|------|-------|----------|---------------------|---------|----------|
| 1 | Haiku | Anthropic | $0.0008 | 200K | Simple lookups, formatting, aggregation |
| 1 | Gemini Flash | Google | $0.000075 | 1M | Bulk data processing, large context |
| 2 | Sonnet | Anthropic | $0.003 | 200K | Analysis, multi-step reasoning, code |
| 2 | GPT-4o | OpenAI | $0.0025 | 128K | Alternative reasoning, second opinion |
| 3 | Opus | Anthropic | $0.015 | 200K | Deep strategy, cross-domain synthesis |

### Scoring Algorithm

1. Context size scoring: >100K tokens (+30), >50K (+20), >10K (+10)
2. Expert-level patterns: strategy, recommendation, due diligence, M&A (+40)
3. Cross-domain synthesis: "across all", "correlate between", "holistic" (+30)
4. Multi-step analysis: why, explain, compare, trend, forecast (+20)
5. Multi-step chaining: 3+ conjunctions, sequential instructions (+15)
6. Pricing queries: price, quote, bid, rate card (+15)
7. Aggregation: summarize, total, top N, rank (+10)
8. Long queries: >50 words (+10), >25 words (+5)

### Complexity Mapping

| Score | Complexity | Model |
|-------|-----------|-------|
| 0-14 | Simple | Haiku |
| 15-29 | Moderate | Haiku |
| 30-59 | Complex | Sonnet |
| 60+ | Expert | Opus |
| >100K context | Bulk | Gemini Flash |

Capability check: if the selected model lacks a required capability (e.g., `long_context`), the router upgrades to the cheapest Anthropic model that has it.

---

## Orchestrator Pattern

For complex queries (score >= 30), the orchestrator (`src/lib/orchestrator.ts`) uses a planner-workers-synthesizer architecture.

### Pipeline

```
User Query
    |
    v
[1] PLANNER (Haiku) — Analyzes query, selects endpoints, creates execution plan
    |
    v
[2] WORKERS (parallel HTTP) — Execute 1-5 gateway calls (zero LLM tokens)
    |
    v
[3] SYNTHESIZER (Sonnet/Opus) — Compresses gathered data into final answer
```

### Cost Savings

Single-model approach (Sonnet): ~55K tokens x $3/M = $0.165
Orchestrated: Plan (2K x $0.80/M) + Synth (8K x $3/M) = $0.026 — 84% savings

### Streaming Variant

`src/lib/orchestrator-stream.ts` wraps the same architecture but streams the synthesizer output via SSE, so users see incremental results during long analyses.

---

## Token Optimization (4-Layer Pipeline)

Defined in `src/lib/token-optimizer.ts`:

### Layer 1: Schema Index (~500 tokens vs ~3K)

A pre-built compact reference of all data sources. The model receives this "table of contents" instead of full endpoint documentation. Includes key SQL join patterns, verified views, and field names.

### Layer 2: Query Planner

Pre-routes queries to specific endpoints before the model runs. Maps user intent (e.g., "rack prices") directly to endpoint paths and SQL patterns, skipping the model's need to discover the schema.

### Layer 3: Result Compressor

Digests large API responses into structured summaries. Raw gateway dumps (potentially thousands of rows) are compressed to the essential data the synthesizer needs.

### Layer 4: Conversation Compactor

Summarizes older messages in long conversations to reclaim context space. Keeps recent messages verbatim while compressing earlier turns.

---

## Prompt Caching Strategy

The system prompt is split into static and dynamic segments:

1. **Static system prompt** — Role identity, response formatting rules, endpoint catalog. This is cacheable across requests because it rarely changes.
2. **Dynamic context** — User role, available endpoints, active conversation documents. Appended per-request.

The static portion uses Anthropic's `cache_control: { type: "ephemeral" }` block type for automatic caching, reducing input token costs for repeated queries within the TTL.

---

## Response Validation Pipeline

`src/lib/response-validator.ts` applies lightweight post-processing after the model generates content:

1. Emoji removal (using surrogate pair regex for ES5 compatibility)
2. Double-space cleanup from emoji removal
3. Filler phrase stripping ("Certainly!", "Of course!", "Happy to help!")
4. Trailing whitespace removal

Applied to every response before returning to the user.

---

## File Export System

`src/lib/file-export.ts` generates real downloadable files from markdown report content.

### Supported Formats (9)

| Format | Library | Output |
|--------|---------|--------|
| CSV | Native | Plain text, comma-separated |
| XLSX | xlsx | Multi-sheet Excel workbook |
| DOCX | docx | Formatted Word document with Delta360 branding |
| PDF | HTML-based | Print-ready HTML with branded header/footer |
| PPTX | pptxgenjs | PowerPoint presentations |
| MD | Native | Raw markdown |
| TXT | Native | Plain text (stripped markdown) |
| JSON | Native | Structured data |
| HTML | Native | Formatted HTML |

### Workbook Templates

Pre-built Excel templates (`src/lib/workbook-generator.ts`) with verified SQL queries:

- BOL Summary (by supplier, product, carrier)
- Revenue Analysis (by customer, product, region, month)
- Additional templates accessible via `POST /api/workbooks`

The AI can invoke workbook generation as a tool during the agentic loop, building multi-sheet .xlsx files with actual gateway data instead of markdown tables.

### ZIP Bundling

Multiple reports can be bundled into a single ZIP download via jszip.

---

## Authentication Flow

1. User visits `/login` — redirected to Microsoft 365 SSO (Azure AD tenant `38425e73-...`)
2. MSAL.js handles OAuth2 flow — receives ID token
3. NextAuth session created with JWT — httpOnly cookie
4. User email looked up in role config (`src/lib/config/roles.ts`) — assigned gateway API key
5. All API routes check session via `getServerSession(authOptions)`
6. In development mode, auth checks are bypassed with admin defaults

### Roles

| Role | Gateway Services | Dashboard Widgets |
|------|-----------------|-------------------|
| Admin | All 7 | All widgets + system health + usage stats |
| Accounting | Ascend + Power BI | AR aging, revenue trend, top customers, invoices, AP |
| Sales | Salesforce + Power BI | Pipeline, opportunities, leads, account activity |
| Operations | Ascend + Samsara + Fleet Panda | Fleet map, vehicle status, equipment, tanks |
| Read-Only | All 7 | AR aging, revenue trend, pipeline, fleet map |

---

## Project Structure

```
src/
  app/
    (dashboard)/
      layout.tsx          # Authenticated layout with sidebar nav
      page.tsx            # Role-based dashboard
      chat/               # AI chat with streaming
      documents/          # Upload + extraction
      history/            # Conversation history
      search/             # Cross-chat search
      reports/            # AI Report Builder + templates
      sources/            # Data source status
      workspaces/         # Workspace marketplace
      dashboards/         # Custom dashboard builder (Phase 4)
      admin/              # User mgmt, permissions, usage, health
    api/
      auth/               # NextAuth routes
      chat/               # AI chat (sync + streaming)
      dashboard/          # KPI endpoint
      dashboards/         # Dashboard CRUD
      navigation/         # Navigation structure
      reports/            # Generate, export, templates, schedules
      upload/             # File upload + extraction
      workbooks/          # Excel workbook generation
      workspaces/         # Workspace CRUD
      registry/           # Schema crawl
      admin/              # Users, permissions, usage, health
      gateway/            # Gateway proxy
    login/                # MS 365 SSO login page
  lib/
    auth.ts               # MSAL config, NextAuth options
    config/roles.ts       # Role definitions, email mapping
    gateway.ts            # Gateway HTTP client
    router.ts             # Multi-model routing algorithm
    orchestrator.ts       # Planner/worker/synthesizer (sync)
    orchestrator-stream.ts # Streaming orchestrator
    token-optimizer.ts    # 4-layer token optimization
    response-validator.ts # Post-processing
    response-schema.ts    # Response format schema
    file-export.ts        # 9-format file generation
    workbook-generator.ts # Excel workbook templates
    usage-logger.ts       # Query + cost tracking
    schema-registry.ts    # Schema discovery + query learning
    role-prompts.ts       # Per-role system prompts
    knowledge-graph.ts    # Entity relationship tracking
    discovered-patterns.ts # Learned query patterns
  components/
    auth/                 # AuthProvider
    chat/                 # Chat UI components
    dashboard/            # Dashboard widgets
    documents/            # Upload components
    workspaces/           # Workspace cards
data/
  users.json              # User store
  workspaces.json         # Workspace definitions
  report-templates.json   # Saved report templates
  report-schedules.json   # Scheduled reports
  schema-registry.json    # Crawled schema cache
  custom-roles.json       # Permission overrides
  usage-log.json          # Query/cost logs
  dashboards.json         # Custom dashboards
```
