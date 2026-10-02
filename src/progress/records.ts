// Best times — the runner's quickest recorded run at each classic distance (stage B1, 2026-10-02).
//
// ⚠️ ONE DEFINITION FOR THE WHOLE APP. The Inte-Club profile's "Best" chips and the Performance
// screen's Best times card both read this module, so two screens can never quote two different times
// for one distance. The rule is the one the club chips already shipped with (notes/inte-club.md): a
// run counts for a distance when its whole measured length is within 3% of it — "a 5.4 km run is not
// a 5 km time" — and the time shown is the run's own time, never scaled to the distance.
//
// ⚠️ "BEST", NOT "PB". A personal best is a race result the runner types in themselves (the club
// profile's wheels); this is the quickest the app has MEASURED them covering about that far, training
// runs included. The app labels the two differently, and this module only ever produces the second.
//
// ⚠️ ONLY A MEASURED DISTANCE COUNTS. A run carrying an origin flag — added by hand, a treadmill, an
// outdoor run without GPS, a simulated run — has a distance somebody typed, a machine reported or the
// app invented, so it can never set a best. No flag means "measured outdoors".
//
// ⚠️ THE ENGINE NEVER MOVES A PACE ON THE STRENGTH OF A BEST. Nothing here reads or writes the plan's
// anchor; a quicker 5 km is something the app may mention, and the runner decides what it means.

export type BestDistanceId = "5k" | "5mi" | "10k" | "10mi" | "half" | "marathon";

export type BestDistance = { id: BestDistanceId; label: string; short: string; km: number };

/** In the order a runner reads them, shortest first. The mile distances are exact. */
export const BEST_DISTANCES: readonly BestDistance[] = [
  { id: "5k", label: "5 km", short: "5 km", km: 5 },
  { id: "5mi", label: "5 miles", short: "5 mi", km: 8.04672 },
  { id: "10k", label: "10 km", short: "10 km", km: 10 },
  { id: "10mi", label: "10 miles", short: "10 mi", km: 16.09344 },
  { id: "half", label: "Half marathon", short: "Half", km: 21.0975 },
  { id: "marathon", label: "Marathon", short: "Marathon", km: 42.195 },
];

/** How far a run's measured length may sit from a distance and still count for it. */
export const BEST_TOLERANCE = 0.03;

/**
 * Quicker than this per kilometre is a GPS fault, not a run: 2:30/km is faster than the 5 km world
 * record, so nothing a runner can do lands below it. A best is the one number the app volunteers
 * ("New best"), which is why it is the one place a glitch is refused rather than shown.
 */
export const BEST_FASTEST_SEC_PER_KM = 150;

/** One run, as the history keeps it. `origin` is the history row's `x`: absent = measured outdoors. */
export type BestRun = { id: string; dateIso: string; km: number; sec: number; origin?: string | null };

export type RunBest = {
  distance: BestDistanceId;
  label: string;
  short: string;
  sec: number;
  /** The run's own measured length, so a screen can say what the time was actually run over. */
  km: number;
  runId: string;
  dateIso: string;
};

export type NewBest = {
  distance: BestDistanceId;
  label: string;
  short: string;
  sec: number;
  previousSec: number;
  previousDateIso: string;
};

/** May this run set a best at all? Measured, positive, and physically possible. */
export function bestEligible(r: BestRun | null | undefined): boolean {
  if (!r || r.origin) return false;
  const km = Number(r.km), sec = Number(r.sec);
  if (!isFinite(km) || !isFinite(sec) || !(km > 0) || !(sec > 0)) return false;
  return sec / km >= BEST_FASTEST_SEC_PER_KM;
}

/**
 * The distance a run counts for, or null. The windows do not overlap (5 km ends at 5.15, 5 miles
 * starts at 7.81, and so on up), so a run can count for one distance at most.
 */
export function bestDistanceOf(km: number): BestDistance | null {
  const k = Number(km);
  if (!(k > 0)) return null;
  // ⚠️ THE 1e-9 IS FLOATING POINT, NOT LENIENCY. |5.15 - 5| / 5 is 0.030000000000000072 in a double, so
  // without it a run of exactly 3% over — the edge the rule names — fell outside it.
  for (const d of BEST_DISTANCES) if (Math.abs(k - d.km) <= d.km * BEST_TOLERANCE + 1e-9) return d;
  return null;
}

/**
 * The quickest eligible run at each distance, in BEST_DISTANCES order; a distance nobody has run is
 * absent, never a zero.
 * ⚠️ A TIE GOES TO THE EARLIER RUN. The first runner to clock a time holds it; equalling it later is
 * not beating it, and the record should not move to the newer date.
 */
export function runBests(runs: readonly BestRun[]): RunBest[] {
  const best = new Map<BestDistanceId, RunBest>();
  for (const r of runs || []) {
    if (!bestEligible(r)) continue;
    const d = bestDistanceOf(r.km);
    if (!d) continue;
    const sec = Math.round(Number(r.sec));
    const iso = String(r.dateIso || "");
    const cur = best.get(d.id);
    if (!cur || sec < cur.sec || (sec === cur.sec && iso < cur.dateIso)) {
      best.set(d.id, { distance: d.id, label: d.label, short: d.short, sec, km: Number(r.km), runId: String(r.id), dateIso: iso });
    }
  }
  return BEST_DISTANCES.map((d) => best.get(d.id)).filter((b): b is RunBest => !!b);
}

/**
 * Did this run just beat the runner's best at its distance? Compared against every OTHER run.
 *
 * ⚠️ A FIRST IS NOT A RECORD — the rule stage A6 set for lifts, for the same reason. The first 5 km a
 * runner ever records is "the quickest" by default, and congratulating it would teach them the message
 * means nothing. A best needs something to beat.
 * ⚠️ STRICTLY QUICKER. A tie is not a new best (see runBests).
 * ⚠️ CALLED ONLY WHERE A RUN IS SAVED, never over the stored history. Run over the history it would
 * announce every best a runner has ever set, all at once, the first time it shipped.
 */
export function newBest(prior: readonly BestRun[], run: BestRun): NewBest | null {
  if (!bestEligible(run)) return null;
  const d = bestDistanceOf(run.km);
  if (!d) return null;
  const before = runBests((prior || []).filter((r) => r && r.id !== run.id)).find((b) => b.distance === d.id);
  if (!before) return null;
  const sec = Math.round(Number(run.sec));
  if (!(sec < before.sec)) return null;
  return { distance: d.id, label: d.label, short: d.short, sec, previousSec: before.sec, previousDateIso: before.dateIso };
}
