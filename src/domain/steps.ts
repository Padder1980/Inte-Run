import type { WorkoutStep } from "./types.ts";

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
