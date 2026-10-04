# Adapting the plan — weekly review, easier weeks, the rebuild moment

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## The weekly review, and the rule that governs it (added 2026-08-03)

⚠️ **STANDING INSTRUCTION FROM THE OWNER (2026-08-03): ALWAYS DO THIS WITH THE RUNNER.** The app may
observe and it may propose; it may never change a pace, a plan or a target on its own. Every
suggestion ends in a choice the runner makes, and declining is a first-class answer that is
remembered rather than re-asked tomorrow. This extends the existing "suggest, never impose" rule
(p4-suggest) to everything the weekly review does, and to anything built on top of it.

**Why a weekly beat at all.** Flags fire when they fire — which for a runner having a steady month
is *never*, so the app went quiet exactly when someone was training consistently enough to be worth
talking to. `buildWeeklyReview` (`src/adapt/weekly-review.ts`, 9 tests) gives the coach a cadence.

⚠️ **IT DOES NOT RE-IMPLEMENT THE ADAPTIVE ENGINE.** `assessTrainingFlags` already decides whether
pace/effort evidence is strong enough to act on, with four guards that each cost a shipped bug
(direction sanity, anchor stamping, per-kind muting, one voice). The 2 km spec's §13 describes
roughly the same behaviour in weaker terms — adopting its version would be a downgrade wearing a
newer date. The review **calls** the engine and frames its answer.

⚠️ **HEART RATE CONFIRMS; IT NEVER DRIVES A PACE CHANGE.** This is a research position, not a
preference: HR at a given pace moves with heat, dehydration, caffeine, sleep, altitude and cardiac
drift *within a single run* — all of which look exactly like a fitness change across a week. Pace
against a known target and reported effort are the two signals that mean what they appear to mean.
So the HR path may produce a **sentence** and is structurally incapable of producing a suggestion; a
test asserts it.

⚠️ **ONE QUESTION A WEEK.** A retest offer and a pace change in the same card means one is dismissed
unread and the app cannot tell which. The pace decision wins (it is about work already done);
`weeklyReviewCard()` also returns "" whenever `trainFlagBanner()` is showing, so the same question is
never asked twice in two voices.

⚠️ **SILENCE IS A VALID ANSWER.** A card that appears every week saying "2 runs, 16 km" becomes
wallpaper, and then the week it matters it is not read either. `quiet` is returned, and the caller
renders nothing.

**Retest (spec §14):** `retestDue()` offers a 2 km every ~4 weeks — and refuses during illness or
reported soreness, in a taper or race week, and for anyone with fewer than two runs that week. Each
refusal is real: offering a maximal effort into illness is the prompt doing harm, and it teaches the
runner to ignore every future prompt. Answered state lives in `interun_review_v1`, keyed by the
week's Monday.

## ✅ "MAKE A WEEK EASIER" (owner, 2026-09-02: *"go"*)

The second half of the ch7 sentence whose first half shipped the day before: *"Low-key, low-volume
competitive runners typically don't need to schedule recovery weeks at all. **Instead, they can just take
a day off or REPLACE A HARD RUN WITH AN EASY RUN as necessary.**"* Suite 1469 → **1482**;
`test/ease-week.test.ts` holds 13 guards and **16 deliberate re-breaks were each watched failing**.

⚠️⚠️ **WHY IT WAS NEEDED, MEASURED.** Every level the app could already offer is a **FILTER**
(`adjDrops`), so the shallowest easing a runner could reach took **57%** off their week and the default
took **70–91%** — where a scheduled recovery week takes 24–28%. Somebody who wanted one notch easier had
to choose between nothing and half their week. And `applyMissedSessionAdjustment` had done exactly the
right thing since it was written — substitute the hardest session for an easy run — with **zero callers**.

⚠️ **THE GATE MOVED TO THE CALLER.** `easeWeek(week, reason)` is the mechanism; `applyMissedSessionAdjustment`
owns the two-misses gate and delegates. Written the other way round, a runner-initiated easier week would
have to **fake two missed sessions** to get one — lying to the function to obtain the behaviour — and the
wording it produces would then be false on screen.

### ⚠️⚠️ THE OBSTACLE `ADJ_MODES`'S OWN NOTE RECORDED FOR MONTHS DID NOT EXIST

It read: *"Replacing a threshold session with an easy run of the same length would mean building a session
in the app layer and keeping PLAN's display summary in step with RAW's steps by hand — two shapes, and
CLAUDE.md records what that costs."* **It never had to be built there.** `src/view/plan-summary.ts`'s
`weekView(w: PlannedWeek): WeekView` has always been the RAW→display projection; it was simply private.
Exported, the engine rewrites the RAW week and the app **re-projects** — no second builder, and the two
shapes cannot drift.
⚠️ **ONLY THE SESSION-DERIVED FIELDS ARE ADOPTED** (`sessions`, `distanceKm`, `quality`, `longRunMin`,
`focus`). `normalizeWeekStarts()` snaps every week back to its Monday **after** adoption, so
`startIso`/`start`/`startFull` on the live PLAN are no longer the engine's own — copying a whole
re-projection over the top un-normalises the week and `computeToday()` stops matching today. Guarded in
both directions.
⚠️ **AND THE ENGINE IS RUN TWICE**, which is worth knowing before relying on the correspondence:
`applyProfile` calls `RC.buildPlanSummary(ath, goal)` for PLAN **and** `RC.generatePlan(ath, goal)` for
RAW. It is deterministic, so they agree — but they are two runs, not one.

### Measured across 9,945 generated weeks

| | |
|---|---|
| training-time cut | **13.4% to 24.2%, mean 18.9%** — inside the book's own "20-to 30-percent" band |
| session COUNT changed | **0** — it substitutes, it never deletes |
| goal race touched | **0** |
| nothing to ease | **540 weeks, every one a race week** whose only sessions are the race and rest days |
| counted km RISES | **44 of 9,405 = 0.5%**, worst **+0.94 km**, while the load still falls 21–24% |

⚠️⚠️ **TIME IS THE RULER AND DISTANCE IS NOT — the third firing of that lesson in this file.** A hill or
fartlek session carries almost no counted distance for its length (CLAUDE.md records 0.50 km for a
39-minute session), so replacing it with an easy run of 70% of its duration can leave the week with MORE
kilometres. It is rare and tiny, and **the copy is worded around it**: where the distance would rise the
row reads *"about the same distance, a lot less hard"* rather than printing a rise as though it were a
cut. Tuning the mechanism to flatter the km figure would have deepened the cut past the book's band.
⚠️ **AND "NOTHING TO EASE" NAMES THE REAL REASON.** Every such week is a race week, so the row says
*"race week — nothing to ease here"*; *"already a light week"* would be technically true and useless, on
the one week the whole block exists for.

### ⚠️ IT IS ITS OWN CONTROL BECAUSE A RECOVERY WEEK IS A WEEK

The book defines one as *"a week of training in which the workload is moderately reduced"*; Going away and
Not feeling 100% are **day ranges**. Put in that sheet, a Tuesday-to-Thursday window would ease a whole
week — the control rounding its own facts up. It stores into the **same adjustment store** with a
whole-week span, so it inherits the breaks list, the Cancel, the week marking on the Plan screen and
`adoptPlan`'s ordering for free.
⚠️ **THE MODE IS DELIBERATELY NOT IN `ADJ_MODES`** — that array is rendered straight into the level
picker (`ADJ_MODES.map(mode)`), so an entry there would put a week-granular level among the day-granular
ones. `adjPhrase` is the one resolver instead, or the breaks list shows the bare word *"recovery"* while
the week marking shows something else.
⚠️ **`adjDrops` RETURNS FALSE FOR IT EXPLICITLY.** The chain happens to fall through to false for an
unknown mode, so the behaviour would be right **by accident** and the next person adding a level would
have no way of knowing a recovery row must never reach it. Easing substitutes; deleting as well would
double the cut.
⚠️ **AND THE EASE RUNS AFTER THE DAY FILTER.** If a holiday has already taken sessions out of the week,
easing it should ease what is **left** — otherwise the two windows compound into a cut neither asked for.
An ORDERING claim, guarded as one.

### ⚠️⚠️ I SHIPPED THE INVENTED-IDENTIFIER TRAP AGAIN, AND THE DURABLE FIX IS THE REAL DELIVERABLE

`openEaseWeekSheet` called **`sheetBody()`** and **`sheetOv()`** — two helpers I invented; neither exists.
The sheet opened showing the menu it came from, and the control looked live and did nothing. It built, it
typechecked, `node --check` passed all three emitted blocks and **1,469 tests passed**. Eighth firing.
Every other sheet in the app uses the `$("sheetBody")` form; `renderAdjustSheet` twelve lines up is the
pattern. **Found by driving the BUTTON rather than the function behind it.**

⚠️⚠️ **AND `test/manage-plan.test.ts` ALREADY HELD THE SWEEP THAT ASKS THIS QUESTION.** Its collection was
a **hand-written list of eight function names**, so it could not see the ninth. It now walks OUT from the
two dispatchers to the functions they call directly plus their sheet builders and wirers — **derived**, so
the next feature is in scope by construction.
⚠️ **ONE LEVEL, NOT TRANSITIVE, AND THAT IS MEASURED.** A fixed-point walk reaches most of the app and
reports **47 false positives** — platform globals (`setTimeout`, `Blob`, `FileReader`, `matchMedia`,
typed arrays), callback parameters (`onDone`, `onConfirm`, `resolve`, `rej`), and words lifted out of
prose (`everything`, `speech`, `equivalent`) — and a guard with 47 false positives is one nobody reads.
One level is where an invented helper is fatal: a control that opens a sheet.

### Four of that file's own guards updated deliberately rather than around

| guard | what changed |
|---|---|
| the menu row set | pinned at six; a seventh row is **meant** to be a decision, so the list gained `"easier"` with its reason |
| the icon count | ⚠️ now **DERIVED from the row count**. A vacuity check that needs a manual bump on every new row is one somebody eventually bumps without reading. |
| the membership list | `eased` is a third **ASKER** and not a third definition — it delegates to `adjustFor` and adds a mode test. Named with the reason, **plus a new check that it does not re-implement the range comparison**. |
| `weekMark`'s lift list | gained `adjPhrase`. The **acceptable** kind of stale: it failed loudly with a ReferenceError rather than quietly measuring less. |

### ⚠️ A SECOND WORDING DEFECT, FOUND THE SAME WAY

A runner who chose an easier week was handed a session titled **"31′ easy (eased re-entry)"** having
missed nothing, described as *"Reintroduce running gently after a break"*. The title, the description, the
focus line and both change lines now follow the reason — and it is guarded in **both** directions, so the
fix cannot be "delete the wording from both paths".

### Verification

Driven end to end in a real browser at 430×932: 18 rows with live previews, week 1 goes **48.3 → 42.4 km**,
quality **1 → 0**, long run **80 → 64 min**, session count **7 → 7**, RAW and PLAN agreeing at 42.4, the
swap titled *"31′ easy (easier week)"*, stored as one whole-week row, marked **"Easier week"** on the Plan
screen, listed under Planned breaks with a Cancel that restores all three figures and empties the store.
Document, body and sheet overflow **0**, every control at least **51px**, **zero console errors**.

Build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean apart from the
one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1482 pass / 0 fail** under UTC,
`TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`, both design ratchets unchanged.

⚠️ **TWO OF MY OWN GUARDS WERE WRONG FIRST.** Three vacuity bounds were set from a wider grid than the
guard's own and failed on correct code; and an `ADJ_MODES` slice taken to the next `const` swallowed
`adjustFor` and `adjPhrase` — both of which name `"recovery"` legitimately — and **reported the fix as the
defect**. Collection-too-wide, in the guard rather than the code.

### ✅ AND THE APP NOW NOTICES — see the next chapter

The granularity gap is closed and so is the prompt. `assessWeeklyJump`, `countTrailingMisses` and
`assessLongRunSpike` are wired into the weekly review as an `ease-week` suggestion.
⚠️ **STILL DEAD: `returnToRunningPlan`, `assessInjury` and `applyInjuryAdjustment`.** And the flags
engine's "ease off" still **INCREASES** training time — measured 295 → 350 min/wk (+19%), because a
slower anchor spends more minutes covering the same km target. That is a defect in its own right and it
is not fixed.

## ✅ THE APP NOTICES WHEN A WEEK IS WORTH EASING (owner, 2026-09-02: *"go"*)

The last piece of Hudson's ch7 sentence. The tier-3 rule removed the *scheduled* recovery week for a
low-mileage 5k/10k runner; "Make a week easier" gave every runner the manual control; this is the app
**offering** one. Suite 1482 → **1499**; `test/ease-offer.test.ts` holds 17 guards and **20 deliberate
re-breaks, 19 caught first time**.

**Three detectors that had ZERO callers since they were written** — `assessWeeklyJump`,
`assessLongRunSpike` and `countTrailingMisses`. **The fix is the import, not new arithmetic.**

⚠️⚠️ **AND THE PROGRESSION AUDIT'S COMPLAINT ABOUT THE FIRST WAS ABOUT A DIFFERENT QUESTION.** It said
`assessWeeklyJump` *"compares the planned week to LAST WEEK in KILOMETRES"* — which is wrong for
auditing the **plan against itself**, and the generator already guards that (`LONG_LIFT_STEP_MAX`, the
volume ramp, `enforceLongRunIsLongest`), which is why a planned week exceeds its own trailing mean by
30% in 0.74% of transitions. **Pointed at the RUNNER they are right as written:** `longestRunLast30dKm`
asks for the runner's own last 30 days in as many words. A plan can be internally smooth and still be a
large step for somebody who has missed half of the last month.

### ⚠️⚠️ THE FIRST VERSION FIRED ON A RUNNER DOING EVERYTHING RIGHT, AND THE CAUSE IS STRUCTURAL

Measured: **5.1% of weeks at 100% adherence.** It is not a threshold needing a nudge. **A PROGRESSIVE
PLAN MEANS EVERY WEEK IS BIGGER THAN THE TRAILING MEAN** — that is what progression *is* — so "next week
is 30% up on your four-week average" is a positive number by design for somebody following the plan
perfectly. Worse, **both detectors' own thresholds sit ON the generator's own guardrails**:
`assessLongRunSpike` fires above 1.10 and `LONG_LIFT_STEP_MAX` clamps the long-run ladder **at** 1.10,
so an on-plan runner trips it on rounding; and `assessWeeklyJump` fires above 1.30 where the plan's own
worst measured km jump is 1.36.

**So the SHORTFALL is the trigger, not the size of the step.** `EASE_MAX_COMPLETION` is
`ADD_DAY_MIN_COMPLETION` **read from the other side** — one number, two directions: above it a runner
may be offered another running day, below it an easier week. Two constants for one line would be two
answers to "is this runner keeping up", and the app builds the prescribed-against-logged array **once**,
reused by both offers.

### Measured, 2,256 weeks per row, seeded per-session coin flip for adherence

| the runner does | silent | missed | jump | long-run |
|---|---|---|---|---|
| **100% of sessions** | **100.0%** | 0 | 0 | 0 |
| 95% | 96.2% | 0.4% | 3.4% | 0.0% |
| 85% | 71.2% | 2.0% | 26.5% | 0.3% |
| 70% | 34.0% | 8.3% | 57.5% | 0.1% |
| 50% | 17.5% | 19.9% | 62.5% | 0.1% |

⚠️ **MY FIRST PROBE'S ADHERENCE MODEL WAS BROKEN AND REPORTED 7 TRAILING MISSES AT EVERY LEVEL.**
`((k*997)%100)/100 < adherence` is a fixed descending pattern that always puts the misses at the END, so
it could never produce the realistic case of a couple of recent misses — and it read `missed 0.0%` at
85% and `85.6%` at 60%, both meaningless. A seeded RNG replaced it. **Check what a synthetic model
actually generates before believing a rate it reports.**

### The decisions

⚠️ **IT LIVES IN THE WEEKLY REVIEW as a new suggestion kind, exactly as `add-a-day` did**, so it
inherits one-question-a-week, the answered store, `quiet` meaning show nothing, and the existing
refusals rather than re-implementing four of them in a second banner.

⚠️⚠️ **BEFORE THE RETEST, AND THAT ORDER IS A SAFETY CLAIM RATHER THAN A PREFERENCE.** A retest asks for
a **maximal 2 km effort**; offering one in a week the app has just judged a large step for this runner is
the prompt doing harm. Ahead of `add-a-day` means a runner who is not absorbing the current load is never
asked to do MORE in the same breath, without add-a-day needing a second refusal for it. Behind the pace
suggestion, which is the flags engine's own verdict on work already done and the bigger change — the
"one voice" rule.

⚠️ **NOT GATED ON `unwell`, WHICH IS THE OPPOSITE OF `retestDue`.** Being unwell is a **reason** to ease
a week; what must never be offered to somebody unwell is a maximal effort. `EaseWeekInput` carries no
such field at all, asserted at the type's own shape and against `retestDue` as the contrast.

⚠️ **BOTH ANSWERS COOL IT DOWN, not just a decline like `addDayOffer`.** A runner at 50% adherence would
otherwise be offered an easier week, accept it, and be offered another one seven days later — **and a
plan eased every week is not a plan.** One field, `lastAnsweredIso`, one 14-day cooldown; measured silent
at 0, 1, 7 and 13 days and firing at 15.

⚠️ **THE LONG-RUN SIGNAL FIRES ON 0.1–0.3% OF WEEKS**, which is rare enough to ask whether it is dead
code. **It is not:** driven directly, its distinct case is a runner whose weekly volume has held up but
who has been skipping the **long run** specifically — the session people skip most — and the control
(long runs done too) is silent.

⚠️ **THE EVIDENCE COMES FROM LOGGED RUNS, NEVER `state.done`.** `seedDone()` rebuilds that at every boot
by marking every non-rest session dated before today as done, run or not, so a completion figure from
there reads **100% for somebody who has not run at all**.

⚠️ **ACCEPTING GOES THROUGH `applyEaseWeek`**, the manual control's own path, so an offer accepted cannot
ease a week differently from one chosen by hand — and it inherits the snapshot-before-rebuild undo, the
breaks-list row and the week marking. **The offer itself never eases anything:** the standing instruction
is that the app may observe and propose and never change a plan on its own, which is also why
`applyMissedSessionAdjustment`'s **detector** raises the offer while its **mechanism** waits for the tap.

⚠️ **THE OFFERED WEEK IS REMEMBERED, NOT RE-DERIVED AT THE TAP.** `WeeklySuggestion` is an engine type
and the engine knows nothing about plan indices, so the accept handler would otherwise work it out a
second time — and the two would disagree the first time the clock crossed a Monday between the card
rendering and the tap. And the week offered is **the first one that has not started**: easing the current
week on a Saturday would trim a long run that has already happened and swap a session already done.

### ⚠️ IT IS UNREACHABLE ON A FRESH PLAN, AND THAT IS NOT A DEFECT

`applyProfile` clamps the start date to today, so a new profile is in week 0 and the four-week evidence
window cannot fill — **`addDayOffer` records the same obstacle**. The evidence builder returns `null` and
the engine treats absent as "do not offer"; what it must not do is throw or invent evidence. So the
engine decision is unit-tested and the **card** was driven by patching `currentWeeklyReview`, since
⚠️ **patching `RC.*` does nothing — esbuild exports are getters.**

### Verification

Driven end to end in a real browser: the card renders with "Make it easier" / "No thanks", both wired;
accepting takes the offered week **53.9 → 46.3 km**, quality **1 → 0**, long run **92 → 74 min** and
stores one recovery row; the seen marker then makes the real `currentWeeklyReview` return null and the
card is gone; all six refusals behave; document overflow 0, **zero console errors**.

⚠️ **AND `cardGone: false` IN THE FIRST DRIVE WAS MY STUB, NOT A DEFECT.** The patched
`currentWeeklyReview` ignores the `loadReviewSeen()` gate that is the real function's first line.
Restored, the marker matches the review week and the card is gone. **Check whether a harness explains a
reading before fixing the code.**

⚠️ **THE ONE RE-BREAK ESCAPE WAS MENTION-IS-NOT-USE.** The guard matched `addDayEvidence(` and a break
that **kept the call** — it is also the null guard — while hand-building its own `recentWeeks` array
walked straight past it. Restated to assert what is **passed**.

Build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean apart from
the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1499 pass / 0 fail** under UTC,
`TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`, both design ratchets unchanged.

⚠️ **STILL DEAD: `returnToRunningPlan`, `assessInjury` and `applyInjuryAdjustment`.** And the flags
engine's "ease off" still **INCREASES** training time — measured 295 → 350 min/wk (+19%).

## THE MOMENT A PLAN IS REBUILT (owner, 2026-09-08: *"do the first one"*)

His question: *"when i change anything in the app or rebuild the plan, why does it happen instantly?
In the runna app ... it takes a few seconds/moments ... almost as if the app is thinking about the
changes"*. **Measured: a 20-week half-marathon block — 140 sessions, 593 steps — rebuilds in 1.1ms
p50, 2.9ms worst**, and that already includes the volume fit rebuilding the whole thing up to five
times to land on the stated mileage. It is instant because it is arithmetic on the phone; the
comparison app is almost certainly a server round trip. Offered three answers he chose **show the
work, don't fake a delay**. Suite 1512 → **1521**; 10 deliberate re-breaks, all 10 caught.

⚠️⚠️ **AND THE TWO SLOW STAGES WERE ALREADY REAL AND ALREADY INVISIBLE, WHICH IS WHAT MAKES THIS
HONEST RATHER THAN A SPINNER.** `syncNativeReminders` debounces **400ms** and reschedules up to 60
iOS notifications; `syncWatch` debounces **500ms** and pushes the block over WatchConnectivity. Both
sit in `adoptPlan` inside `try/catch` **with an empty body** — so they ran after the screen had
already changed, and a failure was indistinguishable from success. This surfaces work that was always
there rather than adding any.

⚠️ **EVERY STAGE NAMED GENUINELY RUNS, AND A STAGE THAT DOES NOT APPLY IS NOT SHOWN.**
`planMomentStages()` is **derived from the same conditions the work itself is gated on** — never a
fixed list — so a line promising *"Sending it to your Apple Watch"* cannot reach somebody with no
watch. Driven across every combination rather than grepped: reminders off, permission denied, no
notification bridge and no breaks booked each correctly drop their stage.

⚠️ **NOTHING REAL TO WAIT FOR MEANS NO MOMENT AT ALL** (`stages.length < 2` returns after committing).
A runner in a browser, or on a phone with nothing connected, still gets the instant rebuild — because
for them it genuinely IS instant, and a spinner there would be exactly the invented delay he
rejected. **That bail-out is the half that keeps the feature honest, and it is guarded.**

⚠️ **THE DWELL IS A FLOOR UNDER REAL WORK, NOT AN ADDITION TO IT** —
`PM_DWELL_MS - (Date.now() - t0)`, so a stage that took longer waits no extra time. 340ms, guarded in
**both** directions: under ~200 a line cannot be read (defeating the point) and over ~600 it stops
being legibility and becomes the fake delay.

⚠️ **A STAGE IS CONFIRMED BY A STAMP NEWER THAN THIS REBUILD.** `SYNC_RAN` records when each deferred
body last ran, **negative on failure**, and `planMoment` waits for `Math.abs(stamp) >= since`.
Reading the raw stamp would let a PREVIOUS rebuild's success be reported as this one's — the
stale-evidence fault this file records for anchor stamping and the flags engine.
⚠️ **AND THE WAIT IS BOUNDED** (`PM_CEIL_MS` 3500). A native side that never answers must not trap
the runner behind a modal, and the ceiling must outlast both debounces without stranding anybody.

⚠️ **IT RUNS THE CALLER'S OWN COMMIT AND IS NOT A SECOND COMMIT PATH.** `planMoment(commit, then)`
takes the existing synchronous commit unchanged, so `adoptPlan` stays the one place a plan is
adopted — the trap that function's own note is about. A guard forbids `adoptPlan(`, `applyProfile(`,
`PLAN =` and `RAW =` inside `planMoment`, and requires the commit handed to it to still contain
`restoreTicks(keptTicks)` — the line that has silently gone missing from this path before.

⚠️ **OPT-IN AT THE DELIBERATE PATHS, NEVER IN `adoptPlan`.** **33 call sites** reach
`recompute()`/`adoptPlan()`, including one at module top level, so baking it in would put a modal over
the launch and over every internal repaint. Guarded both ways: absent from `adoptPlan`, and the
reference count bounded so it cannot spread.

⚠️ **`wizardFinish` IS DELIBERATELY NOT WIRED, AND THE REASON IS THE HONESTY RULE.** It applies the
reminder choice **after** `adoptPlan` (`REMIND.enabled` is still false when the stage list would be
derived), so the moment would omit a reminders stage that then runs — a misreport. Fixing that means
reordering the first-run sequence, which is its own change. At genuine first run there is no watch and
no reminders anyway, so the moment would be empty; the misreport only bites on a SECOND plan.
⚠️ **Worth knowing separately: that ordering means the first plan's `syncNativeReminders` runs with
reminders still disabled and posts `clear`**, and `initReminders()` afterwards is what actually
schedules. Not touched here.

### Traps this paid for

⚠️ **A CHARACTER WINDOW IS NOT A FUNCTION — THIRTEENTH FIRING, AND IT BROKE TWO EXISTING GUARDS.**
`doSaveProfile` grew from ~4.4KB to **5116 chars** when the rebuild moved behind the moment, and both
`test/first-run.test.ts` and `test/silent-defects.test.ts` slice it at a fixed 4000/5000 — so a
navigation that is demonstrably still there read as missing. ⚠️ **`first-run`'s own comment already
recorded being bitten by adjacency once** and had anchored on the facts while keeping the window.
**Both now brace-match via `fnOf`, because widening a window only defers the same failure** — and the
restated guard was proven to still bite by removing the navigation for real. My own new guard made the
same mistake in its first version.

⚠️ **THE BACKTICK RULE FIRED AGAIN — BUT MY OWN PATCH GUARD CAUGHT IT BEFORE THE BUILD COULD**, the
first time that has happened here. Doc-comment backticks around identifier names; the patch script
asserts no backtick in any added text.

⚠️ **I COULD NOT EYEBALL IT.** Browser navigation to localhost is denied to this session and
`Page.captureScreenshot` hangs in this headless Chrome, so the card's **appearance is unverified**.
What is covered without eyes: every `var()` resolves (13 tokens, 0 undeclared), both design ratchets
unchanged, and every colour pairing it uses is already asserted by `test/contrast.test.ts`.

## COMING BACK AFTER TIME OFF: HOW QUICKLY TO BUILD BACK UP (stage B5, 2026-10-04)

PLAN.md B5: *"Coming back after time off: choose how quickly the plan builds up again."* When a **Going away** or
**Not feeling 100%** break that took running out has ended, Today asks once, in the first week back: **"How quickly
do you want to build back up?"** — **Slowly** (two easier weeks), **Balanced** (one easier week), **Quickly** (carry
on as planned). Each answer quotes what it does to the weeks ahead (*"Week 2: 27.9 → 24.5 km · Week 3: 31.5 → 27.2
km"*, or *"Week 2 stays at 27.9 km"*). One tap acts, with Undo straight after. Web-only.

**Which breaks ask.** A window of kind `holiday` or `ease` at any level but "everything as planned"
(`REENTRY_MODES`: none / easy / easyspeed) whose last day is behind us, and no more than `REENTRY_ASK_DAYS` (7) ago —
the first week back, the window in which the answer can still change anything. Never a pause (it asked its own
question up front), an easier week, a skip, or a holiday run as planned.

⚠️⚠️ **THE BREAK IS RECORDED IN ITS OWN STORE, `interun_reentry_v1`, BECAUSE THE BREAK STORE FORGETS IT.** `saveAdjust`
drops every window that has ended on every write, so a holiday that ended yesterday was gone the moment the runner
skipped a session or booked anything, and the question it should raise could never be asked. `reentryCapture(rows)`
runs **at the top of `saveAdjust`, before its prune**, and **at launch** right after the first `seedDone()`. Driven
in the browser: the record cleared, a session skipped, the skip's write pruned the ended holiday — and the record was
written first and the card came back. The newest ended break wins, and the same break keeps its answer (declining is
remembered, never re-asked).

**The answers are existing mechanisms.** An easier week is exactly the row `applyEaseWeek` writes (`kind/mode
"recovery"`, Monday to Sunday), so it lands in Planned breaks with its Cancel, in the week marking, and in
`applyAdjustments` for free. Slowly writes two (distinct ids, or Cancel would take both), Balanced one, Quickly none
(and does not rebuild). One commit, one Undo; **Undo puts the question back as well as the plan** — an answer taken
back is no answer.
**The weeks** are the first plan week that has not started and the one after — the rule the ease offer already uses
(*"you can only ease a week you have not run"*) — previewed by `easeWeekOptions`, the same function the Manage plan
control and `applyEaseWeek` go through.
⚠️ **ONE DECIMAL, FOUND IN THE BROWSER.** Quoted in whole kilometres like the Make a week easier sheet, the card
promised "28 → 24 km" and the week then read 24.5 km on the Plan screen. `reentryKm` rounds the way plan-summary's
`km()` does, and a test holds the promise to the plan after the answer (both answers, every week).
⚠️ **AN ANSWER THAT DOES THE SAME AS A QUICKER ONE IS NOT OFFERED** (two weeks where only one can be eased), and a
recommended answer that is missing passes to the next QUICKER one: it is missing because its week is already easier
(the runner eased it) or has nothing to ease, so the step the tier asks for is in the plan or cannot be taken. No
question at all when every gentler answer would do nothing, while paused, or outside the plan.
**Recommended by `pauseTierFor`** — the repository's own lines for time away: up to a week, carry on; up to a
fortnight, one easier week; more, two. The card explains the length in the tier's own `why` (one definition).
⚠️ **ONE QUESTION AT A TIME.** The card is first in `todayCards()` — it is about the days ahead of someone who has just
come back; a pace flag or a review built from before the break can wait — and `weeklyReviewCard` returns nothing while
it is open (PLAN.md's re-break: remove that and two questions render).

### ⚠️⚠️ NOT THE "AFTER TIME OFF" ANSWER — PLAN.md'S SKETCH NAMED THE PAUSE'S REBUILD FOR A LONG BREAK

Measured: because `applyProfile` rebuilds the plan from today on every launch, `returningFromBreak` re-shapes
**whichever week the runner is in, every week, for as long as it is set** — this week's long run 61 minutes instead of
80, and four weeks on 48 instead of 60 (5-day half, 40 km/week). It is a brake that never comes off. A pause of more
than four weeks sets it (`applyPause`, the "reentry" tier) and nothing clears it on its own (only the runner, by hand,
in the profile). B5's Slowly is two dated easier
weeks instead: they end, they are listed, and they can be undone. A guard holds `answerReentry` away from `returning`.
The deeper cause is the next item — **FIXED the same day** (the block is anchored where it began), after which the
flag re-shapes only the block's first weeks, which for somebody coming back mid-plan are long past: still the wrong
tool, now because it would do nothing.

### ⚠️⚠️ FOUND UNDER IT: THE PLAN NEVER PROGRESSES — see `notes/plan-profile.md`, "THE PLAN NEVER GETS HARDER"

**Tests:** `test/reentry.test.ts` (8) drives the real lifted functions over a four-week plan built with the engine's
own `weekView` and `easeWeek`. `skip-session` and `move-week` lift the capture now (their `saveAdjust` calls it).
**16 of 16 re-breaks caught**, PLAN.md's own (the review not suppressed) among them.
