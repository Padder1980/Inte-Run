// Public API for the running-coach engine. Import from here.

export * from "./domain/types.ts";
export {
  distanceForTime,
  formatDuration,
  formatPace,
  METRES_PER_KM,
  METRES_PER_MILE,
  metresToKm,
  paceSecPerKm,
  parseDuration,
  RACE_DISTANCES_M,
  secPerKmToSecPerMile,
  secPerMileToSecPerKm,
  timeForDistance,
} from "./domain/units.ts";

// Science
export {
  deriveTrainingPaces,
  estimateHrZones,
  goalPace,
  predictAllRaceTimes,
  predictRaceTime,
  riegelPredict,
  withHrZones,
} from "./science/paces.ts";
export {
  chooseModel,
  computeDistribution,
  type Distribution,
  honoursModel,
  TID_TARGETS,
  TID_TOLERANCE,
} from "./science/intensity-distribution.ts";
export { type TaperPlan, taperFor, taperVolumeReductionPct } from "./science/taper.ts";
export { rollingLoad, sessionLoad, weekLoad } from "./science/training-load.ts";

// Planning
export { assessFeasibility } from "./plan/feasibility.ts";
export { generatePlan, type GenerateOptions } from "./plan/generate-plan.ts";
export {
  MAX_STRUCTURED_WEEKS,
  phaseSchedule,
  structuredWeekCount,
  type WeekPlan,
} from "./plan/periodization.ts";
export { addDays, daysBetween, isoToday, weeksBetween } from "./plan/dates.ts";

// Adaptation
export {
  applyMissedSessionAdjustment,
  countTrailingMisses,
  type MissedSessionResult,
} from "./adapt/missed-sessions.ts";
export {
  applyInjuryAdjustment,
  assessInjury,
  type InjuryAdjustmentResult,
} from "./adapt/injury.ts";
export { entriesFromOutcomes, evaluateRpe, type RpeEntry } from "./adapt/rpe-feedback.ts";

// Progress
export {
  bestEffort,
  type BestsMap,
  type AchievementResult,
  detectAchievements,
} from "./progress/achievements.ts";

// View models (presentation-agnostic summaries for any UI)
export {
  buildPlanSummary,
  type PlanSummary,
  type WeekView,
  type SessionView,
} from "./view/plan-summary.ts";
