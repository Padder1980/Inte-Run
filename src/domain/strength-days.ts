import type { Athlete, Phase } from "./types.ts";

/**
 * How many strength sessions a given week of the plan gets.
 *
 * ⚠️ THIS EXISTED AS TWO INLINE RULES IN generate-plan.ts AND THE FORM COULD SEE NEITHER. The main
 * track's was a three-branch literal inside `addStrength` (2 in base/build, 1 in peak or a deload,
 * 1 then 0 across the taper); the beginner track's was a different literal inside
 * `buildBeginnerWeek` keyed on the RAW `daysPerWeek`. Neither was reachable from the UI, so the
 * question on screen was a Yes/No while Runna asks for a number — and the app had no way to say what
 * a number would deliver.
 *
 * ⚠️⚠️ ABSENT PREFERENCES REPRODUCE TODAY EXACTLY, BRANCH FOR BRANCH. That is not caution, it is the
 * `weeklyVolumeKm: 30` rule: a default nobody chose that reshapes the plan rebuilds every existing
 * runner's block on the first boot after an update. The legacy arms below are the old literals moved,
 * not rewritten, and `test/strength-prefs.test.ts` hashes whole plans both ways.
 *
 * ⚠️ IT RETURNS A REQUEST, NOT A PLACEMENT. Each builder places up to as many as it has days for —
 * the beginner week has two strength slots and slices to them — exactly as `runningDaysFor` returns
 * what the generator schedules while the slot tables stay where they are used.
 */
export type StrengthWeek = {
  phase: Phase;
  isDeload: boolean;
  /** 1-based position within the phase. Only the taper reads it. */
  ordinalInPhase: number;
};

/** The most a single week may carry, whatever the runner asked for. Runna offers up to four. */
export const STRENGTH_MAX_PER_WEEK = 4;

/** The most a peak week may carry — see the peak rule below. */
const PEAK_MAX = 2;

export function strengthSessionsFor(
  a: Pick<Athlete, "includeStrength" | "strength" | "experience" | "daysPerWeek">,
  wp: StrengthWeek,
): number {
  if (!a.includeStrength) return 0;
  const beginner = a.experience === "beginner";
  const prefs = a.strength;

  if (!prefs) {
    // ---- Legacy: the two literals this function replaced, moved verbatim. -------------------------
    if (beginner) {
      // The beginner builder's own rule. `ease` there is a deload OR the taper; both mean one session.
      const ease = wp.isDeload || wp.phase === "taper";
      return a.daysPerWeek >= 4 && !ease ? 2 : 1;
    }
    if (wp.phase === "taper") return wp.ordinalInPhase === 1 ? 1 : 0;
    if (wp.phase === "peak" || wp.isDeload) return 1;
    return 2;
  }

  const req = Math.max(0, Math.min(STRENGTH_MAX_PER_WEEK, Math.round(prefs.sessionsPerWeek)));
  if (req === 0) return 0;

  // ⚠️ THE TAPER KEEPS ONE SESSION AND THEN NONE, whatever the runner asked for. The taper evidence
  // is explicit that intensity is maintained while volume falls, and one short session is how that
  // is done; two is the volume the taper exists to remove.
  if (wp.phase === "taper") return wp.ordinalInPhase === 1 ? Math.min(1, req) : 0;
  // A deload is a week whose whole job is absorbing the work already done.
  if (wp.isDeload) return Math.min(1, req);
  // ⚠️ PEAK DROPS ONE SESSION RELATIVE TO BASE AND BUILD, AND NEVER CARRIES MORE THAN TWO. Peak is
  // where the running load is highest, which is the reasoning the old literal encoded by hardcoding
  // 1 — and the shape below reproduces that literal exactly at the two sessions a legacy "Yes"
  // delivers, while staying monotone in the runner's answer. A one-session runner keeps their one
  // session rather than losing it: dropping to zero would be a bigger change than they asked for.
  if (wp.phase === "peak") return Math.min(PEAK_MAX, Math.max(1, req - 1));
  return req;
}
