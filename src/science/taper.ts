// Taper design.
//
// Evidence (2023 taper meta-analysis + the 2026 deep-research report): reduce volume by ~41–60%
// while maintaining intensity and broadly maintaining training frequency. Duration scales with race
// distance: 5K/10K/half ≈ 7–14 days, marathon ≈ 14–21 days.
//
// ⚠️ TAPER WEEKS ARE MONDAY-ALIGNED AND THE LAST ONE IS RACE WEEK, so a one-week taper is NOT seven
// days — it is however many days of race week precede the race: six for a Sunday race, ZERO for a
// Monday one. The 5K and 10K shipped with weeks: 1 for months, which measured as 0–6 days of easing
// against the report's 7–14, and the week before the race ran at within 1% of peak volume. An elite
// coach's verdict was "the taper is not really a taper for a 10km", and he was right on any weekday.
// Two Monday-aligned weeks give 7 + raceDow days: 7–13, inside the window on every weekday.

import type { RaceDistanceKey } from "../domain/types.ts";

export type TaperPlan = {
  weeks: number;
  /** Fraction of peak weekly volume to run in each taper week (last entry = race week). */
  volumeMultiplierByWeek: number[];
  notes: string[];
};

const TAPERS: Record<RaceDistanceKey, TaperPlan> = {
  "1mile": {
    weeks: 1,
    volumeMultiplierByWeek: [0.6],
    notes: ["Short, sharp taper — keep speed, cut volume ~40%."],
  },
  "5k": {
    weeks: 2,
    volumeMultiplierByWeek: [0.72, 0.58],
    notes: ["~7–14 day taper; retain VO2 touches while volume falls ~28% then ~42%."],
  },
  "10k": {
    weeks: 2,
    volumeMultiplierByWeek: [0.72, 0.55],
    notes: ["~7–14 day taper; keep threshold/VO2 intensity while volume falls ~28% then ~45%."],
  },
  half: {
    weeks: 2,
    volumeMultiplierByWeek: [0.7, 0.55],
    notes: ["~7–14 day taper; hold threshold intensity while volume falls ~30% then ~45%."],
  },
  marathon: {
    weeks: 3,
    volumeMultiplierByWeek: [0.8, 0.65, 0.5],
    notes: [
      "~14–21 day taper; progressively cut volume to ~50% of peak, keep marathon-pace touches.",
    ],
  },
};

export function taperFor(distance: RaceDistanceKey): TaperPlan {
  return TAPERS[distance];
}

/** Peak-volume reduction achieved by race week, as a percentage (for reporting). */
export function taperVolumeReductionPct(distance: RaceDistanceKey): number {
  const t = TAPERS[distance];
  const last = t.volumeMultiplierByWeek[t.volumeMultiplierByWeek.length - 1] ?? 0.6;
  return Math.round((1 - last) * 100);
}
