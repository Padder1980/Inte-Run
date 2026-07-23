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
  | "self-harm-thoughts";

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
};

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
