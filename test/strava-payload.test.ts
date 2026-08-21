import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * What Inte-Run would send to Strava.
 * ⚠️ THE RULE THIS FILE EXISTS TO ENFORCE: never fabricate the missing half. A run without timed
 * route points cannot become a GPX without inventing when each point was reached — which draws a
 * perfectly even run that never happened, in somebody else's training log, under their name. The app
 * already refuses to fabricate elsewhere (a simulated run is stamped sim:true and skipped by every
 * adaptive check; a treadmill run stores no route rather than a guessed one) and it must here too.
 */
const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

function lift(name: string, extra: Record<string, unknown> = {}): Function {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  const end = html.indexOf("\nfunction ", at + 10);
  const src = html.slice(at, end > at ? end : at + 4000);
  // ⚠️ BOTH START READERS ARE STUBBED, because runStravaPayload asks two different questions of
  // them: runStartMs for the number to write, runStartExactMs for whether that number is real.
  // Stubbing only the first would leave the second undefined and every test here would throw.
  const scope = { esc: (x: unknown) => String(x ?? ""),
    runStartMs: () => Date.parse("2026-08-09T09:00:00Z"),
    runStartExactMs: () => Date.parse("2026-08-09T09:00:00Z"), ...extra };
  const keys = Object.keys(scope);
  return new Function(...keys, src + "\nreturn " + name + ";")(...keys.map((k) => (scope as any)[k]));
}

const RUN_WITH_TRACE = {
  id: "run-1786000000000", t: "5 km easy", type: "easy", dateIso: "2026-08-09", distKm: 5.02, sec: 1650,
  route: [{ lat: 53.4, lng: -1.5, t: 0 }, { lat: 53.401, lng: -1.501, t: 300 }, { lat: 53.402, lng: -1.502, t: 900 }],
};
const RUN_NO_TRACE = { id: "run-1786000000000", t: "Treadmill", type: "easy", dateIso: "2026-08-09", distKm: 8, sec: 2700, route: [] };
const RUN_UNTIMED = { ...RUN_WITH_TRACE, route: [{ lat: 53.4, lng: -1.5 }, { lat: 53.401, lng: -1.501 }] };

test("⚠️ a timed route becomes a real GPX", () => {
  const fn = lift("runStravaPayload") as (r: unknown) => any;
  const p = fn(RUN_WITH_TRACE);
  assert.equal(p.kind, "gpx");
  assert.equal(p.points, 3, "not every timed point reached the file");
  assert.match(p.gpx, /<gpx version="1\.1"/, "not valid GPX");
  assert.match(p.gpx, /<trkpt lat="53\.400000" lon="-1\.500000">/, "coordinates missing or malformed");
  // ⚠️ EVERY POINT CARRIES A TIME. Without them Strava imports a shape with no pace, no moving time
  // and no splits — which is most of why anybody wants the run there.
  assert.equal((p.gpx.match(/<time>/g) || []).length, 4, "a trackpoint is missing its time (3 points + metadata)");
  assert.match(p.gpx, /<time>2026-08-09T09:00:00Z<\/time>/, "the first point is not at the run's start");
  assert.match(p.gpx, /<time>2026-08-09T09:15:00Z<\/time>/, "the last point's time is not 900s after the start");
  assert.ok(!/NaN|undefined|Invalid/.test(p.gpx), "the file contains a broken value");
});

test("⚠️ a run with no usable trace goes as a manual activity, not an invented one", () => {
  const fn = lift("runStravaPayload") as (r: unknown) => any;
  for (const [label, run] of [["no route at all", RUN_NO_TRACE], ["route with no times", RUN_UNTIMED]] as const) {
    const p = fn(run);
    assert.equal(p.kind, "manual", label + " produced a GPX");
    assert.ok(!p.gpx, label + " fabricated a trace");
    assert.equal(p.distanceM, Math.round(run.distKm * 1000), label + " lost its real distance");
    assert.equal(p.elapsedSec, run.sec, label + " lost its real time");
  }
  // A treadmill run says so; a GPS-refused outdoor run is not a treadmill.
  assert.equal(fn(RUN_NO_TRACE).trainer, true, "a run with no route is not marked as an indoor effort");
  assert.equal(fn(RUN_UNTIMED).trainer, false, "an outdoor run with a route was marked as a treadmill run");
});

/**
 * Heart rate. ⚠️ hrSeries is [metres, bpm] — paired with DISTANCE, not time, because on a time axis
 * every pause is a plateau. Putting it on a trackpoint therefore means walking the route's own
 * cumulative distance, which is the same pairing the in-app chart draws from.
 */
const HR_RUN = {
  ...RUN_WITH_TRACE,
  // The fixture's three points sit ~130 m apart, so these samples bracket them.
  hrSeries: [[0, 120], [100, 140], [200, 160], [300, 170]],
};

test("⚠️ heart rate reaches Strava, attached by distance", () => {
  const fn = lift("runStravaPayload") as (r: unknown) => any;
  const p = fn(HR_RUN);
  assert.equal(p.kind, "gpx");
  assert.ok(p.hrPoints > 0, "no trackpoint carried a heart rate");
  // ⚠️ Without the namespace declaration Strava ignores the extension silently — the upload succeeds
  // and the heart rate is simply absent, which is indistinguishable from not having sent it.
  assert.match(p.gpx, /xmlns:gpxtpx="http:\/\/www\.garmin\.com\/xmlschemas\/TrackPointExtension\/v1"/,
    "the heart-rate namespace is missing, so Strava will drop the readings");
  assert.match(p.gpx, /<gpxtpx:TrackPointExtension><gpxtpx:hr>\d+<\/gpxtpx:hr><\/gpxtpx:TrackPointExtension>/,
    "the heart rate is not in the shape Strava reads");
  for (const bpm of p.gpx.match(/<gpxtpx:hr>(\d+)<\/gpxtpx:hr>/g) || []) {
    const n = Number(/(\d+)/.exec(bpm)![1]);
    assert.ok(n >= 100 && n <= 180, "a heart rate outside the fixture's own range appeared: " + n);
  }
  assert.ok(!/NaN|undefined/.test(p.gpx), "the heart-rate maths produced a broken value");
});

test("⚠️ a run with no heart rate ships no heart-rate machinery at all", () => {
  const fn = lift("runStravaPayload") as (r: unknown) => any;
  const p = fn(RUN_WITH_TRACE);   // same run, no hrSeries
  assert.equal(p.hrPoints, 0, "a run without heart rate reported some");
  assert.ok(!p.gpx.includes("gpxtpx"), "a GPX advertises an extension it never carries");
  // The plain trackpoints must be untouched by the heart-rate work.
  assert.equal((p.gpx.match(/<time>/g) || []).length, 4, "adding heart rate changed the plain trackpoints");
});

test("⚠️ a heart-rate dropout is left as a gap, not interpolated across", () => {
  // ⚠️ HealthKit stops delivering when the watch loses skin contact, so a wide gap between samples is
  // missing evidence — not a slow change. Drawing a smooth line through it would fabricate a steady
  // effort in somebody's training log, which is the rule this whole file exists to hold. Samples land
  // every ~5s, so a 400 m gap is far beyond any real sampling interval.
  const fn = lift("runStravaPayload") as (r: unknown) => any;
  const dropout = { ...RUN_WITH_TRACE, hrSeries: [[0, 120], [5000, 175]] };
  const p = fn(dropout);
  const beats = (p.gpx.match(/<gpxtpx:hr>/g) || []).length;
  assert.ok(beats <= 1,
    `heart rate was invented across a dropout — ${beats} trackpoints got a reading from two samples 5 km apart`);
});

test("⚠️ the start time is taken from the run, never from now", () => {
  const html = page();
  const decl = (name: string) => {
    const at = html.indexOf("function " + name + "(");
    assert.ok(at > 0, name + " is gone");
    return html.slice(at, html.indexOf("\nfunction ", at + 10));
  };
  // ⚠️ THE EXACT START MOVED INTO runStartExactMs AND runStartMsKnown NOW SHARES IT. Two copies of the
  // id arithmetic is two answers to "do we know when this run began" — one of which the debrief prints
  // as a time of day and one of which Strava uploads — and they would have had to learn about the
  // wrist's new start instant separately.
  const exact = decl("runStartExactMs");
  // ⚠️ A phone run's id carries the milliseconds, which is exact.
  assert.match(exact, /replace\("run-", ""\)/, "the exact start in the run id is ignored");
  assert.match(exact, /fromId - \(Number\(run\.sec\) \|\| 0\) \* 1000/,
    "the id is the FINISH time; the start is that minus the duration");
  // ⚠️ AND A WRIST RUN'S OWN INSTANT, WHICH ITS UUID ID CANNOT CARRY. Without it a properly mapped
  // wrist run lands in the runner's Strava feed at 09:00 whatever time they actually ran.
  assert.match(exact, /run\.startMs/, "the instant the watch sends is ignored");
  const fn = decl("runStartMs");
  assert.match(fn, /runStartExactMs\(/, "the Strava start no longer asks for the exact one first");
  // A date-only run gets that day at a sensible hour rather than a precise lie about a moment nobody
  // recorded — and this is the ONE reader entitled to invent it, because something must be sent.
  assert.match(fn, /run\.dateIso \+ "T09:00:00Z"/, "a dated run has no fallback start");
});

test("⚠️ route points are timed at source, and the time survives ingest", () => {
  const html = page();
  // ⚠️ Recorded through gpsFixElapsedMs, which subtracts paused time (it derives from liveElapsedMs)
  // AND uses the fix's own clock rather than the moment it was processed. Date.now() minus a start
  // would put a straight line through the junction a runner waited at, at walking pace.
  assert.match(html, /LIVE\.route\.push\(\{ lat: c\.latitude, lng: c\.longitude, t: Math\.max\(0, Math\.round\(fixMs \/ 1000\)\) \}\)/,
    "GPS points are not stamped with the elapsed time");
  // ⚠️ AND THE STAMP IS THE FIX'S OWN, NOT THE MOMENT IT ARRIVED. iOS suspends the web view while the
  // phone is pocketed, so fixes pile up and land in a batch — stamping on arrival gave every point in
  // that batch the SAME time, collapsing ten quiet minutes into one instant. That is precisely the
  // field Strava reads to derive pace, moving time and splits, so the collapse is the same fabricated
  // even run this test exists to prevent, arriving by a different route.
  const gf = html.indexOf("function gpsFixElapsedMs(");
  assert.ok(gf > 0, "the fix's own clock is no longer used for route points");
  const src = html.slice(gf, html.indexOf("\nfunction ", gf + 10)).replace(/^\s*\/\/.*$/gm, "");
  assert.match(src, /pos\.timestamp/, "the fix's timestamp is not read");
  assert.match(src, /liveElapsedMs\(\)/, "paused time is no longer subtracted");
  assert.match(src, /Math\.max\(at, lastT\)/, "route times must be monotone — a reversal reads as a pause to Strava");
  // ⚠️ normalizeRoute runs on every ingest, so an unknown field is stripped there unless carried
  // deliberately — and the loss would only show up as an upload with no pace in it.
  const at = html.indexOf("function normalizeRoute(");
  const norm = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(norm, /isFinite\(Number\(p\.t\)\)/, "normalizeRoute strips the timestamps at ingest");
});

test("BLOCKER: a timed route with an UNKNOWN start uploads as manual, not as a map at the wrong hour", () => {
  // ⚠️ THE GATE IS THE PAIR, AND THE TWO USED TO BE DECOUPLED. Every trackpoint is written as
  // startMs + t, so an unknown start does not degrade the upload gracefully: it puts a perfectly good
  // map, with perfectly good splits and pace, at the wrong TIME OF DAY in the runner's own log.
  // runStartMs must always answer something, and its fallback is that date at 09:00 — measured, a
  // wrist run carrying times but no startMs uploaded its first trackpoint at 09:00:00Z against a real
  // 06:30:00Z, two and a half hours out, with nothing about the activity looking wrong.
  //
  // ⚠️ THIS GUARD EXISTS BECAUSE DELETING startMs FROM THE WRIST PAYLOAD WAS CAUGHT BY NOTHING. A
  // re-break gated that one field off and the whole suite came back green, while the field is the
  // newest in the payload and the only thing that makes a wrist run's timed route usable.
  const known = lift("runStravaPayload") as (r: unknown) => any;
  assert.equal(known(RUN_WITH_TRACE).kind, "gpx",
    "a timed route with a known start must still be a real GPX — this guard has broken the good case");

  const unknown = lift("runStravaPayload", { runStartExactMs: () => null }) as (r: unknown) => any;
  const p = unknown(RUN_WITH_TRACE);
  assert.equal(p.kind, "manual",
    "a timed route whose start instant is unknown was uploaded as a GPX: its map is right and its " +
    "time of day is invented");
  // ⚠️ AND THE HONEST HALF MUST SURVIVE. Falling back is only defensible because the distance and the
  // duration are real; a manual activity that lost them would be a worse answer than the wrong hour.
  assert.equal(p.distanceM, 5020, "the manual fallback lost the run's real distance");
  assert.equal(p.elapsedSec, 1650, "the manual fallback lost the run's real duration");
  assert.ok(!p.gpx, "a manual activity must carry no GPX at all");
});
