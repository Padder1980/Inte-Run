import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete, Goal, PlannedWeek } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";

/**
 * ⚠️ A DELOAD CUTS VOLUME AND KEEPS THE HARD SESSION (owner's constraint, 2026-08-06: deepen the
 * deloads, but "I don't want users thinking the plan isn't challenging enough").
 *
 * The 2026-08-06 audit measured deloads cutting only 13.2% of a 5 km week against the week before — not
 * an absorb week, a slightly quieter one. Three levers were changed together, and the pairing is the
 * point: the week gets materially lighter while the intensity stays, which is the same bargain the taper
 * already strikes.
 *   - `selectFormat` now PREFERS the "small" formats on a deload, not merely non-"big" ones.
 *   - The long run's deload multiplier went 0.75 → 0.68 and the easy runs 35 → 32 minutes.
 *   - The quality session COUNT was already 1 on a deload, and stays 1. It is never dropped.
 *
 * Measured result: mean cut 17.8% → 26.5%, with the easy floor untouched (2 breaches in 19,200 weeks
 * either way) precisely because the hard session got shorter as the volume fell.
 */
const athlete = (days: number): Athlete => ({
  daysPerWeek: days,
  recent: { distanceMeters: 10000, timeSeconds: 2400 },
  experience: "recreational",
  includeStrength: false,
  returningFromInjury: false,
});
const goal = (distance: Goal["distance"], targetTimeSeconds: number): Goal =>
  ({ distance, targetTimeSeconds, raceDateIso: "2027-03-07", startDateIso: "2026-08-03" });
const TT: Record<string, number> = { "5k": 1500, "10k": 3000, half: 6600, marathon: 14400 };
const km = (w: PlannedWeek) => w.plannedDistanceMeters / 1000;
const QUALITY = new Set(["threshold", "vo2", "race-specific"]);

/** Each deload paired with the week immediately before it, skipping the partial first week. */
function deloadPairs(p: { weeks: PlannedWeek[] }) {
  const full = p.weeks.filter((w, i) => i > 0 && !w.sessions.some((s) => s.type === "race"));
  const out: { before: PlannedWeek; deload: PlannedWeek }[] = [];
  for (let i = 1; i < full.length; i++) if (full[i]!.isDeload) out.push({ before: full[i - 1]!, deload: full[i]! });
  return out;
}

test("a deload is a real absorb week, not a slightly quieter one", () => {
  const cuts: number[] = [];
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, TT[distance]!));
      for (const { before, deload } of deloadPairs(p)) {
        if (km(before) <= 0) continue;
        cuts.push(1 - km(deload) / km(before));
      }
    }
  }
  assert.ok(cuts.length > 40, `only ${cuts.length} deloads measured`);
  const mean = cuts.reduce((a, b) => a + b, 0) / cuts.length;
  // ⚠️ 0.22 IS CHOSEN FROM MEASUREMENT, NOT TASTE. On this sweep the shallow version measures 18.8% and
  // the deepened one 27.2%, so the threshold sits with roughly four points of margin on either side. My
  // first attempt used 0.18 — below the shallow figure — so the test passed on the very code it was
  // written to reject. Re-break the fix and watch a guard fail before believing it.
  assert.ok(mean > 0.22, `deloads cut only ${(mean * 100).toFixed(1)}% on average — that is not an absorb week`);
  // ⚠️ And an upper bound, which is the owner's constraint made testable: a deload is a lighter week,
  // not a week off. Past roughly 45% the runner is being asked to stop rather than to absorb.
  assert.ok(mean < 0.45, `deloads cut ${(mean * 100).toFixed(1)}% on average — that reads as a week off`);
});

test("every deload keeps a genuine hard session — the plan never goes soft", () => {
  // ⚠️ THE OWNER'S CONSTRAINT, MADE INTO AN INVARIANT. A deload that drops the quality session entirely
  // reads as the plan losing its nerve, and a runner who does not trust the easy week is the one who
  // rides through it and reaches the peak phase already tired.
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, TT[distance]!));
      for (const { deload } of deloadPairs(p)) {
        const hard = deload.sessions.filter((s) => QUALITY.has(s.type));
        assert.equal(hard.length, 1,
          `${distance}/${days}d week ${deload.index}: a deload should carry exactly one quality session, found ${hard.length}`);
      }
    }
  }
});

test("on a low-frequency week the easing comes out of the easy running and the long run", () => {
  // The shape that satisfies both halves of the ask: the volume eases, the hard session does not.
  //
  // ⚠️ COMPARED ONLY WHERE THE QUALITY COUNT IS UNCHANGED, and the reason is a real structural quirk
  // worth knowing. When a deload drops a week from two quality sessions to one, it converts a quality
  // day into an EASY day — so the week's easy minutes can go UP even as every run gets shorter
  // (measured: 108′ → 121′ on a 4-day peak deload). That week still eases properly overall, because a
  // whole quality session left it; it just does not ease in this particular column. Scoping by
  // days-per-week was my first attempt and it was wrong: a 4-day PEAK week carries two quality sessions
  // too, so the condition is about the sessions, not the days. State the condition you actually mean.
  let compared = 0;
  for (const distance of ["5k", "10k", "half", "marathon"] as const) {
    for (const days of [3, 4, 5, 6]) {
      const p = generatePlan(athlete(days), goal(distance, TT[distance]!));
      for (const { before, deload } of deloadPairs(p)) {
        const qCount = (w: PlannedWeek) => w.sessions.filter((s) => QUALITY.has(s.type)).length;
        if (qCount(before) !== qCount(deload)) continue;
        const easyMin = (w: PlannedWeek) => w.sessions
          .filter((s) => s.type === "easy" || s.type === "recovery" || s.type === "strides" || s.type === "long")
          .reduce((a, s) => a + (s.estimatedDurationSeconds ?? 0), 0) / 60;
        compared++;
        assert.ok(easyMin(deload) < easyMin(before) * 0.92,
          `${distance}/${days}d week ${deload.index}: the easy + long running barely eased ` +
          `(${easyMin(before).toFixed(0)}′ → ${easyMin(deload).toFixed(0)}′)`);
      }
    }
  }
  assert.ok(compared > 20, `only ${compared} like-for-like deloads compared — this test is not covering much`);
});

test("the deload's own wording does not read as the plan going easy", () => {
  // ⚠️ Half of this problem is language. "Deload — recover and absorb training" is accurate and sounds
  // like a week off; the runner needs to know the hard session is still there and why the week is light.
  const p = generatePlan(athlete(5), goal("half", TT.half!));
  const focus = p.weeks.find((w) => w.isDeload)?.focus ?? "";
  assert.ok(focus.length > 0, "a deload week has no focus text at all");
  assert.match(focus, /hard session|work lands|fitness/i,
    `the deload reads as a rest week rather than a deliberate part of the plan: "${focus}"`);
});
