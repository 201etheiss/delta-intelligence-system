# Delta Intelligence System — App Consolidation Map

**Last Updated:** 2026-03-31

Every Delta app, framework, and module mapped to its consolidation path into the one core Delta Intelligence platform.

---

## The Vision: One Platform, Multiple Faces

Delta Intelligence isn't just a controller tool — it's the unified operating system for ALL of Evan's ventures. Each app becomes a module or view within the core platform:

```
┌────────────────────────────────────────────────────────────┐
│                 DELTA INTELLIGENCE CORE                     │
│            (Next.js 14 + FastAPI + Triple DB)               │
├──────┬──────┬──────┬──────┬──────┬──────┬──────┬──────────┤
│Delta │Equip │Signal│Rift  │Rift  │Eco-  │Work- │Developer │
│360   │Track │Map   │Market│Advis │sphere│flow  │Assess    │
│Fin   │Fleet │Intel │Engine│ory   │Invest│OS    │Framework │
└──────┴──────┴──────┴──────┴──────┴──────┴──────┴──────────┘
     ▲           ▲           ▲           ▲           ▲
     │           │           │           │           │
  Supabase    TimescaleDB  Neo4j     TigerGraph   pgvector
```

---

## App Inventory: 12 Apps → 8 Modules

### APP 1: Delta Intelligence System v2 (CORE)
- **Status:** Running on localhost:3004
- **Stack:** Next.js 14 + FastAPI + SQLite/Supabase/Neo4j
- **What it does:** Corporate controller platform — 6 engines, 13 pages, 101 endpoints
- **Consolidation:** This IS the core. Everything else plugs into it.
- **Location:** ~/Downloads/Delta_Intelligence_System_v2.zip (packaged), localhost:3004 (running)

### APP 2: Equipment Tracker
- **Status:** Built, running separately
- **Stack:** TimescaleDB (hypertables: gps_readings, engine_readings, hos_logs)
- **What it does:** Tracks 178 Samsara vehicles + Ascend equipment. GPS, diagnostics, fuel, HOS.
- **Consolidation path:** → **Fleet Module** within Delta Intelligence
  - Merge fleet_vehicles table into Supabase
  - TimescaleDB stays as time-series backend (already connected)
  - Add Fleet page to Delta Intelligence UI
  - Wire vehicle data → depreciation JE (Family 1, 9)
  - Wire fuel consumption → margin analytics
  - Cross-reference: Samsara Vehicle ID ↔ Ascend Equipment ID (crosswalk built in DATA_MAPPINGS.md)
- **What carries over:** TimescaleDB schema, Samsara API integration, vehicle master data
- **What gets replaced:** Standalone UI → Delta Intelligence Fleet page

### APP 3: SignalMap
- **Status:** Functional, generates operator profiles
- **Stack:** Markdown/PDF report generation
- **What it does:** Personality/operator profiling platform. Generates comprehensive profiles with MBTI, operator types, decision styles, risk orientation.
- **Reports generated:** Evan Theiss, Courtney Maples, Test Account
- **Consolidation path:** → **People Intelligence Module** within Delta Intelligence
  - Integrate with Neo4j Person nodes (already have 17 people mapped)
  - Store SignalMap profiles as structured data in Supabase (person_profiles table)
  - Embed profiles in pgvector for RAG queries ("What's Taylor's decision style?")
  - Display in Delta Intelligence: People page with profile cards, operator type visualization
  - Wire to: hiring decisions (HR module), team composition, delegation optimization
- **What carries over:** Profile generation logic, assessment methodology, report templates
- **What gets replaced:** Standalone reports → integrated people intelligence

### APP 4: Rift Market Engine
- **Status:** Partially built (TimescaleDB 60% wired, security hardened)
- **Stack:** TypeScript, TimescaleDB (8 hypertables), data-fabric.ts, alignment-tracker.ts
- **What it does:** Market data processing, feed ingestion, regime detection, risk snapshots, trade audit
- **Consolidation path:** → **Market Intelligence Module** within Delta Intelligence
  - TimescaleDB hypertables merge into unified time-series backend
  - Feed timeseries → fuel pricing analytics, commodity tracking
  - Regime detection → market condition alerts for hedging decisions
  - Risk snapshots → StoneX hedging intelligence (JE Family 4)
  - Trade audit → evidence vault integration
- **What carries over:** TimescaleDB schema (feed_timeseries, regime_history, risk_snapshots), data-fabric pattern, alignment-tracker pattern
- **What gets replaced:** Standalone engine → Delta Intelligence market data pipeline

### APP 5: Rift Advisory (SID Framework)
- **Status:** Documented methodology, not yet software
- **Stack:** Knowledge base (markdown docs), graph schema defined
- **What it does:** Structural Intelligence Diagnostic — externalizes businesses as inspectable graphs. Nodes: Philosophy, Method, Domain, Constraint, Flow, Incentive, Risk, Value, Output, Narrative, Evidence.
- **Consolidation path:** → **Structural Analysis Module** within Delta Intelligence
  - SID graph schema → Neo4j (new node/relationship types)
  - SID method → WorkflowOS agent that runs structural diagnostics
  - Can be applied to Delta360 itself: map the business as a graph, identify structural risks, center points, vertebrae
  - Can be offered as consulting service module for external clients
- **What carries over:** Graph schema, engagement phases, five decomposition dimensions, analytical lenses
- **What gets new:** Software implementation of SID method, automated graph construction

### APP 6: Ecosphere
- **Status:** Prototype running, Next.js
- **Stack:** Next.js, src/app structure
- **What it does:** Institutional investment platform — pitch decks, investor relations
- **Related:** Investment module knowledge base (16 investment vehicle groups: Aether, Aurevia, CoIn, Fractal, Iulium, Lumora, Nebula, Origo, Rift Advisory, Solium, Tesseract, Tigris, etc.)
- **Consolidation path:** → **Investment Module** within Delta Intelligence
  - Investor relations dashboard
  - Vehicle tracking across all 16 groups
  - Capital deployment / returns tracking
  - Pitch deck generation (PPTX skill integration)
  - Wire to: financial engines for fund-level accounting
- **What carries over:** Investment vehicle structures, pitch deck templates, institutional branding
- **What gets replaced:** Separate prototype → Delta Intelligence Investment page

### APP 7: WorkflowOS
- **Status:** Config module built (10 files), phases planned
- **Stack:** Python, Supabase client, Claude API wrapper
- **What it does:** AI agent automation — orchestrates Claude agents for automated workflows
- **Consolidation path:** → **Agent Layer** within Delta Intelligence (already documented in AGENT_CONFIGS.md)
  - 9 agents defined and ready to deploy
  - SecretsManager, settings, Claude API wrapper all carry over
  - Becomes the "autopilot" layer across ALL modules
- **What carries over:** Full config module, agent definitions, model selection strategy
- **What gets replaced:** Standalone config → embedded agent orchestration layer

### APP 8: Delta Automation Opportunity Agent
- **Status:** Built (3,281 lines PowerShell)
- **Stack:** PowerShell
- **What it does:** Captures automation opportunities from business processes. Scans workflows, identifies repetitive tasks, estimates ROI.
- **Consolidation path:** → **Process Intelligence Module** within Delta Intelligence
  - Automation opportunity database → Supabase table
  - Feed into WorkflowOS agent prioritization
  - Dashboard showing: opportunities identified, estimated savings, implementation status
  - Wire to: ROI tracking against actual savings after automation deployed
- **What carries over:** Opportunity identification logic, ROI estimation formulas
- **What gets replaced:** PowerShell script → web-based process intelligence

### APP 9: Developer Assessment Framework
- **Status:** 10-document suite complete
- **Stack:** Documents (likely DOCX/PDF)
- **What it does:** Evaluates AI-augmented development across 4 scenarios (expense processing, client onboarding, sales intelligence, documentation debt). 1-4 rubric with behavioral anchors.
- **Consolidation path:** → **HR/Assessment Module** within Delta Intelligence
  - Assessment templates stored in Supabase
  - Candidate scoring tracked and trended
  - Wire to: SignalMap profiles for holistic candidate evaluation
  - Generate assessment reports from Delta Intelligence
- **What carries over:** Assessment templates, rubrics, scenario variants
- **What gets new:** Digital administration, scoring dashboard, trend tracking

### APP 10: WildLens
- **Status:** Running, Next.js
- **Stack:** Next.js, auth system, dashboard
- **What it does:** (Based on structure: appears to be a dashboard/monitoring app)
- **Consolidation path:** → Evaluate for unique functionality to merge or deprecate
- **What carries over:** Any unique UI components or patterns

### APP 11: The Forum
- **Status:** Conceptual/early stage
- **What it does:** Corporatocracy / Intrinsic Capitalism platform
- **Consolidation path:** → **Governance Module** or separate product line
  - If it has financial components → wire to Delta Intelligence financial engines
  - If it's purely ideological/community → may stay separate

### APP 12: Rift Investment Module Knowledge Base
- **Status:** Comprehensive KB (16 investment vehicle groups)
- **What it does:** Knowledge management for investment vehicles
- **Consolidation path:** → **pgvector embeddings** for RAG within Investment Module
  - All KB documents → chunked, embedded, searchable
  - Per-vehicle context available to Claude agents
  - Portfolio-level queries across all 16 groups

---

## Consolidated Module Map

| Module | Source Apps | Database | Pages | Agents |
|--------|-----------|----------|-------|--------|
| **Financial Core** | Delta Intelligence v2 | Supabase (24 tables) | Dashboard, JE, Recon, Close, Cash, Reporting | All 9 |
| **Fleet** | Equipment Tracker | TimescaleDB + Supabase | Fleet Map, Vehicle Detail, Depreciation | JE Agent (Fam 1,9) |
| **People Intelligence** | SignalMap | Neo4j + Supabase + pgvector | People, Profiles, Org Chart | Brief Agent |
| **Market Intelligence** | Rift Market Engine | TimescaleDB + TigerGraph | Market Data, Hedging, Alerts | Cash Agent |
| **Structural Analysis** | Rift Advisory (SID) | Neo4j (SID schema) | SID Dashboard, Graph Explorer | SID Agent (new) |
| **Investment** | Ecosphere + Rift Investment KB | Supabase + pgvector | Portfolio, Vehicles, Pitch Gen | — |
| **Agent Layer** | WorkflowOS | Claude API + Supabase | Agent Dashboard, Config | Orchestrator |
| **Process Intelligence** | Automation Opportunity Agent | Supabase | Opportunities, ROI Tracker | — |
| **HR/Assessment** | Dev Assessment + SignalMap | Supabase + pgvector | Candidates, Scoring, Trends | — |
| **Governance** | The Forum | TBD | TBD | TBD |

---

## Unified Navigation Structure

```
Delta Intelligence (/)
├── Dashboard (Controller Cockpit)
├── Financial (/financial)
│   ├── Journal Entries
│   ├── Reconciliations
│   ├── Close Tracker
│   ├── Cash Flow
│   ├── Reporting
│   └── Late-Posted Queue
├── Operations (/operations)
│   ├── Fleet Map & Vehicles
│   ├── Delivery Tracking
│   ├── Process Intelligence
│   └── Automation ROI
├── Intelligence (/intelligence)
│   ├── Daily Brief
│   ├── Market Data & Hedging
│   ├── Exception Monitor
│   └── AI Agent Dashboard
├── People (/people)
│   ├── Org Chart
│   ├── SignalMap Profiles
│   ├── Assessments
│   └── Team Composition
├── Graph (/graph)
│   ├── Entity Explorer (Neo4j)
│   ├── SID Analysis
│   ├── Account Chains
│   └── Dependency Map
├── Investment (/investment)
│   ├── Portfolio Overview
│   ├── Vehicle Detail (16 groups)
│   ├── Pitch Generator
│   └── Returns Tracking
├── Admin (/admin)
│   ├── Users & Roles
│   ├── System Health
│   ├── Import Center
│   ├── Agent Config
│   └── Audit Log
└── Settings (/settings)
    ├── Credentials
    ├── Integrations
    ├── Notifications
    └── Branding
```

---

## Database Consolidation

### What Merges Into Supabase
| New Table | Source App | Fields |
|-----------|-----------|--------|
| fleet_vehicles | Equipment Tracker | samsara_id, ascend_id, name, vin, make, model, year, plate, status |
| person_profiles | SignalMap | person_id, operator_type, mbti, decision_style, risk_orientation, full_profile_json |
| automation_opportunities | Automation Agent | process_name, current_time, estimated_savings, status, roi_actual |
| assessment_results | Dev Assessment | candidate_id, scenario, score, evaluator, notes, timestamp |
| investment_vehicles | Ecosphere/Rift KB | vehicle_name, group, structure, aum, returns, status |
| sid_engagements | Rift Advisory | client_id, phase, graph_snapshot, findings, recommendations |

### What Merges Into Neo4j
| New Node Type | Source App | Relationships |
|---------------|-----------|--------------|
| OperatorProfile | SignalMap | Person→HAS_PROFILE→OperatorProfile |
| InvestmentVehicle | Ecosphere | Entity→MANAGES→InvestmentVehicle |
| AutomationOpportunity | Automation Agent | Process→HAS_OPPORTUNITY→AutomationOpportunity |
| SIDNode (Philosophy, Method, Domain, Constraint, Flow, Incentive, Risk, Value, Output, Narrative, Evidence) | Rift Advisory | Full SID graph schema with Depends_on, Constrains, Enables, Distorts, Clarifies edges |

### What Merges Into pgvector
| Embedding Source | Source App | Record Count |
|-----------------|-----------|-------------|
| Operator profiles | SignalMap | 17+ (all mapped people) |
| Investment KB docs | Rift Investment | ~100+ documents across 16 groups |
| SID methodology docs | Rift Advisory | ~20 core docs |
| Assessment templates | Dev Assessment | 10 templates × 4 variants |

---

## Migration Sequence

### Phase 1: Core Financial (NOW → Week 4)
Already underway. Delta Intelligence v2 is the foundation.

### Phase 2: Fleet Integration (Week 2-3)
1. Merge fleet_vehicles table into Supabase
2. Add Fleet page to UI navigation
3. Wire Samsara data → depreciation calculations
4. Cross-reference vehicle ↔ equipment IDs

### Phase 3: People Intelligence (Week 3-4)
1. Create person_profiles table in Supabase
2. Import existing SignalMap profiles (Evan, Courtney, Test)
3. Generate profiles for all 17 mapped people
4. Add People page with profile cards
5. Embed profiles in pgvector for RAG

### Phase 4: Market Intelligence (Week 4-6)
1. Merge Rift Market Engine TimescaleDB hypertables
2. Wire feed_timeseries → fuel pricing analytics
3. Wire regime detection → hedging alerts
4. Add Market Intelligence page

### Phase 5: Investment Module (Week 6-8)
1. Create investment_vehicles table
2. Import all 16 groups from Rift KB
3. Embed KB docs in pgvector
4. Add Investment pages (portfolio, vehicle detail)
5. Wire to financial engines for fund accounting

### Phase 6: SID Framework (Week 8-10)
1. Deploy SID node types in Neo4j
2. Build SID Analysis page with graph visualization
3. Run first SID engagement on Delta360 itself
4. Create SID Agent in WorkflowOS

### Phase 7: Process Intelligence (Week 10-12)
1. Port automation opportunity logic from PowerShell → Python
2. Create automation_opportunities table
3. Add Process Intelligence page with ROI tracker
4. Wire to WorkflowOS for agent prioritization

### Phase 8: HR/Assessment (Week 12-14)
1. Create assessment tables in Supabase
2. Import assessment templates
3. Add Assessment pages
4. Wire to SignalMap for holistic evaluation
