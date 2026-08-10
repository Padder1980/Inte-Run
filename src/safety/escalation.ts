// Medical red-flag screener (brief §17). Given symptoms the runner reports, it surfaces the most
// urgent escalation pathway and clear, calm next steps — always routing to a human. It never says
// what the problem is; it says who to talk to and how soon.

import {
  type Professional,
  type Urgency,
  maxUrgency,
  URGENCY_RANK,
  NOT_A_DIAGNOSIS,
} from "./common.ts";

/** The red flags the brief lists as needing an escalation pathway. */
export type RedFlag =
  | "chest-pain"
  | "collapse-or-fainting"
  | "palpitations"
  | "severe-breathlessness"
  | "heat-illness"
  | "neurological"
  | "bone-pain"
  | "rapidly-worsening-pain"
  | "eating-disorder-concern"
  | "menstrual-disruption"
  | "mental-health-concern"
  | "self-harm-thoughts"
  // Acute limb injury. ⚠️ TRIAGE ONLY, AND THE NAMES ARE DELIBERATE: every one describes what the
  // runner can OBSERVE, never what it might be. There is no "achilles-rupture", "fracture", "dvt" or
  // "grade-2" flag here, because the app must not name a diagnosis it cannot make — the output is the
  // urgency and where to go, and nothing else.
  | "deformity-or-crack"
  | "cold-blue-or-numb-limb"
  | "severe-constant-pain-or-tense-swelling"
  | "cannot-bear-weight-four-steps"
  | "rapid-swelling-or-bruising"
  | "pop-with-loss-of-push-off"
  | "hot-swollen-one-sided-calf"
  | "open-wound-or-fever";

export type FlagCategory =
  | "cardiac"
  | "respiratory"
  | "neurological"
  | "heat"
  | "musculoskeletal"
  | "psychological"
  | "hormonal";

type FlagDef = {
  category: FlagCategory;
  urgency: Urgency;
  label: string;
  /** What to do — plain, calm, actionable. */
  guidance: string;
  refer: Professional[];
};

const FLAGS: Record<RedFlag, FlagDef> = {
  "chest-pain": {
    category: "cardiac",
    urgency: "emergency",
    label: "Chest pain or pressure",
    guidance: "Stop now and call emergency services. Chest pain or pressure during exercise needs urgent assessment.",
    refer: ["emergency-services"],
  },
  "collapse-or-fainting": {
    category: "cardiac",
    urgency: "emergency",
    label: "Fainting or collapse",
    guidance: "Stop and seek emergency care. Fainting or collapse during or after running should be checked urgently.",
    refer: ["emergency-services"],
  },
  "severe-breathlessness": {
    category: "respiratory",
    urgency: "emergency",
    label: "Severe or sudden breathlessness",
    guidance: "Stop and seek emergency care if breathlessness is severe, sudden, or out of proportion to your effort.",
    refer: ["emergency-services"],
  },
  neurological: {
    category: "neurological",
    urgency: "emergency",
    label: "Neurological symptoms",
    guidance: "Stop and seek emergency care for sudden confusion, severe headache, weakness, or trouble seeing or speaking.",
    refer: ["emergency-services"],
  },
  "heat-illness": {
    category: "heat",
    urgency: "emergency",
    label: "Signs of heat illness",
    guidance: "Stop, cool down, and seek emergency care for confusion, stopping sweating, or feeling faint in the heat.",
    refer: ["emergency-services"],
  },
  "self-harm-thoughts": {
    category: "psychological",
    urgency: "emergency",
    label: "Thoughts of self-harm",
    guidance: "You deserve support right now — please contact an urgent crisis line or emergency services. You do not have to manage this alone.",
    refer: ["crisis-support", "emergency-services"],
  },
  palpitations: {
    category: "cardiac",
    urgency: "urgent",
    label: "Palpitations",
    guidance: "Arrange a prompt medical review of your heart rhythm, especially if palpitations come with dizziness or breathlessness.",
    refer: ["sports-physician", "gp"],
  },
  "bone-pain": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "Focal bone pain",
    guidance: "Stop impact running and arrange prompt assessment. Pinpoint bone pain or tenderness, or pain at night, can signal a bone stress injury.",
    refer: ["sports-physician", "physiotherapist"],
  },
  "rapidly-worsening-pain": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "Rapidly worsening pain",
    guidance: "Pause running and arrange prompt assessment — pain that is escalating quickly should be looked at before you train again.",
    refer: ["physiotherapist", "sports-physician"],
  },
  "eating-disorder-concern": {
    category: "psychological",
    urgency: "professional",
    label: "Concerns about eating",
    guidance: "Reaching out is a strong first step. A GP, sports-medicine doctor, dietitian and psychologist can support you together — this is common and treatable.",
    refer: ["gp", "sports-dietitian", "psychologist"],
  },
  "menstrual-disruption": {
    category: "hormonal",
    urgency: "professional",
    label: "Persistent menstrual disruption",
    guidance: "Arrange a review — missing or irregular periods can affect bone and hormonal health and are worth investigating, not pushing through.",
    refer: ["sports-physician", "gynaecologist"],
  },
  "mental-health-concern": {
    category: "psychological",
    urgency: "professional",
    label: "Mental-health concerns",
    guidance: "Talking to someone helps. A GP or psychologist can support you — training should not come before your wellbeing.",
    refer: ["psychologist", "gp"],
  },

  // ---- Acute limb injury -------------------------------------------------------------------------
  // ⚠️ EVERY GUIDANCE STRING NAMES A DESTINATION, NOT A DIAGNOSIS. "Possible Achilles rupture" or
  // "suspected DVT" would be the app diagnosing from a checkbox, which it is in no position to do —
  // and a wrong guess is worse than none, because a runner told "probably a strain" stops seeking help.
  "deformity-or-crack": {
    category: "musculoskeletal",
    urgency: "emergency",
    label: "Limb looks out of shape, or you heard a crack",
    guidance: "Do not walk on it. Call your local emergency number or go to emergency care now.",
    refer: ["emergency-services"],
  },
  "cold-blue-or-numb-limb": {
    category: "musculoskeletal",
    urgency: "emergency",
    label: "Limb is numb, cold, pale or blue",
    guidance: "Get emergency care now. Loss of feeling, colour or warmth in a limb needs to be seen immediately, not monitored.",
    refer: ["emergency-services"],
  },
  "severe-constant-pain-or-tense-swelling": {
    category: "musculoskeletal",
    urgency: "emergency",
    label: "Severe constant pain, or tense hard swelling",
    guidance: "Get emergency care now. Pain that is severe and unrelenting, especially with tight hard swelling, needs assessment straight away.",
    refer: ["emergency-services"],
  },
  "cannot-bear-weight-four-steps": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "Cannot take four steps on it",
    guidance: "Arrange assessment today rather than waiting. Keep weight off it and use support to get about.",
    refer: ["sports-physician", "physiotherapist"],
  },
  "rapid-swelling-or-bruising": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "Large or fast-growing swelling or bruising",
    guidance: "Arrange assessment today. Swelling or bruising that is large or still increasing should be looked at before you load it again.",
    refer: ["sports-physician", "physiotherapist"],
  },
  "pop-with-loss-of-push-off": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "A pop or snap, and now you cannot push off",
    guidance: "Arrange assessment today and avoid loading it. Losing push-off, stairs or the ability to rise onto your toes after a sudden pop needs examining.",
    refer: ["sports-physician", "physiotherapist"],
  },
  "hot-swollen-one-sided-calf": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "One calf newly swollen, warm or red",
    guidance: "Get medical advice today, especially without a clear injury moment. Do not massage it, stretch it or run on it while you wait.",
    refer: ["gp", "sports-physician"],
  },
  "open-wound-or-fever": {
    category: "musculoskeletal",
    urgency: "urgent",
    label: "Open wound, fever, or hot red skin",
    guidance: "Arrange assessment today. A wound, a temperature or skin that is hot and red needs to be checked rather than covered up.",
    refer: ["gp", "sports-physician"],
  },
};

/**
 * ⚠️ ONE PAIRING ESCALATES, AND IT IS THE ONE THAT KILLS PEOPLE. A newly swollen, warm calf is an
 * urgent same-day matter on its own; the same calf together with chest pain, breathlessness, feeling
 * faint or coughing blood is an emergency, because those symptoms together are how a clot in the leg
 * announces that part of it has travelled. Encoded as a PAIR so neither flag has to overstate its own
 * urgency, and still without naming the condition — the output is "call emergency services now".
 */
const ESCALATING_PAIRS: Array<{ needs: RedFlag[]; because: string }> = [
  {
    needs: ["hot-swollen-one-sided-calf", "chest-pain"],
    because: "A newly swollen or warm calf together with chest pain needs emergency assessment now, not today.",
  },
  {
    needs: ["hot-swollen-one-sided-calf", "severe-breathlessness"],
    because: "A newly swollen or warm calf together with breathlessness needs emergency assessment now, not today.",
  },
  {
    needs: ["hot-swollen-one-sided-calf", "collapse-or-fainting"],
    because: "A newly swollen or warm calf together with feeling faint needs emergency assessment now, not today.",
  },
];

export type FlagAssessment = {
  flag: RedFlag;
  category: FlagCategory;
  urgency: Urgency;
  label: string;
  guidance: string;
  refer: Professional[];
};

export type EscalationResult = {
  urgency: Urgency;
  headline: string;
  flags: FlagAssessment[];
  refer: Professional[];
  disclaimer: string;
};

const HEADLINES: Record<Urgency, string> = {
  emergency: "Stop and seek emergency help now.",
  urgent: "Stop running and get a prompt medical review.",
  professional: "Please reach out to a qualified professional soon.",
  monitor: "Nothing urgent flagged — keep an eye on how you feel.",
  none: "No red flags reported.",
};

/**
 * Screen reported symptoms and return the aggregate escalation. Flags are ordered most-urgent first
 * so a UI can lead with what matters. Emits no diagnosis — only urgency, guidance and referrals.
 */
export function screenRedFlags(reported: RedFlag[]): EscalationResult {
  const unique = [...new Set(reported)];
  const flags: FlagAssessment[] = unique.map((flag) => {
    const def = FLAGS[flag];
    return {
      flag,
      category: def.category,
      urgency: def.urgency,
      label: def.label,
      guidance: def.guidance,
      refer: def.refer,
    };
  });
  // ⚠️ APPLIED BEFORE THE SORT AND BEFORE THE OVERALL URGENCY IS TAKEN, so a pair that escalates is
  // reflected in the headline the runner reads rather than only in one row further down the list.
  for (const pair of ESCALATING_PAIRS) {
    if (!pair.needs.every((f) => unique.includes(f))) continue;
    const target = flags.find((f) => f.flag === pair.needs[0]);
    if (!target) continue;
    target.urgency = "emergency";
    target.guidance = pair.because + " Call your local emergency number.";
    target.refer = ["emergency-services"];
  }

  flags.sort((a, b) => URGENCY_RANK[b.urgency] - URGENCY_RANK[a.urgency]);

  const urgency = flags.reduce<Urgency>((u, f) => maxUrgency(u, f.urgency), "none");
  const refer = [...new Set(flags.flatMap((f) => f.refer))];
  return {
    urgency: flags.length === 0 ? "none" : urgency,
    headline: HEADLINES[flags.length === 0 ? "none" : urgency],
    flags,
    refer,
    disclaimer: NOT_A_DIAGNOSIS,
  };
}
