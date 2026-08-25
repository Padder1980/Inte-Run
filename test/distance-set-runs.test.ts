/**
 * RUNS SET BY DISTANCE AS WELL AS BY TIME (owner, 2026-08-26, four Runna screenshots).
 *
 * "I also think there needs to a mixture of runs set by distance and runs set by time" — then, when it
 * was not done in the first pass: "we need to try and find a fix for that....here are some examples of
 * where it has been done in runna".
 *
 * The rule read off those screenshots: **anything you RUN is a distance; anything you REST is a time.**
 * His examples: "7km at a conversational pace", "2km at a conversational pace", "1km at 5:20/km",
 * "400m at 4:40/km" — and then "90s walking rest".
 *
 * Measured before: 65 sessions clock-only against 9 with any distance-gated step, across a full half
 * block. After: 1100 of 3756 session bodies are distance-set.
 */
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { deriveTrainingPaces } from "../src/science/paces.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import {
  easyProgression, easyRun, longRun, moderateRun, recoveryRun,
} from "../src/plan/session-templates.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

const paces = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 1500 });
// ⚠️ TWO UNITS, AND THEY ARE DIFFERENT ON PURPOSE. A session's TOTAL ceils to the friendly 500 m the
// owner asked for ("a 4.6km easy run would just become a 5km"); the SEGMENTS inside it apportion at
// 100 m, because forcing every gear change to a half-kilometre would drag it around by up to 250 m,
// which is a coaching change rather than a rounder number.
const SEG_UNIT = 100;
// ⚠️ READ FROM THE ENGINE, not typed here — the friendly unit is held at 100 m until the long run is
// converted (see KM_UNIT_M's own note), and a guard with its own copy of a constant measures the test's
// value rather than the app's, which this project has watched escape a re-break twice.
const UNIT = Number(/const KM_UNIT_M = (\d+);/.exec(
  readFileSync(new URL("../src/plan/session-templates.ts", import.meta.url), "utf8"))?.[1] ?? 0);
const gated = (st: any) => st.distanceMeters != null && st.durationSeconds == null;
const midPace = (st: any) =>
  (st.targetPaceSecPerKm.minSecPerKm + st.targetPaceSecPerKm.maxSecPerKm) / 2;
const secs = (st: any) => {
  if (st.durationSeconds) return st.durationSeconds;
  if (st.distanceMeters && st.targetPaceSecPerKm) return (st.distanceMeters / 1000) * midPace(st);
  if (st.distanceMeters) return st.distanceMeters / 4;
  return 0;
};

test("BLOCKER: anything you run is a distance; anything you rest is a time", () => {
  // The four low-intensity builders his screenshots name, and the one shape that proves the rule: an
  // easy run WITH STRIDES, where the body is a distance and every stride and walk-back is still a clock.
  for (const [what, s] of [
    ["easy run", easyRun(paces, 38)],
    ["recovery jog", recoveryRun(paces, 38)],
    ["moderate run", moderateRun(paces, 38)],
    ["easy → moderate", easyProgression(paces, 45)],
  ] as const) {
    const body = (s.steps || []).filter((st: any) => st.kind === "steady");
    assert.ok(body.length > 0, what + " has no continuous body at all");
    for (const st of body) {
      assert.ok(gated(st), what + " still prescribes its body on the clock: " + JSON.stringify(st).slice(0, 90));
      assert.equal(st.distanceMeters! % SEG_UNIT, 0,
        what + " gives a distance of " + st.distanceMeters + " m, which is not a whole 100 m");
    }
  }
  // ⚠️ A STRIDE AND ITS WALK-BACK KEEP THEIR CLOCK, and this is the case that distinguishes the rule
  // from "convert everything". A 20-second stride is a burst of speed, not a distance you pace out, and
  // a walk-back is a rest — which is exactly how his screenshots read (400 m reps, but a 90s walking
  // rest). Measured on screen: "4.0 km steady | 20s rep | 60s recovery" repeated.
  const withStrides: any = easyRun(paces, 38, true);
  const kinds = (withStrides.steps || []).map((st: any) => st.kind + ":" + (gated(st) ? "dist" : "time"));
  assert.ok(kinds.includes("steady:dist"), "the body of an easy+strides run is not a distance: " + kinds.join(","));
  for (const st of (withStrides.steps || [])) {
    if (st.kind === "steady") continue;
    assert.ok(!gated(st),
      "a " + st.kind + " step was converted to a distance — a stride and a walk-back keep their clock");
  }
});

test("BLOCKER: the whole body is rounded once and apportioned, so the ladder cannot step backwards", () => {
  // ⚠️⚠️ ROUNDING EACH SEGMENT SEPARATELY WAS A MEASURED DEFECT: 428 of 23,520 long runs came out
  // SHORTER than the week before, because a two- or three-segment body carries ±150 m of independent
  // rounding noise and a genuine small week-on-week rise is less than that. The parts must sum to the
  // whole.
  for (const m of [22, 31, 45, 62, 80]) {
    const s: any = easyProgression(paces, m);
    const segs = (s.steps || []).filter(gated);
    assert.ok(segs.length >= 2, "the progression run no longer has separate gears to apportion between");
    const total = segs.reduce((a: number, st: any) => a + st.distanceMeters, 0);
    assert.equal(total % UNIT, 0,
      m + "′: the segments add up to " + total + " m, which is not a whole " + UNIT + " m");
  }
  // ⚠️ AND THE CONSEQUENCE THAT MATTERS: a rising sequence of minutes must give a NON-DECREASING
  // sequence of distances. This is the property the per-segment version broke.
  for (const build of [
    (m: number) => easyRun(paces, m),
    (m: number) => recoveryRun(paces, m),
    (m: number) => moderateRun(paces, m),
    (m: number) => easyProgression(paces, m),
  ]) {
    let prev = -1, prevMin = 0;
    for (let m = 20; m <= 90; m++) {
      const s: any = build(m);
      const d = (s.steps || []).filter(gated).reduce((a: number, st: any) => a + st.distanceMeters, 0);
      assert.ok(d >= prev,
        "a " + m + "′ run gives " + d + " m where " + prevMin + "′ gave " + prev + " m — the ladder went backwards");
      prev = d; prevMin = m;
    }
  }
});

test("BLOCKER: rounding gives the runner the work, never takes it away", () => {
  // ⚠️ THE CEILING IS A RULE, NOT A DETAIL. Rounding to NEAREST pushed a floor-hugging session under
  // its own floor — measured, "easy run 20 min is below the floor" against the engine's 20-minute
  // minimum, because 20.0 minutes of exact distance rounded down to 19.9. Ceiling the total also keeps
  // the ladder monotone for free.
  for (const build of [
    (m: number) => easyRun(paces, m),
    (m: number) => recoveryRun(paces, m),
    (m: number) => moderateRun(paces, m),
    (m: number) => easyProgression(paces, m),
  ]) {
    for (let m = 20; m <= 90; m += 7) {
      const s: any = build(m);
      const delivered = (s.steps || []).reduce((a: number, st: any) => a + secs(st), 0) / 60;
      assert.ok(delivered >= m - 0.05,
        "a " + m + "′ run delivers " + delivered.toFixed(2) + "′ — the rounding took work away");
      // Bounded at one unit at the slowest converted pace, so it cannot drift upward without limit.
      const conv = (s.steps || []).filter((st: any) => gated(st) && st.targetPaceSecPerKm);
      const slowest = Math.max(...conv.map(midPace));
      assert.ok(delivered <= m + (UNIT / 1000) * slowest / 60 + 0.05,
        "a " + m + "′ run delivers " + delivered.toFixed(2) + "′, beyond one unit of rounding");
    }
  }
});

test("BLOCKER: the long run is still on the clock, and its own note says why", () => {
  // ⚠️ NOT AN OVERSIGHT — TRIED, MEASURED AND BACKED OUT. It is the session he named ("7.5km
  // Progressive Repeat Long Run") and converting it is two lines; what stopped it is that its dose
  // arithmetic is a fraction of `body` in minutes and SIX guards read the delivered dose back off the
  // steps in minutes. This asserts the state is deliberate, so nobody has to rediscover it.
  const src = readFileSync(new URL("../src/plan/session-templates.ts", import.meta.url), "utf8");
  for (const m of [60, 90, 130]) {
    const body = (longRun(paces, m).steps || []).filter((st: any) => st.kind === "steady");
    assert.ok(body.length > 0 && body.every((st: any) => !gated(st)),
      "the long run has been converted to distances without its guards being made gate-agnostic first");
    assert.match(longRun(paces, m).title, /′ long run/, "the long run's title stopped naming its minutes");
  }
  const at = src.indexOf("THE LONG RUN IS DELIBERATELY STILL ON THE CLOCK");
  assert.ok(at > 0, "the reason the long run is not converted is no longer recorded beside it");
  assert.match(src.slice(at, at + 1700), /428 of 23,520/,
    "the note no longer carries the measurement that stopped it");
});

test("BLOCKER: build-your-own-run scales a distance-set body in its own currency", () => {
  // ⚠️⚠️ A REAL DEFECT THIS CHANGE WOULD HAVE SHIPPED. buildCustomSession clones the plan's
  // representative and scales its steady body; it summed st.durationSeconds directly, so the moment the
  // representative's body became a distance the sum went to zero, the whole scaling branch was skipped
  // and the representative was passed through untouched. Measured: "recovery asked for 3 km and
  // delivered 4.60 km".
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function buildCustomSession(");
  assert.ok(at > 0, "buildCustomSession is not in the build");
  let d = 0, end = at;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}" && --d === 0) { end = i + 1; break; }
  }
  const body = html.slice(at, end).replace(/^\s*\/\/.*$/gm, "");
  assert.match(body, /const steadySecs = rep\.steps\.reduce\(\(s, st\) => s \+ \(st\.kind === "steady" \? stepSecs\(st\) : 0\), 0\)/,
    "the steady body is measured by durationSeconds again, so a distance-set representative reads as zero");
  // ⚠️ AND IT SCALES THE FIELD THE STEP ACTUALLY CARRIES. Writing a duration onto a distance-gated step
  // gives it BOTH, and the runtime's rule is distanceMeters != null AND durationSeconds == null — a step
  // with both ends on the CLOCK, which is the defect a real outing reported when a custom 1 km finished
  // at 0.59 km.
  assert.match(body, /if \(st\.distanceMeters != null && st\.durationSeconds == null\) \{[\s\S]{0,220}?distanceMeters:/,
    "a distance-set body is scaled by writing a duration onto it, which makes it end on the clock");
});

test("BLOCKER: a real plan reads as a genuine mixture, and the accounting survives it", () => {
  // The measurement that decided this was safe. Every model is still fed minutes; only the gate moved,
  // and assemble derives the session's duration straight back from the distance at the same mid-band
  // pace — so the drift is the rounding and nothing else.
  const ath = { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational", includeStrength: false, longRunDay: 6 } as Athlete;
  const goal = { distance: "half", raceDateIso: "2026-12-06", targetTimeSeconds: 6300 } as Goal;
  const plan = generatePlan(ath, goal, {});
  let dist = 0, clock = 0;
  for (const wk of plan.weeks) {
    for (const s of wk.sessions as any[]) {
      const body = (s.steps || []).filter((st: any) => st.kind === "steady" || st.kind === "rep");
      if (!body.length) continue;
      if (body.some(gated)) dist++; else clock++;
      // ⚠️ NO STEP MAY CARRY BOTH, anywhere in a real plan. That is the runtime's gate, and a step with
      // both silently ends on the clock however far the runner has gone.
      for (const st of s.steps || []) {
        assert.ok(!(st.distanceMeters != null && st.durationSeconds != null),
          '"' + s.title + '" has a step carrying BOTH a distance and a duration, so it ends on the clock');
      }
      // The session's stated duration must agree with its steps to within the rounding.
      //
      // ⚠️ MEASURED WITH assemble'S OWN CONVENTION, AND THE TWO IN THIS ENGINE DISAGREE — a
      // pre-existing inconsistency this guard surfaced rather than caused. `stepDuration` in
      // session-templates.ts returns 0 for an EFFORT-ONLY step (a hill sprint carries no pace on
      // purpose, since pace up a hill is a function of the gradient), while `stepSeconds` in
      // src/science/intensity-distribution.ts credits it at a nominal 4 m/s — precisely because
      // returning zero once made a maximal hill session compute as 100% easy. So a hill-sprint
      // session's estimatedDurationSeconds under-counts by the sprint time: measured,
      // "10 × 50 m hill sprints, walk back" states 39′ where the 4 m/s ruler reads 41′. Nothing here
      // touched hillReps, and the claim being tested is about the DISTANCE conversion, so this uses the
      // convention the number was built with. The disagreement is worth someone's attention on its own.
      const assembleSecs = (st: any) => {
        if (st.durationSeconds) return st.durationSeconds;
        if (st.distanceMeters && st.targetPaceSecPerKm) return (st.distanceMeters / 1000) * midPace(st);
        return 0;
      };
      const fromSteps = (s.steps || []).reduce((a: number, st: any) => a + assembleSecs(st), 0);
      assert.ok(Math.abs(fromSteps - s.estimatedDurationSeconds) < 60,
        '"' + s.title + '" claims ' + Math.round(s.estimatedDurationSeconds / 60) + "′ but its steps are " +
        Math.round(fromSteps / 60) + "′");
    }
  }
  assert.ok(dist > 0, "no session in a real plan is set by distance");
  assert.ok(clock > 0, "every session is set by distance — that is not a mixture either");
  assert.ok(dist / (dist + clock) > 0.15,
    "only " + dist + " of " + (dist + clock) + " session bodies are distance-set, which is not a mixture");
});
