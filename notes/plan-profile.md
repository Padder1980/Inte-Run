# Profile answers → the plan

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE PLAN ANSWERS THE PROFILE (owner, 2026-08-25, two annotated screenshots)

*"When editing the questions in my profile, I don't think the app uses the information well enough to
adapt the plan for the needs of the runner. I did an experiment where drastically changed the profile and
it didn't affect the types of run too much"* / *"I also think there needs to a mixture of runs set by
distance and runs set by time"* / *"I also set my preference to Sunday long run and it didn't deliever"* /
*"I think 'building the habit' runner needs to have the option to set a time goal if they choose to, they
can also just leave it off"*.

⚠️⚠️ **MEASURED FIRST, AND THE ENGINE WAS INNOCENT ON BOTH OF THE PLAN COMPLAINTS.** It honours the
chosen long-run day at **every** experience level and **all seven** weekdays, never puts two runs on one
day, and gives **six distinct session mixes across seven very different profiles**. What flattened his
experiment was one line in the WEB layer, and what moved his long run was a stale reschedule. Suite
1338 → **1342**; 10 re-breaks, all 10 caught.

### ⚠️⚠️ A SILENT PROMOTION MEANT "BUILDING THE HABIT" COULD NOT REACH THE HABIT TRACK

```js
if (pf.status === "building" && !pf.noRecent && pf.recentTimeS < 1980) experience = "recreational";
```

⚠️ **ITS CONDITION DID NOT MATCH ITS OWN COMMENT.** The comment justified it by *"a runner who calibrated
a genuinely capable easy pace"* — and the test was on `recentTimeS`, a 5 km TIME which ships at **1500**
in `DEFAULT_PROFILE` and is copied forward by every save. Measured: **default profile PROMOTED**, 24:00
promoted, 32:00 promoted; only 33:30+ or an explicit *"no recent time"* stayed a beginner. So the one
status whose whole point is a gentle build was reachable only by runners who had told the app they had no
time at all.

⚠️ **AND THE TWO TRACKS ARE NOT A SHADE APART.** Measured on his own answers (4 days, Sunday long):
promoted gave **27.5 km with a 3 × 8′ threshold session**; status-decides gives **15.1 km, all easy plus
a long run**. Across 16 goal/day combinations the two differ in **16** and match in **0** — which is why
his experiment looked like the profile doing nothing.

⚠️ **THE INSIGHT IT PROTECTED IS THE RUNNER'S TO STATE, NOT OURS TO ASSUME.** A fit-but-infrequent runner
picks *"Regular runner"*, whose card says exactly that; the habit card says *"I can jog 20–30 minutes
non-stop"*, which nobody running 21:15 for 5 km would choose. Second-guessing a self-description is what
`classifyRunner` already refuses to do — it caps self-assessment **and says so on screen** — and this was
the same overreach with no notice on screen at all.
⚠️ **THE GUARD IS A COUNT, NOT AN ABSENCE.** `experience` must be assigned **exactly once** inside
`applyProfile` and from `expByStatus`, and nothing after it may reassign from `recentTimeS`, `twoKmS` or
`easyPaceS` — so a differently-spelled relative of this cannot come back.

### ⚠️⚠️ A RESCHEDULE IS PERISHABLE, AND NOTHING WAS CHECKING

`seedDone`'s own comment said *"a session's id is deterministic, so a same-shape rebuild keeps them"* —
correct, and **nothing checked whether the shape was still the same**. So a drag made against the old
layout survived the rebuild and dragged the long run back to Wednesday, over his new Sunday preference.
An override is an answer about **one arrangement of the week**; change the arrangement and it answers a
question nobody asked.

**An override now records where it moved the session FROM** (`{ to, from }`; a bare number is one written
before this and reads as *from unknown*), and `seedDone` drops any whose `from` no longer matches the
session's generated day. Driven in a browser, all four cases:

| | result |
|---|---|
| habit-builder, Sunday asked | Tue/Thu/Sat easy + **Sun long** |
| dragged the long run to Wed | stored `{from: 6, to: 2}`, long on Wed |
| rebuild, same preference | **the drag survives** — it is still a valid answer |
| preference changed to Sat | **override dropped, long run on Sat** |

⚠️⚠️ **AND A SEPARATE COLLISION BELT, WHICH IS WHAT CATCHES HIS ACTUAL STORED DATA.** His screenshot had
an easy run **and** the long run both on Wednesday with Sunday empty. `moveSession` swaps with whatever
occupies the target, but only **at the moment of the move**: after a rebuild the plan may put a different
session on the day an old override points at, and nothing was looking. Reproduced exactly with a legacy
bare-number override (`Tuex2`, "Tue easy" + "Tue long") and resolved to a clean week with 0 overrides.
This is also the **only** way a pre-`from` override's staleness can be detected at all.
⚠️ **THE PLAN'S OWN DAY WINS OVER A RESCHEDULE**, and between two reschedules the later id gives way —
stated as a rule so the resolution is not order-dependent by accident.

### A HABIT-BUILDER MAY SET A TIME GOAL, OR LEAVE IT OFF

`GOAL_BY_STATUS.building.time` is **`"optional"`** — a third value, so every reader must now test
`=== true`.
⚠️ **READ AS TRUTHY IT FLIPS THE WHOLE FRAMING TO A RACE:** the distance dropdown becomes *"10 km"*
instead of *"Complete a 10K"*, the date becomes a *"Race date"*, and `draftFromForm` **throws** on a blank
field — which is the pressure the old copy existed to remove. Four call sites fixed; measured per status
after: building keeps *Complete a 10K* / *Target date* with an **OPTIONAL** pill and a hint saying what
blank does; `new` is untouched (he named the habit-builder); regular and competitive are unchanged.
⚠️ **A BLANK ANSWER STILL LEAVES THE ENGINE A TARGET.** `Goal.targetTimeSeconds` is required — every
race-pace step derives from it — so blank derives one with Riegel and records **`targetSet: false`**.
⚠️ **`targetChosen(pf)` IS THE ONE READER, AND MISSING MEANS "WHATEVER THE STATUS ASKS FOR"**, so no
stored profile needs migrating: an existing racer keeps showing the time they typed, an existing beginner
keeps not showing a derived one. Printing a Riegel projection back to a habit-builder as *"your goal"* is
exactly the pressure this is about.
⚠️ **A TYPO IS STILL REFUSED, OPTIONAL OR NOT.** Silently keeping the old value would be a goal they did
not set.

### ⚠️⚠️ AND THE MEASURING APPARATUS IS BLIND TO THIS CHANGE — THAT IS WHY IT IS NOT DONE YET

Before any of it can be swept, the instruments have to be able to see it. Found by pointing the existing
audit tool at the question:
- ⚠️ **`tools/audit-progression.mjs` — FIXED.** Both `secs()` and `raceSecs()` summed
  `st.durationSeconds || 0`, with an `|| estimatedDurationSeconds` fallback on `secs` that only fires when
  the whole sum is zero. So a session with a distance-gated body **and** a timed warm-up would have
  reported only the warm-up's seconds, and converting the long run to a distance would have looked like a
  large drop in training time that had not happened. Both now derive a distance-gated step exactly as the
  engine's own `stepSeconds` does. Same shape as this file's own three original faults in that tool: an
  instrument that cannot see the thing it is pointed at. It also corrected the race-pace figures above.
- ⚠️ **FIVE TEST FILES CARRY THE SAME BLIND SUM AND ARE PREREQUISITE WORK, NOT COLLATERAL.**
  `test/no-warmup-low-intensity.test.ts` (`mins`, line 30 — and line 77 asserts every step has a
  `durationSeconds > 0`, which would fail outright), `test/warmup-delivery.test.ts` (`totalMin`, line 38,
  which sweeps **every session of real generated plans**), `test/segment-clock.test.ts`,
  `test/heat-adapt.test.ts` and `test/custom-session-gear.test.ts`. Some would fail loudly, which is the
  acceptable kind; `warmup-delivery`'s would quietly measure a fraction of a converted session.
  ⚠️ **THEY ARE NOT BEING CHANGED EN MASSE NOW.** Each one's assertion was calibrated against the blind
  figure, so making them gate-agnostic changes what they measure and has to be justified per test — a
  guard churned without cause is worse than a guard that fails loudly when the day comes.

### ⚠️ STILL OPEN: THE MIXTURE OF DISTANCE-SET AND TIME-SET RUNS

**Measured, not guessed:** across a full half-marathon block, **65 sessions are clock-only and 9 carry any
distance-gated body step** (2 pure, 7 mixed) — the interval sessions. So he is right: the plan is
overwhelmingly time-based.

**What the measurement also shows is that the machinery exists.** Both step-to-seconds converters —
`stepSeconds` in `src/science/intensity-distribution.ts` and `stepSecs` in `web/app.ts` — already handle a
step with `distanceMeters` and no `durationSeconds` by dividing distance by the mid-band pace. So the
intensity model and the live runtime can already carry one.

⚠️ **THE CONTAINED DESIGN, FOR WHOEVER PICKS THIS UP: KEEP THE ENGINE IN MINUTES THROUGHOUT AND CHANGE
ONLY THE GATE AT STEP EMISSION.** Every model, cap, ramp and taper (`peakLong`, `easyCapMin`,
`volumeMultiplierByWeek`, `enforceLongRunIsLongest`, the volume fixed-point) takes minutes and must keep
taking minutes; convert to a distance only when the body step is written, and **recompute the session's
estimated duration from the ROUNDED distance** so `sessionMinutes` stays honest.
⚠️ **THE LONG RUN IS THE DEFENSIBLE ONE TO CONVERT FIRST, and this file already argues it:** *"Minutes
are the right currency for FATIGUE… but a race is a distance, and durability for it is a distance too."*
Easy and recovery runs are time on feet by design.
⚠️ **AND IT IS NOT DONE, DELIBERATELY.** Changing how every session is prescribed needs a sweep over
thousands of plans to show the volume fit, the intensity floor and the taper depth are unharmed — the
same bar every other change in this chapter cleared. Shipping it on reasoning alone is what this file
exists to prevent.

⚠️ **`buildProfileFromDraft` DOES NOT EXIST AND THIS FILE NAMES IT TWICE.** The function is
**`draftFromForm`**. An invented identifier in the docs, and it cost a pass here — the guard failed with
*"buildProfileFromDraft is not in the built page"*.

⚠️ **THE BACKTICK RULE FIRED AGAIN, IN MY OWN COMMENT**, and the build failed while `node --check`
reported OK on the **stale** build — exactly as this file warns. Read the exit code first.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1342 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, ratchets unchanged, 10 re-breaks all caught,
and every case above driven in a real browser against the served build.

## THE PROFILE'S QUESTIONS NOW REACH THE PLAN (owner, 2026-08-25/28)

*"Are there any adaptations we need to make to the profile page (training profile questions) that we need
to make to ensure the plan is appropriate?"* then *"yes, start with the age one but also adapt the
questions or layout of the whole profile to make it fit for purpose if you need to"*. Suite 1369 →
**1382**; `test/profile-inputs.test.ts` holds 13 guards and **20 deliberate re-breaks were all caught**.
All of it is web plus two engine files, so it reaches his phone over the air on the next launch.

⚠️ **THE ANSWER TO HIS QUESTION WAS NOT "ADD MORE QUESTIONS". IT WAS THAT FOUR ANSWERS NOBODY GAVE WERE
BEING TREATED AS ANSWERS, AND FIVE READERS OF ONE QUESTION DISAGREED WITH EACH OTHER.** A verification
workflow re-measured every claim independently; where it corrected me, the correction is recorded below
rather than the original figure.

### ⚠️⚠️ THE PHANTOM AGE WAS THE APP'S MAX-HEART-RATE MODEL, NOT ONE SENTENCE

`DEFAULT_PROFILE` shipped `age: 38`, `ageOpts` enumerated 12–90 with **no blank option**, and two
fallbacks read `|| 35`. All three values sit inside the 35–49 masters band, so a runner who had never
answered was classified as a masters athlete. **I first graded the harm as one wrong sentence on the
type-preview panel. That was wrong by a wide margin, and the independent pass is what corrected it.**

`maxHrEstimate()` reads `profile.age` and returns Tanaka's `208 − 0.7 × age`. Its own comment says *"Zero
means no ceiling known; callers must treat that as do not judge, never as a number"* — **so a default
defeats a function deliberately built to refuse to guess**, and it returned **181 bpm** for a phantom 38.
That ceiling drives four surfaces, none of which the first audit named:

| surface | with the phantom | measured after |
|---|---|---|
| `maxHrEstimate()` | 181 bpm for everybody | **0** — "no ceiling known" |
| the coach's 92%-of-max safety cue | fired at **167 bpm** | not raised at all until an age is given |
| Support › Training zones' five-zone table | built from 181, switch auto-ON | says it has nothing to build from |
| `payload.maxHr` → the wrist's zone colours | 181 | absent |
| per-run zone-time accumulation on every logged run | against 181 | absent |

Measured against real ages: a 65-year-old's cue fired **18 bpm late**, a 20-year-old's **11 bpm early**.
⚠️ **ALL FOUR CALLERS ALREADY GUARD ON ZERO, which is what makes the fix safe** — the absence degrades
gracefully everywhere, which is also why nothing ever failed.

⚠️⚠️ **THE TWO EDITS MUST LAND TOGETHER, AND THE ORDER IS A REAL HAZARD.** `ageOpts` marks nothing
selected when its argument is not a real age, so **deleting `age: 38` BEFORE adding the blank option
leaves the browser selecting the first option, 12** — and `draftFromForm` saves the LIVE SELECT VALUE,
not the default. Stored, that gives maxHr 200 and fires `warmup.ts`'s `ageYears < 18` youth branch:
strictly worse than the bug. Verified on the served build: value `""`, `selectedIndex` 0, first option
"Prefer not to say", `profile.age` absent, `maxHrEstimate()` 0; and picking 52 stores 52, band 50-59,
maxHr **172**.
⚠️ **`sex: ""` IN THE SAME OBJECT WAS ALREADY THE HONEST SHAPE** — empty means unanswered — so the fix
matches a precedent one field away rather than inventing one.
⚠️ **AND IT IS NOT "WORSE THAN `weeklyVolumeKm: 30`", which I claimed.** That field had no screen at all;
age has a visible, live, saved select. Non-neutral, yes; worse, no.

⚠️ **`assessMasters` ANSWERED WITH THE OLDEST BAND FOR THE RUNNER IT KNEW LEAST ABOUT.** `bandOf`
compared against three thresholds and returned `"60-plus"` for anything that failed all three, so an
absent age gave `ageBand: "60-plus"` with `isMasters: false` — a pair that cannot both be true. There is
now an `"unknown"` band with its own branch, which still gives the two points that are true at every age
(*"a slightly longer warm-up"*, *"strength work twice a week"*) and a headline naming what is missing,
because withholding age-independent advice for want of an age is worse than saying nothing about age.
⚠️ **THE `knownAge()` GUARD ON `suggestFemaleHealth` IS THE TYPECHECKER'S REQUIREMENT, NOT THE RUNTIME
GUARANTEE.** By that line the unknown band has already returned, so replacing the whole conjunction with
`(input.age ?? 45) >= 45` changes nothing for any unknown age — measured, and it **escaped the first
re-break run**. What it does do is fail `tsc` with *"'input.age' is possibly 'undefined'"*. The reachable
break is the unknown branch's own hardcoded `suggestFemaleHealth: false`, and that one is driven.
⚠️ **AND THE GUARD'S FIXTURE COULD NOT SEE HALF OF WHAT IT ASSERTED**, because it passed no `sex` — and
the suggestion is `sex === "female" && age >= 45`, so the first half of the conjunction was false
whatever the age did. A fixture that cannot reach the branch it is pointed at proves nothing about it.

### `yearsRunning` WAS A PHANTOM, THEN A DERIVED PHANTOM

Never asked, always 3, and it **cannot reach `generatePlan` at all** — `Athlete` has no such field, so a
plan is byte-identical for 0 years and 25. But `classifyRunner`'s label IS rendered, so the number was
invisible in the plan and visible on the screen. It is derived from the status card now
(`trainingYearsFor`), and the derivation is checked against `classifyRunner`'s own two gates (≥1 for
tier 3, ≥3 for tier 4) rather than being three numbers picked by eye.
⚠️ **AND THE FIRST FIX STORED THE DERIVED VALUE BACK INTO THE PROFILE, WHICH IS THE PHANTOM IN A NEW
COSTUME.** `draftFromForm` wrote `yearsRunning: trainingYearsFor(...)` and nothing read it — a number
that goes stale the moment the status changes without a save. Nothing stores it; every caller derives it.

### ⚠️⚠️ THE RUNNER-TYPE PANEL CONTRADICTED THE CARD THE RUNNER HAD JUST ANSWERED

`classifyRunner` starts everybody who runs at all at tier 2, so somebody who had just chosen *"Just
getting started"* was shown **"Recreational runner"** under a heading reading "Your runner type".
`ClassificationInput.maxTier` is applied **last, after the performance refinement** — drawn before it, a
fast 5 km time lifts the runner straight back past their own stated band (measured: a 15:00 5 km reaches
tier 4 through a `maxTier: 2`).
⚠️ **CAPPING IS NOT SECOND-GUESSING THE RUNNER — IT IS THE OPPOSITE.** A fit-but-infrequent runner picks
*"Regular runner"*, whose card says exactly that; the habit card says *"I can jog 20–30 minutes
non-stop"*, which nobody running 21:15 for 5 km would choose. `classifyRunner` already caps
self-assessment and says so on screen; this is the same refusal one layer out.

⚠️ **AND THE PANEL SAW THREE OF THE FIVE FIELDS, SO IT DISAGREED WITH THE PLAN IN BOTH DIRECTIONS.** With
its old inputs the tier was **days alone** — 0→1, 1–3→2, 4+→3, always. Measured disagreements, one in each
direction: a competitive runner on 6 days and 80 km was called *"Trained runner"* where the engine says
*"Highly trained"*; and at **4 days and 10–24 km/week the panel said "Trained runner" where the engine
says "Recreational runner"** (that second one came from the independent pass, not from me). It now reads
`s_volume` and `s_rectime` live and passes the ceiling, so it IS the engine's classifier.

⚠️ **THE CAP NOTE COULD NEVER RENDER, AND CLAUDE.md SAYS THAT NOTE IS WHY THE PANEL EXISTS.**
`classifyRunner` returns a `note` for tier 4 — *"the very top tiers are defined by international
competitive standard, so we cap self-assessment here"* — and the panel rendered `label` and `meaning` and
dropped it. It was unreachable besides: the old inputs topped out at tier 3. Verified on the served build:
a competitive runner on 6 days / 80 km / 18:20 now reads **tier 4, "Highly trained runner", with the cap
note shown**.

### ⚠️⚠️ ONE QUESTION, FIVE READERS, AND THEY DISAGREED FOR LEGACY PROFILES

`profile = storedProfile || Object.assign({}, DEFAULT_PROFILE)` — **a stored profile is used AS-IS with no
merge**, so `status` is undefined for any profile saved before that question existed. Five things then
fell back independently:

| reader | old fallback | consequence |
|---|---|---|
| `expByStatus` in `applyProfile` | `noRecent ? "beginner" : "recreational"` | (the reference answer) |
| `warmupAbility()` | `"intermediate"`, no equivalent test | a runner the plan builds as a **beginner** got an **intermediate** warm-up |
| `trainingYearsFor` (new) | 3 | three years of training for that same runner |
| `typeCeilingFor` (new) | 3 | a tier-3 ceiling for them |
| the add-a-day evidence builder | a **hand-inlined copy** with no fallback at all | ⚠️ see below |

⚠️⚠️ **THE FIFTH WAS THE ONE WITH TEETH, AND THE GUARD FOUND IT RATHER THAN I DID.** The add-a-day
evidence builder carried `(st === "new" || st === "building") ? "beginner" : …` inline — so a legacy
profile was **built as a beginner by `applyProfile` and judged as recreational by the offer**. That
matters because `addDayOffer` opens with `if (input.experience === "beginner") return null`: the runner
would have been offered an extra running day the gate exists to withhold, on a plan whose whole track is
capped by design.

`resolvedStatus(pf)` answers "which of the four cards is this runner" once, and `experienceFor(pf)` is the
one status-to-experience mapping. ⚠️ **THE FALLBACK IS CHOSEN TO PRESERVE `experience` EXACTLY** — measured
byte-identical across all eight input shapes — and deliberately **not `"new"`**, because that is the
run-walk track and silently moving a legacy runner onto it would change every session in their plan. The
warm-up split is fixed as a side effect: a legacy `noRecent` profile now gets a **beginner** warm-up to
match its beginner plan.

### THE STATED MILEAGE IS ANSWERED IN BOTH DIRECTIONS

The existing note fires when the plan cannot REACH a stated figure and said nothing when it overshot one.
At the bottom of the range the per-session floors bind — a 20-minute easy run cannot shrink — so a low
answer stops moving the plan and then stops being reflected in it. **Measured on a half marathon, 5 days,
17 weeks: the opening week is the same 27.8 km whether the runner says 15, 20 or 25**, so somebody who
said 15 was handed 1.85× it in their opening week with nothing on screen about it.
⚠️ **KEYED ON THE OPENING WEEK, NOT THE PEAK.** A peak above the stated figure is what a block IS —
`PEAK_VOLUME_MULTIPLIER` is 1.25 by design — so reading the peak would fire on every plan the volume
model built correctly. The threshold is the 1.10× week-one guardrail the project already states.
⚠️ **THE FIRST NON-DELOAD WEEK**, because week one can be a deload on some runways and a deload is
deliberately smaller.
⚠️⚠️ **AND ADDING THE NOTE UPSTREAM ACHIEVES NOTHING ON ITS OWN.** The app renders exactly ONE of the
eight notes, chosen by a regex naming only the two under-delivery phrasings — so the new branch would have
been generated and discarded, which is the trap this whole area is about. Measured after: fires at 15 and
20 stated, silent at 30, 45 and 60.

### THE BEGINNER CARD NO LONGER INVITES A RETURNING RUNNER — with the harm bounded honestly

The card read *"New to running, or coming back after a long break"*, pointing a detrained veteran at the
run-walk track — where the dedicated *"Coming back to running?"* question they answer two sections later
changes **nothing**: measured, `returningFromBreak` and `returningFromInjury` give a **byte-identical
session list for a beginner (0 of 140 sessions differ)** against 158 of 170 on the recreational track.
⚠️ **THE INDEPENDENT PASS REFUTED MY FRAMING OF THE HARM AND IT IS WORTH KEEPING BOTH HALVES.**
`GOAL_BY_STATUS.new` offers only a 5 km and a 10 km, so the veteran-heading-for-a-half case I led with is
unreachable through that card. The copy fix stands — it removes a misleading invitation, and a returning
runner picking that card for a 10 km still has their returning answer discarded — but it is a copy fix
with a bounded harm, not a fix that prevents a large measured one. `addDayOffer`'s beginner gate is
deliberate and commented, so nothing here changes it.

### ⚠️⚠️ FOUR TRAPS THIS WORK PAID FOR, AND THE FIRST ONE MADE ME REPORT A DEFECT THAT WAS NOT THERE

1. ⚠️⚠️ **A PRISTINE COPY FROM AN EARLIER PHASE RESTORED OVER A LATER PHASE'S WORK, AND I THEN MEASURED
   THE REVERTED TREE AND CONCLUDED MY OWN CHANGE HAD VANISHED.** `/tmp/taper/rebreak.py` listed
   `src/plan/generate-plan.ts` and restored it from a copy taken before the profile work; a run of it
   wiped the over-delivery branch. Two greps minutes apart returned different text, and `git diff --numstat`
   said the file was unmodified and then said 27 lines added. **This file already says "take ONE pristine
   copy at the start"; the missing half is that a harness must be DELETED when its phase ends**, because
   the danger is not a stale copy within a phase, it is a live harness across phases. Also the reason the
   independent pass checked every web-layer claim against `git show HEAD:web/app.ts` rather than the tree.
2. ⚠️ **A GUARD SCOPED TO A MECHANISM FAILED ON A CORRECT CHANGE — the fourteenth firing.**
   `test/plan-adapts.test.ts` pinned `expByStatus[pf.status]`, which moved into the shared
   `experienceFor(pf)`. Restated to the fact: the single assignment must come from the status card, and
   nothing after it may read a time. ⚠️ **And it carried a second defect: `ap.indexOf("expByStatus[pf.status]")`
   returns −1 once the anchor is stale, and `slice(-1)` is the LAST CHARACTER** — so the sweep below it
   would have measured nothing and passed whatever the code did. The anchor is proved present first.
3. ⚠️ **THE BACKTICK RULE FIRED — the fifteenth time**, in my own comment, and it failed as
   `SyntaxError: Expression expected` at the closing brace of the function BELOW the comment, because the
   stray backticks closed the outer template literal and the runtime JS after them became live
   TypeScript. `node --check` then passed all three blocks **on the stale build**. Read the exit code first.
4. ⚠️ **A `\n` INSIDE A `<<'PYEOF'` HEREDOC WRITING PYTHON THAT WRITES PYTHON IS ONE ESCAPING LAYER
   SHORT**, and the generated harness died with `EOL while scanning string literal`. Build the strings
   with `chr(10)` rather than counting backslashes.

### What was deliberately NOT done, and why — these are the owner's to decide

⚠️ **NO NEW QUESTION WAS ADDED.** Every fix above makes an answer the runner ALREADY gives reach the plan
correctly. Three candidates were measured and are his call, with the strongest first:
- ⚠️ **"How long can you be out on a weekday?"** — the strongest of the three. **100% of non-beginner
  profiles contain a weekday run over 45 minutes, floor 59 minutes**, and `buildWarmup`'s
  `timeAvailableMinutes` is fully implemented and **never passed**. A runner with a 40-minute lunch break
  is handed a 59-minute session and no way to say so.
- **"Longest run in the past month"** — one field at first setup. `assessLongRunSpike` exists and has
  **zero callers in the app**.
- **Surfacing `masters.points`** — and ⚠️ **THE COST IS NOT "ONE FIELD, ONE RULE", WHICH IS HOW I FIRST
  PRICED IT.** Those points ship previously-unrendered clinical and nutritional advice (bone health,
  protein distribution, a menopause pointer, and a claim about **running economy**). The owner's standing
  instruction is that any change to clinical wording is flagged for review; the injury and fuelling
  guides both required sign-off; and `test/stretches.test.ts` and `test/warmup.test.ts` hard-fail on
  exactly this family of claim. So the honest cost is a screen **plus a clinical-review step that is
  his**, plus a guard file of the kind every other health surface in this app has.

⚠️ **AND FOUR THINGS WERE MEASURED AND REJECTED, so nobody re-derives them:**
- **Do not wire age into scheduling.** The handoff's 72-hour hard-day spacing is **arithmetically
  impossible** in a seven-day week carrying two quality sessions and a long run: three gaps sum to 7, so
  all three ≥3 needs ≥9. Independently reproduced over 3,023 hard-day pairs — **0 closer than 48h,
  minimum gap exactly 2 days, 33.4% sitting at 48h**. The real lever is *how many* quality sessions, and
  the engine already has it. ⚠️ **AND THE CLAIM THAT `test/generate-plan.test.ts` ALREADY GUARDS THIS IS
  MATERIALLY OVERSTATED — a finding in its own right.** Its `isHard` is
  `intensity === "hard" || type === "threshold" || type === "race-specific"`, and a long run is
  `type: "long"`, `intensity: "easy"` — so it **cannot see long→quality pairs, which are 57% of the
  minimum-gap pairs**; it runs on one fixture rather than a sweep; and it compares only within
  `w.sessions`, so it is blind to a cross-week Sunday-long/Monday-quality pair. The invariant is
  measured-true and **not guarded**.
- **Do not wire `maxHr` into the plan** — 432 profiles come out byte-identical.
- **Do not ask `yearsRunning`** — it cannot reach the engine.
- **Do not convert the volume question to minutes** — the km/minutes spread is not a defect.
⚠️ **AND TWO FIGURES FROM THE FIRST AUDIT DO NOT REPRODUCE AND MUST NOT BE QUOTED:** the Z5→Z5 share
(4.6% against 8.7% independently) and the three spacing-prototype costs, whose patches no longer exist.

⚠️ **STILL OPEN, MEASURED, NOT FIXED:** a runner returning from a break gets a **larger** week one
(350 minutes against 320) when a volume is stated — the damper is applied before the volume fit
re-converges. Reported rather than fixed, because it is a volume-model change and wants its own sweep.

## ✅ THE APP STOPPED ASKING FOR RUNNING DAYS IT THROWS AWAY (owner, 2026-09-09)

*"ive just changed my. training from 4 days per week to 6 and it is saying nothing changes? thats not
right"* — and **the sheet was telling the truth.** Measured through the real engine, identical at every
race distance: a **continuous beginner** asking 3/4/5/6/7 gets **3/4/4/4/4** runs, and a **run-walk
beginner** gets **3 at every answer**. So on the beginner track 4 and 6 build an identical plan.

⚠️⚠️ **THE DEEPER FAULT IS THAT THE QUESTION WAS ASKED AT ALL, AND THIS APP HAD ALREADY REASONED ITS WAY
TO THE ANSWER ONCE.** The **volume** question is HIDDEN for beginners (`syncStatus`) on exactly this
ground — *"a question whose answer is thrown away is worse than no question"* — while the days question
sat two rows above it offering five options that collapse to one. His ruling, from three offered:
**offer only the days the plan can use, and say why.** Not raise the cap (a coaching change to the
beginner track, which is deliberately gentle), not warn-and-ignore. Suite 1521 → **1533**;
`test/running-days.test.ts` holds 11 guards and **14 deliberate re-breaks, all 14 caught**.

### ONE DEFINITION, AND THE UI ASKS IT RATHER THAN BECOMING A FIFTH COPY

The cap was an inline literal in **four** places in `generate-plan.ts` — and one of the four drives a
**sentence the runner reads**, which is how a wrong copy became visible rather than merely untidy.
`src/domain/running-days.ts` is the only copy now, exported through `web/entry.ts`.

⚠️⚠️ **AND NOTHING MAY CLAMP THE ANSWER ON ITS WAY INTO THE ENGINE — that is the tidy-looking fix and it
is wrong.** `Athlete.daysPerWeek` carries the runner's **answer**; `runningDaysFor` says what the plan
does with it. The beginner **strength** count reads the raw answer (`generate-plan.ts:1930`,
`daysPerWeek >= 4`), so a run-walk beginner answering 3 gets 3 runs + 1 strength and answering 4 gets 3
runs + **2** strength — two different plans. Clamping at the seam would silently take a strength session
off every run-walk runner who had answered 4 or more. **That is why `CHOICE_MAX.runWalk` is 4 and not
3**, and why the two tables in that file (`RUN_DAY_SLOTS`, the running cap; `CHOICE_MAX`, what to offer)
are deliberately different numbers rather than one.

⚠️ **FIVE RAW READS MUST STAY RAW, and each is a different question from "how many runs".**
`:404` (`NO_DELOAD_MAX_DAYS` — the tier-3 gate keys on the runner's own declared frequency), `:1930`
(the strength count above), `:2045` and `:2374` (the format rotation seeds — clamping them would
collapse five answers onto one rotation and cost real session variety), and `:2392`
(`daysPerWeek <= 4`, the long-run-carries-work gate). Only the four *running-day* reads moved.

### PROVED NOT TO CHANGE ANY PLAN, THEN THE NOTE DIFFERENCE TURNED OUT TO BE A FIX

Two worktrees, sha256 over each week and over the notes, **1,920 cells** (5 distances × 6 tracks × days
1–8 × strength on/off × volume absent/present × Monday and mid-week starts): **weeks byte-identical in
every cell.** Notes differ in **280** cells, all of them beginner-with-a-stated-volume — because that
note read the main-track clamp with no beginner branch and **told somebody on a four-run build-up plan
that they needed a second run in the day.**

⚠️⚠️ **AND ITS FIRST REPAIR GAVE A RECREATIONAL 7-DAY RUNNER THE BEGINNER COPY.** Written as *"you are at
your maximum"* it fired for anyone at the top of their own offered set, which on the main track is the
six-day runner the doubles note exists for. **Caught by checking the case I was not fixing.** The branch
is keyed on *"capped by your track"* — the runner's own offered set compared against the main track's —
so it is unreachable for a runner whose ceiling is the app's ceiling.

### THE STORED VALUE IS CLAMPED TOO, AND WITHOUT THAT HALF THE FIX SHIPS BROKEN

⚠️ **TWO OF THE THREE ROUTES TO A STATUS CHANGE NEVER RENDER THE DAYS CONTROL AT ALL.**
`SETUP_TOPICS.fitness` is `["status", "volume", "recent", ...]` and does **not** include `"days"`, so a
runner can move onto the beginner track from a screen that never shows the picker — which is the
likeliest way a beginner came to be storing 6 in the first place. Clamping only what is rendered leaves
the stored value lying on every other surface. `dayAnswerOf(profile)` is now read by the profile row
(which said **"6 days / week"** over a four-run plan), by **Alfie's plan context** (the same false
premise, sent to a language model as fact) and by the wizard tile.

⚠️⚠️ **`syncStatus` RE-WIRES THE BUTTONS IT REBUILDS, AND THAT HALF IS EASY TO MISS BECAUSE `#goalBody`
NEVER NEEDED IT.** The `[data-set]` handler is attached **per button inside `wire()`**, so a segmented
control written later has no handler at all — the runner would have seen the correct two options with
**neither of them tappable**. (`#goalBody` gets away with it because its rebuild happens *before*
`wire()` runs, which is the documented reason `linkFormLabels()` has to re-run there.) `bindSegButtons`
is one definition with two callers.

⚠️ **AND THE CLAMP PRE-ANSWERED THE QUESTION ON A FIRST RUN.** `Number("")` is **0**, which folds onto
the lowest offer — so a brand-new runner arrived at the wizard with 3 already selected and no way to
tell an answer from a default. Caught by an existing guard. `daySegVal` returns `""` while unanswered
and `syncStatus` clamps only a *real* answer.

### ⚠️⚠️ THE SAME FALSEHOOD WAS LIVE ON A SECOND QUESTION, FOR EVERY RUNNER

`profileImpact` counted sessions with `PRIMARY_TYPES` — which is a **RUNNING** filter (it exists so the
picker offers only runnable types) — and used it as a session count. So turning **"Include strength &
conditioning?"** from Yes to No reported *"Nothing about your plan changes"* while removing sessions
from every week of the block. Measured after: **"Strength & mobility sessions: 3 → 1"**. Nobody reported
it; it was found by proving `profileImpact` correct on the question he *had* reported.
⚠️ **The "none" copy also dropped its causal clause.** *"Your paces and your weekly shape are the same,
so the plan comes out the same"* is a **claim about why**, and it was false for the runner who reported
this — the paces and shape were identical and the plan was too, but not for that reason. It now says
what it knows: *"Your plan comes out the same either way. Saving is safe."*

### ⚠️⚠️ AND THE PROGRESS MOMENT SHIPPED THE NIGHT BEFORE WAS BROKEN ON HIS PHONE

`el()` in this app takes an **HTML string** (`el('<div class="x"></div>')`); `planMoment` called
`el("div", "pmoment")`, which returns a **text node** whose `classList` is `undefined` — so it threw on
its first real use. It built, typechecked, passed `node --check` on all three blocks, passed **1,521
tests**, and was **installed on his phone**.

⚠️⚠️ **THE DRIVEN TEST HID IT BY SUPPLYING ITS OWN `el`.** The harness stubbed a two-argument `el`, so
it measured a program in which `el` accepts a tag name — **a probe that supplies its own dependency
measures a strictly easier program**, which this file already records for the engine's distance tables
and for `clubToneQ`'s constants. Found only by driving the real page. `test/silent-defects.test.ts` now
rejects any `el(` call given two arguments or a first argument that is not markup.
⚠️ **THAT GUARD ESCAPED ITS OWN RE-BREAK FIRST**, because its scope started at `el`'s definition and
`planMoment` is declared **earlier** in the file — so it reported clean against the exact break it
exists for. Widened to the whole app block, at which point it flagged **its own explanatory comment**
(the twelfth firing of comment-quotes-what-it-forbids) and needed comments stripped.
⚠️ **AND STRIPPING THEM HIT THE 10 KB BLIND WINDOW.** `accept="image/*"` is an unbalanced block-comment
opener mid-line, so an unanchored `/* … */` sweep eats 10,382 characters of live code — a guard with a
ten-kilobyte blind spot reports clean for anything inside it. Anchored to the start of a line and proved
with the `id="s_easypace"` landmark, exactly as this file prescribes.

### The guard that carries the claim is derived AND driven

For each of the **four status cards × four race distances**, every day the picker offers must build a
**distinguishable** plan (compared as an `Nr/Ms` shape through the real `generatePlan`), and nothing
withheld above the top offer may build something new. So the offered set cannot drift from what the
engine does in either direction, and a future change to the beginner cap fails here rather than
re-creating the report.

⚠️ **THREE EXISTING GUARDS BROKE ON CHARACTER WINDOWS** — `doSaveProfile` grew past a 4000-char slice and
past a 5000-char one, and `plan-moment`'s own 3000-char window closed early. All brace-matched now
(`fnOf`). **A character window is not a function**, for the thirteenth time in this file.
⚠️ **AND TWO OF MY OWN NEW GUARDS WERE STALE-SCOPED WITHIN THE HOUR** — one pinned a literal expression
that the extraction moved, one counted a caller whose form is `.forEach(bindSegButtons)`.

### ⚠️ HIS TRACK IS AN INFERENCE I NEVER CONFIRMED

I asked him to read his own profile row back to me (*"if it says 4 or 5, tell me — because then you're
not on the beginner track and I've got the wrong end of this"*) and shipped without the answer, because
every fix here is correct on **any** track: the picker offers what the plan can use, whatever that is,
and the four literals were a real duplication regardless. But **the diagnosis of his particular report
rests on him being a beginner-track runner**, and that is unconfirmed.

### Open, and deliberately not done

⚠️ **`wizVariants`' CANDIDATE LISTS ARE NOT FILTERED THROUGH `runningDayChoices`.** The design called it
cheap insurance; it is a separate surface with its own guards and it does not currently offer a day
count at all, so nothing is wrong today. It is the place a fifth copy would appear.
⚠️ **`assessFeasibility` PROMISES IMPROVEMENT FOR DAYS THE PLAN IGNORES — measured 143 s across day
counts whose beginner plans are byte-identical.** `daysFactor` is `0.8 + 0.06 × (days − 3)` and reads the
raw answer, so a beginner told "6 days" was quoted a goal ~6% more optimistic on the strength of runs
they will never be given. **Not fixed here**: it is a projection change needing its own sweep and proof,
and this file already records the same shape of defect being found in that function's day handling once
before.

## ⚠️⚠️ THE PLAN NEVER GETS HARDER (found 2026-10-04, while building B5 — NOT fixed, the owner decides how)

`applyProfile` builds the block from **today** on every launch: `startDateIso = (pf.startDateIso && pf.startDateIso
>= todayIso()) ? pf.startDateIso : todayIso()` (and before 2026-07-25 it was `todayIso()` outright). So the week the
runner is living in is ALWAYS week 1 of a freshly generated block — every launch, every week, since the first version.
**Measured** (5-day half, 40 km/week, race 28 Feb 2027), the week the runner actually sees, Monday by Monday from
19 Oct, against the same weeks of a plan whose start stays fixed:

| Monday | rolling (what he gets) | fixed start (as designed) |
|---|---|---|
| 19 Oct | 32.4 km, long 80′, base | 32.4 km, long 80′, base |
| 26 Oct | 31.5 km, long 80′, base | 36.6 km, long 84′, base |
| 9 Nov | 32.0 km, long 80′, base | 25.8 km, long 60′, base, easier week |
| 30 Nov | 30.8 km, long 80′, base | 36.4 km, long 102′, base |
| 14 Dec | 30.9 km, long 80′, base | 40.9 km, long 108′, build |
| 28 Dec | 37.3 km, long 80′, base | 42.7 km, long 119′, build |

The long run is 80 minutes every single week, the block never leaves "base", and the planned easier weeks never
arrive. The weeks ahead on the Plan screen ramp correctly — and are regenerated as week 1 when they come.
⚠️ **The code was written expecting past weeks to exist** — seedDone "ticks every session dated before today",
easeWeekEvidence reads "the last four plan weeks" — and with the block starting today those loops never find one.
⚠️ **And the "after time off" answer (`returningFromBreak`) becomes a permanent brake** for the same reason (B5's
chapter in `notes/plan-adaptation.md`).

**Why it is the owner's decision, not a quiet fix.** Anchoring the block at the date the plan was first built would
put a runner who started six weeks ago straight into week 7 — a long run of ~100 minutes after six weeks at 80 — the
load spike the whole engine exists to prevent. The safe fix found so far: **anchor the block at a stored start**,
written the first time the fixed build runs (so everybody's plan starts counting from that week, with no jump) and
whenever a plan is adopted from the wizard or a profile save; keep the "start today" behaviour only for a brand-new
plan and a pause. Session ids already name the calendar week (B4), so nothing stored is disturbed by the change.

### ✅ FIXED THE SAME DAY — HIS RULING: "fix the plan so it gets harder, counting from this week" (2026-10-04)

- **`planStartIso(pf)`** is the one rule: `profile.startDateIso` as it is, past or future; `""` means today.
  `applyProfile` uses it, so the block stays where it began and the weeks advance through it. Measured in the
  browser: a plan anchored 7 Sep sits in week 4 on 4 Oct (a built-in easier week, long run 62′) and climbs 80 →
  85 → 91 → 62 → 98 → 104 → 111 → 75 → 119 → 127 → 136 → 92 → 145, then the taper — the block as designed.
- **`anchorMigrate()`** runs ONCE, immediately before the launch's first `recompute()`: a plan from before the
  fix (a blank or past start) is moved to start TODAY and saved, and `interun_anchor_v1` marks it done. **Never
  from its old start** — that would have handed every existing runner the load of the week their stored start
  implies, after weeks at week 1's. A future start (a pause, or a plan not yet begun) is left alone. A first run
  only sets the mark, so its own wizard start is never moved on a later launch. Verified in the browser: a stored
  start three weeks back became today, marked, week 1.
- **Every path that adopts a plan writes a date, never a blank** (a blank would mean "today" on every later
  launch, and the block would slide again): un-pausing and "Use this plan again" write `todayIso()`; the wizard
  writes the day picked (today by default). A guard sweeps the app for `profile.startDateIso = ""`.
- **`formStartIso`**: a profile EDIT keeps the plan's own start unless the runner changes the field (or the field
  is not on screen); the old rule pulled any past start up to today on every save, which would now have
  restarted the block at week 1 on a name change. The WIZARD is a new plan: the day picked, today by default,
  never the old plan's start.
- **A pause keeps its meaning**: it sets a future start, so the block restarts on the resume date (with the
  "after time off" run-in for over a month, as before). Once that day passes it is simply the block's start and
  the weeks advance from it. ⚠️ **Open:** with progression real, a pause now resets it to the remaining block's
  first week; "pick up where you left off" (shift the block, empty the window) is worth doing with B6, whose
  "extend" option needs exactly that. **B6 (2026-10-04) built it for a lapse** (`realignPickup`: start and target
  date later by the whole weeks missed); **the pause itself still restarted the remaining block** — FIXED the same day on
  his ruling: a pause now picks up where you left off (`blockFromIso`; the last chapter of `notes/manage-plan.md`).
- **What became reachable, as designed:** past weeks exist again, so `seedDone` ticks them, and the weekly
  review's two evidence-based offers (an easier week after misses; an extra day when keeping up) can finally
  find their four weeks of evidence. Seen in the browser: "The last few sessions have not happened." with an
  ease-week suggestion — returned `quiet` because no run was logged that week (`runs.length === 0` in
  `buildWeeklyReview`), an engine rule worth a look on its own.
- **Also found and fixed:** `PLAN_PROF_FIELDS` was declared thirteen thousand lines below the first
  `recompute()`, so `journalSync`'s `planProfSnapshot` threw in its dead zone at launch and the plan history only
  ever recorded on a later rebuild. Moved up beside the store keys; driven: the row is now written at launch.
  And the history's signature (goal | first Monday | weeks) changed every Monday while the block slid, so the
  rail would have grown a "new plan" a week; anchored, it is stable (tested).
- The calendar file now includes the past weeks of the block (it exports every week); harmless, not filtered.
- **Tests:** `test/plan-anchor.test.ts` (5) — the regression drives the app's real `applyProfile` over the real
  engine on six successive Mondays and requires weeks 1–6 with the block's own long runs. `manage-plan`'s two pause
  guards restated for the new rule. **11 of 11 re-breaks caught**, the old clamp put back among them.

## ✅ B8 — TRAINING PREFERENCE DIALS (built 2026-10-05)

Three questions on **Training rhythm** (two of them in the wizard too), each moving one thing in the engine, each
hidden exactly where the engine would ignore it, and each shown in the preview before saving (`profileImpact` rows
"Hard sessions across the plan", "Longest long run", "Your first full week"):

- **"How much should your weekly mileage grow?"** About a fifth / About a tenth / About the same → `profile.volGrowth`
  → `Athlete.volumeGrowth` → `VOLUME_GROWTH` (1.25 / 1.15 / 1.05), read through `peakMultiplierFor` (the peak's
  height above the STATED mileage); `easyStartFracFor` follows (1 / multiplier). Only with a stated mileage: hidden
  with a "why" without one (the engine ignores it there), and hidden outright on a beginner track (syncStatus hides
  the mileage question and the save drops its number). Wizard: the volume step, shown as soon as a number is typed.
- **"How many hard days?"** Comfortable / Balanced / Challenging → `profile.hardDays` → `qualitySessionsThisWeek(…,
  hardDays)`. Hidden, with the reason (`hardDialWhy`), on a beginner track, on four days or fewer, and **under 18**
  (one key day a week is their ceiling — measured, 0 of 72 young plans on five and six days changed). Wizard: the
  details step (age is asked before it).
- **"How long may your long run get?"** → `profile.longMax` (0 = no limit) → `Athlete.longRunMaxMinutes` → clamps
  `peakLong` in `buildAll` to `min(natural, max(floor, cap))`. Not in the wizard (it needs a built plan to know its
  choices). Its options are `RC.longRunRangeFor().choices` (memoised in `LONG_RANGE_MEMO`), rebuilt by
  `syncLongMaxQ` when days, status, mileage, the race, the 5 km time, age or start date change (on change, never per
  keystroke — each rebuild builds a plan; the wrapper `#longMaxWrap` is always rendered).

**Defaults are byte-identical** (tested over the grid) and `applyProfile` sends nothing for a default answer.
The engine wraps in one order: `generatePlan` (growth, with its step-back) → `withLongCap` → `withHardDays` →
`generatePlanCore`. Every dial the engine could not honour says so in the plan's notes, all beginning "You asked
for…", which the preview (pi-warn) and the Plan screen show.

**What building it measured and fixed (each a guard now):**
- ⚠️ **What the growth dial moves is the PEAK's height above what they run, not growth from week one.** A 10K at
  30 km on 5 days went 27.2 → 38.3 km (progressive) and 22.7 → 32.4 km (steady): the fit takes both ends down
  together. Where a plan cannot reach the stated mileage at all, the peak stays and week one rises toward it. The
  question is worded for what it does.
- **Less growth shallowed the taper**: over 310 plans whose default taper clears 30%, Gradual took 8 under and Steady
  19 (worst 30.2% → 27.9%). The plan now steps back (Steady → Gradual → the usual) until the taper and week one hold,
  and says which (`GROWTH_FELL_BACK`).
- **Challenging built one session in the base** (0 of 576 plans gained a hard day): the base branch of
  `qualityContentsFor` now builds two. Then it shrank plans without adding a day (the fit settles under the 0.9
  scale where the second is allowed), so "must add a hard day" joined the post-condition; otherwise the balanced
  plan with `CHALLENGING_FELL_BACK` (44 of 96 audit plans fall back).
- **A cap could LENGTHEN the long run** where the race's floor sits over the absolute ceiling (146 against 145
  minutes, a slow half): hence `min(natural, …)`.
- **The shortest cap broke the intensity floor** (a 5K on three days, 50 minutes: a build week at 67.1% easy), and
  with a stated mileage the volume fit makes the midweek runs LONGER to keep the week's distance, so week one went
  past 1.10x (6 of 13 plans) and easy runs passed the capped long run (8 weeks). `withLongCap` holds a cap to the
  plan without it on all three (`fault`: easy → weekOne → longest).
- ⚠️⚠️ **Holding is NOT monotonic in the cap.** A 5K at 50 km on 6 days: caps 65–69 held, 70–81 did not (the fit
  lands on a bigger first week there), 82 and up held again. An upward-only search turned a 75-minute limit into an
  85-minute long run while 69 would have kept it. So: the picker offers only choices **asked of `generatePlan`
  itself** (quarter hours from the shortest the plan allows, each falling back to +5 / +10 minutes), and a saved
  cap that no longer holds is searched **down first** (the limit is the runner's), then up.
- **The note gives the reason measured at the cap asked for** (`longCapNote(asked, given, reason)`, reasons in
  `LONG_CAP_REASONS`: race / easy / weekOne / longest). A cap under the race's floor delivers the floor — and now
  says so (it was silent).
- **A cap is not read where the dial is not offered** (beginner ladder, run-walk, under 18: `longCapOffered`), so a
  cap saved before the runner moved onto one of those tracks changes nothing and no note names a hidden setting.
- **Empty choices are not null**: the question hides when the plan's long run is already as short as it can keep —
  unless a limit is saved, when it shows "No limit" plus that limit, so the runner can reach the setting the Plan
  screen's note names. A saved limit off the list is marked "can’t be kept exactly" only if the engine says so
  (`longMaxKept`): a saved 84 minutes can be off the quarter-hour list and kept exactly.

**Audit** (`tools/audit-progression.mjs`, "TRAINING-DIAL AXES"): every dial 0 → 0 weeks under the intensity floor,
0 → 0 first weeks over 1.10x, 0 → 0 easy runs past the long run, and no taper shallower than the default's 29.1%.
"Any run > long" rises (16 → 24 for the shortest cap): a hard session with its warm-up and cool-down passing a
shortened long run — default plans have 22 such weeks; it is the cost of a shorter long run, not an easy run. Week-
on-week rises over 10% in MINUTES go up slightly with Gradual/Steady (8.1% → 9.7% / 10.0% of steps) and Comfortable
(7.4% → 8.9%): unguarded, recorded.

**Two guards that never fire** (their re-breaks escape, honestly): the Challenging intensity post-condition (0 of
6,912 plans, 5–7 days, 5 km in 16 to 50 minutes, four runways, with and without strength) and the cap's
easy-run-longer test (0 of 1,152 plans: every plan where a capped long run lets an easy run pass it also breaks the
week-one guard first). Both kept as safety nets; the rules they protect are asserted on every plan's OUTCOME
(breaches, easy runs past the long run, week one), and breaking the week-one and easy-run guards together is caught.

**Speed:** `longRunRangeFor` builds a plan per choice — under 250 ms on this Mac for the slowest case tried; the app
memoises it per answers.

**Tests:** `test/preference-dials.test.ts` (engine, 5), `test/preference-dials-app.test.ts` (the real form readers,
builders, `applyProfile` and `profileImpact` lifted from the built page, 8), and the dial sweep in
`test/session-library.test.ts`. **29 of 31 re-breaks caught** (PLAN.md's own "Steady at 0.9" among them); the two
that escape are the never-firing guards above.

---

## A RETURNING HABIT-BUILDER NEVER GETS A HARDER SESSION — AND NOTHING MOVES THEM UP (owner, 2026-11-18)

Reported from his own new plan: half marathon in May 2027, target 1:35:00, status **"Building the habit"** chosen
on purpose (coming back from a long-term injury), comeback answer **"After an injury"**. The plan was ~21 weeks
of easy/explore runs and long runs only.

**Measured** (real `applyProfile` lifted from the built page, over the real engine; start Mon 2026-11-23, 4 days):
every week is three easy runs plus the long run, **0 quality sessions**, long run peaking at ~102′ (10 km with
the seeded 37:30 5k) or ~66′ (12 km with a 5:30 easy pace typed). The same profile **without** the comeback
answer has **19** quality sessions; the Regular runner card with "after an injury" has 18 and a long run to 132′.

**Cause:** `beginnerQualityFor` returns null when `ctx.returning` (src/plan/generate-plan.ts ~:2257) and
`beginnerHillDose` returns 0 (~:2335); `returning` is set once per plan from the comeback answer and handed to
every beginner week. Deliberate — the Hudson beginner diet of 2026-09-01, "the owner's to overturn" (notes/
plan-coaching-book.md), guarded by `test/beginner-quality.test.ts` ("a returning beginner gets none"). Nothing
promotes a runner between tracks (no silent promotion, 2026-08-25), `addDayOffer` refuses beginners and injured
runners, and the flag never clears itself (only a profile edit does; a 4-week pause and B6's "Start again" set it).

⚠️ **STALE COMMENT, NOT YET FIXED:** the comment above `STATUS_OPTS` in web/app.ts still says the comeback answer
"changes NOTHING" on the beginner track (0 of 140 sessions differ). True when written; false since 2026-09-01 —
on the beginner track it now removes every quality session and the hill sprints. The earlier paragraph in this
file that says the same is stale for the same reason.

⚠️ **TWO MODULES DISAGREE ABOUT HIM:** with a 5:30 easy pace, feasibility calls 1:35 "comfortable" (predicts
1:32:55) while the plan cannot get him there. Same defect class as the one already ruled on: fix the plan, don't
downgrade the verdict.

**The proposed answer is `STAGES.md`** (a road of stages with a checkpoint between each, the runner choosing at
every one). Not built — it needs his decisions, listed at its end, and the returning-beginner ruling goes to the
clinical reviewer. Until then his current plan is safe for its first weeks, which are exactly a Rebuild stage.

**Approved by the owner the same day (2026-11-18), all five decisions — recorded word for word at the end of
`STAGES.md`:** (1) harder sessions return after the Rebuild checkpoint, overturning the 2026-09-01
returning-beginner rule for the rest of the plan (clinical review of the wording before release); (2) moving up
only through a checkpoint the runner accepts; (3) a checkpoint is ≥80% of the last two weeks done, no pain
flagged, the stage's key run done → Ready / Nearly / Not yet; (4) *"all options available"* when time runs
short — adjust the target, a later race, or carry on with a shorter race block, never chosen by the app; (5) race
goals first, no-race goals later as their own planning round. It is `PLAN.md` **B14**; **when to build it (before
or after D4) is still his call**, listed on `docs/plan/`. The stale `STATUS_OPTS` comment above is still unfixed
— fix it when B14 touches the returning flag. **(Fixed with B14, 2026-11-18 — chapter below.)**

---

## ✅ B14 — STAGES: A ROAD TO A RACE, BUILT (2026-11-18, the day it was approved)

Built to `STAGES.md` in the order of its §8. **The owner's own case** (Building the habit + "After an injury", half on
16 May 2027 at 1:35:00, 4 days, start Mon 23 Nov) now builds as **4 weeks Rebuild → 5 weeks Base → 16 weeks race
block**: no harder session in Rebuild, one gentle one a week in Base (fartlek 4 × 30″ growing, hill reps every fourth
week, hill sprints back), then today's main-track half block — 20 quality sessions in all, against 0 before, and the
plan now reaches his goal pace before race day. His long run climbs 30 → 33 → 36 → (27) → 39 → 42 → 46 → (35) → 50
minutes through the foundation and the race block opens at 51.

### The engine (step 1) — `GenerateOptions.road`, `generateRoadPlan`, `src/plan/road.ts`

- **`road = { stages: [{ kind, weeks }], rampWeeks }`**, kinds `rebuild` | `base` | `race` (race last). Absent → the
  plan is byte-identical (dispatched first in `generatePlan`, only when given). Every week of a road plan carries
  `stage` (`PlannedWeek.stage`, `WeekView.stage`); no road-less week carries the key.
- **The race block IS `generatePlan`** on the track the runner reaches (`raceTrackAthlete`: a beginner → the main
  track; comeback flags kept, so a returner's race block is thinned at first exactly as today), laid back from race
  day for the race stage's weeks. Guarded byte for byte against today's main track for the same weeks.
- **The foundation** is built by `buildBeginnerWeek`, one stage kind per week: Rebuild sets `returning` (no quality,
  no hill sprints — for everyone: "no fast running"); Base clears it, with its own dose position (`begQualFrac`,
  over `BASE_DOSE_WEEKS` = 8 Base weeks) so quality starts at Base's first week rather than at 25% of a block.
- ⚠️⚠️ **Volume carries across the boundary because the foundation is aimed at the race block's own first week**:
  the long-run ladder climbs from the beginner opening (never under the 22-minute easy runs — `BEG_EASY_OPEN_MIN`)
  to the long run a race block of the book's length opens with; the easy runs climb on the same ramp to its
  first-week easy length (`begEasyMin`). **On `LONG_LIFT_STEP_MAX` (1.10), not the beginner ladder's 1.09**: at 1.09
  the owner's foundation stopped at 46 minutes and the race block opened at 51, a 1.109 step; at 1.10 it is 50 → 51.
- ⚠️⚠️ **A week already run never changes when a later checkpoint is answered.** Every input a foundation week reads
  is counted from the road's FIRST week: deloads (every fourth week of the road), the ramp (`rampWeeks`, stored when
  the road is made — re-broken: deriving it from the foundation as it stands re-paced the past when Base was carried
  into the race block), the Base dose (Base weeks so far), and the destination (a race block of `RACE_BLOCK_WEEKS`,
  not of whatever the race block has become). Guarded for a week more in Rebuild, two more, easing back from Base,
  and a week more in Base carried into the race block.
- **`roadFor` (placement + budget, §4)** places only the beginner track's continuous runner, comeback or not
  (`roadStartFor`). **Not yet placed, each a follow-up**: run-walk (stage 0, its own exit test), 12–17 (their ceilings
  are a separate review), and a regular runner coming back or far from race day — their foundation must start from
  the mileage they state, which the beginner builder does not read. For all of them the plan is exactly as before.
  The race block takes the book's length (`RACE_BLOCK_WEEKS` = MAX_STRUCTURED_WEEKS − 4: 5K 12 · 10K 14 · half 16 ·
  marathon 20), Rebuild 4 weeks, Base the rest up to `FOUNDATION_MAX_WEEKS` (20; beyond, a lead-in as today).
  **The foundation a runner needs** (`roadFoundationNeed`) is measured on the engine's own ladder: the fewest weeks
  whose long run arrives within one step (1.10, less a minute for the delivered rounding — re-broken) of the race
  block's opening. Short of it, the race block is the part shortened (decision 4's third choice), `shortWeeks` says
  by how much, and `fullFitsRaceMondayIso` names the earliest race the whole road fits.

**Measured** over 360 roads (5K/10K/half, 20:00–45:00 5 km, 3–4 days, no comeback / injury / break, 20–40 weeks):
the long-run step at every boundary at most **1.071**; the easy running (long + easy minutes) into the race block at
most **1.030** on roads that fit; 110 of 360 are short (mostly 5Ks twenty weeks out — a fast 5K beginner's
foundation is long because the main track's 5K long run opens near 40 minutes).

⚠️ **The weekly KILOMETRES still step up into the race block** (owner's road 25.0 → 28.4 km; worst on the sweep
1.6× for a three-day 5K), and it is not volume: it is the hard session changing from Base's fartlek to the race
block's threshold session. Two reasons it reads bigger than it is: the beginner quality sessions "build the work and
not the frame" (session-templates.ts) — the app adds a 15–19 minute warm-up at run time that the plan's counted
volume leaves out (Base's "6 × 35″ fartlek" counts 14 minutes) — and the threshold session carries its own warm-up and
cool-down in the library (54 minutes). Measured on the runner's actual running the step is about 1.08 for the owner.
**Recorded, not guarded**; worth his eye: a first threshold session of 4 × 6′ after five weeks of fartlek.

⚠️ **The race block withholds hill sprints for a returner for its whole length** (today's main-track rule,
`hillSprintDose`), so they appear in Base and stop in the race block. Unchanged here — the race block is today's
plan — and his to rule on.

⚠️ **Eight race-block weeks on the sweep sit under the easy floor** (65.7% easy: a 45:00 5K runner on three days,
coming back). Every one is today's main track's own week for that runner — guarded as "the road adds no breach the
main track lacks" — but the road is what puts such a runner on the main track at all.

**Tests:** `test/road-stages.test.ts` (7), `test/road-checkpoint.test.ts` (5), and `test/beginner-quality.test.ts`'s
returning guard restated (decision 1: none in Rebuild only; off a road still none). **Re-breaks: 9 of 9 caught**
(Rebuild given quality; Base given none; the race block on the beginner track; the ramp re-derived; the deload
cadence moved; the foundation aimed at the beginner endpoint; a stage key leaking onto road-less plans; a short
road cutting the foundation; the join margin dropped).

### The checkpoint judgement (step 3) — `src/plan/checkpoint.ts`

`evaluateCheckpoint(facts)` → Ready / Nearly / Not yet + reasons, pure over observed facts (decision 3 word for
word): ≥ 80% of the last two weeks' runs done (`runsNeeded`: 10 of 12, 6 of 7, 4 of 5), no run flagged "Did anything
hurt?" = yes, and the key run (Rebuild: the longest run rated 4 or easier against **40 minutes or the stage's own
longest planned long run where that is shorter** — a 4-week Rebuild with a deload in week 4 plans a 36-minute long
run, and a runner who follows the plan exactly must be able to pass; Base: a 2 km test run logged in the stage).
⚠️ **Two or more missing without pain is "Not yet" too, but its first choice is a week more, never easing back** —
easing back answers pain. ⚠️ **"You didn't flag pain", never "nothing hurt"**: an unanswered pain question is
absent, not fine (painAskHtml's rule).

### In the app (steps 2, 4, 5, 6) — web/app.ts, "The road to a race"

- **`profile.road`** = `{ v: 1, fromIso, stages, rampWeeks, checkpoints: [{ dueIso, kind, answer, answeredIso }] }`. The current
  stage is DERIVED (`roadLegsNow`), not stored twice. `draftFromForm` carries it through a profile edit (the object replaces
  the profile whole) and never into the wizard (`state.screen === "wizard"` → a new plan's road comes from `wizRoadFor`).
- **`effectiveRoad`** is what `applyProfile` hands the engine — asked only when the profile carries a road, so a road-less
  profile takes exactly the old path (and the harnesses that lift applyProfile keep working). It (a) fits the road to the
  runway from its own first Monday (a moved race date grows or shrinks Base, then the race block; never the weeks run) and
  (b) ⚠️⚠️ **HOLDS**: a foundation stage whose checkpoint Monday has come with no "up" recorded runs on through this week —
  decision 2, nobody is promoted by the calendar. Re-broken: without the hold the runner walked into Base unasked.
- ⚠️ **The road's consts sit beside the store keys, above the first `recompute()`** — applyProfile reads them (TDZ trap).
- **The card** (`roadCard`, after B6's in `todayCards`): shows in a foundation stage's last week, or while held; one answer per
  checkpoint (an "up" is recorded against the Monday; "more"/"ease" move the stage's end, so the card next appears in the new
  last week). ⚠️ **One question at a time**: `currentRoadCheckpoint` waits behind B9/B5/B6, and `weeklyReviewCard` is silent
  while it is up (the two order guards in reentry/realign tests restated, with the road functions in their sandboxes).
  Answers (`answerRoad`, one commit, one Undo): **up**; **more** (a week taken from the next foundation stage, then the race
  block, never under 4); **ease** (one Rebuild week inserted, plus a "make a week easier" row for it). Pain → "Not yet",
  "Ease back" suggested, and the Injury & symptoms door (`data-hub="redflags"`).
- **Facts** (`roadFacts`): planned runs in the last two weeks up to today against runs on their day (history rows AND the
  runs store — ⚠️ the history syncs lazily, and reading it alone counted 0 of 5 on a cold Today) or linked; `run.pain === true`;
  the key run from `state.logged` (RPE ≤ 4); Base's test run from `loadTwoKm()` dated in the stage.
- **Step 6 — the honest target** on the card: `PLAN.feasibility` in words (comfortable/achievable → on track, ambitious →
  little margin, unrealistic → behind + the suggested target as a choice), and when a week more would cut the race block
  under the book's length the option says so and the card lists the other choices (adjust the target, a later race). The
  plan and the verdict now agree for him because the plan was fixed (the race block reaches goal pace), not the verdict.
- **Step 5**: `roadPlanCard` on the Plan screen (bar + one row a stage, "You are here", the next checkpoint or "you chose to
  move up: Base starts on Monday …"); `wizRoadHtml` on the wizard's summary ("Here's your road: …"). ⚠️ **A short runway
  saves no road until the runner ticks "Carry on with the shorter race block"** (`wizStepError`) — decision 4, the app picks
  nothing; the other two choices send them back to the date or the target.
- ⚠️ **Base's key run is reachable from the card**: the plan schedules no test run, so the card offers "Do the 2 km test run"
  (`data-trialstart`, the existing trial flow) until one is logged in the stage — without it, following the app could never
  pass Base's checkpoint. And a short runway's tick reads "Use this road, with the shorter race block": adjusting the target
  keeps the same road, so it needs the same tick.
- **The full verify caught two of my own** (both fixed): raw px font sizes in the road CSS (the type-ladder ratchet — now
  `var(--t-*)`), and the Undo restoring `state.dayOverride` without `saveDayOverride()` before the rebuild (B4's lesson).
- **Tests:** `test/road-app.test.ts` (8, lifted from the built page). **App re-breaks: 8 of 8 caught** (no hold; card after an
  answer; a week more from nowhere; the card beside race day's question; the review beside the card; the wizard inheriting
  the old road; a moved race date re-laying the weeks run; Base's test-run button removed). **Overall 17 of 17.** Driven in the browser at phone size,
  light and dark: Ready (5 of 5 runs, no pain flagged, a 41-minute easy run), Move up (toast with Undo, the answer stored,
  the Plan screen's road), and Not yet with a run that hurt (Ease back suggested, the injury door).

### ✅ THE CHECKPOINT IS A POP-UP, NOT A CARD (owner, 2026-11-18, the same evening)

*"I want the check point to appear as a pop up on the screen rather than it appearing above the 'Hi, Adam' part of the
today screen. It looks too cluttered and as if it's just been wedged on to the screen."* Done: `roadCheckpointHtml` is the
content of the app's bottom sheet (`openRoadCheckpoint`); it is no longer one of `todayCards` (the two order guards are back
to the order they had). `maybeRoadPopup` opens it by itself **once a day while unanswered** (`ROADPOP_KEY` =
"<checkpoint Monday>|<day shown>"), beside `maybeAutoGuide` at its three moments and with its holds — never over the splash
or welcome-back, the sessions guide (which goes first), the extras offer, another sheet, or a run. "Not now" closes it; the
Plan screen's road has **"Open your checkpoint ›"** whenever one is up. Unanswered, the runner stays in the stage (the hold).
⚠️ **A real defect found in doing it**: the card's "Injury & symptoms ›" was a `[data-hub]` button, which only sets
`state.support` — from Today it re-drew Today and went nowhere. The sheet's button navigates (`state.tab = "support"`),
as Alfie's does. Driven in a browser, light and dark: it opens after the welcome, "Not now" closes it, it does not return the
same day, the Plan screen reopens it, and the injury door lands on Injury & symptoms. **Re-breaks 3 of 3** (back among
Today's cards; popping again the same day; the injury door not navigating) — **20 of 20 for the stage.**

### ⚠️ His own plan does not have a road yet

It was made before roads existed, and nothing gives an existing plan a road on its own (decision 2). He gets it by making
the plan again from the wizard with the same answers and a 23 November start — the summary shows the road before saving.

### Follow-ups (not done, each its own piece of work)

- Roads for run-walk (stage 0), 12–17 runners, and regular runners coming back or far from race day (their foundation must
  start from the mileage they state). A plan saved for later (B9 queue) starts without a road.
- ⚠️ **Found while testing, not caused by this stage:** a stored profile with `strengthDays` but no `strengthMin` makes the
  launch `recompute()` throw (`strengthPrefsOf` reads `STR_DEFAULT_MIN` in its temporal dead zone) and the app silently falls
  back to the DEFAULT profile. Profiles saved by `draftFromForm` always carry `strengthMin`, so it needs an older or
  hand-made profile — but the failure is silent and total. Worth its own fix.

### Clinical review — flagged for the owner's reviewer before release

Decision 1 (harder sessions return after Rebuild for an injured returner), the pain rule and its wording, the
Rebuild key run (40 minutes or the stage's own longest), easing back meaning a lighter week of easy running, the
2 km test run at the end of Base (a maximal effort for somebody back from injury), and the card's injury sentence.

---

## ✅ §10 — BLOCKS FOR EVERY LONG-TERM GOAL, PIECE 1: 4-WEEK BLOCKS AND THE TEST BY LEVEL (2026-11-18)

The owner approved all five decisions of `STAGES.md` §10 the evening Stages was built: *"yes to all five, build it"*
(recorded word for word against each). Built in his order, one piece at a time; this is piece 1 — decisions 1 and 5 on
the road that already existed (the beginner track's continuous runner).

### Decision 1 — a block is 4 weeks, 6 at most before a checkpoint (`src/plan/road.ts`)

- `BLOCK_WEEKS` = 4, `BLOCK_MAX_WEEKS` = 6, `blockSplit(n)`: as many fours as fit, the odd weeks on the LAST blocks (so the
  early checkpoints keep landing on the road's every-fourth-week lighter week), never a block over six; 7 is the one
  length that cannot be four-to-six and is cut 4 + 3. `REBUILD_WEEKS` is now `BLOCK_WEEKS`.
- `roadFor` lays Base out as blocks: **consecutive stages of one kind ARE consecutive blocks.** The engine flattens stages
  to one kind per week, so a road cut into blocks builds exactly the plan the uncut one did (its Base dose counts Base
  weeks so far; deloads are every fourth week of the road) — guarded byte for byte, and re-broken by restarting the dose
  at each block. The app already put a checkpoint at the end of every stage entry (`roadLegsNow`), so each block got one.
- ⚠️ **`effectiveRoad` no longer stretches a stage past six weeks.** A later race adds Base blocks before the race block
  (a last Base block not yet begun is cut again together with the new weeks; one under way keeps its end, so the
  checkpoint the runner is heading for never moves under them). A sooner race takes from the later Base blocks first —
  a later block down to nothing, the first keeping a week — before the race block gives up a week. Zero-week legs are
  spliced out before the hold reads them. The old road-app expectation "r4 b7 r16" became "r4 b4 b3 r16" on purpose.
- Names: `roadLegName` — "Base 1", "Base 2" where a kind runs to more than one block (the sheet's header, the timeline,
  the toast); `roadLine` says "16 weeks Base in 4 blocks". A checkpoint whose next block is the same stage reads "Ready
  for your next block" / "Start Base 2" / "On to Base 2." / "You chose to go on" — never "move up" to the same stage.

### Decision 5 — the end-of-block test by level (`src/plan/checkpoint.ts`)

- `blockTestsFor({ level, injured, longestKm30d })` is §10's table and the one definition: new → time on feet only;
  back from injury → a strong-but-controlled 2 km or time on feet; building → the controlled 2 km, plus a parkrun once
  the longest run of the last 30 days is ≥ `PARKRUN_MIN_LONGEST_KM` (4.5, Frandsen's per-run rule over
  `LONGEST_RUN_WINDOW_DAYS` = 30); regular/competitive → a parkrun (same gate) or the 2 km trial.
  `maximalTestAllowed` = not new and not injured.
- Base's key run (`roadFacts`): the offered tests (`offer`) plus, where time on feet counts, `timeOnFeet` = the block's
  OWN longest planned long run against the longest easy-feeling (RPE ≤ 4) run logged in it — the Rebuild rule's shape, so
  a runner who follows the plan exactly can pass. Where time on feet is the only test ("new"), the key run IS an
  easy-run. The words name only what is offered — never the 2 km trial to somebody back from injury.
- ⚠️⚠️ **The controlled 2 km.** `startTrialFlow(mode, from)`: mode "controlled" changes the trial's words on every screen
  (`TRIAL_CONTROLLED_TITLE`, `TRIAL_CONTROLLED_HOW`; RPE 7–8 to the warm-up generator instead of 9–10) and is saved as
  `effort: "controlled"` on the 2 km record. **It is a floor on fitness, not a measure of it:** it becomes `twoKmS` only
  where there is none or it is quicker, so it can lift the paces and never pull down what an all-out test set (and
  applyProfile already uses a 2 km only where it projects faster than the runner's own 5 km). Started from the
  checkpoint (`from` "road"), saving lands back on Today with the checkpoint open and the test counted.
- **A parkrun counts by the runner's own tap.** The sheet lists runs of about 5 km in the block (±10%, raceResult's
  tolerance; ⚠️ not one the runner rated easy — found in the browser, an easy 5.4 km sat beside the parkrun as a "test")
  with "Count your 5.0 km run on 16 Jan as your parkrun or 5 km test ›"; `countRoadTest` stores `run.test = "5k"` and
  turns its 5 km equivalent into the existing pace offer (`state.fitSuggest` with `test: true` — "Your 5 km test says
  your fitness has changed", Update my paces / Not now). Never a change by itself.
- ⚠️ **The weekly review's 28-day 2 km retest (an all-out effort) is no longer offered to somebody just getting started
  or back from injury** — `WeeklyReviewInput.noMaximalTest`, from the same `maximalTestAllowed`. Before this the review
  would have asked an injured returner for a maximal 2 km in the same weeks the checkpoint was telling them not to.

### Found in the browser (both fixed, both guarded)

- ⚠️⚠️ **The checkpoint popped back up over the test the runner had just chosen from it.** "Do the 2 km" renders Today with
  the test's card, and Today's render calls `maybeRoadPopup` — which opened the checkpoint again on top whenever it had
  been opened from the Plan screen (so today's mark was not yet set). It now holds while `state.trialPending`, and any
  opening of the checkpoint counts as today's showing. The old 2 km button had the same fault.
- ⚠️ **A latent one, fixed before it bit:** the sheet's test buttons were `data-trialstart`, and `wire()` binds every
  `[data-trialstart]` in the document to the all-out trial — a render while the sheet was open would have turned the
  controlled 2 km into a maximal one, started behind the sheet. They are `data-roadtrial` now, wired only by the sheet.

**Tests:** `test/road-blocks.test.ts` (8, engine) and `test/road-blocks-app.test.ts` (8, lifted from the built page);
`road-app.test.ts`'s moved-race-date and test-run guards restated. **Re-breaks: 21 of 21 caught.** Driven in a browser at
phone size, light and dark: an injured habit-builder's Base checkpoint (the controlled 2 km and time on feet, nothing
else), the controlled 2 km through to saved and counted, a habit-builder's parkrun counted to "Ready" with the pace
offer on Today, and a long road as Base 1–4 with "Start Base 2" and "You chose to go on".

### For the clinical reviewer (added to the list above)

The no-maximal-test rule and the retest gate; the controlled 2 km's words ("quicker than your usual runs, but never flat
out…", "Not a race: keep something in reserve all the way to the finish"); time on feet as an injured returner's key run
(the block's own longest planned run, felt easy, unbroken); the parkrun gate (longest run ≥ 4.5 km in 30 days).

## ✅ §10 — PIECE 2: TWO WALK-RUN BLOCKS FOR "JUST GETTING STARTED" (2026-11-18)

Decision 2: a run-walk runner (status "new", `runWalk`) is now placed on a road — **Walk-run 1 (5 weeks, to 20 minutes
without stopping) → Walk-run 2 (4 weeks, to 30) → Rebuild → Base blocks → race block**. Before this they had no road.

- **Stage kinds `walkrun1` / `walkrun2`** (`StageKind`). `roadStartFor` returns "walkrun1" for a run-walk adult (12–17 still
  unplaced). `roadFor` puts both blocks first and **never cuts them**: `WALKRUN_WEEKS` = the level counts (5 + 4); a runway
  too short for both and the shortest race block (4) lays **no road** (today's run-walk plan, unchanged); otherwise Rebuild/Base
  are budgeted after them exactly as before, and the honest numbers (`needFoundationWeeks`, `fullFitsRaceMondayIso`) include them.
- **The levels are the app's own** (`WALKRUN_LEVELS`, generate-plan.ts), paced to Couch to 5K's running minutes per session but
  not copied: 8 × 1′/1′30″ → 6 × 1′30″/1′30″ → 4 × 2′30″ (long 3 × 4′) → 3 × 5′ (long 2 × 9′) → 2 × 8′ + **the key run, 20′
  without stopping**; then 2 × 10′ + 22′ → 22′ + 25′ → 25′ + 28′ → 25′ + **the key run, 30′**. Built by the beginner week builder
  with a level override (`WeekContext.walkRun` → `walkRunSession`), so days, strength and mobility are the run-walk track's own.
  No quality, no hill sprints, every rep RPE ≤ 4, and **no lighter week inside walk-run** (the walks are the recovery).
- ⚠️ **The level is counted from the road's first week of each kind** (weeks before the plan began included), and a week past the
  last level REPEATS it (key run and all) — so "one more week" and a week held at an unanswered checkpoint are a repeat ("repeating
  a week is totally okay", C25K), and no answer changes a week already run. Re-broken: wrapping to level 1 was caught.
- ⚠️ **Rebuild after walk-run is the habit-builder's own Rebuild**: walk-run weeks are built apart, and Rebuild/Base keep their ramp,
  lighter weeks and dose counted from the first Rebuild/Base week. Walk-run 2's 30′ joins Rebuild's ≤30′ opening long run
  (`beginnerOpenMin` caps at 30) — guarded, re-broken by lifting that cap.
- **The key run is marked on the session** (`Session.keyRun = { minutes }`, absent everywhere else). The app's `roadTargetRun` counts
  it only when the plan's own key session was DONE AND RATED EASY (≤ `EASY_RPE_MAX`): a run linked to it, or a run on its day at
  least that long. An unrated run is not evidence (as Rebuild's key run). Not yet done: the sheet says the day it is in the plan.
- **The answers in walk-run**: "one more week" never takes a week from a walk-run block (`take` now takes from Base, then the race
  block, then Rebuild — re-broken: the old in-order take cut Walk-run 2 and dropped its 30′ key run); "ease back" inserts a week of
  the SAME walk-run block (not Rebuild — continuous running would be the harder week), plus the existing easier-week row.
  `effectiveRoad` never shrinks a walk-run block, and a later race after a walk-run-only road adds Rebuild before Base.
- Names: "Walk-run 1" / "Walk-run 2" (never numbered again); colour `var(--taper)`; the sheet says "Move up to Walk-run 2" and
  "repeating a week is completely normal".

**Tests:** `test/road-walkrun.test.ts` (8, engine) and `test/road-walkrun-app.test.ts` (4, lifted from the built page);
road-stages' placement line restated (run-walk is placed now); road-app and road-blocks-app harnesses gained `roadWalkRun`.
**Re-breaks: 16 of 16 caught.** Driven in a browser at phone size, light and dark: Walk-run 1's checkpoint before the key run
("in your plan on 27 Dec", one more week suggested) and after it (Ready, move up to Walk-run 2), ease back (a Walk-run 1 week
inserted, Base giving the week, Undo restoring both), and the road on the Plan screen.

### ⚠️ Found, NOT fixed (pre-existing, shared, its own piece of work)

**`easeWeek` (src/adapt/missed-sessions.ts) makes a week lighter only on paper for time-based sessions.** It replaces the week's
hardest session with an easy run, then "trims" long and easy sessions with `scaleSessionDistance`, which scales the ESTIMATED
distance and duration but not the steps — and these runs are prescribed by duration. So a week with no hard session (a Rebuild
ease week from B14, a walk-run ease week, "make a week easier" on any beginner week) is prescribed exactly as before: measured on
Walk-run 1's eased week, the key run still asks for 20′ without stopping while its estimate says 24′ instead of 28′. Fixing it
changes a shared function and what "easier" means (clinical) — for the owner to decide.
**✅ Fixed 2026-11-18/19** — the owner chose "Shorter runs, same walks" and that the key run "Stays as it is";
`shortenSession` shortens the steps for real. See `notes/plan-adaptation.md`, "AN EASIER WEEK IS EASIER ON THE ROAD".

### For the clinical reviewer

The walk-run levels (the table above), the key-run words ("If anything hurts, walk, and say so after the run"), counting the key
run only when rated easy, and easing back as a repeat of the block's last week made easier.

## ☐ §10 — HAND-OVER FOR PIECES 3 AND 4 (not built; 2026-11-18)

Each is as large as pieces 1 and 2 together, so each is its own session (CLAUDE.md: one stage per session).

**Piece 3 — decision 3, regular and competitive runners.** ✅ **Built 2026-11-19** — see the chapter below (the open
question about "one more week" inside the race block was put to the owner; Start / Ease back only until he answers).
- *Placement* (`roadStartFor`): an adult on the main track coming back (injury or break) → Rebuild; otherwise Base when the runway is
  longer than the race block (`RACE_BLOCK_WEEKS`), else a race-only road. Today every main-track runner gets null (no road).
- *Base from the mileage they state* (`pf.volKm` → `weeklyVolumeKmCurrent`; blank = the plan's own defaults): the beginner builder
  cannot read it. The natural builder is the main track's own week builder in its base phase, volume ramped from the stated km to
  the race block's first week (the foundation's aim-at-the-race-block trick), lighter week every fourth week of the road — held to
  the same guards as the foundation: volume carries across the boundary, the easy floor, past weeks never change. A returning
  regular runner's Rebuild needs the same builder with no quality (not the beginner Rebuild).
- *A checkpoint every 4 weeks inside the race block*: consecutive `race` stage entries (as Base blocks are), built as ONE race block
  byte for byte, with a checkpoint at each entry's end. ⚠️ Open: what "one more week" means inside it — §10 says it "eats into the
  block, with decision 4's choices", which needs the engine to hold or repeat a week inside a block it lays back from race day
  (it cannot yet); "ease back" there is only the easier-week row (and see `easeWeek` above).
- *Re-baselining*: the key run is the level's test — `blockTestsFor` already returns the regular runner's parkrun (gated on 4.5 km)
  or the 2 km trial; a 2 km re-sets paces through `twoKmS`, a counted parkrun through the pace offer (`countRoadTest`).

**Piece 4 — decision 4, no-race goals** (overturns decision 5's "later"). PLAN.md's non-race round: every reader of a race in the
app must tolerate none — `profile.raceDate`/`goalDist`/`targetS`, feasibility, the race-day handover (B9), Alfie's race facts, the
calendar export, the plan journal, the wizard's goal step. Inventory first. Engine: rolling 4-week blocks, each planned from the
last block's test (today `generateRoadPlan` falls back to the plain plan when a road has no race stage).

---

## ✅ THE LAUNCH READS NOTHING DECLARED BELOW IT — the strength defaults and six more (2026-11-19)

The defect recorded under Stages ("Found while testing, not caused by this stage") is fixed, and the whole class is now
guarded by a derived check instead of hand-written lists of names.

**What it was.** `strengthPrefsOf` (called by `applyProfile`, so by the launch's first `recompute()`) read `STR_DEFAULT_MIN`,
`STR_DEFAULT_LEVEL` and `STR_DEFAULT_GOAL`, declared ~21,000 lines below that call. Each is read only when the stored answer is
missing or no longer on offer (`RC.STRENGTH_MINUTES` / `STRENGTH_LEVELS` / `STRENGTH_GOALS`), so a profile with `strengthDays`
but no `strengthMin` threw in the dead zone, and `try { recompute(); } catch (e) { profile = Object.assign({}, DEFAULT_PROFILE); … }`
swapped the runner's whole profile for the default one. ⚠️ An engine change that dropped one of those options would have done
the same to every profile that had chosen it. ⚠️ After the swap, the first profile save (Training zones, say) writes the default
answers over the stored ones — `saveProfileStore` writes the whole in-memory `profile`. Reproduced in node before the fix: the
real page in a sandbox opened with `status: "regular"` and `name: ""`.

**The sweep found nine, all at that one statement:**
- Uncaught (a profile reset): the three strength defaults, via `recompute > applyProfile > strengthPrefsOf`.
- Caught inside `adoptPlan`'s own `try` blocks (a step skipped at EVERY launch, silently): `NATIVE_NOTIFY` + `NOTIFY_SYNC_T`
  (`syncNativeReminders`), `NATIVE_WATCH` + `WATCH_SYNC_T` (`syncWatch`) — invisible only because the launch's closing
  `initReminders(); syncWatch();` syncs both anyway; `SLOG` + `SLOG_T` (`migrateSlog` → `slogAll` / `slogFlush`) — the v1 → v2
  migration ran only on the first later rebuild (notes/manage-plan.md recorded that as "not changed here").
- All nine now sit in the store-key block, right after `SLOG_MAX_ROWS`, each with its reason; a pointer is left at each old home.
- Behaviour: the launch's own reminder and watch syncs now schedule, and the closing calls cancel and replace them (both
  debounce through `NOTIFY_SYNC_T` / `WATCH_SYNC_T`), so iOS still gets ONE schedule and the watch ONE sync per launch.
  `migrateSlog` now runs at launch, as its comment in `adoptPlan` always said; for anyone already migrated it returns at once
  (`meta.migratedAt`). Nothing else read at launch changed.

**The guard — `test/launch-order.test.ts` (5 tests).**
- The built page's app script is parsed with the TypeScript compiler (its checker does the scope resolution), and EVERY top-level
  statement is walked in order: its own code plus, transitively, every top-level function it names. A `const`, `let` or
  `class` declared at or below the statement is a finding; a declaration list is taken one declarator at a time.
- Rules (each pinned by a fixture script that breaks it): naming a function counts as calling it; naming a constant declared
  above that HOLDS functions walks them too; a callback runs now unless it is handed to a timer, a listener or a promise, or is
  visibly stored (assigned, a property's value, a variable's value, returned, a method); `if (!FLAG) return;` as a function's
  first line, with FLAG a top-level `let … = false` set only by top-level statements, keeps the function out until the first of
  them (`EXTRA_READY` → `refreshProgExtras`); a read inside a try still counts and is reported as "silently does nothing".
- ⚠️ WHY THIS STATIC SWEEP WORKS WHEN club-trim's DID NOT: that one flagged "a function defined above a const it captures" (57
  candidates, one real). This one follows what the launch EXECUTES, from each top-level statement — measured over the whole
  launch: the nine above and nothing else, and zero after the fix. Self-checks keep it from going blind: it must find the boot
  statement, see `applyProfile` … `normalizeWeekStarts` uncaught and `journalSync`, `migrateSlog` and the two syncs caught,
  honour the EXTRA_READY gate, and see the launch read the very constants these traps were about.
- Not seen: a function reached only through an object property it was put on inside another function; screens opened later
  (the story viewer's dead zone was in a handler — club-trim.test.ts still runs that one).
- The case itself, executed: the page's own engine and app script run in `node:vm` up to the end of the launch's first
  `recompute()` (a probe and a stop are spliced in after it, so every function below is still hoisted), with `rc_profile_v1`
  seeded: strengthDays only, and answers no longer on offer, both keep the runner's name, status and goal, and the defaults
  fill the gaps (45 / intermediate / running); a complete profile keeps its own.
- Re-broken, 4 of 4 caught (file copied aside and back each time, never git checkout): `STR_DEFAULT_MIN` back beside
  `strengthDaysOf` → both sweep tests and the sandbox ("the launch replaced the runner's profile with the default one");
  `NATIVE_WATCH` back beside the watch handover → both sweep tests, marked "inside a try"; `let CURRENT_WEEK …` moved after
  the top-level `computeToday()` → the whole-launch test only; the gate written as `if (EXTRA_READY === false)` → the self-check
  ("the EXTRA_READY gate was not recognised") plus a caught `EXTRA` finding.
- ⚠️ THE FIX FOR A FINDING is to declare the binding in the store-key block, never another try around the read.

**Not changed — the owner's call (Road Map `pc-launchfallback`).** The launch's fallback itself is still silent: any profile
the engine cannot plan opens as the default one, and the first profile save then writes the default answers over the stored
ones. Suggested: a line in Support › Your data saying it happened and why, and a copy of the stored answers kept before anything
can overwrite them. It changes what the runner sees, so it waits for him.
## ✅ §10 — PIECE 3: REGULAR AND COMPETITIVE RUNNERS' ROADS, AND A CHECKPOINT EVERY FOUR WEEKS IN THE RACE BLOCK (2026-11-19)

Decision 3 of `STAGES.md` §10 (*"yes to all five, build it"*, 2026-11-18): regular and competitive runners get roads too (Base
built from the mileage they state, a returner's Rebuild), and race blocks get a checkpoint every four weeks. Before this every
main-track runner had no road. ⚠️ **"One more week" inside the race block was put to the owner first** (the brief said so) —
its answer and what was built for it are the last section of this chapter.

### Placement and the budget — `roadStartFor`, `mainRoadFor` (src/plan/road.ts)

- `roadStartFor`: a main-track adult coming back (injury OR a break) → `"rebuild"`; otherwise → `"base"`. 12–17 still null.
- `mainRoadFor` (the beginner budget is untouched): the race block is the book's length; before it the foundation the runner
  NEEDS — Rebuild (4) when coming back, and the CLIMB from the stated mileage to the race block's first week
  (`mainFoundationNeed`, at least `BASE_MIN_WEEKS` when there is one). Spare weeks join a Base the runner already needs;
  without one they become Base blocks once there are ≥ 4, and fewer go to the race block — today's own longer block
  (`MAX_STRUCTURED_WEEKS` is the book's length + 4), so **a race-only road is today's plan byte for byte**, with checkpoints.
- ⚠️ **The climb is measured against the race block the road will lay**, not the book's: the volume fit opens a block of another
  length on another week. Short of the runway the race block shortens, and a shorter block can open higher, so the need is
  asked again (twice at most). The length the road lays its race block at is returned and stored (`destWeeks`, below).
- ⚠️ **Within one step (the race block opens ≤ 1.10× the first week's own shape at the stated mileage) there is no climb.**
  Measured without it: a 5 km runner at 15 km a week against a 17 km opening (0.88) got four weeks of Base and, fourteen
  weeks out, a shortened race block to tick — where today's 14-week block opens at 15.2 km.
- ⚠️ **A runner not coming back, with no more than today's plan's runway, gets the whole runway as ONE race block** when that
  block needs no climb (it opens lower on its ramp) — a race-only road, not a Base squeezed in front of a shortened block.
- ⚠️ **No road where even the shortest race block (4 weeks) leaves too little room for the climb**: a foundation cut short of
  its need joins its race block in a jump (measured: a marathon 14 weeks out on 15 km a week, 55 → 83 minutes into a 4-week
  block). Such a runner keeps today's plan. Short of a full race block otherwise: the race block is the part shortened, the
  proposal says by how much, and the wizard's existing short-road choices apply (decision 4).

### Base from the stated mileage — `mainFoundation`, `mainFoundationEnds`, `mainFoundationNeed` (src/plan/generate-plan.ts)

- **The main track's own week builder** (`buildWeek`) in its base phase — not the beginner builder, which cannot read a stated
  mileage. **Aimed at the race block's own first week**, as the beginner foundation is: the long run climbs on
  `LONG_LIFT_STEP_MAX` from `open` (the stated mileage's share × the race block's opening long run, never under
  `MAIN_FOUNDATION_OPEN_MIN` = 30) to that opening long run; the easy runs climb on the same ramp, **geometrically**
  (`geomLerp(f0, 1, frac)` — a straight ramp front-loads its growth), built AT THE RACE BLOCK'S OWN VOLUME FIT.
- ⚠️⚠️ **`FIT_OF`** — a WeakMap keyed on a plan's `weeks` array (every wrapper hands the array back untouched): the scale the
  weeks were built at (`weeksScale`, tracked beside every assignment — the bisection assigns `weeks` without moving `scale`,
  so `volScale` could not be read), the lazy quality reference and `easyStartFrac`. **It changes no plan** (nothing reads it
  but `mainFoundation`/`mainFoundationEnds`, and it is not part of any plan object). The last Base week at full ramp IS the
  race block's first week, so the step into it is the next step of one ladder.
- `f0` = the stated mileage over **the foundation's first week's own shape at full size** (1 when blank or already there:
  Base aims UP to the race block, never down to it; blank holds the race block's opening week — "the plan's own defaults").
  ⚠️ Against the race block's week instead, a returner at their race block's volume opened Rebuild at 1.13× what they run.
- **One quality session a week in Base** whatever the hard-days dial says (the dial reaches the race block). Base is annotated
  as a base phase of `MAIN_BASE_PHASE_WEEKS` = 6 — a CONSTANT, so nothing a Base week reads depends on how long Base becomes,
  and under 8 there is no quality-free opening: decision 1, harder sessions from Base's first week.
- **A returner keeps the main track's own returner rules in Base** (no strides, no hill sprints, gentler formats) — the race
  block after it keeps the comeback flags, so Base is no harder than the block it leads to. (The beginner road differs: its
  Base gives a returner hill sprints that its race block then withholds — recorded at B14, still the owner's to rule on.)
- **A returning regular runner's Rebuild** = the same builder with `noQuality` (no hard session) and `easyOnly` (plain easy,
  explore and recovery runs — not the moderate gear, "a gear up from easy"). ⚠️⚠️ **The hard session's day becomes an easy run
  of the ground that session would have covered** (`standInMin`: its counted volume at easy pace, never longer than a usual
  easy run), **on the hard session's own day**. Three versions failed first, each measured: a full-length easy run in its
  place made Rebuild bigger than the race block's opening (a returner at 40 km a week: 41.1 km against today's 34.6); a fixed
  shorter slot cannot shrink once easy runs reach their 95-minute ceiling (3 days, 40 km: 47.4 km of Rebuild before a 39.9 km
  race week); and drawing the stand-in from the easy-day list (four slots) left a six-day runner's Rebuild a run short.
  `standInFull`: where the race block OPENS without a hard session (a long block's own quality-free weeks), Rebuild mirrors that
  week — its hard day is a full easy run, as that week's is (otherwise the race block opened 1.14× bigger, measured).
- **The easy floor is held by construction**: a Base week too small to carry its quality session inside the intensity model
  carries none (`noQuality`), then the long run is held again.
- **A week already run never changes**: every input is counted from the road's first foundation week (weeks before the plan
  began included); `rampWeeks` and now `destWeeks` are stored on the road.

### The race block in blocks of four — `raceBlockSplit` (src/plan/road.ts)

- A checkpoint every `BLOCK_WEEKS` (4) from the race block's first week — **which is where its own lighter weeks fall** (its
  weeks 4, 8, 12…, phaseSchedule), so the test lands on a lighter week — **never inside the taper** (`taperWeeksFor`, now ONE
  definition exported from periodization.ts and used by phaseSchedule), the last entry (to race day, B9's question) ≤ 6.
  Half 16 → 4·4·4·4; 10 km 14 → 4·4·4·2; 5 km 12 → 4·4·4; marathon 20 → 4·4·4·4·4.
- **Consecutive race entries are ONE race block to the engine** (`generateRoadPlan` sums them), byte for byte. Every road gets
  them — the beginner roads of pieces 1–2 too (`roadFor` splits its race stage) — and a road STORED with one race stage (made
  before this) is cut on read by `effectiveRoad`: its sessions cannot change; its checkpoints appear.

### In the app (web/app.ts, "The road to a race")

- `effectiveRoad` merges the race entries (`roadMergeRace`), fits and holds exactly as before, then cuts the race block again
  (`roadSplitRace` → `RC.raceBlockSplit`), and passes `destWeeks` through. `roadFromProposal` stores `destWeeks` (main-track
  roads only; a beginner's road stores none and is aimed at the book's block as before).
- ⚠️⚠️ **NO HOLD INSIDE THE RACE BLOCK.** The hold stops at the race block's first Monday (it is one stage there). Unanswered, a
  race-block checkpoint lets the plan carry on as laid — holding would shorten the race block, which decision 4 says the app
  never does by itself, and there is no stage to move up to. The sheet says so: "If you don't choose, your plan carries on as it
  is." (Foundation checkpoints hold exactly as before.)
- `roadCheckpoint`: every leg ends in a checkpoint except the last (race day). `roadAnswered`: **an answer at a race-block
  checkpoint moves no week** — "Start Race block 2" is the plan as laid; "Ease back" is the existing easier-week row alone (no
  Rebuild week inserted, no week taken). ⚠️ A FOUNDATION answer takes its week from the race block AS ONE BLOCK — its floor
  is the block's (`ROAD_MIN_RACE_WEEKS`), not each four-week piece's, or no week could ever be taken.
- The race-block sheet: the level's test (`blockTestsFor` — a regular runner's parkrun once the longest run of 30 days is
  ~4.5 km, or the 2 km trial; back from injury the controlled 2 km or time on feet), the test buttons (Base's code, now for
  race legs too), and the honest target as at every checkpoint. **Re-baselining only as the runner chooses**: a counted
  parkrun goes through the existing pace offer; the 2 km trial is the runner's own act (its screen says its time sets paces).
- Names: "Race block 1", "Race block 2"…; `roadStageJob` — a regular runner's Rebuild and Base in their own words
  (`ROAD_STAGE_JOB_MAIN`; the beginner words say "one gentle fartlek" and "strength twice a week"); the timeline says each
  stage's job once in the wizard (not four times for the race block); the Plan screen's line for a race-block checkpoint ("a
  test run that keeps your paces honest, and a look at how the block went"); the wizard: "Your race block has a checkpoint
  every four weeks too…".
- ⚠️ **The weekly review's all-out 2 km retest stands aside on a road** (`roadOwnsTests`): the checkpoints ask for the test, and
  the review asking in other weeks would be the same question twice — and for a habit-builder the WRONG test (piece 1 left the
  review offering them the all-out 2 km while their checkpoint asks for the controlled one).
- Wording fix found on the way: the time-on-feet test read "a 80-minute run" — now "an 80-minute run" (8, 11, 18, 80–89).

### Measured (real engine, sweeps over 4 distances × abilities × 3/4/5/6 days × 0/15/25/40/60 km × comeback × runways)

- **The race block is today's main-track plan byte for byte in every road** (7,651 roads), race-only roads included.
- **The long run never steps more than 10% into the next stage** on any road, short ones included (worst 1.100 on whole
  minutes); like for like (the easy running where both weeks carry the same hard sessions, the whole week where the race block
  opens with fewer) worst **1.110** where the road fits, 1.066 where it is short. A foundation aimed at the book's block
  instead of the one it joins measured 1.338; one too short for the climb 1.405 (both re-broken below).
- **No foundation week breaks the easy floor.** Rebuild weeks at most 1.094× the race block's first week with a hard session.
- **Week one**: within 1.10× the stated mileage for 2,360 of 2,830 runners, against 2,186 on today's plan; worst 2.10× against
  today's 2.64×; never more than 1.12× the bigger of the stated mileage and today's own first week (the two points over 1.10 are
  the quality rotation: one profile opens on the library's 65-minute threshold session where today's opens on its 56-minute
  one — and today's own second week is that same 65-minute session). The per-run floors (a 20-minute run cannot shrink, a hard
  session has its library length) keep many low-mileage first weeks above what they state — shared with today's plan — but
  every one of 161 runners stating well under the race block's opening starts nearer their own mileage than the race block would.

**Tests:** `test/road-regular.test.ts` (9, engine, one shared sweep of ~960 roads) and `test/road-regular-app.test.ts` (8, lifted
from the built page); restated on purpose: road-stages' placement line (a regular runner IS placed) and the race block's kinds
(now four entries), road-app's "a regular runner has no road" (now 12–17), the harnesses read the race block's entries as one
(`raceAsOne`) and lift the new helpers, and road-app's test-button regex (Base OR race). **Re-breaks: 30 of 30 caught** —
placement; the race entries built as one; no checkpoint in the taper; Base from the stated mileage; Rebuild's no quality, easy
runs only, the stand-in's size, the stand-ins existing and sitting on the hard days; aimed at the block it joins; the climb;
the easy-floor fallback; past weeks; no road when the climb cannot fit; the one-step threshold; the race-only shortcut; and in
the app: race blocks' checkpoints, the cut, no hold, a foundation week taken from the block as one, race ease moving no week,
no "more" offered there, `destWeeks` stored, a regular runner's words, the review's retest, the footer, the test buttons, the
wizard's line, the race weeks read across blocks, the Plan screen after an ease. ⚠️ Three re-breaks first went UNCAUGHT and each
taught something: the easy-floor fallback fires only at very low mileage on three days (40 of 28,123 weeks — added to the
guard); the race-only shortcut matters for 8 of 1,152 runners and the first fixture was not one of them (replaced); and "no
'more' in the race block" was re-broken at a line that was not load-bearing (the per-block floor refused it anyway) — re-broken
where it IS: the sheet offering it.

**Driven in a browser at phone size, light and dark:** a regular runner's race-only half (16 weeks from 26 Oct): Race block 1's
checkpoint in its lighter week — "Nearly there" with the parkrun and 2 km buttons, the parkrun counted to "Ready for your next
block" with "Start Race block 2" suggested, the pop-up opening by itself after the welcome (dark), "On to Race block 2." with
Undo, Ease back (the answer recorded, the road unchanged, next week the easier week at 28.8 km with no hard session) and its Undo
(answer and row both gone, the checkpoint back); the wizard for a regular runner back from injury at 18 km a week ("4 weeks
Rebuild → 6 weeks Base → 16 weeks race block in 4 blocks", their own stage words, the race-block line) and the plan it saved
(Rebuild 18.2–18.7 km all easy, Base ~21 km with one threshold session, race week 1 21.5 km); the Plan screen's road in both.
**Found there and fixed:** after Ease back the Plan screen still said "your checkpoint is this week" (now "You chose to ease
back: the week of 23 Nov is lighter, then Race block 2 carries on as planned." — guarded and re-broken). ⚠️ **Not a defect,
recorded so nobody chases it:** with the browser pane hidden, screenshots can be stale frames — a "Week 1 · 26 Oct" header that
the live page did not have. Read the page's text when the pane is hidden. ⚠️ Seeding a profile by hand also needs
`interun_anchor_v1` set (or the one-time October migration moves its start to today) and the history rows (`syncHist`), or B6's
"get back on track" (which reads history rows) stands in front of every checkpoint.

### ⚠️ "One more week" inside the race block — put to the owner, 2026-11-19, not answered yet

The brief said to ask before building it. Asked (through the session that started this one), with the measured trade-off:
- **A (recommended — §10's "eats into the block"):** next week repeats the last full week; the weeks after are re-spaced over one
  week less (each later step a little bigger, never past `LONG_LIFT_STEP_MAX`; the longest runs may arrive a few minutes short);
  the sheet says so and offers decision 4's choices. Needs a HELD week inside a block laid back from race day — two-piece ramps
  (the weeks before it as laid, the rest re-laid from its level) and the volume fit pinned to the block as laid, so no week run
  changes. Point in its favour, measured: "Ease back" carries on as laid, so the next full week is two rungs up from the last.
- **B:** no "one more week" inside the race block — "Carry on" and "Ease back" only; behind → a later race or a revised target.

**Until he answers, the race block offers Start / Ease back only** (B's behaviour — `roadAnswered` refuses "more" there and the sheet
does not offer it; both guarded). If he picks A, that is the next piece of work; "Nearly" there then recommends it where runs
were missed (a missing TEST should keep recommending the test, not a repeat).

### ⚠️ Found, NOT fixed (each its own piece of work)

- **The wizard's plan cards ignore the road** ("20 weeks · peak 43 km" for a road of 26 weeks) — they describe the plan without
  it. Pre-existing since B14 (the cards never learned about roads).
- **The main track's easy-day list has four slots**, so a quality-free main-track week gives a six-day runner five runs (a
  marathon race block's own opening weeks, today's plan too). Pre-existing; Rebuild's stand-ins avoid it by using the hard days.
- **An injured returner's race block** keeps "no time trial until running is back to normal" for its whole length (their checkpoint
  test is the controlled 2 km or time on feet throughout) — nothing yet says when running IS back to normal. Clinical.

### For the clinical reviewer (added)

A regular runner's Rebuild (easy only, the hard day an easy run of the session's ground), Base for a returner keeping the main
track's returner rules, the race-block test for somebody back from injury (controlled 2 km or time on feet, all block long), and
the weekly review's all-out retest no longer offered to anyone on a road.
