import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  TRACKS, linearTrack, attachTimes, perTenth, metres, idealEvenSample, type Pt,
} from "./watch-route-harness.ts";

/**
 * THE MAP OF EVERY WRIST RUN LONGER THAN ABOUT TEN MINUTES WAS TRUNCATED.
 *
 * `WorkoutManager.didUpdateLocations` appended a route point only while `routePoints.count < 600`,
 * with no thinning on the wrist and none at ingest either. At roughly a credited fix a second that
 * cap is ten minutes: the line simply stopped mid-run, and the debrief hero, the recap and the share
 * card each drew that prefix as though it were the whole outing. Measured through the shipped code on
 * a synthetic point-to-point three-hour run at 1 Hz, the stored line was 1.82 km of 32.65 km of
 * ground and the missing ground lay a mean of 1540 m from anything kept.
 *
 * ⚠️ AND HALVING THE BUFFER AT THE CAP IS NOT THE FIX, WHICH IS THE FINDING THAT MATTERS MOST HERE.
 * Fixes keep arriving at 1 Hz, so a buffer that is merely halved refills at full rate and the old
 * region's spacing doubles at every pass. Measured on the same track that leaves 306 of 336 points in
 * the LAST TENTH of the run, with a perfect 100% span and an entirely plausible count — the mirror
 * image of the defect being fixed, and invisible to any check that counts points or measures a span.
 * The intake stride has to double with the halving. So the guards below are about the DISTRIBUTION,
 * never the count.
 *
 * Two halves, two files, two caps, and the pair is deliberate — see the reasoning at
 * `routeMaxPoints` in WorkoutManager.swift and at `ROUTE_MAX_POINTS` in web/app.ts.
 *
 * ⚠️ WHAT THIS FILE GUARDS, AND WHAT IT CANNOT. The phone's half is JavaScript, so it is lifted out of
 * the BUILT page and EXECUTED — a real run record goes in and the stored route is measured coming out
 * (the `test/gps-distance.test.ts` precedent). The wrist's half below is guarded STRUCTURALLY: comments
 * stripped, and every list of names DERIVED from the source so it cannot go stale in the direction
 * that matters.
 *
 * ⚠️ AND STRUCTURAL IS NOT ENOUGH — FIVE DELIBERATE RE-BREAKS PASSED EVERY ASSERTION IN THIS FILE,
 * one of them the exact mask the whole fix is about: the accessor changed to
 * `if routeTail != nil { return routePoints }`, the identifier still present, the tail never returned,
 * THE COUNT KEPT AND THE TAIL DROPPED. So the behavioural guards live in
 * `test/watch-route-swift.test.ts`, which lifts `appendRoutePoint`, `thinRoutePoints`, the `route`
 * accessor, the state declarations and `reset()`'s own route lines out of the shipped Swift, compiles
 * them, and measures the points that come out. Read that file before trusting anything in this one
 * about the wrist.
 *
 * ⚠️ THE STRUCTURAL GUARDS STAY ANYWAY, and not out of sentiment: they catch what no fixture can
 * provoke — a whole new append site added outside the thinning path, the payload reading the raw array
 * again, the watch's own map disagreeing with the run that is sent home. And they need nothing but
 * node, so a machine with no Swift toolchain still gets them.
 */

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// Reading the two sources
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/**
 * Swift with its comments removed.
 *
 * ⚠️ NOT TIDINESS. The comments in this area deliberately quote the broken code they replaced
 * ("This used to read `routePoints.count < 600`"), so a guard reading the raw file matches the
 * comment whatever the code says — the trap CLAUDE.md records firing on five earlier guards.
 */
function stripComments(src: string): string {
  return src
    .split("\n")
    .map((line) => {
      let quoted = false;
      for (let i = 0; i < line.length - 1; i++) {
        const c = line[i]!;
        if (c === "\\") { i++; continue; }
        if (c === '"') { quoted = !quoted; continue; }
        if (!quoted && c === "/" && line[i + 1] === "/") return line.slice(0, i);
      }
      return line;
    })
    .join("\n");
}

const wm = () => stripComments(
  readFileSync(new URL("../ios/InteRunWatch/WorkoutManager.swift", import.meta.url), "utf8"));

/** The body of a Swift declaration, from its signature to the matching close brace. */
function fn(src: string, signature: string): string {
  const at = src.indexOf(signature);
  assert.notEqual(at, -1, `the source no longer contains ${signature}`);
  const open = src.indexOf("{", at);
  assert.notEqual(open, -1, `${signature} has no body`);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(open + 1, i); }
  }
  return assert.fail(`${signature} is unbalanced`);
}

/** Lift real functions out of the BUILT page so they can be executed rather than read. */
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

/** The value of a top-level `const NAME = <number>;` in the built page. */
function constant(name: string): number {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const m = html.match(new RegExp("\\b" + name + "\\s*=\\s*(\\d+)"));
  assert.ok(m, `the build no longer declares ${name}`);
  return Number(m![1]);
}

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// THE FIXTURES, AND THE ONE CLAIM THEY DO NOT MAKE
//
// ⚠️ POINT-TO-POINT ON PURPOSE, ALL OF THEM. A looped route MASKS truncation in any deviation measure,
// because the missing tail runs over ground the kept prefix already covers — measured, the same 3-hour
// truncation reads 1541 m of mean error on a point-to-point route and 18 m on a circuit. A fixture
// that flatters the defect certifies a fix that has not been made.
//
// ⚠️ BUT THEY DO RUN OVER THEIR OWN GROUND, AND AN EARLIER VERSION OF THIS FILE CLAIMED OTHERWISE.
// It said times could be re-attached by a coordinate lookup "which is safe only because this fixture
// never runs over its own ground". Measured on `linearTrack` itself: 0 repeated rounded coordinates at
// 600 s, 7 at 3600 s, and 12 at 10800 s with a worst time skew of 1399 s — because its own
// `t % 600` rule turns it back on itself every ten minutes. A `Map` answers with the FIRST visit, so a
// stored point landing on a collision was attributed to the wrong tenth of the run. `attachTimes`
// walks the track IN ORDER instead, which is exact for any thinned route (a thinned route is a
// subsequence) and needs no such property of the fixture — so the claim was removed rather than the
// geometry made tamer. `hairpinTrack` and `eightTrack` cross their own ground far more, deliberately.
//
// They live in `test/watch-route-harness.ts` because the behavioural guards need the same ones; two
// copies of a fixture is two things to keep in step, and the second is the one nobody updates.
// ─────────────────────────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 1. THE WRIST — structural, because there is no Swift runtime here
// ─────────────────────────────────────────────────────────────────────────────────────────────────

test("BLOCKER: the append site has no count gate, so recording never stops", () => {
  // The defect itself: `if movedThisBatch, let last = usable.last, routePoints.count < 600 {`.
  const src = wm();
  const gps = fn(src, "nonisolated func locationManager(_ manager: CLLocationManager, didUpdateLocations");
  assert.doesNotMatch(gps, /routePoints\.count\s*[<>]=?/,
    "the GPS delegate compares the point count again — a wrist run's map is truncated once more");
  assert.doesNotMatch(gps, /routePoints\.append/,
    "the delegate appends straight to the array, bypassing the thinning entirely");
  assert.match(gps, /appendRoutePoint\(/,
    "the delegate no longer records route points at all");
});

test("BLOCKER: appendRoutePoint is the only route into the buffer", () => {
  // ⚠️ DERIVED, NOT LISTED. A hand-written list of permitted writers goes stale the first time
  // somebody adds a fifth one, and the failure is silence — a new append site with no thinning behind
  // it is exactly the defect this file exists for. So every assignment to `routePoints` anywhere in
  // the type is found and each is required to sit in a function that is allowed to make one.
  const src = wm();
  const writes: string[] = [];
  const re = /routePoints\s*(=[^=]|\.append|\.removeAll|\.remove\(|\.insert\()/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    // Which declaration is this inside? The nearest MEMBER header above it. Anchored at exactly four
    // spaces of indentation, which is where members of this type sit — without that anchor a local
    // `var kept` inside the thinner is read as the owner and the guard reports its own fix as a stray.
    // Modifiers are matched generically so `nonisolated func` and `private(set) var` both resolve.
    const before = src.slice(0, m.index);
    const owner = [...before.matchAll(/^ {4}(?:[\w()@]+\s+)*(?:func|var)\s+([A-Za-z_]\w*)/gm)].pop();
    writes.push(owner ? owner[1]! : "(top level)");
  }
  assert.ok(writes.length >= 3, "no writes to routePoints found at all — the guard is looking at nothing");
  const allowed = new Set(["reset", "thinRoutePoints", "appendRoutePoint"]);
  const strays = [...new Set(writes)].filter((w) => !allowed.has(w));
  assert.deepEqual(strays, [],
    "routePoints is written outside the thinning path, by: " + strays.join(", "));
});

test("BLOCKER: the thinner keeps the first point, keeps the last, and halves the intake with it", () => {
  const src = wm();
  const thin = fn(src, "private func thinRoutePoints()");
  // Keeps the first: the decimating walk must start at index 0.
  assert.match(thin, /stride\(from:\s*0\s*,/,
    "the thinning walk no longer starts at index 0, so the start of the run is dropped");
  // Keeps the last: the final index is appended when the even walk misses it.
  assert.match(thin, /routePoints\[n - 1\]/,
    "the last point is no longer preserved — the drawn line will end before the run does");
  // ⚠️ AND THE INTAKE MUST DOUBLE IN THE SAME FUNCTION. Halving alone back-loads the route: 306 of
  // 336 points in the final tenth of a 3-hour run, with a perfect span and a plausible count.
  assert.match(thin, /routeStride\s*\*=\s*2/,
    "the intake stride no longer doubles when the buffer is halved, so the route is back-loaded " +
    "towards the end of the run — a point count and a span both look entirely correct");
  // Guarded against a cap small enough to leave the stride stuck and the array unbounded.
  assert.match(thin, /guard n > 2 else \{ return \}/,
    "the degenerate case is unguarded; with a tiny cap the array would grow past its own bound");
});

test("BLOCKER: a skipped fix becomes the provisional last point rather than being dropped", () => {
  // ⚠️ At a stride of 32, up to 31 fixes at the END of a run are not keepers. Dropped, the drawn line
  // stops up to 90 m short of where the runner finished — the same trap `downsampledHrTrack` records
  // ("dropping the last one would end the chart before the end of the run").
  const src = wm();
  const append = fn(src, "private func appendRoutePoint(_ pt: [Double])");
  const skip = append.match(/guard routeSinceKeep >= routeStride else \{([^}]*)\}/);
  assert.ok(skip, "the stride is no longer what decides whether a fix is kept");
  assert.match(skip![1]!, /routeTail = pt/,
    "a fix the stride skips is discarded, so the route ends before the run does");
  // And a kept fix must clear the tail, or the newest point is duplicated behind itself.
  assert.match(append, /routeTail = nil/,
    "a kept fix no longer clears the provisional tail, so it is recorded twice");
});

test("BLOCKER: the payload and the watch's own map read ONE definition of the route", () => {
  // ⚠️ `summaryPayload` used to read `routePoints` directly. With a provisional tail held outside the
  // array that is two builders of one route: the watch's map would show the newest ground and the run
  // the phone stores would end up to 90 m short of it. Same class as the four fix-one-builder faults
  // CLAUDE.md records.
  const src = wm();
  const payload = fn(src, "func summaryPayload()");
  assert.doesNotMatch(payload, /"route":\s*routePoints/,
    "the payload reads the raw array again, so the run the phone stores ends before the run did");
  assert.match(payload, /"route":\s*route\b/, "the payload no longer sends the route at all");
  // The accessor is what adds the tail, and it must still do so.
  const accessor = fn(src, "var route: [[Double]] {");
  assert.match(accessor, /routeTail/,
    "the route accessor ignores the provisional tail, so the newest fix is never sent or drawn");
  // The wrist's own map reads the same accessor, not the array.
  const view = stripComments(
    readFileSync(new URL("../ios/InteRunWatch/WorkoutView.swift", import.meta.url), "utf8"));
  assert.doesNotMatch(view, /workout\.routePoints/,
    "the watch's map reads the raw array, so it disagrees with the run that is sent home");
});

test("BLOCKER: every route field is cleared for the next run of the app session", () => {
  // ⚠️ WorkoutManager is a @StateObject and outlives a run. A stride left at 32 would have run two
  // keeping one fix in thirty-two from its first minute; a tail left behind would put a point from
  // run one at the end of run two's line.
  //
  // ⚠️ DERIVED FROM THE DECLARATIONS, so a sixth route field added later cannot be forgotten here —
  // which is the whole failure mode. A typed list would pass while the new field went uncleared.
  const src = wm();
  const declared = [...src.matchAll(/^\s*private(?:\(set\))? var (route[A-Z]\w*)/gm)].map((m) => m[1]!);
  assert.ok(declared.length >= 4,
    "no route state fields were found; the guard is deriving from nothing. Found: " + declared.join(", "));
  const reset = fn(src, "func reset()");
  for (const field of declared) {
    assert.match(reset, new RegExp("\\b" + field + "\\s*="),
      `reset() does not clear ${field}, so the next run of this app session inherits it`);
  }
});

test("the wrist's cap and the phone's cap are a stated pair, and the wrist's is the looser", () => {
  // ⚠️ Not a duplicate to be tidied away: the wrist bounds MEMORY and the WatchConnectivity payload
  // while thinning as it goes and not knowing how long the run will be; the phone bounds what is
  // STORED and thins once with the whole run in hand. If the wrist's ever drops to or below the
  // phone's, the headroom that makes a ten-minute run detailed is gone for nothing.
  const src = wm();
  const cap = src.match(/private static let routeMaxPoints\s*=\s*(\d+)/);
  assert.ok(cap, "WorkoutManager no longer names its own route cap");
  const wrist = Number(cap![1]);
  const phone = constant("ROUTE_MAX_POINTS");
  assert.ok(wrist > phone,
    `the wrist's cap (${wrist}) is no longer looser than the phone's stored cap (${phone}), ` +
    "so the wrist is throwing away detail the phone would have kept");
  // And a 3-hour run at 1 Hz is about 10,800 fixes — the reason a cap exists at all.
  assert.ok(wrist < 10800,
    "the wrist's cap no longer bounds a 3-hour run, which is what it exists to do");
});

// ─────────────────────────────────────────────────────────────────────────────────────────────────
// 2. THE PHONE — executed, against the real built code
// ─────────────────────────────────────────────────────────────────────────────────────────────────

/** Run the real `ingestWatchRun` from the built page and hand back the record it stored. */
function ingest(payload: Record<string, unknown>) {
  const src = lift([
    "ingestWatchRun", "normalizeRoute", "normalizeSplits", "downsampleRoute",
    "hrSeriesOrNull", "downsampleSeries",
  ]);
  const state: any = { logged: [], done: {} };
  const noop = () => {};
  const args: Record<string, unknown> = {
    state: state,
    PLAN: { weeks: [] },
    profile: { recentTimeS: 1500 },
    ROUTE_MAX_POINTS: constant("ROUTE_MAX_POINTS"),
    HR_MAX_POINTS: constant("HR_MAX_POINTS"),
    PACE_MODEL_VERSION: 1,
    saveRuns: noop,
    sessionsForIso: () => [],
    rawSessionsForIso: () => [],
    sessionStepText: () => null,
    paceStampFor: () => ({ pband: null, pwin: null, pmix: null }),
    plannedRpeBandOf: () => null,
    todayIso: () => "2026-08-21",
    runDateLabelIso: (iso: string) => iso,
    fmtPace: (n: number) => String(n),
    doneKey: () => "k",
    shoeCreditRun: noop,
    stravaMaybeAutoSend: noop,
    // ⚠️ STUBBED FOR THE SAME REASON stravaMaybeAutoSend IS: this file exercises what the save path STORES,
    // and the automatic grid post is a side effect that draws to a canvas node has none of. Its own
    // behaviour is guarded in test/community.test.ts. ⚠️ It had to be added the moment the call arrived
    // in saveLiveSession — the lift list is hand-written on purpose, so it fails loudly rather than
    // quietly measuring less, and these six tests failed with a ReferenceError until it was here.
    clubMaybeAutoPost: noop,
    maybeAutoPaceCalibrate: () => false,
    maybeTrainingFlags: () => true,
    assessFitnessFromRun: noop,
    renderUnlessTyping: noop,
  };
  const names = Object.keys(args);
  const ingestWatchRun = new Function(...names, src + "; return ingestWatchRun;")(
    ...names.map((n) => args[n]));
  const why = ingestWatchRun(payload);
  assert.equal(why, "", "the run was refused: " + why);
  return state.logged[0];
}

/**
 * The real `runStravaPayload`, so what a stored run WOULD be uploaded as is measured rather than
 * argued for.
 *
 * ⚠️ `runStartMs` AND `runStartExactMs` ARE LIFTED RATHER THAN STUBBED, because the whole claim about a
 * wrist run's start instant lives in them: stub them and the GPX's own start time is whatever the stub
 * says, which is the one thing under test.
 */
function strava(run: Record<string, unknown>) {
  const src = lift(["runStravaPayload", "runStartMs", "runStartExactMs"]);
  // ⚠️ NO CLOCK IS STUBBED, AND NOTHING HERE NEEDS ONE. Every run this helper is given carries a
  // dateIso (ingestWatchRun always stores one), so runStartMs's fallback is Date.parse of that date at
  // 09:00 rather than anything read from now. A stubbed clock would have hidden a reader that DID
  // depend on the time of day.
  const scope: Record<string, unknown> = { esc: (x: unknown) => String(x ?? "") };
  const keys = Object.keys(scope);
  const fn = new Function(...keys, src + "; return runStravaPayload;")(...keys.map((k) => scope[k]));
  return fn(run);
}

test("BLOCKER: a three-hour wrist run is stored spanning the whole run, evenly", () => {
  // The wrist hands over what its own thinner produced. Modelled here at its measured output — one
  // point per 32 fixes across the run — because the Swift cannot be executed from this suite; what is
  // under test is the PHONE's half, which is what decides what the runner keeps.
  const track = linearTrack(10800);
  const fromWrist: number[][] = [];
  for (let i = 0; i < track.length; i += 32) fromWrist.push([track[i]!.lat, track[i]!.lng]);
  if (fromWrist.length && fromWrist[fromWrist.length - 1]![0] !== track[track.length - 1]!.lat) {
    fromWrist.push([track[track.length - 1]!.lat, track[track.length - 1]!.lng]);
  }

  const rec = ingest({ id: "watch-x", sec: 10800, distKm: 32.4, route: fromWrist, source: "watch" });
  const cap = constant("ROUTE_MAX_POINTS");
  assert.ok(rec.route.length <= cap,
    `a wrist run is stored at ${rec.route.length} points, past the ${cap} the phone's own runs keep`);
  assert.ok(rec.route.length >= cap - 1, "the stored route is far shorter than the cap allows");

  // ⚠️ THE SPAN, WHICH A COUNT CANNOT SEE. The stored line must reach the ground the run finished on.
  assert.deepEqual(rec.route[0], { lat: track[0]!.lat, lng: track[0]!.lng },
    "the stored route does not start where the run started");
  const last = track[track.length - 1]!;
  assert.deepEqual(rec.route[rec.route.length - 1], { lat: last.lat, lng: last.lng },
    "the stored route does not end where the run ended — this is the truncation, back again");

  // ⚠️ AND THE DISTRIBUTION, WHICH A SPAN CANNOT SEE EITHER. A back-loaded route has a perfect span.
  // ⚠️ TIMES ARE RE-ATTACHED IN ORDER, NOT BY LOOKUP. linearTrack turns nearly 180 degrees every 600s,
  // so it DOES pass back over its own ground and a coordinate key can answer with the first visit —
  // which would report a late point as an early one and hide exactly the back-loading under test.
  // attachTimes walks the track forward, which is sound because a thinned route is a subsequence.
  //
  // ⚠️ THE BOUND WAS LOOSENED WHEN THE THINNER STOPPED SPREADING EVENLY, AND HERE IS WHAT THAT COSTS:
  // it can no longer see back-loading, because a corner-dense stretch legitimately gets more points.
  // The discriminator for that is the WRIST's own distribution guard in
  // test/watch-route-swift.test.ts, where the halving-and-doubling design does still spread evenly.
  // What this catches is a whole tenth of the run with nothing in it, which the truncation reads as
  // nine of them.
  const tenths = perTenth(attachTimes(rec.route, track), 10800);
  assert.ok(Math.min(...tenths) > 0,
    "a whole tenth of the stored run has no points at all: per tenth " + tenths.join(" "));
  assert.ok(Math.max(...tenths) / Math.min(...tenths) <= 6,
    "the stored points are clustered into part of the run: per tenth " + tenths.join(" "));

  // ⚠️ THE GROUND THE LINE CLAIMS, WHICH IS WHAT A GPX UPLOAD TURNS INTO A NUMBER IN SOMEBODY'S FEED.
  // Measured on this fixture: the even 150 points that shipped claimed 0.928 of the run, the shape-
  // preserving 300 claim 0.992, and the truncation claimed 0.056. So 0.95 sits above what shipped and
  // far above the defect — it is a claim about THIS change, not a generic tolerance.
  const claimed = metres(rec.route) / 1000;
  const real = metres(track) / 1000;
  assert.ok(claimed > 0.95 * real,
    `the stored line claims only ${claimed.toFixed(2)} km of a ${real.toFixed(2)} km run`);
});

test("BLOCKER: the ingest cap is applied whatever the wrist sends, including its own full buffer", () => {
  // Belt and braces on purpose. The wrist thins to its own cap; the phone must not depend on that,
  // because a watch running an older build sends 600 truncated points and a watch running a newer one
  // could send any number the next cap allows.
  const track = linearTrack(3600);
  const raw = track.map((p) => [p.lat, p.lng]);
  const rec = ingest({ id: "watch-y", sec: 3600, distKm: 10.8, route: raw, source: "watch" });
  const cap = constant("ROUTE_MAX_POINTS");
  assert.ok(rec.route.length <= cap,
    `${raw.length} points from the wrist were stored as ${rec.route.length}, past the ${cap} cap`);
  const last = track[track.length - 1]!;
  assert.deepEqual(rec.route[rec.route.length - 1], { lat: last.lat, lng: last.lng },
    "capping the ingest lost the end of the run");
});

test("BLOCKER: the wrist's own shape of point keeps its time all the way into the store", () => {
  // ⚠️ THE WRIST SENDS `[lat, lng, t]` ARRAYS, AND normalizeRoute's ARRAY BRANCH IS THE ONE PLACE THAT
  // THIRD ELEMENT CAN VANISH. It read only p[0] and p[1] — which is why every wrist run reached Strava
  // as a MANUAL activity: the right distance and the right duration, and no map, no splits and no
  // pace, because runStravaPayload filters on isFinite(p.t). A branch that names two of three fields
  // drops the one nothing downstream can reconstruct, and the loss shows up nowhere else.
  //
  // Fed as ARRAYS, deliberately: an object-shaped fixture would exercise the branch that already
  // worked and prove nothing about the one that did not.
  const track = linearTrack(3600);
  const fromWrist = track.map((p) => [p.lat, p.lng, p.t]);
  const rec = ingest({ id: "watch-z", sec: 3600, distKm: 10.8, route: fromWrist, source: "watch" });
  assert.ok(rec.route.length > 2, "nothing was stored");
  for (const p of rec.route) {
    assert.equal(typeof p.t, "number", "the stored route lost its per-point time: " + JSON.stringify(p));
  }
  assert.equal(rec.route[0].t, 0, "the stored route does not start at the start of the run");
  assert.equal(rec.route[rec.route.length - 1].t, 3600, "the stored route does not reach the end of the run");
  // Strictly increasing, so no two stored points share a second — see the Strava guard below for why.
  for (let i = 1; i < rec.route.length; i++) {
    assert.ok(rec.route[i].t > rec.route[i - 1].t,
      "stored point " + i + " is timed at or before the one ahead of it");
  }
});

test("BLOCKER: a wrist run with timed points goes to Strava as a GPX, not as a manual entry", () => {
  // ⚠️ THE WHOLE POINT OF THE PER-POINT TIME, ASSERTED END TO END: the shape of a wrist run's upload is
  // chosen by runStravaPayload from the DATA it finds, and until the wrist sent times that choice was
  // always "manual" — real distance, real duration, and none of the map, splits or pace that are most
  // of why anybody sends a run to Strava at all.
  const track = linearTrack(1800);
  const startMs = Date.UTC(2026, 7, 21, 17, 32, 11);
  const rec = ingest({
    id: "watch-gpx", sec: 1800, distKm: 5.4, source: "watch", startMs: startMs,
    route: track.map((p) => [p.lat, p.lng, p.t]),
  });
  const p = strava(rec);
  assert.equal(p.kind, "gpx",
    "a wrist run with a timed route still uploads as a " + p.kind + " activity");
  assert.ok(p.points > 100, "the GPX carries only " + p.points + " trackpoints");
  assert.match(p.gpx, /<trkpt lat="[-\d.]+" lon="[-\d.]+"><time>/, "the trackpoints carry no time");
  // ⚠️ AND THE ACTIVITY BEGINS WHEN THE RUN DID. A wrist run's id is a UUID, so runStartMs cannot
  // recover a start from it and falls back to 09:00 on the run's date — which would have put a
  // correctly mapped run into somebody's feed nine hours from when they ran it. The watch sends the
  // instant alongside the timed route for exactly this.
  assert.equal(p.startMs, startMs,
    "the upload starts at " + new Date(p.startMs).toISOString() + " rather than " +
    new Date(startMs).toISOString());
  assert.match(p.gpx, new RegExp("<metadata><time>" + new Date(startMs).toISOString().replace(/\.\d{3}Z$/, "Z")),
    "the GPX's own start time is not the instant the run began");
  // The first and last trackpoint times bracket the run, so Strava's derived moving time is the run's.
  const times = [...p.gpx.matchAll(/<time>([^<]+)<\/time>/g)].map((m) => Date.parse(m[1]!));
  assert.equal(times[1], startMs, "the first trackpoint is not at the start of the run");
  assert.equal(times[times.length - 1]! - startMs, 1800 * 1000,
    "the last trackpoint is not at the end of the run");
});

test("BLOCKER: a run whose points carry no time is still a manual upload — never a fabricated trace", () => {
  // ⚠️ NEVER BACKFILLED, AND THE REASON IS WRITTEN INTO runStravaPayload's OWN HEADER: spreading a
  // total evenly across the points a run happens to have "draws a perfectly even run that never
  // happened, in somebody else's training log, under their name". Every wrist run already in the store
  // is exactly this case, and so is any watch still on the old build.
  const track = linearTrack(1800);
  const rec = ingest({
    id: "watch-old", sec: 1800, distKm: 5.4, source: "watch",
    route: track.map((p) => [p.lat, p.lng]),
  });
  for (const p of rec.route) {
    assert.equal(p.t, undefined, "a time was invented for a point the watch never timed");
  }
  const up = strava(rec);
  assert.equal(up.kind, "manual", "an untimed route was turned into a GPX: " + JSON.stringify(up.kind));
  assert.equal(up.distanceM, 5400, "the manual upload lost the real distance");
  assert.equal(up.elapsedSec, 1800, "the manual upload lost the real duration");
  assert.equal(up.trainer, false, "a run with a route was sent as a treadmill effort");
  // And with no start instant either, the 09:00 fallback is what it gets — which is the honest answer
  // for a run nobody recorded a start for, and is why the two fields travel together on new runs.
  assert.equal(new Date(up.startMs).toISOString(), "2026-08-21T09:00:00.000Z",
    "an unrecorded start was invented as something other than the documented fallback");
});

test("BLOCKER: two points sharing a second never reach Strava as an infinite speed", () => {
  // ⚠️ A GPX TRACKPOINT CARRIES WHOLE SECONDS once the payload strips the milliseconds, so two points
  // on the same second are two positions at one instant. The wrist refuses such a fix at source, and
  // the phone's own credited fixes are rounded to seconds too — but every route already in the store
  // predates both rules, so the payload has to be able to survive one.
  const rec = ingest({
    id: "watch-dupe", sec: 300, distKm: 1.0, source: "watch", startMs: Date.UTC(2026, 7, 21, 6, 0, 0),
    route: [[51.5, -0.12, 0], [51.501, -0.12, 1], [51.502, -0.12, 1], [51.503, -0.12, 2],
            [51.504, -0.12, 2], [51.505, -0.12, 3]],
  });
  const p = strava(rec);
  assert.equal(p.kind, "gpx", "the fixture no longer produces a GPX, so this measures nothing");
  const times = [...p.gpx.matchAll(/<trkpt[^>]*><time>([^<]+)<\/time>/g)].map((m) => Date.parse(m[1]!));
  assert.equal(new Set(times).size, times.length,
    "two trackpoints share a timestamp: " + JSON.stringify(times.map((t) => new Date(t).toISOString())));
  for (let i = 1; i < times.length; i++) {
    assert.ok(times[i]! > times[i - 1]!, "trackpoint " + i + " is not later than the one before it");
  }
  assert.equal(times.length, 4, "the duplicates were kept or too much was dropped: " + times.length);
});

test("BLOCKER: a lapped session's stored line is not understated, which is what the cap bought", () => {
  // ⚠️ THE CAP ITSELF IS A JUDGEMENT AND NO GUARD SHOULD PIN A JUDGEMENT — so this pins the OUTCOME it
  // was raised for. Reverting ROUTE_MAX_POINTS from 300 to 150 escaped every other assertion in this
  // file, correctly: the algorithm is unchanged and it is still far better than what shipped. What 300
  // buys is the one shape where ground can only be recovered by spending points per lap.
  //
  // Measured through the real thinner on 52 laps of a 400 m track (21.18 km, a real session): an even
  // 150 points claims 0.755 of it, shape-preserving 150 claims 0.807, and shape-preserving 300 claims
  // 0.955. A GPX has no distance field, so at 150 that half marathon appears in the runner's Strava
  // feed 4.1 km short. 0.94 sits below what ships and well above what 150 can reach.
  const downsampleRoute = new Function(
    "ROUTE_MAX_POINTS", lift(["downsampleRoute"]) + "; return downsampleRoute;")(constant("ROUTE_MAX_POINTS"));
  // Two 84.39 m straights and two 36.5 m-radius bends, walked at 3.3 m/s for 21.1 km.
  const R = 36.5, S = 84.39, lap = 2 * S + 2 * Math.PI * R;
  const track: Pt[] = [];
  for (let t = 0, d = 0; d <= 21100; t++, d = t * 3.3) {
    const into = d % lap;
    let x: number, y: number;
    if (into < S) { x = into; y = 0; }
    else if (into < S + Math.PI * R) { const a = (into - S) / R; x = S + R * Math.sin(a); y = R - R * Math.cos(a); }
    else if (into < 2 * S + Math.PI * R) { x = S - (into - S - Math.PI * R); y = 2 * R; }
    else { const a = (into - 2 * S - Math.PI * R) / R; x = -R * Math.sin(a); y = R + R * Math.cos(a); }
    track.push({ lat: Math.round((51.5074 + y / 111132) * 1e5) / 1e5,
                 lng: Math.round((-0.1278 + x / (111320 * Math.cos(51.5074 * Math.PI / 180))) * 1e5) / 1e5, t });
  }
  const real = metres(track);
  assert.ok(real > 20000 && real < 22500,
    "the fixture is not a half marathon: " + (real / 1000).toFixed(2) + " km");
  const claimed = metres(downsampleRoute(track, constant("ROUTE_MAX_POINTS")) as Pt[]);
  assert.ok(claimed >= 0.94 * real,
    "52 laps of a track are stored as a line claiming " + (claimed / 1000).toFixed(2) + " km of " +
    (real / 1000).toFixed(2) + " km — which is what Strava would show, because a GPX carries no " +
    "distance of its own");
});

test("BLOCKER: the heart-rate series is still thinned evenly, and to its own cap", () => {
  // ⚠️ THE ROUTE'S THINNER CHANGED AND THIS ONE MUST NOT. A heart-rate sample is paired with DISTANCE,
  // not with time — on a time axis every pause is a plateau — so there are no "corners" to preserve and
  // an even sample is the right answer. HR_MAX_POINTS and downsampleSeries keep exactly the behaviour
  // they had; a shape-preserving thinner applied here would keep the spikes and drop the steady
  // stretches, which is the opposite of what a trace of an effort should show.
  const series = new Function("HR_MAX_POINTS", lift(["downsampleSeries"]) + "; return downsampleSeries;")(
    constant("HR_MAX_POINTS")) as (s: number[][], max: number) => number[][];
  const cap = constant("HR_MAX_POINTS");
  const n = 1200;
  const src = Array.from({ length: n }, (_, i) => [i * 10, 120 + (i % 7)]);
  const out = series(src, cap);
  assert.equal(out.length, cap, "the series was not thinned to its own cap");
  assert.deepEqual(out[0], src[0], "the series lost its first sample");
  assert.deepEqual(out[out.length - 1], src[n - 1], "the series lost its last sample");
  const gaps: number[] = [];
  for (let i = 1; i < out.length; i++) gaps.push(out[i]![0]! - out[i - 1]![0]!);
  const mean = (src[n - 1]![0]! - src[0]![0]!) / (cap - 1);
  assert.ok(Math.max(...gaps) <= mean + 10,
    "the heart-rate series is no longer evenly thinned: widest gap " + Math.max(...gaps) +
    " against a mean of " + mean.toFixed(1));
  // And the two caps are still separate numbers for separate jobs.
  assert.notEqual(cap, constant("ROUTE_MAX_POINTS"),
    "the route's cap and the heart-rate series' cap have become one number for two different jobs");

  // ⚠️⚠️ AND THE CLAIM HAS TO BE MADE AT THE READER, NOT AT THE THINNER. Everything above lifts
  // `downsampleSeries` and measures IT, so re-pointing its only CALLER at the route's thinner escaped
  // the whole test — house rule 7, in the one place this file had not applied it. `hrSeriesOrNull` is
  // the single writer of a stored series, so it is driven end to end here, and it must not reach for
  // the route's thinner at all.
  const reader = lift(["hrSeriesOrNull"]);
  assert.match(reader, /downsampleSeries\(/,
    "hrSeriesOrNull no longer thins through downsampleSeries");
  assert.ok(!/downsampleRoute\(/.test(reader),
    "hrSeriesOrNull reaches for the ROUTE's shape-preserving thinner, which would keep the spikes of " +
    "an effort and drop its steady stretches — the opposite of what a heart-rate trace should show");
  const hrOrNull = new Function("HR_MAX_POINTS", "HR_SAMPLE_MS",
    lift(["hrSeriesOrNull", "downsampleSeries"]) + "; return hrSeriesOrNull;")(cap, constant("HR_SAMPLE_MS"));
  const stored = hrOrNull(src2Series(n));
  assert.ok(Array.isArray(stored) && stored.length === cap,
    "a real series went through hrSeriesOrNull and came back as " +
    (Array.isArray(stored) ? stored.length + " samples" : String(stored)));
  const g2: number[] = [];
  for (let i = 1; i < stored.length; i++) g2.push(stored[i][0] - stored[i - 1][0]);
  const mean2 = (stored[stored.length - 1][0] - stored[0][0]) / (cap - 1);
  assert.ok(Math.max(...g2) <= mean2 + 10,
    "the stored heart-rate series is no longer evenly thinned: widest gap " + Math.max(...g2) +
    " against a mean of " + mean2.toFixed(1));
});

/** A series in the shape the wrist sends: [metres, bpm], distance strictly advancing. */
function src2Series(n: number): number[][] {
  return Array.from({ length: n }, (_, i) => [i * 10, 120 + (i % 7)]);
}

test("a wrist run and a phone run of the same length are stored at the same resolution", () => {
  // ⚠️ THE ASYMMETRY THIS REMOVED. liveRunRecord has always downsampled at save and ingestWatchRun
  // never did, so a wrist run went into localStorage at four times a phone run's resolution — 23.5 KB
  // against 6.1 KB on a measured three-hour run, in a store that holds fifty runs and is where the
  // whole training history lives.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const ingestSrc = lift(["ingestWatchRun"]);
  assert.match(ingestSrc, /route:\s*downsampleRoute\(/,
    "ingestWatchRun no longer thins the wrist's route, so a wrist run is stored denser than a phone run");
  // And the phone's own save path still does its half.
  assert.match(html, /route:\s*downsampleRoute\(LIVE\.route\)/,
    "the phone's own save path no longer thins its route");
  // ⚠️ ONE NUMBER. `downsampleRoute`'s default and the constant must not drift apart, or a caller
  // that omits the argument quietly stores at a different resolution from one that passes it.
  const ds = lift(["downsampleRoute"]);
  assert.match(ds, /max\s*=\s*max \|\| ROUTE_MAX_POINTS/,
    "downsampleRoute has its own literal default again, so there are two stored resolutions");
});

/**
 * THE THINNER'S OWN PROPERTIES — restated, because what "evenly" means changed.
 *
 * ⚠️ THIS TEST USED TO REQUIRE AN EVEN SPREAD, AND AN EVEN SPREAD IS THE DEFECT. Every corner it lands
 * either side of is replaced by the chord across it, and a run is mostly corners: measured through the
 * real chain, an even 150 points claimed 36.4 km of a 42.2 km city marathon and 16.0 km of a 21.2 km
 * 52-lap track session. That was invisible for as long as the stored line was only ever drawn as a
 * picture, and stopped being invisible the moment a run went to Strava as a GPX — a GPX has no distance
 * field at all, so whatever the line claims is what appears in the runner's feed.
 *
 * ⚠️ SO THE ASSERTION WAS INVERTED, NOT DELETED. Deleting it would have left the thinner with no claim
 * about how the points are distributed at all, and back-loading is a real defect this project has
 * measured (306 of 336 points in the final tenth of a run, with a perfect span and a plausible count).
 * What survives is: both ends exact, the budget filled, nothing invented, the order kept — and, in
 * place of "evenly", the two claims that actually matter. The line must claim AT LEAST the ground an
 * even sample of the same size would (which is the thing being replaced, used as a control), and on a
 * featureless stretch, where every point ties for significance, it must still spread.
 */
test("BLOCKER: downsampleRoute keeps both ends, fills the budget, and invents nothing", () => {
  const downsampleRoute = new Function(
    "ROUTE_MAX_POINTS", lift(["downsampleRoute"]) + "; return downsampleRoute;")(constant("ROUTE_MAX_POINTS"));
  for (const n of [2, 3, 149, 150, 151, 299, 300, 301, 600, 3601, 10801]) {
    // A gentle arc rather than a straight line, so the significances differ and the ranking is exercised.
    const src = Array.from({ length: n }, (_, i) => ({
      lat: 51 + Math.sin(i / 40) / 1e3, lng: -0.1 + i / 3e4, t: i,
    }));
    const out = downsampleRoute(src, 150);
    assert.ok(out.length <= 150, `${n} points came back as ${out.length}`);
    assert.equal(out[0].t, 0, `${n} points lost the start`);
    assert.equal(out[out.length - 1].t, n - 1, `${n} points lost the end`);
    // Nothing invented, and the order kept — a thinned route is a SUBSEQUENCE of what went in.
    for (let i = 1; i < out.length; i++) {
      assert.ok(out[i].t > out[i - 1].t, `${n} points came back out of order at ${i}`);
      assert.deepEqual(out[i], src[out[i].t], `${n} points: a stored point is not one that went in`);
    }
    if (n > 150) assert.equal(out.length, 150, `${n} points did not fill the cap`);
  }
  // ⚠️ THE END RE-ASSERTION IS BELT AND BRACES AT EVERY REACHABLE CAP, AND LOAD-BEARING ONLY AT ONE.
  // `sig[0]` and `sig[n-1]` are seeded at infinite significance, so both ends already sort to the top
  // and win any budget of two or more; measured, removing `keep[0] = 1; keep[n - 1] = 1;` is
  // byte-identical on all eight route fixtures at the shipped cap. At a budget of ONE it is not —
  // the route comes back as a single point and the END of the run is lost. No caller asks for one
  // (`max || ROUTE_MAX_POINTS` is 300), so this is recorded rather than left to be "verified" by
  // deletion, which is how this project once removed a const a test was reading.
  const tiny = Array.from({ length: 500 }, (_, i) => ({ lat: 51 + i / 1e4, lng: -0.1, t: i }));
  for (const m of [1, 2]) {
    const out = downsampleRoute(tiny, m);
    assert.equal(out[0].t, 0, "a budget of " + m + " lost the start of the run");
    assert.equal(out[out.length - 1].t, 499, "a budget of " + m + " lost the end of the run");
  }
});

test("BLOCKER: a featureless stretch still gets its points spread across the run", () => {
  // ⚠️ THE ONE CASE WHERE SHAPE PRESERVATION HAS NOTHING TO SAY, AND IT WAS A REAL DEFECT IN THE FIRST
  // CUT OF THIS THINNER. On a genuinely straight stretch every interior point sits exactly on the
  // chord, so every deviation ties — and taking the first of each tie makes the subdivision a chain
  // rather than a tree. Measured on a straight 10,801-point track: 299 of the 300 kept points in the
  // FIRST TENTH of the run, and 492 ms of quadratic work at save time. The line drawn is identical
  // either way, which is exactly why nothing but this would have caught it; the GPX is not, because
  // Strava would have had the last three hours of the run as a single segment.
  const downsampleRoute = new Function(
    "ROUTE_MAX_POINTS", lift(["downsampleRoute"]) + "; return downsampleRoute;")(constant("ROUTE_MAX_POINTS"));
  const n = 10801;
  const straight = Array.from({ length: n }, (_, i) => ({ lat: 51 + i / 1e5, lng: -0.1, t: i }));
  const t0 = Date.now();
  const out = downsampleRoute(straight, 300);
  const ms = Date.now() - t0;
  assert.equal(out.length, 300, "the budget was not filled");
  const tenths = new Array(10).fill(0);
  for (const p of out) tenths[Math.min(9, Math.floor(10 * p.t / (n - 1)))]++;
  // ⚠️ MEASURED: the shipped thinner reads 52 43 25 26 25 26 26 25 26 26, a ratio of 2.08 — the
  // frontier level of the dyadic subdivision is where the surplus lands. The chain version reads
  // 299 0 0 0 0 0 0 0 0 1, a ratio of 299 with eight empty tenths. 3.0 separates them.
  assert.ok(Math.min(...tenths) > 0,
    "a whole tenth of a straight run has no points: " + tenths.join(" "));
  assert.ok(Math.max(...tenths) / Math.min(...tenths) <= 3.0,
    "the points on a featureless stretch are clustered: " + tenths.join(" "));
  // ⚠️ AND IT IS THE SAME FIX. Splitting at the middle of the span keeps the subdivision balanced, so
  // the quadratic blow-up goes with the clustering: 492 ms became 14 ms on this exact input. A bound
  // of 200 ms is far above the 14 and far below the 492, and this runs at save time on a phone.
  assert.ok(ms < 200, "thinning a straight 10,801-point track took " + ms + " ms at save time");
});

test("BLOCKER: the stored line claims the ground the run covered", () => {
  // ⚠️ THE CLAIM THAT REPLACED "EVENLY", AND IT IS MADE AGAINST A CONTROL. How much of a run's ground
  // 300 points can describe is a property of the ROUTE, not of the thinner — so the assertion is that
  // the shape-preserving thinner never does WORSE than the even spread it replaced, on any shape,
  // which is falsifiable and needs no percentage chosen by taste. The second claim is the absolute
  // one, and it exists to catch a truncation (which reads 0.056) rather than to grade the thinner.
  //
  // ⚠️ AND IT IS ONLY WEAK EVIDENCE OF BACK-LOADING, WHICH IS WORTH SAYING RATHER THAN LEAVING TO BE
  // ASSUMED. On a point-to-point route a back-loaded line's first 90% is one long chord, so it claims
  // far too little and this catches it. On a CIRCUIT that chord runs over ground the run also covered
  // later, so the shortfall largely cancels — the same reason `test/watch-route-harness.ts` records
  // every fixture here being point-to-point on purpose (a three-hour truncation reads 1541 m of mean
  // error point-to-point and 18 m on a loop). The back-loading discriminator is still the WRIST's own
  // even-spread guard in test/watch-route-swift.test.ts, not this.
  const downsampleRoute = new Function(
    "ROUTE_MAX_POINTS", lift(["downsampleRoute"]) + "; return downsampleRoute;")(constant("ROUTE_MAX_POINTS"));
  const cap = constant("ROUTE_MAX_POINTS");
  const rows: string[] = [];
  for (const [name, fn] of Object.entries(TRACKS)) {
    for (const secs of [600, 3600, 10800]) {
      const track = fn(secs);
      const out = downsampleRoute(track.map((p) => ({ lat: p.lat, lng: p.lng, t: p.t })), cap);
      const claimed = metres(out as Pt[]);
      const control = metres(idealEvenSample(track, out.length));
      const real = metres(track);
      rows.push(name + "/" + secs + " " + (claimed / real).toFixed(3));
      assert.ok(claimed >= 0.999 * control,
        name + " at " + secs + "s: the line claims " + (claimed / 1000).toFixed(2) + " km where an EVEN " +
        "sample of the same " + out.length + " points claims " + (control / 1000).toFixed(2) +
        " km — the thinner is worse than the even spread it replaced");
      // ⚠️⚠️ AND "NO WORSE THAN THE CONTROL" IS SATISFIED BY BEING THE CONTROL, WHICH MADE THE
      // ASSERTION ABOVE VACUOUS ON ITS OWN. Re-broken by putting the even spread back, it PASSED —
      // claimed and control are then the same number, which is this project's own
      // asserting-a-value-against-itself trap in a new place. So the real claim is that the thinner
      // removes most of the ground an even sample LOSES. Measured over 17 fixtures, on every one where
      // an even sample loses 2% or more the shipped thinner leaves at most 65.2% of that shortfall
      // (the pathological lemniscate, where 150 laps of a 90 m figure cannot be described at all); the
      // worst realistic case is 57.7% and a road marathon leaves 0%. An even spread leaves 100%. So
      // 0.80 sits above anything correct and below the defect by a wide margin.
      const shortfallEven = 1 - control / real, shortfallShape = 1 - claimed / real;
      if (shortfallEven >= 0.02) {
        assert.ok(shortfallShape <= 0.80 * shortfallEven,
          name + " at " + secs + "s: an even sample loses " + (shortfallEven * 100).toFixed(1) +
          "% of the ground and this line still loses " + (shortfallShape * 100).toFixed(1) +
          "% of it — the corners are not being kept");
      }
      // ⚠️ 0.55 IS SET FROM MEASUREMENT AND THE MEASUREMENT IS THE POINT. Through the thinner alone the
      // worst of these 12 is the lemniscate at three hours, 0.856; through the whole wrist chain it is
      // 0.821; the worst REALISTIC case anywhere in this work is a 52-lap track session at 0.949; and
      // the truncation this file exists for reads 0.056.
      assert.ok(claimed >= 0.55 * real,
        name + " at " + secs + "s: the line claims " + (claimed / 1000).toFixed(2) + " km of a " +
        (real / 1000).toFixed(2) + " km run");
    }
  }
  assert.equal(rows.length, 12, "the sweep measured " + rows.length + " cases: " + rows.join(", "));
});
