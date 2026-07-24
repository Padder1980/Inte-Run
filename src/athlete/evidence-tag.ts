// Evidence tagging & applicability (brief §11). The brief warns that research on "twelve highly
// trained young men" must not quietly become universal advice. So every recommendation can carry a
// tag — who it was studied in and how strong the evidence is — and we can then say, in plain words,
// how well it applies to *this* runner. It never hides a tip; it just adds an honest note.

import type { RunnerTier } from "./classification.ts";

export type EvidenceQuality = "strong" | "moderate" | "limited" | "emerging";
export type EvidenceSex = "female" | "male" | "mixed" | "any";

export type EvidenceTag = {
  claim: string;
  /** Who it was studied in, in plain words (e.g. "trained young men"). */
  population: string;
  sex: EvidenceSex;
  /** Tiers the evidence was drawn from, or "any". */
  levels: "any" | RunnerTier[];
  ageRange?: [number, number];
  quality: EvidenceQuality;
};

export type Athlete = { tier?: RunnerTier; sex?: "female" | "male"; age?: number };

export type ApplicabilityLevel = "applies-well" | "general-guide" | "limited";

export type Applicability = {
  level: ApplicabilityLevel;
  /** Plain reasons the evidence may not transfer directly. */
  caveats: string[];
  qualityNote: string;
};

const QUALITY_NOTE: Record<EvidenceQuality, string> = {
  strong: "Backed by strong, consistent evidence.",
  moderate: "Reasonable evidence, though not the last word.",
  limited: "Limited evidence — treat as a working guide.",
  emerging: "Emerging evidence — promising but not settled.",
};

/** How well a tagged recommendation applies to a given runner. Adds caveats, never removes the tip. */
export function applicability(tag: EvidenceTag, who: Athlete): Applicability {
  const caveats: string[] = [];

  if (who.sex && tag.sex !== "any" && tag.sex !== "mixed" && tag.sex !== who.sex) {
    caveats.push(`studied mainly in ${tag.sex} runners`);
  }
  if (who.age != null && tag.ageRange && (who.age < tag.ageRange[0] || who.age > tag.ageRange[1])) {
    caveats.push(`studied in ${tag.ageRange[0]}–${tag.ageRange[1]}-year-olds`);
  }
  if (who.tier != null && tag.levels !== "any" && !tag.levels.includes(who.tier)) {
    caveats.push(`studied in ${tag.population}`);
  }

  const weak = tag.quality === "limited" || tag.quality === "emerging";
  let level: ApplicabilityLevel;
  if (caveats.length === 0 && !weak) level = "applies-well";
  else if (caveats.length >= 2) level = "limited";
  else level = "general-guide";

  return { level, caveats, qualityNote: QUALITY_NOTE[tag.quality] };
}
