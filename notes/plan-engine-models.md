# Plan engine — the models (paces, volume, long run, taper, race day, session library)

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## ONE DEFINITION OF A WEEK'S MILEAGE (fixed 2026-08-07)

The suite's last failing test — `re-entry eases load without cramming missed work back in`, which had
been red for days and read like an adaptation bug — was an **accounting** bug, and the whole thing is
a lesson in where a defect hides.

⚠️ **WHEN `trainingDistanceMeters` ARRIVED, SIX CALL SITES WERE UPDATED AND TWO WERE NOT.** The volume
reframing (*a warm-up is not training load*) made `generate-plan.ts` sum
`s.trainingDistanceMeters ?? s.estimatedDistanceMeters ?? 0` in six places. `src/adapt/injury.ts` and
`src/adapt/missed-sessions.ts` kept summing `estimatedDistanceMeters` — the WHOLE outing. So an
adjusted week came back **measured on a different scale from every other week in the same plan**:
measured on a 5-day half block, a re-entry week reported **40.9 → 44.1 km while every session in it
got shorter**. Nothing threw. The number was simply of a different kind. Bisected to `cbe815f`.

⚠️ **AND THE TRIMS ONLY TOUCHED THE SHOWN FIGURE.** Both modules scaled `estimatedDistanceMeters`
alone, so "trim the long run 20%" and the injury model's "cut volume to 60%" changed the session
cards and moved the week's counted mileage **by nothing at all**.

`sessionVolumeMeters` / `weekVolumeMeters` / `scaleSessionDistance` in `src/domain/steps.ts` are now
the single definition, used by the generator and both adapt modules.
⚠️ **Verified byte-identical for every valid plan**: 38,160 sessions across 96 profiles, plan hash
unchanged. The helper replaced the formula; it did not change it.

⚠️ **THE RESIDUAL IS REAL AND IS NOT A BUG.** After the fix, 11% of re-entry weeks still grow in
kilometres — because demoting a hill or race-pace session (0.5 km of counted distance for 39 minutes)
to easy running genuinely adds ground while removing work. On MINUTES, the honest ruler, it is 4%.
Check which of the two a "volume" defect lives in before changing anything; the progression audit
learned this once already.

### The amplification found on the way, and the four tests that did not discriminate

⚠️ **`Number.isFinite`, NOT `!= null`.** `qualityRefFor` is a MEAN over the plan's quality sessions,
so one non-finite duration makes the mean non-finite — and its consumer's gate was `qRefMin != null`,
which **NaN passes**. Every compensating easy run in a 36-week block then came out NaN, titled
*"NaN′ easy + strides"*. Measured: **1598 of 8480 sessions** with the gate as written, **93** with it
guarded — and the 93 are the genuinely broken sessions themselves, which is correct.

⚠️ **IT IS NOT REACHABLE BY A RUNNER, AND I REPORTED IT AS IF IT WERE.** The trigger is a `Goal` with
no `targetTimeSeconds`: `paces.goalRace` comes back with **null bounds**, so distance-gated race-pace
reps cannot be timed. But that field is `number`, not `number?` — TypeScript rejects it, and
`web/app.ts` always computes one (Riegel if the runner did not enter it). With a valid goal:
**0 NaN in 38,160 sessions.** ⚠️ **A plain `.mjs` probe has no typechecking, so it can feed the engine
a shape no caller can produce and the result looks like a product defect.** Check the type before
believing a sweep. The amplification is still worth guarding — one bad session must never rewrite a
whole plan — but it is hardening, not a fix.

⚠️ **FOUR TESTS IN THIS ONE CHANGE PASSED WITH THE FIX DELIBERATELY REMOVED.** Each for a different
reason, and none was caught by reading them:
- *Comparing a value with itself.* `assert.equal(week.plannedDistanceMeters, weekVolumeMeters(week.sessions))`
  holds however the sessions were scaled. The real invariant is that a scaled session moved **both**
  of its distance figures by the same factor.
- *One fixture instead of a sweep.* The NaN test built a single plan; most configurations do not
  amplify at all.
- *The wrong filter.* It counted `type === "easy"`; the sessions that inherit the NaN are typed
  `strides` and `recovery`.
- *A threshold set from taste.* Every bound in the new file is now set from a measurement recorded
  beside it (re-entry rises: 61% before, 11% after; NaN: 15.5% vs 0.9%).

`test/week-volume-accounting.test.ts` holds all of it, and every guard in it was watched failing
against the reverted code before being believed.

## The pace model (reworked 2026-07-28) — read before touching `src/science/paces.ts`

**The gears are MULTIPLES of threshold pace, not fixed offsets.** `PACE_RATIOS` in
`src/science/paces.ts` is the single source of truth: easy 1.22–1.33×, moderate 1.13–1.20×, steady
1.06–1.12×, true tempo 1.025–1.05×. cv/vo2/rep/goalRace come from race predictions and already scale.

Why: the old model used constant offsets (+92 s/km for easy, +35 for steady). A constant +92 is a
50% slowdown for a 14-minute 5 km runner and 16% for a 45-minute one, so easy/threshold drifted from
1.50 to 1.16 across the range where Daniels' tables sit near 1.22–1.30 throughout. Fast runners were
told to jog absurdly slowly; beginners — who most need permission to go easy — got an "easy" pace
barely easier than their tempo.

⚠️ **Anything that inverts the model must use `paceRatioMid()`, never a hardcoded number.**
`impliedRecentFromRun` subtracted 92, which silently became wrong: a 16:00 5 km runner completing an
easy run exactly on target was read as a **13:14** runner, a 40:00 one as **43:51**. Round-trip error
is now ≤2 s. The same constant was in the "enter your easy pace" seed for building runners.

⚠️ **A 1 km trial may sharpen VO2 pace; it may never break the ladder.** `reconcileVo2()` clamps the
MAS band into the corridor between rep pace and CV, and refuses to *blunt* it below what the race
times already imply. Before this, 27 of 63 realistic (5 km, 1 km) pairings produced an inverted
ladder — an 18:00 5 km runner who trialled 4:15 got "intervals" at 4:15–4:31/km, slower than their
own threshold. The web layer separately re-anchors the whole plan when the trial projects a *faster*
5 km (`buildFromProfile`), so the clamp is the safety net for a *poor* trial.

⚠️ **`PACE_MODEL_VERSION` in `web/app.ts` must be bumped whenever the derivation changes.** Logged
runs are stamped with it, and `flagObservations()` stops its walk at a mismatch. Without this, a
model change re-anchors every band while leaving `recentTimeS` untouched, so the flags engine reads
a change in the *prescription* as a change in the *runner*: measured, a banner fired for 16 of 36
one-minute ability buckets from a habit the app itself had prescribed, and the worst case told a
40:00 runner "the plan can be quicker — 36:07". Same trap as anchor stamping, different trigger.

**Intensity distribution is per-STEP, not per-session.** `computeDistribution` used to charge a
55-minute threshold session's whole duration to "moderate" when 30 minutes of it is warm-up, jog
recoveries and cool-down — enough to push five-day build weeks under the pyramidal floor as a pure
accounting artefact. Buckets by kind AND by effort: anything at RPE ≤3 is easy running whatever it
is called (the `setBreak` jog between compound blocks is a `steady` step, so kind alone missed it).
Effort-only hill sprints have no pace by design, so they are counted at a nominal 4 m/s — returning
zero made a maximal hill session compute as 100% easy.

**Result: 0 of 2816 generated weeks fall under the easy floor** (was 61). Also: a 4-day week gets one
quality session outside peak — ⚠️ applied as a CEILING via `Math.min`, *after* the phase decides, or
it overrides the base phase's deliberate zero-quality foundation block.

Known and NOT fixed: an unrealistic goal (a 30:00 5 km runner targeting 20:00) yields a goal pace
faster than the athlete's own mile pace, so race-pace sessions are unrunnable. `assessFeasibility`
already returns "unrealistic" with a suggested target, so the runner is warned — but the sessions
themselves are not clamped. That is a product decision, not a bug fix.

## The volume model (added 2026-08-01, from elite-coach feedback)

"Total mileage for a competitive runner looks a little on the low side." The cause was not a wrong
constant: **there was no volume model at all.** `Athlete.weeklyVolumeKmCurrent` had existed since the
first commit and was read **nowhere**, so stated volumes of 50, 90 and 140 km/week produced
byte-identical plans (measured: peak 74.2 km either way).

`targetPeakWeeklyKm()` in `generate-plan.ts` is stated × **1.25** — build above where the runner is,
but not by much, since progression is the ceiling on adaptation. The plan is then fitted to it.

⚠️ **SOLVED BY ITERATION, not by a formula.** The week is not linear in the scale: quality sessions
are prescribed by the library and do not move at all, and the per-session floors/ceilings bind at the
ends. Two earlier attempts were wrong — scaling against fixed reference constants ignored that the
natural peak depends on days-per-week as well as race distance, and a **single** corrective pass left
a 50 km/week runner peaking at 81 km (a 62% jump, not the 25% intended). `buildAll(vScale)` is
rebuilt to a fixed point, ≤5 passes, 3% tolerance.

⚠️ **IT SCALES DOWN AS WELL AS UP — week one is anchored to the stated mileage.** The first cut set a
peak destination and left the START where it had always been, so a half-marathon runner answering
**10, 25 or 40 km/week got a byte-identical plan opening at 35.5 km**, and **60% of all non-beginner
answers changed nothing at all** while the question on screen promised otherwise. The evidence spec
(`Evidence_Based_Running_Training_Prescription_Engine.html`, commissioned 2026-08-01) says it three
times: *"Never jump an athlete to the bottom of a band"*, *"If current tolerated volume is below the
band, start from current load"*, *"Set week one near the athlete's recent baseline. Do not jump to
band minimum."* Measured after: **week one is within 1.10× stated in 90% of realistic profiles**
(was 54%), and starting *below* stated is fine — the spec's whole concern is the jump upward.

⚠️ **THE LONG RUN GROWS WITH MILEAGE BUT IS NEVER CUT BY IT** (`Math.max(1, vScale)` on `peakLong`).
It answers the RACE, not the week: a runner on 25 km/week still has to build toward a 17 km long run
before a half, and that progression *is* the plan. Letting `vScale` cut it was measured as
destructive — because `vScale` reaches only the long run and the easy runs, and the easy runs stop at
20 minutes while quality never moves, every further unit of shrink came out of the long run alone. A
marathon runner stating 30 km/week got a longest run of **10.3 km** (22.6 km unstated); a
half-marathoner **8.8 km** for a 21.1 km race; and in 48 of 144 realistic profiles the "long run"
ended up **shorter than the midweek workout beside it** — the exact incoherence that made the first
attempt abandon down-scaling. ⚠️ **The intensity guard cannot catch this**: a shorter long run removes
easy minutes proportionally, so the *ratio* stays healthy while the structure rots. With the one-way
rule, long-run size is identical to never scaling down (mean longest-long/race 1.20 either way,
inversions 14.3% vs 14.4%) and anchoring still rises 66% → 79%.

⚠️ **Validate the plan the runner is GIVEN, transforms and all.** `buildFull` runs
`applyPartialFirstWeek` + `applyRaceDay` before the check. Both strip *easy* running out of a week
while leaving its quality session in place, so validating the pre-transform weeks measures a plan
nobody receives: 969 of 52,920 profiles were delivered a first week under the floor that the check had
passed. The web layer defaults the start date to **today**, so a partial first week is the normal
case. Measured over 210,944 weeks: validating the delivered plan gives 3450 under-floor weeks vs 3495
pre-transform and 3482 unscaled — i.e. better than doing nothing, which the other two orderings are not.

⚠️ **BISECT the back-off; never step.** `scale + (1 - scale) / 2` overshoots the whole safe interval —
for one measured runner the smallest safe scale was 0.481, the failing fit 0.459, and a single step
landed on **0.730**, skipping 84% of the usable range. Which side you landed on is not monotone in the
stated mileage, so **answering 30 km/week produced a 32% smaller plan than answering 29**, and on the
form's own 5 km spinner one click *up* shrank week one by >10% in 20 of 96 configurations. Worst drop:
19% stepping, **2% bisecting** (the unscaled engine's own discretisation noise is 1%).

⚠️ **Two things make scaling down safe, and BOTH are load-bearing.** `vScale` reaches only the long
run (`peakLong`) and the easy runs; quality keeps its full library length, so shrinking a plan
shrinks the easy running around fixed hard sessions and the hard fraction climbs by pure arithmetic
(that is what put **175 of 23040 weeks** under the 0.68 easy floor on the first attempt).
1. **Fewer key days in a smaller week** — `qualitySessionsThisWeek` caps quality at 1 outside peak
   when `vScale < 0.9`, the same rule as the existing four-day cap but measured in volume. The
   evidence spec pairs a smaller week with fewer key days for exactly this reason (Intermediate 1–2,
   Advanced 2).
2. **`generatePlan` CHECKS the result instead of assuming it** — `intensityProfile` + `noWorse`. A
   down-scaled plan is accepted only if it adds no week under the floor and drives no week deeper
   than the unscaled plan's own worst; otherwise the scale walks back toward 1, and failing that the
   unscaled plan is used. A post-condition survives a future change to the session library. A fixed
   floor of 1 never guaranteed anything — it only avoided the question.

⚠️ **Three ways of writing that check are wrong, each measured.** Absolute compliance condemns the
scaled plan for an *inherited* fault (28 of 1792 weeks are already under the floor with **no** stated
volume — a 3-day 5 km block for a slow runner, worst 54.5% easy) and hands back an unscaled plan that
breaches just as often. Breach **count** alone lets a shallow breach be swapped for a deep one
(54.5% → 47.1%). Comparing **minima** (`cand.minEasy >= base.minEasy`) sounds equivalent to a floor
and is not — every down-scale nudges some comfortable week down a little, so 80% → 75% is rejected
though both are far above the floor, which turned the fix off for most runners (anchoring fell back
to 78%). It needs the count **and** a floor of `min(modelFloor, base.minEasy)`.

⚠️ **Only check when scaling DOWN.** Scaling up adds easy running and nothing else, so it cannot
lower an easy fraction; running the check anyway is actively harmful, because a plan that already
breached at its natural size gets "corrected" back to that same breaching plan with the runner's
mileage discarded — measured, 8 breaching configurations became 15.

⚠️ **The web field is `profile.volKm`, NOT `profile.weeklyVolumeKm`, and that is the whole point.**
`weeklyVolumeKm: 30` sat in `DEFAULT_PROFILE` from the first commit with **no screen that ever asked
for it**, and every save copied it forward — so every profile ever stored holds a 30 nobody chose.
Feeding that phantom to a model that reshapes the plan rebuilds every existing runner's block on the
first boot after the update, with no tap: measured on the default profile, a half-marathon peak week
**55 → 40 km** and its longest long run **110 → 55 min**; a competitive marathoner's long run
**147 → 74 min**, halved, and in the *opposite* direction from the answer they would have given. A
brand-new key cannot be pre-filled by history, so absent means unanswered and the model stays
genuinely opt-in. `classifyRunner` now reads `volKm` too (its result, `CLASS`, is assigned and read
nowhere). Do not "tidy" this back onto one field.

⚠️ **Pick regression cases by SEARCH, not by taste.** The monotonicity test's first three athletes
were hand-picked and every one of them passed under the broken coarse step. The rows that actually
discriminate (`5k 4d 35:00 competitive`, `half 4d 35:00 competitive`) were found by sweeping 480
configurations for one that fails with the old code and holds with the new — slower runners on four
days, because that is where the intensity check binds. A test written from intuition about where a bug
"should" appear guards nothing; re-break the fix and watch the test fail before believing it.

⚠️ **Any new axis must be added to `test/session-library.test.ts`'s intensity sweep.** That sweep is
the guard for the easy floor, and its athlete did not set `weeklyVolumeKmCurrent` — so the entire new
dimension was untested and the suite stayed green through the regression above. The sweep now varies
stated volume, and reverting the floor to 0.5 makes it fail on
`5k 4d competitive 20wk vol=20 week 11`. Same trap as anchor stamping: a guard blind to the new input
is not a guard.

Beginners are exempt (`experience === "beginner"`, i.e. status *new* and *building*): their
progression is deliberately gentle and volume-independent. `syncStatus()` therefore **hides** the
question for those statuses — a question whose answer is thrown away is worse than no question.

⚠️ **A pre-existing gap the volume work surfaced but did not cause:** 28 of 1792 measured weeks sit
under the easy floor with **no stated volume at all** — 3-day and 4-day 5 km blocks for slower
runners, where one library-length quality session is simply a large share of a small week. Identical
before and after this change (verified against `git archive HEAD`), so it is not a regression, but
`test/session-library.test.ts`'s sweep does not see it: that sweep uses a single 18:20 5 km athlete,
and these cases need a slower one. CLAUDE.md's "0 of 2816 weeks" claim is therefore narrower than it
sounds — it is true of that sweep, not of the product. Not fixed here; fixing it means shrinking
quality sessions for slow runners on few days a week, which is a session-library change.

⚠️ **DOUBLES ARE A DELIBERATE NON-GOAL, not a missing feature** (decided 2026-08-02 with the owner,
who asked the right question: "it would only be appropriate for runners of a certain level"). The
evidence report is unambiguous and goes further than a level:
- Its session counts are **sessions, not days** — *"elite doubles therefore count as two sessions"*.
  Beginner 3–5, Intermediate 4–6, Advanced 5–10, **Elite 10–14**. Only Elite requires them.
- *"Double-threshold sessions and 11–14 weekly sessions are **reserved for verified high-performance
  athletes with extensive history and professional oversight**."*
- The Elite row of the intensity table: *"2–3 key days; **doubles only with oversight**."*
- The tier gate: *"Tier 4–5 only… may be allowed with **coach override**… **Never unlock from
  self-selection or goal time**."*
- Its FALSE-ELITE acceptance case — self-labelled Elite, 25 km/week, no verified result — expects
  *"**Do not unlock elite volume or doubles**"*.

⚠️ **InteRun structurally cannot satisfy that gate, and that is by design.** `classifyRunner` caps
self-assessment at tier 4 and says so on screen; there is no verified-result path and no coach
override. Building automatic doubles would mean either breaking the report's rule or bolting on
verification machinery for a feature that serves almost nobody — and would be actively wrong for
anyone who self-selected into it. **Do not build it because it is the last unticked box.**

What ships instead is the honest explanation. Measured, a marathon plan on six days delivers
everything up to ~100 km/week stated and then saturates near 130 km however much more is typed
(110, 140 and 200 all give the same peak). `buildNotes` now says so, and `viewPlan` renders it.
⚠️ **TWO CAUSES, TWO ANSWERS.** A plan also under-delivers when a big mileage is asked of few days:
a naive "you need doubles" note fired on **247 of 560** plans under 105 km/week, mostly three- and
four-day weeks where the honest advice is the opposite — run more DAYS before running twice in one.
Only a runner already at the six-day ceiling gets the doubles explanation.

⚠️ **`PLAN.notes` reached the UI and was rendered NOWHERE** — the same computed-and-discarded trap as
`CLASS` and `MASTERS`. `viewPlan` now surfaces the volume note specifically; the rest describe the
plan's own design and belong in Support, not on the header. And below roughly `MIN_VOLUME_SCALE` (0.45) the per-session
floors bind instead — a 20-minute easy run cannot shrink — so a runner stating a very low mileage for
a big goal still gets more than they asked for. Lowering the constant does **not** help (measured at
0.45 / 0.35 / 0.25: identical anchoring, identical worst case); `assessFeasibility` is what should
answer that mismatch, and today it is volume-blind.

## The long run reaches a DISTANCE, not just a duration (added 2026-08-01)

⚠️ **A minutes-only plan silently short-changes slower runners.** `PEAK_LONG_MIN` gave everyone the
same 110-minute half-marathon long run, so it covered **22.4 km for a 1:25 runner and 12.8 km for a
2:30 one** — 61% of the race they were about to attempt, and below even the evidence report's
*Beginner* band. Minutes are the right currency for FATIGUE, which is why `LONG_CEILING_MIN` stays in
minutes; but a race is a distance, and durability for it is a distance too.

`LONG_FLOOR_KM` is the lower edge of the report's "Event-specific long-run endpoint references"
table, with `recreational` → its Intermediate row and `competitive` → Advanced (5 km 10/14,
10 km 12/16, half 16/20, marathon 24/28). Converted to minutes at the runner's own easy pace, applied
as a **floor** under `peakLong`, with `LONG_CEILING_MIN` still winning.

⚠️ **The half is deliberately set above its band floor — 21.5 km, not 16.** Its Intermediate band is
16–24 km and the report's evidence note for that row is *"Moderate; >21 km associated with faster
performance"* (Fokkema et al. 2020, n=997). So for a HALF, exceeding the race distance is the
supported target, which is also what an experienced coach will say. ⚠️ **It is not a universal rule** —
the same table tops the marathon out at 28–35 km for a 42.2 km race, and puts a half *beginner* at
12–18 km, both deliberately under the race distance. Do not "make it consistent" across events.

⚠️ **The ceiling is the safety valve, and it must keep winning.** Reaching 21.1 km takes a 2:30 half
runner **182 minutes** and a 2:45 runner **201**. They are capped at 145 instead and land as close as
that carries them (17.5 km and 15.9 km) — a three-hour long run before a half is a worse error than a
short one. Measured, runners to about 2:00 now clear the race distance and nobody exceeds the ceiling.

⚠️ **A minutes-based cap gets it wrong at BOTH ends, so there is a distance CAP too** (`LONG_CAP_KM`,
the band's upper edge). While slow runners were short, a **2:30 marathoner stating 120 km/week rode
the three-hour cap to a 44.4 km long run** — longer than the race, past the Elite band's 40 km, and
past the report's ">35 km benefit uncertain". Three hours is a sane amount of *time*; at 4:00/km it is
an insane *distance*. Now 35.6 km. The longest training session anywhere in any plan fell
**44.7 km → 33.9 km**.

⚠️ **THE MARATHON HAS TWO CEILINGS AND THEY ARE NOT INTERCHANGEABLE.** `LONG_CEILING_MIN` (180) caps
long runs grown by the **volume** model and must stay put — `peakLong` is `PEAK_LONG_MIN × vScale`, so
raising it would let a fast high-mileage marathoner scale straight past three hours to a **60 km** long
run. `LONG_ABS_CEILING_MIN` (**240**, marathon only) caps long runs driven by the **distance floor**,
where the runner is slow rather than high-mileage. Order in `buildAll` is load-bearing: cap the
volume-driven length first, *then* let the floor lift it, *then* apply the cap and the absolute
ceiling. Take the floor before the volume cap and high-mileage runners collect four-hour long runs
they have not earned.

⚠️ **The 4-hour marathon ceiling is the OWNER'S CALL (2026-08-01), against the time-on-feet
convention.** Reaching 25 km — the report's "<25 km slower" threshold — takes a 5:00 runner 3h36 and a
5:30 runner 3h58. The trade-off was put to him explicitly (a 5:30 marathoner now does a four-hour
training run) and he chose the research threshold over the 3-hour convention. Don't quietly revert it.

Measured across 17,920 weeks, this improved every axis and worsened none: half longest-long/race
**mean 0.93 → 1.01, min 0.66 → 0.84**; marathon **min 0.42 → 0.59 and max 0.84 → 0.80** (both ends
pulled into band); 10 km min 1.09 → 1.36; 5 km min 1.81 → 2.25; weeks under the intensity floor
**7 → 2**; long-run week-on-week jumps over 1.10× **242 → 224**. Every ability from 2:30 to 5:30
marathon now lands inside its band. Beginner plans are byte-identical — `buildBeginnerWeek` never
reads `peakLong`, which is the separate open problem of a beginner never being taken near their race
distance at all.

### The beginner track arrives somewhere too (added 2026-08-01)

⚠️ **`buildBeginnerWeek` ignored the race entirely.** It was handed `longMin: 0` and never read
`goal.distance`, so the long run came off one hardcoded ramp (`lerp(22, 38, f) + 8`) and topped out at
**46 minutes for every goal there is**. Measured: a "building the habit" runner on a 28-week HALF
plan progressed 2.9 km → **4.4 km** and was then sent to run 21.1 km — a **5.0× jump** against the
report's 1.10 single-session guardrail — with a ladder byte-identical whether the goal was a 5 km or a
marathon. Gentle is right for a beginner; never arriving is not, and it is the runner least able to
judge the gap who was left to find it on race day.

`BEGINNER_LONG_KM` is the report's **Beginner** row (5 km 6, 10 km 8, half 12, marathon 16), converted
at their easy pace and capped by `BEGINNER_LONG_CEILING_MIN` (135). ⚠️ The beginner half target is
deliberately **under** 21.1 km where the recreational one is over it — the report's row is 12–18 km,
and a first-timer's job is to arrive able to finish, not to have rehearsed the whole thing.

⚠️ **THE RAMP IS GEOMETRIC, AND THAT IS HALF THE FIX.** A straight `lerp` front-loads its growth, which
is backwards for a beginner: ramping 30 → 112 minutes linearly put a **17% jump at week 5** (3.5 →
4.1 km), past the guardrail, four weeks into someone's first plan. `geomLerp` gives the same start and
destination at a constant ~4%/week. Continuous beginners now peak at exactly 1.10×; reverting to
`lerp` fails the test.

⚠️ **`f` ramps against the NON-TAPER weeks.** It used `structuredWeeks`, so it only reached 1 in race
week — which is a taper week, eased 25% — and the long run peaked short of its target and then shrank.

⚠️ **`rwLong`'s cycle clamp is 4–12, not 4–8.** Eight capped the longest run–walk at ~56 minutes of
running whatever was asked, so a "just getting started" runner heading for a 10 km never passed 2.9 km.

⚠️ **MEASURE ONLY THE GOALS A BEGINNER CAN ACTUALLY PICK.** `GOAL_BY_STATUS` (web/app.ts) offers
**"just getting started" 5 km and 10 km only**, and **"building the habit" 5 km, 10 km and half** — a
deliberate product rule that you finish one of those before entering something longer, and the reason
`runWalk` is `status === "new"`. A first pass here measured run–walk against a half and a beginner
against a marathon, called both a shortfall, and wrote them into this file as known gaps. **Neither
combination exists.** `BEGINNER_LONG_KM` keeps a marathon entry as a total-function safety net, not
because anyone reaches it. Sweep the reachable matrix, or you will report on runners who cannot exist
and miss the ones who do.

⚠️ **`targetRunMin` aims at the SAME endpoint as the continuous track, not a discounted one.** The
first pass scaled it to 0.75 reasoning that a run–walker covers less ground per minute. That is true
and points the *other way*: walk breaks add time without adding distance, so covering 8 km takes more
session, not less. At 0.75 a "just getting started" runner reached 4.8 km before a 5 km and 6.2 km
before a 10 km, both under band; at parity, 6.2 and 8.2.

Measured across every reachable combination (16/28/40-week runways), longest run before → after:
run–walk 5 km **3.1 → 6.2**, 10 km **3.1 → 8.2**; continuous 5 km **4.4 → 6.0**, 10 km **4.4 → 8.0**,
half **4.4 → 12.0**. All in band. The step up to race day fell from 3.7× to 1.4× for a run–walk 10 km
and from **5.0× to 1.8×** for a beginner half. Non-beginner plans are **byte-identical** (288-plan
hash unchanged) — `beginnerRun` and `rwLong` have no other caller.

⚠️ When a beginner's race falls on a **Monday**, their peak long run is the race-eve session and
`applyRaceDay` replaces it with the shakeout, so the block tops out one rung lower. That is correct,
and it is also a trap for measurement: a sweep whose race dates are all Mondays reads a 3% shortfall
that is not there.

## The taper is measured in days before the race, not weeks (fixed 2026-08-01)

⚠️ **Taper weeks are Monday-aligned and the LAST one is race week, so `weeks: 1` is not seven days.**
It is however many days of race week precede the race: six for a Sunday race, **zero for a Monday
one**. The 5K and 10K shipped with `weeks: 1` — measured, 0–6 days of easing against the evidence's
7–14, with the week before the race within 1% of peak volume. The coach's "the taper is not really a
taper for a 10km" was correct on every weekday. Both are `weeks: 2` now: 7 + raceDow days = 7–13,
inside the window whatever the weekday. `test/generate-plan.test.ts` asserts the window in **calendar
days across all 7 race weekdays** — the same lesson as the race-eve test; a guard counting weeks
could not even express the defect.

⚠️ **`volumeMultiplierByWeek` must reach the EASY runs, not only the long run.** It was applied in
`longRunMinutes` alone, so a "taper" week kept full-length easy runs — and since the taper drops the
second quality session, the backfilled easy day meant easy volume *rose* into the taper (+45 min).
Measured delivered cut: 18–39% against the evidence's 41–60%. `WeekContext.taperMult` now scales the
easy runs too. After: last-full-taper-week cuts 35–41% (was 22–30), easy-minutes rise +8 (frequency
maintained, sessions shortened — which is what the evidence asks). Intensity is retained: every taper
week keeps one quality session, race week keeps the race. Intensity-floor sweep identical (2/17920).

⚠️ **Clamp the volume-driven length to 95 FIRST, then taper, floor of 20 outermost.** Multiplying
before the clamp let the cap swallow the taper whole for high-mileage runners: at vScale 3,
45 × 3 × 0.8 = 108 still clamps to 95, byte-identical to peak week — a 120 km/week marathoner's taper
cut 3%/14%/46% instead of 17%/31%/59%, and the fix the whole change existed to deliver was silently
withheld from exactly the runners the volume model was built for. And the 20-minute floor must stay
OUTSIDE the taper multiply, or a down-scaled runner's race week produces 11-minute non-runs. Caught
by adversarial review; the suite was green because no taper test varied stated volume — the third
time the "sweep blind to a new axis" trap has fired in two days.

⚠️ **The multiplier array is END-ALIGNED: the last entry belongs to race week, whatever got clamped.**
`periodization.ts` clamps taper to `structuredWeeks - 3`, so a 4-week plan has ONE taper week — and
it IS race week. Start-aligned indexing handed it `mult[0]`, the gentle 0.72 lead-in, instead of the
race-week 0.55: a runner entering a 10 km four weeks out got a race-week long run **20% longer than
before the taper fix existed**. Resolved once in `buildAll` (end-aligned) and passed to
`longRunMinutes` as a number — two call sites each indexing the array is how they disagreed. The test
is constant-free: a clamped race week and a full taper's race week must prescribe the same long run.

Short runways otherwise hold their shape (verified 4/5/6/8/10-week runways). Known and accepted: a
5-week 5k/10k runway now spends its former peak week tapering, so the race-specific rehearsal
disappears on exactly that runway length — the 7–14-day taper is what it buys, and 6 weeks up keeps
the peak week.

## Seven days means seven days (fixed 2026-08-02)

⚠️ **The form offered 3–7 and `buildWeek` said `Math.min(6, …)`.** A runner who chose seven got six
and was never told — while `assessFeasibility`'s `daysFactor` DID count the seventh
(`0.8 + 0.06 × (days − 3)`: 0.98 at six, **1.04 at seven**), so the goal projection was ~6% more
optimistic on the strength of a day the plan never gave them. Promising on a day you do not deliver
is the worst of both worlds. The day slots already existed: long at rel 0, quality at 2 and 4, easy
at 3, 5, 1, 6 — seven distinct days, exactly 1 + 2 + 4.

⚠️ **The seventh day is a RECOVERY JOG (30 min), not a fourth 45-minute easy run.** Seven days means
no rest day at all, and the evidence report's Advanced band (5–10 sessions) assumes the extra
sessions are recovery running — circulation on tired legs, not more aerobic volume. Another full
easy run is how a seven-day week becomes a six-day week plus an injury.

⚠️ **Mobility had no free day to land on and silently vanished.** `MOB_PREF_REL…find()` returned
undefined for exactly the runners carrying the most load. It now falls back to the last easy slot —
the recovery day at seven days, the shortest easy run otherwise, never a quality or long day.
Strength already shares days with runs by design; this is the same trade and a better one than
dropping the session.

Measured: 7 days now builds 7 runs (was 6), peak 94.7 → **102.3 km**; the intensity floor **improved**
(137 vs 143 under-floor weeks of 22,400 — the extra day is easy running); 0 adjacent hard-day pairs
across all seven long-run-day choices; week-one anchoring, long-run and title-drift invariants all
unchanged. Beginners stay capped by their own track (3 run-walk / 4 continuous) whatever they ask
for. `assessFeasibility` now counts a day that exists, so no change was needed there.

## Race day is a session (added 2026-08-01, from elite-coach feedback)

⚠️ **`"race"` is a SessionType, distinct from `"race-specific"`** (which is a rehearsal in
training). `raceDay()` in `session-templates.ts` builds it — a warm-up plus the race distance at
`paces.goalRace` — and `applyRaceDay()` in `generate-plan.ts` places it on the real date after
`applyPartialFirstWeek`.

Before this the race was **not in the plan at all**: `goal.raceDateIso` only aligned the final week
to a Monday and printed a header string, so whatever the rotation happened to put on race day was
prescribed instead. Measured: a Sunday race got a **51-minute long run ON race day**; a Wednesday
race got a recovery jog on the day and the long run **four days after** it; and **6 of 49**
race-day × long-run-day combinations put a `10 × 1′` VO2 session **the day before the race**.

Three rules, enforced in `applyRaceDay` and asserted across all 49 combinations by
`test/generate-plan.test.ts`:
1. Race day IS the race — whatever sat there is replaced.
2. Nothing follows it; later days in that week become rest.
3. Nothing hard the day before (`HARD_BEFORE_RACE`), strength included.

⚠️ **THE EVE CAN LIVE IN THE PREVIOUS WEEK, and both the rule and its test missed it.** `applyRaceDay`
looked for the day before at `dayOfWeek === raceDow - 1` inside the final week. For a **Monday race**
`raceDow` is 0, so `raceDow - 1` is −1 and matches nothing — while the real eve is the **Sunday of the
week before**, which the function never opened. Rule 3 therefore did nothing for one weekday in seven:
measured, 10 of 196 plans put a hard session on race eve and every one was a Monday race, worst case a
**98-minute long run the day before a marathon**. The eve is now resolved as a `(week, day)` pair.

⚠️ **The test could only ever agree with the bug**, because it asked the same question the wrong way —
`dayOfWeek === dow - 1`, inside `weeks.at(-1)`. A guard written in the implementation's own frame of
reference is not a guard. It now flattens the plan to **calendar dates** and asks what the runner would
ask ("what am I doing the day before my race?"), which is the only framing in which the Monday case is
even expressible. Verified: removing the fix fails it; with the fix, 0 hard eves across 588 plans
(4 events × 7 race weekdays × 7 long-run days × 3 day-counts).

⚠️ Two consequences for anything that walks sessions:
- **Race week has NO long run.** "Every week has exactly one long run" is false by design now.
- **Race week is exempt from the intensity model** — it contains a maximal effort over the race
  distance. `test/session-library.test.ts` skips exactly that week and no other.

`race` is in `PRIMARY_TYPES` (page) and `PlannedSession.isRunnable` (watch) — it is a run, it is
trackable, and the plan exists to reach it. Keep those two lists in step.

## The session library (rebuilt 2026-07-28 from a real coached block)

The owner supplied his own coach's Google Sheet — a full GNR block for a sub-1:20 half runner — and
asked for that variety in the generator. Two things came out of it.

**The pace ladder has eight gears, not five.** `deriveTrainingPaces` now also derives:
- **`aerobic`** (threshold + 60 s/km) — the coach's "MOD". Filled a real ~30 s/km hole between easy
  and steady that no session could previously target.
- **`tempo`** (threshold + 18) — "true tempo", holdable for close to an hour.
- **`cv`** (≈ 8 km pace) — critical velocity, between threshold and VO2.

Measured against the coach's own numbers for that athlete these land within a few seconds
(aerobic 4:45–5:05 vs MOD 4:45–5:00; cv 3:42–3:51 vs CV 3:45–3:50). ⚠️ **CV is derived from 8 km, not
10 km pace** — 10 km put it only ~7 s/km off threshold, so a session contrasting the two was not a
gear change at all. `deriveTrainingPaces` is the ONLY construction site, so adding fields is safe.

**The bottleneck was never the number of formats — it was the selector.** Before: 42 quality slots in
a 36-week plan filled by 18 distinct titles, `10 × 1′` five times, and all four peak weeks byte-
identical because `raceSpecificSession` took no variant at all. Now 31 distinct, and ~62 formats.

`QualityFormat` carries `id`, `phases`, `load`, `competitiveOnly`, `skipWhenReturning`, and optional
`rpe`/`intensity`. `selectFormat` filters by context then rotates; filters that would empty the pool
are dropped rather than throwing. Traps, each of which cost a real debugging cycle:
- ⚠️ **Never index these arrays by position.** The taper was `vo2Session(p, 3)`, so inserting any
  format above index 3 silently changed every plan's race-week session. Use `taperSession()` / ids.
- ⚠️ **Never derive a gate from the rotation index.** Capping "big" sessions by week parity, and
  later by `thresholdIsBig(rot)` with the same `rot`, each made *every* big format unreachable —
  the gate and the position were perfectly correlated. The rule is now "cap only when BOTH slots
  would draw big", with offset indices.
- The rotation is `ordinalInPhase + phaseTotal + daysPerWeek + distanceSeed` — walking the pool one
  step at a time, from a per-plan starting point, so different plans use different parts of it.
- `test/session-library.test.ts` (18 tests) asserts the gear ordering, format hygiene, the safety
  gates, per-plan variety, and ≥95% library coverage across ~2000 generated plans.

Two bugs fixed alongside, both pre-existing and both made likelier by the new formats:
- ⚠️ `plannedPaceBandOf` omitted `strides` from its continuous list, so "45′ easy + strides" was
  judged against the **strides** band (mile pace) — every debrief of it was nonsense. It also now
  prefers the LONGEST continuous step, not the first, so a geared run is judged by its main block.
- ⚠️ `WorkoutManager.targetBand` fell back to the session band when a step had none, so on the
  pace-free hill reps the wrist compared hill pace to the threshold band and said "pick it up".

Known and deliberately not fixed: a handful of five-day build weeks with two quality sessions sit
just under the pyramidal easy-fraction floor (measured 6 of 35, unchanged by this work). That is a
periodisation question about two-quality weeks, not a session-library one.
