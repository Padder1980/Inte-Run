/**
 * A6 — TURNING THE SET LOG INTO COACHING: ESTIMATED 1RM, A SUGGESTED NEXT LOAD, RECORDS.
 *
 * Pure functions over the log the app already holds (interun_slog_v2, A1) — nothing new is stored,
 * so there is no migration to guard here. What matters is that the double-progression rules fire in
 * the right DIRECTION, that a suggestion is a plain number the app-layer guard (strength-progress.test.ts)
 * can prove never gets written into a row as if the runner had typed it, and that a "record" needs
 * something to beat.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  epley1RM, bestE1RMKg, suggestLoad, sumVolumeKg,
  LOAD_STEP_KG, LOAD_STEP_KG_BARBELL, LOAD_STEP_THRESHOLD_KG, RPE_HOLD_FLOOR,
  type LoggedSet,
} from "../src/strength/progression.ts";
import { detectStrengthRecords } from "../src/strength/records.ts";
import type { Equipment, MovementPattern } from "../src/strength/library.ts";

// -------------------------------------------------------------------------------------------------
// 1. Epley — the formula, and its bound
// -------------------------------------------------------------------------------------------------

test("BLOCKER: epley1RM = w * (1 + r/30), for 1–10 reps", () => {
  assert.equal(epley1RM(100, 5), 100 * (1 + 5 / 30));
  // Floating point, not the formula: 60 * (1 + 1/30) is 62 exactly on paper and 61.99999999999999
  // in IEEE 754, so this compares with a tolerance rather than asserting bit-exact equality.
  assert.ok(Math.abs(epley1RM(60, 1)! - 62) < 1e-9, "a single rep is close to its own weight, not equal");
  assert.equal(epley1RM(60, 10), 80);
  // The boundary is inclusive at both ends.
  assert.notEqual(epley1RM(60, 1), null);
  assert.notEqual(epley1RM(60, 10), null);
});

test("BLOCKER: epley1RM refuses reps outside 1–10, and non-positive weight", () => {
  assert.equal(epley1RM(60, 11), null, "11 reps was accepted — the formula's error grows too fast past 10");
  assert.equal(epley1RM(60, 0), null, "0 reps was accepted");
  assert.equal(epley1RM(60, -1), null, "negative reps was accepted");
  assert.equal(epley1RM(0, 5), null, "zero weight was accepted");
  assert.equal(epley1RM(-10, 5), null, "negative weight was accepted");
  assert.equal(epley1RM(NaN, 5), null, "NaN weight was accepted");
  assert.equal(epley1RM(60, NaN), null, "NaN reps was accepted");
});

test("bestE1RMKg is the max Epley figure across every instance, not just the last one", () => {
  const instances: LoggedSet[][] = [
    [{ w: 40, r: 8 }],           // 40 * 1.2667 = 50.67
    [{ w: 60, r: 5 }],           // 60 * 1.1667 = 70.0  <- the max
    [{ w: 50, r: 6 }],           // 50 * 1.2    = 60.0
  ];
  assert.equal(bestE1RMKg(instances), 70);
});

test("bestE1RMKg skips sets that carry no usable weight/reps pair and returns null with nothing to see", () => {
  assert.equal(bestE1RMKg([]), null);
  assert.equal(bestE1RMKg([[{ w: null, r: 8 }], [{ w: 40, r: null }]]), null);
});

// -------------------------------------------------------------------------------------------------
// 2. suggestLoad — each rule direction, driven
// -------------------------------------------------------------------------------------------------

type Fixture = { prescribedReps: string; loadPercent1RM: string; pattern: MovementPattern; equipment: Equipment[] };
const dumbbellSquat: Fixture = { prescribedReps: "8–12", loadPercent1RM: "70–75%", pattern: "squat", equipment: ["dumbbell"] };
const barbellSquat: Fixture = { prescribedReps: "3–6 (heavy)", loadPercent1RM: "80%+", pattern: "squat", equipment: ["barbell"] };
const barbellHinge: Fixture = { prescribedReps: "3–6 (heavy)", loadPercent1RM: "80%+", pattern: "hinge", equipment: ["barbell"] };

test("BLOCKER: a hold has nothing to suggest — no numeric range, whatever the history", () => {
  const s = suggestLoad({ prescribedReps: "30–45s hold", loadPercent1RM: "80%+", pattern: "plank" as never,
    equipment: [], priorInstances: [[{ w: 20, r: 10 }]] });
  assert.equal(s, null);
});

test("BLOCKER: every set at the top of the range steps the weight UP", () => {
  const s = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 20, r: 12 }, { w: 20, r: 12 }, { w: 20, r: 12 }]] });
  assert.ok(s);
  assert.equal(s!.direction, "up");
  assert.equal(s!.kg, 20 + LOAD_STEP_KG);
  assert.match(s!.reason, /try 22\.5 kg/i);
});

test("BLOCKER: a barbell squat/hinge at or above 40 kg steps UP by the bigger increment", () => {
  const squat = suggestLoad({ ...barbellSquat, priorInstances: [[{ w: 40, r: 6 }, { w: 40, r: 6 }, { w: 40, r: 6 }]] });
  assert.equal(squat!.kg, 40 + LOAD_STEP_KG_BARBELL);
  const hinge = suggestLoad({ ...barbellHinge, priorInstances: [[{ w: 60, r: 6 }, { w: 60, r: 6 }, { w: 60, r: 6 }]] });
  assert.equal(hinge!.kg, 60 + LOAD_STEP_KG_BARBELL);
});

test("BLOCKER: the bigger barbell step needs BOTH the pattern/equipment AND the weight threshold", () => {
  // Below the threshold weight — small step even though it is a barbell squat.
  const light = suggestLoad({ ...barbellSquat, priorInstances: [[{ w: 30, r: 6 }, { w: 30, r: 6 }, { w: 30, r: 6 }]] });
  assert.equal(light!.kg, 30 + LOAD_STEP_KG, "a sub-threshold barbell squat took the big step");
  assert.ok(LOAD_STEP_THRESHOLD_KG > 30, "the fixture is not actually below the threshold");
  // A dumbbell squat at the same weight — pattern matches but equipment does not.
  const dumbbell = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 45, r: 12 }, { w: 45, r: 12 }]] });
  assert.equal(dumbbell!.kg, 45 + LOAD_STEP_KG, "a dumbbell squat took the barbell step");
  // A barbell PUSH (not squat/hinge) at the threshold weight — equipment matches but pattern does not.
  const push = suggestLoad({ prescribedReps: "8–12", loadPercent1RM: "70–75%", pattern: "push" as const,
    equipment: ["barbell"], priorInstances: [[{ w: 45, r: 12 }, { w: 45, r: 12 }]] });
  assert.equal(push!.kg, 45 + LOAD_STEP_KG, "a barbell push took the squat/hinge step");
});

test("BLOCKER: any set below the range steps the weight DOWN by the cutback fraction", () => {
  const s = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 30, r: 12 }, { w: 30, r: 6 }, { w: 30, r: 12 }]] });
  assert.ok(s);
  assert.equal(s!.direction, "down");
  assert.equal(s!.kg, Math.round(30 * 0.95 * 2) / 2);
  assert.match(s!.reason, /fell short/i);
});

test("BLOCKER: sets inside the range, neither all at the top nor any below, HOLD", () => {
  const s = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 25, r: 9 }, { w: 25, r: 10 }]] });
  assert.equal(s!.direction, "hold");
  assert.equal(s!.kg, 25);
});

test("BLOCKER: an RPE of 9 or more on the last set overrides the rep-range rule and holds", () => {
  // Every rep at the top of the range would normally step UP — the RPE override must win.
  const s = suggestLoad({ ...dumbbellSquat,
    priorInstances: [[{ w: 30, r: 12, rpe: 9 }, { w: 30, r: 12, rpe: 9 }]] });
  assert.equal(s!.direction, "hold", "a high-RPE top-of-range set still stepped up");
  assert.equal(s!.kg, 30);
  // An RPE just below the floor does not trip it — the control case, or the assertion above proves nothing.
  const control = suggestLoad({ ...dumbbellSquat,
    priorInstances: [[{ w: 30, r: 12, rpe: RPE_HOLD_FLOOR - 1 }, { w: 30, r: 12, rpe: RPE_HOLD_FLOOR - 1 }]] });
  assert.equal(control!.direction, "up", "an RPE below the floor still held");
});

test("BLOCKER: no history falls back to loadPercent1RM x best e1RM, and blank when either is missing", () => {
  const withBoth = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 40, r: 8 }]] as never });
  // Force "no history for double progression" by using an exercise reps range that never matches the
  // one in that old instance — simplest is simply passing an EMPTY priorInstances but with a
  // separately-supplied best e1RM via a second, older instance array. Constructed directly instead:
  const noRecent = suggestLoad({ ...dumbbellSquat, priorInstances: [] });
  assert.equal(noRecent, null, "no history and no e1RM to fall back on should be blank");

  // With a genuine (older) instance on record but the load%/e1rm formula in play: pass priorInstances
  // whose only sets are incomplete (reps only, no weight) so double progression cannot run, but a
  // complete OLDER set exists too so bestE1RMKg has something to read.
  const mixed = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 40, r: 8 }], [{ w: null, r: 10 }]] });
  assert.ok(mixed, "a runner with SOME e1RM on record but no usable last instance got no suggestion");
  assert.equal(mixed!.direction, "start");
  const pct = 0.70; // the LOWER bound of "70-75%"
  const e1rm = 40 * (1 + 8 / 30);
  assert.equal(mixed!.kg, Math.round(pct * e1rm * 2) / 2);
  assert.match(mixed!.reason, /estimated one-rep max/i, "the fallback reason does not say 'estimated'");

  // No load% at all (an accessory movement) — blank even with an e1RM on record.
  const noLoad = suggestLoad({ prescribedReps: "8–12", loadPercent1RM: undefined, pattern: "core" as const,
    equipment: [], priorInstances: [[{ w: null, r: 10 }]] });
  assert.equal(noLoad, null, "an exercise with no load percentage and no double-progression history got a number anyway");
  void withBoth;
});

test("suggestLoad rounds to the nearest half kilogram", () => {
  const s = suggestLoad({ ...dumbbellSquat, priorInstances: [[{ w: 31, r: 12 }]] });
  assert.equal(s!.kg % 0.5, 0, s!.kg + " is not a multiple of 0.5");
});

// -------------------------------------------------------------------------------------------------
// 3. sumVolumeKg
// -------------------------------------------------------------------------------------------------

test("sumVolumeKg sums weight x reps and skips anything missing either", () => {
  assert.equal(sumVolumeKg([{ w: 20, r: 10 }, { w: 20, r: 8 }, { w: null, r: 10 }, { w: 20, r: null }]), 360);
  assert.equal(sumVolumeKg([]), 0);
  assert.equal(sumVolumeKg([{ w: null, r: 10 }]), 0, "a bodyweight set (reps, no weight) contributed volume");
});

// -------------------------------------------------------------------------------------------------
// 4. detectStrengthRecords — heaviest, e1RM, volume, all strictly greater
// -------------------------------------------------------------------------------------------------

test("BLOCKER: a record needs something to beat — no prior instances means no records, whatever the numbers", () => {
  const hits = detectStrengthRecords({ priorInstances: [], thisInstance: [{ w: 500, r: 1 }] });
  assert.deepEqual(hits, [], "the runner's very first log of an exercise was reported as a record");
});

test("BLOCKER: a tie is not a record on any of the three dimensions", () => {
  const priors = [[{ w: 60, r: 5 }]]; // heaviest 60, e1rm 60*(1+5/30)=70, volume 300
  const hits = detectStrengthRecords({ priorInstances: priors, thisInstance: [{ w: 60, r: 5 }] });
  assert.deepEqual(hits, [], "matching a prior best was reported as beating it");
});

test("BLOCKER: a genuinely heavier single set sets the heaviest record and nothing else it does not also beat", () => {
  const priors = [[{ w: 60, r: 5 }]]; // heaviest 60, e1rm 70, volume 300
  const hits = detectStrengthRecords({ priorInstances: priors, thisInstance: [{ w: 65, r: 1 }] }); // heaviest 65, e1rm ~66.8, volume 65
  const kinds = hits.map((h) => h.kind).sort();
  assert.deepEqual(kinds, ["heaviest"], "a heavier single beat volume/e1rm too when it should not have");
  assert.equal(hits[0]!.value, 65);
  assert.equal(hits[0]!.previousBest, 60);
});

test("BLOCKER: a higher-rep set at the SAME weight can set the e1RM record alone", () => {
  // ⚠️ AN e1RM RECORD IN ISOLATION IS HARD TO CONSTRUCT WITH A SINGLE LOWER-WEIGHT SET — beating a
  // prior e1rm without also beating the prior weight or volume needs more reps at a similar weight,
  // and reps drive volume up roughly linearly while they only nudge e1rm by 1/30 each; the prior
  // volume has to be large enough (three sets, not one) to absorb that before this reads as isolated.
  const priors = [[{ w: 60, r: 5 }, { w: 60, r: 5 }, { w: 60, r: 5 }]]; // heaviest 60, e1rm 70, volume 900
  const hits = detectStrengthRecords({ priorInstances: priors, thisInstance: [{ w: 60, r: 8 }] }); // heaviest 60 (tie), e1rm 76, volume 480
  const kinds = hits.map((h) => h.kind).sort();
  assert.deepEqual(kinds, ["e1rm"]);
});

test("BLOCKER: more total sets can set the volume record alone", () => {
  const priors = [[{ w: 60, r: 5 }]]; // volume 300, heaviest 60, e1rm 70
  const hits = detectStrengthRecords({
    priorInstances: priors,
    thisInstance: [{ w: 40, r: 8 }, { w: 40, r: 8 }, { w: 40, r: 8 }], // volume 960, heaviest 40, e1rm ~50.7 — neither other record
  });
  const kinds = hits.map((h) => h.kind).sort();
  assert.deepEqual(kinds, ["volume"]);
});

test("all three records can fire together, and each reports the correct previous best", () => {
  const priors = [[{ w: 40, r: 5 }], [{ w: 45, r: 3 }]];
  // prior heaviest 45, prior e1rm = max(40*1.1667=46.67, 45*1.1=49.5) = 49.5, prior volume = max(200, 135) = 200
  const hits = detectStrengthRecords({
    priorInstances: priors,
    thisInstance: [{ w: 50, r: 8 }, { w: 50, r: 8 }], // heaviest 50, e1rm 50*1.2667=63.33, volume 800
  });
  const byKind = Object.fromEntries(hits.map((h) => [h.kind, h]));
  assert.equal(byKind.heaviest!.previousBest, 45);
  assert.ok(Math.abs(byKind.e1rm!.previousBest! - 49.5) < 1e-9); // floating point, see the epley1RM test above
  assert.equal(byKind.volume!.previousBest, 200);
  assert.equal(hits.length, 3);
});

test("a set carrying only weight (no reps) can still set the heaviest record, but not e1rm or volume", () => {
  const priors = [[{ w: 40, r: 5 }]];
  const hits = detectStrengthRecords({ priorInstances: priors, thisInstance: [{ w: 45, r: null }] });
  assert.deepEqual(hits.map((h) => h.kind), ["heaviest"]);
});
