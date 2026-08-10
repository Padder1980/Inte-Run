import assert from "node:assert/strict";
import { test } from "node:test";
import { fuellingFor } from "../src/science/fuelling.ts";

const long = (durationMinutes: number, extra: Partial<Parameters<typeof fuellingFor>[0]> = {}) =>
  fuellingFor({ durationMinutes, raceDistance: "marathon", sessionType: "long", ...extra });

test("short runs are told plainly that no fuel is needed", () => {
  // ⚠️ Silence is not the same as "no". A runner who has read that long runs need gels will guess
  // about a 60-minute one; saying so removes the guess. And the message must not imply that eating
  // is optional — only that eating DURING this run is.
  for (const mins of [30, 45, 60, 74]) {
    const f = long(mins);
    assert.equal(f.needed, false, `${mins}min should need no mid-run fuel`);
    assert.equal(f.perHour, null);
    assert.match(f.headline, /no fuel/i);
    assert.ok(f.points.some((p) => /eating normally|eating properly/i.test(p)),
      "the 'no fuel needed' case must still point at eating around the run");
  }
  // Strength and mobility never carry fuelling advice however long they are scheduled for.
  for (const sessionType of ["strength", "mobility", "rest", "cross-training"] as const) {
    assert.equal(fuellingFor({ durationMinutes: 180, raceDistance: "marathon", sessionType }).needed, false,
      `${sessionType} should never carry mid-session fuelling advice`);
  }
});

test("the dose steps up with duration, and the top tier says WHY it needs mixed sugars", () => {
  // ⚠️ 60 g/h is the ceiling on glucose alone; beyond it needs glucose + fructose, which use
  // different transporters. Telling a runner "90 g/h" without telling them "mixed" is telling them
  // to make themselves ill, so the tier and the note are one decision and must never separate.
  const mid = long(120);
  assert.deepEqual(mid.perHour, { min: 30, max: 60 });
  assert.ok(!mid.points.some((p) => /mixed sugars/i.test(p)),
    "the 30–60 tier does not need the mixed-sugar note");

  const big = long(180);
  assert.deepEqual(big.perHour, { min: 60, max: 90 });
  assert.ok(big.points.some((p) => /mixed sugars/i.test(p) && /fructose/i.test(p)),
    "the 60–90 tier MUST explain that it needs mixed sugars");
});

test("a marathon-pace long run is the rehearsal — same 60–90 g/h band, race-day products", () => {
  // The long run carrying goal-pace work is the rehearsal, so it is fuelled as the race is.
  //
  // ⚠️ THE RATE IS THE PUBLIC 60–90 g/h BAND, NOT A LIFTED 70–90 FLOOR (changed 2026-08-10, fuelling
  // brief §16). Raising the bottom of the band for a marathon made an unpractised rate the default on
  // every qualifying long run, contradicting the "start at the bottom and build" instruction in the
  // same card. What the rehearsal changes is the PRODUCTS and TIMINGS — which is the part that
  // actually needs rehearsing — so this test now pins the copy rather than a bigger number.
  //
  // ⚠️ And it must be LONG enough to be a rehearsal. Gating on race-pace work alone called a
  // 113-minute progressive a dress rehearsal and jumped it straight out of the 30–60 tier.
  const tooShort = long(113, { hasRacePaceWork: true });
  assert.equal(tooShort.rehearsal, false, "a sub-2:30 session is not a race rehearsal");
  assert.deepEqual(tooShort.perHour, { min: 30, max: 60 });

  const rehearsal = long(165, { hasRacePaceWork: true });
  assert.equal(rehearsal.rehearsal, true);
  assert.deepEqual(rehearsal.perHour, { min: 60, max: 90 });
  assert.match(rehearsal.headline, /rehears/i);
  assert.ok(rehearsal.points.some((p) => /same brand|exact gels/i.test(p)),
    "a rehearsal must tell the runner to use race-day products, not just race-day amounts");
  // ⚠️ Nobody takes eleven gels. The count is a unit, and the copy must say drink counts too, or
  // a correct number gets dismissed as absurd on the session card.
  assert.ok(rehearsal.points.some((p) => /drink|chews/i.test(p) && /split/i.test(p)),
    "the gram total must make clear that drink and chews count towards it");

  // The same run without race-pace work is a training long run — same numbers, no rehearsal framing.
  const plain = long(165);
  assert.equal(plain.rehearsal, false);
  assert.deepEqual(plain.perHour, { min: 60, max: 90 });
  assert.ok(!plain.points.some((p) => /exact gels|same brand/i.test(p)),
    "a training long run should not be dressed up as a dress rehearsal");

  // ⚠️ And a 5k/10k runner is never handed marathon race-fuelling, whatever their long run holds:
  // their race is over long before fuelling matters, so there is nothing to rehearse.
  for (const raceDistance of ["5k", "10k"] as const) {
    const f = fuellingFor({ durationMinutes: 165, raceDistance, sessionType: "long", hasRacePaceWork: true });
    assert.equal(f.rehearsal, false, `${raceDistance} has no race fuelling to rehearse`);
  }
});

test("the numbers add up and are actionable", () => {
  // Totals must follow from the rate, gels from the total, and the cadence from the rate — a
  // runner doing the arithmetic themselves must get the same answer.
  for (const mins of [90, 120, 150, 180, 240]) {
    for (const race of [true, false]) {
      const f = long(mins, { hasRacePaceWork: race });
      assert.ok(f.perHour && f.total && f.gels && f.everyMinutes && f.firstAtMinutes);
      const hours = mins / 60;
      assert.ok(Math.abs(f.total!.min - f.perHour!.min * hours) <= 3,
        `${mins}min total ${f.total!.min}g does not follow from ${f.perHour!.min}g/h`);
      assert.ok(Math.abs(f.total!.max - f.perHour!.max * hours) <= 3,
        `${mins}min total ${f.total!.max}g does not follow from ${f.perHour!.max}g/h`);
      assert.ok(f.gels!.min >= 1 && f.gels!.max >= f.gels!.min);
      // Cadence has to be a sane interval — not every 3 minutes, not once an hour.
      assert.ok(f.everyMinutes! >= 15 && f.everyMinutes! <= 45,
        `${mins}min cadence of ${f.everyMinutes} minutes is not usable`);
      // First one before the runner is empty, and inside the run.
      assert.ok(f.firstAtMinutes! >= 20 && f.firstAtMinutes! < mins);
    }
  }
});

test("nothing here reads as eat-less — it sits beside a RED-S screen", () => {
  // ⚠️ This app screens for RED-S and tells that runner "under-eating is not the answer here — if
  // anything you likely need more fuel". Fuelling advice that mentioned calories, weight or
  // deficits would contradict the one piece of genuinely safety-critical guidance in the product.
  const banned = /calorie|kcal|weight|deficit|burn(ed|ing)? off|lose (weight|fat)|lean|slim/i;
  for (const mins of [45, 90, 150, 200]) {
    for (const race of [true, false]) {
      const f = long(mins, { hasRacePaceWork: race });
      for (const text of [f.headline, ...f.points]) {
        assert.ok(!banned.test(text), `fuelling copy strays into diet language: "${text}"`);
      }
    }
  }
  // And the "build up gradually" instruction is always present when fuelling is prescribed —
  // it is the gut-training point, and it is what stops someone trying 90 g/h cold.
  assert.ok(long(180).points.some((p) => /build up gradually/i.test(p)));
});
