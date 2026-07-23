// Evidence-based session library. Each builder returns SessionContent (the "what" of a session);
// scheduling (day of week, id) is added later by the plan generator so content and scheduling stay
// separate. Session formats are taken directly from the research brief:
//   threshold (RPE 6–7): 3×8–10′/2′, 4×6–8′/90–120″, 20–30′ continuous, cruise 5–6×1mi
//   VO2 (RPE 8–9):       5×3′/2′, 4×4′/3′, 5–6×800m, 10×1′/1′  (~12–20′ hard total)
//   long runs develop durability: easy → extend → steady finish → race-specific while tired
//   strength: heavy (~80%+ 1RM), 3–6 reps, 2–4 sets, 2×/week main → 1×/week maintenance
//   warmups are dynamic (jog + drills + strides), not static stretching

import type {
  PaceRange,
  Phase,
  RpeBand,
  Session,
  SessionType,
  TrainingPaces,
  WorkoutStep,
} from "../domain/types.ts";
import { distanceForTime, timeForDistance } from "../domain/units.ts";

export type SessionContent = Omit<Session, "id" | "dayOfWeek" | "source">;

const RPE: Record<string, RpeBand> = {
  easy: { min: 2, max: 3 },
  steady: { min: 4, max: 5 },
  threshold: { min: 6, max: 7 },
  vo2: { min: 8, max: 9 },
  rep: { min: 8, max: 9 },
};

function mid(range: PaceRange): number {
  return (range.minSecPerKm + range.maxSecPerKm) / 2;
}

function stepDistance(step: WorkoutStep): number {
  if (step.distanceMeters) return step.distanceMeters;
  if (step.durationSeconds && step.targetPaceSecPerKm) {
    return distanceForTime(mid(step.targetPaceSecPerKm), step.durationSeconds);
  }
  return 0;
}

function stepDuration(step: WorkoutStep): number {
  if (step.durationSeconds) return step.durationSeconds;
  if (step.distanceMeters && step.targetPaceSecPerKm) {
    return timeForDistance(mid(step.targetPaceSecPerKm), step.distanceMeters);
  }
  return 0;
}

function assemble(
  type: SessionType,
  title: string,
  description: string,
  intensity: Session["intensity"],
  steps: WorkoutStep[],
  targetRpe?: RpeBand,
): SessionContent {
  const estimatedDurationSeconds = Math.round(steps.reduce((s, st) => s + stepDuration(st), 0));
  const estimatedDistanceMeters = Math.round(steps.reduce((s, st) => s + stepDistance(st), 0));
  return {
    type,
    title,
    description,
    intensity,
    estimatedDurationSeconds,
    estimatedDistanceMeters: estimatedDistanceMeters > 0 ? estimatedDistanceMeters : undefined,
    steps,
    targetRpe,
  };
}

function warmup(paces: TrainingPaces, minutes: number, withStrides: boolean): WorkoutStep {
  return {
    kind: "warmup",
    label: withStrides
      ? "Easy jog, dynamic leg swings/drills, then 4–6 progressive strides"
      : "Easy jog and dynamic mobility (leg swings, ankle/calf activation)",
    durationSeconds: minutes * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  };
}

function cooldown(paces: TrainingPaces, minutes: number): WorkoutStep {
  return {
    kind: "cooldown",
    label: "Easy jog to finish",
    durationSeconds: minutes * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  };
}

export function easyRun(
  paces: TrainingPaces,
  minutes: number,
  withStrides = false,
): SessionContent {
  const steps: WorkoutStep[] = [
    {
      kind: "steady",
      label: "Conversational easy running (below the first threshold)",
      durationSeconds: minutes * 60,
      targetPaceSecPerKm: paces.easy,
      targetRpe: RPE.easy,
    },
  ];
  if (withStrides) {
    steps.push({
      kind: "rep",
      label: "6 × 20s relaxed strides, full recovery",
      durationSeconds: 6 * 20,
      targetPaceSecPerKm: paces.rep,
      targetRpe: RPE.rep,
      repeatCount: 6,
    });
  }
  return assemble(
    withStrides ? "strides" : "easy",
    withStrides ? `${minutes}′ easy + strides` : `${minutes}′ easy run`,
    "Foundation aerobic running. Easy means easy — it should feel conversational.",
    "easy",
    steps,
    RPE.easy,
  );
}

export function recoveryRun(paces: TrainingPaces, minutes: number): SessionContent {
  return assemble(
    "recovery",
    `${minutes}′ recovery jog`,
    "Very easy shakeout to promote recovery. Optional — walk or rest if tired.",
    "easy",
    [
      {
        kind: "steady",
        label: "Very easy jog",
        durationSeconds: minutes * 60,
        targetPaceSecPerKm: paces.easy,
        targetRpe: { min: 1, max: 2 },
      },
    ],
    { min: 1, max: 2 },
  );
}

export type LongRunOptions = {
  steadyFinishMin?: number;
  racePace?: PaceRange;
  raceBlockMin?: number;
};

export function longRun(
  paces: TrainingPaces,
  minutes: number,
  opts: LongRunOptions = {},
): SessionContent {
  const steps: WorkoutStep[] = [];
  const easyMin = minutes - (opts.steadyFinishMin ?? 0) - (opts.raceBlockMin ?? 0);
  steps.push({
    kind: "steady",
    label: "Easy aerobic running — build durability",
    durationSeconds: Math.max(0, easyMin) * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  });
  let description =
    "Long run develops durability: holding economy and mechanics under accumulated fatigue.";
  if (opts.raceBlockMin && opts.racePace) {
    steps.push({
      kind: "steady",
      label: "Race-specific block at goal effort (run while already fatigued)",
      durationSeconds: opts.raceBlockMin * 60,
      targetPaceSecPerKm: opts.racePace,
      targetRpe: RPE.steady,
    });
    description += " Includes a race-specific block late in the run.";
  }
  if (opts.steadyFinishMin) {
    steps.push({
      kind: "steady",
      label: "Steady progressive finish",
      durationSeconds: opts.steadyFinishMin * 60,
      targetPaceSecPerKm: paces.steady,
      targetRpe: RPE.steady,
    });
    description += " Finishes steady, not as a race.";
  }
  return assemble("long", `${minutes}′ long run`, description, "easy", steps, RPE.easy);
}

// ---- Threshold ------------------------------------------------------------

type ThresholdFormat = { title: string; build: (p: TrainingPaces) => WorkoutStep[] };

const THRESHOLD_FORMATS: ThresholdFormat[] = [
  {
    title: "3 × 8′ threshold / 2′ jog",
    build: (p) =>
      reps(
        3,
        { durationSeconds: 8 * 60, pace: p.threshold },
        { durationSeconds: 2 * 60, pace: p.easy },
      ),
  },
  {
    title: "4 × 6′ threshold / 90″ jog",
    build: (p) =>
      reps(
        4,
        { durationSeconds: 6 * 60, pace: p.threshold },
        { durationSeconds: 90, pace: p.easy },
      ),
  },
  {
    title: "25′ continuous tempo",
    build: (p) => [
      {
        kind: "steady",
        label: "Continuous controlled tempo",
        durationSeconds: 25 * 60,
        targetPaceSecPerKm: p.threshold,
        targetRpe: RPE.threshold,
      },
    ],
  },
  {
    title: "5 × 1 mile cruise / 90″ jog",
    build: (p) =>
      reps(
        5,
        { distanceMeters: 1609.344, pace: p.threshold },
        { durationSeconds: 90, pace: p.easy },
      ),
  },
];

export function thresholdSession(paces: TrainingPaces, variant: number): SessionContent {
  const fmt = THRESHOLD_FORMATS[variant % THRESHOLD_FORMATS.length]!;
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble(
    "threshold",
    fmt.title,
    "Controlled but demanding (RPE 6–7). You should finish knowing you could do one more rep.",
    "moderate",
    steps,
    RPE.threshold,
  );
}

// ---- VO2 / high-intensity intervals --------------------------------------

const VO2_FORMATS: ThresholdFormat[] = [
  {
    title: "5 × 3′ hard / 2′ easy",
    build: (p) =>
      reps(5, { durationSeconds: 3 * 60, pace: p.vo2 }, { durationSeconds: 2 * 60, pace: p.easy }),
  },
  {
    title: "4 × 4′ hard / 3′ easy",
    build: (p) =>
      reps(4, { durationSeconds: 4 * 60, pace: p.vo2 }, { durationSeconds: 3 * 60, pace: p.easy }),
  },
  {
    title: "6 × 800m / 2′ easy",
    build: (p) =>
      reps(6, { distanceMeters: 800, pace: p.vo2 }, { durationSeconds: 2 * 60, pace: p.easy }),
  },
  {
    title: "10 × 1′ hard / 1′ easy (introductory)",
    build: (p) =>
      reps(10, { durationSeconds: 60, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }),
  },
];

export function vo2Session(paces: TrainingPaces, variant: number): SessionContent {
  const fmt = VO2_FORMATS[variant % VO2_FORMATS.length]!;
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble(
    "vo2",
    fmt.title,
    "Accumulate ~12–20′ of quality hard running (RPE 8–9). Purpose is quality work, not winning rep one.",
    "hard",
    steps,
    RPE.vo2,
  );
}

// ---- Race-specific --------------------------------------------------------

export function raceSpecificSession(paces: TrainingPaces): SessionContent {
  const steps = [
    warmup(paces, 15, true),
    ...reps(
      3,
      { durationSeconds: 10 * 60, pace: paces.goalRace },
      { durationSeconds: 2 * 60, pace: paces.easy },
    ),
    cooldown(paces, 10),
  ];
  return assemble(
    "race-specific",
    "3 × 10′ at goal race pace / 2′ jog",
    "Rehearse goal race pace and rhythm. Controlled, repeatable, race-like.",
    "moderate",
    steps,
    RPE.steady,
  );
}

// ---- Strength / mobility / cross-training / rest --------------------------

export function strengthSession(phase: Phase, maintenance: boolean): SessionContent {
  const heavy = !maintenance && (phase === "build" || phase === "peak");
  const setsReps = maintenance
    ? "1–2 sets × 4–6 reps (maintenance)"
    : heavy
      ? "2–4 sets × 3–6 reps, heavy but controlled (~80%+ 1RM)"
      : "2–3 sets × 6–8 reps, technique focus";
  const exercises = [
    "Squat / trap-bar deadlift / leg press",
    "Split squat or rear-foot-elevated split squat",
    "Romanian deadlift (hip hinge)",
    "Straight-knee calf raise",
    "Bent-knee (soleus) calf raise",
    "Step-ups / single-leg work",
    "Trunk anti-rotation / anti-extension",
  ];
  const minutes = maintenance ? 30 : 45;
  return assemble(
    "strength",
    maintenance ? "Strength (maintenance)" : "Strength (heavy)",
    `${setsReps}. ${exercises.join("; ")}. Keep total volume low — running already supplies fatigue.`,
    "none",
    [
      {
        kind: "steady",
        label: "Runner-focused resistance session",
        durationSeconds: minutes * 60,
        targetRpe: RPE.threshold,
      },
    ],
  );
}

export function mobilitySession(): SessionContent {
  return assemble(
    "mobility",
    "Mobility (15′)",
    "Dynamic mobility and any sport-specific range work. Static stretching only for a specific restriction — it does not improve economy.",
    "none",
    [{ kind: "steady", label: "Dynamic mobility", durationSeconds: 15 * 60 }],
  );
}

export function crossTraining(minutes: number): SessionContent {
  return assemble(
    "cross-training",
    `${minutes}′ cross-training`,
    "Low-impact aerobic work (bike/pool/elliptical) to maintain fitness while sparing the injury.",
    "easy",
    [
      {
        kind: "steady",
        label: "Low-impact aerobic",
        durationSeconds: minutes * 60,
        targetRpe: RPE.easy,
      },
    ],
  );
}

export function restDay(): SessionContent {
  return assemble(
    "rest",
    "Rest",
    "Rest or gentle recovery activity. Recovery is part of the programme.",
    "none",
    [],
  );
}

// ---- helpers --------------------------------------------------------------

type RepSpec = { durationSeconds?: number; distanceMeters?: number; pace: PaceRange };

function reps(count: number, work: RepSpec, recovery: RepSpec): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  const workLabel = work.distanceMeters
    ? `${Math.round(work.distanceMeters)}m rep`
    : `${Math.round(((work.durationSeconds ?? 0) / 60) * 10) / 10}′ rep`;
  for (let i = 1; i <= count; i++) {
    steps.push({
      kind: "rep",
      label: workLabel,
      durationSeconds: work.durationSeconds,
      distanceMeters: work.distanceMeters,
      targetPaceSecPerKm: work.pace,
      repeatIndex: i,
      repeatCount: count,
    });
    if (i < count) {
      steps.push({
        kind: "recovery",
        label: "Easy jog recovery",
        durationSeconds: recovery.durationSeconds,
        distanceMeters: recovery.distanceMeters,
        targetPaceSecPerKm: recovery.pace,
      });
    }
  }
  return steps;
}
