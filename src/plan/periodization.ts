// Periodization: turn the weeks available before a race into an ordered phase schedule.
//
// The plan maps over the WHOLE runway rather than capping a short block and leaving the earlier time
// as vague "just run easy". The specific work — build, peak, taper — is capped and concentrated near
// the race; any surplus time goes into a longer progressive BASE, so the athlete arrives at the
// specific block in the best possible shape. Order is always base → build → peak → taper. Taper
// length comes from the distance-specific taper model. A deload lands every 4th week outside the
// taper. Returning-from-injury athletes get a shorter build (rebuild aerobic consistency first).

import type { Phase, RaceDistanceKey } from "../domain/types.ts";
import { taperFor } from "../science/taper.ts";

/** Upper bound on a single structured plan — beyond this (a race ~9+ months out), the surplus is a
 *  base-building lead-in. Raised well above old values so typical goals map over their full runway. */
export const MAX_STRUCTURED_WEEKS: Record<RaceDistanceKey, number> = {
  "1mile": 30,
  "5k": 32,
  "10k": 36,
  half: 40,
  marathon: 44,
};

/** How long the concentrated, race-specific BUILD phase runs at most, per distance. Extra time is
 *  spent extending the base, not stretching the specific work (which should stay concentrated). */
const BUILD_CAP: Record<RaceDistanceKey, number> = {
  "1mile": 6,
  "5k": 7,
  "10k": 8,
  half: 10,
  marathon: 12,
};

const MIN_STRUCTURED_WEEKS = 4;

export function structuredWeekCount(totalWeeks: number, distance: RaceDistanceKey): number {
  return Math.max(MIN_STRUCTURED_WEEKS, Math.min(totalWeeks, MAX_STRUCTURED_WEEKS[distance]));
}

export type WeekPlan = { phase: Phase; isDeload: boolean };

export function phaseSchedule(
  structuredWeeks: number,
  distance: RaceDistanceKey,
  returningFromInjury: boolean,
): WeekPlan[] {
  const taperWeeks = Math.min(taperFor(distance).weeks, Math.max(1, structuredWeeks - 3));
  const remaining = structuredWeeks - taperWeeks;

  let peakWeeks: number;
  if (remaining >= 8) peakWeeks = Math.min(4, Math.round(remaining * 0.2));
  else if (remaining >= 4) peakWeeks = 1;
  else peakWeeks = 0;

  const afterPeak = remaining - peakWeeks;
  // Build is the concentrated specific phase — capped, and shorter for returning athletes. Whatever
  // time is left over lands in the base, so a long runway becomes a long aerobic foundation.
  const buildCap = Math.max(2, BUILD_CAP[distance] - (returningFromInjury ? 2 : 0));
  let buildWeeks = Math.min(buildCap, Math.round(afterPeak * (returningFromInjury ? 0.4 : 0.5)));
  if (afterPeak >= 1) buildWeeks = Math.min(buildWeeks, afterPeak - 1); // always keep at least 1 base week
  buildWeeks = Math.max(0, buildWeeks);
  const baseWeeks = afterPeak - buildWeeks;

  const phases: Phase[] = [
    ...fill("base", baseWeeks),
    ...fill("build", buildWeeks),
    ...fill("peak", peakWeeks),
    ...fill("taper", taperWeeks),
  ];

  return phases.map((phase, i) => {
    const weekNumber = i + 1;
    // Deload every 4th week, but never during the taper (taper already unloads).
    const isDeload = phase !== "taper" && weekNumber % 4 === 0;
    return { phase, isDeload };
  });
}

function fill(phase: Phase, n: number): Phase[] {
  return Array.from({ length: Math.max(0, n) }, () => phase);
}
