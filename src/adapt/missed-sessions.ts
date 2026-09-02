// Easing a week: the one definition, with two callers.
//
// Rule from the brief: if the athlete misses two sessions in a row, get them back on track — do NOT
// cram the missed work on top. The adjustment eases the upcoming week (drop the hardest session,
// trim the long run and easy volume) so re-entry is gentle, then normal progression resumes.
//
// ⚠️ AND THE SAME SHAPE IS WHAT HUDSON'S ch7 PRESCRIBES FOR A RUNNER WHO WANTS AN EASIER WEEK ON
// DEMAND: "they can just take a day off or REPLACE A HARD RUN WITH AN EASY RUN as necessary". So
// `easeWeek` is the mechanism and the two callers differ only in what triggered it — `applyMissedSessionAdjustment`
// owns the two-misses gate, and the app's own "make a week easier" control asks for it directly.
// ⚠️ THE GATE BELONGS TO THE CALLER, NOT TO THE MECHANISM. Written the other way round, a runner-
// initiated easier week would have to fake two missed sessions to get one — lying to the function to
// get the behaviour, and the wording ("after missed sessions") would then be false on screen.
//
// ⚠️ IT SUBSTITUTES; IT NEVER DELETES, and that is the whole reason it exists. Every level the app
// could already offer is a FILTER (`adjDrops`), so the shallowest easing a runner could reach took
// 57% off their week when a scheduled recovery week takes 25%. Measured, this takes 20-21% — inside
// the book's own "20-to 30-percent reduction in mileage" — and leaves the session COUNT unchanged.

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

/** Why a week is being eased. Decides the wording only — the arithmetic is identical. */
export type EaseReason = "missed" | "chosen";

export function applyMissedSessionAdjustment(
  week: PlannedWeek,
  outcomes: SessionOutcome[],
): MissedSessionResult {
  const misses = countTrailingMisses(outcomes);
  if (misses < 2) {
    return { triggered: false, changes: [], week };
  }
  return easeWeek(week, "missed");
}

/**
 * Take roughly a fifth out of one week by SUBSTITUTING its hardest session for an easy run and
 * trimming the long run and the easy volume. The session count does not change.
 *
 * ⚠️ `triggered` IS FALSE WHEN THERE WAS NOTHING TO EASE, and the caller must honour that rather than
 * reporting success. A rest week, or a week whose only sessions are strength and mobility, has no
 * hardest session, no long run and no easy running — so nothing changes and telling the runner their
 * week is now easier would be false.
 * ⚠️ THE GOAL RACE IS NEVER DEMOTED. `HARDNESS` scores only threshold/vo2/race-specific, so
 * `hardestSessionId` cannot pick it, and a `race` session matches none of the branches below and is
 * returned untouched — the same rule `adjDrops` keeps for the app's own levels.
 */
export function easeWeek(week: PlannedWeek, reason: EaseReason = "chosen"): MissedSessionResult {
  const changes: string[] = [];
  const easyPace = findEasyPace(week);

  // Demote the single hardest quality session to an easy run (no cramming, gentle re-entry).
  const hardestId = hardestSessionId(week);
  const sessions: Session[] = week.sessions.map((s) => {
    if (s.id === hardestId) {
      changes.push(
        reason === "missed"
          ? `Replaced "${s.title}" with an easy run to ease back in after missed sessions.`
          : `Swapped "${s.title}" for an easy run of about the same effort as the rest of the week.`,
      );
      const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.7) || 35;
      return {
        ...s,
        type: "easy",
        // ⚠️ THE TITLE AND THE DESCRIPTION VARY BY REASON TOO, and this was found by driving the real
        // control rather than the function: a runner who chose an easier week was handed a session
        // called "31′ easy (eased re-entry)" when they had missed nothing. A derived string that does
        // not follow its own reason is the stale-derived-fact trap, and it is the text the runner reads.
        title: reason === "missed"
          ? `${minutes}′ easy (eased re-entry)`
          : `${minutes}′ easy (easier week)`,
        description: reason === "missed"
          ? "Reintroduce running gently after a break — quality resumes next week."
          : "An easier week by choice — keep it conversational. Normal training resumes next week.",
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
    reason === "missed"
      ? "Trimmed the long run ~20% and easy volume ~15% this week; missed sessions are not added back."
      : "Trimmed the long run ~20% and easy volume ~15% this week. Next week picks up where it left off.",
  );

  const plannedDistanceMeters = weekVolumeMeters(sessions);
  const qualitySessionCount = sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  // ⚠️ NOTHING CHANGED MEANS NOTHING CHANGED. A rest week or a strength-and-mobility-only week has no
  // hardest session, no long run and no easy running, so every branch above returned the session
  // untouched — and `triggered: true` there would put "this week is easier now" over an identical week.
  const moved = sessions.some((s, i) => s !== week.sessions[i]);
  if (!moved) return { triggered: false, changes: [], week };

  return {
    triggered: true,
    changes,
    week: {
      ...week,
      sessions,
      plannedDistanceMeters,
      qualitySessionCount,
      focus: reason === "missed"
        ? "Re-entry — ease back after missed sessions"
        : "Easier week — volume down, nothing added back",
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
