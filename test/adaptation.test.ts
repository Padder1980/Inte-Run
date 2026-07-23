import assert from "node:assert/strict";
import { test } from "node:test";
import type {
  Athlete,
  Goal,
  InjuryReport,
  PlannedWeek,
  Session,
  SessionOutcome,
} from "../src/domain/types.ts";
import { applyInjuryAdjustment, assessInjury } from "../src/adapt/injury.ts";
import { applyMissedSessionAdjustment, countTrailingMisses } from "../src/adapt/missed-sessions.ts";
import { evaluateRpe } from "../src/adapt/rpe-feedback.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";

const athlete: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 },
  experience: "recreational",
  includeStrength: true,
};
const goal: Goal = {
  distance: "half",
  targetTimeSeconds: 5400,
  raceDateIso: "2027-09-05",
  startDateIso: "2026-07-23",
};
const plan = generatePlan(athlete, goal);
const buildWeek = plan.weeks.find(
  (w) => w.phase === "build" && !w.isDeload && w.qualitySessionCount >= 2,
)!;
const paces = deriveTrainingPaces(athlete.recent, goal);

const outcome = (id: string, completed: boolean): SessionOutcome => ({
  sessionId: id,
  dateIso: "2026-08-01",
  completed,
});
const hasHard = (s: Session) =>
  s.type === "vo2" || s.type === "threshold" || s.type === "race-specific";

// ---- missed sessions ------------------------------------------------------

test("two consecutive misses trigger; one does not", () => {
  assert.equal(countTrailingMisses([outcome("a", true), outcome("b", false)]), 1);
  assert.equal(countTrailingMisses([outcome("a", false), outcome("b", false)]), 2);
  assert.equal(countTrailingMisses([outcome("a", false), outcome("b", true)]), 0);

  const one = applyMissedSessionAdjustment(buildWeek, [outcome("x", false)]);
  assert.equal(one.triggered, false);

  const two = applyMissedSessionAdjustment(buildWeek, [outcome("x", false), outcome("y", false)]);
  assert.equal(two.triggered, true);
});

test("re-entry eases load without cramming missed work back in", () => {
  const res = applyMissedSessionAdjustment(buildWeek, [outcome("x", false), outcome("y", false)]);
  // Volume reduced.
  assert.ok(res.week.plannedDistanceMeters < buildWeek.plannedDistanceMeters, "volume should fall");
  // Fewer quality sessions (hardest demoted), not more.
  assert.ok(res.week.qualitySessionCount < buildWeek.qualitySessionCount);
  // Session count unchanged — nothing crammed on top.
  assert.equal(res.week.sessions.length, buildWeek.sessions.length);
});

// ---- injury ---------------------------------------------------------------

test("severe / bone-stress injuries pause running", () => {
  const severe: InjuryReport = {
    region: "shin",
    severity: "severe",
    painWhileRunning: true,
    reportedOnIso: "2026-08-01",
  };
  const a = assessInjury(severe);
  assert.equal(a.action, "pause");
  assert.equal(a.volumeScale, 0);

  const boneStress: InjuryReport = {
    region: "foot",
    severity: "moderate",
    painWhileRunning: false,
    boneStressSuspected: true,
    reportedOnIso: "2026-08-01",
  };
  assert.equal(assessInjury(boneStress).action, "pause");
});

test("a pause rewrites upcoming weeks with no hard running", () => {
  const report: InjuryReport = {
    region: "shin",
    severity: "severe",
    painWhileRunning: true,
    reportedOnIso: "2026-08-01",
  };
  const from = buildWeek.index;
  const { weeks, changes } = applyInjuryAdjustment(plan.weeks, from, report, paces, 2);
  const affected = weeks.filter((w) => w.index >= from && w.index < from + 2);
  for (const w of affected) {
    assert.equal(
      w.sessions.filter(hasHard).length,
      0,
      `week ${w.index} should have no hard running`,
    );
  }
  assert.ok(changes.length > 0);
  // Weeks outside the window are untouched.
  const outside = weeks.find((w) => w.index === from + 5);
  const original = plan.weeks.find((w) => w.index === from + 5);
  if (outside && original)
    assert.equal(outside.plannedDistanceMeters, original.plannedDistanceMeters);
});

test("a niggle only removes the hardest session, keeping easy running", () => {
  const niggle: InjuryReport = {
    region: "calf",
    severity: "niggle",
    painWhileRunning: false,
    reportedOnIso: "2026-08-01",
  };
  assert.equal(assessInjury(niggle).action, "monitor");
  const { weeks } = applyInjuryAdjustment(plan.weeks, buildWeek.index, niggle, paces, 1);
  const adjusted = weeks.find((w) => w.index === buildWeek.index)!;
  const easyBefore = buildWeek.sessions.filter((s) => s.intensity === "easy").length;
  const easyAfter = adjusted.sessions.filter((s) => s.intensity === "easy").length;
  assert.ok(easyAfter >= easyBefore, "easy running is preserved (or increased by the demotion)");
  assert.ok(
    adjusted.qualitySessionCount < buildWeek.qualitySessionCount,
    "a quality session was dropped",
  );
});

// ---- RPE feedback ---------------------------------------------------------

test("RPE trend maps to ease / hold / progress", () => {
  const target = 7;
  const tooHard = [1, 2, 3].map(() => ({ targetMax: target, actualRpe: 9, completed: true }));
  assert.equal(evaluateRpe(tooHard), "ease");

  const notCompleted = [
    { targetMax: target, actualRpe: 7, completed: true },
    { targetMax: target, actualRpe: 8, completed: false },
  ];
  assert.equal(evaluateRpe(notCompleted), "ease");

  const comfortable = [1, 2, 3].map(() => ({ targetMax: target, actualRpe: 5.5, completed: true }));
  assert.equal(evaluateRpe(comfortable), "progress");

  const onTarget = [1, 2, 3].map(() => ({ targetMax: target, actualRpe: 7, completed: true }));
  assert.equal(evaluateRpe(onTarget), "hold");
});
