# OkDoc

Answers one question: **"Which doctors near me actually take my insurance?"** v1 = Medicare Advantage plans, NYC metro (5 boroughs + Nassau/Westchester). Users are seniors and their adult-child caregivers. Informational answer engine only — we turn "ten blind calls" into "one confirmation call."

**Trust is the product.** Every result carries a source + freshness label ("Listed in Healthfirst's directory · synced Jun 8") and a tap-to-call button with a confirmation script. Never overclaim directory accuracy.

## Stack (decided — do not change without asking)

- Next.js 16 (App Router) + TypeScript strict + Tailwind CSS v4 (CSS-first config in `src/app/globals.css` via `@theme`; there is no `tailwind.config.ts`)
- next-intl for i18n, zod for validation
- Supabase Postgres, **server-side only** (service role key; no client-side Supabase)
- PWA, mobile-first, Vercel
- **No LLM calls at runtime.** Deterministic public data only.
- Ingestion = local CLI scripts (`npm run sync:*`), never serverless functions.

## Commands

- `npm run dev` — dev server
- `npm run build` — production build (keep green)
- `npm run lint` — ESLint incl. jsx-a11y (strict; keep green)
- `npm run test:a11y` — Playwright + axe against every wizard step (keep green)
- `npm run sync:plans` / `sync:nppes` / `sync:payer -- --payer=<humana|uhc>` — ingestion CLIs (need `.env` with Supabase vars)

## Env vars

`.env.example` is the contract: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. **Mock mode:** when these are missing, the app must serve fixture data (~40 fake providers) with a "demo data" banner — the full UI works with zero configuration. Never let missing env crash a page.

## Layout

- `src/app/[locale]/…` — wizard steps as routes: `location` → `plan` → `doctor` → `filters` → `results`. Wizard state lives in **URL query params** (shareable, back-button-friendly). Root `src/app/page.tsx` = language picker.
- `src/lib/` — `search.ts` (Supabase | fixtures switch), `schemas.ts` (zod), `specialties.ts`, `fixtures/`
- `src/ingestion/adapters/` — `PayerAdapter` implementations; one file per payer. Type-checked with the app; `scripts/` are thin CLI wrappers run via tsx.
- `supabase/migrations/*.sql` — run manually in Supabase SQL editor; never auto-applied.
- `messages/<locale>.json` — all UI strings. 12 locales: en, es, bn, zh, hi, ur, ar, fr, ru, ko, pl, ht.
- `docs/DATA_RECON.md` — verified data-source URLs, query patterns, and per-payer gotchas. **Read it before touching ingestion code.**

## Data rules

- Sync public sources into our Postgres; search our copy. **Never query payer APIs live per user search.**
- `provider_plan.last_seen_at` drives freshness labels. Rows missing from recent syncs get flagged stale — **never silently deleted**.
- Keep rows lean (Supabase free tier, 500MB). Store only what the UI needs.
- Every sync writes a `sync_runs` row.
- CMS downloads need a browser `User-Agent`; landscape zip URLs are version-stamped — scrape the hosting page, don't hardcode.

## Accessibility (non-negotiable, WCAG 2.2 AA)

- Base font ≥18px; must survive 200% text zoom without breakage or horizontal scroll
- Semantic HTML first; ARIA only where needed
- Full keyboard nav with visible focus states; touch targets ≥48px
- Color never carries meaning alone (badges = icon + text); color-blind-safe palette
- Respect `prefers-reduced-motion` and `prefers-contrast`
- Soft off-white background, calm blue/teal palette, high-contrast ink, dark mode available
- jsx-a11y lint + axe tests must stay green; new screens get added to `tests/a11y.spec.ts`

## i18n rules

- **Zero hardcoded UI copy** — every string through next-intl. Source copy: tight, plain, ~6th-grade English.
- **RTL (ar, ur):** CSS logical properties only — `ms-*`/`me-*`/`ps-*`/`pe-*`/`start-*`/`end-*`, never `ml-*`/`mr-*`/`pl-*`/`pr-*`/`left-*`/`right-*`/`text-left`/`text-right`.
- Locale-aware date/number formatting via next-intl formatters, never manual.
- High-stakes strings (specialty names, confirm script, disclaimer) carry `"//": "NEEDS_NATIVE_REVIEW"` markers and are tracked in `TRANSLATION_REVIEW.md`.
- Specialty plain-language names are translated as concepts, not word-for-word.

## Scope guardrails — do NOT build (flag if a request conflicts)

No booking/scheduling. No accounts. No reviews/ratings. No insurance card scanning. No ACA/Medicaid segments. No embedded maps (deep-link to Google Maps instead). No symptom checker or anything resembling medical advice. No analytics tying health searches to identity.

## Conventions

- Conventional-ish commits, one commit per vertical slice minimum.
- zod-validate all external data at the boundary (wizard query params, FHIR responses, CSV rows).
- UI never throws on bad/missing data — degrade to "unknown" labels; honesty about data quality is a feature.
