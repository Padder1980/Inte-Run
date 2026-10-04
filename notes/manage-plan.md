# Manage plan — pause, holiday, plan history, move a workout

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## MANAGE PLAN, PAUSE, AND PLAN HISTORY (owner, 2026-08-28)

*"I want the ability on the plan page to have a button that enters a menu to make a number of
adaptions"* — five items, with screenshots. Two are in and shipped; the research he asked for is below.
Suite 1383 → **1394**; **37 deliberate re-breaks across two rounds, all caught**. All web, so all of it
reaches his phone over the air.

⚠️ **AND THE ANSWER TO HIS FIRST QUESTION WAS NO — THE WEEKDAY-TIME TASK IS NOT FINISHED.** It is
measured and prototyped in `/tmp` and nothing of the ceiling is in the repo. What DID come out of that
work is the regression in the chapter above. Say so plainly rather than reporting adjacent progress.

### ⚠️⚠️ FIVE ADAPTATION FUNCTIONS EXIST IN THE ENGINE AND NOT ONE WAS CALLED BY THE APP

`returnToRunningPlan`, `assessWeeklyJump`, `applyMissedSessionAdjustment`, `countTrailingMisses` and
`assessLongRunSpike` — **0 references in `web/app.ts` each**. That is the computed-and-discarded trap
five times over, and it is most of what this menu needs, so the remaining items are wiring more than
writing. `returnToRunningPlan` is exported through `web/entry.ts` and reaches nothing.

### THE PAUSE THRESHOLDS ARE THE REPO'S OWN, NOT NEW NUMBERS

He asked for research rather than a guess. The lines are bounded by what this engine can actually do
differently:
- ⚠️ **`src/adapt/load-guardrails.ts`'s `returnToRunningPlan` ALREADY DRAWS ITS LINE AT `weeksOff >= 4`**
  ("take it slower given the longer break"), so four weeks is this codebase's existing long-layoff
  threshold and there was no reason to invent a second one. `test/manage-plan.test.ts` reads that
  constant out of the engine, so moving it fails the pause guard.
- **`src/adapt/missed-sessions.ts` handles missed work WITHOUT a rebuild** — easy runs ×0.85, long run
  ×0.8, hardest quality session dropped. That is the mechanism for a short gap and it exists precisely
  so a fortnight does not need a new plan.
- ⚠️ **`Athlete.returningFromBreak` IS THE GENERATOR'S ONLY LEVER FOR TIME OFF AND IT IS BINARY** — it
  knows you had a break, not how long. Measured on a 5-day half block at 40 km/week: week one
  **32.0 → 30.2 km**, first long run **80 → 61 min**, **5 of 28 quality sessions gone**, and the PEAK
  unchanged at 51.3 km. **A break changes the run-in, not the destination**, and that sentence is what
  the tier copy says.
- ⚠️ **`returningFromBreak` AND `returningFromInjury` PRODUCE AN IDENTICAL PLAN** for a recreational
  runner (both 30.2 km / 61 min / 23 quality). CLAUDE.md already records them as byte-identical for a
  beginner; they are byte-identical here too. Worth knowing before anything is built on the distinction.

⚠️ **THE GENERAL DETRAINING CONSENSUS IS LABELLED AS CONSENSUS.** The commissioned evidence report is
NOT in the repo (searched) and is scoped to prescription, not detraining — and this file already records
the fuelling module being wrongly described as report-backed. What is uncontroversial is the ORDERING:
plasma volume falls within days, aerobic fitness holds about a week then declines, and tendon and bone
de-adapt more slowly than the cardiovascular system — which is exactly what `returnToRunningPlan`'s own
note says. The tiers follow that ordering and claim nothing more.

⚠️ **THE PAUSE ENDS IN A CHOICE, NEVER A CHANGE** (standing instruction, 2026-08-03), and every option
QUOTES ITS CONSEQUENCE — the reference's own sheet gives real end dates, and "your plan will end later"
without saying when asks somebody to agree to a number they cannot see. Driven: **28 days moves the
target from 14 Feb to 14 Mar and rebuilds 25 weeks into 29**.
⚠️ **I RECOMMENDED THE WRONG OPTION FOR A LONG BREAK AND CAUGHT IT BY DRIVING IT.** After a month off
the first version recommended KEEPING the target date, which compresses the whole block at exactly the
moment the runner is least ready for it. Moving the date is recommended for every break over a week;
keeping it is always offered (a booked race does not move) and never recommended.

### PLAN HISTORY: ONE STORE, EXTENDED

A new plan replaced the old one and the old one was gone. ⚠️ **THE JOURNAL ROWS `adoptPlan` ALREADY
WRITES WERE ALREADY THE RECORD OF A BLOCK** — the club's plan-journal rail reads them, and they are
already in the backup by the `interun_` prefix. A second "recent plans" store would have given one fact
two homes, and the two disagree the first time somebody deletes from one of them. The row gains three
fields:
- ⚠️ **`createdIso` IS THE DAY IT WAS MADE, NOT THE DAY IT STARTS.** `startIso` is the first week's
  MONDAY, which `normalizeWeekStarts` can put before today — so a plan made on a Thursday would have
  listed as created three days before it existed.
- ⚠️ **`name` IS EMPTY UNTIL THE RUNNER TYPES ONE**, so clearing the field goes back to the derived
  default rather than to nothing. `planName()` derives it from the goal.
- ⚠️⚠️ **`prof` IS THE ~20 FIELDS THAT DETERMINE A PLAN, AND DELIBERATELY NOT THE PLAN.** A plan is
  ~200 KB of steps; storing it would also freeze it against an engine that keeps improving, so
  re-activating an old goal would hand back a block built by whatever version was current when it was
  abandoned. **`avatar` and the person's `name` are excluded**: an avatar is a 256px data URL and
  twenty-four of them in a capped list is megabytes of duplicated image in the store the whole training
  history lives in.

⚠️ **THE MIGRATION CASE IS THE COMMON CASE FOR EVERY EXISTING RUNNER.** Rows already on a phone have no
name, no `createdIso` and no `prof`. They list (name falls back to the goal, date to the first week's
Monday) and offer **no reuse button at all** — absent, not disabled, because a greyed control on every
historic plan advertises something the app cannot do for them.
⚠️ **REUSING REBUILDS FROM THE ANSWERS AND PULLS A STALE DATE FORWARD.** `applyProfile` clamps the start
to today, so a target date in the past produces a plan with **no weeks in it**; the sheet says which of
the two happened. Driven: 10k → marathon, target kept, 41 weeks, landing on the plan tab.
⚠️ **DELETING ASKS, BECAUSE THERE IS NOTHING TO UNDO.** The club's delete dialog established the rule —
a confirmation earns its tap when the thing is gone, and is a tap for nothing when it is recoverable.
The dialog says the runs are untouched and that the club's journal loses it too.

### FIVE DEFECTS THIS FEATURE PRODUCED DURING ITS OWN BUILD

⚠️ **TWO INVENTED IDENTIFIERS, BOTH WOULD HAVE SHIPPED AS A TILE THAT LOOKED LIVE AND DID NOTHING.**
`prefersReducedMotion()` does not exist — this app honours the setting GLOBALLY in CSS and browsers
suppress a smooth scroll themselves — and `openHub()` does not exist: a hub page is opened by setting
`state.support` and rendering. Caught by an existence sweep over every bare identifier the dispatchers
call. ⚠️ **That sweep needed three corrections of its own**: it matched `.scrollIntoView(` and
`JSON.stringify(` as missing functions (a method call is a property of something else), and `$` is
defined as `const $ = (id) => …` and is a regex metacharacter, so escaping every name matched nothing
and reported twelve real functions as absent.

⚠️⚠️ **`isoAdd` RETURNS A DATE, NOT A STRING, AND THE ONLY SYMPTOM WAS A SHEET THAT STAYED OPEN.** Every
existing caller appends `.toISOString().slice(0, 10)`. Assigned straight into `profile.raceDate` the
whole apply path threw inside its own `try/catch`: the date never moved, the sheet did not close, and
the option's "your target date becomes …" sentence rendered EMPTY because `runDateLabelIso` splits a
string on "-". **Found by driving the button, not by reading the code** — and the reason to drive the
control rather than the function it calls.

⚠️ **A HIT AREA MEASURED BY READING THE BOX AND ADDING THE INSET IS THE ANSWER YOU ASSUMED.** A box
cannot report its own pseudo-element. Bisecting `elementFromPoint` found the rename pencil at **40px**
against this app's 44 floor, and the two action icons 2px apart **overlapping each other's grown areas
so the left one won 34 of its 44** — fixed with a 12px gap, which is exactly 6+6.
⚠️ **AND `elementFromPoint` ANSWERS ABOUT THE VISIBLE VIEWPORT**, so cards below the fold read 0×0 and
looked like catastrophic failures. Two more read as covered by `bottomnav` — scrolled to the bottom the
last card clears it by **101px** and its controls are hittable, so there was no defect. Filter to
on-screen controls, and test the scrolled-to-bottom case explicitly.

⚠️ **THE TWO DESIGN RATCHETS CAUGHT THIS CSS**, which is what they are for: one off-ladder radius
(10px → `var(--r-ctl)`), and `.rp-name` declared **three times** with `.rp-acts` twice. **A duplicate
declaration cannot be SEEN on screen** — the later rule simply wins — which is why that ratchet is a
count rather than an eye. `CSS_DUP_CEILING` is unchanged.

### Guard weaknesses this round, and the pattern

⚠️ **`rows` IS THE VARIABLE NAME THREE UNRELATED STORES USE**, so "nothing else adds a journal row"
counted `rows.unshift(` and reported the club's posts and one other store as writers of the plan
history. Scoped to `unshift({ sig:` — the field only a journal row has. **A guard over a collection is
only as good as the collection.**
⚠️ **`applyPause` HAS TWO `restoreTicks` CALLS — the apply and the undo closure — so a bare
`/restoreTicks\(/` PASSED with the apply path's removed.** Watched escaping. Counted as the pairing
`seedDone(); restoreTicks(` and required twice. `doSaveProfile` was the one rebuild path in this app
that ever missed that pairing, and editing your profile silently un-ticked the run you had done that day.

### Still open, and named on the menu rather than offered

**Holiday** and **not feeling 100%** use the same machinery as Pause with different dates and a level,
so both are small additions now. **Naming is done; what "start a new plan" still lacks is nothing** —
the wizard already builds one and the old plan now moves into the list by itself.
⚠️ **AND THE MENU SAYS WHICH TWO ARE MISSING, IN ONE SENTENCE** — the same answer the Create sheet gives
reels and going live, and the rule this app keeps everywhere: no control ships before the thing behind it.
⚠️ **NOT SEEN ON A PHONE.** Everything above is measured in a headless browser. The tile labels wrap to
two lines and the pause option cards are wordy; worth the owner's eyes.

## ⚠️⚠️ THE PAUSE LEFT EVERY SESSION IN THE WINDOW (owner, 2026-08-28, within the hour of shipping)

*"ive tested the pause button but it leaves all the sessions in for the selected amount of pause time"*
— and he was right. Suite 1394 → **1400**; **27 more re-breaks, all caught** (two only after a guard was
restated). All web.

⚠️ **THE FIRST VERSION MOVED THE TARGET DATE AND REBUILT, WHICH IS THE HALF THAT LOOKS LIKE THE JOB.**
It grew the block by exactly the right number of weeks and **left the plan STARTING IN THE PAST**, so
the days he had just told us he would be away were still full of sessions. Reproduced exactly: pausing
28 days moved the race **14 Feb → 14 Mar** and grew the plan **25 → 29 weeks** while leaving
**21 runs inside the 28-day window** and the next fortnight **byte-identical** to before.

⚠️ **THE LEVER IS `profile.startDateIso`, AND IT ONLY WORKS BECAUSE `applyProfile` HONOURS A FUTURE
ONE.** Its clamp is `pf.startDateIso >= todayIso() ? pf.startDateIso : todayIso()` — it refuses a date
in the past and accepts one ahead. Set to the day the pause ends: **0 runs in the window**, and the
block back to its original 25 weeks. A guard reads that clamp out of the app, because the whole
mechanism depends on it.
⚠️ **SET FOR "KEEP MY TARGET DATE" TOO.** Keeping the date with no start date is the same defect wearing
the other option's clothes: a rebuild from today into an unchanged deadline.

⚠️⚠️ **AND EMPTYING IT WAS ONLY HALF THE FIX.** Leaving Today blank and jumping the week band three
weeks forward is what that fix produces on its own. Measured before the card existed: `TODAY_IN_PLAN`
false, **1,748 characters on screen and not one of them the word "paused"**. `pausedCard()` says when
the plan picks up and how many days are left.
⚠️ **AND IT CARRIES THE WAY BACK — before this there was NO way to end a pause early at all.** Pause
four weeks, come back after one, and the app had nothing to offer but three more weeks of nothing. **A
state you can enter and cannot leave is worse than one that is merely missing.**
⚠️ **DERIVED, NOT STORED.** A future `startDateIso` IS the pause, so there is nothing to keep in step
and nothing to go stale. A pause store would be a second answer to "are they away", and the two would
disagree the first time somebody edited their start date on the profile screen instead. Guarded by
sweeping the store keys for one.

## HOLIDAY AND NOT-FEELING-100% ARE ONE MECHANISM, AND PAUSE WAS ITS THIRD MEMBER

Both are **a window of dates and a level of training inside it** — which is what pause is too. That is
why they were a small addition rather than two more screens, and why they share one sheet builder with
two headings: two builders over one mechanism is how the two come to behave differently for no reason.

⚠️⚠️ **IT REMOVES SESSIONS AND NEVER REWRITES THEM, AND RUNNA'S OWN FOUR LEVELS MAP ONTO PURE REMOVAL
EXACTLY.** "Easy, long and hard runs" removes nothing; "easy and speed" drops the long run; "easy runs
only" drops the quality sessions and the long run; "not planning on running" drops every run. So no
session has to be built in the app layer and **`PLAN`'s display summary never has to be kept in step
with `RAW`'s steps by hand** — two shapes, and this file records what that costs.
⚠️ **ONE THING RUNNA DOES IS THEREFORE NOT DONE: its "easy runs only" also strips the pace targets from
the runs that remain.** Ours leaves them, and the copy does not claim otherwise.

⚠️ **APPLIED ONCE, INSIDE `adoptPlan`, AND BEFORE THE TWO SYNCS.** A rebuild happens on every launch
(`recompute()` runs at module level), so an adjustment applied anywhere else is undone by the next one.
And run AFTER the syncs, **iOS would hold reminders for sessions the runner has just said they will not
be doing, and the wrist would hold them too** — an ORDERING claim, guarded as one.

⚠️ **`RAW` IS THE TRUTH AND `PLAN` IS A PROJECTION OF IT, so BOTH are filtered.** Filtering only `PLAN`
leaves the wrist and the session sheet still prescribing the work (they read `RAW`); filtering only
`RAW` leaves the chart and the week summaries showing a full week the runner is away for. Both
directions are re-broken.
⚠️⚠️ **AND THE WEEK'S MILEAGE COMES FROM THE ENGINE'S OWN `weekVolumeMeters`, WHICH HAD TO BE EXPORTED
FOR IT.** `src/domain/steps.ts` is the single definition and its own note records what a second one
cost: when `trainingDistanceMeters` arrived, six call sites were updated and two were not, and an
adjusted week came back **measured on a different scale from every other week in the same plan**
(40.9 → 44.1 km while every session in it got shorter). `web/entry.ts` now re-exports it.

⚠️ **THE GOAL RACE IS NEVER REMOVED AT ANY LEVEL.** It is what the whole block exists to reach, and a
holiday that quietly deleted it would be the app throwing the plan away rather than adapting it.
Verified by placing a "not running" window on race day itself: the race survives.
⚠️ **A NON-RUN GOES ONLY IF THE RUNNER ASKED.** Strength and mobility are already optional, and Runna's
own sheet makes removing them a separate switch rather than part of the level.

⚠️ **THE SHEET'S PREVIEW COUNT ASKS THE SAME PREDICATE THE APPLICATION WILL ASK.** It quotes a number
the runner is agreeing to, and a second estimate would be a second answer. Measured across the four
levels on one real week: **0 / 1 / 2 / 6 sessions**.
⚠️ **THE SESSION'S OWN DAY, NOT `effDay`.** A session the runner has MOVED into the window is one they
decided to put there after the window was set; honouring the move is the right answer, and reading
`effDay` here would silently delete it.
⚠️ **PAST WINDOWS ARE DROPPED ON EVERY WRITE.** An adjustment is applied at adopt time, so one that has
ended can only make the next rebuild slower and the store bigger. The runs done during it are in the
logbook, which is the record.
⚠️ **AND AN ADJUSTMENT NEVER TOUCHES THE TARGET DATE — that is what separates it from a pause**, and the
menu says so. Guarded by sweeping `saveAdjustDraft` for any write to `raceDate`, `startDateIso`,
`targetS` or `daysPerWeek`.

**Driven end to end:** a holiday week goes `easy / easy / long / easy / threshold / strength / easy` →
`easy / easy / easy / strength / easy`, the week's mileage follows to **24.1 km** with quality 0 and
long-run 0 and `RAW` agreeing, the target date is untouched at 14 Feb, and no screen overflows.

### Traps this round paid for again

⚠️ **A PYTHON PATCH SCRIPT WHOSE WRITE IS AT THE END LOSES EVERYTHING WHEN ANY ASSERTION FAILS — TWICE
IN ONE SESSION.** The Recent Plans screen and the paused card were both written into memory and thrown
away by a later failed anchor, and both times the *next* step then failed with `X is not defined` on a
function that had never landed. **Write incrementally, or verify the symbol is present afterwards.**
⚠️ **THE BACKTICK RULE FIRED TWICE MORE**, both in my own comments; the build failed outright both
times, which is the good outcome.
⚠️ **TWO GUARDS OF MINE ESCAPED THEIR RE-BREAK AND BOTH ARE FAMILIAR SHAPES.** `resumeFromPause` has
TWO `recompute()` calls — the action and its undo — so a bare `/recompute\(\)/` passed with the
action's removed; counted instead, exactly as `applyPause`'s `restoreTicks` guard already had to be.
And "there is one sheet builder" counted `function renderAdjustSheet(`, which a second builder called
anything else sails past — restated to **which functions write the sheet's own markup**, and re-broken
with a genuine second writer.
⚠️ **AND ONE GUARD FORBADE A CORRECT USE.** The `isoAdd` sweep required
`.toISOString().slice(0, 10)` on every result, which fails on `isoAdd(a, 0).getTime()` — a perfectly
good use of the Date. Its `[^)]*` also could not see past a nested `todayIso()`, so the message it
printed was a truncated call rather than the offending one. The claim is that the result is treated as a
Date at all, i.e. never left bare.

## THE WEEKS AN ADJUSTMENT ACTUALLY TOUCHES, MARKED ON THE PLAN (owner, 2026-08-28)

*"After ive chosen the holiday or ive paused a plan for a set time, i want that to be clear on the plan
page which week(s) it actually is by putting a different colour around the border of the week drop down
button. when opening the drop down it needs to identify the change (e.g. holiday week)"*

⚠️ **THE DEFECT WAS THAT AN ADJUSTMENT LEFT NO TRACE ON THE SCREEN IT CHANGED.** `applyAdjustments`
removed the sessions correctly and the week rows were **byte-identical** whether a holiday ran through
them or not — same border, same tags, same meta line — so the only way to find out which weeks had lost
runs was to open each one and notice one was missing. Suite 1400 → **1405**; **16 deliberate re-breaks,
all 16 caught** (the sixteenth needed a new fixture first — below). Web-only, so it reaches his phone on
the next launch.

⚠️ **DASHED, NOT A NEW COLOUR, AND THAT IS WHAT HIS OWN WORDS DID NOT SETTLE.** He asked for "a
different colour", and `.wk-sum.cur` **already owns the solid accent border** — so a second accent
border would mark two different things identically, which is no marking at all, and a third hue would
put a colour in the plan screen's vocabulary that ruling 7 reserves for effort. The dash is the same
device the share studio's ineligible rows use, for the same reason: form carries a meaning colour is
already spoken for.
⚠️ **AND `.wk-sum.cur.adj` IS A RULE OF ITS OWN BECAUSE THE TWO TIE ON SPECIFICITY.** `.wk-sum.cur` and
`.wk-sum.adj` are both (0,2,0), so without it whichever came later in the stylesheet would decide — and
"this week, and it is a holiday week" is the case a runner most needs to read. Measured: a current week
that is also altered carries **both** tags (`["This week", "Easier"]`).
⚠️ **THE TAG CARRIES THE WORD, so the border is never the only signal** — the rule this app applies to
phase swatches (a swatch reading "Build" only helps if you can match its colour to a bar), to
low-confidence notes, and to the ineligible share rows. `Holiday` or `Easier`, in the accent.

⚠️⚠️ **`weekAdjust(w)` WALKS THE WEEK'S SEVEN DAYS RATHER THAN TESTING ITS START, AND THAT IS THE ONE
DECISION THAT WOULD HAVE BEEN EASY TO GET WRONG.** A holiday runs Friday to the following Thursday far
more often than it lines up with a Monday, so a week-start test marks one of the **two** weeks it
touches while the other reads as untouched with its sessions already gone. Measured through the real
function: a window of 11–17 Sep marks week 3 (**3 days**) and week 4 (**4 days**), each naming its own
share of it, and a week that does not meet it is not marked and carries no note.

⚠️ **IT IS THE ONE DEFINITION, READ BY BOTH RENDER SITES.** A second computation is how the border and
the note come to disagree — the row saying nothing happened over a note describing three missing days,
or the reverse. Neither `weekSummaryRow` nor `weekAdjustNote` walks the days or asks `adjustFor` itself,
and a derived sweep pins the list of functions that decide membership in a **stored** window at exactly
`weekAdjust` and `applyAdjustments`.
⚠️ **`adjustPreviewCount` RANGE-TESTS INLINE AND THAT IS NOT A SECOND DEFINITION** — it is handed ONE
draft window that is not in the store yet, so there is nothing for `adjustFor` to search. Stated in the
guard rather than left as a silent exception, and pinned so it cannot quietly grow into a search.

⚠️⚠️ **A PAUSE GETS A ROW, NOT A COLOURED WEEK, AND THE REASON IS THE DIFFERENCE BETWEEN THE TWO
FEATURES.** Pausing moves the block's **start date**, so the paused days belong to no week of the plan
at all — there is no row to put a border on. A holiday leaves the weeks where they are and empties days
inside them. So `pausedWeekRow()` is one inert row above the list reading *"Paused · 28 Aug to 17 Sep ·
nothing scheduled · week 1 begins 18 Sep"*.
- ⚠️ **A `div` with `aria-disabled`, never a button**, because there is nothing behind it to open — the
  same rule `test/design-system.test.ts` enforces on plan session rows and the Logbook's unopenable days.
- ⚠️ **Derived from a future `profile.startDateIso`, with no store of its own**, exactly as `pausedCard`
  is: a stored copy of "we are paused until…" goes stale against the date that actually decides it.
- ⚠️ **NO TAG ON THIS ROW.** The other marked rows carry one because their title is "Week 4" and the
  word has to go somewhere; this row's title IS the word, and a tag repeating it rendered
  **"PausedPaused"**. Found by reading the served page, not by reasoning.

⚠️ **THE NOTE'S PHRASE COMES FROM `ADJ_MODES[].p`, NOT `.t.toLowerCase()` — my own defect, measured.**
Lowercasing the fourth mode's title gave *"3 days of this week — i am not planning on running."*, which
is a sentence about the runner's **intention** pasted into a sentence about the **week**. A `p` field per
mode, and a guard requires every mode to carry one so a fifth level cannot fall back to printing its id.

⚠️ **THE NOTE NAMES REAL DATES, NEVER "THIS WEEK".** The row above it already says which week; what the
runner cannot work out for themselves is *which days of it* are gone — and a plan is read weeks ahead of
time. It also names the way back per kind (*Manage plan › Going away* / *› Not feeling 100%*), because
the sheet it came from is not the screen it is read on, and it mentions strength and mobility **only**
when they were actually taken out.

⚠️ **CONTRAST IS COVERED BY CONSTRUCTION, AND A GUARD KEEPS IT THAT WAY.** Every pairing introduced here
is one `test/contrast.test.ts` already asserts in all four theme blocks — `--accent-ink` on `--accent`,
and `--accent`/`--ink-soft`/`--ink-faint` on `--surface-2`. So no pixel probe was taken; what was added
instead is a sweep failing if any of these seven rules ever carries a **literal hex or a `color-mix()`**,
which is the shape that would fall outside every existing guard. This file already records a
`color-mix()` label measuring 2.41:1 in light mode after passing a dark-only review.

### ⚠️⚠️ THE SIXTEENTH RE-BREAK: ONE WINDOW CANNOT DISCRIMINATE A DAY COUNT

Dropping the `a === hit` test from `weekAdjust`'s loop **escaped every assertion**, because with a single
window stored `a` is always `hit` and the break is a no-op. It is a real defect: a week holding two
windows — a holiday Mon–Wed and an easier stretch Thu–Fri — then reported *"5 days of this week — easy
runs only"* under the holiday's label, when three of those days were the holiday and two were something
else, with the note's span reaching into a window it was not describing. **The fixture-too-kind trap, in
the one test whose entire subject is day-counting.** The fixture now holds two windows and asserts the
count, the days, the label and the span all belong to the first one only.

⚠️ **AND MY MEMBERSHIP SWEEP REPORTED THE ONE DEFINITION AS A ROGUE CALLER.** `fn("adjustFor")` returns
the function *including its own signature*, so `/adjustFor\(/` matched itself. The body is stripped of
its signature before the scan — the guard-trips-on-its-own-vocabulary trap, which this file has now
recorded six times.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1405 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged and
`CSS_DUP_CEILING` unchanged at 20 (every new selector is compound). Test titles accounted for: **5
added, 0 removed.** Driven end to end in a real browser against the served `docs/`: 25 rows with no
adjustment and none marked; a holiday spanning two plan weeks marking both; the opened week's note; an
unaffected week with no note; a whole-week "not running" reading *"The whole week — no running at all.
Strength and mobility are out too."*; a current+altered week carrying both tags; a 21-day pause
rendering one `DIV` row first in the list; and `document`/`body` horizontal overflow **0**.

⚠️ **STILL THE OWNER'S CALL, UNCHANGED BY THIS:** the weekday-time question (measured, not built), a
"longest run in the past month" profile field, and surfacing `masters.points` (needs his clinical
reviewer). And the returning-from-injury week-one inversion (350 vs 320 minutes when a volume is stated)
is reported and unfixed.

## MOVE A WORKOUT: THE TILE WAS THROWING, AND SIX COLOURED OUTLINES (owner, 2026-08-28)

Two reports. *"when you click the move a workout button, nothing happens. I need it to take you to the
calendar page and for the to be an animated instructional, animated overlay with a dimmed background
showing the user that they need to drag and drop the session"* and *"On the manage plan screen, I want
the different menu options to have different coloured outlines to separate them out better"*.
Suite 1405 → **1412**; **28 deliberate re-breaks, all 28 caught**. Both web-only, so both reach his
phone on the next launch.

### ⚠️⚠️ THE TILE WAS NOT INERT, IT WAS THROWING — AND IT FAILED ON TRAINING DAYS AND WORKED ON REST DAYS

`planAction("move")` read **`sessionsForIso()`**, which walks `PLAN.weeks` — display summaries carrying
`{id, day, dayIndex, type, title, effort, durMin, distKm, pace, rpe, optional}` and **no `steps`** — and
handed one to `openSessionSheet`, which needs a RAW session. `sessionStages` then does
`sess.steps.filter(...)` and throws a **TypeError before `sheetBody.innerHTML` is assigned and before
`.on` is added**, so `.sheet-ov` stays `display: none`. Reproduced in a browser: **one uncaught
TypeError, sheet not open, no toast, nothing on screen.** Exactly "nothing happens".

⚠️ **THE INVERSION IS THE TELL: the first arm used `PLAN.weeks` and the fallback used `RAW.weeks`.**
`sessionsOnSelectedDay()` reads `RAW.weeks[curWeekIdx()].sessions`, so the fallback was always fine —
and today almost always carries a session, so the broken arm is the one that fires. **Dead in practice,
alive on a rest day.**
⚠️ **SEVENTH FIRING OF THE PLAN-vs-RAW TRAP, and this file already names the fix:** *"`PLAN.weeks` has
no steps or pace bands (it is a display summary); the prescription lives in `RAW.weeks`, via
`rawSessionsForIso()`. Reading the wrong one fails silently."* Swept: **of the eight `sessionsForIso`
callers this was the only one handing its result to something that needs `steps`** — every other reads
`distKm`, `durMin`, `title`, `type` or `date`, which are summary fields.
⚠️ **AND IT CARRIED A SECOND LIVE DEFECT, removed with it.** `openSessionSheet(pick)` passed **no
week**, so `SHEET_CTX.week` fell back to `state.planWeek` — once the runner had tapped week 9 on the
Plan screen, `moveSession` looked for the swap occupant in **week 9** while writing the override for a
**week-1** session: the session moved, nothing swapped out, and week 1 ended with two runs on one day
for `seedDone`'s collision belt to clean up. Every other `openSessionSheet` call site passes a week.
⚠️ **THE BRANCH IS DELETED RATHER THAN REPAIRED**, because he asked for the calendar. That removes both
defects by construction rather than fixing one shape mistake.

### ⚠️⚠️ A CENTRED WORDLESS DIAGRAM, NOT A SPOTLIGHT — SIX CONSTRAINTS EACH KILL THE ANCHORED VERSION

A judged panel of three designs (ghost card / spotlight cut-out / minimal) plus two judges each argued
this out, and the reasons are all measurements rather than taste:
1. **`#view` is the only scroll owner and is a SIBLING of every body-level overlay**, so a pass-through
   aperture lets the page scroll under it and it drifts off target every frame.
2. **That scroll cannot be locked with `touch-action: none`** — `test/ios-input-zoom.test.ts` is a
   `deepEqual` on exactly four selectors and a fifth fails the suite.
3. **The calendar opens at week 1 with no auto-scroll**, so a card would have to be found first.
4. ⚠️ **`calTrialRow` emits `.cal-open` with NO `data-oid`**, and `startSessDrag` bails before the ghost
   and before `haptic("lift")` — so an aperture keyed on `.cal-open` can land on **the one row where the
   gesture is a silent no-op**. (That dead gesture is a pre-existing defect; see the open list below.)
5. Two plan states have no card at all and would need a second design.
6. An rAF-gated aperture would be measurable only in a browser, and the five above already settle it.
   ⚠️ **This list originally said rAF fires zero times in this repo's headless Chrome. That is FALSE —
   see the correction above: 112–122 fps once the window is sized.** The decision stands on 1–5.

A diagram with no anchor answers all six **by measuring nothing**, and `calTipHtml` **declares zero
parameters** — which is the clause that makes a rect unable to arrive from outside. The shell is
`.guide-ov` + `.guide-card`, reused as the extras popup reuses it, so the scrim, the dim, the blur and
the `.on` fade all arrive with no new code.

⚠️ **THE SCRIM TAKES POINTER EVENTS ON PURPOSE.** A pass-through scrim over a live card produces this:
the runner presses and holds exactly as instructed, the overlay neither responds nor dismisses (a drag
fires no `click`), and **the app appears inert while they perform the taught gesture correctly** — the
defect this feature exists to remove, one layer up. It also means the page cannot scroll behind the
lesson, because `body` is `overflow: hidden`, so the scroll lock is free.

⚠️⚠️ **THE DEMO'S PRE-LIFT DWELL IS LONGER THAN THE REAL GATE, AND THE INEQUALITY IS THE POINT.**
Measured through `element.getAnimations()`: **motionless at the origin through 448 ms** against
`MOVE_HOLD_MS` = **320**, ring expanding and finishing AT the lift, lifted at 640 ms, travelling with
the finger still on it, dropped at 2560 ms. A demo that lifts early teaches a hold that trips the 9 px
cancel, **and that failure is completely silent** — no haptic, no class, the calendar just scrolls.
Erring long is the only safe direction, and `test/move-workout.test.ts` pins
`stopFraction × duration ≥ MOVE_HOLD_MS` rather than a typed number, because a retune from 3200 ms to
1500 ms puts the dwell at 225 ms and would otherwise pass.
⚠️ **`MOVE_HOLD_MS` EXISTS SO THE DEMO CAN CITE THE GESTURE.** Both drags read it, and a guard asserts
each timer waits on it — extracting a literal that then diverges silently is worse than the literal.

⚠️ **REDUCE MOTION NEEDS ITS OWN BLOCK, AND CLAUDE.md IMPLIED OTHERWISE.** The global rule at line 989
is **`* { transition: none !important }` — TRANSITIONS ONLY** — which is why animations are switched off
in **26 separate per-component blocks**. A keyframe animation is untouched by it. The still frame is the
card **lifted, mid-travel, ring expanded, destination highlighted**: the hold AND the destination in one
frame. A landed frame shows the outcome and drops the press, which is the one fact a Reduce Motion
runner cannot get from anywhere else.
⚠️ **AND THERE ARE FIVE JS `matchMedia` CHECKS FOR IT** (lines 9948, 10936, 27472, 36019, 36582) — this
file's note that there is no `prefersReducedMotion()` helper is about the NAME, not the practice.

### ⚠️⚠️ AN EDGE SCROLLER, BECAUSE THE GESTURE WAS OTHERWISE UNREACHABLE ON A REAL WEEK

Measured on the busiest week of a real plan: **a week spans 662 px** while `#view` is **523 px at
375×667** (short by 139) and **426 px at 320×568** (short by 236). So there is **no scroll position at
which Monday's card and Sunday's row are both on screen** — and `calDragBlockScroll` `preventDefault()`s
touchmove for the length of a drag, so the runner cannot scroll to reach the far end either. **On a
375-wide phone, dragging Monday to Sunday was impossible.** Shipping a tutorial for a gesture that
cannot reach the far end of a busy week is worse than shipping nothing, which is why it is in the same
change.
⚠️ **ONE SCROLLER, NOT TWO.** The plan drag has had `planDragScroll` since it was written and the
calendar drag **twenty lines away had none**; a second copy is the fix-one-builder-not-the-other trap
this file records six times. `edgeScrollDelta(y, top, bottom)` is the pure arithmetic and `dragEdgeTick`
the loop, split so the arithmetic can be driven in node **with no browser at all**. ⚠️ **The reason
originally given — that rAF fires zero times here — is FALSE; see the correction above.** The split is
still right; its stated justification was not.
⚠️ **THE LOOP IS CANCELLED IN `calDragTeardown`, NOT IN `calDragEnd`.** Teardown is the one exit both
the end and the cancel path go through; a cancel that left the rAF running would scroll `#view` for
ever.
⚠️ **AND THE FINGER'S POSITION HAD TO BE KEPT** (`DRAG.px/py`). Without it, holding at the edge scrolls
the list while the target stays on whatever day was under the finger when it stopped moving — the list
slides and the highlight does not follow. `calDragAim(x, y)` was split out of `calDragMove` so the
scroller can re-aim with no event.

### The smaller decisions, each with its reason

⚠️ **NO SEEN KEY, AND THE TILE ALWAYS SHOWS THE LESSON.** A seen key exists to bound something that
appears **unbidden**; this has exactly one caller and that caller is a tap, so the recap's ruling
already holds — *"IT IS AN OFFER. It opens from a tap and never appears on its own."* Making the tile
behave differently the second time **re-creates "the tile does nothing"**, the report being fixed.
⚠️ **THE PERMANENT `.cal-hint` LINE IS WHAT MAKES THAT ANSWER COMPLETE.** Before it, the calendar
explained the gesture **nowhere** — the only "press and hold" wording in the file was a source comment.
It reads `MOVE_TIP_LINE`, the same constant the lesson reads, so the two can never diverge; a guard
asserts **exactly two readers** and that neither types its own copy.
⚠️ **THE SENTENCE NAMES THE SAME-WEEK RULE BECAUSE A CROSS-WEEK DROP IS REFUSED IN SILENCE.**
`calDragAim`'s `ok = day && Number(day.dataset.w) === DRAG.wk` simply declines to mark a target, so
dragging into next week produced no highlight, no haptic and no explanation. It now also toasts —
**only when there is no target at all**, because dropping back on the source day is a deliberate cancel
and answering that with a correction would scold every changed mind.
⚠️ **`calHomeScroll` IS ARMED BY THE TILE ALONE, so `#calBtn`'s behaviour is byte-identical.** Measured:
week 12 sits **8,017 px** down and week 20 **14,049 px**, so a runner in week 12 dismissing onto week 1
would be four months from the day they wanted to move. The first-time case only looks fine because a
fresh plan's week 1 *is* today.
⚠️ **z-index 85, AND THE WHOLE STACK WAS MEASURED TO PICK IT.** Above `.sheet-ov` and `.app-toast` (70)
because both live inside `.app`, which `overlayModal` inerts — a lesson under an inert sheet is the
z-order defect this project has shipped twice; above `.guide-ov` (80) so a stray onboarding popup cannot
cover it; below 90 so a launch overlay still wins; far below `.cal-ghost` (300).
⚠️ **`calTipUp()` IS DERIVED FROM THE NODE, NEVER STORED.** A boolean some other `.on` removal left true
is a guard that passes while `.app` stays inert — a frozen app reporting itself as fine.
⚠️ **AND `render()` CLOSES IT ABOVE THE FIRST SCREEN BRANCH.** The calendar branch **returns**, so a
call placed after it never runs on the path that matters. The condition names `state.screen !==
"calendar"` **and** `liveRunning()`, because a run starting is exactly such a path.

### THE SIX COLOURED OUTLINES, AND WHY THE LITERAL ASK WOULD HAVE BEEN INVISIBLE

⚠️⚠️ **MEASURED AS A 1 px OUTLINE ON THE SHEET'S OWN `--surface` GROUND, THE RAW CATEGORY TOKENS RUN
2.44–3.37:1 IN LIGHT MODE — EIGHT OF THE ELEVEN UNDER THE 3:1 NON-TEXT FLOOR.** The identical
light-only trap this file records twice (the accent at 4.14 on white, the URGENT band title at 2.41),
because the design brief reviewed dark screenshots. And **diluting toward `--line`, which is what eleven
existing borders do, lands them at 1.3–2.2:1** — a grey hairline, i.e. the change would have measured as
nothing and been reported as not done.
⚠️ **`color-mix` TOWARD `--ink` IS THE REMEDY THIS REPO ALREADY USES TWICE**, and it darkens in light
and lightens in dark from ONE declaration. **78% is measured, not picked:** worst-of-six against
`--surface` by weight is **100% 2.76 / 85% 3.54 / 78% 3.98 / 72% 4.46 / 58% 5.83**, while the pairwise
colour separation falls the whole way (**74 → 63 → 59 → 53 → 42**) — so lower is more legible and less
distinguishable, and 78% is where both are comfortable.
**Read back from rendered pixels at 430×932 and 320×568 in both themes: outline worst 3.98:1 light /
6.96:1 dark; glyph on its own tint worst 3.50:1 light / 5.72:1 dark.** All six rows, both themes.

⚠️ **PER-ROW COLOUR HERE IS PRECEDENT, NOT INVENTION.** `profRow` has done exactly this on the Profile
screen's structurally identical row list since it was written — **13 assignments over ten reserved
tokens** (`--eff-hard`, `--steady`, `--build`, `--rest`, `--ease`, `--base`, `--eff-easy`, `--taper`,
`--accent`, `--eff-none`), passed the same way through the same `--pc` channel. ⚠️ **Verify that before
relying on it: a first grep for `--pc: var(` found ONE assignment**, because the colour is passed as a
field of an options object (`colour: "var(--rest)"`) and interpolated.
⚠️ **`--peak` IS DELIBERATELY NOT USED**: `viewPlan` renders `phaseLegend` with a `--peak` swatch
labelled **Peak** on the screen this sheet opens over, and it is the loudest of the four. `--eff-*` are
avoided entirely — those four answer one question through one table (ruling 7) and a row wearing one
would state a session effort that is not there.
⚠️ **THE OLD `:first-child` RULE HAD TO GO WITH THE DIVIDERS.** It was `border-top: 0`, which over a
card would have cut the top edge off the first row **and only the first** — a rendering fault rather
than a stale rule.
⚠️ **`ICON.book` RENDERS AS A BARE RECTANGLE AT 17 px**, which is why `ICON.journal` exists. Found by
looking at the render, not by reading the code.

### Four instrument faults this work paid for, all mine

⚠️⚠️ **A HEADLESS WINDOW WITH NO SIZE MAKES EVERY MEASUREMENT NOISE THAT READS AS A BROKEN LAYOUT.**
`Emulation.setDeviceMetricsOverride` alone left `window.innerHeight` at **1**, so `.app { height: 100% }`
chained down to 1 px and `#view` measured **112 px** with `visibleCards: 0`. **`Browser.setWindowBounds`
is what actually sizes it.** The harness now refuses to measure a shell whose `innerHeight` is under 200.
⚠️⚠️ **`#welcomeGo` IS NOT A SIGNAL THAT THE LAUNCH OVERLAY IS UP.** There are TWO welcome elements:
`DIV.welcome#welcome` is in the page's **static markup** and keeps existing (hidden) for the whole
session, and it contains `#welcomeGo` — so polling for that id waits for ever on a perfectly clear
screen. The one that blocks the page is `DIV.welcome.wb.on#welcomeback`, which JS creates and removes.
Before that was understood, `elementFromPoint` returned `.welcome on` for every point and the page
underneath looked catastrophically broken.
⚠️ **`syncTextScale()` REWRITES `--tscale` ON EVERY RENDER, so a value set BEFORE the render is silently
overwritten.** Measured: six "ts=1.3" cases that all ran at 1.0 and reported an identical card height,
which reads as the type ladder not scaling. Set it **after** the render — then the title genuinely goes
24 px → 31.2 px and the card 374 → 508 px.
⚠️ **CHANGING `animation-delay` ON A RUNNING ANIMATION DOES NOT RESTART IT**, so the paused frame bears
no relation to the phase asked for — measured, `-2560ms` (80%) rendered the 0–15% frame and the timeline
read as inverted. `element.getAnimations()` with `pause()` and `currentTime` addresses the animation
itself. ⚠️ **And pausing an animation then calling `Page.captureScreenshot` HANGS in this headless
Chrome** — consistent with rAF firing zero times here (no compositor). Measure the numbers with the
Web Animations API and take screenshots unpaused.

### Two visual defects found by measuring the animation, not by reading it

⚠️ **THE FINGER FADED OUT AT THE LIFT, so the card travelled ALONE** — which reads as the card moving by
itself rather than as a finger dragging it, the opposite of the instruction. The dot is a CHILD of
`.caltip-sess` so it travels for free; only the ring needed animating.
⚠️ **AND THE LOOP RESET BY DRAGGING THE CARD BACK UP.** At 95% the card was half way home, travelling
upwards, which reads as a second instruction — *"and then move it back"*. It fades out where it landed,
teleports while invisible, and fades in at the start, so the only motion a runner ever sees is the one
being taught.

### Guard defects this round, all mine, all caught by the guards' own first run

⚠️ **`const EDGE_BAND = 64, EDGE_MAX = 7;` IS A MULTI-DECLARATOR const**, so a regex anchored on
`const NAME =` finds the first and reports the second as absent — which reads as the constant having
been deleted.
⚠️ **`calls.length = 0 || calls` PARSES AS `calls.length = calls`** and throws `RangeError: Invalid
array length`. Precedence, in a test's own fixture reset.
⚠️ **A `[^)]*?` WINDOW CANNOT CROSS THE `)` IN `planListSub()`** — the manage-plan icon sweep found five
of six icons and reported the sixth row as missing. Anchored on the colour argument instead, which every
row has.
⚠️ **AND `var(` INSIDE A CSS STRING IS NOT A FUNCTION CALL.** The bare-identifier existence sweep read
`"var(--rest)"` as a function this app does not define and **reported the fix as the defect**. A
`nostring()` helper strips string literals before scanning for code — the same class as `nocomment`.
⚠️ **THE ICON EXISTENCE SWEEP COVERED `planActionsHtml` ONLY**, so the menu's six icons — looked up as
`ICON[icon]` from a **variable**, where a typo renders an empty coloured chip in silence — were
unguarded. Derived from the `row()` calls now.

⚠️ **THE BACKTICK RULE FIRED THREE TIMES, ALL IN MY OWN COMMENTS**, and the first failed as
`SyntaxError: Expression expected` pointing at the splash markup 60 lines away — while
`node --check` and the design-system test both then reported OK **on the stale build**. Read the build's
exit code before trusting anything after it.

### Open, measured, and NOT fixed — reported rather than quietly inherited

⚠️ **HOLDING A SCHEDULED 2 km TRIAL ROW PRODUCES NOTHING AT ALL.** `calTrialRow` emits `.cal-open` with
no `data-oweek`/`data-oid`; `wireCalendarDrag` wires it, and `startSessDrag` then does
`Number(btn.dataset.oweek)` → NaN → `PLAN.weeks[NaN-1]` → undefined → a bare `return` **before** the
ghost, before `haptic("lift")` and before any window listener. A silent dead gesture on that one row
type, and now a gesture the app teaches.
⚠️ **`moveSession` RAISES NEITHER A TOAST NOR AN UNDO**, which is a fair criticism of a gesture we have
just made discoverable. Named as the next real gap; a reversible move is its own change.
⚠️ **THE CALENDAR SAYS NOTHING ABOUT A PAUSE.** `pausedCard()`'s only caller is Today, so during a pause
the calendar is full of draggable cards inside the paused window and dragging them works normally.
⚠️ **`body.cal-dragging { overscroll-behavior: none }` TARGETS THE WRONG ELEMENT** — the scroll owner is
`.view`, not `body`, so that declaration does nothing; the actual suppression is
`calDragBlockScroll`'s `preventDefault()`.
⚠️ **NOTHING `preventDefault()`s THE INITIAL `pointerdown` AND `.cal-open` DECLARES NO `touch-action`**,
so on iOS the scroller may claim the pointer during the 320 ms hold and fire `pointercancel`, cancelling
the lift on a mid-list card. **UNVERIFIED** — one real hold on his phone would settle it, and if it
reproduces it becomes the highest-priority follow-up, because everything above teaches that gesture.
⚠️ **`.pf-ic` ON THE PROFILE SCREEN PAINTS ITS GLYPH IN THE RAW TOKEN over an 18% tint of it**, reported
at 2.10–2.79:1 in light on eight of its twelve rows. Pre-existing and unguarded; the `.mp-ic` treatment
here is the fix, one declaration away. **Reported by a reader and NOT independently reproduced by me** —
I could not get the chips on screen.
⚠️ **NOTHING IN THIS CHAPTER HAS BEEN ON A PHONE.** Every figure is a headless browser or arithmetic.

## FOUR FROM HIS SCREENSHOTS, AND A SHEET THAT SLID SIDEWAYS (owner, 2026-08-28)

Suite 1416 → **1420**; **31 deliberate re-breaks across two rounds, all 31 caught** (five only after a
guard was restated — those five are below). All web, so all of it reaches his phone on the next launch.

### ⚠️⚠️ THE SHEET SLID SIDEWAYS, AND ELEVEN RULES HAD THE SAME LATENT FAULT

He photographed the Going away and Not feeling 100% sheets with their headings, their titles and the
first date field slid off the left edge. **The CSS spec turns `visible` into `auto` whenever the other
axis is not visible**, so `overflow-y: auto` alone had made **every sheet in this app a horizontal
scroller nobody asked for** — and one pixel of overflow is then enough for iOS rubber-banding to drag
the whole thing. Swept: **eleven rules in this stylesheet set `overflow-y` and say nothing about x**,
including `.sheet`, `.view` and my own new `.caltip-body`.

⚠️ **MEASURED 0px OF OVERFLOW IN HEADLESS CHROME AT FOUR SIZES, WHICH IS EXACTLY WHY IT TOOK A
PHOTOGRAPH FROM A REAL PHONE.** A native `<input type="date">` renders wider on iOS than in Chrome, so
the two-column date row overflows there and not here. **I could not reproduce his exact overflow**, so
it is fixed at the platform-independent level and that is stated rather than dressed up as a root-cause
fix: the sheet is no longer pannable at all.
⚠️ **`overflow-x: clip` BESIDE A SCROLLING Y-AXIS IS COERCED TO `hidden`**, and that is the mechanism
rather than a disappointment: `hidden` is not user-pannable (a finger cannot drag it) while remaining
programmatically scrollable, which is why a probe setting `scrollLeft` still reads non-zero. The
user-facing fix holds; a `scrollLeft` measurement is the wrong instrument for it.
⚠️ **AND THE CLIP IS THE GUARANTEE, NOT THE FIX** — on its own it turns an overflow into missing
content. The date row wraps too, and **`flex-wrap` was the wrong tool**: it breaks a line from the flex
**basis**, so with `flex: 1 1 140px` two fields never wrapped and a wider intrinsic minimum pushed them
out of the row instead (measured 17px of overflow at 375 wide). `repeat(auto-fit, minmax(150px, 1fr))`
wraps on the **minimum**, which is the question being asked — measured two columns at 430 and 375, one
at 320. Plus `min-width: 0` on the date input, or `width: 100%` cannot squeeze a native control below
its own intrinsic minimum.
⚠️ **A RATCHET, NOT A BAN.** Nine rules still scroll vertically without pinning x and most are
harmless; what must not grow is the count, because each is a surface that can be slid by accident.

### CANCELLING A BREAK — THERE WAS NO WAY BACK AT ALL

Booking a holiday or an easier stretch raised an undo toast and nothing else. Once it had gone the
window was in the store for good, and the only way to undo it was to guess that an overlapping one
might help. `plannedBreaksHtml()` lists what is booked, each with a Cancel.
⚠️ **A PAUSE IS IN THAT LIST TOO, AND IT IS A DIFFERENT MECHANISM.** A holiday is a row in the
adjustment store; a pause is a future `profile.startDateIso`. Both read as *"a break I have booked"*, so
both belong in one list — and the way out of each is the function that already existed for it
(`resumeFromPause` was reachable only from Today's paused card).
⚠️ **IT RENDERS NOTHING WHEN NOTHING IS BOOKED.** A permanent empty heading on a menu is a section that
teaches the runner to scroll past that part of the screen.
⚠️ **`cancelAdjust` SNAPSHOTS BEFORE THE REBUILD, and that ordering is the whole undo.** `seedDone()`
prunes `dayOverride` of session ids the new plan lacks and **persists the prune**, so a snapshot taken
afterwards hands back a plan with the runner's own reschedules already deleted — under a button
labelled Undo. Measured: cancelling a holiday put week 3 back from **19.0 to 27.1 km**.

### START A NEW PLAN GOES THROUGH THE WIZARD, MINUS THE NAME STEP

His words: *"when a user chooses to start a new plan, I want the app to take them through the initial
start up screens when first entering the app (you can miss out the name one)."* It used to open
`state.screen = "setup"` — the whole profile form on one page, which is the screen for **changing** an
answer rather than the sequence for **building** a block.
⚠️ **GATED ON `profile.personalized`, SO IT NEEDS NO NEW FLAG:** false on a genuine first run, true by
the time a second plan is ever started. Driven both ways: `["level","goal",…]` against
`["you","level","goal",…]`.
⚠️ **`startWizard()` IS NOW THE ONE ENTRY POINT.** It was reachable only from the first-run welcome;
two copies of (reset draft, reset wizStep, reset wizErr, set the screen) is how the second route comes
to start half way through somebody else's answers.
⚠️ **NOTHING EXTRA WAS NEEDED TO PRE-FILL IT** — every later step already falls back to the stored
profile (`wizFieldVal("s_dist") || p.goalDist` and friends), so a second plan opens on last time's
answers rather than blank.

### ⚠️⚠️ THE PLAN SHIELDS REVERSE A REASON WRITTEN IN THIS FILE

*"i want you to use different colours for the icons of the different run plans."* The comment in
`viewPlans` argued a coloured shield would be a second colour vocabulary against ruling 7, because this
app has exactly one meaning for a coloured chip. **He overruled it, and the collision is avoided rather
than accepted:** `--eff-*` are not in the palette, the badge still carries the distance as **text**, the
active plan is always `--accent` and no past plan can wear it. **Do not revert it to grey on the
strength of the old comment** — the guard that asserted the grey was inverted, not deleted.
⚠️ **KEYED ON THE PLAN'S OWN SIGNATURE, NEVER ITS POSITION.** Delete one plan and every colour below it
would shift, so the shield a runner had learned to recognise becomes somebody else's.
⚠️⚠️ **AND THE SHIELD'S TREATMENT HAD TO CHANGE, BECAUSE THE OLD ONE CANNOT CARRY SIX HUES.** It painted
`var(--accent-ink)` on the raw token, and **`--accent-ink` flips with the theme (white in light,
near-black in dark) while the tokens get LIGHTER in dark** — so darkening the ground to fix light mode
breaks dark mode and vice versa. Measured on the gradient's lightest end: light **2.76 (ease) / 2.94
(build) / 3.16 (base)** against a 4.5 floor; darkened to 80%, dark falls to **3.51 (taper) / 3.78
(rest)**. **No single weight works because the ink flips.** Mixing each hue into a **fixed dark base**
holds the lightness while the hue varies, so white always clears — read back from rendered pixels,
**9.48:1 worst in light and 8.03:1 in dark** across all six, hues 27.6 apart.

### Five guard defects, all mine

⚠️ **MY OWN DUPLICATE-CLASS RATCHET CAUGHT ME FOR THE SECOND TIME** — a second bare `.rp-badge` rule
took `CSS_DUP_CEILING` to 21. Merged into the one rule.
⚠️ **`rule()` READ `--accent-ink` OUT OF THE VERY COMMENT EXPLAINING WHY IT IS GONE** — the **eleventh**
firing of comment-quotes-what-it-forbids. It strips CSS comments now.
⚠️ **A `var\(--pc[^)]*\)` REGEX CANNOT CROSS THE `)` IN `var(--pc, var(--accent))`** — the
collection-too-narrow trap, in the guard rather than the code.
⚠️ **THE CANCEL CONTROL MEASURED 41.48px BY BISECTION AGAINST A 44px FLOOR**, and nothing guarded it. A
box cannot report its own pseudo-element, so the inset is what a static guard can check.
⚠️⚠️ **AND SLICING MY OWN TEST FILE BETWEEN TWO ANCHORS DELETED THE THREE ASSERTIONS BETWEEN THEM**, so
two re-breaks escaped with the test green. **This project already records me doing exactly that once.**
When replacing a block in a test, diff the assertion list before and after.

### Two existing guards restated, both scoped to a HOW

⚠️ **`test/manage-plan.test.ts`'s "no second colour vocabulary" ASSERTED THE EXACT GREY HE OVERRULED**
(`isLive ? "var(--accent)" : "var(--ink-faint)"`). What it protected survives — no effort colours, no
phase colours, the active plan readable — and is what it asserts now.
⚠️ **AND `test/onboarding-wizard.test.ts`'s FIRST-LAUNCH GUARD PINNED THE LITERAL `state.screen =
"wizard"` INSIDE THE WELCOME HANDLER**, so extracting `startWizard()` broke a guard whose invariant was
untouched. Restated as a chain, and it is now **stronger** than the old form because it also proves the
draft is cleared. **That is the fourteenth-plus firing of guard-scoped-to-a-HOW in this file.**

⚠️ **THE BACKTICK RULE FIRED, IN CSS COMMENTS THIS TIME — 14 of them in one edit.** The build failed
with `Identifier cannot follow number` pointing at the splash markup, and the measurement I ran next was
against the **stale** build and reported the bug as still present. Read the exit code first.

## THE ADVERSARIAL REVIEW OF THE MOVE-WORKOUT WORK (2026-08-28)

Five lenses over the two shipped commits, each finding attacked by three sceptics. It found four things
that were mine, and **two of them were claims I had written down wrong**.

⚠️⚠️ **`calHomeScroll` SCROLLED AWAY THE INSTRUCTION IT EXISTS TO DELIVER.** Measured on the tile path:
the permanent hint line at **top −21** and the Back button at **top −53** — both off screen, on a
**fresh** plan, which is the one case my own comment called fine because week 1 is today and sits 80px
down. So the sentence I called *"what makes the no-seen-key answer complete"* was never on screen on the
path that exists to teach the gesture. It now refuses to scroll a week that is already visible; mid-plan
it still scrolls, because losing a header when you travel 8,000px is what scrolling means. After: hint
top 51, Back top 19.

⚠️ **A DRAG COULD OUTLIVE THE SCREEN IT STARTED ON.** `__interunWatchLive` sets `state.screen` and
renders with no `DRAG` check, and `liveRunning()` is false during a calendar drag. Measured: DRAG still
set, the lifted ghost over the new screen, the edge scroller auto-scrolling Today by **654px** under a
stationary finger, and `calDragBlockScroll` still preventDefaulting every touchmove app-wide.
⚠️ **THE CANCEL MUST EXCLUDE THE PLAN DRAG**, which lives on a screen where `state.screen` is null and
would otherwise be cancelled on its own first render.

⚠️ **AND THE REFUSAL TOLD EVERY FAILED DROP ABOUT WEEKS**, including one that landed on no day at all.

### ⚠️⚠️ THE TWO CLAIMS I HAD WRITTEN DOWN WRONG

**"`requestAnimationFrame` fires ZERO times in this repo's headless Chrome" is FALSE**, and this file
carried it in three places. Re-measured four times — by me and by three independent reviewers — at
**112–122 frames per second in the loaded app**. The original zero was taken with the headless window at
its **default size, where `window.innerHeight` is 1 and there is nothing to composite**;
`Browser.setWindowBounds` fixes it, and **the same 1px window is what made `#view` measure 112px and
read as a broken layout**. So the harness was the fault, not the browser. Two design decisions cited
that zero and both stand on other grounds, but the reason they gave was wrong. **Corrected at the claim,
not only at the repetition** — the fault this file records fixing in one place and leaving stale in
another.
⚠️ **What genuinely does not work here is pausing an animation and then calling
`Page.captureScreenshot`: that hangs, measured twice.**

⚠️ **THE REVIEW RESCOPED ITS OWN TWO "MAJOR" FINDINGS TO MINOR AFTER THREE SCEPTICS EACH, and both
rescopings are worth keeping.** The edge scroller's frame-rate dependence (`EDGE_MAX` is pixels per
**frame**, so ~420 px/s at 60 Hz and ~840 at 120) is real, but it is **verbatim pre-existing** —
`git show 1fa6240^` has the same `max = 7` and the same per-frame add — it is symmetric so the overshoot
is recoverable, and the "never comes back" figure was an artefact of a harness that parks the finger.
Its supporting day-row figure was also wrong (46px claimed; measured 65–80). **Left alone deliberately:
a time-normalised scroll is a separate change with its own sweep.**

⚠️ **THE RATCHET GUARD FOR A WRONG CLAIM HAD TO BE A COUNT, NOT A NEARBY-RETRACTION CHECK.** Watched
escaping: restoring the claim as a REASON put it a hundred characters before the correction that follows
it, so a window looking for "FALSE" found one either way. Three mentions today, every one inside a
correction; a fourth fails.

### Still open from the review, measured and NOT fixed

⚠️ **`SessionView.effort` IS A SECOND, INTENSITY-KEYED EFFORT MAPPING and one of its five readers
schedules training** — a possible ruling-7 violation, reported by the sweep lens and not verified by me.
⚠️ **`[data-shoeretire]` IS A HANDLER WITH NO CONTROL: a pair of trainers cannot be retired.**
⚠️ **`data-uirow`, `[data-crun]`, `[data-weatherseg]` and `data-phase` at `web/app.ts:12163`** are dead
or superseded bindings.
⚠️ **The plan drag still refuses in silence** — only the calendar's got the new toast.
⚠️ **Twelve of the guards lens's findings are unaddressed**, most of them "the guard asserts the
implementation rather than the invariant". Worth a pass of its own.

## SKIP A SINGLE SESSION (stage B2, 2026-10-02)

PLAN.md B2: *"Skip a single session without rebuilding the week."* A planned session's sheet has **Skip this
session** (`#sdSkip`, between "I did this run elsewhere" and Start, which stays last). One tap: the session
leaves the plan, the rest of the week stays exactly as prescribed, the toast says *"Skipped. It won't count
as missed."* with Undo, and Manage plan › Planned breaks lists it with a Cancel. Web-only.

**The store is the break store.** A skip is a row in `interun_adjust_v1`:
`{ id: "skip-<ms>", kind: "skip", mode: "skip", from, to, sid, t, ty }` — one day (`from === to`), the
session's id, and its title and type (it is no longer in the plan to be read from). So it inherits adoptPlan's
ordering (applied inside `applyAdjustments`, before the reminder and watch syncs), the Planned breaks list
and its Cancel, and the week marking, for free.

⚠️ **`adjDrops` ANSWERS FOR IT AFTER THE RACE GUARD** — `if (a.mode === "skip") return s.id === a.sid;` sits
below `if (s.type === "race") return false;`. PLAN.md's own re-break (move it above) is guarded. The sheet
never offers Skip on the race either (`skipOfferable`), so there is no button that does nothing.

⚠️⚠️ **`adjustFor` NEVER RETURNS A SKIP.** It resolves ONE row per day, so a skip listed first (newest-first
order) would have hidden a holiday's level for every other session that day, and a skip on a Monday would
have hidden a "make this week easier" row from `eased()`, which asks about the week's first day. Skips are
found by **`weekSkips(startIso, rows)` — the one definition of skip membership** (by the week, then by id,
exactly like a B1 link) — and applied as well as the windows, not instead: windows first, then skips, then
easing (easing eases what is left). The guard that pins `adjustFor`'s askers is unchanged; a new guard pins
`weekSkips`'s callers to `applyAdjustments`, `weekAdjust` and `todayDecision`.

⚠️⚠️ **A SKIP OUTLIVES ITS DAY, AND THAT IS WHAT MAKES IT A SKIP RATHER THAN A MISS.** `easeWeekEvidence`
counts misses as RAW's runnable sessions in the last four plan weeks with no run on their date. `saveAdjust`
used to drop every row whose `to` had passed, which would have put the skipped session back into RAW the
next time anything was written — and counted it as missed, the one thing the toast promises it will not be.
Skips are now kept **42 days** (`SKIP_KEEP_DAYS`, declared beside `ADJUST_KEY`), and **capped apart from the
windows** (40 skips, 12 windows): one shared cap of twelve would have let a run of skips push a holiday
booked months ahead out of the store in silence.

⚠️ **ONLY TODAY OR LATER, AND NEVER ONE ALREADY DONE.** `skipOfferable` refuses a past day (turning a miss
into a skip after the fact would launder the evidence the coach reads), a session a B1 link fulfils, today's
session once a run has ticked it, an added session or built run (not in the PLAN, removed directly), and a
programme session. The sheet and `skipSession` ask the same function, so the two cannot disagree.

⚠️ **IT LEAVES THE RUNNER WHERE THEY WERE.** `saveAdjustDraft` and `cancelAdjust` reset the Plan screen to this
week (they are booked from Manage plan); `skipSession` does not, because it is made from the session in front
of the runner and jumping the Plan screen under their finger would lose their place.

**What the runner reads afterwards:**
- the week's row gets the dashed "altered" border and a **Skipped** tag (a window's tag wins when both);
- the opened week says *"Skipped · 4 Oct — 80′ long run is off the plan, and it won't count as a missed
  session. You can put it back from Manage plan › Planned breaks."* — the way back named only while it
  exists;
- Planned breaks lists upcoming and today's skips (not earlier ones, which stay in the store for the
  evidence but are no longer "planned"), in **the session's own effort colour** (`effortVar(sessionEffort)`),
  and Cancel's toast says *"Session put back."*;
- Today, on a day a skip emptied, says **"Skipped today"** — not "Recovery day", which would be the app
  claiming the runner's decision as its own design.

**Known edge, not fixed:** a session the runner had dragged to another day and then skipped loses its
reschedule (`seedDone` prunes `dayOverride` entries for ids the plan no longer holds, as it does for a
holiday), so cancelling the skip brings it back on its original day.

**Tests:** `test/skip-session.test.ts` (13, driving the real lifted functions over a three-week fixture whose
rest day is never today). Updated: `manage-plan` (its hand-written lift list gained `weekSkips`, `todayIso`),
`manual-runs` (the sheet's button order). 17 of 17 re-breaks caught, PLAN.md's own among them.

## A TIME OF DAY FOR A SESSION (stage B3, 2026-10-02)

PLAN.md B3: *"A time of day for each session, carried into your calendar."* A planned session's sheet, from
today on, has **Time of day** (`#sdTime`, the platform's own `<input type="time">`, right under Move to another
day) with a **Clear**. Any kind of session, the race included. Web-only.

**What a time does — and the one reader, `sessionTimeAt(iso, sid)`, every one of these asks:**
- **The calendar file** (`buildSessionsIcs`): the session becomes a timed event — `DTSTART` at the time,
  `DTEND` after the plan's own `durMin`, and `TRIGGER:-PT30M`. Times are **floating** (no Z, no TZID): a
  runner's 18:00 is 18:00 wherever they are, as REMIND.time already is. `icsFloat` does the arithmetic on UTC
  fields as a plain calendar, so 23:30 + 45 min ends 00:15 the next day and a clock change cannot shift it.
  Untimed sessions are the all-day events they always were, alarmed at the morning reminder time.
- **The reminders**: `reminderSlotsFor(iso, s)` moves slot "a" to 30 minutes before a timed session and leaves
  slot "b" where the runner put it — ONE function, read by the native schedule (`buildReminderSchedule`) and
  the Home Screen app's in-page timers (`initReminders`), so the two cannot disagree. A timed reminder's title
  reads *"Today at 18:00: …"*.
- **Today's card** eyebrow (*"Today's plan · 18:00"*) and **the plan's day rows** (the time leads the line).
- The calendar sheet now says what the file does with a time.

⚠️ **THE STORE IS `{ sid: { t, iso } }`, NOT THE SPEC'S `{ sid: "HH:MM" }`.** `TIME_KEY` (`interun_time_v1`,
declared with the store keys — seedDone reads it). Matched on (week, id) like a B1 link: ids recur across
rebuilds of different plans, so the stored date ties a time to the week it was set for, and a session dragged
to another day of that week keeps it. Measured in the test: a time set for "w2-d1-easy" in a plan whose
week 2 fell a fortnight later is NOT inherited by this plan's "w2-d1-easy".

⚠️⚠️ **PRUNED IN seedDone BY DATE ONLY — NEVER BY WHETHER THE PLAN HOLDS THE SESSION.** A holiday or a B2
skip takes a session out of the plan while it stands, and cancelling it must bring the session back with
its time; a prune against plan membership would lose the time on every such cancel (the same reason
LINK_KEY is never pruned on a rebuild). A time goes a week after the day it was set for.

⚠️ **THE SHEET IS PATCHED, NOT REBUILT, and it saves on `change` only.** A rebuild would throw the runner to
the top of a long sheet the moment the picker closed; `applySessionTime` updates the note and the Clear
button in place, re-arms the reminders (`initReminders`) at once, and toasts *"Set for 18:00."*.

⚠️ **FOUND IN THE BROWSER: `.mini-btn` SETS `display: inline-flex`, WHICH BEATS THE BROWSER'S `[hidden]`
RULE**, so the hidden Clear still showed beside an empty time. `.sd-time .mini-btn[hidden] { display: none; }`
restores it, and a guard pins the rule. Worth remembering for any `hidden` on a class that sets `display`.

⚠️ **AND A BACKTICK IN A COMMENT FAILED THE BUILD AGAIN** — the old `web/app.html` stayed in place and a
whole-suite run passed against it. Caught only because the build's own exit code was read.

**The note promises a reminder only while reminders are on** (`sessionTimeNote`): a sentence about a nudge
the runner has switched off is a sentence about a feature that is not there.

**Not done, deliberately:** an added session (an EXTRA) or a built run cannot be timed — the calendar file
does not carry those at all, so a time would reach the reminders and nothing else. The watch is not sent
the time (it would need a Swift change to show it).

**Tests:** `test/session-time.test.ts` (8): parses the real `.ics` and the real schedule items, the week-and-id
matching, the date-only prune driven through the real `seedDone`, the sheet's wiring, the note, and the time
on Today and the plan rows. The B1 and B2 tests' lift lists gained the time helpers. 18 of 18 re-breaks caught.

## MOVE A SESSION A WEEK EARLIER OR LATER (stage B4, 2026-10-04)

PLAN.md B4: *"Move a session a week earlier or later."* A planned run's sheet, from today on, has **Move to another
week** under Move to another day: **‹ A week earlier** and **A week later ›**. Each opens the other week's seven days
in place (dates on the buttons, the ones that cannot take it greyed, the reasons said once underneath, and what it
does to both weeks' distance). One tap moves it; the toast says *"Moved to Thu 15 Oct."* with Undo. Web-only.

**The store is the day-override store.** A week-move is `{ to, from, wk }` in `interun_dayov_v1`: the day it goes to,
the day the plan put it on in ITS week, and the week offset (±1) from that week. The offset is from where the PLAN put
it, never from where it sits: moved a week later and then a week earlier is HOME — an ordinary same-week override, or
none at all on its own day — never two moves that cancel. So a session is at most one week from where the plan put
it, and a moved session is offered *‹ Back to week N* (the way back) while the other direction says *"A session can
move one week from where your plan put it."*

### ⚠️⚠️ FOUND UNDER IT, AND B4 COULD NOT WORK WITHOUT IT: SESSION IDS SHIFTED A WEEK EVERY MONDAY

`applyProfile` builds the plan from **today** on every launch (a past `startDateIso` is replaced by today), so once a
block has begun it is a week shorter every Monday and **every later week's number drops by one**. Ids were
`w{week number}-d{day}-{type}`, so the session that was `w3-d1-threshold` on Sunday was `w2-d1-threshold` on the
Monday, and `w3-d1-threshold` then named a session a week LATER. Measured on a 12-week half (2026-10-02): the strength
session on Tue 20 Oct was `w4-d1-strength`, then `w3-…` from Monday 5 Oct, then `w2-…` from Monday 12 Oct.
**Everything filed against an id was hit:**
- **a same-week drag repeated itself** — this week's Tuesday run dragged to Thursday: next Monday, next week's
  Tuesday run carries the same id, the `from` check passes, and it is dragged to Thursday too (until the template
  changes or the collision belt intervenes);
- **a drag made for a future week jumped a week later** each Monday, and the real session lost it;
- **a B2 skip of a future week's session came back** after the Monday (the row's sid named the next week's session);
- **a B3 time set for a future week vanished** after the Monday (its iso check stopped it being misapplied — but it
  was lost);
- **swaps (A4)** are keyed `sessionId|exercise` with no date, so a swap on a future session jumped weeks too.
A week-move keyed on such an id would have scrambled itself every Monday.

**The fix is at the root: an id names its calendar week.** `sessionIdFor(weekStartIso, dow, type)` in
`src/plan/generate-plan.ts` gives `2026-10-12-d1-threshold` (the week's MONDAY, normalised, because a one-week plan's
only week starts on the start day). A week's Monday is counted back from race week and does not move when the block
shrinks, so an id names one calendar session for the life of the plan. All four id sites use it (finalize, the race,
race-week rest fillers, the shakeout). Measured: 170 of 170 ids kept across a Monday on a 20-week plan; on a 12-week
plan 73 of 93 — the other 20 are sessions the shrinking block genuinely re-planned (a different type that day), which
correctly get a new id. Unique within a plan (0 duplicates), and PLAN's ids still equal RAW's. Exported through
`RC.sessionIdFor`; `RC.HARD_BEFORE_RACE` too (below).

**Nothing the runner set is lost in the change.** `legacySid(id, iso)` carries an old `w3-d1-…` id to the new form, and
every store keyed on a session id is read through it, in its loader:
- **rows with their own date are carried by that date, exactly** — skips (`from`), times (`iso`), links (`iso`), heat
  decisions (`day`), heat declines (the value), finished strength sessions (`d`), the set log (`d`, inside `slogAll`);
- **the two with no date — dragged days and swapped exercises — go by the live plan's numbering**, which is exactly
  where the old code was applying them (so the runner sees nothing move), and **are written back at once**: read again
  after the next Monday, the same old key would land a week later;
- `migrateSlog` (v1 → v2, already run for anyone since A1) resolves v1's old ids the same way.
⚠️ The loaders call it from inside `adoptPlan` (applyCrossWeekMoves reads the override store at boot), so `legacySid`
is a function declaration that reads only `PLAN` (declared above the first `recompute()`) and `RC`.
⚠️ **`slogAll`'s `SLOG` is a `let` declared ~4,000 lines below the first `recompute()`**, so `migrateSlog` throws in
its temporal dead zone at boot and only runs on the next rebuild. Not changed here (it is idempotent and runs on the
first later rebuild), but it is why the set log is carried inside `slogAll` rather than by a boot-time migration.
Verified in the browser: an old drag, time and skip planted in the stores all landed on the right session at launch.

### ⚠️⚠️ THE REBUILD: applyCrossWeekMoves, BEFORE THE BREAKS — the other way round from PLAN.md's sketch

`applyCrossWeekMoves()` runs in `adoptPlan` right after `normalizeWeekStarts()` and **before** `applyAdjustments()`.
It moves RAW's session into the other week with `dayOfWeek` set to its new day, re-derives both weeks with
`RC.weekVolumeMeters` (and the quality count), and re-projects PLAN's two weeks with `RC.weekView`, adopting only the
session-derived fields (sessions, distanceKm, quality, longRunMin — never startIso, for easeWeekIn's reason).
⚠️ **WHY BEFORE THE BREAKS:** a move says where a session IS; a break applies to wherever sessions are. After them (the
spec), a holiday booked over the week a session was moved OUT of took it before it could move — lost from both weeks
— and a skip of a moved session, dated in its new week, found nothing there to take, so the session reappeared.
⚠️ **IT READS THE STORE** (`loadDayOverride()`), never `state.dayOverride`: it runs from the first `recompute()`, above
`state`'s declaration. ⚠️ **AND `PRIMARY_TYPES` MOVED UP** beside `let PLAN, RAW…`: it was a `const` a hundred lines
below the first `recompute()`, so reading it from here would have thrown in its dead zone and the try in `adoptPlan`
would have swallowed every week-move on every launch. `XWEEK` is declared there too. Both pinned by a guard.
⚠️ **ORDER-FREE.** Every move the plan can still recognise is lifted out first, then placed; one that cannot be placed
goes home and the placements are tried again (a fixpoint, at most one pass per move). So "Tuesday's run went to next
week and Monday's came into the Tuesday it left" holds whichever id sorts first — the test builds that chain so the
dependent move sorts FIRST. When two moves genuinely collide, the earlier-sorted one goes home.
⚠️ **ATOMIC:** every touched week is worked out before any is written, so a throw part-way leaves the engine's plan as
built. A throw sets `XWEEK = null` — "not known" — and then effDay reads no week-move and seedDone prunes none, so a
fault can never delete one.
**`XWEEK`** (`{ sid: { home, at, t } }`) is derived on every rebuild, never stored: which stored moves the plan as it
stands could honour. The title is kept because a break may since have taken the session out of the plan.

### xwRefusal — THE ONE SET OF RULES, read by the rebuild AND the sheet

`xwRefusal(s, home, ti, to, ov, rows, weeks)` returns why a run may not go to day `to` of week `ti`, or "". The rebuild
applies a stored move only on "", and the sheet offers a day only on "", so a day the sheet offers is a day the next
launch will honour. PLAN.md's refusals plus three:
- **taken** — a day already holding a run (by its effective day, through any same-week drag; a run a booked break or
  skip will take does NOT occupy its day — `xwDropped` asks the same `adjustFor`/`weekSkips`/`adjDrops` the break
  code does, so a day a holiday emptied is free exactly when it is free on screen). Within a week a drag swaps two
  runs; across weeks a swap would move a second session a week the runner never touched. A strength-only day is free.
- **race** — nothing into or out of race week (the last week).
- **eve** — `RC.HARD_BEFORE_RACE` (exported from the engine; the app keeps no copy, guarded) may not land the day
  before the race. Only a Monday race puts its eve in another week, so only that is reachable by a week-move.
- **far** — one week from where the plan put it.
- **eased** (not in PLAN.md) — a week the runner made easier takes nothing in and gives nothing up: easing demotes
  that week's hardest session, so a move in or out would change which one, after they chose.
- **start** — a part-week's days before the plan begins do not exist.
- **type** — runs only (PRIMARY_TYPES), never the race. Strength and mobility move within their week; a programme's
  sessions are dated.
The sheet adds what changes with time: **past** (a day that has gone) and **break** (a booked break would take it
straight back out — moving a run into a holiday you are not running on would toast "Moved" over nothing).
`xwOfferable` is B2's `skipOfferable` narrowed to runs: from today on, not the race, not already done.

### Everything else that reads a day-override, and what changed

- **effDay** ignores a week-move the last rebuild did not apply (its `to` is a weekday in ANOTHER week; read in the
  session's own week it would drag it there). `xwDayOf(ov, s)` is the same rule over any map, and also reads a stale
  same-week drag (from ≠ the plan's day) as the plan's day, as seedDone is about to prune it.
- **seedDone**: a session in `XWEEK` counts as live even when a break then took it (a skipped moved session would
  otherwise lose its move and reappear in its OLD week, where no skip names it — measured, fixed, guarded); a week-move
  not in `XWEEK` is pruned (only when XWEEK is known); the `from` check skips week-moves (the moved session's
  dayOfWeek is now its new day, so that check would delete every move the moment it was applied).
- **moveSession** (the sheet's day picker, both drags, the trial clash) keeps a moved session's `{ from, wk }` through
  a same-week drag or swap (otherwise the next rebuild found no week-move and snapped it back, drag discarded), and
  refuses — with a toast — a day the rebuild would refuse for it (a long run moved into the week before a Monday race,
  then dragged onto race eve, would otherwise snap back silently on the next launch).
- **The time of day (B3) goes with it**: re-dated to the new day by the move; Undo restores the time store too.
- **The pause's Undo** restored `state.dayOverride` and rebuilt WITHOUT saving it. `applyCrossWeekMoves` reads the store,
  so that rebuild ran without the week-moves and seedDone then pruned them as unapplied — an Undo that deleted the
  runner's moves. It saves first now, as the profile-save Undo always did; a guard sweeps every `state.dayOverride =`
  that is followed by a rebuild.
- **The Plan screen**: both weeks get the dashed border and a **Moved** tag (a window's or a skip's tag wins), and the
  opened week says *"Moved in · Thu 15 Oct — … was moved here from week 2. Open it to move it back."* /
  *"Moved out — … is now on Thu 15 Oct, in week 3. Open it there to move it back."* ⚠️ Found in the browser: a moved
  session later skipped in its new week left its OLD week reading as untouched with its threshold gone — that week
  now says *"… was moved to week 3, then taken off the plan there."*
- **Today**, on a day a week-move emptied: *"Moved to Sat 10 Oct — 80′ long run is in week 2 now, so today is free."*
  (B2's rule: not "Recovery day".)
- **The calendar drag still stays inside its week**, by design, but its refusal now says how: *"…To move it a week,
  tap it and choose a week earlier or later."*
- The commit is the standing one: store (and times) snapshot as strings → write → `recompute()` → computeToday,
  seedDone, restoreTicks → checked that it LANDED (XWEEK) before saying "Moved" → `toastUndo`. It leaves the runner
  where they were, like a skip.

### Also found and fixed: Today's card ate the last letter of a description

`todayDecision` trimmed a description's first sentence with `.replace(/\.$/, "")` written with ONE backslash, so the
page shipped `/.$/` — remove the last character, whatever it is — and the long run's card read "…under accumulated
fatigu." Seen in the browser while checking Today after a move. A sweep of the whole page template found it was the
only single-backslash regex escape; `test/template-escapes.test.ts` now holds the count at zero.

### Not done, and known

- Same-week moves of an ordinary session onto race eve are still allowed (pre-existing; only a moved session is held
  to the week-move rules on a drag).
- The picker observes two long runs in a week ("Week 5 would then have two long runs."), but not two hard days in a row.
- The calendar file's UID still carries `wk.index`, which shifts weekly, so re-importing the file can duplicate future
  events (pre-existing; the ids are stable now, so dropping `wk.index` from the UID is a one-line follow-up that
  changes every UID once).
- Swaps on a future session made before this change were carried by the plan's numbering on the first launch — where
  they were then applying — which is the best an undated row allows.

**Tests:** `test/move-week.test.ts` (15) drives the real lifted functions over a five-week plan built with the engine's
own `weekView`, starting next Monday so no day has passed whichever day the suite runs; plus the engine-id test over
two real plans a week apart. `test/template-escapes.test.ts` (2). Fixtures moved to the real id form in six test files;
lift lists gained the new helpers in six; the who-asks guards in `manage-plan` and `skip-session` name the new askers
and check they delegate. **23 of 23 re-breaks caught** — PLAN.md's own (skip the re-projection) among them — and 2 of 2 for the regex guard.

## A PAUSE PICKS UP WHERE YOU LEFT OFF (2026-10-04, the owner: "make a pause pick up where you left off")

Found the same day, as soon as the block stopped sliding (`notes/plan-profile.md`): the plan finally climbed week by
week, and a pause threw that away. It set a future start, and the block was built again from that day, so pausing
a fortnight in week 8 brought the runner back to **week 1 of a shorter plan**, starting from the weekly distance
they gave when they set it up. "Keep my target date" did the same after even three days.

**What a pause does now** (`pauseChanges`, the one definition: the sheet quotes from it and `applyPause` applies it):
- **Pick up where you left off** (14–28 days, while a plan is running; recommended at 14): the block AND the target
  date move later by the weeks away, so the runner comes back to the week they paused in, **from the same day of it**
  (every pick-up length is whole weeks, so the day back is the same weekday). Driven in the browser: week 6, a
  fortnight → "picks up on 18 Oct in week 6 … your target date becomes 3 Jan 2027", and afterwards week 6 held
  only that Sunday's 99-minute long run, week 7 was the plan's own 105 minutes, and the climb went on (111, 117, 123,
  easier weeks in place).
- **Start again from week 1** (21–70 days; recommended there): the old rebuild, honestly named. The tiers say a
  break of two to four weeks is "worth rebuilding the run-in", and past a month the gentler start comes with it.
  The option used to say "the whole block lands N later", which stopped being true once the block stopped sliding.
- **Keep my target date**: up to a fortnight, the block stays where it is and the days away are held empty, so the
  runner carries on from the week the plan has reached ("skipped, not squeezed in"). Longer: week 1 again, to the
  same date (as before). Never recommended (as before).
- **Leave my plan alone**: unchanged.
- **Back early** ("I am back — start now", or Cancel in Planned breaks): after picking up, the block and the target
  date come back by the whole weeks not taken (`pauseWeeks`), so today is still the week they paused in and the plan
  is as long as it was. Driven: same day → week 6 today, target 20 Dec again; Undo → the pause exactly as it was.

### How: where the block is laid out from is no longer always where it starts

- ⚠️⚠️ **`profile.blockFromIso`** is the day the block is laid out from, when that is earlier than `startDateIso`.
  `blockStartIso(pf)` reads it (ignored unless it is before the start). `startDateIso` keeps its meaning, the day
  the plan starts (again), so **a future start is still the whole of a pause**: `pausedCard`, the paused row,
  Planned breaks, B5 and B6 all read it unchanged. No pause store (still guarded).
- ⚠️ **The engine makes this exact.** It counts the block's length from the start's Monday and lays the weeks out
  backwards from the race's Monday, so moving the start and the race later by the same whole weeks gives the same
  block, just later. B6's "pick up where you left off" already relied on this.
- ⚠️⚠️ **THE WEEKS BEFORE THE RESTART ARE HELD, NOT DROPPED** (`holdBeforeStart`, inside `applyProfile` so the sheet's
  quotes and the adopted plan agree). Their sessions go from PLAN and RAW, a half-held week re-derives its figures
  (the engine's `weekVolumeMeters`), and a week wholly before the start is flagged `beforeStart`. Dropping them looked
  simpler and would have broken everything that reads a week by its number as an array position:
  `RAW.weeks[week - 1]` in `moveSession` and the session sheets, `PLAN.weeks[clash.week - 1]` in the clash check,
  every "Week " + (i + 1) in the ease offer and B5/B6, the race week as `index === PLAN.weeks.length`. Kept, week N
  is still `PLAN.weeks[N - 1]`, and only the screens that LIST weeks skip them (`firstShownWeek`): `computeToday`
  (nobody is "in" a held week, so a pause still reads as `TODAY_IN_PLAN` false), the Plan list and chart and its
  legend, the calendar, Today's week band (its pages and its scroll offset), `curWeekIdx`, the ease offer, and a
  week-move (`xwRefusal` "start"; the restart week's RAW `startDateIso` is the restart day, as the engine's own
  partial first week does).
- **History**: the weeks before a pause are out of sight afterwards, as every week before today was until the block
  stopped sliding. Each later pause re-anchors the same way, so any number of pauses works.
- ⚠️ **Everything that writes the profile was checked**: `draftFromForm` REPLACES the profile, so it now carries
  `blockFromIso`/`pauseWeeks` while the start is unchanged (else saving a name after a pause started the block again
  from week 1, `formStartIso`'s own defect one field over); the wizard, a new start date, `reusePlan` and B6's "start
  again" lay the block out from the start; B6's "pick up" moves `blockFromIso` (moving the start would only hide more
  weeks); `PLAN_PROF_FIELDS` carries both; every Undo restores both. `applyPause` used to leave the start moved when
  the rebuild threw; it now puts everything back.
- Small fixes on the way, both visible during a pause: the paused row's line now wraps (the part that says when you
  pick up was cut off by the ellipsis at phone width: 418px of text in 271px), and the week band says "Week 6", not
  "This week", when the runner is not in the plan today.

⚠️⚠️ **FOUND WHILE BUILDING IT: A HELD WEEK IS NOT EVIDENCE.** `addDayEvidence` takes the three weeks before this
one; held weeks prescribe nothing, so three of them and one run since read as full completion, and the add-a-day
offer (85% of the last three weeks) would have asked for another running day a week after the runner came back.
When a pause restarted the plan those weeks did not exist. They are skipped now, which also keeps the ease offer's
evidence (built from the same weeks) to weeks the runner was actually in.
⚠️ **Not changed, noticed:** during a pause Today's hero shows "Recovery day" for the selected day of the week the
plan restarts in. The old pause did the same.
⚠️ `launch` order: `holdBeforeStart` reads `ADJ_QUALITY` inside `applyProfile`, so a paused plan reads it at launch;
it is declared above the first `recompute()`, and `test/plan-anchor.test.ts` now lists it.

**Tests:** `test/pause-pickup.test.ts` (8), over the real engine and the real sheet, `applyPause` and
`resumeFromPause`. **24 of 24 re-breaks caught**, the defect itself among them (lay the block out from the restart
day and five tests fail). `manage-plan`'s two pause guards were restated for `pauseChanges`.
