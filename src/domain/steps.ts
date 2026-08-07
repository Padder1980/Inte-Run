import type { Session, WorkoutStep } from "./types.ts";

/**
 * Is this step PREPARATION rather than training?
 *
 * ⚠️ A WARM-UP IS NOT TRAINING VOLUME (the owner's reframing, 2026-08-03). *"You can't class warming
 * the body up as real training volume. This is just about preparing the body for training and the user
 * can go as slow as they need to, therefore putting no additional strain on the body."*
 *
 * ⚠️ IT IS FOR THE MILEAGE MODEL ONLY. I also applied it to `computeDistribution` on the reasoning that
 * one definition should serve both, and the suite proved that wrong within a minute: a threshold session
 * dropped to 17% easy running and a 3-day 5 km peak week fell to 66.4% easy, breaking the pyramidal
 * floor. The two models ask different questions and are entitled to different denominators —
 *   volume:    "how much training load is this week?"  Preparation is not load.
 *   intensity: "of the running you do, what fraction is hard?"  Warm-up jogging IS easy running.
 * Excluding it there does not remove easy minutes from a week, it removes them from the DENOMINATOR,
 * which inflates the hard fraction and makes the generator reject perfectly good plans. Leave
 * `computeDistribution` counting warm-ups as easy; that is deliberate and documented in `stepBucket`.
 *
 * ⚠️ It is NOT used for `estimatedDistanceMeters`. That figure is what the session sheet shows and the
 * runner really does cover that ground; trimming it to make the volume model behave would put a lie on
 * the card. Two figures, two jobs.
 */
export function isPreparationStep(step: WorkoutStep): boolean {
  return step.kind === "warmup" || step.kind === "cooldown";
}

/**
 * How much this session counts toward the week's mileage.
 *
 * ⚠️ ONE DEFINITION, IN ONE PLACE, BECAUSE HAVING TWO WAS A REAL BUG. When `trainingDistanceMeters`
 * arrived with the volume reframing above, `generate-plan.ts` was updated in six places and the two
 * adaptation modules were not — they kept summing `estimatedDistanceMeters`, the WHOLE outing. So an
 * injury-adjusted or re-entry week came back measured on a different scale from every other week in
 * the same plan, and a week that had just been deliberately cut reported as BIGGER than the peak
 * week it followed: measured on a 5-day half block, a re-entry week rose 40.9 km → 44.1 km while
 * every session in it got shorter. Nothing threw; the number was simply of a different kind.
 * `test/adaptation.test.ts`'s "volume should fall" is what eventually caught it, and it had been
 * failing for days looking like an adaptation bug rather than an accounting one.
 *
 * The fallback is load-bearing: a session built before this field existed, or by a builder that does
 * not set it, still has to count for something — so an absent training figure means "all of it".
 */
export function sessionVolumeMeters(s: Session): number {
  return s.trainingDistanceMeters ?? s.estimatedDistanceMeters ?? 0;
}

/** The week's mileage — the figure a runner's stated volume is compared against. */
export function weekVolumeMeters(sessions: readonly Session[]): number {
  return Math.round(sessions.reduce((m, s) => m + sessionVolumeMeters(s), 0));
}

/**
 * Rescale a session's distance, keeping BOTH figures in step.
 *
 * ⚠️ Scaling only `estimatedDistanceMeters` leaves `trainingDistanceMeters` at its old value, and
 * since the volume total prefers the training figure, a "trim the long run 20%" that only touched
 * the estimate changed the card and left the mileage exactly where it was. Two figures, two jobs —
 * but one scale factor.
 */
export function scaleSessionDistance(s: Session, factor: number): Session {
  const out: Session = { ...s };
  if (s.estimatedDistanceMeters !== undefined) {
    out.estimatedDistanceMeters = Math.round(s.estimatedDistanceMeters * factor);
  }
  if (s.trainingDistanceMeters !== undefined) {
    out.trainingDistanceMeters = Math.round(s.trainingDistanceMeters * factor);
  }
  return out;
}
