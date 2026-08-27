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

//
// ⚠️⚠️ THE LEAD-IN MULTIPLIERS WERE DEEPENED ON 2026-08-27 BECAUSE THE TAPER NOW HOLDS ITS
// SPECIFICITY, AND THE TWO CHANGES ARE ONE CHANGE. `qualityContentsFor`'s taper branch used to push
// one hardcoded `vo2-10x1` for every distance — so a marathon runner who had spent a block building
// goal-pace work got one-minute VO2 reps for their final fortnight, and measured with the engine's
// own `computeDistribution`, **0 of 120 taper weeks contained any threshold or race-specific work**
// while the notes below promised "keep marathon-pace touches" and "hold threshold intensity". The
// taper now draws what the peak phase would have drawn, at a reduced dose.
//
// That session is bigger than the one it replaced — for a half, `race-3x10` against `vo2-10x1` is
// about 24 extra minutes in that week — so the week's delivered CUT shrank, and the half fell to
// **29.1%** against the 30% floor `test/generate-plan.test.ts` asserts. The evidence resolves the
// tension explicitly rather than leaving it: volume falls 41-60% while frequency and intensity are
// MAINTAINED, and "the volume cut comes entirely out of Z1-Z3". So the easy and long runs give way
// to make room for the held quality, which is what deepening these multipliers does.
//
// Swept on the test's own fixture (5 days, 21:00 5 km, recreational), last full taper week:
//     5k        0.66 -> 32.2%   0.62 -> 35.7%   0.60 -> 37.4%   0.58 -> 39.1%
//     10k       0.72 -> 34.7%   0.68 -> 37.2%   0.66 -> 39.2%   0.64 -> 40.7%
//     half      0.70 -> 29.1%   0.66 -> 32.1%   0.64 -> 33.3%   0.62 -> 35.5%
//     marathon  0.65 -> 31.9%   0.62 -> 34.5%   0.60 -> 36.3%   0.58 -> 38.0%
//
// ⚠️ THE PICK IS THE SHALLOWEST VALUE CLEARING 33% **THAT IS STILL SHALLOWER THAN RACE WEEK**. Both
// halves matter. The 33% is the 30% floor plus three points of margin, for the reason recorded above
// about 0.4 points of headroom being one keystroke from somebody relaxing the floor instead. And the
// lead-in must stay above the race-week multiplier or the taper stops being progressive — a flat
// taper is the "step" the meta-analysis found worse than a progressive one (SMD -0.51). The 5k at
// 0.58 would have tied its own race week exactly, which is why it is 0.62.
//
// ⚠️ THE 10K IS DELIBERATELY UNCHANGED at 0.72: it already delivers 34.7%, so deepening it would be
// a change with no defect behind it.

//
// ⚠️ THE PERCENTAGES IN THESE NOTES NOW DESCRIBE THE DELIVERED CUT FOR THE TAPER WEEKS BEFORE RACE
// WEEK, AND NOTHING ELSE. They used to quote the multiplier's own arithmetic — 1 − 0.72 = "~28%" —
// which is not what the week falls by, because the multiplier reaches only the easy and long runs
// while the quality session keeps its own length: measured, the 10k's 0.72 delivers 35%, not 28%.
// And the second figure was worse than approximate. RACE WEEK CONTAINS THE RACE, so its
// `plannedDistanceMeters` includes 21.1 km or 42.2 km of it — measured, the half's race week reads a
// 28% cut and the marathon's reads **−0%**, so a note promising "~45%" there was describing a
// quantity nobody can observe. Race week's size is the race; there is no useful cut to quote.

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
    volumeMultiplierByWeek: [0.62, 0.58],
    notes: ["~7–14 day taper; retain VO2 touches while the week before race week falls ~36%."],
  },
  "10k": {
    weeks: 2,
    volumeMultiplierByWeek: [0.72, 0.55],
    notes: ["~7–14 day taper; keep threshold/VO2 intensity while the week before race week falls ~35%."],
  },
  half: {
    weeks: 2,
    volumeMultiplierByWeek: [0.64, 0.55],
    notes: ["~7–14 day taper; hold threshold intensity while the week before race week falls ~33%."],
  },
  marathon: {
    weeks: 3,
    volumeMultiplierByWeek: [0.8, 0.62, 0.5],
    notes: [
      "~14–21 day taper; volume falls ~20% then ~34% into race week, keep marathon-pace touches.",
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
