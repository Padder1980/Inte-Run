import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { LiveSession } from "../src/live/session-runtime.ts";

/**
 * THE RHODES FIELD TEST, FINDING 3: A LOCKED SCREEN RECORDED NEARLY DOUBLE THE DISTANCE.
 *
 * Measured on the shipped build: a 20-minute screen lock at 3 m/s credited 7,313 m for 3,780 m
 * covered, +93% on the locked stretch. It was two of the app's own mechanisms disagreeing, in two
 * different languages, neither knowing about the other:
 *
 *  - `LocationService.swift` BUFFERS GPS fixes whenever the app is not active and replays them on
 *    `didBecomeActive`. That is deliberate and correct.
 *  - `PedometerService.swift` has no application-state gate and keeps posting.
 *  - `pedoFillGap`'s blackout detector is "how long since JS last CREDITED a GPS fix", so it cannot
 *    tell "GPS has gone dark" from "our own buffer is holding the fixes". By construction.
 *  - and `LIVE.pedoPaid`, the tab that stops the recovery fix billing the gap a second time, was a
 *    ONE-SHOT VOUCHER cleared by the first credited fix. Right for a tunnel, which recovers with one
 *    fix whose net displacement covers the whole gap. Useless for a lock, which replays the stretch
 *    as hundreds of small fixes: a 3,552 m tab was discharged against a single ~3 m fix and the rest
 *    of the backlog was credited in full, on top of ground already paid for.
 *
 * ⚠️ THREE DEFECTS RODE ON THE DOUBLED DISTANCE and each is pinned below on its own:
 *  (a) three kilometres logged at ZERO seconds per km, because `pedoFillGap` stamped splits on the
 *      wall clock while `onGpsPos` stamps each fix's own clock, and `Math.max(lastKmMs, atMs)` then
 *      pinned every replayed boundary to one instant;
 *  (b) a 1 km distance-gated session declared complete at 720 m actually run;
 *  (c) "Ease back — you're ahead of easy pace." spoken to a runner who was dead on target.
 *
 * ⚠️ AND (c) TURNED OUT NOT TO BE A LOCK DEFECT AT ALL. The doubled distance derives 168-200 s/km,
 * which clears the 150 s/km plausibility floor, so fixing the distance moves the false pace from
 * "absurd, culled" into "just fast enough to be believed". The real cause is that `currentGpsPace`
 * divided a QUANTISED numerator by a tick-aligned denominator: distance arrives one leash (10-14 m)
 * at a time while the window's far end advances every 250 ms, so the two describe different stretches
 * of ground. Measured on a HEALTHY 3 m/s run with no Doppler, true pace 334 s/km, the tick-aligned
 * window derived p5 297 / p95 458 — a forty per cent spread against a five per cent band — and told a
 * runner on target to ease back 59 times. The window is a window over CREDITS now.
 *
 * Reads the BUILT web/app.html, because all of this is web-layer code — same precedent as
 * gps-distance and warmup-delivery. Run `node web/app.ts` first.
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
function liftPedoEntry() {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("window.__interunPedometer = function");
  assert.ok(at >= 0, "the pedometer entry point is not in the build");
  let d = 0;
  for (let i = html.indexOf("{", at); i < html.length; i++) {
    if (html[i] === "{") d++;
    else if (html[i] === "}") { d--; if (!d) return "const pedoEntry = " + html.slice(html.indexOf("function", at), i + 1) + ";"; }
  }
  throw new Error("unbalanced braces in the pedometer entry point");
}

const M_PER_DEG = 111320;
const BAND = { minSecPerKm: 320, maxSecPerKm: 350 };

type Trace = {
  /** Seconds the screen is off / GPS is dark. */
  gapSec: number;
  /** True ground speed, m/s. */
  speed: number;
  /** What the device reports as speed, or null for a Doppler dropout. */
  dev: number | null;
  /**
   * How the web view behaves while the screen is off, which is INFERRED on real hardware. Every world
   * is swept, because a fix verified only against the one the author imagined is not verified:
   *  "suspended" — no JS at all until unlock; "throttled" — one tick a second; "awake" — full ticks.
   */
  world?: "suspended" | "throttled" | "awake";
  /** A genuine blackout: the screen is ON and GPS delivers nothing, so there is nothing to replay. */
  dark?: boolean;
  /**
   * Record the derived pace DURING the gap, at its midpoint.
   *
   * ⚠️ IT IS THE ONLY MOMENT THE PEDOMETER'S CONTRIBUTION TO THE PACE WINDOW IS OBSERVABLE. Before
   * the gap and after it the window is fed by real fixes, so a run measured only at its ends cannot
   * see whether the step counter reached the window at all — which is exactly why that line had
   * nothing but a source grep behind it.
   */
  blackoutPace?: boolean;
  /** Degrees of turn spread across the gap, so the pedometer's PATH exceeds GPS's chord. */
  bend?: number;
  /** An indoor run: no GPS at all. */
  indoor?: boolean;
  /** Metres of the session's single distance-gated step, instead of a timed one. */
  gateM?: number;
  accuracy?: number;
  /** Stand still for this many seconds at the end. */
  stillSec?: number;
  /**
   * Seconds of honest running after the gap. Default 60, which is where a debt carried forward would
   * show. ⚠️ A fixture that stops before the thing it measures can happen proves nothing: at 3 m/s the
   * default trace covers 540 m, so a 1 km step never completes and no kilometre boundary is ever
   * crossed. Both were written that way first and both reported "never" rather than a verdict.
   */
  tailSec?: number;
  /**
   * The pedometer's distance as a fraction of the truth. iOS infers it from stride length, so it
   * under-reads for a shuffling gait or a phone carried in a bag rather than on the body.
   *
   * ⚠️ THIS IS WHAT MAKES THE SPLIT-CLOCK DEFECT REACHABLE AT ALL, and the guards below were written
   * without it first and could not fail. When the pedometer bills the whole gap, the replayed backlog
   * is spent settling that debt and never advances the distance, so no stale fix ever crosses a
   * kilometre boundary. Under-reading leaves a SURPLUS that credits with a lock-era timestamp, which
   * is precisely the pair of clocks that collapses a split to zero seconds.
   */
  pedoScale?: number;
};

/**
 * Drive the real `onGpsPos` / `pedoFillGap` / `checkSplits` / `paceMark` / `currentGpsPace` /
 * `gpsUiTick` over one trace, through the real LiveSession engine so the cues are the engine's own.
 *
 * ⚠️ THE BUFFER IS THE WHOLE POINT OF THIS HARNESS. During the gap, fixes are held in an array and
 * replayed in ONE burst afterwards, which is exactly what `LocationService` does on
 * `didBecomeActive`. A harness that delivered them live could not express the defect.
 */
function run(t: Trace) {
  const src = [
    lift(["haversine", "checkSplits", "gpsFixElapsedMs", "pedoFillGap", "onGpsPos", "paceMark", "liveDistM",
          "currentGpsPace", "gpsUiTick"]),
    liftPedoEntry(),
  ].join("\n");
  const cues: any[] = [];
  const steps = t.gateM
    ? [{ kind: "easy", label: "1 km easy", distanceMeters: t.gateM, targetPaceSecPerKm: BAND, targetRpe: { min: 2, max: 3 } }]
    : [{ kind: "easy", label: "40' easy", durationSeconds: 7200, targetPaceSecPerKm: BAND, targetRpe: { min: 2, max: 3 } }];
  const rt: any = new LiveSession({
    id: "t", dayOfWeek: 1, type: "easy", title: "easy", description: "", intensity: "easy",
    estimatedDurationSeconds: 7200, steps, source: "generated",
  } as any);
  const LIVE: any = {
    mode: t.indoor ? "indoor" : "gps", dist: 0, route: [], elevGain: 0, splits: [], kmDone: 0,
    lastKmMs: 0, lastLat: null, lastLon: null, lastAlt: null, devSpeed: null, acc: null, win: [],
    startMs: 0, pausedMs: 0, pauseStart: null, rt,
  };
  let clock = 1_760_000_000_000;
  LIVE.startMs = clock;
  const FakeDate = { now: () => clock };
  const elapsed = () => FakeDate.now() - LIVE.startMs - LIVE.pausedMs;
  const noop = () => {};
  const f: any = new Function(
    // ⚠️ drawLiveMap IS STUBBED, DELIBERATELY, AND IT IS THE ONE UI CALL THAT DESERVES A NOTE. It is
    // the start screen's position map, which cannot exist in node — and it returns immediately once a
    // run has started, so a running session never reaches it in the app either. Stubbing it here keeps
    // this file about distance; whether the map is drawn at the right moment is asserted where the
    // screen is, not where the metres are.
    "LIVE", "Date", "liveElapsedMs", "liveNowMs", "liveCue", "fmtPace", "renderLiveNow",
    // ⚠️ coachRunTick IS STUBBED FOR THE SAME REASON. It is the coach's own clock work — releasing a
    // line whose reply was lost while the page was frozen, and refreshing the locked-phone schedule —
    // and both are asserted in test/coach-schedule.test.ts, against the real functions. This file is
    // about metres.
    "pushLiveActivity", "stopLive", "liveFinish", "drawLiveMap", "coachRunTick",
    src + "; return { onGpsPos: onGpsPos, pedoEntry: pedoEntry, gpsUiTick: gpsUiTick };",
  )(LIVE, FakeDate, elapsed, elapsed, (c: any) => cues.push(c), (x: number) => String(Math.round(x)),
    noop, noop, noop, noop, noop, noop);
  rt.start(0).forEach((c: any) => cues.push(c));

  const acc = t.accuracy == null ? 8 : t.accuracy;
  let x = 0, y = 0, heading = 0, truth = 0, pedo = 0, jit = 1;
  const advance = () => {
    truth += t.speed; pedo += t.speed * (t.pedoScale == null ? 1 : t.pedoScale); jit = -jit;
    const r = heading * Math.PI / 180;
    x += Math.sin(r) * t.speed; y += Math.cos(r) * t.speed;
  };
  const fix = () => ({
    coords: {
      latitude: 53.48 + (y + jit) / M_PER_DEG,
      longitude: -2.24 + x / (M_PER_DEG * Math.cos(53.48 * Math.PI / 180)),
      accuracy: acc, speed: t.dev == null ? -1 : t.dev, altitude: null,
    },
    timestamp: clock,
  });
  // ⚠️ THE FASTEST DERIVED READING SEEN, WHICH IS THE ONLY OBSERVABLE THE PACE WINDOW'S ARITHMETIC
  // HAS. A window whose metres run ahead of its own far end reports a burst of impossible speed for a
  // tick or two and then settles, so the FINAL reading cannot see it and neither can a cue count.
  let minPace: number | null = null;
  const steps4 = () => {
    for (let k = 0; k < 4; k++) {
      clock += 250;
      if (rt.getStatus() === "active") f.gpsUiTick();
      if (elapsed() > 45000 && LIVE.curPace != null && (minPace == null || LIVE.curPace < minPace)) minPace = LIVE.curPace;
    }
  };
  const second = () => {
    advance();
    if (!t.indoor) f.onGpsPos(fix());
    f.pedoEntry({ available: true, metres: pedo, steps: Math.round(pedo / 0.75), cadence: 172 });
    steps4();
  };

  // Two healthy minutes first, so the 45-second start-settle window has closed.
  for (let s = 0; s < 120 && rt.getStatus() === "active"; s++) second();
  const preDist = LIVE.dist, preTruth = truth, preCues = cues.length;
  let doneAtM: number | null = rt.getStatus() === "completed" ? truth : null;

  // The gap.
  const buffered: any[] = [];
  const world = t.world || "suspended";
  let blackoutPace: number | null = null;
  for (let s = 0; s < t.gapSec && rt.getStatus() === "active"; s++) {
    if (t.bend) heading += t.bend / t.gapSec;
    advance();
    // Sampled at the gap's midpoint, where the window is entirely pedometer-fed.
    if (t.blackoutPace && s === Math.floor(t.gapSec / 2)) blackoutPace = LIVE.curPace ?? null;
    if (t.dark) {
      // A genuine blackout with the screen ON: nothing to buffer, and the page ticks normally.
      f.pedoEntry({ available: true, metres: pedo, steps: 0, cadence: 172 });
      steps4();
      continue;
    }
    if (!t.indoor) buffered.push(fix());
    f.pedoEntry({ available: true, metres: pedo, steps: 0, cadence: 172 });
    if (world === "suspended") clock += 1000;
    else if (world === "throttled") { clock += 1000; if (rt.getStatus() === "active") f.gpsUiTick(); }
    else steps4();
    if (doneAtM == null && rt.getStatus() === "completed") doneAtM = truth;
  }
  const gapTruth = truth - preTruth, gapDist = LIVE.dist - preDist;
  // The flush: iOS hands the whole backlog over in one burst.
  for (const b of buffered) if (rt.getStatus() === "active") f.onGpsPos(b);
  if (buffered.length) f.pedoEntry({ available: true, metres: pedo, steps: 0, cadence: 172 });
  if (!t.dark && !t.indoor) steps4();
  if (doneAtM == null && rt.getStatus() === "completed") doneAtM = truth;
  const afterDist = LIVE.dist, afterTruth = truth;

  // One honest minute afterwards — where a debt carried forward eats real ground.
  const tail = t.tailSec == null ? 60 : t.tailSec;
  for (let s = 0; s < tail && rt.getStatus() === "active"; s++) { second(); if (doneAtM == null && rt.getStatus() === "completed") doneAtM = truth; }
  const postDist = LIVE.dist - afterDist, postTruth = truth - afterTruth;

  let stationaryPace: number | null | "n/a" = "n/a";
  if (t.stillSec) {
    for (let s = 0; s < t.stillSec; s++) { jit = -jit; if (!t.indoor) f.onGpsPos(fix()); f.pedoEntry({ available: true, metres: pedo, steps: 0, cadence: 172 }); steps4(); }
    stationaryPace = LIVE.curPace == null ? null : Math.round(LIVE.curPace);
  }

  const paceCues = cues.filter((c: any) => c.kind === "pace").map((c: any) => String(c.message));
  const p = LIVE.pedo || {};
  return {
    truth, dist: LIVE.dist, gapTruth, gapDist,
    /** The whole locked stretch, buffer replay included: what the runner is actually judged on. */
    gapTotal: afterDist - preDist,
    postDist, postTruth,
    pedoFilled: p.credited || 0, settled: p.settled || 0, writtenOff: p.writtenOff || 0,
    capped: p.capped || 0, owing: LIVE.pedoPaid || 0,
    splits: LIVE.splits as { km: number; sec: number; est?: boolean }[],
    splitCues: cues.filter((c: any) => c.kind === "split").map((c: any) => String(c.message)),
    paceCues,
    burstPaceCues: cues.slice(preCues).filter((c: any) => c.kind === "pace").map((c: any) => String(c.message)),
    tooFastCues: paceCues.filter((m) => /ahead|Ease back/i.test(m)).length,
    completed: rt.getStatus() === "completed", doneAtM, stationaryPace,
    curPace: LIVE.curPace, minPace, blackoutPace,
  };
}

/* ------------------------------------------------------------------------------------------------
   FINDING 3 — the distance itself
   ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a buffered-and-replayed screen lock is credited once, not twice", () => {
  // ⚠️ SWEPT ACROSS ALL THREE SUSPENSION WORLDS. Whether WebKit suspends, throttles or keeps running
  // the page during a lock is inferred, not measured — and the investigation's own preferred fix (a
  // clock that only advances while JS ticks) was perfect in the suspended world and did nothing at
  // all in the throttled one. A guard written for one world certifies a fix that works in one world.
  for (const world of ["suspended", "throttled", "awake"] as const) {
    for (const mins of [1, 5, 10, 20]) {
      for (const speed of [1.4, 3]) {
        const r = run({ gapSec: mins * 60, speed, dev: speed, world });
        const ratio = r.gapTotal / r.gapTruth;
        assert.ok(ratio < 1.06 && ratio > 0.9,
          world + " lock of " + mins + " min at " + speed + " m/s credited " + Math.round(r.gapTotal) +
          " m for " + Math.round(r.gapTruth) + " m covered (x" + ratio.toFixed(2) + ")");
      }
    }
  }
});

test("BLOCKER: the pedometer's fill is settled against the WHOLE replayed backlog, not one fix of it", () => {
  // The mechanism, stated so a regression names itself: the tab is a running balance. Every metre the
  // pedometer credited has to be worked off by real GPS credit before new ground counts, so after a
  // lock the amount SETTLED is essentially the amount FILLED — one fix cannot discharge the lot.
  const r = run({ gapSec: 1200, speed: 3, dev: null });
  assert.ok(r.pedoFilled > 3000, "the pedometer did not fill the lock at all: " + Math.round(r.pedoFilled) + " m");
  assert.ok(r.settled > r.pedoFilled * 0.95,
    "only " + Math.round(r.settled) + " m of the pedometer's " + Math.round(r.pedoFilled) +
    " m fill was worked off by GPS — the tab is being cleared instead of spent");
  assert.equal(Math.round(r.owing), 0, "the balance outlived the run: " + Math.round(r.owing) + " m still owing");
});

test("BLOCKER: a debt the pedometer's PATH left owing is written off, never charged to honest running", () => {
  // ⚠️ THE COST OF A BALANCE WITH NO TIME BOUND, AND IT IS FAR WORSE THAN A ROUNDING ERROR. The
  // pedometer measures the path; GPS measures the chord between two fixes. Round a bend they differ;
  // round a LAP the chord is nearly zero, so no recovery fix can ever pay the debt and it follows the
  // runner into honest ground. Measured with the bound removed: a 360-degree loop through a
  // one-minute blackout credited 51 m of the next honest 180, and the run came out -26.6% instead of
  // -9.9%. A fix whose interval starts after the billed window is covering new ground.
  for (const bend of [180, 270, 360]) {
    const r = run({ gapSec: 60, speed: 3, dev: 3, dark: true, bend });
    assert.ok(r.postDist > r.postTruth * 0.9,
      "after a " + bend + "-degree blackout the next honest minute credited " + Math.round(r.postDist) +
      " m of " + Math.round(r.postTruth) + " m — the pedometer's leftover path was charged to it");
    assert.equal(Math.round(r.owing), 0, "a " + bend + "-degree blackout left " + Math.round(r.owing) + " m owing for ever");
  }
  // And the write-off has to be VISIBLE, or a run full of tight turns looks like a fault.
  const loop = run({ gapSec: 60, speed: 3, dev: 3, dark: true, bend: 360 });
  assert.ok(loop.writtenOff > 50,
    "a 360-degree blackout wrote off " + Math.round(loop.writtenOff) + " m — nothing is being recorded");
});

test("BLOCKER: a genuine blackout with the screen on is still filled, and still filled ONCE", () => {
  // ⚠️ THE FEATURE THE TAB PROTECTS. The step counter exists because distance is lost under trees and
  // in tunnels WITH THE SCREEN ON; a fix that stops it filling destroys what it was defending.
  for (const mins of [1, 2, 5, 10]) {
    const r = run({ gapSec: mins * 60, speed: 3, dev: 3, dark: true });
    assert.ok(r.pedoFilled > mins * 60 * 3 * 0.55,
      mins + "-minute tunnel: the step counter filled only " + Math.round(r.pedoFilled) + " m of " + Math.round(r.gapTruth));
    // Filled once: the recovery fix must not bill the same stretch again.
    assert.ok(r.dist < r.truth * 1.03,
      mins + "-minute tunnel was billed twice: " + Math.round(r.dist) + " m for " + Math.round(r.truth) + " m run");
    assert.ok(r.dist > r.truth * 0.85,
      mins + "-minute tunnel lost the gap's ground: " + Math.round(r.dist) + " m for " + Math.round(r.truth) + " m run");
  }
});

test("BLOCKER: a run with no gaps at all is untouched, and the step counter contributes nothing", () => {
  for (const speed of [1.4, 3, 4.5]) {
    for (const dev of [speed, null]) {
      const r = run({ gapSec: 0, speed, dev });
      assert.equal(Math.round(r.pedoFilled), 0,
        "the step counter credited " + Math.round(r.pedoFilled) + " m on a run where GPS never went quiet");
      assert.equal(Math.round(r.settled), 0, "there was a debt to settle on a healthy run");
      assert.ok(r.dist > r.truth * 0.94 && r.dist < r.truth * 1.03,
        "an honest " + speed + " m/s runner was credited " + Math.round(r.dist) + " m of " + Math.round(r.truth));
    }
  }
});

test("a treadmill run reaches none of this — the step counter is never started indoors", () => {
  const r = run({ gapSec: 600, speed: 3, dev: null, indoor: true });
  assert.equal(Math.round(r.pedoFilled), 0, "the pedometer credited distance to an indoor run");
  assert.equal(r.dist, 0, "an indoor run accumulated GPS distance");
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  // The structural half: the counter is started from the GPS path only, and the filler refuses any
  // other mode. Both, because either one alone would let a future indoor path start it.
  assert.match(html, /function pedoFillGap\(\)\s*\{[\s\S]{0,400}?LIVE\.mode !== "gps"\) return/,
    "pedoFillGap no longer refuses a non-GPS run");
  const startGps = html.slice(html.indexOf("function startGps("), html.indexOf("function startGps(") + 3000);
  assert.match(startGps, /pedoPost\("start"\)/, "the step counter is no longer started from the GPS path");
  const startIndoor = html.slice(html.indexOf("function startIndoor("), html.indexOf("function startIndoor(") + 3000);
  assert.ok(!/pedoPost\("start"\)/.test(startIndoor), "startIndoor now starts the step counter");
});

/* ------------------------------------------------------------------------------------------------
   (b) the session that finished early
   ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a distance-gated session is not completed early by a screen lock", () => {
  // He dialled up 1 km, walked it, and the app declared it done at 720 m. The step gate is
  // `distanceMeters` with no duration, so an inflated distance ENDS THE SESSION — the runner cannot
  // argue with it and there is nothing on screen to explain it.
  // tailSec long enough that the step CAN finish honestly — otherwise the guard reads "never" for
  // both the broken and the fixed build and discriminates nothing.
  const control = run({ gapSec: 0, speed: 3, dev: null, gateM: 1000, tailSec: 600 });
  assert.ok(control.doneAtM != null, "the control run never completed its 1 km step");
  for (const world of ["suspended", "throttled", "awake"] as const) {
    for (const gap of [60, 120, 300]) {
      const r = run({ gapSec: gap, speed: 3, dev: null, gateM: 1000, world, tailSec: 600 });
      assert.ok(r.doneAtM != null, world + " " + gap + "s lock: the 1 km step never completed at all");
      assert.ok(r.doneAtM! > 940,
        world + " " + gap + "s lock: a 1 km step was declared done after " + Math.round(r.doneAtM!) +
        " m actually covered (control " + Math.round(control.doneAtM!) + " m)");
    }
  }
});

/* ------------------------------------------------------------------------------------------------
   (a) the kilometres logged at no time at all
   ------------------------------------------------------------------------------------------------ */

test("BLOCKER: no split is ever recorded as a measured zero seconds", () => {
  // Measured on the shipped build, 20-minute lock: 353s 333s 334s 0s 0s 0s 136s.
  //
  // ⚠️ pedoScale IS WHAT MAKES THIS FALSIFIABLE — see the note on the option. At 1.0 the balance fix
  // alone prevents the collapse, so a sweep without it passed with the est flag deliberately deleted.
  let sawUnmeasured = 0;
  for (const world of ["suspended", "throttled", "awake"] as const) {
    for (const gap of [120, 600, 1200]) {
      for (const pedoScale of [1, 0.5, 0.3]) {
        // tailSec 600 so the trace clears several kilometre boundaries whatever the gap length.
        const r = run({ gapSec: gap, speed: 3, dev: 3, world, tailSec: 600, pedoScale });
        assert.ok(r.splits.length > 0, "no splits at all were recorded across " + Math.round(r.dist) + " m");
        for (const s of r.splits) {
          // A zero is only ever honest if it is flagged as unmeasured, and this app's own est flag is
          // what judged() in runAnalysis reads to refuse to score one.
          if (!(s.sec > 0)) {
            sawUnmeasured++;
            assert.ok(s.est, world + " " + gap + "s lock at pedometer x" + pedoScale + ": kilometre " +
              s.km + " was recorded at " + s.sec + " s/km as a MEASUREMENT");
          }
        }
      }
    }
  }
  // ⚠️ AND THE SWEEP HAS TO PROVE IT REACHED THE CASE. Without this the whole guard is vacuous the day
  // an upstream change stops producing an untimeable split, and it would report clean for ever after.
  assert.ok(sawUnmeasured > 0,
    "no untimeable split occurred anywhere in the sweep, so this guard proved nothing");
});

test("BLOCKER: a kilometre whose time is unknowable is announced without a fabricated one", () => {
  // fmtPace(0) is "0:00", so the collapse above was also SPOKEN: "4 km, zero minutes per kilometre",
  // at the exact moment the runner is least able to check it.
  // pedoScale low enough that an untimeable split genuinely occurs — see the note on the option.
  let sawUnmeasuredCue = 0;
  for (const gap of [120, 1200]) {
    for (const pedoScale of [1, 0.5, 0.3]) {
      const r = run({ gapSec: gap, speed: 3, dev: 3, tailSec: 600, pedoScale });
      assert.ok(r.splitCues.length > 0, "no kilometre was announced at all across " + Math.round(r.dist) + " m");
      for (const m of r.splitCues) {
        assert.ok(!/\b0:00\b/.test(m), "a split was announced as " + JSON.stringify(m));
        if (/not measured/.test(m)) sawUnmeasuredCue++;
      }
    }
  }
  assert.ok(sawUnmeasuredCue > 0,
    "no untimeable kilometre was announced anywhere in the sweep, so this guard proved nothing");
  // And the ordinary case must still carry its time, or this became a silent feature.
  const plain = run({ gapSec: 0, speed: 3, dev: 3, tailSec: 600 });
  assert.ok(plain.splitCues.length > 0, "the control run announced no kilometre to check");
  assert.ok(plain.splitCues.every((m) => /\/km split/.test(m)),
    "an ordinary split stopped reporting its time: " + JSON.stringify(plain.splitCues));
});

test("both callers of checkSplits pass a moment, so neither can silently stamp the other's clock", () => {
  // ⚠️ GUARD THE CALL SITES, not the clamp. The clamp is right — a split can never run backwards. The
  // defect was two callers on two clocks: pedoFillGap on the wall clock (correct for an event that is
  // happening now) and onGpsPos on each fix's own clock (correct for a backlog that happened minutes
  // ago). During a lock they are twenty minutes apart.
  //
  // ⚠️ AND A BARE CALL IS NOT THE DEFECT — this guard's first version counted them and failed on
  // correct code. `gpsUiTick` and `liveTick` both call it bare and both are right to: they run on a
  // live tick, where the wall clock IS the moment the boundary was crossed. The two paths that can
  // disagree are the gap filler and the credited fix, so those two are what is asserted.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const filler = html.slice(html.indexOf("function pedoFillGap("), html.indexOf("function onGpsPos("));
  assert.match(filler, /checkSplits\(liveNowMs\(\)\)/,
    "pedoFillGap no longer stamps its split with a moment — it is back on the default and back on a clock of its own");
  const gps = html.slice(html.indexOf("function onGpsPos("), html.indexOf("function paceMark("));
  assert.match(gps, /checkSplits\(fixMs\)/,
    "a credited fix no longer stamps its split with the fix's own time — a replayed backlog collapses again");
  // Every remaining bare call must be on a live tick, where now is genuinely the moment.
  for (const fn of ["pedoFillGap", "onGpsPos"]) {
    const body = html.slice(html.indexOf("function " + fn + "("), html.indexOf("function " + fn + "(") + 9000);
    const upTo = body.slice(0, body.indexOf("\nfunction ") + 1 || body.length);
    assert.ok(!/checkSplits\(\s*\)/.test(upTo), fn + " calls checkSplits with no moment at all");
  }
});

/* ------------------------------------------------------------------------------------------------
   (c) and (d) the wrong-direction coaching
   ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a runner dead on target is never told to ease back, with or without a lock", () => {
  // ⚠️ THIS IS THE ONE HE HEARD, AND IT IS NOT A LOCK DEFECT. 3.0 m/s is 333 s/km, the middle of a
  // 320-350 band, so every "ahead of easy pace" here is false. Measured on the shipped build: 59 of
  // them on a healthy run with no Doppler, 57 after a 20-minute lock.
  //
  // Sweeps the no-Doppler case deliberately: with a device speed the derivation never runs, so a
  // fixture that supplies one cannot see this at all.
  for (const dev of [null, 3]) {
    for (const gapSec of [0, 60, 600, 1200]) {
      const r = run({ gapSec, speed: 3, dev });
      assert.ok(r.tooFastCues <= 2,
        "on target at 333 s/km with dev=" + dev + " and a " + gapSec + "s gap, the coach said " +
        r.tooFastCues + " times: " + JSON.stringify(r.paceCues.slice(0, 4)));
    }
  }
  // And on vague fixes, where the leash is widest and the quantisation worst.
  for (const accuracy of [25, 40]) {
    const r = run({ gapSec: 0, speed: 3, dev: null, accuracy });
    assert.ok(r.tooFastCues <= 2,
      "on target at +-" + accuracy + " m the coach said ease back " + r.tooFastCues + " times");
  }
});

test("BLOCKER: the derived pace measures metres and seconds over the SAME stretch", () => {
  // The mechanism, so a regression names itself rather than showing up as noisy coaching: both ends of
  // the window are credit events. Pushed on a UI tick the far end advances every 250 ms while the
  // distance advances one leash at a time, and the ratio swings forty per cent.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const pace = html.slice(html.indexOf("function currentGpsPace("), html.indexOf("function gpsUiTick("));
  assert.ok(!/atMs - w0\.t/.test(pace),
    "currentGpsPace is measuring seconds to NOW and metres to the last credit — the mismatched pair again");
  assert.match(pace, /wN\.t - w0\.t/, "the window's own far end is no longer the end of the interval");
  assert.match(pace, /wN\.d - w0\.d/, "the metres are no longer taken from the window's own far end");
  // The tick must not feed the window, or a tick-aligned entry lands beside the credit-aligned ones.
  const tick = html.slice(html.indexOf("function gpsUiTick("), html.indexOf("function gpsStatusText("));
  assert.ok(!/LIVE\.win\.push/.test(tick), "gpsUiTick is pushing into the pace window again");
  // ⚠️ AND BOTH CREDIT PATHS MUST MARK IT. onGpsPos is the obvious one; pedoFillGap is the one that
  // gets forgotten, and it is the only path that credits ground with no fix behind it.
  const filler = html.slice(html.indexOf("function pedoFillGap("), html.indexOf("function onGpsPos("));
  assert.match(filler, /paceMark\(/, "the gap filler credits distance without telling the pace window");
  const gps = html.slice(html.indexOf("function onGpsPos("), html.indexOf("function paceMark("));
  assert.match(gps, /paceMark\(/, "a credited fix no longer tells the pace window");
  // Behaviourally: a healthy no-Doppler run's derived pace must sit close to the truth.
  const seen: number[] = [];
  for (const speed of [2.4, 3, 3.6]) {
    const r = run({ gapSec: 0, speed, dev: null });
    if (r.curPace) seen.push(Math.abs(r.curPace - 1000 / speed) / (1000 / speed));
  }
  assert.ok(seen.length >= 2, "the derived pace never produced a reading to check");
  assert.ok(Math.max(...seen) < 0.12,
    "the derived pace is off the truth by " + Math.round(Math.max(...seen) * 100) + "%");
});

test("BLOCKER: the gap filler tells the pace window, and it is asserted BEHAVIOURALLY", () => {
  // ⚠️ THE ONLY GUARD ON THIS LINE WAS A SOURCE GREP, AND A VERIFIER REPORTED IT AS AN ESCAPE. Their
  // re-break — deleting `paceMark(liveNowMs(), LIVE.dist)` from `pedoFillGap` — was in fact caught by
  // the grep above, but only after a rebuild: these tests read `web/app.html`, so a break applied to
  // `web/app.ts` and not built is a break the suite never sees. Either way the substantive point
  // stands, because a source assertion proves a string exists and never that anything reaches it.
  //
  // ⚠️ SO THIS ASSERTS WHAT THE LINE DELIVERS: during a genuine blackout with the screen on, the only
  // evidence of movement is the step counter, and the derived pace must track the ground it credits
  // instead of going blank or holding a stale number. Traced through a two-minute dark tunnel at
  // 1.4 m/s, the window reads 714 s/km throughout — the truth is 715 — and with the line deleted it
  // reports nothing at all for the whole blackout, because `currentGpsPace` trims to one entry and
  // returns null. A ten-minute tunnel with no pace on screen is not a smaller version of the same
  // thing; it is the feature absent.
  for (const speed of [1.4, 3]) {
    const truth = 1000 / speed;
    const r = run({ gapSec: 120, speed, dev: null, dark: true, blackoutPace: true } as Trace);
    assert.ok(r.blackoutPace != null,
      "the derived pace was null for the whole blackout at " + speed + " m/s — the pedometer credits " +
      Math.round(r.pedoFilled) + " m and the pace window is not being told about it");
    assert.ok(Math.abs(r.blackoutPace! - truth) / truth < 0.06,
      "during the blackout the pace read " + r.blackoutPace!.toFixed(0) + " s/km against a truth of " +
      truth.toFixed(0) + " — the metres and the seconds are not describing the same stretch");
  }
  // ⚠️ AND NO FABRICATED FAST READING AT THE BOUNDARY, which is the half a source grep could never see.
  // A settlement corrects a total rather than describing movement over the window's own interval, and
  // dividing it by the few seconds since the last mark read 151-165 s/km at every long screen lock at
  // walking pace — a 2:36/km quoted to somebody walking, which fired "ease back" at them. The owner's
  // own report was a walk.
  for (const gapSec of [60, 300, 600, 1200]) {
    const r = run({ gapSec, speed: 1.4, dev: null });
    const fastest = r.minPace;
    assert.ok(fastest == null || fastest > 400,
      "a " + gapSec + "-second lock at walking pace reported " + String(fastest) +
      " s/km at its fastest — measured 151-165 before the settlement resets the window, 715 after");
    assert.equal(r.tooFastCues, 0,
      "a walker was told to ease back " + r.tooFastCues + " time(s) after a " + gapSec + "-second lock");
  }
});

test("BLOCKER: a runner who genuinely IS too fast is still told so", () => {
  // ⚠️ THE NON-REGRESSION THAT MATTERS MOST. Removing wrong coaching by removing all coaching is not a
  // fix. 4.2 m/s is 238 s/km against a 320-350 band — a real correction, and it must survive.
  for (const dev of [null, 4.2]) {
    const r = run({ gapSec: 0, speed: 4.2, dev });
    assert.ok(r.tooFastCues >= 1,
      "a runner at 238 s/km against a 320-350 band was told nothing (dev=" + dev + "): " + JSON.stringify(r.paceCues));
  }
});

test("the derived pace still goes away when the runner stops, rather than freezing", () => {
  // Measuring seconds to the last CREDIT rather than to now is what created this risk: with nothing
  // credited, the last pace would otherwise stand for ever — the frozen number currentGpsPace's own
  // contract rules out.
  //
  // ⚠️ SCOPED TO THE DERIVED PATH, and the first version was not. With a device speed still reporting
  // 3 m/s the app is right to believe it — that is the documented pre-existing rule, unchanged here —
  // so a fixture that stands still while claiming to run tests a phone that does not exist and fails
  // on correct code.
  const r = run({ gapSec: 0, speed: 3, dev: null, stillSec: 120 });
  assert.equal(r.stationaryPace, null,
    "after two minutes stationary the app still reported " + r.stationaryPace + " s/km");
});

test("a device speed short-circuits the derivation, so Doppler runs are untouched", () => {
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const pace = html.slice(html.indexOf("function currentGpsPace("), html.indexOf("function gpsUiTick("));
  const devLine = pace.indexOf("LIVE.devSpeed");
  const winLine = pace.indexOf("LIVE.win");
  assert.ok(devLine >= 0 && winLine > devLine,
    "the device speed is no longer consulted before the window — a Doppler run now inherits the derivation");
  for (const speed of [1.4, 3, 4.2]) {
    const r = run({ gapSec: 0, speed, dev: speed });
    assert.equal(Math.round(r.curPace!), Math.round(1000 / speed),
      "a run reporting " + speed + " m/s derived " + Math.round(r.curPace!) + " s/km instead of the device's own figure");
  }
});

/* ------------------------------------------------------------------------------------------------
   the instrument
   ------------------------------------------------------------------------------------------------ */

test("BLOCKER: Support shows the one number that separates a filled gap from a double-billed one", () => {
  // ⚠️ pedoDiagLine SHOWED NOTHING USEFUL ON HIS RUN, and that is why this took a field report to
  // find. "filled 3549m" is what a tunnel looks like AND what a screen lock looks like; the cap never
  // fired, so "refused" stayed at zero. `settled` is the discriminator: metres the pedometer billed
  // that real GPS credit later covered. settled ~= filled means GPS was never dark and our own buffer
  // was holding the fixes; settled ~= 0 means the gap was genuine.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const diag = html.slice(html.indexOf("function pedoDiagLine("), html.indexOf("function pedoDiagLine(") + 2400);
  // ⚠️ THE COMMENT ABOVE THIS FUNCTION EXPLAINS WHY "settled" MATTERS, SO IT CONTAINS THE WORD — and
  // the first version of this guard read the whole slice and passed with the field deleted from the
  // output. Sixth firing of the trap this project records. Scoped to the returned expression, so the
  // claim is about what a runner is shown rather than about what the source happens to say.
  const shown = diag.slice(diag.lastIndexOf("return \"steps: "));
  assert.ok(shown.length > 40, "pedoDiagLine's return statement could not be found");
  for (const word of ["settled", "written off", "filled"]) {
    assert.ok(shown.includes(word), "pedoDiagLine no longer reports " + JSON.stringify(word));
  }
  // The label has to be attached to the number, not merely present somewhere in the string.
  assert.match(shown, /settled " \+ Math\.round\(p\.settled/, "the settled label is no longer printing p.settled");
  // Guard the READER: a line nobody renders is a line nobody reads.
  assert.match(html, /pedoDiagLine\(\),/, "pedoDiagLine is built but never shown in Support > Your data");

  // And the numbers must actually be written, in both directions, or the label is decoration.
  const lock = run({ gapSec: 1200, speed: 3, dev: null });
  assert.ok(lock.settled > lock.pedoFilled * 0.95,
    "a screen lock reported settled " + Math.round(lock.settled) + " m of a " + Math.round(lock.pedoFilled) +
    " m fill — the number cannot identify a lock");
  const tunnel = run({ gapSec: 120, speed: 3, dev: 3, dark: true });
  assert.ok(tunnel.pedoFilled > 100, "the tunnel fixture did not fill anything to report on");
  assert.ok(tunnel.settled < tunnel.pedoFilled * 0.25,
    "a genuine tunnel reported settled " + Math.round(tunnel.settled) + " m of a " + Math.round(tunnel.pedoFilled) +
    " m fill — the number cannot tell a real gap from a lock");
});

test("the native side still has no application-state gate, and that is deliberate", () => {
  // ⚠️ THE ASYMMETRY AT THE ROOT OF THIS IS REAL AND IS LEFT ALONE ON PURPOSE. LocationService gates
  // its delivery on the app being active; PedometerService does not. Gating the pedometer to match
  // would look symmetrical and would take the pedometer away from the one case only it can serve: a
  // POCKETED phone in a tunnel, where the screen is off AND there are no fixes to buffer. The page
  // owns the fusion — Swift reports, the page decides — so the accounting is where the fix belongs.
  const pedo = readFileSync(new URL("../ios/InteRun/PedometerService.swift", import.meta.url), "utf8");
  assert.ok(!/applicationState/.test(pedo),
    "PedometerService now gates on application state: a pocketed phone in a tunnel records nothing at all");
  const loc = readFileSync(new URL("../ios/InteRun/LocationService.swift", import.meta.url), "utf8");
  assert.match(loc, /applicationState == \.active/,
    "LocationService no longer buffers while inactive — the replay this whole file is about has changed shape");
  // The case that justifies keeping the pedometer ungated, measured rather than argued.
  const pocket = run({ gapSec: 600, speed: 3, dev: null, dark: true });
  assert.ok(pocket.dist > pocket.truth * 0.85,
    "a pocketed phone in a ten-minute tunnel recorded " + Math.round(pocket.dist) + " m of " +
    Math.round(pocket.truth) + " m — the only source that can cover it is the step counter");
});
