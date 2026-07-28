// Pace and zone derivation. All paces in seconds-per-kilometre.
//
// Equivalent race times use Riegel's endurance model  T2 = T1 * (D2/D1)^1.06  — a widely used,
// non-proprietary formula. Training paces are computed from the athlete's own predicted race paces
// at reference distances, then cross-checked against the RPE anchors in the research brief
// (easy RPE 2–3, threshold RPE 6–7, VO2 RPE 8–9). No proprietary pace tables are reproduced.

import type {
  Athlete,
  Goal,
  HrZone,
  PaceRange,
  RaceDistanceKey,
  RecentPerformance,
  TrainingPaces,
} from "../domain/types.ts";
import { paceSecPerKm, RACE_DISTANCES_M, timeForDistance } from "../domain/units.ts";

export const RIEGEL_EXPONENT = 1.06;

/** Predict the time (s) to cover `targetMeters` from a known `distanceMeters`/`timeSeconds` effort. */
export function riegelPredict(
  distanceMeters: number,
  timeSeconds: number,
  targetMeters: number,
): number {
  if (distanceMeters <= 0 || timeSeconds <= 0 || targetMeters <= 0) {
    throw new Error("riegelPredict requires positive inputs");
  }
  return timeSeconds * (targetMeters / distanceMeters) ** RIEGEL_EXPONENT;
}

/** Predicted race time (s) for a standard distance from a recent performance. */
export function predictRaceTime(recent: RecentPerformance, target: RaceDistanceKey): number {
  return riegelPredict(recent.distanceMeters, recent.timeSeconds, RACE_DISTANCES_M[target]);
}

export function predictAllRaceTimes(recent: RecentPerformance): Record<RaceDistanceKey, number> {
  const keys = Object.keys(RACE_DISTANCES_M) as RaceDistanceKey[];
  const out = {} as Record<RaceDistanceKey, number>;
  for (const k of keys) out[k] = predictRaceTime(recent, k);
  return out;
}

/** Predicted pace (s/km) for covering `metres` at the athlete's current fitness. */
function predictedPaceFor(recent: RecentPerformance, metres: number): number {
  return paceSecPerKm(riegelPredict(recent.distanceMeters, recent.timeSeconds, metres), metres);
}

function band(center: number, minusFast: number, plusSlow: number): PaceRange {
  return {
    minSecPerKm: Math.round(center - minusFast),
    maxSecPerKm: Math.round(center + plusSlow),
  };
}

/**
 * Derive training paces from a recent performance.
 *
 * Anchors (all from the athlete's own Riegel-predicted paces):
 *  - threshold ≈ the pace sustainable for ~1 hour, approximated by the predicted 15 km pace
 *    (a robust critical-speed proxy across abilities), RPE 6–7.
 *  - VO2 ≈ 3–5 km race pace, RPE 8–9.
 *  - rep/strides ≈ around mile pace.
 *  - easy ≈ threshold + ~75–110 s/km (conversational, RPE 2–3).
 *  - steady/"marathon" ≈ threshold + ~25–45 s/km.
 */
export function deriveTrainingPaces(recent: RecentPerformance, goal?: Goal): TrainingPaces {
  const thresholdPace = predictedPaceFor(recent, 15000);
  const pace3k = predictedPaceFor(recent, 3000);
  const pace5k = predictedPaceFor(recent, 5000);
  const paceMile = predictedPaceFor(recent, RACE_DISTANCES_M["1mile"]);

  const pace8k = predictedPaceFor(recent, 8000);

  const easy = band(thresholdPace + 92, 17, 18); // ~ +75..+110 s/km
  // "Moderate" — between easy and steady, which otherwise leave a ~30 s/km hole no session can use.
  const aerobic = band(thresholdPace + 60, 10, 10);
  const steady = band(thresholdPace + 35, 10, 10); // ~ +25..+45 s/km
  // True tempo — a shade under threshold, holdable for the best part of an hour.
  const tempo = band(thresholdPace + 18, 6, 7);
  const threshold = band(thresholdPace, 5, 8);
  // Critical velocity — the pace sustainable for roughly half an hour, which for a trained runner
  // is close to 8 km pace. It sits midway between threshold and VO2 rather than hugging threshold,
  // so a session that contrasts a threshold block with a CV block is a real change of gear.
  const cv = band(pace8k, 4, 5);
  const vo2: PaceRange = {
    minSecPerKm: Math.round(pace3k - 3),
    maxSecPerKm: Math.round(pace5k + 2),
  };
  const rep = band(paceMile, 8, 4);

  let goalRace: PaceRange;
  if (goal) {
    const goalPace = paceSecPerKm(goal.targetTimeSeconds, RACE_DISTANCES_M[goal.distance]);
    goalRace = band(goalPace, 3, 3);
  } else {
    goalRace = band(thresholdPace + 8, 4, 4);
  }

  return {
    easy,
    aerobic,
    steady,
    tempo,
    threshold,
    cv,
    vo2,
    rep,
    goalRace,
    predictedRaceTimes: predictAllRaceTimes(recent),
  };
}

/**
 * Estimate HR zones from max HR (and resting HR when available, via the heart-rate-reserve /
 * Karvonen method). Secondary anchor only — the research brief cautions against treating any single
 * "Zone 2" number as uniquely correct; paces + RPE lead, HR confirms.
 */
export function estimateHrZones(maxHr: number, restingHr?: number): HrZone[] {
  const defs: Array<{ zone: number; label: string; lo: number; hi: number }> = [
    { zone: 1, label: "Recovery", lo: 0.5, hi: 0.6 },
    { zone: 2, label: "Easy / aerobic", lo: 0.6, hi: 0.7 },
    { zone: 3, label: "Steady / tempo", lo: 0.7, hi: 0.8 },
    { zone: 4, label: "Threshold", lo: 0.8, hi: 0.9 },
    { zone: 5, label: "VO2 / max", lo: 0.9, hi: 1.0 },
  ];
  const at = (frac: number) =>
    restingHr && restingHr > 0
      ? Math.round(restingHr + frac * (maxHr - restingHr))
      : Math.round(frac * maxHr);
  return defs.map((d) => ({ zone: d.zone, label: d.label, minBpm: at(d.lo), maxBpm: at(d.hi) }));
}

/** Pace (s/km) implied by a goal, for convenience in the UI/demo. */
export function goalPace(goal: Goal): number {
  return paceSecPerKm(goal.targetTimeSeconds, RACE_DISTANCES_M[goal.distance]);
}

/** Time (s) at a given pace over a distance — small re-export for call sites that only import paces. */
export const timeAtPace = timeForDistance;

/** Attach HR zones to an existing pace set when the athlete provides a max HR. */
export function withHrZones(paces: TrainingPaces, athlete: Athlete): TrainingPaces {
  if (!athlete.maxHr) return paces;
  return { ...paces, hrZones: estimateHrZones(athlete.maxHr, athlete.restingHr) };
}
