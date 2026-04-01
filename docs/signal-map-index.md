# Signal Map — OTED Assessment Platform Index

**Location**: `~/oted-system`
**Stack**: Next.js 14 App Router, TypeScript strict, Tailwind CSS, Supabase, Claude API, Resend, @react-pdf/renderer

---

## OTED Overview

OTED (Operator and Team Execution Dynamics) is a structured assessment instrument that maps how individuals decide, build, coordinate, and fail under pressure. It does not measure personality — it measures operator pattern signatures across four behavioral dimensions with evidence-grade confidence scoring.

### The Four OTED Dimensions

| Dimension | What It Measures |
|-----------|-----------------|
| Decide | How the subject processes information, frames options, weighs evidence, and reaches conclusions under uncertainty |
| Build | How work gets executed: scope management, installation path, rollback discipline, acceptance tests |
| Coordinate | How handoffs are managed, contracts defined, interfaces maintained, and escalation handled |
| Fail / Recover | How pressure transforms behavior, what failure modes emerge, and whether learning loops compound or decay |

### 14 Archetypes

Each subject's responses are decomposed into a weighted portfolio across 14 operator archetypes. Weights normalize to sum 1.0. Hybrid classifications trigger when top 2 archetypes each exceed 0.15 and jointly exceed 0.50.

| ID | Name | Short Name | Optimizes For |
|----|------|-----------|---------------|
| AT-01 | Systems Cartographer | Cartographer | Clarity, boundary definition, structural coherence |
| AT-02 | Evidence Gatekeeper | Gatekeeper | Defensibility, auditability, truth under uncertainty |
| AT-03 | Mechanism Engineer | Engineer | Installability, repeatable execution, measurable outcomes |
| AT-04 | Scenario Compiler | Compiler | Scenario resilience, decision-grade tradeoffs |
| AT-05 | Compounding Librarian | Librarian | Repeatability, scaling quality, institutional memory |
| AT-06 | Executive Synthesis Writer | Synthesizer | Executive legibility, prioritization, actionability |
| AT-07 | Execution Driver | Driver | Speed, delivery reliability, close-the-loop discipline |
| AT-08 | Constraint-First Strategist | Strategist | Safety, compliance, downside control |
| AT-09 | Opportunity Scout | Scout | Growth, value capture, strategic optionality |
| AT-10 | Commercial Synthesizer | Translator | Buy-in, external communication, adoption velocity |
| AT-11 | Interface Broker | Broker | Coordination efficiency, low rework, cross-team velocity |
| AT-12 | People Stabilizer | Stabilizer | Retention, collaboration, team psychological safety |
| AT-13 | Learning Loop Optimizer | Optimizer | Continuous improvement, compounding returns |
| AT-14 | Decision Rights Architect | Architect | Decision velocity with integrity |

### 12 Lenses

Lenses are analytical frames applied on top of archetype scoring. They evaluate organizational dimensions — each lens overweights certain signals and underweights others, and has a defined failure mode if it dominates unchecked.

| ID | Lens Name | Core Question |
|----|-----------|---------------|
| L-01 | Structural Integrity | Can you draw the system and would two people draw the same picture? |
| L-02 | Evidence Quality | Can you trace any claim back to its source and confidence level? |
| L-03 | Mechanism Installability | Could a new hire execute this install from the runbook alone? |
| L-04 | Scenario Resilience | What would need to change for this recommendation to be wrong? |
| L-05 | Institutional Memory | Does the tenth time take less effort than the first? |
| L-06 | Executive Legibility | Can a decision-maker act on this in under 5 minutes? |
| L-07 | Execution Velocity | Is the gap between deciding and delivering shrinking? |
| L-08 | Risk Surface Coverage | For every plan, can you enumerate the top 5 ways it fails? |
| L-09 | Opportunity Capture | What is the highest-ROI move available right now? |
| L-10 | Stakeholder Alignment | Do all stakeholders agree on the same thing, or just the same words? |
| L-11 | Interface Health | When work crosses a boundary, how often does it arrive in the right shape? |
| L-12 | Learning Compounding | Does the organization get measurably better at recurring tasks? |

### 10 Seats

Seats are organizational roles. OTED scores are overlaid against the seat the subject currently occupies (or targets) to identify archetype-seat fit/misfit, distortions, and seat-specific guardrails.

| ID | Seat |
|----|------|
| ST-01 | Chief Executive / General Manager |
| ST-02 | Chief Operating Officer / VP Operations |
| ST-03 | Chief Financial Officer / VP Finance |
| ST-04 | Chief Technology Officer / VP Engineering |
| ST-05 | Chief Revenue Officer / VP Sales |
| ST-06 | Chief People Officer / VP People |
| ST-07 | Chief Strategy Officer / VP Strategy |
| ST-08 | Chief Product Officer / VP Product |
| ST-09 | Chief Marketing Officer / VP Marketing |
| ST-10 | Board Member / Advisor |

---

## Scoring Engine

**Critical**: The scoring engine is fully deterministic — zero LLM calls during scoring. Pure TypeScript math.

### Pipeline (8 steps)

`src/lib/scoring/pipeline.ts` orchestrates:

1. `mapAllResponses` → converts raw questionnaire responses into `SignalTag[]`
2. `scoreArchetypes` → accumulates weighted signal scores per archetype, floors to 0, normalizes to sum 1.0
3. `scoreLenses` → aggregates signal tags into lens profile weights
4. `scoreSeats` → maps signals to seat overlay fit/misfit scores
5. `scorePressure` → derives pressure-state behavioral transforms
6. `computeConfidence` → OTED confidence formula (see below)
7. `matchFailurePatterns` → matches archetype portfolio against known failure pattern signatures
8. `recommendInstalls` → maps failure matches to install bundle recommendations

### Confidence Formula

```
overall = clip(
  0.10
  + 0.45 * evidence_strength      (signal_count / max_possible_signals)
  + 0.20 * consistency            (1 - contradiction_rate)
  + 0.15 * recency                (1.0 for fresh assessments)
  + 0.10 * scenario_relevance     (0.8 standard)
, 0, 1)
```

Contradiction: same tagId appearing with both `raise` and `lower` directions.

### ScoringResult Interface

```typescript
interface ScoringResult {
  signals: SignalTag[];
  archetypePortfolio: ArchetypePortfolio;   // weights normalized to 1.0 + hybridClassification
  lensProfile: LensProfile;
  seatOverlays: SeatOverlay[];
  pressureProfile: PressureProfile;
  confidence: ConfidenceScores;             // overall, evidenceStrength, consistency, recency, scenarioRelevance
  failureMatches: FailureMatch[];
  installBundles: InstallRecommendation[];
}
```

### Scoring Key Files

`src/data/scoring-key.ts` contains four exported keys:

- `SCORING_KEY` — main SJT/FC/Likert/AI scenario key (item ID → option ID → `SignalTag[]`)
- `PA_SCORING_KEY` — priority allocation scoring (index → archetype tag)
- `PT_SCORING_KEY` — pressure/Likert item scoring (item ID → pressure state + behavior levels)
- `PS02_SCORING_KEY` — constraint rank scoring (rank index → `SignalTag[]`)

---

## Assessment Flow

### Questionnaire — 75 items across 7 blocks

| Block | Type | Count | Purpose |
|-------|------|-------|---------|
| `core-sjt` | Situational Judgment Test | 35 | Main OTED signal capture (20 standard + 15 pressure variants) |
| `core-fc` | Forced Choice | ? | Binary value tradeoffs |
| `core-pa` | Priority Allocation | ? | Points distributed across competing priorities |
| `core-pt` | Likert (pressure trait) | ? | Self-assessed pressure behavior |
| `ai-alignment` | AI Scenario + Prompt/Delegation | ? | AI tool usage and delegation pattern |
| `writing-alignment` | Writing Exercise + Message Choice | ? | Communication style and message framing |
| `problem-solving` | Problem Solving + Constraint Rank | ? | Analytical reasoning + constraint prioritization |

**Question types**: `sjt`, `forced-choice`, `priority-allocation`, `likert`, `ai-scenario`, `prompt-exercise`, `ai-delegation`, `writing-exercise`, `message-choice`, `problem-solving`, `constraint-rank`

### Flow Sequence

```
Access Code Entry → /assess/[sessionId]
    ↓
POST /api/session/start  (validates code, creates person + session in Supabase)
    ↓
75-item questionnaire (responses saved incrementally via POST /api/session/save)
    ↓
POST /api/score  (deterministic scoring pipeline, ~instant, creates profile row)
    ↓
/results/[sessionId]  (teaser view — top archetypes + confidence)
    ↓
POST /api/score/enrich  (async: Claude narrative generation + PDF + Resend email)
    ↓
PDF report available via /api/report/download
```

### Narrative Synthesis (Claude API)

`src/lib/synthesis/narrative-generator.ts` calls `claude-opus-4-20250514` with `maxTokens: 16000` to generate:

- `operatingSignature` — 30-50 word operator descriptor
- `executiveSummary` — 500 words
- `deepDive` — 6 sections × ~300 words (cognitive engine, operator model, decision architecture, pressure transforms, failure modes, install recommendations)
- `psychometricXref` — MBTI, DISC, Enneagram, Kolbe, StrengthsFinder, Big Five (all inferred from archetype weights)
- `roleFit` — best/avoid roles, ideal team description
- `counterbalances` — which archetypes should surround this person

Full report generation uses a separate prompt template at `src/prompts/full-report-generation.md` via `claude-opus-4-20250514`.

**API key**: `SIGNAL_MAP_API_KEY` (primary) or `ANTHROPIC_API_KEY` (fallback).

---

## Data Model

### Supabase Tables

| Table | Purpose | Key Columns |
|-------|---------|-------------|
| `persons` | Subject identity | `id`, `name`, `email`, `org_context` |
| `access_codes` | Gate assessment entry | `id`, `code`, `person_id`, `status` (active/used/expired/revoked), `expires_at` |
| `assessment_sessions` | Active and completed sessions | `id`, `person_id`, `access_code_id`, `status` (pending/in_progress/complete), `responses` (JSONB), `current_item`, `consistency_score`, `started_at`, `completed_at` |
| `evidence_items` | Analyst-tagged evidence (non-questionnaire) | `id`, `person_id`, `session_id`, `evidence_class` (E0–E3), `source_type`, `excerpt`, `signal_tags` |
| `profiles` | Scored output per session | `id`, `person_id`, `session_id`, `archetype_portfolio`, `lens_profile`, `seat_overlays`, `pressure_transforms`, `failure_modes`, `install_bundles`, `confidence`, `hybrid_classification`, `narrative_cache` |
| `reports` | Generated PDF records | `id`, `profile_id`, `tier` (snapshot/profile/full), `pdf_url`, `email_sent_to`, `email_sent_at` |

### Evidence Classes

- `E0` — Direct observation
- `E1` — Inferred from behavior
- `E2` — Self-reported
- `E3` — Speculative / third-party

---

## API Routes

| Method | Route | Auth | Purpose |
|--------|-------|------|---------|
| POST | `/api/session/start` | Public (rate-limited 20/hr/IP) | Validate access code, create person + session |
| POST | `/api/session/save` | Public | Save incremental questionnaire responses |
| POST | `/api/score` | Public (rate-limited 3/hr/session) | Run deterministic scoring pipeline, create profile |
| POST | `/api/score/enrich` | Public | Run narrative generation (Claude), PDF, email (async, 300s timeout) |
| POST | `/api/report/generate` | Admin JWT | Render PDF for existing profile, upload to Storage, save report record |
| GET | `/api/report/download` | — | Download generated PDF |
| POST | `/api/report/email` | — | Send report via Resend |
| GET | `/api/admin/auth` | — | Check admin session (JWT cookie) |
| POST | `/api/admin/auth` | — | Admin login (sets httpOnly JWT cookie) |
| GET/POST | `/api/admin/codes` | Admin JWT | List / create / manage access codes |
| POST | `/api/admin/invite` | Admin JWT | Send invite with access code via Resend |
| GET | `/api/admin/sessions` | Admin JWT | List all sessions with status + metadata |

---

## Admin Dashboard

**URL**: `localhost:3000/admin` (password: `signalmap-admin-2026`)

**Tabs**:

1. **Access Codes** (`CodeManager`) — view all codes, create new codes, revoke/expire
2. **Sessions** (`SessionList`) — view all assessment sessions with person info, status, completion date
3. **Reference** (`ReferenceIndex`) — browse the full OTED reference data: archetypes, lenses, seats, failure patterns, install bundles
4. **Teams** — placeholder, not yet implemented

Admin auth uses httpOnly JWT cookie (`sm-admin-token`). Admin API routes verify via `verifyAdminToken()`.

---

## Integration Points

| Service | Usage | Config |
|---------|-------|--------|
| **Supabase** | Primary database (Postgres) + Storage (PDF reports) | `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_KEY` |
| **Claude API** | Narrative synthesis only — NOT used for scoring | `SIGNAL_MAP_API_KEY` or `ANTHROPIC_API_KEY`; model: `claude-opus-4-20250514` |
| **Resend** | Email delivery — report notification to admin + invite emails | `RESEND_API_KEY`, `ADMIN_EMAIL` |
| **@react-pdf/renderer** | PDF report generation | Used in `/api/score/enrich` and `/api/report/generate` |

---

## Key Files

| File | Purpose |
|------|---------|
| `src/data/archetypes.ts` | 14 archetype definitions with signals, blindspots, distortions |
| `src/data/lenses.ts` | 12 lens definitions with overweights, underweights, failure modes |
| `src/data/seats.ts` | 10 seat definitions with distortions and guardrails |
| `src/data/questionnaire.ts` | 75 questionnaire items across 7 blocks |
| `src/data/scoring-key.ts` | Complete scoring key mapping responses → signal tags |
| `src/data/failure-patterns.ts` | Known failure pattern signatures (TP-01 through TP-N) |
| `src/data/install-bundles.ts` | Install bundle definitions (IB-01 through IB-N) |
| `src/data/pressure-states.ts` | Pressure state definitions |
| `src/data/types.ts` | All shared TypeScript interfaces |
| `src/lib/scoring/pipeline.ts` | 8-step deterministic scoring orchestrator |
| `src/lib/scoring/archetype-scorer.ts` | Weight normalization + hybrid classification |
| `src/lib/scoring/confidence.ts` | OTED confidence formula |
| `src/lib/scoring/lens-scorer.ts` | Lens profile aggregation |
| `src/lib/scoring/seat-scorer.ts` | Seat overlay computation |
| `src/lib/scoring/pressure-scorer.ts` | Pressure transform scoring |
| `src/lib/scoring/signal-mapper.ts` | Response → SignalTag mapping |
| `src/lib/scoring/failure-matcher.ts` | Failure pattern matching |
| `src/lib/scoring/install-mapper.ts` | Install recommendation mapping |
| `src/lib/synthesis/narrative-generator.ts` | Claude API narrative generation (single prompt → full JSON bundle) |
| `src/lib/synthesis/claude-client.ts` | Anthropic SDK wrapper |
| `src/lib/supabase/types.ts` | Full Supabase Database type definitions |
| `src/app/api/score/route.ts` | Deterministic scoring endpoint (10s Vercel limit) |
| `src/app/api/score/enrich/route.ts` | Full enrichment: narrative + PDF + email (300s Vercel limit) |
| `src/app/api/report/generate/route.ts` | Admin-gated PDF generation for existing profiles |
| `src/app/admin/page.tsx` | Admin dashboard (4 tabs: codes, sessions, reference, teams) |
| `src/app/assess/[sessionId]/` | Assessment questionnaire UX |
| `src/app/results/[sessionId]/` | Results teaser view |
| `src/prompts/` | Claude prompt templates (full-report-generation.md, etc.) |
| `src/components/report/pdf-document.tsx` | @react-pdf/renderer PDF report template |
| `src/components/admin/` | CodeManager, SessionList, ReferenceIndex components |

---

## Design System

- Colors: `sm-bg` #1A1A2E, `sm-surface` #16213E, `sm-accent` #00D4AA, `sm-amber` #F5A623
- Fonts: Inter (headings/body), JetBrains Mono (data/scores)
- Dark-mode-first, geometric patterns

---

## Operational Notes

- Scoring is deterministic — re-running `runScoringPipeline` on the same responses always produces the same result
- Enrich endpoint is idempotent — skips narrative generation if `narrative_cache.operatingSignature` is already populated
- Rate limiting is in-memory (not Redis) — resets on server restart
- Access codes are single-use; one code maps to one person and one session
- PDF reports are stored in Supabase Storage bucket `reports/` at path `reports/{profileId}.pdf`
