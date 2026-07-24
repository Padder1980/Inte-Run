// Age-aware guidance for masters runners (brief §12). The brief's core point: do NOT automatically
// make every older athlete's programme slower. Ageing affects recovery, muscle, bone and hormones —
// so adapt recovery and add strength and bone-health awareness, while *preserving* meaningful
// intensity and power. Encouraging, never ageist.

export type AgeBand = "under-35" | "35-49" | "50-59" | "60-plus";

export type MastersInput = {
  age: number;
  sex?: "female" | "male";
};

export type MastersGuidance = {
  ageBand: AgeBand;
  isMasters: boolean;
  headline: string;
  points: string[];
  /** How many easy days to leave between hard sessions at this age (a calibration knob). */
  minEasyDaysBetweenQuality: number;
  /** True when the female-health screen is worth surfacing too (menopause / bone health). */
  suggestFemaleHealth: boolean;
};

function bandOf(age: number): AgeBand {
  if (age < 35) return "under-35";
  if (age < 50) return "35-49";
  if (age < 60) return "50-59";
  return "60-plus";
}

const CORE = [
  "Keep your intensity — strides, hills and quality work preserve speed and power. Don't just run slower.",
  "Heavy strength training 2×/week protects muscle, tendon and running economy as you age.",
  "Spread protein through the day to support muscle repair.",
  "Mind bone health — impact plus strength helps; raise persistent aches early rather than pushing on.",
];

export function assessMasters(input: MastersInput): MastersGuidance {
  const ageBand = bandOf(input.age);
  const isMasters = input.age >= 35;

  let minEasyDaysBetweenQuality = 1;
  let headline: string;
  const points = [...CORE];

  if (ageBand === "under-35") {
    headline = "Standard adult guidance applies — train hard and recover well.";
    return {
      ageBand,
      isMasters: false,
      headline,
      points: [CORE[0]!, CORE[1]!],
      minEasyDaysBetweenQuality: 1,
      suggestFemaleHealth: false,
    };
  }

  if (ageBand === "35-49") {
    headline = "You've got plenty in the tank — a few small tweaks keep you progressing.";
    minEasyDaysBetweenQuality = 1;
    points.push("Recovery is still strong, but watch that hard days are genuinely spaced.");
  } else if (ageBand === "50-59") {
    headline = "Keep the intensity, give recovery a little more room.";
    minEasyDaysBetweenQuality = 2;
    points.push("Leave about two easy days between hard sessions, and prioritise sleep.");
  } else {
    headline = "Strength, recovery and consistency are your superpowers now.";
    minEasyDaysBetweenQuality = 2;
    points.push("Two to three easy days between hard sessions; cross-training spares the joints while keeping fitness.");
    points.push("Consistency beats the occasional big week — little and often wins.");
  }

  // Menopause and bone health overlap for women from midlife — worth pointing to the female-health screen.
  const suggestFemaleHealth = input.sex === "female" && input.age >= 45;
  if (suggestFemaleHealth) {
    points.push("Around menopause, strength and bone health matter even more — the wellbeing check has a section for this.");
  }

  return { ageBand, isMasters, headline, points, minEasyDaysBetweenQuality, suggestFemaleHealth };
}
