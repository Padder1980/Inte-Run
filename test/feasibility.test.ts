import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal } from "../src/domain/types.ts";
import { assessFeasibility } from "../src/plan/feasibility.ts";

const returningRunner: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 }, // 21:00 5k, detrained
  experience: "competitive",
  includeStrength: true,
  returningFromInjury: true,
};

test("a returning runner chasing HM sub-1:30 far out is feasible", () => {
  const goal: Goal = {
    distance: "half",
    targetTimeSeconds: 5400, // 1:30:00
    raceDateIso: "2027-09-01",
  };
  const a = assessFeasibility(returningRunner, goal, "2026-07-23");
  assert.ok(
    a.verdict === "comfortable" || a.verdict === "achievable",
    `expected feasible, got ${a.verdict}`,
  );
  assert.ok(a.weeksAvailable > 50);
  assert.equal(a.suggestedTargetSeconds, undefined);
});

test("an absurd goal in little time is unrealistic and suggests a realistic target", () => {
  const beginner: Athlete = {
    daysPerWeek: 3,
    recent: { distanceMeters: 5000, timeSeconds: 1800 }, // 30:00 5k
    experience: "beginner",
    includeStrength: false,
  };
  const goal: Goal = {
    distance: "marathon",
    targetTimeSeconds: 9000, // 2:30 marathon
    raceDateIso: "2026-09-15",
  };
  const a = assessFeasibility(beginner, goal, "2026-07-23");
  assert.equal(a.verdict, "unrealistic");
  assert.ok(typeof a.suggestedTargetSeconds === "number");
  assert.ok(
    a.suggestedTargetSeconds! > goal.targetTimeSeconds,
    "suggested target must be slower/realistic",
  );
  assert.ok(
    a.suggestedTargetSeconds! < a.currentPredictedSeconds,
    "but still an improvement on current fitness",
  );
});

test("required improvement is negative when the goal is easier than current fitness", () => {
  const goal: Goal = { distance: "10k", targetTimeSeconds: 3600, raceDateIso: "2027-01-01" };
  const a = assessFeasibility(returningRunner, goal, "2026-07-23");
  assert.ok(a.requiredImprovementPct < 0);
  assert.equal(a.verdict, "comfortable");
});
