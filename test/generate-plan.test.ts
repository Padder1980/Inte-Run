import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, Session } from "../src/domain/types.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

const athlete: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 },
  experience: "recreational",
  includeStrength: true,
  returningFromInjury: true,
};

const goal: Goal = {
  distance: "half",
  targetTimeSeconds: 5400,
  raceDateIso: "2027-09-05", // a Sunday
  startDateIso: "2026-07-23",
};

const plan = generatePlan(athlete, goal);
const runSessions = (w: PlannedWeek) => w.sessions.filter((s) => s.estimatedDistanceMeters);
const isHard = (s: Session) =>
  s.intensity === "hard" || s.type === "threshold" || s.type === "race-specific";

test("phases appear in order base → build → peak → taper", () => {
  const order = ["base", "build", "peak", "taper"];
  let cursor = 0;
  for (const w of plan.weeks) {
    const pos = order.indexOf(w.phase);
    assert.ok(pos >= cursor, `phase ${w.phase} out of order at week ${w.index}`);
    cursor = pos;
  }
  assert.equal(plan.weeks[0]!.phase, "base");
  assert.equal(plan.weeks.at(-1)!.phase, "taper");
});

test("structured length is bounded and the last week holds the race week", () => {
  assert.ok(plan.weeks.length <= 40, "half-marathon plan bounded at 40 structured weeks");
  // race 2027-09-05 (Sun) → race-week Monday is 2027-08-30
  assert.equal(plan.weeks.at(-1)!.startDateIso, "2027-08-30");
});

test("a long runway maps to a full-length plan, not a short capped block", () => {
  // ~58 weeks out → a substantial plan (well beyond the old 20-week cap), spanning the runway.
  assert.ok(plan.weeks.length >= 30, `expected a long plan, got ${plan.weeks.length}`);
  // The bulk of the extra time is aerobic base, not stretched-out specific work.
  const base = plan.weeks.filter((w) => w.phase === "base").length;
  const build = plan.weeks.filter((w) => w.phase === "build").length;
  assert.ok(base > build, "surplus time should extend the base, not the build");
  assert.ok(build <= 10, "the specific build stays concentrated");
});

test("every week has exactly one long run", () => {
  for (const w of plan.weeks) {
    const longs = w.sessions.filter((s) => s.type === "long");
    assert.equal(longs.length, 1, `week ${w.index} long-run count`);
  }
});

test("the taper is present with correct length for a half marathon", () => {
  const taperWeeks = plan.weeks.filter((w) => w.phase === "taper");
  assert.equal(taperWeeks.length, 2);
});

test("no two hard sessions land on adjacent days", () => {
  for (const w of plan.weeks) {
    const hardDays = w.sessions
      .filter(isHard)
      .map((s) => s.dayOfWeek)
      .sort((a, b) => a - b);
    for (let i = 1; i < hardDays.length; i++) {
      assert.ok(
        hardDays[i]! - hardDays[i - 1]! >= 2,
        `week ${w.index} has adjacent hard days ${hardDays}`,
      );
    }
  }
});

test("a long base opens with a pure-aerobic foundation, then one quality — never two", () => {
  // The very first week is a foundation week: easy running, no quality yet.
  assert.equal(plan.weeks[0]!.qualitySessionCount, 0);
  // No base week ever carries two quality sessions (the intensity comes in the build).
  for (const w of plan.weeks.filter((w) => w.phase === "base")) {
    assert.ok(w.qualitySessionCount <= 1, `base week ${w.index} has >1 quality`);
  }
  // But quality does appear later in the base.
  assert.ok(plan.weeks.some((w) => w.phase === "base" && w.qualitySessionCount === 1));
});

test("the long run progresses then backs off into the taper", () => {
  const buildPeak = plan.weeks.filter(
    (w) => w.phase === "build" || w.phase === "peak" || w.phase === "base",
  );
  const longestNonTaper = Math.max(...buildPeak.map((w) => longMinutes(w)));
  const raceWeekLong = longMinutes(plan.weeks.at(-1)!);
  assert.ok(raceWeekLong < longestNonTaper, "race-week long run should be reduced vs peak");
  // Peak long run should be materially longer than the first week's.
  assert.ok(longestNonTaper > longMinutes(plan.weeks[0]!) * 1.3);
});

test("weekly intensity distribution stays pyramidal-ish (plenty of easy)", () => {
  // Sample a representative build week.
  const buildWeek = plan.weeks.find((w) => w.phase === "build" && !w.isDeload)!;
  const dist = computeDistribution(buildWeek.sessions);
  assert.ok(dist.easy >= 0.6, `easy fraction ${dist.easy.toFixed(2)} too low`);
  assert.ok(honoursModel(dist, "pyramidal"));
});

test("strength eases from 2×/week to 1× near the race when enabled", () => {
  const strengthCount = (w: PlannedWeek) => w.sessions.filter((s) => s.type === "strength").length;
  const mainWeek = plan.weeks.find((w) => w.phase === "build" && !w.isDeload)!;
  assert.equal(strengthCount(mainWeek), 2);
  const raceWeek = plan.weeks.at(-1)!;
  assert.ok(strengthCount(raceWeek) <= 1, "strength reduced near the race");
});

test("plans without strength omit strength sessions and say so", () => {
  const noStrength = generatePlan({ ...athlete, includeStrength: false }, goal);
  const total = noStrength.weeks.flatMap((w) => w.sessions).filter((s) => s.type === "strength");
  assert.equal(total.length, 0);
  assert.ok(noStrength.notes.some((n) => n.toLowerCase().includes("strength is off")));
});

function longMinutes(w: PlannedWeek): number {
  const long = w.sessions.find((s) => s.type === "long")!;
  return Math.round(long.estimatedDurationSeconds / 60);
}
