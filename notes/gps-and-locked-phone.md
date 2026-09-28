# GPS distance and the locked phone

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## Five faults the owner found on his own phone and wrist (fixed 2026-08-04)

He ran a real session and sent five screenshots. Two were functional and both were serious.

⚠️ **GPS DISTANCE TOOK THREE GOES. READ ALL THREE BEFORE TOUCHING `onGpsPos`.** The first two were shipped
to his phone and he caught each within one run; the third fault was caught by its own test.

1. **Recorded 0.00 km for a whole run.** The gate demanded each fix jump more than half its own accuracy.
   At ±14 m that is 7 m between fixes about a second apart — 7 m/s, a **2:22/km pace**. At his actual
   1.03 m/s every fix was discarded: no distance, no route (the route push is in the same gate), nothing
   for the debrief to read. Even a good 8 m fix demanded 4 m/s, so the phone only recorded distance for a
   fast runner under a clear sky.
2. **Then it invented 0.14 km standing still.** The fix for (1) trusted `coords.speed`: if the device says
   1.03 m/s the runner is moving, so a 1 m step is real. ⚠️ **WRONG, AND THE MISTAKE IS WORTH REMEMBERING —
   A STATIONARY RECEIVER REPORTS A PHANTOM SPEED,** because speed is derived from the same noisy signal as
   position. Speed is *not* independent evidence of movement, so believing it let every jitter step count.
3. **And summing per-fix steps inflates distance anyway.** Noise adds on EVERY reading and haversine is
   always positive, so the sum runs long: measured on a 1.03 m/s fixture with only ±1 m of jitter, 124 m
   covered came out as **215 m recorded, 73% long**. `test/gps-distance.test.ts` caught this one before he
   had to.

**What it does now: an ANCHOR and a LEASH.** Hold the last point we believed; when the current fix is
further from it than the fix's own stated accuracy (min 10 m), credit that **net displacement** and move
the anchor there. Jitter is bounded by the accuracy and has no consistent bearing, so a stationary phone
never leaves the leash however much it twitches; a runner leaves it and keeps going. Immune to (3) because
the jitter is a few metres against a ten-metre leash rather than against every single second.

⚠️ **The visible cost, accepted:** distance advances in leash-sized steps (~10–14 m, so every 4–14 s
depending on pace) rather than smoothly. Pace is unaffected — it comes from the device's own speed. A
stepping distance is a far smaller sin than one that is zero, 73% long, or invented at a standstill.

⚠️ **`LIVE.gpsDiag` is surfaced in Support › Your data** (`gpsDiagLine`), and is the reason to instrument
rather than guess: *"0.00 km"* and *"0.14 km standing still"* look identical in a screenshot. `seen`,
`credited`, `still`, `badAcc`, `spike`, `maxAcc` — and a test asserts the counters account for every fix,
so a future fault cannot hide between them. Same precedent as `__kbDiag` for the keyboard.

⚠️ **A BROWSER HARNESS CAN FALL BACK TO THE SIMULATOR AND LOOK LIKE THE BUG.** Overriding
`watchPosition` but not `getCurrentPosition` left acquisition failing, so the run went to `startSim()` —
which fabricates distance, and produced **0.13 km**, almost exactly the phantom figure being investigated.
Check `LIVE.mode === "gps"` before believing anything a harness tells you about GPS.

⚠️ **THE PHONE RECORDED 0.00 km FOR A WHOLE RUN, AND THE CAUSE WAS A NOISE FLOOR APPLIED TOO WIDELY.**
`onGpsPos` gates distance behind half the fix's own accuracy, to stop GPS jitter piling up at a
standstill. That floor was applied to **every** fix, including the ones where the device reports its
speed — so at the **±14 m** his phone showed, a fix had to move more than **7 metres** to count. Fixes
arrive about a second apart, so that is 7 m/s, a **2:22/km** pace. At his actual **1.03 m/s** every single
fix was discarded: no distance, no route (the route push sits inside the same gate), and a debrief with
nothing to read. Even a good 8 m fix demanded 4 m/s, so **the phone only ever accumulated distance for a
fast runner under a clear sky.** The floor is a PROXY for "is this real movement?" and it is needed only
when `speed` is absent — the watch has always worked this way, and the reasoning was already written down
here against `CLLocation.speed` being −1 when unknown. Now `LIVE.devSpeed != null ? 0.3 : accuracy-scaled`.
⚠️ **That paragraph describes the FIRST fix, which was itself wrong — see the three-goes note above for
what the code does now.** Kept because the diagnosis of fault (1) is still correct and still the reason
the floor cannot be unconditional.

⚠️ **THE LIVE CLOCK READ 0:00 FOR THE WHOLE WARM-UP.** Part 3 of the named-time work subtracts the warm-up
from the displayed clock and clamped the result at zero, with a comment claiming it "counts the warm-up
down to zero" — it did not, it simply showed nothing for five minutes, so "it doesn't start the timer" and
there was no way to see how far through the warm-up you were. Now the clock shows the **warm-up's own
elapsed time under a "Warm-up" label**, then restarts from 0:00 as "Elapsed" the instant the work begins.
The named-time principle is untouched; what changed is that the warm-up is no longer invisible. ⚠️ The
label must switch with the number — a warm-up clock counting up under "Elapsed" is indistinguishable from
the work clock, which is the confusion the reset exists to avoid.

⚠️ **THE MIRRORED CLOCK TICKED IN TWOS.** `sendLiveTick` on the watch throttles to one message every two
seconds (battery, and WCSession traffic) and the phone rendered `sec` raw, so a watch run's elapsed time
advanced 2 seconds at a time on the phone — on the mirror screen *and* on the live pill. The watch stays
authoritative: `watchLiveSec()` adds the wall-clock time since the last tick landed, and every new tick
**snaps** the display back to the wrist's number. ⚠️ Never while paused, or the phone counts on alone and
disagrees with the watch it is mirroring. Verified all three ways round in the browser: drifts forward
between ticks, snaps back on arrival, frozen when paused.

Two aesthetic ones, both his call:
- The gap under **Finish run** was 4px (`.wl-controls` bottom margin) and the card below carries no top
  margin of its own, so that margin IS the gap. Now 12px.
- The Logbook run card's **left accent bar** ended dead at full opacity top and bottom. Now it fades out
  at both ends, extended slightly to keep the same weight of visible colour.

⚠️ **AND ONE ON THE WATCH THAT IS FIXED BUT UNPROVEN.** His photo shows the status word clipped, reading
"AUSED": `MetricsPage`'s stack started at the very top of the page, where the rounded corner eats the
first line's leading characters and the system clock occupies the same strip. It now carries
`.padding(.top, 6)` and the `.padding(.horizontal, 2)` `PacePage` already used, applied to the whole stack
so the hero number does not shift when a run pauses. **Not verified on hardware** — it needs his eyes or a
watch-simulator run, and a green build proves nothing about a rounded bezel.

⚠️ **THE BACKTICK RULE FIRED AGAIN, TWICE, IN THIS ROUND TOO.** Both in comments inside the runtime JS.
Total for the day: four. The build's exit code is the only reliable signal — `node --check` will happily
pass on a stale `web/app.html` while the browser serves the previous build.

## THE WALK THAT CONVICTED THE GPS START (owner's report, 2026-08-17 — four findings, two causes)

He walked a 1 km custom session, phone in hand, badge reading ±2 m: credited **0.28 km for ~0.19 km
walked (+46%)**, CURRENT pace right (11:37, from Doppler speed) while AVERAGE read 8:03 (credited
distance ÷ time), and the cue log said **"Ease back — you're ahead of easy pace" at 0:00** to a runner
SLOWER than the band. Root-caused by a measured workflow (synthetic traces through the REAL lifted
onGpsPos, 300 seeds/row) then adversarially cross-checked; suite 755 → **769**, eleven deliberate
re-breaks all caught.

⚠️ **THE START SETTLE WAS ~ALL OF IT.** The anchor seeds from the FIRST good fix; when the receiver
converges the whole correction (anything ≤ the 200 m spike gate) was credited as ground. Modelled: a
90 m jump-settle reproduces his outing at +42.4% vs the observed +46.1%. First-passage bias at the
leash largely TELESCOPES away (≲3%); wander 0–7%; curve chords −1 to −3%. And that same lump divided
by one 250 ms tick is a "2.8 s/km pace" — the wrong-direction cue at 0:00 and the fabricated numbers
are the SAME defect as the distance.

**The shipped combo, each part justified by a row only it fixes** (owner scenario +42.4% → −4.6%; all
honest-runner rows within −0.5…+2.8%):
- **A2 re-seed:** in the first 45 s (liveElapsedMs), a displacement > max(2·leash, 30 m) RE-SEEDS the
  anchor and credits nothing. ⚠️ Its justifying row is a settle with **devSpeed null** — the cap below
  is disabled there, so without A2 that walk stays +42.5%.
- **D speed cap:** credit ≤ devSpeed × dt × 1.5, dt from **fix timestamps** (LIVE.anchorTs, stamped at
  every anchor write — a pocketed backlog replays in one burst and wall time reads every interval as
  zero). devSpeed null disables the cap rather than zeroing distance.
- **P pedo tab:** pedoFillGap runs a tab (LIVE.pedoPaid) and the next GPS credit settles it —
  the recovery fix's net from the pre-gap anchor covered the SAME stretch the pedometer just paid
  (measured +17% per 120 s blackout). Every anchor re-seed CLEARS the tab.
- Diag: `reseeds` / `capped` in gpsDiagLine. Nonzero reseeds at a start is NORMAL.

⚠️ **CANDIDATE "CREDIT NET MINUS A NOISE ALLOWANCE" MUST NEVER SHIP** — measured −21.7% on a ±5 walk
and −39.6% on a ±14 run (the crossing bias telescopes on its own, so the subtraction banks as pure
under-count), and it does not even fix the settle (+33%). It is the 2026-08-04 defect, 10× the
tolerance, wearing a fix's clothes.

⚠️ **THREE OF THIS AREA'S OWN FIXTURES MOVED 20 m/s WHILE CLAIMING 2–3 m/s** — pairs no phone
produces, so they never exercised the speed↔displacement relationship and the new cap "broke" them.
Made physically consistent, intent preserved. Same fixture-too-kind trap as the debrief's target line.

**The pace verdict now has to be EARNED (engine, session-runtime.ts):**
- **PACE_PLAUSIBLE_MIN 150 s/km** — a derivation faster than any prescribed band (fastest rep bands
  ~180–205) is arithmetic on a lump, refused, previous value held. The fast-side twin of the >1200
  cull; mirrored in gpsUiTick (`cur < 150 → null`) and as a last gate in speakPaceNumbers.
- **A held pace EXPIRES after 15 s** — rollingPace's old dMeters≤0 branch held one bad reading
  forever; measured, it kept "fast" alive 25 s and spoke a fabricated "2 minutes 13" in the RECORDED
  coach voice at t=20.3 s.
- **Grace: no verdict until 30 s AND 100 m.** ⚠️ Its discriminating case is a PLAUSIBLE-looking
  device pace (a 160 s/km Doppler glitch at 0.5 s) — my grace re-break sailed past the settle-lump
  test because the plausibility floor double-covers it; the guard had to gain that fixture before the
  re-break failed. A guard whose scenario is double-covered discriminates nothing.
- ⚠️ **NO MINIMUM-WINDOW GATE, EVER**: update() resets the pace baselines every sample, so "derive
  only over ≥3 s" is unsatisfiable at any sub-3 s cadence and silently kills all pace coaching for
  SIMULATED runs (200 ms distance-only ticks) — measured, with the suite green because every pace
  test set reportPace. `a simulated run's 200 ms distance-only ticks still earn a verdict` now pins it.

⚠️ **THE VOICE LAYER IGNORED THE ENGINE'S OWN EASY-SLOW RULE FOR MONTHS AND THE RUNNER HEARD THE
DISAGREEMENT.** paceMessage has always stayed quiet about slow+non-work ("running easy slower than
the band is fine") while coachPaceTick spoke pace-behind every 100 s — his walk got corrections from
a layer whose own log stayed silent. Now suppressed BEFORE the quiet-window stamp (a suppressed nudge
must not push back a later legitimate cue); work = the engine's isWorkStep (rep, or targetRpe.min ≥ 6
— a threshold block is `steady`, so kind alone is the wrong gate).

### The watch-run "robot voice" verdict, and the wrist set (Swift — REBUILD REQUIRED, none of it OTA)

⚠️ **ON A ONE-STEP EASY WRIST RUN, EVERY MID-RUN CUE IS THE PACE CORRECTION, WHICH IS SYNTHESISED BY
THE OWNER'S OWN 2026-07-31 SPEC** (full sentence with numbers — no clip can say a digit). The cue map
measured healthy (9/13 triggers, 19 files, never cleared, pushed from both start paths). So "the
robot took over" was mostly the designed correction NAGGING A WALKER sixteen times. What ships:
- **slowIsFine** (WorkoutManager): easy/long/recovery + non-work step → tooSlow speaks nothing,
  screen says "SLOWER IS FINE". Too fast is untouched. ⚠️ The work bit rides ON THE PAYLOAD
  (`PlannedStep.work`, set by the phone from isWorkStep) so a long run's goal-pace block — kind
  `steady` — keeps its correction; gate by kind and the two halves of the product disagree again.
- **The spoken quote is a ~10 s window mean** (verdict stays instantaneous — its 6 s hold is the
  decision's smoothing). Quoting the single fix at the biased cue moment measured ~37 s/km wide.
- **paceAt freshness (8 s, deliberately under the 10 s auto-pause still-threshold; autoPauseTick
  reads the RAW field)** — the heartRateAt precedent: stale pace read as FINDING GPS + silence, never
  a 45 s-old number quoted as now.
- **spokenPace grammar mirrors the phone's paceWords** ("1 minutes 1" was real output); paceText now
  ROUNDS so screen and sentence name the same second.
- **Halfway reached the wrist** (sessionProgress is already measured in the session's own gate;
  trigger `halfway` added to WATCH_CUE_TRIGGERS; fallback is deliberate silence, never a robot).
- ⚠️ WATCH_CUE_TRIGGERS' comment now admits `keep-going`/`milestone-distance` are AHEAD of the wrist
  (clips in the map, no sender) — the old comment claimed the list was taken from call sites, false.

**Still the owner's**: (a) wrist FAST-side corrections as recorded no-number nudges would reverse his
2026-07-31 numbers spec — not shipped without him; (b) wiring keep-going through speakOnPhone (its
personalised variant speaks a NAME and must stay wrist-side or route via the personal pack); (c) the
hardware diagnostic that settles the pocketed-phone native player: one MULTI-step wrist run, phone
pocketed, ended from the wrist, then read Support › Your data's `coach:` line — map 0 = stale
build/empty map, failed>0 = refused session, wrist N/N healthy = working as designed.

## THREE FAULTS FROM ONE PHONE-RECORDED RUN, AND TWO OF THEM WERE ONE (owner, 2026-08-22)

He ran a custom 1 km session through the phone and reported four things:

> "when running the session through the phone, as soon as the phone locks the tracking seems to
> jitter......as soon as i unlock it, it corrects itself immediately as you can see by the screenshots.
> The 3rd screenshot displays a message that i got when i unlocked the phone just before the halfway
> point in the session. Also, on the custom run running the session through the phone, once it hit the
> halfway point the voice coach triggered saying session complete.....it didnt stop the session it just
> fired the voice command.......similarly, at the end of the session, the volume on my music ducked but
> the voice stating that the session had finished didnt arrive until approximately 30 seconds afterwards"

Suite 1197 → **1199**; **27 deliberate re-breaks, all 27 caught** (four only after a guard was
restated — those four are the useful half, below).

⚠️ **WHAT REACHES HIS PHONE OVER THE AIR AND WHAT DOES NOT.** The schedule fix, the stale-line release
and the watch toast are all in `docs/index.html`, so they land on the next launch. **The Live Activity
clock and the Swift half of the toast need an Xcode build** and are inert until then.

### ⚠️⚠️ FAULT 1 AND FAULT 2 ARE ONE CAUSE, AND THE PROOF IS ARITHMETIC

`coachNativeSchedule` builds the whole locked-phone cue schedule by summing `stepSecs`, and `stepSecs`
converts a **distance-gated** step at the **prescribed** pace:

```
if (st.distanceMeters && st.targetPaceSecPerKm) return distance / 1000 * midpoint-of-band
```

His step targeted **5:17–5:45**, so 1 km was scheduled as **331 s**. He ran it in **11:00**. The
finishing cue therefore fired at 331 s of a 660 s run — almost exactly halfway — and nothing about
hearing it stops a session, which is precisely what he described.

⚠️ **AND BECAUSE THE SESSION WAS "STEP 1 OF 1", THE ESTIMATE WAS NEVER CORRECTED.** The schedule was
re-pushed at a **step boundary**, and a one-step session has none. So the guess made in the first
second, before a metre had been covered, stood for the whole run. `coachRunTick` now refreshes it on
the clock as well — every 30 s, and only when the **predicted finish** has moved by 8 s or more.
⚠️ **THE GATE IS THE PREDICTION, NOT THE CLOCK**, because that is the number every cue hangs off: a
runner holding their pace produces the same prediction every time and nothing is sent. Each post
**replaces the whole list**, so a needless one is a chance to lose a cue that was about to fire.

⚠️ **A DISTANCE-GATED SESSION NOW GETS NO SCHEDULED FINISHING CUE AT ALL, and estimating it better
would not have been enough.** Even a perfect estimate is a guess: a runner who eases off in the last
kilometre still hears "session complete" before they have finished it. A distance-gated session ends
when the ground is covered, which only the page can see, so that cue belongs to the page's own tick.
A **timed** session still schedules one — taking it from every session would be a silent regression for
the locked-phone case the whole schedule exists for, and a test asserts both halves.

⚠️ **FAULT 2 IS THE SAME RUN'S TAIL: THE FINISHING VOICE ARRIVED ~30 s LATE, BEHIND A LINE THAT HAD
FINISHED MINUTES EARLIER.** The native audio shim's watchdog — the thing that exists to cover a lost
reply — is a `setTimeout`, so **it is frozen with the page it belongs to**. A clip handed to Swift just
before the screen locks is played natively and answered through `evaluateJavaScript`, which this file
already records doing nothing at all against a suspended web content process. The answer is lost, the
timer covering the lost answer is frozen, and `COACH.current` stays set for as long as the phone stays
locked.
⚠️ **THE CONSEQUENCE IS A LATE COACH, NOT A SILENT ONE, WHICH IS WHY IT IS HARD TO RECOGNISE.**
`coachTrigger` **queues** anything of priority 40 or more rather than dropping it, and the queue is only
drained when the current line ends. So the finishing cue was chosen at exactly the right moment and sat
behind a wedge until it cleared.
`coachReleaseStale` decides by the **clock and the clock alone** (`COACH.playAt`, stamped in `coachPlay`
where the clip is handed over), so it does not matter whether the timer resumed, whether the reply
arrived, or which of the two wins.
- ⚠️ **IT GOES THROUGH `pause()`, NOT STRAIGHT TO `coachOnEnded`**, so the shim clears its token and its
  watchdog — otherwise a reply that turns up afterwards advances the queue a **second** time and the
  next line is skipped.
- ⚠️ **A STITCHED SENTENCE (`COACH.seq`) IS LEFT ALONE.** It owns the element deliberately and has its
  own bookkeeping; cutting it mid-number is the defect that machinery exists to prevent.
- ⚠️ **`coachRunTick` IS CALLED FROM BOTH LIVE TICKS AND NOT FROM `coachTick`.** `coachTick` is the
  obvious home and the wrong one: it is called from `renderLiveNow`, which returns immediately when the
  live screen is not mounted — exactly the backgrounded case both of these exist for. A treadmill run
  posts no schedule at all (a decided non-goal), so `indoorUiTick` has nothing to reschedule; it can
  still lose a reply, so the release has to reach it.
- ⚠️ **`reschedAt`, `reschedEta` AND `playAt` ARE CLEARED IN `coachResetSession`.** Left behind, run two
  of an app session inherits run one's predicted finish, the drift gate answers "nothing has moved", and
  its schedule is never refreshed at all.

### ⚠️⚠️ FAULT 3 — "Couldn't communicate with a helper application." IS COCOA ERROR 4099, SHOWN VERBATIM

`reportStart` in `WatchBridge.swift` is shared by **two different launches**, and only one of them is
about the run: `startOnWatch`, where the wrist IS the recorder and a failure changes where the run is
kept, and `startWatchCompanion`, where the wrist is a **display** and whose own comment says it is
*silent if there is no watch*. On the companion path `__interunWatchStart(false, …)` was:
1. clearing the count-in **of the run he had just started**,
2. re-rendering the live screen under him,
3. and raising a toast about a watch he was not using.

⚠️ **`WATCH_LIVE_PENDING` IS THE DISCRIMINATOR, and it is sound because `startOnWatch` is its only
writer of `true` and sets it in the same breath as the request.** On a phone-recorded run the handler
now returns immediately, so the silence IS the fix.

⚠️ **AND THE STRING WAS THE NSError's OWN.** Three of `reportStart`'s four callers pass plain English we
wrote; the fourth passed `error?.localizedDescription` straight through, into a `toast()` in front of a
running runner. Fixed at source (the detail goes to the log instead) **and** on the page, because
`docs/index.html` reaches phones over the air while Swift does not.
⚠️ **`watchStartMessage` IS AN ALLOWLIST, NOT A BLOCKLIST.** A blocklist of known system phrasings goes
stale with the next iOS release and with every locale, and its failure mode is the raw string back on
screen. Our own copy is a closed set of four, so anything not in it is not ours and is not shown — and
a test drives all four through to prove the allowlist has not swallowed them.

### FAULT 4 — THE CARD'S CLOCK IS NOW COUNTED BY THE SYSTEM; ITS DISTANCE STILL IS NOT

His card read **10:52 / 0.86 km / 10:02** while the app, eight seconds later, read **11:00 / 0.98 km /
11:12**. ⚠️ **THE RECORDED RUN WAS NEVER WRONG, AND THAT IS WORTH SAYING FIRST.** Fixes are buffered in
Swift while iOS throttles the web content process and replayed in order; the pace window is stamped with
each fix's **own** clock (`gpsFixElapsedMs`), so the total and the pace both come out right — 0.86 → 0.98
in eight seconds is 120 m of backlog landing at once, not 15 m/s of running. What he saw was the **lag**:
`pushLiveActivity` is called from the page's tick, so every number on the card froze together.

⚠️ **A CLOCK THAT HAS STOPPED READS AS A RUN THAT HAS STOPPED, and that is the part fixable without a
second distance accumulator.** `RunActivityAttributes.ContentState` gained `runningSince`, and the widget
renders `Text(timerInterval:)` — counted by the system with **no pushes at all**.
- ⚠️ **AN ANCHOR, NOT A DURATION, RE-SENT ON EVERY PUSH.** Our own elapsed already subtracts paused time,
  so re-anchoring is what keeps the system's count equal to ours; a timer started once at the beginning
  would run ahead by the length of every pause.
- ⚠️ **COMPUTED ON THE RECEIVING DEVICE**, from the elapsed it was just told. A wrist tick crosses
  WatchConnectivity and a page post crosses a message handler, so a timestamp made at the far end would
  carry the delivery delay into the clock.
- ⚠️ **NIL WHILE PAUSED**, because a system timer counts real time — a paused run falls back to the
  pushed string. And nil for the **watch-pending placeholder**: the wrist has not begun, so a timer
  counting up beside a distance stuck at zero reads as a run in progress going nowhere. A **mirrored**
  wrist workout HAS begun, so its anchor is `Date()` and zero is the truth.
- ⚠️ **`runningSince` CARRIES NO DEFAULT.** `= nil` would let a new producer omit it and compile, and
  that path alone would render a clock that stands still. Caught by re-break: the derived producer sweep
  reads today's call sites and cannot see a door left open for tomorrow's.

⚠️⚠️ **THE DISTANCE ON A LOCKED CARD IS STILL FROZEN, AND CLOSING IT IS THE OWNER'S CALL.** The only way
to keep it current is for Swift to accumulate its own figure from the location stream it already
receives — a **second distance accumulator**, which would disagree with the run being recorded and move
the jump rather than remove it. The clock can be made honest without one, so it is; the distance is
stated here rather than quietly half-done.

### The four re-breaks that escaped first, and what each one taught

1. ⚠️ **A GUARD WHOSE SCENARIO IS DOUBLE-COVERED DISCRIMINATES NOTHING.** "A distance-gated step is
   timed at the runner's own pace" asserted on the finishing cue — and the very next guard removes that
   cue from a distance-gated session, so its absence satisfied the first assertion whatever the timing
   did. Restated on `coachPredictedEndSec`, which IS the arithmetic (half a kilometre in 330 s must
   predict ~660 s, not the prescription's 331), plus a two-step schedule where the second step's own
   placement proves it. Third firing of this trap in this file.
2. ⚠️ **BELT AND BRACES HIDES THE BRACE YOU ARE TESTING.** Deleting `COACH.seq` from
   `coachReleaseStale` left `COACH.current` standing, because `coachOnEnded` opens with the same check.
   The visible harm is the `pause()`: the element is taken back and the stitched sentence stops
   mid-number. Asserted on the element, not on the prompt.
3. ⚠️ **A DERIVED SWEEP READS TODAY'S CALL SITES AND CANNOT SEE A DOOR LEFT OPEN FOR TOMORROW'S.**
   Defaulting `runningSince` to nil passed the every-producer sweep, because every producer still
   passed it. The claim that catches it is about the *declaration*.
4. ⚠️ **TWO STATES BUILT WITH `elapsedSeconds: 0` CANNOT BE TOLD APART SYNTACTICALLY.** The placeholder
   must have no anchor and the mirrored workout must have one, and "runningSince is present" is
   satisfied by `nil`. The difference is which file is building it, so the claim is made per file.

⚠️ **AND THE HAND-WRITTEN LIFT LIST IN `test/locked-screen-distance.test.ts` WENT STALE THE MOMENT
`gpsUiTick` GAINED A CALL** — 16 tests threw `ReferenceError: coachRunTick is not defined` at once.
That is the acceptable kind of stale: it fails loudly rather than quietly measuring less.

⚠️ **THE RE-BREAK HARNESS TOOK ONE PRISTINE COPY AT THE START and copied it back after each break** —
never `git checkout`, per the rule this file records paying for twice. It also rebuilds `web/app.html`
after a page break (these tests read the BUILT page, so an unbuilt break reads as an escape) and treats
a build failure as caught.

**Verified:** build exit 0, `docs/voices/` clean, `node --check` OK on all three emitted blocks, tsc
clean apart from the one pre-existing `test/onboarding-wizard.test.ts` Date overload, **1199 pass / 0
fail under UTC, `TZ=Pacific/Kiritimati` and `TZ=Pacific/Pago_Pago`** with `CHROME_PATH` set, both design
ratchets unchanged (143 radii, 322 font sizes — no CSS changed), and `InteRun` **Release** for
`generic/platform=iOS` building with 0 errors, watch app and widget embedded.

## THE LOCK-SCREEN DISTANCE KEEPS MOVING (owner's ruling, 2026-08-22)

Verbatim: *"The distance needs to keep going on the lock screen if the user has decided to use the phone
to run......There's no reason that this should affect anything else and you need to make sure it doesn't
break anything else...i don't know why the distance cant keep tracking, in fact when i was looking at
the card on the lock screen, it does change but just not accurately."*

⚠️ **HIS LAST OBSERVATION IS THE DIAGNOSIS, AND IT CORRECTS WHAT THIS FILE SAID THE DAY BEFORE.** The
previous note called the card frozen. It is not: iOS **throttles** the web content process rather than
stopping it, so `pushLiveActivity` runs whenever the page happens to wake and every number stands still
in between. The card moves in jumps, and the figure on it is however far behind the runner the buffered
backlog happens to be. *"It does change but just not accurately"* is exactly that.

`ios/InteRun/CardDistance.swift`. Suite 1199 → **1215**; 14 deliberate re-breaks, all caught (three
only after a guard was restated). **Native, so it needs an Xcode build.**

### ⚠️⚠️ IT IS A CHORD FROM THE PAGE'S OWN ANCHOR, NEVER A SUM OF DELTAS

The page pushes its **committed** total and **the position that total was true at**
(`LIVE.anchorLat`/`anchorLon`); Swift adds one straight line from there to the newest fix. Three
consequences, and all three are why this is safe:
1. **Nothing accumulates.** Summing per-fix deltas is precisely the fault `onGpsPos`'s anchor-and-leash
   exists to prevent — noise is positive on every reading and haversine is always positive, so a sum
   runs long (measured on the page's own harness: 124 m of walking read as 215 m) — and that error
   **grows for as long as the phone stays locked**, in the direction that flatters the runner. A chord
   from a fixed point is bounded by the jitter itself, forever. **Measured: 120 jittering fixes at a
   standstill drift under 3 m and do not trend.**
2. **Every push replaces it outright**, so it can only ever be as wrong as the time since the page last
   spoke.
3. **A chord across a bend UNDER-reads** (measured: a 200 m dog-leg shows as its 141 m chord), which is
   the safe direction — the card never claims more ground than was covered.

⚠️ **COMMITTED (`LIVE.dist`), NOT DISPLAYED (`liveDistM()`).** The displayed figure already contains the
pending leg measured from that same anchor, so pairing it with the anchor counts those metres twice.
And the chord is the same quantity `LIVE.pendM` measures — so the two **agree while the page is awake**
and diverge only while it is not, which is the entire point.

⚠️ **THE PAGE REMAINS THE SOLE AUTHOR OF THE RUN, AND THAT IS THE PROMISE HE ASKED FOR.** Nothing this
computes reaches `LIVE`, the saved run, Strava, Health or any store. It answers one question for one
pixel. Guarded three ways: only `adopt`/`stop` may move the base or the anchor; `CardDistance.shared`
may only be *told* things (`adopt`/`stop`/`saw`, never asked); and it speaks to exactly one thing,
`LiveActivityService.shared.update`.

⚠️ **THE PACE IS NEITHER RECOMPUTED NOR DROPPED, AND BOTH ALTERNATIVES ARE WORSE.** Recomputing means
dividing this chord by a wall clock — the "arithmetic on a lump" the page's pace window exists to
refuse. Dropping it to "--:--" takes away a figure the runner already had, which is a regression wearing
honesty's clothes. The page's last judgement stands until it makes a new one. Nothing on the card
contradicts anything else as a result: it shows CURRENT pace, not average, so a fresher distance breaks
no arithmetic relationship.

⚠️ **THE GATES ARE THE PAGE'S OWN NUMBERS.** A fix is usable at **35 m** or better — `onGpsPos`'s own
`good` threshold — because two gates that disagree about a usable fix put a position on the card the run
itself never accepted. A chord implying more than **7 m/s** (faster than any pace this app prescribes;
the engine refuses a derived pace under 150 s/km, i.e. 6.67 m/s) is **clamped, not dropped**: dropping
freezes the card, showing it jumps the card, clamping advances at a believable rate until the next good
fix corrects it.

⚠️ **A 10-METRE MINIMUM CHANGE DOES THE WORK AN `applicationState` CHECK WOULD DO, AND CANNOT GET IT
WRONG.** In the foreground the page resets the base every couple of seconds, so the gap never reaches
ten metres and nothing is pushed at all. This file already records `.inactive` being the wrong gate once
(it covers the app being ON SCREEN), so not needing one is worth more than getting one right.

⚠️ **IT IS TOLD ABOUT FIXES *OUTSIDE* THE `applicationState == .active` GATE, and that asymmetry IS the
fix.** `LocationService`'s buffer exists precisely because the page cannot be reached right now, which
is exactly when the lock screen goes stale. Gating the card update the same way switches it off in the
only situation it is for. ⚠️ **The NEWEST fix only** — replaying a backlog through it would push the
card once per fix for nothing.

⚠️ **THREE STATES SWITCH IT OFF, AND EACH HAS ITS OWN REASON.** A **wrist-recorded** run
(`driveLiveActivity` calls `stop()`): its ticks arrive over WatchConnectivity and are forwarded from
native code that keeps running with the screen off, so that card was never stale, and a phone-side chord
would compete with the wrist's own figure. **Paused**: a paused run is not covering ground, and a card
creeping up while the runner stands still is worse than one standing still with them. **Ended**.

⚠️ **NO ANCHOR MEANS NO EXTRAPOLATION, WHICH IS WHAT MAKES A TREADMILL AND AN OLDER PAGE SAFE BY
CONSTRUCTION.** `LIVE.anchorLat` is written only by `onGpsPos`, so an indoor run and a simulated one
send none — and a page that predates this sends neither field. All three behave exactly as before.

### ⚠️ THE ARITHMETIC IS A PURE FUNCTION SO IT CAN BE RUN, NOT ONLY READ

`CardDistance.project` is `static` and side-effect-free, and `test/card-distance.test.ts` **compiles it
with `swiftc` and drives it** (the `test/watch-route-harness.ts` precedent). The claims that matter here
are behavioural — a bend under-reads, a standstill gains nothing, a wild fix is clamped — and a
structural test of a Swift file can only prove the code says what it says. ⚠️ **The real function is
lifted whole, never modelled**: a hand-written copy in the test agrees with itself and proves nothing
about the shipped one. ⚠️ **Absence of `swiftc` is a FAILURE, not a skip**, for the reason the export
gate already records.

⚠️⚠️ **AND EXTRACTING IT CREATED THE ONE HOLE A RE-BREAK FOUND.** Turning the class into an accumulator
— `baseMeters = shown; anchor = loc; anchorAt = Date()` after each push — leaves `project` untouched, so
**every behavioural test still passed**, and it has no `+=` and still exactly one `distance(from:)`, so
both structural guards passed too. The accumulation had simply moved into the stateful part the pure
function cannot see. The invariant that catches it wherever it is written: **only `adopt` and `stop` may
move the base or the anchor**, derived by walking every function body rather than listing them.

⚠️ **A SECOND ESCAPE WAS A LAZY REGEX RUNNING PAST ITS OWN BLOCK.** `/if ended \{[\s\S]*?live = false/`
matched straight through `if ended { return }` to the `live = false` in the guard-let-else below, so
deleting the whole ended branch passed. Scoped to `[^{}]*` inside the block. Collection-too-wide, in a
two-line regex.

### ⚠️ WHAT IS STILL NOT LIVE ON THAT CARD, STATED RATHER THAN IMPLIED

Between the page's wakes the **pace** is the page's last figure and the **heart rate**, **step** and
**lap** are too. Only the clock (system-counted, from `runningSince`) and now the distance move on their
own. That is deliberate: distance is the only one of them a straight line from a known point can honestly
answer.

## THE 20-METRE GPS REPORT, AND WHY THE OBVIOUS FIX WOULD HAVE MADE IT WORSE (owner, 2026-08-21)

*"I have done a number gps tests again today over multiple 1km runs.....our app is consistent when
tracking on either the phone or watch. However, both are 20 metres out from what the runna app tracks
over that distance. Ours finishes 20 metres after the runna app finishes a 1km segment"*

⚠️ **OUR TOTAL IS NOT WRONG — THE READING LAGS, AND THOSE ARE DIFFERENT DEFECTS WITH DIFFERENT FIXES.**
Measured over sixty simulated kilometres through the SHIPPED `onGpsPos`, with a filtered receiver
(correlated error, not the independent per-fix noise an earlier probe used — independent noise inflates
distance and masks exactly this): accumulated error **−0.25%**, i.e. 2.5 m per km. But at the instant the
true distance crossed 1000 m the app read **3.5 m short on average, 5.3 m worst**, because the leash only
commits distance once the runner is further from the anchor than a fix's own noise. At any moment up to a
leash's worth of real ground is unpaid. That is the shape of his report: our kilometre marker arrives
after the other app's because our reading is behind, not because our total is short.

⚠️⚠️ **TIGHTENING THE LEASH WAS MEASURED AND REJECTED, AND THE MEASUREMENT IS THE POINT.** A 3 m leash
reads 0.4 m short instead of 3.5 — and on a stationary phone with no reported speed it invents distance:

| wander, no reported speed | shipped `max(10, acc)` | `max(3, acc*0.5)` |
|---|---|---|
| ±4 m, ±8 m | 0.0 m | 0.0 m |
| **±16 m (under a roof)** | **0.0 m** | **176.8 m** |
| ±32 m (city canyon) | 270.1 m | 752.5 m |
| ±64 m | 1300.7 m | 2508.7 m |

Three metres on a clean signal for 177 m of invented distance is the standing-still defect this file
already records fixing once, bought back. **Do not tighten the leash.**
⚠️ **AND THAT TABLE IS ALSO THE PROBE'S OWN CALIBRATION.** The standstill check read 0.0 m for every
variant at first, which is what an instrument that never reaches the credit path also reads. Raising the
wander until both variants credit hundreds of metres is what proved it can fail.

**What shipped instead: `LIVE.pendM`, the leg the leash has not committed, included in the READING.**
`liveDistM()` is the one reader (the screen, `checkSplits`, the runtime feed, both saved records); every
writer still writes only `LIVE.dist`. Lag **3.5 m → 0.52 m**, and the standstill behaviour is identical
to shipped at every wander from ±4 m to ±64 m — because it is gated on the device itself reporting
movement (`devSpeed > 0.5`), so a phone on a table accrues nothing.
- ⚠️ **MONOTONE WITHIN A LEG** (`Math.max(pendM, min(net, leash))`). `net` falls when a fix wanders, and a
  distance that goes backwards on screen is worse than one that lags. On commit `dist` grows by more than
  a leash while this resets to zero, so the sum never drops.
- ⚠️ **CLEARED AT THE MOMENT OF COMMIT**, or the same metres are counted twice.
- ⚠️ **ONE READER, OR A KILOMETRE MARKER FIRES AT A DISTANCE THE SCREEN NEVER SHOWED.** Reading
  `LIVE.dist` in some places and `liveDistM()` in others is that defect exactly.

⚠️ **WHICH APP IS RIGHT IS STILL NOT ESTABLISHED, AND THE HONEST ANSWER IS THAT NEITHER IS PROVEN.** Two
apps disagreeing by 2% over a kilometre says nothing about which one matches the ground without a
measured truth. Our model says we are within ~4 m at 1 km; the remaining ~16 m of his 20 is therefore
more likely the other app reading long, but that is an inference, not a measurement. **A 400 m track lap,
or a mapped kilometre, would settle it** — worth asking for before spending anything more here.

## THE LOCKED PHONE, THE THIRD REPORT: THREE SEPARATE FAULTS IN ONE RUN (owner, 2026-08-24)

*"we still have a major issue with the phone recorded run not being accurate whilst it's locked unless
you fixed it in that last task you did? you need to find a fix for this, even if it means that nothing
records on the watch and there are no watch screens for phone recorded runs"* — with three screenshots
of a walked, custom, distance-gated 1 km run: the lock-screen card reading **11:15 / 0.94 km / 10:02**,
the saved run reading **1.00 km / 11:22 / 11:19 per km**, and written on the third *"Completed session
cue still fires approximately 20–30 seconds after the session finished card appears"*.

⚠️ **THERE WERE THREE UNRELATED FAULTS IN THAT ONE RUN, AND ONLY ONE OF THEM WAS THE RECORDED
DISTANCE.** Answering "is it accurate?" with one number would have been wrong three ways.

⚠️ **AND THE ANSWER TO HIS DIRECT QUESTION IS: HALF YES, AND THE HALF HE NEEDED NEVER SHIPPED.** His web
layer is the newest there is (`docs/index.html` carries `BUILD "2026-08-24 11:23"`, which is HEAD), so
every page-side fix is on his phone. **`ios/InteRun/CardDistance.swift` — the one change that makes the
lock-screen distance keep moving — is native and has never been built onto the device.** The repo's own
rebuild ritual (a `Build NNN` commit within ~3 minutes of every native change) stops at Build 458,
**41 minutes before** `ec73065` committed it.

### ⚠️⚠️ THE RECORD IS ACCURATE IN EVERY WORLD, UNLESS iOS'S STEP COUNTER OVER-READS

Reproduced his run through `test/locked-screen-distance.test.ts`, which lifts the REAL `onGpsPos` /
`pedoFillGap` / `checkSplits` / `paceMark` / `gpsUiTick` out of the built page and replays a buffered
burst exactly as `LocationService` does on `didBecomeActive`: a 1 km gate, walked at 1.474 m/s, 460 s
locked, swept across suspended / throttled / awake × Doppler / no-Doppler × accuracy 8 / 20.

**Accurate to within 1.2% in every one of those worlds — locked makes no difference at all.** But at a
step-counter scale of 1.15 the run recorded **+7.6% and the 1 km gate fired at 932 m** of ground
actually covered; at 1.3, **+19.6% and 855 m**; at 1.5, **+34.8%**. Identical suspended, throttled and
awake, so **it was never a lock defect** — and a WALKED run is exactly where iOS over-reads, because the
stride length it infers distance from is calibrated on running strides.

⚠️ **THE MECHANISM: `pedoFillGap` CREDITS ITS METRES STRAIGHT INTO `LIVE.dist` AND THE SURPLUS IS
WRITTEN OFF — AND WRITTEN OFF MEANS KEPT.** GPS settles what its own displacement covers; whatever is
left is `path − chord` and is deliberately not carried forward. Measured, `writtenOff` 71 m against a
70 m over-credit: the write-off was absorbing a stride-model error it cannot tell from a bend.

⚠️ **SO THE FIX IS TO SEPARATE THEM, AND THE DISCRIMINATOR IS THAT ONE IS GEOMETRIC AND THE OTHER IS
SYSTEMATIC.** `path − chord` exists only across the blackout's own bends. A stride-model error is on
every metre — **including the healthy ones, where GPS is right there to compare against.** `pedoCalScale`
divides the fill by what the step counter measures per GPS metre, and the write-off keeps the rest.

| | before | after |
|---|---|---|
| his run, step scale 1.15 | gate@**932 m**, **+7.6%** | gate@1002 m, −0.1% |
| his run, step scale 1.3 | gate@**855 m**, **+19.6%** | gate@1002 m, −0.1% |
| his run, step scale 1.5 | gate@**855 m**, **+34.8%** | gate@1002 m, −0.1% |
| dark tunnel, scale 1.3 | **+4.0%** | −6.3% (identical to an honest counter) |
| bends 0 / 180 / 360° | −0.3 / −0.5 / −0.8% | unchanged |
| 20-minute lock | −0.1% | −0.1% |
| **split times: mean error** | **16.9%** | **12.4%** |
| **untimeable (zero-second) splits** | **6** | **0** |
| worst split error | 155% | 91% |

⚠️ **THE GATE IS THE HALF THAT HURTS MOST.** A distance-gated session is completed BY the credited total,
so an over-read does not merely print a wrong number — it ends the session before the runner has covered
the distance, stamps a split that never happened, and says "well done" for ground they did not run.

### ⚠️⚠️ THREE WRONG VERSIONS OF THE ESTIMATOR, EACH MEASURED, AND THE ORDER MATTERS

The estimator is trivial to write and every obvious form of it is biased. On a purely healthy run its
bias is **0.998–1.010** across every speed, scale and accuracy — so whenever a reading looked wrong, the
denominator was wrong, not the idea.
1. ⚠️ **ACCUMULATING EACH SIDE INDEPENDENTLY READS 1.15 FOR A COUNTER THAT IS EXACTLY 1.00.** The healthy
   branch tolerates **twenty seconds of GPS silence** before it calls a gap a gap, so every blackout opens
   with twenty seconds of pedometer metres against no GPS at all. And that 15% error made a genuine
   two-minute tunnel **worse** rather than better: −6.4% → −11.1%.
2. ⚠️ **REQUIRING BOTH SIDES POSITIVE IN THE SAME TICK IS BIASED THE OTHER WAY.** GPS commits in
   leash-sized steps roughly every seventh second while the step counter reports every one, so it throws
   away six sevenths of the pedometer's metres.
3. ⚠️ **AND DERIVING THE GPS SIDE FROM `LIVE.dist` READS 1.15 TOO**, because a replayed backlog dumps its
   whole settlement residual into one interval the step counter never saw — measured, ~525 m in a single
   tick on a 20-minute lock.

**What works is holding the pedometer's metres PENDING until a GPS credit covers them.** They are
committed by the credit that pays for them and dropped by the fill that bills them, which is the only
form that compares like with like.

⚠️ **AND THE PLACE MATTERS: IT CANNOT BE DONE AT THE GPS CREDIT SITE.** That was the first attempt and it
measured as an exact no-op (`cal 0/0` on every row) — `pedoFillGap`'s healthy branch resets the baseline
on **every tick**, so by the time `onGpsPos` looks there is no delta left to read.

⚠️ **A SKIP-THE-TICK-AFTER-A-BLACKOUT COUNTER WAS BUILT AND THEN REMOVED, AND THAT IS RECORDED SO IT IS
NOT BUILT AGAIN.** It was written for a real hazard and measured **byte-identical on every trace** — his
run, a 20-minute lock, a dark tunnel, bends, at scales 1.0 and 1.3 — because the pending bucket already
subsumes it. Three unfalsifiable moving parts in the most delicate arithmetic in the app is how the next
reader is misled. ⚠️ `LIVE.gpsCredM` is **also** measured equivalent to `LIVE.dist` here and is kept only
because it makes the quantity mean what its name says; that is recorded beside it as principled rather
than demonstrated.

### ⚠️⚠️ THE COMPLETION CUE'S 20–30 SECONDS: `liveFinish` TEARS THE COACH DOWN BEFORE IT SPEAKS

The fix shipped for his first report was not wrong and WAS on his phone. It was defeated by the two lines
that run immediately before the cue is fired:
1. `liveFinish` opens with `stopLive()`, **eight statements before** `coachTrigger("session-complete")`.
2. `stopLive` posts `clearSchedule`, which reaches Swift's `CoachAudioService.stop()` →
   `player?.stop(); player = nil`. ⚠️ **`AVAudioPlayer.stop()` DOES NOT FIRE
   `audioPlayerDidFinishPlaying`**, which is the only path a page clip has back to the page — so
   `COACH.current` stayed set for ever.
3. `stopLive` also clears `LIVE.ui`, the only clock that calls `coachReleaseStale`.
4. `session-complete` is `interrupt: false`, and `shouldInterrupt` needs `interrupt && priority >`, so
   the most important line in the run was pushed onto the queue by a cue of **any** priority — on his
   run almost certainly the kilometre-1 milestone replayed from the unlock burst microseconds earlier.
5. Nothing could then drain the queue but the shim's own **15-second watchdog**. That is the floor;
   a second queued cue and its clip take it to 20–30 s.

⚠️⚠️ **HIS STRONGEST CLUE IS WHAT CONFIRMED IT, AND IT IS A SECOND DEFECT IN ITS OWN RIGHT.** His music
ducked on time and the voice came half a minute later. The duck is `sess.setActive(true)` with
`.duckOthers`, fired the instant a clip is handed over and **before the player is even constructed**; the
un-duck is `releaseSession()` with `.notifyOthersOnDeactivation`, reachable **only** from
`audioPlayerDidFinishPlaying` or `stopPagePlayback`. `stop()` reached neither. So the runner's music was
held down for a clip that had been cut off, with nothing playing at all. **Duck-and-abandon has exactly
that signature, and ducking is therefore not evidence that anything was audible.**

**The fix is three lines in three places, and the reasoning for each is different:**
- ⚠️ **`stopLive` now calls `coachStop()`** — the same reasoning that makes `clearSchedule` right makes
  this right, and that function's own comment already said it: *"A cue arriving from a run that is over
  is the worst kind of ghost."* A cue **still playing** from a run that is over is the same ghost.
  Chosen over giving `session-complete` interrupt rights, which would cut a line off mid-word in every
  other situation — whereas the run ending is the one moment at which every line in flight is about
  something that is no longer happening. It also means the completion cue meets an EMPTY queue.
- ⚠️ **`livePauseSet` NOW TEARS DOWN BEFORE IT SPEAKS, AND IT HAD THE SAME DEFECT PLUS ONE.** `rt.pause()`
  emitted the pause line and *then* `clearSchedule` cut it off — and `paused_1` is `P_INFO`, so it could
  never have interrupted a milestone anyway. ⚠️ **And my `stopLive` change would have silenced the
  treadmill pause cue**, because that branch calls `stopLive()` after `rt.pause()`. Both branches now
  tear down first. `pauseStart` moving up with it is safe: `liveNowMs` reads `pausedMs`, which
  `pauseStart` only feeds on resume.
- ⚠️ **Swift's `stop()` now reports the page's pending token and delegates to `stopPagePlayback`**, which
  has always done it correctly — nil the delegate, stop, release. **Two teardowns for one player with
  opposite discipline** is the fix-one-builder-and-not-the-other trap. ⚠️ The report must PRECEDE the
  token clear: a report carrying token 0 is dropped by the shim as a late answer for a clip it has moved
  past. **This half is native and needs an Xcode build.**

⚠️ **`coachNativeSchedule` ALSO POSTS `clearSchedule` AND MUST NOT SILENCE ANYTHING** — it means "there is
nothing to schedule", and all four of its callers (`coachRescheduleTick`, `startGps`, `startSim`,
`coachRouteCue`) are inside a live run, with `liveFinish` clearing the ticks before the completion cue is
fired. The guard is therefore a **census of the three posters**, not a blanket sweep, so a fourth forces a
decision rather than passing quietly.

### THE COMPANION IS NOT IMPLICATED — DO NOT SPEND HIS PERMISSION

He authorised dropping watch recording and watch screens for phone runs. Traced: the companion's single
entry into the run is `heartRateBpm`, which `SessionRuntime.update` stores and reports and never reads
again; every writer of `LIVE.dist`, `pendM`, `pedoPaid`, `startMs`, `pausedMs` and `kmDone` was swept and
none is companion. `CompanionSession`'s `HKWorkoutSession` runs on the **watch**, never calls
`startMirroringToCompanionDevice`, and constructs no `WorkoutVoice`, so it claims no audio route and
changes nothing about the phone's background execution or CoreLocation delivery. Its traffic is ~227 tiny
inbound messages over 11:22 against a continuous `bestForNavigation` stream.
⚠️ **Dropping it would lose the entire heart section of the debrief, the HR samples written to Apple
Health, the >92%-of-max safety cue and the wrist's pause/resume/finish controls, and gain nothing
measurable.** Reported to him rather than done.

### Traps this work paid for, and two of them were silent

⚠️⚠️ **A STALE HAND-WRITTEN LIFT LIST FAILED SILENTLY AND MADE ME MEASURE A BROKEN HARNESS AS BROKEN
CODE.** `pedoFillGap` gained a call to `pedoCalScale`; the harness had neither it nor the constant it
reads, so every call threw a ReferenceError **inside `window.__interunPedometer`'s own try/catch**, the
fill did nothing, and the probe reported a two-minute tunnel at −40.3% as though the fix had destroyed
it. `test/gps-distance.test.ts` had the same hole in three lift lists — there it failed loudly, which is
the acceptable kind. **A lift list that omits a dependency measures a strictly easier program**, and
`lift()` in both files now carries consts so the omission cannot recur.
⚠️ **A 1400-CHARACTER WINDOW IS NOT A FUNCTION.** `the step counter is optional everywhere it is used`
sliced `stopLive` by character count and failed the moment it gained a comment. **A character window is
not a card**, for the sixth time in this file.
⚠️ **THE zsh WORD-SPLITTING TRAP FIRED EXACTLY AS THIS FILE WARNS.** `node --test $FILES` passed one
bogus filename, printed nothing, and reported **twelve consecutive escapes** on re-breaks that were all
being caught. Use an array.
⚠️ **TWO RE-BREAK ANCHORS WERE AMBIGUOUS AND SILENTLY EDITED THE WRONG SITE** — `const list =
loadShoes().filter(…)` appears three times, and `        stopPagePlayback()` appears at line 329 before
the one in `stop()` at 385. Both read as escapes. **Scope a re-break to the function under test.**
⚠️ **A GUARD TRIPPED ON A NEIGHBOUR'S VOCABULARY**: sweeping for `/clearSchedule/` flagged
`trialSaveResult`, whose only crime is calling `clearScheduledTrial()`.
⚠️ **AND ONE OF MY OWN GUARDS WAS SATISFIED BY THE WRONG BRANCH.** `/step scale/` in the diagnostic is
matched by `"step scale not measured"`, so deleting the numeric branch escaped. Both branches are now
named separately.
⚠️ **TWO PRE-EXISTING SPLIT GUARDS RESTED ON A VACUITY CHECK THEY CAN NO LONGER SATISFY** — "the sweep
must have seen an untimeable split". Calibrating the step counter makes the fill bill a blackout
accurately, so the backlog is spent settling it and no stale-clocked fix crosses a boundary: untimeable
splits went **6 → 0**. Restoring the floor would be asserting a defect back into existence, so the
invariant moved to `splitAt`, a direct driver of `checkSplits` where **the clock collision is the
fixture** and cannot go vacuous.

⚠️⚠️ **THE "node VANISHED" CLAIM IN THIS FILE IS WRONG AND I REPEATED IT — CORRECTED 2026-08-24.**
`~/.local/node/bin` (a symlink to `node-v24.18.0-darwin-arm64`) **is on the default PATH**, `which node`
resolves and `node --version` answers v24.18.0. Nothing about node is broken and nothing needs a PATH
export. What IS missing is Xcode's **iOS platform support component** — see the toolchain note in the
chapter below. Do not propagate the node claim again; check `which node` before writing one down.
⚠️ **THE REAL LIMIT: there are no simulator runtimes and no on-device platform component**, so `xcodebuild`
cannot build any target at all. The Swift
change is verified by `swiftc -typecheck` over the whole module (`ios/InteRun/*.swift` +
`ios/InteRunShared/*.swift`) — **zero errors** — and by nothing stronger. Single-file typechecking is
useless here and looks alarming: it reports 36 errors that are all `cannot find X in scope`.

### What to ask him to read off his own phone

⚠️ **BEFORE CLOSING THE APP** — `GPS_DIAG_LAST` and `PEDO_DIAG_LAST` are module-level variables, so a
force-quit erases them. Support › Your data:
- **`steps:` … `step scale N.NNx over Mm`** — the new figure. Near 1.00 means iOS's stride model agreed
  with GPS on that run and the calibration changed nothing; well above it means the fill was being
  scaled down and this was his defect. **"not measured"** means under 150 m of healthy GPS, so nothing
  was scaled.
- **`web layer:`** — must read `over-the-air 2026-08-24 …` or later.
- **`coach:`** — `missing`/`failed` climbing means the cue map never landed; a clean line with the audio
  still late is new information.
