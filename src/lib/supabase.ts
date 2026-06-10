import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Server-side only — the service role key must never reach the client.
 * Mock mode: when env vars are missing, callers serve fixture data instead.
 */
export function isMockMode(): boolean {
  return !process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY;
}

let client: SupabaseClient | null = null;

export function getServiceClient(): SupabaseClient {
  if (isMockMode()) {
    throw new Error('Supabase env vars missing — check isMockMode() first');
  }
  client ??= createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } },
  );
  return client;
}
