import { coveredZipPrefixes, zipToCounty } from '../../lib/geo';
import { specialties } from '../../lib/specialties';
import {
  type FhirResource,
  pagedSearch,
  resourcesOfType,
} from '../fhir';
import {
  acceptingOf,
  languagesOf,
  npiOf,
  phoneOf,
  refId,
} from './fhir-helpers';
import type {
  DirectoryEntry,
  DiscoveredPlan,
  FetchOptions,
  PayerAdapter,
} from './types';

/**
 * UnitedHealthcare (Optum FLEX) Plan-Net directory. Verified live 2026-06-11
 * (docs/DATA_RECON.md):
 *  - InsurancePlan.identifier system urn:cms:medicare-advantage-contract,
 *    value "H3418001000" (contract+PBP+segment) → CMS ContractPlanID
 *  - chained search WORKS: PractitionerRole?network=X&specialty=Y&
 *    location.address-postalcode=PREFIX (FHIR starts-with) — crawl is
 *    specialty × our 16 zip prefixes, geography filtered server-side
 *  - practitioner.gender and communication languages present;
 *    newpatients extension present; Location has lat/lng; phone on role
 *  - roles carry 700+ network-reference extensions → big payloads, use
 *    modest _count; Bundle.total caps at 10000 (don't trust it)
 *  - InsurancePlan name search is exact-prefix; enumerate + filter instead
 */
const BASE = 'https://flex.optum.com/fhirpublic/R4';

export const uhcAdapter: PayerAdapter = {
  source: 'uhc',
  payerDisplayName: 'UnitedHealthcare',

  async discoverPlans(query: string): Promise<DiscoveredPlan[]> {
    // No usable identifier/name search — walk all ~1.4k plans and filter.
    const needle = query.trim().toLowerCase().replace('_', '');
    const plans: DiscoveredPlan[] = [];
    for await (const bundle of pagedSearch(`${BASE}/InsurancePlan?_count=200`, {
      maxPages: 20,
    })) {
      for (const plan of resourcesOfType(bundle, 'InsurancePlan')) {
        const cms = (plan.identifier ?? []).find(
          (i: FhirResource) =>
            i.system === 'urn:cms:medicare-advantage-contract',
        )?.value as string | undefined;
        const haystack = `${plan.name ?? ''} ${cms ?? ''}`.toLowerCase();
        if (!haystack.includes(needle)) continue;
        const seen = new Set<string>();
        const networks: { id: string; name: string }[] = [];
        for (const n of plan.network ?? []) {
          const id = refId(n.reference);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          networks.push({ id, name: String(n.display ?? '?') });
        }
        plans.push({
          identifier: cms ?? null,
          name: String(plan.name ?? '?'),
          networks,
        });
      }
    }
    return plans;
  },

  async *fetchNetworkEntries(
    networkId: string,
    options: FetchOptions = {},
  ): AsyncGenerator<DirectoryEntry> {
    // Specialty-searchable networks (AARP MA): crawl per specialty × zip,
    // store the searched code. Non-searchable networks (Dual Complete
    // D-SNP — roles carry no specialty at all): crawl by zip only and emit
    // specialtyCode=null for sync:nppes to backfill.
    if (options.specialtySearchable === false) {
      for (const prefix of coveredZipPrefixes) {
        yield* crawlUrl(geoUrl(networkId, prefix), null);
      }
      return;
    }
    const codes =
      options.taxonomyCodes ?? specialties.flatMap((s) => s.taxonomyCodes);
    for (const code of codes) {
      for (const prefix of coveredZipPrefixes) {
        yield* crawlUrl(geoUrl(networkId, prefix, code), code);
      }
    }
  },
};

function geoUrl(networkId: string, zipPrefix: string, code?: string): string {
  return (
    `${BASE}/PractitionerRole?network=${networkId}` +
    (code ? `&specialty=${code}` : '') +
    `&location.address-postalcode=${zipPrefix}&_count=50` +
    `&_include=PractitionerRole:practitioner&_include=PractitionerRole:location`
  );
}

/** Page one search URL, mapping each in-area role to a DirectoryEntry.
 *  `searchedCode` is the NUCC code the URL filtered by, or null for a
 *  geography-only crawl (specialty then comes from NPPES). */
async function* crawlUrl(
  url: string,
  searchedCode: string | null,
): AsyncGenerator<DirectoryEntry> {
  for await (const bundle of pagedSearch(url, { timeoutMs: 60_000 })) {
    const practitioners = new Map<string, FhirResource>();
    const locations = new Map<string, FhirResource>();
    for (const p of resourcesOfType(bundle, 'Practitioner')) {
      practitioners.set(p.id, p);
    }
    for (const l of resourcesOfType(bundle, 'Location')) {
      locations.set(l.id, l);
    }

    for (const role of resourcesOfType(bundle, 'PractitionerRole')) {
      const practitioner = practitioners.get(
        refId(role.practitioner?.reference),
      );
      const npi = npiOf(practitioner);
      if (!npi) continue;

      const loc = locations.get(refId(role.location?.[0]?.reference));
      const addr = loc?.address;
      if (!addr || addr.state !== 'NY') continue;
      const zip = String(addr.postalCode ?? '').slice(0, 5);
      const county = zip ? zipToCounty(zip) : null;
      if (!county) continue;

      const name = practitioner?.name?.[0];
      const line = Array.isArray(addr.line) ? addr.line.join(', ') : '';

      yield {
        npi,
        name:
          (typeof name?.text === 'string' && name.text.trim()) ||
          [
            Array.isArray(name?.given) ? name.given.join(' ') : '',
            name?.family,
          ]
            .filter(Boolean)
            .join(' ') ||
          null,
        // The searched code is what the server matched on; a role's
        // specialty[] is multi-valued and unordered (a cardiologist's role
        // may list internal medicine at [0]), so reading [0] would mislabel.
        // Trust the searched code; null → NPPES backfills.
        specialtyCode: searchedCode,
        languages: languagesOf(practitioner),
        address: [line, `${addr.city}, NY ${zip}`].filter(Boolean).join(', '),
        county,
        zip: zip || null,
        lat: loc.position?.latitude ?? null,
        lng: loc.position?.longitude ?? null,
        phone: phoneOf(role.telecom) ?? phoneOf(loc.telecom),
        acceptingNewPatients: acceptingOf(role),
        gender:
          practitioner?.gender === 'female'
            ? 'f'
            : practitioner?.gender === 'male'
              ? 'm'
              : null,
      };
    }
  }
}
