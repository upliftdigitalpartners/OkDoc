import { fixturePlans, getFixturePlan } from './fixtures/plans';
import { fixtureProviders } from './fixtures/providers';
import { countyCentroids, haversineMiles, zipToCounty } from './geo';
import type { WizardParams } from './schemas';
import type { SpecialtyKey } from './specialties';
import { getServiceClient, isMockMode } from './supabase';
import type {
  County,
  DoctorResult,
  Plan,
  Provider,
  ProviderPlanLink,
  SearchOutcome,
} from './types';

/** A listing not re-confirmed by a sync within this window is flagged stale. */
export const STALE_AFTER_DAYS = 45;

const MAX_RESULTS = 10;
/** Pool pulled from the DB before distance ranking happens in JS. */
const DB_POOL_SIZE = 1000;

export async function getPlans(county?: County): Promise<Plan[]> {
  if (isMockMode()) {
    return county
      ? fixturePlans.filter((p) => p.counties.includes(county))
      : fixturePlans;
  }
  try {
    const db = getServiceClient();
    let query = db
      .from('plans')
      .select('plan_id, payer, plan_name, plan_type, counties')
      .order('payer')
      .order('plan_name');
    if (county) query = query.contains('counties', [county]);
    const { data, error } = await query;
    if (error) throw new Error(error.message);
    return (data ?? []).map((row) => ({
      planId: row.plan_id,
      payer: row.payer,
      planName: row.plan_name,
      planType: row.plan_type ?? '',
      counties: (row.counties ?? []) as County[],
    }));
  } catch (error) {
    // Degrade, never crash a page on bad data or a down DB.
    console.error('getPlans failed:', error);
    return [];
  }
}

export async function searchDoctors(params: WizardParams): Promise<SearchOutcome> {
  if (isMockMode()) {
    return { mode: 'demo', results: searchFixtures(params) };
  }
  try {
    return { mode: 'live', results: await searchSupabase(params) };
  } catch (error) {
    console.error('searchDoctors failed:', error);
    return { mode: 'live', results: [] };
  }
}

// ——— shared ranking helpers ———

function originOf(params: WizardParams) {
  const county =
    params.county ?? (params.zip ? zipToCounty(params.zip) : null);
  return county ? countyCentroids[county] : null;
}

function staleDays(lastSeenAt: string, now: number): number {
  return (now - new Date(lastSeenAt).getTime()) / (24 * 60 * 60 * 1000);
}

/** Near and recently-confirmed first; staleness costs ~1 mile per month. */
function rank(results: DoctorResult[], now: number): DoctorResult[] {
  const score = (r: DoctorResult) =>
    (r.distanceMiles ?? 50) + staleDays(r.lastSeenAt, now) / 30;
  return results.sort((a, b) => score(a) - score(b)).slice(0, MAX_RESULTS);
}

// ——— live path (Supabase) ———

interface ProviderRow {
  npi: string;
  name: string;
  specialty_key: string | null;
  gender: 'f' | 'm' | null;
  languages: string[] | null;
  address: string | null;
  county: string | null;
  lat: number | null;
  lng: number | null;
  phone: string | null;
  wheelchair_accessible: boolean | null;
  telehealth: boolean | null;
}

interface LinkRow {
  npi: string;
  plan_id: string;
  accepting_new_patients: boolean | null;
  source: string;
  last_seen_at: string;
}

async function searchSupabase(params: WizardParams): Promise<DoctorResult[]> {
  const db = getServiceClient();
  const origin = originOf(params);
  const now = Date.now();

  let query = db
    .from('provider_plan')
    .select(
      'npi, plan_id, accepting_new_patients, source, last_seen_at, providers!inner(*)',
    )
    .limit(DB_POOL_SIZE);

  if (params.plan) query = query.eq('plan_id', params.plan);
  if (params.newpt) query = query.eq('accepting_new_patients', true);
  if (params.specialty) query = query.eq('providers.specialty_key', params.specialty);
  if (params.lang) query = query.contains('providers.languages', [params.lang]);
  if (params.gender) query = query.eq('providers.gender', params.gender);
  if (params.tele) query = query.eq('providers.telehealth', true);
  if (params.wheel) query = query.eq('providers.wheelchair_accessible', true);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  // Plan display names for the trust label + confirm script.
  const planIds = [...new Set((data ?? []).map((row) => row.plan_id))];
  const planNames = new Map<string, { payer: string; planName: string }>();
  if (planIds.length > 0) {
    const { data: planRows } = await db
      .from('plans')
      .select('plan_id, payer, plan_name')
      .in('plan_id', planIds);
    for (const p of planRows ?? []) {
      planNames.set(p.plan_id, { payer: p.payer, planName: p.plan_name });
    }
  }

  const results: DoctorResult[] = [];
  for (const row of data ?? []) {
    const link = row as unknown as LinkRow;
    const provider = (
      Array.isArray(row.providers) ? row.providers[0] : row.providers
    ) as ProviderRow;
    if (!provider) continue;

    const distanceMiles =
      origin && provider.lat != null && provider.lng != null
        ? haversineMiles(origin, { lat: provider.lat, lng: provider.lng })
        : null;
    if (params.dist && distanceMiles !== null && distanceMiles > params.dist) {
      continue;
    }

    const plan = planNames.get(link.plan_id);
    results.push({
      npi: provider.npi,
      name: provider.name,
      specialty: (provider.specialty_key ?? 'primary-care') as SpecialtyKey,
      gender: provider.gender,
      languages: provider.languages ?? [],
      address: provider.address ?? '',
      phone: provider.phone ?? '',
      wheelchairAccessible: provider.wheelchair_accessible,
      telehealth: provider.telehealth,
      distanceMiles,
      payer: plan?.payer ?? link.source,
      planId: link.plan_id,
      planName: plan?.planName ?? link.plan_id,
      acceptingNewPatients: link.accepting_new_patients,
      lastSeenAt: link.last_seen_at,
      stale: staleDays(link.last_seen_at, now) > STALE_AFTER_DAYS,
    });
  }
  return rank(results, now);
}

// ——— mock path (fixtures) ———

function searchFixtures(params: WizardParams): DoctorResult[] {
  const origin = originOf(params);
  const now = Date.now();

  const results: DoctorResult[] = [];
  for (const provider of fixtureProviders) {
    if (params.specialty && provider.specialty !== params.specialty) continue;
    if (params.lang && !provider.languages.includes(params.lang)) continue;
    if (params.gender && provider.gender !== params.gender) continue;
    if (params.tele && provider.telehealth !== true) continue;
    if (params.wheel && provider.wheelchairAccessible !== true) continue;

    const link = pickLink(provider, params.plan);
    if (!link) continue;
    if (params.newpt && link.acceptingNewPatients !== true) continue;

    const distanceMiles = origin
      ? haversineMiles(origin, { lat: provider.lat, lng: provider.lng })
      : null;
    if (params.dist && distanceMiles !== null && distanceMiles > params.dist) {
      continue;
    }

    results.push({
      npi: provider.npi,
      name: provider.name,
      specialty: provider.specialty,
      gender: provider.gender,
      languages: provider.languages,
      address: provider.address,
      phone: provider.phone,
      wheelchairAccessible: provider.wheelchairAccessible,
      telehealth: provider.telehealth,
      distanceMiles,
      payer: link.source,
      planId: link.planId,
      planName: getFixturePlan(link.planId)?.planName ?? link.planId,
      acceptingNewPatients: link.acceptingNewPatients,
      lastSeenAt: link.lastSeenAt,
      stale: staleDays(link.lastSeenAt, now) > STALE_AFTER_DAYS,
    });
  }
  return rank(results, now);
}

function pickLink(
  provider: Provider,
  planId: string | undefined,
): ProviderPlanLink | null {
  if (planId) return provider.plans.find((l) => l.planId === planId) ?? null;
  // No plan chosen (deep link): show the most recently confirmed listing.
  return (
    [...provider.plans].sort((a, b) =>
      b.lastSeenAt.localeCompare(a.lastSeenAt),
    )[0] ?? null
  );
}
