// Runner classification (brief §11). The brief insists research findings don't transfer
// indiscriminately between untrained adults, recreational runners, trained runners and elites, and
// points to the six-tier McKay framework. We keep those tiers under the hood (for evidence tagging)
// but present a plain, encouraging "runner type" — and we're honest that the top tiers (elite /
// world-class) are defined by competitive standard, not something an app can self-assign.

/** McKay participant-classification tiers (1 = sedentary … 6 = world class). */
export type RunnerTier = 1 | 2 | 3 | 4 | 5 | 6;

export type ClassificationInput = {
  runsPerWeek: number;
  yearsRunning: number;
  weeklyVolumeKm?: number;
  /** Optional recent 5k time (seconds) to refine the estimate. */
  recent5kSeconds?: number;
  sex?: "female" | "male";
};

export type Classification = {
  tier: RunnerTier;
  /** McKay tier name, for evidence tagging / the science view. */
  tierName: string;
  /** Plain, friendly label for the user. */
  label: string;
  description: string;
  /** What this means for how the app plans your training. */
  meaning: string;
  note?: string;
};

const TIER_NAME: Record<RunnerTier, string> = {
  1: "Sedentary",
  2: "Recreationally active",
  3: "Trained / developmental",
  4: "Highly trained / national",
  5: "Elite / international",
  6: "World class",
};

const PLAIN: Record<number, { label: string; description: string; meaning: string }> = {
  1: {
    label: "Just getting started",
    description: "New to running or coming to it fresh.",
    meaning: "Plans begin with easy running and walk-run, building the habit before anything hard.",
  },
  2: {
    label: "Recreational runner",
    description: "You run regularly for fitness and enjoyment.",
    meaning: "Plans build consistency first — the biggest win at this stage — with one gentle quality session.",
  },
  3: {
    label: "Trained runner",
    description: "You train with structure and have a few years in your legs.",
    meaning: "You can handle structured training with regular quality sessions and steady volume.",
  },
  4: {
    label: "Highly trained runner",
    description: "You train seriously, at high volume, and race competitively.",
    meaning: "You can absorb higher volume and two quality sessions a week, dosed with care.",
  },
};

/** Fast-ish 5k thresholds (seconds) used only to refine the tier upward. */
function performanceTier(seconds: number, female: boolean): RunnerTier | 0 {
  if (seconds < (female ? 1140 : 990)) return 4; // ~sub-19:00 (f) / sub-16:30 (m)
  if (seconds < (female ? 1350 : 1200)) return 3; // ~sub-22:30 (f) / sub-20:00 (m)
  return 0;
}

export function classifyRunner(input: ClassificationInput): Classification {
  const rpw = input.runsPerWeek;
  const vol = input.weeklyVolumeKm ?? 0;
  const yrs = input.yearsRunning;

  let tier: RunnerTier = rpw <= 0 ? 1 : 2;
  if (rpw >= 4 && yrs >= 1 && (vol === 0 || vol >= 25)) tier = 3;
  if (rpw >= 6 && yrs >= 3 && vol >= 64) tier = 4;

  if (input.recent5kSeconds) {
    const pt = performanceTier(input.recent5kSeconds, input.sex === "female");
    if (pt !== 0 && pt > tier) tier = pt;
  }

  const plain = PLAIN[tier] ?? PLAIN[2]!;
  const note =
    tier >= 4
      ? "The very top tiers (elite, world-class) are defined by international competitive standard, so we cap self-assessment here — the training principles are what matter."
      : undefined;

  return {
    tier,
    tierName: TIER_NAME[tier],
    label: plain.label,
    description: plain.description,
    meaning: plain.meaning,
    note,
  };
}
