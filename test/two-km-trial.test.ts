import assert from "node:assert/strict";
import { test } from "node:test";
import {
  TWO_KM_RULES,
  isBeyondMaximalAerobic,
  paceFromVelocityFraction,
  projectableFrom2k,
  splitDifferencePercent,
  twoKmPaceSecPerKm,
  twoKmVelocityMps,
  validateTwoKmTest,
  velocityChangePercent,
  type TwoKmTimeTrial,
} from "../src/science/two-km-trial.ts";
import { PACE_RATIOS, deriveTrainingPaces } from "../src/science/paces.ts";

const trial = (over: Partial<TwoKmTimeTrial> = {}): TwoKmTimeTrial => ({
  id: "t1",
  completedAt: "2026-08-02T09:00:00.000Z",
  elapsedSeconds: 480,
  firstKmSeconds: 241,
  secondKmSeconds: 239,
  rpe0To10: 10,
  environment: "track",
  gpsQuality: "good",
  stoppedOrWalked: false,
  externalInterruption: false,
  painReported: false,
  illnessReported: false,
  ...over,
});

// ── Calculations (spec acceptance tests 1–4) ────────────────────────────────────────────────────

test("an 8:00 result gives 240 s/km, 4.1667 m/s and 15.0 km/h", () => {
  // The spec's own worked example, §10 — if this drifts, every number on the result screen has.
  assert.equal(twoKmPaceSecPerKm(480), 240);
  assert.ok(Math.abs(twoKmVelocityMps(480) - 4.1667) < 0.001);
  assert.ok(Math.abs(twoKmVelocityMps(480) * 3.6 - 15.0) < 0.01);
});

test("percentages are applied to VELOCITY, not to pace", () => {
  // ⚠️ THE POINT OF THIS TEST: multiplying a PACE by 0.65 makes it faster, which is the exact
  // opposite of running at 65% effort. The spec asks for a test that fails any implementation that
  // does it, because getting this backwards produces confident, plausible, dangerously fast numbers.
  const v = twoKmVelocityMps(480);
  const easySlow = paceFromVelocityFraction(v, 0.65);
  const easyFast = paceFromVelocityFraction(v, 0.75);
  assert.ok(Math.abs(easySlow - 369.2) < 1, `65% of velocity should be ~6:09/km, got ${easySlow}`);
  assert.ok(Math.abs(easyFast - 320) < 1, `75% of velocity should be ~5:20/km, got ${easyFast}`);
  // A smaller fraction must always give a SLOWER pace. The naive pace*fraction gives the reverse.
  assert.ok(easySlow > easyFast, "a lower fraction of velocity must be a slower pace");
  assert.ok(easySlow > twoKmPaceSecPerKm(480), "any fraction below 1 must be slower than trial pace");
  // ⚠️ SCOPE. This rule governs velocity fractions ONLY. paces.ts multiplies PACE by 1.22–1.33 for
  // the easy band and that is correct — those are pace ratios, not velocity fractions. Do not
  // "fix" PACE_RATIOS to satisfy this test; see the warning in two-km-trial.ts.
  assert.ok(PACE_RATIOS.easy.fast > 1, "PACE_RATIOS are pace multiples and stay above 1");
});

test("split difference is a percentage of the mean, and is direction-blind", () => {
  assert.ok(Math.abs(splitDifferencePercent(240, 240) - 0) < 1e-9);
  assert.ok(Math.abs(splitDifferencePercent(246, 234) - 5) < 1e-9);
  assert.equal(splitDifferencePercent(234, 246), splitDifferencePercent(246, 234));
});

test("velocity change is positive when the runner got faster", () => {
  assert.ok(velocityChangePercent(500, 480) > 0, "a quicker time is a positive change");
  assert.ok(velocityChangePercent(480, 500) < 0);
  assert.ok(Math.abs(velocityChangePercent(480, 480)) < 1e-9);
});

// ── Validation (spec acceptance tests 5–9) ──────────────────────────────────────────────────────

test("stopping or walking prevents the trial from setting the baseline", () => {
  const v = validateTwoKmTest(trial({ stoppedOrWalked: true }));
  assert.equal(v.status, "invalid");
  assert.equal(v.canSetBaseline, false);
});

test("reported pain invalidates the trial outright", () => {
  // Pain comes before any training number — it must never be read as a poor effort to be graded.
  const v = validateTwoKmTest(trial({ painReported: true }));
  assert.equal(v.status, "invalid");
  assert.equal(v.canSetBaseline, false);
  assert.ok(v.reasons.some((r) => /pain/i.test(r)));
});

test("missing heart rate does not invalidate or soften an otherwise perfect test", () => {
  // ⚠️ Explicitly required by the spec: heart rate is optional data, never a validity condition.
  const withHr = validateTwoKmTest(trial({ averageHeartRate: 172, maximumHeartRate: 186 }));
  const withoutHr = validateTwoKmTest(trial());
  assert.equal(withoutHr.status, "valid");
  assert.equal(withoutHr.confidence, "high");
  assert.deepEqual(withoutHr, withHr, "heart rate must make no difference to the grade");
});

test("an interruption or an implausible time is invalid", () => {
  assert.equal(validateTwoKmTest(trial({ externalInterruption: true })).status, "invalid");
  assert.equal(validateTwoKmTest(trial({ elapsedSeconds: 200, firstKmSeconds: undefined, secondKmSeconds: undefined })).status, "invalid");
  assert.equal(validateTwoKmTest(trial({ elapsedSeconds: 1500, firstKmSeconds: undefined, secondKmSeconds: undefined })).status, "invalid");
});

test("splits that do not add up to the finishing time are invalid", () => {
  // One of the three numbers is wrong, and grading it would launder a mis-recording into a baseline.
  const v = validateTwoKmTest(trial({ elapsedSeconds: 480, firstKmSeconds: 200, secondKmSeconds: 200 }));
  assert.equal(v.status, "invalid");
  assert.ok(v.reasons.some((r) => /add up/i.test(r)));
});

test("a valid but poorly paced test is kept, with reduced confidence", () => {
  // 300 vs 180 is a 50% split difference — a real effort, badly judged. It is evidence, but not
  // evidence to re-set someone's whole plan on.
  const v = validateTwoKmTest(trial({ elapsedSeconds: 480, firstKmSeconds: 300, secondKmSeconds: 180 }));
  assert.equal(v.status, "valid_with_caution");
  assert.equal(v.confidence, "low");
  assert.equal(v.canSetBaseline, false);
});

test("a mildly uneven test is medium confidence, and still cannot set the baseline alone", () => {
  const v = validateTwoKmTest(trial({ elapsedSeconds: 480, firstKmSeconds: 247, secondKmSeconds: 233 }));
  assert.equal(v.confidence, "medium");
  assert.equal(v.canSetBaseline, false);
});

test("a submaximal effort is downgraded even when the pacing was perfect", () => {
  assert.equal(validateTwoKmTest(trial({ rpe0To10: 6 })).confidence, "low");
  assert.equal(validateTwoKmTest(trial({ rpe0To10: 8 })).confidence, "medium");
  assert.equal(validateTwoKmTest(trial({ rpe0To10: 9 })).confidence, "high");
});

test("every reason is written for the runner, not for the developer", () => {
  // The reasons are shown on screen. A rule name or a field name leaking into them is a bug.
  const cases = [
    trial({ stoppedOrWalked: true }), trial({ painReported: true }), trial({ rpe0To10: 6 }),
    trial({ gpsQuality: "poor" }), trial({ hardSessionWithin48Hours: true }),
    trial({ elapsedSeconds: 480, firstKmSeconds: 300, secondKmSeconds: 180 }),
  ];
  for (const c of cases) {
    for (const r of validateTwoKmTest(c).reasons) {
      assert.ok(/^[A-Z]/.test(r) && /[.!]$/.test(r), `not a sentence: "${r}"`);
      assert.ok(!/[a-z][A-Z]/.test(r.replace(/GPS|RPE/g, "")), `camelCase leaked into copy: "${r}"`);
      assert.ok(!/undefined|null|NaN/.test(r), `a raw value leaked into copy: "${r}"`);
    }
  }
});

// ── Interpretation and scope (spec §8, §11) ─────────────────────────────────────────────────────

test("a result over ten minutes is never described as maximal aerobic speed", () => {
  // 2 km at 5:00/km is exactly ten minutes, so this is not an edge case — a large share of real
  // runners sit the wrong side of it, which is why the app never uses the term at all.
  assert.equal(isBeyondMaximalAerobic(TWO_KM_RULES.masCeilingSeconds - 1), false);
  assert.equal(isBeyondMaximalAerobic(TWO_KM_RULES.masCeilingSeconds + 1), true);
  assert.equal(isBeyondMaximalAerobic(780), true);
});

test("a 2 km trial may project a 5k or 10k, and never a half or a marathon", () => {
  // Acceptance test 11. Ten-plus times the tested distance is not a projection, it is a guess, and
  // durability and fuelling decide those races rather than short-distance speed.
  assert.equal(projectableFrom2k("5k"), true);
  assert.equal(projectableFrom2k("10k"), true);
  assert.equal(projectableFrom2k("half"), false);
  assert.equal(projectableFrom2k("marathon"), false);
});

// ── The two models agree (the reason we did not build the spec's table) ─────────────────────────

test("the existing pace model already lands inside the spec's velocity bands", () => {
  // ⚠️ THIS IS THE TEST THAT JUSTIFIES NOT BUILDING SPEC §9. If it ever fails, the two models have
  // diverged and the decision to keep one table has to be revisited — it is not a free assumption.
  // Spec §9: easy 65–75% of 2 km velocity, steady 75–82%, threshold 84–90%.
  for (const seconds of [420, 480, 600, 780]) {
    const paces = deriveTrainingPaces({ distanceMeters: 2000, timeSeconds: seconds });
    const v = twoKmVelocityMps(seconds);
    const pctOf = (secPerKm: number) => (1000 / secPerKm) / v * 100;
    const easyFast = pctOf(paces.easy.minSecPerKm), easySlow = pctOf(paces.easy.maxSecPerKm);
    assert.ok(easySlow >= 63 && easyFast <= 77, `2km ${seconds}s: easy at ${easySlow.toFixed(1)}–${easyFast.toFixed(1)}% is outside the spec's 65–75%`);
    const thrFast = pctOf(paces.threshold.minSecPerKm), thrSlow = pctOf(paces.threshold.maxSecPerKm);
    assert.ok(thrSlow >= 82 && thrFast <= 92, `2km ${seconds}s: threshold at ${thrSlow.toFixed(1)}–${thrFast.toFixed(1)}% is outside the spec's 84–90%`);
    // And the gap the spec exposed, now filled: recovery must be genuinely slower than easy.
    assert.ok(paces.recovery.minSecPerKm > paces.easy.minSecPerKm,
      `2km ${seconds}s: recovery must be slower than easy`);
    const recSlow = pctOf(paces.recovery.maxSecPerKm), recFast = pctOf(paces.recovery.minSecPerKm);
    assert.ok(recSlow >= 58 && recFast <= 70, `2km ${seconds}s: recovery at ${recSlow.toFixed(1)}–${recFast.toFixed(1)}% is outside the spec's 60–68%`);
  }
});

test("the ladder still runs in the right order when the anchor is a 2 km trial", () => {
  // The reason reconcileVo2 exists is that a trial feeding one gear while a race fed the others
  // could inverse the ladder. Anchoring everything on the trial cannot do that — assert it.
  for (const seconds of [400, 480, 560, 660, 780, 900]) {
    const p = deriveTrainingPaces({ distanceMeters: 2000, timeSeconds: seconds });
    assert.ok(p.rep.minSecPerKm < p.vo2.minSecPerKm, `${seconds}s: rep must be faster than VO2`);
    assert.ok(p.vo2.minSecPerKm < p.cv.minSecPerKm, `${seconds}s: VO2 must be faster than CV`);
    assert.ok(p.cv.minSecPerKm < p.threshold.minSecPerKm, `${seconds}s: CV must be faster than threshold`);
    assert.ok(p.threshold.minSecPerKm < p.steady.minSecPerKm, `${seconds}s: threshold must be faster than steady`);
    assert.ok(p.steady.minSecPerKm < p.easy.minSecPerKm, `${seconds}s: steady must be faster than easy`);
    assert.ok(p.easy.minSecPerKm < p.recovery.minSecPerKm, `${seconds}s: easy must be faster than recovery`);
  }
});
