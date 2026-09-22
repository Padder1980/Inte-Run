import { RACE_DISTANCES_M, METRES_PER_KM, type RaceDistanceKey } from "./units.ts";

/**
 * What a 12-17 year old may be coached towards, and how much.
 *
 * Commissioned by the owner on 21 September 2026, replacing an under-18 gate. The research, the
 * sources and what was discarded are in YOUTH.md at the repo root; read that before changing a
 * number here, because every one of them is a governing body's or a position stand's, not a taste.
 *
 * ⚠️⚠️ THESE ARE UK ATHLETICS' RULE, NOT ITS RECOMMENDATION, AND THAT WAS THE OWNER'S EXPLICIT
 * CHOICE. UKA publishes both: a maximum PERMITTED distance (Rules for Competition TR3 S4) and a
 * shorter RECOMMENDED one it licenses real events against. The recommendation would cap 15-17 at
 * 8-14 km and withhold the half marathon until 18. He chose the rule, having first proposed a table
 * more permissive than either. Do not quietly move to the recommendation, and do not move past the
 * rule -- the first reverses his decision, the second coaches a minor toward a race they cannot enter.
 *
 * ⚠️ THE NUMBERS A SEARCH GIVES YOU FOR THIS ARE WRONG, TWICE OVER. UKA's age groups CHANGED on
 * 1 April 2026 (U13/U15/U17 became U14/U16/U18), so anything written before that describes different
 * bands; and the widely-quoted table allowing a 15-year-old a half marathon and a 17-year-old a
 * marathon traces to a 1987 viewpoint article, not to any rule. YOUTH.md section 1 has the detail.
 * If a source lets a 15-year-old race a half, it is that table wearing a new hat.
 *
 * ⚠️ 18 IS AN ADULT, by his ruling and by UK majority, UKA's own rule (a marathon is permitted at 18)
 * and every World Marathon Major's entry age. So this module answers for 12-17 and for nobody else.
 */

/** The youngest and oldest ages that get a youth plan. 18 is an adult. */
export const YOUTH_MIN_AGE = 12;
export const YOUTH_MAX_AGE = 17;

/**
 * UKA Rules for Competition TR3 S4 - maximum permitted ROAD race distance, by age on the day.
 *
 * ⚠️ ROAD, NOT CROSS COUNTRY OR TRAIL, which are shorter again (12-13: 4 km, 14-15: 5 km, 16-17:
 * 8 km off-road). The app builds road plans, so road is the applicable column; if it ever builds a
 * trail plan these are the wrong numbers for it.
 */
const RULE_MAX_KM: Readonly<Record<number, number>> = { 12: 6, 13: 6, 14: 8, 15: 12, 16: 16, 17: 25 };

/**
 * The owner's own frequency column, adopted unchanged on 21 September 2026.
 *
 * ⚠️ THIS IS THE ONE COLUMN OF HIS TABLE THAT WAS NEVER IN DISPUTE, and it is well supported:
 * Nationwide Children's says under-14s should run "only three times per week", and measured practice
 * in competitive adolescent runners is 4.1 sessions a week at 13-14 and 5.1 at 17-18. His table said
 * "max 4-5" at 15-16; 5 is the ceiling of his own range and is what is encoded.
 */
const MAX_RUN_DAYS: Readonly<Record<number, number>> = { 12: 3, 13: 3, 14: 3, 15: 5, 16: 5, 17: 5 };

/**
 * Weekly volume as a multiple of the longest single session.
 *
 * ⚠️ PROVENANCE FLAG - THIS IS THE WEAKEST NUMBER IN THE FILE AND IS DELIBERATELY THE CONSERVATIVE
 * READING. It is attributed to the Youth Running Consensus Statement (Krabak et al., Br J Sports Med
 * 2021;55:305-318) by two independent secondary summaries; I could not obtain the primary text, and a
 * third source -- one quoting the discarded 1987 table -- says three rather than two. Two is chosen
 * because it is the smaller. Raising it needs the primary text, not another blog.
 */
const WEEKLY_MULTIPLE = 2;

export interface YouthLimits {
  /** The age these limits were resolved for, after clamping. */
  age: number;
  /** No single run may exceed this. UKA TR3 S4. */
  maxSessionKm: number;
  /** No week's running may exceed this. See WEEKLY_MULTIPLE's provenance flag. */
  maxWeeklyKm: number;
  /** Most days a week the plan may schedule a run. */
  maxRunDays: number;
}

/**
 * True for anyone this module answers for. Absent, non-finite and 18+ are all false.
 *
 * ⚠️ DELIBERATELY UNBOUNDED BELOW, AND THAT IS THE SAFE DIRECTION. There is no lower test, so
 * an age of 9 is "youth" and youthLimitsFor clamps it to the 12 row. The form cannot produce one, but
 * a restored backup or a future birthday field could -- and the failure mode of a lower bound would be
 * that the youngest runner in the app is treated as an ADULT, which is the one outcome this file
 * exists to prevent.
 */
export function isYouthAge(age: number | null | undefined): boolean {
  return typeof age === "number" && Number.isFinite(age) && age < YOUTH_MAX_AGE + 1;
}

/**
 * The limits for this age, or null for an adult.
 *
 * ⚠️ AN AGE BELOW 12 CLAMPS TO THE 12 LIMITS RATHER THAN THROWING OR ANSWERING null. The form cannot
 * produce one (ageOpts starts at 12) and UKA's rules "do not cater for athletes younger than 12",
 * saying only that distances "should be scaled-down appropriately" -- so we have no basis for a real
 * answer and the most restrictive row we do have is the honest fallback. null here would mean ADULT,
 * which is the one answer that must never come back for a child.
 */
export function youthLimitsFor(age: number | null | undefined): YouthLimits | null {
  if (!isYouthAge(age)) return null;
  const a = Math.max(YOUTH_MIN_AGE, Math.min(YOUTH_MAX_AGE, Math.floor(age as number)));
  const km = RULE_MAX_KM[a]!;
  return { age: a, maxSessionKm: km, maxWeeklyKm: km * WEEKLY_MULTIPLE, maxRunDays: MAX_RUN_DAYS[a]! };
}

/**
 * Filter a caller's own list of goals down to the ones this age may be coached towards.
 *
 * ⚠️ IT TAKES THE OFFERED LIST RATHER THAN OWNING ONE, AND THE DISTANCES COME FROM RACE_DISTANCES_M.
 * A second list of goal keys here would drift from GOAL_BY_STATUS the first time either changed, and
 * a second table of metres would drift from units.ts -- so this module owns only the CEILING and the
 * intersection is computed. Adding a goal to the app needs no edit here, and it cannot slip past the
 * ceiling either.
 *
 * ⚠️ NEVER EMPTY FOR A REAL AGE: a 5k is 5 km and the lowest ceiling is 6 km, so the shortest goal
 * always survives. An empty result means the caller passed an empty list, which is its own bug --
 * a picker with nothing in it is the dead-end this repo refuses to ship.
 */
export function youthGoalsFrom(offered: readonly RaceDistanceKey[], age: number | null | undefined): RaceDistanceKey[] {
  const lim = youthLimitsFor(age);
  if (!lim) return offered.slice();
  return offered.filter((k) => RACE_DISTANCES_M[k] / METRES_PER_KM <= lim.maxSessionKm);
}

/** Fold a day-count answer from anywhere onto what this age may run. Adults pass through. */
export function clampYouthDays(age: number | null | undefined, days: number): number {
  const lim = youthLimitsFor(age);
  const n = Math.round(Number(days));
  if (!Number.isFinite(n)) return lim ? lim.maxRunDays : days;
  return lim ? Math.min(lim.maxRunDays, n) : n;
}
