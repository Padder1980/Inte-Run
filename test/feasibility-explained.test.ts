import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { Athlete, Goal } from "../src/domain/types.ts";
import { assessFeasibility } from "../src/plan/feasibility.ts";
import { phaseSchedule } from "../src/plan/periodization.ts";
import { buildPlanSummary } from "../src/view/plan-summary.ts";

/**
 * ⚠️ THE VERDICT MUST EXPLAIN ITSELF.
 *
 * The owner set up two profiles he believed were identical — same goal, same days, same runway — and
 * got "achievable" on one and "unrealistic" on the other, with nothing on screen to say why. They
 * were not identical: one had "returning from a break" ticked. That single flag raises the
 * improvement ceiling from 0.15 to 0.35, MORE THAN DOUBLE, and it is the only input besides the
 * runway that also reshapes the phase schedule — which is why his two training-block charts differed
 * too (base 5 / build 6 against base 7 / build 4 over sixteen weeks).
 *
 * Every word needed to explain that was already being written by assessFeasibility and thrown away
 * by the view layer. Computed and discarded, the same trap as CLASS, MASTERS and PLAN.notes.
 */
const goal: Goal = {
  distance: "5k", targetTimeSeconds: 19 * 60, raceDateIso: "2026-11-16", startDateIso: "2026-07-27",
};
const athlete = (returning: boolean): Athlete => ({
  daysPerWeek: 5, experience: "recreational", includeStrength: true, returningFromInjury: returning,
  recent: { distanceMeters: 5000, timeSeconds: 21 * 60 },
});

test("⚠️ one checkbox flips the verdict — so the card must say which one", () => {
  const no = assessFeasibility(athlete(false), goal);
  const yes = assessFeasibility(athlete(true), goal);
  // The premise: this really does flip, on identical running inputs.
  assert.notEqual(no.verdict, yes.verdict,
    "the fixture no longer reproduces the owner's two verdicts, so this test proves nothing");
  // And the returning case must SAY it is the returning case, in words a runner can act on.
  assert.ok(yes.rationale.some((r) => /returning/i.test(r)),
    `the achievable verdict never mentions returning: ${JSON.stringify(yes.rationale)}`);
  // The unreachable one must offer a target that would fit, rather than just refusing.
  assert.ok(no.suggestedTargetSeconds, "an unrealistic goal suggests no alternative");
  assert.ok(no.rationale.some((r) => /realistic/i.test(r)), "no explanation of what is realistic");
});

test("⚠️ the same flag reshapes the training block, which is what he could SEE", () => {
  const count = (returning: boolean) => {
    const s = phaseSchedule(16, "5k", returning);
    return { base: s.filter((w) => w.phase === "base").length, build: s.filter((w) => w.phase === "build").length };
  };
  assert.deepEqual(count(false), { base: 5, build: 6 });
  assert.deepEqual(count(true), { base: 7, build: 4 });
});

test("⚠️ the rationale survives the view layer", () => {
  // Where it was lost. buildPlanSummary kept four numbers and dropped every sentence.
  const s = buildPlanSummary(athlete(false), goal);
  assert.ok(Array.isArray(s.feasibility.rationale) && s.feasibility.rationale.length >= 2,
    "the plan summary is dropping the engine's explanation again");
  assert.ok(s.feasibility.suggestedTarget, "and the suggested target with it");
  const t = buildPlanSummary(athlete(true), goal);
  assert.ok(t.feasibility.rationale.some((r) => /returning/i.test(r)),
    "the returning explanation does not reach the view");
});

test("⚠️ and it is rendered, not merely carried", () => {
  // ⚠️ Carrying it and never printing it is the exact bug being fixed, one layer along. Twice tonight
  // a helper has been correct while nothing called it, so the wiring is asserted separately.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  assert.ok(html.includes("function feasibilityWhy("), "the renderer is gone from the build");
  assert.match(html, /feasibilityWhy\(\) \+/, "the plan header no longer calls it");
  assert.match(html, /\.feas-why \{/, "the rationale has no styling, so it would render unreadably");
});
