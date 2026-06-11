import { isCoveredZip, zipToCounty } from '../../lib/geo';
import { specialties } from '../../lib/specialties';
import type { County } from '../../lib/types';
import {
  type FhirResource,
  pagedSearch,
  resourcesOfType,
} from '../fhir';
import type {
  DirectoryEntry,
  DiscoveredPlan,
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

const LANGUAGE_NAMES: Record<string, string> = {
  english: 'en',
  spanish: 'es',
  bengali: 'bn',
  chinese: 'zh',
  mandarin: 'zh',
  cantonese: 'zh',
  hindi: 'hi',
  urdu: 'ur',
  arabic: 'ar',
  french: 'fr',
  russian: 'ru',
  korean: 'ko',
  polish: 'pl',
  'haitian creole': 'ht',
  creole: 'ht',
};

function npiOf(practitioner: FhirResource | undefined): string | null {
  const id = (practitioner?.identifier ?? []).find(
    (i: FhirResource) => i.system === 'http://hl7.org/fhir/sid/us-npi',
  );
  return typeof id?.value === 'string' && /^\d{10}$/.test(id.value)
    ? id.value
    : null;
}

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

function languagesOf(practitioner: FhirResource | undefined): string[] {
  const out = new Set<string>(['en']);
  for (const comm of practitioner?.communication ?? []) {
    const display = comm?.coding?.[0]?.display;
    if (typeof display === 'string') {
      const code = LANGUAGE_NAMES[display.trim().toLowerCase()];
      if (code) out.add(code);
    }
  }
  return [...out];
}

function acceptingOf(role: FhirResource): boolean | null {
  const ext = (role.extension ?? []).find((x: FhirResource) =>
    String(x.url).endsWith('/newpatients'),
  );
  const code = ext?.extension?.find(
    (x: FhirResource) => x.url === 'acceptingPatients',
  )?.valueCodeableConcept?.coding?.[0]?.code;
  if (code === 'newpt') return true;
  if (code === 'nopt') return false;
  if (typeof code === 'string') return code.startsWith('existpt') ? false : null;
  return null;
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
          const id = String(n.reference ?? '').split('/').pop() ?? '';
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
    taxonomyCodes?: string[],
  ): AsyncGenerator<DirectoryEntry> {
    // Chained geo search 504s, so: query per specialty (keeps responses
    // bounded), pull practitioner+location via _include, filter to our
    // counties client-side.
    const codes = taxonomyCodes ?? specialties.flatMap((s) => s.taxonomyCodes);
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
            String(role.practitioner?.reference ?? '').split('/').pop() ?? '',
          );
          const npi = npiOf(practitioner);
          if (!npi) continue;

          // A role may list several locations; emit the first covered one.
          for (const locRef of role.location ?? []) {
            const loc = locations.get(
              String(locRef.reference ?? '').split('/').pop() ?? '',
            );
            const addr = loc?.address;
            if (!addr || addr.state !== 'NY') continue;
            const zip = String(addr.postalCode ?? '').slice(0, 5);
            const district = String(addr.district ?? '').toLowerCase();
            const county =
              COUNTY_DISTRICTS[district] ?? (zip ? zipToCounty(zip) : null);
            if (!county && !isCoveredZip(zip)) continue;

            const line = Array.isArray(addr.line) ? addr.line.join(', ') : '';
            const phone = (loc.telecom ?? []).find(
              (t: FhirResource) => t.system === 'phone',
            )?.value;

            yield {
              npi,
              name: nameOf(practitioner),
              specialtyCode: role.specialty?.[0]?.coding?.[0]?.code ?? code,
              languages: languagesOf(practitioner),
              address: [line, `${addr.city}, NY ${zip}`]
                .filter(Boolean)
                .join(', '),
              county,
              zip: zip || null,
              lat: loc.position?.latitude ?? null,
              lng: loc.position?.longitude ?? null,
              phone: typeof phone === 'string' ? phone : null,
              acceptingNewPatients: acceptingOf(role),
            };
            break;
          }
        }
      }
    }
  },
};
