import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek, SessionOutcome } from "../src/domain/types.ts";
import { sessionVolumeMeters, weekVolumeMeters } from "../src/domain/steps.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { applyMissedSessionAdjustment } from "../src/adapt/missed-sessions.ts";
import { applyInjuryAdjustment } from "../src/adapt/injury.ts";

/**
 * ⚠️ ONE DEFINITION OF A WEEK'S MILEAGE.
 *
 * When `trainingDistanceMeters` arrived with the volume reframing (a warm-up is not training load),
 * `generate-plan.ts` was updated in six places and the two adaptation modules were not — they kept
 * summing `estimatedDistanceMeters`, the whole outing. So an adjusted week came back measured on a
 * different scale from every other week in the same plan. `test/adaptation.test.ts`'s "volume should
 * fall" caught it, and it had been failing for days looking like an adaptation bug rather than an
 * accounting one — the re-entry week reported 40.9 → 44.1 km while every session in it got shorter.
 */
const RACE_M: Record<string, number> = { "5k": 5000, "10k": 10000, half: 21097, marathon: 42195 };
const goalFor = (distance: keyof typeof RACE_M, recentS: number): Goal => ({
  distance: distance as Goal["distance"],
  // ⚠️ REQUIRED, and it is what makes this sweep valid. Omitting it — as an early probe did — leaves
  // `paces.goalRace` with null bounds, so distance-gated race-pace reps cannot be timed and the
  // session's duration is NaN. The type says `number`, the app always computes one; a test that
  // passes an invalid Goal measures a plan no runner can have.
  targetTimeSeconds: Math.round(recentS * Math.pow(RACE_M[distance]! / 5000, 1.06)),
  raceDateIso: "2027-06-06",
  startDateIso: "2026-08-07",
});
const miss = (n: number): SessionOutcome[] =>
  Array.from({ length: n }, (_, i) => ({ sessionId: `s${i}`, dateIso: "2026-08-01", completed: false }));

function* plans() {
  for (const experience of ["recreational", "competitive"] as const)
    for (const distance of ["5k", "10k", "half", "marathon"] as const)
      for (const daysPerWeek of [3, 4, 5, 6])
        for (const recentS of [1200, 1500, 1800]) {
          const athlete: Athlete = {
            daysPerWeek, experience, recent: { distanceMeters: 5000, timeSeconds: recentS },
            includeStrength: true,
          };
          const goal = goalFor(distance, recentS);
          yield {
            where: `${distance} ${daysPerWeek}d ${experience} ${recentS}s`,
            plan: generatePlan(athlete, goal), goal, athlete,
          };
        }
}

test("⚠️ an adjusted week is measured the same way as every other week", () => {
  // The heart of it. Not "is the number smaller" but "is it the same KIND of number" — recompute the
  // adjusted week's total independently and require the module to agree.
  let checked = 0;
  for (const { where, plan } of plans()) {
    for (const week of plan.weeks) {
      const res = applyMissedSessionAdjustment(week, miss(2));
      if (!res.triggered) continue;
      checked++;
      assert.equal(res.week.plannedDistanceMeters, weekVolumeMeters(res.week.sessions),
        `${where}: the re-entry week's total is not the sum of its sessions' training distance`);
    }
  }
  assert.ok(checked > 500, `only ${checked} weeks swept — the sweep has stopped sweeping`);
});

test("⚠️ re-entry after missed sessions makes the week SMALLER, in km and in minutes", () => {
  // ⚠️ Both rulers. The plan is built in minutes and displayed in kilometres, and a session with
  // little counted distance for its duration (hill sprints are 0.5 km for 39 minutes) can make one
  // move while the other does not. The audit's own lesson: check which of the two a volume defect
  // lives in before believing it.
  const mins = (w: PlannedWeek) =>
    w.sessions.reduce((m, s) => m + (s.estimatedDurationSeconds || 0), 0) / 60;
  let checked = 0, roseKm = 0, roseMin = 0;
  for (const { plan } of plans()) {
    for (const week of plan.weeks) {
      if (!week.sessions.some((s) => ["vo2", "threshold", "race-specific"].includes(s.type))) continue;
      const res = applyMissedSessionAdjustment(week, miss(2));
      if (!res.triggered) continue;
      checked++;
      if (res.week.plannedDistanceMeters >= week.plannedDistanceMeters) roseKm++;
      if (mins(res.week) > mins(week)) roseMin++;
    }
  }
  assert.ok(checked > 500, `only ${checked} weeks swept`);
  // ⚠️ Thresholds set FROM MEASUREMENT, not taste. Before the accounting fix this sweep read
  // 61% rising on distance; after, 11% — and those remaining are the honest case where a demoted
  // hill or race-pace session covered very little ground for its duration, so replacing it with easy
  // running adds kilometres while removing work. Minutes, the better ruler, sit at 4%.
  assert.ok(roseKm / checked < 0.20, `${(100 * roseKm / checked).toFixed(0)}% of re-entry weeks grew in km`);
  assert.ok(roseMin / checked < 0.10, `${(100 * roseMin / checked).toFixed(0)}% of re-entry weeks grew in minutes`);
});

test("an injury cut moves the week's mileage, not just the session cards", () => {
  // ⚠️ Scaling only `estimatedDistanceMeters` left `trainingDistanceMeters` untouched — and since the
  // total prefers the training figure, a "cut volume to 60%" changed the cards and the week's total
  // by nothing at all.
  let checked = 0;
  for (const { where, plan, athlete, goal } of plans()) {
    const paces = deriveTrainingPaces(athlete.recent, goal);
    const i = plan.weeks.findIndex((w) => w.phase === "build" && !w.isDeload);
    if (i < 0) continue;
    const before = plan.weeks[i]!.plannedDistanceMeters;
    if (before <= 0) continue;
    const res = applyInjuryAdjustment(
      plan.weeks, i,
      { region: "calf", severity: "moderate", painWhileRunning: false, reportedOnIso: "2026-08-01" },
      paces, 2,
    );
    if (res.assessment.action !== "reduce") continue;
    const after = res.weeks[i]!.plannedDistanceMeters;
    assert.ok(after < before, `${where}: injury week ${before} -> ${after} m, no cut`);
    // ⚠️ THE REAL INVARIANT, and the first version of this test did not have it. Comparing the week's
    // total to `weekVolumeMeters(its own sessions)` is a value asserted against itself — it holds
    // however the sessions were scaled, so the test passed with the fix deliberately removed. What
    // must be true is that a session which was SCALED had both of its distance figures scaled by the
    // same factor; otherwise the card says 60% and the mileage says 100%.
    for (const s of res.weeks[i]!.sessions) {
      const b = plan.weeks[i]!.sessions.find((x) => x.id === s.id);
      if (!b || b.title !== s.title) continue;            // replaced, not scaled — a different path
      if (b.estimatedDistanceMeters == null || b.trainingDistanceMeters == null) continue;
      if (!s.estimatedDistanceMeters || !s.trainingDistanceMeters) continue;
      checked++;
      const est = s.estimatedDistanceMeters / b.estimatedDistanceMeters;
      const train = s.trainingDistanceMeters / b.trainingDistanceMeters;
      assert.ok(Math.abs(est - train) < 0.02,
        `${where}: "${s.title}" scaled its shown distance ×${est.toFixed(2)} but its counted distance ×${train.toFixed(2)}`);
    }
  }
  assert.ok(checked > 20, `only ${checked} scaled sessions swept`);
});

test("⚠️ one unusable session degrades itself, never the whole plan", () => {
  // ⚠️ The compensation reference is a MEAN over the plan's quality sessions, so one non-finite
  // duration made the mean non-finite — and its consumer's guard was `!= null`, which NaN passes.
  // Every compensating easy run in a 36-week block then came out NaN and was titled "NaN′ easy run".
  // Reachable only by an invalid Goal (targetTimeSeconds is required and the app always computes
  // one), so no runner saw it — but a single bad session must never be able to rewrite a whole plan.
  // ⚠️ SWEEP, AND COUNT WHAT ACTUALLY MOVES. The first version of this test checked ONE plan and
  // filtered on `type === "easy"`, and passed with the guards deliberately removed — twice. Neither
  // choice was measured first: most configurations do not amplify at all, and the sessions that do
  // inherit the NaN are typed `strides` and `recovery`, which the filter excluded. A guard has to be
  // watched failing before it is believed, and this one had to be rewritten to earn that.
  let total = 0, bad = 0;
  for (const experience of ["recreational", "competitive"] as const)
    for (const distance of ["5k", "10k", "half", "marathon"] as const)
      for (const daysPerWeek of [3, 4, 5, 6]) {
        const athlete: Athlete = {
          daysPerWeek, experience, includeStrength: true,
          recent: { distanceMeters: 5000, timeSeconds: 1500 },
        };
        const broken = { distance, raceDateIso: "2027-06-06", startDateIso: "2026-08-07" } as unknown as Goal;
        for (const w of generatePlan(athlete, broken).weeks)
          for (const s of w.sessions) {
            total++;
            if (!Number.isFinite(s.estimatedDurationSeconds) || /NaN/.test(s.title)) bad++;
          }
      }
  assert.ok(total > 5000, `only ${total} sessions swept`);
  // ⚠️ Threshold FROM MEASUREMENT: contained it is 0.9%, uncontained 15.5%. Those that remain are the
  // race-pace sessions whose own reps genuinely cannot be timed — the input really is broken, and one
  // bad session SHOULD be bad. What must not happen is it reaching everything else.
  assert.ok(bad / total < 0.05,
    `${bad} of ${total} sessions (${(100 * bad / total).toFixed(1)}%) are unusable — one bad input has spread across the plan`);
});

test("the shared helper is what the generator itself uses", () => {
  // A helper nobody calls is not one definition, it is a third one.
  for (const { where, plan } of plans()) {
    for (const week of plan.weeks) {
      assert.equal(week.plannedDistanceMeters, weekVolumeMeters(week.sessions),
        `${where} week ${week.index}: the generator's own total disagrees with the shared helper`);
    }
    break;
  }
  // And the per-session accessor must prefer the training figure where one exists.
  const s = { trainingDistanceMeters: 100, estimatedDistanceMeters: 999 } as never;
  assert.equal(sessionVolumeMeters(s), 100, "the accessor is not preferring the training figure");
  assert.equal(sessionVolumeMeters({ estimatedDistanceMeters: 999 } as never), 999,
    "a session with no training figure must still count for something");
});
