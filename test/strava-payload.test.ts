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
  const scope = { esc: (x: unknown) => String(x ?? ""), runStartMs: () => Date.parse("2026-08-09T09:00:00Z"), ...extra };
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

test("⚠️ the start time is taken from the run, never from now", () => {
  const html = page();
  const at = html.indexOf("function runStartMs(");
  assert.ok(at > 0, "runStartMs is gone");
  const fn = html.slice(at, html.indexOf("\nfunction ", at + 10));
  // ⚠️ A phone run's id carries the milliseconds, which is exact; a date-only run gets that day at a
  // sensible hour rather than a precise lie about a moment nobody recorded.
  assert.match(fn, /replace\("run-", ""\)/, "the exact start in the run id is ignored");
  assert.match(fn, /fromId - \(Number\(run\.sec\) \|\| 0\) \* 1000/, "the id is the FINISH time; the start is that minus the duration");
  assert.match(fn, /run\.dateIso \+ "T09:00:00Z"/, "a dated run has no fallback start");
});

test("⚠️ route points are timed at source, and the time survives ingest", () => {
  const html = page();
  // ⚠️ Recorded with liveElapsedMs, which subtracts paused time — Date.now() minus a start would put
  // a straight line through the junction a runner waited at, at walking pace.
  assert.match(html, /LIVE\.route\.push\(\{ lat: c\.latitude, lng: c\.longitude, t: Math\.max\(0, Math\.round\(liveElapsedMs\(\) \/ 1000\)\) \}\)/,
    "GPS points are not stamped with the elapsed time");
  // ⚠️ normalizeRoute runs on every ingest, so an unknown field is stripped there unless carried
  // deliberately — and the loss would only show up as an upload with no pace in it.
  const at = html.indexOf("function normalizeRoute(");
  const norm = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(norm, /isFinite\(Number\(p\.t\)\)/, "normalizeRoute strips the timestamps at ingest");
});
