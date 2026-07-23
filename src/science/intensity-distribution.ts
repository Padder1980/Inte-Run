// Training-intensity distribution (TID).
//
// The research brief and its cited meta-analyses (PubMed 40878015 and the 2026 Bayesian network
// meta-analysis) find no single superior model: pyramidal and polarized both work, with
// individualisation mattering more than hitting an exact 80/20 split. So pyramidal is the default
// (most easy, less moderate, least hard — the distribution used by >80% of the fastest marathoners),
// polarized is offered for competitive athletes, and validation uses a tolerance band rather than a
// hard target.

import type { Athlete, IntensityBucket, IntensityModel, Session } from "../domain/types.ts";

export type DistributionTarget = { easy: number; moderate: number; hard: number };

export const TID_TARGETS: Record<IntensityModel, DistributionTarget> = {
  // Fractions of *running* time. Approximate, not dogmatic.
  pyramidal: { easy: 0.8, moderate: 0.15, hard: 0.05 },
  polarized: { easy: 0.8, moderate: 0.05, hard: 0.15 },
};

/** Tolerance (absolute fraction) within which a plan is considered to honour a model. */
export const TID_TOLERANCE = 0.12;

/** Pick the default model: pyramidal for everyone, unless a competitive athlete opts into polarized. */
export function chooseModel(athlete: Athlete): IntensityModel {
  // Pyramidal is the evidence-based default and the recommended structure when returning from a
  // lay-off (the brief calls it "the strongest starting point during your return"). Only established
  // competitive athletes who are *not* currently returning default to polarized.
  if (athlete.returningFromInjury) return "pyramidal";
  return athlete.experience === "competitive" ? "polarized" : "pyramidal";
}

/** Which sessions count toward TID (running only — strength/mobility/rest are excluded). */
export function countsTowardTid(session: Session): boolean {
  return session.intensity !== "none" && session.type !== "cross-training";
}

export type Distribution = { easy: number; moderate: number; hard: number; totalSeconds: number };

/** Distribution of running time across intensity buckets for a set of sessions. */
export function computeDistribution(sessions: Session[]): Distribution {
  const totals: Record<Exclude<IntensityBucket, "none">, number> = {
    easy: 0,
    moderate: 0,
    hard: 0,
  };
  for (const s of sessions) {
    if (!countsTowardTid(s)) continue;
    if (s.intensity === "none") continue;
    totals[s.intensity] += s.estimatedDurationSeconds;
  }
  const totalSeconds = totals.easy + totals.moderate + totals.hard;
  if (totalSeconds === 0) return { easy: 0, moderate: 0, hard: 0, totalSeconds: 0 };
  return {
    easy: totals.easy / totalSeconds,
    moderate: totals.moderate / totalSeconds,
    hard: totals.hard / totalSeconds,
    totalSeconds,
  };
}

/** True when `actual` sits within tolerance of the model's easy-fraction target (the load-bearing one). */
export function honoursModel(
  actual: Distribution,
  model: IntensityModel,
  tolerance = TID_TOLERANCE,
): boolean {
  const target = TID_TARGETS[model];
  // Easy fraction is the primary guard against too much moderate/hard fatigue.
  return actual.easy >= target.easy - tolerance;
}
