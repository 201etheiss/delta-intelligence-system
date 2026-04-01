# Delta Intelligence System — Endpoint & Connection Map

**Last Updated:** 2026-03-31

Every API route, MCP endpoint, database connection, external API, and integration point — indexed and cross-referenced.

---

## Internal API Routes (FastAPI — 101 Endpoints)

### Auth (/api/auth)
| Method | Route | Purpose | Auth | Module |
|--------|-------|---------|------|--------|
| POST | /api/auth/login | User login, returns JWT | None | Auth |
| POST | /api/auth/logout | Invalidate session | JWT | Auth |
| POST | /api/auth/refresh | Refresh JWT token | JWT | Auth |
| GET | /api/auth/me | Current user profile | JWT | Auth |
| POST | /api/auth/invite | Send user invitation | Admin | Auth |

### Journal Entries (/api/je)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/je/templates | List all 43 JE templates | JWT | — |
| GET | /api/je/templates/{family} | Templates by JE family | JWT | — |
| GET | /api/je/templates/{id} | Template detail with calc logic | JWT | — |
| POST | /api/je/draft | Create JE draft from template | JWT | JE Agent |
| GET | /api/je/drafts | List all drafts | JWT | — |
| GET | /api/je/{id} | JE detail with lines | JWT | — |
| PUT | /api/je/{id} | Update JE (edit lines) | JWT | — |
| POST | /api/je/{id}/submit | Submit for review | JWT | — |
| POST | /api/je/{id}/approve | Approve JE | Controller | — |
| POST | /api/je/{id}/reject | Reject with reason | Controller | — |
| POST | /api/je/{id}/post | Post to GL | Controller | — |
| POST | /api/je/{id}/reverse | Reverse posted JE | Controller | — |
| GET | /api/je/pipeline | JE counts by status | JWT | Close Agent |
| GET | /api/je/late-posted | Flagged late-posted transactions | JWT | — |
| POST | /api/je/auto-generate | AI-generate JE from source data | JWT | JE Agent |

### Reconciliation (/api/recon)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/recon/rules | List 37 recon rules | JWT | — |
| GET | /api/recon/rules/{id} | Rule detail | JWT | — |
| POST | /api/recon/run | Execute reconciliation | JWT | Recon Agent |
| GET | /api/recon/runs | List runs with status | JWT | — |
| GET | /api/recon/runs/{id} | Run detail with exceptions | JWT | — |
| GET | /api/recon/exceptions | All open exceptions | JWT | Exception Monitor |
| PUT | /api/recon/exceptions/{id} | Resolve/waive exception | JWT | — |
| GET | /api/recon/heatmap | Exception heatmap data | JWT | — |

### Close Management (/api/close)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/close/templates | List 47 close templates | JWT | — |
| POST | /api/close/generate | Generate checklist for period | JWT | Close Agent |
| GET | /api/close/{period} | Checklist for period | JWT | — |
| PUT | /api/close/{period}/{task_id} | Update task status | JWT | — |
| GET | /api/close/{period}/timeline | Close progress by day | JWT | Close Agent |
| GET | /api/close/{period}/blockers | Blocked tasks with dependencies | JWT | Close Agent |
| GET | /api/close/velocity | Close velocity trending | JWT | — |

### Cash Flow (/api/cashflow)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/cashflow/position | Current cash position | JWT | Cash Agent |
| GET | /api/cashflow/forecast | 13-week forecast | JWT | Cash Agent |
| POST | /api/cashflow/forecast | Create/update forecast | JWT | — |
| GET | /api/cashflow/borrowing-base | Current borrowing base calc | JWT | Cash Agent |
| GET | /api/cashflow/loc | LOC status (acct 25100) | JWT | — |

### Reporting (/api/reporting)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/reporting/packages | List financial packages | JWT | — |
| POST | /api/reporting/packages | Create package for period | JWT | Package Agent |
| GET | /api/reporting/packages/{id} | Package detail | JWT | — |
| POST | /api/reporting/packages/{id}/scan | Run integrity scan | JWT | Package Agent |
| GET | /api/reporting/packages/{id}/issues | Integrity issues | JWT | — |
| POST | /api/reporting/packages/{id}/commentary | Add/draft commentary | JWT | Package Agent |
| POST | /api/reporting/packages/{id}/publish | Publish package | Controller | — |
| GET | /api/reporting/flash | Flash summary (Day 2) | JWT | Package Agent |

### Insights (/api/insights)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/insights/briefs | List intelligence briefs | JWT | — |
| POST | /api/insights/briefs/generate | Generate brief (daily/weekly) | JWT | Brief Agent |
| GET | /api/insights/briefs/{id} | Brief detail (10 sections) | JWT | — |
| POST | /api/insights/briefs/{id}/distribute | Send to recipients | JWT | — |
| GET | /api/insights/patterns | AI-detected patterns | JWT | — |

### Source Import (/api/import)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| POST | /api/import/upload | Upload source file | JWT | — |
| GET | /api/import/history | Import history | JWT | — |
| GET | /api/import/{id} | Import detail with parse results | JWT | — |
| POST | /api/import/{id}/preview | Preview parsed data | JWT | — |
| POST | /api/import/{id}/commit | Commit to database | JWT | — |
| GET | /api/import/parsers | Available parsers list | JWT | — |

### RAG / Search (/api/search)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| POST | /api/search/query | Natural language query → RAG pipeline | JWT | — |
| POST | /api/search/similar-je | Find similar journal entries | JWT | JE Agent |
| POST | /api/search/similar-commentary | Find similar variance explanations | JWT | Package Agent |
| GET | /api/search/context/{type} | Retrieve context by type | JWT | — |

### Fleet (/api/fleet) — NEW
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/fleet/vehicles | List all 178 vehicles | JWT | — |
| GET | /api/fleet/vehicles/{id} | Vehicle detail + Samsara data | JWT | — |
| GET | /api/fleet/locations | Current GPS positions | JWT | — |
| GET | /api/fleet/diagnostics | Engine readings summary | JWT | — |
| GET | /api/fleet/depreciation | Depreciation calculations | JWT | JE Agent |

### People Intelligence (/api/people) — NEW
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/people | List all mapped people | JWT | — |
| GET | /api/people/{id} | Person detail + SignalMap profile | JWT | — |
| GET | /api/people/{id}/profile | Full SignalMap operator profile | JWT | — |
| GET | /api/people/org-chart | Organizational hierarchy | JWT | — |

### Graph (/api/graph)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| POST | /api/graph/query | Execute Cypher query | JWT | — |
| GET | /api/graph/account/{id} | Account relationship chain | JWT | — |
| GET | /api/graph/dependencies | Close dependency DAG | JWT | Close Agent |
| GET | /api/graph/systems | System integration map | JWT | — |
| POST | /api/graph/sid/analyze | Run SID analysis | Admin | SID Agent |

### Admin (/api/admin)
| Method | Route | Purpose | Auth | Agent |
|--------|-------|---------|------|-------|
| GET | /api/admin/health | System health check | JWT | — |
| GET | /api/admin/audit-log | Audit trail | Admin | — |
| GET | /api/admin/users | User management | Admin | — |
| POST | /api/admin/users | Create user | Admin | — |
| PUT | /api/admin/users/{id} | Update user role | Admin | — |
| GET | /api/admin/agents | Agent status dashboard | Admin | All |
| POST | /api/admin/agents/{id}/trigger | Manually trigger agent | Admin | — |
| GET | /api/admin/sync-status | Integration sync statuses | Admin | — |

---

## MCP Endpoints (External Connectors)

### Salesforce MCP (sf_*)
| Tool | Purpose | Data Flow |
|------|---------|----------|
| sf_query | SOQL queries | SF → Delta Intelligence |
| sf_get_record | Single record lookup | SF → Delta Intelligence |
| sf_search | SOSL cross-object search | SF → Delta Intelligence |
| sf_create_record | Create SF record | Delta Intelligence → SF |
| sf_update_record | Update SF record | Delta Intelligence → SF |
| sf_delete_record | Delete SF record | Delta Intelligence → SF |
| sf_describe | Object schema description | SF → Documentation |
| sf_list_objects | List all queryable objects | SF → Documentation |

**Key SOQL queries to index:**
```sql
-- Accounts for AR/Credit module
SELECT Id, Name, BillingAddress, Phone, Industry, AnnualRevenue, Type
FROM Account WHERE Type = 'Customer' LIMIT 10000

-- Credit applications
SELECT Id, Name, Account__c, Status__c, Requested_Amount__c
FROM Credit_Application__c

-- Opportunities for revenue forecast
SELECT Id, Name, Amount, StageName, CloseDate, Probability, AccountId
FROM Opportunity WHERE IsClosed = false

-- Terminals for margin analytics
SELECT Id, Name FROM Terminals_and_Refineries__c

-- Wells for O&G division
SELECT Id, Name FROM Well__c
```

### Power BI MCP (powerbi-mcp)
| Tool | Purpose | Data Flow |
|------|---------|----------|
| list_workspaces | Enumerate workspaces | PBI → Inventory |
| create_workspace | Create Delta360 workspace | → PBI |
| list_datasets | Enumerate datasets | PBI → Inventory |
| create_push_dataset | Create real-time dataset | → PBI |
| push_rows | Push data rows | Delta Intelligence → PBI |
| execute_dax_query | Run DAX against semantic model | PBI → Analytics |
| refresh_dataset | Trigger dataset refresh | → PBI |
| list_reports | Enumerate reports | PBI → Inventory |
| get_report_pages | Report page details | PBI → Inventory |
| export_report | Export report (PDF/PPTX/PNG) | PBI → Files |
| generate_embed_token | Embed in Delta Intelligence UI | PBI → Embedding |
| get_refresh_history | Check refresh status | PBI → Monitoring |

### Session Info MCP (session_info)
| Tool | Purpose | Data Flow |
|------|---------|----------|
| list_sessions | List Claude sessions | → Session History |
| read_transcript | Read session transcript | → Context Recovery |

### Scheduled Tasks MCP (scheduled-tasks)
| Tool | Purpose | Data Flow |
|------|---------|----------|
| create_scheduled_task | Create recurring task | → Automation |
| list_scheduled_tasks | List all scheduled tasks | → Monitoring |
| update_scheduled_task | Modify task schedule | → Automation |

---

## Database Connections

### Supabase PostgreSQL
| Property | Value |
|----------|-------|
| Host | db.ohbqjralhrjqoftkkety.supabase.co |
| Port | 5432 |
| Database | postgres |
| User | postgres |
| Tables | 24 core + 6 new (fleet, people, assessment, investment, automation, SID) = 30 |
| Extensions | pgvector, timescaledb (if supported), uuid-ossp |
| RLS | Enabled, 5 role levels |

### Supabase REST API
| Endpoint | Purpose |
|----------|---------|
| https://ohbqjralhrjqoftkkety.supabase.co/rest/v1/ | Table CRUD |
| https://ohbqjralhrjqoftkkety.supabase.co/auth/v1/ | Auth |
| https://ohbqjralhrjqoftkkety.supabase.co/storage/v1/ | File storage |
| https://ohbqjralhrjqoftkkety.supabase.co/realtime/v1/ | Real-time subscriptions |

### Neo4j Aura
| Property | Value |
|----------|-------|
| URI | neo4j+s://2b6eeb9d.databases.neo4j.io |
| Query API | https://2b6eeb9d.databases.neo4j.io/db/2b6eeb9d/query/v2 |
| Username | 2b6eeb9d |
| Node Types | 13 + 6 new (OperatorProfile, InvestmentVehicle, AutomationOpportunity, SID nodes) |
| Relationship Types | 23+ and growing |

### TimescaleDB (Existing Fleet)
| Property | Value |
|----------|-------|
| Service | TimescaleDB Cloud |
| Hypertables | 3 existing (gps_readings, engine_readings, hos_logs) + 8 from Rift Market Engine |
| Extension | timescaledb 2.25.2 |

### Local PostgreSQL (Ascend Mirror)
| Property | Value |
|----------|-------|
| Host | localhost |
| Port | 5432 |
| Database | ascend |
| User | evantheiss |
| Status | NOT YET MIGRATED (toolkit ready at ~/Desktop/ascend-migration/) |

### Local SQLite
| Property | Value |
|----------|-------|
| Path | delta-system/data/delta_phase2.db |
| Tables | Mirror of Supabase core tables |
| Views | 9 dashboard views |

---

## External API Connections

### Samsara Fleet API
| Endpoint | Purpose | Auth |
|----------|---------|------|
| GET api.samsara.com/fleet/vehicles | Vehicle list | API key |
| GET api.samsara.com/fleet/vehicles/locations | GPS positions | API key |
| GET api.samsara.com/fleet/vehicles/stats | Diagnostics | API key |
| GET api.samsara.com/fleet/hos/logs | HOS compliance | API key |

### Claude API (Anthropic)
| Endpoint | Purpose | Models |
|----------|---------|--------|
| POST api.anthropic.com/v1/messages | Agent responses | haiku-4-5, sonnet-4-6, opus-4-6 |
| POST api.anthropic.com/v1/embeddings | Vector embeddings | (if available, else OpenAI) |

### OpenAI API (Embeddings)
| Endpoint | Purpose | Model |
|----------|---------|-------|
| POST api.openai.com/v1/embeddings | Vector embeddings for RAG | text-embedding-ada-002 |

### Paylocity API (Future)
| Endpoint | Purpose | Auth |
|----------|---------|------|
| POST api.paylocity.com/api/v2/companies/{id}/employees | Employee data | OAuth2 |
| GET api.paylocity.com/api/v2/companies/{id}/employees/{id}/paystatement | Pay details | OAuth2 |

---

## GitHub Repository

| Property | Value |
|----------|-------|
| URL | https://github.com/201etheiss/delta-intelligence-system |
| Visibility | Private |
| Status | CREATED, NOT YET PUSHED |
| PAT | github_pat_11B7TVUIA... (in SKILL.md) |
