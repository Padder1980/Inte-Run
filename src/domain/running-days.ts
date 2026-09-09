import type { Athlete } from "./types.ts";

/**
 * How many days a week the plan will actually schedule a run, and which answers a picker may
 * honestly offer.
 *
 * ⚠️ THIS EXISTED AS AN INLINE LITERAL IN FIVE PLACES AND THE UI COPIED NONE OF THEM, which is how
 * the app came to offer a beginner 5, 6 and 7 and then build 4 — and to say "Nothing about your plan
 * changes" when a runner moved from 4 days to 6, which was TRUE and unexplained (owner, 2026-09-09:
 * "ive just changed my training from 4 days per week to 6 and it is saying nothing changes? thats not
 * right"). Three of the five were the main-track clamp written out verbatim, and one of those three
 * drives a sentence the runner reads.
 *
 * ⚠️⚠️ THERE ARE TWO TABLES HERE AND THEY ARE NOT THE SAME TABLE. RUN_DAY_SLOTS is what the generator
 * honours as RUNS. CHOICE_MAX is the highest answer that produces a DIFFERENT PLAN, and for the
 * run-walk track those differ: buildBeginnerWeek schedules 3 runs at any answer from 3 up, but the
 * strength count (generate-plan.ts, "daysPerWeek >= 4") reads the RAW answer, so 4 buys a second
 * strength session where 3 does not. Measured: run-walk 3 gives 3 runs + 1 strength, 4 gives 3 runs +
 * 2 strength, and 5/6/7 are identical to 4. So clamping a stored 6 to 4 is plan-preserving while
 * clamping it to 3 is a plan CHANGE — a picker restricted to the slot count would silently take a
 * strength session off every run-walk runner who had answered 4 or more.
 *
 * ⚠️ AND NOTHING MAY CLAMP THE VALUE ON ITS WAY INTO THE ENGINE, for that same reason. Athlete
 * carries the runner's ANSWER; runningDaysFor says what the plan does with it. Five other reads of
 * the raw field are separate rules and must stay raw — the recovery-week gate, the beginner strength
 * count, two rotation seeds and the long-run dose gate. test/running-days.test.ts pins that.
 */
type Track = Pick<Athlete, "experience" | "runWalk">;

/** The lowest answer the form offers. The engine's own floors are lower — see RUN_DAY_FLOOR. */
export const RUN_DAY_MIN = 3;

/**
 * Slots, i.e. run days the generator will schedule.
 *
 * ⚠️ THE MAIN 7 AND THE BEGINNER 4 ARE SLOT-TABLE LENGTHS, NOT PREFERENCES: 7 is 1 long + 2 quality
 * + 4 easy, which buildWeek's own comment states as "exactly 1 + 2 + 4"; 4 is 1 long + 3 easy,
 * consumed by that builder's slice. The run-walk 3 is NOT a table length — the beginner easy table
 * supplies four slots and run-walk deliberately discards one. It is a coaching constant, stated in
 * Athlete.runWalk's own doc comment.
 */
const RUN_DAY_SLOTS = { main: 7, beginner: 4, runWalk: 3 };

/**
 * ⚠️ TWO DIFFERENT FLOORS, DELIBERATELY, AND A SHARED CLAMP WITH THE WRONG ONE IS A SILENT PLAN
 * CHANGE AT daysPerWeek === 2. The beginner floor of 2 has its own branch and its own comment in the
 * generator ("IT NEEDS TWO EASY SLOTS TO EXIST"), because two days reaches that builder with a single
 * easy slot and no quality session. The main floor of 3 guarantees the easy count leaves one easy run
 * standing. Neither floor is reachable from the form — the picker starts at 3 — so nothing in the UI
 * and no screen test would catch them being conflated.
 */
const RUN_DAY_FLOOR = { main: 3, beginner: 2 };

/** The highest answer the plan tells apart. NOT the slot count — see the header. */
const CHOICE_MAX = { main: 7, beginner: 4 };

const isBeginner = (t: Track) => t.experience === "beginner";

/** What the generator will schedule as runs for this answer. */
export function runningDaysFor(a: Pick<Athlete, "daysPerWeek" | "experience" | "runWalk">): number {
  const beg = isBeginner(a);
  const slots = beg ? (a.runWalk ? RUN_DAY_SLOTS.runWalk : RUN_DAY_SLOTS.beginner) : RUN_DAY_SLOTS.main;
  return Math.min(slots, Math.max(beg ? RUN_DAY_FLOOR.beginner : RUN_DAY_FLOOR.main, a.daysPerWeek));
}

/** Every answer a picker may offer this runner — ascending, never empty. */
export function runningDayChoices(t: Track): number[] {
  const max = isBeginner(t) ? CHOICE_MAX.beginner : CHOICE_MAX.main;
  const out: number[] = [];
  for (let d = RUN_DAY_MIN; d <= max; d++) out.push(d);
  return out;
}

/** Fold an answer from anywhere — a legacy store, a restored snapshot — onto the offered set. */
export function clampDayAnswer(t: Track, days: number): number {
  const c = runningDayChoices(t);
  const lo = c[0]!, hi = c[c.length - 1]!;
  const n = Math.round(Number(days));
  return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : lo;
}
