// Training-intensity distribution (TID).
//
// The research brief and its cited meta-analyses (PubMed 40878015 and the 2026 Bayesian network
// meta-analysis) find no single superior model: pyramidal and polarized both work, with
// individualisation mattering more than hitting an exact 80/20 split. So pyramidal is the default
// (most easy, less moderate, least hard — the distribution used by >80% of the fastest marathoners),
// polarized is offered for competitive athletes, and validation uses a tolerance band rather than a
// hard target.

import type { Athlete, IntensityBucket, IntensityModel, Session, WorkoutStep } from "../domain/types.ts";

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

/**
 * Which bucket a single step's running time belongs in.
 *
 * A quality session is not uniformly hard: a 55-minute threshold session is a 15-minute easy
 * warm-up, half an hour of work interleaved with easy jog recoveries, and a 10-minute easy
 * cool-down. Charging the whole 55 minutes to "moderate" overstates the week's intensity by a wide
 * margin — enough, measured, to put a five-day build week under the pyramidal easy floor purely as
 * an accounting artefact. Warm-ups, cool-downs and recoveries are easy running and are counted as
 * such; only the work itself carries the session's intensity.
 */
function stepBucket(
  step: WorkoutStep,
  sessionIntensity: Exclude<IntensityBucket, "none">,
  sessionType?: string,
) {
  if (step.kind === "warmup" || step.kind === "cooldown" || step.kind === "recovery") return "easy";
  // Kind alone is not enough. The jog between two blocks of a compound session is written as a
  // "steady" step (deliberately — it is what stops the detail sheet merging the blocks into one
  // row), so bucketing purely by kind charged easy running to the quality bucket. Effort is the
  // honest signal: anything prescribed at RPE 3 or below is easy running, whatever it is called.
  if (step.targetRpe && step.targetRpe.max <= 3) return "easy";
  // ⚠️ LONG RUNS bucket their work by the STEP's own effort, not the session's. A long run is an
  // "easy" session, and charging every step to the session made all race-pace work inside one
  // invisible: a 44-minute marathon-pace block counted as easy running, identical work inside a
  // race-specific session counted moderate, and the easy-floor sweep was structurally incapable of
  // failing however big a dose was added — measured, the "guard" reported zero change while
  // honest bucketing showed +27% under-floor weeks. Same trap CLAUDE.md records twice: a guard
  // blind to the new input is not a guard. The aerobic gear (RPE 3–4) stays easy by the documented
  // house convention above; RPE 4+ work is moderate wherever it lives.
  if (sessionType === "long" && step.targetRpe && step.targetRpe.min >= 4) return "moderate";
  return sessionIntensity;
}

/** A short effort with no pace target is run flat out; ~4 m/s is a fair figure for a hill sprint. */
const EFFORT_ONLY_MPS = 4;

function stepSeconds(step: WorkoutStep): number {
  if (step.durationSeconds) return step.durationSeconds;
  if (step.distanceMeters && step.targetPaceSecPerKm) {
    const mid = (step.targetPaceSecPerKm.minSecPerKm + step.targetPaceSecPerKm.maxSecPerKm) / 2;
    return (step.distanceMeters / 1000) * mid;
  }
  // Effort-only work given in metres — a hill sprint. It carries no pace ON PURPOSE (pace up a hill
  // is a function of the gradient), but returning 0 made it vanish from the accounting entirely, so
  // a maximal hill session reported as 100% easy. An estimate is far better than a silent zero.
  if (step.distanceMeters) return step.distanceMeters / EFFORT_ONLY_MPS;
  return 0;
}

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
    const steps = s.steps ?? [];
    // Step-level accounting when the session has a structure; whole-session otherwise (a plain easy
    // run built without steps is uniformly easy anyway, so the two agree).
    const counted = steps.reduce((n, st) => n + stepSeconds(st), 0);
    if (steps.length > 0 && counted > 0) {
      // Scale to the session's own estimate so rounding in the step maths cannot invent or lose time.
      const scale = s.estimatedDurationSeconds / counted;
      for (const st of steps) totals[stepBucket(st, s.intensity, s.type)] += stepSeconds(st) * scale;
      continue;
    }
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
