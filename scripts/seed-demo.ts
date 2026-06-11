/**
 * Load the in-app demo fixtures (~40 providers + plans) into Supabase, so the
 * LIVE data path (mode: "live") can be exercised end-to-end before running the
 * real, hours-long syncs. Idempotent.
 *
 *   npm run seed:demo            # upsert fixtures into Supabase
 *   npm run seed:demo -- --dry-run
 *
 * Carries the fixtures' last_seen_at dates verbatim, so the stale-listing UI
 * is exercised in live mode too.
 */
import { fixturePlans } from '../src/lib/fixtures/plans';
import { fixtureProviders } from '../src/lib/fixtures/providers';
import { specialties } from '../src/lib/specialties';
import { chunkedUpsert, finishSyncRun, getDb, startSyncRun } from './lib/db';

const flag = (name: string) => process.argv.includes(`--${name}`);

const codeFor = (key: string) =>
  specialties.find((s) => s.key === key)?.taxonomyCodes[0] ?? null;

async function main() {
  const now = new Date().toISOString();

  const planRows = fixturePlans.map((p) => ({
    plan_id: p.planId,
    payer: p.payer,
    plan_name: p.planName,
    plan_type: p.planType,
    counties: p.counties,
    contract_year: 2026,
  }));

  const providerRows = fixtureProviders.map((p) => ({
    npi: p.npi,
    name: p.name,
    specialty_key: p.specialty,
    specialty_code: codeFor(p.specialty),
    gender: p.gender,
    languages: p.languages,
    address: p.address,
    county: p.county,
    lat: p.lat,
    lng: p.lng,
    phone: p.phone,
    wheelchair_accessible: p.wheelchairAccessible,
    telehealth: p.telehealth,
    // Mark enriched so a later sync:nppes run skips these demo NPIs.
    nppes_enriched_at: now,
  }));

  const linkRows = fixtureProviders.flatMap((p) =>
    p.plans.map((link) => ({
      npi: p.npi,
      plan_id: link.planId,
      accepting_new_patients: link.acceptingNewPatients,
      source: 'demo-seed',
      last_seen_at: new Date(link.lastSeenAt).toISOString(),
    })),
  );

  console.log(
    `Seeding ${planRows.length} plans, ${providerRows.length} providers, ${linkRows.length} plan links.`,
  );
  if (flag('dry-run')) {
    console.log('Dry run — sample:', providerRows[0], linkRows[0]);
    return;
  }

  const db = getDb();
  const runId = await startSyncRun(db, 'demo-seed');
  try {
    await chunkedUpsert(db, 'plans', planRows, 'plan_id');
    await chunkedUpsert(db, 'providers', providerRows, 'npi');
    const links = await chunkedUpsert(db, 'provider_plan', linkRows, 'npi,plan_id');
    await finishSyncRun(db, runId, {
      status: 'succeeded',
      rowsUpserted: links,
      notes: 'demo fixtures (not real providers)',
    });
    console.log(
      '✓ seeded. The live app now serves demo data WITHOUT the demo banner — ' +
        'remember this is fictional. Run real syncs to replace it.',
    );
  } catch (error) {
    await finishSyncRun(db, runId, {
      status: 'failed',
      rowsUpserted: 0,
      notes: String(error),
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
