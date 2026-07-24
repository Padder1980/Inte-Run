// Multi-dimensional fitness profile (brief §1 + §16). The brief is explicit: do NOT reduce fitness
// to one score. Track separate, evolving estimates — aerobic capacity, threshold / critical speed,
// speed reserve, durability, economy, training tolerance — each with a confidence range and its
// limitations, and say plainly where the evidence is absent rather than inventing a number.

import {
  type Estimate,
  rangeAround,
  unknownEstimate,
} from "./estimate.ts";
import {
  type CriticalSpeedModel,
  type Effort,
  fitCriticalSpeed,
} from "./critical-speed.ts";

export type FitnessInput = {
  /** One or more recent time trials / races. Two+ of differing duration unlock critical speed. */
  efforts: Effort[];
  /** Pace/HR decoupling (%) over a recent long run — enables a durability read. */
  longRunDecouplingPct?: number;
};

export type FitnessProfile = {
  criticalSpeed?: CriticalSpeedModel;
  aerobicCapacity: Estimate;
  thresholdSpeed: Estimate;
  durability: Estimate;
  trainingTolerance: Estimate;
  summary: string;
};

/** The athlete's fastest effort by average velocity — the best basis for short-duration projections. */
function fastestEffort(input: FitnessInput): Effort {
  return input.efforts.reduce((best, e) =>
    e.distanceMeters / e.timeSeconds > best.distanceMeters / best.timeSeconds ? e : best,
  );
}

/**
 * Velocity (m/s) sustainable for ~6 min — a practical proxy for velocity at VO₂max. Derived by
 * Riegel-projecting the athlete's *fastest* effort to a 6-minute effort. We deliberately do NOT
 * extrapolate the critical-speed line down to 6 min: with closely-spaced efforts that overshoots.
 */
function vAtVo2max(input: FitnessInput): number {
  const fastest = fastestEffort(input);
  return solveDistanceForTime(fastest.distanceMeters, fastest.timeSeconds, 360) / 360;
}

/** Invert Riegel to find the distance coverable in `targetTime` from one effort. */
function solveDistanceForTime(distanceMeters: number, timeSeconds: number, targetTime: number): number {
  // riegel: t2 = t1 · (d2/d1)^1.06  ⇒  d2 = d1 · (t2/t1)^(1/1.06)
  return distanceMeters * (targetTime / timeSeconds) ** (1 / 1.06);
}

/** ACSM level-running cost at velocity v (m/s), in ml/kg/min — used as a VO₂max proxy at vVO₂max. */
function acsmVo2(vMps: number): number {
  return 12 * vMps + 3.5; // 0.2·(v in m/min) + 3.5, with v·60 substituted
}

export function buildFitnessProfile(input: FitnessInput): FitnessProfile {
  if (input.efforts.length === 0) throw new Error("need at least one effort");

  let model: CriticalSpeedModel | undefined;
  if (input.efforts.length >= 2) {
    try {
      model = fitCriticalSpeed(input.efforts);
    } catch {
      model = undefined;
    }
  }
  const haveModel = model != null && model.criticalSpeedMps > 0;

  // --- Aerobic capacity (VO₂max) — always a range, never a point value. ---
  const v = vAtVo2max(input);
  const vo2 = acsmVo2(v);
  const aerobicConf = haveModel ? "moderate" : "low";
  const half = aerobicConf === "moderate" ? 2 : 4;
  const vo2Range = rangeAround(vo2, half);
  const aerobicCapacity: Estimate = {
    metric: "Aerobic capacity (VO₂max)",
    value: Math.round(vo2),
    low: Math.round(vo2Range.low),
    high: Math.round(vo2Range.high),
    unit: "ml/kg/min",
    confidence: aerobicConf,
    method: "ACSM running cost at a Riegel-projected 6-minute velocity (your fastest effort)",
    evidence: "Field estimate from your race efforts.",
    limitations: "Field/smartwatch VO₂max is less valid in highly trained runners — read the range, not the midpoint.",
  };

  // --- Threshold / "strong steady pace" ---
  // Pace sustainable for ~60 min (a practical threshold proxy), Riegel-projected from the fastest
  // effort. We deliberately do NOT use the critical-speed slope for this headline pace: with two
  // long efforts it underestimates and produces a pace slower than the runner's 10k, which is wrong.
  // The critical-speed model is still computed and surfaced as science detail.
  const fastest = fastestEffort(input);
  const d60 = solveDistanceForTime(fastest.distanceMeters, fastest.timeSeconds, 3600);
  const paceThresh = Math.round(3600 / (d60 / 1000));
  const threshConf = input.efforts.length >= 2 ? "moderate" : "low";
  const thresholdSpeed: Estimate = {
    metric: "Threshold / critical speed",
    value: paceThresh,
    low: Math.round(paceThresh * 0.98),
    high: Math.round(paceThresh * 1.02),
    unit: "s/km",
    confidence: threshConf,
    method: haveModel
      ? `Pace sustainable ~60 min (Riegel), alongside a ${model!.nEfforts}-effort critical-speed model`
      : "Pace sustainable ~60 min (Riegel projection)",
    evidence: "Your recent efforts.",
    limitations: "A practical threshold estimate; your true threshold shifts with training and conditions.",
  };

  // --- Durability ---
  let durability: Estimate;
  if (input.longRunDecouplingPct != null) {
    const d = input.longRunDecouplingPct;
    durability = {
      metric: "Durability",
      value: Math.round(d * 10) / 10,
      low: Math.max(0, Math.round((d - 2) * 10) / 10),
      high: Math.round((d + 2) * 10) / 10,
      unit: "% pace/HR decoupling",
      confidence: "low",
      method: "Pace/HR decoupling over a recent long run",
      evidence: "Your long-run split data.",
      limitations: "Lower decoupling (roughly <5%) suggests better durability; one run is a weak signal.",
    };
  } else {
    durability = unknownEstimate(
      "Durability",
      "% pace/HR decoupling",
      "Pace/HR decoupling over a long run",
      "Needs a long run with pace and heart-rate splits to estimate — it's how well you hold form when fatigued.",
    );
  }

  // --- Training tolerance: emerges from logged history, not a one-off input. ---
  const trainingTolerance = unknownEstimate(
    "Training tolerance",
    "relative",
    "Emerges from logged sessions, RPE and readiness over time",
    "Builds up as you log training — a single snapshot can't capture how you absorb load.",
  );

  const estimated = [aerobicCapacity, thresholdSpeed, durability, trainingTolerance]
    .filter((e) => e.confidence !== "none").length;
  const summary =
    `${estimated} of 4 dimensions estimated from what you've entered` +
    (haveModel ? ", including a critical-speed model." : ". Add a second effort of a different duration to unlock critical speed.");

  return {
    criticalSpeed: model,
    aerobicCapacity,
    thresholdSpeed,
    durability,
    trainingTolerance,
    summary,
  };
}
