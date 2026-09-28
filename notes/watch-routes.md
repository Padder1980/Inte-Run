# Watch routes — thinning and per-point times

> Part of Inte-Run's project notes. Moved out of `CLAUDE.md` word for word on 2026-09-28: CLAUDE.md loads
> into every Claude session and had grown to 1.29 MB (about 400,000 tokens), which kept filling the context
> window. The rules that apply to every task stay in `CLAUDE.md`; this file keeps the history, measurements
> and traps for one area. **Add new findings for this area at the END of this file**, dated, in the same style.
> When a code comment or a test says "CLAUDE.md records…", it means these notes now.

## THE WRIST'S ROUTE IS THINNED, NEVER TRUNCATED (owner's request, 2026-08-21)

Reported to him rather than fixed in the watch phase, and he asked for it. `WorkoutManager` appended a
route point only while `routePoints.count < 600`, with no thinning on the wrist and none at ingest
either. At roughly one credited fix a second that is **ten minutes**: every wrist run longer than that
stored its first ten minutes and stopped, and the debrief hero, the recap and the share card each drew
that prefix as though it were the whole outing. Suite 1067 → **1079**; 26 deliberate re-breaks, all 26
caught.

⚠️ **MEASURED THROUGH THE SHIPPED SWIFT, on a point-to-point 1 Hz track with real structure** (long
curves, a sharp turn every 90 s, a hairpin every 600 s, and an out-and-back spur). `line km` is the
ground the stored polyline claims; `dev` is the perpendicular distance of every full-resolution fix
from the thinned line.

| run | | pts | span | line km | mean dev | worst dev | bytes |
|---|---|---|---|---|---|---|---|
| 10 min · 1.82 km | before | 600 | 99.8% | 1.82 | 0.00 m | 2.99 m | 23759 |
| | **stored after** | **150** | **100%** | **1.80** | **0.25 m** | **1.23 m** | **5941** |
| 1 hr · 10.89 km | before | 600 | **16.6%** | **1.82** | **267 m** | **1024 m** | 23759 |
| | wrist after | 453 | 100% | 10.74 | 0.29 m | 6.81 m | 18336 |
| | **stored after** | **150** | **100%** | **10.53** | **1.13 m** | **42 m** | **6075** |
| 3 hr · 32.65 km | before | 600 | **5.5%** | **1.82** | **1541 m** | **4134 m** | 23759 |
| | wrist after | 341 | 100% | 31.52 | 1.53 m | 42 m | 13894 |
| | **stored after** | **150** | **100%** | **30.17** | **6.90 m** | **136 m** | **6107** |

⚠️⚠️ **HALVING THE BUFFER AT THE CAP IS NOT THE FIX, AND NEITHER A POINT COUNT NOR A SPAN CAN SEE WHY.**
Fixes keep arriving at 1 Hz, so a buffer that is merely halved refills at full rate: the surviving old
region's spacing doubles at every pass while the newest region stays dense. Measured, that leaves
**306 of 336 points in the LAST TENTH** of a three-hour run and the first tenth represented by two —
the mirror image of the defect being fixed, with a **perfect 100% span and an entirely plausible
count**, and a mean deviation of **558 m**. So `routeStride` **doubles at the same moment the array is
halved**: every region then converges on one spacing. After — 34 points in each tenth. **This is the
whole reason the brief asked for the SHAPE and not the count, and it is what a shape measurement
bought.**

⚠️ **A LOOPED FIXTURE MASKS THE DEFECT AND WOULD HAVE CERTIFIED THE NAIVE VERSION.** The same 3-hour
truncation measures **1541 m** of mean error on a point-to-point route and **18 m** on a circuit,
because on a loop the missing tail runs over ground the kept prefix already covers. The
`line km` column is the measure a loop cannot hide it from. Measure route fidelity point-to-point.

⚠️ **THE LAST FIX IS ALWAYS KEPT, VIA A PROVISIONAL TAIL.** At a stride of 32 up to 31 fixes at the END
of a run are not keepers, so the drawn line would stop up to **90 m short** of where the runner
finished — `downsampledHrTrack`'s own recorded trap ("dropping the last one would end the chart before
the end of the run"). `routeTail` holds the newest fix and `route` appends it.
⚠️ **AND `summaryPayload` NOW READS `route`, NOT `routePoints`.** With a tail held outside the array,
reading the array is two builders of one route: the watch's map showing the newest ground and the run
the phone stores ending short of it. Fifth outing of that trap. `WorkoutView` reads the accessor too.

⚠️ **TWO CAPS, TWO JOBS, AND NEITHER IS A DUPLICATE TO BE TIDIED AWAY.**
- **`routeMaxPoints = 600` (wrist)** bounds MEMORY and the WatchConnectivity payload. A 3-hour run is
  ~10,800 fixes; 10,800 pairs is also far past what one `transferUserInfo` should carry. It is the
  looser of the two **because the wrist thins as it goes and cannot know how long the run will be** —
  thinning to 150 in flight would leave a ten-minute run with 150 points when 600 cost nothing.
- **`ROUTE_MAX_POINTS = 150` (phone)** bounds what is STORED, thinning ONCE with the whole run in hand.
  `downsampleRoute`'s literal default is now this constant, so a caller that omits the argument cannot
  store at a different resolution from one that passes it.
Exactly the division `HR_MAX_POINTS` already uses. A guard asserts the wrist's stays the looser AND
still bounds a 3-hour run.

⚠️ **`ingestWatchRun` NEVER DOWNSAMPLED AT ALL, so a wrist run was stored at four times a phone run's
resolution** — 23.5 KB against 6.1 KB on a measured 3-hour run, in a store that holds fifty runs and
is where the whole training history lives. `liveRunRecord` has always thinned at save. Sixth outing of
fix-one-commit-point-and-not-the-other in this one function, which already carries warnings about the
shoe rack and Strava.

⚠️ **THE WRIST SENDS NO PER-POINT TIME, AND THAT IS A REAL GAP RATHER THAN A THING TO INVENT.**
`routePoints.append([lat, lng])` is two elements, and `normalizeRoute` reads only `p[0]`/`p[1]` from an
array, so nothing carries one. Consequence, stated plainly: **`runStravaPayload` filters on
`isFinite(p.t)`, so every wrist run falls to `pts.length < 2` and goes to Strava as a MANUAL activity —
real distance and time, no map, no splits, no pace.** Nothing here fabricates one (the phone stamps
`liveElapsedMs()` per credited fix for exactly this reason, and that function's own comment refuses to
spread a total evenly afterwards). What WAS done is make the thinning shape-agnostic — it moves whole
points — and guard it, so the day the wrist does send a time it cannot be silently stripped. **Adding
one is a small, separate change: `loc.timestamp` against the run's start, minus paused time, plus a
third element in `normalizeRoute`'s array branch.** Worth doing; not done unasked.

⚠️ **`migrateRunRoutes` DOES NOTHING HERE, DELIBERATELY, AND BOTH HALVES ARE WRITTEN DOWN.** An
already-truncated run cannot be repaired — the ground past the first ten minutes was never sent, so
there is nothing to rebuild it from. And the surviving points are NOT re-thinned to `ROUTE_MAX_POINTS`
either, though it would free ~17 KB each (~0.9 MB across a full store): those runs are already missing
most of their route, and coarsening the part that is real removes detail from the only ground they have
left. **The migrations that belong there repair a FALSEHOOD** — a route in the wrong shape, splits as
bare seconds, a run captioned "today" a fortnight later. A dense short route is not a lie about itself.

⚠️ **ALL FOUR ROUTE FIELDS ARE CLEARED IN `reset()`, and the guard DERIVES the list from the
declarations** so a fifth cannot be forgotten. `WorkoutManager` is a `@StateObject`: a stride left at
32 would have run two keeping one fix in thirty-two from its first minute, and a tail left behind would
put a point from run one at the end of run two's line.

### How the two halves are guarded, and why they differ

`test/watch-route-thinning.test.ts`. The phone's half is JS, so it is **lifted from the built page and
EXECUTED** — a real run record goes into the real `ingestWatchRun` and the stored route is measured
coming out (the `gps-distance` precedent). The wrist's half is Swift and this suite has no toolchain
for it, so it is structural in the shape `watch-session-end.test.ts` settled on: comments stripped,
lists derived.
⚠️ **THE "ONLY WRITER" GUARD IS DERIVED, NOT LISTED** — every assignment to `routePoints` anywhere in
the type is found and its owning MEMBER resolved, so a new append site with no thinning behind it
fails. ⚠️ **Its owner match must anchor at exactly four spaces of indentation**: without that, the
local `var kept` inside `thinRoutePoints` is read as the owner and the guard reports its own fix as a
stray. Modifiers are matched generically so `nonisolated func` and `private(set) var` both resolve.
⚠️ **THE BEHAVIOURAL PROOF FOR THE SWIFT WAS TAKEN SEPARATELY**, by extracting the shipped
`appendRoutePoint`/`thinRoutePoints`/`route` by brace-matching and running them under `swiftc`. Every
number in the table above came from that, not from a JS model of the algorithm — the model agreed to
the point, on both route shapes, which is why it is worth saying which produced them. Not added to
`node --test`: making the whole suite require Xcode is a bigger imposition than the guard is worth.
⚠️ **AND THE PROBE'S FIRST VERSION REPORTED A THREE-HOUR RUN AS SPANNING 294 SECONDS.** It rebuilt each
point's time from its coordinate, which is unrecoverable on a LOOPED route — every lap repeats the same
lat/lng, so a first-occurrence lookup answers with the first lap. Counts and deviations were right; only
the reconstructed time was wrong, and it read exactly like a product defect. Fixed by passing a third
element through the Swift, **which also proves the thinner carries whole points and would not strip a
time**.


## A PER-POINT TIME ON WRIST ROUTES, AND A STORED LINE THAT CLAIMS THE GROUND (ruling 9, 2026-08-21)

Two changes to the same stored polyline, which is why they are one job. Suite 1092 → **1104**.

⚠️ **THE ASYMMETRY, BECAUSE HALF OF THIS IS INERT UNTIL SOMEBODY REBUILDS IN XCODE.** Part B is
entirely web and reaches his phone on the next launch. **Part A needs the watch to send the times, so
it is native and does nothing at all until the next Xcode build** — the page half is in place and
waiting. Reporting Part A as shipped would be false.

### PART A — THE WRIST APPENDS `[lat, lng, t]`, SO A WRIST RUN CAN REACH STRAVA AS A REAL ACTIVITY

`runStravaPayload` filters on `isFinite(p.t)`, and the wrist appended bare pairs — so **every wrist run
went to Strava as a MANUAL activity**: the right distance and the right duration, and no map, no splits
and no pace, which is most of why anybody sends a run there. `t` is the run's own running seconds at the
moment the fix was taken.

⚠️ **EVERY PART OF THAT SENTENCE IS A DIFFERENT WRONG ANSWER, AND NONE OF THE FOUR IS VISIBLE IN THE
SOURCE TEXT.** So `routeSecondsAt` is `static` and pure specifically so it can be EXECUTED, and
`routeSample` is lifted onto a two-field `CLLocation` shim in `test/watch-route-harness.ts` — build,
gate, thin and read all run the shipped Swift. Measured through it:
- **not subtracting the pause** draws a straight line through the junction the runner waited at, at
  walking pace. Measured: with a 60 s pause the point after it read **160** running seconds where the
  run was 100 seconds old.
- **stamping on arrival** gives a whole delivered batch one identical time — the phone already records
  fixing exactly this.
- **subtracting the FINAL pause total** pulls every early point backwards.
- **a fix stamped INSIDE a pause and delivered after the resume** computes a time EARLIER than the point
  before it, which is a route that goes back in time.

⚠️ **`routeLastT` IS A WATERMARK, AND REFUSING IS THE MECHANISM RATHER THAN A SAFETY NET.** A point that
cannot be placed strictly after the last one accepted is not recorded. That single rule covers all three
of: the mid-pause batch (measured — 143 fixes fed, **140 stored, and the three stamped inside the pause
refused**, with the clock reading 99 then 100 across it); two fixes inside one second; and a clock that
has gone backwards. Nothing is nudged and nothing is invented, which is why it is a refusal and not a
clamp — a nudge would keep the mid-pause point and put it somewhere it never was.
⚠️ **AND IT MUST BE CLEARED IN `reset()`, WHERE IT IS THE SEVEREST OF THE SIX ROUTE FIELDS.** Left at run
one's last time, every fix of run two is earlier in its own run than that, so **run two records no route
at all** — not a thinned one, not a back-loaded one, none. The harness refuses to build a probe whose
lifted reset lines do not include it, because otherwise that guard measures a strictly easier claim.

⚠️ **A TRIPLE IS REQUIRED, AND "MIXED" IS WORSE THAN "MISSING".** An untimed point inside an
otherwise-timed route is dropped by `runStravaPayload` instead — a GPX with a hole in it and a map
missing whatever ground that point described, with nothing anywhere to say so. The wrist always has a
clock, so a bare pair reaching the buffer means a second call site is assembling points by hand;
`routeSample` is the one builder and a hand-built pair fails loudly.

⚠️ **NEVER BACKFILLED.** Runs already stored have no times and keep going up as manual activities;
`runStravaPayload` picks its shape from the DATA and that rule is intact. Guarded from both sides.

⚠️ **`normalizeRoute`'s ARRAY BRANCH IS THE ONE PLACE THE TIME CAN VANISH**, and it read only `p[0]` and
`p[1]`. A branch that names two of three fields drops the one nothing downstream can reconstruct. The
object branch already carried `t` and its own warning; the array branch is the wrist's shape.

⚠️ **AND `runStravaPayload` NOW REQUIRES STRICTLY INCREASING TIMES, NOT MERELY FINITE ONES.** A GPX
trackpoint carries whole seconds once `iso()` strips the milliseconds, so two points on one second are
two positions at one instant — an infinite speed in the field Strava reads for pace. The wrist refuses
such a fix at source, but the phone's own credited fixes are rounded to seconds too, and every route
already in the store predates both rules.

⚠️⚠️ **A CORRECTLY TIMED ROUTE IS USELESS WITHOUT THE INSTANT IT IS RELATIVE TO, AND A WRIST RUN'S ID IS
A UUID.** `runStartMs` cannot recover a start from it and falls back to **09:00 on the run's date** — so
a properly mapped wrist run would land in the runner's Strava feed nine hours from when they ran it. The
watch sends `startMs` alongside the timed route and `ingestWatchRun` stores it; the two travel together,
so a run that can be a GPX also knows when it began, and an older watch build supplies neither and stays
manual.
- ⚠️ **ONE READER, `runStartExactMs`, CALLED BY BOTH `runStartMs` AND `runStartMsKnown`.** Two copies of
  the id arithmetic is two answers to "do we know when this run began" — one of which Strava uploads and
  one of which the debrief PRINTS as a time of day — and they would have had to learn about the wrist's
  new instant separately.
- ⚠️ **SO A WRIST RUN'S DEBRIEF NOW PRINTS A REAL TIME OF DAY**, which is what `runStartMsKnown`'s own
  comment always asked for ("the time is shown only when it is real"). Runs recorded before this still
  print none. `completedAt` on the share card becomes a real instant for such runs; `shareFileName` cuts
  the first ten characters, so the filename is unchanged in shape and still carries the right date.

### PART B — ⚠️⚠️ THE STORED LINE UNDERSTATED THE GROUND, AND PART A IS WHAT MADE IT MATTER

A GPX has **no distance field**: Strava derives the distance FROM THE POINTS. So the moment a run goes up
as a GPX, whatever the stored polyline claims is what appears in the runner's feed — and the stored line
was 150 points spread EVENLY, which replaces every corner it lands either side of with the chord across
it. Measured through the real chain (one credited point per 12 m for a phone run; the wrist's own thinned
output for a wrist one), the line as a fraction of the ground covered:

| | even-150 (shipped) | shape-150 | **shape-300 (now)** | wrist, now |
|---|---|---|---|---|
| 42 km city marathon | 0.863 | 0.990 | **0.991** | 0.954 |
| 52 laps of a 400 m track (21.2 km) | 0.755 | 0.807 | **0.955** | 0.949 |
| 25 laps of a 400 m track | 0.927 | 0.959 | **0.988** | 0.985 |
| 800 m park loop x 10 km | 0.935 | 0.969 | **0.986** | 0.983 |
| 1.2 km park loop x 10 km | 0.966 | 0.982 | **0.990** | 0.989 |
| hostile hairpins, 3 h | 0.573 | 0.965 | **0.980** | 0.824 |
| hostile mixed, 3 h | 0.541 | 0.778 | **0.963** | 0.826 |
| hostile lemniscate, 3 h | 0.440 | 0.560 | **0.856** | 0.821 |

Mean deviation from the real track fell on every one of them (worst 22.50 m → **0.10 m** on the
marathon, 17.03 → **4.48** on the track session).

⚠️ **IT IS A PRE-EXISTING PHONE DEFECT AS MUCH AS A WRIST ONE, CONFIRMED FROM GIT RATHER THAN REASONED.**
At HEAD (`41300a5`, build 434, on TestFlight) `downsampleRoute` was `max = max || 150` with an even
spread, the phone's save path called it, and the phone's route push has always stamped a `t` — so every
route Inte-Run has ever pushed to Strava has been short by this. The two devices are affected within
three thousandths of each other (0.863 phone / 0.862 wrist on that marathon).

⚠️ **THE ALGORITHM IS THE CHANGE THAT MATTERS AND IT COSTS NOTHING; THE CAP IS WHAT BUYS THE LAPPED
SESSIONS.** A real road marathon went 0.863 → 0.990 **at 150 points**. What 300 buys is the routes where
ground can only be recovered by spending points per lap: a half marathon on a track was appearing 5.2 km
short and is now 0.9 km short.

⚠️ **THE RANKING IS DOUGLAS-PEUCKER SIGNIFICANCE, NOT VISVALINGAM AREA, AND THE HAIRPIN IS WHY.**
Visvalingam ranks by the triangle a point makes with its neighbours, which is tiny at the apex of a 6 m
hairpin however far off the chord it sits — measured, **0.607** of the ground there against **0.977**.
⚠️ **AND IT IS BUDGET-EXACT, WHICH PLAIN DOUGLAS-PEUCKER IS NOT.** Bisecting a tolerance until the count
fits leaves the budget partly unspent wherever the count jumps: measured, **144 points of an allowed
150** on the lemniscate. Ranking spends every point it is given.

⚠️⚠️ **THE FIRST CUT PUT 299 OF 300 POINTS IN THE FIRST TENTH OF A STRAIGHT RUN, AND DREW AN IDENTICAL
LINE.** On a genuinely straight stretch every interior point sits exactly on the chord, so every
deviation TIES — and taking the first of each tie makes the subdivision a chain rather than a tree.
Measured on a straight 10,801-point track: **492 ms of quadratic work at save time**, and `299 0 0 0 0 0
0 0 0 1` per tenth. Geometrically harmless; for a GPX it hands Strava a run whose last three hours are
one segment. Two changes fix both at once — **split at the point closest to the MIDDLE of the span among
those tied**, and rank by `(significance desc, subdivision level asc, index asc)`. After: **14 ms** and
`52 43 25 26 25 26 26 25 26 26`.
⚠️ **The index is still the final tie-break, and it is there so the result is DETERMINISTIC** — two runs
over identical ground must store identical routes, which is what lets the route-map cache key on the
route at all.
⚠️ **The parent clamp (`Math.min(worst, cap)`) makes the ranking a hierarchy.** Without it, keeping the
top N can select a point whose neighbours were both discarded, which is a line through ground nobody
covered. ⚠️ **AND IT IS THE ONE RE-BREAK NOTHING CATCHES, BECAUSE IT IS A PRINCIPLE AND NOT A MEASURED
FAULT** — forced to the raw distance the result is IDENTICAL on eight fixtures (a 52-lap track session,
a city marathon, 6 m hairpins, a lemniscate, a perfectly straight track), the only movement anywhere
being one fixture's claimed ground going 0.99230 to 0.99229. Recorded beside the line so nobody
"verifies" it by deleting it, which is what this project once did to a `const` a test was reading.
⚠️ **`keep[0] = 1; keep[n - 1] = 1;` IS THE SAME SHAPE OF LINE and its one binding case is measured:**
both ends are seeded at infinite significance so they win any budget of two or more, and removing the
re-assertion is byte-identical at the shipped cap — but at a budget of ONE the route comes back as a
single point with the END of the run lost. No caller asks for one; a guard sweeps 1 and 2 anyway.

⚠️ **THE COST WAS MEASURED AND SO WAS THE ALTERNATIVE.** A whole stored run record 9151 → **15075 bytes**,
so **447 KB → 736 KB** across a full fifty-run store — the same budget the route-map cache was moved out
of localStorage to protect (64 KB × 50 = 3.2 MB, which would have blown it). Keeping the even spread and
doubling the cap to 600 instead costs about **1324 KB** and is WORSE on almost every shape — measured on
the raw 1 Hz hostile tracks, 0.906 against 0.992 on the hairpins and 0.916 against 0.968 on the mixed one.
Preserving the shape is what recovers ground; more points is only what it costs.

⚠️ **THE HEART-RATE SERIES IS UNTOUCHED, DELIBERATELY.** A sample is paired with DISTANCE, not time — on
a time axis every pause is a plateau — so there are no corners to preserve and an even sample is right.
`HR_MAX_POINTS` and `downsampleSeries` keep exactly the behaviour they had, and a guard says so.

⚠️ **THE WORST CASE STAYS IMPERFECT AND IS STATED RATHER THAN TUNED AWAY.** 65 km walked round a 90 m
figure-of-eight is about 360 laps and no 300-point line can describe it: **0.515** through the thinner
alone. Three hours of the same reads 0.856 (phone) / 0.821 (wrist). The remedy would be points per lap,
not a smaller bound.

### WHAT THE WRIST'S OWN THINNER STILL COSTS, AND WHY IT WAS NOT CHANGED

⚠️ **A WRIST RUN REACHES THE PHONE ALREADY THINNED TO 300–601 POINTS BY THE WRIST'S EVEN HALVING, SO THE
PHONE CANNOT RECOVER SHAPE THE WRIST ALREADY LOST.** Measured, that costs 0.0–0.6 points on every
realistic fixture (track 21k 0.955 → 0.949; park loops 0.990 → 0.989) and up to 3.7 on the city marathon
and 15.6 on the hostile hairpins. The wrist thins AS IT GOES and cannot know how long the run will be, so
a streaming shape-preserving thinner there is a genuinely different design; the documented halve-and-
double is what its own distribution guards are built on. **Not changed, and the residual is the number
above rather than a shrug.**

### WHAT THE GUARDS CAN AND CANNOT SEE NOW — the two that were RESTATED, not deleted

⚠️ **"downsampleRoute keeps both ends and spreads the rest evenly" REQUIRED THE DEFECT.** An even spread
IS the fault. So the assertion was **inverted rather than removed** — removing it would have left the
thinner with no claim about distribution at all, and back-loading is a real measured defect (306 of 336
points in a run's final tenth, with a perfect span and a plausible count). What survives: both ends
exact, the budget filled, nothing invented, the order kept — plus **the line must claim at least the
ground an even sample of the same size would** (measured 1.000–1.148, and the even sample is precisely
what it replaced), and **a featureless stretch must still spread** (ratio 2.08 shipped against 299 for
the chain version).

⚠️ **AND THE CHAIN TEST'S DISTRIBUTION CLAIM HAS LOST MOST OF ITS TEETH — THE TEETH MOVED RATHER THAN
VANISHED.** A corner-dense stretch legitimately gets more points, so the measured worst is now **4.60**
(the hairpin at an hour: `45 45 45 45 45 29 13 10 11 11`), against the **4.06** the earlier phase measured
for the back-loading re-break on the wrist's own output. Those two numbers are taken at different points
in the chain and are NOT a like-for-like comparison, so no claim is made that this bound separates them.
**The back-loading discriminator is the WRIST's own guard** (`TENTH_SPREAD_MAX = 1.5` on the wrist's
output), where the halve-and-double design does still spread evenly. Said out loud in both files.

### Traps this work paid for again

⚠️ **THE BACKTICK RULE FIRED ONCE**, on `` `iso` `` in a runtime-JS comment, and the build failed
outright — which is the good outcome and the reason to read the exit code.

⚠️ **A PRE-EXISTING TYPE ERROR IN `test/watch-route-harness.ts` WAS FOUND AND FIXED** — a `readonly`
tuple cast to `string[]` in `findSwiftc`, present before this phase touched the file. `npx tsc --noEmit`
was reported clean apart from the one `onboarding-wizard` error and this was sitting beside it, so run
every command in the recipe rather than quoting a previous session's result for any of them.

⚠️ **A PROBE THAT TYPES A TABLE FROM MEMORY REPORTS A DEFECT THAT DOES NOT EXIST.** Every number above
came from lifting the real functions out of the BUILT page and out of the shipped Swift; the fixture
builders (`trackLaps`, `parkLoop`, `cityGrid`) are realistic shapes added because the hostile ones alone
cannot tell you whether a cap is worth doubling.

⚠️ **24 DELIBERATE RE-BREAKS. 18 CAUGHT FIRST TIME; FOUR OF THE SIX ESCAPES WERE GUARD DEFECTS AND THEY
ARE THE USEFUL HALF.**
1. ⚠️ **THE PROBE FILTERED OUT THE VERY INPUT UNDER TEST.** "A point with no time is not a point" fed
   `P 51.5 -0.12` — and the probe's own `P` handler requires four fields, so the line was skipped by the
   PARSER and `appendRoutePoint` never saw it. A `PAIR lat lng` command was added and the guard now
   asserts three points were fed before believing what came back.
2. ⚠️⚠️ **"NO WORSE THAN AN EVEN SAMPLE OF THE SAME SIZE" IS SATISFIED BY *BEING* AN EVEN SAMPLE.** Put
   the even spread back and the fidelity guard PASSED — claimed and control are then the same number,
   which is this file's own asserting-a-value-against-itself trap in a new place. The claim is now that
   the thinner removes most of the ground an even sample LOSES: measured, on every fixture where an even
   sample loses ≥2% the shipped thinner leaves at most **65.2%** of that shortfall (the pathological
   lemniscate; worst realistic 57.7%, a road marathon 0%), against **100%** for an even spread. Bound
   0.80.
3. ⚠️ **REVERTING THE CAP TO 150 ESCAPED EVERYTHING, CORRECTLY — a guard should not pin a judgement.**
   So a guard now pins the OUTCOME the cap was raised for: 52 laps of a 400 m track must store a line
   claiming ≥0.94 of its ground (0.955 at 300, 0.807 at 150).
4. ⚠️ **THE HEART-RATE GUARD TESTED THE THINNER AND NOT ITS READER**, so re-pointing `hrSeriesOrNull` at
   the route's thinner escaped the whole test. House rule 7, in the one place this file had not applied
   it. It is driven end to end through `hrSeriesOrNull` now.

The two remaining escapes are **equivalences, measured and recorded in the code** rather than guard
weaknesses — see the parent clamp and the end re-assertion above.

⚠️ **A SWIFT PROBE THAT EXITS ABNORMALLY CAN STALL FOREVER AND HANG THE WHOLE RE-BREAK RUN.** A root
`spindump` was already running on this Mac from before the harness started; one probe sat at zero CPU
for fifty minutes and the harness sat behind it, having produced no output at all because the invocation
piped through `tail`. The harness now takes a **420 s timeout per break** and reports `TIMED-OUT` as its
own outcome rather than as a verdict. Same class as the note about an unparsable `ℹ fail` line: a
re-break run that cannot report is not a re-break run that passed.
