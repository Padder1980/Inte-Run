// Top-level plan generator: goal + athlete → a periodized plan of weeks and sessions.
//
// It composes the science layer (paces, intensity model, taper) with periodization and the session
// library. Design rules encoded here, all traceable to the research brief:
//  - pyramidal by default (lots of easy, some threshold, little VO2); polarized optional
//  - one quality session/week in base and when returning from injury; two once building
//  - a long run every week, progressing in duration (durability), backing off on deload/taper
//  - hard days never back-to-back
//  - strength 2×/week through base/build, easing to 1× near the race (when enabled)
//  - the plan spans the whole runway: surplus time extends a progressive base (opening with a
//    pure-aerobic foundation block), while build/peak/taper stay concentrated near the race

import type {
  Athlete,
  Goal,
  IntensityModel,
  Phase,
  PlannedWeek,
  Session,
  TrainingPaces,
} from "../domain/types.ts";
import { chooseModel } from "../science/intensity-distribution.ts";
import { computeMas, masVo2Range } from "../science/mas.ts";
import { deriveTrainingPaces, withHrZones } from "../science/paces.ts";
import { taperFor } from "../science/taper.ts";
import { addDays, dayOfWeekMondayZero, daysBetween, isoToday, weeksBetween } from "./dates.ts";
import { type WeekPlan, phaseSchedule, structuredWeekCount } from "./periodization.ts";
import {
  contExplore,
  contPickups,
  contProgression,
  easyHillStrides,
  easyRun,
  generalStrengthSession,
  longRun,
  mobilitySession,
  raceSpecificSession,
  restDay,
  rwBuildup,
  rwExplore,
  rwLadder,
  rwLong,
  rwSteady,
  type SessionContent,
  strengthSession,
  thresholdSession,
  vo2Session,
} from "./session-templates.ts";

export type GenerateOptions = {
  intensityModel?: IntensityModel;
  startDateIso?: string;
};

const PEAK_LONG_MIN: Record<Goal["distance"], number> = {
  "1mile": 55,
  "5k": 70,
  "10k": 85,
  half: 110,
  marathon: 150,
};

// Day-of-week scheduling (0 = Mon … 6 = Sun) is expressed RELATIVE to the long run, then rotated to
// whatever long-run day the athlete prefers. The offsets below reproduce the proven Sunday-long
// layout (quality Tue/Thu, easy Wed/Fri/Mon/Sat); because every spacing rule — hard days separated,
// hard days never adjacent to the long run — is rotation-invariant, the same rotation honours any
// chosen long-run day while preserving those rules.
const QUALITY_REL = [2, 4]; // days after the long run
const EASY_REL = [3, 5, 1, 6];
const MOB_PREF_REL = [3, 5, 1, 6, 4, 2]; // preferred order for the mobility / free day
const BEG_EASY_REL = [2, 4, 6]; // beginner easy days — a rest day always sits between runs
const BEG_STRENGTH_REL = [1, 5];
const dayRel = (longDay: number, rel: number) => (longDay + rel) % 7;
const longRunDayOf = (a: Athlete) => ((a.longRunDay ?? 6) % 7 + 7) % 7;

export function generatePlan(
  athlete: Athlete,
  goal: Goal,
  options: GenerateOptions = {},
): {
  goal: Goal;
  athlete: Athlete;
  createdAtIso: string;
  intensityModel: IntensityModel;
  paces: TrainingPaces;
  totalWeeks: number;
  weeks: PlannedWeek[];
  notes: string[];
} {
  const startIso = options.startDateIso ?? goal.startDateIso ?? isoToday();
  const raceMonday = addDays(goal.raceDateIso, -dayOfWeekMondayZero(goal.raceDateIso));
  // Count calendar weeks inclusive of the start week and the race week, so week 1 aligns to the
  // Monday of the athlete's start week (its earlier days are trimmed later for a mid-week start).
  const startWeekMonday = addDays(startIso, -dayOfWeekMondayZero(startIso));
  const totalWeeks = Math.max(0, weeksBetween(startWeekMonday, raceMonday) + 1);
  const structuredWeeks = structuredWeekCount(totalWeeks, goal.distance);

  const returning = athlete.returningFromInjury ?? false;
  const model = options.intensityModel ?? chooseModel(athlete);
  const paces = withHrZones(deriveTrainingPaces(athlete.recent, goal), athlete);
  // If the athlete has done a 1 km time trial, anchor VO₂/interval pace to their MAS — a direct,
  // test-based target rather than one projected from their race pace.
  if (athlete.oneKmTrialSeconds && athlete.oneKmTrialSeconds > 0) {
    paces.vo2 = masVo2Range(computeMas(athlete.oneKmTrialSeconds).masMps);
  }
  const schedule = annotate(phaseSchedule(structuredWeeks, goal.distance, returning));

  const peakLong = PEAK_LONG_MIN[goal.distance];
  const startLong = Math.round(peakLong * (returning ? 0.42 : 0.55));
  const nonTaperCount = schedule.filter((s) => s.phase !== "taper").length;
  const taper = taperFor(goal.distance);

  // Complete beginners get a gentler, purpose-built progression (run–walk or short easy running,
  // general strength, no intervals) rather than the standard threshold/VO2 structure.
  const beginner = athlete.experience === "beginner";
  const runWalk = athlete.runWalk ?? false;

  const weeks: PlannedWeek[] = schedule.map((wp, i) => {
    const weekIndex = i + 1;
    const startDateIso = addDays(raceMonday, -(structuredWeeks - weekIndex) * 7);
    if (beginner) {
      return buildBeginnerWeek(weekIndex, startDateIso, wp, { athlete, goal, paces, returning, longMin: 0 }, structuredWeeks, runWalk);
    }
    const longMin = longRunMinutes(
      wp,
      weekIndex,
      nonTaperCount,
      startLong,
      peakLong,
      taper.volumeMultiplierByWeek,
    );
    return buildWeek(weekIndex, startDateIso, wp, {
      athlete,
      goal,
      paces,
      returning,
      longMin,
    });
  });

  // If the athlete starts mid-week, make week 1 pro-rata: drop the sessions that fall before the
  // start day; full Monday–Sunday weeks follow.
  applyPartialFirstWeek(weeks, startIso);

  return {
    goal,
    athlete,
    createdAtIso: isoToday(),
    intensityModel: model,
    paces,
    totalWeeks,
    weeks,
    notes: buildNotes(athlete, goal, totalWeeks, structuredWeeks, model, weeks),
  };
}

// ---- per-week assembly ----------------------------------------------------

type AnnotatedWeek = WeekPlan & { ordinalInPhase: number; phaseTotal: number };

type WeekContext = {
  athlete: Athlete;
  goal: Goal;
  paces: TrainingPaces;
  returning: boolean;
  longMin: number;
};

function buildWeek(
  index: number,
  startDateIso: string,
  wp: AnnotatedWeek,
  ctx: WeekContext,
): PlannedWeek {
  const runningDays = Math.min(6, Math.max(3, ctx.athlete.daysPerWeek));
  const qualityCount = qualitySessionsThisWeek(wp, runningDays, ctx.returning);
  const easyCount = Math.max(0, runningDays - qualityCount - 1); // minus the long run
  const longDay = longRunDayOf(ctx.athlete);

  const sessions: SessionContent[] = [];
  const dayOf: number[] = [];

  // Long run (on the athlete's chosen day).
  sessions.push(longRunFor(wp.phase, ctx));
  dayOf.push(longDay);

  // Quality sessions — placed relative to the long run so spacing rules hold on any long-run day.
  const qualityContents = qualityContentsFor(wp, index, qualityCount, ctx);
  const qualityDays = QUALITY_REL.map((r) => dayRel(longDay, r));
  qualityContents.forEach((c, qi) => {
    sessions.push(c);
    dayOf.push(qualityDays[qi]!);
  });

  // Easy runs — rotate flavours (plain, strides, hill sprints, explore) so easy days stay fresh.
  const easyDays = EASY_REL.map((r) => dayRel(longDay, r)).slice(0, easyCount);
  const canStride = (wp.phase === "base" || wp.phase === "build") && !wp.isDeload;
  easyDays.forEach((d, ei) => {
    const minutes = wp.isDeload ? 35 : ei === easyDays.length - 1 ? 40 : 45;
    sessions.push(easyVariant(ctx.paces, minutes, index + ei, canStride));
    dayOf.push(d);
  });

  // Strength (shares days with runs, per the research brief's weekly structure).
  addStrength(wp, ctx, sessions, dayOf);

  // Optional mobility on the first free day.
  const used = new Set(dayOf);
  const freeDay = MOB_PREF_REL.map((r) => dayRel(longDay, r)).find((d) => !used.has(d));
  if (freeDay !== undefined) {
    const mob = mobilitySession();
    sessions.push(mob);
    dayOf.push(freeDay);
    used.add(freeDay);
  }

  // Rest on remaining empty days.
  for (let d = 0; d < 7; d++) {
    if (!used.has(d)) {
      sessions.push(restDay());
      dayOf.push(d);
      used.add(d);
    }
  }

  const finalized = finalize(sessions, dayOf, index);
  const plannedDistanceMeters = finalized.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0);
  const qualitySessionCount = finalized.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  return {
    index,
    startDateIso,
    phase: wp.phase,
    isDeload: wp.isDeload,
    focus: weekFocus(wp, ctx),
    sessions: finalized,
    plannedDistanceMeters: Math.round(plannedDistanceMeters),
    qualitySessionCount,
  };
}

const DAY_LABEL = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

/** Trim week 1 to a pro-rata partial week when the plan starts mid-week (full weeks follow). */
function applyPartialFirstWeek(weeks: PlannedWeek[], startIso: string): void {
  const w0 = weeks[0];
  if (!w0) return;
  // Week starts are always Mondays; `off` is the start day's position within week 1 (0 = Monday).
  const off = daysBetween(w0.startDateIso, startIso);
  if (off <= 0 || off > 6) return; // starts on the Monday, or a lead-in gap precedes week 1
  const startDOW = dayOfWeekMondayZero(startIso);
  w0.sessions = w0.sessions.filter((s) => s.dayOfWeek >= startDOW);
  w0.startDateIso = startIso;
  w0.plannedDistanceMeters = Math.round(
    w0.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
  );
  w0.qualitySessionCount = w0.sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;
  w0.focus = `Partial first week — picking up from ${DAY_LABEL[startDOW]}. Full weeks begin Monday.`;
}

function finalize(contents: SessionContent[], dayOf: number[], weekIndex: number): Session[] {
  return contents
    .map((c, i) => ({
      ...c,
      id: `w${weekIndex}-d${dayOf[i]}-${c.type}`,
      dayOfWeek: dayOf[i]!,
      source: "generated" as const,
    }))
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek);
}

// ---- beginner assembly ----------------------------------------------------

const lerp = (a: number, b: number, f: number) => a + (b - a) * Math.max(0, Math.min(1, f));

// Rotating pools of beginner session flavours — every run day of the week draws a different one so a
// plan never repeats the same session two days (or two weeks) running.
const RW_FLAVOURS = [rwSteady, rwLadder, rwExplore, rwBuildup];
const CONT_FLAVOURS = [
  (p: TrainingPaces, m: number) => easyRun(p, m, false),
  contPickups,
  contProgression,
  contExplore,
];

// One beginner running session — a run–walk progression, or short continuous easy running for those
// who can already jog. `f` is 0→1 across the plan; runs lengthen and (for run–walk) walks shrink.
// `flavour` selects which format so sessions vary; the weekly long run uses its own long format.
function beginnerRun(
  paces: TrainingPaces,
  f: number,
  long: boolean,
  runWalk: boolean,
  ease: boolean,
  flavour: number,
): SessionContent {
  if (runWalk) {
    const runSec = Math.round(lerp(60, 300, f) / 15) * 15; // 1′ → 5′ run
    const walkSec = Math.max(30, Math.round(lerp(90, 45, f) / 15) * 15); // 90″ → 45″ walk
    let targetRunMin = lerp(10, 26, f) + (long ? 4 : 0);
    if (ease) targetRunMin *= 0.7;
    const spec = { runSec, walkSec, targetRunMin };
    return long ? rwLong(paces, spec) : RW_FLAVOURS[flavour % RW_FLAVOURS.length]!(paces, spec);
  }
  let minutes = Math.round(lerp(22, 38, f)) + (long ? 8 : 0);
  if (ease) minutes = Math.round(minutes * 0.75);
  return long ? longRun(paces, minutes) : CONT_FLAVOURS[flavour % CONT_FLAVOURS.length]!(paces, minutes);
}

function beginnerFocus(wp: AnnotatedWeek, runWalk: boolean): string {
  if (wp.isDeload) return "Easy week — let your body adapt and come back stronger";
  if (wp.phase === "taper") return "Ease down — stay fresh for your goal";
  return runWalk
    ? "Run–walk foundation — build the habit and let running feel easy"
    : "Easy aerobic base — steady, comfortable running you can chat through";
}

function buildBeginnerWeek(
  index: number,
  startDateIso: string,
  wp: AnnotatedWeek,
  ctx: WeekContext,
  structuredWeeks: number,
  runWalk: boolean,
): PlannedWeek {
  const f = structuredWeeks <= 1 ? 0.5 : (index - 1) / (structuredWeeks - 1);
  const ease = wp.isDeload || wp.phase === "taper";
  const runningDays = Math.min(runWalk ? 3 : 4, Math.max(2, ctx.athlete.daysPerWeek));
  const longDay = longRunDayOf(ctx.athlete);

  const sessions: SessionContent[] = [];
  const dayOf: number[] = [];

  // The weekly long, gentle session (on the athlete's chosen long-run day).
  sessions.push(beginnerRun(ctx.paces, f, true, runWalk, ease, 0));
  dayOf.push(longDay);

  // Other easy days — each draws a different flavour, and the set rotates every week.
  const easyDays = BEG_EASY_REL.map((r) => dayRel(longDay, r)).slice(0, runningDays - 1);
  easyDays.forEach((d, ei) => {
    sessions.push(beginnerRun(ctx.paces, f, false, runWalk, ease, index + ei));
    dayOf.push(d);
  });

  // General, gentle strength (no heavy lifting for a brand-new runner) — themed variants rotate.
  if (ctx.athlete.includeStrength) {
    const strengthCount = ctx.athlete.daysPerWeek >= 4 && !ease ? 2 : 1;
    BEG_STRENGTH_REL.map((r) => dayRel(longDay, r)).slice(0, strengthCount).forEach((d, si) => {
      if (!dayOf.includes(d)) {
        sessions.push(generalStrengthSession(index + si));
        dayOf.push(d);
      }
    });
  }

  // Optional mobility on a free day — theme rotates by week.
  const used = new Set(dayOf);
  const mobDay = MOB_PREF_REL.map((r) => dayRel(longDay, r)).find((d) => !used.has(d));
  if (mobDay !== undefined) {
    sessions.push(mobilitySession(index));
    dayOf.push(mobDay);
    used.add(mobDay);
  }

  for (let d = 0; d < 7; d++) {
    if (!used.has(d)) {
      sessions.push(restDay());
      dayOf.push(d);
      used.add(d);
    }
  }

  const finalized = finalize(sessions, dayOf, index);
  const plannedDistanceMeters = finalized.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0);
  return {
    index,
    startDateIso,
    phase: wp.phase,
    isDeload: wp.isDeload,
    focus: beginnerFocus(wp, runWalk),
    sessions: finalized,
    plannedDistanceMeters: Math.round(plannedDistanceMeters),
    qualitySessionCount: 0,
  };
}

function qualitySessionsThisWeek(
  wp: AnnotatedWeek,
  runningDays: number,
  returning: boolean,
): number {
  if (runningDays < 4) return 1; // low frequency → protect easy volume, one quality
  if (wp.isDeload) return 1;
  switch (wp.phase) {
    case "base": {
      // A long base opens with a pure-aerobic foundation block — consistency and volume before any
      // quality — then settles into one quality session. Short bases carry the single quality throughout.
      const foundationWeeks = wp.phaseTotal >= 8 ? Math.round(wp.phaseTotal * 0.3) : 0;
      return wp.ordinalInPhase <= foundationWeeks ? 0 : 1;
    }
    case "build":
      // Returning athletes add the second quality only in the second half of the build.
      if (returning && wp.ordinalInPhase <= Math.ceil(wp.phaseTotal / 2)) return 1;
      return 2;
    case "peak":
      return 2;
    case "taper":
      return 1;
  }
}

function qualityContentsFor(
  wp: AnnotatedWeek,
  weekIndex: number,
  count: number,
  ctx: WeekContext,
): SessionContent[] {
  const p = ctx.paces;
  const isShortEvent =
    ctx.goal.distance === "5k" || ctx.goal.distance === "10k" || ctx.goal.distance === "1mile";
  const out: SessionContent[] = [];

  if (wp.phase === "taper") {
    // Keep intensity, low volume: a short, sharp session.
    out.push(vo2Session(p, 3)); // 10 × 1′ — naturally low volume
    return out.slice(0, count);
  }
  if (wp.phase === "peak") {
    out.push(raceSpecificSession(p));
    out.push(isShortEvent ? vo2Session(p, weekIndex) : thresholdSession(p, weekIndex));
    return out.slice(0, count);
  }
  if (wp.phase === "build") {
    if (count >= 2) {
      out.push(thresholdSession(p, weekIndex));
      out.push(vo2Session(p, weekIndex));
    } else {
      // Alternate the single quality session week to week.
      out.push(weekIndex % 2 === 0 ? vo2Session(p, weekIndex) : thresholdSession(p, weekIndex));
    }
    return out.slice(0, count);
  }
  // base: threshold-led (tempo/cruise/fartlek rotate); introduce VO2 flavour only in the latter part.
  const lateBase = wp.ordinalInPhase > Math.ceil(wp.phaseTotal / 2);
  out.push(lateBase && weekIndex % 2 === 0 ? vo2Session(p, weekIndex) : thresholdSession(p, weekIndex));
  return out.slice(0, count);
}

// Rotate easy-run flavours for non-beginners. All stay genuinely easy; strides/hill sprints only in
// base/build (neuromuscular work, near-zero aerobic cost), explore/plain anytime.
function easyVariant(paces: TrainingPaces, minutes: number, idx: number, canStride: boolean): SessionContent {
  const pool: ((p: TrainingPaces, m: number) => SessionContent)[] = canStride
    ? [(p, m) => easyRun(p, m, false), (p, m) => easyRun(p, m, true), (p, m) => easyHillStrides(p, m), (p, m) => contExplore(p, m)]
    : [(p, m) => easyRun(p, m, false), (p, m) => contExplore(p, m)];
  return pool[idx % pool.length]!(paces, minutes);
}

function longRunFor(phase: Phase, ctx: WeekContext): SessionContent {
  const min = ctx.longMin;
  if (phase === "peak") {
    // Race-specific work while tired.
    return longRun(ctx.paces, min, {
      raceBlockMin: Math.min(30, Math.round(min * 0.25)),
      racePace: ctx.paces.goalRace,
    });
  }
  if (phase === "build") {
    return longRun(ctx.paces, min, { steadyFinishMin: Math.min(20, Math.round(min * 0.2)) });
  }
  return longRun(ctx.paces, min);
}

function addStrength(
  wp: AnnotatedWeek,
  ctx: WeekContext,
  sessions: SessionContent[],
  dayOf: number[],
): void {
  if (!ctx.athlete.includeStrength) return;
  let count: number;
  if (wp.phase === "taper") count = wp.ordinalInPhase === 1 ? 1 : 0;
  else if (wp.phase === "peak" || wp.isDeload) count = 1;
  else count = 2; // base, build

  const maintenance = wp.phase === "peak" || wp.phase === "taper";
  const longDay = longRunDayOf(ctx.athlete);
  // Pair strength with a quality day and an easy day (so lifting doesn't fall on the long run day).
  const strengthDays = [dayRel(longDay, QUALITY_REL[0]!), dayRel(longDay, EASY_REL[0]!)];
  for (let i = 0; i < count; i++) {
    sessions.push(strengthSession(wp.phase, maintenance));
    dayOf.push(strengthDays[i] ?? strengthDays[0]!);
  }
}

// ---- long-run progression -------------------------------------------------

function longRunMinutes(
  wp: WeekPlan,
  weekIndex: number,
  nonTaperCount: number,
  startLong: number,
  peakLong: number,
  taperMultipliers: number[],
): number {
  if (wp.phase === "taper") {
    const idxInTaper = weekIndex - nonTaperCount - 1;
    const mult = taperMultipliers[idxInTaper] ?? 0.55;
    return Math.round(peakLong * mult);
  }
  const fraction = nonTaperCount <= 1 ? 1 : (weekIndex - 1) / (nonTaperCount - 1);
  let minutes = startLong + fraction * (peakLong - startLong);
  if (wp.isDeload) minutes *= 0.75;
  return Math.round(minutes);
}

// ---- annotations, focus text, notes --------------------------------------

function annotate(schedule: WeekPlan[]): AnnotatedWeek[] {
  const totals: Record<Phase, number> = { base: 0, build: 0, peak: 0, taper: 0 };
  for (const w of schedule) totals[w.phase]++;
  const seen: Record<Phase, number> = { base: 0, build: 0, peak: 0, taper: 0 };
  return schedule.map((w) => {
    seen[w.phase]++;
    return { ...w, ordinalInPhase: seen[w.phase], phaseTotal: totals[w.phase] };
  });
}

function weekFocus(wp: AnnotatedWeek, ctx: WeekContext): string {
  if (wp.isDeload) return "Deload — recover and absorb training";
  switch (wp.phase) {
    case "base": {
      const foundationWeeks = wp.phaseTotal >= 8 ? Math.round(wp.phaseTotal * 0.3) : 0;
      if (wp.ordinalInPhase <= foundationWeeks) {
        return "Foundation — easy consistency, weekly long run, general strength";
      }
      return ctx.returning
        ? "Aerobic base — rebuild consistency + one quality session"
        : "Aerobic base + one quality session";
    }
    case "build":
      return "Build threshold and VO2, extend the long run";
    case "peak":
      return "Race-specific sharpening";
    case "taper":
      return "Taper — cut volume, keep intensity";
  }
}

function buildNotes(
  athlete: Athlete,
  goal: Goal,
  totalWeeks: number,
  structuredWeeks: number,
  model: IntensityModel,
  weeks: PlannedWeek[],
): string[] {
  const notes: string[] = [];
  const leadIn = totalWeeks - structuredWeeks;
  if (leadIn > 1) {
    const planStart = weeks[0]?.startDateIso ?? goal.startDateIso ?? "";
    notes.push(
      `You have ~${leadIn} weeks before the structured plan begins (${planStart}). Use them to build easy-running consistency and a weekly long run — consistency is the biggest driver of improvement.`,
    );
  }
  notes.push(
    model === "pyramidal"
      ? "Intensity distribution: pyramidal — mostly easy running, a moderate amount of threshold, a little VO2. Individual response matters more than an exact split."
      : "Intensity distribution: polarized — mostly easy plus a focused dose of hard work, minimal middle-ground moderate running.",
  );
  if (athlete.oneKmTrialSeconds && athlete.oneKmTrialSeconds > 0) {
    notes.push(
      "VO₂/interval paces are anchored to your 1 km time-trial (MAS) — a direct, test-based target you can re-test to track progress.",
    );
  }
  if (athlete.returningFromInjury) {
    notes.push(
      "Returning from injury: the early weeks stay deliberately conservative (single quality session, gentle long-run progression). Add the second quality session only once weekly running and the long run feel stable.",
    );
  }
  notes.push(
    athlete.includeStrength
      ? "Strength: 2×/week through base and build (heavy, low volume), easing to 1× maintenance near the race. Plyometrics only once faster running is tolerated without a delayed reaction."
      : "Strength is off. The research supports heavy strength 2×/week for economy and durability — consider enabling it.",
  );
  notes.push(
    "Variety: quality sessions rotate across formats — tempo, cruise intervals, threshold and Mona fartlek, VO₂ intervals, pyramids and hill reps — so the stimulus stays fresh week to week while the training intent stays the same.",
  );
  notes.push(
    "Flexibility: warmups are dynamic (easy jog, drills, strides). Static stretching is optional and targeted — it does not improve running economy.",
  );
  return notes;
}
