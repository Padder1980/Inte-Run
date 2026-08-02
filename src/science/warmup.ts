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
export type WarmupSession = { steps?: WorkoutStep[]; targetRpe?: RpeBand };

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
};

export type WarmupPhase =
  | { phase: "raise"; minutes: number; rpe: { min: number; max: number }; instruction: string }
  | { phase: "mobilise"; movements: string[]; instruction: string }
  | { phase: "potentiate"; strides: number; seconds: number; effort: string; instruction: string }
  | { phase: "transition"; minutes: number; instruction: string };

export type Warmup = {
  modelVersion: string;
  firstHardEffort: FirstHardEffort;
  evidenceGrade: EvidenceGrade;
  /** True when the warm-up IS the opening of the run rather than something done beforehand. */
  embedded: boolean;
  totalMinutes: number;
  phases: WarmupPhase[];
  /** One plain sentence: why this warm-up, for this session, for this runner. */
  why: string;
  /** Conditions or limits that changed it, in the runner's words. */
  notes: string[];
};

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
const EMBED_AFTER_MIN = 18;

export function firstHardEffort(session: WarmupSession): FirstHardEffort {
  const steps = (session.steps || []) as WorkoutStep[];
  // ⚠️ A `rep` STEP CARRIES NO RPE OF ITS OWN -- the band lives on the SESSION. Reading only the
  // step returns nothing for every interval session in the library, which graded 10 x 400m at 5k
  // pace as "easy" and would have handed it a long run's warm-up. The session band describes the
  // reps; that is what to read.
  const sessionMax = session.targetRpe ? session.targetRpe.max : 0;
  // ⚠️ FIRST, NOT HARDEST. This is the whole rule and getting it wrong is not subtle: taking the
  // PEAK effort gave a 45-minute easy run with strides on the end a 34-minute warm-up — longer than
  // a VO2 session — because it looked past three quarters of an hour of easy running to find the
  // fastest thing in the session. It also put 24 minutes of preparation in front of a 135-minute
  // long run whose first 40 minutes are easy. Walk the steps in order, stop at the first demanding
  // one, and count how much easy running came before it.
  let easyMin = 0;
  for (const s of steps) {
    const mins = (s.durationSeconds || 0) / 60;
    // The jog BETWEEN reps is recovery, not work; charging it the session's band would say every
    // interval session opens hard even when it opens with a jog.
    if (s.kind === "recovery") { easyMin += mins; continue; }
    const rpe = s.targetRpe ? s.targetRpe.max : (s.kind === "rep" ? sessionMax : 0);
    if (rpe >= 4 && s.kind !== "warmup") {
      // ⚠️ The run has already warmed itself up by the time the work starts.
      if (easyMin >= EMBED_AFTER_MIN) return "easy";
      if (rpe >= 9) return "maximal";
      if (rpe >= 8) return "hard";
      if (rpe >= 6) return "threshold";
      return "steady";
    }
    easyMin += mins;
  }
  return "easy";
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

  const notes: string[] = [];
  const phases: WarmupPhase[] = [];

  // ---- Race day: set by the distance (paper R5-R8) ----
  if (conditions.raceDistance) {
    return raceWarmup(conditions.raceDistance, ability, conditions, notes);
  }

  const effort = firstHardEffort(session);

  // ---- Easy and long runs: the warm-up IS the first few minutes of the run ----
  if (effort === "easy") {
    const mins = ability === "new" || ability === "beginner" ? 5 : 8;
    phases.push({
      phase: "raise", minutes: mins, rpe: { min: 2, max: 2 },
      instruction: ability === "new"
        ? "Walk briskly for 3–5 minutes, then mix a few minutes of easy running with short walks until it feels settled."
        : `Run the first ${mins} minutes slower than your normal easy pace, then let it settle.`,
    });
    return {
      modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: effort, evidenceGrade: GRADE[effort],
      embedded: true, totalMinutes: mins, phases,
      why: "This run starts easy, so the opening few minutes are the warm-up — there is nothing here demanding enough to need preparing for separately.",
      notes,
    };
  }

  // ---- Everything else: raise, mobilise, potentiate, transition ----
  let vol = ABILITY_VOLUME[ability];
  if (ability === "new" || ability === "beginner") {
    notes.push("Shorter and gentler than the full version, because a warm-up should never be the hardest part of your day.");
  }

  const t = conditions.temperatureC;
  if (typeof t === "number" && t >= 24) {
    // ⚠️ HEAT ONLY EVER REMOVES. The paper's content assertion is explicit that heat logic never
    // adds active duration — arriving overheated costs more than arriving under-warmed.
    vol *= 0.7;
    notes.push("Cut short for the heat — get ready in the shade and arrive warm, not cooked.");
  } else if (typeof t === "number" && t <= 5) {
    // ⚠️ COLD ADDS EASY ACTIVITY AND CLOTHING, NEVER HARDER WORK.
    vol *= 1.15;
    notes.push("A little longer in the cold, and keep a layer on until you start — extra easy minutes, not harder ones.");
  }

  let raise = Math.round(RAISE_MIN[effort] * vol);
  let strides = Math.max(0, Math.round(STRIDES[effort] * (ability === "new" ? 0.5 : ability === "beginner" ? 0.75 : 1)));
  let movements = pickMovements(effort, ability);
  let transition = effort === "maximal" ? 4 : 3;

  // ---- Time compression (paper's table): keep the specific, drop the extras ----
  const avail = conditions.timeAvailableMinutes;
  if (typeof avail === "number" && avail > 0) {
    const full = raise + 3 + Math.ceil((strides * 75) / 60) + transition;
    if (avail < full) {
      if (avail >= 12) { raise = Math.max(6, avail - 8); movements = movements.slice(0, 3); strides = Math.min(strides, 4); }
      else if (avail >= 6) { raise = Math.max(4, avail - 4); movements = movements.slice(0, 2); strides = Math.min(strides, 3); transition = 1; }
      else { raise = Math.max(3, avail - 1); movements = movements.slice(0, 1); strides = Math.min(strides, 1); transition = 1; }
      notes.push("Squeezed to fit the time you have — the easy running and a couple of strides are what matter most, so the extras went first.");
    }
  }

  phases.push({
    phase: "raise", minutes: raise, rpe: { min: 2, max: 3 },
    instruction: `${raise} minutes easy — start very gently and finish at your normal easy effort. You should be able to talk in full sentences throughout.`,
  });
  if (movements.length) {
    phases.push({
      phase: "mobilise", movements,
      instruction: "Move through a comfortable range — this is rehearsal and a check on how you feel today, not stretching. Never force it, and never bounce at the end of the range.",
    });
  }
  if (strides > 0) {
    const target = effort === "threshold" ? "building to about 10 km effort"
      : effort === "hard" ? "the last one at about the pace of your first repetition"
      : "the last one or two at the pace you are about to run";
    phases.push({
      phase: "potentiate", strides, seconds: 20, effort: target,
      instruction: `${strides} × 20 seconds relaxed and progressive, ${target}. Walk or jog until your breathing is back before the next one. A stride is a smooth build, not a sprint.`,
    });
  }
  phases.push({
    phase: "transition", minutes: transition,
    instruction: `${transition} minutes easy. Start when your breathing is under control and your legs feel like they will answer.`,
  });

  return {
    modelVersion: WARMUP_MODEL_VERSION, firstHardEffort: effort, evidenceGrade: GRADE[effort],
    embedded: false,
    totalMinutes: raise + (movements.length ? 3 : 0) + Math.ceil((strides * 75) / 60) + transition,
    phases,
    why: whyLine(effort),
    notes,
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
  const novice = ability === "new" || ability === "beginner";
  const spec = {
    // raise minutes, strides, transition minutes
    "5k": novice ? { raise: 8, strides: 2 } : { raise: 13, strides: 4 },
    "10k": novice ? { raise: 6, strides: 0 } : { raise: 10, strides: 3 },
    half: novice ? { raise: 0, strides: 0 } : { raise: 8, strides: 3 },
    marathon: novice ? { raise: 0, strides: 0 } : { raise: 6, strides: 0 },
  }[distance];
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
  phases.push({ phase: "mobilise", movements: [WARMUP_MOVEMENTS.ankle_rocks, WARMUP_MOVEMENTS.leg_swings_fb],
    instruction: "A couple of easy movements to check how the legs feel. Nothing forced." });
  if (strides > 0) {
    phases.push({ phase: "potentiate", strides, seconds: 15, effort: "the last one around race pace",
      instruction: `${strides} × 15 seconds relaxed, the last one around race pace — just enough to make it feel familiar.` });
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
