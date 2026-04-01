# Delta Intelligence System — Training Data & RAG Index

**Last Updated:** 2026-03-31

Complete index of all data available for AI agent training, RAG pipeline seeding, and context embedding.

---

## RAG Embedding Priority Queue

### Priority 1 — Embed Immediately (Seed Data)

| Source | Records | Location | Embed Strategy |
|--------|---------|----------|---------------|
| Master context records | 134 | delta_master_context.sqlite | Full record per embedding |
| JE templates | 43 | je_templates table | Full template + calc logic |
| Recon rules | 37 | recon_rules table | Full rule definition |
| Close templates | 47 | close_templates table | Full template + dependencies |
| Control definitions | 12 | controls | Full metric spec |
| Account master | 71 key accounts | accounts table | Account + relationships |
| People profiles | 17 | Neo4j Person nodes | Name + role + responsibilities |
| JE family definitions | 12 | je_families | Family + source + calc method |
| Workstream definitions | 10 | workstreams | Name + owner + modules |
| Module definitions | 20 | modules | Name + status + dependencies |
| System definitions | 10 | systems | Name + type + integration method |

**Total Priority 1:** ~413 embeddings

### Priority 2 — Embed After Ascend Migration

| Source | Records | Location | Embed Strategy |
|--------|---------|----------|---------------|
| GL transactions (last 12 months) | ~200K | journal_entries | JE description + accounts + amounts |
| Posted JEs (last 12 months) | ~5K | journal_entries (posted) | Full JE with lines |
| Recon exception resolutions | ~500 | recon_exceptions | Exception + resolution note |
| Close task completion notes | ~500 | close_checklists | Task + completion evidence |
| Variance commentary (historical) | ~200 | variance_commentary | Commentary text + account + period |

**Total Priority 2:** ~206K embeddings (batch overnight)

### Priority 3 — Embed From External Sources

| Source | Records | Location | Embed Strategy |
|--------|---------|----------|---------------|
| SignalMap operator profiles | 3 (growing to 17) | Desktop/SignalMap-Reports/ | Full profile per person |
| Rift Investment KB | ~100 docs | Desktop/rift-investment-module-kb/ | 500-token chunks |
| Rift Advisory SID methodology | ~20 docs | rift-investment-module-kb/00_Core_Framework/ | Full doc per embedding |
| Dev Assessment templates | 40 (10 × 4 variants) | Assessment framework | Full scenario per embedding |
| Intelligence briefs (generated) | Growing | intelligence_briefs table | Section-level embedding |
| Uploaded financial documents | Variable | Supabase Storage | 500-token chunks |

**Total Priority 3:** ~200+ embeddings

---

## Agent Training Data

### JE Agent — Pattern Learning

**What it needs to learn:**
1. Which source data fields map to which JE template lines
2. Historical approval/rejection patterns (what gets rejected and why)
3. Anomaly baselines per JE family (normal ranges for amounts, line counts)
4. Seasonal patterns (which JEs are expected each month/quarter)

**Training data sources:**
| Data | Purpose | Volume |
|------|---------|--------|
| Historical JEs by family | Baseline patterns | ~5K entries/year |
| Rejected JEs with reasons | Error pattern recognition | ~100-200 |
| Source file → JE mappings | Auto-generation accuracy | All 12 families |
| Template calc logic | Correct calculation verification | 43 templates |

### AP Intelligence Agent — Auto-Coding

**What it needs to learn:**
1. Vendor → GL account mapping patterns
2. Invoice description → GL account classification
3. Historical coding corrections (what was miscoded and how it was fixed)
4. Multi-line invoice splitting rules

**Training data sources:**
| Data | Purpose | Volume |
|------|---------|--------|
| Historical AP invoices with GL codes | Coding model training | ~50K invoices |
| Vendor master with primary GL accounts | Vendor→account mapping | ~5K vendors |
| Coding corrections | Error correction patterns | ~1K corrections |
| AP approval touch-times | Baseline for improvement | 12 months of data |

### Brief Agent — Narrative Generation

**What it needs to learn:**
1. Taylor's preferred brief format and tone
2. What constitutes "material" vs "immaterial" findings
3. Escalation thresholds (when to flag vs when to note)
4. Commentary style for variance explanations

**Training data sources:**
| Data | Purpose | Volume |
|------|---------|--------|
| Historical briefs (once generated) | Style/tone calibration | Growing |
| Approved variance commentary | Narrative patterns | ~200 entries |
| Taylor's edits to AI drafts | Preference learning | Growing |
| $5K materiality threshold | Filtering rules | Fixed |

### Recon Agent — Exception Resolution

**What it needs to learn:**
1. Common exception types and their typical resolutions
2. Timing patterns (which exceptions clear naturally vs need action)
3. Escalation patterns (which exceptions predict larger issues)

**Training data sources:**
| Data | Purpose | Volume |
|------|---------|--------|
| Historical recon exceptions | Resolution pattern learning | ~500/year |
| Exception → resolution pairs | Suggestion accuracy | All resolved |
| Timing exception aging curves | Auto-aging prediction | 12 months |

---

## Context Records Breakdown (134 Master Records)

From delta_master_context.sqlite and delta_master_context_export.json:

| Category | Count | Key Records |
|----------|-------|-------------|
| People | 17 | Adam Vegas, Taylor Veazey, Lea Centanni, David Carmichael, Bill Didsbury, Brad Vencil, Robert Stewart, Sam Taylor, Brian Kooy, Tony Rubio, Kolby Kennedy, Rodney Sims, Tim Gallaway, Natalie McDaniel, Sam Ferguson, Russ Mason, Mike Long |
| Systems | 10 | Ascend, Vroozi, Paylocity, BizInsight, Solver, NetSuite, Avalara, Salesforce, Gravitate, Delta Intelligence |
| Workstreams | 10 | Finance/Accounting, Audit/Lender, Systems Transformation, AI Strategy, Ops Workflows, Margin Analytics, CFO/Controller Support, AP Automation, Close Management, Treasury/Borrowing Base |
| Modules | 20 | AP Intelligence, Close Readiness, Payroll & Benefits, AR/Credit, Inventory & Margin, Audit, Executive Briefing, Reporting Control Center, Commentary Manager, AR/AP Watchlists, Entity/Profit-Center Review, Workbook Integrity, Late-Posted GJ Queue, Flash Summary, BS Variance Monitor, Close Checklist, Recurring JE Automation, Reconciliations, Financial Package Production, Responsibilities Tracker |
| JE Families | 12 | Depreciation, Payroll accrual/reversal, Internal billings, StoneX hedging, Health insurance/HSA, Tax, Prepaid amortization, Interest allocation, Fixed assets/FAP, Overhead allocation, Inventory reserves, Weekly cash-flow/borrowing base |
| Controls | 12 | Day-5 close, $5K materiality, $1 recon tolerance, AP auto-code >50%, AP touch-time -30%, Approval cycle -25%, Zero control failures, Human-in-loop, AI drafts/humans approve, Immutable vault, Exception queue, No direct ERP posting |
| Accounts | 9 key | 10345, 68115, 80200, 22630, 17200, 12000, 20000, 25100, 17800 |
| Frameworks | 4 | Delta Sync v2/v3, Delta Control Prompt v1.0, Delta Daily Intelligence Brief v1.0, Delta Intelligence Agent |
| Company Info | ~10 | Delta Fuel Company LLC, Delta360 brand, 521 Main St Natchez MS, divisions, org structure |

---

## Interaction & Preference Data

From Evan_Theiss_Global_Operating_Context.md:

| Preference | Value | Applied To |
|-----------|-------|-----------|
| Communication style | Direct, structural, no flattery, no filler | All agent outputs |
| Default verbosity | Short unless asked for depth | Brief Agent, Commentary Agent |
| List format | Numbered/lettered, NOT hyphen bullets | All deliverables |
| Decision approach | Structured choice sets, not open-ended | All agents asking questions |
| Assumption handling | Proceed with reasonable assumptions, state explicitly | All agents |
| Confidence labels | Explicit (high), Inferred (medium), Unspecified (unknown) | All analytical outputs |
| Deliverable standard | Cause→action→outcome traceability | Package Agent, Brief Agent |
| Risk framing | First-class, not afterthought | All risk-related outputs |
| Problem classification | Info gap, execution capacity gap, alignment gap, incentives gap, tooling gap, risk gap | SID Agent, Brief Agent |

---

## Data Freshness Requirements

| Data Type | Freshness | Refresh Trigger |
|-----------|-----------|----------------|
| GL transactions | 15 minutes | Ascend sync cycle |
| Bank balances | Daily | BAI2 import |
| AP invoices | Hourly | Vroozi sync |
| Fleet positions | 5 minutes | Samsara API |
| Salesforce accounts | Daily | Scheduled SOQL |
| Embeddings (new content) | On creation | Webhook/trigger |
| Embeddings (bulk historical) | Weekly batch | Scheduled job |
| Intelligence briefs | Daily 6am | Scheduled agent |
| Close checklist | Every 30 min during close | Close Agent |
| Cash position | Weekly + daily during close | Cash Agent |
