# OkDoc — Data Reconnaissance Report

All findings live-verified with HTTP requests on **2026-06-10**. No remembered URLs were trusted; every endpoint below returned the stated status on that date.

## TL;DR recommendation

**Start with UnitedHealthcare and Humana.** Both expose fully open, no-auth Plan-Net FHIR R4 endpoints where the exact query OkDoc needs — *providers in network X near zip Y, with names/addresses included* — was verified end-to-end live. Aetna is gated behind portal registration + OAuth (start that registration early as the slice-4+ candidate). Healthfirst and EmblemHealth are public but materially broken in different ways (details below); revisit them after the adapter pattern is proven.

---

## 1. CMS MA Plan Landscape (→ `plans` table)

| Item | Verified value |
|---|---|
| Current file | `https://www.cms.gov/files/zip/cy2026-landscape-202603.zip` (HTTP 200, 13.5 MB zip) |
| Hosting page | `https://www.cms.gov/medicare/coverage/prescription-drug-coverage` |
| Historical archive | `https://www.cms.gov/files/zip/cy2006-cy2025-landscape-files.zip` (190 MB) |
| Contents | `CY2026_Landscape_202603.csv` (79.2 MB, UTF-8 **with BOM**) + `.xlsb` (ignore) + ReadMe |
| Grain | contract-plan-segment × county; 138,263 rows; MA + MA-PD + SNP + Cost + PDP merged (since CY2025) |
| Cadence | Annual (~late Sept) + 2–3 in-year revisions; **URL changes per revision** (`cy{YYYY}-landscape-{yyyymm}.zip`) |
| API alternative | **None** — confirmed absent from data.cms.gov catalogs; file download is the only channel |

Key columns: `Contract ID`, `Plan ID`, `Segment ID`, pre-joined `ContractPlanID` / `ContractPlanSegmentID`, `Parent Organization Name`, `Organization Marketing Name`, `Plan Name`, `Plan Type`, `Special Needs Plan (SNP) Indicator`, `SNP Type`, `State Territory Abbreviation`, `County Name`. 51 columns total.

NYC coverage confirmed: Bronx 77 rows, Kings 79, New York 75, Queens 77, Richmond 63, Nassau 66, Westchester 77.

Gotchas:
- cms.gov returns **403 to non-browser user agents** — send a `Mozilla/5.0` UA.
- Don't hardcode the zip URL — scrape the hosting page for `href` matching `/files/zip/cy\d{4}-landscape-\d{6}\.zip`.
- Currency columns are dirty strings (`"$2,100.00 "`, `($3.90)`); `"Not Applicable"` sentinels in numeric columns.
- `Plan ID` (`001`) and `Segment ID` have leading zeros — ingest as text.
- PDP rows use `County Name = "All Counties"` — filter `Contract Category Type IN ('MA','MA-PD','SNP')`.
- No county FIPS codes — join by state + county name (boroughs = Bronx/Kings/New York/Queens/Richmond).

Local copies from recon: `/tmp/cy2026-landscape.zip`, `/tmp/CY2026_Landscape_202603/`.

## 2. Payer Plan-Net FHIR endpoints (→ `provider_plan`)

### UnitedHealthcare — RECOMMENDED #1 (4/5)

- **Base:** `https://flex.optum.com/fhirpublic/R4` — no auth, FHIR 4.0.1, full Plan-Net resource set.
  (Dead candidates verified: `public.fhir.flex.optum.com`, `apimarketplace.uhc.com` → 404. uhc.com docs pages 403 non-browser UAs.)
- **Verified end-to-end NYC MA query:** `PractitionerRole?network={id}&location.address-postalcode=10001&_include=PractitionerRole:practitioner&_include=PractitionerRole:location` → 200, 846 roles for "AARP Medicare Advantage from UHC NY-0012 (PPO)", with real practitioner names + NYC street addresses in the bundle.
- Network discovery: `Organization?type=ntwk` (1,503 networks); `InsurancePlan` (1,395 plans, MA plans present by name). InsurancePlan `name=` search is exact/prefix — enumerate the full list instead (it's small).
- Paging: standard `Bundle.link[next]` (HAPI `_getpages`), verified.
- Gotchas: `Bundle.total` caps at 10,000 (no true counts); duplicate/noisy network Organization refs (one AARP plan had 3 network refs — one empty, one valid, one pointing to a Michigan network) — probe each ref; `PractitionerRole.specialty` sparse on some roles; geography lives on Location only.

### Humana — RECOMMENDED #2 (4/5) — implementation findings 2026-06-11

Verified during adapter build (better than the original recon suggested):

- **`InsurancePlan.identifier` embeds the CMS contract**: `H3533-027-000-2026`
  (contract-PBP-segment-year), and `alias[0]` is the exact landscape plan name.
  `InsurancePlan?identifier=H3533-027-000-2026` works → plan↔network mapping
  is discoverable, no name heuristics needed (`sync:payer --discover=…`).
- **`newpatients` Plan-Net extension IS present** on PractitionerRole
  (`acceptingPatients` code `newpt`) → real accepting-new-patients data.
- **Location carries `position` (lat/lng) and `district` (county name)** →
  no geocoding needed for Humana entries.
- Plan→network links are coarse: every PPO plan lists ~12 networks incl.
  dental/vision/Rx — the medical network is hand-picked in
  `src/ingestion/adapters/plan-network-map.json`.
- "Gold Plus HMO/SNP Downstate" network is regional (1,525 cardiology roles,
  919 in our counties). "Medicare PPO" is national (~19k cardiology roles) —
  a full sync of that network is a 1–2h polite crawl.
- Chained geo params (`location.address-state=NY`) → **504 Gateway Timeout**
  (confirmed) — geographic filtering must stay client-side.

- **Base:** `https://fhir.humana.com/api` — no auth, FHIR 4.0.1, Plan-Net conformant, true totals.
- **Verified:** `PractitionerRole?network={id}&specialty=207R00000X&_include=...` → 200 with Practitioner + Location included; NUCC-coded specialty **on the role**; network displays like "Medicare PPO27". `InsurancePlan?name=medicare` is contains-style (146 hits); "HumanaChoice" MA PPO plans carry network refs + `coverageArea`.
- Paging: `_continuationToken` cursor in next link, verified; docs also show `_skip`.
- Gotchas: unfiltered `PractitionerRole` scans take ~60s (network-filtered 15–25s; simple queries <2s) — budget timeouts; chained search (`practitioner.name=`) times out — avoid; 1,654 plans literally named "HumanaChoice" — disambiguate via coverageArea/network; **developers.humana.com carries a portal-retirement notice** — re-verify URL before launch.

### Aetna — DEFERRED (2/5)

- Bases: `https://apif1.aetna.com/fhir/v1/providerdirectory` and `/providerdirectorydata` (Medicare). `/metadata` open (Plan-Net CapabilityStatement); **all data reads → 401**.
- Requires developer-portal registration (with vetting) + OAuth2 client_credentials (`scope=Public NonPII`, token URL `https://apif1.aetna.com/fhir/v1/fhirserver_auth/oauth2/token`).
- Upside once credentialed: documented **Bulk FHIR export** for the Medicare directory; geo params directly on Practitioner. Downside: no `network` search param on PractitionerRole in the CapabilityStatement.
- Action: kick off portal registration early (long pole). Support: interoperabilitydevelopersupport@aetna.com.

### Healthfirst — NOT VIABLE FOR MA SCOPING (2.5/5)

- **Base:** `https://hf-fhir-provider-directory-sys-api-prod.us-e1.cloudhub.io` — open, fast, no auth.
- **Killer flaw: no `Network` or `InsurancePlan` resources (404), and PractitionerRole carries no network refs** — there is no way to tell which providers are in which MA plan network. One undifferentiated all-lines pool.
- Also: no CapabilityStatement (`/metadata` 404); standard FHIR params (`_count`, `_include`, `_total`) hard-rejected with 400; nonstandard paging (`page`/`pageSize`, **capitalized** link relations `Next`/`Last`); specialties are display-only strings (no NUCC codes); Locations lack `address` (lat/lng only); org names stuffed into person name fields.
- Revisit only if their API grows network resources, or via a non-FHIR source.

### EmblemHealth — BLOCKED ON BROKEN PAGING (2/5)

- **Base:** `https://prodtzinterop.healthtranzformdev.com/providerdirectory` (vendor HealthTranzform, Azure APIM; base URL undocumented — found by probing). No auth; proper R4 CapabilityStatement.
- MA confirmed: `InsurancePlan` includes "EmblemHealth VIP Dual HMO DSNP…" etc., with network refs; network-scoped `PractitionerRole?network=Organization/EVIVIPP00001` works and roles carry Plan-Net `plannet-NewPatients` (accepting-patients!) and `plannet-ParticipatingNetwork` extensions.
- **Killer flaw: `Bundle.link[next]` is malformed (`_getpages=null`) and 404s — cannot paginate past page 1 via spec.** Untested workaround: declared `starting_after`/`ending_before` cursor params.
- Also: bare listings rejected (422 — always pass a search param); some searches hang >60s (use `Practitioner/{id}` reference syntax, never bare ids); dangling references (`Practitioner/100` → 404); network Organizations have *practitioner names* in `.name` (infer network from id prefixes: `EVIVIPP…` ≈ VIP); `_include` silently ignored; specialty codes text-only (`"207R00000X : Internal Medicine"` — parseable!); placeholder phones; Location `position` = (0,0).
- Worth a second look in slice 4+: it has the accepting-new-patients signal UHC lacks, if the cursor params pan out.

## 3. NPPES NPI Registry (→ `providers` enrichment)

- **API:** `https://npiregistry.cms.hhs.gov/api/?version=2.1` — no auth, no documented rate limit (be polite anyway).
- Working params: `number`, `first_name`/`last_name`, `organization_name`, `taxonomy_description`, `city`, `state`, `postal_code` (trailing wildcard: `100*`), `enumeration_type` (NPI-1/NPI-2), `limit` (max 200, silently clamped), `skip` (silently clamped ~1200).
- **Hard cap: ~1,200 records per criteria set** — shard discovery queries by zip wildcard × taxonomy, or use bulk files.
- Response shape: `{result_count, results[]}` — **no total-count field**; detect pagination exhaustion by repeated/short pages, not errors.
- Field traps: `basic.sex` (NOT `gender`); `"--"` placeholder strings; 9-digit unhyphenated zips; `addresses[].address_purpose` = LOCATION vs MAILING; `taxonomies[].primary` boolean; `last_updated_epoch` (ms-epoch string).
- **Bulk files** (index: `https://download.cms.gov/nppes/NPI_Files.html` — filenames rotate, scrape the index):
  - Full monthly: ~1.06 GiB zip (~9–10 GB CSV, 330+ cols)
  - Weekly incremental: ~7 MiB
  - **Deactivated NPIs monthly report** (~2.5 MiB) — the only way to learn deactivations
- **NUCC taxonomy crosswalk:** `https://www.nucc.org/images/stories/CSV/nucc_taxonomy_251.csv` (verified 200; v25.1 current; re-scrape index page for new versions). Header: `Code,Grouping,Classification,Specialization,Definition,Notes,Display Name,Section`. `Display Name` is the consumer-friendly label.
- **Recommended:** per-NPI API lookups for enrichment (we'll already have NPIs from payer syncs — a few req/s, done in hours); bulk route only if we later need the full NYC universe independent of payers.

## 4. Cross-payer comparison

| | UHC | Humana | Aetna | Healthfirst | EmblemHealth |
|---|---|---|---|---|---|
| No-auth access | ✅ full | ✅ full | ❌ OAuth+vetting | ✅ | ✅ |
| MA networks identifiable | ✅ verified | ✅ verified | claimed | ❌ impossible | ✅ but… |
| Paging works | ✅ | ✅ | untested | ✅ nonstandard | ❌ broken next link |
| `_include` | ✅ | ✅ | not advertised | ❌ 400 | ❌ ignored |
| Specialty coding | sparse NUCC | ✅ NUCC on role | untested | strings only | text w/ embedded NUCC |
| Accepting-new-patients | not seen | not seen | unknown | no | ✅ plannet-NewPatients |
| Score | 4/5 | 4/5 | 2/5 | 2.5/5 | 2/5 |

## 5. Implications for the adapter design

- `PayerAdapter` should assume per-payer: base URL, network-discovery strategy (InsurancePlan vs Organization?type=ntwk), paging strategy (link-follow vs continuation token vs page/pageSize), and tolerance for missing `_include`/specialty/totals.
- Plan matching (landscape `ContractPlanID` ↔ payer InsurancePlan) will be **name/heuristic-based** — neither UHC nor Humana exposes CMS contract IDs cleanly on InsurancePlan; expect a manual mapping table for the v1 plan list.
- `accepting_new_patients` will be NULL for UHC/Humana in v1 (schema already allows it); EmblemHealth is the future source for that signal.
- Sync jobs need: browser UA for CMS, generous per-request timeouts for Humana (60s+), retry/backoff, and per-network iteration for UHC (probe each network ref, skip empties).
