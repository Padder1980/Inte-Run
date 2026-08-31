import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { easyHillStrides } from "../src/plan/session-templates.ts";
import type { SessionContent } from "../src/plan/session-templates.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";

/**
 * HILL SPRINTS ARE A WEEKLY STAPLE, NOT A ROTATION FLAVOUR.
 *
 * Short maximal hill sprints are the cheapest neuromuscular work there is - ten seconds, no aerobic
 * cost, and the gradient caps the speed so the forces stay low - and their whole value is FREQUENCY.
 * They were one of EIGHT easy-run flavours, so a runner met them about one easy run in eight:
 * measured on a real 17-week block, six sessions in the whole plan, clustered in weeks 1-2 and 9-10.
 * As an occasional novelty they do nothing at all.
 *
 * ⚠️ EVERY CLAIM HERE IS DRIVEN THROUGH `generatePlan` AND READ OFF REAL SESSIONS. A source-text
 * assertion would prove the dose function exists, which is a different claim from a runner meeting
 * the sprints - and this repo has shipped that exact gap (a marathon-prediction correction that was
 * written, tested, documented and called by nothing).
 *
 * ⚠️ AND HILL WORK IS IDENTIFIED STRUCTURALLY, NEVER BY TITLE. A hill repetition carries NO pace by
 * design, because pace up a hill is a function of the gradient. Matching /hill/i on a title would go
 * stale silently the first time a format was renamed.
 */

const athlete = (over: Partial<Athlete> = {}): Athlete => ({
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1500 },
  experience: "recreational",
  includeStrength: true,
  includeMobility: true,
  longRunDay: 6,
  ...over,
} as Athlete);

const goal = (over: Partial<Goal> = {}): Goal => ({
  distance: "half",
  raceDateIso: "2027-03-07",
  targetTimeSeconds: 6300,
  ...over,
} as Goal);

const plan = (a: Athlete = athlete(), g: Goal = goal()) =>
  generatePlan(a, g, { startDateIso: "2026-09-07" }).weeks;

/** A repetition with no pace target IS hill work. The structural test, not the title. */
const unpacedReps = (s: SessionContent) =>
  (s.steps ?? []).filter((st) => st.kind === "rep" && st.targetPaceSecPerKm == null).length;
const pacedReps = (s: SessionContent) =>
  (s.steps ?? []).filter((st) => st.kind === "rep" && st.targetPaceSecPerKm != null).length;
/** The sprint day specifically: an EASY session (type "strides") carrying unpaced reps. */
const sprintDay = (w: PlannedWeek) => w.sessions.find((s) => s.type === "strides" && unpacedReps(s) > 0);
const hillWeek = (w: PlannedWeek) => w.sessions.some((s) => unpacedReps(s) > 0);
const eligible = (w: PlannedWeek) => !w.isDeload && w.phase !== "taper";

test("BLOCKER: hill sprints reach the great majority of eligible weeks, at every day-count", () => {
  // The whole point of the change. Before it, measured, a runner met them in about one easy run in
  // eight. The bar is set BELOW what every swept configuration delivers and far above the old
  // behaviour, so it discriminates: measured 13/18 at three running days and 17/18 at six.
  for (const daysPerWeek of [3, 4, 5, 6]) {
    for (const distance of ["5k", "10k", "half", "marathon"] as const) {
      const weeks = plan(athlete({ daysPerWeek }), goal({ distance }));
      const elig = weeks.filter(eligible);
      const withHills = elig.filter(hillWeek).length;
      assert.ok(elig.length >= 12, `${distance}/${daysPerWeek}d: only ${elig.length} eligible weeks to judge`);
      assert.ok(withHills / elig.length >= 0.6,
        `${distance}/${daysPerWeek}d: hill work in only ${withHills} of ${elig.length} eligible weeks — ` +
        "the staple has gone back to being a rotation flavour");
    }
  }
});

test("BLOCKER: the dose is introduced small and built, never handed out at full size", () => {
  // Connective tissue adapts more slowly than the cardiovascular system, so the number of contacts is
  // what earns its way up - never the effort of each one. A fixed dose is the defect: it either starts
  // a new runner at the maintenance load or never reaches it.
  const weeks = plan();
  const doses = weeks.filter(eligible)
    .map((w) => { const s = sprintDay(w); return s ? unpacedReps(s) : null; })
    .filter((n): n is number => n != null);
  assert.ok(doses.length >= 8, `only ${doses.length} sprint days to read a progression from`);
  const first = doses[0]!;
  const last = doses[doses.length - 1]!;
  assert.ok(first <= 3, `the first sprint day already prescribes ${first} sprints`);
  assert.ok(last >= 6, `the dose never reaches the maintenance load — it settles at ${last}`);
  assert.ok(last > first, "the dose does not build at all");
  // Monotone: it climbs and then holds, it never falls back.
  for (let i = 1; i < doses.length; i++) {
    assert.ok(doses[i]! >= doses[i - 1]!,
      `the dose went backwards: ${doses[i - 1]} → ${doses[i]} at sprint day ${i + 1}`);
  }
});

test("BLOCKER: no sprints on a deload, in the taper, or for a runner returning from injury", () => {
  // Each refusal is one the easy-run flavours already honour, and the returning one is the reason that
  // rule exists at all - tissue is what is still healing.
  const weeks = plan();
  for (const w of weeks) {
    if (w.isDeload) assert.equal(sprintDay(w), undefined, `week ${w.index} is a deload and carries the sprint day`);
    if (w.phase === "taper") assert.equal(sprintDay(w), undefined, `week ${w.index} is a taper week and carries the sprint day`);
  }
  const returning = plan(athlete({ returningFromInjury: true }));
  const anySprintDay = returning.filter((w) => sprintDay(w) !== undefined);
  assert.equal(anySprintDay.length, 0,
    `a runner returning from injury was given the sprint day in ${anySprintDay.length} weeks`);
});

test("BLOCKER: the sprints are HELD through the sharpening phase, not dropped at the end of build", () => {
  // A block that removes its neuromuscular work exactly when the racing starts spends its last month
  // losing what it built. The old gate was base/build only.
  const weeks = plan();
  const peak = weeks.filter((w) => w.phase === "peak" && eligible(w));
  assert.ok(peak.length >= 2, `only ${peak.length} eligible peak weeks to judge`);
  const withHills = peak.filter(hillWeek).length;
  assert.ok(withHills >= Math.ceil(peak.length * 0.6),
    `hill work survives in only ${withHills} of ${peak.length} eligible peak weeks`);
});

test("BLOCKER: a week whose quality session is already hill work does not also get the sprint day", () => {
  // Five quality formats are hill sessions, up to 10 x 50 m maximal reps - the heaviest connective-
  // tissue load in the library. A week that draws one and ALSO gets the sprint day asks the same
  // tissue twice. The sprint day is the smaller dose, so it gives way.
  let checked = 0;
  for (const daysPerWeek of [4, 5, 6]) {
    for (const distance of ["5k", "10k", "half"] as const) {
      for (const w of plan(athlete({ daysPerWeek }), goal({ distance }))) {
        const qualityHill = w.sessions.some(
          (s) => (s.type === "vo2" || s.type === "threshold") && unpacedReps(s) > 0,
        );
        if (!qualityHill) continue;
        checked++;
        assert.equal(sprintDay(w), undefined,
          `${distance}/${daysPerWeek}d week ${w.index}: a hill quality session AND the sprint day`);
      }
    }
  }
  assert.ok(checked >= 3,
    `the sweep found only ${checked} weeks with a hill quality session — it cannot see the defect`);
});

test("BLOCKER: relaxed strides survive the sprint day, at every day-count", () => {
  // ⚠️ THIS IS THE REGRESSION THE CHANGE ACTUALLY SHIPPED ONCE. The sprint day took the first easy
  // slot every week, so a plan could contain NO relaxed-strides session anywhere - and
  // `sessionLibrary`'s representative for "Easy + Strides" in the build-your-own picker then becomes
  // the maximal hill-sprint session, handing a runner who asked for strides a set of sprints.
  // Measured on a 4-day 5 km block before the fix: 24 strides-typed sessions, not one of them strides.
  // ⚠️ The 4-day case is the discriminating one and a 3-day fixture cannot see it: the rotation index
  // is `index + ei` and the pool is EIGHT long while deloads fall every FOUR weeks, so for an odd `ei`
  // the strides position aliases exactly onto the deload weeks, where the pool has no strides in it.
  for (const daysPerWeek of [3, 4, 5, 6]) {
    const weeks = plan(athlete({ daysPerWeek }), goal({ distance: "5k" }));
    const realStrides = weeks.flatMap((w) => w.sessions)
      .filter((s) => s.type === "strides" && pacedReps(s) > 0);
    assert.ok(realStrides.length >= 1,
      `${daysPerWeek}d: the plan contains no relaxed-strides session at all, so the custom-run ` +
      "picker's representative for Easy + Strides can only be a hill-sprint session");
  }
});

test("the builder's default dose is the maintenance load, so every existing caller is unchanged", () => {
  // The rep count became a parameter. Its default has to be what the constant was, or every other
  // caller's session quietly changed size.
  const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
  const dflt = easyHillStrides(paces, 40);
  assert.equal(unpacedReps(dflt), 6, "the default dose is no longer the 6-sprint maintenance load");
  assert.equal(unpacedReps(easyHillStrides(paces, 40, 2)), 2, "the dose parameter is not honoured");
  assert.equal(unpacedReps(easyHillStrides(paces, 40, 9)), 9, "the dose parameter is capped somewhere it should not be");
});
