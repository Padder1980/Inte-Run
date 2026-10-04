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
  date later by the whole weeks missed); **the pause itself still restarts the remaining block** — Road Map step
  `pc-pauseresume`, waiting on the owner.
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
