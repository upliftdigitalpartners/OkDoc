# OkDoc manual test checklist

Run on a real phone where possible. Automated coverage (axe, RTL, zoom) runs
in `npm run test:a11y`; this list covers what machines can't judge.

## A. Phone pass (any language)

- [ ] Open the deployed URL on a phone. Language screen shows 12 languages,
      each in its own script; all buttons comfortably tappable with a thumb.
- [ ] Walk the whole wizard: language → borough → payer → plan → kind of
      doctor → filters → results. Every screen: one decision, visible Back
      button, progress dots advance.
- [ ] On the plan step, type 2–3 letters in the filter box — list narrows;
      nonsense text shows the friendly "nothing matches" message.
- [ ] Results: each card shows trust label ("Listed in X's directory ·
      synced [date]"), distance, badges with icon + text.
- [ ] Tap the big call button → phone dialer opens with the right number.
- [ ] Expand "What to say when you call" — script shows your language AND
      English (when not English).
- [ ] Share → native share sheet (or "link copied"); send it to another
      device — the SAME results open (URL carries the whole search).
- [ ] Print → print preview is readable: no buttons, cards intact.
- [ ] Directions → opens Google Maps with the office address.
- [ ] Set filters so nothing matches → kind empty state, "Change my filters"
      goes back with previous selections intact.
- [ ] Browser Back button at every step returns exactly one step.
- [ ] No `.env` deployment: orange "demo data" banner shows on results.

## B. Screen-reader pass (VoiceOver on iPhone, or NVDA + Firefox)

- [ ] Language screen: each option announces its language name; the current
      one announces as selected/current.
- [ ] Every wizard page announces its heading (h1) on navigation.
- [ ] Progress announces "Step N of 6" (visually-hidden text on the dots).
- [ ] ZIP input: label read aloud; submit a bad ZIP → error is announced
      immediately (role=alert), input flagged invalid.
- [ ] Filters: each radio/checkbox announces its label and state; groups
      announce their legend ("Doctor's gender", "Only show doctors who…").
- [ ] Result card reads in a sensible order: name → specialty → distance →
      trust label → badges → call button ("Call the office · (xxx) xxx").
- [ ] "What to say when you call" announces as collapsed/expanded.
- [ ] Skip-to-content link is the first Tab stop and works.

## C. 200% zoom pass (desktop browser, Cmd/Ctrl+plus to 200%)

- [ ] Walk all 6 screens at 200%: no horizontal scrolling, no clipped text,
      no overlapping controls.
- [ ] Header wraps gracefully (logo + language link may stack).
- [ ] Result cards: badges wrap to new lines, call button text doesn't
      overflow the button.
- [ ] iOS: Settings → Display → Text Size at max — app text scales.

## D. Arabic / RTL pass (switch to العربية; spot-check اردو too)

- [ ] Entire layout mirrors: progress dots start on the right, back arrow
      points right, list bullets/borders flip sides.
- [ ] Arabic text renders right-aligned; embedded Latin (plan names like
      "Humana Gold Plus", phone numbers) reads correctly inside Arabic
      sentences, not garbled or reversed.
- [ ] Numbers in "about X miles away" and dates in "synced …" are formatted
      and readable.
- [ ] Result count uses correct Arabic plural (try searches returning 1, 2,
      and 3–10 results).
- [ ] Confirm script shows Arabic first, English second.
- [ ] Filters screen: checkboxes sit on the right of their labels (mirrored).

## E. PWA / offline

- [ ] Android Chrome / iOS Safari: "Add to Home Screen" offers the OkDoc
      icon; launched app opens standalone (no browser chrome).
- [ ] With the app loaded once: airplane mode → navigate → friendly
      multilingual offline page (not a browser error).
- [ ] Back online → app recovers without clearing anything.
- [ ] Lighthouse (Chrome DevTools): PWA installable, a11y score ≥ 95 on
      language, filters, and results screens.

## F. Data honesty (with real data loaded)

- [ ] A result synced >45 days ago shows the stale warning ("has not been
      confirmed recently") — find one via `select * from provider_plan order
      by last_seen_at limit 5`.
- [ ] Freshness date on cards matches `provider_plan.last_seen_at`.
- [ ] A provider with unknown accepting-status shows NO "accepting" badge
      (absence, not a false claim).
- [ ] Footer disclaimer is present on every screen, in the UI language.
