import { isCoveredZip, zipToCounty } from '../../lib/geo';
import { specialties } from '../../lib/specialties';
import type { County } from '../../lib/types';
import {
  type FhirResource,
  pagedSearch,
  resourcesOfType,
} from '../fhir';
import { acceptingOf, languagesOf, npiOf, phoneOf, refId } from './fhir-helpers';
import type {
  DirectoryEntry,
  DiscoveredPlan,
  FetchOptions,
  PayerAdapter,
} from './types';

/**
 * Humana Plan-Net directory. Verified live 2026-06-10/11 (docs/DATA_RECON.md):
 *  - no auth; InsurancePlan.identifier = "H3533-027-000-2026" (CMS contract!)
 *  - PractitionerRole carries NUCC specialty, plannet newpatients extension
 *  - Location carries address, county (district), phone, AND lat/lng
 *  - chained searches (location.address-*) time out — filter client-side
 *  - large queries are slow (15–60s) — generous timeouts, _count=200
 */
const BASE = 'https://fhir.humana.com/api';

const COUNTY_DISTRICTS: Record<string, County> = {
  bronx: 'bronx',
  kings: 'kings',
  'new york': 'new-york',
  queens: 'queens',
  richmond: 'richmond',
  nassau: 'nassau',
  westchester: 'westchester',
};

function nameOf(practitioner: FhirResource | undefined): string | null {
  const n = practitioner?.name?.[0];
  if (!n) return null;
  if (typeof n.text === 'string' && n.text.trim()) {
    // Humana formats as "Family, Given MD" — flip to "Given Family, MD".
    const match = /^([^,]+),\s*(.+?)\s+(MD|DO|DPM|OD|NP|PA|PHD|DDS|DMD)$/i.exec(
      n.text.trim(),
    );
    if (match) return `${match[2]} ${match[1]}, ${match[3].toUpperCase()}`;
    return n.text.trim();
  }
  const given = Array.isArray(n.given) ? n.given.join(' ') : '';
  return [given, n.family].filter(Boolean).join(' ') || null;
}

export const humanaAdapter: PayerAdapter = {
  source: 'humana',
  payerDisplayName: 'Humana',

  async discoverPlans(query: string): Promise<DiscoveredPlan[]> {
    const url =
      /^[HS]\d{4}/.test(query.trim())
        ? `${BASE}/InsurancePlan?identifier=${encodeURIComponent(query.trim())}&_count=20`
        : `${BASE}/InsurancePlan?name=${encodeURIComponent(query)}&_count=20`;
    const plans: DiscoveredPlan[] = [];
    for await (const bundle of pagedSearch(url, { maxPages: 3 })) {
      for (const plan of resourcesOfType(bundle, 'InsurancePlan')) {
        const networks: { id: string; name: string }[] = [];
        const seen = new Set<string>();
        for (const n of plan.network ?? []) {
          const id = refId(n.reference);
          if (!id || seen.has(id)) continue;
          seen.add(id);
          networks.push({ id, name: String(n.display ?? '?') });
        }
        plans.push({
          identifier: plan.identifier?.[0]?.value ?? null,
          name: plan.alias?.[0] ?? plan.name ?? '?',
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
    // Chained geo search 504s, so: query per specialty (keeps responses
    // bounded), pull practitioner+location via _include, filter to our
    // counties client-side. (Humana networks all carry searchable
    // specialty, so the specialtySearchable flag doesn't apply here.)
    const codes =
      options.taxonomyCodes ?? specialties.flatMap((s) => s.taxonomyCodes);
    for (const code of codes) {
      const first =
        `${BASE}/PractitionerRole?network=${networkId}&specialty=${code}` +
        `&_count=200&_include=PractitionerRole:practitioner&_include=PractitionerRole:location`;
      let pageNo = 0;
      for await (const bundle of pagedSearch(first, { timeoutMs: 120_000 })) {
        pageNo++;
        if (pageNo === 1) {
          console.log(`  ${code}: ~${bundle.total ?? '?'} roles nationally`);
        }
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

          // A role may list several locations; emit the first covered one.
          for (const locRef of role.location ?? []) {
            const loc = locations.get(refId(locRef.reference));
            const addr = loc?.address;
            if (!addr || addr.state !== 'NY') continue;
            const zip = String(addr.postalCode ?? '').slice(0, 5);
            const district = String(addr.district ?? '').toLowerCase();
            const county =
              COUNTY_DISTRICTS[district] ?? (zip ? zipToCounty(zip) : null);
            if (!county && !isCoveredZip(zip)) continue;

            const line = Array.isArray(addr.line) ? addr.line.join(', ') : '';

            yield {
              npi,
              name: nameOf(practitioner),
              // Searched code is what the server matched; role.specialty[] is
              // multi-valued/unordered, so reading [0] can mislabel. Trust it.
              specialtyCode: code,
              languages: languagesOf(practitioner),
              address: [line, `${addr.city}, NY ${zip}`]
                .filter(Boolean)
                .join(', '),
              county,
              zip: zip || null,
              lat: loc.position?.latitude ?? null,
              lng: loc.position?.longitude ?? null,
              phone: phoneOf(loc.telecom),
              acceptingNewPatients: acceptingOf(role),
              gender: null, // Humana doesn't expose it — NPPES fills this
            };
            break;
          }
        }
      }
    }
  },
};
