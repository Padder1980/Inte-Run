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
  const { cues } = run(live, { startMs: 0, seconds: 20, startDist: 0, paceSecPerKm: 250, reportPace: true });
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
  const { cues } = run(live, { startMs: 0, seconds: 20, startDist: 0, paceSecPerKm: 320, reportPace: true });
  const pace = cues.find((c) => c.kind === "pace");
  assert.equal(pace?.paceStatus, "slow");
  assert.match(pace?.message ?? "", /pick it up/i);
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
