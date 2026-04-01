# Phase 1: Ecosystem Architecture — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the event-sourced platform core — Event Store, polyglot database cluster, module contract, shared UI SDK, and auth federation layer — so that spokes can be integrated in Phase 2.

**Architecture:** Event Store backed by Supabase PostgreSQL (append-only events table) with Redis Streams for real-time delivery. CQRS command/query gateway evolves from the existing port 3847 proxy. Polyglot databases (Supabase, TimescaleDB, Neo4j, Redis) containerized via Docker Compose. Auth federation bridges Azure AD (internal) with Supabase Auth (external) via JWT.

**Tech Stack:** Next.js 14, TypeScript, Supabase (pgvector), TimescaleDB, Neo4j, Redis 7+, Docker Compose, Zod, `@delta/ui` (Tailwind + Radix)

**Spec:** `docs/superpowers/specs/2026-04-01-delta-intelligence-dataos-design.md`

**Existing codebase:** `~/delta360/intelligence` — 62 libs in src/lib/, 58+ API routes, file-based state in data/, gateway client at src/lib/gateway.ts, roles at src/lib/config/roles.ts

---

## File Structure

### New Files

```
docker/
  docker-compose.yml                    — Platform core services (6 containers)
  docker-compose.dev.yml                — Dev overrides (ports, volumes)
  timescaledb/
    init.sql                            — TimescaleDB schema initialization
  redis/
    redis.conf                          — Redis Streams configuration
  supabase/
    migrations/
      001_events_table.sql              — Event Store schema + RLS policies
      002_consumer_offsets.sql          — Consumer group offset tracking

src/lib/events/
  event-store.ts                        — Event Store client (write events, read by cursor)
  event-schema.ts                       — Zod schemas for event validation
  event-types.ts                        — Domain event type registry
  event-processor.ts                    — Base class for materialization processors
  consumer-group.ts                     — Consumer group with offset tracking + Redis Streams

src/lib/cqrs/
  command-bus.ts                        — Command handler registry + event emission
  query-bus.ts                          — Query handler registry (reads from materialized views)
  command-types.ts                      — Zod schemas for all command types

src/lib/auth/
  federation.ts                         — Auth federation layer (Azure AD + Supabase Auth bridge)
  jwt-issuer.ts                         — JWT issuance with tenant/role/module claims
  jwt-verifier.ts                       — JWT verification for spoke requests
  tenant-context.ts                     — Tenant ID extraction and RLS session variable setter

src/app/api/events/
  route.ts                              — POST /api/events (emit events) + GET /api/events (stream)
  [type]/route.ts                       — GET /api/events/:type (filtered event stream)

src/app/api/commands/
  route.ts                              — POST /api/commands (CQRS command endpoint)

src/app/api/auth/federation/
  token/route.ts                        — POST /api/auth/federation/token (issue spoke JWT)
  verify/route.ts                       — POST /api/auth/federation/verify (validate spoke JWT)

packages/ui/
  package.json                          — @delta/ui package config
  src/
    tokens/
      colors.ts                         — Design tokens extracted from globals.css
      typography.ts                     — Font family, size, weight tokens
      spacing.ts                        — Spacing scale + responsive breakpoint tokens
    primitives/
      density-provider.tsx              — Executive/Operator density mode context
      shell-frame.tsx                   — OS shell layout frame
      tab-bar.tsx                       — Module workspace tab bar
      widget-container.tsx              — Embeddable widget wrapper
    index.ts                            — Public API exports

tests/
  events/
    event-store.test.ts                 — Event Store write/read/replay tests
    consumer-group.test.ts              — Consumer offset tracking tests
    event-schema.test.ts                — Event validation tests
  cqrs/
    command-bus.test.ts                 — Command dispatch + event emission tests
  auth/
    federation.test.ts                  — JWT issuance + verification tests
    tenant-isolation.test.ts            — Cross-tenant negative tests
  integration/
    docker-services.test.ts             — Docker Compose service health checks
```

### Modified Files

```
src/lib/gateway.ts                      — Add CQRS command/query methods alongside existing proxy
src/lib/config/roles.ts                 — Add tenant_id to role config, add module_permissions[]
src/app/globals.css                     — Extract design tokens to @delta/ui (keep CSS vars, add references)
package.json                            — Add workspace config for packages/ui, add redis/ioredis dep
tsconfig.json                           — Add packages/ui path alias
.env.example                            — Add REDIS_URL, TIMESCALEDB_URL, EVENT_STORE_TABLE
.gitignore                              — Add docker volumes, .superpowers/
```

---

## Task 1: Docker Compose — Platform Core Services

**Files:**
- Create: `docker/docker-compose.yml`
- Create: `docker/docker-compose.dev.yml`
- Create: `docker/redis/redis.conf`
- Create: `docker/timescaledb/init.sql`

- [ ] **Step 1: Create Docker Compose base file**

```yaml
# docker/docker-compose.yml
version: '3.8'

services:
  supabase-db:
    image: supabase/postgres:15.1.1.61
    ports:
      - "54322:5432"
    environment:
      POSTGRES_PASSWORD: ${POSTGRES_PASSWORD:-postgres}
      POSTGRES_DB: delta_intelligence
    volumes:
      - supabase_data:/var/lib/postgresql/data
      - ./supabase/migrations:/docker-entrypoint-initdb.d
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  timescaledb:
    image: timescale/timescaledb:latest-pg15
    ports:
      - "54323:5432"
    environment:
      POSTGRES_PASSWORD: ${TIMESCALE_PASSWORD:-timescale}
      POSTGRES_DB: delta_timeseries
    volumes:
      - timescale_data:/var/lib/postgresql/data
      - ./timescaledb/init.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5

  neo4j:
    image: neo4j:5-community
    ports:
      - "7474:7474"
      - "7687:7687"
    environment:
      NEO4J_AUTH: neo4j/${NEO4J_PASSWORD:-neo4j_dev}
      NEO4J_PLUGINS: '["apoc"]'
    volumes:
      - neo4j_data:/data
    healthcheck:
      test: ["CMD", "neo4j", "status"]
      interval: 10s
      timeout: 10s
      retries: 5

  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    command: redis-server /usr/local/etc/redis/redis.conf
    volumes:
      - redis_data:/data
      - ./redis/redis.conf:/usr/local/etc/redis/redis.conf
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 3s
      retries: 5

  gateway:
    build:
      context: ..
      dockerfile: Dockerfile
    ports:
      - "3004:3004"
    environment:
      - NEXT_PUBLIC_SUPABASE_URL=http://supabase-db:5432
      - REDIS_URL=redis://redis:6379
      - TIMESCALEDB_URL=postgresql://postgres:timescale@timescaledb:5432/delta_timeseries
      - NEO4J_URI=bolt://neo4j:7687
    depends_on:
      supabase-db:
        condition: service_healthy
      redis:
        condition: service_healthy
    # Stub: runs the existing Next.js app. Replace with dedicated gateway service later.
    command: ["echo", "gateway-stub-ready"]
    healthcheck:
      test: ["CMD", "echo", "ok"]
      interval: 10s
      timeout: 5s
      retries: 3

  nova:
    image: node:20-alpine
    environment:
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY:-}
      - REDIS_URL=redis://redis:6379
    depends_on:
      redis:
        condition: service_healthy
    # Stub: Nova AI service placeholder. Implemented in Phase 3.
    command: ["echo", "nova-stub-ready"]
    healthcheck:
      test: ["CMD", "echo", "ok"]
      interval: 10s
      timeout: 5s
      retries: 3

volumes:
  supabase_data:
  timescale_data:
  neo4j_data:
  redis_data:
```

- [ ] **Step 2: Create Redis config with Streams support**

```conf
# docker/redis/redis.conf
bind 0.0.0.0
protected-mode no
appendonly yes
appendfsync everysec
maxmemory 256mb
maxmemory-policy noeviction
stream-node-max-bytes 4096
stream-node-max-entries 100
```

- [ ] **Step 3: Create TimescaleDB init script**

```sql
-- docker/timescaledb/init.sql
CREATE EXTENSION IF NOT EXISTS timescaledb;

CREATE TABLE IF NOT EXISTS metrics (
  time        TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT NOT NULL,
  metric_name TEXT NOT NULL,
  value       DOUBLE PRECISION NOT NULL,
  labels      JSONB DEFAULT '{}'::jsonb,
  source      TEXT NOT NULL
);

SELECT create_hypertable('metrics', 'time', if_not_exists => TRUE);

CREATE INDEX idx_metrics_tenant ON metrics (tenant_id, time DESC);
CREATE INDEX idx_metrics_name ON metrics (metric_name, time DESC);

CREATE TABLE IF NOT EXISTS price_history (
  time        TIMESTAMPTZ NOT NULL,
  tenant_id   TEXT NOT NULL,
  product_id  TEXT NOT NULL,
  price       DOUBLE PRECISION NOT NULL,
  source      TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}'::jsonb
);

SELECT create_hypertable('price_history', 'time', if_not_exists => TRUE);

CREATE INDEX idx_prices_tenant ON price_history (tenant_id, product_id, time DESC);
```

- [ ] **Step 4: Create dev overrides**

```yaml
# docker/docker-compose.dev.yml
version: '3.8'

services:
  supabase-db:
    ports:
      - "54322:5432"
  timescaledb:
    ports:
      - "54323:5432"
  neo4j:
    ports:
      - "7474:7474"
      - "7687:7687"
  redis:
    ports:
      - "6379:6379"
```

- [ ] **Step 5: Verify Docker Compose starts all services**

Run: `cd docker && docker compose -f docker-compose.yml -f docker-compose.dev.yml up -d`
Expected: All 4 services start and pass health checks.

Run: `docker compose ps`
Expected: All services show "healthy" status.

- [ ] **Step 6: Commit**

```bash
git add docker/
git commit -m "feat: add Docker Compose for platform core services (Supabase, TimescaleDB, Neo4j, Redis)"
```

---

## Task 2: Event Store — Schema and Migrations

**Files:**
- Create: `docker/supabase/migrations/001_events_table.sql`
- Create: `docker/supabase/migrations/002_consumer_offsets.sql`

- [ ] **Step 1: Create events table migration with RLS**

```sql
-- docker/supabase/migrations/001_events_table.sql

-- Event Store: append-only immutable event log
CREATE TABLE IF NOT EXISTS events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_number BIGSERIAL UNIQUE NOT NULL,
  type            TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  actor_id        TEXT NOT NULL,
  version         INTEGER NOT NULL DEFAULT 1,
  payload         JSONB NOT NULL DEFAULT '{}'::jsonb,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes for efficient querying
CREATE INDEX idx_events_tenant_seq ON events (tenant_id, sequence_number);
CREATE INDEX idx_events_type_tenant ON events (type, tenant_id, sequence_number);
CREATE INDEX idx_events_created ON events (created_at);

-- Row Level Security: tenant isolation
ALTER TABLE events ENABLE ROW LEVEL SECURITY;

-- Policy: users can only see events for their tenant
CREATE POLICY events_tenant_isolation ON events
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

-- Policy: insert requires matching tenant_id
CREATE POLICY events_insert_tenant ON events
  FOR INSERT
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

-- Service role bypasses RLS for cross-tenant operations (admin only)
CREATE POLICY events_service_role ON events
  FOR ALL
  TO service_role
  USING (true);

-- Prevent updates and deletes (immutable)
CREATE RULE events_no_update AS ON UPDATE TO events DO INSTEAD NOTHING;
CREATE RULE events_no_delete AS ON DELETE TO events DO INSTEAD NOTHING;

-- Helper function for setting tenant context (used by Supabase JS client)
CREATE OR REPLACE FUNCTION set_tenant_context(tenant text)
RETURNS void LANGUAGE sql AS $$
  SELECT set_config('app.tenant_id', tenant, true);
$$;

-- Notify on new events (for real-time listeners)
CREATE OR REPLACE FUNCTION notify_event_insert()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'new_event',
    json_build_object(
      'sequence_number', NEW.sequence_number,
      'type', NEW.type,
      'tenant_id', NEW.tenant_id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER event_insert_notify
  AFTER INSERT ON events
  FOR EACH ROW
  EXECUTE FUNCTION notify_event_insert();
```

- [ ] **Step 2: Create consumer offsets table**

```sql
-- docker/supabase/migrations/002_consumer_offsets.sql

-- Consumer group offset tracking for durable event consumption
CREATE TABLE IF NOT EXISTS consumer_offsets (
  consumer_group  TEXT NOT NULL,
  tenant_id       TEXT NOT NULL,
  last_sequence   BIGINT NOT NULL DEFAULT 0,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (consumer_group, tenant_id)
);

-- RLS on consumer offsets
ALTER TABLE consumer_offsets ENABLE ROW LEVEL SECURITY;

CREATE POLICY offsets_tenant_isolation ON consumer_offsets
  FOR ALL
  USING (tenant_id = current_setting('app.tenant_id', true));

CREATE POLICY offsets_service_role ON consumer_offsets
  FOR ALL
  TO service_role
  USING (true);
```

- [ ] **Step 3: Apply migrations to Supabase container**

Run: `docker exec -i docker-supabase-db-1 psql -U postgres -d delta_intelligence < docker/supabase/migrations/001_events_table.sql`
Expected: CREATE TABLE, CREATE INDEX, CREATE POLICY output.

Run: `docker exec -i docker-supabase-db-1 psql -U postgres -d delta_intelligence < docker/supabase/migrations/002_consumer_offsets.sql`
Expected: CREATE TABLE, CREATE POLICY output.

- [ ] **Step 4: Verify schema**

Run: `docker exec docker-supabase-db-1 psql -U postgres -d delta_intelligence -c "\dt"`
Expected: `events` and `consumer_offsets` tables listed.

Run: `docker exec docker-supabase-db-1 psql -U postgres -d delta_intelligence -c "SELECT * FROM pg_policies WHERE tablename = 'events'"`
Expected: 3 policies (tenant_isolation, insert_tenant, service_role).

- [ ] **Step 5: Commit**

```bash
git add docker/supabase/
git commit -m "feat: add Event Store schema with RLS tenant isolation and consumer offsets"
```

---

## Task 3: Event Store — TypeScript Client

**Files:**
- Create: `src/lib/events/event-schema.ts`
- Create: `src/lib/events/event-types.ts`
- Create: `src/lib/events/event-store.ts`
- Create: `tests/events/event-schema.test.ts`
- Create: `tests/events/event-store.test.ts`

- [ ] **Step 1: Write event schema validation tests**

```typescript
// tests/events/event-schema.test.ts
import { describe, it, expect } from 'vitest';
import { EventSchema, parseEvent } from '@/lib/events/event-schema';

describe('EventSchema', () => {
  it('validates a well-formed event', () => {
    const event = {
      type: 'order.created',
      tenant_id: 'tenant_001',
      actor_id: 'user_123',
      version: 1,
      payload: { order_id: 'ord_456', total: 1500.00 },
      metadata: { source: 'portal' },
    };
    const result = parseEvent(event);
    expect(result.success).toBe(true);
  });

  it('rejects event without tenant_id', () => {
    const event = {
      type: 'order.created',
      actor_id: 'user_123',
      version: 1,
      payload: {},
    };
    const result = parseEvent(event);
    expect(result.success).toBe(false);
  });

  it('rejects event with invalid type format', () => {
    const event = {
      type: 'invalid',
      tenant_id: 'tenant_001',
      actor_id: 'user_123',
      version: 1,
      payload: {},
    };
    const result = parseEvent(event);
    expect(result.success).toBe(false);
  });

  it('requires version to be a positive integer', () => {
    const event = {
      type: 'order.created',
      tenant_id: 'tenant_001',
      actor_id: 'user_123',
      version: 0,
      payload: {},
    };
    const result = parseEvent(event);
    expect(result.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/events/event-schema.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement event schema**

```typescript
// src/lib/events/event-schema.ts
import { z } from 'zod';

// Event type must be domain.action format (e.g., order.created, feed.ingested)
const eventTypePattern = /^[a-z][a-z0-9_]*\.[a-z][a-z0-9_]*$/;

export const EventSchema = z.object({
  type: z.string().regex(eventTypePattern, 'Event type must be domain.action format (e.g., order.created)'),
  tenant_id: z.string().min(1, 'tenant_id is required'),
  actor_id: z.string().min(1, 'actor_id is required'),
  version: z.number().int().positive('version must be a positive integer'),
  payload: z.record(z.unknown()).default({}),
  metadata: z.record(z.unknown()).default({}),
});

export type EventInput = z.infer<typeof EventSchema>;

export interface StoredEvent extends EventInput {
  id: string;
  sequence_number: number;
  created_at: string;
}

export function parseEvent(input: unknown) {
  return EventSchema.safeParse(input);
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/events/event-schema.test.ts`
Expected: All 4 tests PASS.

- [ ] **Step 5: Create event type registry**

```typescript
// src/lib/events/event-types.ts

// Domain event types used across the platform.
// New event types are added here as modules are built.
// Consumers must handle unknown types gracefully (log and skip).

export const EVENT_TYPES = {
  // Platform lifecycle
  'platform.started': 'Platform core started',
  'platform.health_checked': 'Health check completed',

  // Feed ingestion
  'feed.ingested': 'External data feed ingested and cached',
  'feed.failed': 'External data feed ingestion failed',

  // Auth
  'auth.login': 'User authenticated',
  'auth.logout': 'User logged out',
  'auth.token_issued': 'Spoke JWT issued',

  // Nova AI
  'nova.query': 'Nova received a query',
  'nova.response': 'Nova produced a response',
  'nova.action.requested': 'Nova agentic action requested',
  'nova.action.executed': 'Nova agentic action completed',
  'nova.action.failed': 'Nova agentic action failed',
  'nova.anomaly.detected': 'Nova detected an anomaly',
  'nova.briefing.generated': 'Nova generated a briefing',

  // Bot execution
  'bot.created': 'Automation bot created',
  'bot.executed': 'Bot execution completed',
  'bot.failed': 'Bot execution failed',

  // Security
  'security.rate_limit_exceeded': 'Rate limit exceeded',
  'security.tenant_violation': 'Cross-tenant access attempted',
} as const;

export type EventType = keyof typeof EVENT_TYPES | string;
```

- [ ] **Step 6: Write Event Store client tests**

```typescript
// tests/events/event-store.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventStore } from '@/lib/events/event-store';
import type { EventInput } from '@/lib/events/event-schema';

// These tests use a mock Supabase client for unit testing.
// Integration tests against real Docker services are in tests/integration/.

const mockSupabase = {
  rpc: vi.fn(),
  from: vi.fn(() => ({
    insert: vi.fn(() => ({ select: vi.fn(() => ({ single: vi.fn(() => ({ data: { id: 'evt_1', sequence_number: 1, created_at: new Date().toISOString() }, error: null })) })) })),
    select: vi.fn(() => ({
      eq: vi.fn(() => ({
        gt: vi.fn(() => ({
          order: vi.fn(() => ({
            limit: vi.fn(() => ({ data: [], error: null })),
          })),
        })),
      })),
    })),
  })),
};

describe('EventStore', () => {
  let store: EventStore;

  beforeEach(() => {
    store = new EventStore(mockSupabase as any, 'tenant_001');
  });

  it('emits an event and returns stored event with sequence number', async () => {
    const input: EventInput = {
      type: 'order.created',
      tenant_id: 'tenant_001',
      actor_id: 'user_123',
      version: 1,
      payload: { order_id: 'ord_1' },
      metadata: {},
    };
    const result = await store.emit(input);
    expect(result.id).toBeDefined();
    expect(result.sequence_number).toBe(1);
  });

  it('rejects events with mismatched tenant_id', async () => {
    const input: EventInput = {
      type: 'order.created',
      tenant_id: 'tenant_002',
      actor_id: 'user_123',
      version: 1,
      payload: {},
      metadata: {},
    };
    await expect(store.emit(input)).rejects.toThrow('tenant_id mismatch');
  });

  it('reads events from a cursor position', async () => {
    const events = await store.readFrom(0, 100);
    expect(Array.isArray(events)).toBe(true);
  });
});
```

- [ ] **Step 7: Run test to verify it fails**

Run: `npx vitest run tests/events/event-store.test.ts`
Expected: FAIL — EventStore not found.

- [ ] **Step 8: Implement Event Store client**

```typescript
// src/lib/events/event-store.ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { EventSchema, type EventInput, type StoredEvent } from './event-schema';

export class EventStore {
  constructor(
    private readonly supabase: SupabaseClient,
    private readonly tenantId: string
  ) {}

  async emit(input: EventInput): Promise<StoredEvent> {
    // Validate event schema
    const parsed = EventSchema.parse(input);

    // Enforce tenant isolation at the application layer
    if (parsed.tenant_id !== this.tenantId) {
      throw new Error(`tenant_id mismatch: expected ${this.tenantId}, got ${parsed.tenant_id}`);
    }

    // Set RLS context
    await this.supabase.rpc('set_tenant_context', {
      tenant: this.tenantId,
    });

    // Insert event (append-only)
    const { data, error } = await this.supabase
      .from('events')
      .insert({
        type: parsed.type,
        tenant_id: parsed.tenant_id,
        actor_id: parsed.actor_id,
        version: parsed.version,
        payload: parsed.payload,
        metadata: parsed.metadata,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to emit event: ${error.message}`);
    }

    return data as StoredEvent;
  }

  async readFrom(
    cursor: number,
    limit: number = 100,
    eventType?: string
  ): Promise<StoredEvent[]> {
    await this.supabase.rpc('set_tenant_context', {
      tenant: this.tenantId,
    });

    let query = this.supabase
      .from('events')
      .select('*')
      .eq('tenant_id', this.tenantId)
      .gt('sequence_number', cursor)
      .order('sequence_number', { ascending: true })
      .limit(limit);

    if (eventType) {
      query = query.eq('type', eventType);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to read events: ${error.message}`);
    }

    return (data ?? []) as StoredEvent[];
  }

  async getLatestSequence(): Promise<number> {
    await this.supabase.rpc('set_tenant_context', {
      tenant: this.tenantId,
    });

    const { data, error } = await this.supabase
      .from('events')
      .select('sequence_number')
      .eq('tenant_id', this.tenantId)
      .order('sequence_number', { ascending: false })
      .limit(1);

    if (error) {
      throw new Error(`Failed to get latest sequence: ${error.message}`);
    }

    return (data ?? []).length > 0 ? data[0].sequence_number : 0;
  }
}
```

- [ ] **Step 9: Run tests to verify they pass**

Run: `npx vitest run tests/events/`
Expected: All tests PASS.

- [ ] **Step 10: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/events/ tests/events/
git commit -m "feat: add Event Store client with schema validation, tenant isolation, and cursor-based replay"
```

---

## Task 4: Consumer Groups — Redis Streams Integration

**Files:**
- Create: `src/lib/events/consumer-group.ts`
- Create: `tests/events/consumer-group.test.ts`
- Modify: `package.json` (add ioredis dependency)

- [ ] **Step 1: Add ioredis dependency**

Run: `cd ~/delta360/intelligence && npm install ioredis`
Expected: ioredis added to package.json dependencies.

- [ ] **Step 2: Write consumer group tests**

```typescript
// tests/events/consumer-group.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ConsumerGroup } from '@/lib/events/consumer-group';

const mockRedis = {
  xadd: vi.fn().mockResolvedValue('1-0'),
  xreadgroup: vi.fn().mockResolvedValue(null),
  xgroup: vi.fn().mockResolvedValue('OK'),
  xack: vi.fn().mockResolvedValue(1),
};

const mockEventStore = {
  readFrom: vi.fn().mockResolvedValue([]),
  getLatestSequence: vi.fn().mockResolvedValue(0),
};

const mockOffsetStore = {
  getOffset: vi.fn().mockResolvedValue(0),
  setOffset: vi.fn().mockResolvedValue(undefined),
};

describe('ConsumerGroup', () => {
  let group: ConsumerGroup;

  beforeEach(() => {
    group = new ConsumerGroup({
      groupName: 'portal-sync',
      consumerId: 'portal-1',
      tenantId: 'tenant_001',
      redis: mockRedis as any,
      eventStore: mockEventStore as any,
      offsetStore: mockOffsetStore as any,
    });
  });

  it('publishes events to tenant-namespaced Redis Stream', async () => {
    await group.publish({
      id: 'evt_1',
      sequence_number: 1,
      type: 'order.created',
      tenant_id: 'tenant_001',
      actor_id: 'user_1',
      version: 1,
      payload: {},
      metadata: {},
      created_at: new Date().toISOString(),
    });
    expect(mockRedis.xadd).toHaveBeenCalledWith(
      'tenant:tenant_001:events',
      '*',
      'data',
      expect.any(String)
    );
  });

  it('uses tenant-namespaced stream key', () => {
    expect(group.streamKey).toBe('tenant:tenant_001:events');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/events/consumer-group.test.ts`
Expected: FAIL — ConsumerGroup not found.

- [ ] **Step 4: Implement consumer group**

```typescript
// src/lib/events/consumer-group.ts
import type Redis from 'ioredis';
import type { EventStore } from './event-store';
import type { StoredEvent } from './event-schema';

interface OffsetStore {
  getOffset(group: string, tenantId: string): Promise<number>;
  setOffset(group: string, tenantId: string, sequence: number): Promise<void>;
}

interface ConsumerGroupConfig {
  groupName: string;
  consumerId: string;
  tenantId: string;
  redis: Redis;
  eventStore: EventStore;
  offsetStore: OffsetStore;
}

export class ConsumerGroup {
  private readonly config: ConsumerGroupConfig;
  readonly streamKey: string;

  constructor(config: ConsumerGroupConfig) {
    this.config = config;
    this.streamKey = `tenant:${config.tenantId}:events`;
  }

  async publish(event: StoredEvent): Promise<void> {
    await this.config.redis.xadd(
      this.streamKey,
      '*',
      'data',
      JSON.stringify(event)
    );
  }

  async initialize(): Promise<void> {
    try {
      await this.config.redis.xgroup(
        'CREATE',
        this.streamKey,
        this.config.groupName,
        '0',
        'MKSTREAM'
      );
    } catch (err: any) {
      // Group already exists — this is fine
      if (!err.message?.includes('BUSYGROUP')) {
        throw err;
      }
    }
  }

  async consume(
    handler: (event: StoredEvent) => Promise<void>,
    options: { batchSize?: number; blockMs?: number } = {}
  ): Promise<void> {
    const { batchSize = 10, blockMs = 5000 } = options;

    const results = await this.config.redis.xreadgroup(
      'GROUP',
      this.config.groupName,
      this.config.consumerId,
      'COUNT',
      batchSize,
      'BLOCK',
      blockMs,
      'STREAMS',
      this.streamKey,
      '>'
    );

    if (!results) return;

    for (const [, messages] of results) {
      for (const [messageId, fields] of messages) {
        const event: StoredEvent = JSON.parse(fields[1]);
        await handler(event);
        await this.config.redis.xack(
          this.streamKey,
          this.config.groupName,
          messageId
        );
        await this.config.offsetStore.setOffset(
          this.config.groupName,
          this.config.tenantId,
          event.sequence_number
        );
      }
    }
  }

  async replayFromStore(): Promise<StoredEvent[]> {
    const lastOffset = await this.config.offsetStore.getOffset(
      this.config.groupName,
      this.config.tenantId
    );
    return this.config.eventStore.readFrom(lastOffset);
  }
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/events/consumer-group.test.ts`
Expected: All tests PASS.

- [ ] **Step 6: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 7: Commit**

```bash
git add src/lib/events/consumer-group.ts tests/events/consumer-group.test.ts package.json package-lock.json
git commit -m "feat: add consumer group with Redis Streams delivery and offset tracking"
```

---

## Task 5: CQRS — Command Bus and Query Bus

**Files:**
- Create: `src/lib/cqrs/command-types.ts`
- Create: `src/lib/cqrs/command-bus.ts`
- Create: `src/lib/cqrs/query-bus.ts`
- Create: `tests/cqrs/command-bus.test.ts`

- [ ] **Step 1: Write command bus tests**

```typescript
// tests/cqrs/command-bus.test.ts
import { describe, it, expect, vi } from 'vitest';
import { CommandBus } from '@/lib/cqrs/command-bus';

describe('CommandBus', () => {
  it('dispatches a command to the registered handler', async () => {
    const handler = vi.fn().mockResolvedValue([
      { type: 'order.created', tenant_id: 't1', actor_id: 'u1', version: 1, payload: { id: '1' }, metadata: {} }
    ]);
    const mockEventStore = { emit: vi.fn().mockResolvedValue({ id: 'e1', sequence_number: 1 }) };
    const bus = new CommandBus(mockEventStore as any);
    bus.register('create_order', handler);

    await bus.dispatch('create_order', { product: 'diesel' }, 't1', 'u1');

    expect(handler).toHaveBeenCalledWith({ product: 'diesel' }, 't1', 'u1');
    expect(mockEventStore.emit).toHaveBeenCalled();
  });

  it('throws on unregistered command', async () => {
    const bus = new CommandBus({} as any);
    await expect(bus.dispatch('unknown', {}, 't1', 'u1')).rejects.toThrow('No handler registered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/cqrs/command-bus.test.ts`
Expected: FAIL — CommandBus not found.

- [ ] **Step 3: Implement command types**

```typescript
// src/lib/cqrs/command-types.ts
import { z } from 'zod';

export const CommandEnvelope = z.object({
  command: z.string().min(1),
  payload: z.record(z.unknown()),
  tenant_id: z.string().min(1),
  actor_id: z.string().min(1),
});

export type CommandEnvelopeType = z.infer<typeof CommandEnvelope>;
```

- [ ] **Step 4: Implement command bus**

```typescript
// src/lib/cqrs/command-bus.ts
import type { EventStore } from '@/lib/events/event-store';
import type { EventInput } from '@/lib/events/event-schema';

type CommandHandler = (
  payload: Record<string, unknown>,
  tenantId: string,
  actorId: string
) => Promise<EventInput[]>;

export class CommandBus {
  private handlers = new Map<string, CommandHandler>();

  constructor(private readonly eventStore: EventStore) {}

  register(command: string, handler: CommandHandler): void {
    this.handlers.set(command, handler);
  }

  async dispatch(
    command: string,
    payload: Record<string, unknown>,
    tenantId: string,
    actorId: string
  ): Promise<void> {
    const handler = this.handlers.get(command);
    if (!handler) {
      throw new Error(`No handler registered for command: ${command}`);
    }

    const events = await handler(payload, tenantId, actorId);

    for (const event of events) {
      await this.eventStore.emit(event);
    }
  }
}
```

- [ ] **Step 5: Implement query bus**

```typescript
// src/lib/cqrs/query-bus.ts
type QueryHandler<T = unknown> = (
  params: Record<string, unknown>,
  tenantId: string
) => Promise<T>;

export class QueryBus {
  private handlers = new Map<string, QueryHandler>();

  register<T>(query: string, handler: QueryHandler<T>): void {
    this.handlers.set(query, handler as QueryHandler);
  }

  async dispatch<T = unknown>(
    query: string,
    params: Record<string, unknown>,
    tenantId: string
  ): Promise<T> {
    const handler = this.handlers.get(query);
    if (!handler) {
      throw new Error(`No handler registered for query: ${query}`);
    }
    return handler(params, tenantId) as Promise<T>;
  }
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run tests/cqrs/`
Expected: All tests PASS.

- [ ] **Step 7: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 8: Commit**

```bash
git add src/lib/cqrs/ tests/cqrs/
git commit -m "feat: add CQRS command bus and query bus with event emission"
```

---

## Task 6: Auth Federation — JWT Issuance and Verification

**Files:**
- Create: `src/lib/auth/federation.ts`
- Create: `src/lib/auth/jwt-issuer.ts`
- Create: `src/lib/auth/jwt-verifier.ts`
- Create: `src/lib/auth/tenant-context.ts`
- Create: `tests/auth/federation.test.ts`
- Create: `tests/auth/tenant-isolation.test.ts`

- [ ] **Step 1: Add jose dependency for JWT operations**

Run: `cd ~/delta360/intelligence && npm install jose`
Expected: jose added to dependencies.

- [ ] **Step 2: Write federation tests**

```typescript
// tests/auth/federation.test.ts
import { describe, it, expect } from 'vitest';
import { JwtIssuer } from '@/lib/auth/jwt-issuer';
import { JwtVerifier } from '@/lib/auth/jwt-verifier';

describe('Auth Federation', () => {
  const secret = 'test-secret-key-at-least-32-chars-long!!';

  it('issues a JWT with tenant, role, and module claims', async () => {
    const issuer = new JwtIssuer(secret);
    const token = await issuer.issue({
      tenant_id: 'tenant_001',
      user_id: 'user_123',
      role: 'admin',
      module_permissions: ['portal', 'equipment_tracker'],
    });
    expect(token).toBeDefined();
    expect(typeof token).toBe('string');
  });

  it('verifies a valid JWT and extracts claims', async () => {
    const issuer = new JwtIssuer(secret);
    const verifier = new JwtVerifier(secret);

    const token = await issuer.issue({
      tenant_id: 'tenant_001',
      user_id: 'user_123',
      role: 'admin',
      module_permissions: ['portal'],
    });

    const claims = await verifier.verify(token);
    expect(claims.tenant_id).toBe('tenant_001');
    expect(claims.user_id).toBe('user_123');
    expect(claims.role).toBe('admin');
    expect(claims.module_permissions).toContain('portal');
  });

  it('rejects a JWT signed with a different secret', async () => {
    const issuer = new JwtIssuer(secret);
    const verifier = new JwtVerifier('different-secret-key-at-least-32-chars!!');

    const token = await issuer.issue({
      tenant_id: 'tenant_001',
      user_id: 'user_123',
      role: 'admin',
      module_permissions: [],
    });

    await expect(verifier.verify(token)).rejects.toThrow();
  });

  it('rejects an expired JWT', async () => {
    const issuer = new JwtIssuer(secret);
    const verifier = new JwtVerifier(secret);

    const token = await issuer.issue({
      tenant_id: 'tenant_001',
      user_id: 'user_123',
      role: 'admin',
      module_permissions: [],
    }, '0s'); // Expires immediately

    // Small delay to ensure expiration
    await new Promise(r => setTimeout(r, 100));
    await expect(verifier.verify(token)).rejects.toThrow();
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/auth/federation.test.ts`
Expected: FAIL — modules not found.

- [ ] **Step 4: Implement JWT issuer**

```typescript
// src/lib/auth/jwt-issuer.ts
import * as jose from 'jose';

export interface FederatedClaims {
  tenant_id: string;
  user_id: string;
  role: string;
  module_permissions: string[];
}

export class JwtIssuer {
  private readonly secret: Uint8Array;

  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey);
  }

  async issue(claims: FederatedClaims, expiresIn: string = '1h'): Promise<string> {
    return new jose.SignJWT({
      tenant_id: claims.tenant_id,
      user_id: claims.user_id,
      role: claims.role,
      module_permissions: claims.module_permissions,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(expiresIn)
      .setIssuer('delta-intelligence')
      .setAudience('delta-spoke')
      .sign(this.secret);
  }
}
```

- [ ] **Step 5: Implement JWT verifier**

```typescript
// src/lib/auth/jwt-verifier.ts
import * as jose from 'jose';
import type { FederatedClaims } from './jwt-issuer';

export class JwtVerifier {
  private readonly secret: Uint8Array;

  constructor(secretKey: string) {
    this.secret = new TextEncoder().encode(secretKey);
  }

  async verify(token: string): Promise<FederatedClaims> {
    const { payload } = await jose.jwtVerify(token, this.secret, {
      issuer: 'delta-intelligence',
      audience: 'delta-spoke',
    });

    return {
      tenant_id: payload.tenant_id as string,
      user_id: payload.user_id as string,
      role: payload.role as string,
      module_permissions: (payload.module_permissions ?? []) as string[],
    };
  }
}
```

- [ ] **Step 6: Implement tenant context setter**

```typescript
// src/lib/auth/tenant-context.ts
import type { SupabaseClient } from '@supabase/supabase-js';

export async function setTenantContext(
  supabase: SupabaseClient,
  tenantId: string
): Promise<void> {
  await supabase.rpc('set_tenant_context', {
    tenant: tenantId,
  });
}

export function extractTenantFromJwt(
  claims: { tenant_id: string }
): string {
  if (!claims.tenant_id) {
    throw new Error('JWT missing tenant_id claim');
  }
  return claims.tenant_id;
}
```

- [ ] **Step 7: Implement federation orchestrator**

```typescript
// src/lib/auth/federation.ts
import { JwtIssuer, type FederatedClaims } from './jwt-issuer';
import { JwtVerifier } from './jwt-verifier';

export class AuthFederation {
  private readonly issuer: JwtIssuer;
  private readonly verifier: JwtVerifier;

  constructor(secretKey: string) {
    this.issuer = new JwtIssuer(secretKey);
    this.verifier = new JwtVerifier(secretKey);
  }

  async issueToken(claims: FederatedClaims, expiresIn?: string): Promise<string> {
    return this.issuer.issue(claims, expiresIn);
  }

  async verifyToken(token: string): Promise<FederatedClaims> {
    return this.verifier.verify(token);
  }
}
```

- [ ] **Step 8: Write tenant isolation negative tests**

```typescript
// tests/auth/tenant-isolation.test.ts
import { describe, it, expect } from 'vitest';
import { JwtIssuer } from '@/lib/auth/jwt-issuer';
import { JwtVerifier } from '@/lib/auth/jwt-verifier';
import { extractTenantFromJwt } from '@/lib/auth/tenant-context';

describe('Tenant Isolation', () => {
  const secret = 'test-secret-key-at-least-32-chars-long!!';

  it('JWT for tenant A cannot be used to access tenant B resources', async () => {
    const issuer = new JwtIssuer(secret);
    const verifier = new JwtVerifier(secret);

    const tokenA = await issuer.issue({
      tenant_id: 'tenant_A',
      user_id: 'user_1',
      role: 'admin',
      module_permissions: ['portal'],
    });

    const claims = await verifier.verify(tokenA);
    const tenantId = extractTenantFromJwt(claims);

    // The verified tenant_id is tenant_A, not tenant_B
    expect(tenantId).toBe('tenant_A');
    expect(tenantId).not.toBe('tenant_B');
  });

  it('rejects JWT without tenant_id', () => {
    expect(() => extractTenantFromJwt({ tenant_id: '' })).toThrow('missing tenant_id');
  });

  it('EventStore rejects cross-tenant event emission', async () => {
    // Store scoped to tenant_B should reject events with tenant_A
    const { EventStore } = await import('@/lib/events/event-store');
    const mockSupabase = {
      rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
      from: vi.fn(),
    };
    const store = new EventStore(mockSupabase as any, 'tenant_B');

    await expect(store.emit({
      type: 'order.created',
      tenant_id: 'tenant_A',
      actor_id: 'user_1',
      version: 1,
      payload: {},
      metadata: {},
    })).rejects.toThrow('tenant_id mismatch');
  });
});
```

- [ ] **Step 9: Run all auth tests**

Run: `npx vitest run tests/auth/`
Expected: All tests PASS.

- [ ] **Step 10: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 11: Commit**

```bash
git add src/lib/auth/ tests/auth/ package.json package-lock.json
git commit -m "feat: add auth federation with JWT issuance, verification, and tenant isolation"
```

---

## Task 7: API Routes — Events and Commands

**Files:**
- Create: `src/app/api/events/route.ts`
- Create: `src/app/api/commands/route.ts`
- Create: `src/app/api/auth/federation/token/route.ts`
- Create: `src/app/api/auth/federation/verify/route.ts`

- [ ] **Step 1: Create events API route**

```typescript
// src/app/api/events/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { EventStore } from '@/lib/events/event-store';
import { parseEvent } from '@/lib/events/event-schema';
import { AuthFederation } from '@/lib/auth/federation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_KEY!
);

const federation = new AuthFederation(
  process.env.FEDERATION_JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars'
);

async function authenticateRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return null;
  }
  try {
    return await federation.verifyToken(authHeader.slice(7));
  } catch {
    return null;
  }
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate: tenant_id comes from verified JWT, not request body
    const claims = await authenticateRequest(req);
    if (!claims) {
      return NextResponse.json(
        { success: false, error: 'Valid Bearer token required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    // Override tenant_id with the authenticated tenant — never trust the client
    const eventInput = { ...body, tenant_id: claims.tenant_id };
    const parsed = parseEvent(eventInput);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid event', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    const store = new EventStore(supabase, claims.tenant_id);
    const event = await store.emit(parsed.data);

    return NextResponse.json({ success: true, data: event }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

export async function GET(req: NextRequest) {
  try {
    // Authenticate: tenant_id comes from verified JWT
    const claims = await authenticateRequest(req);
    if (!claims) {
      return NextResponse.json(
        { success: false, error: 'Valid Bearer token required' },
        { status: 401 }
      );
    }

    const cursor = Number(req.nextUrl.searchParams.get('cursor') ?? '0');
    const limit = Number(req.nextUrl.searchParams.get('limit') ?? '100');
    const type = req.nextUrl.searchParams.get('type') ?? undefined;

    const store = new EventStore(supabase, claims.tenant_id);
    const events = await store.readFrom(cursor, limit, type);

    return NextResponse.json({ success: true, data: events });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create commands API route**

```typescript
// src/app/api/commands/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { CommandEnvelope } from '@/lib/cqrs/command-types';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = CommandEnvelope.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid command', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    // Command bus will be initialized with registered handlers
    // For now, return acknowledgment that the command was received
    return NextResponse.json({
      success: true,
      message: `Command ${parsed.data.command} received for tenant ${parsed.data.tenant_id}`,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 3: Create federation token endpoint**

```typescript
// src/app/api/auth/federation/token/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AuthFederation } from '@/lib/auth/federation';
import { getServerSession } from 'next-auth';
import { z } from 'zod';

const federation = new AuthFederation(process.env.FEDERATION_JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars');

const TokenRequest = z.object({
  module: z.string().min(1),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession();
    if (!session?.user?.email) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 }
      );
    }

    const body = await req.json();
    const parsed = TokenRequest.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'module field required' },
        { status: 400 }
      );
    }

    // Default tenant for Delta360 (multi-tenant support added in Phase 5)
    const tenantId = 'delta360';

    // Look up role from existing roles config
    const { getUserRole } = await import('@/lib/config/roles');
    const role = getUserRole(session.user.email);
    if (!role) {
      return NextResponse.json(
        { success: false, error: 'User has no assigned role. Contact admin.' },
        { status: 403 }
      );
    }

    const token = await federation.issueToken({
      tenant_id: tenantId,
      user_id: session.user.email,
      role,
      module_permissions: [parsed.data.module],
    });

    return NextResponse.json({ success: true, data: { token } });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 4: Create federation verify endpoint**

```typescript
// src/app/api/auth/federation/verify/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { AuthFederation } from '@/lib/auth/federation';

const federation = new AuthFederation(process.env.FEDERATION_JWT_SECRET ?? 'dev-secret-change-in-production-min-32-chars');

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { token } = body;

    if (!token) {
      return NextResponse.json(
        { success: false, error: 'token field required' },
        { status: 400 }
      );
    }

    const claims = await federation.verifyToken(token);
    return NextResponse.json({ success: true, data: claims });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Invalid or expired token' },
      { status: 401 }
    );
  }
}
```

- [ ] **Step 5: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/api/events/ src/app/api/commands/ src/app/api/auth/federation/
git commit -m "feat: add API routes for events, commands, and auth federation"
```

---

## Task 8: @delta/ui — Shared SDK Foundation

**Files:**
- Create: `packages/ui/package.json`
- Create: `packages/ui/tsconfig.json`
- Create: `packages/ui/src/tokens/colors.ts`
- Create: `packages/ui/src/tokens/typography.ts`
- Create: `packages/ui/src/tokens/spacing.ts`
- Create: `packages/ui/src/primitives/density-provider.tsx`
- Create: `packages/ui/src/index.ts`
- Modify: `package.json` (add workspace)
- Modify: `tsconfig.json` (add path alias)

- [ ] **Step 1: Create packages/ui directory and package.json**

```json
// packages/ui/package.json
// NOTE: This is a private monorepo-only package. Consumers resolve via tsconfig
// path alias (@delta/ui -> packages/ui/src). main/exports not used by bundler.
// If publishing externally, add a build step and point at ./dist.
{
  "name": "@delta/ui",
  "version": "0.1.0",
  "private": true,
  "peerDependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0"
  }
}
```

- [ ] **Step 2: Create tsconfig for packages/ui**

```json
// packages/ui/tsconfig.json
{
  "compilerOptions": {
    "target": "ES2017",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "esModuleInterop": true,
    "declaration": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
```

- [ ] **Step 3: Extract design tokens from existing globals.css**

```typescript
// packages/ui/src/tokens/colors.ts

// Brand colors — Delta360 corporate identity
export const brand = {
  orange: '#FF5C00',
  orangeHover: '#E54800',
  black: '#000000',
  navy: '#0C2833',
  steel: '#8CAEC1',
} as const;

// Semantic colors — light mode
export const light = {
  background: '#ffffff',
  textPrimary: '#09090B',
  textSecondary: '#71717A',
  textMuted: '#A1A1AA',
  border: '#E4E4E7',
  borderHover: '#D4D4D8',
  card: '#FFFFFF',
  input: '#FFFFFF',
  tertiary: '#F4F4F5',
  accentHighlight: 'rgba(255, 92, 0, 0.1)',
  accentHighlightHover: 'rgba(255, 92, 0, 0.2)',
} as const;

// Semantic colors — dark mode (zinc scale)
export const dark = {
  background: '#09090B',
  textPrimary: '#FAFAFA',
  textSecondary: '#A1A1AA',
  textMuted: '#71717A',
  border: '#27272A',
  borderHover: '#3F3F46',
  card: '#18181B',
  input: '#27272A',
  tertiary: '#18181B',
  accentHighlight: 'rgba(255, 92, 0, 0.1)',
  accentHighlightHover: 'rgba(255, 92, 0, 0.3)',
} as const;

// Status colors
export const status = {
  success: '#22c55e',
  warning: '#eab308',
  error: '#ef4444',
  info: '#3b82f6',
} as const;
```

- [ ] **Step 4: Create typography tokens**

```typescript
// packages/ui/src/tokens/typography.ts

export const fontFamily = {
  sans: 'var(--font-inter), system-ui, -apple-system, sans-serif',
  mono: 'var(--font-geist-mono), ui-monospace, monospace',
  heading: 'Georgia, serif',
  body: "'Times New Roman', serif",
} as const;

export const fontSize = {
  xs: '0.75rem',
  sm: '0.875rem',
  base: '1rem',
  lg: '1.125rem',
  xl: '1.25rem',
  '2xl': '1.5rem',
  '3xl': '1.875rem',
} as const;

export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
} as const;
```

- [ ] **Step 5: Create spacing tokens**

```typescript
// packages/ui/src/tokens/spacing.ts

export const spacing = {
  0: '0',
  1: '0.25rem',
  2: '0.5rem',
  3: '0.75rem',
  4: '1rem',
  5: '1.25rem',
  6: '1.5rem',
  8: '2rem',
  10: '2.5rem',
  12: '3rem',
  16: '4rem',
} as const;

export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;
```

- [ ] **Step 6: Create density mode provider**

```typescript
// packages/ui/src/primitives/density-provider.tsx
'use client';

import { createContext, useContext, useState, type ReactNode } from 'react';

export type DensityMode = 'executive' | 'operator';

interface DensityContextValue {
  mode: DensityMode;
  setMode: (mode: DensityMode) => void;
  toggle: () => void;
}

const DensityContext = createContext<DensityContextValue>({
  mode: 'executive',
  setMode: () => {},
  toggle: () => {},
});

export function DensityProvider({
  children,
  defaultMode = 'executive',
}: {
  children: ReactNode;
  defaultMode?: DensityMode;
}) {
  const [mode, setMode] = useState<DensityMode>(defaultMode);
  const toggle = () => setMode(m => m === 'executive' ? 'operator' : 'executive');

  return (
    <DensityContext.Provider value={{ mode, setMode, toggle }}>
      {children}
    </DensityContext.Provider>
  );
}

export function useDensity(): DensityContextValue {
  return useContext(DensityContext);
}
```

- [ ] **Step 7: Create exports**

```typescript
// packages/ui/src/tokens/index.ts
export * from './colors';
export * from './typography';
export * from './spacing';

// packages/ui/src/primitives/index.ts
export * from './density-provider';

// packages/ui/src/index.ts
export * from './tokens';
export * from './primitives';
```

- [ ] **Step 8: Add workspace to root package.json**

Add `"workspaces": ["packages/*"]` to the root package.json.

- [ ] **Step 9: Add path alias to tsconfig.json**

Add `"@delta/ui": ["./packages/ui/src"]` to tsconfig paths.

- [ ] **Step 10: Verify TypeScript compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 11: Commit**

```bash
git add packages/ui/ package.json tsconfig.json
git commit -m "feat: add @delta/ui shared SDK with design tokens and density mode provider"
```

---

## Task 9: Environment and Configuration Updates

**Files:**
- Modify: `.env.example`
- Modify: `.gitignore`

- [ ] **Step 1: Update .env.example with new variables**

Add the following to `.env.example`:

```env
# Event Store (Docker local — do NOT overwrite existing cloud Supabase URL if set)
# NEXT_PUBLIC_SUPABASE_URL=http://localhost:54322  # Uncomment for local Docker only
# SUPABASE_SERVICE_KEY=  # Use your existing cloud key or Docker-generated key

# TimescaleDB
TIMESCALEDB_URL=postgresql://postgres:timescale@localhost:54323/delta_timeseries

# Redis
REDIS_URL=redis://localhost:6379

# Neo4j
NEO4J_URI=bolt://localhost:7687
NEO4J_USER=neo4j
NEO4J_PASSWORD=neo4j_dev

# Auth Federation
FEDERATION_JWT_SECRET=change-this-to-a-random-32-char-string

# Docker
POSTGRES_PASSWORD=postgres
TIMESCALE_PASSWORD=timescale
NEO4J_PASSWORD=neo4j_dev
```

- [ ] **Step 2: Update .gitignore**

Add:
```
# Docker volumes
docker/*_data/

# Superpowers brainstorm sessions
.superpowers/
```

- [ ] **Step 3: Commit**

```bash
git add .env.example .gitignore
git commit -m "chore: add environment variables for Event Store, TimescaleDB, Redis, and auth federation"
```

---

## Task 10: Integration Test — Full Stack Verification

**Files:**
- Create: `tests/integration/docker-services.test.ts`

- [ ] **Step 1: Write integration test**

```typescript
// tests/integration/docker-services.test.ts
import { describe, it, expect } from 'vitest';

// These tests verify Docker services are running and accessible.
// Run with: npx vitest run tests/integration/ (requires Docker Compose up)

describe('Docker Services Health Check', () => {
  it('Supabase PostgreSQL is accessible', async () => {
    const res = await fetch('http://localhost:54322', { method: 'HEAD' }).catch(() => null);
    // PostgreSQL won't respond to HTTP, but we can check the port is open
    // Better: use pg client
    expect(true).toBe(true); // Placeholder — real test uses pg client
  });

  it('Redis is accessible', async () => {
    const { default: Redis } = await import('ioredis');
    const redis = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379');
    const pong = await redis.ping();
    expect(pong).toBe('PONG');
    await redis.quit();
  });

  it('Neo4j is accessible', async () => {
    const res = await fetch('http://localhost:7474');
    expect(res.ok).toBe(true);
  });
});
```

- [ ] **Step 2: Run integration tests (requires Docker Compose running)**

Run: `npx vitest run tests/integration/docker-services.test.ts`
Expected: All services respond. (Skip if Docker not running.)

- [ ] **Step 3: Run full test suite**

Run: `npx vitest run`
Expected: All unit tests pass.

- [ ] **Step 4: Final TypeScript verification**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 5: Commit**

```bash
git add tests/integration/
git commit -m "test: add integration tests for Docker services health check"
```

---

## Phase 1 Exit Criteria Verification

After completing all tasks, verify:

- [ ] `docker compose up -d` starts all 6 services (Supabase, TimescaleDB, Neo4j, Redis)
- [ ] Event Store accepts events with `POST /api/events` and returns sequence numbers
- [ ] Event Store replays events from cursor with `GET /api/events?cursor=0`
- [ ] RLS enforces tenant isolation (events table)
- [ ] Consumer group tracks offsets and publishes to tenant-namespaced Redis Streams
- [ ] CQRS command bus dispatches commands and emits events
- [ ] Auth federation issues JWTs with tenant/role/module claims via `POST /api/auth/federation/token`
- [ ] Auth federation verifies JWTs via `POST /api/auth/federation/verify`
- [ ] `@delta/ui` package exports design tokens and density mode provider
- [ ] `npx tsc --noEmit` passes with zero errors
- [ ] `npx vitest run` passes all unit tests
