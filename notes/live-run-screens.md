# The phone-recorded run's screens (start, live, finish)

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE TWO SCREENS A PHONE-RECORDED RUN BEGINS AND ENDS ON (owner's annotated references, 2026-08-21)

He photographed another app's start screen and drew arrows at what he wanted, then its finish screen:
*"The second screenshot shows what starts when you select for the run to be recorded on the phone rather
than the watch (I have drawn a number of things on top of that screenshot for you to review and
implement) ... The third and forth screenshots are the end screen"*.

**THE START SCREEN — `viewLiveStart`.** `viewLive` already had a not-started state (a hero, "Press start
when you're ready" and one button); this is its own composition now: the session's first step over its
title, the three numbers at zero, a map centred on where the runner is standing with zoom / voice /
recentre on it, the GPS signal as four bars **and** the metres, an active-shoe chip, and one Start.
- ⚠️ **THE NUMBERS ARE AT ZERO IN THE SAME PLACES THE RUN SHOWS THEM**, so nothing moves when it starts —
  the screen fills in rather than rearranging.
- ⚠️ **THE TREADMILL DOES NOT COME HERE** (`!running && !LIVE.indoor`). No position to draw, no signal to
  report, nothing to recentre.
- ⚠️ **THE SIGNAL SHOWS NOTHING WHEN THERE IS NO FIX.** One lit bar and no fix are different situations
  needing different reactions — a weak signal is something to wait out, no signal may mean permission was
  refused — and the metres stay beside the bars because this project's history is full of plausible
  readouts that hid the fault.
- ⚠️ **THE SHOE CHIP IS HERE BECAUSE THE MILEAGE IS STAMPED AT SAVE TIME FROM WHATEVER IS ACTIVE THEN.**
  Before the run is the moment to set it; a run saved against the wrong pair moves real distance onto the
  wrong shoe, which is the one thing the Shoe Rack exists to get right.

⚠️⚠️ **THE MAP WAS WRITTEN CALLING `loadRouteMap` DIRECTLY AND `test/route-map-cache.test.ts` CAUGHT IT.**
That guard asserts the tile fetcher has exactly ONE caller, because a second caller re-fetches billed
tiles on every view — the bill the whole draw-once design exists to prevent. `routeMapFor` now takes an
explicit FRAMING, so a point map gets the IndexedDB cache, the one-way CARTO fallback and the provider
carried back for attribution, all of it unchanged. `liveMapFor` is four lines.
- ⚠️ **KEYED ON THE FRAMING** (`pt|z|originX,originY|WxH|provider:style`), because a point map's identity
  is where it is centred and how far in it is zoomed, and the pixel origins already carry both.
- ⚠️ **IT DOES NOT FOLLOW THE RUNNER**, and `drawLiveMap` returns immediately once `LIVE.started`. A map
  that tracked a run would be a tile fetch every few seconds for its whole length.
- ⚠️ **AND THE POSITION IS ROUNDED TO ~20 m IN THE IN-MEMORY KEY.** A fix jitters constantly and this
  screen can sit open for minutes; keyed on the raw coordinate it re-fetches the same picture several
  times a second. ⚠️ **The guard for that had to be restated**: asserting `LIVE.mapKey` merely APPEARS in
  the function is satisfied by the assignment, so deleting the early return that reads it escaped.
- ⚠️ **THE ATTRIBUTION IS THE PROVIDER THAT SERVED THE TILES** (`mapAttributionFor(r.prov)`), never the
  one `mapProviderFor` would prefer — the licence breach this file records making once already.
- ⚠️ **THE CENSUS IN `route-map-cache.test.ts` IS NOW 4, NOT 3**, and it is a census of consumers rather
  than a cap. `loadRouteMap`'s own caller count stays at 2.

**THE FINISH SCREEN.** It already had the debrief, the notes, Discard and Save; what the reference adds is
a **workout name**, the session's **description**, and a **sync block**.
- ⚠️ **THE NAME IS NOT NEW STORAGE.** A run has always carried `run.t` from the prescription; this is the
  first time it can be changed. Blank falls back to the title — a run called nothing is unfindable in the
  Logbook — and it parks on `LIVE.summary` until Save, like the note and the effort rating, because
  `liveRunRecord` rebuilds the record on every render of that screen.
- ⚠️ **THE DESCRIPTION IS READ-ONLY.** It is what the session ASKED for; letting it be edited would leave
  the Logbook describing a run against a prescription that never existed, which is what the `run.steps`
  snapshot rule already protects.
- ⚠️⚠️ **THE STRAVA SWITCH IS THE SWITCH THAT ALREADY EXISTED, AND WRITING A SECOND ONE WAS THE MISTAKE.**
  `stravaCfg().auto` is what `stravaMaybeAutoSend` reads at save time and Connections has had a control
  for it since the Strava work — a new `interun_stravaauto_v1` key would have given one preference two
  homes with only one of them deciding anything. ⚠️ **And the guard against it first matched its own
  neighbours' NAMES** (`stravaAutoSend`/`stravaAutoSet` both contain "stravaauto"), reporting the fix as
  the defect: sixth firing of the guard-trips-on-its-own-vocabulary trap. It matches the KEY now.
- ⚠️ **APPLE HEALTH IS NAMED AS NOT BUILT RATHER THAN GIVEN A DEAD SWITCH.** Writing to Health is an
  `HKWorkout` save needing a share entitlement and native code. A toggle for it on the one screen where a
  runner decides whether their run was recorded anywhere is the worst possible place for an inert control,
  and this project has shipped that defect three times.

`test/live-screens.test.ts` holds seven guards. **Nine deliberate re-breaks, and two escaped the first
version of their guard**: the button sweep flagged `#lMapWrap` — a container — as unwired, and the map-key
guard was a presence check. Both restated and re-broken.

## THE PHONE-RECORDED RUN'S START SCREEN, TO HIS MOCKUP (owner, 2026-08-24)

*"On the the run where the user has chose the option to record on the phone, i want the run screen to
look like this. key features are: 1. Type of run/session as the main title / 2. stats of distance, time
average pace (in a line at the top) / 3. Option to set their shoe from the rack / 4. Strength of the
live gps signal / 5. Live map with current live location marker"*

Suite 1300 → **1313**; 20 deliberate re-breaks, 18 caught first time and the two misses were ambiguous
anchors that never applied (below). Web-only apart from one Swift line, so all of it reaches his phone
on the next launch.

### ⚠️⚠️ THE RUNNER HAD NEVER LANDED ON THIS SCREEN, WHICH IS WHY TWO OF HIS FIVE FEATURES WERE ABSENT

`viewLiveStart` existed and had a not-started state. Nothing reached it: `wireStartWhere`'s phone branch
called `startSession(sess)` and then `runCountIn(beginLive)` in the same breath, so choosing "This
iPhone" counted 3-2-1 and started running. The screen was reachable only by the live pill, mid-run, by
which point it renders the running layout instead. **A screen nobody lands on is a screen whose features
nobody can miss**, and that is the whole explanation for features 4 and 5.

⚠️⚠️ **AND FIXING THE LANDING WAS NOT ENOUGH, BECAUSE EVERY WRITER OF THE RUN'S POSITION LIVED INSIDE
`beginLive`.** `startGps` sets `LIVE.lastLat` and in the same breath sets `LIVE.mode`, `LIVE.startMs`
and calls `rt.start` — so the only way to have a position was to have already started running.
`drawLiveMap` returned at its null check and `gpsBarsHtml` saw `acc == null`: a bare panel and nought of
four bars, on the two features he named last. `liveStandbyGps` opens a `watchPosition` **before** the
run, writing only `lastLat`/`lastLon`/`acc`, and a test now sweeps every writer of `LIVE.lastLat` and
requires one outside the run.
⚠️ **IT WAS INVISIBLE TO MY OWN PROBES BECAUSE THEY SET `LIVE.lastLat` BY HAND** — the documented trap
of feeding the app a shape no caller can produce, so the map drew, the bars lit, and the screen
certified itself. Found by a critique agent reading the writers instead. **A probe that constructs the
state under test proves the renderer works and says nothing about whether anything reaches it.**
⚠️ **AND THE GUARD FOR IT ESCAPED ITS FIRST RE-BREAK**: deleting the CALL to `liveStandbyGps` left the
function defined and outside `startGps`, so the writer sweep stayed green with the screen bare again. A
builder proves a shape exists; only the caller proves the runner reaches it.
⚠️ **THE STANDBY MUST NOT LOOK LIKE A RUN.** `LIVE.mode` is what makes the whole distance pipeline live,
so the sweep forbids `LIVE.mode =`, `LIVE.startMs =`, `rt.start(`, a wake lock and the pedometer inside
it; the arrival is re-guarded as well as the subscribe, because a fix can land after Start.
⚠️ **AND IT IS STOPPED ON THREE EXITS** — `beginLive` before opening its own watch, `stopLive` when the
runner walks away, and `visibilitychange` when the app is hidden. That last one is not tidiness: a
staged run can sit on this screen indefinitely and a high-accuracy watcher holds the radio and the
location indicator on for all of it, for a run that has not begun.

### THE FIVE FEATURES, AND WHAT EACH ONE COST

1. **The title is the session**, at `--t-display`, uppercase, in the session's own effort colour through
   `sessionEffort` — the one mapping ruling 7 established, mixed 60% with `--ink` so it clears AA on the
   card rather than being the raw category tone.
2. **Three numbers in a line at the top**, at zero, in the same places the running screen shows them, so
   nothing moves when the run starts — the screen fills in rather than rearranging.
3. **The shoe chip** (see the strand below).
4. **The signal as four bars AND the metres.** ⚠️ **THE GATE IS "IS THERE AN ACCURACY", NOT "IS THE RUN
   IN GPS MODE"** — `LIVE.mode` is set only by `startGps`, so a mode check is what kept the bars dark on
   a phone holding a perfectly good six-metre fix. `acc == null` already excludes the treadmill and a
   refused-GPS run, which is all the mode check ever protected. The number stays beside the bars because
   this project's history is full of plausible readouts that hid the fault.
5. **A live map with the runner's marker**, full-bleed, through `routeMapFor` with an explicit framing.
   ⚠️ **`test/route-map-cache.test.ts` CAUGHT MY FIRST VERSION CALLING `loadRouteMap` DIRECTLY** — that
   guard asserts the tile fetcher has exactly one caller, because a second one re-fetches billed tiles
   on every view, which is the bill the draw-once cache exists to prevent. `liveMapFor` is four lines.
   ⚠️ **The position is rounded to ~20 m in the cache key**: a fix jitters constantly and this screen can
   sit open for minutes, so keyed on the raw coordinate it re-fetches the same picture several times a
   second. The consumer census in that file is now **4**, and `loadRouteMap`'s own caller count is still 2.

### ⚠️⚠️ @container ADDS NO SPECIFICITY, AND THAT TRAP FIRED TWICE IN ONE AFTERNOON

Both times the fix measured as a **no-op** while every diagnostic said it should work — the query
matched, `container-type` was right there in the computed style, and the declaration simply did not
apply, because an identical selector ties at the same specificity and **the later rule wins**.
- The narrow-column type drop sat above `.lst-nums .lv`: the container reported its 288px and the value
  stayed at 24px with the column still overflowing.
- The short-map block sat above `.gps-sig`: the signal pill kept its `bottom` and stayed drawn under the
  control row, overlapping it by **47×33** at the largest text size.

`test/design-system.test.ts` now derives the claim over **every** `@container` block in the stylesheet:
for each selector inside one, if the identical selector exists as a bare rule, the block must come after
it. **No specificity arithmetic is needed** — identical selectors have identical specificity, so source
order alone decides, which is what makes the guard exact.

### THE WORST CASE IS THE LONGEST TITLE ON THE SMALLEST PHONE AT THE LARGEST TEXT SIZE

Measured with the session library's longest title (*"Mona fartlek: 2 x (90/60/30/15s hard, equal
float)"*) at 320×568 with `--tscale` at its 1.3 cap: the title took **six lines**, the card grew to 413px
of a 506px view, and the map collapsed to **18px** with **five of the seven controls clipped out of it
and unhittable**. Every one of those controls was rendered, styled and wired at the moment none of them
could be pressed — the looks-live-is-inert class wearing a layout disguise.

| | before | after |
|---|---|---|
| map height, worst case | **18px** | **117px** |
| card height, worst case | 413px | 322px |
| unhittable controls | 5 of 7 | **0** |
| numbers overflowing their column | 2 of 3 | **0** |
| page horizontal overflow / view scroll | 0 / 0 | 0 / 0 |

⚠️ **A TITLE IS THE ONE THING ON THIS SCREEN WHOSE LENGTH THE APP DOES NOT CHOOSE**, so it is clamped to
three lines. And the clamp is inert without all three declarations (`-webkit-box`, the vertical
orientation, `overflow: hidden`) — three that must travel together is three chances to keep one and lose
the effect with nothing failing.
⚠️ **THE NUMBERS NEVER WRAP, and the unit is two rungs under the value.** A value that wraps takes a
second line and lifts the whole card into the map. At 320 with `--tscale` 1.3 a column is 91px and
`0.00KM` needed 95 — a 3–4px spill into an 8px gap, so nothing collided and nothing clipped, which is
exactly why it survived a look. The narrow-column container query drops the value to `--t-section` at
320 alone; at 375 the row is 343px and at 430 it is 398px, both untouched.
⚠️ **ON A SHORT MAP THE CONTROL COLUMN BECOMES A ROW**, and that creates a **second obligation**: the
signal has to get out of its way. Both sat at `bottom: --s3`. The control size is now one token read by
the button and by the signal's lift — two literal 38s is how the row grows and the pill stops clearing
it, with nothing to see until they touch.

### ⚠️ EVERYTHING THAT FLOATS ON THE MAP IS DEEP INK, AND `.lst-target` WAS THE SIXTH TO NEED IT

Both run basemaps are **light** — median relative luminance 0.876 across 14 real voyager tiles, 0.00% of
pixels below L 0.10 — so a control filled from `--surface` has an edge around **1.05:1**. Five marks had
already been moved off that fill; the target pill, a 44px-tall full-width control at the top of the map,
still wore it. ⚠️ **Its LABEL was always legible, which is why it survived a look: the failure is the
container, not the copy.**
⚠️⚠️ **AND MY GUARD FOR THAT NAMED THREE SELECTORS BY HAND AND OMITTED IT.** The set is now derived from
the builder's own map region **plus one level of markup helpers** — the shoe chip and the signal are
built by functions the region calls, so a derivation that reads only the builder's string finds neither.
The two the map drawer adds are asserted positively rather than swept, with their reasons: the location
marker is the accent **because** it must not read as a sixth control, and attribution is a licence term
whose conventional treatment is a light plate.

### ⚠️⚠️ THE SIGNAL QUOTED A READING OF ANY AGE — the `WorkoutManager.heartRate` trap again

`LIVE.acc` is never cleared. CoreLocation simply stops delivering indoors, exactly as HealthKit stops
delivering when a strap loosens — so the badge sat at *"GPS · ±4 m"* over four lit bars with the last fix
minutes old: **confidently wrong, on the one control whose entire job is to tell the runner whether to
wait.** `gpsAccNow()` is the one reader and `GPS_FRESH_MS` is 20 s.
⚠️ **THE STAMP IS TAKEN AT ALL THREE WRITERS, and the guard counts them against each other.** Two are the
live run and one is the standby watcher; a stamp at one is a freshness rule that holds before Start and
not during the run, or the other way about.
⚠️ **AND THE FAILURE PATH HAS TO REPAINT, or the gate is invisible.** Nothing else on this screen ticks
before the run starts, so a gate with no repaint behind it leaves the stale number exactly where it was.
`watchPosition`'s own 20 s timeout raises that callback, which is the mechanism — no extra timer.

### ⚠️⚠️ THE SHOE CHIP STRANDED THE RUNNER, AND THE LIVE PILL CANNOT SAVE THEM

The chip set `state.tab = "profile"` and navigated to the rack. A staged run has `LIVE.started === false`,
so `liveRunning()` is false and **the live pill — the app's one route back into a run — never appears**;
and the handler skipped `stopLive`, so the staged session survived with nothing able to reach it and the
next bottom-nav tap threw it away. Tap the shoe, land on your rack, run gone.
⚠️ **PUTTING THE WHOLE RACK IN A SHEET TRADES A STRAND FOR A DEAD SHEET.** `shoeRackView` renders an
`id="shoeAdd"` that the Performance screen also renders, so `$()` resolves the wrong one and the sheet's
own add button is wired to nothing. What this screen needs is the one question it is actually asking —
**which of my pairs am I in** — so that is all it asks.
⚠️ **`setActiveShoe` IS ONE DEFINITION READ BY TWO SCREENS.** It was open-coded inside `wireShoeRack`; a
second copy is how the rack and the start screen come to disagree about what "active" means, which is
the fix-one-builder-not-the-other trap this project has paid for six times.
⚠️ **THE GUARD FOR IT WAS TOO BROAD ON ITS FIRST RUN AND FAILED ON CORRECT CODE.** Forbidding every
`.active =` outside the setter trips on **retiring** a pair, which legitimately sets it false in the same
breath as its `retiredIso`. Retiring is not choosing, so `false` is allowed anywhere and every other
value must come from the setter.
⚠️ **EVEN THE EMPTY CASE NEVER LEAVES**: `openShoeSheet(null)` ends in `closeSheet(); render()`, goes
nowhere, and its first pair is active by construction.

### THE FREE RUN, THE TARGET PILL, AND A PRE-EXISTING WRIST DEFECT

The mockup carries two controls outside his five. Both were built, both narrowly.
- **A free run is stepless**, typed `easy`, and carries no band — so `runAnalysis` correctly says there
  is nothing to judge it against rather than judging it against a session the runner declined. Proved
  through the real engine rather than argued.
- **"Add target / workout" is a button, not a second builder.** It reuses the existing one and
  `liveSetTarget` attaches the result to the run in hand — ⚠️ **it does NOT call `addExtra`**, which would
  add a session to the plan the runner never asked for.
- ⚠️⚠️ **AND A WRIST FREE RUN WAS BEING CREDITED TO WHATEVER THE PLAN HAD THAT DAY.** `ingestWatchRun`
  fell back to the day's prescribed session for its title, its band and its steps — so a runner who
  chose to run by feel was told, in their own logbook, that they had run their threshold session 40 s/km
  too fast, and the flags engine counted it as evidence. Pre-existing, unrelated to the mockup, found
  while proving the free run's own record. `run.title` absent is the discriminator.
  ⚠️ **The page half ships now; the Swift half (`WorkoutManager.summaryPayload` omitting the title on a
  free run) needs an Xcode build.**

### Two re-break misses, both ambiguous anchors, and the lesson is the same one twice

18 of 20 caught first time. Neither miss was a weak guard: one anchor did not exist in the file at all
and one existed **three times**, so the edit landed in a different function and the break was never
applied. ⚠️ **A re-break whose anchor is not unique silently tests nothing and reads as an escape** —
the same class as this file's note about a block landing in the wrong function and building cleanly.
Scope the edit to the function under test, and confirm the built page actually changed.

### What is deliberately NOT built, and it should be flagged rather than inferred

⚠️ **THE MOCKUP'S SETTINGS GEAR IS NOT THERE.** Everything it could honestly hold is either already on
the screen (the voice toggle is one of the four map controls) or does not exist for a phone run — there
is no phone auto-pause, no lap-haptics setting, no always-on. A gear opening a sheet of one real control
plus three that do nothing is the class this project has shipped three times, and the watch settings
already carry the rule: **no toggle ships before the feature behind it exists.**
⚠️ **AND THE RUNNING SCREEN IS UNCHANGED.** His mockup is the screen a run **begins** on. The layout
while running is still `.live-metrics` / `.live-paces`, which is a separate piece of work he has not
asked for — do not assume this chapter restyled it.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks (block 1's
214 backticks are the minified engine and identical at HEAD), `npx tsc --noEmit` clean apart from the one
pre-existing `test/onboarding-wizard.test.ts` Date overload, **1313 pass / 0 fail under UTC,
`TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`** with `CHROME_PATH` set, both design ratchets
unchanged, and `CSS_DUP_CEILING` 17 → **18** for `.gps-sig` — a base plus an `@container` override, which
is the category that ceiling exists to permit and the one case that **cannot** be merged the way
`.club-win` was. Test titles accounted for one by one: **13 added, 0 removed**, across three files.
Driven end to end in a real browser at 430×932 and 320×568, `--tscale` 1.0 and 1.3, both themes: all five
features present, nothing self-starting, Start always on screen, view scroll 0, page overflow 0, no two
floating controls overlapping in any of eight states, and **zero console errors**.

## ONE SCREEN FOR THE WHOLE SESSION, AND THE BUTTON ON THE MAP (owner, 2026-08-24)

*"I want the first screenshot to be the screen that stays on for the entire session, not moving to the
second screenshot. Also, the start button needs to sit on top of the map, rather than how you have it"*
— with the start screen he had just approved, and the old `.live-metrics` layout it switched to at Start.

⚠️ **THIS REVERSES A DECISION RECORDED TWO DAYS EARLIER.** The start-screen chapter above closes with
*"AND THE RUNNING SCREEN IS UNCHANGED… a separate piece of work he has not asked for"*. He has now asked
for it. `viewLive`'s gate went from `!running && !LIVE.indoor` to `!LIVE.indoor`, and the guard that
asserted the old gate was **inverted rather than deleted** — what it protected survives intact.

⚠️ **THE TREADMILL IS THE ONE EXCEPTION AND IT IS NOT A CONCESSION.** An indoor run records a real clock
and deliberately no distance, so it has no position to draw, no route, no signal to report and nothing for
the map controls to act on. The screen he drew is a map with numbers over it; there is no map. So
`.live-metrics` stays, and a guard asserts it stays — deleting it would take the indoor run's only screen
with it.

### ⚠️⚠️ THE WHOLE OVERLAY WAS INVISIBLE, AND THE CHECK THAT FOUND IT HAD BEEN REPORTING IT ALL ALONG

Everything that used to be a card below the map is now an in-flow child of the map, so the actions sit on
it. **An absolutely positioned box paints above a STATIC sibling whatever the source order** — so
`.lst-mapimg`, the composited basemap, covered the signal row, the control column, the step card and the
buttons. They were not merely untappable, they were **behind an opaque map**.
⚠️ **`elementFromPoint` AT THE CENTRE OF EACH CONTROL IS WHAT FOUND IT, AND IT HAD SAID SO FROM THE FIRST
MEASUREMENT OF THIS SCREEN** — every probe run since the screen was built reported `unhittable: 1` and I
did not chase it, because Start looked fine in a screenshot-free harness. **A non-zero count in a check
you wrote is not noise.** Fixed with `z-index: 0` on the image and `position: relative; z-index: 1` on the
two in-flow wrappers; a guard asserts all three, because a z-index without a position does nothing.

### ⚠️ THE OVERLAY SHEDS CONTENT IN A STATED ORDER, BECAUSE IT DOES NOT FIT

Measured with the library's longest title at 130% text, running:

| | before shedding | after |
|---|---|---|
| 430×932 overlay / map | 348 / 546 (**64%**) | 285 / 546 (52%) |
| 375×812 overlay / map | 348 / 426 (**82%**) | 246 / 426 (58%) |
| 320×568 overlay / map | **358 / 170 (210%)** | 182 / 247 (74%) |
| visible map, worst case | **−200 px** | **+53 px** |
| controls unhittable, worst case | **6 of 7** | **0** |

⚠️ **THE ORDER IS THE INVARIANT, NOT THE THRESHOLDS.** Shed what a runner can do without, never what they
act on: the cue log first (it is spoken aloud anyway), then Current and Lap (the three numbers that matter
are in the card above), then the step's target and step-count lines. The badge, the heading, the progress
bar, the control column and the buttons never go — a control hidden or clipped while still rendered,
styled and wired is the looks-live-is-inert defect this app has shipped twice. Guarded by comparing the
thresholds against each other rather than pinning any of them, and by a list of what may never be shed.

⚠️ **THE CARD GIVES WAY BEFORE THE OVERLAY DOES, because the card is what is oversized.** At 320×568 with
130% text a display-sized title over three lines measured **322 px of a 494 px view** — right on a big
phone, most of the screen on a small one. A `@media (max-height: 720px)` block clamps it to two lines with
the numbers a rung down and gives the map back ~120 px. **A media query, not a container query: what
decides this is how tall the phone is, not how tall the map ended up.**

⚠️ **AND THE COLUMN→ROW THRESHOLD WAS MEASURED TOO LOW AT 260 px.** The control column is four 38 px
buttons and three gaps = 184 px, and it now sits IN FLOW above an overlay up to 285 px tall — so the map
needs about 470 px for a column to fit, and at 426 px the top button was clipped out of the map while
remaining rendered and wired. **440 px** is above every measured overlay-plus-column that does not fit and
below every one that does.

⚠️ **THE SIGNAL AND THE CONTROLS ARE SIBLINGS IN ONE FLEX ROW NOW, so the overlap the previous chapter
fixed with a container-query lift is impossible rather than corrected** — and that lift, plus the two
owners of one measurement it created, is gone. `.gps-sig` therefore LEFT the duplicate-class list while
`.lst-card`, `.lst-nums` and `.lst-ctrls` joined it (each a base plus one query override, which cannot be
merged because a query is a separate block): `CSS_DUP_CEILING` 18 → 20 with the arithmetic written down.

### ⚠️ EVERY id THE LIVE RUNTIME TOUCHES MUST BE ON THE SCREEN, AND THE FIRST GUARD FOR IT MISSED TWO

`liveUpdate` writes `#lElapsed`, `#lDist`, `#lPace` and `#lStepCard` **unguarded** — `.textContent` and
`.innerHTML` straight onto the result of `$()`. A running layout missing any one throws on the first tick,
a quarter of a second into the run, and the screen freezes with nothing the runner can see.
⚠️ **THE FIRST VERSION TRIED TO IDENTIFY THE UNGUARDED WRITES BY PATTERN AND MISSED TWO OF THE THREE THAT
MATTER**: `#lPace` is written through a local (`const pv = $("lPace"); pv.innerHTML = …`) and `#lStepCard`
is captured in a multi-declarator `const` and written forty lines later. Both re-breaks escaped. The
simpler claim is also the stronger one: **if the live updater reaches for an element, the live screen
renders it** — no pattern-matching on how the write is spelled.

### ⚠️⚠️ THE REBUILD HE ASKED FOR CANNOT BE DONE FROM HERE, AND THE REASON IS ONE MISSING COMPONENT

*"I'd like you to do the rebuild and i don't know why it's vanished."* Diagnosed:
- **node was never broken.** `~/.local/node/bin` is on the default PATH; `node --version` answers. The
  claim in this file was stale and I had repeated it. **Corrected above.**
- **Disk space is not the cause** — 180 GB free.
- **Xcode 26.6 is installed, `xcode-select` is correct, the iOS 26.5 SDK is present, and his iPhone is
  still paired** (`Addo's iPhone (2)`, `00008140-001A3D080A84801C`).
- ⚠️⚠️ **AND THE CONCLUSION DRAWN HERE WAS WRONG — SEE THE CORRECTION OF 2026-08-25.** I read this
  file's own *"use the release one for everything"* note, found the release Xcode refusing every
  destination with *"iOS 26.5 is not installed"*, and reported the rebuild as blocked on a component
  nobody needs. **His phone is on iOS 27 beta and Xcode-beta 27.0 was always the toolchain**, so
  pointing `DEVELOPER_DIR` at it builds cleanly — measured `** BUILD SUCCEEDED **` the same day. The
  release Xcode's missing iOS 26.5 platform is real, irrelevant, and named in an error that reads like
  the answer. **Check `xcode-select -p` before believing a destination error.**
- ⚠️ **`xcodebuild -downloadPlatform iOS` HANGS RATHER THAN FAILING, exactly as this file warns.** Measured:
  **1.75 seconds of CPU in 33 minutes and not one byte transferred** (free space identical before and
  after). It needs root; `sudo` needs a password, which is his to enter and not mine. Worth knowing, and
  it was being run for the wrong reason.

**So the rebuild was never blocked on him at all.** ⚠️ **What genuinely can block a DEVICE INSTALL is the
phone being unreachable:** `devicectl` reports `unavailable` and refuses with `CoreDeviceError 4016` when
a wirelessly paired handset is asleep or off this network. That needs the phone awake and on the same
Wi-Fi. `swiftc -typecheck` over `ios/InteRun/*.swift ios/InteRunShared/*.swift` remains the fallback when
no toolchain is available, and it is strictly weaker than a build — never report a native fix as
delivered on a typecheck alone.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1325 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged. Driven in a real
browser before / running / paused at 430×932, 375×812 and 320×568 at `--tscale` 1.0 and 1.3: the layout
never switches (`.live-metrics` absent in every state), all eleven runtime ids present once running, the
actions inside `#lMapWrap` at every size, **0 unhittable controls and 0 page overflow in all twelve
combinations**, and zero console errors.

## THE TWO REGRESSIONS THE ONE-SCREEN CHANGE CAUSED (owner, same day, within the hour)

*"The map isn't there after it starts and the voice has turned back into the robot"* — both mine, both
caused by the merge above, and both with the same shape: **a rule that was correct while the screen only
existed before the run became wrong the moment the screen served the run.**

### ⚠️⚠️ THE MAP: `drawLiveMap` OPENED WITH `if (LIVE.started) return`

That early return was right and is documented above as right — the map only existed on the screen you
waited on, so following the runner would have been a tile fetch every few seconds for a whole run, billed.
The moment one screen served the session it left **a blank panel for the entire run**.

**The basemap is fetched once and held; the route is drawn over it.** Tiles are re-fetched only when the
runner genuinely leaves the picture (a 15% margin), when they ask with recentre, or when the zoom or the
box changes. So a run costs one basemap per screenful of ground rather than one per 20 metres.

⚠️ **AND THE EARLY RETURN CANNOT BE KEYED ON THE CACHE KEY ALONE.** `render()` empties `#lMap`, so after
any mid-run re-render — a nav tap and back, the pause button, a theme change — every key still matched
while the DOM was empty. The map would have stayed blank for the rest of the session. It checks the
element. Same class of fault as the one being fixed, one layer along.

⚠️⚠️ **AND THE FIRST FIX QUIETLY BOUGHT NEW TILES ON EVERY RE-RENDER.** `liveMapFor` took a position and
derived the framing itself, so a redraw re-centred on wherever the runner had got to — a different
framing, a different cache key, a fresh set of billed tiles. **Visible in the browser as the composite
coming back a `CANVAS` (a new composite) instead of an `IMG` (a cache hit).** `liveMapFor` now takes the
FRAMING, and a redraw that is only replacing an emptied DOM asks for the frame it already has.
⚠️ **THE GUARD FOR THAT ESCAPED ITS FIRST RE-BREAK BECAUSE THE FIXTURE NEVER MOVED THE RUNNER** — with the
position unchanged, re-deriving the framing gives the same answer as reusing it. Fixture-too-kind, in the
one test whose whole subject is which framing was asked for.

⚠️ **THE ROUTE IS DRAWN BY `routeMapSvg`, THE SAME BUILDER THE DEBRIEF AND THE SHARE CARD USE**, handed a
projection built from the frame the basemap was fetched for. A private path-builder here would be a second
answer to "where does this line go", which is the fault that once stretched the debrief hero.
⚠️ **AND THE GUARD FOR *THAT* ESCAPED TOO, because the rig stubbed `routeMapSvg` to return a plain
`<svg></svg>` — indistinguishable from a hardcoded one.** The stub's output is marked now.

⚠️ **THE DOT MOVES; THE OLD ONE WAS PINNED TO THE CENTRE** (`left: 50%; top: 50%`), which is right for a
runner standing still before the start and wrong for every second after it. Positioned from the projection.

### ⚠️⚠️ THE ROBOT VOICE: PAUSING THE ELEMENT REJECTS AN IN-FLIGHT `play()`

`stopLive` learned to call `coachStop` (the fix for the 20–30 second late cue, above). `coachStop` pauses
the shared element — **and pausing ABORTS an in-flight `play()` and rejects its promise.** That rejection
lands *later*, by which time `liveFinish` has set `COACH.current` to the completion prompt, and
`coachFail` read that and **spoke it with the device engine**, over the top of its own clip. So the fix for
one voice defect created another, on the same line of the same run.

⚠️ **A GENERATION STAMP IS THE FIX, AND IT IS THE SAME PRIMITIVE THE NATIVE SHIM'S TOKEN ALREADY IS.**
`COACH.gen` is bumped in `coachPlay` and **before** the pause in `coachStop`; a rejection only counts if
its generation is still current. The ordering in `coachStop` is the whole of it — bump first, then pause,
so the late rejection can see it no longer speaks for anyone.

⚠️⚠️ **AND THERE IS A SECOND ROUTE TO THE SAME ROBOT: THE ELEMENT'S OWN `error` EVENT.** Reassigning `src`
raises `error` for the load being abandoned, on a permanent listener attached to a shared element — so it
too arrives after `COACH.current` has moved on. This file already records that happening once for a
stitched pace sentence; the guard added then (`COACH.seq`) covers only that case, and `stopLive` silencing
the coach immediately before firing the completion cue made the general case fire on **every run**.
⚠️ **`MediaError.MEDIA_ERR_ABORTED` (code 1) IS THE ONLY DISCRIMINATOR HERE**, and it is worth saying why:
by the time the event fires, both the element's `src` and the generation have already advanced, so neither
can tell an abandoned load from a genuine one. Code 1 means the fetch was stopped at our own request; codes
2, 3 and 4 are a real network, decode or unsupported-source failure and must still degrade to speech,
which is the entire purpose of `coachFail`. `coachErr` is the wrapper; the element is wired to it.
⚠️ **AND THE HARNESS WAS WIRING `coachFail` DIRECTLY**, so the fixture would have exercised a program that
no longer exists. Fixed with it.

⚠️ **THE REGRESSION GUARD IS DRIVEN, NOT ASSERTED ON SOURCE, because the whole defect is the ORDER two
asynchronous things arrive in.** Its rig keeps EVERY `catch` handler rather than the most recent one —
the first version kept only the last, so it could only ever reject the line currently playing, which is
not the defect, and it reported the fix as broken. And it asserts the other direction too: a clip that
genuinely fails must still fall back to the device voice, or the guard has traded one silence for another.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1329 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both ratchets unchanged, 4 tests added and none
removed. Driven in a real browser: before start the basemap draws with the dot centred; running, the route
draws with 51 path commands and the dot moves off-centre to follow; after a mid-run `render()` the basemap
comes back as an **IMG** (a cache hit, no tiles) with the frame and the dot held; zero console errors.
