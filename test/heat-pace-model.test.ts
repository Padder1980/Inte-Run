import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assessConditions, heatPaceFactor, dewPointFrom } from "../src/environment/weather.ts";

/**
 * THE HEAT PACE MODEL, re-anchored 2026-08-16 before building heat adaptation on top of it.
 *
 * What it replaced: `pacePenaltySecPerKm = Math.min(30, (feels - 16) * 2.2)` — a flat number of
 * seconds handed to every runner, with no source in the file for the 2.2, the 16 or the 30.
 *
 * Two faults, and the second is the one that matters:
 *  1. Too aggressive. At 29°C it gave 30 s/km; the literature says about 4%.
 *  2. THE WRONG SHAPE. A flat 30 s/km is 14% of a 3:30/km runner's pace and 7% of a 7:00/km
 *     runner's — the same weather, twice as punishing to the faster one. This is the identical
 *     fault the pace ladder carried when easy pace was "threshold + 92 s/km", which CLAUDE.md
 *     records at length. The gears became multiples; so has this.
 *
 * The anchor is the model at apps.runningwritings.com/heat-adjusted-pace/, fitted to 3,891 marathon
 * runners across 754 races (Mantzios et al. 2022).
 */

const marathonMin = 210;

test("the model reproduces its published anchor", () => {
  // ⚠️ THE ONE NUMBER EVERYTHING ELSE IS SET FROM. 29.4°C air, 21.1°C dew point (85°F / 70°F), a
  // marathon: about 4% slower for the same effort. HEAT_K exists to make this true and nothing else
  // was tuned, so if this drifts the whole model has silently become unsourced again.
  const f = heatPaceFactor(29.4, 21.1, marathonMin);
  const pct = (f - 1) * 100;
  assert.ok(pct > 3.8 && pct < 4.2, "anchor drifted to " + pct.toFixed(2) + "% — expected ~4%");
});

test("the effect is a PERCENTAGE, so it costs a slower runner more seconds", () => {
  const f = heatPaceFactor(29.4, 21.1, 60);
  const secFor = (paceSecPerKm: number) => Math.round(paceSecPerKm * (f - 1));
  const fast = secFor(210), mid = secFor(300), slow = secFor(420);
  // ⚠️ THE WHOLE POINT OF THE REWRITE. The old flat 30 s/km was identical for all three, which meant
  // the same weather took twice the proportion off the fastest runner. A slower runner is out in the
  // heat longer and loses more absolute time — that ordering is the correctness check.
  assert.ok(fast < mid && mid < slow,
    "the slowdown must scale with pace, got " + [fast, mid, slow].join(" / "));
  assert.ok(slow >= fast * 1.8, "a 7:00/km runner should lose roughly double a 3:30/km runner");
});

test("it is far gentler than the number it replaced", () => {
  // The old model returned 30 s/km at this temperature, for everybody.
  const f = heatPaceFactor(29.4, 21.1, 60);
  const forFive = 300 * (f - 1);
  assert.ok(forFive < 15,
    "at 29°C a 5:00/km runner should lose well under the old flat 30 s/km, got " + forFive.toFixed(0));
});

test("cool conditions have no effect at all", () => {
  const cool: Array<[number, number]> = [[5, 2], [10, 6], [15, 10]];
  for (const [t, d] of cool) {
    assert.equal(heatPaceFactor(t, d, 60), 1, t + "°C should not slow anybody down");
  }
});

test("dew point matters, not just the thermometer", () => {
  // ⚠️ THE REASON THE MODEL TAKES DEW POINT. Relative humidity is a ratio to what the air could hold
  // at that temperature; dew point is an absolute, and it decides whether sweat can evaporate at all.
  // Two identical air temperatures, muggy versus dry, must not come out the same.
  // ⚠️ COMPARE THE EFFECTS, NOT THE FACTORS. The first version of this asserted `muggy > dry * 1.4`
  // on values of about 1.014 and 1.027 — which asks whether 1.027 exceeds 1.42, and can never be
  // true however well the model behaves. A near-1 multiplier makes ratio assertions meaningless.
  const dry = heatPaceFactor(28, 8, 60) - 1;
  const muggy = heatPaceFactor(28, 22, 60) - 1;
  assert.ok(muggy > dry * 1.7, "a muggy 28°C should cost markedly more than a dry one: " +
    (dry * 100).toFixed(1) + "% vs " + (muggy * 100).toFixed(1) + "%");
});

test("heat accumulates, so a long run pays more than a short one", () => {
  const short = heatPaceFactor(29, 20, 20);
  const hour = heatPaceFactor(29, 20, 60);
  const long = heatPaceFactor(29, 20, 150);
  assert.ok(short < hour && hour < long, "duration must scale the effect");
  // ⚠️ Bounded at both ends. Unbounded, a five-hour ultra would extrapolate off the end of a model
  // built on marathons, and a ten-minute jog would round to nothing when it should still be warm.
  assert.ok(heatPaceFactor(29, 20, 600) === long || heatPaceFactor(29, 20, 600) < long * 1.01,
    "the duration weight must be capped");
});

test("the effect is capped, and past the cap the model says so instead of guessing", () => {
  const absurd = heatPaceFactor(50, 30, 240);
  assert.ok((absurd - 1) <= 0.1001, "the factor must be capped at 10%");
  // ⚠️ Above ~35°C the source's own data thins out. The honest answer there is to move the session,
  // not to print a number derived from an extrapolation — so the engine flags it rather than
  // quietly returning its ceiling as though it were a measurement.
  const hot = assessConditions({ tempC: 36, humidityPct: 50, windKph: 5, sessionType: "easy" } as any);
  assert.equal(hot.beyondModel, true, "past 35°C the model must declare itself out of range");
  const fine = assessConditions({ tempC: 24, humidityPct: 50, windKph: 5, sessionType: "easy" } as any);
  assert.equal(fine.beyondModel, false);
});

test("a session with no running in it is never given a pace factor", () => {
  for (const type of ["strength", "mobility", "rest"]) {
    const r = assessConditions({ tempC: 33, humidityPct: 80, windKph: 5, sessionType: type } as any);
    assert.equal(r.paceFactor, 1, type + " has no pace to slow down");
  }
});

test("dew point is derived when the forecast does not supply one", () => {
  // 29.4°C at 61% RH is the anchor condition; Magnus should put the dew point near 21°C.
  const d = dewPointFrom(29.4, 61);
  assert.ok(d > 20 && d < 22, "derived dew point is " + d.toFixed(1) + "°C, expected ~21°C");
  // And a supplied dew point must win over the derived one.
  const supplied = assessConditions({ tempC: 29.4, humidityPct: 61, windKph: 5, sessionType: "easy", dewPointC: 5 } as any);
  const derived = assessConditions({ tempC: 29.4, humidityPct: 61, windKph: 5, sessionType: "easy" } as any);
  assert.ok(supplied.paceFactor < derived.paceFactor, "a supplied dew point must be used, not ignored");
});

test("every constant in the model is sourced, and the copy says effort not benefit", () => {
  const src = readFileSync(new URL("../src/environment/weather.ts", import.meta.url), "utf8");
  // ⚠️ THE FAULT WITH THE OLD FORMULA WAS NOT ONLY ITS VALUE — it was that nothing said where the
  // value came from, so nobody could tell it was wrong by reading it.
  assert.match(src, /runningwritings|Mantzios/, "the anchor for these constants is not cited");
  assert.match(src, /3,891|754 races/, "the dataset behind the anchor is not named");
  // ⚠️ Owner's ruling, 2026-08-16: the defensible claim is equivalent EFFORT. The source model
  // predicts effort and says heat tolerance varies a lot; "the same training benefit" is a stronger
  // claim than the evidence carries, and this app does not make those.
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/same training benefit|training benefits/i.test(bare),
    "the copy must promise the same effort, not the same training benefit");
  assert.match(bare, /same effort/, "the effort wording is missing");
});

test("nothing anywhere still reads the old flat penalty", () => {
  const weather = readFileSync(new URL("../src/environment/weather.ts", import.meta.url), "utf8");
  const app = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");
  // ⚠️ Left in place it would be reused, and the fault would come back through whichever caller
  // reached for the convenient number instead of the correct multiplier.
  assert.ok(!/pacePenaltySecPerKm/.test(weather), "the engine still exposes the flat penalty");
  assert.ok(!/pacePenaltySecPerKm/.test(app), "the app still reads the flat penalty");
  // The seconds a runner sees must be derived from their own pace.
  assert.match(app, /function heatSecPerKm\(/, "the per-runner conversion is missing");
  assert.match(app, /paceFactor - 1/, "the seconds figure is not derived from the multiplier");
});
