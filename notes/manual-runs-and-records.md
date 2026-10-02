# A run added by hand, a run linked to its session, and best times (stage B1)

Built 2026-10-02 from PLAN.md B1. Web-only: it reaches the phone over the air. The Strava half of a
hand-added run also needs the Worker deployed (`alfie-proxy/`), which only the owner can do.

## What the runner sees

- **Logbook › Runs:** "＋ Add a run you did without Inte-Run" (`#lgAdd`), under the list AND on the empty
  "No runs yet" state, which returns early.
- **A planned session's sheet:** "I did this run elsewhere" (`#sdElsewhere`), between "Add a different
  session" and Start (Start stays last — `test/design-system.test.ts`). Only on a runnable session the PLAN
  holds, dated today or earlier, that no run fulfils yet.
- **The form** (`openAddRunSheet` → `renderAddRunSheet` / `wireAddRun`): date (max today), optional start time,
  distance in km (typed, comma accepted — the treadmill card's field), the time on three native-select
  wheels (the owner's own ask for the PB row), outside/treadmill, run type, "Was it a planned session?",
  and — only when the server can label it truthfully — "Also send to Strava", off by default. Saving opens
  the run's own page, where the effort question and notes already live (no second copy of either).
- **A run's page:** "Added by hand" in the hero, the verdict and the Source row; the Route privacy row is
  hidden for it. The Plan section offers "Link it to a planned session" on a free run, and "Not this
  session? Unlink it" on a link the runner made. A run holding a best says "Your 5 km best".
- **Performance:** a **Best times** card first (`perfBestsHtml`). One row per distance actually covered.

## The owner's rulings

- **Strava: "Ask me each time"** (2026-10-02). A hand-added run goes only when its own switch is on. The
  switch needs a start time (Strava will not take a run without one; none is invented) and appears only
  once `/strava/status` advertises `origins` containing `"added"` (`stravaCanAddedRuns`) — A8's handshake,
  failing closed. Until the owner deploys the Worker the switch simply is not there.
- **"Best", not "PB"** — his vocabulary from the club profile (notes/inte-club.md): a PB is a race time he
  types in; a best is the quickest the app measured. The Logbook button that promised "Personal bests &
  trends" now reads "Best times & fitness" (Performance has no trends).

## The rules, and where they live

- **One record shape.** `buildManualRun` returns a subset of `liveRunRecord`'s fields with `manual: true`.
  Not measured = null: route, splits, elevation, heart rate, cadence — and `pband/pwin/pmix` even when
  linked (one typed time for the whole outing; nothing to judge). `steps` and `rband` ARE stamped when
  linked, so the debrief shows what the session asked for and the effort comparison works.
  `anchor` and `pmodel` are always set (the wrist does the same).
- ⚠️ **The id is `man-<ms>`, never `run-<ms>`.** `runStartExactMs` reads a `run-` id as the instant the run
  began. `startMs` is set only from a time the runner typed, built with LOCAL date parts on purpose.
- **The third commit point is `saveManualRun`.** Same order as the phone: `shoeCreditRun` BEFORE storing,
  insert, `saveRuns()`, link + tick, `clubMaybeAutoPost`, Strava only if switched on (`stravaSendRun`,
  never `stravaMaybeAutoSend`), `maybeTrainingFlags()`. Deliberately absent, by name: `healthSendRun`,
  `maybeAutoPaceCalibrate`, `assessFitnessFromRun`.
- ⚠️ **Inserted in date order, not unshifted.** `state.logged[0]` is read as "the latest run" (club story,
  newest flags evidence, top of Recent runs). The 50-run cap trims by position, so a hand-added run older
  than the 50 newest keeps its history row but drops out of `interun_runs` on the next launch.
- **History rows gain `x`** (`runOriginOf`): `manual`, `sim`, `indoor`, `nogps`. Absent = measured outdoors
  — or recorded before the flag existed: rows whose run had already aged out can never gain one. A manual
  row omits `e` rather than writing a climb of 0 m. `liveRunRecord` now writes `nogps` for a GPS-refused
  outdoor run (the other half of the `indoor` pair it already refused).
- **Never a pace judgement:** `runVerdict` has a manual branch ("Added by hand") after the pain check;
  `flagObservations` SKIPS an unlinked manual run (`continue` — it used to be the walk's stopping point) and
  feeds a linked one as effort evidence only (pace fields null); the weekly review, `progressSnapshot` and
  `rdTrendsHtml` leave typed paces out.

## Links (`interun_link_v1`, `LINK_KEY`)

- `{ runId: { sid, wk, iso, was? } }`. Written by all THREE commit points (the phone and the wrist now link
  their planned session too), by "Link it", and removed by `deleteRun` (Undo restores it) and Unlink.
- `seedDone` replays every link through `tickSession` → `planSessionRef(iso, sid)`: the PLAN week holding
  the date, then the id inside it — so a session dragged to another day of the same week stays ticked.
- ⚠️ **Never pruned in seedDone.** No undo snapshot includes this store, so a prune in a function every
  rebuild calls would be a permanent deletion caused by a plan change. Unmatched links are inert.
- `untickSession` only removes ticks for today or later (seedDone ticks every earlier day whether it was
  run or not) and never while another run still links the session.
- A link made after the fact keeps `was` (type, steps, rband, pband, pwin, pmix) so Unlink restores the
  run exactly. A recorded free run linked later gets the session's pace band (it has kilometres to judge);
  a hand-added one never does.

## Best times (`src/progress/records.ts`, on RC as `runBests` / `newBest` / `BEST_DISTANCES`)

- 5 km, 5 mi, 10 km, 10 mi, half, marathon; a run counts within 3% of a distance (the club chips' own rule;
  the 1e-9 in `bestDistanceOf` is floating point, not leniency); the run's own time, never scaled.
- Refused: any `origin` flag, and anything quicker than 2:30/km (a GPS fault, not a run).
- Ties go to the earlier run. `newBest` needs a prior best to beat — a first is not a record (A6's rule).
- `commBests` (the Inte-Club chips) now calls `RC.runBests` — one definition. It also stopped counting
  simulated, hand-added, treadmill and no-GPS runs, which it used to.
- The "New best" toast (`runBestToast`) is called at the phone's and the wrist's save points only — never
  from `syncHist`, whose first pass back-fills fifty runs.
- Performance shows a typed race PB as "PB · A race time you entered", and beside a measured best as
  "race PB 21:04". A row opens its run only while the run is still in the 50-run store.

## Five faults B1 found (all fixed, all guarded)

1. **A run finished today was unticked by the next launch.** `state.done` is rebuilt from scratch by
   `seedDone`; today's tick lived in memory only. Fixed by the link replay.
2. **The phone ticked a session only in `PLAN.weeks[0]` — week one of the plan** (matched on day name and
   title). From the second week of any plan a finished phone run ticked nothing. Fixed: `plannedSessionIso`
   + `tickSession` by id, and a link.
3. **"Done for today" could never show.** `todayDecision` asked `doneKey(week, sess)` of a RAW session,
   which has no `.day`, so the key was `n|undefined|title`. Fixed with `rawSessionDone`, and only on the real
   today — on a past day a tick means "in the past", not "logged".
4. **"Post every run" never posted a phone run.** `clubMaybeAutoPost` was only in `ingestWatchRun`, whose
   comment wrongly called it "the one place both arrive". Added to `saveLiveSession` (and the hand-added
   path), with a `run.sim` refusal now the demo's simulator can reach it.
5. **The hero of every run without a route was a blank grey box** (found in the browser, not by mapping).
   `.rd-mapin` starts at opacity 0 and only `wire()`'s map path adds `ov-ready`, so "Indoor session", "Map
   hidden", "No route recorded" — and now "Added by hand" — sat in the page invisible. `rdHeroHtml` marks
   the panel ready at once when there is no map to wait for; a run WITH a route still waits for its map.

## Tests

- `test/run-bests.test.ts` — the engine rules.
- `test/manual-runs.test.ts` — 27 tests driving the real lifted functions: the record, validation, the
  commit point and its hooks, date order, the single write of `interun_runs`, the relaunch replay, the
  in-week drag, the phone's week, Done for today, delete/undo, link candidates, link/unlink restoring
  exactly, the flags walk, the verdict, best times, the toast, the `x` flags, the no-route hero, every new
  control wired, and the Strava gates.
- Updated to know the third commit point: `community` (grid hook once per commit point), `contrast`
  (shoe credit), `strava-connect` (a fourth accounted send path; every payload shape carries external_id),
  `watch-recommended` (buildManualRun is a third record builder; Source row), `run-history` (lift list),
  `strength-strava` (the Worker's two attributions and `origins` on every status reply), `watch-route-thinning`
  (its hand-written stub list), `post-run-card` (the work-pace wiring, restated for the typed-pace exclusion).
- 36 of 36 re-breaks caught (scratchpad harness: copy aside, unique anchor, rebuild, run, restore by sha).
