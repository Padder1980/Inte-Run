// STAGES.md §10 — BLOCKS FOR EVERY LONG-TERM GOAL (approved by the owner 2026-11-18: "yes to all five, build it").
// Piece 1, the engine half: decision 1 (a block is 4 weeks as standard, 6 at most before a checkpoint) and decision 5
// (the end-of-block test chosen by level — no maximal test for "Just getting started" or anyone back from injury, and
// a parkrun or 5 km offered only once the longest run in the last 30 days is about 4.5 km).
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal } from "../src/domain/types.ts";
import { generatePlan, type RoadStage } from "../src/plan/generate-plan.ts";
import { BLOCK_MAX_WEEKS, BLOCK_WEEKS, blockSplit, roadFor } from "../src/plan/road.ts";
import {
  type BlockTest, type CheckpointFacts, type RunnerLevel, blockTestsFor, evaluateCheckpoint, maximalTestAllowed,
  PARKRUN_MIN_LONGEST_KM,
} from "../src/plan/checkpoint.ts";

const START = "2026-11-23";
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};

test("BLOCKER: a block is four weeks as standard and never more than six before a checkpoint", () => {
  assert.equal(BLOCK_WEEKS, 4);
  assert.equal(BLOCK_MAX_WEEKS, 6);
  for (let n = 1; n <= 60; n++) {
    const b = blockSplit(n);
    assert.equal(b.reduce((a, x) => a + x, 0), n, `${n} weeks split into ${b} loses weeks`);
    assert.ok(b.every((x) => x >= 1 && x <= BLOCK_MAX_WEEKS), `${n} weeks: a block of ${Math.max(...b)} runs past six`);
    // Four as standard: a whole number of four-week blocks is exactly that; otherwise only the one block that cannot be
    // four to six (seven weeks: 4 + 3) falls under four.
    if (n % BLOCK_WEEKS === 0) assert.deepEqual(b, Array(n / BLOCK_WEEKS).fill(BLOCK_WEEKS), `${n} weeks: ${b}`);
    if (n >= BLOCK_WEEKS && n !== 7) assert.ok(b.every((x) => x >= BLOCK_WEEKS), `${n} weeks: ${b} has a block under four`);
    // Six weeks or fewer is one block; the fewest blocks that keep every one inside six.
    if (n <= BLOCK_MAX_WEEKS) assert.equal(b.length, 1);
  }
  assert.deepEqual(blockSplit(7), [4, 3]);
  assert.deepEqual(blockSplit(0), []);
});

/** The runners roadFor places today, across the runways it lays roads over. */
function* roads() {
  const TT: Record<string, number> = { "5k": 1500, "10k": 3200, half: 7000 };
  for (const dist of ["5k", "10k", "half"]) for (const secs of [1200, 1800, 2700]) for (const days of [3, 4])
    for (const ret of [0, 1]) for (const wk of [14, 20, 26, 32, 40, 52]) {
      const athlete = { daysPerWeek: days, recent: { distanceMeters: 5000, timeSeconds: secs }, experience: "beginner",
        includeStrength: true, returningFromInjury: ret === 1, returningFromBreak: false, runWalk: false, longRunDay: 6 } as Athlete;
      const goal = { distance: dist, targetTimeSeconds: TT[dist]!, raceDateIso: add(START, wk * 7 - 1) } as Goal;
      const prop = roadFor(athlete, goal, START);
      if (prop) yield { who: `${dist} ${secs}s ${days}d ret${ret} ${wk}w`, athlete, goal, prop };
    }
}

test("BLOCKER: every road roadFor lays out has a checkpoint at least every six weeks before the race block", () => {
  let n = 0, split = 0;
  for (const { who, prop } of roads()) {
    n++;
    for (const s of prop.stages.slice(0, -1))
      assert.ok(s.weeks <= BLOCK_MAX_WEEKS, `${who}: a ${s.kind} stage of ${s.weeks} weeks with no checkpoint inside it`);
    if (prop.stages.filter((s) => s.kind === "base").length > 1) split++;
  }
  assert.ok(n > 150, `only ${n} roads`);
  // A sweep where no Base was long enough to split tested nothing: measured, the far races split.
  assert.ok(split > 20, `only ${split} roads had Base in more than one block`);
});

test("BLOCKER: blocks change where the checkpoints fall, not one session of the plan", () => {
  // Consecutive blocks of one kind are one stretch to the engine (its Base dose counts Base weeks so far, its lighter
  // week is every fourth week of the road), so a road cut into blocks builds exactly the plan the uncut one built.
  let compared = 0;
  for (const { who, athlete, goal, prop } of roads()) {
    if (prop.stages.filter((s) => s.kind === "base").length < 2) continue;
    const merged: RoadStage[] = [];
    for (const s of prop.stages) {
      const last = merged[merged.length - 1];
      if (last && last.kind === s.kind) last.weeks += s.weeks; else merged.push({ ...s });
    }
    const a = generatePlan(athlete, goal, { startDateIso: START, road: { stages: prop.stages, rampWeeks: prop.rampWeeks } });
    const b = generatePlan(athlete, goal, { startDateIso: START, road: { stages: merged, rampWeeks: prop.rampWeeks } });
    assert.deepEqual(a.weeks, b.weeks, `${who}: cutting Base into blocks changed the plan`);
    compared++;
  }
  assert.ok(compared > 20, `only ${compared} split roads compared`);
});

const LEVELS: RunnerLevel[] = ["new", "building", "regular", "competitive"];

test("BLOCKER: no maximal test for 'Just getting started' or for anyone back from injury", () => {
  for (const level of LEVELS) for (const injured of [false, true]) for (const longest of [null, 2, 4.4, 4.5, 12]) {
    const offer = blockTestsFor({ level, injured, longestKm30d: longest });
    const who = `${level}${injured ? " back from injury" : ""}, longest ${longest} km`;
    assert.ok(offer.length >= 1, `${who}: no test at all`);
    const maximal = offer.includes("trial-2k") || offer.includes("parkrun");
    if (level === "new" || injured) {
      assert.ok(!maximal, `${who} is offered ${offer.join(", ")} — a timed all-out effort`);
      assert.equal(maximalTestAllowed({ level, injured }), false);
    }
    // The rule the offer is built on agrees with the offer, both ways.
    if (maximal) assert.equal(maximalTestAllowed({ level, injured }), true, `${who}`);
  }
  // §10's table, row by row.
  assert.deepEqual(blockTestsFor({ level: "new", injured: false, longestKm30d: 6 }), ["time-on-feet"]);
  assert.deepEqual(blockTestsFor({ level: "new", injured: true, longestKm30d: 6 }), ["time-on-feet"]);
  assert.deepEqual(blockTestsFor({ level: "building", injured: true, longestKm30d: 8 }), ["controlled-2k", "time-on-feet"]);
  assert.deepEqual(blockTestsFor({ level: "regular", injured: true, longestKm30d: 15 }), ["controlled-2k", "time-on-feet"]);
  assert.deepEqual(blockTestsFor({ level: "building", injured: false, longestKm30d: 6 }), ["controlled-2k", "parkrun"]);
  assert.deepEqual(blockTestsFor({ level: "competitive", injured: false, longestKm30d: 15 }), ["parkrun", "trial-2k"]);
});

test("BLOCKER: a parkrun or 5 km is offered only once the longest run in the last 30 days is about 4.5 km", () => {
  assert.equal(PARKRUN_MIN_LONGEST_KM, 4.5);
  for (const level of LEVELS) for (const injured of [false, true]) {
    for (const longest of [null, undefined, 0, 3, 4.49]) {
      assert.ok(!blockTestsFor({ level, injured, longestKm30d: longest }).includes("parkrun"),
        `${level}${injured ? " (injured)" : ""} offered a parkrun with a longest run of ${longest} km`);
    }
  }
  assert.ok(blockTestsFor({ level: "building", injured: false, longestKm30d: 4.5 }).includes("parkrun"));
  assert.ok(blockTestsFor({ level: "regular", injured: false, longestKm30d: 4.5 }).includes("parkrun"));
  // Short of it the regular runner still has a test: the 2 km trial.
  assert.deepEqual(blockTestsFor({ level: "regular", injured: false, longestKm30d: 4 }), ["trial-2k"]);
});

const base = (keyRun: CheckpointFacts["keyRun"]): CheckpointFacts => ({ stage: "base", planned: 6, done: 6, painRuns: 0, keyRun });

test("BLOCKER: back from injury, the key run is a strong-but-controlled 2 km or time on feet — never the 2 km trial", () => {
  const offer = blockTestsFor({ level: "building", injured: true, longestKm30d: 7 });
  const tof = (best: number | null) => ({ needMin: 46, bestMin: best, bestIso: best ? "Sun 17 Jan" : null });
  // Time on feet passes it with no timed effort at all.
  const v = evaluateCheckpoint(base({ kind: "test", doneIso: null, offer, timeOnFeet: tof(47) }));
  assert.equal(v.verdict, "ready");
  assert.match(v.reasons[2]!, /47-minute run on Sun 17 Jan felt easy/);
  // A strong-but-controlled 2 km passes it too.
  assert.equal(evaluateCheckpoint(base({ kind: "test", doneIso: "Sat 16 Jan", label: "2 km in 9:40", offer, timeOnFeet: tof(30) })).verdict, "ready");
  // Neither: nearly — and the words offer only what this runner is offered.
  const n = evaluateCheckpoint(base({ kind: "test", doneIso: null, offer, timeOnFeet: tof(40) }));
  assert.equal(n.verdict, "nearly");
  assert.match(n.reasons[2]!, /a strong-but-controlled 2 km or a 46-minute run without stopping that feels easy/);
  assert.doesNotMatch(n.reasons.join(" "), /time trial|2 km test run|parkrun|all-out|as fast as/i);
});

test("the words name the parkrun only when it is offered, and a habit-builder's 2 km is the controlled one", () => {
  const without = evaluateCheckpoint(base({ kind: "test", doneIso: null, offer: blockTestsFor({ level: "building", injured: false, longestKm30d: 3 }) }));
  assert.match(without.reasons[2]!, /No test run yet — a strong-but-controlled 2 km ends this block/);
  assert.doesNotMatch(without.reasons[2]!, /parkrun/);
  const withIt = evaluateCheckpoint(base({ kind: "test", doneIso: null, offer: blockTestsFor({ level: "building", injured: false, longestKm30d: 5 }) }));
  assert.match(withIt.reasons[2]!, /a strong-but-controlled 2 km or a parkrun or 5 km/);
  // A test logged in the block is named with what it was.
  const done = evaluateCheckpoint(base({ kind: "test", doneIso: "Sat 16 Jan", label: "5.0 km in 27:10", offer: ["controlled-2k", "parkrun"] as BlockTest[] }));
  assert.equal(done.verdict, "ready");
  assert.match(done.reasons[2]!, /test run on Sat 16 Jan \(5\.0 km in 27:10\)/);
});

test("BLOCKER: the weekly review never offers the all-out 2 km to somebody just starting or back from injury", async () => {
  const { retestDue } = await import("../src/adapt/weekly-review.ts");
  const runs = [{ distKm: 5 }, { distKm: 6 }] as never;
  const due = { runs, lastTrialIso: null, todayIso: "2026-12-01" };
  assert.equal(retestDue(due), true, "the offer itself still stands for everybody else");
  for (const level of LEVELS) for (const injured of [false, true]) {
    const off = !maximalTestAllowed({ level, injured });
    assert.equal(retestDue({ ...due, noMaximalTest: off }), !off, `${level}${injured ? " back from injury" : ""}`);
  }
});
