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
  StrengthExercise,
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

// A softer opening/closing for easy & long runs — same easy pace as the run itself, just a labelled
// "ease in" and "ease down" so every session shares a warm-up → main → cool-down shape (which also
// gives the live session and voice coaching a consistent start and finish).
function easeIn(paces: TrainingPaces, minutes: number): WorkoutStep {
  return {
    kind: "warmup",
    label: "Ease in — start gently and let the pace come to you",
    durationSeconds: minutes * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  };
}
function easeDown(paces: TrainingPaces, minutes: number): WorkoutStep {
  return {
    kind: "cooldown",
    label: "Ease down — relax the pace and let your breathing settle",
    durationSeconds: minutes * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  };
}
/** Split a continuous run's minutes into ease-in / main / ease-down blocks. Runs under 10′ are left
 *  as a single block (too short to frame meaningfully). `buildMiddle` fills the main portion. */
function framedRun(
  paces: TrainingPaces,
  totalMin: number,
  buildMiddle: (midMin: number) => WorkoutStep[],
): WorkoutStep[] {
  if (totalMin < 10) return buildMiddle(totalMin);
  const warm = Math.min(6, Math.max(3, Math.round(totalMin * 0.14)));
  const cool = Math.min(4, Math.max(2, Math.round(totalMin * 0.1)));
  return [easeIn(paces, warm), ...buildMiddle(Math.max(1, totalMin - warm - cool)), easeDown(paces, cool)];
}

export function easyRun(
  paces: TrainingPaces,
  minutes: number,
  withStrides = false,
): SessionContent {
  const strides: WorkoutStep = {
    kind: "rep",
    label: "6 × 20s relaxed strides, full recovery",
    durationSeconds: 6 * 20,
    targetPaceSecPerKm: paces.rep,
    targetRpe: RPE.rep,
    repeatCount: 6,
  };
  const steps = framedRun(paces, minutes, (mid) => [
    {
      kind: "steady",
      label: "Conversational easy running (below the first threshold)",
      durationSeconds: mid * 60,
      targetPaceSecPerKm: paces.easy,
      targetRpe: RPE.easy,
    },
    // Relaxed strides come after the easy portion, before the ease-down jog to finish.
    ...(withStrides ? [strides] : []),
  ]);
  return assemble(
    withStrides ? "strides" : "easy",
    withStrides ? `${minutes}′ easy + strides` : `${minutes}′ easy run`,
    "Foundation aerobic running. Ease in, settle into a conversational rhythm, then ease down to finish.",
    "easy",
    steps,
    RPE.easy,
  );
}

// ---- Beginner run–walk ----------------------------------------------------

function clock(sec: number): string {
  if (sec % 60 === 0) return `${sec / 60}′`;
  if (sec < 60) return `${sec}″`;
  return `${Math.floor(sec / 60)}′${sec % 60 ? String(sec % 60).padStart(2, "0") + "″" : ""}`;
}

export type BeginnerSpec = { runSec: number; walkSec: number; targetRunMin: number };

const r15 = (s: number) => Math.max(30, Math.round(s / 15) * 15);
const clampN = (n: number, a: number, b: number) => Math.max(a, Math.min(b, n));

// Build a run–walk session from a list of run-block durations (walks between). Runs are easy by feel.
function assembleRunWalk(
  paces: TrainingPaces,
  runBlocks: number[],
  walkSec: number,
  title: string,
  desc: string,
  extra: WorkoutStep[] = [],
): SessionContent {
  const steps: WorkoutStep[] = [
    { kind: "warmup", label: "Brisk walk to warm up", durationSeconds: 5 * 60, targetRpe: { min: 1, max: 2 } },
  ];
  runBlocks.forEach((rs, i) => {
    steps.push({
      kind: "rep",
      label: `Run ${clock(rs)} — easy, conversational`,
      durationSeconds: rs,
      targetPaceSecPerKm: paces.easy,
      targetRpe: { min: 3, max: 4 },
      repeatIndex: i + 1,
      repeatCount: runBlocks.length,
    });
    if (i < runBlocks.length - 1) {
      steps.push({ kind: "recovery", label: `Walk ${clock(walkSec)} — recover`, durationSeconds: walkSec, targetRpe: { min: 1, max: 2 } });
    }
  });
  steps.push(...extra);
  steps.push({ kind: "cooldown", label: "Easy walk to finish", durationSeconds: 3 * 60, targetRpe: { min: 1, max: 2 } });
  return assemble("easy", title, desc, "easy", steps, { min: 2, max: 4 });
}

// ---- Beginner run–walk flavours (rotate for variety) ----------------------

export function rwSteady(p: TrainingPaces, s: BeginnerSpec): SessionContent {
  const cycles = clampN(Math.round((s.targetRunMin * 60) / s.runSec), 4, 10);
  return assembleRunWalk(
    p,
    Array(cycles).fill(s.runSec),
    s.walkSec,
    `Run–walk · ${cycles} × (${clock(s.runSec)} run / ${clock(s.walkSec)} walk)`,
    "Alternate easy running and walking. Run at a comfortable, chatty effort — walk breaks are part of the plan, not a failure.",
  );
}

export function rwLadder(p: TrainingPaces, s: BeginnerSpec): SessionContent {
  let shape = [0.5, 0.75, 1, 1.3, 1, 0.75, 0.5].map((m) => r15(s.runSec * m));
  const k = (s.targetRunMin * 60) / shape.reduce((a, c) => a + c, 0);
  shape = shape.map((x) => r15(x * k));
  return assembleRunWalk(
    p,
    shape,
    s.walkSec,
    "Run–walk ladder — build up, then back down",
    "A ladder: the run blocks grow to a peak in the middle, then ease back down. It keeps your mind busy and gently stretches your limit. Walk whenever you need.",
  );
}

export function rwExplore(p: TrainingPaces, s: BeginnerSpec): SessionContent {
  const block = r15(s.runSec * 1.6);
  const cycles = clampN(Math.round((s.targetRunMin * 60) / block), 3, 6);
  return assembleRunWalk(
    p,
    Array(cycles).fill(block),
    s.walkSec + 15,
    "Explore run–walk — by feel",
    "Forget the stopwatch: run easy to a landmark — a tree, a bench, a lamppost — then walk to the next and repeat. Pick a route you enjoy; keep the effort easy and chatty.",
  );
}

export function rwBuildup(p: TrainingPaces, s: BeginnerSpec): SessionContent {
  const n = clampN(Math.round((s.targetRunMin * 60) / s.runSec), 4, 8);
  const blocks: number[] = [];
  for (let i = 0; i < n; i++) blocks.push(r15(s.runSec * (0.6 + 0.8 * (n <= 1 ? 1 : i / (n - 1)))));
  return assembleRunWalk(
    p,
    blocks,
    s.walkSec,
    "Build-up run–walk — finish stronger",
    "Start with the shortest runs and let them grow through the session. You'll finish feeling like you had more to give — the best way to end a run.",
  );
}

export function rwLong(p: TrainingPaces, s: BeginnerSpec): SessionContent {
  const block = r15(s.runSec * 1.4);
  const cycles = clampN(Math.round((s.targetRunMin * 60) / block), 4, 8);
  return assembleRunWalk(
    p,
    Array(cycles).fill(block),
    s.walkSec,
    `Long run–walk · ${cycles} × (${clock(block)} run / ${clock(s.walkSec)} walk)`,
    "Your longest, easiest session of the week. Keep the runs relaxed — finishing comfortably is the whole goal.",
  );
}

// ---- Beginner continuous flavours (for those who can already jog) ----------

export function contPickups(p: TrainingPaces, min: number): SessionContent {
  const pickups: WorkoutStep = { kind: "rep", label: "4 × 15″ relaxed pickups (smooth, not a sprint), walk/jog to recover", durationSeconds: 4 * 15, targetPaceSecPerKm: p.steady, targetRpe: { min: 4, max: 5 }, repeatCount: 4 };
  const steps = framedRun(p, min, (mid) => [
    { kind: "steady", label: "Easy, conversational running", durationSeconds: mid * 60, targetPaceSecPerKm: p.easy, targetRpe: RPE.easy },
    pickups,
  ]);
  return assemble("easy", `${min}′ easy + gentle pickups`, "Easy running with a few short, relaxed pickups to wake the legs up — smooth and controlled, never a sprint — then ease down to finish.", "easy", steps, RPE.easy);
}

export function contProgression(p: TrainingPaces, min: number): SessionContent {
  const steps = framedRun(p, min, (mid) => {
    const steady = Math.min(5, Math.max(1, mid - 1));
    const easy = Math.max(1, mid - steady);
    return [
      { kind: "steady", label: "Easy, conversational", durationSeconds: easy * 60, targetPaceSecPerKm: p.easy, targetRpe: RPE.easy },
      { kind: "steady", label: "Lift to a comfortable steady effort", durationSeconds: steady * 60, targetPaceSecPerKm: p.steady, targetRpe: RPE.steady },
    ];
  });
  return assemble("easy", `${min}′ easy → steady finish`, "Ease in, run easy, then lift to a comfortable steady effort before easing down. Still controlled — you should be able to talk in short sentences.", "easy", steps, RPE.easy);
}

export function contExplore(p: TrainingPaces, min: number): SessionContent {
  const steps = framedRun(p, min, (mid) => [
    { kind: "steady", label: "Easy running by feel", durationSeconds: mid * 60, targetPaceSecPerKm: p.easy, targetRpe: RPE.easy },
  ]);
  return assemble(
    "easy",
    `${min}′ explore run — by feel`,
    "Run a route you enjoy at an easy, chatty effort. Ease in, explore by feel, then ease down — just time on feet and fresh scenery.",
    "easy",
    steps,
    RPE.easy,
  );
}

// Easy run finished with short, sharp uphill sprints — big neuromuscular benefit, minimal fatigue.
export function easyHillStrides(paces: TrainingPaces, minutes: number): SessionContent {
  const hills: WorkoutStep = { kind: "rep", label: "6 × 10″ hill sprints — short and powerful, full walk-back recovery", durationSeconds: 6 * 10, targetRpe: { min: 7, max: 8 }, repeatCount: 6 };
  const steps = framedRun(paces, minutes, (mid) => [
    { kind: "steady", label: "Easy, conversational running", durationSeconds: mid * 60, targetPaceSecPerKm: paces.easy, targetRpe: RPE.easy },
    hills,
  ]);
  return assemble(
    "strides",
    `${minutes}′ easy + hill sprints`,
    "Easy running plus a handful of short, sharp uphill sprints — big power and economy benefit for very little fatigue — then ease down to finish. Full recovery between; quality, not burn.",
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
  const finishMin = (opts.steadyFinishMin ?? 0) + (opts.raceBlockMin ?? 0);
  const warm = Math.min(8, Math.max(4, Math.round(minutes * 0.1)));
  const cool = Math.min(6, Math.max(3, Math.round(minutes * 0.08)));
  const mainEasy = Math.max(1, minutes - finishMin - warm - cool);
  const steps: WorkoutStep[] = [
    easeIn(paces, warm),
    {
      kind: "steady",
      label: "Easy aerobic running — build durability",
      durationSeconds: mainEasy * 60,
      targetPaceSecPerKm: paces.easy,
      targetRpe: RPE.easy,
    },
  ];
  let description =
    "Long run develops durability: holding economy and mechanics under accumulated fatigue. Ease in, hold an easy rhythm, then ease down to finish.";
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
  steps.push(easeDown(paces, cool));
  return assemble("long", `${minutes}′ long run`, description, "easy", steps, RPE.easy);
}

// ---- Threshold (incl. tempo, cruise, fartlek) -----------------------------

type QualityFormat = { title: string; desc?: string; build: (p: TrainingPaces) => WorkoutStep[] };

const THRESHOLD_DESC =
  "Controlled but demanding (RPE 6–7). You should finish knowing you could do one more rep.";

const THRESHOLD_FORMATS: QualityFormat[] = [
  {
    title: "3 × 8′ threshold / 2′ jog",
    build: (p) =>
      reps(3, { durationSeconds: 8 * 60, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }),
  },
  {
    title: "4 × 6′ threshold / 90″ jog",
    build: (p) =>
      reps(4, { durationSeconds: 6 * 60, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }),
  },
  {
    title: "25′ continuous tempo",
    desc: "One controlled, continuous tempo effort (RPE 6–7) — comfortably hard, steady rhythm start to finish.",
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
      reps(5, { distanceMeters: 1609.344, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }),
  },
  {
    title: "2 × 15′ threshold / 3′ float",
    desc: "Two long threshold blocks (RPE 6–7) with an easy float between — builds the ability to hold effort.",
    build: (p) =>
      reps(2, { durationSeconds: 15 * 60, pace: p.threshold }, { durationSeconds: 3 * 60, pace: p.steady }),
  },
  {
    title: "6 × 1 km cruise / 60″ jog",
    build: (p) =>
      reps(6, { distanceMeters: 1000, pace: p.threshold }, { durationSeconds: 60, pace: p.easy }),
  },
  {
    title: "Threshold fartlek: 6 × 3′ brisk / 2′ easy",
    desc: "Fartlek — run the brisk blocks by feel at a controlled-hard effort (RPE 6–7), easy in between. Keep it playful and rolling; the clock is a guide, not a cage.",
    build: (p) =>
      reps(6, { durationSeconds: 3 * 60, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }),
  },
  {
    title: "Progression tempo: 10′ steady → 10′ threshold",
    desc: "Start steady and lift into threshold for the second half — a controlled progression, finishing strong but never sprinting.",
    build: (p) => [
      { kind: "steady", label: "Steady build", durationSeconds: 10 * 60, targetPaceSecPerKm: p.steady, targetRpe: RPE.steady },
      { kind: "steady", label: "Lift to threshold", durationSeconds: 10 * 60, targetPaceSecPerKm: p.threshold, targetRpe: RPE.threshold },
    ],
  },
];

export function thresholdSession(paces: TrainingPaces, variant: number): SessionContent {
  const fmt = THRESHOLD_FORMATS[variant % THRESHOLD_FORMATS.length]!;
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("threshold", fmt.title, fmt.desc ?? THRESHOLD_DESC, "moderate", steps, RPE.threshold);
}

// ---- VO2 / high-intensity (incl. hills, pyramids, fartlek) -----------------

const VO2_DESC =
  "Accumulate ~12–20′ of quality hard running (RPE 8–9). Purpose is quality work, not winning rep one.";

// A pyramid: rep length ramps up then back down, with equal easy recoveries.
function pyramid(p: TrainingPaces): WorkoutStep[] {
  const durs = [60, 120, 180, 120, 60];
  const steps: WorkoutStep[] = [];
  durs.forEach((d, i) => {
    steps.push({
      kind: "rep",
      label: `${Math.round((d / 60) * 10) / 10}′ hard`,
      durationSeconds: d,
      targetPaceSecPerKm: p.vo2,
      targetRpe: RPE.vo2,
      repeatIndex: i + 1,
      repeatCount: durs.length,
    });
    if (i < durs.length - 1) {
      steps.push({ kind: "recovery", label: "Equal easy jog", durationSeconds: d, targetPaceSecPerKm: p.easy });
    }
  });
  return steps;
}

// Hill reps — effort-based (no flat pace target); pace on a hill is meaningless, RPE is the guide.
function hillReps(count: number, workSec: number): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  for (let i = 1; i <= count; i++) {
    steps.push({
      kind: "rep",
      label: `${workSec}″ uphill — strong, tall, driving`,
      durationSeconds: workSec,
      targetRpe: RPE.vo2,
      repeatIndex: i,
      repeatCount: count,
    });
    if (i < count) steps.push({ kind: "recovery", label: "Jog/walk down to recover", durationSeconds: workSec + 30 });
  }
  return steps;
}

// Mona fartlek: descending hard surges (90/60/30/15s) with equal floats, run twice through.
function monaFartlek(p: TrainingPaces): WorkoutStep[] {
  const set = [90, 60, 30, 15];
  const steps: WorkoutStep[] = [];
  for (let r = 0; r < 2; r++) {
    for (const d of set) {
      steps.push({ kind: "rep", label: `${d}″ hard`, durationSeconds: d, targetPaceSecPerKm: p.vo2, targetRpe: RPE.vo2 });
      steps.push({ kind: "recovery", label: `${d}″ float (not a full rest)`, durationSeconds: d, targetPaceSecPerKm: p.steady });
    }
  }
  return steps;
}

const VO2_FORMATS: QualityFormat[] = [
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
    title: "10 × 1′ hard / 1′ easy",
    build: (p) =>
      reps(10, { durationSeconds: 60, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }),
  },
  {
    title: "12 × 400m / 60″ jog",
    build: (p) =>
      reps(12, { distanceMeters: 400, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }),
  },
  {
    title: "5 × 1000m / 90″ jog",
    build: (p) =>
      reps(5, { distanceMeters: 1000, pace: p.vo2 }, { durationSeconds: 90, pace: p.easy }),
  },
  {
    title: "VO₂ pyramid: 1–2–3–2–1′ / equal easy",
    desc: "A pyramid — ramp rep length up then back down, equal easy recovery. Same hard effort (RPE 8–9) throughout; it plays with rhythm and keeps the mind engaged.",
    build: (p) => pyramid(p),
  },
  {
    title: "Hill reps: 8 × 60″ uphill / jog down",
    desc: "Find a moderate hill. Drive up strong and tall for 60″ at a hard effort (RPE 8–9), jog down to recover. Hills build power and economy with less impact — go by effort, not pace.",
    build: () => hillReps(8, 60),
  },
  {
    title: "Mona fartlek: 2 × (90/60/30/15″ hard, equal float)",
    desc: "The classic Mona fartlek — descending hard surges with equal-length floats (not full rest). Continuous and rhythmic, hard by feel. A fun, varied way to hit VO₂.",
    build: (p) => monaFartlek(p),
  },
];

export function vo2Session(paces: TrainingPaces, variant: number): SessionContent {
  const fmt = VO2_FORMATS[variant % VO2_FORMATS.length]!;
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("vo2", fmt.title, fmt.desc ?? VO2_DESC, "hard", steps, RPE.vo2);
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

// Exercise catalog: name, target muscles, movement pattern (for the demo animation) and a form cue.
// `anim` is the slug of a looping demonstration animation (assets/exercise-animations/<slug>.webp),
// inlined into the app at build time; the UI falls back to the schematic figure when it's absent.
type ExDef = { name: string; primary: string; secondary: string[]; pattern: string; cue: string; anim?: string };
const EX: Record<string, ExDef> = {
  squat: { name: "Goblet / bodyweight squat", primary: "Quads", secondary: ["Glutes", "Core"], pattern: "squat", anim: "goblet-squat", cue: "Sit your hips back and down, knees tracking over your toes, chest tall. Drive up through your heels." },
  stepUp: { name: "Step-up", primary: "Quads", secondary: ["Glutes"], pattern: "squat", anim: "step-up", cue: "Drive through the top foot to stand tall, then lower with control. Start with a low step." },
  splitSquat: { name: "Split squat", primary: "Quads", secondary: ["Glutes"], pattern: "lunge", anim: "split-squat-dumbbell", cue: "Feet split front-to-back. Lower straight down, front knee over the foot; push back up." },
  lunge: { name: "Reverse lunge", primary: "Quads", secondary: ["Glutes", "Core"], pattern: "lunge", anim: "reverse-lunge", cue: "Step back and lower the back knee toward the floor; push through the front heel to return." },
  rdl: { name: "Romanian deadlift", primary: "Hamstrings", secondary: ["Glutes", "Lower back"], pattern: "hinge", anim: "romanian-deadlift-dumbbell", cue: "Soft knees, push your hips back with a flat back until you feel the hamstrings, then stand tall." },
  gluteBridge: { name: "Glute bridge", primary: "Glutes", secondary: ["Hamstrings"], pattern: "bridge", anim: "glute-bridge", cue: "Drive your hips up by squeezing your glutes, pause at the top, lower slowly." },
  clamshell: { name: "Clamshell", primary: "Glutes", secondary: ["Hips"], pattern: "bridge", anim: "clamshell", cue: "On your side, knees bent, lift the top knee while keeping your feet together and hips still." },
  calf: { name: "Calf raise", primary: "Calves", secondary: [], pattern: "calf", anim: "standing-calf-raise", cue: "Rise onto the balls of your feet, pause at the top, lower slowly under control." },
  soleus: { name: "Bent-knee calf raise", primary: "Soleus", secondary: ["Calves"], pattern: "calf", anim: "single-leg-standing-calf-raise", cue: "Same as a calf raise but with knees slightly bent, to reach the deeper soleus muscle." },
  plank: { name: "Plank + side plank", primary: "Core", secondary: ["Shoulders"], pattern: "plank", anim: "plank", cue: "Straight line from head to heels. Brace your abs and glutes; don't let the hips sag." },
  deadbug: { name: "Dead bug", primary: "Core", secondary: [], pattern: "core", anim: "dead-bug", cue: "On your back, slowly lower an opposite arm and leg while keeping your lower back pressed down." },
  birddog: { name: "Bird-dog", primary: "Core", secondary: ["Glutes"], pattern: "core", anim: "bird-dog", cue: "On hands and knees, extend an opposite arm and leg, stay level, then switch sides." },
  balance: { name: "Single-leg balance", primary: "Ankles", secondary: ["Core"], pattern: "balance", cue: "Stand tall on one leg and stay steady. Progress by closing your eyes or standing on something soft." },
  pushup: { name: "Push-up (incline if needed)", primary: "Chest", secondary: ["Triceps", "Core"], pattern: "push", anim: "push-up", cue: "Hands under shoulders, body in a straight line. Lower with control, then press away." },
  pogo: { name: "Pogo hops", primary: "Calves", secondary: [], pattern: "jump", anim: "pogo-hops", cue: "Small, springy hops off the balls of your feet — stiff ankles, minimal time on the ground." },
  boxjump: { name: "Box / hurdle jump", primary: "Quads", secondary: ["Glutes", "Calves"], pattern: "jump", anim: "box-jump", cue: "Explode up, land soft and quiet with bent knees. Full recovery between jumps — quality over fatigue." },
};

function mkEx(key: string, sets: number, reps: string): StrengthExercise {
  const d = EX[key]!;
  return { name: d.name, primary: d.primary, secondary: d.secondary, pattern: d.pattern, anim: d.anim, cue: d.cue, sets, reps };
}

const STRENGTH_THEMES: { title: string; keys: string[] }[] = [
  { title: "Strength & mobility · legs", keys: ["squat", "lunge", "gluteBridge", "calf"] },
  { title: "Strength & mobility · core & balance", keys: ["plank", "deadbug", "balance", "birddog"] },
  { title: "Strength & mobility · activation", keys: ["gluteBridge", "clamshell", "calf", "balance"] },
  { title: "Strength & mobility · full body", keys: ["squat", "stepUp", "pushup", "gluteBridge", "plank"] },
];
// Beginner rep prescriptions (default 8–12 reps at 2 easy sets).
const BEGINNER_REPS: Record<string, string> = { plank: "20–40s hold", balance: "30s each leg", deadbug: "8 each side", birddog: "8 each side", clamshell: "12 each side", calf: "12–15", gluteBridge: "10–12" };

export function generalStrengthSession(theme = 0): SessionContent {
  const t = STRENGTH_THEMES[theme % STRENGTH_THEMES.length]!;
  const exercises = t.keys.map((k) => mkEx(k, 2, BEGINNER_REPS[k] ?? "8–12"));
  const content = assemble(
    "strength",
    `${t.title} (20′)`,
    "A gentle, no-equipment routine to build the strength that protects you from injury. 1–2 easy sets each, stopping well before failure — this is support work, not a workout to survive. Tap an exercise below for how to do it.",
    "none",
    [{ kind: "steady", label: "Bodyweight strength & mobility", durationSeconds: 20 * 60, targetRpe: { min: 2, max: 4 } }],
  );
  return { ...content, exercises };
}

export function strengthSession(phase: Phase, maintenance: boolean): SessionContent {
  const heavy = !maintenance && (phase === "build" || phase === "peak");
  const sets = maintenance ? 2 : heavy ? 3 : 2;
  const reps = maintenance ? "4–6" : heavy ? "3–6 (heavy)" : "6–8";
  const exercises = [
    mkEx("squat", sets, reps),
    mkEx("splitSquat", sets, reps),
    mkEx("rdl", sets, reps),
    mkEx("calf", sets, "8–12"),
    mkEx("soleus", sets, "8–12"),
    mkEx("stepUp", sets, reps),
    mkEx("plank", Math.max(1, sets - 1), "30–45s hold"),
  ];
  // Plyometrics only in build/peak — added once faster running is tolerated without a delayed reaction.
  if (heavy) { exercises.push(mkEx("pogo", 2, "8–10"), mkEx("boxjump", 2, "3–5")); }
  const minutes = maintenance ? 30 : 45;
  const desc = maintenance
    ? "Maintenance strength near your race — keep the movements, drop the volume. Tap an exercise for how to do it and to log your weights."
    : heavy
      ? "Heavy but controlled (~80%+ 1RM), low reps — the best-evidenced way to build economy and durability. Keep total volume low; running already supplies fatigue. Tap an exercise for how to do it and to log your weights."
      : "Technique-focused strength to build a base. Moderate load, clean form. Tap an exercise for how to do it and to log your weights.";
  const content = assemble(
    "strength",
    maintenance ? "Strength (maintenance)" : heavy ? "Strength (heavy)" : "Strength (technique)",
    desc,
    "none",
    [{ kind: "steady", label: "Runner-focused resistance session", durationSeconds: minutes * 60, targetRpe: RPE.threshold }],
  );
  return { ...content, exercises };
}

const MOBILITY_THEMES: { title: string; d: string }[] = [
  { title: "Mobility flow (15′)", d: "A flowing dynamic mobility routine — hips, ankles and upper back. Move slowly and breathe." },
  { title: "Hips & ankles (15′)", d: "Targeted mobility for the two areas runners need most — hip openers and ankle/calf range." },
  { title: "Foam roll & reset (15′)", d: "Gentle foam rolling and easy stretches for any tight spot. A nice reset between runs." },
];

export function mobilitySession(theme = 0): SessionContent {
  const t = MOBILITY_THEMES[theme % MOBILITY_THEMES.length]!;
  return assemble(
    "mobility",
    t.title,
    `${t.d} Static stretching only for a specific restriction — it does not improve economy.`,
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
