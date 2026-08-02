/**
 * The 2 km time trial — protocol, validation, confidence and derived velocity.
 *
 * Replaces the 1 km trial on the advice of the owner's elite coach, specified in
 * `InteRun_2km_Time_Trial_Implementation_Specification.md`. Two kilometres is a materially better
 * calibration effort than one: long enough that pacing and aerobic capacity dominate rather than
 * raw speed, short enough to be repeatable, and far closer to the 5 km the whole plan is anchored
 * in — so projecting from it involves much less extrapolation.
 *
 * ⚠️ THIS MODULE DOES NOT DERIVE TRAINING PACES, AND MUST NOT.
 * The specification carries its own table of pace bands as percentages of 2 km velocity (its §9).
 * InteRun already has one — `PACE_RATIOS` in `paces.ts` — and building the spec's would create the
 * second competing source of truth its own instruction 4 forbids. They also already agree: fed the
 * same 2 km time, the existing derivation lands easy at 66.7–72.7% of trial velocity against the
 * spec's 65–75%, and threshold at 85.7–90.5% against its 84–90%. Same model, different coordinates,
 * because Riegel is a scale-free power law — the ratio of one distance's pace to another's depends
 * only on the distance ratio, never on ability. So the trial FEEDS the anchor and the existing
 * table does the rest. The one genuine gap the spec exposed, a missing recovery gear, was added to
 * `PACE_RATIOS` rather than alongside it.
 *
 * ⚠️ AND IT DOES NOT MEASURE VO2max, MAS OR LACTATE THRESHOLD. The spec is explicit (§8): a result
 * over ten minutes is a long sustained effort, not maximal aerobic speed — and 2 km at 5:00/km is
 * exactly ten minutes, so a large share of real runners land there. The honest name for what this
 * measures is "2 km performance velocity", and that is the only term the UI uses.
 */

import type { RaceDistanceKey } from "../domain/types.ts";

/**
 * Stamped onto every stored trial so a future change to these rules can be told apart from a
 * change in the runner. ⚠️ It records which VALIDATION and CONFIDENCE rules produced a record — it
 * is NOT a third pace-derivation stamp beside PACE_MODEL_VERSION and a run's `anchor`. Three
 * version stamps that must agree is precisely how they come to disagree.
 */
export const TWO_KM_MODEL_VERSION = "1.0.0";

export const TWO_KM_DISTANCE_M = 2000;

export type TwoKmTestEnvironment = "track" | "road" | "treadmill";
export type TwoKmValidationStatus = "valid" | "valid_with_caution" | "invalid";
export type TwoKmConfidence = "high" | "medium" | "low";

/**
 * Every threshold in one place — the spec's instruction 6. These are product guardrails, not
 * validated physiological boundaries, and the spec says so; keeping them together is what makes
 * them reviewable when real data arrives.
 */
export const TWO_KM_RULES = {
  /** Plausible finishing times. Below the floor is a mis-measured route; above the ceiling the
   *  effort is no longer the test the protocol describes. */
  minSeconds: 300,
  maxSeconds: 1200,
  /** Kilometre-split difference, as a percentage of the mean split. */
  evenSplitPct: 3,
  cautionSplitPct: 6,
  /** Reported effort, 0–10. Below the floor the runner did not finish at a maximal effort. */
  highRpe: 9,
  mediumRpe: 8,
  /** Over this, the effort is a long sustained one and must never be called maximal aerobic speed. */
  masCeilingSeconds: 600,
  /** How often a retest is worth offering, and the shortest gap that is not simply fatigue. */
  retestWeeks: { min: 4, max: 6 },
  /** A velocity change smaller than this is noise, not progress. */
  meaningfulChangePct: 1.5,
} as const;

export interface TwoKmTimeTrial {
  id: string;
  completedAt: string;
  elapsedSeconds: number;
  firstKmSeconds?: number;
  secondKmSeconds?: number;
  averageHeartRate?: number;
  maximumHeartRate?: number;
  rpe0To10?: number;
  environment: TwoKmTestEnvironment;
  elevationGainMetres?: number;
  gpsQuality?: "good" | "uncertain" | "poor";
  stoppedOrWalked: boolean;
  externalInterruption: boolean;
  painReported: boolean;
  illnessReported: boolean;
  hardSessionWithin48Hours?: boolean;
  athleteNotes?: string;
  modelVersion?: string;
}

export interface TwoKmValidation {
  status: TwoKmValidationStatus;
  confidence: TwoKmConfidence;
  /** Plain-English, runner-facing. Each one says what happened, not which rule fired. */
  reasons: string[];
  /** False for anything that must never move the runner's paces. */
  canSetBaseline: boolean;
}

/** Percentage difference between the two kilometre splits, relative to their mean. */
export function splitDifferencePercent(firstKmSeconds: number, secondKmSeconds: number): number {
  const mean = (firstKmSeconds + secondKmSeconds) / 2;
  if (!(mean > 0)) return 0;
  return (Math.abs(secondKmSeconds - firstKmSeconds) / mean) * 100;
}

/**
 * ⚠️ PERCENTAGES APPLY TO VELOCITY, NEVER TO PACE. Multiplying a pace by 0.7 makes it FASTER, which
 * is the exact opposite of "70% effort" — the spec calls this out (§6) and asks for a test that
 * fails any implementation that does it.
 *
 * ⚠️ That test must be scoped to THIS function. `ratioBand()` in paces.ts multiplies pace by 1.22
 * and 1.33 and is entirely correct, because those are pace ratios, not velocity fractions. A test
 * written mechanically against "never multiply pace by a fraction" would report a bug in the one
 * model CLAUDE.md most forbids touching.
 */
export function paceFromVelocityFraction(velocityMps: number, fraction: number): number {
  return 1000 / (velocityMps * fraction);
}

export function twoKmVelocityMps(elapsedSeconds: number): number {
  return TWO_KM_DISTANCE_M / elapsedSeconds;
}

export function twoKmPaceSecPerKm(elapsedSeconds: number): number {
  return elapsedSeconds / 2;
}

/** Percentage change in velocity between two trials. Positive means faster. */
export function velocityChangePercent(previousSeconds: number, currentSeconds: number): number {
  const prev = twoKmVelocityMps(previousSeconds), cur = twoKmVelocityMps(currentSeconds);
  if (!(prev > 0)) return 0;
  return ((cur - prev) / prev) * 100;
}

/**
 * Grade a trial (spec §7).
 *
 * ⚠️ Two separate questions, deliberately not merged: `status` is whether the effort was a valid
 * test at all, and `confidence` is how much to trust it if it was. A perfectly executed test in
 * uncertain GPS is valid but not high-confidence; a test with beautiful splits that the runner
 * walked in the middle of is not a test.
 */
export function validateTwoKmTest(t: TwoKmTimeTrial): TwoKmValidation {
  const reasons: string[] = [];

  // ---- Invalidating: the effort was not the test the protocol describes ----
  if (t.stoppedOrWalked) reasons.push("You stopped or walked during the effort, so this is not a continuous 2 km.");
  if (t.painReported) reasons.push("You reported pain, which comes before any training number.");
  if (t.illnessReported) reasons.push("You reported illness, so this does not reflect your fitness.");
  if (t.externalInterruption) reasons.push("Something interrupted the run, so the time is not a clean 2 km.");
  if (!(t.elapsedSeconds >= TWO_KM_RULES.minSeconds && t.elapsedSeconds <= TWO_KM_RULES.maxSeconds)) {
    reasons.push("That time is outside what a measured 2 km can plausibly be, so the route or the timing is probably off.");
  }
  if (t.firstKmSeconds !== undefined && t.secondKmSeconds !== undefined) {
    const sum = t.firstKmSeconds + t.secondKmSeconds;
    // The splits must roughly account for the whole thing, or one of the three numbers is wrong.
    if (Math.abs(sum - t.elapsedSeconds) > Math.max(5, t.elapsedSeconds * 0.04)) {
      reasons.push("Your two kilometre splits do not add up to your finishing time, so one of them was mis-recorded.");
    }
  }
  if (reasons.length) {
    return { status: "invalid", confidence: "low", reasons, canSetBaseline: false };
  }

  // ---- Valid. Now how much do we trust it? ----
  // ⚠️ Held on an object, not in a `let`. TypeScript narrows a local to its initialiser and cannot
  // see the closure below reassigning it, so `confidence === "low"` at the end was reported as a
  // comparison that could never be true — a compile error that was telling the truth about what the
  // checker could see, and a lie about what the code does.
  const grade: { confidence: TwoKmConfidence } = { confidence: "high" };
  const soften = (why: string, to: TwoKmConfidence) => {
    reasons.push(why);
    if (to === "low" || grade.confidence === "high") grade.confidence = to;
  };

  if (t.firstKmSeconds !== undefined && t.secondKmSeconds !== undefined) {
    const diff = splitDifferencePercent(t.firstKmSeconds, t.secondKmSeconds);
    if (diff > TWO_KM_RULES.cautionSplitPct) {
      soften("Your two kilometres were paced quite differently, which usually means the effort was not evenly judged.", "low");
    } else if (diff > TWO_KM_RULES.evenSplitPct) {
      soften("Your two kilometres were paced a little unevenly.", "medium");
    }
  } else {
    soften("No kilometre splits were recorded, so the pacing cannot be checked.", "medium");
  }

  // ⚠️ Heart rate is explicitly optional (spec acceptance test 7) — its absence must never soften
  // or invalidate anything. Nothing here reads averageHeartRate or maximumHeartRate.
  if (t.rpe0To10 !== undefined) {
    if (t.rpe0To10 < TWO_KM_RULES.mediumRpe) {
      soften("You rated the effort below a hard maximum, so there was probably more in the tank.", "low");
    } else if (t.rpe0To10 < TWO_KM_RULES.highRpe) {
      soften("You rated the effort just short of maximal.", "medium");
    }
  } else {
    soften("You did not rate the effort, so we cannot tell whether it was a true maximum.", "medium");
  }

  if (t.gpsQuality === "poor") soften("The GPS signal was poor, so the distance may not have been a true 2 km.", "low");
  else if (t.gpsQuality === "uncertain" || t.environment === "road") {
    if (t.gpsQuality === "uncertain") soften("The distance measurement was uncertain.", "medium");
  }
  if (t.hardSessionWithin48Hours) {
    soften("You had a hard session in the two days before, so your legs were not fresh.", "medium");
  }
  if ((t.elevationGainMetres ?? 0) > 15) {
    soften("The route climbed enough to slow you down, so this is not comparable with a flat one.", "medium");
  }

  return {
    status: grade.confidence === "low" ? "valid_with_caution" : "valid",
    confidence: grade.confidence,
    reasons,
    // ⚠️ Only a high-confidence test sets the baseline outright (spec §14). Medium updates
    // cautiously — the caller decides — and low is kept for history only.
    canSetBaseline: grade.confidence === "high",
  };
}

/**
 * Is this result long enough that calling it "maximal aerobic speed" would be wrong? (§8)
 * Kept as a predicate rather than a label so the UI cannot accidentally print the wrong term.
 */
export function isBeyondMaximalAerobic(elapsedSeconds: number): boolean {
  return elapsedSeconds > TWO_KM_RULES.masCeilingSeconds;
}

/**
 * Which race distances a 2 km trial may be projected to on its own (§11 product rules, acceptance
 * test 11). A short maximal effort says a great deal about 5 km and something about 10 km; it says
 * nothing trustworthy about a half or a marathon, where durability and fuelling dominate and the
 * extrapolation is more than a factor of ten.
 */
export function projectableFrom2k(distance: RaceDistanceKey): boolean {
  return distance === "5k" || distance === "10k";
}
