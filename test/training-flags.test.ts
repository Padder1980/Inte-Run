import assert from "node:assert/strict";
import { test } from "node:test";
import type { RunObservation } from "../src/adapt/training-flags.ts";
import { assessTrainingFlags } from "../src/adapt/training-flags.ts";

// A 25:00 5K runner. Easy band used throughout: 6:15–6:50/km (375–410 s/km), RPE 2–3.
const CURRENT = 1500;
const BAND = { minSecPerKm: 375, maxSecPerKm: 410 };
const RPE = { min: 2, max: 3 };

let seq = 0;
function run(over: Partial<RunObservation> = {}): RunObservation {
  return {
    id: "r" + seq++,
    type: "easy",
    distKm: 6,
    avgPaceSecPerKm: 390, // comfortably in band
    plannedPaceSecPerKm: BAND,
    reportedRpe: null,
    plannedRpe: RPE,
    implied5kSeconds: null,
    ...over,
  };
}
const opts = { currentRecent5kSeconds: CURRENT };

// ---- pace flag ------------------------------------------------------------

test("two consecutive fast runs raise pace-fast with an implied-pace anchor", () => {
  const fast = { avgPaceSecPerKm: 350, implied5kSeconds: 1380 }; // 25 s/km under band floor
  const r = assessTrainingFlags([run(fast), run(fast)], opts);
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0]!.kind, "pace-fast");
  assert.equal(r.flags[0]!.runs.length, 2);
  assert.equal(r.flags[0]!.meanDeviation, 25);
  assert.deepEqual(r.suggestion, {
    action: "anchor", direction: "faster", proposedRecent5kSeconds: 1380, basis: "pace",
  });
});

test("one fast run alone raises nothing — the streak needs 2+", () => {
  const r = assessTrainingFlags([run({ avgPaceSecPerKm: 340 }), run()], opts);
  assert.equal(r.flags.length, 0);
  assert.equal(r.suggestion, null);
});

test("an in-band run between two fast ones breaks the streak", () => {
  const fast = { avgPaceSecPerKm: 350 };
  const r = assessTrainingFlags([run(fast), run(), run(fast)], opts);
  assert.equal(r.flags.length, 0);
});

test("two consecutive slow runs raise pace-slow and propose easing", () => {
  const slow = { avgPaceSecPerKm: 440, implied5kSeconds: 1640 }; // 30 s/km over the band ceiling
  const r = assessTrainingFlags([run(slow), run(slow)], opts);
  assert.equal(r.flags[0]!.kind, "pace-slow");
  assert.equal(r.suggestion!.action, "anchor");
  assert.equal((r.suggestion as any).direction, "slower");
  assert.equal((r.suggestion as any).proposedRecent5kSeconds, 1640);
});

test("pace inside the tolerance zone does not classify as fast", () => {
  // Band floor 375, tolerance max(8, 11.25) = 11.25 → 366 is inside the tolerance zone.
  const r = assessTrainingFlags([run({ avgPaceSecPerKm: 366 }), run({ avgPaceSecPerKm: 366 })], opts);
  assert.equal(r.flags.length, 0);
});

test("interval sessions and short runs never qualify for the pace signal", () => {
  const vo2 = run({ type: "vo2", avgPaceSecPerKm: 300 });
  const shortie = run({ avgPaceSecPerKm: 300, distKm: 1.0 });
  const r = assessTrainingFlags([vo2, shortie, run({ avgPaceSecPerKm: 300 })], opts);
  assert.equal(r.flags.length, 0); // only one qualifying fast run — no streak
});

test("mixed directions break the streak rather than flagging", () => {
  const r = assessTrainingFlags(
    [run({ avgPaceSecPerKm: 350 }), run({ avgPaceSecPerKm: 440 })],
    opts,
  );
  assert.equal(r.flags.length, 0);
});

// ---- RPE flag ---------------------------------------------------------------

test("two consecutive hard-feeling runs raise rpe-high and propose easing", () => {
  const hard = { reportedRpe: 5 }; // band max 3, so +2
  const r = assessTrainingFlags([run(hard), run(hard)], opts);
  assert.equal(r.flags.length, 1);
  assert.equal(r.flags[0]!.kind, "rpe-high");
  assert.equal(r.flags[0]!.meanDeviation, 2);
  const s = r.suggestion as any;
  assert.equal(s.direction, "slower");
  assert.equal(s.basis, "rpe");
  // +2 over → 8% cap: 1500 * 1.08 = 1620
  assert.equal(s.proposedRecent5kSeconds, 1620);
});

test("reported RPE exactly one point over the band counts; within the band does not", () => {
  const over = assessTrainingFlags([run({ reportedRpe: 4 }), run({ reportedRpe: 4 })], opts);
  assert.equal(over.flags[0]!.kind, "rpe-high");
  const inBand = assessTrainingFlags([run({ reportedRpe: 3 }), run({ reportedRpe: 3 })], opts);
  assert.equal(inBand.flags.length, 0);
});

test("two easier-than-intended runs raise rpe-low with a conservative nudge", () => {
  const cruisy = { type: "threshold", plannedRpe: { min: 6, max: 7 }, reportedRpe: 4 }; // 2 under
  const r = assessTrainingFlags([run(cruisy), run(cruisy)], opts);
  assert.equal(r.flags[0]!.kind, "rpe-low");
  const s = r.suggestion as any;
  assert.equal(s.direction, "faster");
  // −min(5%, 2.5%·2) = −5%: 1500 * 0.95 = 1425
  assert.equal(s.proposedRecent5kSeconds, 1425);
});

test("runs without a reported RPE are skipped, not treated as in-band", () => {
  const hard = { reportedRpe: 5 };
  const silent = { reportedRpe: null };
  const r = assessTrainingFlags([run(hard), run(silent), run(hard)], opts);
  assert.equal(r.flags[0]!.kind, "rpe-high"); // the silent run doesn't break the streak
  assert.equal(r.flags[0]!.runs.length, 2);
});

test("strength sessions never qualify for the RPE signal", () => {
  const lift = run({ type: "strength", reportedRpe: 9 });
  const r = assessTrainingFlags([lift, lift, lift], opts);
  assert.equal(r.flags.length, 0);
});

// ---- combined signals -------------------------------------------------------

test("faster than planned AND harder than intended is advice, not a plan change", () => {
  const overcooked = { avgPaceSecPerKm: 350, implied5kSeconds: 1380, reportedRpe: 5 };
  const r = assessTrainingFlags([run(overcooked), run(overcooked)], opts);
  assert.equal(r.flags.length, 2);
  assert.deepEqual(r.suggestion, { action: "advice-easy-days" });
});

test("slower AND easier is contradictory — flags reported, nothing suggested", () => {
  const odd = { avgPaceSecPerKm: 440, reportedRpe: 1, plannedRpe: { min: 2, max: 3 } };
  const r = assessTrainingFlags([run(odd), run(odd)], opts);
  assert.equal(r.flags.length, 2);
  assert.equal(r.suggestion, null);
});

test("slower AND harder agree — pace evidence wins the anchor", () => {
  const struggling = { avgPaceSecPerKm: 440, implied5kSeconds: 1650, reportedRpe: 5 };
  const r = assessTrainingFlags([run(struggling), run(struggling)], opts);
  const s = r.suggestion as any;
  assert.equal(s.direction, "slower");
  assert.equal(s.basis, "pace");
  assert.equal(s.proposedRecent5kSeconds, 1650);
});

// ---- guard rails --------------------------------------------------------------

test("the proposed anchor is clamped to ±15% of the current one", () => {
  const wild = { avgPaceSecPerKm: 300, implied5kSeconds: 900 }; // implies a 15:00 5K
  const r = assessTrainingFlags([run(wild), run(wild)], opts);
  assert.equal((r.suggestion as any).proposedRecent5kSeconds, Math.round(CURRENT * 0.85));
});

test("a proposal within 1% of the current anchor is dropped as not worth asking", () => {
  // Fast beyond tolerance (needs < 363.75) but implying ~current fitness.
  const marginal = { avgPaceSecPerKm: 362, implied5kSeconds: 1495 };
  const r = assessTrainingFlags([run(marginal), run(marginal)], opts);
  assert.equal(r.flags.length, 1);
  assert.equal(r.suggestion, null);
});

test("the absolute anchor ceiling never produces a 'slower' proposal that is faster", () => {
  // A very slow anchor (63:03) with slower-than-planned runs: easing would exceed the 3600s ceiling,
  // so the clamp would otherwise hand back 3600 — faster than current, the opposite of the advice.
  const slow = { avgPaceSecPerKm: 800, implied5kSeconds: 4400, plannedPaceSecPerKm: { minSecPerKm: 700, maxSecPerKm: 740 } };
  const r = assessTrainingFlags([run(slow), run(slow)], { currentRecent5kSeconds: 4000 });
  assert.equal(r.flags[0]!.kind, "pace-slow");
  assert.equal(r.suggestion, null);
});

test("an rpe-high nudge above the ceiling is dropped rather than inverted", () => {
  const hard = { reportedRpe: 6 };
  const r = assessTrainingFlags([run(hard), run(hard)], { currentRecent5kSeconds: 3800 });
  assert.equal(r.flags[0]!.kind, "rpe-high");
  assert.equal(r.suggestion, null);
});

test("implied times that contradict the flag direction are refused, not shown", () => {
  // Stale evidence: runs classified fast against an old band but implying a SLOWER 5K than current.
  const odd = { avgPaceSecPerKm: 350, implied5kSeconds: 1600 };
  const r = assessTrainingFlags([run(odd), run(odd)], opts);
  assert.equal(r.flags[0]!.kind, "pace-fast");
  assert.equal(r.suggestion, null); // never "the plan can be quicker" alongside a slower anchor
  // The mirror case.
  const odd2 = { avgPaceSecPerKm: 440, implied5kSeconds: 1400 };
  const r2 = assessTrainingFlags([run(odd2), run(odd2)], opts);
  assert.equal(r2.flags[0]!.kind, "pace-slow");
  assert.equal(r2.suggestion, null);
});

test("no current anchor means flags still report but nothing is proposed", () => {
  const fast = { avgPaceSecPerKm: 350, implied5kSeconds: 1380 };
  const r = assessTrainingFlags([run(fast), run(fast)], { currentRecent5kSeconds: 0 });
  assert.equal(r.flags.length, 1);
  assert.equal(r.suggestion, null);
});
