# Heat adaptation, and the field findings of 2026-08-20

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## FOUR FIELD FINDINGS, AND THE FOUR MECHANISMS A COLD SESSION MUST NOT DELETE (2026-08-20)

The owner field-tested the over-the-air build and reported four things. Every fix is web-only except
where marked, so all of it reaches his phone on the next launch. Suite 1019 → **1027**.

⚠️ **THE FIRST ROUND OF FIXES WENT IN WITH CLAUDE.md AND THE ROAD MAP UNTOUCHED, AND THAT WAS RAISED AS
A BLOCKER RATHER THAN A TIDY-UP.** Three agents each disclosed skipping it on the reasoning that the
shared files were outside their lane, so nobody did it — which is how four new mechanisms nearly
entered the codebase with no record, including two a reader would delete on sight because they look
redundant. The owner's standing instruction (2026-07-29) is that the Road Map is updated **every time a
milestone lands**, in plain English, ticking only what is verifiably done. `docs/roadmap/index.html` is
HAND-WRITTEN — never generated — and its figures are guarded by `test/release-gate-figures.test.ts`,
which derives them rather than trusting a typed copy.

### FINDING 1 — the distance recorded while the screen is off (`pc-lockdist`)

Walked ~0.19 km, credited **0.28 km (+46%)**; current pace correct at 11:37 from Doppler while the
average read 8:03; and *"Ease back — you're ahead of easy pace"* at 0:00 to somebody **walking**.
Measured on a 20-minute lock: **+85.1% → −0.4%**, with a never-locked control unchanged (−2.0 to
−2.6%), a genuine tunnel still filled (129/321/861/1761 m), splits no longer collapsing to zero, a
1 km session completing at **1014 m instead of 720**, and wrong-direction cues 3 → 0.

⚠️ **THE STEP COUNTER AND GPS WERE BOTH PAID FOR THE SAME GROUND, AND THE FIX IS A TAB WITH A TIME
BOUND ON IT.** `LIVE.pedoPaid` is the running balance and **`LIVE.pedoUntil` is the moment its billing
reaches up to**; a fix whose interval BEGINS after that watermark is covering new ground, so whatever
is still owing is written off. ⚠️ **THE TIME BOUND IS THE HALF THAT WOULD BE DELETED AS REDUNDANT, AND
IT IS WORTH 17 POINTS.** Unbounded, a lap has a chord of nearly zero so no fix can ever pay the debt
and it follows the runner into honest ground: measured on a 360° loop through a one-minute blackout,
**−26.6% against −9.9%**, and the honest minute afterwards credited **51 m of 180 against 171 of 180**.
On every straight lock, control, tunnel and treadmill row the two are identical, so the bound costs
nothing and removes that.

⚠️ **`PedometerService.swift` IS DELIBERATELY UNGATED ON APPLICATION STATE, AND A GUARD ASSERTS IT STAYS
THAT WAY.** The asymmetry (Swift keeps counting while the page is frozen) is the root cause, and closing
it there would take the pedometer away from the one case only it can serve — a POCKETED phone in a
tunnel, where the screen is off AND there are no fixes to buffer. The page owns the fusion: Swift
reports, the page decides.

⚠️ **`pedoDiagLine`'s `settled` / `written off` PAIR IS THE WHOLE HARDWARE TEST, AND IT IS THE ONLY THING
THAT CAN SETTLE THE DIAGNOSIS.** `settled ≈ filled` means GPS was never dark and our own buffer was
holding the fixes; `settled ≈ 0` means the gap was genuine. `filled` alone is structurally unable to
separate a gap filler that did nothing from one that did it twice. Ask him to read it after a locked run.

⚠️ **THE PACE WINDOW IS A WINDOW OVER *CREDIT* EVENTS, NOT OVER TICKS.** `currentGpsPace` divided a
QUANTISED numerator by a TICK-ALIGNED denominator — distance arrives one leash (10–14 m) at a time
while the far end advanced every 250 ms — so the two described different stretches of ground.
`paceMark()` is called from `onGpsPos` AND from `pedoFillGap`, `gpsUiTick` trims but no longer feeds.
⚠️ **THE PRE-EXISTING PACE DEFECT WAS FAR BIGGER THAN THE LOCK.** On a HEALTHY ten-minute run with no
lock and no Doppler, a runner dead on target was told to ease back **59 of 80 times** → 1 of 5.

⚠️⚠️ **AND A FABRICATED 2:36/km WAS BEING READ OUT AT WALKING PACE, AT THE END OF EVERY LONG LOCK —
FOUND BY THE INDEPENDENT PASS, ON THE OWNER'S OWN MEASURED SPEED.** A settlement is a correction to a
TOTAL, not movement over the window's own interval, and marking it as one fabricates speed. Traced on a
walker through a two-minute dark tunnel: the window read **714 s/km throughout the blackout** (correct,
fed by the pedometer) and then **276 / 260 / 243 / 225 / 205 / 183 / 159 s/km** over the six seconds
after it — 25.8 m of honest correction divided by a five-second span. `if (settle > 0) LIVE.win.length = 0`
resets it, so the derivation restarts from the corrected total: one second of "—" instead of six of
arithmetic on a lump. **Measured over 43 cases: eight wrong-direction cues removed, two added** (a
60-second dark tunnel at 3 m/s and a 270° bend through one, where the shorter baseline left after the
reset makes a later lump more visible). Reported, not buried.

### FINDING 2 — the long run was not the longest run of the week (`pc-longshort`)

The owner: *"the long run is meant to be the longest run of the week"*. What is implemented is **the
long run is the longest EASY run of its week**, on the clock AND on the ground.
`enforceLongRunIsLongest` is a POST-CONDITION over the built weeks, rebuilding a week through the SAME `buildOne` closure (a second
assembly path is the fix-one-builder-not-the-other trap). Inversion **25.61% → 0.00% on minutes, 27.79%
→ 0.00% on shown km, 27.79% → 0.00% on counted km**, over 3,600 plans / 85,200 weeks with a long run.
His own plan's weeks 1–4 were inverted and are clean; weeks 5–14 byte-identical.

⚠️ **THE INVARIANT IS ABOUT THE EASY RUNS, NOT EVERY RUN, AND THAT IS STILL AN OPEN DECISION FOR HIM.**
A threshold session comes out of the library at a fixed length with a warm-up and cool-down on top and
cannot move. Measured after the fix, a quality session is still the biggest thing in its week in
**7.90% of weeks on minutes and 13.01% on distance, and in EVERY remaining case the offender is a
quality session — zero easy, recovery or strides runs** (before: easy 38,433 · recovery 12,184 ·
strides 3,814). His own 50-minute tempo is therefore still bigger than his long run, deliberately.

⚠️⚠️ **`LONG_LIFT_STEP_MAX` (1.10) EXISTS BECAUSE THE FIRST VERSION BUILT A JUMP TAIL THAT HAD NEVER
EXISTED, AND THE AGGREGATE IMPROVED WHILE IT DID — WHICH IS EXACTLY HOW A TAIL HIDES.** Transitions over
the evidence report's 1.10 guardrail went **6.22% → 4.78%** while the >1.25 bucket went **0 → 33** and
the worst transition **1.2250 → 1.3220**. Frontier measured at 999/1.30/1.25/1.20/1.15/1.10/1.05: the
invariant is **0.00% on all three rulers at every value** (the belt absorbs the clamp), the easy floor
is **34 weeks of 18,624 at every value** by the repo's own `tools/audit-progression.mjs`, every clamp
from 1.20 down removes the whole new tail, and 1.10 is also the best point on the aggregate (4.12%).
Cost: **0.011% of the block's easy minutes.**
⚠️ **IT CLAMPS THE LIFT, NOT THE LONG RUN** — `Math.max(natural, prev × step)` — so the achievable worst
case is bounded below by the unfixed engine's own **1.2250**, not by 1.10. Those transitions come off the
ramp itself and off spanning a deload, and they are pre-existing.
⚠️ **MEASURED AGAINST THE PREVIOUS NON-EASED WEEK, WHICH IS NOT THE PREVIOUS WEEK.** The worst jump
spanned a deload (week 3 → week 5), so a clamp looking one week back measures against the eased week and
lets the whole tail through.

⚠️⚠️ **THREE AGENTS REPORTED 1.23x, 1.3038x AND 1.3220x FOR THE SAME BUILD AND ALL THREE WERE RIGHT
ABOUT DIFFERENT TRANSITIONS.** There are two defensible definitions of a week-on-week long-run jump and
the answer differs by a fifth:

| | ADJACENT (pairs touching an eased week skipped) | SPANNING (consecutive non-eased weeks) |
|---|---|---|
| base, unfixed | 1.0698 (0 over 1.10) | 1.1250 (312 over 1.10, 0 over 1.15) |
| fix, unclamped | 1.2250 (142 over 1.10, 30 over 1.15) | 1.3585 (450 over 1.10, 59 over 1.15, 9 over 1.25) |
| fix, clamped 1.10 | **1.1001** (5 over 1.10) | **1.1250** (235 over 1.10, 0 over 1.15) |

The SPANNING one is what the runner meets. `test/long-run-longest.test.ts`'s "the long-run ladder never
steps backwards" measures ADJACENT ONLY and is structurally unable to see the tail; its own comment used
to claim "1.23x after" on that basis. **Both are now measured, named, and guarded, and the constant is
asserted separately so LOOSENING it fails even on a grid that never reaches the tail.**

⚠️ **THE TWO DISCLOSED COSTS, RECONCILED.** `LONG_CAP_KM` overshoots were reported as 230 → 261, then
345 → 349, and measure **225 → 253** here. The reproducible figures are the ones independent of the
grid: the **worst overshoot is identical at +9.5%**, the longest long run per distance is identical to
three decimals, and `LONG_ABS_CEILING_MIN` breaches stay at 0 — the lift puts more plans into a pocket
that already existed (`peakLong` takes `max(longFloorMin, …)` OUTSIDE the cap). Quote a count only with
its grid. The second cost reproduces exactly: the biggest week sits in build or peak in **98.2% → 96.9%**
of plans. Week one lands within 1.10× stated in **99.96% → 99.33%** with the worst case identical to the
unclamped fix at 1.190× — four plans of 2,400, and the mechanism is the volume fit's own bisection
(3% tolerance) landing on a neighbouring fixed point, not the clamp.

⚠️⚠️ **AND `targetTimeSeconds` IS REQUIRED, SO A PROBE THAT OMITS IT REPORTS A PRODUCT DEFECT THAT DOES
NOT EXIST.** Mine did, and it read as a real fault: 5,280 weeks "inverting on distance" after the fix,
because `paces.goalRace` comes back with null bounds and every distance-derived race-pace step becomes
unmeasurable — so **7,890 of 85,200 long runs (9.26%) carried `estimatedDistanceMeters: 0`**, identical
in both trees, all of them half and marathon "fast finish" / "progressive" formats. With a valid goal:
**0 of 85,200.** CLAUDE.md already records this trap; it fired again anyway. Check the argument shape
before believing a sweep that disagrees with a green test — and the same trap fired a second time in
this phase when a probe typed the `LONG_CAP_KM` / `LONG_FLOOR_KM` tables from memory and got four of
eight numbers wrong. **Copy the engine's tables from the source.**

### FINDING 3 — a custom easy run was a MODERATE run (`pc-customgear`)

`sessionLibrary()` took the FIRST session of each type walked over `RAW.weeks`, and `SessionType "easy"`
covers four gears — a plain easy run, a **moderate** run (typed easy deliberately for the intensity
accounting), an easy→moderate progression, and a beginner run–walk. So the representative
`buildCustomSession` cloned was a coin toss. `REP_GEAR` + `repScore(s, want)` choose it by FITNESS FOR
THE LABEL (longest paced body step at the named gear +4; nothing else mixed in +2, counting UNPACED work
against it; every piece of work carries a band +1), ties keeping plan order so it can only replace a
worse candidate and never returns null. Quality types are deliberately absent and keep first-match.
Measured across 640 plans: at the named gear **62.5% → 100.0%**; the owner's 25:00 anchor was being
handed a band **29–41 s/km too fast** and labelled *"Moderate — quicker than easy, still comfortable"*.

⚠️ **THE SAME DEFECT WAS ON "Easy + Strides" AND NOBODY REPORTED IT: 320 of 320 plans delivered easy +
maximal HILL SPRINTS.** The discriminator is structural, not a label grep — relaxed strides run at
repetition pace, hill sprints carry NO pace by design. That is the +1 term.
⚠️ **THE AXIS THAT EXPOSES IT IS THE START DAY OF THE WEEK.** With a Monday start, **0 of 1,728** plans
put a moderate run first; adding mid-week starts, **1,440 of 5,760 (25.0%)** do — `applyPartialFirstWeek`
trims week 1 before the start date, and the web layer defaults the start to TODAY. A fixture of Monday
starts is a fixture that cannot see this, and the whole finding-5 test file passed with the fix reverted
until mid-week starts were added.
⚠️ **A logged run keeps its old snapshot, by design** (`run.steps` is a snapshot, not a lookup).

### FINDING 4 — heat never reached a custom session (`pc-heatcustom`)

There was **no code path in the app that could write a heat decision for a run the runner added**.
`heatApplied` is gated on a DECISION, and the only writer resolved its session through
`heatTargetSession`, which read `rawSessionsForIso` and never consulted `EXTRA` — so on the holiday this
came from (Rhodes, 33 °C), where the run is one added on a day the plan has nothing on, it was silent by
construction.
Measured: `heatTargetSession() → null`, `heatCard() → ""`, while `assessConditions` answered paceFactor
1.0268 and severity "severe". `heatCandidates(iso)` is now the ONE candidate list (plan + extras,
ordered primary-run-first), `heatSessById` the one resolver (returning the **UNADAPTED** session —
`openSessionSheet` stores the already-adapted copy, so a before/after built from `SHEET_CTX` prints the
wrong starting point), `heatOffer(sess)` the ONE gate read by the Today card AND the block, and
`heatBlockHtml` renders four states, all TODAY-only.

⚠️ **"race" WAS MISSING FROM `weather.ts`'s `RUN` SET, WHICH SILENCED THE HEAT CARD ON THE ONE DAY THE
PLAN EXISTS FOR** — paceFactor exactly 1.0000 and *"Near-ideal conditions"* before a goal race at 33 °C.
It is in `QUALITY` too, which makes race day offerable at ~4.6% slower.
✅ **CONFIRMED 2026-08-22: *"The goal race adaptation for heat can be offered, it doesnt mean the user
has to accept it."*** So the offer stands. `test/heat-custom.test.ts` now proves the whole path from a
real generated `race` session to something on the briefing card, on a fixture whose race is TODAY —
`env(33, true)` exists for that, because `heatBlockHtml` is today-only (correctly: the forecast is
today's) and `dayOverride` cannot help, since it moves a session within its OWN week and the race is
in the last one.
⚠️ **AND CONFIRMING IT FOUND A REAL DEFECT IN THE ADVICE THAT CAME WITH IT.** The quality branch's
severe-heat line is *"Strongly consider moving this to a cooler time of day, or swapping it for an easy
run"* — right for a threshold session, **impossible for the thing the whole plan was built to reach**:
a race starts when it starts and is not swappable. So a runner opening their race briefing in severe
heat was offered two things they could not do, on the one card that matters most. `race` now gets its
own line (go out slower than the plan, take every drink station, be ready to ease off) and keeps the
heat-illness warning. Guarded from both sides — the race wording must be there, and the swappable
wording must not.

⚠️⚠️ **THE TODAY CONDITIONS SQUARE READ "Good to run" UNDER A SEVERE-HEAT COLOUR, AND IT PRICED A
DIFFERENT SESSION FROM THE CARD TWO INCHES BELOW IT.** Two faults in one control, both found by the
independent pass, both after the engine copy had been "fixed":
1. The tile is painted from `imp.severity` while the sub-line was `effortBased ? … : heatSec ? … :
   "Good to run"` — three tests, none of them the severity. A mobility session at 33 °C is severity
   "severe" with `effortBased` false and `heatSec` 0, so it read **"Conditions · live 33° · Clear Good to
   run"**. A moderate WIND on an ordinary easy run reached it the same way. `feelSquare`'s own comment
   ten lines below already stated the rule: readiness is kept separate from the weather *"so that 'good
   to go' can never sit beside a heat warning and contradict it"*.
2. `sessionsOnSelectedDay()` reads `RAW.weeks` and has never consulted `EXTRA`, so on a 33 °C day whose
   plan held only a mobility session with a custom 2 km run added it answered the MOBILITY session while
   `heatCandidates` answered the custom run — the sheet saying "this session has no pace to adjust"
   while the card said "about 2.3% harder".

⚠️ **`conditionsSession()` IS THE ONE RESOLVER, AND `conditionsSquare()` NOW TAKES NO ARGUMENT.** Passing
the right session in from `viewToday` was tried first and re-broken by reverting that one call site:
every behavioural guard still passed, because the resolver existed and nothing read it. A convention a
caller must honour is a convention somebody breaks; the resolver is INSIDE, so there is no argument to
get wrong. ⚠️ **It deliberately does NOT replace `sessionsOnSelectedDay`** — that feeds the hero card,
whose `data-oid` resolves against `RAW.weeks`, so folding extras in would make the day's hero a tap that
lands on nothing, and the extras already have their own card.

⚠️⚠️ **AND THE ENGINE'S NEW "no pace to adjust" LINE COMMITTED THE SAME FAULT IT WAS FIXING: A WINDY
COOL DAY WAS CALLED "Hot out".** It read `cold === "none" ? "Hot" : "Cold"`, and `cold` is not what sets
the severity — `severity` is `worst(worst(heat, wind), cold)`. Swept over 21,120 non-run cases: **"Hot
out" fired 10,208 times, 1,120 of them at ≤12 °C, coldest 6 °C, and 2,992 of them sat under a WIND
headline**; **"Cold out" fired 0 times — a dead branch**. `WeatherImpact.driver` is now the ONE
derivation (`driverOf`), read by the headline, by this line and by the app's square, so the two
sentences on that card cannot name different weather. After: 7,216 "Hot out" (20 °C and up, none under a
wind headline), 2,992 "Windy out", 0 contradictions across 63,360 cases.
⚠️ **THE COLD BRANCH WAS DELETED RATHER THAN MADE REACHABLE, AND WHICH OF THE TWO IS STATED.** Any cold
at all pushes its own point above and that block is NOT gated on `isRun`, so a non-run on a cold day
never reaches this fallback. Making it reachable would mean removing the cold advice that is already
better than it. `test/heat-custom.test.ts` asserts the exhaustion in BOTH directions: every driver that
can reach the line has copy, and the source carries copy for no driver that cannot.
⚠️ **THAT IS THE ENGINE'S FALLBACK ONLY — THE SQUARE'S OWN COLD BRANCH *IS* REACHABLE AND MUST STAY.**
`conditionsSquare` keys on the driver directly rather than on whether the fallback ran, so a −4 °C day
correctly reads **"Cold out today"** on the tile (verified on the served page) while the engine's point
for it is the cold advice rather than the no-pace line. Two different questions, two different answers;
deleting the tile's branch on the strength of the paragraph above would put "Hot out today" on a
freezing morning.

⚠️ **`wxDiagLine()` IS THE HARDWARE TEST FOR THIS ONE.** Support › Your data now carries an eighth
diagnostic line: whether the forecast is live, how many hours are held, and what happened last time
(offline / refused / timed out / never asked). **If it says "0 hours" or "location refused", that alone
explains the original report** — and a refused location can only be undone in iOS Settings.
⚠️ `state.wxHours` is still NOT persisted, so an accepted adaptation is paused on every fresh launch
until a forecast lands. The block and the chip now say so honestly. Caching it is a new store and its
own decision.

### THE GUARD-ADDRESS TRAP, THIRD AND FOURTH OUTINGS

⚠️ **A COMMENT CLAIMED A GUARD IN A FILE THAT DOES NOT CONTAIN IT** — `weather.ts`'s `RUN` set said
*"`test/weather.test.ts` now DERIVES the assertion from PRIMARY_TYPES"*; that file contains no such
assertion, and the derived guard lives in `test/heat-custom.test.ts`. Sweeping every changed file for
`test/*.test.ts` addresses then found **two more, both pre-existing in `web/app.ts` and both naming
files that have never existed**: `test/ios-viewport.test.ts` (claimed to enforce `.wz-extras-body`'s
`44dvh` cap — nothing enforced it at all, so **the guard was written**, in `test/ios-input-zoom.test.ts`,
which already owns the dvh-versus-percent distinction) and `test/support-hub.test.ts` (the real guard is
`test/support-tools.test.ts`, which CLAUDE.md had already recorded while the comment stayed stale).
**The rule: either write the guard where the comment says it is, or move the claim to where the guard
lives. Never leave a comment asserting a test that does not exist** — and when you move a guard, move
its address with it.

### FOUR DEFENSIVE LINES WITH NO OBSERVABLE FAILURE MODE, AND ONE THAT TURNED OUT TO HAVE ONE

⚠️ **RECORDED IN THE CODE BESIDE EACH LINE so a future reader does not "verify" one by deleting it** —
this project has already deleted a `const` on a verifier's word and broken a guard that read it.
- `ladder = Math.max(ladder, longRunMinutesOf(out))` — a plain assignment is identical across 3,600
  plans / 88,800 weeks on both instruments, because the ramp is monotone on non-eased weeks anyway. The
  version that DOES matter (no ladder at all) is caught and sends 3,900 of 50,240 transitions downwards.
- the easy-run cap loop's `minutes > 20` — lowered to 8, identical everywhere: measured over **241,903
  easy/recovery/strides runs, NONE is under 20 minutes and the shortest is exactly 20.0**. The floor that
  produces that 20.0 is the outer `Math.max(20, …)`, which IS load-bearing.
- `Math.max(longRunMinutesOf(week), prevLong × LONG_LIFT_STEP_MAX)` — identical everywhere, because
  `longMinFloor` is a FLOOR so a `want` below the week's natural length never binds.
- `settle > 0` on the pace-window reset, and the `LIVE.dist` argument to `paceMark` in `pedoFillGap` —
  both equivalent transformations, byte-identical over 60 cases (at a steady fill rate, marking
  `dist − walked` gives the same consecutive differences).

⚠️ **THE FIFTH, `owedFrac`, WAS RECORDED AS UNFALSIFIABLE AND IS NOT.** Forced to 1, **six of 46 cases
move** — three dark tunnels at 3 m/s (whole-run error 0.07–0.12 points worse, settled/written-off going
7/2 → 9/0) and three bends (0.13–0.26 points worse). Forcing it to 1 over-settles, i.e. under-credits,
which is the direction that loses honest ground on a curved blackout. **Measure before recording a line
as decoration.**

### VERIFICATION, AND THE HARNESS FAULT THAT READ AS FOUR ESCAPES

Build exit 0; `docs/voices/` clean after every build; `node --check` OK on all three emitted blocks;
`npx tsc --noEmit` clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date error;
**`node --test` 1027 pass / 0 fail** (CHROME_PATH set); both ratchets unchanged.

**24 deliberate re-breaks, re-run start to finish against the finished tree: 21 caught, and the three
that were not are provably EQUIVALENT rather than escapes** — each measured byte-identical over the
whole grid, and each recorded in the code as such (P5 the lift clamp's `Math.max`, G10b the argument to
`paceMark` in the fill, G21 the reset's `settle > 0`). Two further attempts escaped the FIRST version of
a guard and were caught only after it was restated — those two are the useful half:
- ⚠️ **THE RE-BREAK HARNESS ITSELF PRINTED "ESCAPED" FOR FOUR CONSECUTIVE BREAKS AND HAD PARSED
  NOTHING.** It looked for `# fail N` in the output; `node --test` prints **`ℹ fail N`**. A verdict of
  "not caught" from an unparsable result is the same class of fault as this file's zsh word-splitting
  note. The harness now accepts both forms and reports an unparsable result AS SUCH.
- ⚠️ **THESE TESTS READ `web/app.html`, SO A BREAK APPLIED TO `web/app.ts` AND NOT BUILT IS A BREAK THE
  SUITE NEVER SEES.** That is what produced the independent pass's one reported GPS escape; rebuilt, the
  break is caught. Any re-break of a web-layer guard must rebuild.
- ⚠️ **A FIXTURE CAN BE TOO KIND AT EITHER END.** The conditions-square guard first swept 12 °C/8 kph
  (severity none) and 33 °C (severe) and nothing between, so making the gate `severity !== "none"` —
  which makes every mild morning a warning and "Good to run" unreachable — escaped it. It now reaches
  `mild` and asserts "Good to run" SURVIVES on the calm and mild cases.

⚠️ **THE BACKTICK RULE FIRED TWICE MORE, BOTH IN MY OWN COMMENTS, and the second time the build failed
outright** — which is the good outcome and the reason to read the exit code. Count for this phase: 2.

## RACE DAY MAY BE OFFERED A HEAT ADAPTATION (owner's ruling, 2026-08-22)

*"The goal race adaptation for heat can be offered, it doesnt mean the user has to accept it."* Recorded
against the flagged question in the heat chapter above. Three guards: the offer reaches the briefing
card on a fixture whose race is today, it is never applied without a decision, and a race gets the
quality wording rather than an easy run's.

⚠️ **CONFIRMING IT FOUND A REAL DEFECT — see that chapter.** The quality branch's severe-heat advice
told the runner to move the session to a cooler hour or swap it for an easy run, neither of which a goal
race can do. Fixed with a `race` line of its own.

⚠️ **`env(33, true)` PUTS RACE DAY ON TODAY, AND IT HAD TO.** `heatBlockHtml` is today-only and
correctly so — the forecast is today's — and `dayOverride` cannot move a race onto today because it
moves a session within its OWN week and the race is in the last one. So the fixture builds a ~13-week
block whose race date IS today. ⚠️ The existing 22 guards in that file are untouched, because the flag
defaults to the old behaviour.

⚠️ **`/effort/i` MATCHED BOTH BRANCHES, so the first version of the quality-wording guard escaped its
re-break** — the easy-run line is *"Just slow down and go by feel — effort matters far more than pace"*.
Assert the quality phrase AND the absence of the easy-run one; the guard's own title named what it was
failing to check.

## THE HEAT OFFER MOVED INTO THE SESSION PREVIEW, AND THE DAY'S CARD STOPPED STARTING RUNS (2026-08-21)

*"I want the adapt for heat to be within the session preview and for today's session to be a button that
enters the session preview rather than an automatic start button"*

⚠️ **IT WAS ALREADY IN THE PREVIEW — `heatBlockHtml`, above the steps, where it explains the bands the
runner is about to read.** So the card at the top of Today was the same offer made twice, and it was the
copy that pushed the day's own session below the fold (his screenshot shows exactly that). `heatCard` is
**deleted**, not left unreachable, because an unreachable builder is what the next screen copies — and its
own comment claimed it was "also the definition of is there an offer", which was already untrue:
`heatOffer` is, and both callers used it.

⚠️ **THE DAY'S CARD OPENS THE PREVIEW AND NEVER STARTS A RUN.** There were two branches — Start on a
runnable session today, View on anything else — and the first is gone. Starting from there skipped the
one screen that says what the session is, what the heat has done to its paces, and where it will be
recorded, and put the runner one tap from a live GPS session they had not read. The preview carries its
own Start (`sdStart`).
⚠️ **THE `$("id")` GUARD CAUGHT THE LEFTOVER**: the `startSession` handler was still bound to an id
nothing rendered any more. Sixth outing of the invented-identifier trap, and the first time it has fired
on a REMOVAL rather than an invention.
⚠️ **AND SIX GUARDS IN THREE FILES NAMED `heatCard`.** Every one is re-pointed at `heatBlockHtml` rather
than deleted — same gating, and the block additionally has states for an accepted decision and a stale
forecast. One had to change its CLAIM as well as its subject: "the card kept asking after a decline"
asserted an empty string, and the block answers a decided session with a STATE, so it now asserts the
absence of the offer's own control instead.

⚠️ **STILL OUTSTANDING FROM HIS 2026-08-21 REPORT, AND BOTH ARE SCREEN REBUILDS:** the phone-recorded
run's START screen (session title with an up-first rail, distance/time/avg pace, an active-shoe chip, a
GPS signal indicator, map zoom/recentre/mute controls) and its FINISH screen (workout name, description,
private notes, and a "sync to applications" block with Strava and Apple Health toggles beside Discard and
Save). Apple Health WRITE does not exist in this app at all — that is an `HKWorkout` save and a new
entitlement, i.e. native work, not a toggle.
