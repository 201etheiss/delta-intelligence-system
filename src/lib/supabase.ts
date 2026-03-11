import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY!;

/**
 * Browser-side Supabase client
 * Use this in client components and client-side operations
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/**
 * Server-side Supabase service client
 * Use this in API routes and server components for elevated permissions
 */
export const supabaseService = createClient(
  supabaseUrl,
  supabaseServiceKey
);

export default supabase;
