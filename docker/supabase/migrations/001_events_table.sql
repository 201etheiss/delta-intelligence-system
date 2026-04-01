-- Event Store table
-- Central nervous system of Delta Intelligence DataOS
-- Immutable append-only log — events are never deleted or mutated

CREATE TABLE IF NOT EXISTS events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL,              -- domain.action pattern: order.created, feed.ingested
  tenant_id TEXT NOT NULL DEFAULT 'delta360',
  actor_id TEXT,                   -- user email or system identifier
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  version INTEGER NOT NULL DEFAULT 1,
  sequence_number BIGSERIAL,       -- monotonic, used for cursor-based replay
  payload JSONB NOT NULL DEFAULT '{}',
  metadata JSONB NOT NULL DEFAULT '{}'
);

CREATE INDEX idx_events_type ON events(type);
CREATE INDEX idx_events_tenant ON events(tenant_id);
CREATE INDEX idx_events_sequence ON events(sequence_number);
CREATE INDEX idx_events_timestamp ON events(timestamp);

-- RLS for tenant isolation
ALTER TABLE events ENABLE ROW LEVEL SECURITY;
CREATE POLICY tenant_isolation ON events
  USING (tenant_id = current_setting('app.tenant_id', true));
