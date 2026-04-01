# Delta Intelligence System — Database Schema

**Last Updated:** 2026-03-31

Complete schema for all three databases: Supabase (PostgreSQL cloud), SQLite (local), and TimescaleDB (time-series).

---

## Architecture: Triple-Database Strategy

| Database | Purpose | Access | Persistence |
|----------|---------|--------|------------|
| SQLite | Local-first operations, offline capability, fast reads | File-based, FastAPI direct | Persists on machine |
| Supabase | Cloud sync, multi-user, RLS, real-time subscriptions | REST API + direct PG | Cloud-hosted |
| Neo4j | Relationship graph, pattern detection, entity chains | Bolt protocol | Aura cloud |
| TimescaleDB | Time-series data, fleet telemetry, feed analytics | Direct PG | Cloud-hosted |

**Write strategy:** Dual-write to SQLite + Supabase for all financial data. Neo4j gets relationship updates. TimescaleDB gets time-series.

---

## Supabase PostgreSQL — 24 Tables

### Auth & Users

```sql
-- users: System users with role-based access
CREATE TABLE users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    role            VARCHAR(50) NOT NULL DEFAULT 'viewer',
        -- admin, controller, analyst, executive, viewer
    department      VARCHAR(100),
    is_active       BOOLEAN DEFAULT true,
    last_login_at   TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- sessions: JWT session tracking
CREATE TABLE sessions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id         UUID REFERENCES users(id),
    token_hash      VARCHAR(255) NOT NULL,
    expires_at      TIMESTAMPTZ NOT NULL,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- audit_log: Every action traced
CREATE TABLE audit_log (
    id              BIGSERIAL PRIMARY KEY,
    user_id         UUID REFERENCES users(id),
    action          VARCHAR(100) NOT NULL,
        -- login, logout, je_draft, je_approve, je_post, recon_run, etc.
    entity_type     VARCHAR(100),
    entity_id       VARCHAR(255),
    details         JSONB,
    ip_address      INET,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Journal Entry Engine

```sql
-- je_templates: 43 templates across 12 families
CREATE TABLE je_templates (
    id              SERIAL PRIMARY KEY,
    family          VARCHAR(100) NOT NULL,
        -- depreciation, payroll, internal_billing, stonex_hedging,
        -- health_insurance_hsa, tax, prepaid_amortization,
        -- interest_allocation, fixed_assets, overhead_allocation,
        -- inventory_reserves, cash_flow_borrowing_base
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    frequency       VARCHAR(50), -- monthly, weekly, quarterly, annual
    source_system   VARCHAR(100), -- ascend, paylocity, vroozi, stonex, bank, manual
    account_lines   JSONB NOT NULL,
        -- [{account_no, account_name, debit_formula, credit_formula, description}]
    calc_logic      JSONB,
        -- Calculation rules, formulas, source field references
    validation_rules JSONB,
        -- Pre-post validation checks
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- journal_entries: Actual JE records with workflow state
CREATE TABLE journal_entries (
    id              SERIAL PRIMARY KEY,
    je_number       VARCHAR(50) UNIQUE NOT NULL,
    template_id     INTEGER REFERENCES je_templates(id),
    entity_id       INTEGER NOT NULL,
    period          VARCHAR(10) NOT NULL, -- YYYY-MM
    transaction_date DATE NOT NULL,
    post_date       DATE,
    status          VARCHAR(50) NOT NULL DEFAULT 'draft',
        -- draft, in_review, approved, posted, rejected, reversed
    total_debits    NUMERIC(19,4) NOT NULL DEFAULT 0,
    total_credits   NUMERIC(19,4) NOT NULL DEFAULT 0,
    description     TEXT,
    source          VARCHAR(100), -- manual, auto_generated, imported
    source_data     JSONB, -- Raw data from source system
    created_by      UUID REFERENCES users(id),
    reviewed_by     UUID REFERENCES users(id),
    approved_by     UUID REFERENCES users(id),
    posted_by       UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    posted_at       TIMESTAMPTZ,
    rejection_reason TEXT
);

-- je_lines: Individual debit/credit lines
CREATE TABLE je_lines (
    id              SERIAL PRIMARY KEY,
    je_id           INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,
    account_number  VARCHAR(50) NOT NULL,
    account_name    VARCHAR(255),
    debit           NUMERIC(19,4) DEFAULT 0,
    credit          NUMERIC(19,4) DEFAULT 0,
    description     TEXT,
    cost_center     VARCHAR(50),
    profit_center   VARCHAR(50),
    reference       VARCHAR(255),
    CONSTRAINT debits_or_credits CHECK (debit >= 0 AND credit >= 0)
);

-- je_evidence: Supporting documents for JEs
CREATE TABLE je_evidence (
    id              SERIAL PRIMARY KEY,
    je_id           INTEGER REFERENCES journal_entries(id) ON DELETE CASCADE,
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500) NOT NULL, -- Supabase Storage path
    file_hash       VARCHAR(64), -- SHA-256 for tamper detection
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Reconciliation Engine

```sql
-- recon_rules: 37 reconciliation rule sets
CREATE TABLE recon_rules (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    account_number  VARCHAR(50) NOT NULL,
    recon_type      VARCHAR(50) NOT NULL,
        -- balance_compare, detail_match, three_way_match
    source_a        VARCHAR(100), -- e.g., 'ascend_gl'
    source_b        VARCHAR(100), -- e.g., 'bank_statement'
    match_fields    JSONB, -- Fields to match on
    tolerance       NUMERIC(19,4) DEFAULT 1.00, -- $1 tolerance
    frequency       VARCHAR(50), -- daily, weekly, monthly
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- recon_runs: Each reconciliation execution
CREATE TABLE recon_runs (
    id              SERIAL PRIMARY KEY,
    rule_id         INTEGER REFERENCES recon_rules(id),
    period          VARCHAR(10) NOT NULL,
    status          VARCHAR(50) DEFAULT 'running',
        -- running, completed, exceptions_found, reviewed, closed
    source_a_balance NUMERIC(19,4),
    source_b_balance NUMERIC(19,4),
    difference      NUMERIC(19,4),
    matched_count   INTEGER DEFAULT 0,
    exception_count INTEGER DEFAULT 0,
    run_by          UUID REFERENCES users(id),
    reviewed_by     UUID REFERENCES users(id),
    run_at          TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at     TIMESTAMPTZ
);

-- recon_exceptions: Unmatched items
CREATE TABLE recon_exceptions (
    id              SERIAL PRIMARY KEY,
    run_id          INTEGER REFERENCES recon_runs(id) ON DELETE CASCADE,
    exception_type  VARCHAR(50), -- missing_in_a, missing_in_b, amount_mismatch, timing
    source          VARCHAR(10), -- a or b
    reference       VARCHAR(255),
    amount          NUMERIC(19,4),
    description     TEXT,
    status          VARCHAR(50) DEFAULT 'open',
        -- open, investigating, resolved, waived
    resolution_note TEXT,
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    aging_days      INTEGER GENERATED ALWAYS AS (
        EXTRACT(DAY FROM COALESCE(resolved_at, NOW()) - created_at)
    ) STORED,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- recon_evidence: Supporting docs for recon
CREATE TABLE recon_evidence (
    id              SERIAL PRIMARY KEY,
    run_id          INTEGER REFERENCES recon_runs(id),
    exception_id    INTEGER REFERENCES recon_exceptions(id),
    file_name       VARCHAR(255),
    file_path       VARCHAR(500),
    file_hash       VARCHAR(64),
    uploaded_by     UUID REFERENCES users(id),
    uploaded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Close Management Engine

```sql
-- close_templates: 47 close task templates
CREATE TABLE close_templates (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    day_target      INTEGER NOT NULL, -- Day of close (1-10)
    owner_role      VARCHAR(50), -- Who's responsible
    depends_on      INTEGER[], -- Template IDs this depends on
    estimated_hours DECIMAL(4,1),
    is_required     BOOLEAN DEFAULT true,
    category        VARCHAR(100),
        -- journal_entries, reconciliations, reporting, review, signoff
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- close_checklists: Actual close instances
CREATE TABLE close_checklists (
    id              SERIAL PRIMARY KEY,
    period          VARCHAR(10) NOT NULL, -- YYYY-MM
    template_id     INTEGER REFERENCES close_templates(id),
    status          VARCHAR(50) DEFAULT 'not_started',
        -- not_started, in_progress, blocked, completed, skipped
    assigned_to     UUID REFERENCES users(id),
    started_at      TIMESTAMPTZ,
    completed_at    TIMESTAMPTZ,
    blocked_reason  TEXT,
    evidence_ids    INTEGER[], -- References to evidence vault
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- close_timeline: Close progress tracking
CREATE TABLE close_timeline (
    id              SERIAL PRIMARY KEY,
    period          VARCHAR(10) NOT NULL,
    day_number      INTEGER NOT NULL,
    target_tasks    INTEGER NOT NULL,
    completed_tasks INTEGER DEFAULT 0,
    blocked_tasks   INTEGER DEFAULT 0,
    notes           TEXT,
    recorded_at     TIMESTAMPTZ DEFAULT NOW()
);
```

### Cash Flow Engine

```sql
-- cash_flow_forecasts: Weekly/monthly projections
CREATE TABLE cash_flow_forecasts (
    id              SERIAL PRIMARY KEY,
    period          VARCHAR(10) NOT NULL,
    forecast_date   DATE NOT NULL,
    category        VARCHAR(100) NOT NULL,
        -- operating_receipts, operating_disbursements,
        -- financing, investing, payroll, tax
    amount          NUMERIC(19,4) NOT NULL,
    confidence      VARCHAR(20) DEFAULT 'estimated',
        -- confirmed, estimated, projected
    source          VARCHAR(100), -- ascend, manual, calculated
    notes           TEXT,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- borrowing_base: LOC tracking
CREATE TABLE borrowing_base (
    id              SERIAL PRIMARY KEY,
    as_of_date      DATE NOT NULL,
    eligible_ar     NUMERIC(19,4),
    eligible_inventory NUMERIC(19,4),
    advance_rate_ar  DECIMAL(5,4), -- e.g., 0.85
    advance_rate_inv DECIMAL(5,4),
    total_availability NUMERIC(19,4),
    current_outstanding NUMERIC(19,4), -- Account 25100
    remaining_capacity  NUMERIC(19,4),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Reporting Engine

```sql
-- reporting_packages: Financial package tracking
CREATE TABLE reporting_packages (
    id              SERIAL PRIMARY KEY,
    period          VARCHAR(10) NOT NULL,
    package_type    VARCHAR(50) NOT NULL,
        -- monthly_close, flash, quarterly, annual
    status          VARCHAR(50) DEFAULT 'draft',
        -- draft, in_review, approved, published
    integrity_score INTEGER, -- 0-100, from integrity scan
    issue_count     INTEGER DEFAULT 0,
    tie_out_status  VARCHAR(50), -- passed, failed, not_run
    commentary_status VARCHAR(50), -- pending, drafted, approved
    published_at    TIMESTAMPTZ,
    published_by    UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- integrity_issues: Package integrity scan results
CREATE TABLE integrity_issues (
    id              SERIAL PRIMARY KEY,
    package_id      INTEGER REFERENCES reporting_packages(id) ON DELETE CASCADE,
    issue_type      VARCHAR(100) NOT NULL,
        -- formula_error, broken_link, month_anchor, balance_mismatch,
        -- missing_commentary, stale_data, circular_ref, inconsistent_format
    severity        VARCHAR(20) NOT NULL, -- critical, warning, info
    location        VARCHAR(255), -- Cell reference, page, section
    description     TEXT NOT NULL,
    resolution      TEXT,
    status          VARCHAR(50) DEFAULT 'open',
    resolved_by     UUID REFERENCES users(id),
    resolved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- variance_commentary: Analyst/AI commentary on variances
CREATE TABLE variance_commentary (
    id              SERIAL PRIMARY KEY,
    package_id      INTEGER REFERENCES reporting_packages(id),
    account_number  VARCHAR(50) NOT NULL,
    period_current  VARCHAR(10) NOT NULL,
    period_prior    VARCHAR(10),
    amount_current  NUMERIC(19,4),
    amount_prior    NUMERIC(19,4),
    variance        NUMERIC(19,4),
    variance_pct    DECIMAL(8,4),
    commentary      TEXT, -- AI draft or human-written
    commentary_source VARCHAR(20), -- ai_draft, human, ai_approved
    status          VARCHAR(50) DEFAULT 'draft',
        -- draft, reviewed, approved
    approved_by     UUID REFERENCES users(id),
    approved_at     TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Insights Engine

```sql
-- intelligence_briefs: Daily/weekly generated briefs
CREATE TABLE intelligence_briefs (
    id              SERIAL PRIMARY KEY,
    brief_type      VARCHAR(50) NOT NULL, -- daily, weekly, flash, ad_hoc
    period          VARCHAR(10),
    generated_at    TIMESTAMPTZ DEFAULT NOW(),
    sections        JSONB NOT NULL,
        -- {executive_summary, priorities, findings, recon_issues,
        --  risks_controls, ai_opportunities, decisions_needed,
        --  deliverables, assumptions, next_actions}
    model_used      VARCHAR(50), -- claude-sonnet-4-6, claude-haiku-4-5
    distributed_to  UUID[],
    distributed_at  TIMESTAMPTZ,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ai_patterns: Learned patterns from approval history
CREATE TABLE ai_patterns (
    id              SERIAL PRIMARY KEY,
    pattern_type    VARCHAR(100) NOT NULL,
        -- je_approval, recon_resolution, exception_handling, coding_rule
    pattern_data    JSONB NOT NULL,
    confidence      DECIMAL(5,4),
    sample_count    INTEGER DEFAULT 0,
    last_validated  TIMESTAMPTZ,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### Source File Management

```sql
-- source_imports: Track every file import
CREATE TABLE source_imports (
    id              SERIAL PRIMARY KEY,
    source_system   VARCHAR(100) NOT NULL,
        -- ascend, paylocity, vroozi, stonex, bank, generic, fap
    file_name       VARCHAR(255) NOT NULL,
    file_path       VARCHAR(500),
    file_hash       VARCHAR(64),
    file_size_bytes BIGINT,
    row_count       INTEGER,
    parsed_count    INTEGER,
    error_count     INTEGER DEFAULT 0,
    status          VARCHAR(50) DEFAULT 'uploaded',
        -- uploaded, parsing, parsed, validated, imported, failed
    parse_errors    JSONB, -- [{row, column, error, value}]
    uploaded_by     UUID REFERENCES users(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- accounts: Master chart of accounts
CREATE TABLE accounts (
    id              SERIAL PRIMARY KEY,
    standard_acct_no VARCHAR(50) UNIQUE NOT NULL,
    name            VARCHAR(255) NOT NULL,
    account_type    VARCHAR(50) NOT NULL,
    normal_balance  VARCHAR(10), -- debit, credit
    parent_account  VARCHAR(50),
    fs_line         VARCHAR(50), -- IS, BS, CF
    fs_subgroup     VARCHAR(100),
    entity_id       INTEGER,
    is_active       BOOLEAN DEFAULT true,
    created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### AP Intelligence Module

```sql
-- ap_invoices: AP invoice tracking with auto-coding
CREATE TABLE ap_invoices (
    id              SERIAL PRIMARY KEY,
    invoice_number  VARCHAR(100) NOT NULL,
    vendor_id       VARCHAR(100),
    vendor_name     VARCHAR(255),
    invoice_date    DATE,
    due_date        DATE,
    total_amount    NUMERIC(19,4),
    status          VARCHAR(50) DEFAULT 'pending',
    po_number       VARCHAR(100),
    auto_coded      BOOLEAN DEFAULT false,
    coding_confidence DECIMAL(5,4),
    submitted_at    TIMESTAMPTZ,
    approved_at     TIMESTAMPTZ,
    touch_time_minutes INTEGER, -- Calculated
    source_import_id INTEGER REFERENCES source_imports(id),
    created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- ap_invoice_lines: Line-level detail with GL coding
CREATE TABLE ap_invoice_lines (
    id              SERIAL PRIMARY KEY,
    invoice_id      INTEGER REFERENCES ap_invoices(id) ON DELETE CASCADE,
    line_number     INTEGER,
    gl_account      VARCHAR(50),
    description     TEXT,
    quantity        NUMERIC(19,4),
    unit_price      NUMERIC(19,4),
    line_amount     NUMERIC(19,4),
    coding_source   VARCHAR(20), -- manual, auto, ai_suggested
    coding_confidence DECIMAL(5,4)
);
```

---

## SQLite — Local Views (9 Dashboard Views)

```sql
-- Materialized summaries for fast dashboard rendering
CREATE VIEW v_close_progress AS ...;      -- Close tasks by day with status
CREATE VIEW v_je_pipeline AS ...;         -- JE counts by status
CREATE VIEW v_recon_status AS ...;        -- Recon completeness with aging
CREATE VIEW v_exception_aging AS ...;     -- Open exceptions by age bucket
CREATE VIEW v_cash_position AS ...;       -- Current cash + forecast
CREATE VIEW v_late_posted_queue AS ...;   -- 1,009+ flagged transactions
CREATE VIEW v_ap_metrics AS ...;          -- Auto-code rate, touch-time
CREATE VIEW v_audit_pbc_aging AS ...;     -- Open audit requests by SLA
CREATE VIEW v_flash_summary AS ...;       -- Quick financial snapshot
```

---

## TimescaleDB — Hypertables

```sql
-- Already existing (from equipment tracker)
CREATE TABLE gps_readings (...);      -- Vehicle GPS positions
CREATE TABLE engine_readings (...);   -- Vehicle diagnostics
CREATE TABLE hos_logs (...);          -- Hours of service

-- For Delta Intelligence (from Rift Market Engine work)
CREATE TABLE feed_timeseries (
    recorded_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    source       TEXT NOT NULL,
    entity_id    TEXT NOT NULL,
    metric       TEXT NOT NULL,
    value        DOUBLE PRECISION NOT NULL,
    metadata     JSONB
);
-- + regime_history, risk_snapshots, trade_audit, etc.
```

---

## Row-Level Security (RLS) Summary

| Role | journal_entries | recon_runs | close_checklists | reporting_packages | intelligence_briefs |
|------|----------------|-----------|-----------------|-------------------|-------------------|
| admin | ALL | ALL | ALL | ALL | ALL |
| controller | ALL | ALL | ALL | ALL | ALL |
| analyst | Own dept | Own dept | Assigned | View only | View only |
| executive | View only | View only | View only | View only | ALL |
| viewer | View only | View only | View only | View only | None |
