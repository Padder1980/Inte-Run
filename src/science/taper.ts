// Taper design.
//
// Evidence (2023 taper meta-analysis, via the research brief): reduce volume by ~41–60% while
// maintaining intensity and broadly maintaining training frequency. Duration scales with race
// distance: 5–10K ≈ 5–8 days, half ≈ 7–14 days, marathon ≈ 14–21 days.

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
    weeks: 1,
    volumeMultiplierByWeek: [0.6],
    notes: ["~5–8 day taper; retain VO2 touches at low volume."],
  },
  "10k": {
    weeks: 1,
    volumeMultiplierByWeek: [0.6],
    notes: ["~5–8 day taper; keep some threshold/VO2 intensity."],
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
