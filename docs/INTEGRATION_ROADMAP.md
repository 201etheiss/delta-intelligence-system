# Delta Intelligence — Integration Roadmap

## Current Platform State (March 31, 2026)

- 32 pages, 55 lib modules, 27 data files
- 8 live data services (128 gateway endpoints)
- 86 plugin integrations (8 active, 78 available)
- 8 AI chat tools, multi-model (Claude/GPT/Gemini)
- 5 role-based dashboards (Admin, Sales, Accounting, Operations, HR)
- Daily briefing with 24 live queries
- 5 email digest types
- Permission enforcement with MS Graph org hierarchy
- Plugin registry with weighted routing and continuous reweighting

## What Needs Integration

### Priority 1: Accounting Engines (from V2 primitives)

These are the 6 controller engines that Taylor Veazey needs. They exist as FastAPI concepts
and need to be rebuilt as Next.js modules inside the current platform.

| Engine | Pages Needed | API Routes | Lib Module | Data |
|--------|-------------|------------|-----------|------|
| **Journal Entry** | /journal-entries, /journal-entries/[id] | /api/journal-entries (CRUD + workflow) | src/lib/engines/journal-entry.ts | data/je-templates.json |
| **Reconciliation** | /reconciliations, /reconciliations/[id] | /api/reconciliations (CRUD + matching) | src/lib/engines/reconciliation.ts | data/recon-rules.json |
| **Close Management** | /close-tracker, /close-timeline | /api/close (checklists + timeline) | src/lib/engines/close-management.ts | data/close-templates.json |
| **Cash Flow** | /cash-flow | /api/cash-flow (forecast + borrowing base) | src/lib/engines/cash-flow.ts | data/cash-flow-config.json |
| **Reporting** | /reporting (exists), /reporting/packages | /api/reporting/packages (production pipeline) | src/lib/engines/reporting.ts | data/report-packages.json |
| **Insights** | /insights (merge with digest) | /api/insights (pattern detection) | src/lib/engines/insights.ts | — |

### Priority 2: Controller Cockpit

Single-pane-of-glass for Taylor. New page at /(dashboard)/cockpit.
Pulls from all 6 engines + existing dashboard data.
Sections: Close Progress, Exception Aging, JE Pipeline, Recon Status, Audit/PBC Aging, Cash Flow.

### Priority 3: Project Integration Points

| Project | Location | Integration Method |
|---------|----------|-------------------|
| Equipment Tracker | equipment-tracker-tau.vercel.app | API link from DI, shared Supabase |
| Sales Scorecard | localhost:3005 | Embed/link, shared SF data |
| Signal Map (OTED) | oted-system.vercel.app | API link from DI |
| Ecosphere | ~/Projects/ecosphere-prototype | Demonstration prototype, no live integration |
| Rift Market Engine | ~/rift-market-engine | Separate system, no integration needed |

### Priority 4: Data Infrastructure

| Item | Status | Next Step |
|------|--------|-----------|
| Supabase migration | Schema designed, not deployed | Run migration SQL |
| Neo4j seeding | Instance created, empty | Run seed scripts |
| GitHub push | Repo exists, no code pushed | Git init + push |
| Fleet Panda token | Expired | Refresh token |

### Priority 5: Advanced Modules (Wave 6 from roadmap)

- AP Intelligence (auto-coding >50%)
- AR/Credit/Borrowing Base
- Inventory & Margin Analytics
- BS Variance Monitor
- Entity/Profit-Center Review
- Tax Module (Avalara integration)
- StoneX Hedging Intelligence
- Evidence Vault (immutable audit trail)
- Commentary Manager (AI-assisted variance commentary)
- Late-Posted GJ Queue (1,009 flagged transactions)

## Build Sequence

1. Journal Entry engine + Close Management engine (highest daily value for Taylor)
2. Controller Cockpit page (unified view)
3. Reconciliation engine
4. Cash Flow engine
5. Reporting production pipeline
6. GitHub push + Supabase migration
7. Advanced modules (AP, AR, Tax, etc.)
