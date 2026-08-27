// Browser bundle entry point. esbuild bundles this (and everything it imports from the pure-TS
// engine) into a single IIFE exposed as `window.RC`, so the interactive pages can run the real
// engine client-side. Keep this surface minimal — just what the pages call.

export { buildPlanSummary } from "../src/view/plan-summary.ts";
export type { PlanSummary } from "../src/view/plan-summary.ts";
export { parseDuration } from "../src/domain/units.ts";
export { generatePlan } from "../src/plan/generate-plan.ts";
export { LiveSession } from "../src/live/session-runtime.ts";
export type { Telemetry, Cue, LiveSnapshot, StepView } from "../src/live/session-runtime.ts";
// Spoken-coaching catalogue + selection (drives the app's audio controller).
export {
  COACHES, COACH_IDS, DEFAULT_COACH, PROMPTS, ALL_PROMPTS,
  selectPrompt, newPromptHistory, markPlayed, shouldInterrupt, promptsFor, canPlay, promptTextFor,
  PERSONAL_PROMPT_TEMPLATES,
  personalPrompts,
  personalPackSlug,
} from "../src/live/coach-prompts.ts";
export type { CoachId, Coach, PromptTrigger, PromptDef, PromptHistory } from "../src/live/coach-prompts.ts";
export { PROFESSIONAL_LABEL } from "../src/safety/common.ts";
export { screenRedFlags } from "../src/safety/escalation.ts";
export { screenRedS, estimateEnergyAvailability } from "../src/safety/red-s.ts";
export { assessFemaleHealth } from "../src/safety/female-health.ts";
export { buildFitnessProfile } from "../src/science/fitness-profile.ts";
// ⚠️ computeMas is NO LONGER EXPORTED to the page (2026-08-02). The engine still uses it internally
// for reconcileVo2 on plans built from the old 1 km trial, but nothing in the app may show a runner
// a "maximal aerobic speed": the 2 km specification is explicit that an effort over ten minutes is
// not one, and 2 km at 5:00/km is exactly ten minutes. Keeping the export alive is how the term
// finds its way back onto a screen.
export { riegelPredict, PACE_RATIOS, paceRatioMid, reconcileVo2,
  // ⚠️ THE ONE PLACE A BLANK GOAL BECOMES A NUMBER. Exported so `web/app.ts` calls the engine
  // rather than open-coding a Riegel projection — an uncorrected one sets every marathon-effort
  // pace band in the block, so the arithmetic belongs where it is typechecked and tested.
  deriveGoalTimeSeconds } from "../src/science/paces.ts";
export { rangeText } from "../src/science/estimate.ts";
export { assessReadiness } from "../src/readiness/readiness.ts";
export { assessLongRunSpike, returnToRunningPlan } from "../src/adapt/load-guardrails.ts";
export { assessTrainingFlags } from "../src/adapt/training-flags.ts";
export type { RunObservation, TrainingFlag, TrainingFlagsResult } from "../src/adapt/training-flags.ts";
export { assessConditions, heatPaceFactor, dewPointFrom } from "../src/environment/weather.ts";
export { adaptSessionForHeat } from "../src/adapt/heat.ts";
export { fuellingFor } from "../src/science/fuelling.ts";
export { listWorkouts, buildWorkout } from "../src/plan/session-templates.ts";
export type { WorkoutOption } from "../src/plan/session-templates.ts";
export type { FuellingPlan } from "../src/science/fuelling.ts";
export { classifyRunner } from "../src/athlete/classification.ts";
export { assessMasters } from "../src/athlete/masters.ts";
export { applicability } from "../src/athlete/evidence-tag.ts";

// The 2 km time trial — validation, confidence and the derived velocity. ⚠️ Exported so the page can
// grade a trial with the SAME rules the engine's tests cover; the page must never re-implement them.
export {
  TWO_KM_MODEL_VERSION, TWO_KM_RULES, TWO_KM_DISTANCE_M,
  validateTwoKmTest, splitDifferencePercent, velocityChangePercent,
  twoKmVelocityMps, twoKmPaceSecPerKm, paceFromVelocityFraction,
  isBeyondMaximalAerobic, projectableFrom2k,
} from "../src/science/two-km-trial.ts";
export type { TwoKmTimeTrial, TwoKmValidation, TwoKmConfidence, TwoKmTestEnvironment } from "../src/science/two-km-trial.ts";

// The weekly review. ⚠️ It returns observations and at most one SUGGESTION — it can change nothing.
export {
  buildWeeklyReview, retestDue, RETEST_DUE_DAYS,
  // Frequency — the one FITT axis the plan never progressed. It OFFERS a day; it never adds one.
  addDayOffer, ADD_DAY_MAX, ADD_DAY_COOLDOWN_DAYS, ADD_DAY_MIN_RUNWAY_WEEKS,
  ADD_DAY_MIN_WEEKS_ON_PLAN, ADD_DAY_MIN_COMPLETION,
} from "../src/adapt/weekly-review.ts";
export type { WeeklyReview, WeeklySuggestion, ReviewRun, AddDayInput } from "../src/adapt/weekly-review.ts";

// Warm-ups, generated from the session's first hard effort. ⚠️ Never claims to prevent injury —
// that is the specification's one grade-A rule and test/warmup.test.ts enforces it on every string.
export { buildWarmup, firstHardEffort, WARMUP_MOVEMENTS, WARMUP_MODEL_VERSION } from "../src/science/warmup.ts";
export type { Warmup, WarmupPhase, AbilityBand, FirstHardEffort } from "../src/science/warmup.ts";

// The optional post-run stretch session, offered on the debrief in place of the cool-down jog the
// low-intensity runs used to prescribe. ⚠️ Same rule as the warm-up copy: it may never claim to prevent
// injury or to make anyone faster, and test/stretches.test.ts enforces that on every string it exports.
export { STRETCHES, STRETCH_INTRO, stretchTotalSeconds, stretchHolds } from "../src/science/stretches.ts";
export type { Stretch } from "../src/science/stretches.ts";
