/**
 * Sync one payer's Plan-Net directory into Supabase.
 *
 *   npm run sync:payer -- --payer=humana                 # all mapped plans
 *   npm run sync:payer -- --payer=humana --plan=H3533_027
 *   npm run sync:payer -- --payer=humana --dry-run       # fetch, no DB writes
 *   npm run sync:payer -- --payer=humana --discover="Gold Plus"
 *   npm run sync:payer -- --payer=humana --discover=H3533-027-000-2026
 *
 * Read docs/DATA_RECON.md before touching this. Some networks are national —
 * see notes in plan-network-map.json for expected runtimes.
 */
import { humanaAdapter } from '../src/ingestion/adapters/humana';
import type {
  DirectoryEntry,
  PayerAdapter,
  PayerMapConfig,
} from '../src/ingestion/adapters/types';
import planNetworkMap from '../src/ingestion/adapters/plan-network-map.json';
import { taxonomyToSpecialtyKey } from '../src/lib/specialties';
import { chunkedUpsert, finishSyncRun, getDb, startSyncRun } from './lib/db';

const ADAPTERS: Record<string, PayerAdapter> = {
  humana: humanaAdapter,
};

function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}
const flag = (name: string) => process.argv.includes(`--${name}`);

async function main() {
  const payerKey = arg('payer');
  const adapter = payerKey ? ADAPTERS[payerKey] : undefined;
  if (!adapter) {
    console.error(
      `Usage: npm run sync:payer -- --payer=<${Object.keys(ADAPTERS).join('|')}> [--plan=H..._...] [--dry-run] [--discover=query]`,
    );
    process.exit(1);
  }

  const discover = arg('discover');
  if (discover) {
    const plans = await adapter.discoverPlans(discover);
    for (const plan of plans) {
      console.log(`\n${plan.name}  [identifier: ${plan.identifier ?? '—'}]`);
      for (const n of plan.networks) console.log(`  network: ${n.id}  ${n.name}`);
    }
    if (plans.length === 0) console.log('No InsurancePlan matches.');
    return;
  }

  const config = (planNetworkMap as Record<string, unknown>)[
    adapter.source
  ] as PayerMapConfig;
  const planFilter = arg('plan');
  const mappings = config.plans.filter(
    (p) => !planFilter || p.planId === planFilter,
  );
  if (mappings.length === 0) {
    console.error(
      planFilter
        ? `No mapping for plan ${planFilter} in plan-network-map.json`
        : `No plans mapped for ${adapter.source} yet — see plan-network-map.json`,
    );
    process.exit(1);
  }

  const dryRun = flag('dry-run');
  // --specialty=207RC0000X limits the crawl to one NUCC code (testing /
  // incremental runs). Note: a partial run still bumps last_seen_at only
  // for the specialties it covered — fine, staleness is per-row.
  const taxonomyFilter = arg('specialty')?.split(',');
  const lastSeenAt = new Date().toISOString();

  // npi → provider row (first entry with an address wins; fields backfill)
  const providers = new Map<string, Record<string, unknown>>();
  // `${npi}|${planId}` → provider_plan row
  const links = new Map<string, Record<string, unknown>>();

  for (const mapping of mappings) {
    console.log(`\n▶ ${mapping.planId} ${mapping.planName}`);
    for (const networkId of mapping.networkIds) {
      let count = 0;
      for await (const entry of adapter.fetchNetworkEntries(networkId, taxonomyFilter)) {
        count++;
        upsertEntry(providers, entry);
        const key = `${entry.npi}|${mapping.planId}`;
        const existing = links.get(key);
        links.set(key, {
          npi: entry.npi,
          plan_id: mapping.planId,
          // A provider can appear at several locations with different
          // flags — "accepting somewhere" beats unknown beats no.
          accepting_new_patients:
            entry.acceptingNewPatients === true ||
            existing?.accepting_new_patients === true
              ? true
              : (entry.acceptingNewPatients ??
                existing?.accepting_new_patients ??
                null),
          source: adapter.source,
          last_seen_at: lastSeenAt,
        });
        if (count % 500 === 0) console.log(`  …${count} entries`);
      }
      console.log(`  network ${networkId.slice(0, 12)}…: ${count} NYC-metro entries`);
    }
  }

  console.log(
    `\nCollected ${providers.size} unique providers, ${links.size} plan links.`,
  );
  if (dryRun) {
    console.log('Dry run — sample rows:');
    console.log([...providers.values()].slice(0, 3));
    console.log([...links.values()].slice(0, 3));
    return;
  }

  const db = getDb();
  const runId = await startSyncRun(db, adapter.source);
  try {
    // ignoreDuplicates: payer data seeds new providers only — NPPES
    // enrichment (sync:nppes) owns updates to existing rows.
    const inserted = await chunkedUpsert(
      db,
      'providers',
      [...providers.values()],
      'npi',
      500,
      { ignoreDuplicates: true },
    );
    const linked = await chunkedUpsert(
      db,
      'provider_plan',
      [...links.values()],
      'npi,plan_id',
      500,
    );
    await finishSyncRun(db, runId, {
      status: 'succeeded',
      rowsUpserted: linked,
      notes: `${providers.size} providers seen (${inserted} upsert calls), ${links.size} links, plans: ${mappings.map((m) => m.planId).join(',')}`,
    });
    console.log('✓ sync complete. Run `npm run sync:nppes` to enrich new providers.');
  } catch (error) {
    await finishSyncRun(db, runId, {
      status: 'failed',
      rowsUpserted: 0,
      notes: String(error),
    });
    throw error;
  }
}

function upsertEntry(
  providers: Map<string, Record<string, unknown>>,
  entry: DirectoryEntry,
) {
  const existing = providers.get(entry.npi);
  const specialtyKey = entry.specialtyCode
    ? taxonomyToSpecialtyKey(entry.specialtyCode)
    : null;
  if (!existing) {
    if (!entry.name) return; // providers.name is NOT NULL; NPPES can't fix a row we can't insert
    providers.set(entry.npi, {
      npi: entry.npi,
      name: entry.name,
      specialty_key: specialtyKey,
      specialty_code: entry.specialtyCode,
      languages: entry.languages,
      address: entry.address,
      county: entry.county,
      lat: entry.lat,
      lng: entry.lng,
      phone: entry.phone,
    });
    return;
  }
  // Backfill blanks; merge languages.
  existing.specialty_key ??= specialtyKey;
  existing.specialty_code ??= entry.specialtyCode;
  existing.address ??= entry.address;
  existing.county ??= entry.county;
  existing.lat ??= entry.lat;
  existing.lng ??= entry.lng;
  existing.phone ??= entry.phone;
  existing.languages = [
    ...new Set([...(existing.languages as string[]), ...entry.languages]),
  ];
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
