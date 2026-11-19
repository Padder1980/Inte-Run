// STAGES.md §10 PIECE 4 — GOALS WITHOUT A RACE: ROLLING BLOCKS (decision 4; the owner, 2026-11-19: "Yes, all your picks").
// The engine half. A road with no race is laid FORWARD from its first Monday, by the very builders a race road's
// foundation uses, and the app adds a block at a time (the block the runner is in plus the next). It climbs to the first
// week of a race block of the book's length for the runner's distance, then holds there. The one rule everything rests
// on: adding blocks at the end never changes a week already laid out.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, StageKind } from "../src/domain/types.ts";
import { generatePlan, mainFoundationNeed, type Road, type RoadStage } from "../src/plan/generate-plan.ts";
import { BLOCK_WEEKS, noRaceBlockWeeks, noRaceNextKind, REBUILD_WEEKS, roadNoRaceFor, WALKRUN_WEEKS } from "../src/plan/road.ts";
import { RACE_BLOCK_WEEKS } from "../src/plan/periodization.ts";

const M = "2026-11-23"; // a Monday
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

/** The runners a road places, on every track: run-walk, the habit-builder, and regular runners with and without a mileage. */
const RUNNERS: Array<{ who: string; athlete: Athlete; dist: Goal["distance"] }> = [
  { who: "just getting started, 5k", dist: "5k", athlete: { daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 2700 },
    experience: "beginner", runWalk: true, includeStrength: true, longRunDay: 6 } as Athlete },
  { who: "building the habit, 10k", dist: "10k", athlete: { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 2250 },
    experience: "beginner", runWalk: false, includeStrength: true, longRunDay: 6 } as Athlete },
  { who: "building the habit back from injury, 5k", dist: "5k", athlete: { daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 2250 },
    experience: "beginner", runWalk: false, includeStrength: true, longRunDay: 5, returningFromInjury: true } as Athlete },
  { who: "regular back from injury at 18 km, 10k", dist: "10k", athlete: { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational", includeStrength: true, longRunDay: 6, weeklyVolumeKmCurrent: 18, returningFromInjury: true } as Athlete },
  { who: "regular at 15 km, half", dist: "half", athlete: { daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: 1680 },
    experience: "recreational", includeStrength: true, longRunDay: 6, weeklyVolumeKmCurrent: 15 } as Athlete },
  { who: "regular at 30 km, 10k", dist: "10k", athlete: { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational", includeStrength: true, longRunDay: 6, weeklyVolumeKmCurrent: 30 } as Athlete },
  { who: "regular, no mileage given, half", dist: "half", athlete: { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational", includeStrength: true, longRunDay: 6 } as Athlete },
  { who: "competitive at 55 km, marathon", dist: "marathon", athlete: { daysPerWeek: 6, recent: { distanceMeters: 5000, timeSeconds: 1200 },
    experience: "competitive", includeStrength: false, longRunDay: 5, weeklyVolumeKmCurrent: 55 } as Athlete },
];

const goalFor = (dist: Goal["distance"], horizonIso: string): Goal =>
  ({ distance: dist, targetTimeSeconds: 3000, raceDateIso: horizonIso, startDateIso: M } as Goal);

/** The stages a road reaches after `weeks` weeks of blocks, each the block after the last (the app's own extension). */
function stagesTo(first: RoadStage[], weeks: number): RoadStage[] {
  const st = first.map((s) => ({ ...s }));
  while (st.reduce((n, s) => n + s.weeks, 0) < weeks) {
    const k = noRaceNextKind(st[st.length - 1]!.kind);
    st.push({ kind: k, weeks: noRaceBlockWeeks(k) });
  }
  return st;
}
const totalOf = (st: RoadStage[]) => st.reduce((n, s) => n + s.weeks, 0);
/** The Sunday of the last week the stages lay out — the horizon the app passes as goal.raceDateIso. */
const horizonOf = (st: RoadStage[]) => add(M, totalOf(st) * 7 - 1);
function plan(athlete: Athlete, dist: Goal["distance"], road: Road, horizonIso = horizonOf(road.stages), startIso = M) {
  return generatePlan(athlete, { ...goalFor(dist, horizonIso), startDateIso: startIso }, { road });
}
const longMin = (w: { sessions: Array<{ type: string; estimatedDurationSeconds: number }> }) =>
  Math.round(Math.max(0, ...w.sessions.filter((s) => s.type === "long").map((s) => s.estimatedDurationSeconds / 60)));

test("BLOCKER: a road with no race is laid forward from its first Monday, and holds no race and no taper", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    assert.ok(prop, `${who}: no road with no race`);
    const stages = stagesTo(prop.stages, 24);
    const p = plan(athlete, dist, { noRace: true, fromIso: M, stages, rampWeeks: prop.rampWeeks });
    assert.equal(p.weeks.length, totalOf(stages), `${who}: ${p.weeks.length} weeks laid out for ${totalOf(stages)}`);
    assert.equal(p.totalWeeks, p.weeks.length, `${who}: totalWeeks`);
    // One stage kind per calendar week, in road order, from the road's first Monday.
    const kinds = stages.flatMap((s) => Array(s.weeks).fill(s.kind) as StageKind[]);
    p.weeks.forEach((w, i) => {
      assert.equal(w.startDateIso, add(M, i * 7), `${who}: week ${i + 1} starts ${w.startDateIso}`);
      assert.equal(w.stage, kinds[i], `${who}: week ${i + 1} is ${w.stage}, the road says ${kinds[i]}`);
      assert.equal(w.index, i + 1);
      assert.notEqual(w.phase, "taper", `${who}: week ${i + 1} is a taper week`);
      for (const s of w.sessions) assert.notEqual(s.type, "race", `${who}: week ${i + 1} holds a race`);
    });
    assert.ok(p.notes[0]!.startsWith("Your road so far:"), `${who}: ${p.notes[0]}`);
    assert.ok(!p.notes.some((n) => /race day|taper/i.test(n)), `${who}: a note talks about a race: ${p.notes.join(" | ")}`);
  }
});

test("BLOCKER: adding blocks at the end never changes a week already laid out", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    const base: Road = { noRace: true, fromIso: M, stages: prop.stages, rampWeeks: prop.rampWeeks };
    const short = plan(athlete, dist, base);
    let prev = short;
    for (const reach of [12, 20, 36, 52]) {
      const longer = plan(athlete, dist, { ...base, stages: stagesTo(prop.stages, reach) });
      assert.ok(longer.weeks.length >= prev.weeks.length);
      prev.weeks.forEach((w, i) => assert.deepEqual(longer.weeks[i], w,
        `${who}: week ${i + 1} changed when the road reached ${reach} weeks`));
      prev = longer;
    }
  }
});

test("BLOCKER: the horizon is only where the weeks end — the plan never reads it", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    const road: Road = { noRace: true, fromIso: M, stages: stagesTo(prop.stages, 16), rampWeeks: prop.rampWeeks };
    const a = plan(athlete, dist, road, add(M, 16 * 7 - 1));
    const b = plan(athlete, dist, road, add(M, 400));
    assert.deepEqual(b.weeks, a.weeks, `${who}: the weeks moved with the horizon`);
    assert.deepEqual(b.paces, a.paces, `${who}: the paces moved with the horizon`);
  }
});

/**
 * Where the climb is going — the first week of a race block of the book's length for the distance, on the track the runner
 * reaches (a beginner on the main track there), laid from the road's first Monday: the engine's own destination, measured
 * here from the engine's own race plan rather than restated.
 */
function destinationLongMin(athlete: Athlete, dist: Goal["distance"]): number {
  const beginner = athlete.experience === "beginner" || !!athlete.runWalk;
  const track = beginner ? ({ ...athlete, experience: "recreational", runWalk: false } as Athlete) : athlete;
  const book = RACE_BLOCK_WEEKS[dist];
  const ref = generatePlan(track, { distance: dist, targetTimeSeconds: 3000, raceDateIso: add(M, (book - 1) * 7 + 6), startDateIso: M } as Goal,
    { startDateIso: M });
  const w1 = beginner ? ref.weeks[0]! : ref.weeks.find((w) => !w.isDeload && !w.sessions.some((s) => s.type === "race")) ?? ref.weeks[0]!;
  return longMin(w1);
}

test("climb, then hold: the long run reaches race-ready over the road's own climb and stays there", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    const p = plan(athlete, dist, { noRace: true, fromIso: M, stages: stagesTo(prop.stages, 56), rampWeeks: prop.rampWeeks });
    const running = p.weeks.filter((w) => w.stage !== "walkrun1" && w.stage !== "walkrun2");
    const peak = Math.max(...running.map(longMin));
    // ⚠️ THE LEVEL IT HOLDS AT IS RACE-READY — a race block's first week for the distance (the independent review: without
    // this, a plan that never climbed, holding at its opening week, passed). Within a few minutes: the rung is rounded.
    const dest = destinationLongMin(athlete, dist);
    assert.ok(Math.abs(peak - dest) <= 3, `${who}: it holds at a ${peak}-minute long run, race-ready is ${dest}`);
    // And a runner below race-ready climbs to it: the beginner track opens at its own opening (30 minutes at most), and a
    // runner stating little opens at what they run — well under the hold. (A Rebuild for somebody already there is four
    // weeks of easy running at the level they run, with nothing to climb.)
    const first = running.find((w) => !w.isDeload)!;
    // "Below" is the engine's own measure: the beginner track always climbs; a main-track runner climbs where the race block's
    // first week is more than one step above what they run (mainFoundationNeed > 0).
    const book = RACE_BLOCK_WEEKS[dist];
    const refGoal = { distance: dist, targetTimeSeconds: 3000, raceDateIso: add(M, (book - 1) * 7 + 6), startDateIso: M } as Goal;
    const below = athlete.experience === "beginner" || !!athlete.runWalk || mainFoundationNeed(athlete, refGoal, {}, book) > 0;
    if (below) assert.ok(longMin(first) <= peak - 5, `${who}: it opens at ${longMin(first)} minutes and holds at ${peak} — no climb`);
    // Two weeks of slack past the climb: a lighter week can sit where the climb ends.
    const held = p.weeks.slice(prop.climbWeeks + 2).filter((w) => !w.isDeload);
    assert.ok(held.length >= 20, `${who}: only ${held.length} weeks past the climb`);
    for (const w of held) assert.ok(Math.abs(longMin(w) - peak) <= 1,
      `${who}: week ${w.index}'s long run is ${longMin(w)} min, the hold is ${peak} (climb ${prop.climbWeeks} weeks)`);
    // The week's running holds too: the second half of the hold is the first half's size, give or take a few per cent.
    const km = (ws: typeof held) => ws.reduce((n, w) => n + w.plannedDistanceMeters, 0) / ws.length / 1000;
    const half = Math.floor(held.length / 2);
    const early = km(held.slice(0, half)), late = km(held.slice(half));
    assert.ok(Math.abs(late - early) / early <= 0.05, `${who}: the hold drifts from ${early.toFixed(1)} to ${late.toFixed(1)} km a week`);
  }
});

test("each stage keeps its own job: Rebuild has no fast running, Base brings it back, walk-run weeks are run–walk", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    const p = plan(athlete, dist, { noRace: true, fromIso: M, stages: stagesTo(prop.stages, 24), rampWeeks: prop.rampWeeks });
    for (const w of p.weeks) {
      if (w.stage === "rebuild") assert.equal(w.qualitySessionCount, 0, `${who}: a Rebuild week (${w.index}) has a hard session`);
      if (w.stage === "walkrun1" || w.stage === "walkrun2") assert.ok(!w.sessions.some((s) => s.type === "long"), `${who}: a walk-run week has a long run`);
    }
    assert.ok(p.weeks.some((w) => w.stage === "base" && w.qualitySessionCount > 0), `${who}: no Base week brings quality back`);
  }
});

test("weeks of the road before the plan's first week are counted, not laid out — and never made harder", () => {
  for (const { who, athlete, dist } of RUNNERS) {
    const prop = roadNoRaceFor(athlete, goalFor(dist, add(M, 400)), M)!;
    const road: Road = { noRace: true, fromIso: M, stages: stagesTo(prop.stages, 20), rampWeeks: prop.rampWeeks };
    const whole = plan(athlete, dist, road);
    const later = plan(athlete, dist, road, horizonOf(road.stages), add(M, 14));
    assert.equal(later.weeks.length, whole.weeks.length - 2, `${who}`);
    later.weeks.forEach((w, i) => {
      const y = whole.weeks[i + 2]!;
      // The road's own calendar: the same dates, stage and lighter weeks as the whole road two weeks in.
      assert.equal(w.startDateIso, y.startDateIso, `${who}: week ${i + 3}`);
      assert.equal(w.stage, y.stage, `${who}: week ${i + 3}`);
      assert.equal(w.isDeload, y.isDeload, `${who}: week ${i + 3}`);
      // The ramp opens again from the plan's first week (those two weeks were not run): never a longer long run.
      assert.ok(longMin(w) <= longMin(y) + 1, `${who}: week ${i + 3} is ${longMin(w)} min where the whole road has ${longMin(y)}`);
    });
    // And a road that starts later is itself stable as it grows.
    const later2 = plan(athlete, dist, { ...road, stages: stagesTo(prop.stages, 36) }, horizonOf(stagesTo(prop.stages, 36)), add(M, 14));
    later.weeks.forEach((w, i) => assert.deepEqual(later2.weeks[i], w, `${who}: week ${i + 3} changed as the road grew`));
  }
});

test("a road with no race is placed as a race road is: walk-run, Rebuild or Base — the block it starts in, and the next", () => {
  const goal = (d: Goal["distance"]) => goalFor(d, add(M, 400));
  const [walk, habit, habitInj, regInj, , reg] = RUNNERS;
  assert.deepEqual(roadNoRaceFor(walk!.athlete, goal("5k"), M)!.stages,
    [{ kind: "walkrun1", weeks: WALKRUN_WEEKS.walkrun1 }, { kind: "walkrun2", weeks: WALKRUN_WEEKS.walkrun2 }]);
  for (const r of [habit!, habitInj!, regInj!]) assert.deepEqual(roadNoRaceFor(r.athlete, goal(r.dist), M)!.stages,
    [{ kind: "rebuild", weeks: REBUILD_WEEKS }, { kind: "base", weeks: BLOCK_WEEKS }], r.who);
  assert.deepEqual(roadNoRaceFor(reg!.athlete, goal("10k"), M)!.stages, [{ kind: "base", weeks: BLOCK_WEEKS }, { kind: "base", weeks: BLOCK_WEEKS }]);
  // The block after a block: walk-run 1 → walk-run 2 → Rebuild → Base → Base…, at their standard lengths.
  assert.deepEqual(["walkrun1", "walkrun2", "rebuild", "base"].map((k) => noRaceNextKind(k as StageKind)), ["walkrun2", "rebuild", "base", "base"]);
  assert.deepEqual(["walkrun1", "walkrun2", "rebuild", "base"].map((k) => noRaceBlockWeeks(k as StageKind)), [5, 4, 4, 4]);
  // The climb is the road's own need: a habit-builder climbs (never under Rebuild + the shortest Base); a regular runner
  // already at their race block's opening week climbs nothing; the walk-run blocks come first.
  assert.ok(roadNoRaceFor(habit!.athlete, goal("10k"), M)!.rampWeeks >= 8);
  assert.equal(roadNoRaceFor(reg!.athlete, goal("10k"), M)!.rampWeeks, 0);
  const w = roadNoRaceFor(walk!.athlete, goal("5k"), M)!;
  assert.equal(w.climbWeeks, WALKRUN_WEEKS.walkrun1 + WALKRUN_WEEKS.walkrun2 + w.rampWeeks);
});

test("BLOCKER: never a plan with no weeks — a road that ends before the plan starts is refused", () => {
  // The independent review: a start moved on past the road's end came back as an empty plan, which the app adopted and then
  // could not draw. The app lays the road out past the start; the engine refuses the case rather than return nothing.
  const { athlete, dist } = RUNNERS[5]!;
  const road: Road = { noRace: true, fromIso: M, stages: [{ kind: "base", weeks: 4 }, { kind: "base", weeks: 4 }], rampWeeks: 0 };
  assert.throws(() => plan(athlete, dist, road, add(M, 8 * 7 - 1), add(M, 8 * 7)), /laid out no week/);
  assert.equal(plan(athlete, dist, road, add(M, 8 * 7 - 1), add(M, 7 * 7)).weeks.length, 1, "the road's last week is still laid out");
});

test("BLOCKER: never for a 12–17 runner — no road, and the engine refuses one", () => {
  for (const age of [12, 14, 15, 17]) {
    const a = { ...RUNNERS[1]!.athlete, age } as Athlete;
    assert.equal(roadNoRaceFor(a, goalFor("5k", add(M, 400)), M), null, `age ${age}`);
    assert.throws(() => plan(a, "5k", { noRace: true, fromIso: M, stages: [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 4 }], rampWeeks: 8 }),
      /for adults/, `age ${age}: the engine built a plan with no race`);
  }
  assert.ok(roadNoRaceFor({ ...RUNNERS[1]!.athlete, age: 18 } as Athlete, goalFor("5k", add(M, 400)), M), "18 is an adult");
});
