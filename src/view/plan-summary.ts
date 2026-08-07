// Presentation-agnostic view model for a generated plan. Takes an athlete + goal, runs the engine,
// and returns a plain, serialisable summary (formatted paces, per-week session breakdowns, notes)
// that any UI — the static web preview, the interactive browser demo, or a future native screen —
// can render without reaching back into engine internals.

import type { Athlete, Goal, PlannedWeek, Session } from "../domain/types.ts";
import { generatePlan } from "../plan/generate-plan.ts";
import { assessFeasibility } from "../plan/feasibility.ts";
import { isoToday } from "../plan/dates.ts";
import { formatDuration, metresToKm } from "../domain/units.ts";

export type SessionView = {
  id: string;
  day: string;
  dayIndex: number;
  type: Session["type"];
  title: string;
  effort: "easy" | "moderate" | "hard" | "none";
  durMin: number;
  distKm: number | null;
  pace: string | null;
  rpe: string | null;
  optional: boolean;
};

export type WeekView = {
  index: number;
  start: string;
  startFull: string;
  startIso: string;
  phase: PlannedWeek["phase"];
  isDeload: boolean;
  focus: string;
  distanceKm: number;
  quality: number;
  longRunMin: number;
  sessions: SessionView[];
};

export type PlanSummary = {
  goal: { race: string; target: string; raceDate: string; startDate: string };
  athlete: { summary: string };
  feasibility: {
    verdict: string;
    currentPredicted: string;
    required: number;
    projected: number;
    /**
     * ⚠️ THE ENGINE'S OWN EXPLANATION, CARRIED THROUGH. assessFeasibility writes the whole judgement
     * out in sentences — what current fitness predicts, what the target needs against what is
     * realistic, and a target that would fit — and this view dropped every one of them, so the app
     * could only ever say one word. Computed and discarded, the same trap as CLASS and PLAN.notes.
     * The owner hit it by setting up two profiles he believed identical, getting "achievable" and
     * "unrealistic", and having nothing on screen to tell him which input differed.
     */
    rationale: string[];
    /** A target that WOULD fit the time available, when the stated one does not. */
    suggestedTarget: string | null;
  };
  summary: {
    structuredWeeks: number;
    totalWeeks: number;
    model: string;
    peakKm: number;
    totalQuality: number;
  };
  paces: { goal: string; threshold: string; easy: string };
  weeks: WeekView[];
  defaultWeekIndex: number;
  notes: string[];
  generatedAt: string;
};

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const RACE_LABELS: Record<string, string> = {
  "1mile": "1 mile",
  "5k": "5K",
  "10k": "10K",
  half: "Half marathon",
  marathon: "Marathon",
};

/** Format a yyyy-mm-dd string without timezone drift (never construct a Date). */
function humanDate(iso: string, withYear = true): string {
  const [y, m, d] = iso.split("-").map(Number);
  const base = `${d} ${MONTHS[(m ?? 1) - 1]}`;
  return withYear ? `${base} ${y}` : base;
}

function km(metres: number): number {
  return Math.round(metresToKm(metres) * 10) / 10;
}

function paceRange(r: { minSecPerKm: number; maxSecPerKm: number }): string {
  return `${formatDuration(r.minSecPerKm)}–${formatDuration(r.maxSecPerKm)}/km`;
}

/** A representative pace range for a session, from a work step — never the warm-up/cool-down. For
 *  interval sessions that's the rep pace; otherwise it's the steady/easy pace (so an easy+strides run
 *  shows its easy pace, not the fast strides). Returns null for effort-based work (e.g. hill reps),
 *  so the UI shows RPE instead of a misleading pace. */
function paceLabel(s: Session): string | null {
  const rep = s.steps.find((st) => st.kind === "rep" && st.targetPaceSecPerKm);
  const steady = s.steps.find((st) => st.kind === "steady" && st.targetPaceSecPerKm);
  const quality = s.type === "threshold" || s.type === "vo2" || s.type === "race-specific";
  const pick = quality ? (rep ?? steady) : (steady ?? rep);
  return pick ? paceRange(pick.targetPaceSecPerKm!) : null;
}

function rpeLabel(s: Session): string | null {
  let band = s.targetRpe;
  if (!band) {
    const withRpe = s.steps.filter((st) => st.targetRpe);
    if (withRpe.length > 0) {
      band = {
        min: Math.min(...withRpe.map((st) => st.targetRpe!.min)),
        max: Math.max(...withRpe.map((st) => st.targetRpe!.max)),
      };
    }
  }
  return band ? `${band.min}–${band.max}` : null;
}

/** Coarse effort bucket used to colour the session marker. */
function effort(s: Session): SessionView["effort"] {
  if (s.type === "rest" || s.type === "mobility") return "none";
  if (s.type === "strength" || s.type === "cross-training") return "moderate";
  if (s.intensity === "hard") return "hard";
  if (s.intensity === "moderate") return "moderate";
  return "easy";
}

function weekView(w: PlannedWeek): WeekView {
  const sessions = [...w.sessions].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
  const longRun = sessions.find((s) => s.type === "long");
  return {
    index: w.index,
    start: humanDate(w.startDateIso, false),
    startFull: humanDate(w.startDateIso),
    startIso: w.startDateIso,
    phase: w.phase,
    isDeload: w.isDeload,
    focus: w.focus,
    distanceKm: km(w.plannedDistanceMeters),
    quality: w.qualitySessionCount,
    longRunMin: longRun ? Math.round(longRun.estimatedDurationSeconds / 60) : 0,
    sessions: sessions.map((s) => ({
      id: s.id,
      day: DAY_NAMES[s.dayOfWeek] ?? "?",
      dayIndex: s.dayOfWeek,
      type: s.type,
      title: s.title,
      effort: effort(s),
      durMin: Math.round(s.estimatedDurationSeconds / 60),
      distKm: s.estimatedDistanceMeters ? km(s.estimatedDistanceMeters) : null,
      pace: paceLabel(s),
      rpe: rpeLabel(s),
      optional: s.optional ?? false,
    })),
  };
}

function athleteSummary(a: Athlete): string {
  const recentKm = km(a.recent.distanceMeters);
  const parts = [
    a.experience.charAt(0).toUpperCase() + a.experience.slice(1),
    `${recentKm} km in ${formatDuration(a.recent.timeSeconds)}`,
    `${a.daysPerWeek} days/week`,
    `strength ${a.includeStrength ? "on" : "off"}`,
  ];
  if (a.returningFromInjury) parts.push("returning from injury");
  return parts.join(" · ");
}

/** Run the engine and shape the result into a serialisable summary for any UI to render. */
export function buildPlanSummary(athlete: Athlete, goal: Goal): PlanSummary {
  const plan = generatePlan(athlete, goal);
  const feas = assessFeasibility(athlete, goal);
  const weeks = plan.weeks.map(weekView);
  const peakKm = Math.max(...weeks.map((w) => w.distanceKm), 0);
  const totalQuality = weeks.reduce((sum, w) => sum + w.quality, 0);
  // Which week the Plan screen opens on: a representative one, not week 1.
  //
  // ⚠️ THE FALLBACK MATTERS AS MUCH AS THE RULE. This looked for a build week with two quality
  // sessions and fell straight through to `weeks[0]` — which is the PARTIAL first week, often two or
  // three sessions and the rest rest days. Once a small stated mileage could cap a week at one key
  // day, no build week reached two and every such runner opened the Plan tab on a stub that reads as
  // "the app has barely given me anything", at the exact moment they are judging the plan. Step down
  // through weaker preferences instead of off a cliff.
  const defaultWeekIndex =
    weeks.find((w) => w.phase === "build" && w.quality >= 2)?.index ??
    weeks.find((w) => w.phase === "build" && w.quality >= 1)?.index ??
    weeks.find((w) => w.phase === "build")?.index ??
    weeks.find((w, i) => i > 0 && w.quality >= 1)?.index ??
    weeks[1]?.index ?? weeks[0]?.index ?? 1;

  return {
    goal: {
      race: RACE_LABELS[goal.distance] ?? goal.distance,
      target: formatDuration(goal.targetTimeSeconds),
      raceDate: humanDate(goal.raceDateIso),
      startDate: humanDate(goal.startDateIso ?? isoToday()),
    },
    athlete: { summary: athleteSummary(athlete) },
    feasibility: {
      verdict: feas.verdict,
      currentPredicted: formatDuration(feas.currentPredictedSeconds),
      required: Math.round(feas.requiredImprovementPct * 10) / 10,
      projected: Math.round(feas.projectedAchievablePct * 10) / 10,
      rationale: feas.rationale || [],
      suggestedTarget: feas.suggestedTargetSeconds ? formatDuration(feas.suggestedTargetSeconds) : null,
    },
    summary: {
      structuredWeeks: plan.weeks.length,
      totalWeeks: plan.totalWeeks,
      model: plan.intensityModel,
      peakKm,
      totalQuality,
    },
    paces: {
      goal: paceRange(plan.paces.goalRace),
      threshold: paceRange(plan.paces.threshold),
      easy: paceRange(plan.paces.easy),
    },
    weeks,
    defaultWeekIndex,
    notes: plan.notes,
    generatedAt: humanDate(plan.createdAtIso.slice(0, 10)),
  };
}
