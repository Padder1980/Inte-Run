import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  buildWristProbe, runWristProbe, runWristProbeFull, wristRoute, wristTimedRoute, workoutManagerSrc,
  swiftDecl, TRACKS, metres, perTenth, meanDev, idealEvenSample, attachTimes,
  type Pt, type Segment, type WristProbe,
} from "./watch-route-harness.ts";

/**
 * THE WRIST'S ROUTE, EXECUTED — the behavioural half of `test/watch-route-thinning.test.ts`.
 *
 * ⚠️ THIS FILE EXISTS BECAUSE FIVE DELIBERATE RE-BREAKS PASSED THAT FILE, AND ONE OF THEM WAS THE
 * EXACT MASK THE ROUTE FIX WAS WRITTEN AGAINST: THE COUNT IS KEPT AND THE TAIL IS DROPPED. The
 * accessor was changed to `if routeTail != nil { return routePoints }` — the identifier still present,
 * the tail never returned — and the suite stayed at 78 pass / 0 fail across every test file that reads
 * the watch Swift, while a three-hour run came back with 340 points, a 99.9% span, a per-tenth
 * histogram of `34 34 34 34 34 34 34 33 35 34` and its LAST POINT MISSING.
 *
 * The other four, all measured through the shipped code on a three-hour hostile route:
 *   • `reset()` re-arming `routeStride = 32` rather than 1 — the line is still there, so a presence
 *     check passes; run two of an app session came back as 19 points with its first LOST.
 *   • the thinner decimating by 3 while the stride still only doubled — both literals the structural
 *     guard matches still present, the route 4x back-loaded (`17 27 34 45 45 52 67 68 67 69`) with a
 *     perfect span and a plausible count.
 *   • the tail placed first (`[tail] + routePoints`) — first and last both lost, the line jumping from
 *     the end of the run back to its start.
 *   • the thinned buffer reversed (`routePoints = kept.reversed()`) — mean deviation 344 m, and the
 *     count, the span-of-set and the per-tenth histogram all reading exactly correct, because a
 *     distribution is order-blind.
 *
 * ⚠️ SO EVERY CLAIM HERE IS ON POINTS THAT CAME OUT OF THE COMPILED SWIFT, never on its source text.
 * House rule 7: a source-text assertion proves a string exists, never that anything reaches it. The
 * structural guards are still worth having — they catch a whole append site added outside the thinning
 * path, which no fixture can provoke — so they stay where they are, next to the phone's half, in a file
 * that needs nothing but node.
 *
 * ⚠️ AND NO CLAIM IS MADE ABOUT A COUNT, A SPAN OR A DISTRIBUTION ALONE. Each of the three reads
 * correct under at least one of the five. What separates them is asserting all of: both ends exact,
 * the ORDER, membership of the real track, the spread, the deviation from the ground actually covered,
 * and — for `reset()` — that run two is byte-identical to a fresh run.
 */

/* ================================================================================================ *
 * ONE CAPTURE, TAKEN ONCE                                                                          *
 * ================================================================================================ */

/**
 * ⚠️ FOUR FIXTURES AND FOUR DURATIONS, AND THE HOSTILE ONES ARE THE POINT. Six-metre hairpins whose
 * apex is a six-fix feature, a lemniscate that crosses its own ground both ways, and a mixture with
 * fine detail at BOTH ends — because a thinner verified on long gentle curves is not verified, and a
 * route back-loaded into its final tenth still draws plausibly on a circuit.
 *
 * The durations bracket the cap in both directions: ten minutes is under it (no thinning at all at
 * 1 Hz would be 601 fixes against 600, so exactly one halving), and six hours is five halvings.
 */
const DURATIONS = [600, 3600, 10800, 21600];

type Case = { name: string; secs: number; track: Pt[]; seg: Segment };

let probe: WristProbe;
let CASES: Case[] = [];
/** A six-hour run marked every thousand fixes, for the claims about the buffer as it fills. */
let MARKED: Segment[] = [];

before(() => {
  probe = buildWristProbe();
  for (const [name, fn] of Object.entries(TRACKS)) {
    for (const secs of DURATIONS) {
      const track = fn(secs);
      CASES.push({ name, secs, track, seg: wristRoute(probe, track) });
    }
  }
  const long = TRACKS.mixed!(21600);
  const script: string[] = [];
  long.forEach((p, i) => {
    script.push("P " + p.lat + " " + p.lng + " " + p.t);
    if (i > 0 && i % 1000 === 0) script.push("MARK at" + i);
  });
  MARKED = runWristProbe(probe, script);
}, { timeout: 180000 });

const label = (c: Case) => c.name + " at " + c.secs + "s";

/* ================================================================================================ *
 * THE HARNESS PROVES ITSELF FIRST                                                                  *
 * ================================================================================================ */

test("BLOCKER: the probe ran the shipped Swift, so nothing below is measuring a stub", () => {
  // ⚠️ A GUARD OVER A COLLECTION IS ONLY AS GOOD AS THE COLLECTION, and a probe that quietly lifted an
  // empty body would satisfy every assertion in this file. These are the discriminators: the state and
  // the reset lines are byte-for-byte present in the shipped source, and the run demonstrably thinned.
  const src = workoutManagerSrc();
  assert.ok(probe.declarations.length >= 4,
    "only " + probe.declarations.length + " route state declarations were lifted");
  for (const d of probe.declarations) {
    assert.ok(src.includes(d), "a lifted declaration is not in the shipped source: " + d);
  }
  for (const l of probe.resetLines) {
    assert.ok(src.includes(l.trim()), "a lifted reset line is not in the shipped source: " + l.trim());
  }
  // ⚠️ THE DECLARATIONS ARE LIFTED, NOT RETYPED, AND THAT IS LOAD-BEARING. Changing the DECLARATION of
  // `routeStride` from 1 to 32 — rather than reset()'s copy of it — loses the first point of every run
  // and reduces a ten-minute run to nineteen points; measured, a probe with a hand-written `= 1` reads
  // that as clean.
  assert.ok(probe.declarations.some((d) => /\brouteStride\b/.test(d)),
    "the intake stride's declaration was not lifted, so its initial value is not under test");
  assert.ok(probe.declarations.some((d) => /\brouteMaxPoints\b/.test(d)),
    "the wrist's own cap was not lifted, so the buffer bound below is not the shipped one");

  const threeHour = CASES.find((c) => c.name === "mixed" && c.secs === 10800)!;
  assert.ok(threeHour.seg.stride > 1,
    "a three-hour run left the intake stride at " + threeHour.seg.stride +
    " — no thinning happened at all, so the probe is not exercising the path under test");
  assert.ok(threeHour.seg.fed > 10000,
    "only " + threeHour.seg.fed + " fixes reached the Swift; the probe is not being fed");
});

/* ================================================================================================ *
 * BOTH ENDS — THE MASK THE STRUCTURAL GUARD COULD NOT SEE                                          *
 * ================================================================================================ */

test("BLOCKER: the route starts where the run started and ends where it ended", () => {
  // ⚠️ THIS IS THE ONE. Re-broken by making the accessor mention `routeTail` and return `routePoints`
  // anyway, the count stays at 340, the span reads 99.9%, the distribution is untouched and the mean
  // deviation moves by three centimetres — and the drawn line stops short of where the runner
  // finished. Nothing but the identity of the last point can see it.
  for (const c of CASES) {
    const r = c.seg.route;
    assert.ok(r.length > 2, label(c) + ": nothing was recorded at all");
    assert.deepEqual(r[0], c.track[0],
      label(c) + ": the route does not start where the run started. Got " +
      JSON.stringify(r[0]) + ", expected " + JSON.stringify(c.track[0]));
    assert.deepEqual(r[r.length - 1], c.track[c.track.length - 1],
      label(c) + ": the route does not end where the run ended — the drawn line stops short of the " +
      "finish. Got " + JSON.stringify(r[r.length - 1]) + ", expected " +
      JSON.stringify(c.track[c.track.length - 1]));
  }
});

test("BLOCKER: a fix the stride skips is still the last point, so the line reaches the finish", () => {
  // ⚠️ THE END OF A RUN IS ALMOST NEVER A KEEPER. At a stride of 32 the odds are 31 in 32 that the
  // final fix is one the stride skipped, so without the provisional tail the line stops up to 90 m
  // short — the trap `downsampledHrTrack` already records. This asks the question directly, at a
  // length chosen so the last fix CANNOT be a multiple of the stride.
  const secs = 10800;
  const track = TRACKS.mixed!(secs);
  const stride = CASES.find((c) => c.name === "mixed" && c.secs === secs)!.seg.stride;
  assert.ok(stride > 1, "the fixture no longer thins, so this measures nothing");
  let withTail = 0;
  for (let back = 1; back < stride; back++) {
    const cut = track.slice(0, track.length - back);
    const seg = wristRoute(probe, cut);
    assert.deepEqual(seg.route[seg.route.length - 1], cut[cut.length - 1],
      "a run of " + cut.length + " fixes lost its final point, so the drawn line ends before the " +
      "run does");
    if (seg.tail) withTail++;
  }
  // ⚠️ And the provisional-tail path must genuinely have been taken, or the sweep above proves only
  // that the stride happened to keep every one of those final fixes.
  assert.ok(withTail >= stride - 2,
    "only " + withTail + " of " + (stride - 1) + " run lengths ended on a fix the stride skipped, so " +
    "the provisional tail is barely exercised");
});

/* ================================================================================================ *
 * THE ORDER, WHICH A DISTRIBUTION IS BLIND TO                                                       *
 * ================================================================================================ */

test("BLOCKER: the route is in the order it was recorded", () => {
  // ⚠️ RE-BROKEN BY `routePoints = kept.reversed()`, WHICH READS PERFECTLY ON EVERY OTHER MEASURE:
  // 341 points, a per-tenth histogram of exactly 34 34 34 34 34 34 34 33 35 35, and a set of points
  // that is precisely the right set. The line drawn from it is nonsense — measured 344 m of mean
  // deviation from where the runner was when they were there, 586 m on the hairpin fixture.
  //
  // ⚠️ AND A GLOBAL NEAREST-SEGMENT DEVIATION CANNOT SEE IT EITHER, because the reversed line covers
  // the same ground. Only the order does.
  for (const c of CASES) {
    const r = c.seg.route;
    for (let i = 1; i < r.length; i++) {
      assert.ok(r[i]!.t > r[i - 1]!.t,
        label(c) + ": point " + i + " is not later than the one before it (" + r[i - 1]!.t + " then " +
        r[i]!.t + ") — the route is out of order, so the drawn line does not follow the run");
    }
  }
});

test("BLOCKER: every point is a whole fix the runner actually passed through", () => {
  // Two claims in one sweep, and both matter. Nothing is INVENTED — no midpoint, no average of two
  // fixes, no rounded copy — and nothing is PARTIAL: the probe feeds each fix as [lat, lng, t] and the
  // time comes back untouched, which is what proves the thinner moves whole points rather than
  // rebuilding them from coordinates. That third element is now what the wrist genuinely sends, and it
  // is the field a Strava upload lives or dies by — silently dropped, every wrist run goes up as a
  // manual activity with no map, no splits and no pace.
  for (const c of CASES) {
    const known = new Set(c.track.map((p) => p.lat + "," + p.lng + "," + p.t));
    for (const p of c.seg.route) {
      assert.ok(known.has(p.lat + "," + p.lng + "," + p.t),
        label(c) + ": the route contains a point the run never passed through: " + JSON.stringify(p));
    }
  }
});

/* ================================================================================================ *
 * THE PER-POINT TIME, AND THE PAUSE                                                                 *
 *                                                                                                   *
 * ⚠️ EXECUTED, NOT READ, AND THE PAUSE IS THE WHOLE REASON. The rule is that a point's time is the   *
 * run's own running seconds at the instant the FIX was taken — the fix's own clock, minus the pause   *
 * total in force when it was taken rather than at the end of the run. Every part of that sentence is  *
 * a different wrong answer, and none of the four is distinguishable from the source text:             *
 *                                                                                                   *
 *   • not subtracting the pause at all draws a straight line through the junction the runner waited   *
 *     at, at walking pace, which is the phone's own documented reason for using liveElapsedMs;        *
 *   • stamping on arrival gives a whole delivered batch one identical time;                           *
 *   • subtracting the FINAL pause total pulls every early point backwards;                            *
 *   • and a fix stamped inside a pause and delivered after the resume computes a time EARLIER than    *
 *     the point before it, which is a route that goes back in time.                                   *
 *                                                                                                   *
 * `routeSecondsAt` is static and pure so it can be driven directly, and `routeSample` is lifted onto  *
 * a two-field CLLocation shim so the whole pipeline — build, gate, thin, read — runs the shipped code.*
 * ================================================================================================ */

const T0 = 1_700_000_000;

test("BLOCKER: a point's time is the run's own running seconds at the moment the fix was taken", () => {
  const secs = runWristProbeFull(probe, [
    "START " + T0,
    "S " + T0,                 // the first fix of the run is second zero
    "S " + (T0 + 100),
    "PAUSE 60",
    "S " + (T0 + 160),         // 60 s of wall clock later, and the RUN is no further on
    "S " + (T0 + 220),
    "S " + (T0 - 5),           // a clock that has gone backwards is never a negative time
    "S " + (T0 + 100.4),       // whole seconds, and ROUNDED rather than truncated
    "S " + (T0 + 100.6),
  ]).seconds;
  assert.deepEqual(secs, [0, 100, 100, 160, 0, 40, 41],
    "the running clock is not what a route point is timed against: " + JSON.stringify(secs));
  // ⚠️ SPELT OUT, because deepEqual on a list of numbers proves the values and not what they mean.
  assert.equal(secs[0], 0, "a run's first fix is not second zero, so nothing can be timed from it");
  assert.equal(secs[2], secs[1],
    "the pause was counted as running time — a runner who waits at a crossing gets a straight line " +
    "through the junction at walking pace, which is the exact fault the phone's own route push " +
    "records fixing");
  assert.equal(secs[3]! - secs[2]!, 60,
    "running time did not resume after the pause: 60 s of running after a 60 s pause read " +
    (secs[3]! - secs[2]!) + " s");
  assert.equal(secs[4], 0, "a fix from before the run began produced " + secs[4] + " rather than 0");
  assert.equal(secs[6], 41, "the seconds are truncated rather than rounded, so a GPX loses half a second");
});

test("BLOCKER: a fix stamped inside a pause is refused, not placed before the point ahead of it", () => {
  // ⚠️ THIS IS THE CASE THE WATERMARK EXISTS FOR, AND IT IS NOT HYPOTHETICAL: the delegate discards
  // fixes while paused, so the batch CoreLocation hands over on the RESUME can carry fixes stamped
  // during it. Timed against the pause total as it now stands, those come out earlier than the point
  // before them — a route that goes backwards, and a Strava trace with a negative split in it.
  const leg = (from: number, n: number, lat = 51.5) =>
    Array.from({ length: n }, (_, i) => ({ lat: lat + (from + i) * 1e-4, lng: -0.12, at: T0 + from + i }));
  const midPause = leg(120, 3, 52.9);   // 1.5 km away, so its presence is unmistakable
  const seg = wristTimedRoute(probe, T0, [
    { fixes: leg(0, 100), pauseAfterSec: 60 },
    { fixes: [...midPause, ...leg(160, 40)] },
  ]);
  assert.equal(seg.fed, 143, "the probe did not feed every fix");
  assert.equal(seg.route.length, 140,
    "143 fixes with 3 of them stamped inside the pause were stored as " + seg.route.length);
  assert.ok(!seg.route.some((p) => p.lat > 52),
    "a fix taken while the run was paused is in the route, so the line detours to somewhere the " +
    "runner was standing still");
  // ⚠️ AND THE CLOCK IS CONTINUOUS ACROSS THE PAUSE. 100 running seconds before it, 101 after — the
  // pause contributes nothing, and the point after it is not thrown 60 s forward either.
  assert.equal(seg.route[99]!.t, 99, "the last point before the pause is not at 99 running seconds");
  assert.equal(seg.route[100]!.t, 100,
    "the first point after the pause reads " + seg.route[100]!.t + " running seconds rather than 100");
});

test("BLOCKER: no two points share a time, at any thinning stride", () => {
  // ⚠️ A GPX TRACKPOINT CARRIES WHOLE SECONDS once runStravaPayload strips the milliseconds, so two
  // points on one second are two positions at one instant — an infinite speed between them, in the
  // field Strava reads to work out pace. Swept over every fixture and every duration, including the
  // strides at which the buffer has been halved five times.
  for (const c of CASES) {
    const ts = c.seg.route.map((p) => p.t);
    assert.equal(new Set(ts).size, ts.length,
      label(c) + ": two stored points share a time, which is an infinite speed to Strava");
    for (let i = 1; i < ts.length; i++) {
      assert.ok(ts[i]! > ts[i - 1]!,
        label(c) + ": point " + i + " is timed at or before the one ahead of it (" + ts[i - 1] +
        " then " + ts[i] + ")");
    }
  }
  // And a run of fixes that genuinely repeat a second is refused rather than stored.
  const same = runWristProbe(probe, [
    "P 51.5 -0.12 0", "P 51.6 -0.12 0", "P 51.7 -0.12 1", "P 51.8 -0.12 1", "P 51.9 -0.12 2",
  ])[0]!;
  assert.deepEqual(same.route.map((p) => p.t), [0, 1, 2],
    "fixes sharing a second were both kept: " + JSON.stringify(same.route.map((p) => p.t)));
});

test("BLOCKER: a point with no time is not a point", () => {
  // ⚠️ MIXED IS WORSE THAN MISSING, WHICH IS WHY THIS IS A REFUSAL RATHER THAN A DEFAULT. Strava's
  // payload filters on isFinite(p.t), so an untimed point inside an otherwise-timed route is dropped
  // THERE instead — a GPX with a hole in it, and a map missing whatever ground that point described,
  // with nothing anywhere to say so. The wrist always has a clock, so a bare pair reaching the buffer
  // is a second call site assembling points by hand, and it fails loudly instead.
  // ⚠️ FED THROUGH 'PAIR', NOT 'P', AND THE FIRST VERSION OF THIS GUARD WAS VACUOUS FOR WANT OF IT.
  // The probe's 'P' handler requires four fields, so "P 51.5 -0.12" was skipped by the PARSER and
  // never reached the buffer at all — the re-break that accepts a bare pair sailed through, because
  // the instrument was filtering out the input under test. 'PAIR' hands over a two-element array.
  const seg = runWristProbe(probe, ["PAIR 51.5 -0.12", "PAIR 51.6 -0.12", "P 51.7 -0.12 5"])[0]!;
  assert.equal(seg.fed, 3, "the probe did not feed all three points, so this measures nothing");
  assert.deepEqual(seg.route, [{ lat: 51.7, lng: -0.12, t: 5 }],
    "a bare [lat, lng] pair was stored: " + JSON.stringify(seg.route));
});

test("BLOCKER: the shipped builder reads the fix's own clock, and one builder writes every point", () => {
  // ⚠️ STRUCTURAL, AND LEGITIMATELY SO: `routeSample` takes a CLLocation, so what it is HANDED cannot
  // be executed from here — only what it does with it, which the guards above cover. This is the
  // wiring, and it is the half a fixture cannot reach.
  const src = workoutManagerSrc();
  const sample = swiftDecl(src, "private func routeSample(_ loc: CLLocation)");
  assert.match(sample, /loc\.timestamp/,
    "the point is not timed from the fix's own clock. iOS suspends the watch app between fixes, so a " +
    "delivered batch stamped on arrival shares ONE time — ten quiet minutes as one instant, in the " +
    "field the whole per-point time exists to keep honest");
  assert.ok(!/\bDate\(\)/.test(sample),
    "routeSample reads the clock at the moment it runs, not the moment the fix was taken");
  assert.match(sample, /pausedSoFar:\s*pausedAccum/,
    "the pause total is not passed, so a runner who stopped at a crossing gets a straight line " +
    "through the junction");
  // ⚠️ AND THE DELEGATE MUST NOT ASSEMBLE ONE ITSELF. A hand-built pair there is refused by the append
  // gate and the route vanishes in silence — the shape and the time have to arrive together.
  const gps = swiftDecl(src,
    "nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations");
  assert.match(gps, /appendRoutePoint\(routeSample\(/,
    "the GPS delegate no longer records points through the one builder");
  const built = [...gps.matchAll(/appendRoutePoint\(/g)].length;
  assert.equal(built, 1, "the delegate has " + built + " append sites; only one can be the builder");
  // The payload must send the run's start instant, or a correctly timed route has nothing to be timed
  // FROM: runStravaPayload cannot recover one from a UUID and falls back to 09:00 on the run's date.
  const payload = swiftDecl(src, "func summaryPayload()");
  assert.match(payload, /"startMs"\]?\s*=\s*began\.timeIntervalSince1970/,
    "the wrist no longer sends when the run began, so a mapped wrist run lands in the runner's " +
    "Strava feed at 09:00 whatever time they actually ran");
});

/* ================================================================================================ *
 * THE SPREAD, WHICH A COUNT AND A SPAN ARE BLIND TO                                                 *
 * ================================================================================================ */

/**
 * ⚠️ BOTH BOUNDS ARE MEASURED, AND THE MEASUREMENT IS QUOTED BECAUSE A THRESHOLD FROM TASTE CATCHES
 * NOTHING — this project has shipped that mistake at least three times.
 *
 * Swept over the four fixtures at ten durations from five minutes to six hours (40 cases), the shipped
 * thinner's worst reading is a per-tenth spread of **1.067** and a widest gap of **1.007x the mean**.
 * The back-loading re-break — decimate by three, double the stride — reads **4.06** and **3.67**, and
 * the original truncation reads a spread of **600** (every point in the first tenth). The reversal
 * reads a gap ratio of **150.9**.
 *
 * So 1.5 sits 40% above anything correct and 2.7x below the defect.
 */
const TENTH_SPREAD_MAX = 1.5;
const GAP_RATIO_MAX = 1.5;

test("BLOCKER: the route is spread evenly across the whole run, not back-loaded into its end", () => {
  // ⚠️ THE HEADLINE FINDING OF THE WHOLE FIX, AND THE REASON THIS IS NOT A COUNT. Halving the buffer
  // without doubling the intake refills at full rate, so the old region's spacing doubles at every
  // pass: measured, 306 of 336 points in the LAST TENTH of a three-hour run, with a perfect 100% span
  // and an entirely plausible count. The milder version — decimate by three while the stride only
  // doubles — is the re-break that escaped the structural guard, because both of the literals it
  // matches are still there.
  for (const c of CASES) {
    const r = c.seg.route;
    const tenths = perTenth(r, c.secs);
    assert.ok(Math.min(...tenths) > 0,
      label(c) + ": a whole tenth of the run has no points at all: " + tenths.join(" "));
    const spread = Math.max(...tenths) / Math.min(...tenths);
    assert.ok(spread <= TENTH_SPREAD_MAX,
      label(c) + ": the points are not spread across the run — the densest tenth holds " +
      spread.toFixed(2) + "x the sparsest (bound " + TENTH_SPREAD_MAX + "). Per tenth: " +
      tenths.join(" "));

    const meanGap = c.secs / (r.length - 1);
    let widest = 0, at = 0;
    for (let i = 1; i < r.length; i++) {
      const g = r[i]!.t - r[i - 1]!.t;
      if (g > widest) { widest = g; at = i; }
    }
    assert.ok(widest / meanGap <= GAP_RATIO_MAX,
      label(c) + ": the widest gap in the route is " + widest.toFixed(0) + "s against a mean of " +
      meanGap.toFixed(1) + "s (at point " + at + ") — the spacing is uneven, so part of the run is " +
      "drawn in more detail than the rest");
  }
});

/**
 * ⚠️ MEASURED WORST 13.63 m ACROSS THE SAME 40 CASES (the lemniscate at six hours, where a 64-fix
 * stride cuts the corners of a 90 m loop). The reversal re-break reads 344-586 m. 40 m therefore sits
 * three times above anything correct and eight times below the defect.
 */
const MEAN_DEV_MAX_M = 40;

test("BLOCKER: the drawn line is where the runner was, when they were there", () => {
  // ⚠️ TIME-BRACKETED, NOT NEAREST-SEGMENT, and the difference is whether two of the five escapes are
  // visible at all. A global nearest-segment search asks "does this ground appear somewhere in the
  // line", which a route that comes back over itself — or one stored in reverse — answers yes to while
  // being completely wrong about when the runner was where. On the reversal re-break the same route
  // reads 344 m time-bracketed and near zero globally. It is also why every fixture here is
  // point-to-point: a circuit reads 18 m of error for a truncation that a point-to-point route reads
  // 1541 m for.
  for (const c of CASES) {
    const dev = meanDev(c.seg.route, c.track);
    assert.ok(dev <= MEAN_DEV_MAX_M,
      label(c) + ": the drawn line sits a mean of " + dev.toFixed(2) + " m from where the runner " +
      "actually was (bound " + MEAN_DEV_MAX_M + " m)");
  }
});

/**
 * ⚠️ AGAINST A CONTROL, NOT A PERCENTAGE OF THE FULL-RESOLUTION GROUND. How much of a run's ground a
 * 341-point line can claim is a property of the ROUTE, not of the thinner: at that resolution a track
 * of long curves keeps 97% of its ground and one of six-metre hairpins keeps 82%, because a hairpin
 * apex cannot be represented at any even spacing. So the claim is made against the line an IDEAL even
 * sample of the same size would draw. Measured over 104 cases the shipped thinner reads 0.9969-1.0032
 * of that control; the original truncation reads 0.060.
 */
const IDEAL_RATIO_TOL = 0.05;

test("BLOCKER: the route claims the ground an even sample of its own size would claim", () => {
  for (const c of CASES) {
    const ratio = metres(c.seg.route) / metres(idealEvenSample(c.track, c.seg.route.length));
    assert.ok(Math.abs(ratio - 1) <= IDEAL_RATIO_TOL,
      label(c) + ": the line claims " + (metres(c.seg.route) / 1000).toFixed(2) + " km where an even " +
      "sample of its own " + c.seg.route.length + " points claims " +
      (metres(idealEvenSample(c.track, c.seg.route.length)) / 1000).toFixed(2) + " km (ratio " +
      ratio.toFixed(4) + ")");
  }
});

/* ================================================================================================ *
 * THE BOUND, AS THE BUFFER FILLS                                                                    *
 * ================================================================================================ */

test("BLOCKER: the buffer never passes the wrist's own cap, at any point in a six-hour run", () => {
  // The memory and payload bound, asserted where it is enforced rather than where it is declared. A
  // cap small enough to leave the stride stuck would let the array grow forever, which is what
  // thinRoutePoints' `guard n > 2` exists to prevent, and it cannot be seen from the end of a run.
  assert.ok(MARKED.length > 20, "the six-hour run was marked only " + MARKED.length + " times");
  for (const s of MARKED) {
    assert.ok(s.buffer <= probe.cap,
      "at " + s.label + " the buffer held " + s.buffer + " points against a cap of " + probe.cap);
    assert.ok(s.route.length <= probe.cap + 1,
      "at " + s.label + " the route the phone would be sent was " + s.route.length +
      " points — more than the cap plus the one provisional tail point");
  }
  // And the cap is genuinely reached, or the assertion above is about a bound nothing approaches.
  assert.ok(Math.max(...MARKED.map((s) => s.buffer)) > probe.cap / 2,
    "the buffer never got near its cap, so this run does not exercise the thinning");
});

/* ================================================================================================ *
 * THE NEXT RUN OF THE APP SESSION                                                                   *
 * ================================================================================================ */

test("BLOCKER: after a reset the next run is indistinguishable from a fresh one", () => {
  // ⚠️ A PRESENCE CHECK ON `reset()` PROVED NOTHING, AND THIS IS THE RE-BREAK THAT SHOWED IT: setting
  // `routeStride = 32` in reset() rather than 1 leaves a line matching /routeStride\s*=/ in place, and
  // run two of an app session came back as NINETEEN points with its first LOST. WorkoutManager is a
  // @StateObject and outlives a run, so every route field is either cleared or inherited.
  //
  // ⚠️ COMPARED AGAINST A CONTROL IN THE SAME PROCESS, not against an expected count. A count is one
  // number and there are five fields; "identical to a fresh run" is the whole claim at once, and it
  // covers a sixth field added later that reset() forgets.
  const runTwo = TRACKS.hairpin!(600);
  const runOne = TRACKS.mixed!(4000);
  const script: string[] = [];
  for (const p of runTwo) script.push("P " + p.lat + " " + p.lng + " " + p.t);
  script.push("MARK fresh", "RESET");
  for (const p of runOne) script.push("P " + p.lat + " " + p.lng + " " + p.t);
  script.push("RESET");
  for (const p of runTwo) script.push("P " + p.lat + " " + p.lng + " " + p.t);
  script.push("MARK after");

  const segs = runWristProbe(probe, script);
  const fresh = segs.find((s) => s.label === "fresh")!;
  const after = segs.find((s) => s.label === "after")!;
  assert.ok(fresh && after, "the probe did not emit both segments");
  assert.ok(fresh.route.length > 100,
    "the control run is only " + fresh.route.length + " points, so there is little to compare");
  assert.equal(after.stride, fresh.stride,
    "run two started at an intake stride of " + after.stride + " where a fresh run starts at " +
    fresh.stride + " — it inherited the previous run's thinning");
  // ⚠️ AND THE TIME WATERMARK IS THE SEVEREST OF THE FIVE FIELDS, so it is named rather than left to
  // the comparison above. Left at run one's last time, every fix of run two is earlier in its own run
  // than that, so the append gate declines ALL of them and run two records no route whatever — not a
  // thinned one, not a back-loaded one, none.
  assert.ok(after.route.length > 100,
    "run two recorded " + after.route.length + " points: the time watermark was not cleared, so every " +
    "fix was refused as earlier than run one's last");
  assert.deepEqual(after.route, fresh.route,
    "run two of this app session is not the run a fresh session would have recorded: " +
    after.route.length + " points against " + fresh.route.length +
    ", first " + JSON.stringify(after.route[0]) + " against " + JSON.stringify(fresh.route[0]));
});

/* ================================================================================================ *
 * DEGENERATE LENGTHS                                                                                *
 * ================================================================================================ */

test("a run of any length is safe, and keeps both of its ends", () => {
  // The cap, either side of it, and twice it — plus the lengths thinRoutePoints' own guard is about.
  const cap = probe.cap;
  const track = TRACKS.linear!(2 * cap + 8);
  for (const n of [0, 1, 2, 3, 4, cap - 1, cap, cap + 1, cap + 2, 2 * cap, 2 * cap + 1]) {
    const seg = wristRoute(probe, track.slice(0, n));
    assert.equal(seg.fed, n, n + " fixes were fed and the probe counted " + seg.fed);
    assert.ok(seg.buffer <= cap, n + " fixes left " + seg.buffer + " in a buffer capped at " + cap);
    assert.ok(seg.route.length <= cap + 1,
      n + " fixes produced a route of " + seg.route.length + " points");
    if (n === 0) { assert.equal(seg.route.length, 0, "an empty run produced points"); continue; }
    assert.deepEqual(seg.route[0], track[0], n + " fixes lost the start of the run");
    assert.deepEqual(seg.route[seg.route.length - 1], track[n - 1]!,
      n + " fixes lost the end of the run");
  }
});

/* ================================================================================================ *
 * AND THE WHOLE CHAIN                                                                               *
 * ================================================================================================ */

/** Lift real functions out of the BUILT page so the phone's half can be executed, not read. */
function lift(names: string[]): string {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return names.map((name) => {
    const at = html.indexOf("function " + name + "(");
    assert.ok(at >= 0, "not in the build (run `node web/app.ts`): " + name);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + name);
  }).join("\n");
}

/**
 * ⚠️ THE DISTRIBUTION CLAIM HAS DELIBERATELY LOST MOST OF ITS TEETH HERE, AND THE TEETH MOVED RATHER
 * THAN VANISHED. The phone's thinner keeps the points where the route TURNS, so a route whose corners
 * fall unevenly in TIME legitimately gets unevenly spaced points — and must, or it is back to chording
 * across the features it exists to keep. Measured over these 16 cases the shipped chain reads a
 * densest/sparsest tenth ratio of up to 4.60 (the hairpin at an hour: 45 45 45 45 45 29 13 10 11 11,
 * because the wrist's own even sample catches some apexes and misses others and the thinner then keeps
 * the ones it caught). The back-loading re-break was measured at 4.06 on the WRIST'S OWN OUTPUT rather
 * than here, so those two figures are not a like-for-like pair and NO CLAIM is made that this bound
 * separates them — pretending it did would be a guard that cannot fail.
 *
 * ⚠️ THE BACK-LOADING DISCRIMINATOR IS THE WRIST'S OWN, ABOVE: `TENTH_SPREAD_MAX = 1.5` on
 * `c.seg.route`. The wrist still thins by an even halving with a doubling intake, so its output is
 * genuinely even, and that is where the 4.06 is caught. This bound only has to catch a route clustered
 * into part of the run, which the truncation reads at 600.
 */
const CHAIN_TENTH_SPREAD_MAX = 6.0;

/**
 * ⚠️ THE CLAIM THAT CARRIES THE WEIGHT NOW, AND IT IS MADE AGAINST A CONTROL RATHER THAN A PERCENTAGE.
 * How much of a run's ground 300 points can describe is a property of the ROUTE — a 42 km city marathon
 * keeps 0.991 of it and 65 km walked round a 90 m figure-of-eight (about 360 laps) keeps 0.515, and no
 * 300-point line can do better on the second. So the primary claim is that the shape-preserving thinner
 * never claims LESS ground than an even sample of the same size would: measured 1.000-1.148 across all
 * 16 cases, and the even sample is precisely what it replaced.
 *
 * The absolute floor is the truncation catcher and nothing else. Measured worst 0.515 (that lemniscate
 * at six hours); the worst REALISTIC case anywhere in this work is a 52-lap track session at 0.949; the
 * original truncation reads 0.056. So 0.45 sits below the honest worst case and eight times above the
 * defect. It is NOT tightened to flatter the numbers — the residual is real, it is stated, and the
 * remedy for it would be points per lap rather than a smaller bound.
 */
const CHAIN_GROUND_MIN = 0.45;
const CHAIN_VS_EVEN_MIN = 0.999;

test("BLOCKER: the wrist's route through the phone's own thinner still spans the run", () => {
  // ⚠️ THE ONLY PLACE THE TWO HALVES MEET. `test/watch-route-thinning.test.ts` measures the phone's
  // half against a MODEL of what the wrist sends, deliberately — the phone must not depend on the
  // wrist having thinned at all, because a watch on an older build sends 600 truncated points. This
  // is the other direction: what the runner actually keeps, from the real Swift through the real
  // `normalizeRoute` and `downsampleRoute`, with nothing modelled anywhere in the chain.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const capM = html.match(/\bROUTE_MAX_POINTS\s*=\s*(\d+)/);
  assert.ok(capM, "the build no longer declares ROUTE_MAX_POINTS");
  const cap = Number(capM![1]);
  const web = new Function("ROUTE_MAX_POINTS",
    lift(["normalizeRoute", "downsampleRoute"]) +
    "; return { normalizeRoute: normalizeRoute, downsampleRoute: downsampleRoute };")(cap) as {
      normalizeRoute: (r: unknown) => { lat: number; lng: number; t?: number }[];
      downsampleRoute: (r: unknown, max?: number) => { lat: number; lng: number; t?: number }[];
    };

  for (const c of CASES) {
    // ⚠️ FED AS TRIPLES, BECAUSE THAT IS WHAT CROSSES THE BRIDGE NOW. The wrist's points carry the
    // run's own running seconds, and `normalizeRoute`'s array branch is the one place that time can be
    // silently dropped — reading only p[0] and p[1] is exactly what sent every wrist run to Strava as
    // a manual activity.
    const sent = c.seg.route.map((p) => [p.lat, p.lng, p.t]);
    const stored = web.downsampleRoute(web.normalizeRoute(sent), cap);
    assert.ok(stored.length <= cap,
      label(c) + ": stored at " + stored.length + " points against a cap of " + cap);
    assert.deepEqual({ lat: stored[0]!.lat, lng: stored[0]!.lng },
      { lat: c.track[0]!.lat, lng: c.track[0]!.lng },
      label(c) + ": the stored route does not start where the run started");
    const end = c.track[c.track.length - 1]!;
    assert.deepEqual({ lat: stored[stored.length - 1]!.lat, lng: stored[stored.length - 1]!.lng },
      { lat: end.lat, lng: end.lng },
      label(c) + ": the stored route does not end where the run ended");
    for (const p of stored) {
      assert.ok(Number.isFinite(p.t),
        label(c) + ": a stored point lost its time on the way across the bridge: " + JSON.stringify(p));
    }
    // The weakened distribution claim — see CHAIN_TENTH_SPREAD_MAX for what it can and cannot see.
    const timed = attachTimes(stored, c.track);
    const tenths = perTenth(timed, c.secs);
    assert.ok(Math.min(...tenths) > 0,
      label(c) + ": a whole tenth of the stored run has no points: " + tenths.join(" "));
    assert.ok(Math.max(...tenths) / Math.min(...tenths) <= CHAIN_TENTH_SPREAD_MAX,
      label(c) + ": the stored points are clustered into part of the run: " + tenths.join(" "));

    // ⚠️ AND THE CLAIM THAT REPLACED IT: THE STORED LINE CLAIMS THE GROUND THE RUN COVERED. This is
    // what a GPX upload turns into a number in somebody's Strava feed, because a GPX has no distance
    // field at all. It also catches back-loading from the other side — a route whose first 90% is one
    // long chord claims far too little.
    const claimed = metres(stored as Pt[]);
    const evenControl = metres(idealEvenSample(c.track, stored.length));
    assert.ok(claimed >= CHAIN_VS_EVEN_MIN * evenControl,
      label(c) + ": the stored line claims " + (claimed / 1000).toFixed(2) + " km where an EVEN sample " +
      "of the same " + stored.length + " points claims " + (evenControl / 1000).toFixed(2) +
      " km — the shape-preserving thinner is doing worse than the even spread it replaced");
    assert.ok(claimed >= CHAIN_GROUND_MIN * metres(c.track),
      label(c) + ": the stored line claims " + (claimed / 1000).toFixed(2) + " km of a " +
      (metres(c.track) / 1000).toFixed(2) + " km run");
  }
});

test("BLOCKER: a timed route and the instant it started travel together in the wrist payload", () => {
  // ⚠️ EVERY TRACKPOINT IS WRITTEN AS startMs + t, SO ONE FIELD IS USELESS WITHOUT THE OTHER. The
  // phone refuses to build a GPX when the start instant is unknown (see runStravaPayload), because the
  // alternative is a correct map with an invented time of day — measured, a wrist run carrying times
  // but no startMs put its first trackpoint at 09:00:00Z against a real 06:30:00Z. So the wrist must
  // send BOTH or the timed route it worked to produce is thrown away at the far end.
  //
  // ⚠️ THIS GUARD EXISTS BECAUSE GATING startMs OFF WAS CAUGHT BY NOTHING. A re-break wrote
  // "if false, let began = startedAt" and the ENTIRE suite came back 0 fail — not merely the route
  // files. It is the newest field in the payload and the one that makes the rest of it usable.
  const body = swiftDecl(workoutManagerSrc(), "func summaryPayload");

  // ⚠️ DERIVED FROM BOTH PLACES A KEY CAN BE WRITTEN, and the first version of this guard read only
  // one of them. The payload opens with a dictionary LITERAL and then adds the conditional fields by
  // subscript, so a sweep for out["k"] = alone finds none of the always-present keys and reported the
  // payload as no longer sending a route at all. A guard over a collection is only as good as the
  // collection.
  const keys = [
    ...[...body.matchAll(/out\["([A-Za-z0-9_]+)"\]\s*=/g)].map((m) => m[1]!),
    ...[...body.matchAll(/^\s*"([A-Za-z0-9_]+)"\s*:/gm)].map((m) => m[1]!),
  ];
  assert.ok(keys.includes("route"), "summaryPayload no longer sends a route at all — read this test");
  assert.ok(keys.includes("startMs"),
    "the payload sends a route but not startMs, so its per-point times cannot be placed on a clock: " +
    "the run reaches Strava with a correct map at the wrong time of day. Keys sent: " + keys.join(", "));

  // ⚠️ AND PRESENT IS NOT THE SAME AS REACHABLE — which is exactly how the escape was written. A
  // constant-false condition leaves the identifier in the source for any presence check to find.
  const line = body.split("\n").find((l) => l.includes('out["startMs"]')) || "";
  assert.ok(!/\bfalse\b/.test(line),
    "the startMs assignment is behind a constant-false condition, so it is present and unreachable: " +
    line.trim());
  assert.match(line, /startedAt/,
    "startMs is no longer derived from the session's own start instant: " + line.trim());
});
