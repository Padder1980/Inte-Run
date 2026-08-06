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
  RaceDistanceKey,
  RpeBand,
  Session,
  SessionType,
  StrengthExercise,
  TrainingPaces,
  WorkoutStep,
} from "../domain/types.ts";
import { distanceForTime, RACE_DISTANCES_M, timeForDistance } from "../domain/units.ts";
// ⚠️ One definition of what counts as training, shared with the intensity model — see steps.ts.
import { isPreparationStep } from "../domain/steps.ts";

export type SessionContent = Omit<Session, "id" | "dayOfWeek" | "source">;

const RPE = {
  easy: { min: 2, max: 3 },
  aerobic: { min: 3, max: 4 },
  steady: { min: 4, max: 5 },
  tempo: { min: 5, max: 6 },
  threshold: { min: 6, max: 7 },
  cv: { min: 7, max: 8 },
  vo2: { min: 8, max: 9 },
  rep: { min: 8, max: 9 },
  // Time trials, races and maximal hill sprints. Without this band an honest 10/10 on a parkrun
  // reads as "much harder than intended" and becomes evidence for easing the whole plan off.
  maximal: { min: 9, max: 10 },
} satisfies Record<string, RpeBand>;

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

function trainingStepDistance(step: WorkoutStep): number {
  return isPreparationStep(step) ? 0 : stepDistance(step);
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
  const trainingDistanceMeters = Math.round(steps.reduce((s, st) => s + trainingStepDistance(st), 0));
  return {
    type,
    title,
    description,
    intensity,
    estimatedDurationSeconds,
    estimatedDistanceMeters: estimatedDistanceMeters > 0 ? estimatedDistanceMeters : undefined,
    trainingDistanceMeters: trainingDistanceMeters > 0 ? trainingDistanceMeters : undefined,
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

// A softer opening for easy & long runs — same easy pace as the run itself, just a labelled "ease in"
// so every session shares a consistent start for the live session and the voice coaching.
//
// ⚠️ THERE IS NO LONGER AN `easeDown` COUNTERPART (owner's decision, 2026-08-03). The prescribed
// cool-down jog on the LOW-INTENSITY runs is gone, replaced by the optional stretch session offered on
// the post-run debrief. At the end of an easy run an "ease down" was prescribed at easy pace inside a
// run that was already easy — the same effort under a different label, which is a name for the last
// four minutes rather than a change of anything.
//
// ⚠️ THE HARD SESSIONS KEEP THEIRS, and that is deliberate rather than an oversight. `cooldown()`
// below is still appended by every threshold / VO2 / race-specific pool. Ten minutes of jogging after
// maximal intervals is a genuine change of effort doing genuine work; stepping straight from 5 km pace
// to standing still is not the same proposition as easing off an easy run. The stretch session is
// offered after EVERY run either way, so nothing is taken away from anybody.
function easeIn(paces: TrainingPaces, minutes: number): WorkoutStep {
  return {
    kind: "warmup",
    label: "Ease in — start gently and let the pace come to you",
    durationSeconds: minutes * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  };
}
/** Split a continuous run's minutes into ease-in / main / ease-down blocks. Runs under 10′ are left
 *  as a single block (too short to frame meaningfully). `buildMiddle` fills the main portion. */
/**
 * ⚠️ THE MINUTES NAMED ARE THE WORK, NOT THE WHOLE SESSION (owner's decision, 2026-08-03).
 *
 * He watched a simulation of "38′ moderate run" and saw it spends 29 minutes at moderate: the frame
 * was being taken OUT of the named time. Asked whether to grow the sessions or rename them, he chose
 * to grow them — so `moderateRun(paces, 38)` now delivers 38 minutes at moderate with the warm-up and
 * cool-down on top, and the title finally describes the work the runner is there to do.
 *
 * ⚠️ EVERY SESSION THROUGH HERE THEREFORE GETS LONGER, AND `estimatedDurationSeconds` IS WHAT THE
 * VOLUME MODEL FITS. `targetPeakWeeklyKm` runs `buildAll(vScale)` to a fixed point against the plan it
 * actually produces, so it re-converges on the runner's stated mileage by itself — but that is a claim
 * to MEASURE, not to assume, and `test/volume-anchoring.test.ts` measures it.
 *
 * ⚠️ The warm-up is a flat 5 minutes, not a percentage. Also the owner's call: a standard short
 * warm-up for the low-intensity sessions, with the stretches coming from the warm-up card's mobilise
 * phase rather than from a step here. A proportional warm-up gave a 90-minute long run 6 minutes and a
 * 20-minute recovery jog 3, which is backwards — the long run is the one already warm by minute five.
 */
const FRAME_WARM_MIN = 5;

// ⚠️ NO CLOSING FRAME ANY MORE — see the note on `easeIn`. The named minutes are the WORK, so removing
// the ease-down shortens the OUTING by four minutes and leaves the named time untouched, which is the
// correct pairing: the runner still gets the 38 minutes at moderate the title promises. Training volume
// does not move at all, because `isPreparationStep` never counted a cool-down as load.
function framedRun(
  paces: TrainingPaces,
  workMin: number,
  buildMiddle: (midMin: number) => WorkoutStep[],
): WorkoutStep[] {
  if (workMin < 10) return buildMiddle(workMin);
  return [easeIn(paces, FRAME_WARM_MIN), ...buildMiddle(workMin)];
}

export function easyRun(
  paces: TrainingPaces,
  minutes: number,
  withStrides = false,
): SessionContent {
  // ⚠️ STRIDES ARE SIX REPETITIONS WITH A RECOVERY BETWEEN THEM, NOT ONE BLOCK. They shipped as a
  // single 120-second step labelled "full recovery", which put the recovery in prose and nowhere
  // else. Two consequences, both real: the brief could not state how long the recovery is (the owner
  // asked for it and there was no number to show), and the live session counted through it as two
  // unbroken minutes at repetition pace — 3:49/km for 120 seconds straight, which is not the
  // prescription. Emitted the same way as hillReps and the session builder: one step per repetition,
  // with a recovery between.
  //
  // ⚠️ THE LAST STRIDE NOW GETS A WALK-BACK TOO, and it must. There deliberately was no trailing
  // recovery here "because the ease-down follows" — and then the ease-down was removed (owner, 2026-08-03),
  // which left the session ENDING on a 20-second effort at repetition pace with nothing after it at all.
  // Caught by the delivery sweep, not by eye: an easy run is supposed to finish easy, and a run whose
  // final step is a sprint is both bad coaching and the one case that would have needed a cool-down jog
  // adding back. It is still carved OUT of the easy portion below, so the session's total does not move.
  const STRIDE_SEC = 20, STRIDE_REPS = 6, STRIDE_REC_SEC = 60;
  const strideSteps: WorkoutStep[] = [];
  if (withStrides) {
    for (let i = 1; i <= STRIDE_REPS; i++) {
      strideSteps.push({
        kind: "rep",
        label: `${STRIDE_SEC}s relaxed stride — quick feet, tall, no strain`,
        durationSeconds: STRIDE_SEC,
        targetPaceSecPerKm: paces.rep,
        targetRpe: RPE.rep,
        repeatIndex: i,
        repeatCount: STRIDE_REPS,
      });
      strideSteps.push({
        kind: "recovery",
        label: i < STRIDE_REPS
          ? "Walk back or jog easy — full recovery, until your breathing is back"
          : "Walk or jog easy to finish — let your breathing settle",
        durationSeconds: STRIDE_REC_SEC,
        // A walk-back is easier than easy running, and the band is what the debrief judges it by.
        targetRpe: { min: 1, max: 2 },
        repeatIndex: i,
        repeatCount: STRIDE_REPS,
      });
    }
  }
  // ⚠️ The recovery is TAKEN OUT OF THE EASY PORTION, not added on top. The session already ran two
  // minutes over its title for the strides themselves; letting the walk-backs extend it too would add
  // five minutes to every easy+strides session in every plan, and estimatedDurationSeconds feeds the
  // volume and intensity models. The session's total is unchanged — the walk-back is now counted as
  // the recovery it is rather than as easy running.
  const recTotal = strideSteps.filter((s) => s.kind === "recovery")
    .reduce((a, s) => a + (s.durationSeconds || 0), 0);
  const steps = framedRun(paces, minutes, (mid) => [
    {
      kind: "steady",
      label: "Conversational easy running (below the first threshold)",
      durationSeconds: Math.max(300, mid * 60 - recTotal),
      targetPaceSecPerKm: paces.easy,
      targetRpe: RPE.easy,
    },
    // Relaxed strides come after the easy portion, and the last walk-back is what finishes the run.
    ...strideSteps,
  ]);
  return assemble(
    withStrides ? "strides" : "easy",
    withStrides ? `${minutes}′ easy + strides` : `${minutes}′ easy run`,
    "Foundation aerobic running. Ease in and settle into a conversational rhythm to the finish.",
    "easy",
    steps,
    RPE.easy,
  );
}

/**
 * A moderate run — the coach's "MOD".
 *
 * An entire gear the plan could not previously reach: quicker than easy, slower than steady, and
 * the pace most of a club runner's non-quality mileage actually sits at.
 *
 * ⚠️ Assembled as intensity "easy", not "moderate". The intensity bucket drives the
 * training-intensity distribution, and one 45′ run re-bucketed as moderate drops a build week's
 * easy fraction below the pyramidal floor — the plan then looks mis-periodised when it is not.
 * `contProgression` already sets this precedent for the same reason.
 */
export function moderateRun(paces: TrainingPaces, minutes: number, withStrides = false): SessionContent {
  const steps = framedRun(paces, minutes, (mid) => [
    block({ label: "Moderate — quicker than easy, still comfortable", minutes: mid, pace: paces.aerobic, rpe: RPE.aerobic }),
    // ⚠️ `trailing` — the strides are the last thing here, and with the ease-down gone the session would
    // otherwise end on an 80 m stride at repetition pace with nothing after it.
    ...(withStrides ? strides(5, { distanceMeters: 80, pace: paces.rep }, { durationSeconds: 60, pace: paces.easy }, undefined, true) : []),
  ]);
  return assemble(
    "easy",
    withStrides ? `${minutes}′ moderate + strides` : `${minutes}′ moderate run`,
    "A gear up from easy but well short of a workout — steady breathing, controlled, and you should finish feeling you could have kept going.",
    "easy",
    steps,
    RPE.aerobic,
  );
}

/** An easy run that lifts to moderate for its last third. The non-beginner progression run. */
export function easyProgression(paces: TrainingPaces, minutes: number): SessionContent {
  const steps = framedRun(paces, minutes, (mid) => {
    const first = Math.max(1, Math.round(mid * 0.6));
    return gears([
      { label: "Easy, conversational", minutes: first, pace: paces.easy, rpe: RPE.easy },
      { label: "Lift to moderate for the last third", minutes: Math.max(1, mid - first), pace: paces.aerobic, rpe: RPE.aerobic },
    ]);
  });
  return assemble(
    "easy",
    `${minutes}′ easy → moderate finish`,
    "Start genuinely easy and lift a gear for the final third. Finishing a run slightly quicker than you started is a habit worth building.",
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
  // ⚠️ The upper bound is 12, not 8. It was 8, which capped the longest run-walk session at about
  // 56 minutes of running whatever was asked of it — so a "just getting started" runner heading for a
  // 10 km never got past a 2.5 km longest session. Twelve cycles of a 7-minute block is 84 minutes of
  // running, which is what a beginner half needs and is still a session a person can hold in mind.
  const cycles = clampN(Math.round((s.targetRunMin * 60) / block), 4, 12);
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
  // ⚠️ SIX SPRINTS WITH A WALK BACK, NOT ONE 60-SECOND BLOCK. Spotted by the owner in a simulation of
  // this session: it shipped as a single step labelled "full walk-back recovery" with the recovery in
  // prose and nowhere else, so the brief could not say how long it was and the live session counted
  // through it as one unbroken minute at RPE 7-8. Same fault as the strides, and the last of its kind
  // — `audit-reps.ts` swept 3,378 sessions and found no other block with a prose-only recovery.
  // 45 seconds is the owner's call (2026-08-03), and it suits the effort: a 10-second maximal hill
  // sprint is about power, so the recovery exists to make the NEXT one as good as the last.
  // ⚠️ THE LAST SPRINT GETS ITS WALK BACK DOWN TOO — same reason as the strides. There was no trailing
  // recovery because the ease-down used to follow; with that gone (owner, 2026-08-03) the session ended
  // on a maximal 10-second hill sprint at RPE 8 with nothing after it, which is the one shape that would
  // have needed the cool-down jog reinstating. You have to walk back down the hill regardless — it was
  // always going to happen, it simply was not written down.
  const SPRINT_SEC = 10, SPRINT_REPS = 6, SPRINT_REC_SEC = 45;
  const hills: WorkoutStep[] = [];
  for (let i = 1; i <= SPRINT_REPS; i++) {
    hills.push({ kind: "rep", label: `${SPRINT_SEC}″ hill sprint — short and powerful, tall and driving`,
      durationSeconds: SPRINT_SEC, targetRpe: { min: 7, max: 8 }, repeatIndex: i, repeatCount: SPRINT_REPS });
    hills.push({ kind: "recovery",
      label: i < SPRINT_REPS ? "Walk back down — full recovery before the next one"
        : "Walk back down and let your breathing settle",
      durationSeconds: SPRINT_REC_SEC, targetRpe: { min: 1, max: 2 }, repeatIndex: i, repeatCount: SPRINT_REPS });
  }
  // ⚠️ The walk-backs come OUT of the easy portion, not on top of it — the same rule as the strides.
  // estimatedDurationSeconds feeds the volume and intensity models, so adding three and a half minutes
  // to every hill-sprint session would quietly reshape plans.
  const recTotal = hills.filter((s) => s.kind === "recovery").reduce((a, s) => a + (s.durationSeconds || 0), 0);
  const steps = framedRun(paces, minutes, (mid) => [
    { kind: "steady", label: "Easy, conversational running", durationSeconds: Math.max(300, mid * 60 - recTotal),
      targetPaceSecPerKm: paces.easy, targetRpe: RPE.easy },
    ...hills,
  ]);
  return assemble(
    "strides",
    `${minutes}′ easy + hill sprints`,
    "Easy running plus a handful of short, sharp uphill sprints — big power and economy benefit for very little fatigue. Full recovery between; quality, not burn.",
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
        // ⚠️ paces.recovery, not paces.easy. This session exists to be slower than an easy run, and
        // prescribing it at easy pace made it one — up to 50 s/km too fast against the 2 km spec.
        targetPaceSecPerKm: paces.recovery,
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
  /** What the race-pace work is called on screen and on the wrist ("marathon effort", …). */
  raceLabel?: string;
  /** RPE band for the race-pace work — marathon effort is steady, half effort is tempo. */
  raceRpe?: { min: number; max: number };
  /**
   * Progressive long run: the easy main is split 40% easy → 35% aerobic → 25% at finalPace,
   * biggest gear last. The easy share stays the LONGEST single step on purpose — the debrief
   * judges a run by its longest continuous step, and a progressive long run is still an easy run.
   *
   * ⚠️ finalCapMin/midCapMin are REQUIRED BY REVIEW, not optional polish. Uncapped percentages made
   * the progressive the only ungoverned format: a 3-day/week 4-hour marathoner drew a 240′ run with
   * 79′ aerobic + 57′ at marathon pace — nearly double the cap the same plan applied to its
   * fast-finish sibling, landing on exactly the runner least able to absorb it. Whatever the caps
   * shave off goes back into the easy first gear, so the run's length never changes.
   */
  progressive?: {
    finalPace: PaceRange; finalLabel: string; finalRpe: { min: number; max: number };
    finalCapMin?: number; midCapMin?: number;
  };
  /**
   * Interleaved race-pace blocks late in the run: N × blockMin with easy floats between —
   * "run your race pace on tired legs, recover just enough to do it again". The classic
   * marathon-block session, and where race-day fuelling gets practised.
   */
  blocks?: { count: number; blockMin: number; floatMin: number; pace: PaceRange; label: string; rpe: { min: number; max: number } };
  /** Title suffix, e.g. "· fast finish" — the minutes stay first so the week list scans. */
  titleSuffix?: string;
};

export function longRun(
  paces: TrainingPaces,
  minutes: number,
  opts: LongRunOptions = {},
): SessionContent {
  const warm = Math.min(8, Math.max(4, Math.round(minutes * 0.1)));
  const cool = Math.min(6, Math.max(3, Math.round(minutes * 0.08)));
  // ⚠️ `body` KEEPS THE COOL-DOWN'S MINUTES OUT OF THE DOSE MATHS, and that is load-bearing. Every
  // branch below sizes its race-pace work as a fraction of `body` (0.25 and 0.35 in the progressive,
  // the leftover lead-in in the blocks), so folding the cool-down's minutes in here to "give them back
  // to the easy running" instead grew every DOSE proportionally — measured, that put a 3-day
  // competitive half's week 9 at 67.3% easy and broke the polarized floor. The minutes are given back
  // at the END instead, where they can only ever land on easy running. Doses are byte-identical to
  // before the cool-down was removed.
  const body = Math.max(1, minutes - warm - cool);
  const steps: WorkoutStep[] = [easeIn(paces, warm)];
  let description =
    "Long run develops durability: holding economy and mechanics under accumulated fatigue. Ease in, then hold an easy rhythm to the finish.";
  const easyStep = (min: number): WorkoutStep => ({
    kind: "steady",
    label: "Easy aerobic running — build durability",
    durationSeconds: min * 60,
    targetPaceSecPerKm: paces.easy,
    targetRpe: RPE.easy,
  });

  if (opts.progressive) {
    // 40 / 35 / 25 — biggest gear last, capped, remainder back into the easy opening. The EASY
    // share stays the longest single step, so the debrief still judges this run against the easy
    // band. Coach's question answered on screen: how long easy, how long steady, over the run.
    const c = Math.min(opts.progressive.finalCapMin ?? Infinity, Math.max(1, Math.round(body * 0.25)));
    const b = Math.min(opts.progressive.midCapMin ?? Infinity, Math.round(body * 0.35));
    const a = Math.max(1, body - b - c);
    steps.push(easyStep(a));
    steps.push({
      kind: "steady",
      label: "Lift to a moderate aerobic rhythm — breathing deepens, still conversational",
      durationSeconds: b * 60,
      targetPaceSecPerKm: paces.aerobic,
      targetRpe: RPE.aerobic,
    });
    steps.push({
      kind: "steady",
      label: opts.progressive.finalLabel,
      durationSeconds: c * 60,
      targetPaceSecPerKm: opts.progressive.finalPace,
      targetRpe: opts.progressive.finalRpe,
    });
    description =
      "Progressive long run: three gears, biggest last. Start genuinely easy, lift to moderate through the middle, and finish strong on tired legs — the discipline is holding back early.";
  } else if (opts.blocks) {
    // Race-pace repeats late in the run, with easy floats between. The easy lead-in takes whatever
    // the work leaves, and never shrinks below a real run — the blocks are meant to land on tired
    // legs, which requires the tiredness first.
    let { count } = opts.blocks;
    const { blockMin, floatMin, pace, label, rpe } = opts.blocks;
    // ⚠️ Shed blocks rather than stretch the run. lead = max(10, body - work) alone ADDS time when
    // the run is too short for the work — a 50′ title over 52′ of steps, with the race block
    // promoted to the longest step and the debrief judging the whole run at race pace. Unreachable
    // through generatePlan today (its budget guard filters first), but longRun is an exported
    // template and the next caller lands here silently.
    while (count > 1 && body - (count * blockMin + (count - 1) * floatMin) < 10) count--;
    const work = count * blockMin + (count - 1) * floatMin;
    const lead = Math.max(10, body - work);
    steps.push(easyStep(lead));
    for (let i = 0; i < count; i++) {
      if (i > 0) {
        steps.push({
          kind: "recovery",
          label: "Float — easy running, just enough to go again",
          durationSeconds: floatMin * 60,
          targetPaceSecPerKm: paces.easy,
          targetRpe: RPE.easy,
        });
      }
      steps.push({
        kind: "steady",
        label,
        durationSeconds: blockMin * 60,
        targetPaceSecPerKm: pace,
        targetRpe: rpe,
      });
    }
    description =
      "Long run with race-pace blocks: get properly tired first, then run your goal pace in pieces with short floats between. This is where race rhythm — and race fuelling — get practised.";
  } else {
    const finishMin = (opts.steadyFinishMin ?? 0) + (opts.raceBlockMin ?? 0);
    steps.push(easyStep(Math.max(1, body - finishMin)));
    if (opts.raceBlockMin && opts.racePace) {
      steps.push({
        kind: "steady",
        label: opts.raceLabel
          ? `Fast finish at ${opts.raceLabel} — run it on tired legs`
          : "Race-specific block at goal effort (run while already fatigued)",
        durationSeconds: opts.raceBlockMin * 60,
        targetPaceSecPerKm: opts.racePace,
        targetRpe: opts.raceRpe ?? RPE.steady,
      });
      description += " Finishes with a sustained block at race effort — the point is meeting your goal pace when your legs are already heavy.";
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
  }
  // ⚠️ A RUN THAT FINISHES EASY LOSES ITS COOL-DOWN; A RUN THAT FINISHES WITH WORK KEEPS ITS JOG.
  // The owner's decision removes the prescribed cool-down from the low-intensity running, and a plain
  // long run is exactly that — its last few minutes were easy pace inside a run that was already easy,
  // so they simply become part of the easy running and the stretch session takes it from there. But a
  // progressive long run ends at goal pace and a blocks long run ends on a race-pace repeat: stopping
  // dead there is the same proposition as stopping dead after intervals, which is why the threshold and
  // VO2 pools keep `cooldown()` too. Read from the LAST STEP's own effort rather than from `opts`, so a
  // new long-run format cannot be added without this deciding correctly for it.
  // ⚠️ Either way the outing is `minutes` long, because the title is built from it — a "69′ long run"
  // delivering 63 minutes would be the title lying about the session.
  // ⚠️ THE LINE IS AT RPE 5, NOT 4. A long run finishing at the aerobic/moderate gear is still
  // conversational — you can stop and stretch after it. From steady upwards (a goal-pace finish, a
  // race-pace repeat) it is work, and work gets jogged down. Drawn at 4 instead, an "easy → moderate
  // finish" was handed a cool-down jog it does not need, which is the very padding this change removes.
  const last = steps[steps.length - 1];
  const finishesGently = (last?.targetRpe?.max ?? 0) <= RPE.aerobic.max;
  if (finishesGently) {
    // Give the minutes to the easy running that is already there rather than appending a second easy
    // step saying almost the same thing.
    if (last) last.durationSeconds = (last.durationSeconds ?? 0) + cool * 60;
    else steps.push(easyStep(cool));
  } else {
    steps.push(cooldown(paces, cool));
    description += " Jog easy at the end — that finish is real work, and it needs winding down.";
  }
  const title = `${minutes}′ long run` + (opts.titleSuffix ? ` ${opts.titleSuffix}` : "");
  // ⚠️ The session's intended-effort band must SPAN the work, or the debrief calls a perfect
  // execution overcooked: plannedRpeBandOf short-circuits on the session band, so a runner who ran
  // a race-pace block exactly as prescribed and honestly reported five-out-of-ten was told it was
  // "meant to feel about 2–3" after every structured long run — and two of those in a row raised
  // an ease-off flag from correctly executed sessions.
  const maxRpe = steps.reduce((m, st) => Math.max(m, st.targetRpe?.max ?? 0), RPE.easy.max);
  return assemble("long", title, description, "easy", steps, { min: RPE.easy.min, max: maxRpe });
}

// ---- Threshold (incl. tempo, cruise, fartlek) -----------------------------

/**
 * A quality-session format.
 *
 * `id` is the stable handle: positional indexes into these arrays are a trap (the taper used to be
 * `vo2Session(p, 3)`, so inserting any format above it silently changed every plan's race-week
 * session). Insert freely — nothing may depend on order.
 *
 * `phases` is what makes a big library reachable. Selection is `variant % pool.length`, so a flat
 * pool longer than the plan's week count leaves formats permanently unused. Filtering by phase
 * first shrinks each pool to something a 12-week plan can genuinely cycle through, and keeps
 * peak-only work out of week two.
 */
type QualityFormat = {
  id: string;
  title: string;
  desc?: string;
  build: (p: TrainingPaces) => WorkoutStep[];
  /** Phases this format belongs in. */
  phases: Phase[];
  /** Session-wide effort band, when it differs from the family default (e.g. a maximal time trial). */
  rpe?: RpeBand;
  /** Intensity bucket, when it differs from the family default. */
  intensity?: Session["intensity"];
  /** "big" formats are held back on deload weeks; "small" are the gentlest in the pool. */
  load?: "small" | "normal" | "big";
  /** Only offer to an athlete who has said they train competitively. */
  competitiveOnly?: boolean;
  /** High connective-tissue load — withheld from anyone returning from injury. */
  skipWhenReturning?: boolean;
  /**
   * Shortest event this format suits, in km. Race-pace volume has to be read against the race:
   * "2 × 5 km at goal pace" is a fine half-marathon session and an absurd one for a 5 km runner,
   * who would be covering twice their race distance at race effort.
   */
  minEventKm?: number;
};

export type FormatCtx = {
  phase?: Phase;
  /** The goal race distance in km, so race-pace volume can be read against it. */
  eventKm?: number;
  isDeload?: boolean;
  competitive?: boolean;
  returning?: boolean;
  /** Set when the week already carries another quality session — keeps the biggest formats out. */
  avoidBig?: boolean;
};

/**
 * Pick a format for this week, honouring the context and never returning nothing.
 *
 * Filters narrow the pool; if a filter would empty it, that filter is dropped rather than throwing
 * — a plan must always be generatable, even for a returning beginner in a deload taper week.
 */
function selectFormat(pool: QualityFormat[], variant: number, ctx: FormatCtx): QualityFormat {
  const narrow = (list: QualityFormat[], keep: (f: QualityFormat) => boolean) => {
    const next = list.filter(keep);
    return next.length ? next : list;
  };
  let list = pool;
  if (ctx.phase) list = narrow(list, (f) => f.phases.includes(ctx.phase!));
  if (ctx.eventKm !== undefined) list = narrow(list, (f) => (f.minEventKm ?? 0) <= ctx.eventKm!);
  if (!ctx.competitive) list = narrow(list, (f) => !f.competitiveOnly);
  if (ctx.returning) list = narrow(list, (f) => !f.skipWhenReturning);
  if (ctx.isDeload || ctx.avoidBig) list = narrow(list, (f) => f.load !== "big");
  // ⚠️ A DELOAD PREFERS THE SHORTEST SESSION IN THE POOL, and that is how the week gets lighter WITHOUT
  // getting soft (owner's constraint, 2026-08-06: "I don't want users thinking the plan isn't
  // challenging enough"). Dropping the "big" formats was the only thing a deload did here, so it still
  // drew a full-length session and the week's measured cut came out at 13% on a 5 km block — barely an
  // absorb week. The runner still gets a genuine hard session, at the same intensity; it is simply
  // short. That is exactly what `taperSession` does with `vo2-10x1`, for the same reason.
  // `narrow` falls back to the wider list when nothing qualifies, so a pool with no "small" format is
  // unaffected rather than broken.
  if (ctx.isDeload) list = narrow(list, (f) => f.load === "small");
  // Modulo over a stable, sorted-by-id list so the rotation does not shift when formats are added
  // in the middle of the array.
  const ordered = [...list].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const i = ((variant % ordered.length) + ordered.length) % ordered.length;
  return ordered[i]!;
}

/** Look a format up by id — for the places that need one specific session, not a rotation. */
function formatById(pool: QualityFormat[], id: string): QualityFormat {
  const f = pool.find((x) => x.id === id);
  if (!f) throw new Error(`unknown session format: ${id}`);
  return f;
}

const THRESHOLD_DESC =
  "Controlled but demanding (RPE 6–7). You should finish knowing you could do one more rep.";

const THRESHOLD_FORMATS: QualityFormat[] = [
  // — classic interrupted threshold —
  { id: "thr-3x8", title: "3 × 8′ threshold / 2′ jog", phases: ["base", "build", "peak"],
    build: (p) => reps(3, { durationSeconds: 8 * 60, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "thr-4x6", title: "4 × 6′ threshold / 90″ jog", phases: ["base", "build", "peak"],
    build: (p) => reps(4, { durationSeconds: 6 * 60, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }) },
  { id: "thr-5x5", title: "5 × 5′ threshold / 90″ jog", phases: ["base", "build", "peak"],
    build: (p) => reps(5, { durationSeconds: 5 * 60, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }) },
  { id: "thr-6x8", title: "6 × 8′ threshold / 2′ jog", phases: ["build", "peak"], minEventKm: 10, load: "big", competitiveOnly: true,
    desc: "Forty-eight minutes of threshold. A big, honest session — hold the same effort on the last rep as the first.",
    build: (p) => reps(6, { durationSeconds: 8 * 60, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }) },

  // — continuous tempo —
  { id: "thr-cont-25", title: "25′ continuous tempo", phases: ["base", "build"], load: "small",
    desc: "One controlled, continuous tempo effort (RPE 6–7) — comfortably hard, steady rhythm start to finish.",
    build: (p) => [block({ label: "Continuous controlled tempo", minutes: 25, pace: p.threshold, rpe: RPE.threshold })] },
  { id: "thr-cont-40", title: "40′ continuous tempo", phases: ["build", "peak"], minEventKm: 10, load: "big", competitiveOnly: true,
    desc: "A long, unbroken tempo. Slightly easier per kilometre than a short one — the challenge is holding rhythm, not speed.",
    build: (p) => [block({ label: "Long continuous tempo — settle and hold", minutes: 40, pace: p.tempo, rpe: RPE.tempo })] },
  { id: "thr-tempo-8k", title: "8 km continuous tempo", phases: ["build", "peak"], load: "big",
    desc: "A true tempo by distance — a shade easier than threshold, held for eight kilometres. Rhythm work for the second half of a race.",
    build: (p) => [{ kind: "steady", label: "8 km at true tempo — smooth and repeatable", distanceMeters: 8000, targetPaceSecPerKm: p.tempo, targetRpe: RPE.tempo }] },
  { id: "thr-tempo-10k", title: "10 km continuous tempo", phases: ["build", "peak"], minEventKm: 10, load: "big", competitiveOnly: true,
    desc: "Ten kilometres of true tempo. The session that makes half-marathon pace feel ordinary.",
    build: (p) => [{ kind: "steady", label: "10 km at true tempo — patient, even, controlled", distanceMeters: 10000, targetPaceSecPerKm: p.tempo, targetRpe: RPE.tempo }] },

  // — cruise intervals —
  { id: "thr-5xmile", title: "5 × 1 mile cruise / 90″ jog", phases: ["build", "peak"], minEventKm: 10, load: "big",
    build: (p) => reps(5, { distanceMeters: 1609.344, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }) },
  { id: "thr-6x1k", title: "6 × 1 km cruise / 60″ jog", phases: ["base", "build", "peak"],
    build: (p) => reps(6, { distanceMeters: 1000, pace: p.threshold }, { durationSeconds: 60, pace: p.easy }) },
  { id: "thr-4x2k", title: "4 × 2 km / 400 m jog", phases: ["build", "peak"], minEventKm: 10, load: "big",
    desc: "Long cruise reps with a jogged 400 m between. Eight kilometres of quality without the grind of one continuous block.",
    build: (p) => reps(4, { distanceMeters: 2000, pace: p.threshold }, { distanceMeters: 400, pace: p.easy }) },
  { id: "thr-3x3k", title: "3 × 3 km / 2′ jog", phases: ["build", "peak"], minEventKm: 10, load: "big", competitiveOnly: true,
    desc: "Three long reps at threshold. Concentration as much as fitness — the middle kilometre of each is where it is won.",
    build: (p) => reps(3, { distanceMeters: 3000, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "thr-2x15", title: "2 × 15′ threshold / 3′ float", phases: ["build", "peak"], load: "big",
    desc: "Two long threshold blocks (RPE 6–7) with an easy float between — builds the ability to hold effort.",
    build: (p) => reps(2, { durationSeconds: 15 * 60, pace: p.threshold }, { durationSeconds: 3 * 60, pace: p.steady }) },
  { id: "thr-4x10", title: "4 × 10′ tempo / 2′ walk", phases: ["build", "peak"],
    desc: "Four ten-minute tempo blocks with a full walking break. The walk is deliberate — it keeps every block honest rather than letting them blur into one.",
    build: (p) => reps(4, { durationSeconds: 10 * 60, pace: p.tempo }, { durationSeconds: 2 * 60, pace: p.easy }) },

  // — fartlek and progression —
  { id: "thr-fartlek-6x3", title: "Threshold fartlek: 6 × 3′ brisk / 2′ easy", phases: ["base", "build"],
    desc: "Fartlek — run the brisk blocks by feel at a controlled-hard effort (RPE 6–7), easy in between. Keep it playful and rolling; the clock is a guide, not a cage.",
    build: (p) => reps(6, { durationSeconds: 3 * 60, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "thr-prog-2gear", title: "Progression tempo: 10′ steady → 10′ threshold", phases: ["base", "build"], load: "small",
    desc: "Start steady and lift into threshold for the second half — a controlled progression, finishing strong but never sprinting.",
    build: (p) => gears([
      { label: "Steady build", minutes: 10, pace: p.steady, rpe: RPE.steady },
      { label: "Lift to threshold", minutes: 10, pace: p.threshold, rpe: RPE.threshold },
    ]) },
  { id: "thr-prog-70", title: "Progression run: 60′, a gear up every 10′", phases: ["build", "peak"], load: "big", competitiveOnly: true,
    desc: "Start genuinely easy and lift a gear every ten minutes, finishing at threshold. The discipline is in the first twenty minutes — go too hard early and the last block is impossible.",
    build: (p) => gears([
      { label: "Easy — resist the urge to push", minutes: 10, pace: p.easy, rpe: RPE.easy },
      { label: "Moderate", minutes: 10, pace: p.aerobic, rpe: RPE.aerobic },
      { label: "Steady", minutes: 10, pace: p.steady, rpe: RPE.steady },
      { label: "True tempo", minutes: 10, pace: p.tempo, rpe: RPE.tempo },
      { label: "Threshold", minutes: 10, pace: p.threshold, rpe: RPE.threshold },
      { label: "Hold threshold to the line", minutes: 10, pace: p.threshold, rpe: RPE.threshold },
    ]) },
  { id: "thr-gears-4", title: "Geared run: easy → steady → tempo → easy", phases: ["build", "peak"],
    desc: "Four gears in one continuous run. Changing pace deliberately mid-run — and settling again afterwards — is a skill a race asks for and a steady run never trains.",
    build: (p) => gears([
      { label: "Easy to open up", minutes: 12, pace: p.easy, rpe: RPE.easy },
      { label: "Lift to steady", minutes: 12, pace: p.steady, rpe: RPE.steady },
      { label: "Lift to tempo — the hard part", minutes: 14, pace: p.tempo, rpe: RPE.tempo },
      { label: "Ease back down and finish relaxed", minutes: 10, pace: p.easy, rpe: RPE.easy },
    ]) },

  // — compound: two different stimuli in one session —
  { id: "thr-plus-hills", title: "5 × 5′ threshold, then 8 × 30″ hills", phases: ["base", "build"], load: "big",
    competitiveOnly: true, skipWhenReturning: true,
    desc: "Threshold first, hills second — the hills land on tired legs, which is the point. Run the hills by effort; pace on a climb means nothing.",
    build: (p) => [
      ...reps(5, { durationSeconds: 5 * 60, pace: p.threshold }, { durationSeconds: 90, pace: p.easy }),
      setBreak(p, 180, "Easy jog across to your hill"),
      ...hillReps(8, { seconds: 30 }, { recoverySec: 90, recoveryLabel: "Walk back down", rpe: RPE.maximal }),
    ] },
  { id: "thr-plus-cv", title: "2 × 2 km threshold, then 3 × 1 km at CV", phases: ["build", "peak"], load: "big",
    competitiveOnly: true,
    desc: "Two gears in one session: controlled threshold first, then a genuine lift to critical velocity. The second block should feel distinctly quicker, not just harder.",
    build: (p) => [
      ...reps(2, { distanceMeters: 2000, pace: p.threshold }, { durationSeconds: 2 * 60, pace: p.easy }),
      setBreak(p, 180),
      ...reps(3, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 2 * 60, pace: p.easy }),
    ] },
  { id: "thr-sandwich", title: "Tempo sandwich: 3 km tempo, 5 × 3′ CV, 3 km tempo", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true,
    desc: "Tempo, faster work, then tempo again on tired legs. The closing block is the session — holding rhythm when it has already been taken off you.",
    build: (p) => [
      { kind: "steady", label: "3 km at true tempo", distanceMeters: 3000, targetPaceSecPerKm: p.tempo, targetRpe: RPE.tempo },
      setBreak(p, 120),
      ...reps(5, { durationSeconds: 3 * 60, pace: p.cv }, { distanceMeters: 200, pace: p.easy }),
      setBreak(p, 120),
      { kind: "steady", label: "3 km at true tempo — tired, and that is the point", distanceMeters: 3000, targetPaceSecPerKm: p.tempo, targetRpe: RPE.tempo },
    ] },
  { id: "thr-tempo-plus-reps", title: "4 km threshold, then 4 × 1 km at CV", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true,
    desc: "A solid threshold block to take the edge off, then kilometre reps quicker than it. Classic race-preparation shape.",
    build: (p) => [
      { kind: "steady", label: "4 km at threshold", distanceMeters: 4000, targetPaceSecPerKm: p.threshold, targetRpe: RPE.threshold },
      setBreak(p, 300, "5′ easy jog"),
      ...reps(4, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 2 * 60, pace: p.easy }),
    ] },
  { id: "thr-2xtempo10", title: "2 × 10′ true tempo / 4′ jog", phases: ["base", "build"], load: "small",
    desc: "Two honest tempo blocks with a generous jog between. A gentle way into tempo work, or a steadying session in a heavy week.",
    build: (p) => reps(2, { durationSeconds: 10 * 60, pace: p.tempo }, { durationSeconds: 4 * 60, pace: p.easy }) },

  // — hills as the session —
  { id: "thr-kenyan-20", title: "20′ Kenyan hills", phases: ["base", "build"],
    desc: "Twenty minutes of continuous rolling hills — strong and even up, relaxed and controlled down, never stopping. Pace is meaningless here; the hill sets the effort.",
    build: () => [kenyanHills(20)] },
  { id: "thr-kenyan-30", title: "30′ Kenyan hills", phases: ["base", "build"], load: "big", competitiveOnly: true,
    desc: "Half an hour of unbroken undulating running. Enormously effective and much kinder on the legs than the equivalent on the flat.",
    build: () => [kenyanHills(30)] },
  { id: "thr-kenyan-tempo", title: "20′ Kenyan hills straight into 5 km tempo", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true, skipWhenReturning: true,
    desc: "Hills, then straight onto the flat at tempo with no recovery. Brutal and specific — it teaches your legs to find rhythm again after a climb has taken it away.",
    build: (p) => [
      kenyanHills(20),
      { kind: "steady", label: "Straight into 5 km at true tempo — no rest", distanceMeters: 5000, targetPaceSecPerKm: p.tempo, targetRpe: RPE.tempo },
    ] },
];

/**
 * The whole quality library, built at THIS runner's paces, for the "build your own run" browser.
 *
 * ⚠️ THIS IS THE PLAN'S OWN LIBRARY, NOT A PARALLEL ONE. Every workout offered here is a format the
 * generator itself schedules, at the runner's own derived paces — so a session picked by hand is
 * the same evidence-based session, judged by the same debrief, as one the plan prescribed. A second
 * hand-written catalogue would drift from this one within a release and quietly teach different
 * paces.
 *
 * Filters mirror the generator's: `competitiveOnly` and `skipWhenReturning` are honoured, and
 * `minEventKm` keeps "2 × 5 km at goal pace" away from a 5 km runner, who would otherwise be
 * offered twice their race distance at race effort.
 */
export type WorkoutOption = {
  id: string;
  type: SessionType;
  title: string;
  description: string;
  load: "small" | "normal" | "big";
  minutes: number;
  km: number | null;
  session: SessionContent;
};

export function listWorkouts(paces: TrainingPaces, ctx: FormatCtx = {}): WorkoutOption[] {
  const pools: Array<[SessionType, QualityFormat[], (f: QualityFormat) => SessionContent]> = [
    ["threshold", THRESHOLD_FORMATS, (f) =>
      assemble("threshold", f.title, f.desc ?? THRESHOLD_DESC, f.intensity ?? "moderate",
        [warmup(paces, 15, true), ...f.build(paces), cooldown(paces, 10)], f.rpe ?? RPE.threshold)],
    ["vo2", VO2_FORMATS, (f) =>
      assemble("vo2", f.title, f.desc ?? VO2_DESC, f.intensity ?? "hard",
        [warmup(paces, 15, true), ...f.build(paces), cooldown(paces, 10)], f.rpe ?? RPE.vo2)],
    ["race-specific", RACE_FORMATS, (f) =>
      assemble("race-specific", f.title, f.desc ?? RACE_DESC, f.intensity ?? "moderate",
        [warmup(paces, 15, true), ...f.build(paces), cooldown(paces, 10)], f.rpe ?? RPE.steady)],
  ];
  const out: WorkoutOption[] = [];
  for (const [type, pool, make] of pools) {
    for (const f of pool) {
      if (f.competitiveOnly && !ctx.competitive) continue;
      if (f.skipWhenReturning && ctx.returning) continue;
      if (f.minEventKm && ctx.eventKm !== undefined && ctx.eventKm < f.minEventKm) continue;
      const session = make(f);
      out.push({
        id: f.id,
        type,
        title: f.title,
        description: session.description,
        load: f.load ?? "normal",
        minutes: Math.round(session.estimatedDurationSeconds / 60),
        km: session.estimatedDistanceMeters ? Math.round(session.estimatedDistanceMeters / 100) / 10 : null,
        session,
      });
    }
  }
  return out;
}

/** One workout by id, at this runner's paces. Null when the id is unknown or filtered out. */
export function buildWorkout(id: string, paces: TrainingPaces, ctx: FormatCtx = {}): SessionContent | null {
  return listWorkouts(paces, ctx).find((w) => w.id === id)?.session ?? null;
}

export function thresholdSession(paces: TrainingPaces, variant: number, ctx: FormatCtx = {}): SessionContent {
  const fmt = selectFormat(THRESHOLD_FORMATS, variant, ctx);
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("threshold", fmt.title, fmt.desc ?? THRESHOLD_DESC, fmt.intensity ?? "moderate", steps, fmt.rpe ?? RPE.threshold);
}

/** Whether the format this variant/context would select is one of the biggest in its pool. */
export function thresholdIsBig(variant: number, ctx: FormatCtx = {}): boolean {
  return selectFormat(THRESHOLD_FORMATS, variant, ctx).load === "big";
}
export function vo2IsBig(variant: number, ctx: FormatCtx = {}): boolean {
  return selectFormat(VO2_FORMATS, variant, ctx).load === "big";
}
export function raceIsBig(variant: number, ctx: FormatCtx = {}): boolean {
  return selectFormat(RACE_FORMATS, variant, ctx).load === "big";
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
// Short maximal sprints and longer aerobic hill reps are different sessions, so work can be given
// in seconds or metres and the effort band is explicit.
function hillReps(
  count: number,
  work: { seconds?: number; metres?: number },
  opts: { recoverySec?: number; recoveryLabel?: string; rpe?: RpeBand; label?: string } = {},
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  const what = work.metres ? `${work.metres} m` : `${work.seconds}″`;
  for (let i = 1; i <= count; i++) {
    steps.push({
      kind: "rep",
      label: opts.label ?? `${what} uphill — strong, tall, driving`,
      durationSeconds: work.seconds,
      distanceMeters: work.metres,
      targetRpe: opts.rpe ?? RPE.vo2,
      repeatIndex: i,
      repeatCount: count,
    });
    if (i < count) {
      steps.push({
        kind: "recovery",
        label: opts.recoveryLabel ?? "Jog/walk down to recover",
        durationSeconds: opts.recoverySec ?? (work.seconds ?? 30) + 30,
      });
    }
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
  // — classic time-based VO2 —
  { id: "vo2-5x3", title: "5 × 3′ hard / 2′ easy", phases: ["base", "build", "peak"],
    build: (p) => reps(5, { durationSeconds: 3 * 60, pace: p.vo2 }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "vo2-4x4", title: "4 × 4′ hard / 3′ easy", phases: ["base", "build", "peak"],
    build: (p) => reps(4, { durationSeconds: 4 * 60, pace: p.vo2 }, { durationSeconds: 3 * 60, pace: p.easy }) },
  { id: "vo2-10x1", title: "10 × 1′ hard / 1′ easy", phases: ["base", "build", "peak", "taper"], load: "small",
    build: (p) => reps(10, { durationSeconds: 60, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }) },
  { id: "vo2-6x2", title: "6 × 2′ hard / 90″ jog", phases: ["base", "build", "peak"],
    build: (p) => reps(6, { durationSeconds: 2 * 60, pace: p.vo2 }, { durationSeconds: 90, pace: p.easy }) },

  // — track-shaped reps —
  { id: "vo2-6x800", title: "6 × 800 m / 2′ easy", phases: ["build", "peak"],
    build: (p) => reps(6, { distanceMeters: 800, pace: p.vo2 }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "vo2-12x400", title: "12 × 400 m / 60″ jog", phases: ["build", "peak"],
    build: (p) => reps(12, { distanceMeters: 400, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }) },
  { id: "vo2-16x400", title: "16 × 400 m / 60″ jog", phases: ["build", "peak"], load: "big", competitiveOnly: true,
    desc: "Sixteen laps of quality. The trap is running the first six too fast — start at a pace you could hold for all sixteen.",
    build: (p) => reps(16, { distanceMeters: 400, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy }) },
  { id: "vo2-10x600", title: "10 × 600 m / 90″ jog", phases: ["build", "peak"], load: "big",
    desc: "Six kilometres of quality in bite-sized reps — long enough to hurt, short enough to hold form.",
    build: (p) => reps(10, { distanceMeters: 600, pace: p.vo2 }, { durationSeconds: 90, pace: p.easy }) },
  { id: "vo2-10x500", title: "10 × 500 m / 100 m jog", phases: ["build", "peak"], competitiveOnly: true,
    desc: "Short jogged recoveries — barely enough. The incomplete recovery is the stimulus.",
    build: (p) => reps(10, { distanceMeters: 500, pace: p.vo2 }, { distanceMeters: 100, pace: p.easy }) },
  { id: "vo2-5x1k", title: "5 × 1000 m / 90″ jog", phases: ["build", "peak"], load: "big",
    build: (p) => reps(5, { distanceMeters: 1000, pace: p.vo2 }, { durationSeconds: 90, pace: p.easy }) },
  { id: "vo2-6x1k", title: "6 × 1 km / 200 m jog", phases: ["build", "peak"], load: "big", competitiveOnly: true,
    desc: "Six kilometre reps off a jogged two hundred. A staple session — repeatable, measurable, and honest about your fitness.",
    build: (p) => reps(6, { distanceMeters: 1000, pace: p.cv }, { distanceMeters: 200, pace: p.easy }) },
  { id: "vo2-3xmile", title: "3 × 1 mile / 4′ jog, then 6 × 200 m", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true,
    desc: "Long reps with generous recovery, then a short sharp finish to remind your legs what quick feels like.",
    build: (p) => [
      ...reps(3, { distanceMeters: 1609.344, pace: p.cv }, { durationSeconds: 4 * 60, pace: p.easy }),
      setBreak(p, 180),
      ...strides(6, { distanceMeters: 200, pace: p.rep }, { distanceMeters: 200, pace: p.easy }),
    ] },

  // — ladders, cut-downs and pyramids —
  // ⚠️ load "small" because it MEASURES small — 42 minutes against the 44 of vo2-10x1, which already
  // carried the label. The field describes size relative to the pool, and these two were simply never
  // labelled. It matters now that a deload PREFERS the small formats: with only vo2-10x1 marked, every
  // VO2 deload in a 35-week plan drew the identical session and "a long plan delivers real variety"
  // failed at 6 appearances against a limit of 5.
  { id: "vo2-pyramid", title: "VO₂ pyramid: 1–2–3–2–1′ / equal easy", phases: ["base", "build"], load: "small",
    desc: "A pyramid — ramp rep length up then back down, equal easy recovery. Same hard effort (RPE 8–9) throughout; it plays with rhythm and keeps the mind engaged.",
    build: (p) => pyramid(p) },
  { id: "vo2-ladder-km", title: "Ladder: 1–2–3–4–3–2–1 km / equal jog", phases: ["build", "peak"], minEventKm: 21, load: "big",
    competitiveOnly: true,
    desc: "Up to four kilometres and back down, with the recovery matching the rep you have just run. The four is the summit — everything after it is run tired, on purpose.",
    build: (p) => ladder([1, 2, 3, 4, 3, 2, 1].map((km) => ({
      work: { distanceMeters: km * 1000, pace: km >= 3 ? p.threshold : p.cv },
      rec: { durationSeconds: km * 60, pace: p.easy },
    })), (w) => `${(w.distanceMeters ?? 0) / 1000} km`) },
  { id: "vo2-cutdown", title: "Cut-down: 2 km – 1.6 – 1.2 – 800 – 400 / 2′30 jog", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true,
    desc: "Each rep shorter and quicker than the last. Start conservatively — the whole session is designed so the 400 is your fastest, not your slowest.",
    build: (p) => ladder([
      { work: { distanceMeters: 2000, pace: p.threshold }, rec: { durationSeconds: 150, pace: p.easy } },
      { work: { distanceMeters: 1600, pace: p.cv }, rec: { durationSeconds: 150, pace: p.easy } },
      { work: { distanceMeters: 1200, pace: p.cv }, rec: { durationSeconds: 150, pace: p.easy } },
      { work: { distanceMeters: 800, pace: p.vo2 }, rec: { durationSeconds: 150, pace: p.easy } },
      { work: { distanceMeters: 400, pace: p.rep } },
    ]) },
  { id: "vo2-descend-fartlek", title: "Descending fartlek: 5–4–3–2–1′ / 2′ float", phases: ["base", "build"],
    desc: "Work descends, the float stays the same — so each rep is a little quicker and a little easier to face than the one before.",
    build: (p) => ladder([5, 4, 3, 2, 1].map((m) => ({
      work: { durationSeconds: m * 60, pace: p.vo2 },
      rec: { durationSeconds: 120, pace: p.aerobic },
    })), (w) => `${Math.round((w.durationSeconds ?? 0) / 60)}′ hard`) },
  { id: "vo2-mona", title: "Mona fartlek: 2 × (90/60/30/15″ hard, equal float)", phases: ["base", "build", "peak"], load: "small",
    desc: "The classic Mona fartlek — descending hard surges with equal-length floats (not full rest). Continuous and rhythmic, hard by feel. A fun, varied way to hit VO₂.",
    build: (p) => monaFartlek(p) },

  // — sets and broken reps —
  { id: "vo2-3x2k1k", title: "3 × (2 km + 1 km)", phases: ["build", "peak"], load: "big", competitiveOnly: true,
    desc: "Three sets, each a long rep then a shorter, quicker one. The 1 km inside each set is a genuine gear up from the 2 km that preceded it — not just the same pace held longer.",
    build: (p) => sets(3, () => [
      ...reps(1, { distanceMeters: 2000, pace: p.tempo }, { durationSeconds: 150, pace: p.easy }),
      { kind: "recovery", label: "2′30 jog", durationSeconds: 150, targetPaceSecPerKm: p.easy },
      ...reps(1, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 0, pace: p.easy }),
    ], setBreak(p, 240, "4′ easy jog between sets")) },
  { id: "vo2-broken-km", title: "Broken kilometres: 1 km / 4 × 400 m, twice, then 1 km", phases: ["build", "peak"], load: "big",
    competitiveOnly: true,
    desc: "Long and short alternating. The kilometres set the rhythm and the four-hundreds break it — then you have to find it again.",
    build: (p) => [
      ...reps(1, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 120, pace: p.easy }),
      setBreak(p, 120),
      ...reps(4, { distanceMeters: 400, pace: p.rep }, { durationSeconds: 60, pace: p.easy }),
      setBreak(p, 120),
      ...reps(1, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 120, pace: p.easy }),
      setBreak(p, 120),
      ...reps(4, { distanceMeters: 400, pace: p.rep }, { durationSeconds: 60, pace: p.easy }),
      setBreak(p, 120),
      ...reps(1, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 0, pace: p.easy }),
    ] },
  { id: "vo2-mixed-descend", title: "3 × 2 km, 2 × 1 km, 4 × 200 m", phases: ["build", "peak"], minEventKm: 10, load: "big", competitiveOnly: true,
    desc: "Volume first, speed last. Each block is shorter and quicker than the one before it — a whole race's worth of gears in one session.",
    build: (p) => [
      ...reps(3, { distanceMeters: 2000, pace: p.threshold }, { durationSeconds: 120, pace: p.easy }),
      setBreak(p, 120),
      ...reps(2, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 90, pace: p.easy }),
      setBreak(p, 120),
      ...strides(4, { distanceMeters: 200, pace: p.rep }, { distanceMeters: 200, pace: p.easy }),
    ] },
  { id: "vo2-1k-then-200", title: "5 × 1 km / 90″, then 5 × 200 m", phases: ["build", "peak"], load: "big",
    desc: "The bulk of the work first, then five fast, relaxed two-hundreds. Finishing quick teaches good form when tired.",
    build: (p) => [
      ...reps(5, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 90, pace: p.easy }),
      setBreak(p, 180),
      ...strides(5, { distanceMeters: 200, pace: p.rep }, { durationSeconds: 60, pace: p.easy }),
    ] },
  { id: "vo2-1k-then-400", title: "4 × 1 km / 4′, then 16 × 200 m / 30″", phases: ["build", "peak"], minEventKm: 10, load: "big",
    competitiveOnly: true,
    desc: "A big session in two halves: full-recovery kilometre reps, then a long grind of short, fast two-hundreds off almost no rest.",
    build: (p) => [
      ...reps(4, { distanceMeters: 1000, pace: p.cv }, { durationSeconds: 4 * 60, pace: p.easy }),
      setBreak(p, 180),
      ...reps(16, { distanceMeters: 200, pace: p.rep }, { durationSeconds: 30, pace: p.easy }),
    ] },

  // — continuous alternation, no standing rest —
  { id: "vo2-20x200", title: "20 × 200 m on / 200 m off — continuous", phases: ["build", "peak"], load: "big",
    competitiveOnly: true,
    desc: "Eight kilometres with no standing rest at all — the 'off' is a jog, not a stop. Relentless, and superb preparation for a fast finish.",
    build: (p) => onOff(20, { distanceMeters: 200, pace: p.rep }, { distanceMeters: 200, pace: p.easy },
      { on: "200 m on", off: "200 m off — keep running" }) },
  { id: "vo2-20x60", title: "20 × 60″ on / 60″ off", phases: ["base", "build"],
    desc: "Twenty minutes of alternating, continuous throughout. Simple, no measuring, and it works anywhere.",
    build: (p) => onOff(20, { durationSeconds: 60, pace: p.vo2 }, { durationSeconds: 60, pace: p.easy },
      { on: "60″ on", off: "60″ easy — keep moving" }) },
  { id: "vo2-alt-400", title: "6 × (400 m fast / 400 m threshold)", phases: ["build", "peak"], load: "big", competitiveOnly: true,
    desc: "There is no easy running in this one — the 'recovery' four-hundred is at threshold. Lactate clearance at speed.",
    build: (p) => onOff(6, { distanceMeters: 400, pace: p.vo2 }, { distanceMeters: 400, pace: p.threshold },
      { on: "400 m fast", off: "400 m at threshold — the 'recovery'" }) },

  // — hills —
  { id: "vo2-hills-8x60", title: "Hill reps: 8 × 60″ uphill / jog down", phases: ["base", "build"],
    desc: "Find a moderate hill. Drive up strong and tall for 60″ at a hard effort (RPE 8–9), jog down to recover. Hills build power and economy with less impact — go by effort, not pace.",
    build: () => hillReps(8, { seconds: 60 }) },
  { id: "vo2-hills-10x30", title: "10 × 30″ hill sprints, full walk back", phases: ["base", "build"],
    skipWhenReturning: true,
    rpe: RPE.maximal,
    desc: "Not an aerobic session — this is pure power. Thirty seconds up as hard as you can hold good form, then walk all the way back down. Take the full recovery; rushing it turns a strength session into a mediocre interval session.",
    build: () => hillReps(10, { seconds: 30 }, { recoverySec: 120, recoveryLabel: "Walk back down — full recovery", rpe: RPE.maximal }) },
  { id: "vo2-hills-10x50m", title: "10 × 50 m hill sprints, walk back", phases: ["base", "build"],
    skipWhenReturning: true,
    rpe: RPE.maximal,
    desc: "Very short, very hard, fully recovered. Fifty metres is over before fatigue arrives — which is exactly why it builds speed rather than endurance.",
    build: () => hillReps(10, { metres: 50 }, { recoverySec: 90, recoveryLabel: "Walk back down", rpe: RPE.maximal }) },
  { id: "vo2-1k-plus-hills", title: "5 × 1 km, then 10 × 50 m hill sprints", phases: ["build"], load: "big",
    competitiveOnly: true, skipWhenReturning: true,
    desc: "Kilometre reps first, then short maximal hills on legs that already know they have worked. Strength at the end of a session, which is where a race asks for it.",
    build: (p) => [
      ...reps(5, { distanceMeters: 1000, pace: p.cv }, { distanceMeters: 200, pace: p.easy }),
      setBreak(p, 180, "Easy jog across to your hill"),
      ...hillReps(10, { metres: 50 }, { recoverySec: 90, recoveryLabel: "Walk back down", rpe: RPE.maximal }),
    ] },
];

export function vo2Session(paces: TrainingPaces, variant: number, ctx: FormatCtx = {}): SessionContent {
  const fmt = selectFormat(VO2_FORMATS, variant, ctx);
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("vo2", fmt.title, fmt.desc ?? VO2_DESC, fmt.intensity ?? "hard", steps, fmt.rpe ?? RPE.vo2);
}

/** The taper's sharpener, by id — never by array position. */
export function taperSession(paces: TrainingPaces): SessionContent {
  const fmt = formatById(VO2_FORMATS, "vo2-10x1");
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("vo2", fmt.title, fmt.desc ?? VO2_DESC, "hard", steps, RPE.vo2);
}

// ---- Race-specific --------------------------------------------------------

const RACE_DESC = "Rehearse goal race pace and rhythm. Controlled, repeatable, race-like.";

// ⚠️ THE TWO MILDEST FORMATS REACH INTO THE BUILD PHASE (2026-08-06 audit). Every race-specific format
// was `phases: ["peak"]`, which made goal-pace rehearsal STRUCTURALLY IMPOSSIBLE before the peak — measured
// across 768 plans at 0.0% of running time in base AND build, for every distance, then 5–12% in peak. A
// runner met the pace they had been training months for only in the last few weeks, and on a short block
// 24 plans in the sweep met it never.
//
// ⚠️ ONLY THE NON-"big" ONES, AND DELIBERATELY SO. `race-8x1k`, `race-4x2k`, `race-2x5k`, `race-sandwich`
// and the 5 km time trial are all `load: "big"` — a build week is not the place for a time trial or eight
// kilometres at goal pace, and the deload gating already treats "big" as the thing to hold back. What the
// build gets is the two ordinary ones: a 3 × 10′ and the cut-down. The peak keeps the whole pool, so the
// progression from build to peak is still a real step up rather than a relabelling.
const RACE_FORMATS: QualityFormat[] = [
  { id: "race-3x10", title: "3 × 10′ at goal race pace / 2′ jog", phases: ["build", "peak"],
    build: (p) => reps(3, { durationSeconds: 10 * 60, pace: p.goalRace }, { durationSeconds: 2 * 60, pace: p.easy }) },
  { id: "race-8x1k", title: "8 × 1 km at goal race pace / 60″ jog", phases: ["peak"], minEventKm: 10, load: "big",
    desc: "Eight kilometres at goal pace off a minute's jog — short enough recovery that it starts to feel continuous.",
    build: (p) => reps(8, { distanceMeters: 1000, pace: p.goalRace }, { durationSeconds: 60, pace: p.easy }) },
  { id: "race-4x2k", title: "4 × 2 km at goal race pace / 90″ jog", phases: ["peak"], minEventKm: 10, load: "big",
    desc: "Middle-length blocks at goal pace. Long enough to settle into rhythm, short enough to repeat well.",
    build: (p) => reps(4, { distanceMeters: 2000, pace: p.goalRace }, { durationSeconds: 90, pace: p.easy }) },
  { id: "race-2x5k", title: "2 × 5 km at goal race pace / 5′ jog", phases: ["peak"], minEventKm: 21, load: "big", competitiveOnly: true,
    desc: "Two long goal-pace blocks. As close to the real thing as training gets without racing.",
    build: (p) => reps(2, { distanceMeters: 5000, pace: p.goalRace }, { durationSeconds: 5 * 60, pace: p.easy }) },
  { id: "race-cutdown", title: "Goal-pace cut-down: 3 km – 2 km – 1 km / 3′ jog", phases: ["build", "peak"],
    desc: "Goal pace, then a final kilometre quicker than it. Rehearses the finish, not just the rhythm.",
    build: (p) => ladder([
      { work: { distanceMeters: 3000, pace: p.goalRace }, rec: { durationSeconds: 180, pace: p.easy } },
      { work: { distanceMeters: 2000, pace: p.goalRace }, rec: { durationSeconds: 180, pace: p.easy } },
      { work: { distanceMeters: 1000, pace: p.threshold } },
    ]) },
  { id: "race-sandwich", title: "15′ easy → 20′ at goal pace → 10′ threshold", phases: ["peak"], load: "big",
    desc: "Goal pace, then faster still. Teaches you to lift when you are already at race effort — the last three kilometres of any race.",
    build: (p) => gears([
      { label: "Easy to open", minutes: 15, pace: p.easy, rpe: RPE.easy },
      { label: "Lock into goal race pace", minutes: 20, pace: p.goalRace, rpe: RPE.steady },
      { label: "Lift to threshold to finish", minutes: 10, pace: p.threshold, rpe: RPE.threshold },
    ]) },
  { id: "race-timetrial-5k", title: "5 km time trial — or race a parkrun", phases: ["peak"], load: "big",
    rpe: RPE.maximal, intensity: "hard", competitiveOnly: true,
    desc: "Race it properly. A hard, measured 5 km tells you more about your fitness than any session — and InteRun will use the result to re-tune your paces. Warm up well, go out honestly, and finish empty.",
    build: (p) => [{ kind: "rep", label: "5 km — race it, honest effort start to finish", distanceMeters: 5000, targetPaceSecPerKm: p.vo2, targetRpe: RPE.maximal }] },
];

/** Every format id, by family — so tests can assert the library's shape without exporting builders. */
export const QUALITY_FORMAT_IDS = {
  threshold: THRESHOLD_FORMATS.map((f) => f.id),
  vo2: VO2_FORMATS.map((f) => f.id),
  race: RACE_FORMATS.map((f) => f.id),
};

export function raceSpecificSession(paces: TrainingPaces, variant = 0, ctx: FormatCtx = {}): SessionContent {
  const fmt = selectFormat(RACE_FORMATS, variant, ctx);
  const steps = [warmup(paces, 15, true), ...fmt.build(paces), cooldown(paces, 10)];
  return assemble("race-specific", fmt.title, fmt.desc ?? RACE_DESC, fmt.intensity ?? "moderate", steps, fmt.rpe ?? RPE.steady);
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
  // anim is pre-wired: the artwork doesn't exist yet, so this falls back to the schematic figure and
  // activates automatically once assets/exercise-animations/single-leg-balance.webp is added.
  balance: { name: "Single-leg balance", primary: "Ankles", secondary: ["Core"], pattern: "balance", anim: "single-leg-balance", cue: "Stand tall on one leg and stay steady. Progress by closing your eyes or standing on something soft." },
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

/**
 * Race day. The thing the whole plan was for.
 *
 * Built as a real session so it occupies its date and everything downstream — the calendar, the
 * chart, reminders, the watch — can see it. Its steps are a warm-up and the race itself at goal
 * pace, so the wrist has something to run against; the distance is the race distance, so weekly
 * volume counts it honestly rather than pretending the week was short.
 */
export function raceDay(
  paces: TrainingPaces,
  distanceKey: RaceDistanceKey,
  label: string,
): SessionContent {
  const metres = RACE_DISTANCES_M[distanceKey];
  // A 5k warm-up matters; a marathon one is a jog to the start. Long races warm up ON the way.
  const warmMin = metres <= 10000 ? 15 : metres <= 21098 ? 10 : 5;
  const steps: WorkoutStep[] = [
    {
      kind: "warmup",
      label: "Warm up — easy jog, drills, a few strides, then get to the line",
      durationSeconds: warmMin * 60,
      targetPaceSecPerKm: paces.easy,
      targetRpe: RPE.easy,
    },
    {
      kind: "rep",
      label: label + " — race",
      distanceMeters: metres,
      targetPaceSecPerKm: paces.goalRace,
      targetRpe: { min: 9, max: 10 },
    },
  ];
  return assemble(
    "race",
    label + " — RACE DAY",
    "This is the one. Everything in the plan has been building to it. Warm up properly, start at the pace you have practised, and trust the work.",
    "hard",
    steps,
    { min: 9, max: 10 },
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

type RepSpec = { durationSeconds?: number; distanceMeters?: number; pace?: PaceRange };

// ---- structural helpers ----------------------------------------------------
//
// Real coached sessions are not all "N x the same thing". They ladder, they alternate, they chain
// two different stimuli, and they change gear mid-run. Each helper below exists because a session
// in a real coaching block could not otherwise be written down.

function repLabel(work: RepSpec): string {
  if (work.distanceMeters) {
    return work.distanceMeters >= 1000
      ? `${Math.round(work.distanceMeters / 100) / 10} km`
      : `${Math.round(work.distanceMeters)} m`;
  }
  const m = (work.durationSeconds ?? 0) / 60;
  return m >= 1 ? `${Math.round(m * 10) / 10}′` : `${work.durationSeconds}″`;
}

/**
 * A block separator.
 *
 * Two purposes, both load-bearing. Physically it is the jog between two different blocks of a
 * compound session. Structurally it breaks the run of contiguous rep/recovery steps that the
 * session-detail sheet collapses into one row — without it, a session with a threshold block and a
 * CV block renders as a single row showing only the threshold pace, which is a lie.
 */
function setBreak(p: TrainingPaces, seconds: number, label = "Easy jog between blocks"): WorkoutStep {
  return { kind: "steady", label, durationSeconds: seconds, targetPaceSecPerKm: p.easy, targetRpe: RPE.easy };
}

/** Reps whose length varies: ladders, cut-downs and pyramids. Work and recovery vary independently. */
function ladder(
  rungs: Array<{ work: RepSpec; rec?: RepSpec }>,
  label?: (work: RepSpec, i: number) => string,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  rungs.forEach((rung, i) => {
    steps.push({
      kind: "rep",
      label: label ? label(rung.work, i) : repLabel(rung.work),
      durationSeconds: rung.work.durationSeconds,
      distanceMeters: rung.work.distanceMeters,
      targetPaceSecPerKm: rung.work.pace,
      repeatIndex: i + 1,
      repeatCount: rungs.length,
    });
    if (rung.rec) {
      steps.push({
        kind: "recovery",
        label: rung.rec.distanceMeters ? `${Math.round(rung.rec.distanceMeters)} m jog` : "Jog recovery",
        durationSeconds: rung.rec.durationSeconds,
        distanceMeters: rung.rec.distanceMeters,
        targetPaceSecPerKm: rung.rec.pace,
      });
    }
  });
  return steps;
}

/** A set of mixed reps, repeated N times, with a longer break between sets. */
function sets(
  count: number,
  build: (setIndex: number) => WorkoutStep[],
  between: WorkoutStep,
): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  for (let i = 1; i <= count; i++) {
    // Sets are numbered in the step labels because the flat step list has no nesting: without it,
    // "rep 2 of 3" appears three times in one session with nothing to tell them apart.
    steps.push(...build(i).map((st) => (st.kind === "rep" ? { ...st, label: `Set ${i}/${count} — ${st.label}` } : st)));
    if (i < count) steps.push(between);
  }
  return steps;
}

/** Continuous alternation with no standing rest — the "off" keeps moving. */
function onOff(count: number, on: RepSpec, off: RepSpec, labels?: { on?: string; off?: string }): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  for (let i = 1; i <= count; i++) {
    steps.push({
      kind: "rep",
      label: labels?.on ?? `${repLabel(on)} on`,
      durationSeconds: on.durationSeconds,
      distanceMeters: on.distanceMeters,
      targetPaceSecPerKm: on.pace,
      repeatIndex: i,
      repeatCount: count,
    });
    steps.push({
      kind: "recovery",
      label: labels?.off ?? `${repLabel(off)} off — keep running`,
      durationSeconds: off.durationSeconds,
      distanceMeters: off.distanceMeters,
      targetPaceSecPerKm: off.pace,
    });
  }
  return steps;
}

/** One continuous effort, given in minutes. */
function block(o: { label: string; minutes: number; pace?: PaceRange; rpe: RpeBand }): WorkoutStep {
  return {
    kind: "steady",
    label: o.label,
    durationSeconds: Math.round(o.minutes * 60),
    targetPaceSecPerKm: o.pace,
    targetRpe: o.rpe,
  };
}

/** A continuous run that changes gear — progressions and easy→steady→tempo→easy runs. */
function gears(blocks: Array<{ label: string; minutes: number; pace: PaceRange; rpe: RpeBand }>): WorkoutStep[] {
  return blocks.map((b) => ({
    kind: "steady" as const,
    label: b.label,
    durationSeconds: Math.round(b.minutes * 60),
    targetPaceSecPerKm: b.pace,
    targetRpe: b.rpe,
  }));
}

/**
 * Relaxed fast strides, usually tacked on the end of a session.
 *
 * ⚠️ `trailing` adds a recovery AFTER the last stride, and it is off by default on purpose. In the
 * quality formats a ten-minute cool-down jog follows the strides, so a trailing walk-back would be
 * redundant AND would add distance to a session whose length feeds the volume model. It is needed only
 * where the strides are the last thing in the session — which, since the ease-down was removed
 * (owner, 2026-08-03), is any low-intensity run that carries them. `test/warmup-delivery.test.ts`
 * catches the case, so a new caller cannot get this wrong silently.
 */
function strides(count: number, work: RepSpec, rec: RepSpec, label?: string, trailing = false): WorkoutStep[] {
  const steps: WorkoutStep[] = [];
  for (let i = 1; i <= count; i++) {
    steps.push({
      kind: "rep",
      label: label ?? `${repLabel(work)} stride — fast and relaxed`,
      durationSeconds: work.durationSeconds,
      distanceMeters: work.distanceMeters,
      targetPaceSecPerKm: work.pace,
      targetRpe: RPE.rep,
      repeatIndex: i,
      repeatCount: count,
    });
    if (i < count || trailing) {
      steps.push({
        kind: "recovery",
        label: i < count ? "Walk back / easy jog, full recovery" : "Easy jog to finish — let your breathing settle",
        durationSeconds: rec.durationSeconds,
        distanceMeters: rec.distanceMeters,
        targetPaceSecPerKm: rec.pace,
      });
    }
  }
  return steps;
}

/**
 * Continuous undulating running — "Kenyan hills".
 *
 * Deliberately has no pace target: on rolling ground pace is a function of the gradient, not the
 * effort, so a band here would have the coach telling you to speed up on every climb. Effort is the
 * whole instruction.
 */
function kenyanHills(minutes: number): WorkoutStep {
  return {
    kind: "rep",
    label: "Rolling hills — strong and even up, relaxed and controlled down, no stopping",
    durationSeconds: minutes * 60,
    targetRpe: RPE.threshold,
  };
}

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
