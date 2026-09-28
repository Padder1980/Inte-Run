# Plan engine — the coaching book (Hudson) work

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE COACHING BOOK, WORKED THROUGH (owner, 2026-08-31) — ADAPT, NOT REBUILD

He attached *Run Faster from the 5K to the Marathon* (Hudson & Fitzgerald) and asked whether to make
targeted adaptations or rebuild the plan generator from scratch. **Adapt**, on three legs — and the
legs matter, because they are also the reason a rebuild must not be attempted later on a whim:

1. ⚠️ **CHAPTER 6 CONTAINS NO PACE SYSTEM AT ALL** — it delegates to mcmillanrunning.com. So "rebuild
   on the book's exact algorithms" is undefined for the layer that matters most. And measured, this
   engine's `PACE_RATIOS` already ARE the book's zone fractions inverted: easy slow 0.75 against our
   0.752, easy fast 0.82 against 0.820, threshold 0.96 against 0.952–0.976, recovery ceiling 0.70
   against 0.667–0.735. Two models, one model, agreeing to ~4%, with our easy pace 8–26 s/km SLOWER,
   which is the safe direction.
2. ⚠️ **THE BOOK DISOWNS ITS OWN TWELVE PLANS.** Its thesis is ~90% individualised / ~10% templated,
   said three times. A faithful rebuild would implement the one thing the author argues against while
   discarding the adaptive machinery that IS his chapter 8 — which this app already has.
3. ⚠️ **IT CONTRADICTS ITSELF IN NINE PLACES**, so a clean-slate build has to pick a side at each,
   which is the adaptive option with a bigger budget and no tests.

⚠️ **"ANTI-TEMPLATE" IS NOT "ANTI-PLAN."** He bounds it three times himself: the default is adherence,
with deviation on stated evidence. Do not quote the 90/10 line as licence to loosen the generator.
⚠️ **HIS HALF-MARATHON TAPER IS EFFECTIVELY ONE WEEK** — the penultimate week sits at near-full volume
and only race week drops 29–36%. Worth knowing before anyone "aligns" `src/science/taper.ts` to it.
⚠️ **AND PORTING THE CRITICAL-SPEED ANCHOR IS MEASURABLY DANGEROUS, NOT MERELY UNNECESSARY.**
`src/science/fitness-profile.ts` records the objection at the rejection site and it reproduces: a
10 km + half fit puts CS at 4:57/km, **27 s/km slower than that runner's own 10 km pace**. The book's
own eligibility window (120–900 s) means a 5 km time qualifies only at **15:00 or faster**, and this
app stores a 5 km plus an optional 2 km trial — so a 40:00 5 km runner has **zero** eligible efforts.
`fitCriticalSpeed` is therefore computed and discarded: no number from it appears in the shipped app
(`web/fitness.ts` renders it and is absent from `docs/`).

### WHAT SHIPPED, AND THE MECHANISMS NOT TO UNDO

- ⚠️ **HILL SPRINTS ARE A WEEKLY STAPLE, AND THE FREQUENCY IS THE FEATURE.** `easyHillStrides` was one
  of EIGHT rotation flavours, so a runner met it about one easy run in eight — measured on a real
  17-week block, six sessions clustered in weeks 1–2 and 9–10. `hillSprintDose` dedicates one easy day
  a week; measured, **the staple reaches 11–14 of 18 eligible weeks** and hill work of any kind 13–15.
  ⚠️ **THOSE ARE TWO DIFFERENT NUMBERS AND CONFLATING THEM OVERSTATED THE CHANGE ONCE ALREADY** — "any
  hill work" counts the five pre-existing VO2/threshold hill formats, which were always there.
- ⚠️ **ONE PRODUCER: `easyHillStrides` IS NO LONGER IN `easyVariant`'s POOL.** Two sources meant two
  doses — the rotation always asked for the settled 6 while the staple was building from 2 — and it
  made the stacking rule unenforceable. The pool went 8 → 7, which changes which flavour every easy
  slot draws; that is a real difference to every plan and it is the point.
- ⚠️ **`weekAlreadyClimbs` KEEPS THE SPRINT DAY OFF A WEEK WHOSE QUALITY SESSION IS ALREADY HILL
  WORK**, detected **structurally** — a `rep` step with no `targetPaceSecPerKm` IS hill work, because
  pace up a hill is a function of the gradient. Never match `/hill/i` on a title.
- ⚠️⚠️ **`rotWouldStride` STANDS THE SPRINT DAY ASIDE WHEREVER THE ROTATION WOULD HAVE GIVEN RELAXED
  STRIDES, AND IT IS NOT GATED ON THE EASY-DAY COUNT.** Without it a plan can contain **no** strides
  session at all, and `sessionLibrary`'s representative for "Easy + Strides" in the build-your-own
  picker becomes the maximal sprint session — a runner asking for strides is handed sprints. Gating it
  on "only one easy day" shipped that same defect on 4-day plans: **the pool is EIGHT long while
  deloads fall every FOUR weeks, so for an odd slot index the strides position aliases exactly onto
  the deload weeks**, where `canStride` is false and the pool has no strides in it. Measured on a
  4-day 5 km block: **24 strides-typed sessions, not one of them strides.**
  ⚠️ Alternating by week parity was tried and is worse — it hands the rotation only even pool
  positions, so strides becomes unreachable rather than rare.
- ⚠️⚠️ **`pickSprintSlot` CHOOSES THE EASY DAY FURTHEST FROM THE WEEK'S HARD WORK, AND THE FIRST EASY
  DAY IS THE WORST SLOT THERE IS.** Relative to the long run, quality sits at rel 2 and 4 while
  `EASY_REL` opens at rel 3 — directly between them. Measured over 1,232 sprint days across 72
  profiles: **74% fell the day AFTER a quality session, 18% between two of them, and 83% shared the
  day with a strength session.** After: **20% / 1% / 0%**, and MORE weeks get a sprint day
  (1232 → 1281). The score weights "days since" double "days until", because ten seconds of sprinting
  does not carry fatigue into tomorrow — which is the whole reason this is the safe way to introduce
  intensity — while yesterday's hard session is the recovery the sprints would eat.
  ⚠️ **NO SLOT IS CLEAR**: three hard days in seven means every easy day touches something.
  ⚠️ **THE DAYS THEMSELVES ARE NOT REORDERED**, only which one carries the sprints: `easyDays`' order
  drives the flavour rotation index and the seventh-day recovery jog is identified by being LAST.
- ⚠️ **THE DOSE ADVANCES EVERY THREE WEEKS (`HILL_DOSE_EVERY`), NOT EVERY TWO, and the reason is the
  delivered sequence rather than the formula.** It is keyed on the CALENDAR week, so a week with no
  sprint day still advances it. Measured over 96 plans: at every two weeks, **72 transitions between
  consecutive sprint days moved the dose by more than one, worst 3 → 6 across a six-week gap**; at
  three it is 18 with the same worst case; at four it is 9 but the dose does not settle until week 21.
  ⚠️ **The residual is deliberate and consistent with the engine** — `longRunMinutes` and `easyRampFor`
  both grow through weeks the runner may miss entirely, and making this one uniquely absence-aware on
  the far smaller load would be the inconsistency. Three extra sprints is thirty seconds.
- ⚠️ **BEGINNERS: `contHillSprints`, 8 seconds, 1 → 4, CONTINUOUS BEGINNERS ONLY.** Measured before:
  **0 sessions containing an unpaced repetition** across a 26-week beginner block, at either status.
  ⚠️ **The roadmap's claim that the track also needed a fartlek was WRONG** — `contPickups` ("easy +
  gentle pickups") already is one, and the track has progressions and explore runs. Force production
  was the only thing missing.
- ⚠️ **A RUN-WALK BEGINNER GETS NONE**, a scope boundary rather than an oversight: someone who cannot
  yet run twenty minutes is below the lowest tier the book is written for, their plan is already
  interval-shaped, and there is no run-walk hill format. **The owner's call to overturn**, asserted so
  it cannot change silently.
- ⚠️ **NO RACE-SPECIFIC SESSION WAS ADDED TO THE BEGINNER TRACK**, though the roadmap listed one.
  Beginners get no threshold, VO2 or race-pace work **by design**; overturning it is a coaching
  decision. A guard holds it: every beginner week reports `qualitySessionCount` 0. **The owner's call.**
- ⚠️ **`beginnerEasyMin` IS THE ONE DEFINITION** of a continuous beginner's ordinary run length, read
  by `beginnerRun` and by the sprint day. Its guard compares against the **timed** siblings and demands
  they match to the minute: a first version allowed the five minutes `roundMinutes` can legitimately
  introduce, and **a tolerance wide enough for the rounding is wide enough to hide a drift** —
  re-broken with a private `lerp(26, 42, f)`, the loose guard passed.
- ⚠️ **EVERY ADDED SECOND IS CARVED OUT OF THE EASY PORTION IN BOTH BUILDERS.** `easyHillStrides` was
  the last minute-titled builder still overrunning its title — it carved only the walk-backs, so it
  delivered **46.00 minutes for a "45′ easy + hill sprints"** (0.33–1.00 over, by dose). That is the
  defect the owner reported on the sibling in as many words: *"25′ easy + gentle pickups"* with a chip
  reading 26. `contPickups` and `contProgression` were fixed for it; this one was not.

### ⚠️⚠️ A SESSION NEVER DECLARES ITSELF EASIER THAN ITS OWN HARDEST STEP — THE WORST FIND

`plannedRpeBandOf` stamps a session's declared band onto every logged run as `rband`, and
`assessTrainingFlags`' `classifyRpe` fires at `band.max + 1`. So a session saying *"meant to feel about
2–3"* while carrying RPE 9 strides turns an honest answer into evidence for easing the whole plan off.
**Driven through the real engine, not argued: two honestly-rated hill-sprint days at RPE 6 against a
{2,3} band produced an rpe-high flag with mean deviation 3 and a suggestion to RE-ANCHOR A 25:00 5 KM
RUNNER TO 27:00.**

⚠️ **IT WAS EIGHT TITLE FAMILIES AND ~14% OF ALL SESSIONS, NOT THE ONE I NOTICED.** Swept 27,462
generated sessions: "easy + strides" declared 2–3 and contained 9 (×818), "moderate + strides" 3–4
against 9 (×830), "easy → steady finish" 2–3 against 5 (×783), "easy + gentle pickups" 2–3 against 5
(×765), "easy → moderate finish" 2–3 against 4 (×552), the goal-pace-then-threshold long run 4–5
against 7 (×70), "threshold, then hills" 6–7 against 10 (×45), "N × N km, then hill sprints" 8–9
against 10 (×4). **3,867 sessions. Now 0.**

- ⚠️ **FIXED IN `assemble`, THE ONE CONSTRUCTION POINT**, so no builder can forget it — and
  `longRun`'s own copy of the arithmetic is deleted, because one place beats two. It is also exactly
  what `plannedRpeBandOf`'s fallback already does for a session declaring no band, so the declared
  band now agrees with the app's own derivation instead of contradicting it.
- ⚠️ **ONLY THE TOP MOVES.** A session containing ten seconds of maximal work is still an easy run and
  its floor is what says so; widening both ends makes every band meaningless. `RPE.maximal` for the
  whole session is the same dishonesty pointing the other way.
- ⚠️ **THE TRADE, STATED:** a wider band makes the RPE flag less sensitive for sessions with brief hard
  work, and the displayed chip reads "RPE 2–9" rather than "2–3". Both are the right way to be wrong —
  a false *"shall we slow the plan down"* is acted on by the runner, and a true-but-broad label merely
  reads less usefully than a false-but-narrow one. The flag still fires: an honest 4, 5 and 6 no longer
  flag and a 10 still does, asserted **both** ways.
- ⚠️ `test/session-library.test.ts`'s *"moderate and progression runs stay honestly easy"* asserted
  `targetRpe.max <= 4` — the narrow band, i.e. the direction that CAUSES the false flag its own comment
  warns about. Restated to the run's own **body** steps staying at RPE ≤ 4, plus the band spanning.

### ⚠️⚠️ I QUOTED THE WRONG NUMBERS AT THE OWNER, AND THIS IS THE TRAP TO REMEMBER

Seven of the eight measured figures in commit `487e844`'s message **do not describe the state it
committed**. I measured, then made two more edits (removing `easyHillStrides` from the rotation pool,
and the `buildCustomSession` currency fix), and quoted the earlier measurement — the exact trap this
file already records as *"a verification step quoted from a previous session's notes has not been
run"*. **Every discrepancy flattered the change, and the rule-3 cost was understated fourfold**
(claimed +3, actual +11). Found by an adversarial reviewer, not by me.

⚠️ **THE RULE: RE-MEASURE AFTER THE LAST EDIT, NOT AFTER THE INTERESTING ONE.** A figure captured
before a later change is a figure about a program that no longer exists.

**BASELINE (`82ba142`) → NOW (`94b1059`), over 768 plans / 18,624 weeks. This is the table to quote:**

| metric | baseline | now |
|---|---|---|
| weeks under the pyramidal easy floor | 41 | **39** |
| weeks under 75% easy | 468 | **480** |
| weeks under 80% easy | 1965 | **1906** |
| worst week easy % | 67.6 | **68.1** |
| rises >1.10 on training minutes | 4.1% | **4.4%** |
| rises >1.10 on counted km | 11.2% | **9.9%** |
| worst single jump, minutes | 1.34× | **1.32×** |
| worst single jump, km | 1.46× | **1.43×** |
| rule-3 transitions over 1.30 | 50 | **68** |
| rule-3 worst | 1.425× | 1.426× |
| biggest week in build/peak | 96.7% | **95.6%** |
| deload depth | 28.8% | 28.8% |
| taper cut mean | 37.1% | **36.3%** |

Six better, five worse, two flat. The tails improved in both currencies and the 80% band improved; the
costs are 12 more weeks under 75% easy, 18 more rule-3 transitions of 7,152, and a point off
biggest-week placement.

### ⚠️⚠️ PARKED: THE BLOCK-LENGTH CHANGE IS ONE COUPLED RECALIBRATION, NOT FOUR CONSTANTS

Four roadmap items — cap the block at the book's optimal durations, shorten base and lengthen build,
plateau volume after the introductory period, and refine the deload cadence — were **implemented,
measured and reverted**. The measurements are here so nobody spends the afternoon rediscovering them.
Road Map step **`pc-blocklen` is deliberately UNTICKED**.

**Item 3, `MAX_STRUCTURED_WEEKS` 30/32/36/40/44 → 14/16/18/20/24.** Weeks are placed backwards from
race Monday (`addDays(raceMonday, -(structuredWeeks - weekIndex) * 7)`), so capping only moves the
start later — a 5 km entered 30 weeks out correctly produced 16 weeks ending on race day, phases
base 4 / build 7 / peak 3 / taper 2, every introductory period inside the book's 2–6 weeks.

| | baseline | cap only | cap + build split + plateau |
|---|---|---|---|
| weeks measured | 18,624 | 12,144 | 12,144 |
| biggest week in build/peak | 96.7% | **98.4%** | 97.0% |
| rises >1.10 on km | 11.2% | 15.3% | **20.5%** |
| worst jump, minutes | 1.34× | — | **1.24×** |
| worst jump, km | 1.46× | 1.35× | **1.32×** |
| weeks under 75% easy | **468** | 457 | **430** |
| rule-3 transitions over 1.30 | **50** | 50 | **81** |

⚠️ **THE TAILS IMPROVE AND THE RATES WORSEN, AND THE ABSOLUTE COUNTS ARE WHAT TO READ.** The cap does
not *generate* bad weeks — it removes comfortable ones (the surplus base weeks a 30-week 5 km plan
spends warming up), so the easy-floor **count falls 468 → 430** while the rate rises because the
denominator shrank. Items 4 and 5 do generate rule-3 breaches: 50 → 81.

⚠️⚠️ **BUT IT BREAKS FOUR THINGS CALIBRATED AGAINST THE OLD LENGTHS. With items 3+4+5 in, 17 tests
fail** (all 8 affected files are green at baseline, so none is date fragility). Two are genuine
defects: the beginner geometric ramp exceeds the 1.10 single-session guardrail (measured 3.0 → 3.4 km
= 13%, 3.8 → 4.4 = 16%, 5.0 → 5.6 = 12%), and the long-run ladder exceeds its own
`LONG_LIFT_STEP_MAX` clamp.

⚠️⚠️ **BOTH HAVE ONE ROOT CAUSE WORTH KNOWING EVEN IF THE CAP IS NEVER DONE: THE RAMP KEEPS CLIMBING
THROUGH A DELOAD, SO THE REBOUND OUT OF IT COSTS TWO STEPS.** Every ramp divides by the CALENDAR week
index (`easyRampFor`, `longRunMinutes`, `buildBeginnerWeek`'s `f`). In a long block one step is small
enough that two stay inside the guardrail, so nothing ever showed; shorten the block and the same code
breaches at **every post-deload week**.
⚠️ **A deload-aware ramp (`rampFractions`, counting only progressing weeks) was written and measured:
the suite is GREEN at 1420 with it, and the audits are slightly WORSE at current lengths** — rises
>1.10 on minutes 4.1% → 4.6%, on km 11.2% → 12.5%, rule 3 0.70% → 0.84% — because holding the ramp
flat through a deload leaves fewer steps for the same range, so each step grows. **It only pays for
itself in company with the cap.**

⚠️ **ITEM 5'S PLATEAU FIGHTS `enforceLongRunIsLongest`.** If easy volume reaches full size by week 4
while the long run ramps to week 14, the long run must be LIFTED every week in between — and the lift
is bounded, so either the invariant breaks or the ramp does. The original design's coupling (both ramps
running the same length) was deliberate.

⚠️ **ITEM 6, DELOAD CADENCE.** `deloadEveryFor(daysPerWeek)` — 6+ days every 3rd week, 5 or fewer every
4th, grounded in how many rest days the week already contains. Only ever ADDS recovery. Implemented and
reverted: **2 tests fail** — the long-run-is-longest BLOCKER at 12 of 54,720 weeks (more eased weeks
means the lift clamp's previous non-eased week is further back, so it binds harder) and session variety
at **23 distinct sessions in 40 quality slots** (more deloads draw more often from the small-format
pool, which has few members).
⚠️ **AND IT IS COUPLED TO ITEM 3:** a 3rd-week cadence is the book's rule for a 16–20 week block and is
excessive in a 44-week one, where it gives fourteen deloads.
⚠️ **THE OTHER HALF OF THE BOOK'S RULE — no down week at all for a low-load runner — WAS DELIBERATELY
NOT ATTEMPTED.** It REMOVES recovery from the least-trained runners on a reading of a book, and this
app's deload does a second job the book's does not: absorbing the volume ramp. The owner's call.

**So the honest scope is: cap the lengths, make every ramp deload-aware, widen the small-format pool,
and re-derive the long-run lift clamp — then measure the whole thing at once.** One piece of work with
its own sweep; shipping any part alone ships a regression.

### ⚠️ THE AUDIT'S VOLUME SECTION WAS HEADED "TIME" AND MEASURED KILOMETRES

`tools/audit-progression.mjs` divided `plannedDistanceMeters` under a heading reading TIME — the
instrument-cannot-see-what-it-is-pointed-at trap, in the tool this file already records being bitten by
three times. It now reports **both** rulers and says which is which. **Read the MINUTES figure to judge
the training and the KM figure to judge what the runner sees.** Without that fix the hill-sprint work
reads as a regression: 11.2% → 8.4% on km against 4.1% → 4.1% on minutes, for the same change.

### ⚠️ FIVE ADAPTATION FUNCTIONS EXIST IN THE ENGINE AND THE APP CALLS NONE OF THEM

`returnToRunningPlan`, `assessWeeklyJump`, `applyMissedSessionAdjustment`, `countTrailingMisses` and
`assessLongRunSpike` — **0 references in `web/app.ts` each**, and `returnToRunningPlan` is exported
through `web/entry.ts` and reaches nothing. The computed-and-discarded trap five times over, and most
of what a plan-adaptation menu needs already written.

### STILL THE OWNER'S CALL

- ✅ **Race-specific work for beginners — ASKED, RULED ON AND SHIPPED, 2026-09-01.** The
  no-quality-for-beginners rule is gone; see the beginner-track chapter at the end of this file for the
  progression, the doses and why the reps are timed. Do not reinstate `qualitySessionCount === 0`.
- **Hill sprints for run-walk beginners.**
- ⚠️ **Reshape the retest as a spec test** (5 × 1 km at goal pace off 2 min, cadence 4 → 5–6 weeks) in
  `src/adapt/weekly-review.ts` · `retestDue`.
- ✅ **Two hard days a week regardless of level — ASKED AND ANSWERED, 2026-09-01. Do not reopen it
  without reading the chapter below.** The book does recommend it, the app already delivers it for every
  runner the book addresses, and lifting the remaining caps was measured as harmful.
- ✅ **The no-deload-for-low-load half of the cadence rule — ASKED, RULED ON AND SHIPPED, 2026-09-01.**
  See the tier-3 chapter at the end of this file for the gate, why the half and the marathon are
  excluded, and the control that refuted the "it spikes" objection. ⚠️ **The block-length recalibration
  is also DONE — see the shorter-plans chapter; do not re-cost either.**

## TWO HARD DAYS A WEEK: ASKED, MEASURED, AND ALREADY DONE (owner, 2026-09-01)

*"Does the book recommend 2 hard runs per week for everyone? If so, then do it"* — the conditional that
settles roadmap item 8, which this file had listed as **recommended against**. **The answer is that the
book does recommend it, the app already delivers it for everyone the book addresses, and forcing it on
the two frequencies the book excludes is measurably harmful. Nothing in the engine changed.**
`test/hard-day-frequency.test.ts` holds 8 guards; **10 deliberate re-breaks, all 10 caught** (one only
after the guard was split in two — that one is below).

⚠️ **THE ENGINE IS BYTE-IDENTICAL TO HEAD AND THAT IS THE DELIVERABLE.** The work was a measurement and a
guard, because the measurement said the code was already right. Reporting a fix here would have been
false; leaving the rules unguarded would have been worse, since they were protecting a measured harm and
nothing was stopping a future change removing them.

### What the book says, and the three things that bound it

> *"I believe in doing two hard workouts per week, not including the weekend long run."* — ch2

Flat, and with no level qualification. But:
1. ⚠️ **IT IS PREMISED ON SIX OR SEVEN DAYS OF RUNNING.** *"I recommend that every runner, INCLUDING
   BEGINNERS, run at least six times per week, if possible"* (ch7) and *"I strongly recommend that
   competitive runners seeking to improve their race times run six or seven times a week"* (ch2). **The
   book does not contemplate a three- or four-day runner anywhere** — its answer for one is to run more
   days, which `addDayOffer` already offers.
2. ⚠️ **IT IS A DESTINATION, NOT A CONSTANT — read off his own tables rather than his prose.** The
   **Level 1** plan ("low training volume plans for beginners", 12 weeks) carries **zero** hard workouts
   in weeks 1–3, **one** in weeks 4–7, and reaches two only in the last third; **Level 2** carries zero
   for two weeks and one for three more, reaching two at week 6 of 12. Measured off those tables, Level 1
   delivers **~1.20** hard workouts a week and Level 2 **~1.40**.
3. ⚠️ **AT LOW VOLUME ONE OF THE TWO IS A PROGRESSION RUN, NOT A SECOND INTERVAL SESSION.** Level 1 weeks
   8–12 read *"Progression Run 6 miles, last 20 min hard"* **plus** one interval session, and ch3 says
   why: progression runs *"represent an excellent means of squeezing a little more beneficial hard work
   into one's training without overtaxing the runner."* That is exactly what `longCarriesWork` does at
   four running days or fewer.

⚠️ **THE PLANS ARE IMAGES IN THE EPUB (47 of them, 0 `<table>` elements), so the chapter-12 text says
nothing about their content.** Anyone re-checking this has to read `images/Huds_..._05[12]_r1.jpg` for
Level 1 and `053` for Level 2. The prose alone gives the flat statement and none of the three bounds.

### The measurement: the app already meets or exceeds the book at every level

Counting a work-carrying long run the way his Level 1 table counts its progression run, at **his own
block lengths** (5K 12wk, 10K 14wk, half 16wk, marathon 20wk), 72 plans per row:

| days/week | 0 hard | 1 hard | 2+ hard | mean hard/week | his comparable plan |
|---|---|---|---|---|---|
| 3 | 0.0% | 69.0% | 31.0% | **1.31** | Level 1 ≈ 1.20 |
| 4 | 0.0% | 63.8% | 36.2% | **1.36** | Level 1 ≈ 1.20 |
| 6 | 0.0% | 54.1% | 45.9% | **1.75** | Level 2 ≈ 1.40 |

And the per-phase rule already **is** his shape — base 1, build 2, peak 2, taper 1, deload 1. Attributed
over 1,044 weeks for a six-day runner at his lengths: 45.8% carry two (build 28.6 + peak 17.2), 31.0% are
base weeks at one, 20.6% are deloads at one, 8.6% taper, 0.7% vScale-capped. His Level 2 spends 42% of
its weeks at ≤1 hard workout; ours spends 31% in base.

### ⚠️⚠️ AND LIFTING THE REMAINING CAPS IS MEASURABLY HARMFUL

All three caps lifted (`runningDays < 4`, the four-day ceiling, and the `longCarriesWork` cap at
`buildWeek`), swept over **7,416 weeks per frequency** (3 abilities × 4 distances × 2 experience × 4
stated volumes × 3 runways):

| | shipped | caps lifted |
|---|---|---|
| 3-day weeks under the 68% pyramidal easy floor | **17** | **699** (41×) |
| 3-day worst week, easy fraction | 63.8% | **55.4%** |
| 3-day weeks under 75% easy | 362 | 1638 |
| 4-day weeks under the 68% floor | 0 | 84 |
| 5-day / 6-day / 7-day rows | — | **identical** |

⚠️ **THE LAST ROW IS THE WHOLE ARGUMENT.** Five, six and seven days are byte-identical with the caps
lifted, so **the caps can only ever bind at frequencies the book does not address.** Removing them buys
nothing for anybody Hudson is writing to and costs a three-day runner a week that is 55% easy.

⚠️ **THE ONE LEVER THAT DOES RAISE DELIVERED FREQUENCY IS BLOCK LENGTH, NOT THIS RULE.** The same six-day
runner gets **1.30** hard sessions a week on our long runways and **1.75** at Hudson's block lengths —
**with the build phase identical either way (69% vs 68% of build weeks at two).** A 40-week 5K block
spends most of its life in base, where one hard day is both correct and faithful to him. So this ask
points squarely at the parked **`pc-blocklen`** recalibration and at nothing in `qualitySessionsThisWeek`.

### ⚠️⚠️ THE ONE ESCAPE: THE TAPER'S ONE-SESSION RULE IS ENFORCED TWICE

Making `qualityByPhase` return **2** for the taper changed nothing observable, so the end-to-end guard
passed. `qualityContentsFor`'s taper branch pushes exactly one session and then `return out.slice(0,
count)` — so `count` can only ever **reduce** the list, never grow it. **Belt and braces hides the brace
you are testing**, the same shape this file already records for the share card's date gating. The outcome
guard now catches deleting *both*; a second guard names each brace (comments stripped — both functions
carry some of the longest comments in the engine and both quote the identifiers being asserted, the
comment-quotes-what-it-forbids trap for the twelfth time) so deleting *either* fails. Re-broken three
ways: the phase rule returning 2, the branch dropping its slice, and the branch pushing a second session.

### Traps this measurement paid for

⚠️ **`targetTimeSeconds: 0` THROWS `pace must be positive` FROM `distanceForTime`, AND A `catch { continue }`
REPORTED IT AS "0 plans generated".** This file already records that the field is required and that a
probe omitting it reports a product defect that does not exist; a probe passing **zero** fails the same
way one line deeper. **Print the error before believing a sweep that measured nothing.**

⚠️ **MY FIRST COUNT WAS UNFAIR TO THE APP BY EXCLUDING THE LONG RUN.** Hudson excludes it from the phrase
"two hard workouts", so I did too — and his Level 1's own two hard days *are* a progression run plus one
interval session. Counting his way moved a three-day runner from 1.00 to 1.31 hard sessions a week and a
six-day runner from 1.18 to 1.75. **Count the way the source counts, not the way its headline reads.**

⚠️⚠️ **I NEARLY RECORDED A DEFECT IN `tools/audit-progression.mjs` THAT DOES NOT EXIST, AND CAUGHT IT
ONLY BY VERIFYING A CLAIM I HAD ALREADY WRITTEN DOWN.** It passes `startDateIso` inside the **goal**
object rather than in the third positional `GenerateOptions`, and this file's own note that
`generatePlan(athlete, goal, options)` is positional made that look like a silently-ignored argument —
i.e. an audit whose start date drifts with the day it runs. **It is not:** `Goal` carries its own optional
`startDateIso`, and line 380 reads `options.startDateIso ?? goal.startDateIso ?? isoToday()`, so the
tool's `START` is honoured. Had it shipped, the next session would have "fixed" a working instrument and
invalidated every progression figure in this file. **A rule about one call shape is not a rule about every
field of every argument — read the destructure before calling a caller wrong.**

⚠️ **AND A PROBE READING `wp.ordinalInPhase` OFF A `PlannedWeek` GETS `undefined`** — those fields live on
the internal `AnnotatedWeek`, not on the public shape (`index`, `startDateIso`, `phase`, `isDeload`,
`focus`, `sessions`, `plannedDistanceMeters`, `qualitySessionCount`). Harmless here; it printed
`ordundefined/undefined` in an attribution table and would silently bucket everything together in a sweep
that grouped by it.

## THE SHORTER PLANS ARE IN (owner, 2026-09-01) — AND THE CAP EXPOSED FIVE DEFECTS IT DID NOT CAUSE

The parked `pc-blocklen` recalibration, done as one job. `MAX_STRUCTURED_WEEKS` **30/32/36/40/44 →
14/16/18/20/24** — Hudson's twelve plans are 12/14/16/20 weeks and no others, plus up to four weeks of
the introductory period ch7 asks for. ⚠️ **CAPPING DOES NOT TRUNCATE A PLAN, IT MOVES THE START LATER**,
because weeks are placed backwards from race Monday. Suite **1447 pass / 0 fail**, same count as before.

⚠️⚠️ **CLAUDE.md PREDICTED 17 FAILURES; THERE WERE 20, AND FIVE WERE REAL DEFECTS THE CAP MERELY
EXPOSED.** A long block's steps are small enough to hide arithmetic that a short one breaks — that is
the transferable lesson, and it applies to anything else in this engine expressed as a ramp.

1. ⚠️ **EVERY RAMP CLIMBED THROUGH A DELOAD.** `easyRampFor`, `longRunMinutes` and
   `buildBeginnerWeek`'s `f` all divided by the CALENDAR week, so a deload advanced the ramp while its
   own volume was cut and **the rebound out of one cost two steps**. `rampFractions` counts progressing
   weeks only and all three read it — one definition, because three copies of "which weeks count" is how
   they came to disagree.
2. ⚠️⚠️ **THE MAIN-TRACK LONG RUN WAS A LINEAR LERP, AND THE BEGINNER TRACK HAD ALREADY LEARNED WHY THAT
   IS WRONG.** Constant absolute steps mean the RELATIVE step is largest at the start: measured on a
   capped 3-day 5 km block, 36 → 82 minutes over ten steps is 4.6 minutes each, i.e. **12.8% on the
   opening long run**. `geomLerp` was introduced for exactly this on 2026-08-01 ("a straight lerp
   front-loads its growth, which is backwards") and the main track never got it. Both tracks now share
   `quantisedLadder`: geometric, quantised once across the plan, no delivered step over the guardrail.
3. ⚠️ **THE LIFT CLAMP WAS A FLOAT AND THE BUILDER ROUNDED IT UP.** `stepCap = prevLong * 1.10` gave
   39.6 from a 36-minute week, passed as `longMinFloor`, and `Math.round` made it **40** — an 11.1% step
   through a clamp set at 10%. **A clamp has to be expressed in the units the plan is delivered in.**
4. ⚠️⚠️ **THE TAPER CUT FROM A PEAK THE RUNNER NEVER RAN.** It multiplied `peakLong`, the ramp's
   DESTINATION; on a short block the step clamp tops out below that. Measured on a 10.6-week 10 km
   block: `peakLong` 91 minutes, the ladder topped out at 63, and the taper's 61 was **0.97× the week
   before it** — a taper that cut nothing. It reads `builtPeakLong` now, the highest rung actually
   delivered. ⚠️ **THAT INVERTED A GUARD'S CLAIM**: "a clamped one-week taper gives race week the same
   depth" held only while the taper multiplied a constant, so it is now asserted as a RATIO to each
   block's own built peak, which still catches the start-aligned-indexing bug it exists for.
5. ⚠️⚠️ **THE HILL-SPRINT STAND-ASIDE WAS TOO BROAD, AND THAT ONE WAS MINE FROM THE DAY BEFORE.**
   "Any unpaced rep" meant **"20′ Kenyan hills" — one twenty-minute rep at RPE 7, an aerobic run over
   rolling ground — stood the sprint day aside, 14 of 36 firings.** A short block is proportionally more
   build (two quality sessions a week rather than one), so it fired far more often and the weekly staple
   fell to **46%** of eligible weeks — which would have made the Road Map's own claim false. Narrowed to
   `MAXIMAL_HILL_RPE` (9+), and `pickSprintSlot` now prefers an easy day the rotation would NOT have
   given strides rather than dropping the sprints from the week entirely.
   ⚠️ **THAT IS HUDSON'S OWN LAYOUT, NOT A COMPROMISE** — his Level 2 week 7 carries hill sprints on the
   Monday AND 10 × 100 m strides on the Friday. Worst case **0.462 → 0.727**, better than the 0.611 it
   managed before the cap.

### Two more things had to move, and one is a whole extra cap table

⚠️ **THE 10k TAPER LEAD-IN 0.72 → 0.67 AND THE HALF'S 0.64 → 0.62.** The depth is measured against the
plan's own peak week, so anything that changes which week is biggest changes the denominator — the same
mechanism recorded for the 5k in 2026-08-04. The 10k landed at **29.9% against a 30% floor**, which is
the failure somebody meets and "fixes" by relaxing the floor. Swept: 0.68 → 32.3%, **0.67 → 35.1%**,
0.64 → 37.3%. Both picks are the shallowest value clearing 33% and both stay shallower than race week's
0.55, so the taper is still PROGRESSIVE rather than a step.

⚠️⚠️ **AND THE BEGINNER TRACK KEEPS A LONGER CAP — `MAX_STRUCTURED_WEEKS_BEGINNER` 16/20/24/28/28.**
Hudson's lengths describe runners **already training**: his Level 1 plan, the one explicitly "for
beginners", opens at a **four-to-five mile long run**, which is at or above where our beginner track
FINISHES for a 5 km. Our beginner ramps from ~30 minutes to the event's endpoint, a range his plans
never attempt, and the 1.10 guardrail bounds how fast a ramp may climb — so **the length a beginner
block needs is set by the ramp, not by the race.** Derived, not chosen: `log(range)/log(1.09)` steps,
supplied by (total − taper − one deload in four) progressing weeks, worst case at each distance being
the slowest beginner (whose `peakMin` rides the 135-minute ceiling while `beginnerOpenMin` stays pinned
at 30). Measured with the main-track caps applied: the 10 km ramp was one step short and the half FOUR
short, so **the beginner half arrived at 10.9 km against the report's 12–18 km band** and every step
across a deload delivered 17.5%.

⚠️ **`beginnerLongLadder`'s FIRST VERSION LET A DELOAD CONSUME A RUNG, WHICH IS WORSE THAN NOT CLAMPING
AT ALL.** A deload builds from the ramp's own value × its ease multiplier, so it never uses a rung — and
the clamp kept climbing through one anyway, because the held `ideal` was still above the pulled-down
`prev`. The runner then met the next non-eased week two rungs up: **every consecutive pair of ladder
entries was inside 9% while every step the runner actually ran was 17.5%.** The sequence that must
satisfy the guardrail is the one the runner runs.

⚠️ **THE LADDER'S ENDPOINT IS NOT FORCED, AND FORCING IT WAS ITSELF A BREACH.** Rounding each rung down
to stay inside the bound accumulates a deficit the ladder never makes up, so the destination then needs
one oversized final step: measured, forcing 82 after a ladder of 34 37 40 44 48 52 57 62 68 74 made the
last step **1.108**. It arrives a minute short instead. ⚠️ The beginner ladders reach 61/82/123 minutes —
their exact endpoints — on their own, which is what makes dropping it safe rather than a trade.

⚠️ **A THREE-RUN WEEK NOW PREFERS A SMALL QUALITY FORMAT (`avoidBig`).** The cap changes the rotation's
phase arithmetic, so different weeks draw different formats: a 3-day 5 km competitive block drew an
**85-minute threshold session** into week 9 beside a 38-minute easy run and a 58-minute long run — 47%
of the week in one session, and 65.7% easy against the 68% floor. `avoidBig` already means "this week
cannot take a big format"; three runs a week is that, reached from the other side.

### Measured, 768 plans, baseline → now

| | baseline | now |
|---|---|---|
| biggest week sits in build/peak | 95.6% | **98.7%** |
| weeks under the pyramidal easy floor | 39 of 18,624 (0.21%) | **22 of 12,144 (0.18%)** |
| worst single jump, minutes | 1.32× | **1.30×** |
| worst single jump, km | 1.43× | **1.36×** |
| rises >1.10 on km (count) | 826 | **794** |
| rises >1.10 on minutes (count) | 368 | 381 |
| mean deload depth | 28.8% | **30.2%** |
| taper cut, min | 22.3% | **26.0%** |
| long run not the longest of its week | 0.3% | 1.0% |

Six better, two worse. ⚠️ **THE RATES RISE WHERE THE COUNTS FALL, AND THE COUNTS ARE WHAT TO READ** —
8,352 transitions became 5,232, because the cap removes comfortable weeks rather than adding bad ones.
The two real costs are 13 more minute-jumps over the guardrail and 0.7 points of long-run inversion,
both from the geometric ramp's smaller mid-block long runs.

### Eleven guards restated, each against a re-measured counterfactual

⚠️ **THE BLOCK-LENGTH ASSERTION IS INVERTED, NOT DELETED.** It required `weeks.length >= 30`, which is
the behaviour the owner asked to remove; what it PROTECTED (surplus time extends the base, the build
stays concentrated) is unchanged and still asserted.

⚠️ **THE SPRINT-SLOT METRIC WAS THE WRONG DISCRIMINATOR UNDER THE CAP.** "Day after a quality session"
barely separates now (98% → 54%), because a day-after slot is often genuinely the least-bad one
available. What carries the claim is **sandwiched-between-two-quality (41% → 12%)** and a new positive
assertion, **clear-of-both (2% → 46%)** — a picker that stopped scoring collapses the latter to 2%,
which no bound on the other three catches as sharply.

⚠️ **THE LIBRARY-REACHABILITY GRID NEEDED SHORTER RUNWAYS, AND THE ABILITY AXIS DOES NOTHING.** `rot` is
`ordinalInPhase + phaseTotal + daysPerWeek + DISTANCE_SEED`, so what reaches a new format is a new PHASE
LENGTH. Capping collapsed 22/24/26/30/35 weeks onto one block, five grid points became one, and coverage
fell 95% → 93%. Adding the shorter runways restored it. Widening the ability axis was measured and
changes nothing — the seed never reads the runner's paces.

⚠️ **THE HEAT FIXTURE'S 200-DAY RUNWAY NOW EXCEEDS THE HALF'S CAP**, so its plan began 60 days in the
future and "today" was not in it at all — three guards failed with "the fixture is misaligned". Ninety-one
days, and the fixture now throws by name if a future cap change breaks it again.

⚠️ **AND ONE VACUITY CHECK BECAME STRUCTURALLY UNSATISFIABLE, WHICH IS A STRONGER STATE THAN A HOLE.**
`custom-session-gear`'s strides calibration required the FIRST strides-typed session to be effort-only;
`easyHillStrides` left the rotation pool and the sprint day now avoids the strides slot, so it is 0 of
480. Restated to the precondition `repScore` actually needs — both candidate kinds must EXIST — which is
true of 720 of 960 plans.

## ✅ THE BEGINNER TRACK GETS FAST RUNNING (owner, 2026-09-01: *"i want to follow the books
recommendation"*)

**This closes the finding the shorter-plans job surfaced and did not cause.** His check: *"In the plan
builder i selected building the habit / i set my Easy pace as 5.40 / My goal is running 5k and i selected
a time goal of 19:50 / The plan it produces doesnt appear to have any form of hard session"*. Reproduced
exactly — **zero quality sessions across all 15 weeks**, and it was the documented design
(`building` → `beginner`, and `test/hill-sprints.test.ts` asserted `qualitySessionCount === 0` for every
beginner week). Suite 1447 → **1456**; `test/beginner-quality.test.ts` holds 9 guards and **11 deliberate
re-breaks were each watched failing**.

⚠️⚠️ **THE DEFECT WAS NOT THE CONSERVATISM, IT WAS THAT TWO MODULES DISAGREED ABOUT ONE RUNNER.**
`assessFeasibility` returns **`verdict: "achievable"`** for that goal (4.7% needed, 11.6% realistic in 14
weeks) — so the app promised a 19:50 and then built a plan using exactly TWO bands, 5:26–5:55 easy and
4:43–4:59 for a steady finish, while he would have to race at **3:58**. He never ran within 45 s/km of
his goal pace before race day. Downgrading the verdict instead was the other option and is the worse one:
it tells somebody their goal is out of reach when the real answer is that the plan should have quality in
it. **Do not now do both.**

### What the book prescribes — transcribed from the plates, not the prose

⚠️ **THE ch11 "FRESHMAN PLAN" IS THE CALIBRATION POINT AND IS THE MOST CONSERVATIVE THING IN THE BOOK:**
twelve weeks for a runner brand new to structured training, carrying **hill sprints and fartlek and
nothing else** — no intervals, no threshold, no goal-pace work, no long run — with the fartlek at 5 km
pace rather than 1500m. **5K/10K Level 1** give the sharp end: *one* quality session a week, support work
run *"from the fast end downward"*, goal pace only in the final specific block, and race week run FASTER
than race pace.

⚠️ **OUR RUNNER SITS BETWEEN THE TWO, AND THAT IS WHY THE DIET IS FRESHMAN-WEIGHTED WITH LEVEL 1'S
TAIL.** Level 1 opens at a **four-mile long run**, which is at or above where this track FINISHES for a
5 km — so its interval volume (12 × 400 m, 6 × 800 m, 5 × 1 km) describes a fitter runner than ours.

| | |
|---|---|
| **wk 1–4** | nothing but hill sprints — the introductory period ch7 asks for |
| **wk 5–10** | fartlek at 5 km effort, growing 4 × 30″ → 8 × 45″; hill reps every 4th week |
| **wk 11–13** | goal race pace, reps lengthening as they thin (6 × 1′ → 4 × 3′) |
| **wk 14–15** | back to the fartlek, because both Level 1 plans sharpen into race week |

**His own plan now:** 11 quality sessions in 15 weeks, fastest training pace **3:55/km** against a 3:58
race pace, worst easy fraction **76.6%** against the 68% floor, 0 weeks breaching.

### ⚠️⚠️ THE REPS ARE TIMED, AND THAT IS MEASURED RATHER THAN PREFERRED

A hand-authored distance dose costs whatever the runner's pace makes it, and our beginners span a very
wide range. Against a 17-minute work budget: **6 × 400 m at goal pace fits a 19:50 5 km runner (15.2′)
while even 8 × 200 m OVERFLOWS for a 62:00 10 km runner (17.1′)**. Hudson prescribes by distance because
his Level 1 runners are far more alike than ours — and he uses time himself where it matters
(*"15 × 1 min. @ 5K pace"*, 10K Level 1 week 7). Guarded: **0 distance-based reps** across 1,384 sessions.

⚠️ **THE HILL VARIANT CARRIES NO PACE BAND AT ALL**, because pace up a hill is a function of the gradient
and for a beginner it is the one session that cannot be wrong about their fitness. Hudson's Level 1
week 7 says *"@ 3K effort"*, not a pace.

⚠️ **`BEG_INTRO_FRAC` IS 0.25, AND IT PROTECTS THE PACE BANDS AS WELL AS THE RUNNER.** `autoPace`
recalibrates a seeded anchor from the runner's **first continuous run**, so by the time any fast running
is prescribed the bands come from a real one rather than from a 5 km time nobody ran. Measured, the first
quality session lands at **25.0%–33.3%** of the block — the guard has a ceiling as well as a floor,
because an introduction that never arrives is the defect being fixed.

⚠️ **RUN-WALK AND RETURNING BEGINNERS GET NONE — the same scoping as the hill-sprint staple.** Somebody
who cannot yet run twenty minutes continuously is below the lowest tier the book addresses and their plan
is already interval-shaped; and coming back from a break is not the moment to meet fast running for the
first time. **Both are the owner's to overturn**, and both are guarded so they cannot change silently.

⚠️ **THE HILL SPRINTS ARE NOT LOST TO THE QUALITY DAY, THEY MOVE.** Hudson never puts them on the quality
day — Level 1 hangs them off the Monday, Thursday or Saturday easy run — so `sprintSlot` shifts to the
second easy day whenever a quality session takes the first. Dropping them instead would undo the weekly
staple the previous change measured in; guarded at **90%+ of quality weeks**.

### Measured, 96 plans / 1,920 weeks, race week excluded as always

| | |
|---|---|
| quality per week | max 1, and **0 weeks carry two** |
| first quality session | 25.0%–33.3% of the block |
| worst easy fraction | **85.9%** against the 68% floor, **0** model breaches |
| distance-based reps | 0 |
| goal-pace work outside the peak | 0 |
| longest quality session | 21 minutes of its own steps |

⚠️⚠️ **THE FIRST RUN OF THAT PROBE REPORTED "worst easy fraction 7.4%, 96 breaches" — EXACTLY ONE PER
PLAN, WHICH WAS RACE WEEK.** Race week contains the goal race, a maximal effort over the full distance,
and every intensity sweep in this repo exempts it for that reason. **A breach count equal to the plan
count is the signature of a per-plan structural exemption, not of a defect.**

⚠️ **AND THE MAIN TRACK IS UNTOUCHED, WHICH IS PROVED RATHER THAN ASSERTED.**
`tools/audit-progression.mjs` sweeps `recreational` and `competitive` **only**, so a beginner change
cannot reach it — and every figure came back byte-identical: biggest week in build/peak **98.7%**, **22
of 12,144** weeks under the floor, worst jump **1.30× minutes / 1.36× km**, rises >1.10 **381/5232**
minutes and **794/5232** km, deload depth **30.2%**, taper cut **36.3% mean / 26.0% min**, long-run
inversion **1.0%**.

### Two guards restated, and one fixture that had never built what it tested

⚠️ **`test/hill-sprints.test.ts`'s BEGINNER BLOCKER ASSERTED THE BEHAVIOUR BEING REMOVED** —
`qualitySessionCount === 0` for every beginner week. **Inverted rather than deleted:** what it protected
(the sprint day stays an easy day, and run-walk is scoped out) is unchanged and is what it asserts now.
Its vacuity floors were raised with it — staple 0.6 → **0.7**, any-hill 0.65 → **0.75** — because the
shorter blocks made the old bars pass on less.

⚠️⚠️ **`test/no-warmup-low-intensity.test.ts`'s RUN-WALK FIXTURE HAD NEVER BUILT A RUN-WALK PLAN.** It
passed **`status: "new"`** — a **web-layer** field the engine does not read (it reads `athlete.runWalk`) —
so it built a continuous beginner and **agreed with its guard by accident**, because a continuous
beginner's sessions were also all typed `easy`. It was invisible until a positive proof
(`anyQuality === 0`) was added beside it. **A fixture that cannot reach the state it names proves nothing
about it**, and the tell is that it can only ever pass.

### Still the owner's call, unchanged

Hill sprints for **run-walk** beginners; reshaping the **retest** as a spec test (5 × 1 km at goal pace
off 2 min, cadence 4 → 5–6 weeks) in `src/adapt/weekly-review.ts` · `retestDue`; and the
**no-deload-for-low-load** half of the cadence rule. ⚠️ **`assessFeasibility` IS NOW LESS WRONG BUT STILL
UNAUDITED FOR BEGINNERS** — it believes 11.6% in fourteen weeks is realistic, and nothing measures
whether the new quality diet makes that true.

## ✅ HUDSON'S THIRD RECOVERY-WEEK TIER (owner, 2026-09-01: *"Recovery weeks for low-mileage runners.
The book says skip them entirely and i'm happy with that"*)

**He overruled a concern this file had recorded, so it is his decision and it is built.** Suite 1456 →
**1469**; `test/deload-tier3.test.ts` holds 13 guards and **15 deliberate re-breaks were each watched
failing**. A read-only investigation ran first (13 agents, 7.3M tokens) and **two of its three
adversarial verdicts said DO NOT SHIP** — the reasons they gave are below, and two of the three
headline objections were refuted by measurement.

⚠️⚠️ **THE RULE HAS THREE TIERS AND WE DELIVERED TIER 2 TO EVERYBODY.** Verbatim (ch7): *"Competitive
runners who typically maintain a workload that's close to the limit of what their bodies can handle
require a recovery week every third week throughout the training cycle. Runners who maintain a more
easily managed workload relative to their personal limits may only need a recovery week every fourth
week. Low-key, low-volume competitive runners typically don't need to schedule recovery weeks at all.
Instead, they can just take a day off or replace a hard run with an easy run as necessary."*

⚠️ **`phaseSchedule` GAINED A 4th ARGUMENT DEFAULTING TO TRUE**, and that default is the whole safety of
the change: every other caller — the tests, and any future one — keeps the behaviour it had.
`schedulesRecoveryWeeks(athlete, goal)` is the only caller that passes false.

⚠️ **EVERY FIELD THE GATE READS IS A PURE INPUT, AND THAT IS ARCHITECTURE RATHER THAN TIDINESS.** The
book keys its rule on *"the planned average training workload of your training plan"*, which is a BUILT
quantity — and `buildAll(vScale)` is rebuilt to a fixed point whose input is this very schedule. A gate
reading the built plan is circular and could make that fixed point oscillate. So the gate reads what the
runner told us, and its arms are DERIVED from measuring what the plan then delivers for them.

### The gate, arm by arm

| arm | why, and it is measured or declared a judgement |
|---|---|
| **non-beginner** | ⚠️ Table 3.1 lists **FIVE** volume categories and **"Beginners" is a separate, LOWER one than "Low-Key Competitive"** — the category the exemption names. So the book says nothing about a beginner's recovery weeks; this is not it saying yes. Our deload also absorbs the geometric beginner long-run ramp whose block length was DERIVED assuming one deload in four, and the engine ignores a stated volume for beginners entirely (0 of 840 beginner plans differ with one). |
| **not returning** | Both comeback flags mean **detrained** — `generate-plan.ts` says so where it computes `returning` — and `returnToRunningPlan` draws this repo's long-layoff line at four weeks. All three verdicts demanded this arm; without it, 100% of returning band plans lost every recovery week. |
| **≤ 4 running days** | ⚠️ **THE MECHANISM, NOT A PROXY FOR VOLUME.** The book's own remedy is *"just take a day off"*, which presumes a week that already has days off in it: a 4-day week has three, a 7-day week has none. Days per week is a **poor** volume key — measured, 7.8% of the spread, and a 4-day runner can be at 403 min/wk — and that is not the job it is doing here. It is also where the measured risk lives: the easy-fraction cost is concentrated in 5- and 6-day runners. |
| **a STATED volume, 22 (5k) / 25 (10k) to 35 km** | absence keeps the recovery weeks — see below |
| **5k and 10k only** | the half and the marathon are excluded on the long-run share — see below |

⚠️ **`!stated` IS THE SAME EXPRESSION AS `targetPeakWeeklyKm` AND IT IS LOAD-BEARING.** `volKm` is 0 in
`DEFAULT_PROFILE` and the web layer only sets the engine field `if (pf.volKm > 0)`, so **0 and undefined
must mean the same thing**. Written `stated < 35` this reads 0 as the lowest mileage there is and strips
the recovery weeks from every runner who skipped the question — the phantom-default disaster this file
records for `weeklyVolumeKm: 30`, which rebuilt every existing runner's block on one boot. **Absence
keeps the recovery weeks; the change is fail-safe by construction.**

### The floors are the book's own criterion, measured on this engine

Worst mean-week/stated across 3–4 days, five abilities and three runways per cell. Below these the
per-session floors bind (a 20-minute easy run cannot shrink; `MIN_VOLUME_SCALE` bottoms out at 0.45) and
the plan delivers MORE than the runner said they run — so by the book's own test they are tier 1 or 2:

| stated | 12 | 15 | 18 | 20 | 22 | 25 | 28 | 30 | 35 |
|---|---|---|---|---|---|---|---|---|---|
| **5k** | 1.81× | 1.45× | 1.21× | 1.09× | **1.02×** | 1.01× | 0.99× | 0.97× | 0.97× |
| **10k** | 1.93× | 1.55× | 1.29× | 1.16× | 1.05× | **0.99×** | 0.99× | 0.96× | 0.97× |

⚠️ **MY FIRST VERSION OF THAT TABLE SWEPT THE MEAN AND STARTED AT 20 km, AND ITS OWN GUARD CAUGHT IT:** a
10 km runner stating 15 km/week was being gated while their plan averaged **1.63×** what they said. The
fixture-too-kind trap, in the one measurement the whole gate rests on.

⚠️ **THE PEAK IS NOT THE RULER AND MUST NOT BE SUBSTITUTED.** Peak/stated is 1.27× on average in this
band and an adversarial verifier used it to argue the premise was refuted. That figure is
`PEAK_VOLUME_MULTIPLIER` (1.25) working exactly as designed — a block is *supposed* to build above
maintenance, and the book's own 5K Level 1 peaks at 2.2× its opening week. Reading the peak here
condemns every correctly-built plan.

### ⚠️⚠️ THE HALF AND THE MARATHON ARE EXCLUDED, ON A BETTER MEASUREMENT THAN ANY RATIO

The peak long run as a share of **its own week**, worst cell:

| stated | 25 | 28 | 30 | 35 | 45 |
|---|---|---|---|---|---|
| 5k | 51% | 48% | 46% | 46% | 46% |
| 10k | 57% | 54% | 51% | 49% | 48% |
| **half** | 71% | 66% | 63% | 58% | 53% |
| **marathon** | **77%** | 76% | 74% | 71% | 65% |

A marathon runner stating 25 km/week is prescribed a **19 km long run inside a 25 km week** — their week
IS one long run plus a couple of short ones, because `LONG_FLOOR_KM` forces a 24–28 km endpoint whatever
they said. **There is no "easily managed workload relative to their personal limits" there to exempt, and
removing their one eased week takes it from the runner who needs it most.** The half is milder but still
63–66% across its whole candidate band — marginal on two independent measures at once, and where a
population is marginal this engine keeps the behaviour it has.
⚠️ **NEITHER SHARE IS CAUSED BY THIS CHANGE** — the long run and the week scale together, so it is
identical with and without the recovery weeks. It is `assessFeasibility`'s documented volume-blindness
showing through, **read as a tier signal rather than fixed here**.
⚠️ **AND EXCLUDING THE MARATHON REMOVED THE WORST CASE ON A DIFFERENT METRIC AS A SIDE EFFECT** — the
21-consecutive-week plan, which came from our 24-week marathon cap.

### ⚠️ THE CEILING IS A JUDGEMENT, AND HUDSON'S OWN TABLE CANNOT SUPPLY ONE

Measured across 2,940 plans there is **NO EMPTY BIN** anywhere in mean weekly minutes, mean km or peak km
at 25-min/5-km resolution — the quantity is continuous, so **a threshold is a judgement, not a
discovery**. The largest gap between consecutive observations is 20.9 min, in the extreme top tail.

⚠️⚠️ **AND TABLE 3.1 IS IN MILES, WHICH ANYONE "ALIGNING" THE THRESHOLD TO THE BOOK MUST KNOW.** The
sentence after it reads *"if you plan to exceed 70 miles a week, you will need to run twice a day"* and
its Elite marathon row is 110–130. Converted:

| per week | Beginner | Low-Key Competitive |
|---|---|---|
| 5K | 32–48 km | **40–56 km** |
| 10K | 40–56 km | **48–64 km** |
| Half | 56–64 km | **56–72 km** |
| Marathon | 64–80 km | **80–97 km** |

**Every volume this app serves is at or BELOW Hudson's *Beginner* band**, so his tier-3 band covers our
whole population — transplanting it would strip the recovery weeks from everybody. The 35 km ceiling is a
judgement about OUR population, bounded by the guards.

⚠️ **AND "LOW-KEY, LOW-VOLUME *COMPETITIVE*" MUST NEVER BE WIRED TO `experience === "competitive"`.**
Table 3.1 makes "Low-Key Competitive" a category BELOW "Competitive", so the phrase names the low end of
racers rather than our flag. Measured, our flag carries essentially **no volume information at all** —
0.1% of the spread; it holds 102 of the 200 busiest plans and 89 of the 200 lightest. So reading it as
the key is **a coin flip, not merely an inversion**; reading it as "the high end" would remove recovery
from the runners the book says need it MOST often.

### ⚠️⚠️ THE HEADLINE OBJECTION WAS REFUTED BY A CONTROL, AND THAT IS THE LESSON OF THE WHOLE JOB

An adversarial verifier reported: *"the ex-recovery week is a local maximum 36.8% of the time against
0.0% at baseline — this is not 'no recovery week', it is a spike where the recovery week was."* The 0.0%
is **trivially true**: a week whose volume is deliberately cut cannot exceed its neighbours. The honest
comparison is how often **ANY** week in the same plans is a local maximum:

| | measured |
|---|---|
| ex-recovery week is a local max | **27.9%** |
| **control — any non-taper week in the same plans** | **29.9%** |

So the ex-recovery week is a local maximum **less** often than an average week. It levels; it does not
spike. **A ratio against a control of 0.0% measures the definition of a deload, not the effect of
removing one.**

### Measured, 24,750 plans, variant against a HEAD worktree

| | |
|---|---|
| gated | **900 = 3.6%**, in 60 distinct shapes |
| collateral | **0** non-gated plans changed; all 900 gated ones did |
| gate purity | **0** beginners, **0** returning, **0** above 4 days |
| easy floor | **IDENTICAL** whole-grid (868 breaches of 415,250 both ways); **0 of 13,100** in the gated set both ways, worst 69.1% → 68.5% |
| longest unbroken stretch | **3 → 13..16 weeks** (the book's longest plan implies 18) |
| long-run step | worst **1.1000×**, exactly the guardrail |

⚠️ **REMOVING THE RECOVERY WEEKS MAKES THE LONG-RUN STEPS SMALLER, NOT LARGER**, and that is worth knowing
before anyone fears it: `rampFractions` HOLDS the progress count on a deload or taper week, so a gated
plan has **more** progressing weeks for the same range and each step shrinks.

### The runner is told, and the app rendered only one note

⚠️ This app never changes a plan silently and a block with no recovery week is a permanent structural
difference. The note also carries the other half of Hudson's sentence — where to ease a week off by
hand — because removing the automatic easing is only safe if the manual easing is findable.
⚠️ **`viewPlan` WENT FROM `.find` TO `.filter`, AND THAT IS A FIX RATHER THAN A TIDY-UP.** Both volume
notes can fire for one runner — measured, a runner stating 35 km on 4 days trips the under-delivery note
AND is inside the band — and `.find` silently dropped the second, so they were told their plan could not
reach their mileage and never told it also had no easier weeks in it.

### ⚠️⚠️ THE REPO'S OWN INSTRUMENT WAS BLIND TO ALL OF THIS

`tools/audit-progression.mjs` swept `[null, 40]`: `null` means the runner never answered (which keeps the
recovery weeks) and 40 is above the ceiling — so **it reported the entire change as byte-identical**. With
30 added to the axis, **4 of 17 metrics move and three are the change describing itself**: no-deload plans
0.0% → 8.3%, the deload-depth sample size (n 4032 → 3732, depth 29.6% → 29.3%), and two transition rates
whose **denominator grew 7848 → 8412** because more consecutive non-deload pairs now exist (counts 731 →
733 minutes, 1338 → 1375 km). Every safety metric identical, both worst jumps included.

### Two of my own guards were refuted by their own measurements

⚠️ **THE FLOOR'S BOUND WAS SET AT 1.03× ON THE VARIANT AND WAS UNSATISFIABLE BY CONSTRUCTION.** Removing
four ~30%-deep recovery weeks from a ~20-week block raises the plan's own mean by
`4/20 × 0.30 / (1 − 4/20 × 0.30)` = **6.4%**, so a variant ratio of ~1.06 **IS** a baseline ratio of 1.00.
Measured, the variant plateaus at 1.04–1.08 for every distance at every stated volume — there is no floor
at which 1.03 is reachable. **Measuring the thing being gated against the criterion that gates it is the
circularity to avoid**; the bound is 1.10 on the variant, which corresponds to ~1.03 at baseline.

⚠️ **AND `test/profile-inputs.test.ts`'s OVERSHOOT-NOTE BLOCKER IS RESTATED, NOT DELETED** — it pinned
`.find`, and its invariant (a note the engine writes must be one the app shows, and the design notes must
stay off it) never changed. Both directions re-broken. **That is the fifteenth-plus firing of
guard-scoped-to-a-HOW in this file.**

### ⚠️⚠️ STILL OPEN, AND IT IS THE HALF THAT MAKES THE RULE SAFE

**The book's "instead" clause is only half delivered, and this is the most useful finding of the
investigation.** Measured, every route by which a runner can currently get unplanned recovery:

| depth of easing | route |
|---|---|
| **−21%** | `applyMissedSessionAdjustment` — substitutes a hard run for an easy one, i.e. **Hudson's sentence implemented exactly** — and it has **ZERO callers** |
| −24 to −28% | a scheduled recovery week (what this change removes) |
| **−57%** | the shallowest thing a runner can actually TAP (Manage plan › Not feeling 100% › "Easy and speed") |
| −70 to −91% | the wired **default** ("Easy runs only") |

⚠️ **SO THE GRANULARITY IS WRONG: the shallowest tappable easing is twice a recovery week and the default
is three times it.** Recovery IS reachable and undoable in 4 taps, so the change is not unsafe — but the
app cannot currently *replace a hard run with an easy one*, which is the mechanism the book names.
⚠️ **AND NOTHING PROMPTS.** `assessWeeklyJump`, `countTrailingMisses` and `assessLongRunSpike` — the three
functions that would detect a needed recovery week — have **0 callers in `web/app.ts`**. `assessInjury` and
`applyInjuryAdjustment` are equally dead.
✅ **THE −21% MECHANISM IS NOW WIRED — see the "Make a week easier" chapter at the end of this file.**
The granularity gap is closed: the shallowest easing a runner can tap is no longer 57%. What is still
open is the PROMPT, and the three dead detectors above are what would supply it.
⚠️ **AND THE FLAGS ENGINE'S "EASE OFF" INCREASES TRAINING TIME** — measured 295 → 350 min/wk (+19%),
because a slower anchor spends more minutes covering the same km target. That is a defect in its own
right, found on the way and not fixed.

### Also worth knowing

⚠️ **THE BOOK'S OWN PLANS ARE IMAGES.** `grep -c '<table'` gives c07 **69** and c11/c12 **0**; the twelve
chapter-12 plans are **47 JPEG plates** with no `alt` text, and all six chapter-11 plans likewise. The
week-by-week structure of every plan the book *ships* is unreadable as text — only the worked examples in
chapters 6 and 7 can be quoted. Chapter 7's 20-week / 70-mile plan puts its recovery weeks at **6, 9, 12,
15 — every third week** (tier 1), achieving −18.9 / −19.2 / −32.3 / **−10.6%**, so the book's own worked
example does not always hit its own stated 20–30% depth. Chapter 6's 12-week progression uses **every
fourth week**.
⚠️ **AND A 13-AGENT WORKFLOW'S FINDINGS WERE PARTLY CORRUPTED BY ME EDITING `src/` WHILE IT RAN** — in an
earlier session, 23 of 133 checks. This one was run strictly read-only with the rule stated in every
prompt, and the tree was byte-identical throughout.
