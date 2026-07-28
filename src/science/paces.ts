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
 * A band expressed as a multiple of threshold pace.
 *
 * The aerobic gears used to be fixed second-per-kilometre offsets from threshold (+92 for easy, +35
 * for steady, and so on). That does not describe how the gears really spread: the same +92 s/km is
 * a 50% slowdown for a 14-minute 5 km runner and a 16% slowdown for a 45-minute one. Measured
 * against Daniels' tables the honest figure for easy is about 1.22–1.30× threshold at every level.
 *
 * The practical consequence of getting it wrong ran in both directions: fast runners were told to
 * jog absurdly slowly, and beginners — the people who most need permission to go easy — were given
 * an "easy" pace only 16% off their threshold, which is not easy at all.
 */
/**
 * The aerobic gears as multiples of threshold pace.
 *
 * Exported because the app also needs to run this model BACKWARDS — given the average pace of an
 * easy run, what threshold pace (and so what 5 km) does it imply? That inverse used to be written
 * out longhand as `avgPace - 92`, which silently became wrong the moment the forward model stopped
 * being additive: a 16:00 5 km runner completing their easy run exactly on target was inferred to
 * be a 13:14 runner, and a 40:00 runner a 43:51 one. Both wrong by enough to trigger a spurious
 * "your fitness has changed" prompt. One table, both directions.
 */
export const PACE_RATIOS = {
  easy: { fast: 1.22, slow: 1.33 },
  aerobic: { fast: 1.13, slow: 1.2 },
  steady: { fast: 1.06, slow: 1.12 },
  tempo: { fast: 1.025, slow: 1.05 },
} as const;

/** The mid-band multiple for a gear — the factor to divide by when inverting. */
export function paceRatioMid(gear: keyof typeof PACE_RATIOS): number {
  const r = PACE_RATIOS[gear];
  return (r.fast + r.slow) / 2;
}

function ratioBand(thresholdPace: number, fast: number, slow: number): PaceRange {
  return {
    minSecPerKm: Math.round(thresholdPace * fast),
    maxSecPerKm: Math.round(thresholdPace * slow),
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
 *  - the aerobic gears are MULTIPLES of threshold, not fixed offsets: easy 1.22–1.33×, moderate
 *    1.13–1.20×, steady 1.06–1.12×, true tempo 1.025–1.05×. See PACE_RATIOS for why.
 */
export function deriveTrainingPaces(recent: RecentPerformance, goal?: Goal): TrainingPaces {
  const thresholdPace = predictedPaceFor(recent, 15000);
  const pace3k = predictedPaceFor(recent, 3000);
  const pace5k = predictedPaceFor(recent, 5000);
  const paceMile = predictedPaceFor(recent, RACE_DISTANCES_M["1mile"]);

  const pace8k = predictedPaceFor(recent, 8000);

  // Ratios to threshold, constant across the ability range (see ratioBand).
  const easy = ratioBand(thresholdPace, PACE_RATIOS.easy.fast, PACE_RATIOS.easy.slow);
  // "Moderate" — between easy and steady, which otherwise leave a hole no session can target.
  const aerobic = ratioBand(thresholdPace, PACE_RATIOS.aerobic.fast, PACE_RATIOS.aerobic.slow);
  const steady = ratioBand(thresholdPace, PACE_RATIOS.steady.fast, PACE_RATIOS.steady.slow);
  // True tempo — a shade under threshold, holdable for the best part of an hour.
  const tempo = ratioBand(thresholdPace, PACE_RATIOS.tempo.fast, PACE_RATIOS.tempo.slow);
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
 * Fold a MAS-derived VO2 band into an existing set of paces without breaking the ladder.
 *
 * A 1 km time trial is the sharpest input the app has for interval pace, so it is worth using — but
 * it is a single hard effort and it can be poor: mispaced, into a headwind, on a bad day. The old
 * code replaced `paces.vo2` outright, so a runner with an 18:00 5 km who trialled 4:15 was handed
 * VO2 "intervals" at 4:15–4:31/km, SLOWER than their own threshold of 3:46–3:59. Measured across
 * realistic (5 km, 1 km) pairs, 27 of 63 produced a ladder in the wrong order.
 *
 * VO2 pace must stay strictly between rep pace and critical velocity. The trial moves it inside
 * that corridor; it cannot move it out.
 */
export function reconcileVo2(paces: TrainingPaces, masVo2: PaceRange): PaceRange {
  const floor = paces.rep.minSecPerKm + 1;        // never faster than rep pace
  const ceil = paces.cv.minSecPerKm - 1;          // its fast edge stays quicker than CV
  const tail = paces.threshold.minSecPerKm - 1;   // its slow edge stays quicker than threshold
  if (ceil <= floor) return paces.vo2;            // no room — the race-derived band stands

  const width = Math.max(6, masVo2.maxSecPerKm - masVo2.minSecPerKm);
  const min = Math.min(Math.max(masVo2.minSecPerKm, floor), ceil);
  const out = { minSecPerKm: Math.round(min), maxSecPerKm: Math.round(Math.min(min + width, tail)) };
  // A trial can sharpen the interval pace or leave it alone. It must never BLUNT it: if the effort
  // was poor enough that reconciling it lands slower than the athlete's own race times already
  // imply, the race is the better evidence and the derived band stands.
  return out.minSecPerKm >= paces.vo2.minSecPerKm ? paces.vo2 : out;
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
