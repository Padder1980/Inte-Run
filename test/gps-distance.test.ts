import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * GPS distance has now been got wrong in BOTH directions, one after the other, on the owner's own phone.
 * These tests pin both edges so it cannot swing again.
 *
 * 1. The original gate demanded each fix jump more than half its own accuracy. At the ±14 m his phone
 *    reported that is 7 m between fixes about a second apart — 7 m/s, a 2:22/km pace. At his actual
 *    1.03 m/s every fix was discarded and a whole run recorded 0.00 km, with no route either.
 * 2. The fix for that trusted `coords.speed`: if the device says 1.03 m/s the runner is moving, so a 1 m
 *    step is real. He caught it in one run — 0.14 km standing still. A stationary receiver reports a
 *    PHANTOM speed, because speed is derived from the same noisy signal as position. Speed is NOT
 *    independent evidence of movement, and that was the wrong assumption.
 *
 * The rule that survives both: hold an ANCHOR and credit the NET displacement from it whenever that
 * exceeds the fix's own stated accuracy, then move the anchor there. Jitter is bounded by that accuracy and
 * has no consistent bearing, so a stationary phone never gets far from a fixed anchor; a runner leaves it
 * and keeps going.
 *
 * 3. And a THIRD fault these tests caught before he had to: summing the per-fix steps inflates distance,
 *    because noise adds on every reading and haversine is always positive. Measured on a 1.03 m/s fixture
 *    with only ±1 m of jitter, 124 m covered came out as 215 m recorded — 73% long. An anchor is immune.
 *
 * ⚠️ Honest limit, stated rather than hidden: no position-based rule can defeat pathological jitter that
 * swings the full accuracy radius every second. These fixtures use realistic correlated jitter (a few
 * metres for a ±14 m fix), which is what a receiver actually produces.
 *
 * Reads the BUILT web/app.html because onGpsPos is web-layer code — same precedent as warmup-delivery.
 * Run `node web/app.ts` first.
 */
function lift(names: string[]) {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not found in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
}

type Opts = {
  accuracy: number;
  /** What the device claims, in m/s. -1 for "unknown", which is the normal indoor/cold-start case. */
  speed: number;
  /** Real ground speed in m/s. 0 for a phone standing still. */
  groundSpeed: number;
  /** Jitter amplitude in metres, applied alternately either side of the true position. */
  jitter?: number;
  seconds: number;
};

/**
 * Feed one fix a second for `seconds`, with a controllable clock. `Date` is injected as a Function
 * parameter so it shadows the global inside the lifted source — without that the whole run happens inside
 * one millisecond and the 20-second window can never open.
 */
function run(o: Opts) {
  const src = lift(["haversine", "onGpsPos"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  const FakeDate = { now: () => clock };
  // ⚠️ onGpsPos now stamps each route point with the elapsed time, so the harness has to supply the
  // same clock the app uses. liveElapsedMs subtracts paused time; this fake mirrors that with no
  // pauses, which is what these fixtures replay.
  const liveElapsedMs = () => FakeDate.now() - (LIVE.startMs || 0) - (LIVE.pausedMs || 0);
  const onGpsPos = new Function("LIVE", "Date", "liveElapsedMs", src + "; return onGpsPos;")(LIVE, FakeDate, liveElapsedMs);
  const M_PER_DEG = 111320;
  let travelled = 0;
  for (let i = 0; i < o.seconds; i++) {
    clock += 1000;
    travelled += o.groundSpeed;
    const jit = o.jitter ? (i % 2 ? o.jitter : -o.jitter) : 0;
    const lat = 53.48 + (travelled + jit) / M_PER_DEG;
    onGpsPos({ coords: { latitude: lat, longitude: -2.24, accuracy: o.accuracy, speed: o.speed, altitude: null } });
  }
  return { metres: LIVE.dist, points: LIVE.route.length, truth: travelled, diag: LIVE.gpsDiag };
}

test("a slow runner on a mediocre fix accrues very nearly the right distance", () => {
  // The owner's exact conditions: 1.03 m/s (16:07/km) at ±14 m.
  const r = run({ accuracy: 14, speed: 1.03, groundSpeed: 1.03, jitter: 1, seconds: 120 });
  assert.ok(r.metres > r.truth * 0.75,
    `covered ${r.truth.toFixed(0)} m, recorded ${r.metres.toFixed(0)} m — real movement is being discarded`);
  assert.ok(r.metres < r.truth * 1.35, `recorded ${r.metres.toFixed(0)} m against ${r.truth.toFixed(0)} m covered`);
  // ⚠️ The route is DELIBERATELY sparser than one point per fix: a point lands each time the anchor moves,
  // so roughly every leash-length (10-14 m). That is what stops the jitter inflation, and it is still a
  // point every few strides — about 350 for a 5 km run, plenty to draw. Asserting one per second here is
  // what the per-fix model produced, and it is the thing being deliberately left behind.
  assert.ok(r.points >= Math.floor(r.truth / 20),
    `only ${r.points} route points for ${r.truth.toFixed(0)} m — too sparse to draw a map from`);
  assert.ok(r.points > 4, `only ${r.points} route points — no usable route`);
});

test("and so does a runner whose phone refuses to report any speed at all", () => {
  // speed -1 is the normal cold-start / indoor case. The displacement rule does not need speed.
  const r = run({ accuracy: 14, speed: -1, groundSpeed: 2.5, jitter: 1, seconds: 120 });
  assert.ok(r.metres > r.truth * 0.75,
    `unknown speed lost the run: ${r.metres.toFixed(0)} m of ${r.truth.toFixed(0)} m`);
});

test("a phone standing still records NOTHING, even while claiming to be moving", () => {
  // ⚠️ THE FAULT HE CAUGHT. A stationary receiver reports a phantom speed from the same noisy signal as
  // its position, so believing `speed` produced 0.14 km without a step taken.
  const r = run({ accuracy: 14, speed: 1.2, groundSpeed: 0, jitter: 6, seconds: 300 });
  assert.equal(Math.round(r.metres), 0,
    `invented ${r.metres.toFixed(1)} m standing still, with the device claiming 1.2 m/s`);
  assert.equal(r.points, 0, "recorded route points while standing still");
});

test("nor does one standing still with no speed reported and heavier jitter", () => {
  const r = run({ accuracy: 20, speed: -1, groundSpeed: 0, jitter: 9, seconds: 300 });
  assert.equal(Math.round(r.metres), 0, `invented ${r.metres.toFixed(1)} m from jitter alone`);
});

test("a vague fix is not used at all", () => {
  // Worse than 35 m tells us almost nothing; better to record nothing than to guess.
  const r = run({ accuracy: 60, speed: 3, groundSpeed: 3, jitter: 2, seconds: 60 });
  assert.equal(Math.round(r.metres), 0, "used a fix too vague to trust");
  assert.ok(r.diag.badAcc > 50, "the diagnostics did not record the vague fixes");
});

test("the run's GPS accounting is recorded for Support so the next report carries numbers", () => {
  // ⚠️ Both faults look identical from a screenshot. Instrumentation is the only way the next one gets
  // settled from his phone instead of guessed at, the same reasoning as the keyboard diagnostics.
  const r = run({ accuracy: 14, speed: 1.03, groundSpeed: 1.03, jitter: 1, seconds: 60 });
  assert.ok(r.diag && r.diag.seen === 60, "fixes seen not counted");
  assert.ok(r.diag.credited > 0, "credited fixes not counted");
  assert.equal(r.diag.seen, r.diag.credited + r.diag.still + r.diag.badAcc + r.diag.spike,
    "the diagnostic counters do not account for every fix, so a future fault would hide between them");
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  assert.match(html, /function gpsDiagLine\(/, "the gps diagnostics are not surfaced anywhere");
  assert.match(html, /gpsDiagLine\(\),/, "gpsDiagLine is defined but never shown in Your data");
});

test("distance is gated on DISPLACEMENT, never on the speed the device claims", () => {
  // Names the invariant in one line at the top of the failure list if anyone reinstates a speed-trusting
  // or per-fix-floor rule.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function onGpsPos(");
  const body = html.slice(at, html.indexOf("function currentGpsPace", at));
  assert.match(body, /const leash = /, "the anchor leash is gone — distance is being credited per fix again");
  assert.match(body, /LIVE\.dist \+= net/, "distance is summing per-fix steps again, which inflates it by tens of percent");
  assert.ok(!/const floor = LIVE\.devSpeed != null \? 0\.3/.test(body),
    "the speed-trusting floor is back; a stationary phone will invent distance again");
});
