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
  const src = lift(["haversine", "onGpsPos", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  const FakeDate = { now: () => clock };
  // ⚠️ onGpsPos now stamps each route point with the elapsed time, so the harness has to supply the
  // same clock the app uses. liveElapsedMs subtracts paused time; this fake mirrors that with no
  // pauses, which is what these fixtures replay.
  const liveElapsedMs = () => FakeDate.now() - (LIVE.startMs || 0) - (LIVE.pausedMs || 0);
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const onGpsPos = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return onGpsPos;")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);
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
  // The credit starts life as the NET displacement and may only ever be trimmed (pedometer tab,
  // device-speed cap) — never replaced by a per-fix sum, which inflates by tens of percent.
  assert.match(body, /let credit = net/, "the credit no longer derives from net displacement");
  assert.match(body, /LIVE\.dist \+= credit/, "distance is summing per-fix steps again, which inflates it by tens of percent");
  assert.ok(!/const floor = LIVE\.devSpeed != null \? 0\.3/.test(body),
    "the speed-trusting floor is back; a stationary phone will invent distance again");
});

/**
 * ⚠️ FAULT FOUR, found by auditing against what iOS running apps actually do (2026-08-15).
 *
 * A NEGATIVE OR MISSING accuracy MEANS THE POSITION IS INVALID — CoreLocation saying it could not work
 * out where the phone is, so the coordinates are meaningless. The native shim converted that to the Web
 * API's null, and onGpsPos read `c.accuracy == null` as GOOD, then handed it `Math.max(10, null || 8)`
 * — the TIGHTEST leash available. The one kind of fix the system explicitly disowns was the kind
 * trusted most, free to credit distance and to move the anchor onto a garbage position.
 *
 * AND NOTHING EVER LOOKED AT HOW OLD A FIX WAS. Both iOS and the browser return a REMEMBERED position
 * the moment tracking starts; the shim discards the maximumAge the page asks for, so a run could anchor
 * where the runner was earlier and credit the journey back as their first distance.
 */
function feed(fixes: any[]) {
  const src = lift(["haversine", "onGpsPos", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  const FakeDate = { now: () => clock };
  const liveElapsedMs = () => FakeDate.now() - (LIVE.startMs || 0) - (LIVE.pausedMs || 0);
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const onGpsPos = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return onGpsPos;")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);
  for (const f of fixes) { clock += 1000; onGpsPos(f); }
  return { metres: LIVE.dist, points: LIVE.route.length, diag: LIVE.gpsDiag, acc: LIVE.acc, now: clock };
}
const at = (lat: number, o: any = {}) => ({
  coords: { latitude: lat, longitude: -2.24, accuracy: o.accuracy === undefined ? 8 : o.accuracy,
            speed: o.speed === undefined ? 2 : o.speed, altitude: null },
  timestamp: o.timestamp,
});

test("a fix with no usable accuracy credits nothing and never moves the anchor", () => {
  const M = 111320;
  // Start somewhere real, then a burst of INVALID fixes 500 m away, then back to the real position.
  // ⚠️ The valid step's speed matches its displacement (20 m over the 4 s the burst lasted = 5 m/s).
  // The fixture used to claim 2 m/s while moving 20 m/s-equivalent — a pair no phone produces — and
  // the speed-consistency cap rightly trims impossible pairs, so the kind fixture hid the mechanism.
  const r = feed([
    at(53.48),
    at(53.48 + 500 / M, { accuracy: null }),
    at(53.48 + 500 / M, { accuracy: -1 }),
    at(53.48 + 500 / M, { accuracy: NaN }),
    at(53.48 + 20 / M, { speed: 5 }),
  ]);
  // Only the last, valid, 20 m step may count. If any invalid fix were believed the anchor would have
  // teleported and this would read in the hundreds of metres.
  assert.ok(r.metres > 15 && r.metres < 30, "invalid fixes were believed: " + Math.round(r.metres) + " m");
  assert.equal(r.diag.badAcc, 3, "invalid fixes must be counted as vague, not silently swallowed");
  assert.equal(r.acc, 8, "an invalid reading must not overwrite the accuracy shown to the runner");
});

test("a remembered fix cannot seed the run, and cannot credit distance", () => {
  const M = 111320;
  const now = 1_760_000_001_000;
  // ⚠️ THE GATE IS SCOPED TO SEEDING, and that scoping is deliberate — applied to every fix it also
  // threw away the replayed backlog from a pocketed phone, which is legitimately minutes old.
  // Case one: the very first fix is iOS's remembered position. It must not become the anchor.
  // 20 m in 8 s at the default 2 m/s device speed — a pair a real phone can produce; the old 20 m in
  // one second contradicted its own claimed speed and the consistency cap trims exactly that.
  const seed = feed([
    at(53.48 + 500 / M, { timestamp: now - 600_000 }),   // 10 minutes old, half a km away
    at(53.48, { timestamp: now }),
    at(53.48 + 20 / M, { timestamp: now + 8000 }),
  ]);
  assert.equal(seed.diag.stale, 1, "the remembered fix was allowed to seed the anchor");
  assert.ok(seed.metres > 15 && seed.metres < 30,
    "the run should have started from the real position: " + Math.round(seed.metres) + " m");

  // Case two: a remembered fix arrives MID-run. It is no longer age-gated, so the spike rule has to
  // hold the line — and it must credit nothing, which is the guarantee that actually matters.
  const mid = feed([
    at(53.48, { timestamp: now }),
    at(53.48 + 20 / M, { timestamp: now + 1000 }),
    at(53.48 + 500 / M, { timestamp: now - 600_000 }),   // the ghost
  ]);
  assert.ok(mid.metres < 30, "a remembered fix credited phantom distance: " + Math.round(mid.metres) + " m");
  assert.ok(mid.diag.spike >= 1, "the spike rule did not catch the ghost");
});

test("a fix with no timestamp is still accepted — the browser is not required to send one", () => {
  const M = 111320;
  // ⚠️ Guards the fix against overreach. The PWA path and the test harness both omit the timestamp,
  // and refusing those would record 0.00 km for every web run — fault one, reintroduced by the cure.
  // No speed either — browsers routinely omit both, and with devSpeed unknown the consistency cap
  // must stand aside rather than zeroing the run.
  const r = feed([at(53.48, { speed: -1 }), at(53.48 + 20 / M, { speed: -1 }), at(53.48 + 40 / M, { speed: -1 })]);
  assert.ok(r.metres > 30, "fixes without a timestamp must still count: " + Math.round(r.metres) + " m");
  assert.equal(r.diag.stale, 0);
});

test("the native side refuses invalid and stale fixes before they reach the page", () => {
  const swift = readFileSync(new URL("../ios/InteRun/LocationService.swift", import.meta.url), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(swift, /horizontalAccuracy < 0/, "invalid fixes are still forwarded to the page");
  assert.match(swift, /timeIntervalSinceNow < -staleFixSeconds/, "stale fixes are still forwarded to the page");
  // ⚠️ A refusal must be COUNTABLE. A GPS refusing everything and a GPS delivering nothing look
  // identical from the outside, which is how the last distance fault went a week without an explanation.
  assert.match(swift, /dropped \+= 1/, "refusals are not counted");
  assert.match(swift, /__interunGeo\.dropped/, "the refusal count never reaches the page");
});

/**
 * ⚠️ FAULT FIVE, same audit: THE WATCH COLLECTED APPLE'S OWN FUSED DISTANCE AND THREW IT AWAY.
 *
 * `HKLiveWorkoutDataSource` has always gathered `distanceWalkingRunning` — GPS blended with wrist
 * motion, calibrated per-runner, the number the built-in Workout app shows — and the builder delegate
 * read only heart rate and calories from it. The displayed distance came from summing raw CLLocation
 * deltas instead: the exact pattern measured at 73% long under jitter in the tests above.
 *
 * It also meant the distance SAVED to Apple Health (HealthKit's own) and the distance shown in the app
 * (ours) did not have to agree about the same run.
 */
test("the watch reads the fused HealthKit distance rather than only its own GPS sum", () => {
  const src = readFileSync(new URL("../ios/InteRunWatch/WorkoutManager.swift", import.meta.url), "utf8");
  const bare = src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\/\/.*$/gm, "");

  // It must be collected AND read. It was always collected; being read is the fix.
  assert.match(bare, /HKQuantityType\(\.distanceWalkingRunning\)/, "the type is no longer collected");
  const delegate = bare.slice(bare.indexOf("didCollectDataOf collectedTypes"));
  assert.match(delegate, /quantityType == HKQuantityType\(\.distanceWalkingRunning\)/,
    "the builder delegate ignores distance again — Apple's fused figure is being discarded");

  // ⚠️ CUMULATIVE, so assigned and never added to. `+=` here would double-count every sample.
  assert.ok(!/self\.distanceMetres \+= /.test(delegate), "HealthKit's distance is cumulative and must not be accumulated");
  // ⚠️ AND NEVER BACKWARDS. A distance that decreases mid-run reads as the app losing the run.
  assert.match(delegate, /metres > self\.distanceMetres/, "the distance must never be allowed to go backwards");

  // The GPS sum must survive as the fallback for when HealthKit never delivers.
  assert.match(bare, /gpsDistanceMetres \+= step/, "the GPS fallback accumulation is gone");
  assert.match(bare, /if !adoptedHealthKitDistance \{ distanceMetres = gpsDistanceMetres \}/,
    "the GPS sum must drive the display only while HealthKit is silent");

  // ⚠️ WorkoutManager outlives a run (@StateObject), so run two inherits whatever run one left.
  const reset = bare.slice(bare.indexOf("func reset()"), bare.indexOf("func reset()") + 900);
  assert.match(reset, /gpsDistanceMetres = 0/, "reset must clear the GPS fallback or run two starts mid-run");
  assert.match(reset, /adoptedHealthKitDistance = false/, "reset must clear the adoption flag");
});

/**
 * ⚠️ FAULT THREE FROM THE AUDIT, and the biggest addition: THE STEP COUNTER.
 *
 * Every iPhone has a motion chip that counts steps and estimates distance from stride length, which
 * iOS calibrates against GPS over time. It is most of why the big running apps agree with each other,
 * and this app used none of it.
 *
 * It is a GAP FILLER, never a second opinion. GPS measures the ground actually covered; the pedometer
 * infers distance from strides. Blending them continuously means two numbers arguing all run. These
 * tests pin the three things that make that safe: it credits nothing while GPS is working, it credits
 * a genuine gap once, and it refuses a reading no runner could produce.
 */
function pedoHarness() {
  const src = lift(["haversine", "onGpsPos", "pedoFillGap", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0, lastFixAt: null,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    pedo: { metres: 0, steps: 0, credited: 0, capped: 0 },
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  const FakeDate = { now: () => clock };
  const liveElapsedMs = () => FakeDate.now() - (LIVE.startMs || 0) - (LIVE.pausedMs || 0);
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const fns = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return { onGpsPos: onGpsPos, pedoFillGap: pedoFillGap };")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);
  const M = 111320;
  return {
    LIVE,
    tick: (ms: number) => { clock += ms; },
    gps: (metresNorth: number) => {
      LIVE.lastFixAt = LIVE.lastFixAt == null ? clock : LIVE.lastFixAt;
      fns.onGpsPos({ coords: { latitude: 53.48 + metresNorth / M, longitude: -2.24, accuracy: 8, speed: 3, altitude: null } });
    },
    steps: (cumulativeMetres: number) => { LIVE.pedo.metres = cumulativeMetres; fns.pedoFillGap(); },
  };
}

test("the step counter adds nothing while GPS is working", () => {
  const h = pedoHarness();
  // 20 m every 6 s ≈ 3.3 m/s, consistent with the harness's claimed 3 m/s — the old 20 m-per-second
  // fixture contradicted its own device speed and the consistency cap trims exactly such pairs.
  h.gps(0); h.tick(6000);
  for (let i = 1; i <= 20; i++) { h.gps(i * 20); h.tick(6000); h.steps(i * 20); }
  // ⚠️ THE FAILURE THAT WOULD MATTER MOST: every metre counted twice, once by each source.
  assert.equal(Math.round(h.LIVE.pedo.credited), 0, "the pedometer double-counted ground GPS had already credited");
  assert.ok(h.LIVE.dist > 350 && h.LIVE.dist < 420, "GPS distance is wrong: " + Math.round(h.LIVE.dist));
});

test("a real GPS blackout is filled once, and only for the gap", () => {
  const h = pedoHarness();
  // ⚠️ The pedometer counts THROUGHOUT, including while GPS is working — it does not switch on when
  // GPS fails. The first version of this fixture left it at zero during the GPS phase, so the gap it
  // then measured included ground GPS had already credited. A harness that does not mirror the real
  // device tests the wrong thing, and here it would have hidden double-counting rather than caught it.
  h.gps(0); h.steps(0); h.tick(1000); h.gps(20); h.steps(20);
  const before = h.LIVE.dist;
  // Into a tunnel: no fixes for 60 s, during which the pedometer reaches 200 m — 180 m of new ground.
  h.tick(60000);
  h.steps(200);
  const filled = h.LIVE.pedo.credited;
  assert.ok(filled > 150 && filled < 200, "the blackout was not filled correctly: " + Math.round(filled));
  assert.ok(h.LIVE.dist > before + 150, "the filled distance never reached the total");
  // ⚠️ And it must not keep paying for the same stretch on every later update.
  h.tick(1000); h.steps(200);
  assert.equal(Math.round(h.LIVE.pedo.credited), Math.round(filled), "the same gap was credited twice");
});

test("a pedometer reading no runner could produce is refused, not banked", () => {
  const h = pedoHarness();
  h.gps(0); h.tick(1000); h.gps(20);
  const before = h.LIVE.dist;
  // 30 s of silence, and the pedometer claims 900 m — 30 m/s, which is a car.
  h.tick(30000);
  h.steps(900);
  assert.equal(h.LIVE.dist, before, "an impossible pedometer reading was added to the run");
  assert.equal(h.LIVE.pedo.capped, 1, "the refusal must be counted, not silent");
});

test("the step counter is optional everywhere it is used", () => {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  // ⚠️ There is no pedometer in a browser, and the PWA must simply carry on without one.
  assert.match(html, /function pedoAvailable\(/, "the availability guard is missing");
  assert.match(html, /if \(pedoAvailable\(\)\) pedoPost\("start"\)/, "the counter is started unguarded");
  assert.match(html, /if \(pedoAvailable\(\)\) pedoPost\("stop"\)/, "the counter is stopped unguarded");
  // ⚠️ Left running it is a battery drain nothing reads, and the next run opens with a stale baseline.
  const stop = html.slice(html.indexOf("function stopLive("), html.indexOf("function stopLive(") + 1400);
  assert.match(stop, /pedoPost\("stop"\)/, "stopLive does not stop the pedometer");
  // And its contribution must be visible, or a filler doing nothing and one doing too much look alike.
  assert.match(html, /function pedoDiagLine\(/, "the pedometer contribution is not surfaced");
  assert.match(html, /pedoDiagLine\(\),/, "pedoDiagLine is defined but never shown in Your data");
});

test("the native side declares why it wants motion data", () => {
  const plist = readFileSync(new URL("../ios/InteRun-Info.plist", import.meta.url), "utf8");
  // ⚠️ Without NSMotionUsageDescription iOS TERMINATES the app on first access — it does not merely
  // refuse. This entry is load-bearing, not paperwork.
  assert.match(plist, /NSMotionUsageDescription/, "the motion permission string is missing — the app will be killed on first use");
  const swift = readFileSync(new URL("../ios/InteRun/PedometerService.swift", import.meta.url), "utf8");
  assert.match(swift, /isStepCountingAvailable/, "hardware availability is not checked");
  // distance is an OPTIONAL on CMPedometerData; treating a missing one as zero says "stopped moving".
  assert.match(swift, /data\.distance\?\.doubleValue/, "the optional distance is not handled safely");
});

/**
 * ⚠️ FAULT FIVE FROM THE AUDIT: A REPLAYED BATCH COLLAPSED IN TIME.
 *
 * iOS suspends the web view while the phone is in a pocket, so CoreLocation's fixes pile up and arrive
 * together the moment the runner looks at the screen. Route points were stamped with the elapsed time
 * AT THAT MOMENT, so every point in the batch got the same one — ten quiet minutes became an instant,
 * in exactly the field Strava reads to derive pace, moving time and splits.
 *
 * Splits were worse: they were only checked on the UI tick, which runs once for the whole backlog, so
 * a batch crossing two kilometre boundaries recorded ONE split and silently dropped the other.
 */
function replayHarness() {
  const src = lift(["haversine", "onGpsPos", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0,
    startMs: 0, pausedMs: 0, lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  LIVE.startMs = clock;
  const FakeDate = { now: () => clock };
  const liveElapsedMs = () => FakeDate.now() - LIVE.startMs - LIVE.pausedMs;
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const onGpsPos = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return onGpsPos;")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);
  const M = 111320;
  return {
    LIVE,
    tick: (ms: number) => { clock += ms; },
    /** A fix that HAPPENED `agoMs` ago and is only being delivered now — a replayed backlog. */
    fix: (metresNorth: number, agoMs = 0) => onGpsPos({
      coords: { latitude: 53.48 + metresNorth / M, longitude: -2.24, accuracy: 8, speed: 3, altitude: null },
      timestamp: clock - agoMs,
    }),
  };
}

test("a replayed backlog keeps each point's own time instead of collapsing to one", () => {
  const h = replayHarness();
  h.tick(1000); h.fix(0);
  // The phone goes in a pocket for five minutes. The fixes happened 300s, 200s and 100s ago; all
  // three are handed over at once, now.
  h.tick(300000);
  h.fix(150, 300000); h.fix(300, 200000); h.fix(450, 100000);
  const times = h.LIVE.route.map((p: any) => p.t);
  assert.equal(new Set(times).size, times.length,
    "every point in the batch got the same time — the run collapsed to an instant: " + JSON.stringify(times));
  // ⚠️ And they must be in order. A route whose times go backwards invents a negative split, and
  // Strava reads the reversal as a pause.
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i] >= times[i - 1], "route times went backwards: " + JSON.stringify(times));
  }
  // The oldest replayed fix should sit far earlier than the newest, not beside it.
  // Three fixes that happened 300s, 200s and 100s before delivery must span ~200s, not 0.
  assert.ok(times[times.length - 1] - times[0] > 150,
    "the batch spans only " + (times[times.length - 1] - times[0]) + "s of a five-minute stretch");
});

test("a live fix is unaffected — its time is where it always was", () => {
  const h = replayHarness();
  h.tick(1000); h.fix(0);
  h.tick(1000); h.fix(20);
  h.tick(1000); h.fix(40);
  const times = h.LIVE.route.map((p: any) => p.t);
  // ⚠️ Guards the fix against overreach: the ordinary case must not move. Delivery jitter of a second
  // or so is not a backlog, and treating it as one would drift every point on every normal run.
  // ⚠️ The FIRST fix seeds the anchor and creates no point; only credited ones do.
  assert.deepEqual(times, [2, 3], "a live run's point times changed: " + JSON.stringify(times));
});

test("a stretch that crosses two kilometres at once records both, and marks them estimated", () => {
  // ⚠️ A single credited GPS fix can never do this — the 200 m spike gate forbids it. The path that
  // genuinely can is the pedometer filling a long blackout, which adds the whole stretch in one go.
  const src = lift(["haversine", "onGpsPos", "pedoFillGap", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 900, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0,
    startMs: 0, pausedMs: 0, lastFixAt: null,
    pedo: { metres: 900, steps: 0, credited: 0, capped: 0, mark: 900, markAt: 0 },
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  LIVE.startMs = clock; LIVE.pedo.markAt = clock; LIVE.lastFixAt = clock;
  const FakeDate = { now: () => clock };
  const liveElapsedMs = () => FakeDate.now() - LIVE.startMs - LIVE.pausedMs;
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const fns = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return { pedoFillGap: pedoFillGap };")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);

  // Six minutes in a tunnel; the pedometer records 1200 m, carrying the run from 0.9 km past 2 km.
  clock += 360000;
  LIVE.pedo.metres = 2100;
  fns.pedoFillGap();

  const kms = LIVE.splits.map((s: any) => s.km);
  assert.deepEqual(kms, [1, 2], "kilometres were skipped when a gap fill crossed them: " + JSON.stringify(kms));
  // ⚠️ Both are estimates — the elapsed stretch divided evenly — and must say so, because runAnalysis
  // would otherwise score the runner against a number the app invented.
  assert.ok(LIVE.splits.every((s: any) => s.est), "a split the app estimated is not flagged");
});

test("an estimated split is never judged against the target band", () => {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("const judged = (s) =>");
  assert.ok(at > 0, "runAnalysis no longer gates judging on the split itself");
  const src = html.slice(at, at + 1200).replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /if \(s\.est\) return false/, "an estimated split is being scored as if measured");
  // ⚠️ And the runner is told. Printing an invented time bare, in a column of measured ones, is the
  // quiet fabrication this project refuses everywhere else.
  assert.match(html, /r\.est \? "estimated"/, "an estimated split is not labelled in the splits table");
});

/**
 * ⚠️ THE 2026-08-17 WALKING INFLATION, reproduced and pinned. The owner walked a 1 km custom session
 * with the badge reading ±2 m and the app credited 0.28 km for ~0.19 km walked (+46%) — his CURRENT
 * pace (device speed, 11:37/km) was right while AVERAGE (credited distance ÷ time, 8:03/km) was not.
 * Measured cause: the anchor seeds from the FIRST good fix, GPS then converges to truth, and the whole
 * correction — anything up to the 200 m spike gate — was credited as ground. Two guards hold the fix:
 * an early large displacement RE-SEEDS instead of crediting (the settle window), and a credit can
 * never exceed what the device's own Doppler speed says was coverable in the time (the speed cap).
 * Every scenario here is deterministic; the tolerances come from the measured probe matrix.
 */
function settleHarness() {
  const src = lift(["haversine", "onGpsPos", "pedoFillGap", "gpsFixElapsedMs", "checkSplits", "paceMark"]);
  const LIVE: any = {
    mode: "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0, lastKmMs: 0, lastFixAt: null,
    lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null,
    pedo: { metres: 0, steps: 0, credited: 0, capped: 0 },
    rt: { getStatus: () => "active" },
  };
  let clock = 1_760_000_000_000;
  LIVE.startMs = clock;                      // the settle window measures from the run's own start
  const FakeDate = { now: () => clock };
  const liveElapsedMs = () => FakeDate.now() - (LIVE.startMs || 0) - (LIVE.pausedMs || 0);
  const liveNowMs = () => liveElapsedMs();
  const liveCue = () => {};
  const fmtPace = (x: number) => String(Math.round(x));
  const fns = new Function("LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace",
    src + "; return { onGpsPos: onGpsPos, pedoFillGap: pedoFillGap };")(LIVE, FakeDate, liveElapsedMs, liveNowMs, liveCue, fmtPace);
  const M = 111320;
  return {
    LIVE,
    tick: (ms: number) => { clock += ms; },
    fix: (northM: number, o: any = {}) => fns.onGpsPos({
      coords: { latitude: 53.48 + northM / M, longitude: -2.24,
                accuracy: o.acc === undefined ? 5 : o.acc,
                speed: o.speed === undefined ? 1.4 : o.speed, altitude: null },
      timestamp: clock,
    }),
    steps: (cumulativeMetres: number) => { LIVE.pedo.metres = cumulativeMetres; fns.pedoFillGap(); },
  };
}

test("the owner's walk: a start-settle correction is re-seeded, never credited", () => {
  const h = settleHarness();
  // The first fix lands 90 m from where the runner actually is — the receiver still settling, with a
  // confidently-claimed ±5 m. It seeds the anchor because nothing can know better yet.
  h.fix(90);
  // From the next second GPS has converged: fixes track the true walk at 1.4 m/s from zero.
  for (let t = 1; t <= 134; t++) { h.tick(1000); h.fix(t * 1.4); }
  const truth = 134 * 1.4;
  assert.ok(h.LIVE.gpsDiag.reseeds >= 1,
    "the 90 m settle correction was not re-seeded — it was credited as walked distance");
  assert.ok(h.LIVE.dist < truth * 1.08,
    `the walk credited ${Math.round(h.LIVE.dist)} m for ${Math.round(truth)} m walked — the +46% defect is back`);
  assert.ok(h.LIVE.dist > truth * 0.78,
    `the settle fix is eating honest distance: ${Math.round(h.LIVE.dist)} m of ${Math.round(truth)} m`);
});

test("the settle is caught even when the device reports no speed at all", () => {
  // ⚠️ THE ROW THAT JUSTIFIES THE RE-SEED RULE. With Doppler speed absent the speed cap is disabled
  // entirely, so the settle window is the ONLY thing standing between the correction and the total.
  const h = settleHarness();
  h.fix(90, { speed: -1 });
  for (let t = 1; t <= 134; t++) { h.tick(1000); h.fix(t * 1.4, { speed: -1 }); }
  const truth = 134 * 1.4;
  assert.ok(h.LIVE.dist < truth * 1.08,
    `with no device speed the settle was credited again: ${Math.round(h.LIVE.dist)} m for ${Math.round(truth)} m`);
  assert.ok(h.LIVE.dist > truth * 0.78, "the no-speed walk lost honest distance");
});

test("a mid-run lurch under the spike gate is capped by the device's own speed", () => {
  const h = settleHarness();
  // A healthy minute of walking first, so the settle window (45 s) has closed.
  for (let t = 1; t <= 60; t++) { h.tick(1000); h.fix(t * 1.4); }
  const before = h.LIVE.dist;
  // Then the receiver lurches 120 m sideways in one second — under the 200 m spike gate, far beyond
  // what 1.4 m/s can cover. The old code credited all of it.
  h.tick(1000);
  h.fix(61 * 1.4 + 120);
  assert.ok(h.LIVE.dist - before < 10,
    `a 120 m receiver lurch credited ${Math.round(h.LIVE.dist - before)} m in one second at walking speed`);
  assert.ok(h.LIVE.gpsDiag.capped >= 1, "the trim must be counted, or the next report cannot see it");
});

test("ground the pedometer filled is not billed again when GPS recovers", () => {
  const h = settleHarness();
  // A healthy walking start, pedometer tracking alongside.
  for (let t = 1; t <= 60; t++) { h.tick(1000); h.fix(t * 1.4); if (t % 5 === 0) h.steps(t * 1.4); }
  const beforeGap = h.LIVE.dist;
  // 120 s under a bridge: no fixes at all, the pedometer keeps counting the real ground.
  for (let t = 65; t <= 180; t += 5) { h.tick(5000); h.steps(t * 1.4); }
  const paidByPedo = h.LIVE.pedo.credited;
  assert.ok(paidByPedo > 100, "the blackout was not filled by the pedometer: " + Math.round(paidByPedo) + " m");
  // GPS recovers exactly where the runner really is. Its net displacement from the pre-gap anchor
  // covers the SAME stretch the pedometer just paid for — measured +17% per two-minute blackout when
  // this was billed twice.
  h.tick(4000);
  h.fix(184 * 1.4);
  const truth = 184 * 1.4;
  assert.ok(h.LIVE.dist < truth * 1.10,
    `the blackout was billed twice: ${Math.round(h.LIVE.dist)} m credited for ${Math.round(truth)} m walked`);
  assert.ok(h.LIVE.dist > beforeGap + 80, "the recovery credited nothing at all — the gap's ground was lost");
});

test("an honest runner is still credited nearly everything (the 2026-08-04 rule holds)", () => {
  // ⚠️ THE GUARD THE FIXES MUST NEVER BREAK: under-crediting a real runner is the defect the anchor
  // design exists to prevent. Consistent 3.3 m/s with matching device speed, five minutes.
  const h = settleHarness();
  h.fix(0, { speed: 3.3 });
  for (let t = 1; t <= 300; t++) { h.tick(1000); h.fix(t * 3.3, { speed: 3.3 }); }
  const truth = 300 * 3.3;
  assert.ok(h.LIVE.dist > truth * 0.95,
    `an honest 3.3 m/s runner lost distance: ${Math.round(h.LIVE.dist)} m of ${Math.round(truth)} m`);
  assert.ok(h.LIVE.dist < truth * 1.03, "an honest runner is over-credited");
  assert.equal(h.LIVE.gpsDiag.capped, 0, "the speed cap trimmed a physically consistent run");
});
