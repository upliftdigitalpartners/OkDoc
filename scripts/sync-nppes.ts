/**
 * Enrich providers from the NPPES NPI Registry (and geocode any rows still
 * missing lat/lng via the free Census geocoder).
 *
 *   npm run sync:nppes                  # enrich rows where nppes_enriched_at is null
 *   npm run sync:nppes -- --limit=200   # cap this run
 *   npm run sync:nppes -- --all         # re-enrich everything
 *   npm run sync:nppes -- --npi=1306073978 --dry-run   # test one lookup, no DB
 *
 * NPPES API notes (verified, docs/DATA_RECON.md): field is `sex` not
 * `gender`; "--" placeholder strings; addresses[].address_purpose
 * LOCATION vs MAILING; no auth, no documented rate limit — stay polite.
 *
 * Policy: NPPES FILLS GAPS, it never overwrites payer-directory fields.
 * Verified example (1306073978): Humana lists the doctor's real NY office,
 * NPPES still has his out-of-state training address and a "Student"
 * taxonomy. The payer directory is plan-specific truth for location and
 * specialty; NPPES contributes name/gender/etc. only where we have nothing.
 */
import { taxonomyToSpecialtyKey } from '../src/lib/specialties';
import { zipToCounty } from '../src/lib/geo';
import { finishSyncRun, getDb, startSyncRun } from './lib/db';

const NPPES = 'https://npiregistry.cms.hhs.gov/api/?version=2.1';
const CENSUS =
  'https://geocoding.geo.census.gov/geocoder/locations/onelineaddress';
const DELAY_MS = 120;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const flag = (name: string) => process.argv.includes(`--${name}`);
function arg(name: string): string | undefined {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit?.slice(name.length + 3);
}

const clean = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() && v.trim() !== '--' ? v.trim() : null;

interface Enrichment {
  name?: string;
  gender?: 'f' | 'm';
  specialty_code?: string;
  specialty_key?: string;
  address?: string;
  county?: string | null;
  phone?: string;
  zip?: string;
}

async function lookupNpi(npi: string): Promise<Enrichment | null> {
  const res = await fetch(`${NPPES}&number=${npi}`, {
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`NPPES HTTP ${res.status} for ${npi}`);
  const data = (await res.json()) as {
    result_count: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    results?: any[];
  };
  const result = data.results?.[0];
  if (data.result_count !== 1 || !result) return null;

  const out: Enrichment = {};
  const basic = result.basic ?? {};
  if (result.enumeration_type === 'NPI-1') {
    const first = clean(basic.first_name);
    const last = clean(basic.last_name);
    const credential = clean(basic.credential)?.replace(/\./g, '');
    if (first && last) {
      out.name = `${title(first)} ${title(last)}${credential ? `, ${credential}` : ''}`;
    }
    const sex = clean(basic.sex)?.toUpperCase();
    if (sex === 'F') out.gender = 'f';
    if (sex === 'M') out.gender = 'm';
  } else if (clean(basic.organization_name)) {
    out.name = title(clean(basic.organization_name)!);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const primaryTaxonomy = (result.taxonomies ?? []).find((t: any) => t.primary);
  const code = clean(primaryTaxonomy?.code);
  if (code) {
    out.specialty_code = code;
    const key = taxonomyToSpecialtyKey(code);
    if (key) out.specialty_key = key;
  }

  const loc = (result.addresses ?? []).find(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (a: any) => a.address_purpose === 'LOCATION',
  );
  if (loc) {
    const zip = String(loc.postal_code ?? '').slice(0, 5);
    const line = [clean(loc.address_1), clean(loc.address_2)]
      .filter(Boolean)
      .join(', ');
    if (line && clean(loc.city)) {
      out.address = `${title(line)}, ${title(clean(loc.city)!)}, ${loc.state} ${zip}`;
    }
    if (zip) {
      out.zip = zip;
      out.county = zipToCounty(zip);
    }
    const phone = clean(loc.telephone_number)?.replace(/\D/g, '');
    if (phone?.length === 10) out.phone = phone;
  }
  return out;
}

function title(s: string): string {
  return s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
}

async function geocode(address: string): Promise<{ lat: number; lng: number } | null> {
  const url = `${CENSUS}?address=${encodeURIComponent(address)}&benchmark=Public_AR_Current&format=json`;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(30_000) });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      result?: { addressMatches?: { coordinates: { x: number; y: number } }[] };
    };
    const match = data.result?.addressMatches?.[0];
    return match ? { lat: match.coordinates.y, lng: match.coordinates.x } : null;
  } catch {
    return null;
  }
}

async function main() {
  const singleNpi = arg('npi');
  if (singleNpi && flag('dry-run')) {
    console.log(await lookupNpi(singleNpi));
    return;
  }

  const db = getDb();
  const limit = Number(arg('limit') ?? 10_000);
  let query = db
    .from('providers')
    .select('npi, name, gender, specialty_key, specialty_code, address, county, phone, lat')
    .order('npi')
    .limit(limit);
  if (!flag('all')) query = query.is('nppes_enriched_at', null);
  if (singleNpi) query = query.eq('npi', singleNpi);
  const { data: pending, error } = await query;
  if (error) throw new Error(error.message);
  if (!pending?.length) {
    console.log('Nothing to enrich.');
    return;
  }
  console.log(`Enriching ${pending.length} providers…`);

  const runId = await startSyncRun(db, 'nppes');
  let updated = 0;
  let missing = 0;
  try {
    for (const row of pending) {
      const enrichment = await lookupNpi(row.npi);
      await sleep(DELAY_MS);
      const update: Record<string, unknown> = {
        nppes_enriched_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      if (enrichment) {
        // Fill gaps only — the payer directory owns whatever it provided.
        if (row.name == null && enrichment.name) update.name = enrichment.name;
        if (row.gender == null && enrichment.gender) update.gender = enrichment.gender;
        if (row.specialty_key == null && enrichment.specialty_key) {
          update.specialty_key = enrichment.specialty_key;
          update.specialty_code = enrichment.specialty_code;
        }
        if (row.address == null && enrichment.address) update.address = enrichment.address;
        if (row.county == null && enrichment.county) update.county = enrichment.county;
        if (row.phone == null && enrichment.phone) update.phone = enrichment.phone;
        // Geocode only when the payer didn't give coordinates.
        const addressForGeo = (row.address ?? enrichment.address) as string | undefined;
        if (row.lat == null && addressForGeo) {
          const coords = await geocode(addressForGeo);
          if (coords) Object.assign(update, coords);
          await sleep(DELAY_MS);
        }
      } else {
        missing++;
      }
      const { error: upErr } = await db
        .from('providers')
        .update(update)
        .eq('npi', row.npi);
      if (upErr) throw new Error(`update ${row.npi}: ${upErr.message}`);
      updated++;
      if (updated % 50 === 0) console.log(`  …${updated}/${pending.length}`);
    }
    await finishSyncRun(db, runId, {
      status: 'succeeded',
      rowsUpserted: updated,
      notes: `${missing} NPIs not found in NPPES`,
    });
    console.log(`✓ enriched ${updated} providers (${missing} not found in NPPES).`);
  } catch (error) {
    await finishSyncRun(db, runId, {
      status: 'failed',
      rowsUpserted: updated,
      notes: String(error),
    });
    throw error;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
