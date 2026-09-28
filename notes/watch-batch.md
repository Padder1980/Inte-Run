# The watch batch of 2026-08-21

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE WATCH BATCH (owner's six findings, 2026-08-21) — NATIVE, SO IT NEEDS AN XCODE BUILD

Six findings from the same Rhodes field test. **The architecture reversal and the three invented
identifiers are in the Apple Watch chapter above** — read that first; this is what went with them.
Suite 1027 → **1060** (`test/watch-session-end.test.ts` 16 from the wrist half,
`test/watch-recommended.test.ts` 17 from the phone half). **30 deliberate re-breaks, all 30 caught.**

⚠️⚠️ **WHAT REACHES HIM OVER THE AIR AND WHAT DOES NOT, because the two halves are asymmetric and it
would be dishonest to report the wrist work as shipped.** Web-only, so it lands on the next launch: the
badge and the copy, the Source row, `run.indoor`, `livePausedNow` (so the lock-screen card finally says
Paused), and `coachPrimeWatchCueMap`. **Everything else is inert until somebody rebuilds in Xcode** — the
companion's extra keys need `WatchBridge`'s forward list, the wrist controls need `CompanionView`'s
buttons, cadence needs the wrist to send one, and the count beats need the wrist to send four messages.
Shipping the page half alone changes nothing visible and **must not be reported as a fix**.

### THE FIVE WRIST MECHANISMS A COLD SESSION MUST NOT DELETE (Swift, `ios/InteRunWatch/`)

Recorded here because they look redundant on sight and two of them would be deleted by anybody tidying.
Each carries the reason it could not be seen from a screenshot.

1. ⚠️ **`finishPrescribedSession` / `autoCompleted` — THE WATCH COULD NOT END A SESSION AT ALL.**
   `advanceStepIfDue` ended in `guard stepIndex + 1 < steps.count else { return }`, so on the LAST step
   the whole function returned and nothing else in the watch target ever called `end()` — only the phone's
   relayed stop and the runner's own Finish button. **It was never distance-specific:** a single TIMED step
   hung identically (simulated, a 32′ moderate ran to 3600 s / 9.4 km). It goes through `end()` rather than
   setting `phase` — `end()` does the completion cue, the final "ended" tick and `sendHome()` **before** the
   HealthKit teardown that owns the transition to `.ended`, so an auto-complete that assigned `phase`
   directly would skip `sendHome()` and lose the run. ⚠️ **A FREE RUN MUST NOT GAIN AN END**, and the guard
   for it is the existing `currentStep` bail: `plan` nil → `steps` is `[]` → nil → return before anything
   fires. ⚠️ `autoCompleted` is cleared in `reset()` with every other per-run flag, or run two of an app
   session starts already finished — the documented trap that once had run two silently dropped.
2. ⚠️ **`derivePaceIfStale` / `paceRef` — THIS IS WHY "CURRENT" READ "—" FOR A WHOLE RUN.**
   `paceSecPerKm` had exactly one writer, `CLLocation.speed`, which is **−1 when the receiver will not
   commit** — and the delegate's branches were `if sp > 0.5 {…} else if sp >= 0 {…} else if !movedThisBatch
   {…}`, so "no speed reported AND moving" assigned **nothing at all**: the published pace stayed nil from
   `reset()` for the whole run. No current pace on the wrist, none in the tick, "FINDING GPS" throughout, no
   pace cues, and auto-pause blind — while HealthKit's fused distance advanced perfectly two lines away.
   The derivation runs only when the device's own figure has gone stale (Doppler keeps priority), is measured
   in `elapsed` so a pause contributes no seconds, and **clears the pace when its window expires empty**,
   which is the only thing keeping auto-pause honest. ⚠️ **TWO time bounds, not one:** ten metres is ~6 s at
   running pace and ~15 s for a 25:00/km shuffle, so the window EXTENDS to `paceDeriveMaxSec` before
   concluding the runner stopped. One bound clears the pace of every slow runner on every window.
3. ⚠️ **`tookSteps` / `cadSteps` / `cadSeconds` / `lastStepTotal` / `lastStepElapsed` — ALL FOUR RESET
   FIELDS ARE LOAD-BEARING.** Two totals and two baselines: leaving the baselines charges run two's first
   interval against run one's last step count; leaving the totals reports run one's cadence on run two.
   The `defer` advances the baselines **even when the sample is refused**, which is what makes a pause free
   — steps shuffled at a crossing are absorbed into the baseline. Time-weighted, because HealthKit delivers
   `stepCount` in irregular batches and an unweighted mean is dominated by the shortest windows.
   ⚠️ **`.stepCount` HAD TO BE ADDED TO BOTH THE READ SET AND `enableCollection`** — the default type set for
   a running configuration does not carry it, so a cadence branch reading a type nobody collects is the
   computed-and-discarded trap in a new place. The runner sees one extra line in the Health prompt once.
4. ⚠️ **ONE MESSAGE PER COUNT BEAT (`countdownTriggers`)** — see the count-in section below for why four
   triggers rather than one, which is the half that would look like a fix and be worse than the bug.
5. ⚠️ **A STATUS SHORTCUT PAST `requestAuthorization` WAS CONSIDERED AND REJECTED, and the reasoning must
   not be re-derived wrongly.** `HKHealthStore.authorizationStatus(for:)` answers only for types the app
   WRITES, because read permission is deliberately undisclosed — so a `.sharingAuthorized` shortcut would
   silently never ask for a newly added READ type, and `.stepCount` is exactly such a type. The cost would
   be a permanently blank cadence tile with nothing to see. The round trip is milliseconds when granted.

⚠️ **THE POINT/PIXEL INSTRUMENT ERROR, worth knowing before measuring any watch screen.** An Apple Watch's
usable height is roughly **215 / 242 / 251 POINTS** at 41 / 45 / 49 mm. The read-only investigation compared
those against **pixels** and concluded the companion screen fitted on every size — refuting a real overflow
the owner had photographed. `.system(size:)` is fixed and does not scale with the watch's text-size setting,
so the arithmetic is sound; the units were not.

⚠️ **`WatchPreview.swift` HAD 25 SCENES AND NONE FOR `CompanionView`** — the one live screen the harness had
never been pointed at was the one that shipped clipped. Six were added. ⚠️ **The harness must never write
`WatchSettings.shared.metrics`**: it persists on `didSet`, so a preview scene assigning a persisted
singleton leaks into every later scene and into the real app.

⚠️ **TWO HARDWARE READINGS THAT NOTHING HERE CAN SETTLE.** (a) After one wrist run of 25+ minutes,
`state.logged[0].route.length` — **exactly 600 confirms the truncation** at `WorkoutManager`'s
`routePoints.count < 600` (no thinning at send or at ingest, where the phone downsamples to 150); anything
under 600 on a long run means the ~1-append-per-second inference is wrong. Road Map step `pc-watchroute` is
deliberately UNTICKED as a finding rather than a fix. (b) After a locked-pocket free run, the `coach:` line
in Support › Your data — `missing`/`failed` climbing confirms the cue map never landed; a clean line with
the audio still late is new information.

### The companion tick: three numbers became eleven, plus a capability flag

`pushToCompanion` posted `sec`, `distKm`, `paceSec` and a title — while `pushLiveActivity` ten lines above
already computed the heart rate, the step and the paused flag for the lock screen. It now sends
`avgPaceSec`, `lapPaceSec`, `lapNumber`, `hr`, `stepProgress`, `paused` and `control` as well.
- ⚠️ **NO `kcal`, DELIBERATELY.** The phone measures no calories of its own — `run.kcal` has exactly one
  writer and it is the wrist's ingest — and the wrist renders "--" for an absent key. Sending 0 would put
  "0 CAL" on the wrist, which is the null-never-zero rule in a new place.
- ⚠️ **NO `type` EITHER, THOUGH THE BRIDGE WOULD CARRY ONE.** Nothing on the wrist reads it:
  `SessionStore` turns `phoneLive` into `[String: Double]` and reads title/step/paused/control as named
  exceptions; `CompanionView` reads only numbers. So a session type would cross two process boundaries to
  be discarded, and an unread value is what the next reader copies. The session's effort COLOUR (ruling 7)
  is the obvious future reader and it is one line when it exists. **The bridge's own `type` line is
  therefore currently dead** — harmless, and recorded here rather than edited, because `ios/**` belonged
  to the wrist phase.
- ⚠️ **`control: true` IS A CAPABILITY THE PAGE DECLARES ABOUT ITSELF**, and it is the only thing that
  puts pause/resume/finish on the wrist. An older page sends no flag and the wrist offers no buttons —
  rather than buttons that look live and do nothing, which is the class this project has shipped twice
  (`rdMore`, and the profile confirm clicking a `#saveSetup` that was nowhere in the app). Same answer the
  coach bridge already uses: a flag the SENDER sets, never a message name the receiver might not know.
- ⚠️ **`window.__interunWatchControl` GOES THROUGH `livePauseSet`, WHICH WAS EXTRACTED FROM THE BUTTON'S
  OWN CLICK HANDLER.** The resume branch alone clears six fields in a specific order; a hand copy for the
  wrist is the fix-one-builder-not-the-other trap this project has paid for four times. The button now
  only re-labels itself, and a guard asserts its handler contains no `rt.pause(`/`rt.resume(` at all.
- ⚠️ **FINISH DOES NOT CONFIRM ON THE PHONE.** The wrist raises its own `confirmationDialog` before
  sending `"stop"`, so a second sheet would be a dialog nobody can answer on a phone in a pocket.
- ⚠️ **THE NEW STATE IS PUSHED BACK FORCED, past the two-second throttle**, or the wrist's own label keeps
  saying Pause for up to two seconds after the runner pressed it, which reads as the button having missed.

### The count-in: four beats, four triggers, four fixed clips

`WATCH_COUNT_CLIPS` maps `count-3`/`count-2`/`count-1`/`count-go` → `count_3`/`count_2`/`count_1`/`count_go`,
and **`WATCH_CUE_TRIGGERS` is built from `Object.keys` of it** so a trigger cannot exist without a clip
mapping. `coachScheduledPrompt` resolves those four **by clip id, never through the catalogue**, and
`__interunWatchCue` gained a by-id path that speaks one beat immediately.
- ⚠️ **FOUR TRIGGERS, NOT ONE REUSED FOUR TIMES, and this is the half that looks like a fix and is worse
  than the bug.** `CoachAudioService.playWatchCue` plays exactly ONE file per call and holds a 20 s
  per-trigger dedupe, so one shared `"countdown"` sent four times speaks one number, suppresses the other
  three, and rotates WHICH number across runs. Resolving through `promptsFor` does the same damage a
  different way: four prompts share the trigger `"countdown"`.
- ⚠️ **THE OLD `"countdown"` BRANCH IS KEPT AND IS NOT DEAD CODE.** A watch on the previous build sends
  one `"countdown"`, and an over-the-air page update reaches phones whose watch has not been rebuilt.
  Late is what it has always been; silence would be a regression for anyone who has not rebuilt.
- ⚠️ **MEASURED FROM THE SHIPPED MANIFEST: 36 count clips (9 coaches × 4), longest 0.77 s.** The beats are
  one second apart and the native player refuses a cue while a clip is playing, so a clip re-recorded
  longer than a beat would swallow the next number silently. Guarded.
- ⚠️ **`coachPrimeWatchCueMap` EXISTS BECAUSE A WRIST-INITIATED RUN INTO A POCKET HAD NO CUE MAP AT ALL.**
  The map was pushed from `startOnWatch` (a foreground tap on the phone) and from `__interunWatchLive` on a
  new run id — and that second one arrives by `evaluateJavaScript`, which does nothing against a suspended
  page. So the one path that most needs the native player was the one path that could never install its
  own map. It is now primed on `visibilitychange`, a foreground moment by definition.
  ⚠️ **NEVER WHILE A RUN IS LIVE ON EITHER DEVICE** — a `cuemap` post REPLACES the whole map in Swift, so
  priming today's-plan lines over a running session would swap the coach's wordings mid-run. The type is
  today's plan, which is a guess and is stated as one; the four beats are unaffected because they resolve
  by clip id, so the cue this exists for is the one it cannot get wrong.
- ⚠️ **THE SWEEP THAT WOULD HAVE CAUGHT THE WHOLE FINDING** is `every trigger the wrist can send is a
  trigger the page can play`, derived from the Swift: every literal passed to `speakOnPhone(` **plus every
  literal assigned to the `trigger` variable** must be in `WATCH_CUE_TRIGGERS`. The second half matters —
  `announceStep` maps the step's KIND to a trigger in a switch and passes the variable, so a call-site-only
  sweep sees five triggers and misses the five that fire most often. The old comment claimed the list was
  taken from the call sites and nothing checked it.

### Refuted, with the measurement

⚠️ **"CURRENT AND LAP READ '—' FOR THE WHOLE RUN" IS HALF WRONG, AND THE LAP HALF IS CORRECT BEHAVIOUR.**
CURRENT was real and is the wrist's own fix (`CLLocation.speed` is −1 when unknown, and the delegate's
third branch assigned nothing at all in the "no speed AND moving" case). **LAP was not a defect in that
screenshot.** `lapPaceSecPerKm` requires `distanceMetres - lastSplitMetre > 60`; at 2.05 km with the last
split banked at 2000 m the lap is **50 m**, under the wrist's own floor, so "—" is the honest answer at
exactly that instant. One screenshot cannot show it was "—" for the whole run, and the arithmetic says it
would not have been. The phone's mirror renders `L.paceSec`/`L.lapPaceSec` verbatim, so nothing on the page
side was ever wrong here.

### ⚠️ TWO PRE-EXISTING TEST FAILURES THAT WERE NOT MINE, AND BOTH WERE THE CALENDAR

`node --test` was **1041 pass / 2 fail** on 2026-08-21 before a line of this phase's code was written.
Proven pre-existing by building HEAD's `web/app.ts` and re-running: **identical 2 failures.** Both were in
`test/heat-custom.test.ts`, both written the day before, and both had ONE cause.
- The fixture's plan starts **today**, so today's slot is whatever the generator puts on today's weekday.
  On 2026-08-20 that was a **mobility** session and the two guards reached their case; on 2026-08-21 it is
  a **strides run**, so the plan's own run became the head candidate and "declining the custom run
  silences the card" stopped being true. `ensureNoPlannedToday` now moves today's runnable sessions off
  today through `state.dayOverride` — the app's own reschedule mechanism, and the mirror of the
  `ensurePlannedToday` that file already carried. **The weekday fragility was recognised in one direction
  and missed in the other**, which is the tell.
  ⚠️ It does NOT also move a non-run ON. That was tried: `applyPartialFirstWeek` trims week one to today
  onward, and on 2026-08-21 week one is exactly strides / easy / long — there is no non-run left to move.
  The helper promises only what it can keep on every weekday.
- The same test's day sweep read `selWeek = 0`, the **partial** first week: full on a Monday, three
  sessions on a Friday, so its own `checked >= 4` floor failed for a reason unrelated to what it tests.
  Week **one** is always whole.

⚠️⚠️ **AND A THIRD, WHICH CLAUDE.md CLAIMED WAS ALREADY PROVEN: 6 of 20 FAILED UNDER
`TZ=Pacific/Pago_Pago`, AT HEAD.** The previous phase recorded proving that file across six timezones
"including both sides of the date line (… Pago Pago UTC-11 …)". It does not hold. The cause is that
`hoursFor(null)` builds its day from **LOCAL** getters — deliberately, and one of this repo's legitimate
exceptions to the UTC rule, because "the remaining hours of today" is a wall-clock question and Open-Meteo
is fetched in the device's own timezone — while the DECISION stores are UTC (`todayIso()`). At UTC-11 the
local day is 2026-08-20 and the fixture seeded 08-21/08-22, so `hoursFor` matched nothing and every heat
surface went silent, reading exactly like the defect that file exists to guard. The fixture now seeds the
**union** of the UTC and local days, and the diagnostic's hour count is **derived from what was seeded**
rather than the typed `48` — a typed constant there would have turned a timezone fix into a second
timezone failure. **All 20 now pass under UTC, Athens, Los Angeles, Kolkata, Kiritimati (UTC+14) and Pago
Pago (UTC-11).**

⚠️ **THE BACKTICK RULE FIRED THREE TIMES, ALL IN MY OWN COMMENTS**, and on the third the build failed
while the `node --check` step that followed reported OK **on the previous build** — exactly as this file
warns. Read the build's exit code before trusting anything after it. Running total for the two 2026-08-21
phases: 5.

⚠️ **A `git checkout` WAS NOT USED TO UNDO ANY RE-BREAK.** Each break copied the file to a keep directory
first and copied it back, per the rule this file records paying for. The harness also parses `ℹ fail N`
(not `# fail N`) and **rebuilds `web/app.html` after a break to `web/app.ts`** — these tests read the
BUILT page, so an unbuilt break is a break the suite never sees and reads as an escape.

### THE VERIFIER'S EIGHT RESIDUALS, CLOSED (2026-08-21, same day, second pass)

An adversarial verifier returned SHIPPABLE with two majors and six smaller items. All eight are closed.
Suite 1060 → **1066**; 17 deliberate re-breaks, all 17 caught. Nothing in `web/app.ts` changed, so the
over-the-air payload is byte-identical to what the batch above pushed apart from the build stamp.

#### ⚠️⚠️ MAJOR 1 — THE REBUILT COMPANION'S TOP STRIP RAN UNDER THE watchOS SYSTEM CLOCK

The strip filled the whole display width and ended in a `Spacer`, so on the small watches the app's own
content was drawn straight into the columns the system draws its clock into. Measured by colour
separation on five real simulators — the app never uses pure white, the system clock is exactly
255,255,255, so the two can be told apart pixel by pixel with no fixture recolouring — with the clock's
leading edge normalised to the worst position its digits produce:

| size | running, before → after | paused ("PAUSED · IPHONE"), before → after |
|---|---|---|
| 40mm (162pt) | **−1px** → **+29px** | **−52px** → **+30px** |
| 41mm (176pt) | +23px → +36px | **−28px** → **+37px** |
| 42mm (187pt) | +42px → +48px | **−9px** → **+40px** |
| 45mm (198pt) | own line (+16px below) | own line (+19 → +20px below) |
| 49mm (205pt) | own line (+9px below) | own line (+12 → +13px below) |

So the word naming the device was destroyed on three of the five sizes, and the +23px case is not the
whole story either: at 40mm the running strip's gap was **1.5pt**, where the spacing WITHIN a number is
2–2.5pt, so "23:10" and "06:19" rendered as one number, "23:1006:19".

⚠️ **THE OWNER OWNS THE ONE SIZE WHERE IT WAS CLEAN.** From 45mm up, watchOS gives its clock a line of
its own and the app's content starts below it; at 42mm and under they share a row. That boundary is an OS
behaviour observed at five points with nothing between 187pt and 198pt, so **the reserve is
unconditional** rather than keyed on the cliff — a rule that depends on where that cliff is would fail
silently, by overprinting, the first time watchOS moved it.

⚠️ **IT CANNOT BE FIXED BY MOVING DOWN, AND THAT IS WHY IT IS A WIDTH.** `MetricsPage`'s block is
vertically CENTRED, so where the strip lands depends on how tall the content is — the same view puts the
strip on the clock's row with three metrics and below it before the phone has ticked. Top-anchoring
instead would raise the FIRST METRIC ROW into the clock's row on the big watches, where its label already
reaches x=340 of 396. A reserved width is true wherever the block happens to sit.

⚠️ **`MetricsPage.clockReserveFraction` IS 0.34, MEASURED AND PROPORTIONAL.** The clock's leading edge
sits at 0.679 / 0.693 / 0.700 / 0.710 / 0.705 of the display width across those five sizes — near enough
constant, so a fraction tracks it where a constant would be right for one watch and wrong for six. With
the page's own 8pt `edge` that puts the strip's content right edge at 0.66 of the width, leaving 11–18pt
of daylight everywhere. `MetricsPage.edge` is now the single owner of that inset, because the reserve is
expressed against it.

⚠️ **The reserve reads `WKInterfaceDevice.current().screenBounds.width`,** which makes this otherwise
pure view read one device constant. Passing it in was rejected: a convention every caller must honour is
a convention somebody breaks, and this project has shipped that twice.

#### ⚠️⚠️ AND THE FIX EXPOSED THE REAL MECHANISM: `.kerning` MAKES `.minimumScaleFactor` INERT

Reserving the columns made the strip truncate — "PAUSED · IPHO…" and "IPH…" — rather than shrink. **A
`Text` carrying custom letter spacing does not honour `minimumScaleFactor`; it truncates.** Both strip
strings already carried a scale factor AND a kerning, so the give they were written for **had never once
worked**, and that is also why the collision presented as an OVERPRINT rather than as small text: given
too little room the strip did not shrink, it ran on. Proved by deleting the kerning and re-shooting the
same scene — both strings then fitted whole.

⚠️ **IT WAS COSTING A WORD IN THE METRIC ROWS TOO.** The caption carried 0.2pt of tracking beside a
`minimumScaleFactor(0.7)` whose comment records being tuned twice; measured at 40mm, "DISTANCE" rendered
**"DISTAN…"** with room to spare beneath it. Both are gone, and `test/watch-session-end.test.ts` fails on
either returning.

⚠️ **FOUR MORE PAIRINGS EXIST AND ARE DELIBERATELY UNFIXED — `PacePage` ×3, `StepsPage` ×1.** Shot at
40mm, none of them is truncating today, so they are latent rather than broken, and rewriting screens with
no measured defect is not a trade worth making in a phase certifying this one. Guarded as a **ratchet at
4**, plus zero in the two repaired files, so the count cannot grow.

⚠️ **AND A SPACER IN THAT STRIP COSTS THE WORD BY ITSELF.** An HStack shares its width among the children
that can flex and a `Spacer` flexes without limit, so its share plus the spacing it brings left
"IPHONE 23:10" truncating to "IPH… 23:10" at 40mm **with room going spare** — measured, 33..173px of ink
in a 198px box. `.frame(alignment: .leading)` was already doing the aligning, so the Spacer was never
earning its place. Gone. A negative `layoutPriority` on it was tried first and did NOT fix it.

⚠️ **The elapsed clock gained a `minimumScaleFactor` and the layout priority.** Past an hour the
companion renders h:mm:ss — 62pt of monospaced digits against the 85pt the strip gets at 40mm — so the
one thing with no give was the number. It takes the priority so the WORD gives way first.

#### ⚠️⚠️ MAJOR 2 — THE INSTRUMENT THAT CERTIFIED IT CLEAN COULD NOT SEE IT, AND THAT IS THE BIGGER HALF

The previous phase's probe counted **edge ink**: pixels in the outer six rows and columns. A collision in
the MIDDLE of the top strip puts no ink on any edge, so it returned 0 for a 52px overprint and read as a
pass. And the sweep started at 41mm while `WATCHOS_DEPLOYMENT_TARGET = 10.0` admits **40mm** (162pt), which
is both the smallest supported size and where the running state was also broken.

`scratchpad/field/wclose/probe/stripprobe.py` is the replacement, and the rules it encodes are the
transferable part:
- ⚠️ **A COLLISION IS A SPATIAL FACT BETWEEN TWO DRAWN THINGS, so measure both.** It reports the system
  clock's ink box, the app's ink box inside the clock's own rows, the vertical gap and the horizontal gap,
  and calls it clear only when one axis genuinely separates them.
- ⚠️ **NOT-OVERLAPPING IS NOT THE BAR.** A same-row gap under 16px (8pt) is reported TIGHT and counted as
  a failure, because 3px is not a gap — it is one number.
- ⚠️ **AND A BOX CANNOT SEE CLIPPING**, which is this file's own rule. Because the page is vertically
  centred, content too tall is cut at BOTH display edges, so ink in the outermost rows is reported
  separately as CLIPPED — which is the only way the four-row overflow below is visible at all.
- ⚠️ **THE CLOCK'S LEADING EDGE MOVES ±8px WITH THE DIGITS IT HAPPENS TO BE SHOWING**, so a before/after
  taken minutes apart is confounded by the time of day. `probe/compare.txt` normalises both batches to the
  leftmost edge seen in either.

The arithmetic half is a test rather than a script: `WATCH_WIDTHS` in `test/watch-session-end.test.ts`
carries every display width watchOS 10 admits with the measured clock-edge fraction for each, and requires
8pt of clearance at all of them. Cutting the fraction, cutting `edge`, un-applying the padding or making
the reserve stop tracking the display all fail it.

#### The six smaller items

⚠️ **AN UNREAD KEY ADDED TO THE COMPANION TICK BY A STATEMENT OF ITS OWN ESCAPED EVERY GUARD — and the
shipped code already contained one.** Both guards sliced the `for k in [...]` literal, so
`live["type"] = type` sat three lines under a comment reading "EVERY KEY HERE IS READ BY THE WRIST": the
page deliberately sends no `type`, and `SessionStore` reduces `phoneLive` with
`compactMapValues { $0 as? Double }`, so a String is dropped on arrival. Deleted, and both guards now
**derive the sent set from every write into `live`** and require each key to be reached by a NAMED reader —
a subscript into that dictionary or the `flag(…)` helper. ⚠️ The old reader check was `"key"` appearing
anywhere in four files, which `type` satisfies several times over (`PlannedSession.type`). **A guard over a
collection is only as good as the collection, and "the word appears" is not "something reads it".**

⚠️ **`defaultMetrics` HAD FIVE ENTRIES AGAINST `maxMetrics = 4`**, so `init`'s clamp fired on a FRESH
install and silently dropped `.avgPace` — the declared default and the delivered default were different
lists. Worse, `reset()` assigns the declared one with **no clamp**, so the one control whose job is to
restore the default was the only way to exceed a cap the editor enforces. Now four entries, and it is
`.avgPace` that goes because `prefix(4)` was already dropping exactly that — **no runner's screen changes.**

⚠️ **`derivePaceIfStale`'s GIVE-UP WINDOW WAS A THIRD NUMBER THAT CONTRADICTED THE OTHER TWO.** At a flat
15s it named a 25:00/km shuffle as the case it existed for and then refused it: ten metres at 1500 s/km
takes exactly 15.0s, so the two branches tie and float noise decides. Driven, it returned 1499 for 1499
and **nil for 1500**. And 1800 needs 18s, so the top 300 s/km of the declared plausible band was
unreachable by its only writer. **It is the CLAMP that was wrong, not the comment**: the window is now
derived from `paceDeriveMetres` and `paceMaxPlausible`, so the three can no longer disagree. Nothing acts
on the difference except the display — `autoPauseTick` treats anything slower than 900 s/km as not moving.

⚠️ **THE TICK THAT ENDS A PRESCRIBED RUN NOW STOPS THERE.** `advanceStepIfDue` → `finishPrescribedSession`
→ `end()` invalidates the ticker, and the tick already executing carried on to `sendLiveTick()` and
`autoPauseTick()`. Two things followed the forced "ended" tick by accident rather than by design: a
non-forced "running" tick, suppressed only by the 2s send throttle; and a `pause()` on a session that had
just ended, because `phase` stays `.running` until HealthKit's teardown lands — reachable on a TIMED final
step that expires while the runner is already standing still. `if self.autoCompleted { return }` sits
between them, and the guard is an ORDERING one.

⚠️ **TWO GUARDS FAILED UNDER `TZ=Pacific/Kiritimati` AND CHOOSING A DIFFERENT INSTANT CANNOT FIX THAT
CLASS.** `test/share-model.test.ts` hard-coded "18 Aug 2026" while `rdDateText` reads the start time out of
the run id and formats it with LOCAL getters — so at UTC+14 the reference run's 11:29 UTC start is 01:29
the next morning and the card correctly says 19 Aug. The fixture's own note claimed noon UTC protected it;
noon UTC protects the UTC date, which the card does not use. **UTC−11 to UTC+14 is a 25-hour spread, so no
single instant falls on one local date everywhere** — the expected string is now derived the way the code
derives it. Full suite: **1066 / 0 under UTC, Kiritimati and Pago Pago.**

⚠️ **TWELVE STALE `http.server` PROCESSES WERE STILL LISTENING**, from 7–20 August, on ports 8089 8091
8092 8101 8137 8731 8761 8765 8771 8801 8899 8911 — the documented port-squatter hazard left armed, and
the previous report's claim that they were cleared was false. All killed; `lsof -nP -iTCP -sTCP:LISTEN`
now lists no python listener at all.

#### Found, measured, NOT fixed — and why

⚠️ **FOUR METRIC ROWS OVERFLOW THE THREE SMALLEST WATCHES, AND IT IS REACHABLE.** With `.elapsed`
filtered out of the rows, the default renders three rows on both screens — but a runner who picks four
non-clock metrics gets four 42pt rows, and the page is then taller than the glass. Measured, the block is
clipped at BOTH edges (it is centred): the whole top strip is sliced in half at 41mm (`companion-four`),
and the run screen's own clock is cut at 40mm (`mid-run`, `paused`). **Identical before and after this
phase** — every number in the probe's CLIPPED rows is unchanged, so nothing here regressed it. Not fixed
because the honest fix is to shrink the rows when there are four, which is a legibility decision the owner
has already been consulted on twice ("make them bigger") and is not one of the eight.

⚠️ **AND `five-metrics` IS A FIXTURE FOR A STATE NO RUNNER CAN REACH.** Its comment claimed "the maximum
Settings allows"; the maximum has been four since the rebuild. Kept as the overflow case, comment
corrected — a fixture that certifies an impossible state while the reachable tightest one overflows is the
fixture-too-kind trap in its other direction.

⚠️ **I NEARLY REPORTED A FIXED DEFECT THAT WAS NOT ONE.** `CompanionControls`' "RECORDING ON YOUR IPHONE"
also paired `.kerning` with a `minimumScaleFactor`, and arithmetic said it must be truncating at 40mm. Shot
with the kerning in place: it fits (x 20..299 of 324). The kerning is still removed — it is the screen
under repair and the change is measured to be visually identical — but as a **latent hazard, not a fixed
defect.** This file already records reporting a grey box as a plate when it was legs showing through a
scrim; check the render before believing a visual diagnosis.

#### Verification

Build exit 0; `git status --short docs/voices/` clean; `node --check` OK on all three emitted blocks;
`npx tsc --noEmit` clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload;
**`node --test` 1066 pass / 0 fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`**, with
`CHROME_PATH` set so the browser-backed export gates really ran. All four Xcode targets: `InteRun` Debug on
the iOS Simulator (watch app and widget both embedded), `InteRunUITests` build-for-testing, and `InteRun`
**Release** for `generic/platform=iOS` — 0 errors each, only the pre-existing `CoachAudioService`
actor-conformance warning. **0 dylibs** in the watch app in either configuration; `ENABLE_DEBUG_DYLIB = NO`
×4; `CURRENT_PROJECT_VERSION = 433` in all eight configurations.

⚠️ **17 RE-BREAKS, 17 CAUGHT**, applied one at a time with every file copied to a keep directory first and
copied back — **never `git checkout`**, per the rule this file records paying for. `probe/rebreak.py`
escapes the test-name pattern (it is a regex), refuses to believe an unparsable result, and accepts both
the `ℹ` and `#` fail lines. The two that mattered are the ones that used to escape: an unread key added to
the companion tick outside the loop's list, and the date guards under Kiritimati.
