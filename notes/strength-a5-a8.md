# Strength A5–A8 — player, progression, programmes, Strava

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.
>
> The plan itself is PLAN.md.

## ✅ A5 — THE GUIDED STRENGTH PLAYER, AND A REST TIMER THAT IS RIGHT WITH THE PHONE FACE DOWN (2026-09-20)

Tap Start on a strength day and the exercises run in order: supersets alternate, each set is logged with
one tap against last time's numbers, rests count down and buzz, holds count down, and finishing ticks
the day and lists the session under Logbook → Strength. Suite 1595 → **1617**;
`test/strength-player.test.ts` holds 22 guards and **17 deliberate re-breaks were all caught**.

⚠️⚠️ **THE ONE THING THIS STAGE IS ABOUT IS THAT REST IS MEASURED AGAINST AN ABSOLUTE TIMESTAMP AND NOT
COUNTED IN TICKS.** The stretch player it is modelled on does one decrement per interval, so a throttled
interval makes its clock run SLOW — harmless for a routine somebody is watching, wrong for the one timer
whose whole job is to be right while the phone is on the floor. iOS throttles timers hard in a
backgrounded web view (the same behaviour the coach schedule and the lock-screen distance both exist to
work around). **Measured in a real browser: twenty seconds of wall clock with ZERO interval ticks left
the countdown exactly twenty seconds further on — drift 0.0 s — where a tick-counting design would not
have moved at all.** `strRestLeft()` derives from `Date.now()` on every repaint and the interval only
decides how often the number is redrawn.

⚠️ **THE TEN-SECOND WARNING IS NOT FIRED AFTER THE REST HAS ALREADY ENDED, AND THE `return` IS WHAT DOES
IT.** Wake from a throttle at five seconds past the end and both thresholds are behind us; buzzing "ten
seconds left" then is a statement about the time that is simply false. Measured: on a normal run-down the
buzzes are `tick` at the threshold and `lift` at zero, once each; woken past the end, only `lift`.
⚠️ **A `T.warned = true` WAS WRITTEN IN THAT BRANCH AND REMOVED AFTER A RE-BREAK PROVED IT DEAD** — the
`return` precedes the warning check and `restEnd` is nulled, so the flag could not change any outcome.
A redundant assignment beside a real one is what invites the next reader to delete the wrong one.

### The engine says what a prescription means; the app never regexes the engine's own vocabulary

⚠️⚠️ **A HOLD IS NOT A FIELD, IT IS A REP WORDING — AND THERE ARE THREE OF THEM, ACROSS TWO BUILDER
PATHS.** `StrengthExercise` has no `hold` (that one belongs to stretches), so the only signal that a plank
should count down rather than ask for kilograms is the `reps` string: `"30–45s hold"` from the A3 builder,
`"20–40s hold"` from `BEGINNER_REPS`, and `"30s each leg"` for the balance drill — **a hold whose wording
never says the word**, on the path a runner with no strength preferences still gets. `holdSecondsFor` in
`src/strength/builder.ts` is the one definition, exported through `entry.ts`. A regex in the app layer
would be a second copy of the engine's vocabulary that goes stale in silence: nothing fails, a plank just
starts asking for weight.

⚠️ **IT ANSWERS THE TOP OF THE RANGE, AND THE REGEX IS WHAT DOES THAT — NOT THE `Math.max`.** In every
live wording the `s` is attached to the UPPER bound, so the lower one is followed by a dash and never
matches. **Measured: every live wording yields exactly ONE match, so max and min are identical and a
re-break swapping them changes nothing.** The max is defensive generality with no observable failure mode
today, recorded at the line rather than deleted so nobody "verifies" it by removing it — and the guard was
re-aimed at the real mechanism once the re-break exposed that it had been testing an unfalsifiable line.
⚠️ Answering the bottom would have a countdown congratulate somebody a third of the way through.

⚠️ **AND THE CLASSIFICATION IS SWEPT OVER REAL PLANS, NOT A LIST.** A hand-written list of rep strings
goes stale the first time the builder rewords one; the guard generates plans across three levels, two
goals and three lengths, and requires every distinct string produced to be classified correctly — plus at
least one of each kind to have appeared, or the sweep proved nothing either way.

### The play order — and a superset pair whose members have different set counts

⚠️ **A SUPERSET ALTERNATES AND RESTS ONCE PER ROUND, WHICH IS THE ONLY REASON TO HAVE ONE.** The builder's
own `pairCost` charges a pair `max(setsA, setsB)` rounds of `work × 2 + one rest` — so playing the pair as
two separate blocks silently adds a rest per round and overruns the minutes printed on the card.

⚠️⚠️ **AND A PAIR CAN HAVE UNEQUAL SET COUNTS — measured on a real 45-minute session, group 3 is a 2-set
step-up paired with a 1-set plank.** Round 2 has no partner, so it is a single set with its own rest
rather than half of a pair. Zipping the two lists and assuming equal length drops the step-up's second set
entirely. Real play order for that session: `rdl#1 → pushup#1 → rdl#2`, `stepUp#1 → plank#1 → stepUp#2`.
⚠️ **NO REST AFTER THE LAST SET OF THE SESSION** — a countdown starting when there is nothing left to come
is a timer asking the runner to wait for the end of their own workout.
⚠️ Guarded by sweeping every real generated strength session and requiring the player's set list to be a
permutation of the prescribed one — every set exactly once, none invented.

### A hold is performed and counted, and logged nowhere

⚠️ A plank is not weight × reps. Writing its seconds into the reps field corrupts the one number A6's e1RM
will read (Epley is defined for 1–10 reps), and `strengthHistory` drops any row carrying neither weight
nor reps anyway — so a hold row would be written and then silently discarded. It is counted towards the
session and the completion row; nothing else.
⚠️ **THE LABEL SAID THE WORD TWICE** — "Hold for 30–45s hold", because the prescription already ends in
it. Found by reading the rendered label in a browser, not the code, and stripped rather than assumed
because the other live wording ("30s each leg") does not carry the word at all.

### Finishing — a fact of its own, in its own store

`SDONE_KEY = "interun_sdone_v1"`, one row per finished session: `{ d, s, at, sets, ex, min }`.

⚠️ **(d, s) IS THE IDENTITY, FOR EXACTLY THE REASON THE SET LOG LEARNED IT.** Session ids are
deterministic — `w3d2-strength` recurs in every rebuilt plan — so the id alone says "a session of this
shape", not "this session on this day". Keyed on the id alone, finishing week 3's strength day reads as
having already finished week 7's. Verified live: a second strength session on another day stays unticked.

⚠️⚠️ **A FINISHED SESSION IS NOT DERIVABLE FROM THE SET LOG, AND NOT FROM `state.done` EITHER — WHICH IS
WHY THE STORE EXISTS.** A runner can log three sets and walk away, and a bodyweight session can be
finished in full having written no set rows at all (holds log nothing, a press-up needs no kilograms), so
counting rows calls the first finished and the second unfinished — both answers wrong. And `seedDone`
marks every non-rest session dated before today as done whether it happened or not, so `state.done`
answers "is this in the past", not "did they do it".

⚠️ **`seedDone` RE-DERIVES TODAY'S TICK FROM THE STORE, MATCHED ON DATE AND ID.** `state.done` is rebuilt
from scratch on every boot, so a tick set by the player and nowhere else lives exactly until the app is
next launched — the runner finishes a session, closes the app, comes back and the day is unticked.
Verified by reloading: the tick survives, and the Start button then reads "Do it again".
⚠️ **FINISH IS IDEMPOTENT AND UPDATES RATHER THAN SKIPS** — the Finish button, a second tap and
re-finishing an already-completed session all produce one row, and finishing again after logging two more
sets records the fuller attempt rather than the first.

### Wiring — and the guard from the last stage that caught this one

⚠️ **THE STRENGTH START MUST NEVER REACH THE RUNNING PATH.** `#sdStart` opens "where shall we record
this", which leads to GPS, a wake lock, the coach and a live `LiveSession` — every one wrong for a session
done standing still in a room, and the GPS one wrong expensively (the location indicator on for forty
minutes of squats). `PRIMARY_TYPES` is the runnable set and excludes strength, so the two ids cannot
collide by accident. Driven: **0 calls to `openStartWhereSheet`, 0 geolocation watches, `LIVE` still null.**

⚠️⚠️ **A4's "EVERY CONSUMER OF `.exercises` CALLS `withSwaps`" SWEEP CAUGHT A5 ON ITS FIRST FULL RUN.** The
player's flattener read `.exercises` with no swap applied — correct only because the one caller happened
to pass `withSwaps`' output, which is a convention every future caller has to know and one of them
eventually will not. **Swaps are now resolved at the player's ENTRY POINT**, so `SPLAY.sess` is the swapped
session for the player's whole life and the flattener stays pure; it is exempted with that reason, and a
guard proves the entry point still applies it rather than taking the exemption on trust. That is the
derived-sweep-over-a-hand-written-list design doing exactly its job one stage later.

⚠️ **`closeSheet` STOPS THE PLAYER**, or its interval runs on behind a dismissed sheet and buzzes into the
next session — the trap `stretchStop`'s own comment records. `openStrengthPlayer` also stops any previous
one first, so two intervals can never run together.
⚠️ **THE PLAYER REPLACES THE SHEET BODY IN PLACE** and never opens a second `.sheet-ov`, like the swap
picker and `openProfilePreview`: a nested sheet needs its own back-stack and is the shape of z-order bug
this project has shipped twice.

### Three measurement traps this stage paid for

⚠️⚠️ **AN OPEN OVERLAY MAKES EVERY `elementFromPoint` HIT-AREA PROBE REPORT THE BARE BOX.** My tap-target
sweep read **36.75 px** for `.mini-btn` against this app's 44 px floor and I was one edit from "fixing" it
— when `.mini-btn` has had a 44 px `::after` since the accessibility pass and the computed `min-height`
was 44 px the whole time. An onboarding guide (`guide-ov on`, z-index 80, above the sheet's 70) was open
and swallowing every probe point. Dismissed, every control measures **44.25 px minimum**. **Ask what is
on top before believing a hit-test.**

⚠️⚠️ **A RE-BREAK HARNESS THAT DOES NOT CHECK ITS BASELINE BUILDS REPORTS FALSE PASSES — fifteen of them
in one run, observed.** A backtick in one of my own comments broke the build between the edit and the
re-break run, so every `web/app.ts` break reported "the build refused it" and the harness scored them
caught. It now refuses to start against a tree that does not build. **A harness that cannot tell "my break
was rejected" from "nothing built here anyway" is not a harness.**

⚠️ **AND A GUARD MUST NOT SLICE ON A MARKER THE DEFECT ITSELF CAN INTRODUCE.** The hold-branch guard
sliced from `it.hold` to where the rep-logging branch begins — and a re-break that put a rep-logging div
INSIDE the hold branch moved that very marker, so the slice collapsed and the assertion passed against
exactly the defect it names. It renders the two states and looks at the output now, with the rep set as
its own control so "no weight boxes" cannot be satisfied by rendering nothing.

⚠️ **THE BACKTICK RULE FIRED TWICE, BOTH IN MY OWN COMMENTS**, and the first time `build exit=0` was
**`tail`'s** exit code, not the build's — the pipeline lied about the very thing the rule exists to catch.
Read the build's own status.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1617 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged, and the
progression audit **byte-for-byte identical to A4's baseline** (24 under-floor weeks of 18,216, deload
depth 29.3%, taper 35.8/21.3/47.4%, long-run inversion 0.9% — A5 adds a pure function nothing in the
generator calls). Driven end to end in a real browser: a 16-set session played to completion, the 20-second
throttle test, both buzz cases, a hold started and stopped early, the completion row, the reload, the
Strength tab, and no horizontal overflow at 430 and 320 px in both themes.

**Still to come in this track:** A6 e1RM and progression, A7 standalone programmes, A8 Strava as Weight
Training, A9 the watch.

## ✅ A6 — TURNING THE SET LOG INTO COACHING: e1RM, A SUGGESTED LOAD, AND A NEW-RECORD TOAST (2026-09-20)

Every lift now shows an estimated one-rep max, how much you lifted this week, and a trend arrow. The kg
box suggests your next load and says why. Beating your own best — heaviest set, best e1RM, most volume
— gets a toast. `src/strength/progression.ts` and `src/strength/records.ts` are the two new pure engine
files; nothing new is stored, so there is no migration risk here at all — A6 reads the log A1 built and
never writes to it.

⚠️⚠️ **A BARE DIGIT-DASH-DIGIT REGEX CANNOT TELL A REP RANGE FROM A HOLD, AND MY OWN TESTS CAUGHT IT
BEFORE IT SHIPPED.** `repRange("30–45s hold")` happily extracted `[30, 45]` and offered a load suggestion
for a plank — the same shape trap `holdSecondsFor`'s own comment already records for three live rep
wordings. Fixed by asking `holdSecondsFor` itself (imported from `builder.ts`) rather than inventing a
second, disagreeing test for the same fact — one definition of what counts as a hold, read by both the
session player's countdown and now the suggestion engine.

⚠️ **THE SUGGESTION IS A VALUE THE ENGINE RETURNS AND A PLACEHOLDER THE APP MUST NEVER WRITE AS A VALUE.**
"Suggests" and "logs" are different verbs: a runner who never touches the kg box must never have a
computed guess recorded as if they had typed it. `strpW`'s `placeholder=` carries `sugg.kg`; its
`value=` carries only `strPrefill`'s answer — what the runner actually did last time. Driven, not
grepped: the guard renders the real `strPlayerBodyHtml` with a store seeded so the two numbers are
provably different (20 kg prefilled, 22.5 kg suggested) and asserts the suggested figure never appears
inside a `value="..."` attribute anywhere in the output. Re-broken by moving the suggestion into `value`
— caught.

⚠️⚠️ **A RECORD NEEDS SOMETHING TO BEAT, AND THE FIRST VERSION OF THAT RULE WAS PROVED TWICE OVER.**
`detectStrengthRecords` refuses outright when `priorInstances.length === 0` — without it, a runner's
very first-ever log of any exercise would toast "New best!" on every single one, which cheapens the ones
that mean something. Re-broken by commenting out the early return: **both** the pure-engine test and the
driven app-layer test caught it independently, which is exactly the kind of double coverage this project
keeps recommending and rarely gets for free — here it fell out of testing the same invariant from two
different entry points (the raw function, and the app's `strNewRecordMessage` wrapper around it).

⚠️ **STRICTLY GREATER, ON ALL THREE — A TIE IS NOT A RECORD.** Heaviest single set, best estimated 1RM,
most total volume in one session, each compared independently so a heavier single doesn't silently also
claim the volume record it didn't earn (and vice versa). Measured: a heavier single at fewer reps sets
"heaviest" alone; more reps at the same weight can set "e1rm" alone (though constructing that case by
hand turned out to need the PRIOR instance to carry enough volume of its own to absorb the extra reps —
epley1RM rewards reps far more gently than volume does, so isolating an e1RM-only win from a single
low-weight set is often mathematically impossible against a single-set prior); more total sets set
"volume" alone. All three can fire together.

⚠️ **THE "NO HISTORY" FALLBACK IS NOT THE SAME QUESTION AS "FIRST TIME EVER."** `suggestLoad` falls back
to `loadPercent1RM × best e1RM on record` whenever the most recent PRIOR INSTANCE has no complete
weight+reps set to double-progress from — which covers a genuine first-ever log, but also a return to an
exercise after a gap, or a swap back to something logged only partially last time. The fallback reads
`bestE1RMKg` over **every** prior instance, not just the most recent, so a runner with real history
still gets a seeded number even when there's nothing recent enough to judge "top of range" against.
Where NEITHER ingredient exists — no `loadPercent1RM` on the exercise (an accessory movement) or no
e1RM anywhere on record — it stays honestly blank rather than inventing one.

⚠️⚠️ **THE HISTORY CARD'S "TREND" ANSWERS A DIFFERENT QUESTION FROM THE LIVE PLAYER'S SUGGESTION, ON
PURPOSE, AND THAT IS NOT AN INCONSISTENCY.** `suggestLoad` needs the CURRENT prescription (a rep range, a
load%) to judge "at the top of the range" — the right question mid-session, where that context exists.
The set log stores no prescription against a past row, only what was actually lifted, so reusing
`suggestLoad` for the history card would mean inventing a fake current prescription for an exercise that
might not even be in this week's plan. The honest question there is simpler — is the most recent
session's best e1RM higher than the one before it — and `instanceE1RM` (a small new helper, distinct
from `RC.bestE1RMKg` which looks across every instance ever) answers exactly that, using nothing but
`RC.epley1RM` per set so the arithmetic still has one definition.

⚠️ **DIAGNOSED A "MISSING FEATURE" THAT WAS CORRECT BEHAVIOUR, IN A REAL BROWSER, BEFORE TRUSTING IT.**
Driving the app end to end, the first seeded exercise showed no e1RM/volume/trend line at all — looked
exactly like a bug. It was my own test data: every logged set used 12 reps, one past Epley's 1–10 domain
by design (`epley1RM` refuses reps outside it, on purpose — "the formula's error grows too fast past
ten"), and both instances were dated outside the real current ISO week (`logWeekStartIso()` reads the
actual wall clock, not a simulated date). Re-seeded with 5-rep sets inside the real current week: the
card correctly rendered `↑ ~53 kg estimated 1RM · 450 kg this week`. Read the live function's own source
out of the running page (`window.viewStrengthHistory.toString()`) before concluding a rendered card is
wrong — it was the fresh build the whole time, just fed data outside its honest bounds.

⚠️ **A COLOUR TOKEN FOR THE TREND ARROW HAD TO BE PICKED CAREFULLY.** The first draft used
`var(--eff-hard)` for the "up" glyph — reusing ruling 7's ONE session-effort vocabulary for an unrelated
fact about a weight trend, which is exactly the "second colour vocabulary" violation this file records
the Manage Plan screen paying for once already. Caught before it shipped; `var(--accent)` instead,
matching `.sh-best b`'s own existing treatment of the best-weight figure.

⚠️⚠️ **`strPlayerBodyHtml` GAINED A NEW DEPENDENCY AND A5's OWN TEST HARNESS FOR IT WENT STALE — the
acceptable kind, failing loudly (`ReferenceError: strSuggestFor is not defined`) rather than quietly
measuring less.** `test/strength-player.test.ts`'s hand-lifted `loadBodyHtml()` didn't know about
`strParseSet`/`strPriorInstances`/`strSuggestFor`, so every test driving `strPlayerBodyHtml` broke the
moment A6 touched that function. Fixed by extending the lift list and supplying a real (not stubbed) `RC`
— the same "a probe that supplies its own dependency measures a strictly easier program" principle that
file's own comment already states for `holdSecondsFor`.

⚠️ **EVERY A6 ENGINE EXPORT IS CHECKED AGAINST THE ACTUAL BUNDLED `RC`, NOT JUST `entry.ts`'s CLAIM TO
EXPORT IT.** `web/entry.ts` saying an export exists is a source-level promise; esbuild actually carrying
it into the IIFE's property map is a fact about the built artifact. A one-line guard greps `web/app.html`
for `name:()=>` for each of the five new names — cheap, and it is exactly the class of gap that has
shipped a "fully wired, fully tested and completely dead" feature in this codebase before (the coach
audio bug this file already records at length).

**Toast wording, by kind:** "New best: {name} {weight} kg" (heaviest), "New estimated 1RM: {name} ~{weight}
kg" (e1rm), "New best volume: {name}" (volume) — the first genuine hit, in the order the runner met the
exercises, since `toast()` shows one message at a time and firing several back to back would just
flash-overwrite each other. ⚠️ Not HTML-escaped: `toast()` sets `.textContent`, which never interprets
markup, so running `esc()` on the exercise name would turn a literal `&` into the visible text `&amp;` —
the opposite mistake from what `esc()` exists to prevent, caught before it shipped by checking which DOM
property `toast()` actually writes to.

**Five deliberate re-breaks, all caught, tree restored byte-identical each time (never `git checkout` —
copied aside, copied back):** the suggestion moved from `placeholder=` into `value=`; the "all sets at
top of range" rule flipped from up to down (caught by 6 of the pure-engine tests at once — every rule
that shares that code path); `detectStrengthRecords`'s no-prior-instances guard commented out (caught by
both the pure-engine and the driven app-layer test independently); the word "estimated" dropped from the
history card's copy; and `strFinish`'s `sets > 0` gate removed from the record check.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc clean
apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1652 pass / 0 fail under
UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both design ratchets unchanged (143 radii, 322
font sizes — the new CSS reads `var(--t-*)`/`var(--r-*)`/`var(--s*)` throughout, nothing off-ladder), and
the progression audit **byte-for-byte identical to A5's baseline** — A6 touches no generator code, only
render-time reads of the already-existing log. Driven end to end in a real browser against the served
`docs/`: a real session played through the guided player with a genuine top-of-range suggestion shown as
a placeholder distinct from the prefilled value, a heavier set logged and the "New best" toast firing on
the real Session-done screen, and the Logbook → Strength card showing the estimated 1RM, this week's
volume and an upward trend arrow once fed data inside Epley's valid domain and the real current week.

**Still to come in this track:** A7 standalone programmes, A8 Strava as Weight Training, A9 the watch.

## ✅ A7 — STANDALONE STRENGTH PROGRAMMES, AND THE PLAN STEPS ASIDE (2026-09-20)

Start a 4–12 week programme from the same questions the plan already asks. Its sessions land on days
that do not fight the running, the plan schedules no strength of its own while one is running, and
the blocks progress — technique, then loading, then heavy, easing off every fourth week — with an
A/B(/C) rotation so two sessions in a week are not the same lifts. Suite 1652 → **1675**;
`test/strength-programme.test.ts` holds 23 guards and **32 deliberate re-breaks were all caught**
(three only after a guard was strengthened — those three are the useful half).

⚠️ **THE PROGRESSION AUDIT IS BYTE-IDENTICAL TO HEAD**, proved by running it in a stashed worktree
rather than argued: `strengthProgramme` is absent from every existing profile, `pickForSlot`'s new
`rotate` argument defaults to 0 (the shipped order), and `buildStrength`'s level bump is suppressed
only when an `intent` is injected, which nothing but a programme does.

### ⚠️⚠️ THE SESSIONS ARE DERIVED INTO `EXTRA`, NEVER STORED THERE

The obvious build materialises them into the extras store and re-places the future ones on every
rebuild. That hits **three temporal dead zones at boot**: `adoptPlan` is reached from a top-level
`recompute()` at `web/app.ts:7420`, while `const state` is at 7464, `const PRIMARY_TYPES` at 7509 and
`let EXTRA` at ~12354 — all below it. Deriving instead, at the moment `EXTRA` is built and again
whenever the plan changes, removes the whole class.

- `loadExtra()` returns `stored.filter(!prog).concat(progExtras())`; `saveExtra()` strips `prog` rows.
  ⚠️ **WITHOUT BOTH HALVES A PROGRAMME DOUBLES ON EVERY REBUILD** — a stored copy of a derived row is
  a second copy of every session, and it outlives the programme that produced it, un-removable.
- `refreshProgExtras()` runs from `adoptPlan`, **gated on `EXTRA_READY`** and **before the two syncs**
  — after them, iOS holds reminders and the wrist holds a schedule for sessions that have just moved.
  An ORDERING claim, guarded as one.
- ⚠️ **`extraSession` ROUTES A PROGRAMME ROW FIRST.** It carries `type: "strength"` and would
  otherwise fall through to `buildCustomSession`, which resolves a type to **the plan's representative
  session of it** — so every week of a twelve-week programme would render as the plan's own strength
  session with none of the block progression that is the entire point.
- ⚠️ **`removeExtra` RECORDS A SKIP** (`p.skipped[id]`), because deleting a derived row is undone by
  the next rebuild. The ids are deterministic (`p<pid>-w<k>-s<j>`), which is what makes a skip and a
  move survive one; a guard asserts two derivations of one record agree exactly.

⚠️ **AND THE CALENDAR HAD NEVER SHOWN AN EXTRA AT ALL, WHICH A7 TURNS FROM A GAP INTO A DEFECT.**
`viewCalendar` maps `PLAN.weeks[].sessions`, so a session the runner ADDED to a day has only ever
appeared on Today. One added run is a thing you remember; sixteen programme sessions over eight weeks
is a schedule, and a schedule you cannot see is not one. `calExtraRow` renders **every** extra, not
only a programme's — measured at 3 ms for 16 builds on a full calendar render.
⚠️ **NO TICK BOX ON IT.** `state.done` is keyed `doneKey(weekIndex, session)` = week|day|title, which
an extra has no week index for; Today's own extras card has no tick for the same reason.

### ⚠️⚠️ THE BLOCK PROPOSES THE SET COUNT AND THE RUNNER'S MINUTES DISPOSE — SO THE CARD ASKS THE BUILDER

`programmeWeek(week, level)` is the block table. `programmeWeekFor(week, prefs)` is what this runner
will actually be given, and the two **disagree in both directions**: a 20-minute advanced heavy week
is prescribed 3 sets and delivered **2** (the spine has to fit), a 60-minute intermediate technique
week is prescribed 2 and delivered **3** (an hour has to buy something). A card reading "3 × 3–6" over
a session giving two sets is a title promising what a session does not contain, which this repo has
shipped twice.
⚠️ **THE FIX IS IN THE CARD, NOT THE BUILDER.** Making the block authoritative would undo A3's own
measured rule — the sets give way before the movements do, or a 30-minute advanced session is one
exercise. Both the card and the create sheet's overview read the delivered shape; a guard forbids
either reaching `programmeWeek`/`programmeWeeks` at all, because those are the numbers that can lie.

### ⚠️⚠️ A SWEEP THAT MEASURED NOTHING AND REPORTED CLEAN — THE MOST VALUABLE FINDING HERE

A probe comparing the card's set count against the built session's said **"0 mismatches" across 288
cases**. Every one of those sessions had **zero exercises**: the probe's fixture omitted
`sessionsPerWeek`, `rotationIndex` answered NaN, and `all[(NaN + i) % n]` is `undefined` for every
slot — so the comparison was skipped 288 times and the zero read as a pass. **A `.mjs` probe has no
typechecking, so it can feed the engine a shape no caller can produce**, which this file already
records twice.
- The guard now asserts it was **not vacuous** (≥1000 comparisons genuinely made) before believing
  its own zero. Swept properly: **5184 cases, 0 mismatches, 0 empty sessions.**
- ⚠️ **AND IT EXPOSED A REAL SILENT-TOTAL-FAILURE HOLE.** `pickForSlot` now refuses a non-finite
  rotation and falls back to 0. The rotation comes off a **stored record**, so a record written before
  that field existed, or restored from an older backup, is exactly how NaN gets there — and the
  failure is a card promising forty-five minutes of lifting with **nothing on it** and nothing thrown.
  Same lesson as the engine's `qualityRefFor`: a gate written `!= null` lets NaN through.
- ⚠️ **`rotationIndex` IS TOTAL TOO, AND THAT HID THE FIRST GUARD.** Belt and braces hides the brace
  you are testing: removing `pickForSlot`'s guard changed nothing measurable through
  `buildProgrammeSession` — watched escaping. The guard drives `buildStrength` directly now.

### PLACEMENT: TWO TIERS, AND THE SPLIT IS WHAT MAKES FOUR SESSIONS A WEEK POSSIBLE

**HARD** (never): the long-run day, race day, race eve, a day already carrying a strength session.
**SOFT** (scored): the eve of the long run (+100), the eve of a quality day (+50). Banning all of them
leaves fewer than four placeable days in a seven-day week and the runner may ask for four — the
identical arithmetic `strengthDaysFor` already records.

⚠️⚠️ **MEASURED AGAINST A CONTROL WITH THE SCORE DELETED, BECAUSE A BARE PERCENTAGE CANNOT TELL A RULE
THAT IS WORKING FROM A RULE THAT NEVER HAD ANYTHING TO DECIDE:**

| sessions/week | shipped eve-of-long | control (rule removed) |
|---|---|---|
| 1 | **0.0%** | 23.2% |
| 2 | **0.0%** | 25.0% |
| 3 | **0.0%** | 16.7% |
| 4 | **12.5%** | 12.5% |

At one, two and three a week the eve of the long run is **never** used; at four it is unavoidable and
the rule changes nothing. **My first bound was 6% picked by taste and it failed at 8.3%** — an
aggregate that would have hidden both halves. The quality eve is what pays for it: at three a week the
shipped placer uses one 16.7% of the time and the control never does, which is the stated trade (when
something gives, it gives on the smaller session).

⚠️ **AND THE RACE-EVE BAN WAS UNTESTABLE UNTIL THE LAST WEEK JOINED THE SWEEP.** Weeks 1 and 6 of a
four-month block contain neither race day nor its eve, so deleting the ban outright **passed every
assertion** — the fixture-too-kind trap, in the one test whose subject is race day. The sweep now
counts how often a race eve was even a candidate and fails if it never was.

### THE RUNNER MAY MOVE A SESSION, AND BEFORE THIS THE CONTROL LOOKED LIVE AND DID NOTHING

⚠️⚠️ **A PROGRAMME SESSION IS DATED, NOT WEEK-AND-DAY, SO `moveSession` CANNOT MOVE IT — AND IT DID
NOT REFUSE, IT WROTE A `dayOverride` NOTHING READS.** Measured by driving the session sheet: tapping a
day rescheduled nothing, left a dead override in the store, and closed the sheet as though it had
worked. Sixteen of them on one screen. **Found by driving the control, not by reading the code.**
`progMove(id, iso)` records it and `progExtras` honours it.
- ⚠️ **INSIDE ITS OWN WEEK ONLY**, and that is structural: the programme is blocks of weeks, so a
  session dragged into the next one leaves a week with three sessions and a week with one, both at the
  wrong block's prescription.
- ⚠️ **A MOVE ONTO A DAY THE PROGRAMME ALREADY USES SWAPS**, which is what the sheet's own copy
  promises ("if a run is already there, the two will swap"). Without it both of that week's sessions
  land on one day, against the placer's own one-a-day rule. The session that did **not** move gives way.
- ⚠️ **NOT RE-SCORED.** A choice then overruled by our own preference is the app deciding, which the
  weekly review's standing instruction forbids.

### The rest of the decisions

⚠️ **`Athlete.strengthProgramme` IS READ BY THE ENGINE, NOT FILTERED BY THE APP AFTERWARDS.**
`strengthSessionsFor` returns 0 **above** the `includeStrength` check — the two answers are about
different things — and `buildNotes` says so, so the plan the runner reads and the plan the watch is
sent agree about it. ⚠️ **`viewPlan`'s note filter had to admit the new wording**, or the note is
written and never shown: the computed-and-discarded trap, which this repo has now recorded seven times.
⚠️ **AND IT IS READ FROM THE STORE, NOT A PROFILE FIELD** — the programme IS the record, and a second
copy of "is one running" on the profile is the one that goes stale.

⚠️ **`progActive` REFUSES AN ENDED *OR* AN EXPIRED PROGRAMME, AND ONLY THE SUPPRESSION CAN FAIL.**
`progExtras` skips any past week on its own, so deleting the expiry check changes nothing it produces
— watched escaping. What the check holds is `applyProfile`: without it a programme that finished in
March keeps the plan's own strength suppressed for ever. **The guard was restated to the claim with
teeth rather than the one that was easy to write.**

⚠️ **NO PLYOMETRICS IN A PROGRAMME SESSION.** The contacts are prescribed against the running week's
tolerance for them; a standalone programme has no running week to hang that judgement off.

⚠️ **STARTING AND ENDING GO THROUGH `recompute()`, NOT A HAND-ASSIGNMENT.** Both change what the
ENGINE builds, so the plan has to be rebuilt with the ticks carried across it — `todayTicks()` /
`seedDone()` / `restoreTicks()`, the pairing `doSaveProfile` is the one path that ever missed.

⚠️ **NO NEW CSS.** The card reuses `.sh-card`/`.sh-rows`/`.sh-row`, the sheet reuses
`.po-opt`/`.po-t`/`.po-b`/`.po-verdict` and `.act-pair`/`.ap-yes`/`.ap-no`. Both design ratchets and
`CSS_DUP_CEILING` are unchanged.

### Traps this stage paid for again

⚠️ **`ensureSheet()` ONLY BUILDS THE NODE — every opener adds `.on` itself.** Written without it the
sheet filled in perfectly and stayed **invisible**: the option buttons existed, were wired, and could
never be reached. Found by driving the button.
⚠️ **`confirmSheet` IS POSITIONAL** `(title, body, confirmLabel, onConfirm)`, not an options object,
and it closes the sheet itself before calling back.
⚠️ **THE BACKTICK RULE FIRED THREE TIMES**, all in my own comments; the build failed outright each
time, which is the good outcome. Sweep `git diff | grep '^+' | grep -F '\`'` before building.
⚠️ **`buildPlanSummary(athlete, goal)` TAKES TWO ARGUMENTS** — the start date rides on the `Goal`
(`options.startDateIso ?? goal.startDateIso ?? today`), which CLAUDE.md already records.
⚠️ **`profile.strength` IS THE BOOLEAN THE ENGINE READS**, not `includeStrength`; a seeded fixture
setting the latter builds a plan with no strength in it and the "plan steps aside" claim then proves
nothing. Every claim in this chapter's browser drive was re-taken after that was fixed.

**Still to come in this track:** A8 Strava as Weight Training, A9 the watch.

## ✅ A8 — STRENGTH REACHES STRAVA AS "WEIGHT TRAINING" (2026-09-21)

A finished strength session can now reach Strava, using the exact same device-key connection and the
exact same auto-send switch a run already uses. It shows up as Weight Training — never a Run — with a
duration and a sets/volume line, whether it was sent by hand or automatically.

⚠️⚠️ **THE OLD WORKER HARDCODED `sport_type: "Run"` IN BOTH UPLOAD SHAPES, SO SENDING A STRENGTH
SESSION WITHOUT FIRST FIXING THE SERVER WOULD HAVE FILED IT AS A RUN WITH NOTHING ANYWHERE TO SAY SO.**
That is the whole reason this stage is two halves that have to agree, deployed independently — the
Worker by hand (`wrangler deploy`, the owner's manual step), the client over the air on the next
launch — and it is why the FIRST thing built was a handshake rather than the payload.

### THE HANDSHAKE: `sportTypes` ON EVERY `/strava/status` REPLY, CONNECTED OR NOT

`SPORT_TYPES = ["Run", "WeightTraining"] as const` and `resolveSportType(v)` are exported from
`alfie-proxy/src/strava.ts` for exactly the reason `src/strength/progression.ts`'s pure functions are —
so a test can drive the real resolution with no KV and no network. Absent means `"Run"`, unchanged for
every run this Worker has ever uploaded (none of which has ever sent the field); present-but-unknown is
refused (400) rather than silently defaulted, which is the new behaviour and the whole point.

⚠️ **`sportTypes` RIDES ON EVERY REPLY FROM `status()`, INCLUDING "NOT CONFIGURED" AND "NOT LINKED",
BECAUSE IT IS A FACT ABOUT THE DEPLOYED CODE, NOT ABOUT ANY ONE RUNNER'S CONNECTION.** A client has to
learn what a Worker understands before it has necessarily connected to Strava through it. `stravaRefresh()`
copies it straight onto `stravaCfg()` (`c.sportTypes = Array.isArray(r.json.sportTypes) ? … : []`), and
`stravaCanWeightTraining()` is the one gate: connected **and** the cached list contains
`"WeightTraining"`. Everything that could ever send a strength session — the auto-send hook and the
manual button — asks this gate first and **fails closed**: an old Worker, or a client that has simply
never refreshed yet, sends nothing rather than sending it wrong. Re-broken four ways (old Worker, partial
rollout, not connected, the real upgraded case) and all four land where they should.

### THE PAYLOAD IS ALWAYS MANUAL, NEVER GPX

`strengthStravaPayload(row)` reads a finished-session row from `SDONE_KEY` (A5's completion store) and
builds `{ kind: "manual", sportType: "WeightTraining", trainer: true, distanceM: 0, … }`. A squat has no
route, so there is nothing to draw and nothing to fabricate one from — the same rule `runStravaPayload`
already states for a run with no trace, applied to a kind of session that never has one.

⚠️ **THE DESCRIPTION IS BUILT FROM THE SESSION'S OWN NUMBERS, AND THE SERVER LEARNED TO ACCEPT ONE
WITHOUT DROPPING ITS OWN ATTRIBUTION.** `description` used to be a hardcoded `"Recorded with
Inte-Run."`; it now reads an optional `run.description` from the client and prefixes it —
`extra + " Recorded with Inte-Run."` — so "45 min · 3 exercises · 9 sets · 600 kg lifted" appears on
the activity ahead of the app's own line, and a run (which sends no `description` at all) is
byte-for-byte unaffected.

⚠️ **VOLUME IS SUMMED ACROSS THE WHOLE SESSION, NOT ONE EXERCISE.** `strSessionVolumeKg(iso, sessId)`
finally gives `slogForSession` — A5's own per-instance lookup, written for the older card renderer and
called nowhere else — a second caller, and reuses `strParseSet` (the one definition of a stored row's
`{w, r, rpe}`) and `RC.sumVolumeKg` (A6) rather than rolling a third walk of the log. A bodyweight-only
session correctly omits the kg line rather than printing "0 kg lifted".

⚠️ **THE START IS DERIVED FROM WHEN FINISH WAS TAPPED, MINUS THE SESSION'S OWN NAMED LENGTH — THE BEST
HONEST FIGURE AVAILABLE, BECAUSE A5 NEVER BUILT A LIVE ELAPSED CLOCK.** `row.at` is the real moment
Finish was pressed; there is no wall-clock start recorded anywhere in the player, so `startMs = row.at -
minutes * 60000` is an estimate rather than a measurement, and is treated as one. `elapsedSec` and
`startMs` both clamp `minutes` to at least 1, matching the Worker's own `elapsed_time` floor.

⚠️ **THE DEDUPE HANDLE IS THE ROW'S OWN `(d, s)` IDENTITY** — `"strength-" + row.d + "-" + row.s`,
stable across a retry, exactly the reasoning `runStravaPayload`'s `externalId` already documents.

### THE SEND PATH IS THE RUN'S OWN, TWICE

`strengthSendSession(row, onDone)` and `strengthMaybeAutoSend(row)` are the strength twins of
`stravaSendRun`/`stravaMaybeAutoSend`, deliberately reusing `stravaCfg().auto` rather than inventing a
second switch — CLAUDE.md already records that exact mistake once for Strava's own auto-send setting,
and a second store for one preference is how the two come to disagree about what the runner actually
chose. `strengthMaybeAutoSend` is called from `strFinish()`, **after** the row is marked done and
**before** the screen repaints, so "Sending to Strava…" is what the runner sees land rather than
something that changes state invisibly.

⚠️ **NEVER "PENDING".** A GPX upload is asynchronous and `stravaSendRun` polls it; a manual activity —
which a strength session always is — settles inside the one HTTP request, so `strengthSendSession` has
no pending branch at all. Adding one would be dead code implying machinery that does not exist for this
shape.

⚠️ **WHAT HAPPENED IS RECORDED ON THE ROW ITSELF (`row.strava`), AND PERSISTING IT NEEDED A NEW
HELPER.** `loadSdone()` has no in-memory cache the way `SLOG` does — every call is a fresh
`JSON.parse` — so a row held onto after `sdoneMark` returns is not automatically "live". `sdoneSave(row)`
re-reads the store, finds the same row by its `(d, s)` identity, and writes the mutated object back over
it. `sdoneMark` also now stamps `t` (the session's title, from `S.sess.title`) once and keeps it across
a re-finish that names none, because that is what `strengthStravaPayload` reads for the activity's name.

### THE "SESSION DONE" SCREEN, NOT A HISTORY ROW

`strengthStravaControlHtml(row)` is `stravaRunButtonHtml`'s strength twin, rendered on
`strPlayerDoneHtml()` — the moment a runner is actually looking, right after Finish — because strength
has no run-detail screen to reopen a past session on and carry a button there. **Absent, not disabled**,
when the handshake has not confirmed Weight Training, matching the rule `stravaRunButtonHtml` already
states for the reason it states it: a greyed-out button on the one screen a runner just finished
something on advertises a feature that is not there. `#strStvSend` is wired with the identical
`if (stvSend && !stvSend.disabled)` pattern the run's own `#stvSend` uses.

### ⚠️⚠️ A FIXTURE THAT PASSED BY LUCK OF ARRAY POSITION, NOT BY TESTING THE THING IT CLAIMED TO

Re-breaking `sdoneSave` to match on date alone (dropping the session-id half of the comparison) did not
fail the first version of its guard. The fixture used two rows on **different dates**, so a date-only
match still found the right row by accident — the bug only bites when two sessions share a date, which
is realistic (a programme session alongside the plan's own, or a run-walk day carrying an ad-hoc extra)
and the fixture never constructed it. Rewritten with both rows on the **same** date, marked in the order
that puts the wrong one first in the array (`sdoneMark` unshifts), the re-break then failed exactly as
it should. Filed here because it is this project's own repeated lesson in a new place: a fixture that
cannot discriminate the failure mode proves nothing about it, whatever the assertion says.

⚠️ **A SECOND INSTANCE OF THIS PROJECT'S OWN TIMEZONE LESSON, CAUGHT BY `npm run verify` ITSELF.** A
first version of the "start is derived from Finish minus the named length" test asserted `startLocal`
against a hardcoded `"2026-09-08T…"` — which is wrong under `TZ=Pacific/Kiritimati` (UTC+14), where an
18:30 UTC moment is already the next **local** day. `verify`'s three-timezone sweep caught it before
anything was committed. Fixed by computing the expected string from local getters on the same `startMs`
the code itself uses, so the claim holds under whichever timezone the suite happens to run in.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks,
`npx tsc --noEmit` clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload
(and `alfie-proxy/src/strava.ts` clean under its own by-hand command, per its README), **1700 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, both engine audits unchanged (A8
touches no plan generation — only the strength-completion and Strava layers). **8 deliberate re-breaks,
all 8 caught** — the worker's sport-type refusal, the `/strava/status` handshake, the client-side gate
inside `strengthMaybeAutoSend`, the payload's own `sportType`, the ordering of `strFinish`'s auto-send
call, `sdoneMark`'s title persistence, and `sdoneSave`'s row-matching (twice, after its fixture was
strengthened). New test files: `test/strength-strava.test.ts`; `test/strength-player.test.ts` gained
two guards for the store additions.

⚠️ **DEPLOYMENT IS THE OWNER'S MANUAL STEP, AND NOTHING SENDS UNTIL IT HAPPENS.** The client change
reaches his phone over the air on the next launch; the Worker change needs `wrangler deploy` from
`alfie-proxy/`. Until then `stravaCanWeightTraining()` correctly answers false for everyone, because the
currently-deployed Worker's `/strava/status` carries no `sportTypes` field at all — the handshake this
stage exists to build is also what makes that safe to leave sitting unsent.
✅ **DEPLOYED 2026-09-23 — version `3dde9be4`; the previous deploy was 2026-08-10.** Verified live:
`/strava/status` answers `sportTypes: ["Run","WeightTraining"]`, the health report and CORS are
unchanged, and a bare `/strava/start` still reaches its device-key refusal, so the secrets are intact —
`wrangler deploy` does not touch them.
⚠️ **"NO FURTHER CHANGE" AFTER THE DEPLOY WAS NOT QUITE TRUE.** The phone caches `sportTypes` and
refreshes it in exactly three places — `wireConnectView` (Profile › Apps & devices), that screen's Check
link, and `stravaResume` after a consent — and **nowhere at launch**. So an already-connected runner does
not learn the server changed until they open that screen once. Not fixed: a refresh on launch would close
it, and it wants its own guard. The same will apply to any future server capability.
⚠️ **HOW TO DEPLOY FROM THIS MAC.** The wrangler OAuth login expires (the 2026-08-10 one had lapsed by
2026-09-22). Run `npx wrangler login` in the owner's Terminal panel (`run_in_terminal`, cwd
`alfie-proxy/`); **he must click Allow within about two minutes** or it fails with *"Timed out waiting
for authorization code"*. Then from the sandbox: the README's by-hand `tsc` for `strava.ts`,
`CI=1 WRANGLER_SEND_METRICS=false npx --no-install wrangler deploy --dry-run --outdir <scratch>`, the
same without `--dry-run`, then re-check `/strava/status`. `wrangler deployments list` shows the history.

**Still to come in this track:** A9 the watch (native, Xcode-beta).
