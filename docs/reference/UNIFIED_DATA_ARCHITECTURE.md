# Delta Intelligence System — Unified Data Architecture

**Last Updated:** 2026-03-31

The master architecture for tying together Supabase Vector (embeddings/RAG), Neo4j (entity graph), TigerGraph (time-series graph), and a data lake layer into a single unified intelligence platform — with an Ascend-to-Delta migration path that makes NetSuite unnecessary.

---

## Vision: Why Build vs. Buy NetSuite

Delta360 is evaluating NetSuite to replace PDI Ascend. But the 167GB Ascend database already contains everything NetSuite would provide, and Delta Intelligence is already being built as the intelligence layer on top. The opportunity:

**Build a purpose-built ERP overlay that:**
1. Ingests the full Ascend data model (already have the 167GB backup + migration toolkit)
2. Prunes and optimizes the schema for Delta360's actual needs (fuel distribution, not generic ERP)
3. Adds the intelligence layer NetSuite can't provide (AI agents, graph analytics, RAG, real-time briefs)
4. Costs a fraction of NetSuite licensing ($50K-150K/year for mid-market NetSuite vs ~$5K/year for Supabase + Neo4j + TigerGraph cloud)
5. Is fully customizable — Taylor gets exactly what he needs, not a generic ERP with 500 modules he'll never use

**The architecture makes this possible by:**
- Using Ascend's data model as the foundation (167GB of real operational data)
- Pruning to only the tables/columns Delta360 actually uses
- Mapping everything into a modern cloud-native stack
- Adding AI/ML capabilities no ERP provides

---

## Architecture Overview

```
                    ┌──────────────────────────────────────────┐
                    │          DELTA INTELLIGENCE UI            │
                    │    (Next.js 14 + React + Recharts)        │
                    └──────────────────┬───────────────────────┘
                                       │
                    ┌──────────────────┴───────────────────────┐
                    │          UNIFIED QUERY API                │
                    │    (FastAPI + GraphQL Federation)          │
                    │    Single endpoint for ALL data stores     │
                    └──┬────┬────┬────┬────┬────┬─────────────┘
                       │    │    │    │    │    │
           ┌───────────┘    │    │    │    │    └──────────┐
           │                │    │    │    │               │
    ┌──────┴──────┐  ┌─────┴────┐ ┌──┴───┐ ┌───┴──┐  ┌───┴──────┐
    │  Supabase   │  │ Supabase │ │Neo4j │ │Tiger │  │  Data     │
    │  PostgreSQL │  │  Vector  │ │ Aura │ │Graph │  │  Lake     │
    │  (tables)   │  │ (pgvec)  │ │(graph)│ │(time)│  │ (Parquet) │
    └──────┬──────┘  └─────┬────┘ └──┬───┘ └───┬──┘  └───┬──────┘
           │               │         │         │          │
    24 tables        Embeddings   13 node   Temporal    Raw/Curated
    6 engines        RAG search   types     graph       All sources
    RLS policies     Semantic     23 rels   Causal      CDC streams
                     similarity             chains
```

---

## Layer 1: Supabase PostgreSQL (Relational Core)

**Purpose:** Source of truth for all structured financial data. Powers the 6 engines.

**What's here:** All 24 tables from DATABASE_SCHEMA.md — journal_entries, recon_runs, close_checklists, cash_flow_forecasts, reporting_packages, intelligence_briefs, accounts, users, audit_log, etc.

**Ascend Migration Path:**
The 167GB Ascend database gets migrated to PostgreSQL (toolkit built). But we don't keep all of it — we prune:

```
ASCEND (167GB, hundreds of tables)
    │
    ├── KEEP & OPTIMIZE (core financial tables):
    │   ├── GL Transactions → journal_entries + je_lines
    │   ├── Chart of Accounts → accounts
    │   ├── AP Transactions → ap_invoices + ap_invoice_lines
    │   ├── AR Aging → ar_aging + borrowing_base
    │   ├── Inventory → inventory_positions
    │   ├── Equipment/Assets → fixed_assets + fleet_vehicles
    │   ├── Customer Master → customers (+ Neo4j Account nodes)
    │   ├── Vendor Master → vendors (+ Neo4j Vendor nodes)
    │   ├── Fuel Pricing → fuel_pricing + margin_analytics
    │   └── Delivery Scheduling → delivery_schedule
    │
    ├── ARCHIVE (historical, query-only):
    │   ├── Prior year GL detail → data lake (Parquet)
    │   ├── Closed AP/AR → data lake (Parquet)
    │   └── Legacy equipment → data lake (Parquet)
    │
    └── DROP (unused modules):
        ├── Ascend POS modules (not used)
        ├── Legacy reporting tables (replaced by Delta Intelligence)
        └── System/config tables (Ascend-specific)
```

**Estimated pruned size:** ~5-15GB of active data (vs 167GB full dump)

### Ascend Table → Delta Intelligence Table Mapping

| Ascend Schema.Table | Rows (Est.) | → Delta Intelligence Table | Action |
|---------------------|------------|---------------------------|--------|
| dbo.GLTransactions | ~2M | journal_entries + je_lines | Migrate + transform |
| dbo.ChartOfAccounts | ~500 | accounts | Migrate + enrich |
| dbo.APInvoiceHeader | ~50K | ap_invoices | Migrate + transform |
| dbo.APInvoiceDetail | ~200K | ap_invoice_lines | Migrate + transform |
| dbo.ARAgingDetail | ~20K | ar_aging | Migrate + transform |
| dbo.InventoryMaster | ~5K | inventory_positions | Migrate + transform |
| dbo.Equipment | ~3.5K | fixed_assets | Migrate + crosswalk Samsara |
| dbo.CustomerMaster | ~10K | customers + Neo4j | Migrate + dual-write |
| dbo.VendorMaster | ~5K | vendors + Neo4j | Migrate + dual-write |
| dbo.FuelPricing | ~100K | fuel_pricing | Migrate |
| dbo.DeliverySchedule | ~50K | delivery_schedule | Migrate |
| dbo.TrialBalance | Monthly | reporting_snapshots | Migrate + snapshot |
| dbo.BankTransactions | ~100K | bank_transactions | Migrate |
| Various history tables | ~5M+ | Data Lake (Parquet) | Archive |

---

## Layer 2: Supabase Vector (pgvector — Embeddings & RAG)

**Purpose:** Semantic search, document retrieval, AI-grounded responses. This is what makes the system "intelligent" — every document, JE description, commentary, and context record is embedded and searchable.

### Schema

```sql
-- Enable extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document embeddings (uploaded reports, policies, audit docs)
CREATE TABLE document_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    content         TEXT NOT NULL,
    embedding       vector(1536) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
        -- {source_type, source_id, document_name, period, tags[], entity_id}
    chunk_index     INTEGER DEFAULT 0,
    total_chunks    INTEGER DEFAULT 1,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- JE pattern embeddings (for "find similar JEs")
CREATE TABLE je_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    je_id           INTEGER REFERENCES journal_entries(id),
    content         TEXT NOT NULL,
        -- Concatenation of: template name + description + account names + amounts
    embedding       vector(1536) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
        -- {family, template_id, period, total_amount, account_numbers[]}
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Commentary embeddings (for "find similar variance explanations")
CREATE TABLE commentary_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    commentary_id   INTEGER REFERENCES variance_commentary(id),
    content         TEXT NOT NULL,
    embedding       vector(1536) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
        -- {account_number, period, variance_amount, variance_pct}
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Context embeddings (134 master context records + growing)
CREATE TABLE context_embeddings (
    id              BIGSERIAL PRIMARY KEY,
    context_type    VARCHAR(100) NOT NULL,
        -- person, system, workstream, module, je_family, control, account, process
    content         TEXT NOT NULL,
    embedding       vector(1536) NOT NULL,
    metadata        JSONB NOT NULL DEFAULT '{}',
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for fast similarity search
CREATE INDEX ON document_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON je_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX ON commentary_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
CREATE INDEX ON context_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 50);
```

### RAG Pipeline

```
USER QUESTION
    │
    ├── 1. Embed question (Anthropic Embeddings API or OpenAI ada-002)
    │
    ├── 2. Vector similarity search (top-k=10, threshold=0.75)
    │   ├── Search document_embeddings (reports, policies)
    │   ├── Search je_embeddings (similar transactions)
    │   ├── Search commentary_embeddings (similar explanations)
    │   └── Search context_embeddings (organizational knowledge)
    │
    ├── 3. Metadata filter (narrow by period, account, entity if specified)
    │
    ├── 4. Re-rank results (cross-encoder or Anthropic re-rank)
    │
    ├── 5. Assemble context window:
    │   ├── Top 5 most relevant chunks
    │   ├── Current system state (from Supabase queries)
    │   └── Relevant graph context (from Neo4j)
    │
    ├── 6. Call Claude API:
    │   ├── System prompt: Delta Intelligence controller assistant
    │   ├── Context: assembled from steps 2-5
    │   └── User question: original query
    │
    └── 7. Return grounded response with source citations
```

### Embedding Strategy

| Content Type | Count | Chunk Size | Overlap | Model | Refresh |
|-------------|-------|-----------|---------|-------|---------|
| Master context records | 134 | Full record | — | ada-002 | On update |
| JE templates | 43 | Full template | — | ada-002 | On update |
| Recon rules | 37 | Full rule | — | ada-002 | On update |
| Close templates | 47 | Full template | — | ada-002 | On update |
| Historical JEs | ~2M | 500 tokens | 50 | ada-002 | Weekly batch |
| Variance commentary | Growing | Full commentary | — | ada-002 | On creation |
| Intelligence briefs | Growing | By section | — | ada-002 | On creation |
| Uploaded documents | Variable | 500 tokens | 50 | ada-002 | On upload |

---

## Layer 3: Neo4j Aura (Entity Relationship Graph)

**Purpose:** Relationship intelligence. What flat tables can't show — organizational structure, account hierarchies, dependency chains, causal relationships.

See NEO4J_SCHEMA.md for full schema (13 node types, 23+ relationship types).

**Key addition for unified architecture:** Neo4j becomes the "relationship index" that enriches every query from the other layers:

```
Supabase query: "Show me journal entries for account 10345"
    + Neo4j enrichment: "Account 10345 (Broker-FC Stone) is linked to StoneX hedging,
      with relationships to accounts 68115 (commission) and 80200 (gain/loss).
      Owner: Taylor Veazey. Part of Treasury/Borrowing Base workstream."
```

### Neo4j → Supabase Vector Bridge

When new entities are created in Neo4j, automatically embed them in pgvector:
```python
# On neo4j node create/update:
async def sync_node_to_vector(node_type, node_id, properties):
    content = f"{node_type}: {properties['name']}. {properties.get('description', '')}"
    embedding = await get_embedding(content)
    await supabase.table('context_embeddings').upsert({
        'context_type': node_type.lower(),
        'content': content,
        'embedding': embedding,
        'metadata': {'neo4j_id': node_id, **properties}
    })
```

---

## Layer 4: TigerGraph (Time-Series Graph Analytics)

**Purpose:** Temporal graph traversal — tracing causal chains through time, detecting patterns in sequences, and forecasting based on historical graph evolution.

### Why TigerGraph (Not Just TimescaleDB)

TimescaleDB handles time-series storage well (and we keep it for fleet telemetry). But TigerGraph adds **graph traversal over time** — following relationships through temporal sequences:

| Capability | TimescaleDB | TigerGraph |
|-----------|------------|-----------|
| Store time-series data | Yes | Yes |
| Aggregate over time windows | Yes | Yes |
| Traverse relationships across time | No | **Yes** |
| Causal chain analysis | No | **Yes** |
| Pattern detection in graph evolution | No | **Yes** |
| N-hop traversal with time ordering | No | **Yes** |

### TigerGraph Schema (GSQL)

```gsql
// Vertex types
CREATE VERTEX Account (
    PRIMARY_ID id STRING,
    name STRING,
    account_type STRING,
    normal_balance STRING
)

CREATE VERTEX JournalEntry (
    PRIMARY_ID id STRING,
    je_number STRING,
    period STRING,
    transaction_date DATETIME,
    post_date DATETIME,
    total_amount DOUBLE,
    status STRING,
    is_late_posted BOOL
)

CREATE VERTEX Period (
    PRIMARY_ID id STRING,
    year_month STRING,
    close_day INT,
    is_closed BOOL
)

CREATE VERTEX SourceTransaction (
    PRIMARY_ID id STRING,
    source_system STRING,
    transaction_type STRING,
    amount DOUBLE,
    transaction_date DATETIME
)

CREATE VERTEX CashFlowEvent (
    PRIMARY_ID id STRING,
    event_type STRING,
    amount DOUBLE,
    event_date DATETIME,
    category STRING
)

CREATE VERTEX Exception (
    PRIMARY_ID id STRING,
    exception_type STRING,
    engine STRING,
    amount DOUBLE,
    aging_days INT,
    status STRING
)

// Edge types (all temporal)
CREATE DIRECTED EDGE POSTED_TO (FROM JournalEntry, TO Account,
    amount DOUBLE, is_debit BOOL, posted_at DATETIME)

CREATE DIRECTED EDGE SOURCED_FROM (FROM JournalEntry, TO SourceTransaction,
    confidence DOUBLE)

CREATE DIRECTED EDGE OCCURRED_IN (FROM JournalEntry, TO Period)

CREATE DIRECTED EDGE CAUSED_BY (FROM Exception, TO JournalEntry,
    detected_at DATETIME)

CREATE DIRECTED EDGE PRECEDED_BY (FROM CashFlowEvent, TO CashFlowEvent,
    days_between INT)

CREATE DIRECTED EDGE BALANCE_CHANGE (FROM Account, TO Account,
    period STRING, delta DOUBLE, via_je STRING)
```

### Key GSQL Queries

#### 1. Causal Chain: "What caused the variance in account X?"
```gsql
CREATE QUERY trace_variance(STRING account_id, STRING period) FOR GRAPH DeltaIntelligence {
    Start = {Account.*};

    // Find the account
    target = SELECT s FROM Start:s WHERE s.id == account_id;

    // Get all JEs posted to this account in the period
    jes = SELECT t FROM target:s -(POSTED_TO:e)- JournalEntry:t
          WHERE t.period == period
          ORDER BY t.post_date DESC;

    // Trace each JE back to its source
    sources = SELECT t FROM jes:s -(SOURCED_FROM:e)- SourceTransaction:t;

    // Find related exceptions
    exceptions = SELECT t FROM jes:s -(CAUSED_BY:e)- Exception:t;

    PRINT jes, sources, exceptions;
}
```

#### 2. Close Velocity Trending
```gsql
CREATE QUERY close_velocity(INT num_periods) FOR GRAPH DeltaIntelligence {
    Start = {Period.*};

    periods = SELECT s FROM Start:s
              WHERE s.is_closed == true
              ORDER BY s.year_month DESC
              LIMIT num_periods;

    // For each period, get JEs by day
    FOREACH p IN periods DO
        jes_by_day = SELECT t FROM p:s -(OCCURRED_IN:e)- JournalEntry:t
                     GROUP BY t.post_date;
        PRINT p.year_month, p.close_day, jes_by_day;
    END;
}
```

#### 3. Late-Posting Pattern Detection
```gsql
CREATE QUERY late_posting_patterns(INT lookback_months) FOR GRAPH DeltaIntelligence {
    Start = {JournalEntry.*};

    late = SELECT s FROM Start:s
           WHERE s.is_late_posted == true
           AND datetime_diff(s.post_date, s.transaction_date) > 30;

    // Group by account to find systematic late-posters
    accounts = SELECT t FROM late:s -(POSTED_TO:e)- Account:t;

    // Count by account
    late_by_account = SELECT t, COUNT(s) AS late_count
                      FROM late:s -(POSTED_TO:e)- Account:t
                      GROUP BY t
                      ORDER BY late_count DESC;

    PRINT late_by_account;
}
```

---

## Layer 5: Data Lake (Unified Ingestion/Egress)

**Purpose:** Raw and curated data from ALL sources, in Parquet format, with full lineage tracking.

### Architecture

```
SOURCE SYSTEMS
    │
    ▼
┌─────────────────────────────────────────────────┐
│              LANDING ZONE (Raw)                  │
│   Format: Original (CSV, JSON, BAI2, PDF)        │
│   Retention: 90 days                             │
│   Storage: Supabase Storage / S3                 │
├─────────────────────────────────────────────────┤
│              RAW ZONE (Standardized)             │
│   Format: Parquet, partitioned by source + date  │
│   Schema: source-native (no transformation)      │
│   Retention: 7 years                             │
├─────────────────────────────────────────────────┤
│              CURATED ZONE (Transformed)          │
│   Format: Parquet, Delta Intelligence schema     │
│   Transformations: type casting, dedup, enrich   │
│   Retention: 7 years                             │
├─────────────────────────────────────────────────┤
│              SERVING ZONE (Query-Ready)          │
│   Format: Views in Supabase (materialized)       │
│   Purpose: Powers dashboards, reports, exports   │
│   Refresh: On schedule per source                │
└─────────────────────────────────────────────────┘
```

### CDC (Change Data Capture) Strategy

| Source | CDC Method | Frequency | Landing → Raw → Curated |
|--------|-----------|-----------|------------------------|
| Ascend (local PG) | Logical replication / trigger-based | 15 min | Auto pipeline |
| Paylocity | API polling / webhook | Per pay period | On arrival |
| Vroozi | API polling | Hourly | On arrival |
| StoneX | File-based (statement parse) | Monthly | On upload |
| JPMorgan | File-based (BAI2 parse) | Daily | On upload |
| Samsara | API streaming | 5 min | Real-time |
| Salesforce | MCP query / Platform Events | Hourly | On arrival |

### Data Catalog

```json
{
    "catalog": [
        {
            "dataset": "ascend_gl_transactions",
            "source": "PDI Ascend",
            "format": "parquet",
            "partition_key": "transaction_date",
            "row_count": 2000000,
            "freshness": "15 minutes",
            "lineage": "Ascend SQL Server → Docker → PostgreSQL → Parquet",
            "schema_version": "2.0",
            "owner": "evan-theiss"
        }
    ]
}
```

---

## Unified Query Layer

### The Problem
Five data stores means five query languages: SQL (Supabase), Cypher (Neo4j), GSQL (TigerGraph), vector similarity (pgvector), file queries (data lake). Users shouldn't have to know which store has what.

### The Solution: Federated Query API

```python
# Unified query endpoint
@app.post("/api/query")
async def unified_query(request: UnifiedQueryRequest):
    """
    Single endpoint that routes to appropriate store(s) and merges results.
    """
    results = {}

    # 1. Structured data from Supabase
    if request.needs_structured:
        results['structured'] = await supabase_query(request.sql_filter)

    # 2. Relationship context from Neo4j
    if request.needs_graph:
        results['graph'] = await neo4j_query(request.cypher_filter)

    # 3. Temporal analysis from TigerGraph
    if request.needs_temporal:
        results['temporal'] = await tigergraph_query(request.gsql_filter)

    # 4. Semantic search from pgvector
    if request.needs_semantic:
        results['semantic'] = await vector_search(request.question)

    # 5. Merge and return
    return merge_results(results)
```

### Example: Complex Cross-Store Query

**User asks:** "Show me all late-posted JEs for account 10345, similar historical patterns, the causal chain, and related entity relationships."

**System executes:**
1. **Supabase:** `SELECT * FROM journal_entries WHERE account_number = '10345' AND post_date > transaction_date + interval '30 days'`
2. **pgvector:** `SELECT content, 1-cosine_distance FROM je_embeddings ORDER BY embedding <=> $question_embedding LIMIT 5`
3. **Neo4j:** `MATCH (a:Account {id:'10345'})-[*1..3]-(related) RETURN related`
4. **TigerGraph:** `RUN trace_variance('10345', '2026-03')`

**Merged response:** Structured JE data + similar historical JEs + entity relationships + causal chain from source transactions through to the variance.

---

## Ascend → Delta ERP: The NetSuite Replacement Path

### Why This Architecture Makes NetSuite Unnecessary

| Capability | NetSuite | Delta Intelligence |
|-----------|---------|-------------------|
| GL / Journal Entries | Yes (basic) | Yes + AI drafting + 12 JE family automation |
| AP Processing | Yes (basic) | Yes + AI auto-coding (>50% target) + touch-time analytics |
| AR / Credit | Yes | Yes + Salesforce D&B integration + graph-based risk scoring |
| Close Management | Manual checklists | AI-monitored close with dependency graph + Day 5 enforcement |
| Financial Reporting | Standard reports | AI-generated intelligence briefs + integrity scanning + commentary drafting |
| Reconciliation | Basic | AI-powered matching + $1 tolerance + exception aging + evidence vault |
| Cash Flow | Basic | 13-week forecast + borrowing base automation + LOC tracking |
| Audit Trail | Basic logging | Immutable evidence vault + PBC automation + 7-year retention |
| AI/ML | None | 9 AI agents + RAG + graph analytics + pattern detection |
| Customization | Expensive SuiteScript | Full control — it's your codebase |
| Licensing | $50-150K/year | ~$5K/year (Supabase + Neo4j + TigerGraph cloud) |
| Implementation | 6-12 months, $200K+ services | Already 60%+ built |

### Migration Path

```
Phase 1 (NOW): Run on Ascend data in PostgreSQL
    ↓
Phase 2 (Month 2-3): Delta Intelligence becomes the primary interface
    - Users log into Delta Intelligence, not Ascend
    - All JEs drafted in Delta Intelligence, posted back to Ascend
    - All reporting from Delta Intelligence
    ↓
Phase 3 (Month 4-6): Ascend becomes write-back only
    - Delta Intelligence is the single pane of glass
    - Ascend receives JE postings via API/import
    - Ascend handles only: fuel delivery dispatch, POS transactions
    ↓
Phase 4 (Month 7+): Evaluate Ascend replacement
    - If fuel/delivery modules can be replaced → full migration to Delta
    - If fuel/delivery needs Ascend → keep Ascend for operations only
    - Either way, Delta Intelligence IS the financial operating system
```

---

## Implementation Sequence

| Step | What | Where | Effort | Dependencies |
|------|------|-------|--------|-------------|
| 1 | Enable pgvector in Supabase | Supabase SQL editor | 10 min | None |
| 2 | Create embedding tables | Supabase SQL editor | 30 min | Step 1 |
| 3 | Build embedding pipeline (Python) | FastAPI backend | 1 day | Step 2 |
| 4 | Seed initial embeddings (134 context + templates) | Pipeline | 2 hours | Step 3 |
| 5 | Build RAG query endpoint | FastAPI | 1 day | Step 4 |
| 6 | Run Ascend migration toolkit | Local machine | 3 hours | Docker + disk space |
| 7 | Inventory and prune Ascend tables | Local PostgreSQL | 1 day | Step 6 |
| 8 | Build Ascend → Supabase ETL | Python pipeline | 2 days | Step 7 |
| 9 | Set up TigerGraph Cloud instance | tgcloud.io | 1 hour | None |
| 10 | Deploy TigerGraph schema (GSQL) | TigerGraph | 2 hours | Step 9 |
| 11 | Build TigerGraph loading pipeline | Python | 1 day | Steps 8, 10 |
| 12 | Build unified query API | FastAPI + GraphQL | 2 days | Steps 5, 8, 11 |
| 13 | Build data lake landing zone | Supabase Storage | 1 day | None |
| 14 | Build CDC pipelines for each source | Python workers | 1 week | Steps 6-13 |
| 15 | Integration testing | End-to-end | 2 days | All above |

**Total estimated effort:** 3-4 weeks for full unified architecture deployment.
