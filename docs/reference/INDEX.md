# Delta Intelligence System — Master Index

**Last Updated:** 2026-03-31
**Auto-Updated:** Yes — via `update-delta-docs` skill + scheduled task
**Total Files:** 17 documentation files, 5,500+ lines

---

## Quick Start

**Starting a new Claude session?** Paste this:
```
Read ALL files in ~/Desktop/Delta-Intelligence-Docs/ starting with INDEX.md,
then give me a 3-sentence status summary and the highest-priority next action.
```

---

## Document Map

### TIER 1 — Read These First (Project Context)

| File | Lines | What It Contains | When To Read |
|------|-------|-----------------|-------------|
| [PROJECT_STATUS.md](./PROJECT_STATUS.md) | 119 | Current state of everything — what's built, what's broken, what's blocked | Every session start |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 174 | System components, tech stack, triple-database strategy, 6 engines | When planning features |
| [ROADMAP.md](./ROADMAP.md) | 302 | 6-wave development plan with dependencies and ROI milestones | When prioritizing work |
| [OPTIMIZATIONS.md](./OPTIMIZATIONS.md) | 141 | 20 gaps ranked by severity, 12 control alignment statuses | When fixing issues |

### TIER 2 — Deep Reference (Architecture & Schemas)

| File | Lines | What It Contains | When To Read |
|------|-------|-----------------|-------------|
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | 512 | All 24 Supabase tables, SQLite views, TimescaleDB hypertables, RLS matrix | When building/querying |
| [NEO4J_SCHEMA.md](./NEO4J_SCHEMA.md) | 350 | 13 node types, 23+ relationship types, Cypher examples, 6 key queries | When building graph features |
| [INTEGRATIONS.md](./INTEGRATIONS.md) | 488 | 16 system integration plans with connection methods, data flows, priorities | When wiring integrations |
| [DATA_MAPPINGS.md](./DATA_MAPPINGS.md) | 294 | Field-level source→target for every parser, JE generation formulas | When building parsers/ETL |
| [ENDPOINTS.md](./ENDPOINTS.md) | 600+ | Every API route, MCP endpoint, database endpoint, integration point mapped | When building/debugging APIs |
| [UNIFIED_DATA_ARCHITECTURE.md](./UNIFIED_DATA_ARCHITECTURE.md) | 594 | Supabase Vector + Neo4j + TigerGraph + RAG + Data Lake + NetSuite replacement | When making architecture decisions |

### TIER 3 — Implementation (Agents, Prompts, Training)

| File | Lines | What It Contains | When To Read |
|------|-------|-----------------|-------------|
| [AGENT_CONFIGS.md](./AGENT_CONFIGS.md) | 426 | 9 WorkflowOS AI agents with schedules, triggers, inter-agent wiring | When building/deploying agents |
| [PROMPTS.md](./PROMPTS.md) | 390 | 12 ready-to-paste Claude prompts + session context loader | When starting implementation work |
| [PROMPTS_ADVANCED.md](./PROMPTS_ADVANCED.md) | 350 | 8 deep implementation prompts for integrations, RAG, TigerGraph | When building advanced features |
| [TRAINING_DATA.md](./TRAINING_DATA.md) | 400+ | All training/context data indexed for AI agents and RAG pipeline | When seeding AI systems |

### TIER 4 — Living Trackers (Auto-Updated)

| File | Lines | What It Contains | When To Read |
|------|-------|-----------------|-------------|
| [CHANGELOG.md](./CHANGELOG.md) | 105+ | Running log of all work completed, most recent first | To see what's changed |
| [ALIGNMENT_TRACKER.md](./ALIGNMENT_TRACKER.md) | 300+ | Living tracker: what's aligned, what's drifted, what needs attention | Weekly review |
| [USE_CASES.md](./USE_CASES.md) | 202 | 30 use cases by persona — built, designed, expansion | When scoping features |

---

## Cross-Reference Map

### By System
| System | Integration | Data Mapping | Endpoints | Agent |
|--------|------------|-------------|-----------|-------|
| PDI Ascend | INTEGRATIONS §1 | DATA_MAPPINGS §Ascend | ENDPOINTS §Ascend ETL | JE Agent, Recon Agent |
| Salesforce | INTEGRATIONS §7 | DATA_MAPPINGS §Salesforce | ENDPOINTS §Salesforce MCP | — |
| Samsara | INTEGRATIONS §6 | DATA_MAPPINGS §Samsara | ENDPOINTS §Samsara API | — |
| Paylocity | INTEGRATIONS §2 | DATA_MAPPINGS §Paylocity | ENDPOINTS §Paylocity | JE Agent |
| Vroozi | INTEGRATIONS §3 | DATA_MAPPINGS §Vroozi | ENDPOINTS §Vroozi | AP Agent |
| StoneX | INTEGRATIONS §4 | DATA_MAPPINGS §StoneX | ENDPOINTS §StoneX Parser | JE Agent |
| JPMorgan | INTEGRATIONS §5 | DATA_MAPPINGS §JPMorgan | ENDPOINTS §JPM Parser | Recon Agent, Cash Agent |
| Power BI | INTEGRATIONS §8 | — | ENDPOINTS §Power BI MCP | — |
| Supabase | DATABASE_SCHEMA | — | ENDPOINTS §Supabase | All agents |
| Neo4j | NEO4J_SCHEMA | — | ENDPOINTS §Neo4j | Brief Agent |
| TigerGraph | UNIFIED_DATA §Layer4 | — | ENDPOINTS §TigerGraph | — |

### By Engine
| Engine | Schema | Agent | Endpoints | Use Cases |
|--------|--------|-------|-----------|-----------|
| Journal Entries | DATABASE §JE | JE Agent | ENDPOINTS §JE API | USE_CASES §2,3,14 |
| Reconciliation | DATABASE §Recon | Recon Agent | ENDPOINTS §Recon API | USE_CASES §4 |
| Close Management | DATABASE §Close | Close Agent | ENDPOINTS §Close API | USE_CASES §2,11 |
| Cash Flow | DATABASE §Cash | Cash Agent | ENDPOINTS §Cash API | USE_CASES §5 |
| Reporting | DATABASE §Report | Package Agent | ENDPOINTS §Report API | USE_CASES §6,16 |
| Insights | DATABASE §Insights | Brief Agent | ENDPOINTS §Insights API | USE_CASES §10 |

### By Person
| Person | Role | Primary Use Cases | Agents That Serve Them |
|--------|------|-------------------|----------------------|
| Taylor Veazey | Controller | 1-9, 11, 14 | All 9 agents |
| Lea Centanni | Controller | 2-7, 13-15 | JE, Recon, Close, AP |
| David Carmichael | Dir. Accounting | 3, 4, 7, 14 | JE, Recon |
| Bill Didsbury | Tax Manager | 3 (tax JEs) | JE Agent (tax family) |
| Adam Vegas | CEO | 1, 5, 10, 23-24 | Brief, Cash, Package |
| Mike Long | Finance Exec | 1, 5, 10, 15 | Brief, Cash, Package |
| Brad Vencil | VP Technology | System health | Exception Monitor |
| Evan Theiss | Admin/Builder | All | All |

---

## Update Protocol

This documentation is maintained by the `update-delta-docs` scheduled skill:

1. **On every Claude session that modifies the codebase:**
   - CHANGELOG.md gets a new entry
   - ALIGNMENT_TRACKER.md statuses refresh
   - ENDPOINTS.md updates if routes changed

2. **Weekly (Monday 8am):**
   - Full alignment check across all docs
   - PROJECT_STATUS.md refreshes
   - ROADMAP.md wave progress updates

3. **On major milestones:**
   - All 17 docs reviewed and updated
   - New documents created if scope expanded
   - Cross-references validated

4. **Manual trigger:**
   - Tell Claude: "Run the update-delta-docs skill"
   - Or: "Update the Delta Intelligence documentation"
