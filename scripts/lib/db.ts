import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * CLI-side Supabase access. Unlike the app, the sync scripts REQUIRE env
 * vars — there is no mock mode for ingestion.
 */
export function getDb(): SupabaseClient {
  try {
    process.loadEnvFile('.env');
  } catch {
    // No .env file — rely on the ambient environment.
  }
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error(
      'SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required to run syncs.\n' +
        'Copy .env.example to .env and fill them in (Supabase → Settings → API).',
    );
    process.exit(1);
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function startSyncRun(
  db: SupabaseClient,
  source: string,
): Promise<number> {
  const { data, error } = await db
    .from('sync_runs')
    .insert({ source })
    .select('id')
    .single();
  if (error) throw new Error(`sync_runs insert failed: ${error.message}`);
  return data.id as number;
}

export async function finishSyncRun(
  db: SupabaseClient,
  id: number,
  outcome: { status: 'succeeded' | 'failed'; rowsUpserted: number; notes?: string },
): Promise<void> {
  const { error } = await db
    .from('sync_runs')
    .update({
      finished_at: new Date().toISOString(),
      status: outcome.status,
      rows_upserted: outcome.rowsUpserted,
      notes: outcome.notes ?? null,
    })
    .eq('id', id);
  if (error) console.error(`sync_runs update failed: ${error.message}`);
}

/** Upsert in chunks — Supabase rejects very large single payloads. */
export async function chunkedUpsert(
  db: SupabaseClient,
  table: string,
  rows: Record<string, unknown>[],
  onConflict: string,
  chunkSize = 500,
): Promise<number> {
  let upserted = 0;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await db.from(table).upsert(chunk, { onConflict });
    if (error) {
      throw new Error(
        `${table} upsert failed at rows ${i}–${i + chunk.length}: ${error.message}`,
      );
    }
    upserted += chunk.length;
  }
  return upserted;
}
