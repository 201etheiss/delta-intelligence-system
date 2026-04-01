# Delta Intelligence System — Agent Configurations

**Last Updated:** 2026-03-31

WorkflowOS AI agent definitions, wiring diagrams, and configuration for each automated workflow. These agents are the "autopilot" layer that reduces controller workload by 40-60%.

---

## Agent Architecture

```
┌──────────────────────────────────────────────────┐
│               WorkflowOS Orchestrator             │
│    (Claude API → Haiku for simple, Sonnet for     │
│     analysis, Opus for complex reasoning)         │
└────────┬────────┬────────┬────────┬──────────────┘
         │        │        │        │
    ┌────┴──┐ ┌───┴──┐ ┌──┴───┐ ┌──┴────┐
    │ Close │ │ JE   │ │ Recon│ │ Brief │  ... more agents
    │ Agent │ │ Agent│ │ Agent│ │ Agent │
    └───────┘ └──────┘ └──────┘ └───────┘
```

**Model selection strategy:**
| Task Complexity | Model | Use Case |
|----------------|-------|----------|
| Simple classification, parsing | claude-haiku-4-5 | Source file validation, GL code lookup |
| Analysis, drafting, pattern recognition | claude-sonnet-4-6 | JE drafting, variance commentary, recon matching |
| Complex reasoning, multi-step planning | claude-opus-4-6 | Intelligence briefs, risk assessment, audit analysis |

---

## Agent 1: Close Management Agent

**Purpose:** Monitor close progress, flag blockers, predict completion, escalate delays.

**Trigger:** Runs continuously during close period (Day 1-10 of each month).

**Inputs:**
- Close checklist status (from `close_checklists` table)
- Close template dependencies (from `close_templates`)
- JE pipeline status (from `journal_entries`)
- Recon completion status (from `recon_runs`)

**Actions:**
1. **Morning scan (6am):** Check what's due today, what's overdue, what's blocked
2. **Dependency check:** Identify tasks that can't start because predecessors aren't done
3. **Prediction:** Based on current velocity, predict close day completion
4. **Escalation:** If predicted close > Day 5, alert Taylor via brief + Slack/email
5. **Status update:** Write to `close_timeline` table

**Configuration:**
```json
{
    "agent_id": "close-management",
    "model": "claude-sonnet-4-6",
    "schedule": "*/30 * * * *",
    "active_window": {
        "start_day": 1,
        "end_day": 10
    },
    "escalation_rules": [
        {"condition": "predicted_close_day > 5", "action": "alert_controller"},
        {"condition": "blocked_tasks > 3", "action": "alert_controller"},
        {"condition": "overdue_tasks > 0", "action": "flag_in_cockpit"}
    ],
    "data_sources": [
        "supabase:close_checklists",
        "supabase:close_templates",
        "supabase:journal_entries",
        "supabase:recon_runs"
    ],
    "outputs": [
        "supabase:close_timeline",
        "supabase:intelligence_briefs"
    ]
}
```

---

## Agent 2: Journal Entry Agent

**Purpose:** Auto-generate JE drafts from source data, validate, route for approval.

**Trigger:** Runs when new source data is imported OR on close day schedule.

**Inputs:**
- Source file imports (from `source_imports`)
- JE templates (from `je_templates`)
- Account master (from `accounts`)
- Historical JE patterns (from `ai_patterns`)

**Actions:**
1. **Source detection:** When new source file imported, match to JE template family
2. **Data extraction:** Parse source file using appropriate parser
3. **Calculation:** Apply template calc logic to source data
4. **Validation:** Run pre-post checks (debits = credits, amounts reasonable, accounts valid)
5. **Draft creation:** Create JE in `draft` status with all lines
6. **Pattern check:** Compare to historical JEs for same template/period — flag anomalies
7. **Route:** Assign to reviewer based on template owner

**Configuration:**
```json
{
    "agent_id": "je-automation",
    "model": "claude-sonnet-4-6",
    "triggers": [
        {"event": "source_import_complete", "action": "generate_je"},
        {"schedule": "0 7 1-5 * *", "action": "check_missing_jes"}
    ],
    "validation_rules": {
        "debits_equal_credits": true,
        "max_single_line": 1000000,
        "require_description": true,
        "flag_duplicate_period": true,
        "anomaly_threshold": 0.25
    },
    "families": {
        "depreciation": {"source": "fap", "schedule": "day_1", "reviewer": "lea-centanni"},
        "payroll": {"source": "paylocity", "schedule": "biweekly", "reviewer": "lea-centanni"},
        "health_insurance": {"source": "paylocity", "schedule": "monthly", "reviewer": "lea-centanni"},
        "stonex_hedging": {"source": "stonex", "schedule": "monthly", "reviewer": "taylor-veazey"},
        "tax": {"source": "manual", "schedule": "quarterly", "reviewer": "bill-didsbury"},
        "prepaid": {"source": "ascend", "schedule": "monthly", "reviewer": "lea-centanni"},
        "interest": {"source": "ascend", "schedule": "monthly", "reviewer": "taylor-veazey"},
        "fixed_assets": {"source": "fap", "schedule": "monthly", "reviewer": "lea-centanni"},
        "overhead": {"source": "ascend", "schedule": "monthly", "reviewer": "taylor-veazey"},
        "inventory": {"source": "ascend", "schedule": "monthly", "reviewer": "taylor-veazey"},
        "internal_billing": {"source": "ascend", "schedule": "monthly", "reviewer": "taylor-veazey"},
        "cash_flow": {"source": "bank", "schedule": "weekly", "reviewer": "taylor-veazey"}
    }
}
```

---

## Agent 3: Reconciliation Agent

**Purpose:** Run scheduled reconciliations, flag exceptions, suggest resolutions.

**Trigger:** Scheduled based on recon rule frequency, or on-demand.

**Inputs:**
- Recon rules (from `recon_rules`)
- Source A data (GL from Ascend)
- Source B data (bank statements, subledgers)
- Historical exception patterns (from `ai_patterns`)

**Actions:**
1. **Balance compare:** Pull both source balances, calculate difference
2. **Detail matching:** Match transactions by reference, amount, date (within tolerance)
3. **Exception identification:** Flag unmatched items with classification
4. **Resolution suggestion:** Based on historical patterns, suggest likely resolution
5. **Aging update:** Calculate days open for existing exceptions
6. **Escalation:** If aging > 30 days or amount > $5K, flag for controller

**Configuration:**
```json
{
    "agent_id": "reconciliation",
    "model": "claude-sonnet-4-6",
    "schedule": {
        "daily_recons": "0 8 * * *",
        "weekly_recons": "0 8 * * MON",
        "monthly_recons": "0 8 1 * *"
    },
    "matching_config": {
        "amount_tolerance": 1.00,
        "date_tolerance_days": 3,
        "fuzzy_reference_match": true,
        "auto_resolve_threshold": 0.95
    },
    "escalation_rules": [
        {"condition": "aging_days > 30", "action": "alert_controller"},
        {"condition": "amount > 5000", "action": "alert_controller"},
        {"condition": "exception_count > 10", "action": "flag_in_cockpit"}
    ]
}
```

---

## Agent 4: Intelligence Brief Agent

**Purpose:** Generate daily/weekly intelligence briefs for controller and executives.

**Trigger:** Daily at 6am, Weekly on Monday 6am, on-demand.

**Inputs:**
- All 6 engine statuses
- Close progress
- Exception summaries
- Cash flow position
- Audit/PBC aging
- System alerts/errors
- New patterns detected

**Actions:**
1. **Data collection:** Query all 6 engines for current status
2. **Analysis:** Identify trends, anomalies, risks
3. **Narrative generation:** Draft each of 10 brief sections using Claude Sonnet/Opus
4. **Prioritization:** Rank priorities by urgency and impact
5. **Store:** Save to `intelligence_briefs` table
6. **Distribute:** Send to configured recipients (email via Resend, Slack)

**Configuration:**
```json
{
    "agent_id": "intelligence-brief",
    "model": "claude-opus-4-6",
    "schedule": {
        "daily": "0 6 * * *",
        "weekly": "0 6 * * MON"
    },
    "sections": [
        "executive_summary",
        "priorities",
        "confirmed_findings",
        "open_recon_issues",
        "risks_and_controls",
        "ai_opportunities",
        "decisions_needed",
        "deliverables_due",
        "assumptions_caveats",
        "next_actions"
    ],
    "distribution": {
        "daily": ["taylor-veazey"],
        "weekly": ["taylor-veazey", "adam-vegas", "mike-long"]
    },
    "channels": {
        "email": {"provider": "resend", "from": "brief@delta360.energy"},
        "slack": {"webhook": "TBD"}
    }
}
```

---

## Agent 5: AP Intelligence Agent

**Purpose:** Auto-code AP invoices, detect duplicates, measure touch-time, flag anomalies.

**Trigger:** When new Vroozi imports arrive.

**Inputs:**
- New AP invoices (from `ap_invoices`)
- Historical coding patterns (from `ai_patterns`)
- Vendor master (from Neo4j vendor nodes)
- PO data for 3-way matching

**Actions:**
1. **Auto-code:** Predict GL account for each invoice line using historical patterns
2. **Confidence scoring:** Rate each prediction (>0.8 = auto-apply, 0.5-0.8 = suggest, <0.5 = manual)
3. **Duplicate detection:** Flag invoices matching vendor + amount + date within 7 days
4. **3-way match:** Match invoice → PO → receipt
5. **Touch-time tracking:** Measure elapsed time from submission to approval
6. **Learning:** Update patterns based on analyst corrections

**Configuration:**
```json
{
    "agent_id": "ap-intelligence",
    "model": "claude-haiku-4-5",
    "triggers": [
        {"event": "vroozi_import_complete", "action": "auto_code"},
        {"schedule": "0 9 * * *", "action": "duplicate_scan"}
    ],
    "auto_code_config": {
        "confidence_auto_apply": 0.80,
        "confidence_suggest": 0.50,
        "min_history_for_prediction": 5,
        "learning_rate": 0.1
    },
    "targets": {
        "auto_coded_pct": 0.50,
        "touch_time_reduction_pct": 0.30
    }
}
```

---

## Agent 6: Cash Flow / Borrowing Base Agent

**Purpose:** Track cash position, forecast flows, calculate borrowing base, flag liquidity risks.

**Trigger:** Weekly on Monday, daily during close.

**Inputs:**
- Bank balances (JPM)
- AR aging (Ascend)
- AP aging (Vroozi)
- Payroll schedule (Paylocity)
- LOC balance (account 25100)

**Actions:**
1. **Position snapshot:** Current cash across all accounts
2. **13-week forecast:** Roll forward based on known inflows/outflows
3. **Borrowing base calc:** Eligible AR × advance rate + Eligible Inventory × advance rate
4. **Availability check:** Total availability - outstanding = remaining capacity
5. **Alert:** If remaining capacity < 2 weeks of burn, alert Taylor + Mike

**Configuration:**
```json
{
    "agent_id": "cash-flow",
    "model": "claude-sonnet-4-6",
    "schedule": {
        "weekly": "0 7 * * MON",
        "during_close": "0 7 1-10 * *"
    },
    "accounts": {
        "loc": "25100",
        "ar_control": "12000",
        "ap_trade": "20000"
    },
    "thresholds": {
        "min_capacity_weeks": 2,
        "alert_recipients": ["taylor-veazey", "mike-long"]
    }
}
```

---

## Agent 7: Reporting / Package Agent

**Purpose:** Assemble financial packages, run integrity scans, draft commentary, gate publishing.

**Trigger:** During close period, Days 3-5.

**Actions:**
1. **TB pull:** Get trial balance from Ascend
2. **Tie-out:** BS balances to TB, IS flows to BS changes, CF to cash
3. **Integrity scan:** Run 8 issue type checks
4. **Commentary draft:** For each variance > $5K, draft commentary using Claude
5. **Package assembly:** Combine all components
6. **Quality gate:** Must pass all checks before publish-ready status

---

## Agent 8: Exception Monitor Agent

**Purpose:** Continuous monitoring of all exceptions across all engines with aging and escalation.

**Trigger:** Runs every hour during business hours.

**Actions:**
1. **Scan:** Check all open exceptions across JE, recon, close, AP, reporting
2. **Age:** Update aging calculations
3. **Escalate:** Based on age and amount thresholds
4. **Predict:** Flag items likely to become problems based on patterns
5. **Dashboard update:** Write to exception aging view

---

## Agent 9: Audit Readiness Agent

**Purpose:** Monitor PBC requests, auto-pull evidence, track SLAs, generate readiness score.

**Trigger:** When audit requests are submitted, daily scan during audit periods.

**Actions:**
1. **Request intake:** Parse auditor request into structured fields
2. **Evidence search:** Query evidence vault for matching documents
3. **Auto-assembly:** Build PBC response package with all found evidence
4. **Gap identification:** Flag requests where evidence is missing or incomplete
5. **SLA tracking:** Days remaining on each request, aging dashboard

---

## Agent Wiring: Inter-Agent Communication

```
Close Agent ──triggers──→ JE Agent (generate JEs for close day)
                     └──→ Recon Agent (run scheduled recons)
                     └──→ Package Agent (start assembly on Day 3)

JE Agent ──notifies──→ Close Agent (JE posted → mark close task done)

Recon Agent ──notifies──→ Close Agent (recon complete → mark task done)
            ──escalates──→ Exception Monitor (new exceptions found)

Brief Agent ──reads──→ ALL other agents (aggregates status)

AP Agent ──feeds──→ JE Agent (auto-coded invoices → AP accrual JE)

Cash Flow Agent ──feeds──→ Brief Agent (liquidity alerts)
                ──triggers──→ JE Agent (borrowing base JE)

Package Agent ──reads──→ JE Agent (all JEs posted?)
              ──reads──→ Recon Agent (all recons clear?)
              ──reads──→ Close Agent (all tasks done?)
```

---

## Supabase Configuration for Agents

```json
{
    "supabase_url": "https://ohbqjralhrjqoftkkety.supabase.co",
    "supabase_anon_key": "eyJhbGci...",
    "supabase_service_role": "REDACTED_SUPABASE_SERVICE_ROLE"
}
```

## Claude API Configuration

```json
{
    "anthropic_api_key": "sk-ant-...",
    "models": {
        "fast": "claude-haiku-4-5",
        "standard": "claude-sonnet-4-6",
        "advanced": "claude-opus-4-6"
    },
    "max_tokens": {
        "fast": 1024,
        "standard": 4096,
        "advanced": 8192
    }
}
```
