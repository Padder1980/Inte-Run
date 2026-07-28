// Core domain types for the running-coach engine. Pure type declarations — no runtime code.
// Content (what a session is), scheduling (when), and intensity accounting are kept separate so
// the plan can be adapted along any one axis without disturbing the others.

import type { RaceDistanceKey } from "./units.ts";

export type { RaceDistanceKey };

export type UnitSystem = "metric" | "imperial";

/** Self-reported training background — used to pick defaults, not to gatekeep. */
export type ExperienceLevel = "beginner" | "recreational" | "competitive";

/** A recent representative effort used to seed pace and fitness estimates. */
export type RecentPerformance = {
  distanceMeters: number;
  timeSeconds: number;
};

export type Athlete = {
  /** How many days per week the athlete can train (running + strength share the week). */
  daysPerWeek: number;
  recent: RecentPerformance;
  experience: ExperienceLevel;
  includeStrength: boolean;
  /** When true the plan starts conservatively (single quality session, gentle volume ramp). */
  returningFromInjury?: boolean;
  /** Couch-to-5k starter: runs become run–walk intervals and the whole plan stays very gentle
   *  (3 run days, short durations, general strength, no strides or hard intervals). */
  runWalk?: boolean;
  weeklyVolumeKmCurrent?: number;
  maxHr?: number;
  restingHr?: number;
  /** Optional 1 km max-effort time-trial (seconds) — anchors MAS-based VO₂/interval paces. */
  oneKmTrialSeconds?: number;
  /** Preferred day for the weekly long run (0 = Monday … 6 = Sunday). The rest of the week's
   *  sessions are scheduled around it. Defaults to Sunday (6) when unset. */
  longRunDay?: number;
  unit?: UnitSystem;
};

export type Goal = {
  distance: RaceDistanceKey;
  targetTimeSeconds: number;
  /** ISO date (yyyy-mm-dd) of the goal race. */
  raceDateIso: string;
  /** ISO date the plan should start from; defaults to "today" at generation time. */
  startDateIso?: string;
  priority?: "primary" | "secondary";
};

/** Training-intensity-distribution model. Pyramidal is the evidence-based default. */
export type IntensityModel = "pyramidal" | "polarized";

export type Phase = "base" | "build" | "peak" | "taper";

export type SessionType =
  | "easy"
  | "long"
  | "recovery"
  | "threshold"
  | "vo2"
  | "strides"
  | "race-specific"
  | "strength"
  | "mobility"
  | "cross-training"
  | "rest";

/** Coarse intensity bucket used for training-intensity-distribution accounting. */
export type IntensityBucket = "easy" | "moderate" | "hard" | "none";

export type PaceRange = { minSecPerKm: number; maxSecPerKm: number };

export type RpeBand = { min: number; max: number };

export type HrZone = {
  zone: number;
  label: string;
  minBpm: number;
  maxBpm: number;
};

export type TrainingPaces = {
  easy: PaceRange;
  /** "Moderate" — quicker than easy, slower than steady. Fills a real ~30 s/km hole between the
   *  two, and is the gear most coached plans call MOD. Aerobic, still comfortable, RPE 3–4. */
  aerobic: PaceRange;
  steady: PaceRange;
  /** "True tempo" — between steady and threshold. Sustainable for close to an hour, and the gear
   *  long continuous tempo runs actually sit in; threshold is too sharp to hold for 10 km. */
  tempo: PaceRange;
  threshold: PaceRange;
  /** Critical velocity — around 10 km pace. Sits between threshold and VO2: faster than a tempo,
   *  slower than an interval. A session that contrasts threshold and CV blocks (a staple of real
   *  coaching) cannot be written without both bands. */
  cv: PaceRange;
  vo2: PaceRange;
  rep: PaceRange;
  goalRace: PaceRange;
  predictedRaceTimes: Record<RaceDistanceKey, number>;
  hrZones?: HrZone[];
};

export type WorkoutStepKind = "warmup" | "cooldown" | "steady" | "rep" | "recovery";

export type WorkoutStep = {
  kind: WorkoutStepKind;
  label: string;
  durationSeconds?: number;
  distanceMeters?: number;
  targetPaceSecPerKm?: PaceRange;
  targetRpe?: RpeBand;
  /** 1-based position within a repeated block, when applicable. */
  repeatIndex?: number;
  repeatCount?: number;
};

/** A single strength exercise with its prescription — enables per-exercise, per-set logging. */
export type StrengthExercise = {
  name: string;
  primary: string;
  secondary: string[];
  sets: number;
  /** Reps or hold, e.g. "3–6", "8–12", "30–45s". */
  reps: string;
  /** Movement family the UI uses to pick a schematic demonstration figure. */
  pattern: string;
  /** Slug of a looping demonstration animation (assets/exercise-animations/<slug>.webp),
   *  inlined into the app at build time. Absent for exercises without a bespoke animation. */
  anim?: string;
  cue: string;
};

export type Session = {
  id: string;
  /** 0 = Monday … 6 = Sunday. */
  dayOfWeek: number;
  type: SessionType;
  title: string;
  description: string;
  intensity: IntensityBucket;
  estimatedDurationSeconds: number;
  estimatedDistanceMeters?: number;
  steps: WorkoutStep[];
  targetRpe?: RpeBand;
  optional?: boolean;
  /** Present on strength sessions: the exercises to perform, for a full breakdown and logging. */
  exercises?: StrengthExercise[];
  source: "generated" | "manual";
};

export type PlannedWeek = {
  /** 1-based week number within the structured plan. */
  index: number;
  startDateIso: string;
  phase: Phase;
  isDeload: boolean;
  focus: string;
  sessions: Session[];
  plannedDistanceMeters: number;
  qualitySessionCount: number;
};

export type Plan = {
  goal: Goal;
  athlete: Athlete;
  createdAtIso: string;
  intensityModel: IntensityModel;
  paces: TrainingPaces;
  /** Calendar weeks from plan start to race. */
  totalWeeks: number;
  weeks: PlannedWeek[];
  notes: string[];
};

// ---- Feasibility ----------------------------------------------------------

export type FeasibilityVerdict = "comfortable" | "achievable" | "ambitious" | "unrealistic";

export type FeasibilityAssessment = {
  verdict: FeasibilityVerdict;
  currentPredictedSeconds: number;
  goalSeconds: number;
  /** How much faster (percent) the athlete must get; negative means the goal is already within reach. */
  requiredImprovementPct: number;
  /** Model estimate of the improvement achievable in the time available. */
  projectedAchievablePct: number;
  projectedAchievableSeconds: number;
  weeksAvailable: number;
  rationale: string[];
  /** Present when the raw goal is out of reach — a realistic target for the same date. */
  suggestedTargetSeconds?: number;
};

// ---- Adaptation: missed sessions, injury, RPE -----------------------------

export type SessionOutcome = {
  sessionId: string;
  dateIso: string;
  completed: boolean;
  rpe?: number;
};

export type InjurySeverity = "niggle" | "moderate" | "severe";

export type InjuryRegion =
  | "foot"
  | "achilles"
  | "calf"
  | "shin"
  | "knee"
  | "hip"
  | "hamstring"
  | "itb"
  | "other";

export type InjuryReport = {
  region: InjuryRegion;
  severity: InjurySeverity;
  painWhileRunning: boolean;
  boneStressSuspected?: boolean;
  reportedOnIso: string;
};

export type InjuryAction = "pause" | "reduce" | "cross-train" | "monitor";

export type InjuryAssessment = {
  action: InjuryAction;
  pauseDays: number;
  /** Multiplier applied to running intensity/volume during the affected period (1 = unchanged). */
  intensityScale: number;
  volumeScale: number;
  guidance: string[];
};

export type RpeRecommendation = "ease" | "hold" | "progress";

// ---- Progress / achievements ----------------------------------------------

export type ActivitySplit = { distanceMeters: number; timeSeconds: number };

export type Activity = {
  id: string;
  dateIso: string;
  distanceMeters: number;
  movingTimeSeconds: number;
  /** Ordered splits (per km or per mile) enabling best-effort detection within an activity. */
  splits?: ActivitySplit[];
  type?: SessionType;
};

export type AchievementKind =
  | "fastest-1k"
  | "fastest-1mile"
  | "fastest-5k"
  | "fastest-10k"
  | "fastest-half"
  | "fastest-marathon"
  | "longest-run";

export type Achievement = {
  kind: AchievementKind;
  valueSeconds?: number;
  valueMeters?: number;
  activityId: string;
  dateIso: string;
};
