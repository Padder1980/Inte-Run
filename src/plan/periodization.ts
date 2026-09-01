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
/**
 * ⚠️⚠️ HUDSON'S OWN BLOCK LENGTHS PLUS AN INTRODUCTORY PERIOD, capped 2026-09-01 (owner's ask, the
 * parked `pc-blocklen` recalibration).
 *
 * `Run Faster from the 5K to the Marathon` ch12 publishes twelve plans at FOUR lengths and no others:
 * **5K 12 weeks, 10K 14, half 16, marathon 20.** These caps are those lengths plus four weeks, because
 * ch7 asks for a 2-6 week introductory period on top of the structured block for a runner starting from
 * a modest base ("a 20-week plan including a longer, six-week introductory period is appropriate").
 *
 * ⚠️ WEEKS ARE PLACED BACKWARDS FROM RACE MONDAY, so a cap does not truncate a plan — it moves its
 * START later and leaves the runner un-planned until then. A 5K entered 30 weeks out now yields a
 * 16-week block ending on race day rather than 32 weeks of mostly-base.
 *
 * ⚠️ AND THE CAP IS WHY EVERY RAMP HAD TO BECOME DELOAD-AWARE IN THE SAME CHANGE — see
 * `rampFractions` in generate-plan.ts. Long blocks hid a defect that a short one exposes at every
 * post-deload week: measured before the ramp fix, capping alone broke the beginner geometric ramp's
 * own 1.10 single-session guardrail (3.0 -> 3.4 km = 13%) and the long-run lift clamp. Shipping the cap
 * without the ramp fix ships those two regressions; shipping the ramp fix without the cap measures
 * slightly worse than neither. They are one change.
 */
export const MAX_STRUCTURED_WEEKS: Record<RaceDistanceKey, number> = {
  "1mile": 14,
  "5k": 16,
  "10k": 18,
  half: 20,
  marathon: 24,
};

/**
 * ⚠️⚠️ THE BEGINNER TRACK KEEPS A LONGER MAXIMUM, AND IT IS ARITHMETIC RATHER THAN CAUTION.
 *
 * Hudson's block lengths describe runners **already training**: his Level 1 plan — the one explicitly
 * "for beginners" — opens at a FOUR-TO-FIVE MILE long run, which is at or above where our beginner
 * track FINISHES for a 5 km. Our beginner ramps from about 30 minutes to the event's own endpoint, a
 * range his plans never attempt, and the evidence report's 1.10 single-session guardrail bounds how
 * fast a ramp may climb. So the length a beginner block needs is set by the ramp, not by the race.
 *
 * Derived, not chosen: a ramp of range R needs `log(R) / log(1.09)` steps, the block must supply that
 * many PROGRESSING weeks (total, less the taper, less one deload in four), and the worst case at each
 * distance is the slowest beginner — whose easy pace pushes `peakMin` up against
 * `BEGINNER_LONG_CEILING_MIN` while `beginnerOpenMin` stays pinned at its 30-minute cap:
 *
 *   distance  peak  open  range   steps  progressing weeks  minimum block
 *   1mile       20     9  2.22x     9.3                 11             16
 *   5k          84    30  2.80x    11.9                 13             19
 *   10k        112    30  3.73x    15.3                 17             24
 *   half       135    30  4.50x    17.5                 19             27
 *   marathon   135    30  4.50x    17.5                 19             27
 *
 * ⚠️ MEASURED WITH THE MAIN-TRACK CAPS APPLIED TO BEGINNERS, the 10 km ramp was one step short and the
 * half FOUR short — so the half beginner arrived at 10.9 km against the report's 12–18 km band, and
 * every step across a deload delivered 17.5%. Those are the two failures that forced this table.
 *
 * ⚠️ IT IS STILL SHORTER THAN BEFORE AT EVERY DISTANCE (was 30/32/36/40/44), so a beginner does get a
 * shorter plan — just not as short as somebody the shorter-plan evidence is actually about. The
 * benefit the cap buys is concentrating race-specific work, and the beginner track deliberately has
 * none to concentrate.
 * ⚠️ A beginner cannot reach a marathon through the UI (`GOAL_BY_STATUS` offers 5k/10k/half at most),
 * so that row is a total-function safety net rather than a length anybody receives.
 */
export const MAX_STRUCTURED_WEEKS_BEGINNER: Record<RaceDistanceKey, number> = {
  "1mile": 16,
  "5k": 20,
  "10k": 24,
  half: 28,
  marathon: 28,
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

export function structuredWeekCount(
  totalWeeks: number,
  distance: RaceDistanceKey,
  // ⚠️ The beginner track's ramp needs more weeks than the race does — see
  // MAX_STRUCTURED_WEEKS_BEGINNER. Defaults false so every existing caller is unchanged.
  beginner = false,
): number {
  const cap = beginner ? MAX_STRUCTURED_WEEKS_BEGINNER[distance] : MAX_STRUCTURED_WEEKS[distance];
  return Math.max(MIN_STRUCTURED_WEEKS, Math.min(totalWeeks, cap));
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
