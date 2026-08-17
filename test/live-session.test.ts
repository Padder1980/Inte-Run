import assert from "node:assert/strict";
import { test } from "node:test";
import type { PaceRange, Session, WorkoutStep } from "../src/domain/types.ts";
import { LiveSession, type Cue } from "../src/live/session-runtime.ts";

const EASY: PaceRange = { minSecPerKm: 300, maxSecPerKm: 360 };
const THRESH: PaceRange = { minSecPerKm: 240, maxSecPerKm: 260 };

function makeSession(steps: WorkoutStep[], title = "Test session"): Session {
  const estimatedDurationSeconds = steps.reduce((s, st) => s + (st.durationSeconds ?? 0), 0);
  return {
    id: "t1",
    dayOfWeek: 1,
    type: "threshold",
    title,
    description: "",
    intensity: "moderate",
    estimatedDurationSeconds,
    steps,
    source: "generated",
  };
}

/** Feed constant-pace telemetry over `seconds`, one sample/second, starting at `startMs`. */
function run(
  live: LiveSession,
  opts: { startMs: number; seconds: number; startDist: number; paceSecPerKm: number; reportPace?: boolean },
): { cues: Cue[]; endMs: number; endDist: number } {
  const cues: Cue[] = [];
  let dist = opts.startDist;
  const perSec = 1000 / opts.paceSecPerKm; // metres per second
  let ms = opts.startMs;
  for (let i = 1; i <= opts.seconds; i++) {
    ms = opts.startMs + i * 1000;
    dist += perSec;
    cues.push(
      ...live.update({
        atMs: ms,
        distanceMeters: dist,
        ...(opts.reportPace ? { paceSecPerKm: opts.paceSecPerKm } : {}),
      }),
    );
  }
  return { cues, endMs: ms, endDist: dist };
}

test("progresses through every step in order and completes", () => {
  const steps: WorkoutStep[] = [
    { kind: "warmup", label: "Warm up", durationSeconds: 60, targetPaceSecPerKm: EASY },
    { kind: "rep", label: "Rep", durationSeconds: 30, targetPaceSecPerKm: THRESH, repeatIndex: 1, repeatCount: 2 },
    { kind: "recovery", label: "Jog", durationSeconds: 20, targetPaceSecPerKm: EASY },
    { kind: "rep", label: "Rep", durationSeconds: 30, targetPaceSecPerKm: THRESH, repeatIndex: 2, repeatCount: 2 },
    { kind: "cooldown", label: "Cool down", durationSeconds: 30, targetPaceSecPerKm: EASY },
  ];
  const live = new LiveSession(makeSession(steps));
  const startCues = live.start(0);
  assert.equal(startCues[0]?.kind, "session-start");
  assert.equal(startCues[1]?.kind, "step-start");

  const { cues, endMs } = run(live, { startMs: 0, seconds: 180, startDist: 0, paceSecPerKm: 300 });
  const stepStarts = cues.filter((c) => c.kind === "step-start");
  // 4 further step-starts after the first (warmup was announced at start()).
  assert.equal(stepStarts.length, 4);
  assert.equal(live.getStatus(), "completed");
  assert.equal(cues.filter((c) => c.kind === "session-complete").length, 1);

  const snap = live.snapshot(endMs);
  assert.ok(snap.overallProgress >= 1 - 1e-6);
});

test("pause excludes wall-clock time from active elapsed", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", durationSeconds: 100, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  run(live, { startMs: 0, seconds: 40, startDist: 0, paceSecPerKm: 330 });

  live.pause(40_000);
  // 10 minutes of standing still.
  live.resume(640_000);
  const snap = live.snapshot(640_000);
  // ~40s of active time, not ~640s of wall-clock.
  assert.ok(Math.abs(snap.elapsedSeconds - 40) < 1.5, `elapsed was ${snap.elapsedSeconds}`);
  assert.equal(snap.status, "active");
});

test("lap pace reflects the current section only and resets at each step boundary", () => {
  const steps: WorkoutStep[] = [
    { kind: "warmup", label: "Warm up", durationSeconds: 60, targetPaceSecPerKm: EASY },
    { kind: "steady", label: "Tempo", durationSeconds: 60, targetPaceSecPerKm: THRESH },
  ];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  // Section 1: 60s at 360 s/km (slow). Section 2: 60s at 240 s/km (fast).
  const a = run(live, { startMs: 0, seconds: 60, startDist: 0, paceSecPerKm: 360 });
  const b = run(live, { startMs: a.endMs, seconds: 59, startDist: a.endDist, paceSecPerKm: 240 });
  const snap = live.snapshot(b.endMs);
  // Lap = section 2's pace (~240), well apart from the whole-session average (~300).
  assert.ok(Math.abs(snap.lapPaceSecPerKm! - 240) < 12, `lap was ${snap.lapPaceSecPerKm}`);
  assert.ok(Math.abs(snap.averagePaceSecPerKm! - 300) < 12, `avg was ${snap.averagePaceSecPerKm}`);
  assert.ok(snap.lapPaceSecPerKm! < snap.averagePaceSecPerKm! - 30);
});

test("distance-gated step completes on distance, not time", () => {
  const steps: WorkoutStep[] = [
    { kind: "rep", label: "1 mile cruise", distanceMeters: 1609.344, targetPaceSecPerKm: THRESH },
    { kind: "cooldown", label: "Cool down", durationSeconds: 30, targetPaceSecPerKm: EASY },
  ];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  // Run well past the mile's nominal time but keep distance short: should NOT advance yet.
  run(live, { startMs: 0, seconds: 60, startDist: 0, paceSecPerKm: 6000 }); // ~10 m over 60s
  assert.equal(live.snapshot(60_000).step?.label, "1 mile cruise");
  // Now cover the remaining distance quickly.
  const { cues } = run(live, { startMs: 60_000, seconds: 400, startDist: 10, paceSecPerKm: 240 });
  assert.ok(cues.some((c) => c.kind === "step-start" && c.message.includes("Cool down")));
});

test("emits an ease-off cue when running an easy step too fast", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", durationSeconds: 120, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  // 40 s, not 20 — a verdict now needs evidence (30 s AND 100 m) before it exists at all, because the
  // start is where GPS lies biggest. The cue still fires; it just waits for the grace to pass.
  const { cues } = run(live, { startMs: 0, seconds: 40, startDist: 0, paceSecPerKm: 250, reportPace: true });
  const pace = cues.find((c) => c.kind === "pace");
  assert.equal(pace?.paceStatus, "fast");
  assert.match(pace?.message ?? "", /ease back/i);
});

test("nudges to pick it up when a work rep is too slow", () => {
  const steps: WorkoutStep[] = [
    { kind: "rep", label: "Threshold rep", durationSeconds: 120, targetPaceSecPerKm: THRESH },
  ];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  const { cues } = run(live, { startMs: 0, seconds: 40, startDist: 0, paceSecPerKm: 320, reportPace: true });
  const pace = cues.find((c) => c.kind === "pace");
  assert.equal(pace?.paceStatus, "slow");
  assert.match(pace?.message ?? "", /pick it up/i);
});

// ---- The 2026-08-17 walking-run defects: a verdict must be EARNED --------------------------------
// The owner walked a 1 km custom session; GPS settling credited a ~90 m correction in one lump at the
// start, one 250 ms tick divided by it read as a "2.8 s/km pace", and the log said "Ease back — you're
// ahead of easy pace" at 0:00 to a runner SLOWER than the band. Three guards, each watched failing
// against the pre-fix engine.

test("a settle lump at the start produces no pace verdict at all", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", distanceMeters: 1000, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  // The settle: 90 m arrives in one 250 ms tick with no device pace — the exact observed shape.
  let cues = live.update({ atMs: 250, distanceMeters: 90 });
  assert.equal(cues.filter((c) => c.kind === "pace").length, 0,
    "a 90 m settle lump at 0:00 produced a pace cue — the wrong-direction walk defect is back");
  assert.equal(live.snapshot(250).paceStatus, "none", "a verdict exists before the run has shown evidence");
  // And the lump must not have poisoned the pace once the grace opens: keep walking honestly.
  for (let t = 1000; t <= 40_000; t += 1000) {
    cues = live.update({ atMs: t, distanceMeters: 90 + (t / 1000) * 1.4 });
    for (const c of cues) {
      assert.notEqual(c.paceStatus, "fast", "a walker was told they were too fast at " + t + "ms");
    }
  }
  assert.notEqual(live.snapshot(40_000).paceStatus, "fast", "the settle lump's garbage pace survived the grace");
});

test("a plausible-looking device pace in the first seconds is not judged either", () => {
  // ⚠️ THE CASE ONLY THE GRACE CATCHES. A settle lump's 2.8 s/km is refused by the plausibility
  // floor — but a start-of-run Doppler glitch can report a pace a human COULD run (160 s/km), and
  // the floor waves it through. The verdict must wait for evidence regardless of how believable the
  // number looks, because the start is where every instrument lies at once. This fixture was added
  // after a deliberate re-break of the grace sailed past the settle-lump test above: that lump is
  // double-covered by the floor, so it cannot discriminate.
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", distanceMeters: 1000, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  const cues = live.update({ atMs: 500, distanceMeters: 2, paceSecPerKm: 160 });
  assert.equal(cues.filter((c) => c.kind === "pace").length, 0,
    "a half-second-old device pace produced a verdict before the run had any evidence");
  assert.equal(live.snapshot(500).paceStatus, "none", "the snapshot judged a pace the run has not earned");
});

test("an implausible derivation is refused and a held pace expires", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", distanceMeters: 5000, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  // Establish an honest walking pace past the grace (device-reported, 700 s/km).
  for (let t = 1000; t <= 31_000; t += 1000) {
    live.update({ atMs: t, distanceMeters: (t / 1000) * 1.4 + 100, paceSecPerKm: 700 });
  }
  assert.equal(live.snapshot(31_000).currentPaceSecPerKm, 700);
  // A leash lump lands: 12 m in one 250 ms tick with no device pace = 20.8 s/km. Refused, held.
  live.update({ atMs: 31_250, distanceMeters: (31.25 * 1.4) + 112 });
  const held = live.snapshot(31_250).currentPaceSecPerKm;
  assert.equal(held, 700, "a leash lump was adopted as a pace: " + held);
  // And with no fresh evidence at all, the held value expires rather than driving verdicts forever.
  for (let t = 32_000; t <= 48_000; t += 1000) live.update({ atMs: t, distanceMeters: 156 });
  assert.equal(live.snapshot(48_000).currentPaceSecPerKm, undefined,
    "a pace with no evidence behind it for 15 s is still being believed");
});

test("a simulated run's 200 ms distance-only ticks still earn a verdict", () => {
  // ⚠️ THE REGRESSION THE SUITE WAS BLIND TO. The browser simulator feeds update() distance-only at a
  // 200 ms cadence and every existing pace test set reportPace — so a "derive only over ≥3 s" gate
  // would have silently killed all pace coaching in simulated runs with the suite green. The engine's
  // plausibility floor must never come with a minimum-window gate.
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", durationSeconds: 600, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  let verdict: string = "none";
  for (let t = 200; t <= 60_000; t += 200) {
    live.update({ atMs: t, distanceMeters: (t / 1000) * 3.7 });   // a steady 270 s/km, no device pace
    const s = live.snapshot(t).paceStatus;
    if (s !== "none") verdict = s;
  }
  assert.equal(verdict, "fast", "distance-only sim ticks no longer produce a pace verdict at all");
});

test("stop() ends the session early", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", durationSeconds: 600, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  live.start(0);
  run(live, { startMs: 0, seconds: 30, startDist: 0, paceSecPerKm: 330 });
  const cues = live.stop(30_000);
  assert.equal(cues[0]?.kind, "session-complete");
  assert.equal(live.getStatus(), "completed");
  // Further samples are ignored once completed.
  assert.equal(live.update({ atMs: 31_000, distanceMeters: 999 }).length, 0);
});

test("start() is idempotent and update() before start does nothing", () => {
  const steps: WorkoutStep[] = [{ kind: "steady", label: "Easy", durationSeconds: 60, targetPaceSecPerKm: EASY }];
  const live = new LiveSession(makeSession(steps));
  assert.equal(live.update({ atMs: 1000, distanceMeters: 100 }).length, 0);
  assert.equal(live.getStatus(), "idle");
  live.start(0);
  assert.equal(live.start(0).length, 0); // second start is a no-op
});
