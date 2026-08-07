/**
 * Warm-ups, generated from what the session actually asks of you first.
 *
 * From `InteRun_Running_Warm_Up_Research_and_Implementation_Specification.md` (v1.0, 2026-08-02).
 * This is the specification's Phase 1 "safe core": templates T1–T8, ability scaling, RPE cues,
 * heat/cold modifiers, time compression and the safety gates. No primers, no inspiratory devices,
 * no loaded potentiation — those are the paper's grade C/E options and it is explicit that they are
 * never defaults.
 *
 * ⚠️ THE WARM-UP IS SELECTED FROM THE FIRST HARD EFFORT, NOT FROM THE SESSION'S LENGTH. That is the
 * paper's central implementation rule and it is the opposite of how this app used to work: a 90
 * minute easy long run needs almost nothing before it because it BEGINS easy, while a 45 minute
 * session containing 10 x 400m at 5k pace needs a real one because its first repetition is
 * maximal-ish. Duration tells you about fuelling; the first hard effort tells you about warming up.
 *
 * ⚠️ IT MAY NEVER CLAIM TO PREVENT INJURY. The paper's one grade-A rule is about language, not
 * physiology: a 2024 meta-analysis found no pooled injury reduction from exercise programmes in
 * endurance runners, and the classic 1993 trial found none from warm-up education. So the allowed
 * claims are "prepares you for the demands of this session" and "helps you check how you are
 * responding today". `test/warmup.test.ts` fails on the banned phrasings, in every generated string.
 *
 * ⚠️ AND STRETCHING IS NOT THE MECHANISM. A 2025 running-specific review found no significant acute
 * effect of static, dynamic or PNF stretching on running economy, at low-to-very-low certainty. The
 * dynamic movements here are for rehearsal, range and a readiness check — never sold as making you
 * faster or safer, and never compulsory.
 */

import type { RpeBand, WorkoutStep } from "../domain/types.ts";

/**
 * ⚠️ Typed as the two fields it actually reads, not as a whole Session. The session library returns
 * SessionContent (no id, no dayOfWeek, no source) while the plan holds Session, and a warm-up is
 * generated from both — a preview in the builder and a scheduled session on Today. Naming either
 * concrete type forces a cast at one of the two call sites, and a cast is where the next wrong
 * assumption gets in.
 */
export type WarmupSession = { steps?: WorkoutStep[]; targetRpe?: RpeBand; exercises?: unknown[] };

export const WARMUP_MODEL_VERSION = "1.0.0";

/** How demanding the session's FIRST real work is — the key the whole warm-up hangs off. */
export type FirstHardEffort = "easy" | "steady" | "threshold" | "hard" | "maximal";

/** The paper's evidence labels, carried through to the screen so nothing looks more certain than it is. */
export type EvidenceGrade = "A" | "B" | "B/C" | "C" | "C/D" | "D";

export type AbilityBand = "new" | "beginner" | "intermediate" | "advanced";

export type WarmupConditions = {
  /**
   * The race distance, when this session IS the race.
   * ⚠️ A RACE IS WARMED UP BY ITS DISTANCE, NOT ITS INTENSITY. Every race is maximal effort, so
   * reading effort alone handed a half marathon the same 34-minute preparation as a VO2 session —
   * against a paper that gives a half 0-15 minutes, a marathon 0-12, and warns in as many words not
   * to copy 5 km logic into longer races. The longer the race, the less you warm up: the opening
   * kilometres do the job, and everything you spend beforehand is fuel and heat you do not get back.
   */
  raceDistance?: "5k" | "10k" | "half" | "marathon" | null;
  /** Degrees C, when known. */
  temperatureC?: number | null;
  /** Minutes the runner has. Undefined means "enough". */
  timeAvailableMinutes?: number | null;
  /** Reported illness, or pain that changes how they run. Blocks generation outright. */
  unwell?: boolean;
  /**
   * How ready the runner says they feel, 1–5.
   * ⚠️ IT CAN ONLY EVER REDUCE OR DELAY (the paper's acceptance criterion 4). A good score does not
   * unlock a bigger warm-up — there is no evidence for that and it is exactly the direction in which
   * an app talks someone into more work on a day they said they felt fine.
   */
  readiness?: number | null;
  /**
   * A formal test or a race — a session whose whole value depends on being properly prepared for.
   * ⚠️ TIME COMPRESSION DOES NOT APPLY. The paper is explicit: for a sprint race or a formal time
   * trial, less than the minimum safe preparation should return "warm-up incomplete" rather than
   * squeezing maximal-speed preparation into two minutes. Compressing it produces a number that
   * measures how badly the runner was warmed up.
   */
  formalTest?: boolean;
  /** Age, when known. Under 18 gets the paper's youth treatment. */
  ageYears?: number | null;
  /** The runner has a known mobility restriction or simply prefers a hold or two. */
  mobilityNeeds?: boolean;
};

/**
 * How to describe which stride carries the target pace — and it depends on HOW MANY there are.
 *
 * ⚠️ The copy was written once, for a full warm-up, and read as nonsense at the small end. A short
 * session gets a single stride, and the owner's phone showed *"1 × 20″ strides, the last one or two
 * at the pace you are about to run"* — a plural, a count of one, and a rule about "the last one or
 * two" of a set that has neither. With two, "the last one or two" means both, which is not what the
 * phase is for: the point of the closing stride is that everything before it is a build.
 */
export function strideTarget(strides: number, pace: string): string {
  if (strides <= 1) return `at ${pace}`;
  if (strides === 2) return `the last one at ${pace}`;
  return `the last one or two at ${pace}`;
}

export type WarmupPhase =
  // ⚠️ `title` is the SHORT name the live screen shows. Without it the raise was always labelled
  // "Warm up easy" — literally the wrong instruction for a run-walk beginner, whose raise is a
  // brisk walk. The module that decides what the phase IS owns what it is called.
  | { phase: "raise"; minutes: number; rpe: { min: number; max: number }; instruction: string; title?: string }
  | { phase: "mobilise"; movements: string[]; instruction: string }
  | { phase: "potentiate"; strides: number; seconds: number; effort: string; instruction: string }
  | { phase: "transition"; minutes: number; instruction: string };

export type Warmup = {
  modelVersion: string;
  firstHardEffort: FirstHardEffort;
  evidenceGrade: EvidenceGrade;
  /** True when the warm-up IS the opening of the run rather than something done beforehand. */
  embedded: boolean;
  /**
   * For an embedded warm-up: how long the run's OWN opening is, in minutes. The caller pins the
   * warm-up step to exactly this so the session keeps the length the plan gave it — the warm-up is
   * describing minutes that already exist, not asking for new ones. Absent when the run has no
   * opening of its own, in which case the caller carves the raise out of the first easy running.
   */
  openingMinutes?: number;
  totalMinutes: number;
  phases: WarmupPhase[];
  /** One plain sentence: why this warm-up, for this session, for this runner. */
  why: string;
  /** Conditions or limits that changed it, in the runner's words. */
  notes: string[];
  /**
   * True when the runner does not have enough time to prepare properly for a session whose value
   * depends on it. The caller must say so rather than quietly serving a compressed version.
   */
  incomplete?: boolean;
  /** What to do if the start is delayed (paper §7). Never repeat the warm-up; reactivate briefly. */
  delayPlan?: { afterMinutes: number; actions: string[] };
  /** The three questions to ask before starting (paper's readiness check). */
  readinessCheck?: string[];
};

/**
 * ⚠️ ASKED AFTER THE WARM-UP, NOT BEFORE. The paper's point is that the warm-up is itself the
 * readiness check — it is the first chance the runner has to find out what their legs think today,
 * and the answers change what happens next rather than being collected for a chart.
 */
export const WARMUP_READINESS_QUESTIONS = [
  "How ready do your legs feel, 1 to 5?",
  "Is your breathing back under control?",
  "Any pain that is sharp, getting worse, or changing how you run?",
];

/**
 * The movement library (paper §3). Deliberately small: the same review that supports these says
 * ten minutes of drills for every runner is not supported, so the generator picks two to five.
 */
export const WARMUP_MOVEMENTS = {
  ankle_rocks: "Ankle rocks, 8–12 each side",
  leg_swings_fb: "Leg swings front-to-back, 8–12 each side",
  leg_swings_lat: "Leg swings side-to-side, 8–12 each side",
  walking_lunge: "Walking lunge with a reach, 5–8 each side",
  a_march: "Marching on the spot or A-march, 2 × 15–20 m",
  a_skip: "A-skip, 2 × 15–20 m",
  high_knees: "High knees, 2 × 10–20 m",
  ankling: "Heel recovery / ankling, 2 × 15–20 m",
} as const;

/**
 * What does this session ask of you first?
 *
 * ⚠️ Read from the session's OWN STEPS, by effort, exactly as the fuelling module and the key-day
 * rule already do. Reading the session's title or type instead is how a "long run" carrying 20
 * minutes at goal pace gets a long run's warm-up, when its first real effort might be 25 minutes in.
 */
/**
 * Minutes of easy running before the first demanding step, after which the run has warmed itself up.
 * The paper's T2: a long run with a pace block later needs no second full warm-up; strides only if
 * that block starts inside the first 20 minutes.
 */
const EMBED_AFTER_MIN = 12;

/**
 * The first demanding step: what it asks for, and how much easy running comes before it.
 * ⚠️ Both halves matter. The effort sets the size of the warm-up; the minutes before it decide
 * whether the run warms ITSELF up — and, when it does, whether the work still arrives soon enough
 * to want a couple of strides first (the paper's T2: strides only if the block starts inside the
 * first 20 minutes).
 */
export function analyseSession(session: WarmupSession): { effort: FirstHardEffort; minutesBefore: number } {
  const steps = (session.steps || []) as WorkoutStep[];
  const sessionMax = session.targetRpe ? session.targetRpe.max : 0;
  let easyMin = 0;
  for (const s of steps) {
    const mins = (s.durationSeconds || 0) / 60;
    // ⚠️ THE SESSION'S OWN WARM-UP STEP DOES NOT COUNT. It is the thing being generated, not
    // evidence that the run warms itself up — counting it said an interval session had already had
    // 15 minutes of easy running before its first repetition, so nothing ever needed preparing for
    // and the stride rule below could never fire. Only easy running that is part of the RUN counts.
    if (s.kind === "warmup") continue;
    if (s.kind === "recovery") { easyMin += mins; continue; }
    const rpe = s.targetRpe ? s.targetRpe.max : (s.kind === "rep" ? sessionMax : 0);
    if (rpe >= 4) {
      const effort: FirstHardEffort = rpe >= 9 ? "maximal" : rpe >= 8 ? "hard" : rpe >= 6 ? "threshold" : "steady";
      return { effort, minutesBefore: Math.round(easyMin) };
    }
    easyMin += mins;
  }
  return { effort: "easy", minutesBefore: Math.round(easyMin) };
}

export function firstHardEffort(session: WarmupSession): FirstHardEffort {
  const a = analyseSession(session);
  // Past this much easy running the session has warmed itself up, whatever comes next.
  return a.minutesBefore >= EMBED_AFTER_MIN ? "easy" : a.effort;
}

const RAISE_MIN: Record<FirstHardEffort, number> = {
  easy: 0, steady: 10, threshold: 13, hard: 17, maximal: 20,
};
const STRIDES: Record<FirstHardEffort, number> = {
  easy: 0, steady: 2, threshold: 4, hard: 5, maximal: 5,
};
const GRADE: Record<FirstHardEffort, EvidenceGrade> = {
  // The paper grades its own templates; carrying them through stops the app sounding more certain
  // than the research is. Easy/long are frank coaching extrapolation.
  easy: "D", steady: "D", threshold: "B/C", hard: "B/C", maximal: "C/D",
};
const ABILITY_VOLUME: Record<AbilityBand, number> = {
  // Paper §8. A novice's warm-up must not become their first workout.
  new: 0.6, beginner: 0.75, intermediate: 1, advanced: 1.1,
};

export function buildWarmup(
  session: WarmupSession,
  ability: AbilityBand,
  conditions: WarmupConditions = {},
): Warmup | null {
  // ⚠️ SAFETY GATE FIRST, and it returns nothing at all rather than a gentler warm-up. The paper's
  // modifier order puts the medical gate above every performance rule precisely so that no later
  // scaling can talk its way past it.
  if (conditions.unwell) return null;

  // ⚠️ RUNNING SESSIONS ONLY, AND THE GATE LIVES HERE. A strength session's honest RPE 4-5 looks
  // exactly like a steady run to a generator that reads steps and effort — measured, "Strength
  // (maintenance)" was handed 24 minutes of easy jogging and four strides. A gate in the UI stops
  // it being SHOWN while every other caller still gets the wrong answer, which is how it reached
  // the duration figures. One gate, at the source.
  // ⚠️ The tell is a PACE OR A DISTANCE, not the step's kind. A strength session is a single
  // `steady` step of 45 minutes at RPE 6-7 with neither — indistinguishable from a tempo run if you
  // look at kind and effort, which is exactly what my first gate did and why it still handed
  // "Strength (maintenance)" 21 minutes of jogging and four strides. A session that is a list of
  // exercises is not a run either, whatever its steps say.
  const steps = (session.steps || []) as WorkoutStep[];
  if (session.exercises && session.exercises.length) return null;
  const runs = steps.some((s) => (s.targetPaceSecPerKm !== undefined) || (s.distanceMeters || 0) > 0);
  if (!runs) return null;

  const notes: string[] = [];
  const phases: WarmupPhase[] = [];

  // ---- Race day: set by the distance (paper R5-R8) ----
  if (conditions.raceDistance) {
    return raceWarmup(conditions.raceDistance, ability, conditions, notes);
  }

  const effort = firstHardEffort(session);
  // ⚠️ CONTINUOUS RUNNING WARMS ITSELF UP; REPETITIONS DO NOT. A 35-minute moderate run was being
  // given a 19-minute warm-up — more than half the session, to prepare for RPE 3-4 running you can
  // hold a conversation through. The distinction the paper actually draws is between a run that
  // BUILDS into its effort (start easy, let it come to you) and one that starts with a repetition
  // you have to be ready for. A steady effort reached by building is the former.
  const workSteps = (session.steps || []).filter((s: WorkoutStep) => s.kind === "rep");
  /**
   * ⚠️ REPETITIONS ARE NOT THE SAME THING AS INTENSITY, and reading them as such gave the app's most
   * fragile runner its most inappropriate warm-up.
   *
   * A run–walk session has NINE work steps, and every one of them is easy conversational running at
   * RPE 3–4. The repetitions exist because the runner cannot yet run continuously — not because the
   * effort is hard. Counting them sent a complete beginner down the structured path and produced,
   * measured on "Long run–walk · 9 × (1′30″ run / 1′30″ walk)":
   *   • **six minutes of CONTINUOUS easy running** as the raise, then three more to settle — nine
   *     minutes of unbroken running before a session that never asks for more than ninety seconds
   *     at a time, for someone whose whole plan exists because they cannot do that yet;
   *   • **a stride at RPE 5–7**, a near-10 km-effort acceleration, in week one;
   *   • 13.3 minutes of warm-up against 13.5 minutes of running in the session itself — against the
   *     paper's own §8 rule, quoted in ABILITY_VOLUME above, that *a novice's warm-up must not
   *     become their first workout*.
   * And the session already carried the right answer in its own step, "Brisk walk to warm up",
   * which the generator discarded.
   *
   * The low-intensity path below is the correct one: its `ability === "new"` copy is *"walk briskly
   * for 3–5 minutes, then mix a few minutes of easy running with short walks"*, and it carries no
   * strides by design. The gate is the WORK'S OWN EFFORT, so a format that alternates hard reps with
   * recoveries is unaffected however it is titled.
   *
   * ⚠️ AND A MISSING STEP RPE MEANS THE SESSION'S BAND, NOT ZERO. Written as
   * `(s.targetRpe ? s.targetRpe.max : 0) <= 4` this was far worse than the bug it fixed: quality reps
   * do not carry a step-level band — a threshold session probes at the SESSION's RPE 6–7 — so every
   * tempo and interval session read as "gentle" and would have been handed a beginner's brisk-walk
   * warm-up with no strides. The same undefined-reads-as-zero trap the progression audit hit when it
   * measured intensity from step RPE. `test/warmup.test.ts` caught it on the first run; the ordering
   * fallback is exactly what `analyseSession` already uses a few lines above.
   * A rep with no band anywhere is NOT gentle — unknown must fail toward the fuller warm-up.
   */
  const sessionRpeMax = session.targetRpe ? session.targetRpe.max : 0;
  const gentleReps = workSteps.length > 1 && workSteps.every((s: WorkoutStep) => {
    const r = s.targetRpe ? s.targetRpe.max : sessionRpeMax;
    return r > 0 && r <= 4;
  });
  const isContinuous = workSteps.length <= 1 || gentleReps;

  // ---- Easy, and continuous moderate running: the warm-up IS the opening of the run ----
  if (effort === "easy" || (effort === "steady" && isContinuous)) {
    // ⚠️ THE RUN'S OWN OPENING IS THE WARM-UP, SO ITS LENGTH IS THE RUN'S, NOT OURS. Sessions carry
    // their own opening step — 6 minutes on a progression run, 15 on a threshold one — and an
    // embedded warm-up is a description of those minutes. Advising a length of our own choosing made
    // three things disagree at once: the card said 8 minutes, the delivered step was another number,
    // and the session's total moved. Measured across 432 sessions, 69 had a duration chip that
    // disagreed with what Start delivered, the worst losing 10 minutes of a 45-minute session.
    // ⚠️ A REAL FIVE-MINUTE WARM-UP AND SOME STRETCHES — NOT "your opening minutes are the warm-up"
    // (owner's decision, 2026-08-03). The embedded model described minutes the run already contained,
    // which is why the named time had to include them. He asked for the opposite: a standard short
    // warm-up for the low-intensity sessions, done BEFORE the named time starts. So this path is no
    // longer embedded, it carries a mobilise phase, and the session's own opening step is replaced by
    // it exactly as the structured warm-ups are.
    // ⚠️ Five minutes flat, and deliberately NOT scaled by ability: it is already the shortest warm-up
    // the model produces, and a new runner needs the gentle opening more than an experienced one, not
    // less. What ability still changes here is the strides below.
    const mins = 5;
    const ownMin = Math.round(steps.filter((s) => s.kind === "warmup")
      .reduce((a, s) => a + (s.durationSeconds || 0), 0) / 60);
    phases.push({
      phase: "raise", minutes: mins, rpe: { min: 2, max: 2 },
      title: ability === "new" ? "Brisk walk, easing into running" : "Warm up easy",
      instruction: ability === "new"
        ? "Walk briskly for 3–5 minutes, then mix a few minutes of easy running with short walks until it feels settled."
        : `Run the first ${mins} minutes slower than your normal easy pace, then let it settle.`,
    });
    // ⚠️ AN EMBEDDED WARM-UP STILL WANTS STRIDES WHEN THE WORK COMES SOON. The paper's T2 is
    // specific: no second full warm-up for a run whose pace block is later, but 2-4 progressive
    // strides IF that block starts inside the first 20 minutes — because by then the run's own
    // opening has had barely any time to do the job. Novices are exempt; their sessions do not open
    // with work this soon, and strides are the component the paper caps hardest for them.
    const look = analyseSession(session);
    // ⚠️ COUNT THE WARM-UP THE RUNNER IS ACTUALLY GOING TO DO. `analyseSession` deliberately skips
    // the session's own warm-up step (it is the thing being replaced), so `minutesBefore` is the
    // run's easy running ALONE — and asking "does the work start inside 20 minutes?" of that number
    // answers a question nobody asked. The delivered session opens with this raise: measured on
    // "40′ easy → moderate finish", the lift arrives 26 minutes in, and the old gate read 18 and
    // fired, printing "the quicker running starts early in this one" above a session where it
    // starts at 60% distance. The paper's 20 minutes is about how long the opening has had to do
    // its job, which is raise + easy, not easy on its own.
    // ⚠️ And it counts the WHOLE opening, not the advised part of it. A threshold progression opens
    // with 15 minutes of easy running of which we advise the first 5 be slower still; all 15 prime
    // the runner. Using the advice instead put "the quicker running starts early" on 12 sessions
    // whose first effort was 25-28 minutes in.
    // A few easy movements before the run — the "stretches" the owner asked for, in the model's own
    // language: rehearsal and a check on how you feel, never sold as making you faster or safer.
    const mob = ability === "new"
      ? [WARMUP_MOVEMENTS.ankle_rocks, WARMUP_MOVEMENTS.leg_swings_fb]
      : [WARMUP_MOVEMENTS.ankle_rocks, WARMUP_MOVEMENTS.leg_swings_fb, WARMUP_MOVEMENTS.leg_swings_lat];
    phases.push({
      phase: "mobilise", movements: mob,
      instruction: "Move through a comfortable range — this is rehearsal and a check on how you feel today, not stretching for its own sake.",
    });
    // ⚠️ NO STRIDES ON THIS PATH ANY MORE. The owner specified what a low-intensity warm-up is —
    // five easy minutes and some movements — and strides are neither. They were here to bridge into a
    // pace block arriving inside the first 20 minutes, a job the real warm-up now does; keeping them
    // meant a gate that had to guess how far away the work was, and it kept guessing wrong (strides
    // 12 minutes before the effort, "the quicker running starts early" above a session whose first
    // effort is 23 minutes in). Sessions that genuinely open with repetitions still get the full
    // structured warm-up, strides included, further down.
    return {
      modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: effort, evidenceGrade: GRADE[effort],
      // ⚠️ NOT EMBEDDED ANY MORE. This is time spent before the run's named minutes begin, so it is
      // added to what the session sheet shows and to what Start counts through — the same treatment a
      // threshold session's warm-up already gets. `openingMinutes` is deliberately absent: it existed
      // to pin an embedded raise to the run's own opening, and there is no longer an opening to pin to.
      embedded: false,
      totalMinutes: mins + 3 + (phases.some((p) => p.phase === "potentiate") ? 4 : 0),
      phases,
      why: "Five easy minutes and a few movements before the run proper — enough for a session this gentle, and it comes before the time on the card rather than out of it.",
      notes,
    };
  }

  // ---- Everything else: raise, mobilise, potentiate, transition ----
  let vol = ABILITY_VOLUME[ability];
  if (ability === "new" || ability === "beginner") {
    notes.push("Shorter and gentler than the full version, because a warm-up should never be the hardest part of your day.");
  }

  // ⚠️ Youth: technique-led and smaller, and never the adult template scaled down on paper only.
  const youth = typeof conditions.ageYears === "number" && conditions.ageYears < 18;
  if (youth) {
    vol *= 0.75;
    notes.push("Kept simple and well short of a workout — building the habit of preparing properly matters more at your age than the size of it.");
  }

  // ⚠️ Readiness can ONLY reduce. See the note on the field.
  const rd = conditions.readiness;
  if (typeof rd === "number" && rd > 0 && rd <= 2) {
    vol *= 0.8;
    notes.push("You said you are not feeling great today, so this is shorter and the strides stay controlled — start the first effort conservatively and see how it goes.");
  }

  const t = conditions.temperatureC;
  // ⚠️ Kept separately from `vol` so the proportion cap below can move with the WEATHER but not with
  // ability or readiness. A cold morning genuinely warrants a longer preparation, so a cap that ignored
  // it flattened the cold and mild warm-ups to the same number and broke "cold adds easy minutes".
  // Ability and readiness must NOT loosen the cap — that is the disproportion it exists to prevent.
  let tempFactor = 1;
  if (typeof t === "number" && t >= 24) {
    // ⚠️ HEAT ONLY EVER REMOVES. The paper's content assertion is explicit that heat logic never
    // adds active duration — arriving overheated costs more than arriving under-warmed.
    vol *= 0.7; tempFactor = 0.7;
    notes.push("Cut short for the heat — get ready in the shade and arrive warm, not cooked.");
  } else if (typeof t === "number" && t <= 5) {
    // ⚠️ COLD ADDS EASY ACTIVITY AND CLOTHING, NEVER HARDER WORK.
    vol *= 1.15; tempFactor = 1.15;
    notes.push("A little longer in the cold, and keep a layer on until you start — extra easy minutes, not harder ones.");
  }

  let raise = Math.round(RAISE_MIN[effort] * vol);
  let strides = Math.max(0, Math.round(STRIDES[effort] * (ability === "new" ? 0.5 : ability === "beginner" ? 0.75 : 1)));
  let movements = pickMovements(effort, ability);
  let transition = effort === "maximal" ? 4 : 3;

  if (typeof rd === "number" && rd > 0 && rd <= 2) strides = Math.min(strides, 2);
  if (youth) strides = Math.min(strides, 3);

  // ---- Time compression (paper's table): keep the specific, drop the extras ----
  const avail = conditions.timeAvailableMinutes;
  if (typeof avail === "number" && avail > 0) {
    const full = raise + 3 + Math.ceil((strides * 75) / 60) + transition;
    // ⚠️ A FORMAL TEST IS NOT COMPRESSED, IT IS DECLINED. Squeezing the preparation for a time trial
    // produces a time that measures the warm-up rather than the runner — and the whole point of the
    // test is that it is comparable with the last one.
    if (avail < full && conditions.formalTest) {
      return {
        modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: effort, evidenceGrade: GRADE[effort],
        embedded: false, totalMinutes: full, phases: [], incomplete: true,
        why: "There is not enough time to prepare properly for this one, and a rushed warm-up would make the result mean something different from your last test.",
        notes: [`Give it about ${full} minutes, or move the test to a day you have them. A time trial is only worth doing if it is comparable.`],
      };
    }
    if (avail < full) {
      if (avail >= 12) { raise = Math.max(6, avail - 8); movements = movements.slice(0, 3); strides = Math.min(strides, 4); }
      else if (avail >= 6) { raise = Math.max(4, avail - 4); movements = movements.slice(0, 2); strides = Math.min(strides, 3); transition = 1; }
      else { raise = Math.max(3, avail - 1); movements = movements.slice(0, 1); strides = Math.min(strides, 1); transition = 1; }
      notes.push("Squeezed to fit the time you have — the easy running and a couple of strides are what matter most, so the extras went first.");
    }
  }

  // ⚠️ THE CAP MUST RUN BEFORE THE PHASES ARE BUILT, and for a long time it did not. It sat after this
  // point and only adjusted `totalMinutes`, so it changed the NUMBER ON THE CARD and never the session:
  // every phase had already been pushed with the uncapped raise. A guard that cannot reach what it
  // guards is not a guard, and this one also made the card disagree with the run it described.
  // ⚠️ COUNT DISTANCE-BASED REPS, OR THE CAP SILENTLY DOES NOTHING. Reading durationSeconds alone made
  // "5 x 1000 m" measure as ZERO work, so the guard below was skipped entirely for every distance-based
  // interval session — the sessions most likely to need it. The same field trap caught my own audit
  // instrument twice; here it was in the shipped code.
  const stepMin = (s: WorkoutStep): number => {
    if (s.durationSeconds) return s.durationSeconds / 60;
    if (s.distanceMeters && s.targetPaceSecPerKm) {
      const mid = (s.targetPaceSecPerKm.minSecPerKm + s.targetPaceSecPerKm.maxSecPerKm) / 2;
      return ((s.distanceMeters / 1000) * mid) / 60;
    }
    if (s.distanceMeters) return s.distanceMeters / 4 / 60;   // effort-only, ~4 m/s
    return 0;
  };
  const workMin = ((session.steps || []) as WorkoutStep[])
    .filter((s) => s.kind !== "warmup" && s.kind !== "cooldown")
    .reduce((a, s) => a + stepMin(s), 0);
  // ⚠️ THE CAP NOW APPLIES TO REPETITION SESSIONS TOO — the owner looked at a real one and said so
  // (2026-08-06). It used to be gated on `isContinuous`, on the reasoning that the paper's worked
  // example wants "a distinct warm-up because the first repetition is demanding". True, but unbounded
  // it delivered 33 MINUTES OF WARM-UP FOR 19 MINUTES OF WORK on 10 x 1', against a template that had
  // asked for 15. A warm-up nearly twice what the plan wrote, and longer than the session, is not what
  // that sentence is arguing for.
  //
  // Repetition sessions keep a more generous ratio than continuous ones (0.9 against 0.7) because the
  // first rep really is demanding, and the floor rises to 10 minutes so a short sharp session still
  // gets a real preparation. On 10 x 1' that lands at ~15 minutes — which is what the plan asked for.
  if (workMin > 0) {
    const cap = Math.max(10, Math.round(workMin * (isContinuous ? 0.7 : 0.9) * tempFactor));
    let total = raise + (movements.length ? 3 : 0) + Math.ceil((strides * 75) / 60) + transition;
    if (total > cap) {
      // Trim the easy running first — the strides are the part that is specific to the work ahead.
      raise = Math.max(5, raise - (total - cap));
      total = raise + (movements.length ? 3 : 0) + Math.ceil((strides * 75) / 60) + transition;
      if (total > cap) { strides = Math.max(1, strides - 1); movements = movements.slice(0, 3); }
      notes.push("Kept in proportion to the session — a warm-up longer than the running it prepares you for is just a workout with a different name.");
    }
  }

  phases.push({
    phase: "raise", minutes: raise, rpe: { min: 2, max: 3 },
    instruction: `${raise} minutes easy — start very gently and finish at your normal easy effort. You should be able to talk in full sentences throughout.`,
  });
  if (conditions.mobilityNeeds) {
    // ⚠️ OPTIONAL, SHORT, AND FOLLOWED BY MOVEMENT. The paper does not support making stretching
    // compulsory — a 2025 review found no reliable acute effect on running economy either way — but
    // it does allow a hold or two for someone with a known restriction, provided it is brief and
    // dynamic work follows it. Long holds immediately before fast running are the thing to avoid.
    movements = ["One or two comfortable holds of 15–30 seconds on the tight spot, then keep moving", ...movements];
    notes.push("The hold is there because you asked for it — keep it short, never stretch into pain, and let the running that follows do the real preparation.");
  }
  if (movements.length) {
    phases.push({
      phase: "mobilise", movements,
      instruction: "Move through a comfortable range — this is rehearsal and a check on how you feel today, not stretching. Never force it, and never bounce at the end of the range.",
    });
  }
  if (strides > 0) {
    const pace = effort === "threshold" ? "about 10 km effort"
      : effort === "hard" ? "about the pace of your first repetition"
      : "the pace you are about to run";
    const target = strideTarget(strides, pace);
    phases.push({
      phase: "potentiate", strides, seconds: 20, effort: target,
      instruction: `${strides} × 20 seconds relaxed and progressive, ${target}.${
        strides > 1 ? " Walk or jog until your breathing is back before the next one." : ""
      } A stride is a smooth build, not a sprint.`,
    });
  }
  phases.push({
    phase: "transition", minutes: transition,
    instruction: `${transition} minutes easy. Start when your breathing is under control and your legs feel like they will answer.`,
  });

  // ⚠️ THE WARM-UP MUST NEVER BECOME THE SESSION. The paper asks for "the smallest warm-up that
  // prepares the athlete for the first demanding task", and says in as many words that a novice's
  // warm-up must not become their first workout. Nothing enforced that, so a short session could be
  // handed a warm-up longer than the running it was preparing for. Capped against the session's own
  // work — never below six minutes, because something is always needed before hard running.
  return {
    modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: effort, evidenceGrade: GRADE[effort],
    embedded: false,
    totalMinutes: raise + (movements.length ? 3 : 0) + Math.ceil((strides * 75) / 60) + transition,
    phases,
    why: whyLine(effort),
    notes,
    // ⚠️ NEVER REPEAT THE WARM-UP AFTER A DELAY — reactivate briefly instead. Repeating it spends
    // the runner twice, and in heat it adds thermal strain on top.
    delayPlan: {
      afterMinutes: 12,
      actions: (typeof t === "number" && t >= 24)
        ? ["Stay in the shade and keep still", "One short stride shortly before you start"]
        : ["Keep a layer on", "2 minutes easy moving", "One relaxed stride before you start"],
    },
    readinessCheck: WARMUP_READINESS_QUESTIONS,
  };
}

/** Race-day warm-ups, from the paper's R5-R8. Short races need preparing for; long ones need you
 *  to arrive with everything you have. */
function raceWarmup(
  distance: "5k" | "10k" | "half" | "marathon",
  ability: AbilityBand,
  conditions: WarmupConditions,
  notes: string[],
): Warmup {
  // ⚠️ THREE TIERS, NOT TWO. The paper gives advanced runners a longer raise and more strides at
  // every distance — 15-20 min and 4-6 strides before a 5 km against the intermediate's 10-15 and
  // 4-5, and 2-4 short strides before a marathon where an intermediate usually has none. Collapsing
  // advanced into intermediate gave an experienced runner a novice-adjacent race routine, which is
  // the one place the paper says least about averages and most about the individual.
  const tier = (ability === "new" || ability === "beginner") ? "novice"
    : ability === "advanced" ? "advanced" : "intermediate";
  const novice = tier === "novice";
  const spec = {
    "5k":      { novice: { raise: 8, strides: 2 }, intermediate: { raise: 13, strides: 4 }, advanced: { raise: 17, strides: 5 } },
    "10k":     { novice: { raise: 6, strides: 0 }, intermediate: { raise: 10, strides: 3 }, advanced: { raise: 15, strides: 5 } },
    half:      { novice: { raise: 0, strides: 0 }, intermediate: { raise: 8, strides: 3 },  advanced: { raise: 12, strides: 4 } },
    marathon:  { novice: { raise: 0, strides: 0 }, intermediate: { raise: 6, strides: 0 },  advanced: { raise: 9, strides: 2 } },
  }[distance][tier];
  let raise = spec.raise, strides = spec.strides;
  const t = conditions.temperatureC;
  if (typeof t === "number" && t >= 24) {
    raise = Math.round(raise * 0.6); strides = Math.max(0, strides - 1);
    notes.push("Cut right back for the heat — every minute you run beforehand is heat you carry to the start line.");
  }
  const phases: WarmupPhase[] = [];
  if (raise > 0) {
    phases.push({ phase: "raise", minutes: raise, rpe: { min: 2, max: 3 },
      instruction: `${raise} minutes very easy. This is not training — it is just getting the engine turning over.` });
  } else {
    phases.push({ phase: "raise", minutes: 5, rpe: { min: 1, max: 2 },
      instruction: "No running needed beforehand. Walk briskly while you sort your kit, and use the first kilometre or two of the race itself as the warm-up — deliberately slower than your target pace." });
  }
  // The paper gives an advanced runner "an individual drill sequence" rather than two movements.
  const moves = tier === "advanced"
    ? [WARMUP_MOVEMENTS.ankle_rocks, WARMUP_MOVEMENTS.leg_swings_fb, WARMUP_MOVEMENTS.leg_swings_lat, WARMUP_MOVEMENTS.a_skip]
    : [WARMUP_MOVEMENTS.ankle_rocks, WARMUP_MOVEMENTS.leg_swings_fb];
  phases.push({ phase: "mobilise", movements: moves,
    instruction: tier === "advanced"
      ? "Your own routine, if you have one — this is the shape of it. Race day is not the time to add something new."
      : "A couple of easy movements to check how the legs feel. Nothing forced." });
  if (strides > 0) {
    const target = strideTarget(strides, "race pace");
    phases.push({ phase: "potentiate", strides, seconds: 15, effort: target,
      instruction: `${strides} × 15 seconds relaxed, ${target} — just enough to make it feel familiar.` });
  }
  phases.push({ phase: "transition", minutes: 5,
    instruction: "Finish 3–8 minutes before the gun, and keep moving gently rather than standing still." });
  const why = distance === "marathon" || distance === "half"
    ? "A long race warms you up itself. Anything substantial beforehand costs fuel you will want later, so this is deliberately small."
    : "A short race starts at full effort, so most of the preparation has to happen before the gun rather than in the first kilometre.";
  if (novice && (distance === "half" || distance === "marathon")) {
    notes.push("Your first job is to finish, so start the race easier than feels right — the opening kilometres are the rest of your warm-up.");
  }
  return {
    modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: "maximal",
    evidenceGrade: distance === "5k" || distance === "10k" ? "C/D" : "D",
    embedded: raise === 0, totalMinutes: raise + 2 + Math.ceil((strides * 45) / 60) + 5,
    phases, why, notes,
  };
}

function pickMovements(effort: FirstHardEffort, ability: AbilityBand): string[] {
  const M = WARMUP_MOVEMENTS;
  const base: string[] = [M.ankle_rocks, M.leg_swings_fb, M.leg_swings_lat];
  // ⚠️ A-skips ask for coordination a new runner does not have yet; the paper says use a march
  // instead rather than dropping the rhythm work altogether.
  if (ability === "new" || ability === "beginner") return [...base.slice(0, effort === "steady" ? 2 : 3), M.a_march];
  const more: string[] = [...base, M.walking_lunge, M.a_skip];
  if (effort === "hard" || effort === "maximal") more.push(M.ankling);
  return more.slice(0, effort === "steady" ? 3 : effort === "threshold" ? 4 : 5);
}

/**
 * ⚠️ Every one of these is written inside the paper's allowed language. "Prepares you for", "helps
 * you check how you are responding" — never "prevents injury", "protects your joints", or any
 * promise that finishing the warm-up makes the session safe.
 */
function whyLine(effort: FirstHardEffort): string {
  switch (effort) {
    case "steady": return "This session settles into controlled aerobic running, so it needs enough easy running to feel warm and a couple of strides to wake the legs up.";
    case "threshold": return "The first hard piece here is comfortably hard, so the warm-up prepares you for that pace rather than for the length of the session.";
    case "hard": return "Your first repetition is quick, so this prepares you for that speed — the aim is to arrive ready for repetition one rather than tired from getting ready.";
    case "maximal": return "This session asks for near-maximal running early, which is the one case where most of the preparation has to happen before you start.";
    default: return "This prepares you for the demands of the session ahead.";
  }
}
