# Plan engine — how sessions are built (warm-ups, named time, long-run structure, distance-set runs)

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## The long run reads like a session (added 2026-08-02, from elite-coach feedback)

"How long do you run easy for, then how long do you steady for, over the course of 32km?" Structure
was token before — a 20′ steady finish in build, a capped 30′ block in peak, identical every week —
and a **5k plan's PEAK long run held up to 25 minutes AT 5K PACE** inside an easy run, unrunnable as
prescribed, with the debrief then judging the runner against it.

`longRunFor(wp, ctx)` now selects per week: **base, deloads and the taper stay plain** (durability,
absorption, ease — structure would defeat all three); **5k/10k never carry goal-race pace** (steady
is the ceiling; race pace lives in the interval sessions); **half/marathon build** rotates
progressive → steady / steady-finish / plain, and **peak** rotates fast-finish at goal pace /
interleaved blocks with floats / progressive → goal pace. Rotation runs on its own seed stream
(`LR_SEED`) — sharing the quality rotation's would lock the two together.

⚠️ **Traps the adversarial review caught in the first cut — all four reproduced, do not reopen:**
- **Every dose is CAPPED, including the progressive's.** Uncapped percentages made the progressive
  the only ungoverned format: a 3-day/week 4:00 marathoner drew 240′ with **79′ aerobic + 57′ at
  marathon pace**, double the cap the same plan applied to its fast-finish sibling. `finalCapMin` /
  `midCapMin` are review requirements; what the caps shave off returns to the easy opening.
- **Dose caps SCALE with `vScale`** (`capped()`); percentages already did. Absolute caps on a
  down-scaled run kept the work full-size while the easy shrank, the honest intensity check then
  rejected every scaled candidate, and week-one anchoring silently died (25 km/week → 31 km wk1).
- **Long-run work steps bucket by their OWN RPE in `computeDistribution`** (`stepBucket`,
  session type "long", RPE ≥ 4 → moderate; the aerobic 3–4 gear stays easy by house convention).
  Charging steps to the session's "easy" made every dose invisible: the floor sweep was
  structurally incapable of failing — "identical to HEAD" was guaranteed whatever was added. The
  FOURTH firing of the guard-blind-to-new-input trap. Measured with the honest ruler: this change
  is BETTER than HEAD (32 vs 57 under-floor weeks of 4560).
- **The session RPE band spans the hardest step** (`{min: 2, max: maxStepRpe}`). With the band left
  at 2–3, a runner who executed a race-pace block perfectly and honestly reported 5 was told it was
  "meant to feel about 2–3" after every structured long run, and two in a row raised a false
  ease-off flag from `assessTrainingFlags`.
- **At ≤4 running days, a long run carrying 10+ min of RPE-4+ work IS the week's second key day** —
  `buildWeek` builds the long run first and caps quality at 1 when it carries work. Before: a
  4-day peak week held two interval sessions PLUS the long run's block, honestly 67.0% easy, under
  the floor. The gate derives from the long run's CONTENT, never the rotation index (the documented
  unreachable-formats trap).
- `coachStepTrigger` distinguishes a long run's WORK block (RPE ≥ 4 → "tempo-start") from its easy
  main ("long-run-settle") — the settle line ("patience early… sip fluids") was the exact wrong
  instruction at the lift moment. And `longRun`'s blocks path SHEDS blocks when the run is too
  short rather than stretching past its own title (latent; unreachable via generatePlan, but the
  template is exported).

Costs, accepted and measured: week-one anchoring 79% → 74% (the honest walk-back refusing scaled
plans it previously couldn't judge — still far above the pre-anchor 66%); the long-run
never-shrinks test now holds MINUTES exactly and distance to 2% (scaled caps swap a few race-pace
minutes back to easy pace, ~200 m of composition drift in the same duration).

## The warm-up is built from the session, and it is MEASURED ON THE SESSION AS DELIVERED (2026-08-03)

`src/science/warmup.ts` builds the warm-up from **the first hard thing the session asks for and how
soon it arrives** (`analyseSession` → `firstHardEffort`), not from the session's length or its title.
A run that begins easy is told its opening minutes ARE the warm-up (`embedded: true`); a session that
opens with repetitions gets raise → mobilise → potentiate → transition. `withGeneratedWarmup(sess)`
in `web/app.ts` expands it into real steps at `startSession`, so what the brief promises is what the
live session counts through.

⚠️ **`analyseSession` SKIPS the session's own warm-up step, so `minutesBefore` is NOT the wait the
runner experiences.** Skipping it is right — that step is the thing being replaced — but the
generated raise then stands in its place, so the delivered wait is `raise + minutesBefore`. The
strides gate asked "does the work start inside 20 minutes?" of the *un-raised* number. Found by the
owner on his phone: **"40′ easy → moderate finish"** printed *"the quicker running starts early in
this one"* and prescribed 3 × 18s strides, above a session whose moderate lift begins at **minute 24
of 40**. Measured 18, actual 26. The gate is now `mins + look.minutesBefore <= 20`.

⚠️ **The test that should have caught it was written in the implementation's own frame of reference.**
Its fixture carried 10 min of warm-up + 15 min of easy and asserted strides, which is only "early"
if you also discard the 10. Reframed, and it now sits at the exact boundary (12 min) where both
rules can hold — with `easyProgression(paces, 20)` asserted alongside it as the *wide* window, so a
future change cannot make strides unreachable without a test failing. Same lesson as the race-eve
guard: ask the question the runner would ask.

⚠️ **AN EMBEDDED WARM-UP MUST BE CARVED OUT OF THE OPENING, NOT ADDED TO IT.** Its entire claim is
"the opening few minutes are the warm-up" — minutes the run already contains. Prepending a step
inflated every session that had one: a plain 40′ easy run was **delivered as 42′**, and the
progression run as **45.75′** against a duration chip still reading 40′. The difference now comes off
the first easy step, and **both directions matter** — when the run's own opening is *longer* than the
generated raise the surplus is given back, or the plan quietly loses minutes it asked for. If there
is nothing to borrow from, the raise shrinks rather than the session growing: a 20-minute run must
not become a 29-minute one because its warm-up would not fit inside it.

⚠️ **SWEEP IT, AND SWEEP THE PLAN — `test/warmup-delivery.test.ts`.** The defects above lived behind a
green suite because `withGeneratedWarmup` is web-layer code and every warm-up test was a `src/` test.
That file lifts the function out of the BUILT `web/app.html` (same precedent as
`home-screen-chrome.test.ts`) and runs it over the whole builder catalogue **and every session of real
generated plans**, across four ability bands. Traps it caught in its own construction, each of which
made it prove less than it claimed:
- ⚠️ **`generatePlan(athlete, goal, options)` is POSITIONAL.** Passing one object threw, a
  `catch { continue }` swallowed it, and the plan arm contributed **nothing** — the sweep measured 432
  builder sessions while its comment claimed to cover plans, which are the sessions runners get on
  Today. It throws now. Fixing it immediately found four more defects.
- ⚠️ **`Athlete.recent` is `{distanceMeters, timeSeconds}`**, not `recentRaceDistance`/`recentRaceTimeSeconds`.
- ⚠️ **A NaN duration makes every comparison false, so a broken sweep reports clean.** Paces built from
  the wrong input shape made distance-derived repetitions non-finite; the sweep said NO DEFECTS.
  Non-finite now fails loudly.
- ⚠️ **Never assert a value against itself.** The first version compared the duration chip to the
  delivered length *after* the fix made both read the same array — passing whatever happened. It
  asserts the invariants a runner can be wronged by instead.
- ⚠️ **The strides step is itself RPE 5-7**, so "find the first hard step" finds the strides and
  compares them to themselves. Skip `kind === "warmup"`. Same for the run's OWN strides step in
  "40′ easy + strides", which is the session's work.

⚠️ **STRIDES ADD TIME; THE RAISE DOES NOT.** Only the raise describes minutes the run already
contains, so only the raise is reconciled against the run's own opening. A 23-minute moderate run is
RPE 3-4 throughout — there is no step worth shortening — so trying to absorb the strides shrank the
raise to one minute and still overran. They add, and the chip is derived from the delivered steps, so
the runner is told.

⚠️ **EVERY SECTION OF THE BRIEF CARRIES ITS TIME AND DISTANCE** (`spanText`, owner's request
2026-08-03). A rep block reports the WHOLE block including recoveries — the per-rep figure is already
in the label. A distance the plan **asked for** prints at any size (hill reps are 50 m, and
suppressing that left the row with no figure at all); a distance **inferred** from pace × time is
hidden under 200 m, where it would be rounding noise. The warm-up card's rows read their times off the
delivered steps too, not off the phase: the phase says "3 × 18 seconds", the step it becomes is 75 s
per stride including the walk back.

⚠️ **STRIDES ARE SIX REPETITIONS WITH A RECOVERY, NOT ONE BLOCK** (fixed 2026-08-03). `easyRun`
shipped them as a single 120-second step labelled *"6 × 20s relaxed strides, full recovery"* — the
recovery existing in prose and nowhere else. The owner asked for its length to be labelled and there
was no number to show. Worse, the live session counted through it as **two unbroken minutes at
repetition pace** (3:49/km), which is not the prescription. Now emitted like `hillReps` and the session
builder: one step per repetition, a 60 s walk-back between, none trailing because the ease-down
follows. ⚠️ **The recovery is CARVED OUT of the easy portion, not added on top** — the session was
already two minutes over its title for the strides themselves, and `estimatedDurationSeconds` feeds the
volume and intensity models, so letting the walk-backs extend it would have added five minutes to
every easy+strides session in every plan. Total unchanged (47 min before and after); the walk-back is
now counted as the recovery it is rather than as easy running.

⚠️ **AND THE GENERATED WARM-UP KEPT THE DEFECT FOR FOUR MORE DAYS — fixed 2026-08-07, found by the
owner on his phone, again.** Fixing `easyRun` fixed the strides the SESSION LIBRARY prescribes;
`withGeneratedWarmup` builds its own from `WarmupPhase.potentiate` and still emitted
`durationSeconds: strides * 75` as one step. His screenshot: a single card badged **STRIDES**, one
6:15 clock, label *"5 × 20s strides, the last one or two at the pace you are about to run"* — the
five and the twenty seconds existing in prose and nowhere the runner could act on. There is no way
to tell which stride you are on, when to go, or how long the walk back lasts; the new segment clock,
which exists to answer exactly that, showed 6:15 of unbroken stride effort and a progress bar
filling smoothly through five accelerations and five walks. **A fix applied to one builder is not
applied to the other.** Now one step per repetition with a walk back between, `repeatIndex` set so
the badge reads **STRIDE 3/4**, and a trailing walk back — needed here because on an embedded warm-up
the block is moved to sit immediately before the work.

⚠️ **The 75-second budget is UNCHANGED, and that is what makes it safe.** 75 s per stride always
meant the stride plus its walk back — the warm-up card's own comment said so — so splitting it moves
nothing: measured across a real 36-week plan, **136 sessions, 39 carrying strides, 0 changed length,
worst drift 0 s.**

⚠️ **TWO MATCHES BY LABEL REGEX HAD TO GO WITH IT, AND BOTH WOULD HAVE FAILED SILENTLY.** The
embedded carve-out excluded strides with `!/strides/.test(st.label)` and the reordering found the
block with `findIndex(/strides/)`. Against "Stride 1 of 5" and "Walk back" neither matches — the
carve-out would have started absorbing stride time into the session and the block would have stayed
at the front of the run, with nothing throwing and no way to see it except by running a session.
One predicate, `isStrideStep`, keyed on `display`.

⚠️ **A SPLIT STEP CHANGES EVERY WRITTEN VIEW BUILT FROM IT.** `structureRows` groups uniform
repetitions only when `kind === "rep"`, and these are `warmup`, so the session brief went from one
row to eight — and since `sessionStepText` stores that snapshot on **every logged run**, the
Logbook's "what the plan asked for" would have become a wall of *"Walk back — easy until your
breathing is back"*, permanently, on runs already saved. A dedicated branch collapses them back to
*"4 × 20″ strides, building to about 10 km effort"* with *"with 55″ walk back between"* — which is
better than before, because the walk back is now stated rather than implied.
⚠️ **A BRANCH OF ITS OWN, NOT A LOOSENING OF THE `rep` COLLECTOR.** That collector stops at a change
of pace; strides carry none, and neither do hill reps — so a generalised version would run straight
out of the warm-up and swallow the workout on exactly the sessions where it matters.

⚠️ **Ten steps in a row is ten step-start cues.** `coachStepTrigger` now returns null for a walk back
and for any stride after the first, so the coach introduces the block once instead of talking over
every acceleration for six minutes.

⚠️ **And `StepView` did not carry `targetRpe` at all** — found while changing that function's
signature. `coachStepTrigger` reads `step.targetRpe.min` to tell a long run's race-pace block ("pick
it up") from its easy main ("patience early, sip fluids"). The schedule builder passes a raw
`WorkoutStep` and got it right; the live path passes a `StepView`, where the read was `undefined` on
every step — so **every structured long run got the settle line at the exact moment it was meant to
lift**, which is the defect the split was written to prevent. The function now takes the whole step,
so the two call sites cannot drift apart again.

⚠️ **Grouping uniform repetitions was dropping what they ARE.** `structureRows` rendered them as bare
measurements — "6 × 20″", "10 × 50 m" — so splitting strides into real steps turned a row that read
"6 × 20s relaxed strides" into "6 × 20″". It now appends the step's own label with its leading
measurement stripped, so nothing is printed twice: "6 × 20″ relaxed stride — quick feet, tall, no
strain", "10 × 50 m uphill — strong, tall, driving". ⚠️ That strip regex is in `web/app.ts`, so its
backslashes must be DOUBLED — `\\d` not `\d`. Written singly it shipped as a literal "d", matched
nothing, and the row read "6 × 20″ 20s relaxed stride" with the measurement twice. Fifth firing of
this file's own escaping rule.

⚠️ **The evidence grade is no longer printed on the session card** (owner's call, 2026-08-03). It was a
note about warm-up research in general, repeated under every single session, pushing what to actually
do further down the screen. It still travels on the warm-up object and is still asserted by
`test/warmup.test.ts`; it belongs in Support, where someone asking "how sure are you about this?" can
find it. Don't reinstate it on the card.

**Two findings deliberately NOT changed**, both reported to the owner rather than quietly fixed:
- **Race day prescribes no cool-down.** `applyRaceDay` builds a warm-up plus the race and rests
  afterwards. Whether a goal race should carry a cool-down jog is a coaching decision, not a test fix.
- **A recovery jog has no cool-down either**, and correctly so — it is easy from start to finish, so
  the test scopes that assertion to sessions containing work.

⚠️ **A non-embedded warm-up IS extra time, and that is not the same bug.** The threshold session is
53′ of steps delivered as 62′ — correct, and the sheet's duration chip already adds it
(`extra` is computed only when `!wu.embedded`). Verified they agree to the minute. Don't "fix" it.

⚠️ **Strides go next to the WORK, not at the front.** On an embedded warm-up the run's own easy
running sits between the two, so prepending them put 3 × 18s at RPE 5–7 immediately before eighteen
minutes of conversational running — priming the runner for something twenty-one minutes away.
Strides are a potentiation cue; separated from the effort they precede they are just a hard bit in a
warm-up. Non-embedded warm-ups keep them at the front, where the work follows straight on.

⚠️ **The gate for "is this a run at all" is a PACE OR A DISTANCE, never the step's kind.** A strength
session is one `steady` step at RPE 6–7 with neither, indistinguishable from a tempo run by kind and
effort — which is how "Strength (maintenance)" was handed 21 minutes of jogging and four strides.

## THE NAMED TIME IS THE WORK TIME (decided 2026-08-03, **all four parts shipped 2026-08-04**)

He watched a simulation of "38′ moderate run" and said the 38 should be **the time spent at moderate**,
not the total including the warm-up. Presented with the fork, he chose **grow the sessions** over
renaming them, and asked for the plan's volume targets to be re-based in the same change so his stated
mileage still means what he answered.

**The four parts — all four are now in.** Parts 1–3 landed 2026-08-04 morning; part 4 that afternoon,
and it was NOT the change its own description predicted (see the ⚠️ under part 4).
1. **`framedRun` names the MIDDLE.** `moderateRun(paces, 38)` must deliver 38 minutes at moderate with
   the warm-up and cool-down ON TOP (~48 min door to door), not 6 + 29 + 4. Every template that goes
   through `framedRun` is affected.
2. **Easy and long runs get a REAL warm-up: 5 minutes plus stretches**, excluded from the named time.
   This RETIRES the embedded warm-up for them — the "the opening few minutes are the warm-up" wording
   and `embedded: true` for `effort === "easy"`. Keep `openingMinutes`/the carve-out machinery for
   anything still embedded, or delete it with the last caller.
3. **The live clock resets to zero when the warm-up ends**, so the named time is what the runner watches
   count up. `LIVE.vms` drives everything (cues, steps, splits, the debrief) — reset the DISPLAY, not
   the session clock, or splits and coach timings all shift.
4. **A WARM-UP IS NOT TRAINING VOLUME — the owner's reframing, 2026-08-03, and it is the whole fix.**
   I had this wrong and reported a problem that does not exist: I measured the new, additive warm-up
   minutes as mileage, saw week one open at 1.16× stated, and called it a volume increase needing the
   ramp re-anchored. His correction: *"You can't class warming the body up as real training volume.
   This is just about preparing the body for training and the user can go as slow as they need to,
   therefore putting no additional strain on the body."*
   So the fix is **exclude `warmup` and `cooldown` steps from the volume accounting**, and measure the
   mileage target AND the week-one guardrail on the training portion only. Then the guardrail compares
   like with like, and the preparation sits outside it where it belongs.
   ⚠️ **The work portion DID grow and that part IS volume.** A 38′ moderate asks for 38 minutes at
   moderate where it asked for 29, which is the "grow the sessions" choice he made. So once warm-ups
   are out of the count, expect the fit to pull the named minutes down to keep stated mileage honest.
   The runner covers more ground per week than before — the warm-up jogging — while their training load
   still matches what they answered. That is the intended outcome, not a discrepancy to chase.
   ⚠️ **ONE DEFINITION OF VOLUME, AND IT IS NOT THE INTENSITY MODEL'S.** I also applied the exclusion to
   `computeDistribution`, reasoning that one definition should serve both, and the suite refuted it in
   under a minute: a threshold session fell to 17% easy and a 3-day 5 km peak week to 66.4%, breaking
   the pyramidal floor. The two models ask different questions and are entitled to different
   denominators — *volume:* "how much training load is this week?" (preparation is not load);
   *intensity:* "of the running you do, what fraction is hard?" (warm-up jogging IS easy running).
   Excluding it there does not remove easy minutes from a week, it removes them from the DENOMINATOR.
   `src/domain/steps.ts` says so in as many words. Do not repeat it.

⚠️ **PART 4'S REAL CAUSE WAS NOT THE ACCOUNTING, AND THE ACCOUNTING FIX ALONE CHANGED NOTHING.** Both
earlier sessions assumed the overshoot was a measurement error, then a re-base. Excluding the frame from
the count removed about as much as naming-the-work added, so the two cancelled and week one stayed at
1.16× stated. Measured per-session on the one failing profile (55 km/week, 5 days, 40:00 10k), the
answer named itself in one run:

**`buildWeek`'s easy runs had NO week-to-week progression at all.** `baseMin` is a flat 45 minutes
scaled only by `vScale` — a whole-plan constant — so a midweek easy run was **the same length in week one
as in peak week**, while the long run ramped 55% → 100% around it. Week one held four easy runs of 71,
71, 71 and 63 minutes against a 69-minute "long run", opened at 63.6 km, and sat at **93% of its own
peak**. A block that starts at 93% of peak is not a progression, it is a plateau with a taper on the end.
`EASY_START_FRAC` + `easyRampFor` give easy running the same ramp shape `longRunMinutes` already used.

⚠️ **`EASY_START_FRAC` IS DERIVED (`1 / PEAK_VOLUME_MULTIPLIER`), NOT PICKED.** Peak is stated × 1.25 by
design, so starting easy running at 1/1.25 of its peak length puts week one back at the mileage the
runner stated. Tying the constants together means a future change to the peak multiplier cannot silently
un-anchor week one. Swept 0.75 / 0.80 / 0.85: anchoring 90.8 / 90.0 / 88.7% — flat enough that the
principled value is also the sensible one, so do not "tune" it.

⚠️ **THE RAMP ARRIVES AT THE START OF THE PEAK PHASE AND THEN HOLDS.** Ramping all the way to the last
non-taper week left every peak week still climbing, so the plan's measured peak fell ~4% and the taper
read shallower against it — which broke `the taper genuinely cuts the week` at 27.7% against a 30% floor.
Peak phase is where volume is HELD while the work sharpens.

⚠️ **AND THAT EXPOSED A REAL 5K TAPER SHALLOWNESS — `taper.ts` 5k lead-in is now 0.66, was 0.72.** The
30% floor had been met only by an inflated denominator: before this change the 5k plan's **biggest week
was week 3 of 31**, because base weeks carry fewer quality sessions (so more easy days) and flat easy-run
length let an early base week outweigh the entire peak phase. With the ramp the peak moved to week 27
where it belongs, the denominator became honest, and the 0.72 multiplier's true depth (27.7%) was under
both the floor and its own note's claim of ~28%. **Deepened rather than the floor loosened**, and 0.66
not 0.68 for margin — 0.68 delivers 30.4% against a 30.0% floor, and whoever met that 0.4-point failure
later would be one keystroke from relaxing the floor instead. Only the 5k was affected; 10k, half and
marathon already peaked in the peak phase and their cuts are byte-identical.

**Measured over 640 profiles / 19,200 weeks (4 events × 3–6 days × 4 abilities × 2 experience × 5 stated
volumes), before → after:**
- week one within 1.10× stated: **80.7% → 90.0%**
- biggest week sits in build/peak: **76.9% → 96.9%**
- long run not the longest run of its week: **37.9% → 34.2%** (improved, still the open defect below)
- weeks under the intensity floor: **5 → 5, unchanged** (the documented pre-existing 3–4-day slow-runner
  5 km weeks; no new breaches)
- worst easy fraction: 65.0% → **64.6%** — ⚠️ 0.4 points deeper on the single worst already-breaching
  week, and insensitive to `EASY_START_FRAC` (64.5–64.8% across the swept range), so it is inherent to
  having any ramp at all rather than to its steepness. Accepted and reported, not hidden.
- worst anchoring case unchanged at 1.59× (marathon, 20 km/week stated) — below `MIN_VOLUME_SCALE` the
  per-session floors bind, which is the documented `assessFeasibility` gap, not this.

⚠️ **A SWEEP THAT READS THE WRONG FIELD REPORTS CLEAN.** The first run of that sweep checked
`d.easyFraction`; the field is `d.easy`. Every comparison was false, so it reported **0 weeks measured
and 100% easy** — i.e. "no intensity problems" — while measuring nothing. Fifth firing of this file's
guard-blind-to-the-new-input trap. Any sweep must throw on a shape it does not recognise.

⚠️ **Still outstanding from this work:** the **six warm-up tests** in `test/warmup.test.ts` (5) and
`test/warmup-delivery.test.ts` (1) still encode the retired embedded design and fail. They need
rewriting to the new one, keeping their intent — an easy run gets a SMALLER warm-up than an interval
session, not none. Do not delete them.

⚠️ **Re-record the simulation videos** (`/Volumes/Adam/Inter-Run`, harness in the session scratchpad) —
every one of the 92 shows the old timing.

## NO WARM-UP AND NO COOL-DOWN ON THE LOW-INTENSITY RUNS (owner 2026-08-07, shipped same day)

*"I dont think any of the following runs should include a warm up or cool down: 1. Long run 2. Easy
3. Recovery ... All of the others need a proper warm up as already mapped."* (He numbered a fourth
and left it blank. ✅ **ANSWERED 2026-08-22: it was a typo — there is no fourth type.** The list is
exactly those three, and the note asking about it has been removed rather than left standing, because
a question already answered is a question the next session asks again.)

⚠️ **THIS REVERSES PART 2 OF THE NAMED-TIME WORK** (2026-08-03), which gave easy and long runs a real
five-minute warm-up plus stretches. His reasoning is the same one that removed the ease-down on
2026-08-03 and it applies just as well to the opening: an "ease in" prescribed at easy pace, at the
front of a run that is easy from start to finish, is the same effort under a different label.

**Delivered before → after**, measured on a real plan (this is the clearest statement of the change):

| session | delivered before | delivered after |
|---|---|---|
| 32′ moderate run | 40′ (8′ generated warm-up) | **32′**, one step |
| 80′ long run | 80′ (8′ ease-in + 72′) | **80′**, one easy step |
| 37′ recovery jog | **45′** (8′ warm-up on a recovery jog) | **37′** |
| 25′ continuous tempo | 53′ (18′ warm-up) | **53′, unchanged** |
| 10 × 1′ hard | 46′ (17′ warm-up) | **46′, unchanged** |

⚠️ **TWO SYSTEMS PRODUCE A WARM-UP AND BOTH HAD TO CHANGE — changing either alone is a silent no-op.**
The session library (`easeIn` via `framedRun`, and `longRun`'s own frame) writes the steps **the WATCH
runs**; `buildWarmup` → `withGeneratedWarmup` writes the ones **the PHONE runs**, replacing whatever the
library wrote. Library only: the generated warm-up expands into the gap and the runner sees nothing
change. Delivery only: the wrist keeps warming up while the phone does not.

⚠️ **THE GATE IS KEYED ON THE SESSION TYPE, NOT ON THE WARM-UP BRANCH, AND THAT IS THE WHOLE DESIGN.**
`buildWarmup`'s low-intensity branch fires for anything whose FIRST effort is gentle — which includes
the threshold formats **"Geared run: easy → steady → tempo → easy"** and **"Progression tempo"**. Both
open easy, both land in the same branch as an easy run, and both must keep what they have. Keyed on the
branch, the rule strips the warm-up off a tempo session. Keyed on the RPE the session reaches, it keeps
it on "easy + strides" (RPE 9) while removing it from "long run · fast finish" (RPE 6) — backwards.
`WarmupSession` gained a `type` field for exactly this; it is load-bearing, not convenience.

⚠️ **`moderate + strides` is typed `easy` and KEEPS its 19-minute warm-up** — it carries strides in the
warm-up, so it takes the structured branch and never reaches the gate. That is the right answer, and a
type-only rule applied earlier would have got it wrong. `easy + strides` (RPE 9) correctly loses its
warm-up: those strides sit at the END, after forty minutes that have done the job far better.

⚠️ **RUN–WALK BEGINNERS ARE EXEMPT, and without the exemption the rule strips 100% of a new runner's
preparation.** Every session in a run–walk plan is typed `"easy"` — `assembleRunWalk` has one exit, and
a beginner plan contains no `long` and no `recovery` at all. His own earlier request (2026-08-05) put
the brisk walk there. Ability `"new"` and `runWalk` are exactly coextensive (`runWalk: status === "new"`
and `warmupAbility()` returns `"new"` for the same status), so the ability band is a sound key.
⚠️ `test/warmup.test.ts`'s run–walk fixture had **no `type` field**, so it would have stayed green while
every real run–walk session lost the walk. Sixth firing of the guard-blind-to-the-new-input trap.

⚠️ **"NOT NEEDED" IS A FLAG, NOT `null`, AND THE DIFFERENCE IS A MEDICAL MESSAGE ON EVERY EASY RUN.**
`warmupHtml` renders *"You have told us you are unwell or sore enough that it is changing how you run"*
whenever `warmupCardFor` returns falsy. Implementing this by returning null would have put that untrue
sentence above the step list of every easy run, long run and recovery jog in the app. Seven tests also
call `buildWarmup(...)!` and would have crashed rather than failed. `Warmup.notNeeded` says which of the
two is meant; `withGeneratedWarmup` already returns the session untouched on `!phases.length`.

⚠️ **THE TWO BUILDERS TREAT THEIR FRAME OPPOSITELY, so removing it needs two different fixes.**
- `framedRun` **ADDED** its ease-in on top of the named work minutes, so removing it shortens the
  outing to exactly the named minutes and **counted training volume moves by ZERO** — measured 0.000%
  across 13,024 plan weeks and 0 m across 3,024 sessions, because `isPreparationStep` never counted a
  warm-up as load. The runner covers less ground; their training load is identical.
- `longRun` **CARVED** its frame out of the named minutes (`body = minutes - warm - cool`), so the
  minutes must be **GIVEN BACK** (`body = minutes`) or a "90′ long run" silently delivers 82 — the
  title lying about the session. That moves those minutes from an excluded kind into a counted one, so
  **counted volume rises** (+8.5%/long run, +2.1%/week after the volume fit re-converges).
  ⚠️ Shrinking the outing instead to keep the count still was measured and is **worse on every axis**:
  weeks under the easy floor 18 → 43 of 9,696, and three distance-floor tests fail because a
  half-marathon block stops building past the race distance.

⚠️ **THE COOL-DOWN GOES FROM EVERY LONG-RUN FORMAT, INCLUDING THE FOUR THAT FINISH ON WORK** (steady
finish, fast finish, race-pace blocks, progressive). This narrows the RPE-5 rule he set on 2026-08-04
("a run that finishes on work keeps its jog"), which still governs threshold / VO2 / race-specific —
where the last effort is 5 km pace rather than marathon effort at the end of a two-hour run.
✅ **PUT TO HIM AND CONFIRMED, 2026-08-08: *"Long runs don't need a cool down (just the stretch
optional function in the debrief card)"*.** So this is his decision, not an override to be tidied away
later — do NOT "restore consistency" by giving the structured long runs their jog back. The optional
stretch offer in the debrief is the replacement, and it is shown after every run.
`test/warmup-delivery.test.ts` exempts `type === "long"` and says why.

⚠️ **REMOVING A FRAME BY SETTING ITS LENGTH TO ZERO CREATES A ZERO-LENGTH STEP.** `longRun`'s cool-down
branch was kept so restoring it is one constant — and unguarded it pushes `cooldown(paces, 0)`, a step
of no duration that nothing filters: unreachable in the live session, lengthless on the watch, and a row
reading "0′" in the brief. `if (cool > 0)` guards it and `test/no-warmup-low-intensity.test.ts` sweeps
every session of every plan for one.

**Measured cost, same 512 plans / 11,776 weeks before and after** — reported, not hidden:
| | before | after |
|---|---|---|
| weeks under the pyramidal easy floor | 15 (0.13%) | **20 (0.17%)** |
| worst easy fraction | 61.6% | **60.8%** |
| week one within 1.10× stated | 95.1% | **94.5%** |
| worst anchoring case | 1.21× | **1.27×** |

The intensity cost is real and inherent: warm-up jogging **is** easy running in `computeDistribution`
(a different denominator from the volume model — `src/domain/steps.ts` explains why), so five minutes
genuinely leave the denominator of every framed session. Do not "fix" it by putting the frame back.

⚠️ **A SUBAGENT LEFT A `return null` PROBE GATE IN `src/science/warmup.ts` AND IT LOOKED LIKE A REAL
BUG.** During this work the suite went nondeterministic (10 vs 11 failures on identical runs) and
`test/warmup.test.ts` passed alone while failing in the suite — because a background agent was
patching and probing the real source mid-run. Symptom to recognise: **a test that passes in isolation
and fails in the suite, with the count changing between identical runs, is contamination, not a
defect.** Stop the background work, `git diff src/`, then re-measure. Also worth knowing: **`node --test
$FILES` in zsh does not word-split** — it passes one bogus filename and prints nothing, which reads as
"no failures" if you are grepping for `✖`. Use `${=FILES}` or an array.

## THE COOL-DOWN IS NOW AN OPTIONAL STRETCH SESSION (owner 2026-08-03, shipped 2026-08-04)

He asked for the prescribed cool-down jog to go, replaced by an **optional stretch session
linked from the debrief card** — tap it and you get suggested stretches for runners, with a short
demonstration video he will embed later.

⚠️ **REMOVING THE COOL-DOWN DOES NOT REDUCE VOLUME, and that was his question.** Measured on a 55 km/week
5-day profile: the counted figure changes by **0.0 km**, because `isPreparationStep` already excludes
`cooldown` from `trainingDistanceMeters`. It shortens the outing on the clock and nothing else. Do not
sell it as a volume lever; it is a coaching change (a stretch at the end beats a prescribed jog).

⚠️ **Ship the replacement in the same change as the removal.** Taking the cool-down out on its own leaves
the runner with neither a jog nor a stretch — worse than today.

**The rule that came out of building it, and it is the useful half:** ⚠️ **A RUN THAT FINISHES EASY LOSES
ITS COOL-DOWN; A RUN THAT FINISHES ON WORK KEEPS ITS JOG.** Read from the LAST STEP's own effort, never
from the session type or from `opts`, so a new format cannot be added without this deciding correctly for
it. The line sits at **RPE 5**: ending at the aerobic/moderate gear (4) is still conversational and needs
nothing after it, while steady and above is work. Drawn at 4 instead, "easy → moderate finish" was handed
a cool-down jog it does not need — reinstating the exact padding this change exists to remove.

So: `framedRun` no longer appends anything (its named minutes are the WORK, so the outing is 4 minutes
shorter and the named time is untouched); plain long runs give their cool-down minutes back to their own
easy running; and every threshold / VO2 / race-specific pool, plus a structured long run finishing at goal
pace, still appends `cooldown(paces, 10)`. Ten minutes of jogging down from maximal intervals is a real
change of effort; an "ease down" at easy pace at the end of an easy run was the same effort under a
different label. The stretch session is offered after **every** run either way, so nothing is taken from
anybody.

⚠️ **THREE SESSIONS ENDED ON A SPRINT, AND ONLY A SWEEP FOUND THEM.** The strides and hill-sprint builders
deliberately had no recovery after the LAST repetition — "no trailing one because the ease-down follows".
Remove the ease-down and `easy + strides` ended on a 20-second stride at repetition pace, `easy + hill
sprints` on a maximal 10-second hill sprint at RPE 8, and `moderate + strides` on an 80 m stride at RPE 9,
each with nothing whatever after it. All three now carry a trailing walk-back, **carved out of the easy
portion** exactly as the between-rep recoveries already are, so no session's total moves. `strides()`
takes a `trailing` flag which is **off by default on purpose** — the quality formats have a ten-minute jog
after their strides, and adding a walk-back there would inflate sessions whose length feeds the volume
model.

⚠️ **`body` MUST KEEP THE COOL-DOWN'S MINUTES OUT OF THE LONG RUN'S DOSE MATHS.** Every long-run branch
sizes its race-pace work as a fraction of `body` (0.25 and 0.35 in the progressive, the leftover lead-in
in the blocks). Folding the freed minutes into `body` to "give them back to the easy running" instead grew
every DOSE proportionally — measured, that put a 3-day competitive half's week 9 at **67.3% easy** and broke
the polarized floor. The minutes are added at the END, where they can only land on easy running, and every
dose is byte-identical to before.

**Measured over 640 profiles / 19,200 weeks, against the Part 4 baseline:**
- long run not the longest run of its week: **34.2% → 30.0%** — a 4.2-point improvement, because the easy
  runs each lost four minutes while the long run kept its whole outing. The best result yet on the defect
  the progression audit is meant to address.
- week one within 1.10× stated: **90.0% → 88.5%**, and worst case 1.59× → 1.63×
- weeks under the intensity floor: **5 → 6**; worst easy fraction 64.6% → 64.1%

⚠️ **THAT ANCHORING COST IS AN ACCOUNTING ARTEFACT, AND THE OWNER SHOULD SETTLE IT.** Real time on feet went
DOWN (every framed run is four minutes shorter; no run got longer). The counted figure went UP only because
a plain long run's last few minutes moved from `cooldown` — which `isPreparationStep` excludes — into the
easy running, where they count. Both readings are defensible: those minutes are easy running and arguably
always should have counted, or they should stay excluded because nothing about the run changed except a
label. If he wants the 90.0% held, moving them into `easeIn` instead of the easy body keeps them excluded
and is a one-line change. Not chosen unilaterally, because it is his stated mileage that the number means.

**Build record:**
- `src/science/stretches.ts` — six stretches, hold times, cues, ordering, `stretchTotalSeconds` and
  `stretchHolds`; exported via `web/entry.ts`. ⚠️ `seconds` is ONE hold and the total counts both sides, or
  the routine advertises half the time it takes and the player runs past its own total.
- ⚠️ **The copy may not claim injury prevention or a performance benefit**, and `test/stretches.test.ts`
  fails on either. Static stretching after running is neither; it is range of movement and it feels good.
  Same rule `test/warmup.test.ts` already enforces on the warm-up copy — this sits beside a RED-S screen,
  and a claim we cannot defend costs the runner's trust in everything else the app says.
- `exerciseBlock` gained a **hold mode** rather than a second list renderer: a stretch carries `hold`, and
  gets the same animated demo, name, area and cue with no sets and no weight boxes to log into.
- Six new `POSES` entries so each stretch has its own silhouette. ⚠️ `exAnim` falls back to `POSES.squat`
  for an unknown pattern **silently**, so a typo draws six identical squats rather than failing; the test
  reads the poses out of the built page and asserts every pattern exists. ⚠️ Lying poses need their limbs
  to RADIATE — at a 9-10px limb stroke a torso and two legs within a dozen pixels of the same y merge into
  one dark mass, which is how the glute and child's-pose figures first shipped.
- The offer lives in `runOverviewHtml`, so the finish screen and the Logbook carry it from one builder.
  `STRETCH_VIDEO` is the slot for his demonstration video — set it to a file the build copies into `docs/`
  and it renders in place of the placeholder. It stays a placeholder rather than a remote URL because the
  page ships with no external network assets.
- The guided player counts through the HOLDS (a both-sides stretch is two), and `closeSheet` calls
  `stretchStop()` — without it the interval keeps ticking behind a dismissed sheet and the next open runs
  two of them.
- ⚠️ `test/warmup-delivery.test.ts`'s cool-down assertion was **replaced, not deleted**: it now asserts the
  offer is built, is called from `runOverviewHtml`, is wired to a handler, and that any session finishing
  above RPE 4 still reaches a jog. It is what caught all three sprint-ending sessions.

⚠️ **THE BACKTICK RULE FIRED TWICE MORE IN THIS ONE CHANGE — and the second time it hid.** Both were in
comments inside the runtime JS. The first stopped the build outright. The second was worse: `node web/app.ts`
exited non-zero, the `&& echo` guard meant no success line was printed, and the `node --check` step that
followed happily reported OK **on the previous build** — so the browser was serving a stale page while every
check looked green. Read the build's exit code before trusting anything after it; that is why the rule is
written down.

## Build your own run (added 2026-08-02)

Today › "Add a session" is a **fold-out on the page**, not a modal: the button expands in place and
the coloured type grid drops down onto Today (owner's request). Tapping a type opens the sheet
ALREADY PAST the grid — for quality types a list of real workouts, then the session in full before
Add. ⚠️ The sheet keeps its **own copy** of the grid for the other entry points (the session sheet's
"add a different session", the Plan screen), which have no room for an inline one — so
`shapeDefaultsFor` is a top-level function, not a closure inside `wireAddSessionSheet`, because both
callers need it. The drawer animates on `grid-template-rows: 0fr → 1fr` rather than a `max-height`
constant, which would clip as soon as the grid gains a row. `RC.listWorkouts` / `RC.buildWorkout`
surface the generator's **own** 62 formats at the runner's derived paces, with the plan's own
filters (`competitiveOnly`, `skipWhenReturning`, `minEventKm`). ⚠️ **Never write a second
catalogue** — it would drift within a release and quietly teach different paces.

⚠️ **THE TYPE GRID MUST BE GATED ON THE PLAN** (`runTypesAvailable`, = `RUN_TYPES` filtered by
`extraRep`). `RUN_TYPES` is a fixed seven; a plan is not. Showing all seven broke two things at
once: `buildCustomSession` returns **null** for a type the plan has no representative of, and
reading `estimatedDurationSeconds` off it threw inside `addSessionSheetHtml` *before* the innerHTML
assignment — so the sheet silently froze with `BUILDER` already mutated and every other control on
the stale screen dead. Measured: **80 of 128 profiles** had a dead "Easy + Strides" card, including
any ordinary runner who ticked "returning from a break". The same gate stops a run-walk beginner —
whose plan withholds quality deliberately — being offered sixteen VO2 workouts. `addSessionSheetHtml`
also now falls back to the grid rather than throwing: a recoverable dead end beats a frozen sheet.

⚠️ **A library pick stores its FORMAT ID and is rebuilt from it** at current paces, so a workout
added last week re-derives if fitness re-anchors. **Everything that reads an extra must call
`extraSession`, never `buildCustomSession` directly.** A library pick has `durMin`/`reps` null,
which sends `buildCustomSession` into its "no params — return the plan's representative" early
return: `watchPayloadForToday` and `buildReminderSchedule` both did, so **the wrist was handed a
completely different workout from the phone**, pushed the instant the runner tapped Add — and that
is exactly the cached "today" the watch runs from when it stands alone.

⚠️ **The "best for" tag comes from the session's RPE, not the format's `load` field.** That field is
size relative to its own pool: the *smallest* VO2 session is still an RPE 8–9 interval workout, and
tagging it "a gentle touch" in easy-run green told the runner the opposite of the truth.

⚠️ **A doc comment containing backticks broke the build** — the fourth time this file's own rule has
caught someone. `node web/app.ts` **failed**, so `web/app.html` stayed stale and the `node --check`
step reported OK on the *previous* build. Check the build exits 0 before trusting any check after it.

Known and not fixed: the browser ignores `fmt.phases`, so a peak-only session can be picked in week
one. Defensible — the runner is deliberately building their own run — but it is a real difference
from what the generator would schedule.

## RUNS SET BY DISTANCE AS WELL AS BY TIME (owner, 2026-08-26, four Runna screenshots)

*"we need to try and find a fix for that....here are some examples of where it has been done in runna"* —
after the previous pass measured the gap and did not close it. Suite 1342 → **1348**; 11 re-breaks, 10
caught and the eleventh is a measured no-op recorded as such.

⚠️ **THE SPECIFICATION IS HIS SCREENSHOTS, AND THE RULE FALLS STRAIGHT OUT OF THEM: ANYTHING YOU RUN IS A
DISTANCE; ANYTHING YOU REST IS A TIME.** `7km at a conversational pace`, `2km at a conversational pace`,
`1km at 5:20/km`, `400m at 4:40/km` — and then `90s walking rest`. Also read off them and NOT yet built:
the duration shown as a **range** (35m–45m), the easy pace as a **ceiling** ("No faster than 5:40/km.
This is a limit, not a target"), and a **Switch to RPE** toggle for rolling terrain.

**Measured before: 65 sessions clock-only against 9 with any distance-gated step. After: 33 of 89
sessions in a real half block are set by distance — 37%, against 12%.** On screen:

| day | title | steps |
|---|---|---|
| Mon | **5.6 km easy run** | `5.6 km` |
| Wed | **5.8 km easy → moderate finish** | `3.4 km` \| `2.4 km` |
| Fri | **5 km recovery jog** | `5.0 km` |
| Sat | **4.4 km easy + strides** | `4.0 km` \| `20s rep` \| `60s recovery` ×6 |
| Sun | 90′ long run | `5400s` — still the clock, deliberately |

### ⚠️⚠️ WHY THIS IS SAFE: `assemble` WAS ALREADY GATE-AGNOSTIC, AND THAT IS THE WHOLE DESIGN

`assemble` derives `estimatedDurationSeconds`, `estimatedDistanceMeters` and `trainingDistanceMeters` from
the steps via `stepDuration` and `stepDistance` — and **both already handled a distance-gated step**,
converting back at the same mid-band pace. So **every model keeps being fed minutes** (`peakLong`,
`easyCapMin`/`easyCapKm`, `volumeMultiplierByWeek`, `enforceLongRunIsLongest`, the volume fixed point in
`buildAll`), the conversion happens only as the step is emitted, and the sole drift is the rounding.
**Measured over the same 768 plans / 18,624 weeks: the pyramidal easy floor UNCHANGED at 34, the long-run
inversion UNCHANGED (1.2 / 0.1 / 0.4 / 0.0%), intensity buckets and race-pace shares unchanged; biggest
week in build/peak 96.9% → 96.7%, week-on-week rises above 1.10 10.9% → 11.0% (+7 of 8,352), taper cut
mean 37.4% → 37.3%.**

⚠️ **THE TITLE IS REBUILT FROM THE STEPS.** A title reading "37′ easy run" over a step reading 6.6 km is
two answers to one question, and his screenshots name the distance ("7km Easy Run"). Guarded by an EXACT
claim the old minutes-only guard could not express: the distance in the title equals the steps' total to
within one unit.

### ⚠️⚠️ THE WHOLE BODY IS ROUNDED ONCE AND APPORTIONED — PER-SEGMENT ROUNDING WAS A MEASURED DEFECT

A long run or progression has two or three segments, so rounding each independently carries ±150 m of
noise — more than a genuine small week-on-week rise. **Measured with per-segment rounding: 428 of 23,520
long runs came out SHORTER than the week before**, against a ladder this engine goes to real trouble to
keep monotone. `byDistanceSet` rounds the body's total once and hands the remainder to the longest
segments, so the parts sum to the whole.

⚠️ **AND THE TOTAL IS ROUNDED *UP*: ROUNDING GIVES THE RUNNER THE WORK, NEVER TAKES IT AWAY.** Rounding to
nearest pushed a floor-hugging session under its own floor — measured, *"easy run 20 min is below the
floor"* against the engine's 20-minute minimum, because 20.0 minutes of exact distance rounded down to
19.9. Ceiling also preserves monotonicity for free, and costs one unit per SESSION rather than per step.
⚠️ **THE TOLERANCE IN THE GUARD IS THEREFORE PACE-DEPENDENT, NOT A NUMBER PICKED TO PASS.** One unit is
~34 s at easy pace and ~44 s at recovery pace, which is why a flat 0.6′ failed on *"a 20′ recovery jog is
20.6′"* — and widening it to 0.7 would have been fitting the guard to the answer. The direction is
asserted separately: never shorter than named.

### ⚠️⚠️ A REAL DEFECT THIS WOULD HAVE SHIPPED: BUILD-YOUR-OWN-RUN

`buildCustomSession` clones the plan's representative and scales its steady body, summing
`st.durationSeconds` directly — so the moment the representative's body became a distance the sum went to
zero, the whole scaling branch was skipped and the representative was passed through untouched.
**Measured: *"recovery asked for 3 km and delivered 4.60 km"*, *"recovery 4.5 km is 35.1′ but seeded as
20′"*.** It uses `stepSecs`, the app's own gate-agnostic converter, now.
⚠️ **AND IT SCALES THE FIELD THE STEP ACTUALLY CARRIES.** Writing a duration onto a distance-gated step
gives it BOTH, and the runtime's rule is `distanceMeters != null && durationSeconds == null` — a step with
both ends on the CLOCK, which is the exact defect a real outing reported when a custom 1 km finished at
0.59 km. Guarded, and no step in a real plan may carry both.

### ⚠️⚠️ THE LONG RUN IS STILL ON THE CLOCK — TRIED, MEASURED, BACKED OUT

It is the session he named ("7.5km Progressive Repeat Long Run") and converting it is **two lines**.
What stopped it: its dose arithmetic is a fraction of `body` in minutes, and **six guards read the
delivered dose back off the steps in minutes** and go blind the moment a work segment carries a distance —
*"the long run reads like a session — real doses, in the right phases only"*, *"the lift is clamped to the
plan's own peak long run"*, *"a lift never builds a week-on-week jump tail — measured on BOTH
definitions"*, *"capping the easy runs is the belt"*, and the ladder guard. The honest order is **make
those six gate-agnostic, then convert**. Recorded beside `longRun`'s own title line, with the 428/23,520
measurement, and asserted by a guard so the state reads as deliberate rather than forgotten.

### The blind instruments this uncovered — the recurring trap, four more times

⚠️ **A RULER THAT CANNOT SEE THE THING IT IS POINTED AT.** Every one of these summed
`st.durationSeconds` with no distance fallback, so a converted session read as a fraction of itself:
`tools/audit-progression.mjs` (`secs`, `raceSecs` — fixed in the previous commit, and it corrected the
repo's own race-pace figures), `test/no-warmup-low-intensity.test.ts` (`mins`, measured *"a 20′ easy run
is 0.0′ of steps"*), and the same shape in `test/warmup-delivery.test.ts`, `test/segment-clock.test.ts`,
`test/heat-adapt.test.ts` and `test/custom-session-gear.test.ts`.
⚠️ **`test/no-warmup-low-intensity.test.ts`'s NAMED-TIME GUARD WAS RESTATED AND STRENGTHENED, NOT
RELAXED.** It was *"the named minutes are what the runner is actually given"* and it failed on a correct
change because its subject moved — the guard-scoped-to-a-HOW pattern, again. The invariant never was about
minutes: **it is that the title does not lie.** It now asserts both currencies, and the distance claim is
exact where the minutes one is a tolerance.

### ⚠️ A PRE-EXISTING INCONSISTENCY THIS SURFACED AND DID NOT CAUSE

**The engine has two conventions for an effort-only step.** `stepDuration` in `session-templates.ts`
returns **0** for a step with a distance and no pace (a hill sprint carries none on purpose, since pace up
a hill is a function of the gradient); `stepSeconds` in `src/science/intensity-distribution.ts` credits it
at a nominal **4 m/s**, precisely because returning zero once made a maximal hill session compute as 100%
easy. So a hill-sprint session's `estimatedDurationSeconds` under-counts by the sprint time: measured,
*"10 × 50 m hill sprints, walk back"* states **39′** where the 4 m/s ruler reads **41′**. Nothing here
touched `hillReps`. Worth someone's attention on its own.

⚠️ **AND THE WORKFLOW LAUNCHED TO MAP THIS DIED ON NETWORK ERRORS** — 9 of 10 agents lost their connection
("the response stopped arriving", "your computer went to sleep mid-response"). The blast radius was found
instead by DOING the change and letting the suite report the consequences, which is stronger evidence than
a reading: it is what found `buildCustomSession`, the 428 shorter long runs and the 20-minute floor.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1348 pass / 0 fail**,
and the week above read off the served build in a browser.

### ROUNDING THE FIGURES A RUNNER READS (owner, 2026-08-26) — ONE FIX, TWO BLOCKED ON THE SAME KEYSTONE

*"I think that the should always be in multiples of 5's when we are talking about long or easy runs (when
its a timed run). When its a Distance based run, i want you to round up to make it easier for the runner
e.g. a 4.6km easy run would just become a 5km"* — with a screenshot showing a `27′ long run`, a `31′ long
run`, a `4.6 km easy run` and a `25′ easy + gentle pickups` whose chip read **26 min**.

✅ **THE 26-MINUTE MISMATCH WAS A DEFECT HE SPOTTED WITHOUT LOOKING FOR IT, AND IT IS FIXED.**
`contPickups` added its `4 × 15″` on top of the named minutes instead of carving them out, so it
delivered **exactly one minute more than its title at every duration** — measured 21 / 26 / 28 / 33 for
20 / 25 / 27 / 32. `easyRun`'s strides already had this exact fix (the walk-back is taken out of the easy
running rather than extending the run), so it was the same defect in the sibling builder, never caught
because its own guard summed the same steps it built.

✅ **THE TIMED BEGINNER RUNS ARE MULTIPLES OF FIVE.** `contExplore`, `contPickups` and `contProgression`
round at the top, so the steps and the title derive from one number and cannot disagree.
⚠️ **UPWARD, NOT TO THE NEAREST — the same rule the distance rounding follows.** Nearest was tried and it
**trimmed a beginner's week**: a 23-minute midweek run came out at 20 and *"a beginner's midweek runs keep
their own ramp — the beginner fix lifts the long run, it does not trim the week"* failed on it. Choosing
nearest for minutes while ceiling distances would also have been two rules for one idea.
**Cost, measured: week-on-week rises above the 1.10 guardrail 11.0% → 11.4% (+30 of 8,352); easy floor
unchanged at 34; taper mean 37.3% → 37.1%.**

### ⚠️⚠️ BOTH REMAINING ASKS ARE BLOCKED ON THE SAME KEYSTONE: THE LONG RUN'S CONVERSION

**1. The long run cannot be rounded to five minutes while it is timed — the two rules contradict each
other arithmetically.** Five minutes of a 45-minute long run is **11%**, and the evidence report's
week-on-week ceiling is **1.10**. So a long run cannot both step in fives and respect the clamp
`LONG_LIFT_STEP_MAX` exists to hold. Built and measured: **six ladder guards failed outright** — *"a lift
never builds a week-on-week jump tail — measured on BOTH definitions"*, *"a deload's and the taper's long
run is never LIFTED"*, *"the invariant is reached by GROWING the long run, not by shrinking the week"*,
*"a beginner's long run knows what race they entered"* and two more — because they encode the exact minute
relationships the ladder, the deload multiplier and the taper multiplier compute, and quantising the
answer afterwards makes the delivered run disagree with what those decided. On its own it cost +13 of
8,352 transitions over the guardrail.

**2. The friendly 500 m rounding works and breaks HIS OWN EARLIER RULE.** Set `KM_UNIT_M` to 500 and
`4.6 km` becomes `5 km` exactly as he asked — and **12 of 54,720 weeks then put a longer EASY run than the
long run**, against *"the long run is meant to be the longest run of the week"* from two messages
earlier. The mechanism is not subtle: an easy run's distance ceils up by as much as 500 m while the long
run is measured in MINUTES and cannot follow, and in those twelve weeks `enforceLongRunIsLongest` is
already pinned by the 1.10× clamp or the event's own ceiling, so it has no room to lift over it. Held at
**100 m** with the reason recorded on the constant.

⚠️ **SO THE KEYSTONE IS CONVERTING THE LONG RUN, AND IT UNBLOCKS BOTH.** Converted, it reads *"8 km long
run"* — a round number reached without touching the ladder's arithmetic, because `byDistanceSet` rounds
the OUTPUT while every minute the models see stays exact; and it rounds on the same friendly unit as the
easy runs, so it cannot be overtaken. What that needs first is the six ladder guards made gate-agnostic —
the same job named in the previous chapter, now with two more reasons to do it. Then `KM_UNIT_M` goes to
500 and `roundMinutes` is not needed for the long run at all.

⚠️ **AND THE GUARDS NOW READ `KM_UNIT_M` OUT OF THE ENGINE** rather than keeping their own copy — a guard
with its own constant measures the test's value, which this project has watched escape a re-break twice.

**Verified:** build exit 0, `docs/voices/` clean, tsc clean apart from the one pre-existing
`test/onboarding-wizard.test.ts` Date overload, **1348 pass / 0 fail**. His week 3 now reads
`25′ explore run` · `Mobility flow (15′)` · `3.4 km easy run` · **`25′ easy + gentle pickups`** (was 26) ·
`31′ long run`.
