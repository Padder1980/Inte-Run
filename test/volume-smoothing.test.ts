import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { computeDistribution, honoursModel } from "../src/science/intensity-distribution.ts";

/**
 * ⚠️ THE EASY RUNNING ABSORBS HOW BIG THIS WEEK'S QUALITY SESSION HAPPENS TO BE (2026-08-06 audit).
 *
 * The quality slot's size swings with whichever format the rotation lands on, and nothing compensated.
 * Measured on a 3-day 5 km block: 22.4 → 16.6 → 24.2 km across three weeks with the middle one NOT a
 * deload — because week 6's session was `10 × 50 m hill sprints` (39 minutes, 0.50 km counted, since
 * effort-only hill work carries no pace and its walk-backs no distance) against week 7's `2 × 15′
 * threshold` at 7.94 km. A 7.4 km swing, 37% of the week, decided by a rotation blind to volume.
 *
 * ⚠️ THREE RULES, AND EACH OF THE FIRST TWO WAS LEARNED BY BREAKING SOMETHING:
 *   1. Compensate in MINUTES, never by inventing distance — a synthetic distance for hill sprints would
 *      be a fabricated number in the runner's logbook and in the mileage they are judged against.
 *   2. FILL HOLES, NEVER SHAVE PEAKS. Symmetric compensation removed easy running from big-quality weeks
 *      and measured as a clear regression: weeks under the pyramidal floor 18 → 83, deloads shallower,
 *      the biggest week leaving the peak phase 5.5% more often. Removing easy running from a hard week
 *      is exactly how the easy floor breaks.
 *   3. LEAVE DELOADS AND THE TAPER ALONE. Both are deliberately smaller; a compensator reads them as
 *      holes and undoes them. The taper case was caught by `the taper genuinely cuts the week` at 29%
 *      against its 30% floor.
 */
const RUN = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const runMinutes = (w: PlannedWeek) =>
  w.sessions.filter((s) => RUN.has(s.type)).reduce((a, s) => a + (s.estimatedDurationSeconds ?? 0), 0) / 60;
const km = (w: PlannedWeek) => w.plannedDistanceMeters / 1000;

const athlete = (days: number): Athlete => ({
  daysPerWeek: days,
  recent: { distanceMeters: 10000, timeSeconds: 2400 },
  experience: "recreational",
  includeStrength: false,
  returningFromInjury: false,
});
const goal = (distance: Goal["distance"], targetTimeSeconds: number, raceDateIso = "2027-03-07"): Goal =>
  ({ distance, targetTimeSeconds, raceDateIso, startDateIso: "2026-08-03" });
const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };

/** Non-deload, non-taper transitions, skipping the partial first week. */
function transitions(p: { weeks: PlannedWeek[] }) {
  const full = p.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
  const out: { from: PlannedWeek; to: PlannedWeek }[] = [];
  for (let i = 1; i < full.length; i++) {
    if (full[i]!.isDeload || full[i - 1]!.isDeload || full[i]!.phase === "taper") continue;
    out.push({ from: full[i - 1]!, to: full[i]! });
  }
  return out;
}

test("the weekly volume line does not saw-tooth", () => {
  // The headline. Before compensation this was 15.7% of transitions on counted distance across the
  // sweep; the guard is set well inside that so a real regression trips it, without pinning the exact
  // figure a session-library change would legitimately move.
  let over = 0, n = 0, worst = 0, worstWho = "";
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, TT[distance]!));
      for (const { from, to } of transitions(p)) {
        n++;
        const r = km(from) > 0 ? km(to) / km(from) : 1;
        if (r > 1.10) over++;
        if (r > worst) { worst = r; worstWho = `${distance}/${days}d wk${to.index} ${km(from).toFixed(1)}→${km(to).toFixed(1)}km`; }
      }
    }
  }
  assert.ok(n > 100, "not enough transitions measured to mean anything");
  assert.ok(over / n < 0.14, `${((over / n) * 100).toFixed(1)}% of weeks rise more than 10% — the volume line is saw-toothing again`);
  assert.ok(worst < 1.45, `worst single jump ${worst.toFixed(2)}x — ${worstWho}`);
});

test("a week whose quality session is tiny is not a hole in the volume line", () => {
  // ⚠️ The specific shape of the original defect: a hill-sprint week next to a threshold week. Measured
  // in TIME, because that is what the plan is actually built in and what the compensation adjusts.
  for (const days of [3, 4, 5]) {
    const p = generatePlan(athlete(days), goal("5k", TT["5k"]!));
    for (const { from, to } of transitions(p)) {
      const drop = runMinutes(from) > 0 ? runMinutes(to) / runMinutes(from) : 1;
      assert.ok(drop > 0.78,
        `5k/${days}d wk${to.index}: training time fell ${((1 - drop) * 100).toFixed(0)}% in a week that is not a deload`);
    }
  }
});

test("the easy floor still holds across the sweep", () => {
  // ⚠️ AN HONEST NAME, AFTER TWO ATTEMPTS AT A DISHONEST ONE. This started as "it never SHAVES a
  // big-quality week", comparing the easy minutes of the lightest- and heaviest-quality build weeks —
  // and PASSED under the symmetric compensation, the very bug it was named for, because the easy-run
  // ramp varies by week and swamped the comparison. Rewritten to measure the easy floor instead, it
  // STILL passed under that bug at 16 plans and again at 256: the profiles that breach live in runway
  // lengths this test does not sweep, and the 18 → 83 jump only shows up across the full 768-plan audit.
  //
  // So this is NOT the guard that caught the symmetric version — `deloads and the taper are left alone`
  // is, and `tools/audit-progression.mjs` is what measured it. This is kept as a broad invariant, named
  // for what it actually does. A test whose name claims a sensitivity it does not have is worse than no
  // test, because the next person trusts it.
  let weeks = 0, breaches = 0, worstEasy = 1;
  // ⚠️ The sweep has to be WIDE ENOUGH TO CONTAIN THE BREACHING PROFILES. A first cut swept only four
  // distances at four day-counts — 16 plans — and passed under the symmetric compensation that produced
  // 83 breaches across the full 768-plan audit, because none of those 16 was one of the profiles that
  // breaks. Slow runners on few days are where the easy fraction gets tight, so they must be in here.
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) for (const tenK of [2400, 3600]) for (const vol of [null, 40]) {
      const a = { ...athlete(days), recent: { distanceMeters: 10000, timeSeconds: tenK },
                  ...(vol ? { weeklyVolumeKmCurrent: vol } : {}) };
      const p = generatePlan(a, goal(distance, TT[distance]!));
      for (const w of p.weeks) {
        if (w.sessions.some((s) => s.type === "race")) continue;
        const d = computeDistribution(w.sessions);
        if (!d || !Number.isFinite(d.easy)) continue;
        weeks++;
        if (!honoursModel(d, p.intensityModel)) breaches++;
        if (d.easy < worstEasy) worstEasy = d.easy;
      }
    }
  }
  assert.ok(weeks > 200, "not enough weeks measured to mean anything");
  assert.ok(breaches / weeks < 0.01,
    `${breaches} of ${weeks} weeks breach the easy floor (worst ${(worstEasy * 100).toFixed(1)}% easy) — ` +
    `smoothing is taking easy running out of hard weeks`);
});

test("deloads and the taper are left alone — they are meant to be smaller", () => {
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    const p = generatePlan(athlete(5), goal(distance, TT[distance]!));
    const full = p.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
    // A deload must still be clearly smaller than the week before it.
    for (let i = 1; i < full.length; i++) {
      if (!full[i]!.isDeload) continue;
      assert.ok(km(full[i]!) < km(full[i - 1]!) * 0.95,
        `${distance}: deload week ${full[i]!.index} is not meaningfully smaller than the week before it`);
    }
    // And the taper must still cut hard against peak.
    const peak = Math.max(...full.map(km));
    const tw = p.weeks.filter((w) => w.phase === "taper");
    if (tw.length > 1) {
      const lastFull = tw[tw.length - 2]!;
      assert.ok(km(lastFull) < peak * 0.75,
        `${distance}: the last full taper week is only ${((1 - km(lastFull) / peak) * 100).toFixed(0)}% below peak`);
    }
  }
});

test("no easy run is distorted past the bounds it already had", () => {
  // The compensation is clamped to ±30% of the run it adjusts and stays inside the existing 20/95 floor
  // and ceiling — otherwise filling a hole becomes a bigger swing than the one it removed.
  for (const distance of ["5k", "marathon"] as const) {
    for (const days of [3, 6]) {
      const p = generatePlan(athlete(days), goal(distance, TT[distance]!));
      for (const w of p.weeks) {
        for (const s of w.sessions) {
          if (s.type !== "easy" && s.type !== "recovery" && s.type !== "strides") continue;
          const m = (s.estimatedDurationSeconds ?? 0) / 60;
          if (!m) continue;
          assert.ok(m >= 15 && m <= 125,
            `${distance}/${days}d wk${w.index}: "${s.title}" is ${m.toFixed(0)} minutes`);
        }
      }
    }
  }
});
