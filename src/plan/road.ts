// Stage B14 — the road to a race (STAGES.md, approved by the owner 2026-11-18).
//
// Where a runner starts on the ladder, and how the weeks to race day are budgeted between the stages. Pure: the app
// asks this when a plan is made, shows the road before it is saved, and stores what the runner accepted
// (`profile.road`); the engine then builds exactly that road (`GenerateOptions.road`). Nothing here changes a plan.

import type { Athlete, Goal, RaceDistanceKey, StageKind } from "../domain/types.ts";
import { youthLimitsFor } from "../domain/youth.ts";
import { addDays, dayOfWeekMondayZero, weeksBetween } from "./dates.ts";
import { type GenerateOptions, mainFoundationNeed, type RoadStage, roadFoundationNeed, WALKRUN_LEVELS } from "./generate-plan.ts";
import { RACE_BLOCK_WEEKS, taperWeeksFor } from "./periodization.ts";

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

/**
 * ⚠️⚠️ §10 PIECE 3 — THE RACE BLOCK IN BLOCKS (owner, 2026-11-18, decision 3: "race blocks get a checkpoint every 4
 * weeks"). The race block is still ONE block to the engine, laid back from race day (consecutive race entries are built
 * as one, byte for byte); this says where its checkpoints fall: every BLOCK_WEEKS weeks from its first week — which is
 * where the race block's own lighter weeks fall (its weeks 4, 8, 12…, periodization.ts), so the test lands on a lighter
 * week — and NEVER INSIDE THE TAPER (a checkpoint there would re-set paces for a race already being tapered for). The
 * last entry runs to race day, whose question is B9's after-race handover, not a checkpoint. A race block too short for
 * any checkpoint is one entry. The last entry is never over six weeks (the taper is three at most).
 */
export function raceBlockSplit(weeks: number, distance: RaceDistanceKey): number[] {
  const n = Math.max(0, Math.floor(Number(weeks) || 0));
  if (n <= 0) return [];
  const lastCut = n - taperWeeksFor(n, distance);
  const out: number[] = [];
  let at = 0;
  while (at + BLOCK_WEEKS <= lastCut && at + BLOCK_WEEKS < n) { out.push(BLOCK_WEEKS); at += BLOCK_WEEKS; }
  out.push(n - at);
  return out;
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
  /**
   * §10 piece 3 — a main-track road only: the race block's length as laid, which its foundation is aimed at (stored on
   * the road as `destWeeks`, as rampWeeks is, so no later answer moves it). Absent on a beginner's road (the book's).
   */
  destWeeks?: number;
};

/**
 * Where a runner STARTS on the ladder (STAGES.md §3–§4.1), or null for a runner this stage does not yet place.
 *
 * ⚠️ PLACED: the beginner track's continuous runner ("Building the habit"), comeback or not — the runner the owner's
 * own plan failed — at Rebuild; (§10 decision 2) the run-walk runner ("Just getting started") at Walk-run 1, two
 * walk-run blocks before that same Rebuild; and (§10 decision 3, piece 3) a regular or competitive runner — coming
 * back from an injury or a break at Rebuild, otherwise at Base (roadFor lays a race-only road when the runway leaves
 * no Base worth calling one). ⚠️ NOT YET PLACED: a 12–17 runner (their ceilings are a separate review), for whom the
 * plan is exactly what it was.
 */
export function roadStartFor(athlete: Athlete): StageKind | null {
  if (youthLimitsFor(athlete.age)) return null;
  if (athlete.runWalk) return "walkrun1";
  if (athlete.experience === "beginner") return "rebuild";
  return athlete.returningFromInjury || athlete.returningFromBreak ? "rebuild" : "base";
}

/**
 * ⚠️⚠️ §10 PIECE 3 — A REGULAR OR COMPETITIVE RUNNER'S ROAD (decision 3). The race block is the book's length; before it,
 * the foundation they NEED (never the part a short runway cuts):
 *   coming back (injury or a break)  Rebuild (one block), and Base after it where the climb takes longer;
 *   stating less than the race block opens with   Base, as long as the climb takes (mainFoundationNeed — at least
 *                                    BASE_MIN_WEEKS), from the mileage they state to the race block's first week;
 *   otherwise                        nothing: they can start the race block today, as today's plan does.
 * Spare weeks join a Base the runner already needs; where there is none they become Base blocks once there are at
 * least BASE_MIN_WEEKS of them (up to FOUNDATION_MAX_WEEKS of foundation), and fewer go to the race block — exactly the
 * longer block today's engine lays for that runway (MAX_STRUCTURED_WEEKS is the book's length plus four), so a race-only
 * road is today's plan byte for byte, with its checkpoints. Short of the foundation plus a full race block, the race
 * block is the part shortened and the proposal says by how much — decision 4: one choice among the others, never picked
 * by the app. A road with no checkpoint at all is no road.
 */
function mainRoadFor(athlete: Athlete, startStage: StageKind, goal: Goal, startMonday: string, total: number,
  options: GenerateOptions): RoadProposal | null {
  const fullRaceWeeks = RACE_BLOCK_WEEKS[goal.distance];
  const rebuildNeed = startStage === "rebuild" ? REBUILD_WEEKS : 0;
  // The foundation needed to reach a race block of `weeks`: Rebuild when coming back, and the climb from the stated
  // mileage (at least a Base worth calling one).
  const needFor = (weeks: number) => {
    const climb = mainFoundationNeed(athlete, goal, options, weeks);
    return rebuildNeed > 0 ? Math.max(rebuildNeed, climb) : climb > 0 ? Math.max(BASE_MIN_WEEKS, climb) : 0;
  };
  const layOut = (need: number) => {
    if (need + fullRaceWeeks > total) {
      const race = Math.max(MIN_RACE_WEEKS, Math.min(fullRaceWeeks, total - need));
      return { race, foundation: Math.max(0, Math.min(need, total - race)) };
    }
    const spare = total - need - fullRaceWeeks;
    const extraBase = need > rebuildNeed || spare >= BASE_MIN_WEEKS ? spare : 0;
    return { race: fullRaceWeeks + spare - extraBase, foundation: Math.min(FOUNDATION_MAX_WEEKS, need + extraBase) };
  };
  // ⚠️ A RUNNER NOT COMING BACK, WITH NO MORE THAN TODAY'S PLAN'S RUNWAY, takes the whole runway as one race block where that
  // block — today's own longer block, which opens lower on its ramp — needs no climb: a race-only road, today's plan with
  // checkpoints, rather than a Base squeezed in front of a shortened block the runner would have to tick.
  const longestOnly = fullRaceWeeks + BASE_MIN_WEEKS - 1;
  if (rebuildNeed === 0 && total <= longestOnly && needFor(Math.max(MIN_RACE_WEEKS, total)) === 0) {
    const stages = raceBlockSplit(total, goal.distance).map((w) => ({ kind: "race" as const, weeks: w }));
    if (stages.length < 2) return null;
    return { stages, rampWeeks: 0, startStage: "race", fullRaceWeeks, needFoundationWeeks: 0, shortWeeks: 0,
      fullFitsRaceMondayIso: addDays(startMonday, (fullRaceWeeks - 1) * 7), destWeeks: total };
  }
  // ⚠️ THE NEED IS MEASURED AGAINST THE RACE BLOCK THIS ROAD WILL LAY, which is not always the book's: the volume fit opens
  // a block of another length on another week. Short of the runway, the race block shortens to make room, and a shorter
  // block can open higher still — so it is asked again (twice at most) until the foundation reaches the block it joins.
  let need = needFor(fullRaceWeeks);
  let { race: raceWeeks, foundation } = layOut(need);
  for (let k = 0; k < 3 && raceWeeks !== fullRaceWeeks; k++) {
    const again = needFor(raceWeeks);
    if (again <= need) break;
    need = again;
    ({ race: raceWeeks, foundation } = layOut(need));
  }
  const shortWeeks = Math.max(0, need + fullRaceWeeks - total);
  // ⚠️ NO ROAD WHERE EVEN THE SHORTEST RACE BLOCK LEAVES TOO LITTLE ROOM FOR THE CLIMB: a foundation cut short of its need
  // joins its race block in a jump (measured: a marathon fourteen weeks away on 15 km a week, 55 → 83 minutes into a
  // four-week block). Such a runner keeps today's plan, exactly as one no road places.
  if (foundation < need) return null;
  const rebuild = Math.min(rebuildNeed, foundation);
  const base = foundation - rebuild;
  const stages: RoadStage[] = [];
  if (rebuild > 0) stages.push({ kind: "rebuild", weeks: rebuild });
  for (const w of blockSplit(base)) stages.push({ kind: "base", weeks: w });
  for (const w of raceBlockSplit(raceWeeks, goal.distance)) stages.push({ kind: "race", weeks: w });
  if (stages.length < 2) return null;
  return {
    stages,
    rampWeeks: rebuild + base,
    startStage: stages[0]!.kind,
    fullRaceWeeks,
    needFoundationWeeks: need,
    shortWeeks,
    fullFitsRaceMondayIso: addDays(startMonday, (need + fullRaceWeeks - 1) * 7),
    destWeeks: raceWeeks,
  };
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
  // §10 piece 3: a regular or competitive runner's road is budgeted on its own terms (mainRoadFor).
  if (athlete.experience !== "beginner" && !athlete.runWalk) return mainRoadFor(athlete, startStage, goal, startMonday, total, options);
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
  // §10 piece 3: the race block in blocks of four, each with its checkpoint (raceBlockSplit) — one block to the engine.
  for (const w of raceBlockSplit(raceWeeks, goal.distance)) stages.push({ kind: "race", weeks: w });
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

// ---- §10 piece 4: a goal without a race — rolling blocks (STAGES.md §10 decision 4) --------------------------------

/**
 * §10 piece 4 — THE BLOCK AFTER A BLOCK ON A ROAD WITH NO RACE: Walk-run 1 → Walk-run 2 → Rebuild → Base → Base → …, each
 * at its standard length (noRaceBlockWeeks). The road has no end: the app lays out the block the runner is in and the
 * next, and adds another as each checkpoint is passed. One definition, read by the app (effectiveRoad) and the tests.
 */
export function noRaceNextKind(kind: StageKind): StageKind {
  return kind === "walkrun1" ? "walkrun2" : kind === "walkrun2" ? "rebuild" : "base";
}
/** A block's standard length on a road with no race: the walk-run blocks their levels, Rebuild and Base four weeks. */
export function noRaceBlockWeeks(kind: StageKind): number {
  return kind === "walkrun1" ? WALKRUN_WEEKS.walkrun1 : kind === "walkrun2" ? WALKRUN_WEEKS.walkrun2
    : kind === "rebuild" ? REBUILD_WEEKS : BLOCK_WEEKS;
}
export type NoRaceRoadProposal = {
  /** The first two blocks: the block the runner starts in and the next (decision 3 — "the block you're in plus the next"). */
  stages: RoadStage[];
  /** The foundation's ramp, in Rebuild/Base weeks: how long the climb to race-ready takes before the plan holds there. */
  rampWeeks: number;
  startStage: StageKind;
  /** Every week of the climb, the walk-run blocks included — what the wizard says ("it builds for about 12 weeks"). */
  climbWeeks: number;
};
/**
 * ⚠️⚠️ §10 PIECE 4 — A NEW ROAD WITH NO RACE (owner, 2026-11-19: "yes, all your picks"). Placed exactly as a race road is
 * (roadStartFor: the walk-run blocks for a runner just getting started, Rebuild for a habit-builder or anybody coming
 * back, Base for a regular runner), and never for a 12–17 runner (null — their plan is built for a race).
 *
 * THE CLIMB IS THE ROAD'S OWN NEED, measured as a race road measures it (roadFoundationNeed, mainFoundationNeed): the
 * fewest weeks whose long run arrives within one step of the first week of a race block of the book's length for the
 * runner's distance — anchored, as the engine anchors it (generateNoRaceRoadPlan), on the road's first Monday. Over those
 * weeks the plan climbs; past them it holds (decision 4, the owner's A). A regular runner already there climbs nothing.
 */
export function roadNoRaceFor(athlete: Athlete, goal: Goal, startIso: string, options: GenerateOptions = {}): NoRaceRoadProposal | null {
  const startStage = roadStartFor(athlete);
  if (!startStage) return null;
  const startMonday = addDays(startIso, -dayOfWeekMondayZero(startIso));
  const book = RACE_BLOCK_WEEKS[goal.distance];
  const refGoal: Goal = { ...goal, raceDateIso: addDays(startMonday, (book - 1) * 7 + 6), startDateIso: startMonday };
  const { road: _road, secondaryRace: _sr, ...rest } = options;
  let ramp: number;
  if (athlete.experience !== "beginner" && !athlete.runWalk) {
    const climb = mainFoundationNeed(athlete, refGoal, rest, book);
    const rebuild = startStage === "rebuild" ? REBUILD_WEEKS : 0;
    ramp = rebuild > 0 ? Math.max(rebuild, climb) : climb > 0 ? Math.max(BASE_MIN_WEEKS, climb) : 0;
  } else {
    ramp = Math.max(REBUILD_WEEKS + BASE_MIN_WEEKS, roadFoundationNeed(athlete, refGoal, rest).weeks);
  }
  const second = noRaceNextKind(startStage);
  const stages: RoadStage[] = [
    { kind: startStage, weeks: noRaceBlockWeeks(startStage) },
    { kind: second, weeks: noRaceBlockWeeks(second) },
  ];
  const walk = startStage === "walkrun1" ? WALKRUN_WEEKS.walkrun1 + WALKRUN_WEEKS.walkrun2 : 0;
  return { stages, rampWeeks: ramp, startStage, climbWeeks: walk + ramp };
}
