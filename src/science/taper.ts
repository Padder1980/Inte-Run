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
  // ⚠️ THE LEAD-IN WEEK IS 0.68, NOT 0.72, AND THE EASY-RUN RAMP IS WHY (2026-08-04). At 0.72 the
  // delivered cut against peak was 27.7% — under the 30% floor `test/generate-plan.test.ts` asserts,
  // and under this entry's own claim of ~28%. It passed for years only because the 5k's biggest week
  // was WEEK 3 of 31: base weeks carry fewer quality sessions, so more easy days, and easy-run length
  // was flat across the whole block, which made an early base week outweigh the entire peak phase.
  // Once easy running ramps, the peak moved to week 27 where it belongs, the denominator became 4%
  // smaller and honest, and this taper's real depth was exposed. Deepening it is the correct direction
  // — the floor is not the thing to loosen — and it sits inside the evidence window while matching the
  // depth the 10k already delivers (33%). The other three distances are unaffected: they already peaked
  // in the peak phase, and their cuts are byte-identical either way.
  //
  // ⚠️ 0.66 rather than 0.68 FOR MARGIN. Swept: 0.68 delivers a 30.4% cut against a 30.0% floor, which
  // is 0.4 points of headroom — the next change to any part of a taper week would trip it, and whoever
  // met that failure would be one keystroke from relaxing the floor instead. 0.66 delivers 32.7%.
  "5k": {
    weeks: 2,
    volumeMultiplierByWeek: [0.66, 0.58],
    notes: ["~7–14 day taper; retain VO2 touches while volume falls ~34% then ~42%."],
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
