import assert from "node:assert/strict";
import { test } from "node:test";
import { assessReadiness } from "../src/readiness/readiness.ts";
import {
  assessLongRunSpike,
  assessWeeklyJump,
  returnToRunningPlan,
} from "../src/adapt/load-guardrails.ts";

// ---- Readiness ------------------------------------------------------------

test("a good day reads as ready", () => {
  const r = assessReadiness({ sleepHours: 8, sleepQuality: "good", soreness: "none", energy: "good", stress: "low", motivation: "high" });
  assert.equal(r.band, "ready");
  assert.ok(r.score >= 85);
});

test("one poor HRV reading alone never cancels the session", () => {
  const r = assessReadiness({ hrvStatus: "low" });
  assert.notEqual(r.band, "rest");
  assert.notEqual(r.band, "ease");
});

test("feeling unwell forces a rest day, regardless of everything else", () => {
  const r = assessReadiness({ illness: "unwell", sleepHours: 9, energy: "good", motivation: "high" });
  assert.equal(r.band, "rest");
  assert.match(r.reassurance, /never push through/i);
});

test("a slight illness caps the day at ease — never a hard session", () => {
  const r = assessReadiness({ illness: "slight", sleepHours: 8, energy: "good" });
  assert.ok(r.band === "ease" || r.band === "rest");
});

test("several soft factors together lower readiness", () => {
  const r = assessReadiness({ sleepHours: 5, soreness: "moderate", energy: "low", stress: "high" });
  assert.ok(r.band === "ease" || r.band === "rest");
  assert.ok(r.reasons.length >= 3);
});

test("the recommendation and reasons are always plain and present", () => {
  const r = assessReadiness({});
  assert.ok(r.recommendation.length > 0);
  assert.ok(r.reasons.length > 0);
});

// ---- Long-run spike -------------------------------------------------------

test("a long run over ~10% longer than the recent longest is flagged as a signal", () => {
  const r = assessLongRunSpike({ plannedLongestRunKm: 20, longestRunLast30dKm: 15 });
  assert.equal(r.withinComfort, false);
  assert.equal(r.overPct, 33);
  assert.equal(r.suggestedCapKm, 16.5);
  assert.match(r.note, /signal, not a hard rule/i);
});

test("a modest step up in the long run is within comfort", () => {
  const r = assessLongRunSpike({ plannedLongestRunKm: 16, longestRunLast30dKm: 15 });
  assert.equal(r.withinComfort, true);
});

test("no recent long run gives gentle build-up guidance, not a flag", () => {
  const r = assessLongRunSpike({ plannedLongestRunKm: 12, longestRunLast30dKm: 0 });
  assert.equal(r.withinComfort, true);
  assert.match(r.note, /gradually/i);
});

// ---- Weekly jump ----------------------------------------------------------

test("a big weekly volume jump is flagged", () => {
  const r = assessWeeklyJump({ plannedWeekKm: 50, lastWeekKm: 30 });
  assert.equal(r.withinComfort, false);
  assert.equal(r.jumpPct, 67);
});

// ---- Return to running ----------------------------------------------------

test("no pain-free walking (or a bone/joint injury) means see a professional first", () => {
  const a = returnToRunningPlan({ weeksOff: 3, painFreeWalking: false });
  assert.equal(a.canStart, false);
  assert.equal(a.seeProfessionalFirst, true);
  const b = returnToRunningPlan({ weeksOff: 2, painFreeWalking: true, boneOrJointInjury: true });
  assert.equal(b.canStart, false);
});

test("pain-free walking unlocks a graded walk-run progression", () => {
  const r = returnToRunningPlan({ weeksOff: 2, painFreeWalking: true });
  assert.equal(r.canStart, true);
  assert.ok(r.stages.length >= 3);
  assert.match(r.stages[0]!.detail, /walk/i);
});
