import type { Equipment, MovementPattern } from "./library.ts";
import { holdSecondsFor } from "./builder.ts";

/**
 * TURNING THE SET LOG INTO COACHING (A6).
 *
 * Everything here is a pure function over the log a runner has already built — nothing is stored,
 * nothing is fetched. The log itself (interun_slog_v2, A1) needs no new shape and no migration: this
 * stage reads it, it never writes to it.
 *
 * ⚠️ EPLEY IS DEFINED FOR 1-10 REPS ONLY. Past ten reps the formula's error grows fast enough that the
 * number stops meaning anything, and this app's own warm-up work already refuses to synthesise a
 * figure it cannot stand behind rather than printing a confident wrong one.
 */
export function epley1RM(weightKg: number, reps: number): number | null {
  if (!Number.isFinite(weightKg) || weightKg <= 0) return null;
  if (!Number.isFinite(reps) || reps < 1 || reps > 10) return null;
  return weightKg * (1 + reps / 30);
}

/**
 * The one-rep-max the runner has ever DEMONSTRATED for this exercise — the max Epley figure across
 * every complete set on record, whatever session it came from. `suggestLoad`'s no-history fallback
 * reads this rather than only the most recent instance, because a runner returning to an exercise
 * after weeks away still has a real e1RM on file even though there is nothing recent enough to
 * double-progress from.
 */
export function bestE1RMKg(instances: LoggedSet[][]): number | null {
  let best: number | null = null;
  for (const inst of instances) for (const s of inst) {
    if (s.w == null || s.r == null) continue;
    const e = epley1RM(s.w, s.r);
    if (e != null && (best == null || e > best)) best = e;
  }
  return best;
}

/** kg added on a clean double-progression step. Barbell squats and hinges step in bigger jumps once
 *  they are carrying real load — see isBigBarbellLift. */
export const LOAD_STEP_KG = 2.5;
export const LOAD_STEP_KG_BARBELL = 5;
/** The weight a barbell lift must already be at before the bigger step applies — below this a 5 kg
 *  jump is proportionally large, not the "small, sensible step" the bigger increment is meant to be. */
export const LOAD_STEP_THRESHOLD_KG = 40;
/** A missed rep range costs more than a clean one earns, on purpose — descending too slowly from a
 *  weight that was genuinely too heavy is worse than descending a touch too far. */
export const LOAD_CUTBACK_FRAC = 0.05;
/** An RPE at or above this on the last set caps the weight next time, whatever the reps said —
 *  reaching the top of the rep range at a 9 or 10 is not the same "clean" as reaching it at a 6. */
export const RPE_HOLD_FLOOR = 9;

/** A set as the store holds it: weight in kg, reps, and an optional effort rating. Both w and r are
 *  present together or the set is not usable for progression — a reps-only row (bodyweight) or a
 *  weight-only one (mistyped) carries nothing this module can act on. */
export type LoggedSet = { w?: number | null; r?: number | null; rpe?: number | null };

export type LoadSuggestion = {
  /** kg, rounded to the nearest half — never rendered as a value the runner did not type; see the
   *  player's own comment on why this goes into an input's placeholder and nowhere else. */
  kg: number;
  reason: string;
  direction: "up" | "down" | "hold" | "start";
} | null;

/**
 * "8–12" -> [8, 12]. Returns null for a hold ("30–45s hold") or anything with no numeric range —
 * there is no weight to suggest for either.
 *
 * ⚠️ "30–45s hold" HAS THE SAME SHAPE AS A REP RANGE, AND A BARE DIGIT-DASH-DIGIT REGEX CANNOT TELL
 * THEM APART — it happily extracted [30, 45] from a hold prescription and suggested a load for a
 * plank. holdSecondsFor is the engine's own single definition of what counts as a hold (it answers
 * the exact same question for the session player's countdown), so this asks it rather than inventing
 * a second, disagreeing test for the same fact.
 */
function repRange(reps: string): [number, number] | null {
  if (holdSecondsFor(reps) > 0) return null;
  const m = /(\d+)\s*[–-]\s*(\d+)/.exec(String(reps));
  if (!m) return null;
  return [Number(m[1]), Number(m[2])];
}

/** The first number in "80%+" or "70–75%", as a fraction. The LOWER bound on purpose: this only ever
 *  fires when there is no set-log history to seed from, so the honest answer is to start conservative
 *  and let the first real session's own numbers take over from there. */
function parseLoadPercent(s: string): number | null {
  const m = /(\d+(?:\.\d+)?)/.exec(String(s));
  return m ? Number(m[1]) / 100 : null;
}

/** Barbell squats and deadlift-family hinges are the two lifts where plates make a 5 kg total jump
 *  (2.5 kg a side) the natural next step rather than a leap — everything else steps in 2.5 kg. */
function isBigBarbellLift(pattern: MovementPattern, equipment: Equipment[]): boolean {
  return (pattern === "squat" || pattern === "hinge") && equipment.includes("barbell");
}

function round(kg: number): number { return Math.round(kg * 2) / 2; }

/**
 * The next load to try, and why — double progression against the runner's OWN last complete session
 * of this exercise, falling back to a fraction of their best-ever e1RM when there is nothing recent
 * enough to compare against.
 *
 * ⚠️ THIS RETURNS A VALUE, AND THE CALLER MUST NEVER WRITE IT INTO A ROW. "Suggests" and "logs" are
 * different verbs: a runner who never touches the kg box must never have this number silently recorded
 * as if they had typed it. The player renders it as the input's PLACEHOLDER, never its value — the
 * prefilled value comes only from strPrefill, which is what the runner actually did last time.
 */
export function suggestLoad(opts: {
  prescribedReps: string;
  loadPercent1RM?: string | null;
  pattern: MovementPattern;
  equipment: Equipment[];
  /** Every prior instance of this exercise, oldest first, most recent LAST. Each instance is every
   *  set logged for it on one date. Today's own in-progress session is not included. */
  priorInstances: LoggedSet[][];
}): LoadSuggestion {
  const range = repRange(opts.prescribedReps);
  if (!range) return null; // a hold has no weight to suggest

  const last = opts.priorInstances.length ? opts.priorInstances[opts.priorInstances.length - 1]! : [];
  const lastValid = last.filter((s): s is Required<Pick<LoggedSet, "w" | "r">> & LoggedSet =>
    s.w != null && s.w > 0 && s.r != null && s.r > 0);

  // ⚠️ EACH REASON STRING RESTATES THE SUGGESTED NUMBER, RATHER THAN LEAVING IT TO THE CALLER TO
  // COMPOSE. The number is also rendered as the kg box's placeholder — ghost text that is easy to
  // miss — so the caption stays true on its own even if a runner never notices the box.
  if (lastValid.length) {
    const final = lastValid[lastValid.length - 1]!;
    const lastWeight = final.w!;
    // ⚠️ THE RPE OVERRIDE IS CHECKED FIRST. Reaching the top of the rep range at an RPE of 9 or 10 is
    // not the same "clean" pass as reaching it at a 6 — the runner is already close to their limit, so
    // adding weight now would be encouraging a jump straight into failure next time.
    if (final.rpe != null && final.rpe >= RPE_HOLD_FLOOR) {
      const kg = round(lastWeight);
      return { kg, direction: "hold", reason: "That last set was close to your limit — " + kg + " kg again." };
    }
    const allAtTop = lastValid.every((s) => s.r! >= range[1]);
    const anyBelow = lastValid.some((s) => s.r! < range[0]);
    if (allAtTop) {
      const step = isBigBarbellLift(opts.pattern, opts.equipment) && lastWeight >= LOAD_STEP_THRESHOLD_KG
        ? LOAD_STEP_KG_BARBELL : LOAD_STEP_KG;
      const kg = round(lastWeight + step);
      return { kg, direction: "up", reason: "Every set hit the top of the range last time — try " + kg + " kg." };
    }
    if (anyBelow) {
      const kg = round(lastWeight * (1 - LOAD_CUTBACK_FRAC));
      return { kg, direction: "down",
        reason: "A set fell short of the range last time — try " + kg + " kg." };
    }
    const kg = round(lastWeight);
    return { kg, direction: "hold", reason: "Right in the range last time — " + kg + " kg again." };
  }

  // ⚠️ NOTHING RECENT ENOUGH TO DOUBLE-PROGRESS FROM. This is not necessarily a runner's first-ever
  // set of this exercise — it also covers a return after a gap, or a swap back to something they used
  // to do — so rather than leave the box blank, fall back to a fraction of the best e1RM anywhere on
  // record. Only where BOTH ingredients exist: an exercise with no load percentage (an accessory
  // movement) or a runner with no e1RM at all for it (truly the first time) is left blank, because
  // there is nothing honest to suggest.
  if (!opts.loadPercent1RM) return null;
  const pct = parseLoadPercent(opts.loadPercent1RM);
  if (pct == null) return null;
  const best = bestE1RMKg(opts.priorInstances);
  if (best == null) return null;
  const kg = round(pct * best);
  return { kg, direction: "start",
    reason: "About " + Math.round(pct * 100) + "% of your estimated one-rep max — around " + kg + " kg." };
}

/** Total kg lifted in a set of sets — sum of weight x reps, skipping anything without both. Bodyweight
 *  sets (reps with no weight) contribute nothing, which is correct: without a tracked load, "volume"
 *  is not a number that means anything for that set. */
export function sumVolumeKg(sets: LoggedSet[]): number {
  let v = 0;
  for (const s of sets) if (s.w != null && s.w > 0 && s.r != null && s.r > 0) v += s.w * s.r;
  return v;
}
