# Plan engine — progression audits, the engine handoff read-across, taper specificity

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## REVIEW THE SESSIONS FOR GENUINE PROGRESSION (owner 2026-08-03) — **AUDIT DONE 2026-08-06**

**The measurement is done — findings below.** He wanted the plan audited against the principles of training — Specificity, Progression,
Overload, Reversibility — with progressive overload examined through **FITT: Frequency, Intensity, Time,
Type**. Measure it, do not reason about it; every session type, every plan length, several abilities.

What each axis means here, and the check to write:
- **Frequency** — runs per week across the block. Does it rise, and never by more than one run at a time?
- **Intensity** — the fraction of weekly minutes at threshold and above, and whether the prescribed paces
  themselves sharpen as fitness is re-anchored. Beware: paces only move when the runner re-tests, so a
  block can look flat here and be correct.
- **Time** — session duration and weekly volume. Monotone rise, deloads excepted, with week-on-week jumps
  inside the 1.10 guardrail the long run already uses.
- **Type** — does the mix shift toward race-specific work as the race approaches? That is specificity, and
  it is the one most likely to be missing: `selectFormat` rotates a pool rather than progressing it.
- **Reversibility** — are deloads and the taper deep enough to absorb and short enough not to detrain?

⚠️ **One defect already found, and now MEASURED — start here.** A long run that is not the longest run of
the week is incoherent as coaching whatever the mileage says, and it is a specificity failure, not a
rounding one. The open question was whether the named-time change caused it. **It did not cause it, but it
made it materially worse.** Measured over the same 19,200 weeks at three points in history, on whole-outing
distance so the trees are comparable:

| tree | long run NOT the longest run of its week |
|---|---|
| `ed9140b` — before the named-time work | **32.7%** |
| `cbe815f` — after it, before the easy ramp | **40.1%** (+7.4 pts) |
| with the easy-run ramp (2026-08-04) | **37.6%** (−2.5 pts recovered) |
| with the cool-down removed (2026-08-04) | **30.0%** (−7.6 pts more — better than before any of this) |

⚠️ **The cool-down removal has already improved this more than anything else tried**, and by accident
rather than by design: the framed easy runs each lost four minutes while the long run kept its whole
outing. It is now BELOW the pre-named-time baseline. Re-measure before deciding how much is left to fix.

So there is a large pre-existing defect (a third of all weeks) which the named-time change worsened and the
easy ramp partly repaired. Two causes, and they need separating before anything is changed:
1. **`startLong` is `peakLong × 0.55` while easy runs now start at `× 0.80`** — the long run ramps from much
   further back, so in early weeks it is *structurally* allowed to be the shortest run of the week. Whether
   the long run should ramp that gently, or easy runs be held under it, is a coaching decision.
2. **The long run's frame is excluded from the count but its CEILING is measured on the whole outing**
   (`LONG_CEILING_MIN`), so a capped long run silently loses its warm-up and cool-down minutes from the
   counted figure while a capped easy run does not. That one is arguably a bug.

⚠️ **Do not "fix" this by scaling the long run up.** `Math.max(1, vScale)` is one-way on purpose and the
reasoning behind it is documented at length in `buildAll` — a marathoner stating 30 km/week got a 10.3 km
longest run when that rule was absent.

## THE PROGRESSION AUDIT — measured 2026-08-06

His instruction was *measure it, do not reason about it*. **768 plans / 18,624 weeks**: 4 distances × 4
runways (13 to 52 weeks) × 3–6 days × 3 abilities × recreational/competitive × stated-volume on/off. The
partial first week and race week are excluded from every trend — both are fragments by construction.

⚠️ **THREE INSTRUMENT FAULTS CAME FIRST, AND EACH WOULD HAVE PRODUCED A CONFIDENT WRONG REPORT.** Found by
probing one plan by hand rather than trusting the totals. Anyone repeating this audit should re-read these
before writing a measurement:
1. **Hard minutes read from STEP-level `targetRpe`.** Quality reps do not carry one — a threshold session
   probes at "max RPE 3", a VO2 session at "RPE 3" — so intensity read ~2% everywhere and the taper read
   **0.0% hard**, which would have been reported as "the taper throws away all intensity". `stepBucket` /
   `computeDistribution` is the engine's own tested definition. Use it; never roll a second one.
2. **Race-pace seconds charged the WHOLE race-specific session**, so "15′ easy → 20′ at goal pace → 10′
   threshold" counted 70 minutes of race pace instead of 20.
3. **The label is "marathon EFFORT", not "marathon pace".** A regex looking for "pace" missed every
   marathon race-pace block in the library.

### What the five principles measure at

| principle | measured | verdict |
|---|---|---|
| **Frequency** | flat in **81.3%** of plans; **zero** jumps of 2+ running days | not progressed **by design** — the runner picks their days |
| **Time** | **16.3%** of non-deload week-on-week rises exceed the 1.10 guardrail (1359/8352), worst **1.46×** | ⚠️ real defect, root cause below |
| **Intensity** | 5k/10k hard **1.4% → 3.4%**; half/marathon hard **1.1% → 0.4%** while moderate **6% → 20%** | correct, and correctly different per race |
| **Type / specificity** | race-pace share **0.0% base → 0.0% build → 5.2–12.3% peak** | ⚠️ nothing before the peak phase — ⚠️⚠️ **and the peak figure was UNDER-REPORTED, see the instrument note at the end of this chapter** |
| **Reversibility** | deload **17.8%** deep, every 4.0 weeks; taper **36.9%** (20.7–46.7%) | taper healthy, ⚠️ deloads shallow |

Also: only **23 weeks of 18,624** breach the pyramidal/polarized easy floor, and the biggest week sits in
build or peak in **97.9%** of plans — both healthy, and both the product of the easy-run ramp.

### ✅ FINDING 1 — the volume line saw-tooths — **FIXED 2026-08-06**

Not a ramp that is slightly too steep. Measured on a 3-day 5 km block: **22.4 → 16.6 → 24.2 km** across
weeks 5–7, with week 6 **not a deload**. The week-6 quality session is `10 × 50 m hill sprints, walk back`
— **0.50 km** of counted distance for a 39-minute session — where week 7's is `2 × 15′ threshold / 3′
float` at **7.94 km**.

**The same slot swings by 7.4 km — 37% of that week's entire volume — decided by a format rotation that
knows nothing about volume.** Hill sprints are effort-only steps (no pace, by design, because pace up a
hill is a function of gradient) and their walk-back recoveries carry no distance either, so a hill week
reads as nearly empty to the volume model while the runner is out for the same 39 minutes.

⚠️ **Do not "fix" this by giving hill sprints a synthetic distance** — that would put a fabricated number
in the runner's logbook and in the mileage they are judged against. The honest options are to smooth the
ramp across the rotation, or to let `selectFormat` see the volume it is about to spend. That is a design
decision for the owner.


**Fixed by letting the EASY RUNNING absorb how big this week's quality session happens to be.** The
compensation is in MINUTES — a week whose quality session is light genuinely carries a little more easy
running, which is ordinary coaching and honest because the runner really does run those minutes.

⚠️ **TWO THIRDS OF THE VISIBLE SAWTOOTH WAS NEVER A TRAINING PROBLEM.** Measured over 8,352 transitions,
rises above the 1.10 guardrail were **15.7% on counted distance but only 6.1% on training TIME**. The plan
is built in minutes and displayed in kilometres, and a hill-sprint session covers almost no ground. Always
check which of the two a "volume" defect lives in before changing the volume model.

⚠️ **FILL HOLES, NEVER SHAVE PEAKS — the first cut compensated symmetrically and regressed nearly
everything it touched.** Removing easy running from a big-quality week raises that week's hard fraction:
weeks under the pyramidal floor went **18 → 83**, deloads went shallower (5k 13.2% → 11.7%), and the
biggest week left the peak phase in 5.5% more plans. A week whose quality session is genuinely long IS a
bigger week and must be left alone.

⚠️ **AND IT MUST LEAVE THE DELOADS AND THE TAPER ALONE.** Both are deliberately smaller, so a compensator
reads them as holes and undoes them. `taperSession` is a short, sharp VO2 session — shorter than the mean
— so the taper got topped back up and `the taper genuinely cuts the week` failed at 29% against its 30%
floor. A week that is deliberately smaller is not a week with a hole in it.

⚠️ **The reference is the plan's OWN mean quality session, from a first pass in `buildAll` — not a
constant.** Quality sessions scale with the runner's paces and with `vScale`, so a hardcoded figure would
be right for an average runner and quietly biased for everyone else, and it would not fail loudly.

**Measured, before → after:**
| | before | after |
|---|---|---|
| rises >1.10 on counted distance | 15.7% | **10.6%** |
| rises >1.10 on training time | 6.1% | **3.1%** |
| worst single jump | 1.46× | **1.35×** |
| weeks under the easy floor (640-plan sweep) | 18 | **2** |
| week-one anchoring | 88.5% | 88.5% (unchanged) |
| deload depth | 17.8% | 18.4% |
| taper cut | 36.9% (20.7–46.7) | 36.8% (20.7–46.7) |

⚠️ One cost, reported rather than buried: the long-run inversion drifts **30.0% → 30.8%**, because the
easy runs in hole weeks get slightly longer. Finding 4 already argues that figure is mostly a short-race
artefact, but it did move the wrong way.

⚠️ **`test/volume-smoothing.test.ts` CONTAINS A TEST THAT DOES NOT DO WHAT ITS FIRST TWO NAMES CLAIMED.**
"It never shaves a big-quality week" passed under the symmetric bug it was named for (the easy-run ramp
swamped the comparison); rewritten to measure the easy floor it still passed at 16 plans and at 256,
because the breaching profiles live in runway lengths the test does not sweep. It is now named `the easy
floor still holds across the sweep`, for what it actually does. The real discriminator is `deloads and the
taper are left alone`, and the 18 → 83 signal only appears in the full 768-plan audit.
### ✅ FINDING 2 — no race-pace rehearsal before the peak phase — **FIXED 2026-08-06**

`0.0%` in base **and** in build, for 5k, 10k, half and marathon alike, then 5.2–12.3% in peak. The build
phase's long-run finishes are explicitly `"Strong steady finish — controlled, not raced"`; every
`"Block at marathon effort"` / `"Finish at marathon effort"` step lives in peak only. For a marathon in
particular, race-pace long runs during the build are standard practice, and the plan has none.

**And 24 plans (3.1%) never get any race-pace work at all** — all short-runway blocks, concentrated in the
10 km. A short block spends its whole life in base and build, which is exactly where the library has no
race-pace work to give.
⚠️⚠️ **THAT 3.1% IS AN INSTRUMENT ARTEFACT AND THE REAL FIGURE IS 0.0% — corrected 2026-08-25.**
`raceSecs` in `tools/audit-progression.mjs` summed `st.durationSeconds || 0`, and **race-pace reps are
prescribed BY DISTANCE**: measured on one competitive half block, **8 of its 21 race-pace work steps carry
`distanceMeters` with `durationSeconds` undefined** (`8 × 1 km at goal race pace`, and the 4 × 2 km and
2 × 5 km formats likewise). So the ruler could not see 38% of the very thing it was pointed at. Re-run
gate-agnostically over the same 768 plans: **peak race-pace share 9.7% → 16.3%**, plans with no rehearsal
**3.1% → 0.0%**, and per distance the peak share goes 5k 7.9% → **13.3%**, 10k 5.5% → **13.3%**, half
12.8% → **19.5%**, marathon 12.5% → **19.1%**. Every other metric in the audit is byte-identical — the
intensity buckets, the easy floor (34 of 18,624), the deload depth (28.9%), the taper cut
(37.4% / 21.9% / 46.4%) and the long-run inversion (0.4%) — which is exactly what you would predict if
only race-pace steps are distance-gated today, and is what makes the correction believable.
⚠️ **THE FIX THIS FINDING PROMPTED IS STILL CORRECT AND IS NOT WITHDRAWN.** Allowing `race-3x10` and
`race-cutdown` into the build phase, and making `qualityContentsFor` actually ask for one, moved the build
phase off a genuine 0.0% — and build-phase race-pace comes from long-run fast finishes, which are TIMED,
so that measurement was never blind. What was wrong was the peak figure and the short-runway claim.


**Fixed, in two places, because there were two independent causes:**
1. **Every race-specific format was `phases: ["peak"]`.** The two mildest — `race-3x10` and
   `race-cutdown` — now allow `["build","peak"]`. The five `load: "big"` ones (8×1k, 4×2k, 2×5k, the
   sandwich, the 5 km time trial) stay peak-only: a build week is not the place for a time trial.
2. ⚠️ **AND THE BUILD PHASE NEVER ASKED FOR ONE.** `qualityContentsFor`'s build branch drew only
   threshold and VO2, so change (1) alone was **dead code and measured as exactly zero effect** — the
   audit caught that, not a review. Late build weeks now alternate a race-specific session in.
   Half/marathon build long runs also gained a race-pace fast finish at ~half the peak's cap, which the
   function's own doc comment had claimed all along ("REAL doses of race-pace work in build/peak") while
   the code finished every build variant steady, one labelled "controlled, not raced".

⚠️ **SHORT EVENTS ARE DELIBERATELY EXCLUDED, and that is the finding's correction to itself.** For 5 km
and 10 km, `paces.goalRace` sits on top of threshold/VO2 — **the interval work already IS the rehearsal**,
so the measured "0.0%" was an artefact of a label-based metric, not a gap in the training. Handing them
"3 × 10′ at goal race pace" would be thirty minutes at 5 km pace, longer than the race itself, and is the
identical unrunnable prescription this file records removing from short-event long runs.

⚠️ **A ONE-QUALITY WEEK NEARLY MISSED OUT.** Written as "threshold, plus race-specific if there is room",
the race-pace session fell off the end of `slice(0, count)` on a three-day week — so the runners with the
fewest sessions, who most need the one they get to be specific, were the only ones never reached.

**Measured, before → after** (`tools/audit-progression.mjs`, 768 plans):
| | base | build | peak |
|---|---|---|---|
| half | 0.0% | **0.0% → 3.2%** | 12.3% |
| marathon | 0.0% | **0.0% → 3.1%** | 12.2% |

A clean 0 → 3 → 12 progression, with the peak untouched so build→peak is a real step up. Side effects, all
measured: weeks under the easy floor **23 → 18**, and week-on-week volume jumps above 1.10 *improved* for
both (half 18.6% → 17.7%, marathon 13.9% → 12.7%) because race-specific formats vary less in length than
the VO2 ones they replace. `test/race-pace-progression.test.ts` pins all of it, including the exclusion.

⚠️ **A PEAK deload still carries a race-specific session and that is deliberate** — `fctx.isDeload` reaches
the format picker, which drops the "big" formats, so the week gets the mild cut-down. The first cut of the
test asserted across every phase, failed on this, and would have had me overturn a real design decision to
get a green test. Build deloads are the ones that must stay clean, and they do.
### ✅ FINDING 3 — deloads are shallow — **FIXED 2026-08-06**

Mean cut against the week before: **5k 13.2%, 10k 17.5%, half 19.4%, marathon 20.4%**. A 13% cut is not
much of an absorb week. The taper by contrast is healthy at 36.9% (inside the 30–60% window on every
distance). Whether a deload should cut 20–40% is a coaching call, but 13% is worth him seeing.


**Deepened to a mean 26.5% cut (was 17.8%), with the hard session kept.** The owner's constraint was the
design: *"I don't want users thinking the plan isn't challenging enough."* So the week loses VOLUME and
keeps INTENSITY — the same bargain the taper already strikes. Three levers, and they only work together:
1. ⚠️ **`selectFormat` now PREFERS the "small" formats on a deload**, not merely non-"big" ones. Dropping
   the big formats was all a deload did there, so it still drew a full-length session. The runner gets a
   genuine hard session at the same intensity; it is simply short — exactly what `taperSession` does.
2. The long run's deload multiplier **0.75 → 0.68**, easy runs **35 → 32 minutes**. Swept as a pair; the
   chosen point lands the mean at 25.7% before the format effect, 26.5% with it.
3. The quality session **COUNT was already 1 and stays 1**. It is never dropped, and a test asserts it.

⚠️ **THE EASY FLOOR IS UNTOUCHED — 2 breaches in 19,200 weeks either way — precisely BECAUSE the hard
session got shorter as the volume fell.** Cutting easy running while leaving a full-length quality session
in place is what would have raised the hard fraction. The two halves of this change protect each other,
which is why the sweep showed the floor holding at every point in it.

⚠️ **TWO FORMATS WERE MISLABELLED AND IT ONLY SURFACED HERE.** `vo2-mona` (38′) and `vo2-pyramid` (42′)
are both SHORTER than `vo2-10x1` (44′), which already carried `load: "small"` — they simply had no label.
It did not matter until a deload started preferring small formats: with only one small VO2 format, every
VO2 deload in a 35-week plan drew the identical session and `a long plan delivers real variety` failed at
6 appearances against a limit of 5. ⚠️ `vo2-hills-10x50m` is 39′ and is deliberately NOT labelled small —
hill sprints are the highest connective-tissue load in the library, which is not what a deload is for.

⚠️ **THE WORDING IS HALF THE FIX.** "Deload — recover and absorb training" is accurate and reads as the
plan going soft. It now says *"Absorb week — volume down, one hard session kept. This is where the work
lands"*, and the beginner track likewise. A runner who does not trust the easy week is the one who rides
through it and reaches the peak phase already tired.

**Measured, before → after:** mean deload cut **17.8% → 26.5%**; 5k **13.2% → 23.1%**, 10k 17.5% → 25.8%,
half 19.4% → 27.9%, marathon 20.4% → 28.8%. Taper unchanged (36.8%, 20.7–46.7). Week-one anchoring
unchanged at 88.5%. Easy floor unchanged at 2 of 19,200.

⚠️ **A STRUCTURAL QUIRK FOUND ON THE WAY, WORTH KNOWING.** When a deload takes a week from two quality
sessions to one it converts a quality day into an EASY day, so that week's easy MINUTES can rise even as
every run shortens (measured 108′ → 121′ on a 4-day peak deload). The week still cuts properly overall
because a whole quality session left it. `test/deload-depth.test.ts` therefore compares the easy column
only where the quality count is unchanged — scoping it by days-per-week was wrong, because a 4-day PEAK
week carries two quality sessions too.

⚠️ **THE DEPTH TEST'S THRESHOLD IS SET FROM MEASUREMENT.** On its own sweep the shallow version reads
18.8% and the deepened one 27.2%, so the bar sits at 0.22. It was first written at 0.18 — below the
shallow figure — and therefore passed on the very code it existed to reject. Re-break the fix and watch a
guard fail before believing it; that is now three tests in this session that needed it.
### ✅ FREQUENCY — the plan now OFFERS a running day (owner 2026-08-06, shipped)

The audit's frequency answer was "not progressed, by design — the runner picks their days". His reply:
*"the runner needs to adapt their frequency as an option… an alert at an appropriate time asking the
runner if they'd like to increase the number of days."* Adding a day is one of the strongest progressions
available, and the only way to get one was to edit your profile and rebuild the plan yourself.

**It lives in the WEEKLY REVIEW, not a new banner** — `addDayOffer` in `src/adapt/weekly-review.ts`, a new
`add-a-day` suggestion kind. That inherits everything already solved there: one question a week, the
answered-state store, `quiet` meaning show nothing, and the existing illness/taper refusals. A second
banner would have re-implemented all four and drifted from them.

⚠️ **IT IS LAST IN THE SUGGESTION ORDER.** A pace change is about work already done; a retest answers a
question about the runner now. This is about months from now and can wait a week. A test asserts a pace
decision displaces it.

⚠️ **ACCEPTING REWRITES EVERY WEEK AHEAD — his explicit instruction**: *"it does need to change the weeks
ahead; that's the whole point of the app. It adapts and changes based on the runner."* `applyAddDay` bumps
`profile.daysPerWeek` and goes through `recompute()` → `adoptPlan`, then `seedDone()`/`restoreTicks()`.
⚠️ Never assign PLAN by hand here: that is the documented trap that skips `normalizeWeekStarts` and leaves
iOS reminders and the watch holding the old schedule. Verified in the browser — weeks 6, 12 and 20 all
went from 4 running days to 5 on one tap.

**The gate is COMPLETION, and it is the whole feature:** 85%+ of prescribed runs actually logged over the
last three plan weeks. Someone missing sessions does not need a fourth day; they need the three they have.

**Every refusal, each a real one:** already at 6 days (⚠️ **the seventh is never offered automatically** —
that means no rest day at all, which the evidence report reserves for athletes with oversight); in a peak
or a taper; a beginner (their track is capped by design); returning from injury; unwell; fewer than 4
weeks on the plan; fewer than 6 weeks of block left; the flags engine already suggesting they ease off;
or declined within the last 8 weeks. ⚠️ **A "no" is remembered as a DATE** (`interun_addday_v1`) so it
cannot be re-asked tomorrow — declining is a first-class answer, per the standing instruction.

⚠️ **THE EVIDENCE BUILDER CALLED TWO FUNCTIONS THAT DO NOT EXIST**, and its `try/catch` swallowed the
ReferenceError — the offer would have shipped as a permanent no-op with nothing to see and nothing in the
console. `rawSessionsForWeek`/`isRunnableSession` were invented; the real ones are `RAW.weeks[i].sessions`
(PLAN.weeks is only a display summary) and `PRIMARY_TYPES`. The catch now logs. **A silent catch around
code you have just written is how a feature ships broken and gets reported as working.**

⚠️ **`CURRENT_WEEK` CANNOT BE FAKED BY SEEDING A PAST START DATE** — `applyProfile` clamps the start to
today (`pf.startDateIso >= todayIso()`), so a fresh profile is always in week 0 and the offer is
unreachable from the UI until four real weeks pass. The engine decision is unit-tested instead, and the
card/accept/decline path was exercised by patching `currentWeeklyReview`. ⚠️ Patching `RC.*` does NOT
work — esbuild exports are getters, so the assignment silently does nothing and the real function runs.

### ✅ FINDING 4 — the long-run inversion is a SHORT-RACE phenomenon, and the aggregate hid it

| distance | long run NOT the longest run of its week |
|---|---|
| 5k | **46.1%** |
| 10k | 23.2% |
| half | 3.8% |
| marathon | **0.0%** |

The headline figure quoted before this audit (30%, then 17.5%) is an average over distances and says
nothing useful. **Where it would actually matter it is already solved** — a marathon plan never does it,
a half almost never. What remains is 5 km and 10 km plans, where the "long run" is naturally modest and a
midweek threshold session can legitimately be longer. ⚠️ **Re-examine whether this is a defect at all for
those two distances before spending anything on it** — it may be correct coaching that was being measured
as a fault.

## THE COMMISSIONED ENGINE HANDOFF, MINED FOR IDEAS RATHER THAN PORTED (owner, 2026-08-27)

He attached `INTERUNENGINEHANDOFF.md` — a complete, self-contained **Swift** specification for a
programme engine (1,704 lines, 19 sections, 11 Swift files, 48 types, golden fixtures with real
verified numbers) — asked whether it had arrived intact, and then ruled: **"take the ideas not the
swift if we dont need it"**. The engine here is 10,800 lines of pure TypeScript with 1,348 passing
tests and is what his phone actually runs, so a Swift rewrite would have replaced the brain in a
different language on the far side of the WKWebView wall, and every change would then need an Xcode
build. Suite 1348 → **1361**; **18 deliberate re-breaks, all 18 caught** (three only after a guard
was restated — those three are below).

⚠️ **THE READ-ACROSS WAS 18 AGENTS OVER 9 AREAS, 133 VERIFIED CHECKS, AND 23 WERE REFUTED — ALMOST
ALL IN THE SAME WAY: THE VERDICT HELD AND THE NUMBERS DID NOT REPRODUCE.** Three verifiers
independently found the cause, and it was mine: **I started editing `src/` while the measurement
workflow was still running.** `paces.ts`, `types.ts`, `generate-plan.ts` and `session-templates.ts`
all changed under them, one watched `TID_TOLERANCE` flip 0.12 → 0.05 → 0.12, and one correctly
diagnosed a test I had just broken as contamination rather than a defect. This file already records
the mirror image (a subagent patching `src/` while tests ran); the rule is symmetric.
**Never edit the tree while a measurement is being taken against it.** Treat every figure from that
run as directional until re-measured.

### What the five rules measure at, against the real engine

⚠️ **RULE 1 IS ALREADY HONOURED IN SUBSTANCE, AND THAT SAVED THE LARGEST PIECE OF WORK IN THE
DOCUMENT.** The spec anchors every zone to a fraction of measured critical speed. Measured, the
engine's `PACE_RATIOS` **already are those fractions**, inverted:

| | spec (× CS) | engine (× its own anchor) |
|---|---|---|
| recovery ceiling | 0.70 | 0.667–0.735 |
| easy slow | 0.75 | **0.752** |
| easy fast | 0.82 | **0.820** |
| tempo / threshold | 0.96 | 0.952–0.976 |

And the anchor itself sits at a stable **95.7–96.1% of a fitted CS across every ability from a 14:00
to a 45:00 5 km** — which is exactly what the spec calls `threshold: p(0.96)`. The two models are one
model in two currencies, agreeing to ~4%; the engine's easy pace is 8–26 s/km *slower* than the
spec's, which is the safe direction.

⚠️ **AND PORTING THE CS ANCHOR IS MEASURABLY DANGEROUS, NOT MERELY UNNECESSARY.** `fitness-profile.ts`
records the objection at the rejection site — *"with two long efforts it underestimates and produces
a pace slower than the runner's 10k"* — and it reproduces exactly: a 10 km + half fit puts CS at
4:57/km, **27 s/km slower than that runner's own 10 km pace**.
⚠️ **THE SPEC'S OWN ELIGIBILITY WINDOW IS WHY, AND IT ALSO MAKES THE FEATURE UNREACHABLE HERE.** An
effort qualifies at 120–900 s, so **a 5 km time is eligible only at 15:00 or faster**. The app's two
stored efforts are a 5 km and an optional 2 km trial, so for every runner slower than that the spec's
`fit()` returns nil — and a 40:00 5 km runner has **zero** eligible efforts. The spec's intent is GPS
best efforts harvested from real runs, which this app records the data for and does not harvest.
⚠️ **`fitCriticalSpeed` IS THEREFORE COMPUTED AND DISCARDED**, and the verifier put it precisely: *"no
NUMBER from the model is ever shown in the shipped app"*. It is rendered on the standalone
`web/fitness.ts` page, which is **absent from `docs/`**. Its one live effect is a confidence flip that
changes a VO₂max range and removes a "Low confidence" pill.

⚠️ **RULE 2 — THE ENGINE'S OWN 0.68 FLOOR IS HONOURED; THE SPEC'S 0.75 IS NOT.** Measured over 18,384
non-race weeks: **468 (2.55%) under 75% easy, 1,968 (10.70%) under 80%, worst 67.6%.** The breaches
cluster in the **peak phase** (455 of 750 before the cap), which is where quality is deliberately
highest — so raising the floor means reducing peak-phase quality, a coaching decision and **not
done**. ⚠️ **AND THE EXISTING CHECK IS COMPARATIVE BY DESIGN**: `intensityProfile`/`noWorse` runs only
inside `if (scale < 1)` and asks *"did scaling down make this worse?"*, because — as its own comment
says — an absolute check would "correct" a plan that breached at its natural size back to that same
breaching plan.

⚠️ **RULE 3 IS VIOLABLE AND VIOLATED, AND THE ONE HELPER THAT KNOWS THE NUMBER HAS ZERO CALLERS.**
`assessWeeklyJump` compares the planned week to **last week** in **kilometres** and returns advisory
prose; it is not exported to the app bundle at all (`assessLongRunSpike` and `returnToRunningPlan`
are). Measured in minutes against the trailing four-week mean: **53 of 7,152 transitions (0.74%)
exceed 1.30, worst 1.427×.** Not enforced — reported.

⚠️ **RULE 4 IS HONOURED BY CONSTRUCTION, AND IS NOW GUARDED TWICE.** `ReadinessResult` is a band, a
score and four prose fields; it structurally cannot reach a pace. Nothing was checking that.

⚠️ **RULE 5 — SESSIONS ARE IN MINUTES, THE VOLUME MODEL IS IN KILOMETRES.** One stated 40 km/week,
half marathon, five days: **200 training minutes for a 15:00 5 km runner and 465 for a 40:00 one, a
2.32× spread.** Not changed: `weeklyVolumeKmCurrent` feeds a bisection fit, and CLAUDE.md already
records ~150 stored `distKm` references. ⚠️ `sessionLoad`/`weekLoad`/`rollingLoad` in
`src/science/training-load.ts` are a minutes-based model with **zero callers**.

### THE THREE IDEAS TAKEN, each chosen because a MEASUREMENT wanted it

⚠️⚠️ **1. THE QUALITY-SESSION COST CAP — `QUALITY_WORK_CAP_SEC`, and the defect it caught is the worst
thing this audit found.** A 40:00 5 km runner training three days a week for a half marathon was
handed **"Ladder: 1–2–3–4–3–2–1 km / equal jog" as 176 minutes** — 16 km of work plus 16 km of jog at
about 10:30/km, as one of that week's three runs, and **longer than their own long run**. That single
session put the week **1.55× over its trailing four-week mean** and dropped it to **66% easy**,
breaching the progression guardrail and the intensity floor at once. A hand-authored format has a
fixed structure, so its cost in MINUTES is whatever the runner's own pace makes it.
- ⚠️ **IT REFUSES A FORMAT; IT NEVER TRUNCATES ONE.** Shedding reps would deliver 1–2–3–4 under a
  title promising 1–2–3–4–3–2–1, and a title that lies is a defect this file guards elsewhere. The
  pool is filtered — the mechanism `selectFormat` already uses for every other constraint.
- ⚠️ **AND THE COST FILTER DOES NOT USE `narrow`.** Every filter above it means "not appropriate
  here", where falling back to the wider list is right. A format that would take this runner two and
  a half hours is not merely inappropriate, so where nothing qualifies the **cheapest** is taken.
- ⚠️ **70 MINUTES IS MEASURED AND ALSO PRINCIPLED.** The full table is in the code. 70 is where the
  worst week stops improving (below it the figure oscillates around 66–67%, because what remains is
  structural); at 60 the slowest runner loses a third of the library, which trades an absurd session
  for a monotonous block. It is also the spec's own arithmetic — a cruise-threshold session capped at
  60 minutes of work lands near 70 with short recoveries.
- **Measured:** quality sessions over 90 minutes **44 of 20,105 → 0**; over 40% of their week
  **2 → 0**; rule 3 breaches **94 → 53**, worst **1.549× → 1.427×**; rule 2 breaches **635 → 468**,
  worst **61.4% → 67.6%**. The mean quality session is **unchanged at 26–33 minutes** across every
  ability, and a 15:00 runner's longest is unchanged at 67 minutes — the fast end is untouched.

⚠️ **2. THE MARATHON ENDURANCE CORRECTION — and the harm compounds, which is why it was worth fixing
rather than caveating.** Riegel over-predicts the marathon for roughly half of recreational runners.
A predicted time is not only a number on a screen: **a blank goal is derived with plain Riegel**
(`web/app.ts:20158`), becomes `goal.targetTimeSeconds`, becomes `paces.goalRace`, and becomes the pace
band of every "block at marathon effort" step in the block. Measured on a real 20-week plan, the
uncorrected chain prescribes race-pace work **16 s/km too fast for a 20:00 5 km runner and 29 s/km
too fast for a 35:00 one** — so the runner rehearses a pace they cannot hold, and `runAnalysis` then
judges them against a band that was never achievable.
- ⚠️ **KEYED ON TRAINING, NOT ABILITY.** A fast runner on low mileage is exactly as over-predicted as
  a slow one; what protects you at 42 km is the volume and the long runs.
- ⚠️ **SEPARATE FROM `predictRaceTime`, WHICH IS UNCHANGED.** That function is pure in one argument
  and is called from a dozen places holding no training context; giving it a context it must guess
  would mean guessing +6% for a 120 km/week runner. The corrected form is opt-in, and an identity
  below 30 km and without a context — both swept over the real distance table.

⚠️ **3. THE PLYOMETRIC DOSE, AND THE LOAD AS DATA.** `2 × 8–10` pogo hops plus `2 × 3–5` box jumps is
**22–30 ground contacts per session**, and a build week carries two of them — so **44–60 a week**
against the handoff's 60–100 (developing) and 100–150 (trained). From the same evidence the session's
own description already cited: 31 studies, 652 runners, heavy lifting alone ES −0.47 and heavy
**combined with plyometrics ES −1.04**, the best-evidenced strength intervention there is for runners.
Now `PLYO_DOSE` by experience: **45 contacts/session developing and 72 trained → 90 and 144 a week**,
both inside band. `loadPercent1RM` and `contacts` are fields on `StrengthExercise`.
⚠️ **AND MY FIRST WRITE-UP OF THIS COMPARED A PER-SESSION FIGURE TO A PER-WEEK BAND** — "22–30 against
60–150" — which overstated the gap as roughly threefold when measured end to end it is 60 → 90 for a
developing runner and 60 → 144 for a trained one. The old dose sat AT the bottom edge of the lower
band and at 40% of the upper one; it was not a third of either. Measured through two real 20-week
plans, not from the table. **State which currency a dose is in, every time.**
- ⚠️ Base stays plyo-free and maintenance weeks stay plyo-free — the repo's own reasoning, unchanged.
- ⚠️ The load is claimed only where it is meant: `80%+` heavy and in maintenance, `70–75%` in a
  technique phase, and absent from holds and jumps where a %1RM is meaningless.

### ⚠️⚠️ AND I SHIPPED THE MARATHON CORRECTION WIRED TO NOTHING

It was written, typechecked, unit-tested across every distance, re-broken four times, documented in
this file, pushed to `main` and reported to the owner as fixed — and **nothing called it.** `grep`
for `predictRaceTimeWithEndurance` outside its own module and its own test returned nothing. Every
guard I had written passed against a function no plan could reach, because they all asked *does this
work* and none asked *does anything use it*. **Sixth firing of the computed-and-discarded trap**
(`CLASS`, `MASTERS`, `PLAN.notes`, `refreshTypePreview`, `assessWeeklyJump`), and the first where I
both introduced it and announced it as delivered.

Now wired, and the wiring is the guarded part: `deriveGoalTimeSeconds` is the engine's one derivation,
exported through `web/entry.ts`, reached by exactly one helper in `web/app.ts`, called from **both**
blank-goal branches — and no branch may assign `Math.round(RC.riegelPredict(...))` to a target again.
⚠️ **`assessFeasibility` HAD TO CORRECT TOO, OR THE APP HOLDS TWO OPINIONS ABOUT ONE MARATHON**: it
would have set a runner a 4:14 target and then told them their current fitness predicts 3:59, fifteen
minutes ahead of a goal it chose for them.
⚠️ **AND `longestRunMinutes` BECAME OPTIONAL, BECAUSE ABSENCE IS NOT ZERO.** At setup there is no
logged history, so treating "not asked yet" as "their longest run is nothing" put a 120 km/week runner
in the +6% band — over-correcting the exact runner the correction exists to leave alone. Absent reads
volume alone; a KNOWN short long run still holds them in the middle band.

**The rule this cost: a test that a thing WORKS is not a test that anything USES it.** Every port in
this chapter now has a reachability guard, and it is the first assertion in the file rather than an
afterthought.

### FIVE INSTRUMENT FAULTS, ALL MINE, EACH PRODUCING A CONFIDENT WRONG NUMBER

⚠️⚠️ **THERE IS NO `weeks` OPTION ON `generatePlan`.** `GenerateOptions` is
`{ intensityModel?, startDateIso? }` and nothing else, so a probe passing `{ weeks: 16 }` has it
silently ignored and the runway comes from `goal.raceDateIso`. **My five-runway sweep therefore built
the same 40-week plan five times** — a fifth of the grid was real. The tell was every runway reporting
an identical breach count (147, 147, 147, 147, 147) and I read it without questioning it. Set the race
date from the runway, and assert the plan came back the length asked for.

⚠️⚠️ **THERE IS NO `isPartial` FIELD ON `PlannedWeek` EITHER.** `!w.isPartial` is `!undefined` —
always true — so every `filter((w) => !w.isPartial)` filtered **nothing**. tsc caught it in the test
file; a `.mjs` probe has no typechecking and would not have. The protection that actually works is
starting the plan on a **Monday**, because `applyPartialFirstWeek` trims week 1 before the start date
and there is nothing to trim when the start date is the week's Monday.

⚠️ **RULE 3 NEEDS A FULL FOUR-WEEK WINDOW OR IT MEASURES THE OPENING RAMP.** The rule is about the
ATHLETE's trailing four-week mean, i.e. their real history; inside a fresh plan weeks 1–3 have none.
Measured with short windows allowed: **315 breaches, worst 1.897× at WEEK 2** — which compared week 2
against week 1 alone. Windowed properly: **94, worst 1.549×**. A fifth of what I first reported.

⚠️ **A PROBE THAT CLAMPS ITS OWN INPUT DESTROYS ITS OWN FIT.** My first CS comparison clamped the
longer effort to 2700 s, which wrecked the slope for slow runners and printed a `thresh/CS` ratio
falling from 0.999 to 0.362 down the ability range. It read exactly like a model that falls apart.

⚠️ **A `deepEqual` AGAINST THE OBJECT'S OWN FILTERED KEYS CANNOT FAIL.** My readiness guard compared
`Object.keys(r)` against a list **filtered by `k in r`** — the asserting-a-value-against-itself trap,
in the one check written to stop a `suggestedPaceSecPerKm` appearing.

### THREE GUARD WEAKNESSES, FOUND BY RE-BREAKING

⚠️⚠️ **A GUARD THAT SCALES WITH THE CONSTANT IT GUARDS IS NOT ONE.** `worst <= QUALITY_WORK_CAP_SEC`
passed with the cap raised to 200 minutes, which let the original 176-minute ladder straight back in.
There is now an absolute `EVIDENCED_CEILING_SEC` alongside it, set from the recorded sweep rather than
from the shipped value.

⚠️⚠️ **A TYPE-ONLY FIELD IS INVISIBLE TO A VALUE-LEVEL GUARD.** Adding `suggestedPaceSecPerKm?: number`
to `ReadinessResult` passed every runtime check, because an optional field nothing assigns never
appears on the object. A type is a promise about what the loop MAY return, and rule 4 is about what it
may return — so the declaration has its own guard, parsed out of the source.

⚠️ **AND A RE-BREAK ANCHOR MUST MATCH THE REAL CHARACTERS.** One escape was `"70-75%"` against a
source containing `"70–75%"` — an en dash. The harness reports a non-unique or absent anchor as
**ANCHOR NOT UNIQUE** rather than as a verdict, which is what stopped it reading as an escape.

### The seven-day test, restated rather than relaxed

⚠️ **`km(7) > km(6)` WAS PASSING ON A 0.7 KM MARGIN — 1% — IN THE WRONG CURRENCY.** The cap shifted a
format rotation and it went red. Swept over 32 configurations the claim is true in **28 of 32 in
kilometres (worst ratio 0.967)** and **32 of 32 in minutes (worst 1.000)**, so it was never reliably
true in km and the fixture had picked one of the 28. Restated on minutes, plus the honest mechanism:
for a runner already at `LONG_CEILING_MIN` and the 95-minute easy cap a seventh day **redistributes**
(−0.27 min at a 17:00 5 km) while for a slower one it genuinely adds (**+17.9 min at 30:00**). What the
engine guarantees is more RUNS and no materially less time, and a third assertion requires the day to
add real time off the ceilings — so a regression making it cosmetic for everybody fails.

### Deliberately NOT ported, with the reason

| spec idea | why not |
|---|---|
| CS as the prescribing anchor, D′ interval model, eligibility gate | already honoured to ~4%; the gate returns nil for everyone slower than a 15:00 5 km, and re-anchoring is measurably dangerous |
| T0–T5 tiers, `TierConstants`, `AthleteState` | a reorganisation of what `experience` + `daysPerWeek` + `volKm` already do; needs `weeksInjuryFree`, a real training age and observed weekly history the app does not collect |
| Volume in minutes; observed-load-driven ramp | architectural; ~150 stored `distKm` references, and the engine's ramp is destination-based rather than incremental so the spec's defect 1 cannot occur here |
| Raising the easy floor to 0.75 | 468 weeks, structural in the peak phase — a coaching decision, his to make |
| 1.30 as a refusal | 53 transitions; needs a trailing-mean denominator the generator does not have |
| Distribution sequencing pyramidal → polarised | the spec grades it **Emerging** and says to put Emerging behind a flag |
| VO2 reps of 3–5 min | **Emerging**, and measured 50% of VO2 work sits in 60–119 s reps across 1,064 sessions — real, but it is 29 formats with variety guards over them |
| Strides twice a week | measured **6 sessions in 17 weeks**, clustered in weeks 1–2 and 9–10 — real and cheap, but it pins an easy day and removes it from an 8-format rotation |
| Taper holding intensity | measured **0 of 120 taper weeks carry threshold or race-specific work** — `taperSession` is hardcoded to `vo2-10x1` for every distance, which makes taper.ts's own notes false as delivered. **The biggest unported finding.** |
| Masters ramp and spacing | `assessMasters` returns `minEasyDaysBetweenQuality` and it is **read nowhere**; `Athlete` has no `age`, so the generator is structurally age-blind |
| Foster monotony, non-responder protocol, readiness actions, ACWR | absent by decision, or Convention-grade with no mechanism to act on them |

⚠️ **THE SPEC CONFLATES HILL REPS WITH HILL SPRINTS, and this repo is right.** It calls hills "the SAFE
way to introduce intensity below T3" because gradient caps velocity; CLAUDE.md calls hill sprints "the
highest connective-tissue load in the library" and withholds them from returning runners. A 60-second
submaximal hill rep and a 10-second maximal sprint are different sessions. Do not reconcile them.

⚠️ **`tools/audit-five-rules.mjs` IS THE REPRODUCIBLE INSTRUMENT** for all of the above, and its two
recorded instrument faults are in its own comments so the next reader does not repeat them.

## THE TAPER NOW HOLDS ITS SPECIFICITY, NOT JUST A HARD SESSION (owner, 2026-08-27)

The biggest thing the engine-handoff read-across found, and he asked for it next. Suite 1363 →
**1369**; **9 deliberate re-breaks, all 9 caught** (one only after the guard was made bidirectional —
that one is the useful half).

⚠️⚠️ **THE DEFECT WAS A WRITTEN PROMISE THE CODE DID NOT KEEP.** `qualityContentsFor`'s taper branch
was `out.push(taperSession(p))` — and `taperSession` is `formatById(VO2_FORMATS, "vo2-10x1")`, one
hardcoded format for every distance. So a marathon runner who had spent a whole block building
goal-pace work was handed **one-minute VO2 reps for their final three weeks**, while
`src/science/taper.ts`'s own notes promised *"keep marathon-pace touches"* and *"hold threshold
intensity"*. Measured with the engine's own `computeDistribution` over a 20-week block: **0 of 120
taper weeks contained any threshold or race-specific work, and 120 of 120 contained VO2.**

A marathon runner's final fortnight, before → after:

| | before | after |
|---|---|---|
| taper wk 1 | `10 × 1′ hard / 1′ easy` | **`3 × 10′ at goal race pace / 2′ jog`** |
| taper wk 2 | `10 × 1′ hard / 1′ easy` | **`Goal-pace cut-down: 3 km – 2 km – 1 km / 3′ jog`** |
| race week | `10 × 1′ hard / 1′ easy` | `10 × 1′ hard / 1′ easy` — unchanged, and deliberately |

⚠️ **THE TAPER NOW DRAWS WHAT THE PEAK PHASE WOULD HAVE DRAWN, AT A REDUCED DOSE**, which is what
"hold the specificity" means: `raceSpecificSession` for the half and marathon, a small `vo2Session`
for 5 km and 10 km. **The short-event exclusion is the point, not an omission** — for those events
`paces.goalRace` sits on top of threshold/VO2, so goal pace IS the interval work, and "3 × 10′ at
goal race pace" would be thirty minutes at 5 km pace: longer than the race, and the identical
unrunnable prescription this file already records removing from short-event long runs.

⚠️ **THE POOL IS NAMED `phase: "peak"` EXPLICITLY, AND NOT LEFT TO A FALLBACK.** No quality format
lists `"taper"` in its `phases`, so a `phase: "taper"` filter empties the list and `narrow` silently
hands back the **whole pool — big formats included**. Asking for the peak's pool is both what holding
the specificity means and the only way the size preference below it can bind at all.

⚠️ **`isDeload: true` IS THE DOSE LEVER, AND `avoidBig` WAS MEASURED AND REJECTED.** Measured on the
spec's own quantity (Z5–Z7, i.e. this engine's `hard` bucket) against a 5 km peak week's 25 hard
minutes: `isDeload` delivers 10 (41% of peak), `avoidBig` delivers 15 (61%). Both sit in or near the
handoff's 35–60% window, and `avoidBig` cost every distance 2–6 points of delivered volume cut on top
of what the specificity fix already cost. A taper's job is freshness, and `isDeload` carries the
reasoning already written down for the deload — *the runner still gets a genuine session at the same
intensity, it is simply short.*

⚠️ **RACE WEEK KEEPS `taperSession`, FOR THREE SEPARATE REASONS.** It is the smallest dose, which is
the progressive shape the evidence asks for rather than a step; it is chosen **by id** rather than by
a rotation index, because it used to be `vo2Session(p, 3)` and inserting any format above index 3
silently changed the race-week session of every plan ever generated — race week is the worst possible
week for a surprise; and `test/session-library.test.ts` pins that by-id guarantee, so keeping a real
caller stops the guard being orphaned.

### ⚠️⚠️ HOLDING THE QUALITY COSTS VOLUME CUT, AND THE EVIDENCE SAYS WHERE TO TAKE IT FROM

A session drawn from the peak's pool is bigger than the `vo2-10x1` it replaced — about **24 extra
minutes** for a half — so the delivered cut shrank and **the half fell to 29.1% against the 30% floor
`test/generate-plan.test.ts` asserts.** The taper meta-analysis resolves the tension explicitly
rather than leaving it: volume falls 41–60% *while frequency and intensity are maintained*, and **"the
volume cut comes entirely out of Z1–Z3"**. So the easy and long runs give way. Swept on the test's own
fixture, last full taper week:

| | 0.72 | 0.70 | 0.68 | 0.66 | 0.64 | 0.62 | 0.60 | 0.58 |
|---|---|---|---|---|---|---|---|---|
| 5k | | | | 32.2% | | **35.7%** | 37.4% | 39.1% |
| 10k | **34.7%** | | 37.2% | 39.2% | 40.7% | | | |
| half | | 29.1% | | 32.1% | **33.3%** | 35.5% | | |
| marathon | | | | 31.9% (0.65) | | **34.5%** | 36.3% | 38.0% |

**5k 0.66 → 0.62, half 0.70 → 0.64, marathon 0.65 → 0.62. The 10k is deliberately unchanged** at 0.72,
because it already delivers 34.7% and deepening it would be a change with no defect behind it.

⚠️ **THE PICK IS THE SHALLOWEST VALUE CLEARING 33% THAT IS STILL SHALLOWER THAN RACE WEEK, AND BOTH
HALVES MATTER.** 33% is the 30% floor plus three points, for the reason already recorded in this file
about 0.4 points of headroom being one keystroke from somebody relaxing the floor instead. And a
lead-in deepened past its own race-week multiplier makes the taper **flat**, which is the "step" shape
the meta-analysis found worse than a progressive one (SMD −0.51) — the 5k at 0.58 would have tied its
race week exactly, which is why it is 0.62.

### ⚠️⚠️ I MADE THE EXACT MEASUREMENT MISTAKE THIS FILE ALREADY DOCUMENTS

My first probe read **step-level `targetRpe`** and reported the pre-race taper weeks as carrying
**0 minutes** of non-easy running — about weeks that plainly contain a VO2 session. Quality reps carry
no step RPE: the SESSION carries `{min:8,max:9}` and every rep carries nothing. That is instrument
fault 1 from the 2026-08-06 progression audit, recorded in this file in as many words — *"intensity
read ~2% everywhere and the taper read 0.0% hard, which would have been reported as 'the taper throws
away all intensity'"* — and it is precisely what I would have reported. **Use
`computeDistribution`; never roll a second definition.**

⚠️ **AND MY DEPTH PROBE USED A DIFFERENT RUNNER FROM THE TEST'S OWN FIXTURE**, so it reported all four
distances passing while the test failed on the half. The fixture is a 1260 s recreational runner with
`returningFromInjury` overridden to false; I had used an 1100 s competitive one. Read the fixture.

### The notes now state the delivered cut, and race week's figure was unobservable

⚠️ **THE PERCENTAGES IN taper.ts's NOTES DESCRIBED THE MULTIPLIER, NOT THE WEEK.** They quoted
`1 − 0.72 = "~28%"`, which is not what the week falls by, because the multiplier reaches only the easy
and long runs while the quality session keeps its own length — measured, the 10k's 0.72 delivers
**35%**. Worse, the second figure was of a quantity nobody can observe: **race week contains the
race**, so its `plannedDistanceMeters` includes 21.1 km or 42.2 km of it, and the half's race week
reads a 28% cut while the marathon's reads **−0%**. A note promising "~45%" there was describing
nothing. The notes now state the delivered cut for the weeks **before** race week and say nothing
about race week's size, which is the race.

### The guard, and the weakness that made it bidirectional

`test/taper-holds-intensity.test.ts`, six guards. The load-bearing one **derives its claim from the
note's own words** rather than a hand-written table, so rewording a promise without delivering it
fails.

⚠️⚠️ **AND A GUARD THAT "THE PROMISE IS KEPT" CAN BE SATISFIED BY DELETING THE PROMISE.** Watched
escaping: removing *"keep marathon-pace touches"* from the marathon's note passed every assertion,
because there was then nothing to check. That is the drift in its quietest form — the behaviour and
the description parting company by dropping the description. The guard is bidirectional now: the note
must MAKE a specificity claim, the claim must be delivered, and whatever is delivered must be named.

⚠️ **"threshold/VO2" IS A DISJUNCTION AND MY FIRST GUARD READ IT AS A CONJUNCTION.** The 10k's note
says *"keep threshold/VO2 intensity"*, which either kind of work satisfies; demanding threshold there
failed on correct code and would have pushed the fix towards giving a 10 km runner a threshold session
in race week for the sake of a slash in a sentence.

⚠️ **AND THE HALF'S NOTE IS SATISFIED IN SUBSTANCE RATHER THAN BY A LABEL.** For a half, goal pace
sits **5–8 s/km slower than threshold and the two bands overlap** (measured across abilities: 4:19–4:25
against 4:11–4:24 for a 20:00 5 km runner), so a goal-pace session IS a threshold session in all but
name. For a **marathon** the two are 20 s/km apart and genuinely different gears, which is why that
note names marathon pace instead. Requiring a session literally typed `threshold` would fail on
correct code for the half.

⚠️ **TWO MORE OF MY OWN GUARDS WERE OVER-SPECIFIED AND FAILED ON CORRECT CODE.** "The taper is
progressive" asserted the pre-race SESSION must be no smaller than race week's — but the 10k's
pre-race session is a 38-minute Mona fartlek against race week's 44-minute `10 × 1′`, so the session
grows while the week falls, and both are fine. The progression is about the WEEK's volume, which the
multipliers carry and which is asserted separately. And a sweep bar written at `> 100` failed at 72,
because one or two taper weeks per plan is simply what a plan has — **widening the grid is the fix,
not lowering the bar**, since a sweep that only just clears its own floor is one change from proving
nothing.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1369 pass /
0 fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, five-rule audit unchanged or
better (rule 3 transitions 53 → 50), both design ratchets unchanged.
