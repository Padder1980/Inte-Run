// Stage B14 — the road to a race (STAGES.md, approved by the owner 2026-11-18).
//
// Where a runner starts on the ladder, and how the weeks to race day are budgeted between the stages. Pure: the app
// asks this when a plan is made, shows the road before it is saved, and stores what the runner accepted
// (`profile.road`); the engine then builds exactly that road (`GenerateOptions.road`). Nothing here changes a plan.

import type { Athlete, Goal, StageKind } from "../domain/types.ts";
import { youthLimitsFor } from "../domain/youth.ts";
import { addDays, dayOfWeekMondayZero, weeksBetween } from "./dates.ts";
import { type GenerateOptions, type RoadStage, roadFoundationNeed } from "./generate-plan.ts";
import { RACE_BLOCK_WEEKS } from "./periodization.ts";

/** How long Rebuild runs when the time allows (STAGES.md §3: 4–6 weeks). */
export const REBUILD_WEEKS = 4;
/** The shortest Base worth calling one (§3: 4–8 weeks typical). */
export const BASE_MIN_WEEKS = 4;
/**
 * The longest foundation a road lays out. ⚠️ BEYOND IT THE WEEKS ARE A LEAD-IN, AS TODAY: a Base of a year is not a
 * stage with one clear job, and the ladder would be spread so thin it would barely move. §4.4's "more time than
 * needed → extra Base weeks" is honoured up to here (Base up to sixteen weeks).
 */
export const FOUNDATION_MAX_WEEKS = 20;

export type RoadProposal = {
  /** The stages in order, the race block last. Their weeks add up to the runway (up to FOUNDATION_MAX_WEEKS of it). */
  stages: RoadStage[];
  /** The foundation's ramp length, fixed now so that no later checkpoint answer can re-pace a week already run. */
  rampWeeks: number;
  /** Where this runner starts on the ladder. */
  startStage: StageKind;
  /** The race block of the book's length for this race (RACE_BLOCK_WEEKS). */
  fullRaceWeeks: number;
  /** The foundation this runner needs before that race block (roadFoundationNeed — Rebuild + Base at least). */
  needFoundationWeeks: number;
  /**
   * How many weeks short the runway is of the whole road — 0 when it fits. ⚠️ WHEN IT IS SHORT THE PROPOSAL IS NOT
   * A DECISION: `stages` then carries the foundation the runner needs and a race block shortened to fit, which is
   * ONE of the choices the app must offer beside the others (owner, 2026-11-18, decision 4: "all options
   * available" — adjust the target, a later race, or carry on with the shorter race block). It never picks.
   */
  shortWeeks: number;
  /** The earliest race Monday the whole road would fit before, for the "a later race" choice. */
  fullFitsRaceMondayIso: string;
};

/**
 * Where a runner STARTS on the ladder (STAGES.md §3–§4.1), or null for a runner this stage does not yet place.
 *
 * ⚠️ PLACED TODAY: the beginner track's continuous runner ("Building the habit"), comeback or not — the runner the
 * owner's own plan failed (a habit-builder coming back from injury had no harder session in any week), and the one
 * whose foundation the engine builds with the week builder it already has. ⚠️ NOT YET PLACED, each for a reason
 * recorded in notes/plan-profile.md: run-walk (the ladder's stage 0 — its own exit test, 25–30 minutes continuous);
 * a 12–17 runner (their ceilings are a separate review); and a regular runner, whether coming back or far from race
 * day (their foundation must start from the mileage they state, which the beginner builder does not read). For all
 * of them the plan is exactly what it was.
 */
export function roadStartFor(athlete: Athlete): StageKind | null {
  if (athlete.runWalk) return null;
  if (youthLimitsFor(athlete.age)) return null;
  if (athlete.experience !== "beginner") return null;
  return "rebuild";
}

/**
 * The road for this runner and race, budgeted backwards from race day (STAGES.md §4): the race block takes the
 * book's length first, the foundation fills the weeks before it — Rebuild first, then Base — and where the runway
 * is short the race block is the part shortened (decision 4's third choice), never the foundation the runner needs,
 * and the proposal says by how much. Null where `roadStartFor` places nobody.
 */
export function roadFor(athlete: Athlete, goal: Goal, startIso: string, options: GenerateOptions = {}): RoadProposal | null {
  const startStage = roadStartFor(athlete);
  if (!startStage) return null;
  const raceMonday = addDays(goal.raceDateIso, -dayOfWeekMondayZero(goal.raceDateIso));
  const startMonday = addDays(startIso, -dayOfWeekMondayZero(startIso));
  const total = Math.max(0, weeksBetween(startMonday, raceMonday) + 1);
  const fullRaceWeeks = RACE_BLOCK_WEEKS[goal.distance];
  const need = Math.max(REBUILD_WEEKS + BASE_MIN_WEEKS, roadFoundationNeed(athlete, goal, options).weeks);
  const shortWeeks = Math.max(0, need + fullRaceWeeks - total);
  // The foundation: what the runway leaves after the full race block, never less than the runner needs, never more
  // than FOUNDATION_MAX_WEEKS. Short: the race block gives up the difference (down to the engine's shortest block).
  const foundation = Math.min(FOUNDATION_MAX_WEEKS, Math.max(need, total - fullRaceWeeks));
  const raceWeeks = Math.max(4, Math.min(fullRaceWeeks, total - foundation));
  const fWeeks = Math.max(0, Math.min(foundation, total - raceWeeks));
  const rebuild = Math.min(REBUILD_WEEKS, fWeeks);
  const base = fWeeks - rebuild;
  const stages: RoadStage[] = [];
  if (rebuild > 0) stages.push({ kind: "rebuild", weeks: rebuild });
  if (base > 0) stages.push({ kind: "base", weeks: base });
  stages.push({ kind: "race", weeks: raceWeeks });
  return {
    stages,
    rampWeeks: fWeeks,
    startStage,
    fullRaceWeeks,
    needFoundationWeeks: need,
    shortWeeks,
    fullFitsRaceMondayIso: addDays(startMonday, (need + fullRaceWeeks - 1) * 7),
  };
}
