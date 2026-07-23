// Female-athlete health prompts (brief §10). The brief is explicit: offer symptom-informed
// personalisation, NOT compulsory calendar-based "cycle syncing" — average performance differences
// across cycle phases are small and highly variable. So this module changes no training by phase.
// It surfaces health prompts and referrals, and treats missing periods as a health signal, never a
// badge for dedication.

import { type Professional, type Urgency, URGENCY_RANK, NOT_A_DIAGNOSIS } from "./common.ts";

export type MenstrualStatus =
  | "regular"
  | "irregular"
  | "absent-3m-plus"
  | "hormonal-contraception"
  | "pregnant"
  | "postpartum"
  | "perimenopause"
  | "menopause"
  | "prefer-not-to-say";

export type FemaleSymptom =
  | "pelvic-floor" // leaking, heaviness or dragging
  | "heavy-bleeding"
  | "iron-fatigue" // tiredness, breathlessness, heavy periods
  | "hot-flushes-or-sleep"
  | "painful-periods";

export type FemaleHealthInput = {
  status: MenstrualStatus;
  /** Months since the last period, when known — used to reinforce an amenorrhoea prompt. */
  monthsSinceLastPeriod?: number;
  /** Weeks since giving birth, for postpartum return-to-running readiness. */
  postpartumWeeks?: number;
  symptoms?: FemaleSymptom[];
};

export type HealthPrompt = {
  topic: string;
  urgency: Urgency;
  message: string;
  refer: Professional[];
};

export type FemaleHealthResult = {
  urgency: Urgency;
  prompts: HealthPrompt[];
  /** True when a training UI should also open the RED-S screen (bone/energy overlap). */
  suggestRedSScreen: boolean;
  disclaimer: string;
};

export function assessFemaleHealth(input: FemaleHealthInput): FemaleHealthResult {
  const prompts: HealthPrompt[] = [];
  const symptoms = new Set(input.symptoms ?? []);
  let suggestRedS = false;

  const amenorrhoea =
    input.status === "absent-3m-plus" ||
    (input.status === "irregular" && (input.monthsSinceLastPeriod ?? 0) >= 3);

  if (amenorrhoea) {
    suggestRedS = true;
    prompts.push({
      topic: "Missing or infrequent periods",
      urgency: "professional",
      message:
        "Periods stopping or becoming infrequent is a health signal worth reviewing — it can be linked to low energy availability and bone health, not a sign you're training well.",
      refer: ["sports-physician", "gynaecologist"],
    });
  } else if (input.status === "irregular") {
    prompts.push({
      topic: "Irregular periods",
      urgency: "monitor",
      message: "Tracking your symptoms over the coming months is more useful than changing training by calendar phase. Raise it at a review if it persists.",
      refer: ["gp"],
    });
  }

  if (input.status === "pregnant") {
    prompts.push({
      topic: "Running in pregnancy",
      urgency: "professional",
      message:
        "Running can be fine in pregnancy when you've been cleared, but guidance is individual — please plan it with your maternity team rather than a generic plan.",
      refer: ["gp", "physiotherapist"],
    });
  }

  if (input.status === "postpartum") {
    const weeks = input.postpartumWeeks ?? 0;
    if (weeks < 12) {
      prompts.push({
        topic: "Return to running after birth",
        urgency: "professional",
        message:
          "Consensus guidance suggests holding off on impact running until around 12 weeks and after a pelvic-floor assessment. Walking and strengthening first protects your recovery.",
        refer: ["pelvic-health-physio", "gp"],
      });
    } else {
      prompts.push({
        topic: "Return to running after birth",
        urgency: "monitor",
        message:
          "A pelvic-floor assessment before returning to impact is worth it even past 12 weeks. Build back gradually and stop if you notice leaking or heaviness.",
        refer: ["pelvic-health-physio"],
      });
    }
  }

  if (input.status === "perimenopause" || input.status === "menopause") {
    prompts.push({
      topic: "Menopause considerations",
      urgency: "monitor",
      message:
        "This is a time to protect intensity, heavy strength and bone health rather than only running slower. Raise troublesome symptoms with a clinician.",
      refer: ["gp"],
    });
  }

  if (symptoms.has("pelvic-floor")) {
    prompts.push({
      topic: "Pelvic-floor symptoms",
      urgency: "professional",
      message: "Leaking, heaviness or a dragging sensation is common and treatable — a pelvic-health physiotherapist can help, and it's not something to just run through.",
      refer: ["pelvic-health-physio"],
    });
  }

  if (symptoms.has("iron-fatigue") || symptoms.has("heavy-bleeding")) {
    prompts.push({
      topic: "Iron and heavy bleeding",
      urgency: "professional",
      message: "Persistent tiredness or breathlessness with heavy periods is worth an iron / ferritin check — low iron is common in runners and very treatable.",
      refer: ["gp"],
    });
  }

  const urgency = prompts.reduce<Urgency>(
    (u, p) => (URGENCY_RANK[p.urgency] > URGENCY_RANK[u] ? p.urgency : u),
    "none",
  );

  return { urgency, prompts, suggestRedSScreen: suggestRedS, disclaimer: NOT_A_DIAGNOSIS };
}
