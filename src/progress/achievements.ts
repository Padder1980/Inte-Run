// Achievements / personal bests.
//
// Given activities (with optional splits), compute best efforts for standard distances and detect
// new records against the athlete's prior bests. With splits, a sliding window finds the fastest
// contiguous span of the target distance (interpolating the final split for accuracy). Without
// splits, only a whole-activity effort at (approximately) the target distance counts.

import type { Achievement, AchievementKind, Activity } from "../domain/types.ts";
import { RACE_DISTANCES_M } from "../domain/units.ts";

const DISTANCE_KINDS: Array<{ kind: AchievementKind; meters: number }> = [
  { kind: "fastest-1k", meters: 1000 },
  { kind: "fastest-1mile", meters: RACE_DISTANCES_M["1mile"] },
  { kind: "fastest-5k", meters: RACE_DISTANCES_M["5k"] },
  { kind: "fastest-10k", meters: RACE_DISTANCES_M["10k"] },
  { kind: "fastest-half", meters: RACE_DISTANCES_M.half },
  { kind: "fastest-marathon", meters: RACE_DISTANCES_M.marathon },
];

/** Best time (s) to cover `distanceMeters` within a single activity, or undefined if not possible. */
export function bestEffort(activity: Activity, distanceMeters: number): number | undefined {
  if (activity.distanceMeters + 1e-6 < distanceMeters) return undefined;

  if (!activity.splits || activity.splits.length === 0) {
    // No splits: only trust a whole-activity effort at ~ the target distance (±1%).
    if (Math.abs(activity.distanceMeters - distanceMeters) <= distanceMeters * 0.01) {
      return activity.movingTimeSeconds;
    }
    return undefined;
  }

  const splits = activity.splits;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < splits.length; i++) {
    let dist = 0;
    let time = 0;
    for (let j = i; j < splits.length; j++) {
      const seg = splits[j]!;
      if (dist + seg.distanceMeters >= distanceMeters) {
        const need = distanceMeters - dist;
        const frac = seg.distanceMeters > 0 ? need / seg.distanceMeters : 1;
        time += seg.timeSeconds * frac;
        best = Math.min(best, time);
        break;
      }
      dist += seg.distanceMeters;
      time += seg.timeSeconds;
    }
  }
  return Number.isFinite(best) ? Math.round(best) : undefined;
}

export type BestsMap = Partial<Record<AchievementKind, number>>;

export type AchievementResult = {
  achievements: Achievement[];
  bests: BestsMap;
};

/**
 * Detect new PBs across `activities` versus `priorBests`. A new time PB must be strictly faster;
 * a longest-run PB strictly longer. Ties are not counted.
 */
export function detectAchievements(
  activities: Activity[],
  priorBests: BestsMap = {},
): AchievementResult {
  const bests: BestsMap = { ...priorBests };
  const achievements: Achievement[] = [];

  for (const activity of activities) {
    for (const { kind, meters } of DISTANCE_KINDS) {
      const effort = bestEffort(activity, meters);
      if (effort === undefined) continue;
      const prior = bests[kind];
      if (prior === undefined || effort < prior) {
        bests[kind] = effort;
        achievements.push({
          kind,
          valueSeconds: effort,
          activityId: activity.id,
          dateIso: activity.dateIso,
        });
      }
    }
    const prevLongest = bests["longest-run"];
    if (prevLongest === undefined || activity.distanceMeters > prevLongest) {
      bests["longest-run"] = Math.round(activity.distanceMeters);
      achievements.push({
        kind: "longest-run",
        valueMeters: Math.round(activity.distanceMeters),
        activityId: activity.id,
        dateIso: activity.dateIso,
      });
    }
  }

  return { achievements, bests };
}
