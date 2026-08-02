// Goal feasibility.
//
// Compares the athlete's current Riegel-predicted time at the goal distance with the target, then
// estimates how much improvement is realistic in the weeks available. The improvement model uses
// diminishing returns (you cannot keep improving linearly forever) with a ceiling that depends on
// training background and whether the athlete is returning from a lay-off (returners regain fitness
// faster than trained athletes gain it). These are transparent heuristics, not physiological truth —
// the rationale strings spell out the assumptions so a coach/user can judge them.

import type { Athlete, FeasibilityAssessment, FeasibilityVerdict, Goal } from "../domain/types.ts";
import { formatDuration } from "../domain/units.ts";
import { predictRaceTime, riegelPredict } from "../science/paces.ts";
import { RACE_DISTANCES_M } from "../domain/units.ts";
import { isoToday, weeksBetween } from "./dates.ts";

/** Ceiling on achievable improvement (fraction) by background, before the time factor is applied. */
const IMPROVEMENT_CEILING: Record<Athlete["experience"], number> = {
  beginner: 0.25,
  recreational: 0.15,
  competitive: 0.08,
};

/** Returners can regain a large fraction of former fitness — a higher ceiling. */
const RETURNING_CEILING = 0.35;

/** Weeks at which ~63% of the ceiling is reached (exponential time constant). */
const TIME_CONSTANT_WEEKS = 18;

export function assessFeasibility(
  athlete: Athlete,
  goal: Goal,
  startDateIso?: string,
): FeasibilityAssessment {
  const start = startDateIso ?? goal.startDateIso ?? isoToday();
  const weeksAvailable = Math.max(0, weeksBetween(start, goal.raceDateIso));

  // Current-fitness read from the recent effort, plus the 2 km trial when present. A fresh all-out
  // 1 km is genuine evidence, so we take whichever prediction is faster (best current form). The
  // recent effort stays in play so a short 1 km can't over-flatter a long-distance goal on its own.
  const predictedFromRecent = predictRaceTime(athlete.recent, goal.distance);
  const trialSeconds = athlete.twoKmTrialSeconds && athlete.twoKmTrialSeconds > 0
    ? athlete.twoKmTrialSeconds
    : undefined;
  const predictedFromTrial = trialSeconds
    ? riegelPredict(2000, trialSeconds, RACE_DISTANCES_M[goal.distance])
    : undefined;
  const trialIsStronger = predictedFromTrial !== undefined && predictedFromTrial < predictedFromRecent;
  const currentPredicted = trialIsStronger ? predictedFromTrial! : predictedFromRecent;
  const goalSeconds = goal.targetTimeSeconds;
  const requiredImprovementPct = ((currentPredicted - goalSeconds) / currentPredicted) * 100;

  const ceiling = athlete.returningFromInjury
    ? RETURNING_CEILING
    : IMPROVEMENT_CEILING[athlete.experience];
  // Diminishing-returns curve; a few days/week of training assumed. More days nudges it up slightly.
  const timeFactor = 1 - Math.exp(-weeksAvailable / TIME_CONSTANT_WEEKS);
  const daysFactor = Math.min(1.1, 0.8 + 0.06 * Math.max(0, athlete.daysPerWeek - 3));
  const projectedAchievablePct = ceiling * timeFactor * daysFactor * 100;
  const projectedAchievableSeconds = Math.round(
    currentPredicted * (1 - projectedAchievablePct / 100),
  );

  const rationale: string[] = [];
  rationale.push(
    `Current fitness predicts ${formatDuration(currentPredicted)} for the ${goal.distance}; target is ${formatDuration(goalSeconds)}.`,
  );
  if (predictedFromTrial !== undefined) {
    rationale.push(
      trialIsStronger
        ? `Your 2 km trial projects a faster ${formatDuration(predictedFromTrial)} than your recent effort (${formatDuration(predictedFromRecent)}), so it sets the current-fitness read.`
        : `Your 2 km trial projects ${formatDuration(predictedFromTrial)}; your recent effort (${formatDuration(predictedFromRecent)}) is the stronger read, so it stands.`,
    );
  }

  let verdict: FeasibilityVerdict;
  let suggestedTargetSeconds: number | undefined;

  if (requiredImprovementPct <= 0) {
    verdict = "comfortable";
    rationale.push(
      "The goal is at or above current predicted fitness — the plan can push further.",
    );
  } else if (requiredImprovementPct <= projectedAchievablePct * 0.6) {
    verdict = "achievable";
    rationale.push(
      `Needs a ${requiredImprovementPct.toFixed(1)}% improvement; ~${projectedAchievablePct.toFixed(1)}% is realistic in ${weeksAvailable} weeks.`,
    );
  } else if (requiredImprovementPct <= projectedAchievablePct) {
    verdict = "ambitious";
    rationale.push(
      `Needs ${requiredImprovementPct.toFixed(1)}% vs a realistic ceiling near ${projectedAchievablePct.toFixed(1)}% — attainable but with little margin. Consistency and injury-free training are essential.`,
    );
  } else {
    verdict = "unrealistic";
    suggestedTargetSeconds = projectedAchievableSeconds;
    rationale.push(
      `Needs ${requiredImprovementPct.toFixed(1)}% but only ~${projectedAchievablePct.toFixed(1)}% is realistic here. A target near ${formatDuration(projectedAchievableSeconds)} fits the time available; extending the race date would raise the ceiling.`,
    );
  }

  if (weeksAvailable < 6 && verdict !== "comfortable") {
    rationale.push("Fewer than 6 weeks remain — limited time to build fitness safely.");
  }
  if (athlete.returningFromInjury) {
    rationale.push(
      "Returning from injury: fitness may return before joints/tendons are ready — early weeks stay conservative.",
    );
  }

  return {
    verdict,
    currentPredictedSeconds: Math.round(currentPredicted),
    goalSeconds,
    requiredImprovementPct: Number(requiredImprovementPct.toFixed(2)),
    projectedAchievablePct: Number(projectedAchievablePct.toFixed(2)),
    projectedAchievableSeconds,
    weeksAvailable,
    rationale,
    suggestedTargetSeconds,
  };
}
