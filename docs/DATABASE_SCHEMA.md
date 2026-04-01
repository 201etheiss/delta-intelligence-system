# Delta Intelligence — Database Schema

## Decision: Supabase Postgres + pgvector

Full-stack Supabase with vector embeddings for semantic search across all user interactions.

**Why Supabase Postgres (not Neo4j):**
- Cross-system entity relationships handled by 71 trained SQL joins
- pgvector extension gives vector similarity search without separate infra
- RLS (row-level security) for multi-tenant data isolation
- Same platform as Equipment Tracker (operational familiarity)

**pgvector enables:**
- Semantic search across ALL conversations (not just keyword matching)
- "Find conversations similar to this one" across users
- Cross-user knowledge sharing: if one user asked about a topic, surface that insight to others
- Smart query routing: match new questions to previously successful query patterns
- Document similarity: find related uploaded documents

## Supabase Project

Use the existing Delta Intelligence Supabase project or create a new one.
Connection: adapter-pg with SSL (same pattern as Equipment Tracker).

---

## Tables

### users
```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'readonly' CHECK (role IN ('admin','accounting','sales','operations','readonly')),
  custom_role TEXT,
  is_active BOOLEAN DEFAULT true,
  last_active_at TIMESTAMPTZ,
  query_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
```

### usage_log
```sql
CREATE TABLE usage_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  model TEXT NOT NULL,
  input_tokens INTEGER NOT NULL,
  output_tokens INTEGER NOT NULL,
  estimated_cost NUMERIC(10,6),
  endpoints TEXT[],
  workspace_id TEXT,
  query_preview TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_usage_user ON usage_log(user_email);
CREATE INDEX idx_usage_model ON usage_log(model);
CREATE INDEX idx_usage_created ON usage_log(created_at DESC);
```

### conversations
```sql
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  title TEXT,
  workspace_id TEXT,
  message_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_conv_user ON conversations(user_email);
CREATE INDEX idx_conv_updated ON conversations(updated_at DESC);

CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user','assistant')),
  content TEXT NOT NULL,
  model TEXT,
  input_tokens INTEGER,
  output_tokens INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_msg_conv ON messages(conversation_id);
CREATE INDEX idx_msg_content_search ON messages USING gin(to_tsvector('english', content));
```

### feedback
```sql
CREATE TABLE feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID,
  conversation_id UUID,
  user_email TEXT NOT NULL,
  rating TEXT NOT NULL CHECK (rating IN ('up','down')),
  comment TEXT,
  model TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_feedback_model ON feedback(model);
```

### shared_results
```sql
CREATE TABLE shared_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  shared_by TEXT NOT NULL,
  visibility TEXT DEFAULT 'link' CHECK (visibility IN ('link','team','role')),
  allowed_roles TEXT[],
  view_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shared_result_id UUID REFERENCES shared_results(id) ON DELETE CASCADE,
  author TEXT NOT NULL,
  text TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### workspaces
```sql
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  long_description TEXT,
  color TEXT DEFAULT '#FF5C00',
  icon TEXT DEFAULT 'chat',
  category TEXT DEFAULT 'custom',
  tags TEXT[],
  data_sources TEXT[],
  system_prompt TEXT,
  preferred_model TEXT DEFAULT 'auto',
  temperature NUMERIC(3,2) DEFAULT 0.7,
  response_format TEXT,
  sample_prompts TEXT[],
  visibility TEXT DEFAULT 'private',
  created_by TEXT NOT NULL,
  usage_count INTEGER DEFAULT 0,
  rating NUMERIC(3,2),
  rating_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### automations
```sql
CREATE TABLE automations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  enabled BOOLEAN DEFAULT false,
  trigger_type TEXT NOT NULL,
  trigger_config JSONB,
  conditions JSONB DEFAULT '[]',
  actions JSONB NOT NULL,
  created_by TEXT NOT NULL,
  last_run_at TIMESTAMPTZ,
  last_run_status TEXT,
  run_count INTEGER DEFAULT 0,
  error_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE automation_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id TEXT REFERENCES automations(id),
  status TEXT NOT NULL CHECK (status IN ('success','error')),
  trigger_type TEXT,
  actions JSONB,
  started_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX idx_runs_automation ON automation_runs(automation_id);
CREATE INDEX idx_runs_started ON automation_runs(started_at DESC);
```

### notifications
```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT,
  title TEXT NOT NULL,
  body TEXT,
  type TEXT DEFAULT 'info',
  read BOOLEAN DEFAULT false,
  action_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_notif_user ON notifications(user_email);
CREATE INDEX idx_notif_read ON notifications(read) WHERE read = false;
```

### assistants
```sql
CREATE TABLE assistant_learnings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role TEXT NOT NULL,
  learning TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE reminders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  role TEXT NOT NULL,
  message TEXT NOT NULL,
  due_at TIMESTAMPTZ NOT NULL,
  recurring TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','sent','dismissed')),
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_reminders_due ON reminders(due_at) WHERE status = 'pending';
```

### favorites
```sql
CREATE TABLE favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_email TEXT NOT NULL,
  query TEXT NOT NULL,
  title TEXT,
  category TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_fav_user ON favorites(user_email);
```

### glossary
```sql
CREATE TABLE glossary (
  id TEXT PRIMARY KEY,
  term TEXT NOT NULL,
  definition TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  aliases TEXT[],
  examples TEXT[],
  updated_by TEXT,
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_glossary_term ON glossary(term);
CREATE INDEX idx_glossary_category ON glossary(category);
```

### alert_rules
```sql
CREATE TABLE alert_rules (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  metric TEXT,
  operator TEXT,
  threshold NUMERIC,
  channel TEXT DEFAULT 'email',
  recipients TEXT[],
  role TEXT,
  enabled BOOLEAN DEFAULT false,
  last_triggered_at TIMESTAMPTZ,
  snoozed_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### integrations
```sql
CREATE TABLE integrations (
  id TEXT PRIMARY KEY,
  config JSONB DEFAULT '{}',
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### dashboards
```sql
CREATE TABLE dashboards (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  widgets JSONB NOT NULL DEFAULT '[]',
  created_by TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  visibility TEXT DEFAULT 'private',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

---

## Vector / Embedding Tables (pgvector)

### Enable pgvector
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### embeddings (core vector store)
```sql
CREATE TABLE embeddings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content TEXT NOT NULL,
  content_type TEXT NOT NULL CHECK (content_type IN ('message','document','query_pattern','glossary','report','workspace_prompt')),
  embedding vector(1536),         -- OpenAI ada-002 dimension (or 768 for smaller models)
  metadata JSONB DEFAULT '{}',    -- flexible: user_email, conversation_id, model, role, etc.
  source_id TEXT,                 -- ID of the source record (message ID, document ID, etc.)
  user_email TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_embeddings_vector ON embeddings USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_embeddings_type ON embeddings(content_type);
CREATE INDEX idx_embeddings_user ON embeddings(user_email);
CREATE INDEX idx_embeddings_source ON embeddings(source_id);
```

### Semantic Search Functions
```sql
-- Find similar content across all users (cross-user knowledge)
CREATE OR REPLACE FUNCTION search_similar(
  query_embedding vector(1536),
  match_count INT DEFAULT 10,
  match_threshold FLOAT DEFAULT 0.7,
  filter_type TEXT DEFAULT NULL,
  filter_user TEXT DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content,
    e.content_type,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE (filter_type IS NULL OR e.content_type = filter_type)
    AND (filter_user IS NULL OR e.user_email = filter_user)
    AND 1 - (e.embedding <=> query_embedding) > match_threshold
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Find cross-user insights (team knowledge sharing)
CREATE OR REPLACE FUNCTION search_team_knowledge(
  query_embedding vector(1536),
  match_count INT DEFAULT 5
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  content_type TEXT,
  user_email TEXT,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.id,
    e.content,
    e.content_type,
    e.user_email,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE e.content_type IN ('message', 'query_pattern', 'report')
    AND 1 - (e.embedding <=> query_embedding) > 0.75
  ORDER BY e.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Match new queries to successful historical patterns
CREATE OR REPLACE FUNCTION match_query_pattern(
  query_embedding vector(1536)
)
RETURNS TABLE (
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    e.content,
    e.metadata,
    1 - (e.embedding <=> query_embedding) AS similarity
  FROM embeddings e
  WHERE e.content_type = 'query_pattern'
    AND 1 - (e.embedding <=> query_embedding) > 0.8
  ORDER BY e.embedding <=> query_embedding
  LIMIT 3;
END;
$$;
```

### query_patterns (learned successful queries)
```sql
CREATE TABLE query_patterns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  query TEXT NOT NULL,                    -- the user's question
  endpoints_used TEXT[],                  -- which gateway endpoints answered it
  sql_used TEXT[],                        -- SQL queries that worked
  model TEXT,                             -- which model answered it
  feedback_score NUMERIC(3,2),            -- average feedback rating
  usage_count INTEGER DEFAULT 1,          -- how many times this pattern matched
  embedding vector(1536),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_qp_vector ON query_patterns USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_qp_usage ON query_patterns(usage_count DESC);
```

### document_chunks (for RAG over uploaded documents)
```sql
CREATE TABLE document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),
  user_email TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_doc_vector ON document_chunks USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_doc_name ON document_chunks(document_name);
CREATE INDEX idx_doc_user ON document_chunks(user_email);
```

---

## Cross-User Knowledge Flow

```
User A asks: "What are current rack prices for dyed diesel in LA?"
  → AI answers with vRackPrice data
  → Response embedded and stored with metadata
  → Feedback: thumbs up (good answer)
  → Pattern saved: query → endpoints used → SQL → model

User B asks: "What's the LA diesel price?"
  → New query embedded
  → search_similar() finds User A's successful pattern (0.92 similarity)
  → System routes to same endpoints + SQL that worked for User A
  → Faster, cheaper, more accurate response

User C searches shared results
  → search_team_knowledge() surfaces User A's insight
  → User C sees the answer without asking the question
```

---

## Migration Strategy

1. Create Supabase project (or reuse existing Delta Intelligence project: bnjenbparvqusodiakdh)
2. Enable pgvector extension
3. Run all CREATE TABLE statements
4. Run CREATE FUNCTION statements for semantic search
5. Seed glossary, workspaces, automations, alert rules from current JSON files
6. Update each lib module to use Supabase client instead of JSON file read/write
7. Add embedding pipeline: after each successful chat response, embed and store
8. Keep schema-registry.json local (it's a cache, not persistent data)
9. Move conversations from localStorage to server (enables cross-device + cross-user search)

## Row-Level Security (RLS)

```sql
-- Users can only see their own data
ALTER TABLE usage_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY usage_own ON usage_log FOR SELECT USING (user_email = auth.email());

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
CREATE POLICY conv_own ON conversations FOR SELECT USING (user_email = auth.email());

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notif_own ON notifications FOR ALL USING (user_email = auth.email());

ALTER TABLE reminders ENABLE ROW LEVEL SECURITY;
CREATE POLICY remind_own ON reminders FOR ALL USING (user_email = auth.email());

-- Shared results visible based on visibility
ALTER TABLE shared_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY shared_view ON shared_results FOR SELECT USING (
  visibility = 'link' OR
  visibility = 'team' OR
  shared_by = auth.email()
);
```

## Estimated Size (first year)

| Table | Rows/year | Storage |
|-------|----------|---------|
| usage_log | ~100K | ~50MB |
| messages | ~500K | ~200MB |
| feedback | ~50K | ~10MB |
| notifications | ~50K (capped) | ~10MB |
| All config tables | <1K each | <1MB |
| **Total** | | **~270MB** |

Well within Supabase free tier (500MB). Pro tier ($25/mo) gives 8GB.
