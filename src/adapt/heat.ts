// Rewriting a session's pace targets for the heat.
//
// The engine already knows how much slower the same EFFORT runs in given conditions
// (`heatPaceFactor` in ../environment/weather.ts, anchored to a published marathon dataset). This is
// the other half: taking that multiplier and producing the session the runner should actually do.
//
// ⚠️ IT RETURNS A COPY AND MUTATES NOTHING. The plan is rebuilt from the profile at every boot, and
// an adapted session is a decision about one day — never a change to the plan. The caller stores the
// DECISION and re-derives, which is the rule `addExtra` states for the same reason: "storing baked
// steps would freeze old paces into the logbook."

import type { Session, WorkoutStep } from "../domain/types.ts";

/** A step's pace target, slowed by the factor. Undefined in, undefined out. */
function slowBand(band: WorkoutStep["targetPaceSecPerKm"], factor: number) {
  if (!band) return undefined;
  return {
    minSecPerKm: Math.round(band.minSecPerKm * factor),
    maxSecPerKm: Math.round(band.maxSecPerKm * factor),
  };
}

/**
 * How long a step takes once its pace has been slowed.
 *
 * ⚠️ THE TWO KINDS OF STEP MOVE IN OPPOSITE DIRECTIONS, and getting this wrong is how a session
 * quietly stops adding up. A step measured in DISTANCE — "6 × 1 km" — still covers a kilometre, so
 * slowing it makes it take LONGER. A step measured in TIME — "20 minutes steady" — still takes
 * twenty minutes, so slowing it covers LESS GROUND. Only the first changes the session's duration,
 * which is why a heat-adapted interval session reads "45–55m" where it read "35–45m" while an
 * adapted easy run reads exactly as long as it always did.
 */
function stepSecondsAfter(st: WorkoutStep, factor: number): number {
  if (st.distanceMeters && st.targetPaceSecPerKm) {
    // Distance-bound: the clock stretches with the pace.
    const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
    return Math.round((st.distanceMeters / 1000) * mid * factor);
  }
  return st.durationSeconds || 0;
}

/** The ground a step covers once its pace has been slowed. */
function stepMetresAfter(st: WorkoutStep, factor: number): number {
  if (st.distanceMeters) return st.distanceMeters;          // a kilometre is still a kilometre
  if (st.durationSeconds && st.targetPaceSecPerKm) {
    const mid = (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
    return Math.round((st.durationSeconds / (mid * factor)) * 1000);
  }
  return 0;
}

export type HeatAdaptation = {
  session: Session;
  /** The multiplier applied, echoed back so a caller can label the result honestly. */
  factor: number;
  /** How many steps actually had a pace target to slow. Zero means nothing was changed. */
  changedSteps: number;
  /** True when the session carries no pace targets at all — hill reps, strength, a plain rest day. */
  effortOnly: boolean;
};

/**
 * A copy of `session` with every pace target slowed by `factor`.
 *
 * ⚠️ STEPS WITHOUT A PACE ARE LEFT EXACTLY AS THEY ARE, AND THAT IS THE INTERESTING CASE. Hill reps
 * carry no pace by design — "pace on a hill is meaningless, RPE is the guide" — and neither do
 * jogged recoveries or strength work. Scaling a band that is not there would do nothing; the bug to
 * avoid is the opposite one, of reporting a session as adapted when nothing in it changed. That is
 * what `changedSteps` and `effortOnly` are for: a caller must not offer to adapt a hill session.
 *
 * ⚠️ THE RPE BANDS ARE UNTOUCHED, DELIBERATELY. The whole claim is that the slower pace is the SAME
 * EFFORT — so the effort target is the one thing that must not move. Shifting it too would be saying
 * the session should feel easier, which is a different and unevidenced proposition.
 */
export function adaptSessionForHeat(session: Session, factor: number): HeatAdaptation {
  const steps = session.steps || [];
  const paced = steps.filter((st) => !!st.targetPaceSecPerKm);
  if (!(factor > 1) || !paced.length) {
    return { session, factor: 1, changedSteps: 0, effortOnly: !paced.length };
  }

  let changed = 0;
  const out: WorkoutStep[] = steps.map((st) => {
    if (!st.targetPaceSecPerKm) return st;
    changed++;
    const band = slowBand(st.targetPaceSecPerKm, factor);
    const next: WorkoutStep = { ...st, targetPaceSecPerKm: band };
    // Only a step bound to a distance gets a longer clock; see stepSecondsAfter.
    if (st.distanceMeters && st.durationSeconds) next.durationSeconds = stepSecondsAfter(st, factor);
    return next;
  });

  const seconds = out.reduce((a, st) => a + stepSecondsAfter(st, 1), 0);
  const metres = out.reduce((a, st) => a + stepMetresAfter(st, 1), 0);

  const adapted: Session = { ...session, steps: out };
  if (seconds > 0) adapted.estimatedDurationSeconds = seconds;
  if (session.estimatedDistanceMeters !== undefined && metres > 0) adapted.estimatedDistanceMeters = metres;
  // ⚠️ trainingDistanceMeters IS LEFT ALONE ON PURPOSE. That field is the plan's mileage accounting —
  // what the volume model measures a runner's stated weekly distance against. A hot Tuesday is not a
  // smaller training week; the runner did the session they were set, in worse conditions. Rewriting
  // it here would let one day's weather quietly reshape the block's volume fit.

  return { session: adapted, factor, changedSteps: changed, effortOnly: false };
}
