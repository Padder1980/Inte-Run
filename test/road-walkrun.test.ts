// STAGES.md §10, PIECE 2 — decision 2 (owner, 2026-11-18: "yes to all five, build it"): "Just getting started" gets two
// walk-run blocks before Rebuild — Walk-run 1 to 20 minutes without stopping (about 5 weeks), Walk-run 2 to 30 (about 4),
// each ending in its key run at a chatting pace, as NHS Couch to 5K paces it. These guard the engine half.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";
import { generatePlan, type RoadStage, WALKRUN_LEVELS } from "../src/plan/generate-plan.ts";
import { roadFor, roadStartFor, WALKRUN_KEY_MIN, WALKRUN_WEEKS } from "../src/plan/road.ts";
import { evaluateCheckpoint } from "../src/plan/checkpoint.ts";

const START = "2026-11-23";
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
/** A runner just getting started ("New to running" → the run-walk track): no time of their own, the app's seeded 5 km. */
function newbie(o: Partial<Athlete> = {}): Athlete {
  return { daysPerWeek: 3, recent: { distanceMeters: 5000, timeSeconds: 2400 }, experience: "beginner", runWalk: true,
    includeStrength: true, returningFromInjury: false, returningFromBreak: false, longRunDay: 6, ...o } as Athlete;
}
const goal = (dist: Goal["distance"], weeks: number): Goal =>
  ({ distance: dist, targetTimeSeconds: dist === "5k" ? 2100 : dist === "10k" ? 4200 : 9000, raceDateIso: add(START, weeks * 7 - 1) } as Goal);
const runs = (w: PlannedWeek): Session[] => w.sessions.filter((s) => (s.steps ?? []).some((st) => st.kind === "rep"));
/** The longest stretch of running without a walk in a session, in minutes. */
const longestBlock = (s: Session) => Math.max(0, ...(s.steps ?? []).filter((st) => st.kind === "rep").map((st) => (st.durationSeconds ?? 0) / 60));
const runMin = (s: Session) => (s.steps ?? []).filter((st) => st.kind === "rep").reduce((m, st) => m + (st.durationSeconds ?? 0) / 60, 0);
function plan(a: Athlete, g: Goal, stages: RoadStage[], rampWeeks?: number) {
  return generatePlan(a, g, { startDateIso: START, road: { stages, ...(rampWeeks ? { rampWeeks } : {}) } });
}
/** Two weeks are the same walk-run week when their RUNS match (ids carry the date; the strength session rotates by week,
 *  as on every track, and is not the level). */
const shape = (w: PlannedWeek) => JSON.stringify(runs(w).map(({ id: _i, ...s }) => s)) + w.focus;

test("BLOCKER: a runner just getting started starts at Walk-run 1, with two walk-run blocks before Rebuild", () => {
  assert.equal(roadStartFor(newbie()), "walkrun1");
  assert.equal(roadStartFor(newbie({ age: 15 })), null, "a 12-17 runner is still not placed (their own review)");
  assert.deepEqual(WALKRUN_WEEKS, { walkrun1: 5, walkrun2: 4 }, "§10: about 5 weeks to 20 minutes, then about 4 to 30");
  const prop = roadFor(newbie(), goal("5k", 40), START)!;
  assert.deepEqual(prop.stages.slice(0, 3).map((s) => s.kind + s.weeks), ["walkrun15", "walkrun24", "rebuild4"]);
  assert.equal(prop.stages[prop.stages.length - 1]!.kind, "race");
  assert.equal(prop.startStage, "walkrun1");
  assert.equal(prop.shortWeeks, 0);
  const p = plan(newbie(), goal("5k", 40), prop.stages, prop.rampWeeks);
  assert.equal(p.weeks.length, 40, "every week to race day is planned");
  assert.deepEqual(p.weeks.slice(0, 10).map((w) => w.stage), [...Array(5).fill("walkrun1"), ...Array(4).fill("walkrun2"), "rebuild"]);
  assert.deepEqual(p.weeks.map((w) => w.index), p.weeks.map((_, i) => i + 1), "weeks are numbered in road order");
  assert.match(p.notes[0]!, /^Your road to race day: 5 weeks Walk-run 1 → 4 weeks Walk-run 2 → 4 weeks Rebuild/);
});

test("BLOCKER: each walk-run block ends in its key run — 20 minutes without stopping, then 30 — and none comes sooner", () => {
  assert.deepEqual(WALKRUN_KEY_MIN, { walkrun1: 20, walkrun2: 30 });
  for (const days of [2, 3]) for (const dist of ["5k", "10k", "half"] as const) {
    const prop = roadFor(newbie({ daysPerWeek: days }), goal(dist, 44), START)!;
    const p = plan(newbie({ daysPerWeek: days }), goal(dist, 44), prop.stages, prop.rampWeeks);
    const wr = p.weeks.filter((w) => w.stage === "walkrun1" || w.stage === "walkrun2");
    const keys = wr.map((w) => w.sessions.find((s) => s.keyRun));
    assert.deepEqual(keys.map((k) => k?.keyRun?.minutes ?? 0), [0, 0, 0, 0, 20, 0, 0, 0, 30], `${dist} ${days}d`);
    // The key run IS that long without stopping: one block of running.
    for (const k of keys.filter(Boolean)) {
      const reps = (k!.steps ?? []).filter((st) => st.kind === "rep");
      assert.equal(reps.length, 1, `${k!.title} has walk breaks`);
      assert.equal(reps[0]!.durationSeconds, k!.keyRun!.minutes * 60);
    }
    // Nobody is asked for 20 minutes without stopping before Walk-run 1's key run.
    for (const w of wr.slice(0, 4)) for (const s of runs(w))
      assert.ok(longestBlock(s) < 20, `week ${w.index}: ${s.title} asks for ${longestBlock(s)} minutes without stopping`);
    // And no other session anywhere in the road is a key run.
    assert.equal(p.weeks.flatMap((w) => w.sessions).filter((s) => s.keyRun).length, 2);
  }
});

test("BLOCKER: walk-run is easy running and walking only — and it builds week on week", () => {
  const prop = roadFor(newbie(), goal("5k", 40), START)!;
  const p = plan(newbie(), goal("5k", 40), prop.stages, prop.rampWeeks);
  const wr = p.weeks.filter((w) => w.stage === "walkrun1" || w.stage === "walkrun2");
  let prev = 0;
  for (const w of wr) {
    assert.equal(w.qualitySessionCount, 0);
    assert.equal(w.isDeload, false, "a walk-run week is never a lighter week: the walks are the recovery");
    for (const s of runs(w)) for (const st of (s.steps ?? []).filter((x) => x.kind === "rep"))
      assert.ok((st.targetRpe?.max ?? 0) <= 4, `week ${w.index}: ${s.title} asks for effort ${st.targetRpe?.max}`);
    // The week's most running in one session never goes backwards, and never jumps more than half again.
    const most = Math.max(...runs(w).map(runMin));
    assert.ok(most >= prev, `week ${w.index}: ${most} minutes of running after ${prev}`);
    if (prev) assert.ok(most <= prev * 1.5 + 1e-9, `week ${w.index}: ${prev} → ${most} minutes of running`);
    prev = most;
  }
  assert.equal(prev, 30);
});

test("BLOCKER: a week already run never changes when a walk-run checkpoint is answered — and one more week repeats the last", () => {
  const a = newbie();
  const g = goal("5k", 40);
  const prop = roadFor(a, g, START)!;
  // The week comes from Base, as the app takes it (roadAnswered): the road keeps its length, the race keeps its day.
  const rest = (): RoadStage[] => {
    const c = prop.stages.slice(2).map((s) => ({ ...s }));
    c.find((s) => s.kind === "base")!.weeks -= 1;
    return c;
  };
  const asLaid = plan(a, g, prop.stages, prop.rampWeeks);
  const variants: Array<{ why: string; stages: RoadStage[]; same: number }> = [
    { why: "one more week of Walk-run 1", same: 5, stages: [{ kind: "walkrun1", weeks: 6 }, { kind: "walkrun2", weeks: 4 }, ...rest()] },
    { why: "easing back at the end of Walk-run 1", same: 5,
      stages: [{ kind: "walkrun1", weeks: 5 }, { kind: "walkrun1", weeks: 1 }, { kind: "walkrun2", weeks: 4 }, ...rest()] },
    { why: "one more week of Walk-run 2", same: 9, stages: [{ kind: "walkrun1", weeks: 5 }, { kind: "walkrun2", weeks: 5 }, ...rest()] },
  ];
  for (const v of variants) {
    const p = plan(a, g, v.stages, prop.rampWeeks);
    assert.equal(p.weeks.length, asLaid.weeks.length);
    for (let i = 0; i < v.same; i++) assert.deepEqual(p.weeks[i], asLaid.weeks[i], `${v.why}: week ${i + 1}, already run, changed`);
    // The extra week repeats the block's last level, key run and all ("repeating a week is totally okay").
    assert.equal(shape(p.weeks[v.same]!), shape(p.weeks[v.same - 1]!), `${v.why}: the extra week is not a repeat of the last`);
    assert.ok(p.weeks[v.same]!.sessions.some((s) => s.keyRun), `${v.why}: the repeated week has no key run`);
    // And it does change what comes next — a guard that nothing changed would pass on a no-op.
    assert.notDeepEqual(p.weeks[v.same], asLaid.weeks[v.same], `${v.why}: the week after the checkpoint did not change`);
  }
});

test("the walk-run blocks are never cut: too short for both and a race block, there is no road; short, the race block gives way", () => {
  assert.equal(roadFor(newbie(), goal("5k", 12), START), null, "twelve weeks cannot hold nine of walk-run and a race block");
  const tight = roadFor(newbie(), goal("5k", 13), START)!;
  assert.deepEqual(tight.stages.map((s) => s.kind + s.weeks), ["walkrun15", "walkrun24", "race4"]);
  assert.ok(tight.shortWeeks > 0, "it says honestly that it is short");
  for (const wk of [14, 16, 20, 24, 30]) {
    const p = roadFor(newbie(), goal("10k", wk), START)!;
    assert.deepEqual(p.stages.slice(0, 2).map((s) => s.kind + s.weeks), ["walkrun15", "walkrun24"], `${wk} weeks`);
    assert.equal(p.stages.reduce((n, s) => n + s.weeks, 0), wk, `${wk} weeks: the road does not fill the runway`);
  }
  // The walk-run blocks count in the honest "a later race" date.
  const s = roadFor(newbie(), goal("half", 20), START)!;
  assert.ok(s.needFoundationWeeks >= 9 + 8);
});

test("BLOCKER: Walk-run 2's 30 minutes carries into Rebuild without a jump", () => {
  for (const dist of ["5k", "10k", "half"] as const) for (const days of [2, 3]) {
    const a = newbie({ daysPerWeek: days });
    const prop = roadFor(a, goal(dist, 44), START)!;
    const p = plan(a, goal(dist, 44), prop.stages, prop.rampWeeks);
    const i = p.weeks.findIndex((w) => w.stage === "rebuild");
    const before = Math.max(...runs(p.weeks[i - 1]!).map(runMin));
    const longR = p.weeks[i]!.sessions.find((s) => s.type === "long");
    const after = longR ? Math.round(longR.estimatedDurationSeconds / 60) : 0;
    assert.ok(after > 0 && after <= Math.floor(before * 1.10), `${dist} ${days}d: ${before} minutes of running → a ${after}-minute long run`);
  }
});

test("a habit-builder's road has no walk-run and no key run — piece 1's road exactly", () => {
  const habit = { ...newbie(), runWalk: false } as Athlete;
  const prop = roadFor(habit, goal("half", 26), START)!;
  assert.equal(prop.stages[0]!.kind, "rebuild");
  const p = plan(habit, goal("half", 26), prop.stages, prop.rampWeeks);
  assert.ok(p.weeks.every((w) => w.stage !== "walkrun1" && w.stage !== "walkrun2"));
  assert.ok(p.weeks.flatMap((w) => w.sessions).every((s) => !("keyRun" in s)));
  // And the levels are what the comment says: Walk-run 1 five, Walk-run 2 four, the key runs last.
  assert.equal(WALKRUN_LEVELS.walkrun1.length, 5);
  assert.equal(WALKRUN_LEVELS.walkrun2.length, 4);
});

test("a walk-run checkpoint's key run, in words that say only what was observed", () => {
  const f = (k: { doneIso: string | null; plannedIso?: string | null }) => evaluateCheckpoint({ stage: "walkrun1", planned: 6,
    done: 6, painRuns: 0, keyRun: { kind: "target-run", needMin: 20, ...k } });
  const done = f({ doneIso: "Sat 26 Dec" });
  assert.equal(done.verdict, "ready");
  assert.equal(done.reasons[2], "You ran 20 minutes without stopping on Sat 26 Dec, at a chatting pace.");
  const notYet = f({ doneIso: null, plannedIso: "Sat 26 Dec" });
  assert.equal(notYet.verdict, "nearly");
  assert.equal(notYet.reasons[2], "This block’s key run is 20 minutes without stopping, at a chatting pace — it is in your plan on Sat 26 Dec.");
  // A run that hurt is "not yet", whatever else — easing back put first.
  assert.equal(evaluateCheckpoint({ stage: "walkrun2", planned: 6, done: 6, painRuns: 1,
    keyRun: { kind: "target-run", needMin: 30, doneIso: "Sat 23 Jan" } }).recommend, "ease");
});
