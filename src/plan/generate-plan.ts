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
  SessionType,
  TrainingPaces,
} from "../domain/types.ts";
import { chooseModel } from "../science/intensity-distribution.ts";
import { computeMas, masVo2Range } from "../science/mas.ts";
import { deriveTrainingPaces, reconcileVo2, withHrZones } from "../science/paces.ts";
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
  raceDay,
  raceSpecificSession,
  restDay,
  rwBuildup,
  rwExplore,
  rwLadder,
  rwLong,
  rwSteady,
  type SessionContent,
  strengthSession,
  taperSession,
  moderateRun,
  easyProgression,
  recoveryRun,
  raceIsBig,
  thresholdIsBig,
  thresholdSession,
  vo2IsBig,
  vo2Session,
} from "./session-templates.ts";
import type { FormatCtx } from "./session-templates.ts";

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

/**
 * Absolute ceiling on a long run, whatever the runner's mileage. Time on feet is the injury
 * currency: a marathoner running 140 km/week still should not be doing four-hour long runs, and
 * the standard advice caps the marathon long run around three hours.
 */
const LONG_CEILING_MIN: Record<Goal["distance"], number> = {
  "1mile": 75,
  "5k": 90,
  "10k": 110,
  half: 145,
  marathon: 180,
};

/**
 * How much to scale the plan's volume for the runner actually in front of it.
 *
 * ⚠️ Until 2026-08-01 there was NO volume model. Session lengths came from the tables above, keyed
 * on race distance alone, so a 40 km/week runner and a 140 km/week runner training for the same
 * marathon got byte-identical plans — measured: stated volumes of 50, 90 and 140 produced exactly
 * the same peak, mean and long run. `Athlete.weeklyVolumeKmCurrent` existed but was read nowhere.
 * An elite coach's verdict on the result was "total mileage for a competitive runner looks a
 * little on the low side", and he was right for anyone above the reference.
 *
 * A block should build ABOVE where the runner is now, not merely reproduce it, but not by much —
 * PROGRESSION is the ceiling on adaptation. 25% over a block is already brisk beside the usual
 * "add 10% a week, then back off" guidance.
 *
 * Returns 1 (no change at all) when the runner has not told us their mileage, which keeps every
 * existing plan and every existing test exactly as it was.
 */
function targetPeakWeeklyKm(athlete: Athlete): number | null {
  const stated = athlete.weeklyVolumeKmCurrent;
  if (!stated || !Number.isFinite(stated) || stated <= 0) return null;
  // A block should build ABOVE where the runner is now, but not by much — progression is the
  // ceiling on adaptation, and 25% across a whole block is already brisk beside the usual
  // "add 10% a week, then back off" guidance.
  return stated * 1.25;
}

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
    // Reconciled, not replaced: a poor trial must not hand someone "intervals" slower than their
    // own threshold pace. See reconcileVo2.
    paces.vo2 = reconcileVo2(paces, masVo2Range(computeMas(athlete.oneKmTrialSeconds).masMps));
  }
  const schedule = annotate(phaseSchedule(structuredWeeks, goal.distance, returning));

  const targetPeakKm = targetPeakWeeklyKm(athlete);
  const nonTaperCount = schedule.filter((s) => s.phase !== "taper").length;
  const taper = taperFor(goal.distance);

  // Complete beginners get a gentler, purpose-built progression (run–walk or short easy running,
  // general strength, no intervals) rather than the standard threshold/VO2 structure.
  const beginner = athlete.experience === "beginner";
  const runWalk = athlete.runWalk ?? false;

  const buildAll = (vScale: number): PlannedWeek[] => {
    const peakLong = Math.min(
      LONG_CEILING_MIN[goal.distance],
      Math.round(PEAK_LONG_MIN[goal.distance] * vScale),
    );
    const startLong = Math.round(peakLong * (returning ? 0.42 : 0.55));
    return schedule.map((wp, i) => {
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
        athlete, goal, paces, returning, longMin, vScale,
      });
    });
  };

  // ⚠️ SOLVED BY ITERATION, not by a formula. Build unscaled to learn what THIS plan's natural
  // peak week actually is, then close the gap to the runner's target and rebuild, a few times.
  //
  // Two earlier attempts were wrong. Scaling against fixed reference constants ignored that the
  // natural peak depends on days-per-week as well as race distance. And a single corrective pass
  // does not land, because the week is not linear in the scale: quality sessions are prescribed by
  // the library and do not move at all, and the per-session floors and ceilings bind at the ends —
  // measured, one pass left a 50 km/week runner peaking at 81 km, a 62% jump rather than the 25%
  // intended. Iterating to a fixed point converges where the target is reachable and settles
  // honestly where it is not.
  //
  // ⚠️ Where it settles short is not a bug. Beyond roughly 130 km/week the caps bind because you
  // cannot run that mileage in six single runs — it needs DOUBLES, which the generator cannot
  // schedule yet. Better to hand a high-mileage runner an honest 130 than a fictional 175.
  //
  // Beginners are exempt: their progression is deliberately gentle and volume-independent.
  let weeks = buildAll(1);
  if (targetPeakKm && !beginner) {
    let scale = 1;
    for (let pass = 0; pass < 5; pass++) {
      const peakKm = Math.max(...weeks.map((w) => w.plannedDistanceMeters)) / 1000;
      if (peakKm <= 0) break;
      const ratio = targetPeakKm / peakKm;
      if (Math.abs(ratio - 1) < 0.03) break;   // within 3% — closer than the input is accurate
      // ⚠️ THE FLOOR IS 1: this model may only scale a plan UP. buildWeek scales the easy runs and
      // the long run; the quality sessions come from the library at full prescribed length and do
      // not move at all. Scaling DOWN therefore shrinks the denominator while the hard minutes stay
      // put, and the easy fraction falls purely as arithmetic — measured across 23040 weeks, low
      // stated mileages pushed 175 of them under the intensity model's easy floor (0.68), an
      // invariant this file's own sweep records as never breached. One case: half, 4 days, 25 km
      // stated — a peak week at 64% easy, with a "long run" shorter than the workout beside it.
      // The coach's complaint was that HIGH-mileage runners were under-served, and that is the half
      // this fixes. Building a genuinely smaller week needs the quality sessions to shrink with it,
      // which is a periodisation change, not a scale factor. Until then a runner who states less
      // than the plan asks for gets the plan unchanged plus the existing feasibility warning.
      // The upper clamp keeps a mistyped mileage from producing an absurd plan; the per-session
      // ceilings (LONG_CEILING_MIN, and the easy-run bounds in buildWeek) are the real safety net.
      const next = Math.max(1, Math.min(3, scale * ratio));
      if (Math.abs(next - scale) < 0.01) break;   // the caps are binding; further passes are futile
      scale = next;
      weeks = buildAll(scale);
    }
  }

  // If the athlete starts mid-week, make week 1 pro-rata: drop the sessions that fall before the
  // start day; full Monday–Sunday weeks follow.
  applyPartialFirstWeek(weeks, startIso);
  applyRaceDay(weeks, goal, paces);

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
  /** Volume scale for this runner (see volumeScale). Absent means 1 — beginner weeks ignore it. */
  vScale?: number;
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
  // Strides and hill sprints are neuromuscular work with near-zero aerobic cost, but hill sprints
  // in particular are the highest connective-tissue load in the library — tissue adapts more slowly
  // than the cardiovascular system, so they are withheld from anyone coming back from injury.
  const canStride = (wp.phase === "base" || wp.phase === "build") && !wp.isDeload && !ctx.returning;
  easyDays.forEach((d, ei) => {
    // Easy running is where weekly volume actually lives, so it scales with the runner too —
    // bounded so a low-mileage runner still gets a real run and a high-mileage one is not handed
    // a two-hour midweek easy day.
    const baseMin = wp.isDeload ? 35 : ei === easyDays.length - 1 ? 40 : 45;
    const minutes = Math.max(20, Math.min(95, Math.round(baseMin * (ctx.vScale ?? 1))));
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

/**
 * Put the goal race on its actual date in the final week, and make the days around it make sense.
 *
 * ⚠️ Before this existed the race was not in the plan AT ALL — `goal.raceDateIso` only aligned the
 * last week to a Monday and printed a date in the header. Whatever the rotation happened to place
 * on race day was prescribed instead. Measured on real plans: a Sunday race got a 51-minute LONG
 * RUN on race day; a Wednesday race got a recovery jog on the day and the long run four days AFTER
 * the race; and 6 of 49 race-day/long-run-day combinations put a 10 x 1' VO2 session the day
 * before. That last one is not untidy, it is a bad prescription.
 *
 * Three rules, in order:
 *   1. Race day IS the race. Whatever sat there is replaced.
 *   2. Nothing follows it. Sessions after race day in that week become rest — you have raced.
 *   3. The day before is a shakeout at most. Any quality session there is replaced by rest.
 * Strength and mobility are cleared from race day and the day before too: nobody lifts the day
 * before a goal race.
 */
function applyRaceDay(weeks: PlannedWeek[], goal: Goal, paces: TrainingPaces): void {
  const last = weeks[weeks.length - 1];
  if (!last) return;
  const raceDow = dayOfWeekMondayZero(goal.raceDateIso);
  // The final week is aligned to the race's own Monday, so the race must fall inside it. If some
  // future change breaks that, do nothing rather than write the race onto the wrong day.
  if (daysBetween(last.startDateIso, goal.raceDateIso) !== raceDow) return;

  const label = RACE_LABELS[goal.distance] ?? goal.distance;

  // ⚠️ THE EVE IS NOT ALWAYS IN THE RACE WEEK. For a MONDAY race raceDow is 0, so `raceDow - 1` is
  // -1 and matches no dayOfWeek at all — while the real day before is the SUNDAY of the PREVIOUS
  // week, which this function never opened. Rule 3 therefore did nothing for one weekday in seven.
  // Measured across 4 events x 7 race weekdays x 7 long-run days: 10 of 196 plans put a
  // HARD_BEFORE_RACE session on race eve and every single one was a Monday race — worst case, a
  // 98-minute LONG RUN the day before a marathon. Resolve the eve as a (week, day) pair; an index
  // into the final week cannot express it.
  const eve: { week: PlannedWeek; dow: number } | null =
    raceDow > 0 ? { week: last, dow: raceDow - 1 }
    : weeks.length > 1 ? { week: weeks[weeks.length - 2]!, dow: 6 }
    : null;

  const kept = last.sessions.filter((s) => {
    if (s.dayOfWeek > raceDow) return false;               // rule 2: nothing after the race
    if (s.dayOfWeek === raceDow) return false;             // rule 1: race day is the race
    if (eve && eve.week === last && s.dayOfWeek === eve.dow && HARD_BEFORE_RACE.has(s.type)) return false;  // rule 3
    return true;
  });

  const race: Session = {
    ...raceDay(paces, goal.distance, label),
    id: `w${last.index}-d${raceDow}-race`,
    dayOfWeek: raceDow,
    source: "generated",
  };
  const filler: Session[] = [];
  for (let d = 0; d < 7; d++) {
    if (d === raceDow) continue;
    if (kept.some((s) => s.dayOfWeek === d)) continue;
    filler.push({
      ...restDay(),
      id: `w${last.index}-d${d}-rest`,
      dayOfWeek: d,
      source: "generated",
    });
  }
  last.sessions = [...kept, race, ...filler].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  last.plannedDistanceMeters = Math.round(
    last.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
  );
  last.qualitySessionCount = last.sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  // Rule 3, applied across the week boundary for a Monday race. The eve session is replaced by rest
  // rather than dropped, so the week keeps all seven days like every other week in the plan.
  if (eve && eve.week !== last) {
    const w = eve.week;
    w.sessions = w.sessions.map((s) =>
      s.dayOfWeek === eve.dow && HARD_BEFORE_RACE.has(s.type)
        ? { ...restDay(), id: `w${w.index}-d${eve.dow}-rest`, dayOfWeek: eve.dow, source: "generated" as const }
        : s,
    );
    w.plannedDistanceMeters = Math.round(
      w.sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
    );
    w.qualitySessionCount = w.sessions.filter(
      (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
    ).length;
  }
}

/** Session types that must not sit the day before a goal race. */
const HARD_BEFORE_RACE = new Set<SessionType>([
  "threshold", "vo2", "race-specific", "long", "strength",
]);

const RACE_LABELS: Record<string, string> = {
  "1mile": "1 mile", "5k": "5K", "10k": "10K", half: "Half marathon", marathon: "Marathon",
};

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
  // ⚠️ The four-day cap below is a CEILING applied to the phase's own answer, not a short-circuit
  // before it. Returning 1 up here overrode the base phase's pure-aerobic foundation block, which
  // deliberately returns 0 — so a beginner's first weeks gained a quality session they should not
  // have had.
  const byPhase = qualityByPhase(wp, returning);
  // Four runs a week cannot support two quality sessions: it leaves one easy run and the long run
  // to carry all the aerobic volume, and the week's easy fraction collapses towards half — far
  // under any pyramidal or polarized target. Such weeks get their second quality session only in
  // the peak block, where a short, sharp overload is the intent and the taper follows.
  if (runningDays === 4 && wp.phase !== "peak") return Math.min(byPhase, 1);
  return byPhase;
}

function qualityByPhase(wp: AnnotatedWeek, returning: boolean): number {
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
  // What this week can safely be given. Filtering the format pool by phase is what makes a large
  // session library actually reachable: selection is `variant % pool.length`, so one flat pool
  // longer than the plan leaves formats permanently unused.
  // Rotate by position WITHIN the phase, offset by a per-plan seed.
  //
  // Two problems this solves. Using the raw week index means the pool is walked in steps that skip
  // residues, so a pool longer than the phase leaves formats permanently unused; walking by
  // ordinal-in-phase steps through it one at a time instead. And seeding the start point from the
  // plan's own shape — phase length, training days, and the event being trained for — means two
  // different plans begin at different points in the pool. Across the range of plans people
  // actually build, every format gets used rather than the same prefix every time.
  const DISTANCE_SEED: Record<Goal["distance"], number> = { "1mile": 0, "5k": 2, "10k": 5, half: 8, marathon: 11 };
  const rot = wp.ordinalInPhase + wp.phaseTotal + ctx.athlete.daysPerWeek + DISTANCE_SEED[ctx.goal.distance];
  const EVENT_KM: Record<Goal["distance"], number> = { "1mile": 1.609, "5k": 5, "10k": 10, half: 21.0975, marathon: 42.195 };
  const fctx: FormatCtx = {
    phase: wp.phase,
    eventKm: EVENT_KM[ctx.goal.distance],
    isDeload: wp.isDeload,
    competitive: ctx.athlete.experience === "competitive",
    returning: ctx.returning,
  };

  if (wp.phase === "taper") {
    // Keep intensity, low volume: a short, sharp session, chosen BY ID. This used to be
    // `vo2Session(p, 3)` — a positional index, so inserting any format above it silently changed
    // the race-week session of every plan ever generated.
    out.push(taperSession(p));
    return out.slice(0, count);
  }
  if (wp.phase === "peak") {
    // The race-pace session is the week's centrepiece, so the supporting one steps back — but only
    // when the centrepiece is itself a big one. Capping it unconditionally made every peak-only big
    // format unreachable, because a peak week always carries two quality sessions.
    const sRot = rot + 5;
    const supportBig = isShortEvent ? vo2IsBig(sRot, fctx) : thresholdIsBig(sRot, fctx);
    const support = count >= 2 && raceIsBig(rot, fctx) && supportBig ? { ...fctx, avoidBig: true } : fctx;
    out.push(raceSpecificSession(p, rot, fctx));
    out.push(isShortEvent ? vo2Session(p, sRot, support) : thresholdSession(p, sRot, support));
    return out.slice(0, count);
  }
  if (wp.phase === "build") {
    if (count >= 2) {
      // Offset the two variants. With the same index, a given threshold format is locked to a given
      // VO2 format for the whole plan whenever the two pools happen to be the same length.
      // One big session a week is the load; two is how people get hurt.
      //
      // The cap applies only when BOTH slots would draw a big format. Capping the VO2 slot whenever
      // the threshold slot happened to be big made every big VO2 format unreachable: the two share
      // a rotation index, so "threshold is big" and "which VO2 format" are perfectly correlated.
      // The two indexes are also offset so a given threshold format is not welded to one VO2 format
      // for the life of the plan.
      const vRot = rot + 5;
      const bothBig = thresholdIsBig(rot, fctx) && vo2IsBig(vRot, fctx);
      out.push(thresholdSession(p, rot, fctx));
      out.push(vo2Session(p, vRot, bothBig ? { ...fctx, avoidBig: true } : fctx));
    } else {
      // Alternate the single quality session week to week.
      out.push(weekIndex % 2 === 0 ? vo2Session(p, rot, fctx) : thresholdSession(p, rot, fctx));
    }
    return out.slice(0, count);
  }
  // base: threshold-led (tempo/cruise/fartlek rotate); introduce VO2 flavour only in the latter part.
  const lateBase = wp.ordinalInPhase > Math.ceil(wp.phaseTotal / 2);
  out.push(lateBase && weekIndex % 2 === 0 ? vo2Session(p, rot, fctx) : thresholdSession(p, rot, fctx));
  return out.slice(0, count);
}

// Rotate easy-run flavours for non-beginners. All stay genuinely easy; strides/hill sprints only in
// base/build (neuromuscular work, near-zero aerobic cost), explore/plain anytime.
function easyVariant(paces: TrainingPaces, minutes: number, idx: number, canStride: boolean): SessionContent {
  const pool: ((p: TrainingPaces, m: number) => SessionContent)[] = canStride
    ? [
        (p, m) => easyRun(p, m, false),
        (p, m) => easyRun(p, m, true),
        (p, m) => easyHillStrides(p, m),
        (p, m) => contExplore(p, m),
        (p, m) => moderateRun(p, m, false),
        (p, m) => moderateRun(p, m, true),
        (p, m) => easyProgression(p, m),
        (p, m) => recoveryRun(p, m),
      ]
    : [
        (p, m) => easyRun(p, m, false),
        (p, m) => contExplore(p, m),
        (p, m) => moderateRun(p, m, false),
        (p, m) => recoveryRun(p, m),
      ];
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
