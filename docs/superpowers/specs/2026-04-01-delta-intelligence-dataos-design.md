# Delta Intelligence — Event-Sourced DataOS Platform Design

**Date:** 2026-04-01
**Author:** Evan Theiss
**Status:** Approved (brainstorm)

---

## 1. Platform Identity

Delta Intelligence is a Jarvis-style AI Operating System for business operations. The platform AI is named **Nova**.

Delta Intelligence is not a dashboard or a single application. It is an event-sourced operating system where every business tool is a module (spoke), Nova is the connective intelligence layer, data flows through an immutable event backbone, and any business can be onboarded as a tenant for commercial deployment.

### Core Principles

1. **Hub-and-spoke topology** — DI is the hub. All modules are spokes that emit and consume events.
2. **Event sourcing** — every data change is an immutable event. Databases are materialized views rebuilt from events.
3. **Federated auth** — DI owns identity. All spokes authenticate through DI.
4. **Build, don't integrate** — internal SaaS tools (Zoho, QuickBooks, Salesforce, Ascend) are replaced with custom-built first-party modules. External data sources with high value and low replicability (Samsara, Fleet Panda) are kept as feeds.
5. **Commercializable** — multi-tenant, event protocol as API, module marketplace for third parties.

---

## 2. System Architecture — Event-Sourced DataOS

### 2.1 Event Store

The Event Store is the central nervous system and single source of truth.

- Immutable append-only log of all events across the platform
- Multi-tenant: events are namespaced by tenant ID with RLS enforcement (see Section 13)
- Event schema: `{ id, type, tenant_id, actor_id, timestamp, version, sequence_number, payload, metadata }`
- Event types follow a domain.action pattern: `order.created`, `feed.ingested`, `alert.triggered`, `margin.calculated`
- Events are never deleted or mutated — corrections are new compensating events

#### 2.1.1 Durability and Replay

The Event Store uses a dual-layer architecture:

- **Persistence layer (Supabase PostgreSQL):** Append-only `events` table with monotonic `sequence_number` column. This is the durable log. Events are never lost. Consumers replay from any sequence number forward via cursor-based polling (`SELECT * FROM events WHERE sequence_number > $cursor AND tenant_id = $tenant ORDER BY sequence_number LIMIT $batch`).
- **Delivery layer (Redis Streams):** Real-time event delivery to active consumers. Redis Streams provide consumer groups with offset tracking — each consumer group tracks its own read position. If a subscriber goes offline, it resumes from its last acknowledged offset. Redis Streams are NOT the source of truth — they are a delivery optimization. If Redis loses data, consumers fall back to polling the PostgreSQL events table.

Consumer durability contract:
- Each consumer group stores its last-processed `sequence_number` in a `consumer_offsets` table in Supabase
- On startup, a consumer reads its offset and replays from PostgreSQL, then switches to Redis Streams for real-time delivery
- This guarantees at-least-once delivery regardless of subscriber downtime

#### 2.1.2 Event Schema Versioning

- Every event carries a `version` field (integer, starts at 1)
- When an event schema evolves, the version increments. Old events retain their original version.
- Consumers MUST handle unknown event types gracefully (log and skip, never crash)
- Consumers MUST handle events with `version > known_version` by processing known fields and ignoring unknown fields (forward-compatible)
- Upcasting: event processors MAY transform old-version events to current-version format during replay. Upcasters are registered per event type and version range.
- Deprecation: event types are never removed. They can be marked deprecated with a `deprecated_at` metadata field. New events of deprecated types trigger a warning log.

### 2.2 Materialized Views (Polyglot Database Layer)

All databases are projections of the event stream. If a database corrupts or needs restructuring, it is rebuilt from events.

| Database | Purpose | Materializes |
|----------|---------|-------------|
| **Supabase (pgvector)** | Relational data, vector embeddings, auth, realtime subscriptions | Customer records, orders, invoices, user profiles, document embeddings |
| **Neo4j** | Knowledge graph, entity relationships | Vendor-customer relationships, cross-module intelligence, metadata linkages |
| **TimescaleDB (self-hosted container)** | Time-series data, metrics, pricing history | Fuel prices, fleet telemetry, financial metrics over time, KPI trends |
| **Redis** | Cache, pub/sub, session state | Hot data, event bus pub/sub channels, user session state |

### 2.3 CQRS Pattern

- **Commands** (writes): User actions and system operations write new events to the Event Store
- **Queries** (reads): All reads go to materialized views, never to the Event Store directly
- The gateway evolves from the current API proxy (port 3847) into a full CQRS command/query interface

### 2.4 Containerization

The full database cluster and event infrastructure are containerized (Docker Compose for dev, Kubernetes for production). Each spoke is independently deployable. The platform core (Event Store + databases + gateway + Nova) is the minimum deployment unit.

Docker Compose services for the platform core:
- `supabase` — PostgreSQL 15 with pgvector extension (Event Store + relational views + auth)
- `timescaledb` — Self-hosted PostgreSQL 15 with TimescaleDB extension (separate from Supabase, dedicated to time-series workloads). TimescaleDB is NOT available on Supabase hosted instances — it runs as its own container.
- `neo4j` — Knowledge graph (Community or Enterprise edition)
- `redis` — Redis 7+ with Streams support (event delivery + cache + pub/sub)
- `gateway` — CQRS command/query API (Node.js, evolves from current port 3847 gateway)
- `nova` — AI orchestration service (connects to LLM APIs)

---

## 3. Module Contract

### 3.1 First-Party Contract (Thick)

All Delta-built modules implement:

1. **Auth** — authenticate via DI's federated auth (JWT with tenant_id, user_id, role claims)
2. **Events** — emit domain events to the Event Store; consume relevant event streams
3. **Shared UI SDK** — import `@delta/ui` for design tokens, components, layout primitives
4. **Widget embedding** — expose widget components that DI can embed in the command center dashboard
5. **Nova context** — provide module-specific context to Nova (schema, vocabulary, available actions)

### 3.2 Third-Party Contract (Thin)

Commercial/external modules implement:

1. **Auth** — authenticate via DI's federated auth (JWT)
2. **Events** — emit and consume events via the event protocol

No UI SDK required. Third-party modules bring their own UI. They connect to the platform via events and auth only.

### 3.3 Event Protocol Contract

All modules (first-party and third-party) must comply with the event protocol:

- Events MUST include all required fields from the schema in Section 2.1
- Consumers MUST handle unknown event types by logging and skipping (never crash)
- Consumers MUST handle forward-compatible versioning (process known fields, ignore unknown)
- Modules MUST NOT emit events without a valid `tenant_id` — the gateway rejects any event missing this field
- The Module Context Protocol (Section 7.3) is versioned separately from events. Breaking changes to the context protocol require a major version bump and a 90-day deprecation window.

### 3.4 `@delta/ui` Shared SDK

- **Location:** monorepo package at `packages/ui` (published as `@delta/ui` to private npm registry)
- **Scope:** design tokens (colors, typography, spacing, breakpoints), density mode primitives (executive/operator), base layout components (shell frame, tab bar, widget container), icon set
- **Not in scope:** business logic, data fetching, module-specific components. Modules compose their own UIs from SDK primitives.
- **Versioning:** semver, modules pin to minor version (`^1.2.0`). Breaking changes (major bumps) require coordinated rollout across all first-party modules.
- **Density modes:** the executive/operator toggle is an SDK-level context provider. Modules consume it to switch rendering density. The toggle UI is part of the OS shell, not individual modules.

### 3.5 Auth Federation

- DI owns identity for all modules
- Internal users: Azure AD (Microsoft SSO) via NextAuth, same as current DI implementation
- External users (Portal customers): Supabase Auth bridged to DI's identity layer
- Permissions managed from one panel inside DI — segmented per module and per role
- JWT claims include: tenant_id, user_id, role, module_permissions[]

---

## 4. Spoke Catalog

### 4.1 Customer-Facing

| Module | Description | Status |
|--------|-------------|--------|
| **Delta Portal** | Consumer-facing orders, product catalog, delivery tracking, invoices | Scaffolded (Phase 1) |
| **Signal Map (OTED)** | Assessment platform, reports, scoring | Deployed |
| **Customer Insights** | Analytics dashboards for clients | Planned |

### 4.2 Operations and Assets

| Module | Description | Status |
|--------|-------------|--------|
| **Equipment Tracker** | Asset management, maintenance, GPS tracking | Deployed |
| **Fleet Management** | Vehicles, drivers, dispatch (Samsara data) | Planned |
| **Inventory and Supply** | Tank levels, product stock, BOLs | Planned |

### 4.3 ERP Replacement Suite (Replaces Ascend)

| Module | Description | Status |
|--------|-------------|--------|
| **General Ledger** | GL, journal entries, chart of accounts | Planned |
| **Accounts Payable** | Vendor invoices, payments, aging | Planned |
| **Accounts Receivable** | Billing, collections, aging | Planned |
| **Financial Statements** | P&L, balance sheet, cash flow | Planned |

### 4.4 SaaS Replacements (Custom-Built)

| Module | Replaces | Status |
|--------|----------|--------|
| **Finance / Accounting** | QuickBooks | Planned |
| **Ticketing** | Zoho Tickets | Planned |
| **Project Management** | Zoho Projects | Planned |
| **CRM** | Salesforce | Planned |

### 4.5 Advanced Modules

| Module | Description | Status |
|--------|-------------|--------|
| **HR and People** | Paylocity data with custom UI | Planned |
| **Compliance and Audit** | Evidence vault, controls, exceptions | Partial (in DI) |
| **Analytics Dashboards** | Power BI replacement | Planned |
| **Procurement** | Vroozi replacement | Planned |

### 4.6 Extensibility

The module grid includes an "Add Module" capability. Commercial tenants can add first-party or third-party modules to their instance. The event protocol and auth federation make any new module a plug-and-play addition.

---

## 5. External Data Sources

| Source | Strategy | Purpose |
|--------|----------|---------|
| **Ascend ERP** | Replacing (migrating data, then sunset) | Current ERP — 5,105 SQL tables |
| **Salesforce** | Replacing with custom CRM module | Current CRM — 21K accounts |
| **Power BI** | Replacing with custom Analytics module | Current dashboards |
| **Vroozi** | Replacing with custom Procurement module | Current procurement |
| **Samsara** | Keeping (high-value, hard to replicate) | GPS, fleet telemetry, HOS |
| **Fleet Panda** | Keeping (high-value, hard to replicate) | Assets, trucks, tanks |
| **Paylocity** | Data feed (HR data source) | HR/people data |
| **MS 365** | Keeping (auth, docs, SharePoint) | Identity, document storage |

All external feeds are cached locally: raw data is ingested, emitted as events, and materialized into views. The platform owns all data regardless of upstream availability. As custom modules deploy, external source events are gradually replaced by spoke-emitted events.

---

## 6. DI Command Center UI

### 6.1 Design Direction

Blend of three patterns:

- **Module Grid OS (primary)** — app-launcher home screen with module tiles
- **Executive Command (inside modules)** — curated, attention-driven content by default
- **Mission Control (power user toggle)** — dense data view available per-module or globally

### 6.2 OS Shell (Always Present)

The DI shell never goes away. All module content renders inside it.

1. **Nova Bar** — persistent AI intelligence strip across the top or side. Shows:
   - Session continuity: "You left off reviewing AP invoices"
   - Proactive briefing: "3 items need your attention since yesterday"
   - Cross-module intelligence: anomaly alerts, pattern detection, suggestions
   - Quick-invoke input: type or speak to Nova from anywhere

2. **Module Workspace** — tiled/tabbed content area in the center. Multiple modules can be open simultaneously. Modules render inside the shell context, not as separate pages.

3. **Status Rail** — collapsible panel showing:
   - Spoke health indicators (green/yellow/red per module)
   - Live event feed (recent events across the platform)
   - Notification inbox

4. **Home / Module Grid** — the landing screen. Grid of module tiles with status indicators. "Add Module" tile for extensibility. Pinnable favorites.

### 6.3 Density Modes

Users can switch between two density modes within any module:

- **Executive mode (default for executives/managers)** — curated KPIs, progress bars, attention-driven alerts, clean whitespace, larger typography
- **Operator mode (default for operators/accountants)** — dense data tables, live numbers, monospace formatting, Bloomberg-style information density

Role determines the default. Users can toggle freely.

### 6.4 Navigation Pattern

Split-view / IDE-style:
- Nova bar and status rail are always visible (like VS Code activity bar)
- Module content loads in the workspace area
- Multiple modules open as tabs within the workspace
- Home grid is always one click away

---

## 7. Nova — AI Intelligence Layer

Nova is the platform AI. Not a chatbot page — an OS-level presence embedded in the shell.

### 7.1 Core Capabilities

| Capability | Description |
|------------|-------------|
| **Session continuity** | Remembers where the user was, what they were doing, and what changed since |
| **Proactive briefing** | "Here's what happened overnight" — surfaces changes, anomalies, and priorities |
| **Cross-module intelligence** | Connects dots across spokes: "This AP invoice is from a vendor whose delivery was flagged by Samsara" |
| **Contextual per module** | When user is in Finance, Nova knows finance vocabulary, schemas, and available actions |
| **Agentic execution** | "Run the month-end close checklist" — orchestrates multi-step workflows across modules |
| **Bot creation** | Users create saved automations (bots) that Nova executes on schedule or on trigger |
| **Natural language query** | "What's our margin on diesel this month?" — queries materialized views and responds |

### 7.2 Architecture

Nova builds on DI's existing multi-model orchestrator and agentic loop:

- **Planner (Haiku)** decomposes requests into steps
- **Workers** pull data from materialized views via the CQRS query interface
- **Synthesizer (Sonnet/Opus)** assembles the response
- **Event emission** — Nova's intelligence outputs (anomalies detected, patterns found, briefings generated) are themselves events in the Event Store, available to all modules

### 7.3 Bot Execution Model

Bots are saved automations that Nova executes on schedule or on trigger.

- **Permitted actions:** Bots can perform any action defined in a module's Context Protocol (Section 7.4). Actions are categorized:
  - **Read-only** (query, report, export) — execute without confirmation
  - **Write** (create ticket, update record, send notification) — execute without confirmation unless flagged high-impact
  - **Destructive** (approve invoice, execute payment, delete record) — ALWAYS require human confirmation before execution
- **Authentication:** Bots execute under a service account scoped to the creating user's permissions. A bot cannot perform actions the user who created it cannot perform.
- **Scheduling:** Bots run on cron expressions. Execution is logged as `bot.executed` events in the Event Store with full input/output payloads.
- **Audit:** Every bot execution produces an immutable audit event. Failed executions produce `bot.failed` events with error context.
- **Rollback:** Bots that emit write events can be rolled back by emitting compensating events. The bot execution log links each emitted event to the bot run ID, enabling targeted reversal.
- **Versioning:** Bots are versioned. Editing a bot creates a new version. Previous versions are retained and can be rolled back to.

### 7.4 Module Context Protocol

Each first-party module provides Nova with:

- **Schema** — what data exists in this module (tables, fields, types)
- **Vocabulary** — domain-specific terms and their definitions
- **Actions** — what Nova can do in this module (create ticket, approve invoice, run report)
- **Alerts** — what conditions should trigger proactive notification

---

## 8. Data Flow

The platform operates on a 7-step data flow cycle:

1. **Ingest** — External data sources emit raw events into the Event Store. All data is cached and owned locally.
2. **Materialize** — Event processors build Supabase tables, Neo4j graph nodes/edges, TimescaleDB hypertables, and Redis cache entries from the event stream.
3. **Query** — Hub (DI) and spokes read from materialized views via the CQRS query interface. Never from the Event Store directly.
4. **Command** — User actions (place order, approve invoice, create ticket) write new events to the Event Store via the CQRS command interface.
5. **Sync** — All spokes consume relevant event streams for bidirectional synchronization. A spoke subscribes to event types it cares about and receives updates in real time.
6. **Enrich** — Nova reads events and materialized views, detects patterns and anomalies, and writes intelligence events back to the Event Store (e.g., `anomaly.detected`, `briefing.generated`, `pattern.discovered`).
7. **Migrate** — As custom modules deploy and replace external SaaS tools, external source events are gradually replaced by spoke-emitted events. The Event Store remains the constant.

---

## 9. Migration Path

The platform builds incrementally on what exists. Phases are numbered sequentially. The D/B/A labels in parentheses reference the original brainstorm discussion.

### Phase 1: Ecosystem Architecture (brainstorm ref: D)

- Define event schema and protocol
- Set up Event Store infrastructure (Supabase events table + Redis Streams)
- Define module contract (thick and thin)
- Containerize the database cluster (Supabase, Neo4j, TimescaleDB, Redis) via Docker Compose
- Build `@delta/ui` shared SDK with design tokens from existing DI styles
- Build auth federation layer (Azure AD + Supabase Auth bridge)
- Implement tenant isolation (RLS policies, subscriber channel namespacing)

**Exit criteria:** Event Store accepts and replays events. Docker Compose brings up all 6 services. Auth federation issues valid JWTs consumed by a test spoke.

### Phase 2: Portal-to-DI Integration (brainstorm ref: B)

- Wire Delta Portal into the gateway via event protocol
- Portal emits events (order.created, customer.registered) back to DI
- Portal authenticates through DI's federated auth
- Portal consumes relevant event streams (pricing, inventory, delivery status)
- Proof of concept: one spoke fully integrated with the hub

**Exit criteria:** Portal authenticates via DI JWT. Events emitted by Portal appear in DI's Event Store. Portal reads materialized views. Bidirectional event flow verified.

### Phase 3: DI UI/UX Upgrade (brainstorm ref: A)

- Rebuild DI frontend as the Module Grid OS
- Implement Nova Bar, workspace area, status rail
- Implement density modes (executive and operator)
- Embed existing DI pages as modules within the new shell
- Build the module grid home screen with "Add Module" extensibility
- Wire Nova into the OS shell as the persistent AI presence

**Exit criteria:** Module Grid renders all existing DI modules as tiles. Nova Bar provides session continuity and proactive briefings. Density toggle works. Multiple modules open simultaneously as tabs.

### Phase 4: Module Expansion

- ERP replacement modules (GL, AP, AR, Financial Statements)
- SaaS replacement modules (Ticketing, PM, CRM, Finance)

**Sequencing gate for ERP modules:** Ascend event replay must be validated — materialized views from replayed events must produce identical state to direct Ascend SQL queries before any module replaces Ascend functionality.

### Phase 5: Commercialization

- Commercial multi-tenancy (tenant provisioning, billing, isolation verification)
- Module marketplace for third parties
- Third-party module SDK and documentation

---

## 10. Technology Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Event Store | PostgreSQL-backed (via Supabase) with append-only event table | Leverages existing Supabase infrastructure, pgvector for embeddings, realtime for subscriptions |
| Knowledge Graph | Neo4j | Already in the DI stack, purpose-built for entity relationships |
| Time-Series | TimescaleDB (self-hosted container, separate from Supabase) | PostgreSQL extension not available on Supabase hosted — runs as dedicated container for time-series workloads |
| Cache/PubSub | Redis | Industry standard, event bus pub/sub, session state |
| Frontend Framework | Next.js 14 (App Router) | Existing DI and Portal stack, server components for performance |
| UI SDK | `@delta/ui` (Tailwind + Radix primitives) | Consistent design tokens across all first-party modules |
| Auth | Azure AD (internal) + Supabase Auth (external) bridged via DI | Existing SSO for employees, Supabase for consumer auth |
| AI Orchestration | Existing multi-model orchestrator (Haiku/Sonnet/Opus) | Already built and working in DI |
| Containerization | Docker Compose (dev), Kubernetes (production) | Standard, scalable, supports the polyglot database cluster |

---

## 11. Success Criteria

**Phase 1 (Ecosystem Architecture):**
1. Event Store accepts, persists, and replays events with consumer group offset tracking
2. Docker Compose brings up all 6 services (Supabase, TimescaleDB, Neo4j, Redis, gateway, Nova)
3. Federated auth issues valid JWTs consumed by a test spoke
4. Tenant isolation verified: tenant A events never visible to tenant B subscribers

**Phase 2 (Portal Integration):**
5. Portal authenticates via DI's federated auth (single identity, permissions from one panel)
6. Events emitted by Portal appear in DI's Event Store with bidirectional sync
7. All external data feeds are cached locally as events (no direct upstream dependency for reads)

**Phase 3 (UI/UX Upgrade):**
8. Module Grid OS renders at least 3 modules (DI core, Portal, Equipment Tracker) as tiles
9. Nova provides session continuity and proactive briefings from event data
10. Density modes (executive and operator) are toggleable per user

**Phase 4 (Module Expansion):**
11. At least one custom SaaS replacement module (Ticketing or PM) is functional
12. Ascend event replay validated — materialized views match direct SQL query results

---

## 12. Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Event schema design errors lock in bad patterns | High | Start with a small set of event types, version the schema, allow schema evolution |
| Materialization lag creates stale views | Medium | Use Redis pub/sub for real-time critical paths, accept eventual consistency for analytics |
| Shared UI SDK becomes a bottleneck | Medium | Keep SDK thin (tokens + primitives), let modules compose their own layouts |
| Auth federation complexity | Medium | Start with Azure AD pass-through, add Supabase Auth bridge incrementally |
| Ascend migration data loss | High | Run Ascend and custom ERP in parallel during migration, validate event replay produces identical state |
| Multi-tenant event isolation | High | RLS on events table, gateway-layer tenant_id injection, Redis Stream channel namespacing per tenant, Nova tenant boundary enforcement (see Section 13) |

---

## 13. Security

### 13.1 Tenant Isolation

- **Event Store:** Row Level Security (RLS) policy on the `events` table enforces `tenant_id = current_setting('app.tenant_id')`. The gateway sets this session variable before every query.
- **Gateway command layer:** All write commands inject `tenant_id` from the authenticated JWT. Events without a valid `tenant_id` are rejected at the gateway — they never reach the Event Store.
- **Redis Streams:** Channels are namespaced by tenant: `tenant:{tenant_id}:events`. Subscribers can only subscribe to their own tenant's channel.
- **Nova:** All Nova queries and actions are scoped to the authenticated user's `tenant_id`. Cross-tenant intelligence is prohibited. Nova's event emissions include the tenant_id from the requesting context.
- **Negative testing:** Tenant isolation is verified by automated tests that attempt cross-tenant reads, writes, and subscriptions and assert failure (see Section 14).

### 13.2 Encryption

- **At rest:** Supabase provides encryption at rest by default. Self-hosted TimescaleDB and Neo4j containers use encrypted volumes.
- **In transit:** All inter-service communication uses TLS. Redis connections require TLS in production. Spoke-to-gateway communication uses HTTPS.
- **Secrets:** JWT signing keys, database credentials, and API keys are stored in a secret manager (environment variables in dev, Vault or cloud KMS in production). Never in source code.

### 13.3 Agentic Action Audit Trail

Nova's agentic actions (approve invoice, execute payment, create ticket, run workflow) produce dedicated audit events separate from the general Event Store:

- `nova.action.requested` — who asked Nova to do what
- `nova.action.executed` — what Nova actually did, including all emitted events
- `nova.action.confirmed` — human confirmation for destructive actions
- `nova.action.failed` — what went wrong

These audit events are immutable and retained indefinitely, even if the underlying business events are compacted.

### 13.4 API Rate Limiting

- CQRS command interface: rate-limited per tenant and per user (configurable, default 100 commands/minute per user)
- Query interface: rate-limited per tenant (configurable, default 1000 queries/minute per tenant)
- Nova API: rate-limited per user (configurable, default 30 requests/minute)
- Rate limit violations emit `security.rate_limit_exceeded` events

---

## 14. Testing Strategy

### 14.1 Event Replay Validation

- **Replay correctness:** Automated tests replay a known set of events and assert that materialized views (Supabase tables, Neo4j nodes, TimescaleDB hypertables) match expected state.
- **Idempotency:** Replaying the same event set twice produces identical materialized state.
- **Regression:** Any change to an event processor must pass the replay validation suite before merge.

### 14.2 Module Contract Tests

- **Event schema compliance:** Each module's emitted events are validated against the event schema (required fields, type format, version presence).
- **Consumer resilience:** Test harness sends events with unknown types and future versions to each consumer — consumers must not crash.
- **Auth contract:** Test that modules reject requests without valid JWTs and accept requests with valid JWTs scoped to the correct tenant.

### 14.3 Tenant Isolation Tests

- **Cross-tenant read:** Authenticate as tenant A, attempt to read tenant B events — must fail.
- **Cross-tenant write:** Authenticate as tenant A, attempt to write an event with tenant B's ID — must fail.
- **Cross-tenant subscription:** Subscribe to tenant B's Redis Stream channel as tenant A — must fail.
- **Nova cross-tenant:** Ask Nova a question while authenticated as tenant A — response must never include tenant B data.

### 14.4 Nova Action Sandboxing

- **Dry-run mode:** Nova can execute agentic workflows in dry-run mode that logs what would happen without emitting events.
- **Test tenant:** A dedicated test tenant with synthetic data is available for Nova testing. No production data is accessible from the test tenant.
- **Bot testing:** New bots must pass at least one dry-run execution before being activated for live execution.
