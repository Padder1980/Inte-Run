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

/**
 * ⚠️ `preoccupation-with-food-or-weight` WAS NOT IN HERE AND HAD TO BE, THE MOMENT IT GOT A CHECKBOX.
 * It had none until 2026-08-10, so the path did not exist — and the day it appeared, a runner whose only
 * disclosure was distress about food, exercise or weight scored 1, came back `risk: "low"` with an empty
 * refer list, and was told nothing here points to a problem. That is reassurance this app is not
 * entitled to give about the most eating-disorder-adjacent question on the screen, and the app's OWN
 * other safety module flatly disagreed with it: `escalation.ts` grades `eating-disorder-concern` as
 * `professional` and refers to a GP, a dietitian and a psychologist. The same disclosure cannot mean
 * "see three professionals" on one screen and "nothing to worry about" on another.
 */
const STRONG: ReadonlySet<RedSIndicator> = new Set([
  "unintentional-weight-loss",
  "restrictive-or-skipped-meals",
  "preoccupation-with-food-or-weight",
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
    // ⚠️ ONE "EAT ENOUGH" LINE, NOT TWO. These were two sentences making the same point in different
    // words ("under-eating is not a shortcut to performance" / "under-eating is not the answer here"),
    // which reads as padding at the exact moment the runner is deciding whether to believe the screen.
    // The substance is unchanged and deliberately blunt — it is the one piece of genuinely
    // safety-critical guidance in the product.
    guidance.push(
      "Fuelling enough — especially carbohydrate — around training is the priority. Under-eating is not the answer here: " +
      "if anything you likely need more fuel, guided by a professional.",
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
    // ⚠️ A LOW RESULT IS NOT CLEARANCE, AND IT HAS TO SAY SO IN THE SAME BREATH. Self-reported
    // low-energy-availability screens have imperfect sensitivity (Gallant et al. 2025) — a runner who
    // has not noticed a symptom, or has stopped noticing, reads "no strong signs" as a clean bill of
    // health and stops asking the question. Naming what would change the answer is the fix.
    // ⚠️ AND THE HIGH MESSAGE MUST NAME THE TWO THINGS NOT TO DO WHILE WAITING. Left at "arrange a
    // review soon", the gap between deciding and being seen is where somebody adds a session or eats
    // less to feel in control of it.
    message:
      risk === "high"
        ? "Several signs need a professional review. Keep eating regularly and avoid adding training or restricting food while you arrange support."
        : risk === "moderate"
          ? "Some signs suggest you may not be meeting the energy demands of training. Arrange a review with a registered sports dietitian, or your GP or a sports-medicine clinician."
          : "Nothing here strongly points to under-fuelling, but a short checklist cannot rule it out. Recheck if your health, periods, libido, mood, injuries or performance change.",
    guidance,
    // ⚠️ DISTRESS ABOUT FOOD REFERS TO SOMEBODY WHO CAN HELP WITH THAT, not only to a dietitian and a
    // physician. `escalation.ts` already sends the same disclosure to a GP and a psychologist, and the
    // two modules must not name different destinations for the same sentence from the same runner.
    refer: elevated
      ? (unique.includes("preoccupation-with-food-or-weight")
        ? ["sports-dietitian", "gp", "psychologist"]
        : ["sports-dietitian", "sports-physician"])
      : [],
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
 *
 * ⚠️ THE BANDS ARE NOT DIAGNOSTIC CUT-OFFS AND THIS IS DELIBERATELY NOT IN THE APP. The 2023 IOC
 * consensus is explicit that calculated energy-availability thresholds are not reliable diagnostic
 * cut-offs for free-living individuals: all three inputs carry large measurement error, and dividing
 * two bad numbers by a third produces a figure whose precision is entirely false. The ~30 / ~30–45 /
 * ~45+ split below is the research convention, useful for reading a paper and worthless as a personal
 * verdict — which is exactly why a number like it, printed in a consumer screen, becomes a target to
 * eat down to. `screenRedS` is the symptom-led screen the UI uses instead.
 *
 * Kept, not deleted: it is exported through `src/index.ts` and covered by `test/safety.test.ts`, and
 * the arithmetic is correct. It simply has no consumer caller, and must not acquire one.
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
