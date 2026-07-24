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
export {
  type Confidence,
  type Estimate,
  rangeText,
  rangeAround,
  unknownEstimate,
} from "./science/estimate.ts";
export {
  type Effort,
  type CriticalSpeedModel,
  fitCriticalSpeed,
  predictTimeFromModel,
  predictDistanceFromModel,
} from "./science/critical-speed.ts";
export {
  type FitnessInput,
  type FitnessProfile,
  buildFitnessProfile,
} from "./science/fitness-profile.ts";

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

// Live session runtime (start/pause/stop, pace cues — the "during the run" logic layer)
export {
  LiveSession,
  type Telemetry,
  type Cue,
  type CueKind,
  type LiveStatus,
  type LiveSnapshot,
  type PaceStatus,
  type StepView,
} from "./live/session-runtime.ts";

// Safety layer — screen, educate and refer. Never diagnoses.
export {
  type Professional,
  PROFESSIONAL_LABEL,
  type Urgency,
  URGENCY_RANK,
  maxUrgency,
  NOT_A_DIAGNOSIS,
} from "./safety/common.ts";
export {
  screenRedFlags,
  type RedFlag,
  type FlagCategory,
  type FlagAssessment,
  type EscalationResult,
} from "./safety/escalation.ts";
export {
  screenRedS,
  estimateEnergyAvailability,
  type RedSIndicator,
  type RedSRisk,
  type RedSResult,
  type EnergyAvailabilityBand,
  type EnergyAvailabilityEstimate,
} from "./safety/red-s.ts";
export {
  assessFemaleHealth,
  type MenstrualStatus,
  type FemaleSymptom,
  type FemaleHealthInput,
  type HealthPrompt,
  type FemaleHealthResult,
} from "./safety/female-health.ts";
