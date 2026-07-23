// RED-S / low-energy-availability screen (brief §7, IOC 2023 consensus). Relative Energy Deficiency
// in Sport is impaired functioning caused by too little energy to cover training plus daily needs;
// it affects all athletes and can harm bone, hormonal, immune and mental health. This is a screen
// that flags risk and refers — it is not a diagnosis, and the app never sets weight-loss targets.

import { type Professional, type Urgency, NOT_A_DIAGNOSIS } from "./common.ts";

/** Indicators associated with low energy availability. Strong indicators carry more weight. */
export type RedSIndicator =
  | "unintentional-weight-loss"
  | "restrictive-or-skipped-meals"
  | "preoccupation-with-food-or-weight"
  | "menstrual-disruption"
  | "low-libido"
  | "recurrent-illness"
  | "bone-stress-history"
  | "poor-recovery"
  | "low-mood-or-irritability"
  | "always-feeling-cold"
  | "gi-discomfort"
  | "persistent-fatigue";

const STRONG: ReadonlySet<RedSIndicator> = new Set([
  "unintentional-weight-loss",
  "restrictive-or-skipped-meals",
  "menstrual-disruption",
  "bone-stress-history",
]);

export type RedSRisk = "low" | "moderate" | "high";

export type RedSResult = {
  risk: RedSRisk;
  urgency: Urgency;
  score: number;
  strongCount: number;
  message: string;
  guidance: string[];
  refer: Professional[];
  disclaimer: string;
};

/**
 * Screen self-reported indicators. Any elevated result refers on — energy availability is not
 * something to self-manage by eating less. Deliberately conservative: a single strong indicator is
 * enough to move off "low".
 */
export function screenRedS(indicators: RedSIndicator[]): RedSResult {
  const unique = [...new Set(indicators)];
  const strongCount = unique.filter((i) => STRONG.has(i)).length;
  const score = unique.reduce((sum, i) => sum + (STRONG.has(i) ? 2 : 1), 0);

  let risk: RedSRisk;
  if (strongCount >= 2 || score >= 5) risk = "high";
  else if (strongCount >= 1 || score >= 2) risk = "moderate";
  else risk = "low";

  const elevated = risk !== "low";
  const guidance: string[] = [];
  if (elevated) {
    guidance.push(
      "Fuelling enough — especially carbohydrate — around training is the priority; under-eating is not a shortcut to performance.",
    );
    guidance.push(
      "Under-eating is not the answer here — if anything you likely need more fuel, guided by a professional.",
    );
    if (unique.includes("bone-stress-history") || unique.includes("menstrual-disruption")) {
      guidance.push("Bone and hormonal health can be affected by low energy availability — worth raising explicitly at your review.");
    }
  } else {
    guidance.push("Keep fuelling consistently around training and re-check if things change.");
  }

  return {
    risk,
    urgency: risk === "high" ? "professional" : risk === "moderate" ? "professional" : "monitor",
    score,
    strongCount,
    message:
      risk === "high"
        ? "Several signs point to possible low energy availability. Please arrange a review soon."
        : risk === "moderate"
          ? "Some signs suggest your fuelling may be worth reviewing with a professional."
          : "No strong signs of low energy availability from what you reported.",
    guidance,
    refer: elevated ? ["sports-dietitian", "sports-physician"] : [],
    disclaimer: NOT_A_DIAGNOSIS,
  };
}

export type EnergyAvailabilityBand = "low" | "reduced" | "adequate";

export type EnergyAvailabilityEstimate = {
  eaKcalPerKgFfm: number;
  band: EnergyAvailabilityBand;
  note: string;
};

/**
 * Optional education-only estimate of energy availability:
 *   EA = (intake − exercise energy expenditure) / fat-free mass, in kcal/kg FFM/day.
 * ~30 and below is commonly considered low, ~30–45 reduced, ~45+ adequate. Intake and expenditure
 * are hard to measure, so this is a rough teaching aid — never a target to drive weight down.
 */
export function estimateEnergyAvailability(input: {
  intakeKcal: number;
  exerciseEnergyKcal: number;
  fatFreeMassKg: number;
}): EnergyAvailabilityEstimate {
  if (input.fatFreeMassKg <= 0) throw new Error("fat-free mass must be positive");
  const ea = (input.intakeKcal - input.exerciseEnergyKcal) / input.fatFreeMassKg;
  const rounded = Math.round(ea * 10) / 10;
  const band: EnergyAvailabilityBand = ea < 30 ? "low" : ea < 45 ? "reduced" : "adequate";
  const note =
    band === "low"
      ? "Below ~30 kcal/kg FFM/day is commonly considered low. This is an estimate — please review fuelling with a sports dietitian rather than eating less."
      : band === "reduced"
        ? "Around 30–45 kcal/kg FFM/day. An estimate only; keep fuelling consistent, especially on hard days."
        : "Around 45+ kcal/kg FFM/day is generally adequate. This is a rough estimate, not a precise measurement.";
  return { eaKcalPerKgFfm: rounded, band, note };
}
