# Translation review checklist

All 11 non-English catalogs in `messages/` are **LLM-drafted first passes**. A
native (ideally NYC-community) speaker must review the high-stakes strings
below before launch. Keys marked `"//": "NEEDS_NATIVE_REVIEW"` in the JSON
carry the same warning in-file.

## What to check, per language

For each locale, a native reviewer should confirm:

1. **Specialty names** (`specialties.*.plain` / `.formal`) — the *plain* name
   must be what a senior in that community would naturally say (concept, not
   calque); the *formal* name must be the real medical term used in that
   language.
2. **The confirm script** (`results.confirmScript`) — will be read aloud on
   the phone to a NYC medical receptionist; it must sound natural and polite.
3. **The disclaimer** (`footer.disclaimer`) — legal-adjacent; meaning must be
   exact: public directory data, always confirm with the office, no medical
   advice.
4. **Stale-data warning** (`results.staleWarning`) and **trust label**
   (`results.trustLabel`, `results.syncedOn`) — must not overclaim accuracy.
5. **Borough names** (`counties.*`) — as the community actually writes them.
6. **Register** — respectful form of address for elders throughout.
7. **Plurals** — counts render correctly for 0, 1, 2, 5, 21 results/miles
   (especially ru, pl, ar).
8. **RTL (ar, ur only)** — text reads correctly in the running app, numbers
   and Latin plan names embed cleanly (visit `/ar`, `/ur`).

## Reviewer sign-off

| Locale | Language | Specialties | Confirm script | Disclaimer | Stale/trust | Boroughs | Plurals | Reviewer / date |
|--------|----------|:-----------:|:--------------:|:----------:|:-----------:|:--------:|:-------:|-----------------|
| es | Español | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| bn | বাংলা | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| zh | 中文 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| hi | हिन्दी | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| ur | اردو (RTL) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| ar | العربية (RTL) | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| fr | Français | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| ru | Русский | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| ko | 한국어 | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| pl | Polski | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |
| ht | Kreyòl Ayisyen | ☐ | ☐ | ☐ | ☐ | ☐ | ☐ | |

## Process notes

- Edit translations directly in `messages/<locale>.json`, then run
  `npm run check:i18n` (key structure + placeholder safety) and
  `npm run test:a11y`.
- When a reviewer signs off a locale, drop the `"//"` marker keys from that
  file and record the reviewer/date here.
- Machine-translation vendors are not a substitute for this review — the
  specialty names and the confirm script in particular need community ears.
