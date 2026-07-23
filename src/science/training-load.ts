// Simple, transparent training-load model used by the adaptation logic.
//
// Session load ≈ duration (minutes) × an intensity weight (a session-RPE-style estimate). This is a
// deliberately simple proxy — enough to compare weeks and to avoid piling load onto a struggling
// athlete — not a physiological model.

import type { IntensityBucket, PlannedWeek, Session, SessionType } from "../domain/types.ts";

const INTENSITY_WEIGHT: Record<IntensityBucket, number> = {
  none: 0,
  easy: 1,
  moderate: 2,
  hard: 3,
};

const TYPE_WEIGHT_OVERRIDE: Partial<Record<SessionType, number>> = {
  strength: 1.5,
  mobility: 0.4,
  "cross-training": 0.8,
  rest: 0,
};

export function sessionLoad(session: Session): number {
  const minutes = session.estimatedDurationSeconds / 60;
  const weight = TYPE_WEIGHT_OVERRIDE[session.type] ?? INTENSITY_WEIGHT[session.intensity];
  return Math.round(minutes * weight);
}

export function weekLoad(week: PlannedWeek): number {
  return week.sessions.reduce((sum, s) => sum + sessionLoad(s), 0);
}

/** Rolling average of the most recent `windowWeeks` weekly loads (chronic-load proxy). */
export function rollingLoad(weeklyLoads: number[], windowWeeks = 4): number {
  if (weeklyLoads.length === 0) return 0;
  const window = weeklyLoads.slice(-windowWeeks);
  return Math.round(window.reduce((a, b) => a + b, 0) / window.length);
}
