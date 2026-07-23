// Periodization: turn a number of weeks into an ordered phase schedule.
//
// Order is always base → build → peak → taper. Taper length comes from the distance-specific taper
// model. A deload (recovery) week lands every 4th week outside the taper. Returning-from-injury
// athletes get a longer base and a shorter build (rebuild aerobic consistency before intensity),
// matching the research brief's return-to-running ordering.

import type { Phase, RaceDistanceKey } from "../domain/types.ts";
import { taperFor } from "../science/taper.ts";

/** Longest structured plan we hand out per distance; extra lead time becomes flexible base-building. */
export const MAX_STRUCTURED_WEEKS: Record<RaceDistanceKey, number> = {
  "1mile": 12,
  "5k": 16,
  "10k": 18,
  half: 20,
  marathon: 24,
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
  const baseFraction = returningFromInjury ? 0.62 : 0.5;
  const baseWeeks = Math.max(1, Math.round(afterPeak * baseFraction));
  const buildWeeks = Math.max(0, afterPeak - baseWeeks);

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
