// STAGE B14 — A ROAD OF STAGES TO A RACE (STAGES.md, approved by the owner 2026-11-18).
//
// His report: a half marathon in May 2027, target 1:35:00, "Building the habit" chosen on purpose and the comeback
// answer "After an injury". The plan was ~21 weeks of easy runs and long runs only — not one harder session — because
// `beginnerQualityFor` returned nothing for a returner for the WHOLE block. The road makes that per stage: Rebuild
// (no fast running), Base (the beginner track's gentle quality and hill sprints), then the race block, which is
// today's main-track plan for those weeks. These guards hold the engine half of it (STAGES.md §8 step 1):
//   * no quality in Rebuild; quality returns in Base;
//   * the race block IS today's main track for the same weeks, byte for byte;
//   * volume carries across each boundary;
//   * a week already run never changes when a later checkpoint is answered;
//   * a plan built without a road is exactly what it was.
import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";
import { generatePlan, type RoadStage } from "../src/plan/generate-plan.ts";
import { RACE_BLOCK_WEEKS } from "../src/plan/periodization.ts";
import { roadFor, roadStartFor } from "../src/plan/road.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";

const QUALITY = new Set(["threshold", "vo2", "race-specific"]);
const AEROBIC = new Set(["long", "easy", "recovery", "strides"]);
const START = "2026-11-23"; // a Monday — the owner's own plan starts here
const add = (iso: string, d: number) => {
  const t = new Date(iso + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + d);
  return t.toISOString().slice(0, 10);
};
const qualityOf = (w: PlannedWeek): Session[] => w.sessions.filter((s) => QUALITY.has(s.type));
/** Hill sprints: unpaced repetitions on an easy-day run (the test test/beginner-quality.test.ts uses). */
const hasSprints = (w: PlannedWeek) => w.sessions.some((s) => (s.type === "easy" || s.type === "strides") &&
  (s.steps ?? []).some((st) => st.kind === "rep" && st.targetPaceSecPerKm == null));
const longMin = (w: PlannedWeek) => {
  const l = w.sessions.find((s) => s.type === "long");
  return l ? Math.round(l.estimatedDurationSeconds / 60) : 0;
};
const aerobicMin = (w: PlannedWeek) =>
  w.sessions.filter((s) => AEROBIC.has(s.type)).reduce((m, s) => m + s.estimatedDurationSeconds / 60, 0);

/** The owner's own answers: Building the habit (beginner track), After an injury, 4 days, a half on 16 May 2027 at
 *  1:35:00. His 5 km is the one a 5:30 easy pace back-calculates to (about 20:50); the guards also run slower ones. */
function owner(secs = 1250): { athlete: Athlete; goal: Goal } {
  return {
    athlete: {
      daysPerWeek: 4, recent: { distanceMeters: 5000, timeSeconds: secs }, experience: "beginner",
      includeStrength: true, returningFromInjury: true, returningFromBreak: false, runWalk: false, longRunDay: 6,
    } as Athlete,
    goal: { distance: "half", targetTimeSeconds: 5700, raceDateIso: "2027-05-16" } as Goal,
  };
}
function roadPlan(athlete: Athlete, goal: Goal, stages: RoadStage[], rampWeeks?: number) {
  return generatePlan(athlete, goal, { startDateIso: START, road: { stages, ...(rampWeeks ? { rampWeeks } : {}) } });
}

test("BLOCKER: the owner's own case builds as Rebuild → Base → race block, with quality back after Rebuild", () => {
  const { athlete, goal } = owner();
  const prop = roadFor(athlete, goal, START);
  assert.ok(prop, "a returning habit-builder is placed on a road");
  assert.equal(prop.startStage, "rebuild");
  assert.equal(prop.shortWeeks, 0, "his runway fits the whole road");
  assert.deepEqual(prop.stages.map((s) => s.kind), ["rebuild", "base", "race"]);
  assert.equal(prop.stages[2]!.weeks, RACE_BLOCK_WEEKS.half, "the race block is the book's 16 weeks");
  const p = roadPlan(athlete, goal, prop.stages, prop.rampWeeks);
  assert.equal(p.weeks.length, 25, "his 25 weeks to race day are all planned — none left as a lead-in");
  assert.ok(p.weeks.every((w) => w.stage), "every week carries its stage");
  const rebuild = p.weeks.filter((w) => w.stage === "rebuild");
  const base = p.weeks.filter((w) => w.stage === "base");
  const race = p.weeks.filter((w) => w.stage === "race");
  assert.equal(rebuild.length, 4);
  assert.equal(base.length, 5);
  assert.equal(race.length, 16);
  for (const w of rebuild) {
    assert.equal(qualityOf(w).length, 0, `Rebuild week ${w.index} carries "${qualityOf(w).map((s) => s.title)}"`);
    assert.ok(!hasSprints(w), `Rebuild week ${w.index} carries hill sprints — Rebuild is no fast running`);
  }
  for (const w of base) assert.equal(qualityOf(w).length, 1, `Base week ${w.index} has ${qualityOf(w).length} quality sessions`);
  assert.ok(base.filter((w) => !w.isDeload).every(hasSprints), "Base's ordinary weeks carry the hill sprints");
  const total = p.weeks.reduce((n, w) => n + w.qualitySessionCount, 0);
  // Measured: 5 in Base + 15 in the race block. Today's plan for the same answers had 0.
  assert.ok(total >= 15, `only ${total} quality sessions in the whole road`);
  // And the plan reaches his goal pace before race day — the reason the road exists.
  const fastest = Math.min(...race.flatMap((w) => w.sessions).filter((s) => s.type !== "race")
    .flatMap((s) => s.steps ?? []).map((st) => st.targetPaceSecPerKm?.minSecPerKm ?? Infinity));
  assert.ok(fastest <= p.paces.goalRace.maxSecPerKm, `fastest training pace ${fastest}s/km never reaches goal pace`);
});

test("BLOCKER: the race block is today's main-track plan for the same weeks, byte for byte", () => {
  for (const secs of [1250, 1800, 2400]) {
    const { athlete, goal } = owner(secs);
    const prop = roadFor(athlete, goal, START)!;
    const p = roadPlan(athlete, goal, prop.stages, prop.rampWeeks);
    const race = p.weeks.filter((w) => w.stage === "race");
    const main = generatePlan({ ...athlete, experience: "recreational" }, goal, { startDateIso: race[0]!.startDateIso });
    assert.equal(race.length, main.weeks.length);
    race.forEach((w, i) => {
      const { index: _a, stage: _b, ...mine } = w;
      const { index: _c, ...theirs } = main.weeks[i]!;
      assert.deepEqual(mine, theirs, `${secs}s runner, race-block week ${i + 1} differs from today's main track`);
    });
  }
});

test("BLOCKER: a plan built without a road is exactly the plan it was", () => {
  // The road is dispatched first and only when given; every week of a plan without one carries no stage at all.
  const { athlete, goal } = owner();
  const a = generatePlan(athlete, goal, { startDateIso: START });
  const b = generatePlan(athlete, goal, { startDateIso: START, road: undefined });
  assert.deepEqual(a, b);
  assert.ok(a.weeks.every((w) => !("stage" in w)), "a week of a road-less plan carries a stage key");
  // And off a road a returning beginner still gets none: an existing plan does not change until its runner
  // chooses a road (decision 2 — moving up only through a choice the runner makes).
  assert.equal(a.weeks.reduce((n, w) => n + w.qualitySessionCount, 0), 0);
});

test("BLOCKER: a week already run never changes when a later checkpoint is answered", () => {
  const { athlete, goal } = owner();
  const ramp = 9;
  const asLaid = roadPlan(athlete, goal, [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 5 }, { kind: "race", weeks: 16 }], ramp);
  const variants: Array<{ why: string; stages: RoadStage[]; same: number }> = [
    { why: "one more week in Rebuild", same: 4,
      stages: [{ kind: "rebuild", weeks: 5 }, { kind: "base", weeks: 4 }, { kind: "race", weeks: 16 }] },
    { why: "two more weeks in Rebuild", same: 4,
      stages: [{ kind: "rebuild", weeks: 6 }, { kind: "base", weeks: 3 }, { kind: "race", weeks: 16 }] },
    { why: "easing back from Base for a week", same: 7,
      stages: [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 3 }, { kind: "rebuild", weeks: 1 }, { kind: "base", weeks: 1 }, { kind: "race", weeks: 16 }] },
    { why: "one more week in Base, carried into the race block", same: 9,
      stages: [{ kind: "rebuild", weeks: 4 }, { kind: "base", weeks: 6 }, { kind: "race", weeks: 15 }] },
  ];
  for (const v of variants) {
    const p = roadPlan(athlete, goal, v.stages, ramp);
    for (let i = 0; i < v.same; i++) {
      assert.deepEqual(p.weeks[i], asLaid.weeks[i], `${v.why}: week ${i + 1}, already run, changed`);
    }
    // And the answer does change what comes next — a guard that nothing changed would pass on a no-op.
    assert.notDeepEqual(p.weeks[v.same], asLaid.weeks[v.same], `${v.why}: the week after the checkpoint did not change`);
  }
});

/** Every road roadFor lays out across a grid of the runners it places (the app offers beginners 3–4 days). */
function* sweep() {
  const TT: Record<string, number> = { "5k": 1500, "10k": 3200, half: 7000 };
  for (const dist of ["5k", "10k", "half"]) for (const secs of [1200, 1500, 1800, 2250, 2700])
    for (const days of [3, 4]) for (const ret of [0, 1, 2]) for (const wk of [20, 26, 32, 40]) {
      const athlete = { daysPerWeek: days, recent: { distanceMeters: 5000, timeSeconds: secs }, experience: "beginner",
        includeStrength: true, returningFromInjury: ret === 1, returningFromBreak: ret === 2, runWalk: false, longRunDay: 6 } as Athlete;
      const goal = { distance: dist, targetTimeSeconds: TT[dist]!, raceDateIso: add(START, wk * 7 - 1) } as Goal;
      const prop = roadFor(athlete, goal, START);
      if (!prop) continue;
      const p = roadPlan(athlete, goal, prop.stages, prop.rampWeeks);
      yield { who: `${dist} ${secs}s ${days}d ret${ret} ${wk}w`, athlete, goal, prop, p };
    }
}

test("BLOCKER: volume carries across every boundary", () => {
  let roads = 0, joins = 0, worstLong = 0, worstAerobic = 0;
  for (const { who, prop, p } of sweep()) {
    roads++;
    // Every boundary: the last ordinary week before it against the first ordinary week after it.
    for (let i = 1; i < p.weeks.length; i++) {
      const w = p.weeks[i]!;
      if (w.stage === p.weeks[i - 1]!.stage || w.isDeload) continue;
      const before = p.weeks.slice(0, i).filter((x) => !x.isDeload).pop();
      if (!before || !longMin(before) || !longMin(w)) continue;
      joins++;
      const lj = longMin(w) / longMin(before);
      worstLong = Math.max(worstLong, lj);
      // The long run: the main track's own step limit, in the minutes it is built in (LONG_LIFT_STEP_MAX).
      assert.ok(longMin(w) <= Math.floor(longMin(before) * 1.10),
        `${who}: the long run jumps ${longMin(before)} → ${longMin(w)} minutes into ${w.stage} (week ${w.index})`);
      // The aerobic running (long + easy) only where the runway fits the road: a SHORT road is the runner's
      // choice made with an honest note on the risk (decision 4), measured below rather than held.
      if (prop.shortWeeks === 0) {
        const aj = aerobicMin(w) / aerobicMin(before);
        worstAerobic = Math.max(worstAerobic, aj);
        assert.ok(aj <= 1.10, `${who}: easy running jumps ${aj.toFixed(2)}x into ${w.stage} (week ${w.index})`);
      }
    }
  }
  assert.ok(roads > 300, `only ${roads} roads swept`);
  assert.ok(joins > 500, `only ${joins} boundaries measured`);
  // Measured 1.071 and 1.030. The bars discriminate: a foundation aimed at nothing (the beginner ladder's own
  // endpoint) joined at up to 1.39 on the long run.
  assert.ok(worstLong > 1.0 && worstAerobic > 1.0, "a sweep with no step measured nothing");
});

test("BLOCKER: the foundation never breaks the easy floor, and the road adds no breach the main track lacks", () => {
  let weeks = 0;
  for (const { who, athlete, goal, p } of sweep()) {
    const race = p.weeks.filter((w) => w.stage === "race");
    const main = generatePlan({ ...athlete, experience: "recreational" }, goal, { startDateIso: race[0]!.startDateIso });
    p.weeks.forEach((w) => {
      if (w.sessions.some((s) => s.type === "race")) return; // race week is a race (every sweep exempts it)
      const d = computeDistribution(w.sessions);
      if (!d.totalSeconds) return;
      weeks++;
      if (honoursModel(d, p.intensityModel)) return;
      // ⚠️ A breach is allowed only where today's main track already has it in the same week — a very slow
      // runner on three days, measured at 65.7% easy, before this stage existed. Never in the foundation.
      assert.equal(w.stage, "race", `${who}: foundation week ${w.index} is ${(d.easy * 100).toFixed(1)}% easy`);
      const same = main.weeks[race.indexOf(w)]!;
      assert.ok(!honoursModel(computeDistribution(same.sessions), main.intensityModel),
        `${who}: race-block week ${w.index} breaks the easy floor where today's main track does not`);
    });
  }
  assert.ok(weeks > 5000, `only ${weeks} weeks measured`);
});

test("roadFor places the runners it is built for, and says honestly when the runway is short", () => {
  const { athlete, goal } = owner();
  // Placed: the beginner track's continuous runner, coming back or not.
  assert.equal(roadStartFor(athlete), "rebuild");
  assert.equal(roadStartFor({ ...athlete, returningFromInjury: false }), "rebuild");
  // Not yet placed (each recorded in notes/plan-profile.md): run-walk, a 12-17 runner, a regular runner.
  assert.equal(roadStartFor({ ...athlete, runWalk: true }), null);
  assert.equal(roadStartFor({ ...athlete, age: 15 }), null);
  assert.equal(roadStartFor({ ...athlete, experience: "recreational" }), null);
  // Short: ten weeks to the same race. The foundation he needs is kept; the race block is the part shortened, and
  // the proposal says by how much and when a race would fit the whole road — one choice among the others.
  const soon = { ...goal, raceDateIso: add(START, 18 * 7 - 1) };
  const prop = roadFor(athlete, soon, START)!;
  assert.ok(prop.shortWeeks > 0, "eighteen weeks is not enough for 9 + 16");
  const f = prop.stages.filter((s) => s.kind !== "race").reduce((n, s) => n + s.weeks, 0);
  assert.equal(f, prop.needFoundationWeeks, "the foundation he needs is never the part cut");
  assert.equal(prop.stages.reduce((n, s) => n + s.weeks, 0), 18, "the road still fills the runway");
  assert.ok(prop.fullFitsRaceMondayIso > soon.raceDateIso, "the later-race choice names a later date");
  // Long: a race a year away is not a year of Base — the foundation stops at FOUNDATION_MAX_WEEKS.
  const far = roadFor(athlete, { ...goal, raceDateIso: add(START, 52 * 7) }, START)!;
  assert.ok(far.stages.filter((s) => s.kind !== "race").reduce((n, s) => n + s.weeks, 0) <= 20);
});
