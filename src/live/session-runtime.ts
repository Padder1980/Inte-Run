// Live-session runtime: the logic layer that drives a runner through a planned session in real time.
//
// It is a deterministic state machine — idle → active ⇄ paused → completed — fed plain telemetry
// samples (elapsed wall-clock + cumulative distance, optionally heart rate / instantaneous pace).
// It owns no clock and touches no device: the caller supplies timestamps, so the exact same code
// runs behind a real GPS/HR feed, a simulated run in the browser demo, or a unit test. It steps
// through the session's workout steps (warmup, reps, recoveries, cooldown), tracks progress against
// each step's time/distance target, judges pace against the target band, and emits cues a UI or a
// text-to-speech layer can announce.

import type { PaceRange, Session, WorkoutStep } from "../domain/types.ts";
import { formatDuration, formatPace, metresToKm } from "../domain/units.ts";

export type LiveStatus = "idle" | "active" | "paused" | "completed";

/** A telemetry sample from the device layer. Distance is cumulative for the whole session. */
export type Telemetry = {
  atMs: number;
  distanceMeters: number;
  heartRateBpm?: number;
  /** Instantaneous pace if the device reports it; otherwise the runtime derives a rolling pace. */
  paceSecPerKm?: number;
};

export type PaceStatus = "fast" | "on" | "slow" | "none";

export type CueKind =
  | "session-start"
  | "step-start"
  | "pace"
  | "paused"
  | "resumed"
  | "session-complete";

export type Cue = {
  kind: CueKind;
  message: string;
  atMs: number;
  /** For "pace" cues, the status that triggered it. */
  paceStatus?: PaceStatus;
  /** For step cues, the index of the step involved. */
  stepIndex?: number;
};

export type StepView = {
  index: number;
  total: number;
  kind: WorkoutStep["kind"];
  label: string;
  repeatIndex?: number;
  repeatCount?: number;
  gate: "time" | "distance";
  targetSeconds?: number;
  targetMeters?: number;
  targetPace?: PaceRange;
};

export type LiveSnapshot = {
  status: LiveStatus;
  step?: StepView;
  stepElapsedSeconds: number;
  stepProgress: number; // 0..1
  elapsedSeconds: number;
  distanceMeters: number;
  overallProgress: number; // 0..1 against the planned session duration
  currentPaceSecPerKm?: number;
  averagePaceSecPerKm?: number;
  /** Average pace over the current section (workout step) only — resets at each step boundary. */
  lapPaceSecPerKm?: number;
  paceStatus: PaceStatus;
  heartRateBpm?: number;
  lastCue?: Cue;
};

/** Pace within this many sec/km of the band still counts as "on target" (avoids jitter). */
const PACE_TOLERANCE = 6;

function isDistanceGated(step: WorkoutStep): boolean {
  return step.distanceMeters != null && step.durationSeconds == null;
}

/** Planned seconds for a step — its duration, or distance ÷ mid target pace for distance-gated steps. */
function plannedStepSeconds(step: WorkoutStep): number {
  if (step.durationSeconds != null) return step.durationSeconds;
  if (step.distanceMeters != null && step.targetPaceSecPerKm) {
    const midPace = (step.targetPaceSecPerKm.minSecPerKm + step.targetPaceSecPerKm.maxSecPerKm) / 2;
    return midPace * metresToKm(step.distanceMeters);
  }
  return 0;
}

function stepView(steps: WorkoutStep[], index: number): StepView {
  const s = steps[index]!;
  return {
    index,
    total: steps.length,
    kind: s.kind,
    label: s.label,
    repeatIndex: s.repeatIndex,
    repeatCount: s.repeatCount,
    gate: isDistanceGated(s) ? "distance" : "time",
    targetSeconds: s.durationSeconds,
    targetMeters: s.distanceMeters,
    targetPace: s.targetPaceSecPerKm,
  };
}

/** True for steps meant to be worked (reps / threshold efforts), where running slow warrants a nudge. */
function isWorkStep(step: WorkoutStep): boolean {
  return step.kind === "rep" || (step.targetRpe != null && step.targetRpe.min >= 6);
}

function paceVsBand(paceSecPerKm: number, band: PaceRange | undefined): PaceStatus {
  if (!band) return "none";
  if (paceSecPerKm < band.minSecPerKm - PACE_TOLERANCE) return "fast";
  if (paceSecPerKm > band.maxSecPerKm + PACE_TOLERANCE) return "slow";
  return "on";
}

function repSuffix(step: WorkoutStep): string {
  return step.repeatIndex && step.repeatCount ? ` (${step.repeatIndex}/${step.repeatCount})` : "";
}

function targetPhrase(step: WorkoutStep): string {
  const parts: string[] = [];
  if (isDistanceGated(step)) parts.push(`${Math.round(step.distanceMeters!)}m`);
  else if (step.durationSeconds) parts.push(formatDuration(step.durationSeconds));
  if (step.targetPaceSecPerKm) {
    parts.push(
      `${formatDuration(step.targetPaceSecPerKm.minSecPerKm)}–${formatPace(step.targetPaceSecPerKm.maxSecPerKm)}`,
    );
  }
  return parts.join(" · ");
}

/**
 * Stateful controller for one live session. Methods return the cues emitted by that transition, so
 * a UI can render them immediately; `snapshot()` gives the current state for the display.
 */
export class LiveSession {
  private readonly steps: WorkoutStep[];
  private readonly plannedSeconds: number;
  private status: LiveStatus = "idle";
  private stepIndex = 0;

  private accruedActiveMs = 0;
  private segmentStartMs: number | null = null;

  private stepBaselineActiveMs = 0;
  private stepBaselineDistanceM = 0;

  private distanceM = 0;
  private heartRateBpm?: number;

  private lastPaceSampleActiveMs = 0;
  private lastPaceSampleDistanceM = 0;
  private currentPace?: number;
  private stepPaceStatus: PaceStatus = "none";

  private lastCue?: Cue;

  readonly session: Session;

  constructor(session: Session) {
    this.session = session;
    this.steps = session.steps;
    this.plannedSeconds =
      session.estimatedDurationSeconds ||
      this.steps.reduce((sum, s) => sum + plannedStepSeconds(s), 0);
  }

  private activeMsAt(atMs: number): number {
    return this.accruedActiveMs + (this.segmentStartMs != null ? atMs - this.segmentStartMs : 0);
  }

  private record(cue: Cue): Cue {
    this.lastCue = cue;
    return cue;
  }

  /** Begin the session. No-op (returns []) if already started. */
  start(atMs: number): Cue[] {
    if (this.status !== "idle") return [];
    this.status = "active";
    this.segmentStartMs = atMs;
    this.stepBaselineActiveMs = 0;
    this.stepBaselineDistanceM = 0;
    this.lastPaceSampleActiveMs = 0;
    const cues = [
      this.record({ kind: "session-start", atMs, message: `Session started — ${this.session.title}.` }),
    ];
    if (this.steps.length > 0) cues.push(this.stepStartCue(atMs));
    return cues;
  }

  pause(atMs: number): Cue[] {
    if (this.status !== "active") return [];
    this.accruedActiveMs = this.activeMsAt(atMs);
    this.segmentStartMs = null;
    this.status = "paused";
    return [this.record({ kind: "paused", atMs, message: "Paused." })];
  }

  resume(atMs: number): Cue[] {
    if (this.status !== "paused") return [];
    this.segmentStartMs = atMs;
    this.status = "active";
    return [this.record({ kind: "resumed", atMs, message: "Resumed." })];
  }

  /** End the session early. */
  stop(atMs: number): Cue[] {
    if (this.status === "completed" || this.status === "idle") return [];
    this.accruedActiveMs = this.activeMsAt(atMs);
    this.segmentStartMs = null;
    this.status = "completed";
    return [this.record({ kind: "session-complete", atMs, message: "Session ended." })];
  }

  /** Feed a telemetry sample. Advances steps, judges pace, and returns any cues emitted. */
  update(t: Telemetry): Cue[] {
    if (this.status !== "active") return [];
    this.distanceM = t.distanceMeters;
    if (t.heartRateBpm != null) this.heartRateBpm = t.heartRateBpm;
    const activeMs = this.activeMsAt(t.atMs);
    const cues: Cue[] = [];

    // Advance through any steps completed by this sample.
    while (this.stepIndex < this.steps.length) {
      const step = this.steps[this.stepIndex]!;
      const stepActiveSec = (activeMs - this.stepBaselineActiveMs) / 1000;
      const stepDist = this.distanceM - this.stepBaselineDistanceM;
      const done = isDistanceGated(step)
        ? stepDist >= (step.distanceMeters ?? 0)
        : stepActiveSec >= (step.durationSeconds ?? 0);
      if (!done) break;
      this.stepIndex++;
      this.stepBaselineActiveMs = activeMs;
      this.stepBaselineDistanceM = this.distanceM;
      this.stepPaceStatus = "none";
      if (this.stepIndex < this.steps.length) {
        cues.push(this.stepStartCue(t.atMs));
      } else {
        this.status = "completed";
        cues.push(
          this.record({
            kind: "session-complete",
            atMs: t.atMs,
            message: `Done — ${formatDuration(activeMs / 1000)} · ${Math.round(metresToKm(this.distanceM) * 10) / 10} km. Nice work.`,
          }),
        );
        return cues;
      }
    }

    // Pace: prefer a device-reported value, else derive a rolling pace since the last sample.
    this.currentPace = t.paceSecPerKm ?? this.rollingPace(activeMs);
    this.lastPaceSampleActiveMs = activeMs;
    this.lastPaceSampleDistanceM = this.distanceM;

    const step = this.steps[this.stepIndex];
    if (step && this.currentPace != null) {
      const status = paceVsBand(this.currentPace, step.targetPaceSecPerKm);
      if (status !== "none" && status !== this.stepPaceStatus) {
        this.stepPaceStatus = status;
        const msg = this.paceMessage(step, status);
        if (msg) cues.push(this.record({ kind: "pace", atMs: t.atMs, paceStatus: status, message: msg }));
      }
    }
    return cues;
  }

  private rollingPace(activeMs: number): number | undefined {
    const dSec = (activeMs - this.lastPaceSampleActiveMs) / 1000;
    const dMeters = this.distanceM - this.lastPaceSampleDistanceM;
    if (dSec <= 0 || dMeters <= 0) return this.currentPace;
    return dSec / metresToKm(dMeters);
  }

  private stepStartCue(atMs: number): Cue {
    const step = this.steps[this.stepIndex]!;
    const head = step.label + repSuffix(step);
    const target = targetPhrase(step);
    return this.record({
      kind: "step-start",
      atMs,
      stepIndex: this.stepIndex,
      message: target ? `${head} — ${target}` : head,
    });
  }

  private paceMessage(step: WorkoutStep, status: PaceStatus): string | null {
    const work = isWorkStep(step);
    if (status === "on") return "On target.";
    if (status === "fast") {
      return work ? "Quick — keep it controlled and repeatable." : "Ease back — you're ahead of easy pace.";
    }
    // slow
    return work ? "Pick it up to reach target pace." : null; // running easy slower than the band is fine
  }

  snapshot(atMs?: number): LiveSnapshot {
    // With a timestamp we can include the in-progress active segment; without one we report time as
    // of the last accrual (exact while paused/idle/completed).
    const activeMs = atMs != null ? this.activeMsAt(atMs) : this.accruedActiveMs;
    const elapsedSeconds = activeMs / 1000;
    const step = this.stepIndex < this.steps.length ? this.steps[this.stepIndex] : undefined;
    const view = step ? stepView(this.steps, this.stepIndex) : undefined;

    let stepElapsedSeconds = 0;
    let stepProgress = 0;
    if (step) {
      stepElapsedSeconds = (activeMs - this.stepBaselineActiveMs) / 1000;
      const stepDist = this.distanceM - this.stepBaselineDistanceM;
      if (isDistanceGated(step)) {
        stepProgress = step.distanceMeters ? Math.min(1, stepDist / step.distanceMeters) : 0;
      } else {
        stepProgress = step.durationSeconds ? Math.min(1, stepElapsedSeconds / step.durationSeconds) : 0;
      }
    }

    const averagePace =
      this.distanceM > 0 ? elapsedSeconds / metresToKm(this.distanceM) : undefined;
    const lapDistanceM = this.distanceM - this.stepBaselineDistanceM;
    const lapPace =
      lapDistanceM > 0 ? stepElapsedSeconds / metresToKm(lapDistanceM) : undefined;
    const paceStatus = step && this.currentPace != null
      ? paceVsBand(this.currentPace, step.targetPaceSecPerKm)
      : "none";

    return {
      status: this.status,
      step: view,
      stepElapsedSeconds,
      stepProgress,
      elapsedSeconds,
      distanceMeters: this.distanceM,
      overallProgress: this.plannedSeconds > 0 ? Math.min(1, elapsedSeconds / this.plannedSeconds) : 0,
      currentPaceSecPerKm: this.currentPace,
      averagePaceSecPerKm: averagePace,
      lapPaceSecPerKm: lapPace,
      paceStatus,
      heartRateBpm: this.heartRateBpm,
      lastCue: this.lastCue,
    };
  }

  getStatus(): LiveStatus {
    return this.status;
  }

  /** The planned step timeline — useful for a progress bar segmented by step. */
  plan(): StepView[] {
    return this.steps.map((_, i) => stepView(this.steps, i));
  }
}
