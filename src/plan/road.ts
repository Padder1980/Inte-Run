// Stage B14 — the road to a race (STAGES.md, approved by the owner 2026-11-18).
//
// Where a runner starts on the ladder, and how the weeks to race day are budgeted between the stages. Pure: the app
// asks this when a plan is made, shows the road before it is saved, and stores what the runner accepted
// (`profile.road`); the engine then builds exactly that road (`GenerateOptions.road`). Nothing here changes a plan.

import type { Athlete, Goal, StageKind } from "../domain/types.ts";
import { youthLimitsFor } from "../domain/youth.ts";
import { addDays, dayOfWeekMondayZero, weeksBetween } from "./dates.ts";
import { type GenerateOptions, type RoadStage, roadFoundationNeed, WALKRUN_LEVELS } from "./generate-plan.ts";
import { RACE_BLOCK_WEEKS } from "./periodization.ts";

/**
 * A BLOCK — the stretch between two checkpoints (STAGES.md §10, the owner's decision 1 of 2026-11-18: "yes to all five,
 * build it"). Four weeks as standard, six at most, at every level: the research put 4–6 weeks as the review point
 * from "Building the habit" up (Daniels re-sets paces every 3–6 weeks; Hudson's recovery week every 3rd–4th), and no
 * study sets a maximum after which a block stops working — so six is a limit on how long a runner goes WITHOUT A
 * CHECKPOINT, not a limit on adaptation. A stage longer than that is laid out as several blocks, each ending in its
 * own checkpoint; the runner can always repeat one (one more week, at the checkpoint).
 */
export const BLOCK_WEEKS = 4;
export const BLOCK_MAX_WEEKS = 6;

/**
 * A stage of `weeks` as its blocks, in order: as many four-week blocks as fit, the odd weeks spread over the LAST
 * ones (so the early checkpoints keep falling on the road's every-fourth-week lighter week), and never a block over
 * BLOCK_MAX_WEEKS. A stage of six weeks or fewer is one block. Seven is the one length that cannot be cut into
 * blocks of four to six, and it is cut 4 + 3 rather than run seven weeks without a checkpoint.
 */
export function blockSplit(weeks: number): number[] {
  const n = Math.max(0, Math.floor(Number(weeks) || 0));
  if (n <= BLOCK_MAX_WEEKS) return n > 0 ? [n] : [];
  const k = Math.floor(n / BLOCK_WEEKS), r = n - k * BLOCK_WEEKS;
  if (BLOCK_WEEKS + Math.ceil(r / k) > BLOCK_MAX_WEEKS) return [BLOCK_WEEKS, ...blockSplit(n - BLOCK_WEEKS)];
  return Array.from({ length: k }, (_, i) => BLOCK_WEEKS + Math.floor(r / k) + (i >= k - (r % k) ? 1 : 0));
}

/** How long Rebuild runs when the time allows (STAGES.md §3: 4–6 weeks) — one block. */
export const REBUILD_WEEKS = BLOCK_WEEKS;
/**
 * §10 DECISION 2 — the two walk-run blocks before Rebuild for a runner just getting started: about 5 weeks to 20
 * minutes without stopping, then about 4 to 30 (as NHS Couch to 5K paces it). One level a week (WALKRUN_LEVELS), so a
 * block is as long as its levels. ⚠️ NEVER CUT: a runway too short for both blocks and the shortest race block lays no
 * road at all, and the runner keeps today's run-walk plan.
 */
export const WALKRUN_WEEKS = { walkrun1: WALKRUN_LEVELS.walkrun1.length, walkrun2: WALKRUN_LEVELS.walkrun2.length } as const;
/** Each walk-run block's key run, in minutes without stopping — its last level's (20, then 30). */
export const WALKRUN_KEY_MIN = {
  walkrun1: WALKRUN_LEVELS.walkrun1[WALKRUN_LEVELS.walkrun1.length - 1]!.keyMin!,
  walkrun2: WALKRUN_LEVELS.walkrun2[WALKRUN_LEVELS.walkrun2.length - 1]!.keyMin!,
} as const;
/** The shortest race block a road keeps (the engine's own shortest block). */
const MIN_RACE_WEEKS = 4;
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
 * ⚠️ PLACED: the beginner track's continuous runner ("Building the habit"), comeback or not — the runner the owner's
 * own plan failed — at Rebuild; and (§10 decision 2) the run-walk runner ("Just getting started") at Walk-run 1, two
 * walk-run blocks before that same Rebuild. ⚠️ NOT YET PLACED, each for a reason recorded in notes/plan-profile.md: a
 * 12–17 runner (their ceilings are a separate review), and a regular runner (§10 decision 3, a later piece: their
 * foundation must start from the mileage they state). For them the plan is exactly what it was.
 */
export function roadStartFor(athlete: Athlete): StageKind | null {
  if (youthLimitsFor(athlete.age)) return null;
  if (athlete.runWalk) return "walkrun1";
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
  // §10 decision 2: the walk-run blocks come first and are never the part cut (WALKRUN_WEEKS).
  const wr = startStage === "walkrun1" ? WALKRUN_WEEKS.walkrun1 + WALKRUN_WEEKS.walkrun2 : 0;
  if (wr > 0 && total - wr < MIN_RACE_WEEKS) return null;
  const avail = total - wr;
  const need = Math.max(REBUILD_WEEKS + BASE_MIN_WEEKS, roadFoundationNeed(athlete, goal, options).weeks);
  const shortWeeks = Math.max(0, wr + need + fullRaceWeeks - total);
  // The foundation: what the runway leaves after the full race block, never less than the runner needs, never more
  // than FOUNDATION_MAX_WEEKS. Short: the race block gives up the difference (down to the engine's shortest block).
  const foundation = Math.min(FOUNDATION_MAX_WEEKS, Math.max(need, avail - fullRaceWeeks));
  const raceWeeks = Math.max(4, Math.min(fullRaceWeeks, avail - foundation));
  const fWeeks = Math.max(0, Math.min(foundation, avail - raceWeeks));
  const rebuild = Math.min(REBUILD_WEEKS, fWeeks);
  const base = fWeeks - rebuild;
  const stages: RoadStage[] = [];
  if (wr > 0) stages.push({ kind: "walkrun1", weeks: WALKRUN_WEEKS.walkrun1 }, { kind: "walkrun2", weeks: WALKRUN_WEEKS.walkrun2 });
  if (rebuild > 0) stages.push({ kind: "rebuild", weeks: rebuild });
  // ⚠️ DECISION 1 (§10): BASE IS LAID OUT AS BLOCKS, each ending in a checkpoint — never more than six weeks without
  // one. Consecutive stages of one kind ARE consecutive blocks: the engine builds them as one stretch of Base (its
  // dose counts Base weeks so far, its lighter week every fourth week of the road), and the app puts a checkpoint
  // at the end of each.
  for (const w of blockSplit(base)) stages.push({ kind: "base", weeks: w });
  stages.push({ kind: "race", weeks: raceWeeks });
  return {
    stages,
    rampWeeks: fWeeks,
    startStage,
    fullRaceWeeks,
    needFoundationWeeks: wr + need,
    shortWeeks,
    fullFitsRaceMondayIso: addDays(startMonday, (wr + need + fullRaceWeeks - 1) * 7),
  };
}
