-- Consumer offset tracking for at-least-once delivery
-- Each consumer group stores its last-processed sequence_number

CREATE TABLE IF NOT EXISTS consumer_offsets (
  consumer_group TEXT NOT NULL,
  last_sequence_number BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consumer_group)
);
