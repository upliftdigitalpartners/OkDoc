import { NextResponse } from 'next/server';
import { getServiceClient, isMockMode } from '@/lib/supabase';

// Always live — never cache a health check.
export const dynamic = 'force-dynamic';

/**
 * Lightweight health probe for uptime monitors. Reports whether the app is
 * serving demo (fixture) or live (Supabase) data, and in live mode confirms
 * the database answers. Returns no PII and no configuration values.
 */
export async function GET() {
  const time = new Date().toISOString();

  if (isMockMode()) {
    return NextResponse.json(
      { status: 'ok', mode: 'demo', time },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  }

  try {
    const db = getServiceClient();
    const { error } = await db
      .from('plans')
      .select('plan_id', { count: 'exact', head: true })
      .limit(1);
    if (error) throw new Error(error.message);
    return NextResponse.json(
      { status: 'ok', mode: 'live', time },
      { headers: { 'Cache-Control': 'no-store' } },
    );
  } catch {
    // Don't echo the DB error (could leak host/table details).
    return NextResponse.json(
      { status: 'degraded', mode: 'live', time },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
