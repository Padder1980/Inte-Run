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
type Comeback = "none" | "break" | "injury";
const athlete = (back: Comeback): Athlete => ({
  daysPerWeek: 5, experience: "recreational", includeStrength: true,
  returningFromInjury: back === "injury", returningFromBreak: back === "break",
  recent: { distanceMeters: 5000, timeSeconds: 21 * 60 },
});

test("⚠️ being INJURED makes a goal less likely, not more", () => {
  // ⚠️ The owner's objection, and he was right. One checkbox meant "injury or a long break" and both
  // got the same 0.35 ceiling — so coming back hurt made a target look MORE achievable than it was
  // for an uninjured runner, while the very same flag shortened the build phase to keep the early
  // weeks conservative. The two decisions contradicted each other.
  const none = assessFeasibility(athlete("none"), goal);
  const brk = assessFeasibility(athlete("break"), goal);
  const inj = assessFeasibility(athlete("injury"), goal);

  // Coming back healthy really is faster — regaining beats gaining, and that stays.
  assert.ok(brk.projectedAchievablePct > none.projectedAchievablePct,
    "time off no longer helps at all — the regaining effect has been thrown away with the bug");
  // ⚠️ THE FIX: injured must sit BELOW healthy-returner. This is the assertion that was false before.
  assert.ok(inj.projectedAchievablePct < brk.projectedAchievablePct,
    `injured (${inj.projectedAchievablePct.toFixed(1)}%) is still projected as well as or better than a healthy returner (${brk.projectedAchievablePct.toFixed(1)}%)`);
  // But still above someone who was never fit: a previously-trained runner does come back quicker.
  assert.ok(inj.projectedAchievablePct > none.projectedAchievablePct,
    "an injured returner is now projected worse than a runner who was never fit — that is the wrong way too");

  // And each case must SAY which it is, in words a runner can act on.
  assert.ok(inj.rationale.some((r) => /injur/i.test(r) && /tendon|joint|cautious/i.test(r)),
    `the injury verdict does not explain itself: ${JSON.stringify(inj.rationale)}`);
  assert.ok(brk.rationale.some((r) => /time off|regain/i.test(r)),
    `the time-off verdict does not explain itself: ${JSON.stringify(brk.rationale)}`);
  // The unreachable one must offer a target that would fit, rather than just refusing.
  assert.ok(none.suggestedTargetSeconds, "an unrealistic goal suggests no alternative");
  assert.ok(none.rationale.some((r) => /realistic/i.test(r)), "no explanation of what is realistic");
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
  const s = buildPlanSummary(athlete("none"), goal);
  assert.ok(Array.isArray(s.feasibility.rationale) && s.feasibility.rationale.length >= 2,
    "the plan summary is dropping the engine's explanation again");
  assert.ok(s.feasibility.suggestedTarget, "and the suggested target with it");
  const t = buildPlanSummary(athlete("injury"), goal);
  assert.ok(t.feasibility.rationale.some((r) => /injur/i.test(r)),
    "the comeback explanation does not reach the view");
});

test("⚠️ and it is rendered, not merely carried", () => {
  // ⚠️ Carrying it and never printing it is the exact bug being fixed, one layer along. Twice tonight
  // a helper has been correct while nothing called it, so the wiring is asserted separately.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  assert.ok(html.includes("function feasibilityWhy("), "the renderer is gone from the build");
  assert.match(html, /feasibilityWhy\(\) \+/, "the plan header no longer calls it");
  assert.match(html, /\.feas-why \{/, "the rationale has no styling, so it would render unreadably");
});
