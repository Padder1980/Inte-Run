# The redesign and the design system

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> Tokens, ladders, ratchets, the ui* components, the Support/Logbook/Performance phases. See also DESIGN.md.

## THE REDESIGN (brief 2026-08-08) — PHASE 0 STARTED, TESTFLIGHT HELD

The owner commissioned an Experience Design Brief (20pp, 6 concept screens) and decided the redesign
goes in **before** TestFlight: *"i think the redesign is best before we go to test flight"*. The
phased plan is at https://claude.ai/code/artifact/46e85e7b-bbc3-4ee8-8698-c2916a2e6b40 — read it
before continuing the work.

⚠️ **THE BRIEF REVIEWED DARK SCREENSHOTS ONLY, AND THE REAL DEFECT WAS IN LIGHT MODE.** It scored
accessibility 2.6/5 and asked for 4.5:1 on body text. Measured: in DARK every text token already
passed — the brief's own secondary target (9.33:1) was within a rounding error of what shipped
(9.23:1). In LIGHT, `--accent` measured **4.14:1 on white and 3.64:1 on the canvas** — the primary
action colour, on every button and every link, failing AA. Fixed to `#0c7b70`: same hue, darker.

**Phase 0 slice 1 (tokens + contrast) is in.** Dark moved to the brief's targets; `--ink-faint` was
lifted in both themes (dark 4.32 → 5.25, light 3.30 → 4.56). Every text token now clears 4.5:1 on
canvas, surface and surface-2 in both themes.

⚠️ **THE ACCENT IS BOTH A TEXT COLOUR AND A BUTTON BACKGROUND.** Darkening it until it passes as text
can push the label on top of it the other way. `test/contrast.test.ts` checks both directions.

⚠️ **FOUR PLACES DEFINE THESE TOKENS** — `:root`, the `prefers-color-scheme` block, and the two
`data-theme` blocks. A change applied to three leaves the fourth stale, and which one a runner gets
depends on their OS setting, so it reproduces for some people and not others. Guarded.

⚠️ **AND CHANGING `--bg` IS COUPLED TO TWO OTHER VALUES** — the `theme-color` meta and the first stop
of `--splash-bg`, both per-theme. Miss either and the iOS status strip mismatches the app for the
whole session (documented at length above). Both guarded.

⚠️ **TWO OF THAT TEST'S OWN GUARDS COULD NOT FAIL WHEN FIRST WRITTEN, AND WERE CAUGHT BY RE-BREAKING.**
The media-query check sliced to the end of the DOCUMENT, which contains the `data-theme` block, so
every value was "found"; and the identity check ("green and blue both beat red") is satisfied by a
BLUE — swapping the accent for `#3a7ce8` passed it. Both tightened. Six deliberate regressions were
each watched failing their own guard.

**Phase 0 slice 2 (the ladders) is in.** Measured first: the stylesheet carried **TEN distinct
border-radius values and TWELVE font sizes**, which is the brief's "everything competes" made
countable. `--r-*`, `--s1..6`, `--t-*` and `--tap` are now the ladders, plus a shared `.ui-*`
vocabulary (eyebrow, display, section, pill, bar) generalised from the Shoe Rack, which got there
first by being built to his mockup.

⚠️ **THE 200-ODD OFF-LADDER VALUES ARE NOT REWRITTEN, AND THAT IS THE DESIGN.** A blind sweep across
1,900 lines of CSS is a large regression risk for no visible gain, and this project's history says the
dangerous changes are the ones that look mechanical. `test/design-system.test.ts` **counts the drift
and refuses to let it grow** — 143 off-ladder radii of 225, 323 font sizes of 442, measured
2026-08-08. Migration then happens screen by screen inside the phase that touches that screen.
⚠️ **When you migrate a screen, LOWER THE CEILING to what it then measures.** Leaving it high is how a
ratchet quietly becomes a rubber band.

⚠️ **There were FOUR `:focus-visible` rules in the whole stylesheet** — a keyboard or switch-control
user could not see where they were. Now global, plus per-element for button/a/input/select/textarea
and `[role=button]`. Reduce Motion is honoured **globally**; there were 14 per-component blocks, and a
rule per component is a rule the next component forgets.
⚠️ That last one caught its own test: `indexOf` found the FIRST of the 14 pre-existing blocks, so the
guard failed while the global rule sat two hundred lines below it — and the obvious "fix" would have
been to delete the assertion. It scans all of them now.

**Phase 0 slice 3 (the components) is in, and PHASE 0 IS COMPLETE.** `uiDecisionHero`,
`uiSessionRow`, `uiCoachNote`, `uiReadinessTile` and `uiActionBar` — **31 states across five
components**, every one from the brief's build specification, all exercised by
`test/design-system.test.ts` rather than only the happy path.

⚠️ **THE STATES ARE THE COMPONENT.** "Implement loading, empty, error and accessibility states — not
only the ideal state." A component with one state is a mockup. Specifically guarded: a disabled row
is a `div` with `aria-disabled`, not a button that silently does nothing; a low-confidence note says
**"Low confidence"** in words rather than hedging by colour; a stale readiness score says **when it
was taken**; every session-row status carries a word (Done / Next / Moved / Missed / Optional).

⚠️ **THE RATCHET CAUGHT MY OWN NEW CODE** on its first outing — one off-ladder `font-size: 18px` on a
chevron, which is exactly what it is for.

⚠️ **`.ui-bar-wrap` IS `position: sticky`, so ANY SCREEN USING IT NEEDS BOTTOM PADDING** or the bar
covers the last card. Three of them in one scroll container all pin and overlap, which is a gallery
artefact rather than a defect — but the padding requirement is real and Phase 1 must honour it.

**Phase 1 (Today) is next**, and it assembles exactly these five components.

### PHASES 1, 2 AND MOST OF 3 ARE IN (2026-08-08)

**Phase 1 (Today)** assembles the five components. **Phase 2 (Plan + session preview)** is complete:
the session is staged into warm-up / main set / cool-down, each with its own colour and its own time
and a chevron; "Why this session?" carries the rationale the sheet used to open with; every week of
the block is a one-line summary with the selected one expanded; and the phase legend names WEEK
RANGES ("Base wk 1–20"), because a swatch reading "Build" only helps if you can match its colour to
a bar, which is the one task a colour-blind runner cannot do. **Phase 3** has landed the Logbook, the
Support/Alfie safety work and the Profile preview; Performance provenance and Support search remain.

⚠️ **`#weekDetail` CARRIED THE CARD STYLING FROM WHEN IT WAS THE CARD.** Once it wrapped a list it
drew a card round every week and `.wk-open` drew a second inside it — the nested cards the brief
exists to remove, introduced by not moving a rule. Its two child rules were also addressed by
POSITION (`> div:first-child`, `> div:nth-child(2)`), which worked only while it held exactly one
week; with a list they landed on whichever week came first, and the second stopped matching at all
because a summary row is a button, not a div. Position is not a name.

⚠️ **THE RATCHET CAME DOWN TO 322** when that subtitle's 12.5px went onto the type ladder. Radii
unchanged at 143. Migrating a screen lowers the ceiling — leaving it high is how a ratchet becomes a
rubber band.

### EIGHT SILENT DEFECTS FOUND BY SURVEYING BEFORE BUILDING (2026-08-08)

Surveying the app against the brief before starting Phase 3 turned up eight faults, ALL of them
behind a green suite of 437 tests, two of them four days old and mine. `test/silent-defects.test.ts`
holds the guards; every one was watched failing against the pre-fix build (0 pass / 8 fail).

⚠️ **NONE OF THEM THREW**, and that is the lesson. Inside one 20,000-line template literal there is
no typechecking and no linting, so the only thing that can see any of this is a test asking the
question a runner would ask.

1. **A MISSING `+` ENDED A RETURN STATEMENT.** `treadmillDistanceHtml` rendered its heading and
   paragraph and stopped — no distance box, no button. **Every treadmill run AND every outdoor run
   that failed to get GPS** (`gpsFallback` lands in `startIndoor`) was logged by time with no way,
   ever, to add its distance. The dead line below it was the ORIGINAL paragraph, left behind when the
   denied/indoor conditional replaced it: it read as harmless duplication and was a severed return.
2. **`w.index === CURRENT_WEEK` compares 1-based to 0-based.** `curWeekNo()` exists to convert. The
   week AFTER the current one was marked current, and in week 1 nothing matched, so a runner in their
   first week never saw "Next". Must also be gated on `TODAY_IN_PLAN`.
3. **`w.plannedDistanceMeters` IS NOT ON `WeekView`** (it is `distanceKm`; the other name is the
   engine's `PlannedWeek` field and does not survive `weekView()`). The week's mileage never rendered.
4. **THE READINESS SCALE HAD A DEAD BRANCH AND COULD NOT REACH ITS OWN TOP.** It branched on
   `soreness === "some"`, which nothing writes — the check-in offers none/mild/moderate/high — so a
   runner answering **Sore scored identically to Fine**. And the base was 4 with no positive term, so
   5 was unreachable: a four-point scale printed as n/5, the same false precision the owner's "whole
   numbers" ruling rejected in the mockup's 7.6/10. ⚠️ **CLAUDE.md's own "exactly five reachable
   values" was describing intent, not the code.** Now none 5 / mild 4 / moderate 3 / high 2, and
   `feelSquare`'s `ready` state is renderable for the first time. Safe at the engine boundary:
   `buildWarmup` only acts on readiness ≤ 2 and the change can only move a runner INTO that band.
5. **`esc()` DID NOT ESCAPE QUOTES** while user text already reached ATTRIBUTES through it — the four
   "your why" answers, the why name, the shoe name. A shoe called `5" Racer` lost its row.
6. **`data-wk` MEANS TWO THINGS** — a week NUMBER on the chart, a workout FORMAT ID on the
   add-a-session library rows — and `wire()` bound it from `document`. `#sheetOv` is outside `#view`
   and survives a render, so any background render while the builder sheet was open rebound those
   rows to `state.planWeek = Number("vo2-10x1")` = NaN and killed the sheet. ⚠️ **There were TWO
   selectors in one line**; fixing one left the aria-pressed sweep.
7. **`$("readySlot").innerHTML` with no such element**, bound on every render to any `[data-seg]`.
   The live check-in uses `data-fseg` by accident of naming, so it has never fired — one natural
   attribute name away from taking the render with it.
8. **THE RED-FLAG SCREEN SAT ON THE FAILURE PATH OF WHAT IT SCREENS.** `alfieAsk` dispatches to the
   remote proxy when one is configured and only reaches `alfieRedFlags` via `alfieLocalAnswer`, which
   the SUCCESS path never touches — so "chest pain" got a language model's reply and no escalation.
   It runs first now, and a hit is answered locally and never sent.

⚠️ **AND A NINTH, IN MY OWN NEW LOGBOOK CODE: `new Date(iso + "T00:00:00")` HAS NO Z.** It parses as
LOCAL midnight, and `toISOString()` on that returns the PREVIOUS day for the whole of British Summer
Time — so the week boundary was one day early for half the year, and on a Monday the "this week"
total silently included Sunday's long run. The biggest run of the week, so it would have looked
plausible almost every time. `todayIso()` and `isoAdd()` are UTC; anything computing a date must be.
Guarded by a **400-day sweep**, because one fixture passes under the bug five days in seven.

⚠️ **`node --check` OVER THE EMITTED SCRIPT BLOCKS IS NOW A TEST, NOT A DOCUMENTED MANUAL STEP.** I
broke the app completely during this work (a dangling `).join("")` left by an edit) and
`node web/app.ts` exited 0, tsc was clean, and **451 tests passed against a page that would not
boot**. A check nobody can forget beats a documented one.

⚠️ **AND EVERY `$("id")` LOOKUP MUST RESOLVE TO A REAL `id=`.** The profile confirm button clicked
`#saveSetup`, which is nowhere in the app: it built, typechecked, passed everything, and did nothing.
Third outing of the invented-identifier trap. The guard names the five string-built ids as exempt.
It also found **`refreshTypePreview` writing into `#typePreview`, which does not exist** — the same
computed-and-discarded trap as `CLASS`, `MASTERS` and `PLAN.notes`. Inert, guarded, NOT built.

⚠️ **FOUR OF THE GUARDS TRIPPED ON THEIR OWN EXPLANATORY COMMENTS**, which quote the strings they
forbid. `fnSrc()` strips comments for exactly this. Two more sliced to a function that turned out to
sit 68,000 characters LATER in the file, swallowing a third of the app.

### THE PROFILE EDIT NOW PREVIEWS, CONFIRMS AND UNDOES (2026-08-08)

⚠️ **`applyProfile` IS PURE; `adoptPlan` AND `recompute` COMMIT.** They are one line apart and the
familiar one is the committing one — and `adoptPlan` fires `syncNativeReminders()` and `syncWatch()`
inside try/catch. Building a preview with it pushes a plan the runner has not accepted to the iOS
notification scheduler and to the wrist, where it becomes what the watch runs from when it stands
alone. Nothing throws; the runner meets it as reminders for sessions they declined. `profileImpact`
uses `applyProfile` only, and a test fails if the other two ever appear in it.

⚠️ **THE UNDO SNAPSHOT IS TAKEN BEFORE THE REBUILD, AND THAT IS THE WHOLE FEATURE.** `seedDone()`
prunes `state.dayOverride` of every session id the new plan lacks and **persists the prune**, so by
the time a toast appears the runner's own reschedules — made on a different screen, the session
sheet's day picker — are already gone from disk. An undo restoring only the profile, which is what
the existing `toastUndo` precedent models, hands back a plan with those moves deleted under a button
labelled Undo. Guarded by ORDERING, not by presence.

⚠️ **`doSaveProfile` WAS THE ONE REBUILD PATH THAT NEVER RESTORED TODAY'S TICKS.** Every other one
brackets `seedDone` with `todayTicks()`/`restoreTicks()`; this one did not, so editing your profile
silently un-ticked the run you had already done today. Fixed in the same change.

⚠️ **`PROFILE_CONFIRMED` IS ONE-SHOT**, cleared the instant `doSaveProfile` reads it. Left set, the
next edit saves silently — the exact behaviour this removes, reintroduced by a variable nobody would
think to look at.

### SUPPORT, ALFIE AND THE CHECK-INS (2026-08-08)

⚠️ **ALFIE'S LIMITS SIT ABOVE `#alfieLog`, NOT INSIDE IT.** `alfieRenderLog()` rebuilds that element's
innerHTML on every message and it is a scroller pinned to its own bottom, so a label placed in there
is destroyed by the first question — the precise moment the brief's criterion is about. The guard
compares the two POSITIONS, not presence.

⚠️ **THE ESCALATION ROUTE IS A BUTTON, NOT A SENTENCE.** The red-flag screener could only be reached
by typing a symptom AT Alfie and having it matched; a runner worried about their knee had no way to
go and find it. The machinery was complete, good and invisible.

⚠️ **THE CONSENT COPY HAD TO BE CHECKED AGAINST THE CODE, AND CHECKING IT WAS THE WORK.** "Saved on
this device" would have been FALSE: `chkValues()` reads the boxes straight out of the DOM and nothing
writes them anywhere, so the answers do not survive leaving the screen. `test/silent-defects.test.ts`
fails on saved / stored / we keep / remembered. A consent line that overstates what is kept is worse
than none — it is the sentence a worried runner reads most carefully.

⚠️ **A HUB CARD NAMED IN NO GROUP DOES NOT APPEAR AT ALL. THIS FILE CLAIMED THE OPPOSITE FOR MONTHS**
— it promised a "More" catch-all, and there has never been one. `viewSupport` renders exactly Alfie,
`HUB_CHECKINS`, `HUB_LEARN`, `HUB_TOOLS` and the Safety footer, so an entry added to `SUPPORT_HUB`
without naming a group ships as an unreachable page with nothing looking wrong. Corrected 2026-08-15
and guarded by `test/support-hub.test.ts`… which is to say `test/support-tools.test.ts`, whose first
test fails on any hub id that no group names.
⚠️ **`why`, `connect`, `shoes` and `data` are ungrouped ON PURPOSE** — they are rows on the Profile
screen, where a thing about the runner belongs, and a code comment records that `why` was moved there
deliberately. They are the reason the guard carries a named exemption list and then checks each of
those four is genuinely reachable from Profile, rather than demanding every entry be grouped.

### THE LOGBOOK'S TOTALS ARE NO LONGER BOUNDED BY THE 50-RUN CAP (rewritten 2026-08-15)

⚠️ **THE CAP IS STILL 50 RUNS, BUT THE FACTS OF EVERY RUN ARE NOW KEPT FOREVER.** `saveRuns()` still
slices `interun_runs` to 50, because a run carries its GPS route and heart-rate series (~1.7 KB). It
also calls `syncHist()`, which merges each run into **`interun_hist_v1`** — one ~63-byte row of
`{i,d,k,s,t,e}` (id, date, km, seconds, type, elevation), **never capped**. Five years at four runs a
week is about 65 KB. `logTotals`, `logWeekBuckets` and `logStreakWeeks` all read `state.hist`.
- ⚠️ **It is written INSIDE `saveRuns()`, not at its fourteen call sites**, so a fifteenth cannot
  forget. The runs are written FIRST, in their own `try` — losing the history must never cost
  somebody the run they just finished.
- ⚠️ **`deleteRun` must call `histForget(run)`**; merging never deletes, so without it a deleted run
  counts toward every total forever. Undo needs no partner call — the run returns to `state.logged`
  and the next merge re-adds it.
- ⚠️ **`state.hist` is the in-memory copy and readers must use it.** Re-parsing a thousand-row store
  on every render costs most for the people who have used the app longest.
- ⚠️ **THE OLD "Last 50 runs" THIRD COLUMN DESCRIBED HERE HAD ALREADY BEEN REMOVED** before this was
  written, leaving only an orphaned `.lb-cs` CSS class. Both facts in that sentence were stale.

⚠️ **`logStreakWeeks()` READ THE CAPPED STORE AND THEREFORE GOT SHORTER THE MORE CONSISTENTLY SOMEBODY
RAN.** Measured against a genuine 40-week streak: it displayed **11 weeks**, and a runner going out
seven days a week topped out near seven. The one number whose job is to reward consistency was being
reduced by it, silently. Fixed 2026-08-15; `test/run-history.test.ts` proves the streak does not
depend on `state.logged` at all.

⚠️ **TWO SCREENS MUST REFUSE TO INVENT A REST DAY, and the store being uncapped does not remove the
need.** History still starts when the runner did. The month calendar will not page back past the
first recorded run, and Progress captions any range that reaches further back than the records do —
otherwise a flat line reads as months of not running rather than months of no data.

⚠️ **THE TRAINING LOG ONLY MAKES A RUN TAPPABLE IF ITS FULL RECORD SURVIVES.** History is uncapped but
`state.logged` is still 50, so on a real training year most days describe a run whose map and splits
are gone: measured on an eight-month fixture, **148 dots, 50 openable, 98 landing on "Run not
found."** Those days keep their distance and are `aria-disabled` spans, never buttons — the same rule
`test/design-system.test.ts` already enforces on session rows.

⚠️ **CONSISTENCY IS NEVER TAKEN FROM `state.done`.** `seedDone()` rebuilds it at every boot by marking
every non-rest session dated before today as done, run or not — so a figure from there reads 100% for
somebody who has not run at all. Logged runs against `RAW.weeks` is the only honest pair. And days
that have not happened yet are not counted, or every week reads as a failure until Sunday. It states
the evidence ("2 of 4 planned runs done this week"), never a percentage.

⚠️ **RUN ROWS CARRY AN ID, NOT AN ARRAY INDEX.** The index was already documented as "not a handle"
because `state.logged` is unshifted whenever a watch run arrives; filtering breaks it a SECOND way,
because position in the rendered list stops matching position in the array — deleting the third row
of a filtered list would delete the third run of the store. `migrateRunRoutes` backfills ids on runs
logged before they existed.

### PHASE 3 IS COMPLETE; PHASE 4 IS HALF IN (2026-08-08)

Performance, Support search and the accessibility pass landed after the notes above.

⚠️ **EVERY PART OF THE PERFORMANCE "PROVENANCE" WORK WAS ALREADY COMPUTED AND DISCARDED.** Each
dimension is an `Estimate` carrying `.low/.high/.confidence/.method`; `RC.rangeText` exists to format
exactly that and had **zero callers**; `FITNESS.summary` is a ready-made honest provenance sentence
rendered nowhere; and `uiCoachNote`, built in Phase 0 with all its states, had no production caller at
all. The screen was three numbers with no source, no date and no uncertainty.

⚠️ **A NUMBER WITH NO DATE READS AS A MEASUREMENT OF TODAY.** All three dimensions come from ONE input
— the 5 km time typed into setup, or a 2 km trial — so the meter labelled "endurance base" only ever
moves when that input changes, however much training has happened.

⚠️ **A SEEDED ANCHOR IS NOT EVIDENCE.** `buildProfileFromDraft` seeds a 5 km time for a beginner and
sets `noRecent` — a time nobody ran. This app already refuses to raise adaptive flags off a seeded
anchor; printing a fitness estimate from one as measured is the same mistake somewhere else.

⚠️ **`durability` IS PERMANENTLY EMPTY** (`confidence` is always `"none"`; nothing computes it). The
old copy — *"We'll learn this from your long runs"* — was a promise the app never keeps. It is the
`unavailable` state now and says **why**: no method behind it yet, rather than not enough data.

⚠️ **`refreshTypePreview` HAD NO CONTAINER.** Wired to three call sites including `oninput` on the two
fields above it, it computed `classifyRunner` and `assessMasters` on every keystroke and returned at
`if (!tp) return` — `#typePreview` was nowhere in the markup. That is the only place `CLASS` and
`MASTERS` were ever going to be read, so this trap was holding its own last two examples. It also
matters because `classifyRunner` caps self-assessment at tier 4 and this panel is where the app was
supposed to SAY so. Given its container.

⚠️ **THE `$("id")` GUARD HAD TO BE RESTATED, because its first version rejected a correct fix.** The
invariant is **"something produces this id"**, not "it appears as a literal `id=`" — several real ids
are string-built (`uiActionBar`'s `id`, `uiDecisionHero`'s `actionId`), and a hand-written exemption
list goes stale the first time somebody adds a builder and then gets deleted rather than updated.
⚠️ **And the obvious fix for it tripping on a comment — strip comments first — was tried, MEASURED and
REVERTED:** a regex doing that over 1.6 MB of generated page ate real markup and reported sixteen live
ids as missing. Far worse than the false positive. The app's comment was reworded instead.

⚠️ **SUPPORT SEARCH READS THE ARTICLE BODIES.** Somebody typing "gel" is not looking for an article
called that. `GUIDES` and `SUPPORT_HUB` are both DATA, so the index is a filter — no backend, exactly
as the owner said. While searching, the hub groups are **hidden, not filtered**: a grid that quietly
loses eight of its eleven tiles reads as the app having lost them. A guide is keyed on its **slug**
now, so a result can open the right one. ⚠️ `ICON.search` **did not exist**, so `(ICON.search || "")`
drew an empty slot in silence.
⚠️ **16px ON A SEARCH FIELD FAILS THE TYPE RATCHET, and both constraints are real** — under 16px iOS
auto-zooms and pinch is disabled, so the runner can never zoom back. `var(--t-card)` is **17px**: on
the ladder AND above the floor. Do not widen the ladder to admit 16px.
⚠️ **Re-rendering on every keystroke rebuilds the field under the runner's finger**, so the caret is
captured and restored — otherwise every character types to the front of the box.

⚠️ **THIRTEEN FORM LABELS NAMED NOTHING.** The setup form is `<div class="q"><label>Age</label><select
id="s_age">` — a label that is a SIBLING of its field with no `for`, so a screen reader announces an
unlabelled combo box. It is the most form-heavy screen in the app and the first one a runner meets.
`linkFormLabels()` fixes it **at runtime**, so it cannot drift and covers questions added later.
⚠️ **It must re-run wherever form markup is REPLACED** — the goal block is rebuilt after `wire()`, which
is why its three fields stayed unnamed while the static ones above them were fixed.
⚠️ **FOUR GROUP SHAPES, NOT ONE**: `.seg`, `.opts`, `.statuscards`, `.coachsel`. Written against the
first two it left the two biggest questions on the screen — what kind of runner you are, and which
coach speaks to you — announced as unlabelled buttons.

⚠️ **NOTHING HAD A 44px HIT AREA** despite `--tap` existing since Phase 0: icon buttons 36, back button
20, Alfie chips 35, logbook filters 34, a calendar tick 24, segmented buttons 38. **THE HIT AREA GROWS,
NOT THE BOX** — growing the boxes relayouts the top bar and every segmented control.

**Measured clean:** no horizontal page scroll on any screen with a 40-character name and 100-character
free-text answers; every wide element sits inside a deliberate scroller (`#chart`, `.weekstrip`).

**Still open in Phase 4:** content-preserving transitions (160–220 ms), and Dynamic Type — the app is
px throughout, so it does not honour the phone's text-size setting at all. That is 443 font sizes and
a large regression risk; the brief itself scopes it separately.

### PHASE 4 IS COMPLETE — THE REDESIGN IS DONE (2026-08-08)

⚠️ **THE TYPE LADDER IS THE DYNAMIC TYPE MECHANISM, and that is the payoff for having built one.**
Every size in the app is px, so it honoured the phone's text-size setting nowhere at all. The seven
tokens are now `calc(Npx * var(--tscale))`, so every screen already migrated onto the ladder scales
for free — and the off-ladder ratchet gains a second meaning: an off-ladder value is no longer merely
inconsistent, it is one that **does not grow for somebody who needs it to**. Do not convert the 443
individual sizes; migrate screens onto the ladder instead.

⚠️ **`font: -apple-system-body` IS THE ONLY THING THAT TRACKS DYNAMIC TYPE INSIDE A WKWebView.** `rem`
follows the page, not the phone, and there is no API to ask. An off-screen probe is measured at boot
and on `visibilitychange` — **iOS never notifies a web view that the setting changed**, so returning to
the app is the only moment it can be caught.

⚠️ **CLAMPED TO 1.0–1.3, WHICH IS A LIMITATION, NOT A PREFERENCE.** The app is full of fixed-height
controls (the 44px target, the nav, the live hero), so an unclamped 235% overlaps rather than reflows.
Never below 1 either. Measured at the cap across six screens: no horizontal page scroll, nothing
escaping a scroller. Lifting the cap means making those controls reflow first.

⚠️ **`.view-in` MUST BE REMOVED, A REFLOW READ, THEN ADDED.** Otherwise a second render inside the
180 ms window finds the class present, the animation does not restart, and the screen simply appears —
which is most tab switches, because `render()` is called from many paths.

⚠️ **TWO HAPTICS WERE SILENT IN THE NATIVE APP.** The stretch player called `navigator.vibrate`
directly and **WKWebView has no vibrate API at all**, so the guided routine buzzed in a browser and did
nothing on the phone. `haptic()` and its native bridge is the only path that reaches a real generator;
a test allows exactly one raw call, the one inside `haptic()`.

**`test/silent-defects.test.ts` now holds 24 guards** covering every defect found in this work, each
watched failing against a deliberate re-break before being believed.

### The seven mockup features that do not exist — his ruling, 2026-08-08

*"I would build those features in advance and leave a place holder message like coming soon"* — build
the shell now so the navigation is complete, and fill in behaviour later.

⚠️ **BUT THEY ARE NOT ALL THE SAME THING, AND THREE NEED NO PLACEHOLDER AT ALL.** Treating them
uniformly would add seven unfinished surfaces where three could simply be finished — and a
"coming soon" on something the app can already compute is worse than no feature, because it says the
app cannot do a thing it demonstrably can.

| Mockup feature | Verdict | Why |
|---|---|---|
| Logbook period totals, consistency, filters | **BUILD IT** | Every run is in `interun_runs` with `dateIso`, distance, time and type. Nothing is missing. |
| Support search | **BUILD IT** | The articles are markup in the build; a client-side index over them needs no backend. |
| Apps & devices | **BUILD IT, partially** | `WatchBridge` already knows `isPaired` / `isWatchAppInstalled`. Show the real state; "coming soon" only for the things that are not the watch. |
| Subscription / PREMIUM badge | ❌ **CUT** | *"Leave the subscription one out.....thats not something we are doing (yet)"* (owner, 2026-08-08). Not a placeholder — it does not appear at all. Do not reinstate it from the mockup. |
| Community | **PLACEHOLDER** | Needs a backend the app deliberately does not have. |
| Shoes | ✅ **BUILD IT — "Shoe Rack"** | *"I want the shoes one....it will be called 'shoe rack' and it will allow users to choose what trainers they're wearing and be able to track the milage in them so they know when to retire the trainers"* (owner, 2026-08-08). His name, his framing — keep both. |
| Plan move / swap / skip + impact sheet | **ENGINE WORK, not a placeholder** | The engine can rebuild a plan; it cannot move one session and describe the consequence. The largest genuinely new capability in the brief. |

### The readiness score is a WHOLE NUMBER OUT OF FIVE (owner, 2026-08-08)

*"The readiness score needs to be whole numbers."*

⚠️ **AND THE SCALE IS FIVE, NOT THE MOCKUP'S TEN.** `readinessScore()` already returns a whole 1–5,
built from two questions worth ±2 each — so there are exactly five reachable values. Rescaling to /10
would print 2, 4, 6, 8, 10: a ten-point scale with five possible answers, which is the same false
precision as the mockup's "7.6 / 10" wearing a different disguise. The brief's own insight contract
(meaning, evidence, freshness, confidence) argues against it. Show `n/5` with the plain-language
label beside it. If the inputs ever grow, the scale can grow with them.

⚠️ **A "coming soon" placeholder was REMOVED on 2026-08-08** (the stretch-video box, offered after
every run) because the TestFlight audit called it the most visible unfinished surface in the app, and
separately predicted the Community tab's "on the way" would be a leading piece of tester feedback.
Adding placeholders is therefore a deliberate reversal, made safe only by the redesign landing BEFORE
TestFlight. If that ordering ever changes, revisit this.

## THE CSS TOKEN GUARD, AND WHY THE RATCHETS WERE BLIND TO IT (2026-08-15)

⚠️ **AN UNDECLARED CUSTOM PROPERTY INVALIDATES THE WHOLE DECLARATION, SILENTLY.** `var(--r-sm)` was
invented and used four times — **two of them in the plan drag-and-drop that had already shipped in
build 373**, where it left the drag highlight and the floating card with square corners. It passed the
build, the typecheck, 573 tests and a screenshot review, because "slightly less rounded than intended"
is not something an eye catches. Chasing it found `--wc`, used three times in the weather CSS and
declared nowhere, which had made the bullet dots on the weather advice invisible.

The radius and type ratchets count **literal** off-ladder values, so they are structurally incapable
of seeing this. `test/design-system.test.ts` now asserts every bare `var()` resolves.
⚠️ **DECLARATIONS ARE SCANNED ACROSS THE WHOLE PAGE, USES ONLY IN THE STYLESHEET** — nine tokens
(`--hc`, `--phase`, `--rc`, `--p` and friends) are legitimately set per element as inline
`style="--hc: …"`, and a stylesheet-only scan reports every one of them as missing.

## THE WELCOME-BACK SCREEN LANDS ON TODAY BY ITSELF (owner, 2026-08-21)

*"when the app loads, when the welcome back message comes on with the quote, I want that screen to last 4
seconds before automatically landing on the today page. I've decided i don't wan't the user to keep
needing to press the lets go button."*

`WELCOME_BACK_MS = 4000`, a `setTimeout` in `showWelcomeBack`, and the `#wbGo` button is gone.
**Measured on the served build: the welcome appears at 2.3s, holds 4.6s (4.0 plus the 0.5s cross-fade),
and Today is up at 6.9s with `state.tab === "today"`.**

⚠️ **THE WHOLE LAUNCH IS WHAT THE RUNNER FEELS, NOT THE 4000.** The splash holds 2.2s before this appears,
so a return to the app is now ~6.9 seconds to Today where it used to be ~2.5 plus however long the runner
took to tap. That is the cost of the ask; `WELCOME_BACK_MS` is the one constant to lower if it ever feels
long, and the figure is written beside it so nobody has to rediscover it.

⚠️ **THE SCREEN IS STILL TAPPABLE, AND THAT IS NOT A CONTRADICTION OF THE ASK.** He removed the
REQUIREMENT to press something, not the ability to move on — so `ov.onclick = dismiss` skips the wait with
no control on screen to look at and wonder about. Nobody impatient is held for four seconds.

⚠️ **THE BUTTON IS DELETED, NOT HIDDEN,** and its `.wb-cta` rule went with it. A control that is merely
invisible is still announced by a screen reader and still reachable by keyboard — and an orphaned style
rule is what the next screen copies.

⚠️ **THE FIRST-RUN WELCOME IS DELIBERATELY UNTOUCHED.** Its `#welcomeGo` leads into the setup wizard,
which is a choice rather than a pause; auto-advancing somebody into a form is worse than asking them to
tap. Guarded, so a future tidy-up cannot make the two consistent by breaking the one that should not
change.

⚠️ **THE TIMER IS CLEARED ON A TAP**, so nothing runs against a node that has been removed — the `gone`
flag already made a second dismissal harmless, this stops the work happening at all.

⚠️ **AND THREE OTHER PLACES NAMED `#wbGo`, WHICH IS HOW A REMOVAL BREAKS A HARNESS.**
`tools/story-shots.mjs`, `tools/debrief-shots.mjs` and this file's own Playwright recipe all clicked that
button to get past the welcome. All three now click `#welcomeback`, the overlay itself. **Grep for an id
before deleting it** — the app was clean, the tooling was not.
