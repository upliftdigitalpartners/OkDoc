/**
 * Minimal FHIR R4 search client for Plan-Net directory syncs.
 * Payer endpoint quirks (see docs/DATA_RECON.md):
 *  - Humana: slow large queries (15–60s) — generous timeout, cursor paging
 *  - UHC: HAPI-style _getpages links, totals capped at 10k
 * Be polite: sequential requests with a small delay, retries with backoff.
 */

export interface FhirBundle {
  resourceType: string;
  total?: number;
  link?: Array<{ relation: string; url: string }>;
  entry?: Array<{ fullUrl?: string; resource: FhirResource }>;
}

// FHIR resources are deeply heterogeneous across payers — adapters narrow
// them field-by-field with the helpers below instead of a full type model.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FhirResource = Record<string, any>;

const DEFAULT_TIMEOUT_MS = 90_000;
const RETRIES = 3;
const POLITE_DELAY_MS = 250;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchFhir(
  url: string,
  timeoutMs = DEFAULT_TIMEOUT_MS,
): Promise<FhirBundle> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= RETRIES; attempt++) {
    try {
      const res = await fetch(url, {
        headers: { Accept: 'application/fhir+json, application/json' },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      if (!res.ok) {
        const body = await res.text();
        throw new FatalFhirError(`HTTP ${res.status} for ${url}: ${body.slice(0, 300)}`);
      }
      return (await res.json()) as FhirBundle;
    } catch (error) {
      if (error instanceof FatalFhirError) throw error;
      lastError = error;
      const backoff = 2 ** attempt * 1000;
      console.warn(`  retry ${attempt}/${RETRIES} after ${backoff}ms: ${String(error)}`);
      await sleep(backoff);
    }
  }
  throw new Error(`FHIR request failed after ${RETRIES} retries: ${url} — ${String(lastError)}`);
}

/** Non-retryable client error (4xx other than 429). */
export class FatalFhirError extends Error {}

/**
 * Follow Bundle.link[next] until exhausted. Tolerates capitalized relation
 * codes (some payers violate the spec). maxPages is a runaway guard.
 *
 * HAPI-style servers (UHC) expire `_getpages` cursors server-side; a slow
 * patch mid-crawl then yields HTTP 410 "Paging information not found" on the
 * next link, which would kill a long crawl. Consumers dedupe entries by NPI,
 * so on cursor expiry we restart the search from page 1 instead of dying —
 * duplicate yields are harmless, a lost crawl is not.
 */
export async function* pagedSearch(
  firstUrl: string,
  options: { maxPages?: number; timeoutMs?: number } = {},
): AsyncGenerator<FhirBundle> {
  const { maxPages = 5000, timeoutMs } = options;
  const MAX_RESTARTS = 3;
  let restarts = 0;
  let url: string | null = firstUrl;
  let pages = 0;
  while (url && pages < maxPages) {
    let bundle: FhirBundle;
    try {
      bundle = await fetchFhir(url, timeoutMs);
    } catch (error) {
      const cursorExpired =
        error instanceof FatalFhirError &&
        /HTTP 410|Paging information not found/i.test(error.message);
      if (cursorExpired && url !== firstUrl && restarts < MAX_RESTARTS) {
        restarts++;
        console.warn(
          `  paging cursor expired — restarting search from page 1 (${restarts}/${MAX_RESTARTS})`,
        );
        url = firstUrl;
        await sleep(2000);
        continue;
      }
      throw error;
    }
    pages++;
    yield bundle;
    const next = bundle.link?.find((l) => l.relation.toLowerCase() === 'next');
    url = next?.url ?? null;
    if (url) await sleep(POLITE_DELAY_MS);
  }
  if (url) {
    console.warn(`  stopped paging at maxPages=${maxPages}; next link remained`);
  }
}

/** All resources of a type across a bundle, including _include entries. */
export function resourcesOfType(bundle: FhirBundle, type: string): FhirResource[] {
  return (bundle.entry ?? [])
    .map((e) => e.resource)
    .filter((r) => r && r.resourceType === type);
}
