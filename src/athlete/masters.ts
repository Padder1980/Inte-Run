// Age-aware guidance for masters runners (brief §12). The brief's core point: do NOT automatically
// make every older athlete's programme slower. Ageing affects recovery, muscle, bone and hormones —
// so adapt recovery and add strength and bone-health awareness, while *preserving* meaningful
// intensity and power. Encouraging, never ageist.

/**
 * ⚠️ "unknown" IS A BAND, AND IT EXISTS BECAUSE THE ALTERNATIVE WAS INCOHERENT. `bandOf` compared a
 * number against three thresholds and returned "60-plus" for anything that failed all three — so an
 * absent age answered `ageBand: "60-plus"` with `isMasters: false`, a pair that cannot both be true,
 * and the OLDEST band for the runner we know least about. Nothing passed undefined while
 * DEFAULT_PROFILE shipped `age: 38`, so it never fired; removing that phantom would have fired it on
 * every runner who had not answered.
 */
export type AgeBand = "unknown" | "under-35" | "35-49" | "50-59" | "60-plus";

export type MastersInput = {
  /**
   * The runner's age in years, when they have given one.
   *
   * ⚠️ OPTIONAL, AND ABSENT MUST NOT BE TREATED AS A NUMBER. This is the `weeklyVolumeKm: 30` lesson
   * in a second field: a default in every stored profile is an answer nobody gave, and this one
   * reaches further than a plan. `maxHrEstimate()` in web/app.ts falls back to Tanaka's
   * 208 - 0.7 x age and its own comment says "Zero means no ceiling known; callers must treat that
   * as do not judge, never as a number" — so a phantom age defeats a function deliberately built to
   * refuse to guess. Measured with the old `age: 38` default: a 65-year-old was handed a ceiling
   * 19 bpm too high, so the coach's 92%-of-max safety cue fired at 167 bpm instead of 149, and a
   * 20-year-old's fired 11 bpm early.
   */
  age?: number;
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

/** True only for an age a person can actually be. Anything else is unknown, never a band. */
function knownAge(age: number | undefined): age is number {
  return typeof age === "number" && Number.isFinite(age) && age >= 10 && age <= 100;
}

function bandOf(age: number | undefined): AgeBand {
  if (!knownAge(age)) return "unknown";
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
  const isMasters = knownAge(input.age) && input.age >= 35;

  // ⚠️ UNKNOWN SAYS SO, AND STILL GIVES THE ADVICE THAT IS TRUE AT EVERY AGE. The two core points —
  // keep your intensity, and lift heavy twice a week — are not masters advice, they are running
  // advice; withholding them because we do not know somebody's age would be worse than saying
  // nothing about their age. What it must NOT do is imply a band, because the caller renders this
  // beside a runner-type panel and "a few small tweaks keep you progressing" reads as a statement
  // about them.
  if (ageBand === "unknown") {
    return {
      ageBand,
      isMasters: false,
      headline: "Add your age and we will tailor recovery and strength guidance to it.",
      points: [CORE[0]!, CORE[1]!],
      minEasyDaysBetweenQuality: 1,
      suggestFemaleHealth: false,
    };
  }

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
  // ⚠️ `knownAge` RATHER THAN A BARE COMPARISON. `undefined >= 45` is false, so this happened to be
  // safe — but it is safe by the same accident that made `bandOf` answer "60-plus" for an absent
  // age, and tsc rightly refuses it. Reaching this line at all means the band is known, so the
  // guard is also a statement of that.
  // ⚠️ THE `knownAge` HERE IS THE TYPECHECKER'S REQUIREMENT, NOT THE RUNTIME GUARANTEE, and the
  // difference matters if anyone ever "simplifies" it. By this line the unknown band has already
  // returned, so an absent age cannot reach the comparison at all — measured, replacing this whole
  // conjunction with `(input.age ?? 45) >= 45` changes nothing for any unknown age. What it DOES do is
  // fail `npx tsc --noEmit` with "'input.age' is possibly 'undefined'", so the guard is load-bearing
  // for the build and inert for behaviour. The reachable break is the unknown branch's own hardcoded
  // `suggestFemaleHealth: false` above; that one is driven by test/profile-inputs.test.ts.
  const suggestFemaleHealth = input.sex === "female" && knownAge(input.age) && input.age >= 45;
  if (suggestFemaleHealth) {
    points.push("Around menopause, strength and bone health matter even more — the wellbeing check has a section for this.");
  }

  return { ageBand, isMasters, headline, points, minEasyDaysBetweenQuality, suggestFemaleHealth };
}
