# Delta Intelligence — Token Optimization Architecture

## Overview

4-layer optimization strategy that minimizes token burn across all models and use cases.
Every prompt, every tool call, every response passes through these layers.

## Architecture

```
User Prompt
    │
    ▼
┌─────────────────────────────────┐
│  Layer 1: Schema Index          │  ~500 tokens (vs ~3,000 for full endpoints)
│  Compact reference of all data  │  Pre-built, cached in memory
│  sources, tables, and fields    │  Model uses this as "table of contents"
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Layer 2: Query Planner         │  Regex-based intent matching
│  Maps user intent → endpoints   │  Injects "suggested data plan" into prompt
│  BEFORE the model even runs     │  Model gets targeted guidance, not guesswork
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Model Execution (Anthropic)    │  Agentic loop with tool calls
│  Uses schema index + plan       │  Max 8 tool rounds
│  to pick precise endpoints      │  Auto-routes: Haiku < 4k, Sonnet > 4k
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Layer 3: Result Compressor     │  Raw data → structured digest
│  Aggregates numeric columns     │  Caps at 25 sample rows
│  Computes sum/min/max           │  Reports total count + column list
│  Returns digest, not raw dump   │  ~2k tokens vs ~50k for full result
└─────────────┬───────────────────┘
              │
              ▼
┌─────────────────────────────────┐
│  Layer 4: Conversation Compactor│  After 6+ turns, older messages
│  Summarizes older turns         │  compressed to 1-line summaries
│  Keeps last 6 turns verbatim   │  Prevents unbounded context growth
└─────────────────────────────────┘
```

## Token Budget

| Component             | Before Optimization | After Optimization | Savings |
|-----------------------|--------------------|-------------------|---------|
| System prompt         | ~3,000 tokens      | ~500 tokens       | 83%     |
| Query plan hint       | (none)             | ~100 tokens       | Guides model, reduces tool call waste |
| Gateway response (avg)| ~15,000 tokens     | ~2,000 tokens     | 87%     |
| 20-turn conversation  | ~40,000 tokens     | ~12,000 tokens    | 70%     |
| **Typical request**   | **~60,000 tokens** | **~15,000 tokens**| **75%** |

## Layer Details

### Layer 1: Schema Index (`SCHEMA_INDEX`)

Location: `src/lib/token-optimizer.ts`

Compact, human-readable index of all data sources. Lists:
- Service name and what it contains
- Table/resource names (not full descriptions)
- Query endpoints for raw access

The model treats this as a table of contents. It knows what exists and where,
without needing the full endpoint documentation for every call.

### Layer 2: Query Planner (`planQuery`)

Location: `src/lib/token-optimizer.ts`

Pre-matches user intent to specific endpoints using regex patterns.
Returns:
- `domains`: Which data domains were matched (financial, fleet, sales, etc.)
- `suggestedEndpoints`: Specific paths to call
- `hint`: Natural language guidance for the model

Intent patterns:
- AR/aging → `/ascend/ar/aging`, `/ascend/ar/summary`
- Top customers → `/ascend/customers/top`, `/ascend/revenue/by-customer`
- Balance sheet → `/ascend/gl/balance-sheet`
- P&L → `/ascend/gl/income-statement`, `/ascend/gl/pl-by-pc`
- Pipeline → `/salesforce/opportunities`
- Fleet → `/samsara/vehicles`, `/samsara/locations`
- Equipment → `/ascend/equipment`, `/ascend/tanks`
- POs → `/vroozi/purchase-orders`, `/ascend/vendors`

If no patterns match, the full schema index still guides the model.

### Layer 3: Result Compressor (`compressGatewayResult`)

Location: `src/lib/token-optimizer.ts`

For array responses:
1. Counts total rows
2. Extracts column names from first row
3. Detects numeric columns, computes sum/min/max in single pass
4. Returns top 25 rows as sample + aggregates + metadata
5. Hard cap at 30k chars

For non-array responses:
- Pass through if < 30k chars, truncate if larger

### Layer 4: Conversation Compactor (`compactConversation`)

Location: `src/lib/token-optimizer.ts`

When conversation exceeds 12 messages (6 turns):
1. Splits into older + recent (last 6 turns kept verbatim)
2. Summarizes each older turn in ~50 words
3. Replaces old messages with a single summary message + acknowledgment
4. New messages continue normally

### Model Routing

| Input Size   | Complexity | Model          | Max Output |
|-------------|-----------|----------------|------------|
| < 4k tokens | Simple    | Haiku 4.5      | 8,192      |
| < 4k tokens | Complex   | Sonnet 4.6     | 16,384     |
| > 4k tokens | Any       | Sonnet 4.6     | 16,384     |
| > 50k tokens| Any       | Gemini Flash   | 8,192      |

## Extending

To add a new intent pattern, add to `INTENT_PATTERNS` in `token-optimizer.ts`:
```typescript
{
  pattern: /\b(your|keywords|here)\b/i,
  domains: ['domain-name'],
  endpoints: ['/service/endpoint'],
  hint: 'Guidance for the model on when to use these endpoints.',
}
```

To add a new data source, update:
1. `SCHEMA_INDEX` in `token-optimizer.ts` (add service block)
2. `ENDPOINTS` array in `config/endpoints.ts` (add endpoint definitions)
3. `INTENT_PATTERNS` in `token-optimizer.ts` (add routing patterns)
4. `DOMAIN_KEYWORDS` in `config/endpoints.ts` (add keyword clusters)

## Files

| File | Purpose |
|------|---------|
| `src/lib/token-optimizer.ts` | All 4 optimization layers |
| `src/lib/router.ts` | Model selection + cost routing |
| `src/lib/config/endpoints.ts` | Endpoint catalog + relevance scoring |
| `src/app/api/chat/route.ts` | Wires everything together |
| `docs/TOKEN_OPTIMIZATION.md` | This reference document |
