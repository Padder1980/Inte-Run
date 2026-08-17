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
  /** What to call this section on screen — see WorkoutStep.display. */
  display?: string;
  targetSeconds?: number;
  targetMeters?: number;
  targetPace?: PaceRange;
  /**
   * ⚠️ CARRIED BECAUSE THE COACH DECIDES WHAT TO SAY FROM IT. `coachStepTrigger` reads
   * `step.targetRpe.min` to tell a long run's race-pace block ("pick it up") from its easy main
   * ("patience early, sip fluids") — and StepView did not carry the field, so that read was
   * `undefined` on every live step and every structured long run got the settle line at the exact
   * moment it was meant to lift. The schedule builder passed the raw WorkoutStep and got it right;
   * the live path passed a StepView and did not, so the two disagreed with nothing to show why.
   */
  targetRpe?: { min: number; max: number };
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

/**
 * ⚠️ NO PACE FASTER THAN THIS IS BELIEVED (sec/km). 150 s/km is 6.67 m/s — faster than any pace this
 * app ever prescribes (the fastest generated interval bands bottom out around 180-205 s/km), so a
 * derived pace below it is arithmetic on garbage, not a runner. The real case, measured 2026-08-17:
 * GPS settling at the start of a run credited a ~90 m correction in one lump, one 250 ms tick divided
 * by it gave "2.8 s/km", the verdict came out "fast", and a WALKER slower than their band was told
 * "Ease back — you're ahead of easy pace" at 0:00 with fabricated numbers behind it. There has always
 * been a slow-side cull (a derived pace slower than 20:00/km reads as stopped); this is its missing
 * fast-side twin. Strides carry no target band, so no verdict exists for them to lose.
 */
const PACE_PLAUSIBLE_MIN = 150;

/**
 * ⚠️ A HELD PACE EXPIRES. rollingPace holds the previous value whenever a sample brings no new
 * distance (leash-quantised GPS crediting means MOST ticks bring none), which is right for a few
 * seconds and wrong forever: a value held indefinitely lets one bad reading — or one real reading
 * from before a tunnel — drive verdicts minutes later. Measured: a garbage-fast settle reading held
 * this way kept paceStatus "fast" for 25 s and put a fabricated correction in the coach's own
 * recorded voice at t=20.3 s. 15 s matches the phone UI's own "no fresh evidence → show —" design.
 */
const PACE_STALE_MS = 15000;

/**
 * ⚠️ PACE VERDICTS NEED EVIDENCE BEFORE THEY EXIST AT ALL. The start of a run is exactly where the
 * device is least trustworthy — GPS settling happens at 0 m and 0 s by definition — so no pace
 * verdict (cue or snapshot) is issued until the session has both ~30 s of active time AND ~100 m of
 * credited distance. A treadmill run credits no distance and never had pace verdicts; a real runner
 * at 3-5 m/s clears 100 m in 20-33 s, so the elapsed arm decides and the wait is barely visible.
 * Every generated quality session opens with a band-less warm-up step, so in practice the grace
 * elapses long before the first banded work step.
 */
const PACE_GRACE_MS = 30000;
const PACE_GRACE_METERS = 100;

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
    display: s.display,
    targetSeconds: s.durationSeconds,
    targetMeters: s.distanceMeters,
    targetPace: s.targetPaceSecPerKm,
    targetRpe: s.targetRpe,
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
  /** Active-time stamp of the last BELIEVED pace (device-reported or a plausible derivation). */
  private paceAdoptedActiveMs = 0;
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
    //
    // ⚠️ A DERIVATION IS ADOPTED ONLY IF A HUMAN COULD RUN IT. GPS distance arrives in leash-sized
    // lumps (~10-90 m at a time), so a lump divided by one short tick is not a pace, it is
    // arithmetic noise — measured at 2.8-25 s/km on real traces. The old code adopted it, and the
    // old rollingPace then HELD it forever through the dMeters<=0 branch, so one settle lump kept
    // paceStatus "fast" for 25 s and spoke a fabricated correction in the coach's recorded voice.
    // Now: implausible derivations are refused (the previous believed pace holds instead), every
    // adoption is stamped, and a held value expires after PACE_STALE_MS with nothing fresh behind
    // it. ⚠️ NO MINIMUM-WINDOW GATE — the baselines below reset on EVERY sample, so a "derive only
    // over ≥3 s" rule can never be satisfied at any sub-3 s tick cadence and silently kills all
    // pace coaching for simulated runs (measured: the 200 ms sim tick went from a correct verdict
    // to none, permanently, and the suite could not see it).
    if (t.paceSecPerKm != null) {
      this.currentPace = t.paceSecPerKm;
      this.paceAdoptedActiveMs = activeMs;
    } else {
      const derived = this.rollingPace(activeMs);
      if (derived != null && derived >= PACE_PLAUSIBLE_MIN) {
        this.currentPace = derived;
        this.paceAdoptedActiveMs = activeMs;
      } else if (this.currentPace != null && activeMs - this.paceAdoptedActiveMs > PACE_STALE_MS) {
        this.currentPace = undefined;
      }
    }
    this.lastPaceSampleActiveMs = activeMs;
    this.lastPaceSampleDistanceM = this.distanceM;

    const step = this.steps[this.stepIndex];
    if (step && this.currentPace != null && this.paceGraceOver(activeMs)) {
      const status = paceVsBand(this.currentPace, step.targetPaceSecPerKm);
      if (status !== "none" && status !== this.stepPaceStatus) {
        this.stepPaceStatus = status;
        const msg = this.paceMessage(step, status);
        if (msg) cues.push(this.record({ kind: "pace", atMs: t.atMs, paceStatus: status, message: msg }));
      }
    }
    return cues;
  }

  /** Raw pace derivation since the last sample — no holding; the caller owns what to believe. */
  private rollingPace(activeMs: number): number | undefined {
    const dSec = (activeMs - this.lastPaceSampleActiveMs) / 1000;
    const dMeters = this.distanceM - this.lastPaceSampleDistanceM;
    if (dSec <= 0 || dMeters <= 0) return undefined;
    return dSec / metresToKm(dMeters);
  }

  /** No pace verdict exists until the run has shown real evidence — see PACE_GRACE_MS. */
  private paceGraceOver(activeMs: number): boolean {
    return activeMs >= PACE_GRACE_MS && this.distanceM >= PACE_GRACE_METERS;
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
    const paceStatus = step && this.currentPace != null && this.paceGraceOver(activeMs)
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
