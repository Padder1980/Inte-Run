/**
 * Training flags — the "intelligent coach" heart.
 *
 * Watches recent completed runs for two signals, each requiring a streak of consecutive sessions
 * (default 2+) so a single odd day never trips anything:
 *
 *  - PACE: the run's average pace sits consistently outside the prescribed band, in the same
 *    direction, beyond a tolerance. Only continuous runs qualify (easy/long/recovery/steady) —
 *    interval sessions average across recoveries, so their mean pace says nothing.
 *  - RPE: the runner's reported effort (1–10, asked after each run) sits consistently a full point
 *    or more outside the session's intended band, in the same direction.
 *
 * The result is evidence (the exact runs, with mean deviation) plus at most ONE suggestion. The app
 * presents it in plain words and the runner accepts or declines — this module never mutates a plan.
 *
 * Suggestion logic:
 *  - faster-than-planned + harder-than-intended together ⇒ not a fitness change: the runner is
 *    overcooking easy days. Advice only ("run the easy sessions easy"), no plan change.
 *  - consistently faster (or consistently easier than intended) ⇒ propose re-anchoring to a faster
 *    5 km equivalent. Pace evidence uses the runs' implied 5 km times; RPE-only evidence nudges the
 *    current anchor by a small, capped percentage.
 *  - consistently slower (or consistently harder) ⇒ propose easing, same mechanics.
 *  - slower + easier together is contradictory ⇒ flags are reported but nothing is suggested.
 */
import type { PaceRange, RpeBand } from "../domain/types.ts";

export type RunObservation = {
  /** Stable id of the logged run (used by the app to mute a declined suggestion). */
  id: string | number;
  /** Session type as run ("easy", "long", "threshold", ...). */
  type: string;
  distKm: number;
  avgPaceSecPerKm?: number | null;
  /** The pace band the plan prescribed for the run's main work, if it prescribed one. */
  plannedPaceSecPerKm?: PaceRange | null;
  /** The effort the runner reported afterwards (1–10). */
  reportedRpe?: number | null;
  /** The effort band the session intended. */
  plannedRpe?: RpeBand | null;
  /** 5 km-equivalent seconds implied by this run's pace (computed by the caller). */
  implied5kSeconds?: number | null;
};

export type TrainingFlagKind = "pace-fast" | "pace-slow" | "rpe-high" | "rpe-low";

export type TrainingFlag = {
  kind: TrainingFlagKind;
  /** The evidence: the consecutive qualifying runs, newest first. */
  runs: RunObservation[];
  /**
   * Mean size of the deviation: seconds/km beyond the band edge for pace kinds,
   * RPE points beyond the band edge for RPE kinds. Always positive.
   */
  meanDeviation: number;
};

export type FlagSuggestion =
  | {
      action: "anchor";
      direction: "faster" | "slower";
      /** The 5 km-equivalent (seconds) to re-anchor the plan around, if accepted. */
      proposedRecent5kSeconds: number;
      basis: "pace" | "rpe";
    }
  | { action: "advice-easy-days" };

export type TrainingFlagsResult = {
  flags: TrainingFlag[];
  suggestion: FlagSuggestion | null;
};

/** Continuous types whose whole-run average pace is honestly comparable to a prescribed band. */
const PACE_TYPES = new Set(["easy", "long", "recovery", "steady"]);
/** Running types where a whole-session RPE report is meaningful (strength/mobility are excluded). */
const RPE_TYPES = new Set([
  "easy", "long", "recovery", "steady", "threshold", "vo2", "strides", "race-specific",
]);

const MIN_DIST_KM = 1.5;
/** Pace must beat the band edge by this much to count: 8 s/km or 3% of the edge, whichever is larger. */
function paceTolerance(edgeSecPerKm: number): number {
  return Math.max(8, edgeSecPerKm * 0.03);
}

type PaceClass = "fast" | "slow" | "ok";

function classifyPace(run: RunObservation): PaceClass | null {
  if (!PACE_TYPES.has(run.type)) return null;
  if (!(run.distKm >= MIN_DIST_KM)) return null;
  const pace = run.avgPaceSecPerKm;
  const band = run.plannedPaceSecPerKm;
  if (!pace || pace <= 0 || !band) return null;
  if (!(band.minSecPerKm > 0) || !(band.maxSecPerKm >= band.minSecPerKm)) return null;
  if (pace < band.minSecPerKm - paceTolerance(band.minSecPerKm)) return "fast";
  if (pace > band.maxSecPerKm + paceTolerance(band.maxSecPerKm)) return "slow";
  return "ok";
}

type RpeClass = "high" | "low" | "ok";

function classifyRpe(run: RunObservation): RpeClass | null {
  if (!RPE_TYPES.has(run.type)) return null;
  const rpe = run.reportedRpe;
  const band = run.plannedRpe;
  if (rpe == null || !(rpe >= 1 && rpe <= 10) || !band) return null;
  if (!(band.min >= 1) || !(band.max >= band.min)) return null;
  if (rpe >= band.max + 1) return "high";
  if (rpe <= band.min - 1) return "low";
  return "ok";
}

/**
 * Walk newest → oldest over the runs that qualify for a signal, and return the streak of identical
 * non-ok classifications starting at the newest qualifying run. A single in-band run breaks it.
 */
function streak<C extends string>(
  runs: RunObservation[],
  classify: (r: RunObservation) => C | "ok" | null,
): { cls: C; runs: RunObservation[] } | null {
  let cls: C | null = null;
  const hits: RunObservation[] = [];
  for (const run of runs) {
    const c = classify(run);
    if (c === null) continue; // doesn't qualify for this signal — skip, don't break
    if (c === "ok") break;
    if (cls === null) cls = c as C;
    if (c !== cls) break;
    hits.push(run);
  }
  return cls && hits.length ? { cls, runs: hits } : null;
}

function mean(ns: number[]): number {
  return ns.reduce((a, b) => a + b, 0) / ns.length;
}

function paceDeviation(run: RunObservation, cls: "fast" | "slow"): number {
  const band = run.plannedPaceSecPerKm!;
  const pace = run.avgPaceSecPerKm!;
  return cls === "fast" ? band.minSecPerKm - pace : pace - band.maxSecPerKm;
}

function rpeDeviation(run: RunObservation, cls: "high" | "low"): number {
  const band = run.plannedRpe!;
  return cls === "high" ? run.reportedRpe! - band.max : band.min - run.reportedRpe!;
}

const ANCHOR_MIN_S = 600;
const ANCHOR_MAX_S = 3600;

function clampAnchor(proposed: number, current: number): number {
  let p = Math.min(current * 1.15, Math.max(current * 0.85, proposed));
  p = Math.min(ANCHOR_MAX_S, Math.max(ANCHOR_MIN_S, p));
  return Math.round(p);
}

/** Mean implied 5 km across the evidence runs that carry one; null if none do. */
function meanImplied(runs: RunObservation[]): number | null {
  const vals = runs.map((r) => r.implied5kSeconds).filter((v): v is number => v != null && v > 0);
  return vals.length ? Math.round(mean(vals)) : null;
}

export function assessTrainingFlags(
  runs: RunObservation[],
  opts: { currentRecent5kSeconds: number; minStreak?: number },
): TrainingFlagsResult {
  const minStreak = Math.max(2, opts.minStreak ?? 2);
  const current = opts.currentRecent5kSeconds;

  const flags: TrainingFlag[] = [];

  const pace = streak<"fast" | "slow">(runs, classifyPace);
  if (pace && pace.runs.length >= minStreak) {
    flags.push({
      kind: pace.cls === "fast" ? "pace-fast" : "pace-slow",
      runs: pace.runs,
      meanDeviation: Math.round(mean(pace.runs.map((r) => paceDeviation(r, pace.cls)))),
    });
  }

  const rpe = streak<"high" | "low">(runs, classifyRpe);
  if (rpe && rpe.runs.length >= minStreak) {
    flags.push({
      kind: rpe.cls === "high" ? "rpe-high" : "rpe-low",
      runs: rpe.runs,
      meanDeviation: Math.round(mean(rpe.runs.map((r) => rpeDeviation(r, rpe.cls))) * 10) / 10,
    });
  }

  if (!flags.length || !(current > 0)) return { flags, suggestion: null };

  const byKind = new Map(flags.map((f) => [f.kind, f]));
  const fast = byKind.get("pace-fast");
  const slow = byKind.get("pace-slow");
  const high = byKind.get("rpe-high");
  const low = byKind.get("rpe-low");

  // Faster than planned AND harder than intended: the runner is overcooking easy days.
  // A new plan doesn't fix that — discipline does. Advice only.
  if (fast && high) return { flags, suggestion: { action: "advice-easy-days" } };
  // Slower AND easier is contradictory — report the flags, suggest nothing.
  if (slow && low) return { flags, suggestion: null };

  let suggestion: FlagSuggestion | null = null;
  if (slow || high) {
    // Working too hard for the plan: ease. Pace evidence anchors to the runs' implied fitness;
    // RPE-only evidence eases the current anchor by up to 8%.
    const implied = slow ? meanImplied(slow.runs) : null;
    const proposed = implied ?? current * (1 + Math.min(0.08, 0.04 * (high ? high.meanDeviation : 1)));
    suggestion = {
      action: "anchor",
      direction: "slower",
      proposedRecent5kSeconds: clampAnchor(proposed, current),
      basis: slow && implied != null ? "pace" : "rpe",
    };
  } else if (fast || low) {
    // Finding it easier than the plan expects: sharpen. RPE-only evidence is nudged conservatively
    // (max 5%) — feeling fresh is weaker evidence than actually running faster.
    const implied = fast ? meanImplied(fast.runs) : null;
    const proposed = implied ?? current * (1 - Math.min(0.05, 0.025 * (low ? low.meanDeviation : 1)));
    suggestion = {
      action: "anchor",
      direction: "faster",
      proposedRecent5kSeconds: clampAnchor(proposed, current),
      basis: fast && implied != null ? "pace" : "rpe",
    };
  }

  if (suggestion && suggestion.action === "anchor") {
    const p = suggestion.proposedRecent5kSeconds;
    // The proposal must land on the side the evidence points to. It might not: the absolute clamp
    // can push it across `current` when the anchor itself sits outside [600, 3600], and caller-
    // supplied implied times can disagree with the flag. An "ease off" that speeds every pace up is
    // worse than silence, so when we can't propose something consistent we say nothing.
    const consistent = suggestion.direction === "slower" ? p > current : p < current;
    // And a proposal within 1% of where the plan already is isn't worth interrupting anyone for.
    if (!consistent || Math.abs(p - current) < current * 0.01) suggestion = null;
  }

  return { flags, suggestion };
}
