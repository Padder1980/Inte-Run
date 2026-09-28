# Route maps, the post-run debrief and the recap story

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE MAP IS DRAWN ONCE AND KEPT (added 2026-08-08, ahead of the provider move)

A run's route never changes, so the picture of it never changes either — and yet every glance at a run
in the Logbook re-fetched its tiles. Free on CARTO, **billed per request on Mapbox**, and on the NATIVE
app cached by nothing at all: the service worker is gated on `location.protocol` being http(s) and the
app serves itself from `interun://app`, so the SW's cache-first tile branch does not exist there.
Rendering once makes the bill track **how many runs are recorded**, not how often they are browsed.
That is the difference between a paid map provider being affordable and not, and it is why this landed
before the provider choice rather than after it.

`routeMapFor(route, pw, ph, style)` returns `{ image, proj }` and is the only thing the app calls;
`loadRouteMap` is now the tile fetcher behind it, with exactly one caller. **Measured: 64 KB per map
(WebP q0.8), 137 ms → 6 ms on a repeat, and zero tile requests on the second view.**

⚠️ **KEYED ON THE ROUTE, NEVER ON THE RUN ID.** `liveRunRecord` stamps `id: "run-" + new Date().getTime()`
on **every render** of the finish screen (documented above), so a run-id key would mint a fresh cache
entry several times a second while the runner sat looking at their own finished run — an unbounded
store of identical pictures. The route decides what the map looks like, so the route is the key, and a
bonus falls out: the finish screen and the Logbook share one entry. Coordinates are rounded to ~1 m so
float noise across a JSON round-trip cannot invalidate it.

⚠️ **THE PICTURE IS A CACHE, NOT DATA, AND ALL THREE CONSEQUENCES ARE LOAD-BEARING.**
1. **IndexedDB, never localStorage.** 64 KB × 50 runs would blow the localStorage quota and take the
   runner's entire training history with it — localStorage is where the RUNS live.
2. **It is therefore not in the backup, and must not be.** `dataView()` discovers backup keys by the
   `interun_`/`rc_` prefix in localStorage, so IndexedDB is excluded by construction. That is correct:
   an export should carry the run, not a regenerable image of it.
3. **Every failure is silent and harmless.** No IndexedDB, a quota refusal, private browsing — the map
   still draws straight from tiles. A cache that can break the screen is worse than no cache.

⚠️ **COMPOSITED AT A FIXED 2×, not at the device's DPR.** At 1× a soft map would be baked into every
retina screen forever; at the drawing device's own DPR the stored size would depend on which phone
happened to open the run first.

⚠️ **THE STYLE IS PART OF THE KEY**, so changing map provider or style invalidates every stored picture
by itself — nothing has to be cleared by hand.

**What it costs, measured 2026-08-08.** One recorded run is **~8 tiles** (run card, 700×420 at z11–14);
a SHARED run adds ~18 more, and only when it is shared. We are on the **Static Tiles API** — raster
tiles fetched directly — **not** Mapbox GL JS, which matters enormously: 200,000 free tiles/month then
$0.50/1,000, against GL JS's 50,000 free "map loads" then $5.00/1,000. So it is **free to roughly 1,000
people each running four times a week**, ≈$70/month at 2,000 and ≈$750/month at 10,000.
⚠️ **The Road Map's original "£100 a month at 10,000 users" was too optimistic and has been corrected**
in the page. ⚠️ And `MAPCACHE_MAX` is 120 entries, so after roughly six months of heavy use the oldest
runs re-fetch when scrolled back to — eviction is by last USE, so it is the forgotten runs that go.

## MAPBOX OUTDOORS ON THE RUN CARD (owner's pick, 2026-08-08)

*"I like the first mapbox style and want to use that"* — **Mapbox Outdoors**: trails, footpaths and
contour lines, the one thing none of the free styles offers and the reason to be on a paid provider at
all for a running app.

- `MAP_STYLE_RUN = { mapbox: "outdoors-v12", carto: "rastertiles/voyager" }`
- `MAP_STYLE_SHARE = { mapbox: "dark-v11", carto: "dark_all" }`

⚠️ **THE SHARE CARD IS DARK ON BOTH PROVIDERS AND DELIBERATELY NOT OUTDOORS.** That card is a dark
branded panel — it paints `rgba(4,16,13,.4)` over the map and draws light text on top — so a pale
outdoors basemap behind it is washed out and the text unreadable. Two surfaces, two answers.

⚠️ **EACH SURFACE NAMES A STYLE FOR BOTH PROVIDERS, so the app falls back to the free CARTO maps by
itself when there is no token.** That is what anyone else's checkout gets, and what the public GitHub
Pages build gets. `mapProviderFor()` is the single decision; `mapAttribution()` follows it.

⚠️ **THE TOKEN NEVER TOUCHES THE REPO.** `docs/` is committed and served publicly by Pages, and a
Mapbox token is BILLABLE — a published one is somebody else's free maps at the owner's expense, and a
token in git history has been published whatever is done afterwards. So: it lives in
**`ios/mapbox-token.txt`, which is gitignored**, the "Embed web app" build phase copies it into the app
bundle, and `WebHost` injects it as `window.__interunMapboxToken` at document start. Exactly the
two-tier shape the personal voice packs already use. `localStorage interun_mapbox_v1` is a second route
for trying it in a browser without a rebuild.
⚠️ **A `sk.` token is REFUSED**, in Swift and again on the page. A secret token must never ship in a
client at all, and that mistake is expensive and silent.
⚠️ `test/route-map-cache.test.ts` asserts **no `pk.` token is ever in the built page**. That is the
guard that matters most in this whole area.

⚠️ **ATTRIBUTION IS A LICENCE TERM AND IT DIFFERS BY PROVIDER** — Mapbox requires Mapbox +
OpenStreetMap, CARTO requires OpenStreetMap + CARTO. Derived from the same provider decision that chose
the tiles, never typed twice, and asserted at both call sites.

⚠️ **THE CACHE KEY CAUGHT A REAL BUG HERE.** Once each surface named a style per provider, `styles`
became an OBJECT — and passing it to `routeMapKey` stringifies to `"[object Object]"`, identical for
every style. The run card and share card would have shared one cache entry, whichever drew first
winning, presenting as the share card rendering the wrong map at the wrong size with nothing to point
at. The provider is resolved ONCE in `routeMapFor` and the key is `kind + ":" + style`.

✅ **CONFIRMED AND ANSWERED, 2026-08-17.** It was not "very likely" — it is what happens. The owner's
phone reported `map: mapbox · 0 cors / 0 plain / 2 failed of 20 · mapbox tiles refused (CORS)`: every
tile refused, on every run, for as long as a Mapbox token has been on that device. A URL-restricted
token checks the REQUESTING URL and the native app is not a web page — `interun://app` matches no
restriction that can be written.

**The answer is that `routeMapFor` falls back to the surface's CARTO style when Mapbox is refused.**
Every surface already names one, for the no-token case. It costs the Outdoors basemap — trails and
contours, the reason Mapbox was chosen at all — and keeps a real map that is free and cacheable.
⚠️ **THE FALLBACK RE-ENTERS `routeMapFor` SO THE CACHE KEY IS RE-DERIVED.** Falling back further down
would file a CARTO image under a mapbox key, which is the same class of fault that function's own
comment records catching once already.
⚠️ **AND IT ONLY EVER FALLS TOWARDS THE FREE PROVIDER.** A refused Mapbox load is never retried as an
uncacheable Mapbox load: that would re-fetch billed tiles on every view, which is the exact bill the
one-render cache exists to prevent.
⚠️ **A SECOND, UNRESTRICTED TOKEN IS STILL THE ONLY WAY TO KEEP OUTDOORS IN THE APP** — and an
unrestricted `pk.` token shipped in a client is a token anyone can extract and spend. The honest
options are: accept CARTO in the app, or keep Mapbox for the shared card only. Not decided.

### THE RECAP REBUILT AGAINST THE REFERENCE (2026-08-17, two judged workflows)

The owner's verdict on the first cut: *"I do not like the icon for the story at all it looks cheap and
nasty and far too dominating"* and, after a second look, *"it still isn't working as it should be… I'm
not settling for worse, I want to strive to be better than them."* Two multi-agent workflows followed:
**66 findings, 14 blockers**, then a three-way judged redesign of the two panels a critic still
refused. Suite went 716 → **755**; `test/run-debrief.test.ts` holds **78 guards**.

⚠️ **THE WORST FAULT WAS INVISIBLE FROM A SCREENSHOT: TWO ELEMENTS SHARED ONE id.** `storyShow` keeps
the outgoing panel in the DOM for 520 ms for the cross-dissolve, so `$("storyShare")` and
`$("storyMap")` resolved to the **OUTGOING** node. Consequences: the Share button on the final card had
**no handler at all**, and tapping back on panel 0 destroyed the basemap for good (tiles still fetched
and thrown away — billable on Mapbox). Fixed by scoping every lookup to the panel just built
(`p.querySelector(...)`) and deleting the ids. ⚠️ **A DOM kept for a transition is a DOM with duplicate
ids; `$()` is unsafe inside it.** I then fell into the same trap in my own verification probe.

⚠️ **AN 8px RAIL WAS MOVED TWICE AND SHOULD HAVE BEEN DELETED.** It read as a disabled iOS slider. The
verdict panel now carries `storyBandSvg` — the target band as a **filled lane**, a pace line, a marker
per kilometre coloured by verdict, stems sized by the miss, the mean on a plate, and a legend **in
words**. Measured: first element y452.7 → **y96**, non-text graphic 8px → **442px (53.6%)**,
inter-beat jolt 22px → **0.0px**. This is the one thing the competitor structurally cannot show.

⚠️ **"46% EMPTY" WAS NOT THE FLOOR — THE FIRST FIX PUT IT BACK ON DEGENERATE RUNS.** One split measured
**69%** empty and no-band **61%**, both worse than the defect being fixed. A layout verified only on a
good run is not verified. The one-split panel is now gone entirely (`storyPanelKinds` gates on
`a.n > 1`) because the verdict chart already draws a single kilometre honestly.

⚠️ **CONTRAST MEASURED FROM RENDERED PIXELS FOUND 2.10–2.91:1** where the radial gradient peaks — even
opaque white is 3.62:1 there. Fixed to 5.27–9.24:1. ⚠️ **`.story-h i`, the header date, still measures
2.42:1 on that peak and is NOT fixed** — five panels share it and it predates this work.

⚠️ **MEASURING A FLEX ITEM'S BOX CANNOT SEE CLIPPING.** `.story-cardin` has `overflow: hidden` and
reported 705.0/705 with 14px genuinely cut. Only `scrollHeight` vs `clientHeight` showed it.
`storyFit()` now sheds content in a stated order — eyebrow, then picture band, then the split row —
after measuring the header's **real** height (92px assumed vs 107 measured).

⚠️ **A GUARD PINNED THE DEFECT ITSELF, TWICE.** The split-bar test *required* the old
`46 + 54 * (slow - r.sec) / span` and was satisfied while one split rendered at 46%; the tap-zone test
compared z-indexes from **different stacking contexts** and could never fail. Both restated to the
mechanism. **36 deliberate re-breaks across the two workflows; 35 caught first time.**

⚠️ **THE `python3 -c` ONE-LINER FOR node --check IN MY WORKFLOW BRIEFS IS A SILENT NO-OP** —
`if not open(...).write(b)` is always false, so it prints nothing and reads as "all OK". Use the loop
form in the Commands section above.

### THE RECAP STORY (owner's request after a Runna screen recording, 2026-08-17)

Four panels the runner swipes through from a route thumbnail on the debrief: the route drawing
itself, the kilometres as bars, the coach's read, and a share card ending in Share / Maybe later.

⚠️ **NO PANEL COMPUTES A FACT OF ITS OWN.** They read `runAnalysis`, `runVerdict`,
`routeMapFraming` and `runRoutePresentation` — the same sources the screen behind them uses — so the
story and the debrief can never tell the runner two different things about one run, and the story
inherits route privacy for free.

⚠️ **THE SPLIT BARS ARE SCALED ACROSS THE RANGE, NOT FROM ZERO.** A well-run easy session has every
kilometre within a few seconds; measured from zero every bar comes out the same length and the panel
says nothing — which is exactly what a *consistent* run should be most able to show. Shortest bar is
40% so the slowest kilometre still reads as a bar. Measured on a real six-kilometre run:
51 / 84 / 40 / 67 / 56 / 100%.

⚠️ **THE LAST PANEL DOES NOT AUTO-ADVANCE.** It ends in a choice, and a screen that closes itself
while somebody is deciding has decided for them.

⚠️ **THE TAP ZONES SIT BELOW THE BUTTONS.** A full-width invisible "next" over a panel carrying real
actions eats every tap on Share — the control looks live and does the wrong thing, which is the
dead-button class this file already records twice. Guarded by comparing the two z-indexes.

⚠️ **IT IS AN OFFER.** It opens from a tap and never appears on its own after a run; a recap that
interrupts is one people learn to dismiss without reading. A test asserts exactly one caller.

⚠️ **`pathLength="1"` ON THE ROUTE PATH** is what lets one dash length draw any route in. It changes
nothing for the static maps and removes the need to measure each path at runtime.

⚠️ **AND THE FIX FOR THOSE PUSHED THE WHOLE PAGE SIDEWAYS.** Rendering `run.steps` as rows put a
real target line — *"36 min · 6.3 km · 5:28–5:58/km · RPE 2–3"* — in a flex child set `flex: 0 0
auto`, which will not shrink. The row grew past the viewport and, because `#view` is the scroll
owner, the ENTIRE SCREEN gained a horizontal scroll: headings clipped on the left, the overflow
button off the right, the page drifting as it was touched. Nothing in the row looked wrong — the page
moved. ⚠️ **A flex item defaults to `min-width: auto` and refuses to shrink below its content**, the
same trap `.view`'s `min-height: 0` exists for elsewhere in this file.
⚠️ **THE HARNESS MISSED IT BECAUSE THE FIXTURE WAS TOO KIND.** It carried a short `"5:20–6:10 /km"`
target, which fits — so the layout was verified against a prescription no plan actually produces. A
fixture must carry the LONGEST REAL VALUE, not a tidy one, or it certifies a layout that only works
on made-up data.

⚠️ **TWO PLAN-CARD FAULTS THAT BOTH PRINTED THEMSELVES ONTO THE SCREEN.** `rdPlanHtml` read
`a.band.min`/`.max` — the band is a `PaceRange` (`minSecPerKm`/`maxSecPerKm`), so it rendered
**"NaN:NaN–NaN:NaN /km"**; and it escaped `run.steps` as if it were a sentence when
`sessionStepText` stores an ARRAY OF ROWS, so it rendered **"[object Object]"**. Every other reader
in the file already had the band right — this was the only new one, and it is the *same* shape
mistake that had silently broken the screenshot fixture earlier the same night. ⚠️ **Check the shape
before writing the reader**, not after the screen shows it.

⚠️ **TWO THINGS OWNED ONE OPACITY, AND THE REVEAL SILENTLY LOST.** The route is arithmetic and
instant; the tiles take a second or two — so each appearing as it became ready read as two events
where the runner sees one thing. The fix was a class-based reveal on the hero, and it did nothing:
`wireRunDebrief` writes `.rd-map`'s opacity **inline** on every scroll frame, and inline beats a
class. Measured, the visible result was decided by whichever ran last.
⚠️ **AND IT CANNOT BE SOLVED BY TRANSITIONING THE SCROLL OPACITY** — that has to track the finger
with no easing, which is the pack's explicit requirement. So the hero is two layers: `.rd-map` owns
the scroll fade (inline), `.rd-mapin` owns the arrival reveal (class + transition). One owner each.
⚠️ **THE REVEAL MUST ALSO FIRE ON FAILURE**, or a phone with no signal holds a permanently blank hero
instead of showing the route by itself. `buildOverviewMap` sets the class from both paths.

⚠️ **THE ROUTE JUMPED WHEN THE MAP ARRIVED, BECAUSE TWO FRAMINGS DISAGREED.** The hero painted the
route immediately using `routeMapSvg` with NO projection — which fits the line to its own bounding
box — and `buildOverviewMap` then replaced it a second or two later with the Mercator-framed version
at the map's zoom. Measured from the owner's screen recording: at 0.4s the line filled the hero and
ran off the top; at 2.0s it was less than half the size and in a different place.
`routeMapFraming(route, pw, ph)` is now the one definition of how a route is framed — pure
arithmetic, no network — used by `loadRouteMap` and by the placeholder, which `wire()` draws once it
can measure the box. Measured after: **0px of movement** when the tiles land.
⚠️ **THE PLACEHOLDER CANNOT BE DRAWN IN `rdHeroHtml`.** Before layout the only framing available is
the bounding-box fit, which is the wrong one — so the hero renders an empty map and `wire()` fills it.
⚠️ **THE QUANTISED SIZE MUST MATCH IN BOTH PLACES** (`Math.round(n / 20) * 20`), or the placeholder is
framed for one size and the tiles for another, and the jump comes back smaller and harder to see.

⚠️ **THE CARTO FALLBACK CREDITED MAPBOX OVER CARTO'S TILES, AND ATTRIBUTION IS A LICENCE TERM.**
`mapAttribution` asks `mapProviderFor`, which answers *who we would prefer* — fine while that was the
only answer, wrong the moment a refused Mapbox token started falling back. The owner's screenshot
showed "© Mapbox © OpenStreetMap" under a map Mapbox had served nothing of, with CARTO left out.
`routeMapFor` now carries the provider it actually used back on its result and the caller reads that;
`mapAttributionFor(prov)` holds the two strings and `mapAttribution(styles)` delegates to it. The
guard was restated to assert the invariant and re-broken by crediting the preference again.
⚠️ **A FIX THAT ADDS A FALLBACK ADDS A WAY FOR EVERY DERIVED FACT TO GO STALE.** The attribution was
correct for as long as there was only one possible provider; nothing about it changed, and it became
a licence breach anyway. Anything else derived from `mapProviderFor` at render time is suspect.

⚠️ **THE ROUTE LINE CAME OUT STRETCHED, AND IT WAS TWO TRANSFORMS OVER ONE PICTURE.**
`buildOverviewMap` always composited **700×420** whatever asked for it; the debrief hero is nearly
square (measured 440×467 on a 16 Pro Max). The canvas then COVERED its box — cropped, scale 1.11 —
while the route overlay, whose SVG carries `preserveAspectRatio="none"`, STRETCHED to fill the same
box at scale **0.63**. Squashed sideways, pulled vertically, and no longer on the streets it was run
on. Reported by the owner as "slightly stretched or distorted", which is exactly what it was.
The compositor now takes a size and the hero passes its measured box, so both scale ×1.00 and nothing
needs cropping or stretching. ⚠️ **The size is QUANTISED to 20px because it is part of the cache key**
— keyed on a raw measurement, every device width and every rotation would mint its own stored picture
and `MAPCACHE_MAX` would evict real entries to hold near-duplicates of one run.
⚠️ **`object-fit` was removed rather than kept as a safety net.** It does nothing for an inline SVG,
so it was only ever hiding half of the mismatch — and a rule that papers over one of two disagreeing
transforms makes the next one harder to see.

⚠️ **THE OVERFLOW BUTTON SHIPPED WIRED TO NOTHING, AND NO EXISTING GUARD COULD SEE IT.** `rdMore`
rendered, sat in the top-right corner where every iOS app puts its actions, and did nothing at all —
reported within the hour. The id-must-resolve guard proves an id EXISTS; it cannot prove a control is
connected to anything, and "looks live, is inert" is its own class of defect this project has now
shipped twice (the profile confirm button clicked a `#saveSetup` that was nowhere in the app).
`test/run-debrief.test.ts` now collects every `id=` rendered on a `<button>` by the debrief and
requires each to be reached by a handler, plus the four `data-` sweeps. Re-broken by unwiring it.
⚠️ **And writing that guard's comment tripped the id guard on the literal it quotes** — the fifth
firing of that trap. The remedy is to reword the comment; stripping comments was tried, measured and
reverted years-equivalent ago because the regex ate real markup.
⚠️ **Delete lives in the overflow and leaves the screen BEFORE deleting.** This screen resolves its
run by id, so deleting while still on it lands the runner on "Run not found." rather than the Logbook.
No confirmation dialog: `deleteRun` already raises an undo toast, and a dialog before a reversible
action is a tap for nothing.

⚠️ **THE MAP FAILED SILENTLY FOR ITS ENTIRE LIFE, AND THAT IS WHY THIS TOOK MONTHS TO SURFACE.**
`buildOverviewMap` ends in a bare `.catch(() => {})`, and the fallback — a route drawn on a plain
panel — is designed to look deliberate. On a small card nobody questioned it; the moment the debrief
made it a full-bleed hero it was obvious. `mapDiagLine()` in Support › Your data now reports the
provider, how many tiles loaded with CORS, how many without, how many failed, and why.

**The swap-point:** `MAP_STYLE_RUN` and `MAP_STYLE_SHARE` are the only two places a style is named, and
`loadRouteMap` builds the only tile URL in the app. They differ on purpose — the little map on a
finished run is the colourful one, the share card the dark one. Moving to Mapbox is those two constants
plus that one URL. `test/route-map-cache.test.ts` asserts there is exactly ONE tile host and that both
surfaces go through the cache; all six of its guards were watched failing before being believed.

⚠️ **Mapbox has NO spending cap and NO configurable usage alerts** (verified against their own FAQ,
2026-08-08) — one email the first time you cross the free tier, and that is all. So the protections are
this cache, a URL-restricted token, and watching the Statistics page. ⚠️ **URL restrictions cannot be
applied to the account's DEFAULT public token** — a second token has to be created. And ⚠️ **a
URL-restricted token will very likely be refused in the native app**, which is not a web page and
serves itself from `interun://app`; that needs its own answer before the App Store.

## The post-run debrief is ONE screen, and it is built ONCE (rebuilt 2026-08-02)

Modelled on a reference the owner sent (Runna's): map → stats → Share → the coach's read → what the
plan asked for → heart rate → notes. `runOverviewHtml()` composes all of it and is shared by the
finish screen and the Logbook, so what you read 30 seconds after a run is what you read a month later.

⚠️ **`liveRunRecord(sm)` is the ONLY builder of a phone run's record — never hand-build another.**
`viewLiveComplete` used to build its own object with five fields (`dist/time/pace/route/splits`)
while `saveLiveSession` stored fifteen. `runAnalysis` therefore got **no `pband`** on the finish
screen: after a *prescribed* session it said "a run by feel, nothing to judge it against", drew the
pace chart with no target band and showed none of the chips — and the identical run opened from the
Logbook a minute later showed all of them. It is called on **every render** of the finish screen and
reads the clock, so its id/caption differ per render; that is safe only because nothing resolves an
*unsaved* run by id (`viewLiveComplete` looks the saved record up by `LIVE.summary.runId`). Don't
start keying off it without stamping the id once at save time.

⚠️ **`normalizeSplits()` at ingest — the wrist sends bare seconds, the page stores `{km, sec}`.**
`runAnalysis` filters on `s.sec > 0`, so every watch split was silently discarded: no pace chart, no
splits table, and the share card's "fastest km" was `Math.min()` of nothing → NaN. Exactly the
`normalizeRoute` bug in a second field. `migrateRunRoutes()` repairs runs already stored.

⚠️ **`dayLabelIso()` writes the literal word "today"** — so every watch run was captioned "today"
forever, because nothing recomputed it. Runs now carry `dateIso`; the caption comes from
`runDateLabelIso()`. Runs logged before this **cannot** be recovered (watch ids are UUIDs, not
timestamps), so the migration *clears* the false caption rather than keeping it. And the future-date
clamp must apply to the caption AND the stored date from one variable — the watch's UPCOMING page
lets a session start days early.

⚠️ **Time in zone is ACCUMULATED, never derived from a stored series.** Five running totals answer
the whole zones panel; keeping every sample so the phone could add them up costs hundreds of numbers
per run against a 50-run store to answer the same question. Both sides accumulate:
`WorkoutManager.accumulateZone` (watch, from the ticker's **running** branch only) and
`window.__interunCompanionHR` (phone). **Both must skip paused time** — the companion watch has no
idea the phone is paused and keeps streaming, so without the `LIVE.pauseStart` guard the zone totals
exceeded the elapsed time printed on the same screen. The boundaries (50/60/70/80/90% of max) exist
in **three** places — `HR_ZONE_FLOOR`, `WorkoutManager.hrZone`, `estimateHrZones` — move all three
together. ⚠️ The watch's `hrZone` returns 0–5 and the panel is 1–5, so zone 0 folds into index 0:
time below 50% is still time on your feet.

⚠️ **`run.steps` is a SNAPSHOT, not a lookup.** `sessionStepText()` stores the prescription at save
time. Re-deriving it from the run's date later would describe the run with whatever session now sits
there — `adoptPlan()`/`applyTrainFlag()` rebuild the plan. Same reasoning as stamping `pband`/`rband`
/`pmodel`. It shares `structureRows(steps, plain)` so the grouping logic is not duplicated; **in
plain mode the label stays RAW**, because `runDescriptionHtml` escapes it again (double-escaping
showed "Bodyweight strength &amp;amp; mobility").

⚠️ **The heart-rate SERIES is captured, and it is bounded at source.** `hrTrack` on the watch and
`LIVE.hrSeries` on the phone sample one `[metres, bpm]` pair every 5 s of *running* time, capped at
160 points by even thinning that keeps the first and last (dropping the last ends the chart before
the end of the run). Measured 1.7 KB/run — 50 runs ≈ 85 KB; the route is still the large field.
- ⚠️ **Paired with DISTANCE, not time** — the chart is drawn across the run, and on a time axis every
  pause is a plateau.
- ⚠️ **A TREADMILL RUN STORES NO SERIES.** It records a real clock and deliberately no distance, so
  every sample sits at metre zero with no axis to draw against — and `applyTreadmillDistance` sets a
  TOTAL, which cannot say which beat happened where. `hrSeriesOrNull()` is the one gate for both
  writers and refuses a series whose distance never advances.
- ⚠️ **`WorkoutManager.heartRate` IS NEVER CLEARED.** HealthKit simply stops delivering when the
  watch loses skin contact, so *polling* it is not evidence of a reading. Sampling it unguarded
  charged the whole dropout to the last beat seen: measured, a strap loosening 20 min into an hour
  fabricated **two thirds** of the trace and drew as a genuinely steady effort. `heartRateAt` is
  stamped when a reading ARRIVES and samples older than `hrFreshSec` (15 s) are skipped, so a
  dropout leaves a gap the polyline bridges as a diagonal — which is what the event-driven phone
  path already did. Two writers of one field must agree on what counts as a reading.
- `hrChartSvg` takes BOTH baseline corners from the data (a literal left edge drew a shaded wedge
  with no line above it whenever the first reading arrived after the start), drops the average
  gridline when it would collide with the peak label, and uses `--ink-faint` not `--line` for the
  gridlines — `--line` is a hairline *border* token and measured 1.05:1 against the tinted fill.

⚠️ **Every stat tile is conditional.** Elevation is 0 on a watch run unless the watch sent it, HR is
null on a phone run with no watch, calories only exist when measured. A tile appears when there is
something true to put in it — a confident "0 m" reads as a measurement rather than an absence.

⚠️ **A list INDEX is not a handle.** `state.logged` is unshifted whenever a watch run arrives, so
`state.viewRunIdx` can point at a different run by the time the runner rates it or writes a note.
`state.viewRunId` + `viewedRun()` resolve by id.

⚠️ **Notes: keep the TEXT synchronously, debounce only the disk write.** Holding it in a 400 ms timer
meant any re-render inside that window rebuilt the textarea from the old value — and tapping an
effort number, an inch away, re-renders. Before the run is saved the note parks on `LIVE.summary`
and rides out through `liveRunRecord`, the same route `rpe` takes; without that, Save discarded it
under a hint promising the opposite.

The RPE picker is now on the Logbook screen too — gating it to the finish screen meant a rating
skipped in the moment could never be given, and it is half the flags engine's evidence.

**Not built, deliberately:** the heart-rate line chart (needs a per-sample series that exists
nowhere — an average is one number and a chart needs hundreds; an empty chart is worse than none),
and from the reference the points badge and the thumbs-up rating (a backend, a network, and a button
with nowhere to send its answer).

⚠️ **The Strava link WAS on that list and no longer is — see the Strava section below (2026-08-09).**
It is on the run's own page as *Send to Strava*, beside *Share my run*. What made it possible was
accepting the backend: `alfie-proxy/` holds the client secret, because nothing else can.

**Known, pre-existing, not fixed:** `SHARE_INSIGHT` prints fixed praise keyed only on session type —
an easy run always gets "Aerobic fitness building exactly as planned" whether it hit target or ran
60 s/km too fast. That breaks the project's own no-unconditional-praise rule, and putting Share next
to the debrief on one screen makes the contradiction visible. Feed it `runAnalysis`.

The Activities tab is now **Logbook** (`TITLES.activities`), which covers runs, strength and progress
rather than only runs. MAS was removed from Performance — it is a reference for setting interval
paces, not a measure of progress; `masCard()` is kept but unused.

**Adaptive flags + RPE (Road Map phase 4, shipped):** the app now asks *"How hard did that feel, 1–10?"*
after every run and watches for two signals over **2+ consecutive sessions** — pace consistently
outside the prescribed band, and reported effort consistently outside the intended RPE band. Detection
lives in the engine (`src/adapt/training-flags.ts`, 21 tests, exported via `web/entry.ts` as
`RC.assessTrainingFlags`); the app never changes a plan silently — it raises a Today banner carrying its
evidence ("your last 2 sessions came in about 24s/km faster than their target pace") and the runner
taps *Adjust my plan* or *Not now*.

Design rules baked in, each of which cost a real bug when it was missing — don't unpick them:
- **Direction sanity.** A suggestion is dropped unless the proposal genuinely lies on the side the
  evidence points to. Clamps (±15%, and an absolute 600–3600s) can otherwise invert it, so a very slow
  runner got an "ease off" that made every pace *faster*.
- **Anchor stamping.** Each logged run stores the `anchor` (`recentTimeS`) it was judged against, plus
  its `pband`/`rband`/`rpe`. `flagObservations()` stops at the first run from an older anchor — once the
  plan is re-anchored, deviations it already accounts for are history, not evidence.
- **Per-kind muting.** The pace and RPE flags can rest on *different* newest runs (the engine skips
  non-qualifying runs rather than breaking a streak), so each kind is muted at its own evidence id in
  `interun_flagmute`. One shared id let a just-declined banner re-raise with nothing new.
- **One voice.** Raising a flag clears `fitSuggest` and `paceNotice`; every non-raising path clears any
  pending flag, so a banner never outlives its evidence.
- **Seeded anchors stay quiet.** Gated on `!profile.autoPace && !profile.noRecent` — quoting a beginner
  a 5K time they never ran (and then having auto-calibration overwrite what they agreed to) is worse
  than silence.
- **Accepting must stick.** `applyTrainFlag` scales `oneKmS` with the anchor (`applyProfile` takes
  whichever implies the faster 5K, so an un-scaled trial silently cancelled the change) and restores
  today's ticks around `seedDone()` via `todayTicks()`/`restoreTicks()`.
- **RPE stays answerable after Save** — the picker writes through to the logged run. Gating it on
  `!saved` starved the whole signal for anyone who taps Save first.

## THE POST-RUN DEBRIEF, REBUILT TO A COMMISSIONED PACK (2026-08-16)

`~/Downloads/InteRun_Claude_Implementation_Pack` — a binding contract, a spec, an acceptance
checklist and three authoritative reference PNGs. Owner's four decisions at preflight: **Logbook page
only**, wording **"View next run"**, **persist cadence**, **privacy in scope**.

⚠️ **THE PACK IS WRITTEN FOR A NATIVE SwiftUI APP AND THIS DEBRIEF IS WEB.** Most of it translates
(offset-driven opacity, gradient blend, sticky header, one scroll owner). Three things do not, and
they are recorded as deviations rather than quietly satisfied: MapKit snapshots (we use the existing
cached raster composite), Dynamic Type to Accessibility 2 (`--tscale` is clamped 1.0–1.3 because the
app is full of fixed-height controls), and a feature flag (the project has no such mechanism).

⚠️ **THE FINISH SCREEN AND THE LOGBOOK NOW LOOK DIFFERENT, AND THE CONTENT IS STILL BUILT ONCE.** The
standing rule is that the two must never disagree about the same run. Splitting the presentation
reopens exactly that risk, so both read `runAnalysis` and the same stored fields; only the layout
differs. `runOverviewHtml` is untouched and still serves `viewLiveComplete`.

⚠️ **THE ZONE COLOURS ARE `--hz1..--hz5` VIA THE SHARED `.hz-bar` COMPONENT** — the same source as
Support › Training zones, the same `HR_ZONE_FLOOR` boundaries and the same `maxHrEstimate()` ceiling.
The reference's teal placeholder bars are not reproduced and no zone hex exists in the debrief. The
token name is **built from the loop index**, so there is no literal `--hz3` to grep for — which is
stronger than five literals, because a hand-written list of five can list four. `test/run-debrief.test.ts`
asserts the construction, and three deliberate re-breaks (a local hex, an accent fallback, deleting
`--hz3` from one theme block) were each watched failing the blocker guards.

⚠️ **REDACTION TRIMS THE LINE; IT DOES NOT HIDE THE PINS.** A polyline still ending at the runner's
front door is not private however many markers are removed. `redactRouteEnds` drops points within
250 m of each end — measured on the fixture, the start moved 254 m and the end 267 m. And the hero,
the tile loader and the share sheet all call **one** `runRoutePresentation`, because two copies would
mean a redacted map on screen and a full one in the picture that gets posted.

⚠️ **CADENCE WAS RECEIVED AND NEVER SAVED,** so no run in the store has ever carried it and the
reference's cadence tile could not have been filled by any real run. It is accumulated like `avgHr`
(paused time skipped, the zone-totals rule) and stored as **null, never 0** — a stored zero renders
as a measurement of somebody standing still.

⚠️ **MY OWN FIXTURE'S `pband` SHAPE WAS WRONG AND IT LOOKED LIKE A PRODUCT DEFECT.** The real field is
a `PaceRange` (`{minSecPerKm, maxSecPerKm}`); I seeded `{min, max}`, every chart coordinate became
NaN, and the pace panel rendered as six dots with no line. Same trap this file already records: a
plain probe has no typechecking, so it can feed the app a shape no caller can produce. Check the shape
before believing a rendering fault.

⚠️ **THE BAND-GAP IMAGE COMPARISON IS CONFOUNDED BY CONTENT AND MUST NOT BE QUOTED AS A VERDICT.**
`tools/debrief-diff.py` finds text bands and compares gaps between them — but the build's bands are
not the same ELEMENTS as the reference's (different wording, an extra plan section, two "what went
well" items against three), so band *i* is often a different thing in each. It is useful for spotting
gross geometry error and useless as a pass/fail number. The transition, by contrast, IS checkable and
matches the pack's formula exactly: opacity 1 to 48pt, 0.49 at 160pt, 0 and hit-testing off at 268pt,
reversible at identical offsets in both directions.

`tools/debrief-shots.mjs` captures the three states headlessly at the reference's 450×954 canvas.
⚠️ It emulates a **44pt status bar**, which the reference PNGs include and a headless viewport does
not — without it every landmark reads 44px high and the systematic error hides the real ones.
