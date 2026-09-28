# Strength A1–A4 — set log, exercise library, preferences, swap

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> The plan itself is PLAN.md.

## THE PLAN TO GO PAST RUNNA, AND THE ONE COMMAND THAT PROVES A STAGE (owner, 2026-09-20)

*"I want to move towards a better app than Runna, that has all of their functionality plus more … the
ability to plan detailed strength training programmes that has a full functionality to be able to track
reps/sets."* The whole plan — status, a researched audit of Runna, the decisions from two interview
rounds, and ~30 small stages in five tracks — is **`PLAN.md`** at the repo root. Read it before starting
any stage; tick a stage there when it lands.

⚠️ **THE AUDIT WAS RESEARCHED, NOT REMEMBERED, and three of its findings overturn assumptions.**
(1) **Runna closed its in-app community on 7 September 2026** and moved it to a Strava club — so
Inte-Club already does more in-app than Runna does, and "community parity" is a Strava club, not a
backend. (2) Runna **does** log reps + weight and tracks "Weight Lifted" over time, has ~175 exercises,
30/45/60-minute sessions, three levels, two goals and an equipment picker — but **cannot** build custom
programmes, swap an exercise, run a rest timer, estimate a 1RM, suggest a load, or reach a watch. That
is the differentiator the owner named, and it is where Runna is thinnest. (3) Strava has owned Runna
since April 2025; the apps stay separate; they push **two weeks of runs to Garmin/COROS/Suunto/Fitbit
every Monday**, runs only, no Connect IQ app.

**The owner's decisions (binding):** full strength gym (parity + programmes, rest timers, supersets,
e1RM, progression; watch strength as its own native stage) · **accounts/server are a SEPARATE planning
round** after strength and launch hygiene · strength first, then launch hygiene, parity gaps interleaved
· a Strava club now, Inte-Club kept for the accounts round · all four parity groups, with **non-race
modes flagged COMPLEX → their own planning round** · AI briefings + insights **grounded in the debrief's
own numbers**, free brain first, capped · yoga/pilates later in this plan · Garmin form **sent** · iOS
only for v1.

⚠️ **THREE FACTS ABOUT THE CODEBASE THE PLAN RESTS ON, all verified first-hand this session:**
- `interun_slog` is keyed `sessId|exIdx|setIdx`, carries **no date**, and `strengthHistory()` drops every
  row whose plan has been rebuilt (`if (!ex) continue;`). **The strength log loses data on every plan
  rebuild.** Stage A1 fixes this before anything is built on it.
- There are **two exercise catalogues**: the engine's `EX` (17 entries) and the Learn hub's
  `STRENGTH_LIB` (`web/app.ts:19281`). Stage A2 deletes the second.
- The Strava Worker **hardcodes `sport_type: "Run"`** (`alfie-proxy/src/strava.ts:272,292`), and the
  watch's `isRunnable` mirror of `PRIMARY_TYPES` has **no test behind it**.

### T1 — `npm run verify`

The first stage, because six of this file's documented harness faults came from a verification step
quoted from memory. `tools/verify.mjs` runs the recipe end to end and prints one line. It was
**deliberately broken five ways and caught all five**: an untracked file under `docs/voices/` (step 2), a
backtick in a runtime-JS comment (the build fails — step 1, exit code read), an emitted block that
builds but does not parse (step 3), an unexpected type error (step 4), and a failing test named by
title (step 5). `web/app.ts` was restored from a copy each time and checked byte-identical — never
`git checkout`.
⚠️ **IT NEVER RESTORES `docs/voices/`.** The same diff is an accident after a routine build and correct
after a deliberate regeneration; the script prints the restore command and stops.

## ✅ A1 — THE STRENGTH LOG SURVIVES A PLAN REBUILD (2026-09-20)

The first stage of `PLAN.md`'s strength track, and a foundation rather than a feature: **nothing new
appears on screen.** Suite 1533 → **1546**; `test/strength-log.test.ts` holds 13 guards and **9
deliberate re-breaks were each watched failing**.

⚠️⚠️ **EVERY SET A RUNNER HAD LOGGED WAS THROWN AWAY BY THE NEXT PLAN REBUILD, IN SILENCE.**
`interun_slog` filed a set under `sessionId|exerciseIndex|setIndex` with **no date**, and
`strengthHistory()` read it back through `RAW.weeks[n].sessions.find(id).exercises[i]` with
`if (!ex) continue;` for anything it could not resolve. So changing the race date, the days per week or
the long-run day renumbered or removed the exercise and the history was gone — **and the reader's own
skip-if-unresolvable meant nothing on screen said so.** Reproduced in a real browser: log two sets,
change days 5 → 4 and the long-run day, and the card was empty. After: 2 rows, best 45 kg, the card
intact.

⚠️ **THE FIX IS A STABLE ID ON THE MOVEMENT, AND THE CATALOGUE KEY *IS* THAT ID** (`mkEx` sets
`id: key`). One source, so a builder cannot give an exercise a second name, and `exerciseById()` can
resolve a logged row **without the plan it was logged against**. ⚠️ **AN ID IS NEVER RENAMED OR
REUSED** — a rename orphans history exactly as the index did, so the sixteen ids a runner's store can
already hold are pinned by a guard.

⚠️ **THE DATE IS PART OF A ROW'S IDENTITY, NOT DECORATION.** Session ids are deterministic:
`w3d2-strength` recurs in every rebuilt plan. Keyed on `(session, exercise, set)` alone, week 3 of the
old plan and week 3 of the new one are the same row and overwrite each other. Identity is
`(date, session, exercise, set)`.
⚠️ **AND THAT IS ONLY UNIQUE WHILE AN EXERCISE APPEARS AT MOST ONCE IN A SESSION** — asserted across a
whole real block. If a later stage adds supersets that repeat a movement, that guard fails and **that**
stage must carry the slot index into the row.

⚠️ **THE STORE IS HELD IN MEMORY AND THE DISK WRITE IS DEBOUNCED, because the weight box writes on
every KEYSTROKE.** Re-parsing and re-stringifying the whole log per character costs most for the runner
who has used the app longest — the reasoning `state.hist` already records — and it is the same split
the run-note field uses. `closeSheet` and `visibilitychange` flush first, so nothing that can lose the
page loses a set.

⚠️ **PRUNING FOLDS WHAT IT DROPS INTO `bests`; KEYSTROKES DO NOT.** The heaviest lift is the one figure
here that may only ever go up, so housekeeping at the 12,000-row cap (~4 years) folds the dropped
maxima in first. Writing bests on every keystroke instead would make a **typo permanent** — 400 kg
entered for 40 could never be corrected. Both directions are guarded.

⚠️ **THE MIGRATION RESOLVES v1 ROWS THE WAY v1's OWN READER DID, AND KEEPS v1.** Anything the current
plan cannot resolve was *already* invisible, so nothing on screen is lost; the count goes in
`meta.skipped` rather than being shrugged off, and the old store is never deleted — it is the only copy
of what could not be carried. Idempotent, guarded by `meta.migratedAt`, because `adoptPlan` runs on
every launch.
⚠️ **IT DATES A ROW FROM `genDay`, NOT `effDay`.** `effDay` reads `state.dayOverride`, and this runs
from `adoptPlan` which `recompute()` calls at module top level — reaching into `state` from there is
the boot-order trap `JOURNAL_KEY` and `CLUBPROF_KEY` already record. Carried rows are stamped `m: 1`
precisely because their date is a planned one rather than an observed one.
⚠️ **`SLOG2_KEY` IS DECLARED WITH THE OTHER STORE KEYS — the third time this file records that rule.**
Declared beside its own functions five thousand lines below, it would be read in its temporal dead
zone, throw, and be swallowed by the try/catch around it, which is how `journalSync` wrote nothing on
any launch for weeks. Guarded by comparing its position against `adoptPlan`'s.

⚠️ **THE HISTORY NOW SHOWS DATES, NOT "Week N".** A week number means nothing once the plan it referred
to has been rebuilt — which is the whole reason the store was reshaped.

⚠️ **THE BACKTICK RULE FIRED FIVE TIMES IN ONE STAGE, ALL IN MY OWN COMMENTS**, and the fifth was the
instructive one: it was in the **store-key block**, far from the code it described, and the build
failed pointing at a line 300 lines away. Sweep `git diff` for backticks on added lines before
building, not after.

⚠️ **AND THE ONE TEST FAILURE WAS THE FIXTURE, NOT THE CODE: `PLAN.weeks` carry `startIso` while the
generator's weeks carry `startDateIso`.** Passing the raw plan as `PLAN` made the migration build an
invalid date. The fixture now uses the real `buildPlanSummary`, so the two shapes cannot drift apart
inside this test.

**Still to come in this track (see `PLAN.md`):** A2 the exercise library (17 → 60+, and the Learn hub's
duplicate catalogue deleted), A3 preferences, A4 swap, A5 the session player with rest timers, A6 e1RM
and progression, A7 standalone programmes, A8 Strava as Weight Training, A9 the watch.

## ✅ A2 — ONE EXERCISE CATALOGUE, GROWN TO 62 AND MADE BROWSABLE (2026-09-20)

The exercise library was TWO catalogues, not one. `EX` in `session-templates.ts` (17 entries, built
sessions) and `STRENGTH_LIB` in `web/app.ts` (a separate hand-picked ~20, taught the Learn hub) — a
cue fixed in one never reached the other, and neither could answer "what can I do with a kettlebell",
which A3's preferences stage needs to ask. Suite 1546 → **1561**; `test/strength-library.test.ts` holds
15 guards and **9 deliberate re-breaks, all 9 caught** (two only after the guard, and the re-break
itself, were fixed — those two are below).

⚠️⚠️ **THE OLD LEARN HUB COULD ONLY EVER SHOW THE EXERCISES SOMEBODY HAD DRAWN ART FOR.** `exCard()`
returned `""` for anything with no bespoke `.webp`, so 62 exercises would have rendered as 16 cards
with a lot of silent gaps. `exVisual()` — the same renderer the session sheet already uses — already
falls back to a schematic figure for the movement's PATTERN, so reusing it instead of writing a second
card renderer is what makes all 62 show a demonstration today, whether or not their own animation
exists yet.

`src/strength/library.ts` is the one definition now: `EXERCISES` (62 entries, up from 17), `EQUIPMENT`
(Runna's nine: bodyweight/bands/barbell/box/bench/dumbbell/kettlebell/pullUpBar/swissBall), `PATTERNS`
(13, up from 10 — pull, carry and rotate are new), `alternativesFor(id, owned)` for A4's swap.
`session-templates.ts`'s `mkEx` now resolves against it; `web/entry.ts` exports the library surface
directly rather than through the engine module. **Every equipment tag has ≥2 exercises and every
pattern has ≥2** — checked, not assumed, because a filter with no coverage is "a dead end wearing the
clothes of a feature" (this app's own rule for the Logbook's filters, applied here).

⚠️ **THREE NEW POSES NEEDED HAND-DRAWN COORDINATES, AND I LOOKED AT THEM BEFORE TRUSTING THEM.**
`pull` reuses the `hinge` stance (a bent-over row is the same body position, a different arm path);
`carry` alternates the STRIDE while the arm stays locked at the side in both frames (a loaded carry
doesn't move the load, it moves the legs); `rotate` sweeps the arm from low on one side to high on the
other. Screenshotted all three in a real browser: pull and hinge render as the same kind of solid
silhouette at thumbnail size (confirmed by comparing against the EXISTING, already-shipped
`Single-leg RDL`/`Kettlebell deadlift` cards, which use the untouched `hinge` pose and look identical
— not a regression I introduced, just what this rig does at 82px for any bent-over stance); carry and
rotate both read clearly as their movements.

⚠️⚠️ **THE EQUIPMENT FILTER IS "OR", NOT "AND" — and combined with full coverage, that makes its own
"nothing matches" message provably unreachable.** A runner with dumbbells AND a kettlebell wants
exercises using EITHER, so ticking two tags only ever grows the visible set from ticking one — and
since every tag alone already guarantees ≥1 match, no real combination of ticks can ever be empty. I
wrote the "nothing matches, try clearing a filter" message anyway on the first pass, then drove it in
a real browser and found there was no way to reach it: `bench + pullUpBar` (a combo I picked because
it sounded narrow) returned four groups, because OR unions rather than intersects. **Deleted rather
than kept as defensive code** — an untestable branch for a state the UI cannot reach is worse than no
branch, and the comment left in its place says exactly why, so a future change to the semantics (an
AND filter, a poorly-covered new tag) knows it needs one back.

⚠️ **A GUARD'S OWN TRAILING WORD BOUNDARY COULDN'T CATCH AN INFLECTED FORM.** The copy sweep for
"prevents injury / guarantee / cure" used `\bguarantee\b` — and the character right after "guarantee"
in "guarantees" or "guaranteed" is a word character, so the trailing `\b` never fires and the whole
match fails. Caught only by re-breaking with a real sentence ("This guarantees you never get
injured.") rather than the bare word. Fixed by dropping the trailing boundary on the open-ended stems
and letting `\w*` absorb the suffix, keeping the LEADING boundary so it still can't fire inside an
unrelated word like "obscure".

⚠️ **AND MY FIRST RE-BREAK OF THE COVERAGE GUARD WASN'T SEVERE ENOUGH TO TEST WHAT IT PROTECTS.**
Removing `barbell` from one of its ten exercises left nine — nowhere near the ≥2 floor the guard
actually checks, so it correctly stayed green and I nearly logged that as an escape. Redone properly
(barbell down to exactly one exercise) and it failed exactly where it should. **A re-break has to cross
the boundary the guard is testing, not just perturb the code near it.**

⚠️ **`.excard`/`.excard-img`/`.excard-b`/`.excard-n`/`.excard-m`/`.excard-c` WENT WITH `exCard()`,
DELETED RATHER THAN LEFT — an orphaned rule is what the next screen copies.** The replacement
(`.lib-card`, `.lib-cb`, `.lib-cn`, `.lib-cm`, `.lib-cc`, `.lib-ceq`, `.lib-eqf`, `.lib-eqc`) uses the
same visual values on the design-system LADDER (`var(--s2)`, `var(--r-card)`, `var(--r-pill)`,
`var(--t-card)`, `var(--tap)`) instead of the old off-ladder literals — both ratchets (radii, font
sizes) are unchanged or improved, because this stage net-removed off-ladder rules rather than adding
any.

⚠️ **THE `plank` ENTRY'S NAME CHANGED FROM "Plank + side plank" TO "Plank"** — side plank is now its
own catalogue entry (`sidePlank`, with the "side-plank.webp" asset that existed on disk but was never
referenced by anything). This is a display-name change, not an id change: the id `plank` is unchanged
and every logged set against it still resolves. Checked that nothing in `test/`, `src/` or the built
page depended on the old combined string.

⚠️ **BACKTICKS FIRED AGAIN, TWICE, ONCE IN `session-templates.ts` (HARMLESS — that file is ordinary
TypeScript with 119 pre-existing backticks, not the template-literal-delimited `web/app.ts`) AND ONCE
IN THE NEW POSES COMMENTS (real — the build failed, exit code read, both fixed).** Worth restating the
scope precisely: the no-backticks rule is about `web/app.ts`'s runtime JS specifically, not every file
in the repo — checking WHICH file a backtick landed in before treating it as a defect saved chasing a
non-issue in `session-templates.ts`.

**Still to come in this track:** A5 the session player, A6 e1RM and progression, A7 standalone
programmes, A8 Strava as Weight Training, A9 the watch. (A3 preferences and A4 swap both landed —
see the chapters at the foot of this file.)

## ✅ A3 — FIVE STRENGTH QUESTIONS, AND A SESSION BUILT TO THE TIME YOU ACTUALLY HAVE (2026-09-20)

Runna asks for a number of sessions, a length, a level, a focus and an equipment list. This app asked
**one Yes/No** and built two fixed sessions of seven fixed exercises. Suite 1561 → **1576**;
`test/strength-prefs.test.ts` holds 15 guards and **23 deliberate re-breaks were all caught**
(two only after the guard was restated — those two are below).

⚠️⚠️ **THE SHIPPED "45 MINUTE" SESSION TAKES ABOUT SIXTY-SEVEN, AND ONLY COUNTING THE RESTS SHOWED IT.**
`strengthSession` carried a literal `minutes = maintenance ? 30 : 45` sitting beside a fixed list, and
the two had nothing to do with each other: three sets of three heavy lifts off three minutes' rest,
plus two calf raises, a step-up, a plank and the plyometric dose, is 67 minutes of work. The label was
a decoration. So the new builder takes a budget and fills it — a set costs `WORK_SEC + rest`, the
spine is walked in order, and the session's stated duration is the DERIVED total. Measured across
1,800 reachable combinations: worst overshoot **1.83 minutes**, lowest fill **55.4%**.

### ⚠️⚠️ THE ONE PROPERTY EVERYTHING ELSE HANGS OFF: ABSENT MEANS UNCHANGED

`Athlete.strength` absent → the **frozen legacy path**, in both `strengthSession` and `addStrength`.
Not a generalised builder reproducing the old output through a default — that is one edit away from
moving every existing block silently, which is the `weeklyVolumeKm: 30` failure. Proved by the audits
being **byte-identical** before and after A3 (`tools/audit-progression.mjs`: 24 under-floor weeks of
18,216, deload depth 29.3%, taper 35.8/21.3/47.4%, long-run inversion 0.9% — every figure unmoved),
because that tool sweeps runners with no prefs.

⚠️ **AND THE GUARD FOR IT WAS NEARLY VACUOUS ON ITS FIRST WRITING.** It built the same athlete twice,
once with `strength: undefined` — which the code handles on the *same branch*, so it proved only that
`undefined` equals absent. Restated as the shipped session written out: the nine ids in order, the
sets, the reps, which two exercises carry a load, and the two placement days. **A golden hash was
rejected** for the reason this file already records for the share card: its failures mean "something
moved" rather than "something is wrong", and a baseline like that gets re-blessed without being read.

⚠️ **THE PEAK RULE IS `min(2, max(1, req - 1))`, NOT `min(req, 2)`, AND THAT IS WHAT MAKES MIGRATION
SAFE.** The old control was a boolean and the plan it builds carries two sessions in base and build
and **one** in peak. A flat cap at two would have quietly added a peak session to every runner whose
Yes became a 2. Peak drops one relative to base and build — the coaching reason the old literal
encoded — and the arithmetic falls out of it: at `req = 2` the prefs path equals the legacy path in
every phase, so `strength: true` → 2 sessions moves nobody's count.

### THE BUILDER'S DECISIONS, EACH WITH THE MEASUREMENT BEHIND IT

⚠️ **THE ANSWER IS A CEILING, SO THE TWO DIRECTIONS ARE JUDGED DIFFERENTLY.** Over is a session the
runner cannot finish; under is a session that ended. Closest-fit alone overshot a 30-minute advanced
session by **six minutes**, so an addition may cross the line by at most `OVER_SLACK` (2 min). Coming
in under is allowed and sometimes unavoidable — a beginner's whole spine at two sets is 33 minutes,
and padding it to reach a 45-minute answer would be inventing work to match a number.

⚠️⚠️ **THE SETS GIVE WAY BEFORE THE MOVEMENTS DO, AND WITHOUT THAT RULE A 30-MINUTE ADVANCED SESSION IS
ONE EXERCISE.** Measured: `squat x4` plus the jumps, 23 minutes. The set count is capped down until the
three lifts the spine opens with (squat, single-leg, hinge) fit. Measured floor across the grid:
**3 lifts**; without the cap, **1**.

⚠️ **AND THE SAME ADJUSTMENT UPWARDS, OR AN HOUR BUYS NOTHING.** A 60-minute intermediate base session
ran the WHOLE spine at two sets and finished in **30** — the same session a half-hour answer gets.
The clock raises the set count **by at most one**, so the level question still decides something at
every length. ⚠️ The grid minimum barely separates the two (3.3 min against 1.2), so the guard names
the **discriminating case found by sweeping** — intermediate / running / base — where 30 gives 2 sets
and 60 gives 3 and 49 minutes.

⚠️ **ALL-ROUND'S PUSH AND PULL ARE ACCESSORY WORK, AND THE FIRST CUT PRINTED ITS OWN MISTAKE:** a
push-up prescribed at **"3–6 (heavy)" off three minutes' rest**, which nobody can do. The heavy 80%+
prescription is what the evidence supports for the LEGS. Charging them as main lifts also cost them
their place — at 60 minutes the pull slot was priced out and All-Round delivered a push and no pull.

⚠️ **AT MOST TWO SESSIONS A WEEK CARRY THE JUMPS, WHATEVER IS ASKED FOR.** Four sessions each carrying
the shipped dose is 180 contacts against evidenced bands of 60–100 / 100–150. Capping the number of
SESSIONS rather than scaling the dose keeps each one a real plyometric session instead of four token
ones. A **beginner level gets hops and not box jumps** (an intermediate movement), so their weekly
total sits below the band — what choosing that level costs, said rather than hidden.

⚠️ **PLACEMENT IS THE APP'S OWN PUBLISHED RULE.** Ask Alfie has told runners for a year: *"Put it on a
quality day or after an easy run, not the day before a hard session."* So: never the long-run day, and
heavy legs never the eve of the long run or the eve of the week's first quality session. ⚠️ **Two eves
and not every eve, and the reason is arithmetic**: a week holds three hard days, and banning all three
eves plus the long-run day leaves three placeable days against a possible answer of four.

⚠️ **A REAL DEFECT THE EQUIPMENT GUARD FOUND: BODYWEIGHT IS NOT SOMETHING YOU OWN.** `canDo` built the
owned set from the ticks alone, so a runner who ticked "a resistance band" was refused **every
bodyweight exercise in the catalogue** — no plank, no calf raise, no pogo hops. Ticking kit can only
ever ADD. And nothing ticked costs a default runner nothing: all seven shipped exercises list
bodyweight, so an empty kit picks exactly the same seven.

### ⚠️⚠️ THE PLAN-vs-RAW TRAP, SEVENTH FIRING — IN MY OWN NEW PREVIEW ROW

`profileImpact` gained an "Each strength session" row precisely because this screen has shipped
"Your plan comes out the same either way" **twice** while the plan changed (the days question, then
the strength toggle). It read `PLAN.weeks` — the **display summary**, whose sessions carry no
`exercises` — so it compared 0 against 0, found them equal, and stayed silent. Measured on a legacy
runner saving an untouched form: **9 exercises became 7 and the row said nothing.** It reads `RAW` and
`out.raw` now. ⚠️ **My guard passed the whole time**, because it measured the right computation on a
source the screen does not use; only driving the screen found it. The guard now also asserts the
summary genuinely lacks exercises, so the claim about which source is read has teeth.

### THE FORM

⚠️ **THE DRAFT KEY CHANGED FROM A FLAG TO A COUNT, AND BOTH ENDS HAD TO MOVE IN THE SAME BREATH.**
`draft.strength` was `"0"/"1"` and is now `"0".."4"`; the seeder still said `profile.strength ? "1" :
"0"`, which would have silently given every wizard runner **one** session a week instead of Yes.
⚠️ **The four detail questions are hidden where their answers reach nothing** — no sessions asked for,
or a beginner track whose strength session is a fixed 20-minute bodyweight routine — with a line
saying why. That is the volume question's own ruling applied again, and `syncStrength` is called from
**both** `syncStatus` (the track changes) and `bindSegButtons` (the count changes): a control revealed
by one and not the other is the looks-live-does-nothing class this project has shipped three times.
⚠️ **`includeStrength` is DERIVED from the count and stays**, because it is read all over the engine
and the app and none of those readers wants a number.
⚠️ **The equipment ticks write a hidden `s_strkit` field**, so `captureSetupFields` carries them
through a trip to another tab like every other `s_` field; `"-"` is an explicit empty answer, because
`restoreSetupFields` deliberately refuses to restore `""` over a rendered default.

### Two guards restated, both scoped to a place rather than a fact

⚠️ **`test/running-days.test.ts` SWEPT ONE FILE.** Its "the five raw reads stay raw" guard read
`src/plan/generate-plan.ts` alone, so moving the beginner strength count into
`src/domain/strength-days.ts` — one definition of how many strength sessions a week gets — failed a
guard whose invariant was completely intact. It walks the whole `src/` tree now.
⚠️ **`test/silent-defects.test.ts`'s `fnSrc` WAS A CHARACTER WINDOW** with a 9,000-character ceiling;
`draftFromForm` grew past it. **Fourteenth firing of that trap here** — brace-matched now, like the
three other test files that already carry the remedy.

### Traps this stage paid for again

⚠️ **THE BACKTICK RULE FIRED ONCE**, in seven of my own comments at once, and the build failed
outright — which is the good outcome. Sweep `git diff` for backticks on added lines before building.
⚠️ **A PROBE THAT ASSUMES A RESET THE CODE DELIBERATELY DOES NOT DO MEASURES SOMETHING ELSE.**
`seedSetupDraft` opens with `if (draft.__live) return;` — once per session, by design — so my
"untouched form" check re-used a draft I had been clicking through and reported a change that was
mine. Reload, do not re-seed.
⚠️ **`buildPlanSummary` IS IN `src/view/plan-summary.ts`, NOT `generate-plan.ts`.**

### Named, measured, NOT done

⚠️ **THE TWO SESSIONS IN A WEEK ARE IDENTICAL TO EACH OTHER.** A/B rotation is A7's job (standalone
programmes), where the block structure already needs it; doing it here would have meant the
byte-identity comparison carrying a rotation as well.
⚠️ **A BEGINNER TRACK HONOURS ONLY THE COUNT.** `buildBeginnerWeek` builds `generalStrengthSession`, a
fixed 20-minute bodyweight routine, and has two placement slots — so an answer of 3 or 4 delivers 2.
The form says so rather than offering four answers that collapse to two.
⚠️ **`applyRaceDay` NEEDED NO CHANGE FOR FOUR SESSIONS** — it filters everything on and after race day
regardless of count, and `strength` is already in `HARD_BEFORE_RACE` — but nothing had asserted it, so
the placement guard now sweeps race weeks out explicitly rather than leaving it to luck.
⚠️ **NOT SEEN ON A PHONE.** Everything above is a headless browser at desktop width. The equipment grid
is nine tick-boxes and the detail block adds four questions to Training rhythm; worth the owner's eyes.

## ✅ A4 — SWAP ANY EXERCISE, AND A REAL BUG THE GUARD COULDN'T SEE UNTIL THE UI WAS DRIVEN (2026-09-20)

Every strength exercise now carries a "Swap" link. Suite 1576 → **1595**; `test/strength-swap.test.ts`
holds 19 guards and **9 deliberate re-breaks were all caught** (two only after the design was made
more robust, not just guarded — those two are below).

⚠️⚠️ **THE FIRST-CUT DESIGN WAS WRONG AND A DESK CHECK OF THE CODE COULD NOT HAVE FOUND IT.** A swap is
keyed `"sessionId|exerciseId" -> "toId"`, and the first version keyed the lookup on `e.id` — the
CURRENTLY DISPLAYED id. That is correct for a FIRST swap and silently wrong for a second one on the
same slot: after squat → stepUp, tapping Swap again on the displayed "Step-up" looked up
`"w1-d1-strength|stepUp"` instead of `"w1-d1-strength|squat"`, wrote a **brand-new, unreachable key**,
and left the original `squat → stepUp` mapping untouched underneath it. Picking "squat" from that
second picker did **nothing at all**, because nothing ever looks that key up. This was found by
**driving the real sheet in a browser**, not by reading the code or by the guard suite — every
assertion I had written first still passed, because they all tested a single swap in isolation.

⚠️ **THE FIX: `slotId`, STAMPED ON EVERY EXERCISE, ALWAYS, WHETHER OR NOT IT HAS EVER BEEN SWAPPED.**
`withSwaps(sess)` resolves each exercise by `e.slotId || e.id`, then stamps the ORIGINAL id back onto
the output as `slotId` — so the Swap button (`exerciseBlock`) reads `e.slotId` and always has the
correct key to swap FROM, regardless of how many times this slot has already changed. `e.slotId ||
e.id` (not `e.id` alone) is what makes a repeat application of `withSwaps` **idempotent** — applying it
to its own output changes nothing further, which matters if a future consumer (A5's session player,
A9's watch payload) ever re-reads an already-resolved session and calls this again.

⚠️ **THE CANDIDATE LIST NEVER OFFERS THE EXERCISE ITSELF, WHICH MEANS "BACK TO ORIGINAL" NEEDS ITS OWN
ROW.** `swapCandidatesFor` self-excludes the source id (same as A2's `alternativesFor`) — so once a
slot has an active swap, the ranked list can never contain the way back to what it originally
prescribed. `swapPickerHtml` checks whether a swap is currently active for this slot and, if so,
prepends a distinct "Back to the original pick" row built from the catalogue entry directly.

⚠️ **`swapCandidatesFor` IS NOT `alternativesFor` WITH AN EXTRA ARGUMENT, AND THE DIFFERENCE IS WHO IS
CHOOSING.** `alternativesFor` is the plan BUILDER's own fallback when an exercise is unreachable — it
has no level parameter, because the builder already decided the level for that slot. A runner tapping
Swap is choosing for THEMSELVES, and offering something above their own stated level (A3's "how much
lifting have you done") would undo that question one tap after it was answered — a beginner swapping
away from a kettlebell deadlift must never be offered a barbell one. `canDo` already folds equipment
and level into one check, so `swapCandidatesFor` reuses it rather than repeating `alternativesFor`'s
bare equipment test. Measured: at bodyweight+beginner with no equipment ticked, **13 of 62** catalogue
exercises reach a genuinely empty candidate list (push and carry each have only one or zero
bodyweight-eligible members) — real and reachable at the DEFAULT answer, not an unusually tight tick,
so the picker names the reason rather than showing a dead box.

⚠️ **ONLY IDENTITY MOVES.** `sets`, `reps`, `restSeconds`, `loadPercent1RM`, `contacts` and `superset`
all stay on the exercise instance untouched — a slot prescribed heavy triples off three minutes' rest
is still heavy triples off three minutes' rest; only which movement fills it changes. Driven through
the real function with every prescription field populated, not just asserted on paper.

⚠️ **THE PICKER RENDERS THE SCHEMATIC FIGURE, NEVER `exVisual`.** `exVisual` can return an interactive
`<button data-exdemo>` when a still or animation exists, and nesting a button inside the row's own
`<button data-swapto>` is invalid HTML and an unpredictable tap target. A2's own `libCard` sidesteps
this by not wrapping its card in a button at all; here the row itself has to be tappable, so the
thumbnail is `exAnim(cand.pattern)` — always a plain, non-interactive `<svg>`.

⚠️ **NO NEW CSS AT ALL.** The picker reuses `.sw-row`/`.sw-b`/`.sw-n`/`.sw-d`/`.arr` (the exact shell
`startWhereHtml` already uses for "where shall we record this"), `.ex-anim` for the thumbnail slot, and
`.mini-btn.pi-ghost` for the back button — the same "Go back" class `openProfilePreview` uses. The
per-exercise Swap trigger reuses `.pf-edit`, the app's own "Edit"/"Filter"/"View all" micro-link, with
no inline style override so it inherits the on-ladder `--t-body` token rather than adding a literal px
value the design-system ratchet would have to count.

⚠️ **THE PICKER REPLACES THE SHEET BODY IN PLACE — IT NEVER OPENS A SECOND `.sheet-ov`.** Every picker
in this app that needs to return to something already open (`openProfilePreview`, `wireHeatControls`'
clear-adaptation handler) rewrites `#sheetBody` and re-wires rather than stacking a second overlay — a
nested sheet needs its own back-stack and is exactly the shape of z-order bug this project has shipped
before (the Inte-Club share ask opening behind the card it was asking about).

⚠️ **PRUNING SPLITS THE KEY BEFORE CHECKING IT.** `dayOverride` and `heatAdapt` prune by comparing a
WHOLE key against a live session id; a swap key is `"sessionId|exerciseId"`, so comparing the whole
thing would call every swap stale on every boot — no session is literally named `"w3d2-strength|squat"`.
`seedDone` splits on the first `"|"` before checking `alive`. Confirmed live: turning strength off
entirely (which removes every strength session) correctly empties the swap store; changing days-per-
week alone did not, because the session id `w1-d1-strength` happened to survive at both 3 and 5 days —
worth knowing before trusting a single manual test as proof either way.

⚠️ **`SWAP_KEY` SITS WITH THE OTHER STORE KEYS FOR DISCOVERABILITY, NOT BECAUSE IT NEEDS TO.** Unlike
`JOURNAL_KEY`/`CLUBPROF_KEY`/`SLOG2_KEY`, nothing reads it from inside `adoptPlan`'s own call chain —
`withSwaps` only runs when a session sheet is actually rendered, well after boot — so there is no real
temporal-dead-zone risk here. Said plainly in the comment rather than borrowing the neighbours' urgency
for a risk that does not apply.

### Three guard weaknesses found by the re-breaks, all mine

⚠️⚠️ **A LIFTED HARNESS THAT OMITS ONE CONSTANT MEASURES A STRICTLY EASIER PROGRAM, AND EVERY GUARD
STILL PASSED.** `loadSwaps`/`saveSwaps` both read/write `localStorage` under `SWAP_KEY`, inside a
`try/catch`. My first lift concatenated the five functions but never declared `SWAP_KEY` in scope — so
every call threw `ReferenceError`, the catch swallowed it, `loadSwaps()` always answered `{}`, and
`saveSwaps` always wrote nothing. **Three tests calling `setSwap` then reading the result all failed**,
which is what caught it — but it is worth naming as the exact trap this file records for the engine's
own distance tables: a probe supplying its own (incomplete) dependencies proves nothing about the
shipped code. Fixed by extracting the real `const SWAP_KEY = "...";` line via regex rather than
retyping it, so the lift cannot drift from the constant it depends on.

⚠️ **A DEFENSIVE COMMENT WAS TESTED FOR THE FIRST TIME BY A RE-BREAK, AND THE COMMENT WAS WRONG.**
`withSwaps` originally read `const slotId = e.id;` with a comment claiming this was "safe only because
the input is always pristine" — true for every call site that exists TODAY, but untested and, on
inspection, an unnecessary constraint: `e.slotId || e.id` costs nothing and makes the function
genuinely idempotent under chaining, which is strictly more robust for a future caller. Re-broken back
to `e.id` alone, it passed every existing guard — so a new one was added that drives the actual chain
(`withSwaps(withSwaps(sess))` must equal `withSwaps(sess)`), and the code was changed to the more
robust form rather than leaving the weaker one merely documented as fragile.

⚠️ **A LOOKUP WITH A FALLBACK KEY IS A CROSS-SESSION LEAK WAITING FOR A DAY IT IS POPULATED.** Re-broke
the lookup to `m[sess.id + "|" + slotId] || m[slotId]` — a bare-exercise-id fallback. Nothing the real
app ever WRITES could populate that fallback today, so no existing guard could tell the difference; but
the safety property `withSwaps` exists to guarantee is that a decision made for one session can never
affect another, and a fallback lookup breaks that the day anything (a future bug, a hand-edited
`localStorage`, a colliding backup restore) ever writes a bare key. Pinned the exact scoped lookup
expression rather than leaving the property merely true-by-luck.

### The reachability sweep, and the two exemptions it found for free

`test/strength-swap.test.ts` derives every top-level function in the built page and requires each one
reading `.exercises` on a session-shaped object to call `withSwaps` first — a hand-written list is
exactly what let the days question and the strength toggle each ship a screen that silently disagreed
with the plan (this file records both). Three exemptions, each justified rather than assumed:
- `warmupCardFor` gates on **length only** (`sess.exercises && sess.exercises.length`) — a swap never
  changes how many exercises a session has.
- `profileImpact`'s own `strengthShape` row reports a **count and a duration** ("45 min · 7
  exercises") — found by this very sweep, not assumed safe in advance, and correct for the same
  length-only reason.
- `migrateSlog`'s read of `raw.exercises[exIdx]` reconstructs **history** from the pre-A1 v1 store,
  which predates swaps entirely — a swap made today must not rewrite what a runner logged before A4
  existed.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1595 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, the progression audit
byte-for-byte unchanged from A3's baseline (24 under-floor weeks of 18,216, deload depth 29.3%, taper
35.8/21.3/47.4%, long-run inversion 0.9% — A4 touches only render-time exercise identity, never plan
generation), both design ratchets unchanged, and 9 deliberate re-breaks all caught with the tree
restored byte-identical. Driven end to end in a real browser: a squat swapped to a step-up, a set
logged against the swapped-in exercise, both surviving a sheet close/reopen; a second swap on the same
slot correctly overwriting the first key rather than adding a dead one; picking "back to the original"
from the picker correctly clearing the store; a starved candidate list (push-up, beginner, no
equipment) showing the reason rather than an empty box; and mobility/rest sessions (no `exercises` at
all) opening cleanly with zero Swap buttons.

**Still to come in this track:** A6 e1RM and progression, A7 standalone programmes, A8 Strava as
Weight Training, A9 the watch. (A5's session player landed — see the chapter at the foot of this file.)
