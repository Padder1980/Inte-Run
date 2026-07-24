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
import { deriveTrainingPaces, withHrZones } from "../science/paces.ts";
import { taperFor } from "../science/taper.ts";
import { addDays, dayOfWeekMondayZero, isoToday, weeksBetween } from "./dates.ts";
import { type WeekPlan, phaseSchedule, structuredWeekCount } from "./periodization.ts";
import {
  easyRun,
  longRun,
  mobilitySession,
  raceSpecificSession,
  restDay,
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

// Day-of-week slots (0 = Mon … 6 = Sun). Hard days (Tue/Thu) are separated by an easy day and never
// sit next to the Sunday long run.
const DAY_LONG = 6;
const DAY_QUALITY_1 = 1;
const DAY_QUALITY_2 = 3;
const EASY_DAY_POOL = [2, 4, 0, 5];

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
  const totalWeeks = Math.max(0, weeksBetween(startIso, goal.raceDateIso));
  const structuredWeeks = structuredWeekCount(totalWeeks, goal.distance);

  const returning = athlete.returningFromInjury ?? false;
  const model = options.intensityModel ?? chooseModel(athlete);
  const paces = withHrZones(deriveTrainingPaces(athlete.recent, goal), athlete);
  const schedule = annotate(phaseSchedule(structuredWeeks, goal.distance, returning));

  const raceMonday = addDays(goal.raceDateIso, -dayOfWeekMondayZero(goal.raceDateIso));
  const peakLong = PEAK_LONG_MIN[goal.distance];
  const startLong = Math.round(peakLong * (returning ? 0.42 : 0.55));
  const nonTaperCount = schedule.filter((s) => s.phase !== "taper").length;
  const taper = taperFor(goal.distance);

  const weeks: PlannedWeek[] = schedule.map((wp, i) => {
    const weekIndex = i + 1;
    const startDateIso = addDays(raceMonday, -(structuredWeeks - weekIndex) * 7);
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

  const sessions: SessionContent[] = [];
  const dayOf: number[] = [];

  // Long run (Sunday).
  sessions.push(longRunFor(wp.phase, ctx));
  dayOf.push(DAY_LONG);

  // Quality sessions.
  const qualityContents = qualityContentsFor(wp, index, qualityCount, ctx);
  const qualityDays = qualityCount >= 2 ? [DAY_QUALITY_1, DAY_QUALITY_2] : [DAY_QUALITY_1];
  qualityContents.forEach((c, qi) => {
    sessions.push(c);
    dayOf.push(qualityDays[qi]!);
  });

  // Easy runs — one carries strides during base/build.
  const easyDays = EASY_DAY_POOL.slice(0, easyCount);
  easyDays.forEach((d, ei) => {
    const withStrides = ei === 0 && (wp.phase === "base" || wp.phase === "build") && !wp.isDeload;
    const minutes = wp.isDeload ? 35 : ei === easyDays.length - 1 ? 40 : 45;
    sessions.push(easyRun(ctx.paces, minutes, withStrides));
    dayOf.push(d);
  });

  // Strength (shares days with runs, per the research brief's weekly structure).
  addStrength(wp, ctx, sessions, dayOf);

  // Optional mobility on the first free day.
  const used = new Set(dayOf);
  const freeDay = [2, 4, 0, 5, 3, 1].find((d) => !used.has(d));
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
  // base: threshold-led; introduce VO2 flavour only in the latter part of base.
  const lateBase = wp.ordinalInPhase > Math.ceil(wp.phaseTotal / 2);
  out.push(lateBase && weekIndex % 2 === 0 ? vo2Session(p, 3) : thresholdSession(p, weekIndex));
  return out.slice(0, count);
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
  const strengthDays = [DAY_QUALITY_1, EASY_DAY_POOL[0]!]; // pair with a quality day and an easy day
  for (let i = 0; i < count; i++) {
    sessions.push(strengthSession(wp.phase, maintenance));
    dayOf.push(strengthDays[i] ?? DAY_QUALITY_1);
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
    "Flexibility: warmups are dynamic (easy jog, drills, strides). Static stretching is optional and targeted — it does not improve running economy.",
  );
  return notes;
}
