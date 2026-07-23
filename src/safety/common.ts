// Shared vocabulary for the safety layer.
//
// Guiding rule from the research brief: the app must *educate, screen and refer* — it must NEVER
// diagnose. Every screen in this folder returns plain guidance, an urgency level, and who to talk
// to; none of them label a condition. The wording is deliberately non-alarming and non-judgemental,
// and always points to a qualified human.

/** Kinds of professional the app can point someone toward. It never acts as any of them. */
export type Professional =
  | "emergency-services"
  | "crisis-support"
  | "gp"
  | "sports-physician"
  | "physiotherapist"
  | "pelvic-health-physio"
  | "sports-dietitian"
  | "psychologist"
  | "gynaecologist";

export const PROFESSIONAL_LABEL: Record<Professional, string> = {
  "emergency-services": "emergency services",
  "crisis-support": "an urgent crisis-support line",
  gp: "a GP",
  "sports-physician": "a sports-medicine doctor",
  physiotherapist: "a physiotherapist",
  "pelvic-health-physio": "a pelvic-health physiotherapist",
  "sports-dietitian": "a registered sports dietitian",
  psychologist: "a psychologist or your GP",
  gynaecologist: "a sports-medicine doctor or gynaecologist",
};

/** How soon to act. Ordered least → most urgent for comparison. */
export type Urgency = "none" | "monitor" | "professional" | "urgent" | "emergency";

export const URGENCY_RANK: Record<Urgency, number> = {
  none: 0,
  monitor: 1,
  professional: 2,
  urgent: 3,
  emergency: 4,
};

export function maxUrgency(a: Urgency, b: Urgency): Urgency {
  return URGENCY_RANK[a] >= URGENCY_RANK[b] ? a : b;
}

/** The line every safety result carries — the app screens, it does not diagnose. */
export const NOT_A_DIAGNOSIS =
  "This is general guidance, not a diagnosis. Only a qualified professional can assess you properly.";
