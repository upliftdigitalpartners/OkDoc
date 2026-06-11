# OkDoc

**Which doctors near me actually take my insurance?** OkDoc answers that one
question for Medicare Advantage members in the NYC metro (5 boroughs +
Nassau/Westchester) — in 12 languages, built senior-first.

It is an informational answer engine: we sync public CMS + payer directory
data into our own database and turn "ten blind calls" into **one confirmation
call**. Every result shows where the data came from and how fresh it is.
No booking, no accounts, no medical advice.

## Quick start (zero config)

```bash
npm install
npm run dev
```

Open http://localhost:3000. With no `.env`, the app runs in **mock mode**:
~40 fictional providers behind a "demo data" banner. The full wizard works.

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | dev server |
| `npm run build` | production build (keep green) |
| `npm run lint` | ESLint incl. strict jsx-a11y (keep green) |
| `npm run test:a11y` | Playwright + axe on every wizard step, RTL + 200% zoom checks |
| `npm run check:i18n` | validates all 12 message catalogs (keys + ICU placeholders) |
| `npm run sync:plans` | CMS MA landscape → `plans` table |
| `npm run sync:payer -- --payer=<humana\|uhc>` | payer FHIR directory → `providers` + `provider_plan` |
| `npm run sync:nppes` | NPPES enrichment (gender, missing fields) + geocoding |
| `npm run seed:demo` | load the fixture data into Supabase to test the live path |

## Supabase setup

1. Create a project at supabase.com (free tier is enough — the schema is
   deliberately lean).
2. In the SQL editor, run each file in `supabase/migrations/` **in order**
   (001 → 004). Migrations are applied manually, never automatically.
3. Copy `.env.example` → `.env`, fill `SUPABASE_URL` and
   `SUPABASE_SERVICE_ROLE_KEY` (Settings → API). The service role key is
   server-side only; nothing Supabase-related ships to the browser.

## Loading real data

Run on your machine, in this order (read `docs/DATA_RECON.md` first —
endpoint quirks live there):

```bash
# 1. Plans for the wizard's plan picker (~114 NYC-metro MA plans)
npm run sync:plans

# 2. Provider networks. Start with a regional network — fast:
npm run sync:payer -- --payer=humana --plan=H3533_027
npm run sync:payer -- --payer=uhc --plan=H3418_001
# National networks (e.g. Humana H5970_028) are a polite 1–2h crawl.

# 3. Enrich what the payers didn't provide (gender, NPPES gaps, geocodes)
npm run sync:nppes
```

Every run writes a `sync_runs` row. `provider_plan.last_seen_at` drives the
freshness label on result cards; rows missing from recent syncs flag as
stale after 45 days — they are never silently deleted.

Useful flags: `--dry-run` (no DB writes), `--specialty=207RC0000X` (one
specialty), `--discover=<query>` (search a payer's InsurancePlans to curate
`src/ingestion/adapters/plan-network-map.json`).

### Testing the live path without real syncs

To verify a Supabase + deployment wiring works before committing to the
hours-long real syncs, seed the fixtures into your database:

```bash
npm run seed:demo
```

> **Staging/testing only.** Once Supabase env vars are set, the app reports
> `mode: live` and **drops the demo banner** — so seeded data shows fictional
> doctors with no "demo" warning. Use this only on a staging project, and run
> the real syncs (which overwrite it) before any public launch.

## Adding a payer adapter

1. Recon first: find the payer's public Plan-Net FHIR base URL, verify
   `/metadata`, probe `PractitionerRole` search params live. Append findings
   to `docs/DATA_RECON.md`.
2. Create `src/ingestion/adapters/<payer>.ts` implementing `PayerAdapter`
   (`src/ingestion/adapters/types.ts`): `discoverPlans(query)` +
   `fetchNetworkEntries(networkId)` yielding `DirectoryEntry` rows filtered
   to our coverage area. Reuse `fhir-helpers.ts` (NPI, languages,
   newpatients) and `../fhir.ts` (retrying paged search).
3. Register it in `ADAPTERS` in `scripts/sync-payer.ts`.
4. Map plans: `npm run sync:payer -- --payer=<x> --discover=<plan name or
   CMS id>`, then add curated entries to `plan-network-map.json` (pick the
   *medical* network — payers attach dental/vision/Rx networks too, and some
   refs are empty; probe before trusting).
5. Dry-run a single specialty before a full sync.

## i18n & accessibility

- All UI strings live in `messages/<locale>.json` (12 locales, RTL for
  ar/ur). `npm run check:i18n` guards structure; first-pass translations are
  LLM-drafted and tracked for native review in `TRANSLATION_REVIEW.md`.
- WCAG 2.2 AA is a hard requirement: ≥18px base font, 48px+ touch targets,
  logical CSS properties only, axe tests on every screen. See `CLAUDE.md`.

## Deploying to Vercel

1. Push the repo to GitHub, import into Vercel (defaults work — Next 16).
2. Set env vars (Production):
   - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` — without them the deployment
     serves demo data, which is useful for previews.
   - `SITE_URL` — your canonical origin (e.g. `https://okdoc.app`). Used for
     the sitemap, robots, canonical, and Open Graph URLs. It is read **at
     build time** (those routes are static), so set it before the build;
     Vercel exposes its env vars to the build automatically.
3. Ingestion stays local by design (long-running syncs would hit serverless
   timeouts): run `npm run sync:*` from your machine against the same
   Supabase project whenever you want fresher data.
4. Health check: `GET /api/health` returns `{status, mode, time}` for uptime
   monitors (`degraded` + 503 if the DB is unreachable in live mode).

## Manual test checklist

See [docs/TEST_CHECKLIST.md](docs/TEST_CHECKLIST.md) — phone pass,
screen-reader pass, 200% zoom pass, Arabic/RTL pass.
