/**
 * Supabase Client for Delta Intelligence
 *
 * Handles connection to Supabase Postgres + pgvector for:
 * - Multi-user data persistence (replaces JSON files)
 * - Vector embeddings for semantic search
 * - Cross-user knowledge sharing
 * - Query pattern learning
 *
 * Setup:
 * 1. Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local
 * 2. Run migrations from docs/DATABASE_SCHEMA.md
 * 3. Enable pgvector extension in Supabase dashboard
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabase) return supabase;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Supabase not configured — fall back to JSON file storage
    return null;
  }

  supabase = createClient(url, key, {
    auth: { persistSession: false },
    db: { schema: 'public' },
  });

  return supabase;
}

/**
 * Check if Supabase is configured and reachable
 */
export async function isSupabaseReady(): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  try {
    const { error } = await client.from('users').select('id').limit(1);
    return !error;
  } catch {
    return false;
  }
}

/**
 * Generate an embedding vector using OpenAI's API
 * Falls back to null if OPENAI_API_KEY is not set
 */
export async function generateEmbedding(text: string): Promise<number[] | null> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'text-embedding-3-small',
        input: text.substring(0, 8000), // cap input length
      }),
    });

    if (!res.ok) return null;

    const data = await res.json() as { data: Array<{ embedding: number[] }> };
    return data.data[0]?.embedding ?? null;
  } catch {
    return null;
  }
}

/**
 * Store an embedding in the vector table
 */
export async function storeEmbedding(params: {
  content: string;
  contentType: 'message' | 'document' | 'query_pattern' | 'glossary' | 'report' | 'workspace_prompt';
  metadata?: Record<string, unknown>;
  sourceId?: string;
  userEmail?: string;
}): Promise<boolean> {
  const client = getSupabase();
  if (!client) return false;

  const embedding = await generateEmbedding(params.content);
  if (!embedding) return false;

  const { error } = await client.from('embeddings').insert({
    content: params.content.substring(0, 10000),
    content_type: params.contentType,
    embedding,
    metadata: params.metadata ?? {},
    source_id: params.sourceId,
    user_email: params.userEmail,
  });

  return !error;
}

/**
 * Search for similar content using vector similarity
 */
export async function searchSimilar(params: {
  query: string;
  matchCount?: number;
  threshold?: number;
  contentType?: string;
  userEmail?: string;
}): Promise<Array<{ id: string; content: string; contentType: string; metadata: Record<string, unknown>; similarity: number }>> {
  const client = getSupabase();
  if (!client) return [];

  const embedding = await generateEmbedding(params.query);
  if (!embedding) return [];

  const { data, error } = await client.rpc('search_similar', {
    query_embedding: embedding,
    match_count: params.matchCount ?? 10,
    match_threshold: params.threshold ?? 0.7,
    filter_type: params.contentType ?? null,
    filter_user: params.userEmail ?? null,
  });

  if (error || !data) return [];
  return data as Array<{ id: string; content: string; contentType: string; metadata: Record<string, unknown>; similarity: number }>;
}

/**
 * Search across all users' knowledge (team-level)
 */
export async function searchTeamKnowledge(query: string, matchCount: number = 5): Promise<Array<{ content: string; userEmail: string; similarity: number }>> {
  const client = getSupabase();
  if (!client) return [];

  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  const { data, error } = await client.rpc('search_team_knowledge', {
    query_embedding: embedding,
    match_count: matchCount,
  });

  if (error || !data) return [];
  return data as Array<{ content: string; userEmail: string; similarity: number }>;
}

/**
 * Find matching query patterns from historical successful queries
 */
export async function matchQueryPattern(query: string): Promise<Array<{ content: string; metadata: Record<string, unknown>; similarity: number }>> {
  const client = getSupabase();
  if (!client) return [];

  const embedding = await generateEmbedding(query);
  if (!embedding) return [];

  const { data, error } = await client.rpc('match_query_pattern', {
    query_embedding: embedding,
  });

  if (error || !data) return [];
  return data as Array<{ content: string; metadata: Record<string, unknown>; similarity: number }>;
}
