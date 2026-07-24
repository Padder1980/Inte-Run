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
  /** A recent maximal short sprint speed (m/s), e.g. from a flying 40 m — enables speed reserve. */
  maxSprintSpeedMps?: number;
  /** Pace/HR decoupling (%) over a recent long run — enables a durability read. */
  longRunDecouplingPct?: number;
};

export type FitnessProfile = {
  criticalSpeed?: CriticalSpeedModel;
  aerobicCapacity: Estimate;
  thresholdSpeed: Estimate;
  speedReserve: Estimate;
  durability: Estimate;
  economy: Estimate;
  trainingTolerance: Estimate;
  summary: string;
};

/**
 * Velocity (m/s) sustainable for ~6 min — a practical proxy for velocity at VO₂max. Derived by
 * Riegel-projecting the athlete's *fastest* effort to a 6-minute effort. We deliberately do NOT
 * extrapolate the critical-speed line down to 6 min: with closely-spaced efforts that overshoots.
 */
function vAtVo2max(input: FitnessInput): number {
  const fastest = input.efforts.reduce((best, e) =>
    e.distanceMeters / e.timeSeconds > best.distanceMeters / best.timeSeconds ? e : best,
  );
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

  // --- Threshold / critical speed ---
  let thresholdSpeed: Estimate;
  if (haveModel) {
    const pace = model!.csPaceSecPerKm;
    thresholdSpeed = {
      metric: "Threshold / critical speed",
      value: pace,
      low: Math.round(pace * 0.98),
      high: Math.round(pace * 1.02),
      unit: "s/km",
      confidence: model!.confidence,
      method: `Critical-speed model from ${model!.nEfforts} efforts (R²=${model!.rSquared})`,
      evidence: "Slope of distance vs time across your efforts.",
      limitations: model!.limitations ?? "CS sits near, but not exactly at, your lactate/ventilatory threshold.",
    };
  } else {
    // Single-effort proxy: pace sustainable for a ~40-minute effort, via Riegel — a rough threshold stand-in.
    const e = input.efforts[0]!;
    const d40 = solveDistanceForTime(e.distanceMeters, e.timeSeconds, 2400);
    const paceThresh = Math.round(2400 / (d40 / 1000));
    thresholdSpeed = {
      metric: "Threshold / critical speed",
      value: paceThresh,
      low: Math.round(paceThresh * 0.97),
      high: Math.round(paceThresh * 1.03),
      unit: "s/km",
      confidence: "low",
      method: "Riegel projection from a single effort (no critical-speed model yet)",
      evidence: "One recent effort.",
      limitations: "Add a second effort of a different duration to compute true critical speed.",
    };
  }

  // --- Speed reserve (anaerobic speed reserve) ---
  let speedReserve: Estimate;
  if (input.maxSprintSpeedMps && input.maxSprintSpeedMps > v) {
    const asr = input.maxSprintSpeedMps - v;
    speedReserve = {
      metric: "Speed reserve",
      value: Math.round(asr * 100) / 100,
      low: Math.round((asr - 0.3) * 100) / 100,
      high: Math.round((asr + 0.3) * 100) / 100,
      unit: "m/s above vVO₂max",
      confidence: "low",
      method: "Max sprint speed minus velocity at VO₂max",
      evidence: "Your reported maximal short-sprint speed.",
      limitations: "From a single sprint; a bigger reserve favours faster finishing and short intervals.",
    };
  } else {
    speedReserve = unknownEstimate(
      "Speed reserve",
      "m/s above vVO₂max",
      "Max sprint speed minus velocity at VO₂max",
      "Add a maximal short sprint (e.g. a flying 40 m) to estimate this.",
    );
  }

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

  // --- Economy: not estimable from times alone. Say so. ---
  const economy = unknownEstimate(
    "Running economy",
    "ml/kg/km",
    "Requires lab metabolic testing or running-power data",
    "Can't be estimated from race times — it needs a lab or a running-power meter. The evidence here is simply absent for now.",
  );

  // --- Training tolerance: emerges from logged history, not a one-off input. ---
  const trainingTolerance = unknownEstimate(
    "Training tolerance",
    "relative",
    "Emerges from logged sessions, RPE and readiness over time",
    "Builds up as you log training — a single snapshot can't capture how you absorb load.",
  );

  const estimated = [aerobicCapacity, thresholdSpeed, speedReserve, durability, economy, trainingTolerance]
    .filter((e) => e.confidence !== "none").length;
  const summary =
    `${estimated} of 6 dimensions estimated from what you've entered` +
    (haveModel ? ", including a critical-speed model." : ". Add a second effort of a different duration to unlock critical speed.");

  return {
    criticalSpeed: model,
    aerobicCapacity,
    thresholdSpeed,
    speedReserve,
    durability,
    economy,
    trainingTolerance,
    summary,
  };
}
