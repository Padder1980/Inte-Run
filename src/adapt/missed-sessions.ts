// Missed-session adaptation.
//
// Rule from the brief: if the athlete misses two sessions in a row, get them back on track — do NOT
// cram the missed work on top. The adjustment eases the upcoming week (drop the hardest session,
// trim the long run and easy volume) so re-entry is gentle, then normal progression resumes.

import type { PlannedWeek, Session, SessionOutcome } from "../domain/types.ts";
import { scaleSessionDistance, weekVolumeMeters } from "../domain/steps.ts";

export type MissedSessionResult = {
  triggered: boolean;
  changes: string[];
  week: PlannedWeek;
};

/** Number of consecutive not-completed outcomes at the end of the log. */
export function countTrailingMisses(outcomes: SessionOutcome[]): number {
  let n = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i]!.completed) break;
    n++;
  }
  return n;
}

const EASY_SCALE = 0.85;
const LONG_SCALE = 0.8;
const HARDNESS = { vo2: 3, "race-specific": 2, threshold: 1 } as const;

export function applyMissedSessionAdjustment(
  week: PlannedWeek,
  outcomes: SessionOutcome[],
): MissedSessionResult {
  const misses = countTrailingMisses(outcomes);
  if (misses < 2) {
    return { triggered: false, changes: [], week };
  }

  const changes: string[] = [];
  const easyPace = findEasyPace(week);

  // Demote the single hardest quality session to an easy run (no cramming, gentle re-entry).
  const hardestId = hardestSessionId(week);
  const sessions: Session[] = week.sessions.map((s) => {
    if (s.id === hardestId) {
      changes.push(`Replaced "${s.title}" with an easy run to ease back in after missed sessions.`);
      const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.7) || 35;
      return {
        ...s,
        type: "easy",
        title: `${minutes}′ easy (eased re-entry)`,
        description: "Reintroduce running gently after a break — quality resumes next week.",
        intensity: "easy",
        estimatedDurationSeconds: minutes * 60,
        estimatedDistanceMeters: easyPace
          ? Math.round(((minutes * 60) / easyPace) * 1000)
          : s.estimatedDistanceMeters,
        // ⚠️ The replacement is a single steady step — no warm-up, no cool-down — so all of it is
        // training. Inheriting the demoted session's `trainingDistanceMeters` would leave the week
        // counting a workout that is no longer prescribed.
        trainingDistanceMeters: easyPace
          ? Math.round(((minutes * 60) / easyPace) * 1000)
          : s.trainingDistanceMeters,
        steps: [
          {
            kind: "steady",
            label: "Conversational easy running",
            durationSeconds: minutes * 60,
            targetRpe: { min: 2, max: 3 },
          },
        ],
        targetRpe: { min: 2, max: 3 },
      };
    }
    if (s.type === "long") {
      return {
        ...scaleSessionDistance(s, LONG_SCALE),
        estimatedDurationSeconds: Math.round(s.estimatedDurationSeconds * LONG_SCALE),
      };
    }
    if (s.intensity === "easy") {
      return {
        ...scaleSessionDistance(s, EASY_SCALE),
        estimatedDurationSeconds: Math.round(s.estimatedDurationSeconds * EASY_SCALE),
      };
    }
    return s;
  });

  changes.push(
    "Trimmed the long run ~20% and easy volume ~15% this week; missed sessions are not added back.",
  );

  const plannedDistanceMeters = weekVolumeMeters(sessions);
  const qualitySessionCount = sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  return {
    triggered: true,
    changes,
    week: {
      ...week,
      sessions,
      plannedDistanceMeters,
      qualitySessionCount,
      focus: "Re-entry — ease back after missed sessions",
    },
  };
}

function hardestSessionId(week: PlannedWeek): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const s of week.sessions) {
    const score = (HARDNESS as Record<string, number>)[s.type] ?? 0;
    if (score > 0 && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best?.id;
}

/** Seconds-per-km of an easy step already present in the week, for rebuilding a demoted session. */
function findEasyPace(week: PlannedWeek): number | undefined {
  for (const s of week.sessions) {
    if (s.intensity !== "easy") continue;
    for (const step of s.steps) {
      if (step.targetPaceSecPerKm) {
        return (step.targetPaceSecPerKm.minSecPerKm + step.targetPaceSecPerKm.maxSecPerKm) / 2;
      }
    }
  }
  return undefined;
}
