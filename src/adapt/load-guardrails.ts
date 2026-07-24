// Training-load guardrails (brief §5). Plain-English injury-risk signals, framed as signals — not
// commandments. Includes the specific 2025 finding the brief highlights: a single run more than ~10%
// longer than your longest run in the past 30 days is associated with higher lower-limb injury risk.
// The brief is emphatic this is "one observational model … not a commandment carved into a Garmin",
// so the wording stays advisory.

export type LongRunSpike = {
  withinComfort: boolean;
  /** How much longer the planned run is vs the recent longest, as a percentage. */
  overPct: number;
  suggestedCapKm: number;
  message: string;
  note: string;
};

/** Compare a planned long run to the longest run of the past ~30 days. */
export function assessLongRunSpike(input: {
  plannedLongestRunKm: number;
  longestRunLast30dKm: number;
}): LongRunSpike {
  const planned = input.plannedLongestRunKm;
  const recent = input.longestRunLast30dKm;
  if (recent <= 0) {
    return {
      withinComfort: true,
      overPct: 0,
      suggestedCapKm: Math.round(planned * 10) / 10,
      message: "No recent long run to compare against.",
      note: "Build your long run up gradually over the coming weeks rather than jumping straight to a big one.",
    };
  }
  const overPct = Math.round((planned / recent - 1) * 100);
  const cap = Math.round(recent * 1.1 * 10) / 10;
  if (planned > recent * 1.1) {
    return {
      withinComfort: false,
      overPct,
      suggestedCapKm: cap,
      message: `That's about ${overPct}% longer than your longest run in the past month.`,
      note: `Big single-run jumps are linked to higher injury risk. Consider capping around ${cap} km this time and building from there. It's a signal, not a hard rule.`,
    };
  }
  return {
    withinComfort: true,
    overPct,
    suggestedCapKm: Math.round(planned * 10) / 10,
    message: "In line with your recent long runs.",
    note: "Nice steady progression — this is how durability is built.",
  };
}

export type WeeklyJump = { withinComfort: boolean; jumpPct: number; message: string };

/** A gentle week-on-week volume check — a large jump warrants easing the increase. */
export function assessWeeklyJump(input: { plannedWeekKm: number; lastWeekKm: number }): WeeklyJump {
  const { plannedWeekKm: p, lastWeekKm: w } = input;
  if (w <= 0) {
    return { withinComfort: true, jumpPct: 0, message: "No recent week to compare against — build up gently." };
  }
  const jumpPct = Math.round((p / w - 1) * 100);
  if (p > w * 1.3) {
    return {
      withinComfort: false,
      jumpPct,
      message: `This week is about ${jumpPct}% more than last week — a big jump. Easing the increase can lower injury risk.`,
    };
  }
  return { withinComfort: true, jumpPct, message: "A sensible week-on-week change." };
}

export type ReturnStage = { label: string; detail: string };

export type ReturnToRunning = {
  canStart: boolean;
  seeProfessionalFirst: boolean;
  message: string;
  stages: ReturnStage[];
  note: string;
};

/**
 * Conservative return-to-running guidance after time off. The principle from the brief: the heart
 * and lungs recover faster than tendons and bone, so ease back gradually. Anything involving a bone
 * or joint injury, or pain that isn't settling, is routed to a professional first — not run through.
 */
export function returnToRunningPlan(input: {
  weeksOff: number;
  painFreeWalking: boolean;
  boneOrJointInjury?: boolean;
}): ReturnToRunning {
  if (!input.painFreeWalking || input.boneOrJointInjury) {
    return {
      canStart: false,
      seeProfessionalFirst: true,
      message:
        "Get comfortable, pain-free walking first — and if this involved a bone or joint injury, get the all-clear from a professional before running.",
      stages: [],
      note: "Connective tissue and bone recover more slowly than your heart and lungs, so there's no rush.",
    };
  }
  const longLayoff = input.weeksOff >= 4;
  const stages: ReturnStage[] = [
    { label: "Start", detail: "Walk-run: 1 min easy jog / 2 min walk, repeated 6–8 times, every other day." },
    { label: "Next", detail: "Even it up: 2 min jog / 1 min walk, 6–8 times, every other day." },
    { label: "Then", detail: "Continuous easy runs of 15–25 min, 3–4 times a week — all easy." },
    { label: "Building", detail: "Rebuild easy volume first, add gentle strides, then reintroduce one quality session." },
  ];
  return {
    canStart: true,
    seeProfessionalFirst: false,
    message: longLayoff
      ? "You can ease back in with walk-run — take it slower given the longer break."
      : "You can ease back in with walk-run.",
    stages,
    note: "Keep everything easy and stop if pain returns. Build volume before intensity.",
  };
}
