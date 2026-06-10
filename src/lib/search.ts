import { fixturePlans, getFixturePlan } from './fixtures/plans';
import { fixtureProviders } from './fixtures/providers';
import { countyCentroids, haversineMiles, zipToCounty } from './geo';
import type { WizardParams } from './schemas';
import { isMockMode } from './supabase';
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

export async function getPlans(county?: County): Promise<Plan[]> {
  // Live path (Supabase) lands in slice 3; fixtures power mock mode.
  const plans = fixturePlans;
  return county ? plans.filter((p) => p.counties.includes(county)) : plans;
}

export async function searchDoctors(params: WizardParams): Promise<SearchOutcome> {
  // Live path (Supabase) lands in slice 3. Until then — and always when env
  // vars are missing — serve fixtures and let the UI show the demo banner.
  void isMockMode();
  return { mode: 'demo', results: searchFixtures(params) };
}

function searchFixtures(params: WizardParams): DoctorResult[] {
  const county = params.county ?? (params.zip ? zipToCounty(params.zip) : null);
  const origin = county ? countyCentroids[county] : null;
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

    const staleDays =
      (now - new Date(link.lastSeenAt).getTime()) / (24 * 60 * 60 * 1000);

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
      stale: staleDays > STALE_AFTER_DAYS,
    });
  }

  // Rank: near and recently-confirmed first. Staleness costs ~1 mile per
  // month since last sync; unknown distance sorts after known.
  const score = (r: DoctorResult) => {
    const dist = r.distanceMiles ?? 50;
    const staleDays =
      (now - new Date(r.lastSeenAt).getTime()) / (24 * 60 * 60 * 1000);
    return dist + staleDays / 30;
  };
  results.sort((a, b) => score(a) - score(b));
  return results.slice(0, MAX_RESULTS);
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
