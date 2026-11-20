// pc-days-raceblock — A RUNNING DAY ADDED IN A HABIT-BUILDER'S RACE BLOCK STARTS SHORT (the owner's yes to the
// recommendation in notes/plan-profile.md, "Days a week for a habit-builder once the road reaches the race block",
// 2026-11-20). The engine half: `Road.daysAdded` and `phaseInAddedDays` (src/plan/generate-plan.ts).
//   * a day added changes NO week before its Monday — the foundation included (it is aimed at the race block's first week,
//     which a day more reshapes: measured, the owner's Base week 6 moved 5.5 → 5.7 km);
//   * the new day starts as a 20-minute easy run (ADDED_DAY_OPEN_MIN), on the day the plan for the new days runs, and grows
//     ADDED_DAY_STEP_MIN a week, never longer than that week's shortest easy run — every other session exactly as it was;
//   * it joins in a week where it keeps the week within ADDED_DAY_RISE_MAX of the week before (Damsted et al., JOSPT 2019:
//     weekly jumps of 20–60% raised early injury), and makes no step bigger than the plan already makes by itself;
//   * once fully in (and always in race week), the weeks ARE the main track's own block for the new days, byte for byte;
//   * only a record the runner could have made counts: one day at a time, in date order, ending at their answer.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan, ADDED_DAY_OPEN_MIN, ADDED_DAY_STEP_MIN, ADDED_DAY_RISE_MAX } from "../src/plan/generate-plan.ts";
import { roadFor } from "../src/plan/road.ts";

const START = "2026-11-23";
const RUN = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific"]);
const EASY = new Set(["easy", "recovery", "strides"]);
const runMin = (w: PlannedWeek) => w.sessions.filter((s) => RUN.has(s.type)).reduce((m, s) => m + s.estimatedDurationSeconds / 60, 0);
const add = (iso: string, d: number) => { const t = new Date(iso + "T00:00:00Z"); t.setUTCDate(t.getUTCDate() + d); return t.toISOString().slice(0, 10); };
const newDayOf = (w: PlannedWeek) => w.sessions.find((s) => s.newDay);
const DM: Record<string, number> = { "5k": 5000, "10k": 10000, half: 21097.5, marathon: 42195 };

/** The owner's own answers (test/road-stages.test.ts): Building the habit, After an injury, 4 days, a half on 16 May 2027. */
function owner(): { athlete: Athlete; goal: Goal } {
  return {
    athlete: { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1250 }, experience: "beginner", includeStrength: true,
      returningFromInjury: true, returningFromBreak: false, runWalk: false, longRunDay: 6 } as Athlete,
    goal: { distance: "half", targetTimeSeconds: 5700, raceDateIso: "2027-05-16" } as Goal,
  };
}
/** A road plan for these days, with these days added (none: the plan as it always was). */
function build(athlete: Athlete, goal: Goal, days: number, daysAdded?: { fromIso: string; from: number; to: number }[]) {
  const prop = roadFor(athlete, goal, START)!;
  const road = { stages: prop.stages, rampWeeks: prop.rampWeeks, ...(daysAdded ? { daysAdded } : {}) };
  return generatePlan({ ...athlete, daysPerWeek: days }, goal, { startDateIso: START, road });
}
/** The checkpoint's Monday: the race block's SECOND week (the app's roadDayAddFrom). */
const secondRaceMonday = (p: { weeks: PlannedWeek[] }) => p.weeks[p.weeks.findIndex((w) => w.stage === "race") + 1]!.startDateIso;

test("BLOCKER: a day added in the race block changes no week before its Monday — the foundation included", () => {
  const { athlete, goal } = owner();
  const before = build(athlete, goal, 4);
  const fromIso = secondRaceMonday(before);
  const after = build(athlete, goal, 5, [{ fromIso, from: 4, to: 5 }]);
  const cut = after.weeks.findIndex((w) => w.startDateIso >= fromIso);
  assert.ok(cut > 9, "the fixture's day is not added in the race block's second week");
  for (let i = 0; i < cut; i++) assert.deepEqual(after.weeks[i], before.weeks[i], `week ${i + 1} (${before.weeks[i]!.stage}) changed`);
  // The counterfactual this exists for: built for five days with no record, a Base week already run moves.
  const naive = build(athlete, goal, 5);
  assert.ok(before.weeks.slice(0, cut).some((w, i) => JSON.stringify(w) !== JSON.stringify(naive.weeks[i])),
    "the fixture no longer shows the foundation moving with the days — it proves nothing");
});

test("BLOCKER: the new day starts as a 20-minute easy run, grows a little each week, and leaves every other session as it was", () => {
  const { athlete, goal } = owner();
  const before = build(athlete, goal, 4);
  const fromIso = secondRaceMonday(before);
  const after = build(athlete, goal, 5, [{ fromIso, from: 4, to: 5 }]);
  const full = build(athlete, goal, 5);
  const phase = after.weeks.map((w, i) => ({ w, i })).filter(({ w }) => newDayOf(w));
  assert.equal(phase[0]!.w.startDateIso, fromIso, "the owner's day does not start on the Monday he chose");
  assert.deepEqual(phase.map(({ w }) => Math.round(newDayOf(w)!.estimatedDurationSeconds / 60)), [20, 26, 27],
    "the owner's new day is no longer 20 → 25 → the lighter week's 27 minutes (built from a distance, 25 asks for 26)");
  assert.equal(ADDED_DAY_OPEN_MIN, 20);
  let last = 0;
  for (const { w, i } of phase) {
    const s = newDayOf(w)!;
    const m = s.estimatedDurationSeconds / 60;
    assert.equal(s.type, "easy");
    assert.match(s.description, /new running day/);
    // ⚠️ Every other session is the week the runner had, with the new day's rest gone and nothing else touched.
    const was = before.weeks[i]!.sessions.filter((x) => !(x.dayOfWeek === s.dayOfWeek && x.type === "rest"));
    assert.deepEqual(w.sessions.filter((x) => !x.newDay), was, `week ${i + 1}: a session other than the new day changed`);
    // On a day the plan for the new days runs, so nothing moves when it is fully in.
    assert.ok(full.weeks[i]!.sessions.some((x) => RUN.has(x.type) && x.dayOfWeek === s.dayOfWeek), `week ${i + 1}: the new day is not one the 5-day plan runs`);
    const shortest = Math.min(...was.filter((x) => EASY.has(x.type)).map((x) => x.estimatedDurationSeconds / 60));
    assert.ok(m <= shortest + 1, `week ${i + 1}: the new day (${m.toFixed(0)}′) is longer than the week's shortest easy run`);
    if (last) assert.ok(m <= last + ADDED_DAY_STEP_MIN + 1, `week ${i + 1}: the new day grew by ${(m - last).toFixed(1)} minutes`);
    last = m;
  }
});

test("BLOCKER: once the day is fully in, the weeks ARE the full plan for the new days — race week always", () => {
  const { athlete, goal } = owner();
  const before = build(athlete, goal, 4);
  const after = build(athlete, goal, 5, [{ fromIso: secondRaceMonday(before), from: 4, to: 5 }]);
  const full = build(athlete, goal, 5);
  const lastNew = after.weeks.map((w) => !!newDayOf(w)).lastIndexOf(true);
  assert.ok(lastNew > 0 && lastNew < after.weeks.length - 1);
  for (let i = lastNew + 1; i < after.weeks.length; i++) assert.deepEqual(after.weeks[i], full.weeks[i], `week ${i + 1} is not the 5-day plan`);
  // His: fully in from Race block 2's first week (22 Feb) — the race block's lighter week was the last with the short run.
  assert.equal(after.weeks[lastNew + 1]!.startDateIso, "2027-02-22");
});

test("BLOCKER: over 672 habit-builders' roads, the new day never makes a step the plan does not already make", () => {
  let roads = 0, joinOver = 0, ownMax = 0, phaseMax = 0, phaseOver = 0, plainOver = 0, steps = 0, longest = 0, unchanged = 0;
  let worstJoin = 0, worstOwn = 0, waited = 0, straightIn = 0;
  for (const dist of ["5k", "10k", "half", "marathon"]) for (const secs of [1200, 1500, 1800, 2100, 2400, 2700]) for (const from of [3, 4])
  for (const comeback of ["none", "injury", "break"]) for (const weeksOut of [20, 26, 32, 40]) for (const longRunDay of [6, 5]) {
    const goal = { distance: dist, targetTimeSeconds: Math.round(secs * Math.pow(DM[dist]! / 5000, 1.06)), raceDateIso: add(START, weeksOut * 7 - 1) } as Goal;
    const athlete = { daysPerWeek: from, recent: { distanceMeters: 5000, timeSeconds: secs }, experience: "beginner", includeStrength: true,
      returningFromInjury: comeback === "injury", returningFromBreak: comeback === "break", runWalk: false, longRunDay } as Athlete;
    const prop = roadFor(athlete, goal, START);
    if (!prop || prop.shortWeeks > 0) continue;
    const before = build(athlete, goal, from);
    const r0 = before.weeks.findIndex((w) => w.stage === "race");
    if (r0 < 1) continue;
    roads++;
    const fromIso = before.weeks[r0 + 1]!.startDateIso;
    const after = build(athlete, goal, from + 1, [{ fromIso, from, to: from + 1 }]);
    const cut = r0 + 1;
    if (after.weeks.slice(0, cut).every((w, i) => JSON.stringify(w) === JSON.stringify(before.weeks[i]))) unchanged++;
    const firstNew = after.weeks.findIndex((w) => newDayOf(w));
    // It joins on the Monday chosen, or — where the plan is already making a big step that week — the week after.
    if (firstNew >= 0 && after.weeks[firstNew]!.startDateIso > add(fromIso, 7)) waited++;
    if (firstNew < 0) straightIn++;
    if (firstNew >= 0) {
      // The day alone, in the week it joins: the week with it against the same week without it.
      const own = runMin(after.weeks[firstNew]!) / runMin(before.weeks[firstNew]!);
      worstOwn = Math.max(worstOwn, own);
      longest = Math.max(longest, after.weeks.map((w) => !!newDayOf(w)).lastIndexOf(true) - firstNew + 1);
    }
    // ⚠️ THE FIRST WEEK THAT CHANGES AT ALL — the short run joining, or the full plan where it already fits — against the
    // week before it (a lighter week before is the plan's own bounce, left to it). Measured on the short run alone this
    // guard escaped its re-break: without the wait, a runner whose full plan fits at once jumped straight to it (1.232).
    const firstDiff = after.weeks.findIndex((w, i) => i >= cut && JSON.stringify(w) !== JSON.stringify(before.weeks[i]));
    if (firstDiff > 0 && firstDiff < after.weeks.length - 1 && !after.weeks[firstDiff - 1]!.isDeload) {
      const join = runMin(after.weeks[firstDiff]!) / runMin(after.weeks[firstDiff - 1]!);
      worstJoin = Math.max(worstJoin, join);
      if (join > ADDED_DAY_RISE_MAX + 1e-9) joinOver++;
    }
    // Every step from the Monday chosen to race week, against the plan's own steps over the same weeks.
    for (let i = cut; i < after.weeks.length - 1; i++) {
      if (after.weeks[i - 1]!.isDeload || before.weeks[i - 1]!.isDeload) continue;
      steps++;
      const s = runMin(after.weeks[i]!) / runMin(after.weeks[i - 1]!);
      const p = runMin(before.weeks[i]!) / runMin(before.weeks[i - 1]!);
      phaseMax = Math.max(phaseMax, s); ownMax = Math.max(ownMax, p);
      if (s > ADDED_DAY_RISE_MAX) phaseOver++;
      if (p > ADDED_DAY_RISE_MAX) plainOver++;
    }
  }
  assert.ok(roads >= 600, `the sweep shrank to ${roads} roads`);
  assert.equal(unchanged, roads, `a week before the Monday chosen changed on ${roads - unchanged} roads`);
  assert.equal(joinOver, 0, `on ${joinOver} roads the week the day joined was over ${ADDED_DAY_RISE_MAX}× the week before (worst ${worstJoin.toFixed(3)})`);
  assert.ok(worstOwn <= ADDED_DAY_RISE_MAX, `the day alone added ${((worstOwn - 1) * 100).toFixed(0)}% to a week`);
  assert.ok(phaseMax <= ownMax + 1e-9, `a step of ${phaseMax.toFixed(3)} with the day, where the plan's own worst is ${ownMax.toFixed(3)}`);
  assert.ok(phaseOver <= plainOver, `${phaseOver} steps over ${ADDED_DAY_RISE_MAX} with the day against ${plainOver} in the plan alone`);
  assert.ok(longest <= 4, `the short run lasted ${longest} weeks before the full plan`);
  assert.equal(waited, 0, `on ${waited} roads the new day waited more than a week to join`);
  assert.ok(straightIn < roads / 10, `${straightIn} roads never had the short run at all`);
  // Measured 2026-11-20 (recorded in notes/plan-profile.md): 672 roads, 6,452 steps; the day alone at most 1.171; joining
  // at most 1.198; the worst step 1.304 with the day and without; 94 steps over 1.2 against the plan's own 186; the short
  // run lasts at most three weeks.
});

test("only a record the runner could have made counts — otherwise the plan is exactly the plan for their answer", () => {
  const { athlete, goal } = owner();
  const before = build(athlete, goal, 4);
  const fromIso = secondRaceMonday(before);
  const full5 = JSON.stringify(build(athlete, goal, 5).weeks);
  const same = (days: number, rec: { fromIso: string; from: number; to: number }[], want: string, why: string) =>
    assert.equal(JSON.stringify(build(athlete, goal, days, rec).weeks), want, why);
  // Back to four (the record ends at five): the plan for four, as if never added.
  same(4, [{ fromIso, from: 4, to: 5 }], JSON.stringify(before.weeks), "a record that no longer ends at the answer was used");
  // Two days in one record is not a day added.
  same(5, [{ fromIso, from: 3, to: 5 }], full5, "a jump of two days was phased in as one");
  // A broken chain, or two on one Monday.
  same(5, [{ fromIso, from: 3, to: 4 }, { fromIso: add(fromIso, 7), from: 3, to: 5 }], full5, "a broken chain was used");
  same(5, [{ fromIso, from: 3, to: 4 }, { fromIso, from: 4, to: 5 }], full5, "two days on one Monday were used");
  // A 12–17 runner's limits are their own review (YOUTH.md): never phased.
  const young = { ...athlete, age: 16 } as Athlete;
  assert.equal(JSON.stringify(generatePlan({ ...young, daysPerWeek: 5 }, goal, { startDateIso: START, road: { stages: roadFor(athlete, goal, START)!.stages,
    rampWeeks: roadFor(athlete, goal, START)!.rampWeeks, daysAdded: [{ fromIso, from: 4, to: 5 }] } }).weeks),
  JSON.stringify(generatePlan({ ...young, daysPerWeek: 5 }, goal, { startDateIso: START, road: { stages: roadFor(athlete, goal, START)!.stages,
    rampWeeks: roadFor(athlete, goal, START)!.rampWeeks } }).weeks), "a young runner's plan was phased");
});

test("BLOCKER: a day never joins in the race block's first week — its step from the foundation is the race block's own", () => {
  const { athlete, goal } = owner();
  const before = build(athlete, goal, 4);
  const r0 = before.weeks.findIndex((w) => w.stage === "race");
  const first = before.weeks[r0]!.startDateIso;
  const after = build(athlete, goal, 5, [{ fromIso: first, from: 4, to: 5 }]);
  assert.deepEqual(after.weeks[r0], before.weeks[r0], "the race block's first week changed");
  assert.ok(newDayOf(after.weeks[r0 + 1]!), "the day did not join in the second week");
});

test("two days added in turn each start short, and nothing before the first Monday moves", () => {
  // A three-day habit-builder adds a day at the checkpoint, and another later (the picker's door, one a week apart).
  const { goal } = owner();
  const athlete = { ...owner().athlete, daysPerWeek: 3 } as Athlete;
  const before = build(athlete, goal, 3);
  const a = secondRaceMonday(before);
  const after = build(athlete, goal, 5, [{ fromIso: a, from: 3, to: 4 }, { fromIso: add(a, 7), from: 4, to: 5 }]);
  const cut = after.weeks.findIndex((w) => w.startDateIso >= a);
  for (let i = 0; i < cut; i++) assert.deepEqual(after.weeks[i], before.weeks[i], `week ${i + 1} changed`);
  const days = new Set(after.weeks.flatMap((w) => w.sessions.filter((s) => s.newDay).map((s) => s.dayOfWeek)));
  assert.equal(days.size, 2, "the two days were not both phased in");
  for (const w of after.weeks) for (const s of w.sessions.filter((x) => x.newDay)) assert.ok(s.estimatedDurationSeconds / 60 <= 60);
  // Race week is the five-day plan's.
  assert.deepEqual(after.weeks[after.weeks.length - 1], build(athlete, goal, 5).weeks[after.weeks.length - 1]);
});
