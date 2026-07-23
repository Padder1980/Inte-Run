// Injury adaptation.
//
// The athlete reports an injury (region, severity, whether it hurts while running, and whether bone
// stress is suspected). The engine maps that to an action — pause, reduce, cross-train or monitor —
// and rewrites the upcoming weeks accordingly. It is deliberately conservative: severe or suspected
// bone-stress injuries stop running entirely and advise assessment; running through pain is never
// recommended. This is decision-support, not medical advice.

import type { InjuryAssessment, InjuryReport, PlannedWeek, Session } from "../domain/types.ts";
import { crossTraining, easyRun, restDay } from "../plan/session-templates.ts";
import type { TrainingPaces } from "../domain/types.ts";

export function assessInjury(report: InjuryReport): InjuryAssessment {
  const guidance: string[] = [];

  if (report.severity === "severe" || report.boneStressSuspected) {
    guidance.push(
      report.boneStressSuspected
        ? "Suspected bone stress: stop running and seek a professional assessment before resuming."
        : "Severe injury: stop running and seek assessment.",
    );
    guidance.push(
      "Pain-free cross-training (pool, bike) may maintain fitness if a clinician agrees.",
    );
    return { action: "pause", pauseDays: 10, intensityScale: 0, volumeScale: 0, guidance };
  }

  if (report.severity === "moderate" || report.painWhileRunning) {
    guidance.push("Cut out all hard running; keep only easy volume you can run pain-free.");
    guidance.push("Substitute cross-training for harder sessions and progress back gradually.");
    if (report.painWhileRunning) {
      guidance.push(
        "If it hurts while running, stop — pain during a run is a stop signal, not a niggle.",
      );
    }
    return { action: "reduce", pauseDays: 0, intensityScale: 0, volumeScale: 0.5, guidance };
  }

  // niggle, pain-free while running
  guidance.push("Drop the hardest session and keep easy running you can do without symptoms.");
  guidance.push("Monitor for any delayed increase in symptoms over the following day.");
  return { action: "monitor", pauseDays: 0, intensityScale: 0.5, volumeScale: 0.85, guidance };
}

export type InjuryAdjustmentResult = {
  assessment: InjuryAssessment;
  changes: string[];
  weeks: PlannedWeek[];
};

/**
 * Rewrite the next `affectedWeeks` weeks (from `fromIndex`) per the assessment. `paces` is used to
 * build replacement easy/cross-training sessions.
 */
export function applyInjuryAdjustment(
  weeks: PlannedWeek[],
  fromIndex: number,
  report: InjuryReport,
  paces: TrainingPaces,
  affectedWeeks = 2,
): InjuryAdjustmentResult {
  const assessment = assessInjury(report);
  const changes: string[] = [];
  const isRunning = (s: Session) =>
    s.estimatedDistanceMeters !== undefined && s.type !== "strength";
  const isHard = (s: Session) =>
    s.intensity === "hard" || s.type === "threshold" || s.type === "race-specific";

  const out = weeks.map((week) => {
    if (week.index < fromIndex || week.index >= fromIndex + affectedWeeks) return week;

    let sessions: Session[];
    if (assessment.action === "pause") {
      sessions = week.sessions.map((s) => {
        if (!isRunning(s)) return s;
        // Replace running with pain-free cross-training (kept low), or rest for hard days.
        if (isHard(s)) return finalizeReplacement(restDay(), s);
        const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.6) || 20;
        return finalizeReplacement(crossTraining(minutes), s);
      });
      changes.push(
        `Week ${week.index}: running paused; hard sessions → rest, easy running → light cross-training.`,
      );
    } else if (assessment.action === "reduce") {
      sessions = week.sessions.map((s) => {
        if (isHard(s)) {
          const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.6) || 30;
          return finalizeReplacement(crossTraining(minutes), s);
        }
        if (isRunning(s)) {
          return {
            ...s,
            estimatedDurationSeconds: Math.round(
              s.estimatedDurationSeconds * assessment.volumeScale,
            ),
            estimatedDistanceMeters: s.estimatedDistanceMeters
              ? Math.round(s.estimatedDistanceMeters * assessment.volumeScale)
              : undefined,
          };
        }
        return s;
      });
      changes.push(
        `Week ${week.index}: hard sessions → cross-training; easy volume cut to ${Math.round(assessment.volumeScale * 100)}%.`,
      );
    } else {
      // monitor: drop the single hardest, keep the rest.
      const hardestId = week.sessions.filter(isHard).sort(byHardness)[0]?.id;
      sessions = week.sessions.map((s) => {
        if (s.id !== hardestId) return s;
        const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.7) || 35;
        return finalizeReplacement(easyRun(paces, minutes), s);
      });
      changes.push(
        `Week ${week.index}: hardest session replaced with an easy run while monitoring the niggle.`,
      );
    }

    if (
      (report.region === "knee" || report.region === "achilles") &&
      assessment.action !== "pause"
    ) {
      changes.push(
        "Load-sensitive site (knee/Achilles): reintroduce faster work only once it settles without a delayed reaction.",
      );
    }

    const plannedDistanceMeters = Math.round(
      sessions.reduce((m, s) => m + (s.estimatedDistanceMeters ?? 0), 0),
    );
    const qualitySessionCount = sessions.filter(
      (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
    ).length;
    return {
      ...week,
      sessions,
      plannedDistanceMeters,
      qualitySessionCount,
      focus: `Injury-adjusted (${assessment.action})`,
    };
  });

  return { assessment, changes, weeks: out };
}

function byHardness(a: Session, b: Session): number {
  const rank = (s: Session) =>
    s.type === "vo2" ? 3 : s.type === "race-specific" ? 2 : s.type === "threshold" ? 1 : 0;
  return rank(b) - rank(a);
}

function finalizeReplacement(
  content: Omit<Session, "id" | "dayOfWeek" | "source">,
  original: Session,
): Session {
  return { ...content, id: original.id, dayOfWeek: original.dayOfWeek, source: "generated" };
}
