# Delta Intelligence — Documentation Index

## Primary Documentation (docs/)

### Architecture and Design
| File | Description |
|------|-------------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | System architecture — components, tech stack, data flow |
| [SPEC.md](./SPEC.md) | Full platform specification — features, modules, capabilities |
| [FULL_BUILDOUT_SCHEMA.md](./FULL_BUILDOUT_SCHEMA.md) | 35-module ERP replacement plan with phased buildout |
| [NAVIGATION.md](./NAVIGATION.md) | Navigation map — all pages under the dashboard layout |
| [TOKEN_OPTIMIZATION.md](./TOKEN_OPTIMIZATION.md) | Token optimization architecture for AI interactions |

### API and Integrations
| File | Description |
|------|-------------|
| [API_REFERENCE.md](./API_REFERENCE.md) | API endpoint reference — all Next.js API routes |
| [ENDPOINT_PATTERN_MAP.md](./ENDPOINT_PATTERN_MAP.md) | Endpoint, pattern, and schema cross-reference map |
| [GATEWAY_REFERENCE.md](./GATEWAY_REFERENCE.md) | Gateway endpoint reference — 8 services, 128 endpoints |
| [INTEGRATION_ROADMAP.md](./INTEGRATION_ROADMAP.md) | Integration plan — current state and next priorities |

### Data and Schema
| File | Description |
|------|-------------|
| [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) | Database schema — 24 Supabase tables, pgvector |
| [ASCEND_TABLE_MAP.md](./ASCEND_TABLE_MAP.md) | Ascend ERP complete table map — 5,105 tables |
| [DATA_MAP.md](./DATA_MAP.md) | Complete data map — source to destination field mappings |
| [PBI_VIEWS_MAPPING.md](./PBI_VIEWS_MAPPING.md) | Power BI views mapped to DI engine functions |
| [TAYLOR_WORKBOOK_MAPPING.md](./TAYLOR_WORKBOOK_MAPPING.md) | Taylor's Excel workbooks mapped to DI engines |

### Setup
| File | Description |
|------|-------------|
| [SETUP_GUIDE.md](./SETUP_GUIDE.md) | Full setup guide — Azure AD, gateway, services |

## Reference Documentation (docs/reference/)

These documents were consolidated from the original planning and design phase.

### Project Status and Planning
| File | Description |
|------|-------------|
| [reference/INDEX.md](./reference/INDEX.md) | Original master index with tiered reading order |
| [reference/PROJECT_STATUS.md](./reference/PROJECT_STATUS.md) | Current project status — what is built, broken, blocked |
| [reference/ROADMAP.md](./reference/ROADMAP.md) | 6-wave development plan with dependencies and ROI milestones |
| [reference/CHANGELOG.md](./reference/CHANGELOG.md) | Running log of all work completed |
| [reference/ALIGNMENT_TRACKER.md](./reference/ALIGNMENT_TRACKER.md) | Living tracker — aligned, drifted, needs attention |
| [reference/OPTIMIZATIONS.md](./reference/OPTIMIZATIONS.md) | 20 gaps ranked by severity, 12 control alignment statuses |
| [reference/DELTA_APPS.md](./reference/DELTA_APPS.md) | App consolidation map — all Delta360 apps |

### Architecture and Schema (Reference Copies)
| File | Description |
|------|-------------|
| [reference/ARCHITECTURE.md](./reference/ARCHITECTURE.md) | System architecture (reference copy from planning phase) |
| [reference/DATABASE_SCHEMA.md](./reference/DATABASE_SCHEMA.md) | Database schema (reference copy from planning phase) |
| [reference/NEO4J_SCHEMA.md](./reference/NEO4J_SCHEMA.md) | Neo4j graph schema — 13 node types, 23+ relationship types |
| [reference/UNIFIED_DATA_ARCHITECTURE.md](./reference/UNIFIED_DATA_ARCHITECTURE.md) | Unified data architecture — Supabase + Neo4j + TigerGraph + RAG |
| [reference/ENDPOINTS.md](./reference/ENDPOINTS.md) | Endpoint and connection map (reference copy) |
| [reference/DATA_MAPPINGS.md](./reference/DATA_MAPPINGS.md) | Field-level source to target mappings for parsers and ETL |
| [reference/INTEGRATIONS.md](./reference/INTEGRATIONS.md) | 16 system integration plans with connection methods |

### AI Agents and Prompts
| File | Description |
|------|-------------|
| [reference/AGENT_CONFIGS.md](./reference/AGENT_CONFIGS.md) | 9 WorkflowOS AI agent configurations with schedules and triggers |
| [reference/PROMPTS.md](./reference/PROMPTS.md) | 12 ready-to-use Claude prompts for implementation work |
| [reference/PROMPTS_ADVANCED.md](./reference/PROMPTS_ADVANCED.md) | 8 deep implementation prompts for integrations and RAG |
| [reference/Delta_Intelligence_All_Prompts.md](./reference/Delta_Intelligence_All_Prompts.md) | Complete Claude prompt library |
| [reference/Delta_Intelligence_Master_Action_Plan.md](./reference/Delta_Intelligence_Master_Action_Plan.md) | Master action plan and alignment report |
| [reference/TRAINING_DATA.md](./reference/TRAINING_DATA.md) | Training data and RAG index for AI agents |

### Use Cases
| File | Description |
|------|-------------|
| [reference/USE_CASES.md](./reference/USE_CASES.md) | 30 use cases by persona — built, designed, expansion |
