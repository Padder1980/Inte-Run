// Central, typed, data-driven catalogue for spoken coaching. This is the single source of truth for
// every spoken line: raw text and audio filenames live here, never scattered through the UI. The app's
// audio controller reads this catalogue, maps live-session events to prompt triggers, and plays the
// matching pre-generated clip for the chosen coach. Selection (priority, interruption, repeat limits)
// is pure and unit-tested so behaviour is predictable without any audio present.

import type { SessionType } from "../domain/types.ts";

// ---- Coaches ---------------------------------------------------------------
// Original InteRun personalities (not imitations of any real person). Each is bound to one open-source
// Kokoro voice; the voice carries the personality, while the spoken text is shared across coaches.

export type CoachId = "guide" | "pacer" | "motivator" | "technician"
  | "spark" | "steady" | "storyteller" | "commentator" | "sportsman";

export type Coach = {
  id: CoachId;
  name: string;
  /** Kokoro voice id used to generate this coach's audio. */
  voice: string;
  tagline: string;
  description: string;
};

export const COACHES: Record<CoachId, Coach> = {
  guide: {
    id: "guide",
    name: "The Guide",
    voice: "bf_emma",
    tagline: "Warm and reassuring",
    description: "A calm, encouraging companion who keeps you relaxed and confident from first step to last.",
  },
  pacer: {
    id: "pacer",
    name: "The Pacer",
    voice: "bm_george",
    tagline: "Calm and authoritative",
    description: "A steady, measured voice that holds you to your plan and keeps your effort honest.",
  },
  motivator: {
    id: "motivator",
    name: "The Motivator",
    voice: "bf_isabella",
    tagline: "Energetic and positive",
    description: "Upbeat and driving — the lift you want on the hard reps and the final push.",
  },
  technician: {
    id: "technician",
    name: "The Technician",
    voice: "bm_lewis",
    tagline: "Precise and composed",
    description: "Clear, exact cues on form, pacing and structure for the runner who likes the detail.",
  },
  // ---- Added 2026-08-03 from the owner's own ElevenLabs voices -----------------------------------
  //
  // ⚠️ These five carry NO per-coach variants yet, so they speak the catalogue's default text. That
  // is a deliberate first step, not an oversight: the original four differ in WORDING as well as
  // sound — the same moment phrased four ways — and until these have their own phrasing they are a
  // different voice reading the same script. Worth knowing before judging them against Holly.
  spark: {
    id: "spark",
    name: "The Spark",
    voice: "el:axell",
    tagline: "Bright and quick",
    description: "Fast, upbeat and full of energy — the voice for the days you need dragging out of the door.",
  },
  steady: {
    id: "steady",
    name: "The Steady",
    voice: "el:robert",
    tagline: "Unhurried and grounded",
    description: "Calm and natural, never rushed. The one to run long with when nothing needs to be dramatic.",
  },
  storyteller: {
    id: "storyteller",
    name: "The Storyteller",
    voice: "el:nathaniel",
    tagline: "Expressive and vivid",
    description: "Warm and animated — makes an ordinary hour out feel like it is going somewhere.",
  },
  commentator: {
    id: "commentator",
    name: "The Commentator",
    voice: "el:announcer",
    tagline: "Crisp and fast-paced",
    description: "Sharp, energetic match-day delivery. Your intervals narrated like they matter, because they do.",
  },
  sportsman: {
    id: "sportsman",
    name: "The Sportsman",
    voice: "el:sportsman",
    tagline: "Blunt and Irish",
    description: "Direct, no fuss and quietly certain you have more in you than you think.",
  }
};

// ⚠️ Order is the order they appear in the picker. The original four lead because they are the
// ones with their own per-moment wording; the five added on 2026-08-03 share the default text
// and differ by voice alone, which is a real difference in depth the runner can hear.
export const COACH_IDS: CoachId[] = ["guide", "pacer", "motivator", "technician",
  "spark", "steady", "storyteller", "commentator", "sportsman"];
export const DEFAULT_COACH: CoachId = "guide";

// ---- Triggers --------------------------------------------------------------
// A trigger is a moment in a session the controller can detect. Prompts are chosen by trigger; several
// prompts can share a trigger (variety), and the selector picks by priority + least-recently-played.

export type PromptTrigger =
  | "session-prep"        // before the first step: settle the runner in
  | "warmup-start"        // a warm-up step begins
  | "session-start"       // the working session gets under way
  | "easy-settle"         // easy / recovery running underway
  | "long-run-settle"     // long-run specific settling
  | "tempo-start"         // steady / tempo block begins
  | "threshold-hold"      // threshold effort mid-block hold
  | "interval-start"      // a hard rep begins
  | "interval-work"       // mid-rep hold-on
  | "recovery-start"      // recovery jog between reps
  | "hill-start"          // a hill rep begins
  | "strength-start"      // strength / mobility session begins
  | "technique"           // running-form cue
  | "halfway"             // halfway through the session
  | "milestone-distance"  // a distance/time milestone passed
  | "final-effort"        // the last stretch / last rep
  | "cooldown-start"      // a cool-down step begins
  | "session-complete"    // the session finished as planned
  | "paused"              // runner paused
  | "resumed"             // runner resumed
  | "ended-early"         // runner ended before the plan finished
  | "safety-effort"       // sustained excessive effort warning (data-driven)
  | "pace-behind"         // consistently slower than the step's band (gentle lift)
  | "pace-ahead"          // consistently faster than the step's band (protect the plan)
  | "pace-on"             // back on target after a correction (affirm once, then quiet)
  | "keep-going"          // grind-moment encouragement, late in hard or long work
  | "why-inspire"         // invoke the runner's "who inspires you" answer
  | "why-reason"          // invoke the runner's "why do you run" answer
  | "why-goal"            // invoke the runner's "why this goal" answer
  | "why-anchor"
  /** Number and sentence fragments for the pace cue. NEVER fired by trigger — played by id only. */
  | "fragment"          // invoke the runner's "who keeps you going" answer
  | "countdown";          // the three beats before the clock starts

/** The words a given coach actually says for a prompt. */
export function promptTextFor(p: PromptDef, coach: CoachId): string {
  return (p.variants && p.variants[coach]) || p.text;
}

// ---- Prompt definitions ----------------------------------------------------

export type PromptIntensity = "low" | "moderate" | "high";

export type PromptDef = {
  /** Permanent, stable id — also the audio filename stem (<coach>/<id>.mp3). Never reuse or renumber. */
  id: string;
  trigger: PromptTrigger;
  /** The spoken text. Already pronunciation-safe ("Inter-run" for the brand). */
  text: string;
  /** Higher wins when two prompts contend; also gates interruption. 0–100. */
  priority: number;
  /** May this prompt interrupt one already playing (of lower priority)? Safety/countdowns do. */
  interrupt: boolean;
  /** Do not replay this prompt within this many seconds (0 = no limit; one-shots use a big number). */
  minRepeatSec: number;
  /** Session types this applies to, or "all". */
  sessionTypes: SessionType[] | "all";
  /** Per-coach wordings. Absent coaches fall back to `text`. Personality lives here: the same
   *  moment gets Holly's kindness, Philip's economy, Hope's fire and Lucy's mechanics. */
  variants?: Partial<Record<CoachId, string>>;
  /** Optional tag for future per-intensity selection. */
  intensity?: PromptIntensity;
};

// Priority bands (kept as named constants so intent is legible).
const P_AMBIENT = 20;   // easy encouragement, form cues — never interrupts anything
const P_INFO = 40;      // step transitions, milestones
const P_KEY = 60;       // interval starts, halfway, final effort
const P_CRITICAL = 90;  // safety warnings — always interrupt

const ONESHOT = 36000;  // effectively once per session


// ---- The number bank, so the coach can say a pace in their own voice --------------------------
//
// ⚠️ THESE ARE PLAYED BY ID, NEVER BY TRIGGER. The pace cue assembles a sentence from them —
// "Your current pace is" + six + "minutes" + forty-three + "per kilometre" — the same trick the
// count-in already uses to say "three, two, one" in each coach's voice. A pre-generated clip cannot
// hold a number, so the number becomes its own clip.
//
// ⚠️ SPELLED OUT, because no prompt text may contain a digit: the clips are generated from this text
// and a numeral is not reliably spoken. test/coach-variants.test.ts enforces it across every coach.
//
// ⚠️ NO PER-COACH VARIANTS, deliberately. A coach saying "forty-three" says "forty-three"; the
// difference is the voice, not the wording — exactly the reasoning already recorded for the
// countdown. Personality lives in the instruction that precedes this, which is a normal prompt with
// its own four variants.
//
// Recorded flat and list-like on purpose: these are joined end to end, so a rising or falling
// intonation baked into one fragment fights the sentence it lands in.
const PACE_NUMBER_CLIPS: PromptDef[] = [
  { id: "num_0", trigger: "fragment", text: "Nought", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_1", trigger: "fragment", text: "one", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_2", trigger: "fragment", text: "two", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_3", trigger: "fragment", text: "three", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_4", trigger: "fragment", text: "four", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_5", trigger: "fragment", text: "five", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_6", trigger: "fragment", text: "six", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_7", trigger: "fragment", text: "seven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_8", trigger: "fragment", text: "eight", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_9", trigger: "fragment", text: "nine", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_10", trigger: "fragment", text: "ten", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_11", trigger: "fragment", text: "eleven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_12", trigger: "fragment", text: "twelve", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_13", trigger: "fragment", text: "thirteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_14", trigger: "fragment", text: "fourteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_15", trigger: "fragment", text: "fifteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_16", trigger: "fragment", text: "sixteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_17", trigger: "fragment", text: "seventeen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_18", trigger: "fragment", text: "eighteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_19", trigger: "fragment", text: "nineteen", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_20", trigger: "fragment", text: "twenty", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_21", trigger: "fragment", text: "twenty-one", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_22", trigger: "fragment", text: "twenty-two", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_23", trigger: "fragment", text: "twenty-three", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_24", trigger: "fragment", text: "twenty-four", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_25", trigger: "fragment", text: "twenty-five", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_26", trigger: "fragment", text: "twenty-six", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_27", trigger: "fragment", text: "twenty-seven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_28", trigger: "fragment", text: "twenty-eight", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_29", trigger: "fragment", text: "twenty-nine", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_30", trigger: "fragment", text: "thirty", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_31", trigger: "fragment", text: "thirty-one", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_32", trigger: "fragment", text: "thirty-two", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_33", trigger: "fragment", text: "thirty-three", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_34", trigger: "fragment", text: "thirty-four", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_35", trigger: "fragment", text: "thirty-five", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_36", trigger: "fragment", text: "thirty-six", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_37", trigger: "fragment", text: "thirty-seven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_38", trigger: "fragment", text: "thirty-eight", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_39", trigger: "fragment", text: "thirty-nine", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_40", trigger: "fragment", text: "forty", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_41", trigger: "fragment", text: "forty-one", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_42", trigger: "fragment", text: "forty-two", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_43", trigger: "fragment", text: "forty-three", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_44", trigger: "fragment", text: "forty-four", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_45", trigger: "fragment", text: "forty-five", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_46", trigger: "fragment", text: "forty-six", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_47", trigger: "fragment", text: "forty-seven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_48", trigger: "fragment", text: "forty-eight", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_49", trigger: "fragment", text: "forty-nine", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_50", trigger: "fragment", text: "fifty", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_51", trigger: "fragment", text: "fifty-one", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_52", trigger: "fragment", text: "fifty-two", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_53", trigger: "fragment", text: "fifty-three", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_54", trigger: "fragment", text: "fifty-four", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_55", trigger: "fragment", text: "fifty-five", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_56", trigger: "fragment", text: "fifty-six", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_57", trigger: "fragment", text: "fifty-seven", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_58", trigger: "fragment", text: "fifty-eight", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "num_59", trigger: "fragment", text: "fifty-nine", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
];
const PACE_FRAGMENT_CLIPS: PromptDef[] = [
  { id: "frag_current_pace", trigger: "fragment", text: "Your current pace is", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "frag_target_is", trigger: "fragment", text: "Your target is", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "frag_minutes", trigger: "fragment", text: "minutes", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "frag_per_km", trigger: "fragment", text: "per kilometre.", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
  { id: "frag_to", trigger: "fragment", text: "to", priority: P_CRITICAL, interrupt: false, minRepeatSec: 0, sessionTypes: "all" },
];

export const PROMPTS: PromptDef[] = [
  // — Session preparation ----------------------------------------------------
  { id: "prep_1", trigger: "session-prep", text: "Welcome to Inter-run. Let's make today's session count.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },
  { id: "prep_2", trigger: "session-prep", text: "Good to have you here. Take a breath, and let's begin when you're ready.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Warm-up ----------------------------------------------------------------
  { id: "warmup_1", trigger: "warmup-start", text: "Let's warm up. Start easy and let your body wake up gradually.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },
  { id: "warmup_2", trigger: "warmup-start", text: "Ease in gently. Loose shoulders, relaxed breathing, no rush.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Session start ----------------------------------------------------------
  { id: "start_1", trigger: "session-start", text: "Here we go. Settle into your rhythm.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },
  { id: "start_2", trigger: "session-start", text: "Let's get to work. Find a pace you can hold.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Easy running -----------------------------------------------------------
  { id: "easy_1", trigger: "easy-settle", text: "Nice and easy. This pace should feel comfortable and conversational.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 300, sessionTypes: ["easy", "recovery"], intensity: "low" },
  { id: "easy_2", trigger: "easy-settle", text: "Relax and enjoy this one. Effort stays gentle throughout.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 300, sessionTypes: ["easy", "recovery"], intensity: "low" },
  { id: "easy_3", trigger: "easy-settle", text: "Keep it light. If you can chat, you're right where you should be.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 300, sessionTypes: ["easy", "recovery"], intensity: "low" },

  // — Long runs --------------------------------------------------------------
  { id: "long_1", trigger: "long-run-settle", text: "This is your long run. Patience early pays off late — settle in.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 480, sessionTypes: ["long"], intensity: "low" },
  { id: "long_2", trigger: "long-run-settle", text: "Steady does it. Sip fluids, stay relaxed, and let the miles build.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 480, sessionTypes: ["long"], intensity: "low" },

  // — Tempo / threshold ------------------------------------------------------
  { id: "tempo_1", trigger: "tempo-start", text: "Lifting to tempo now. Strong and controlled — comfortably hard.", priority: P_KEY, interrupt: false, minRepeatSec: 90, sessionTypes: ["threshold", "race-specific"], intensity: "high" },
  { id: "threshold_1", trigger: "threshold-hold", text: "Hold this effort. Smooth, steady, right on the edge of comfortable.", priority: P_INFO, interrupt: false, minRepeatSec: 120, sessionTypes: ["threshold", "race-specific"], intensity: "high" },
  { id: "threshold_2", trigger: "threshold-hold", text: "Stay composed. Same effort, same rhythm — keep it repeatable.", priority: P_INFO, interrupt: false, minRepeatSec: 120, sessionTypes: ["threshold", "race-specific"], intensity: "high" },

  // — Intervals --------------------------------------------------------------
  { id: "interval_start_1", trigger: "interval-start", text: "Next rep coming up. Get ready.", priority: P_KEY, interrupt: true, minRepeatSec: 20, sessionTypes: ["vo2", "threshold", "race-specific"], intensity: "high" },
  { id: "interval_work_1", trigger: "interval-work", text: "This is the work. Strong arms, tall posture, keep driving.", priority: P_INFO, interrupt: false, minRepeatSec: 45, sessionTypes: ["vo2", "threshold", "race-specific"], intensity: "high" },
  { id: "interval_work_2", trigger: "interval-work", text: "Hold your pace. You've got more than you think.", priority: P_INFO, interrupt: false, minRepeatSec: 45, sessionTypes: ["vo2", "threshold", "race-specific"], intensity: "high" },

  // — Recovery periods -------------------------------------------------------
  { id: "recovery_1", trigger: "recovery-start", text: "Recover now. Ease right down and catch your breath.", priority: P_INFO, interrupt: false, minRepeatSec: 20, sessionTypes: ["vo2", "threshold", "race-specific"], intensity: "low" },
  { id: "recovery_2", trigger: "recovery-start", text: "Good rep. Jog easy and let the heart rate come back.", priority: P_INFO, interrupt: false, minRepeatSec: 20, sessionTypes: ["vo2", "threshold", "race-specific"], intensity: "low" },

  // — Hills ------------------------------------------------------------------
  { id: "hill_1", trigger: "hill-start", text: "Up the hill. Shorten your stride, drive your arms, keep the effort steady.", priority: P_KEY, interrupt: false, minRepeatSec: 25, sessionTypes: ["vo2", "threshold"], intensity: "high" },
  { id: "hill_2", trigger: "hill-start", text: "Attack the climb. Eyes up, strong and powerful.", priority: P_KEY, interrupt: false, minRepeatSec: 25, sessionTypes: ["vo2", "threshold"], intensity: "high" },

  // — Strength ---------------------------------------------------------------
  { id: "strength_1", trigger: "strength-start", text: "Strength time. Move with control, quality over quantity, and stop before failure.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: ["strength"] },
  { id: "strength_2", trigger: "strength-start", text: "Let's build durability. Brace your core and keep every rep clean.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: ["strength"] },

  // — Technique --------------------------------------------------------------
  { id: "technique_1", trigger: "technique", text: "Quick check: relax your shoulders and let your hands stay soft.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 240, sessionTypes: "all" },
  { id: "technique_2", trigger: "technique", text: "Light, quick steps. Let your feet land underneath you.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 240, sessionTypes: "all" },
  { id: "technique_3", trigger: "technique", text: "Tall through the spine, eyes on the horizon. Run relaxed.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 240, sessionTypes: "all" },

  // — Halfway ----------------------------------------------------------------
  { id: "halfway_1", trigger: "halfway", text: "You're halfway through. Hold your form and keep working.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },
  { id: "halfway_2", trigger: "halfway", text: "Halfway done, and looking strong. Stay with it.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Pace against the prescribed band ---------------------------------------
  // No numbers anywhere: these are pre-generated clips, so a coach can never say "eight seconds
  // down". Everything is phrased relatively, which also keeps them true on any device.
  { id: "pace_behind_1", trigger: "pace-behind", text: "You've drifted a little under pace. Gently find that rhythm again.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Slipped a touch — pick it up, nice and light.",
      steady: "A little under pace. Bring it back gradually, no rush.",
      storyteller: "The pace has quietly drifted. Reel it back in.",
      commentator: "He's dropped off the pace slightly — needs to respond here.",
      sportsman: "You're off it a bit. Wind it back on.", guide: "You've drifted a little soft. Gently find that rhythm again.", pacer: "You're a shade down on target. Lift the rhythm, not the strain.", motivator: "You've got more than this \u2014 let's go find it.", technician: "Pace is down. Lift your cadence a notch and stand tall." } },
  { id: "pace_behind_2", trigger: "pace-behind", text: "A touch under pace. No panic \u2014 just ease back into it.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Bit slow — lift it, don't lunge.",
      steady: "Just under. Add a small amount and hold there.",
      storyteller: "A shade behind where you meant to be. Ease it forward.",
      commentator: "Fractionally behind schedule — a gentle response required.",
      sportsman: "Slightly slow. Nudge it, don't attack it.", guide: "A touch under pace. No panic \u2014 just lean back into it.", pacer: "Pace has slipped. Quicker feet, same effort.", motivator: "Wake it up! Quick feet, big heart.", technician: "Losing time. Shorten the stride, quicken the rhythm." } },
  { id: "pace_behind_3", trigger: "pace-behind", text: "Come back to target. Smooth and steady does it.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Back on it — smooth and quick.",
      steady: "Find target again. Slowly does it.",
      storyteller: "Back towards the pace you set out for.",
      commentator: "Working his way back onto the pace now.",
      sportsman: "Get back on target. No drama.", guide: "Come back to me. Smooth and steady does it.", pacer: "Below the band. Build back gradually over the next minute.", motivator: "This is where it's won. Pick it up with me.", technician: "Check in: eyes up, arms driving. Now build the pace back." } },

  { id: "pace_ahead_1", trigger: "pace-ahead", text: "Easy now \u2014 you're quicker than we need. Save it for later.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Whoa — quick! Rein it in, save that.",
      steady: "You're ahead of pace. Ease back and keep it there.",
      storyteller: "Quicker than the plan asked. Put that away for later.",
      commentator: "He's gone off too fast — that will cost him later.",
      sportsman: "Too quick. Back off, you'll want that.", guide: "Easy now \u2014 you're quicker than we need. Save it for later.", pacer: "Above target. Ease back \u2014 the plan needs this pace, not that one.", motivator: "Whoa, speedster! Bank that fire \u2014 you'll want it at the end.", technician: "Running hot. Drop the effort a notch \u2014 same form, less force." } },
  { id: "pace_ahead_2", trigger: "pace-ahead", text: "Ahead of pace. Breathe, soften, let it come back.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Fast! Breathe, soften, settle.",
      steady: "Ahead of target. Let it come back on its own.",
      storyteller: "Running above yourself. Let the pace fall back to you.",
      commentator: "Well ahead of pace — and he needs to settle now.",
      sportsman: "You're flying. Too early for that. Settle.", guide: "Ahead of pace. Breathe, soften, let it come back.", pacer: "Too quick. Settle down to the band and hold.", motivator: "Too hot too soon. Cool it a touch and finish like a hero instead.", technician: "Over pace. Relax the shoulders, shorten the push, let it slow." } },
  { id: "pace_ahead_3", trigger: "pace-ahead", text: "Lovely energy, but ease off. Patience wins today.", priority: P_INFO, interrupt: false, minRepeatSec: 90, sessionTypes: "all",
    variants: {
      spark: "Great legs — but not yet! Ease off.",
      steady: "Good, but quicker than needed. Ease down a little.",
      storyteller: "Plenty there today. Spend it later, not here.",
      commentator: "Looking strong, but this is not the moment to use it.",
      sportsman: "Grand legs on you. Save them.", guide: "I love the energy, but ease off. Patience wins today.", pacer: "You're over-pacing. Trim it back and lock in.", motivator: "Save the fireworks! Ease down, we'll light them later.", technician: "Faster than prescribed. Control is the skill here \u2014 dial it back." } },

  { id: "pace_on_1", trigger: "pace-on", text: "That's it. Right where you should be.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 240, sessionTypes: "all",
    variants: {
      spark: "Yes! Bang on.",
      steady: "That's it. Right where it should be.",
      storyteller: "There it is — exactly the pace you came for.",
      commentator: "And he's back on the pace. Nicely done.",
      sportsman: "That's the one. Stay there.", guide: "That's it. Right where you should be.", pacer: "On target. Lock this in.", motivator: "Yes! This is your pace \u2014 own it.", technician: "On pace, and the form matches. Keep it exactly like this." } },
  { id: "pace_on_2", trigger: "pace-on", text: "Back on target. Hold this and relax into it.", priority: P_AMBIENT, interrupt: false, minRepeatSec: 240, sessionTypes: "all",
    variants: {
      spark: "Perfect — hold that!",
      steady: "Back on target. Settle in and leave it alone.",
      storyteller: "Back on terms with the plan. Hold it there.",
      commentator: "Back on schedule, and looking comfortable with it.",
      sportsman: "On it now. Don't touch a thing.", guide: "Lovely. Hold this and relax into it.", pacer: "Bang on pace. Hold steady.", motivator: "Dialled in. You look unstoppable.", technician: "Textbook. Same cadence, same effort." } },

  // — Keep going: the grind, wherever it bites --------------------------------
  { id: "keep_going_1", trigger: "keep-going", text: "I know it's hard. You've been harder. Keep going.", priority: P_KEY, interrupt: false, minRepeatSec: 300, sessionTypes: "all",
    variants: {
      spark: "This is the bit! Come on — keep going!",
      steady: "It's hard. You've done hard before. Keep going.",
      storyteller: "This is the part you'll remember. Keep going.",
      commentator: "This is where the session is won — and he keeps going!",
      sportsman: "It's meant to hurt. Keep going.", guide: "I know it's hard. You've been harder. Keep going.", pacer: "Hold the rhythm. The rhythm carries you.", motivator: "Don't you dare stop now \u2014 this is the good part!", technician: "When it hurts, run taller. Posture first, the rest follows." } },
  { id: "keep_going_2", trigger: "keep-going", text: "One step, then the next. That's all it ever is.", priority: P_KEY, interrupt: false, minRepeatSec: 300, sessionTypes: "all",
    variants: {
      spark: "One step. Then another. Go!",
      steady: "One step, then the next. That's the whole job.",
      storyteller: "One step at a time is how every one of these ends.",
      commentator: "Digging in now — one stride at a time.",
      sportsman: "One foot, then the other. That's it.", guide: "One step, then the next. That's all it ever is.", pacer: "Nothing changes. Same pace, same breath, keep moving.", motivator: "Tough is temporary. You are not. Go!", technician: "Reset: shoulders down, breathe long, drive the arms." } },
  { id: "keep_going_3", trigger: "keep-going", text: "Stay with it. This part passes \u2014 you don't stop.", priority: P_KEY, interrupt: false, minRepeatSec: 300, sessionTypes: "all",
    variants: {
      spark: "Stay with it — this bit ends!",
      steady: "Stay with it. This part always passes.",
      storyteller: "Stay with it. This stretch is temporary; you are not.",
      commentator: "He's hurting — but he's still there!",
      sportsman: "Stay with it. It passes. You don't stop.", guide: "Stay with me. This part passes \u2014 you don't stop.", pacer: "This is where pace is made. Stay on it.", motivator: "Every stride right now is building the runner you want to be.", technician: "Fatigue is form's enemy. Beat it with technique." } },

  // — The runner's own reasons ------------------------------------------------
  // Fired at most once per run, deep into long or hard work. The coach frames it; the runner's own
  // words appear on screen (phone) or are spoken after it (watch, which has live text-to-speech).
  // Rarity is the point: a "why" that plays every run becomes wallpaper.
  { id: "why_inspire_1", trigger: "why-inspire", text: "Think of the person who inspires you. Run this part with them.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: {
      spark: "That person who inspires you? Run this bit for them!",
      steady: "Think of whoever inspires you. Run this part with them.",
      storyteller: "Somewhere behind this run is the person who made you want it. Bring them along.",
      commentator: "And you can be sure someone would be proud of this.",
      sportsman: "Think of the one who got you into this. Do it for them.", guide: "Think of the person who inspires you. Run this part with them.", pacer: "Your inspiration didn't quit here. Neither do you.", motivator: "Picture who inspires you \u2014 now show them what you've got!", technician: "Recall who inspires you. Match their standard for one kilometre." } },
  { id: "why_reason_1", trigger: "why-reason", text: "Remember why you started. It's still true, right now.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: {
      spark: "Remember why you started — it still counts!",
      steady: "Remember why you started. It hasn't changed.",
      storyteller: "You had a reason for this before today. It is still standing.",
      commentator: "This is what all that work was for.",
      sportsman: "You know why you're out here. Nothing's changed.", guide: "Remember why you started. It's still true, right now.", pacer: "You had a reason to start running. Hold it for the next minute.", motivator: "Your why is bigger than this hill. Prove it!", technician: "Reconnect with your reason. Purpose steadies pace." } },
  { id: "why_goal_1", trigger: "why-goal", text: "That goal of yours has a reason behind it. This is you earning it.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: {
      spark: "That goal! This is you earning it!",
      steady: "There's a reason behind that goal. This is you paying for it.",
      storyteller: "The goal has a reason underneath it, and this is the price of it.",
      commentator: "This is the work that makes the target possible.",
      sportsman: "You want that goal. This is the cost. Pay it.", guide: "That goal of yours has a reason behind it. This is you earning it.", pacer: "The goal means something. This stretch is where it's paid for.", motivator: "That time goal? You chose it for a reason. Chase it down!", technician: "Your goal was chosen deliberately. Run this stretch deliberately." } },
  { id: "why_anchor_1", trigger: "why-anchor", text: "It's tough. So think of what keeps you going \u2014 and let it.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: {
      spark: "Think what keeps you going — and use it!",
      steady: "It's hard. Think of what keeps you going, and let it.",
      storyteller: "When it bites, think of whatever holds you together. Let it hold now.",
      commentator: "Reaching for something extra — and finding it.",
      sportsman: "It's hard. Think what keeps you at it. Lean on that.", guide: "It's tough. So think of what keeps you going \u2014 and let it.", pacer: "Hard patch. Anchor to your reason and hold the pace.", motivator: "This is the tough bit \u2014 and you know exactly who you're doing it for.", technician: "When it's tough, your anchor is a tool. Use it now." } },

  // — The count-in ------------------------------------------------------------
  // Separate beats rather than one clip, so the app can place each on its own second and the run
  // starts exactly on "go". Words, never numerals — the catalogue forbids digits because a
  // pre-generated clip can never say a number that varies, and these are played by id.
  // No per-coach variants, deliberately: a coach counting to three says "three". What differs is
  // the VOICE — four recorded actors — and inventing four wordings for one syllable would be
  // difference for its own sake.
  { id: "count_3", trigger: "countdown", text: "Three.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 0, sessionTypes: "all" },
  { id: "count_2", trigger: "countdown", text: "Two.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 0, sessionTypes: "all" },
  { id: "count_1", trigger: "countdown", text: "One.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 0, sessionTypes: "all" },
  { id: "count_go", trigger: "countdown", text: "Go.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 0, sessionTypes: "all" },

  // — Distance / time milestones --------------------------------------------
  { id: "milestone_1", trigger: "milestone-distance", text: "Another kilometre done. Strong and steady.", priority: P_INFO, interrupt: false, minRepeatSec: 30, sessionTypes: "all" },
  { id: "milestone_2", trigger: "milestone-distance", text: "That's another one behind you. Keep rolling.", priority: P_INFO, interrupt: false, minRepeatSec: 30, sessionTypes: "all" },
  { id: "milestone_3", trigger: "milestone-distance", text: "Ticking them off nicely. Same rhythm, keep going.", priority: P_INFO, interrupt: false, minRepeatSec: 30, sessionTypes: "all" },

  // — Final effort -----------------------------------------------------------
  { id: "final_1", trigger: "final-effort", text: "Last effort now. Empty the tank — you're nearly there.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all", intensity: "high" },
  { id: "final_2", trigger: "final-effort", text: "This is the finish. Everything you've got, all the way through the line.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all", intensity: "high" },

  // — Cool-down --------------------------------------------------------------
  { id: "cooldown_1", trigger: "cooldown-start", text: "Ease down now. Let your pace and your breathing settle.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all", intensity: "low" },
  { id: "cooldown_2", trigger: "cooldown-start", text: "Cool-down time. Relax, slow it right down, and enjoy the finish.", priority: P_INFO, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all", intensity: "low" },

  // — Session completion -----------------------------------------------------
  { id: "complete_1", trigger: "session-complete", text: "Session complete. Excellent work today. Recover well.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },
  { id: "complete_2", trigger: "session-complete", text: "That's it — done and dusted. Really strong session. Be proud.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Pause / resume / end early --------------------------------------------
  { id: "paused_1", trigger: "paused", text: "Paused. Take your time.", priority: P_INFO, interrupt: true, minRepeatSec: 5, sessionTypes: "all" },
  { id: "resumed_1", trigger: "resumed", text: "And we're back. Pick up where you left off.", priority: P_INFO, interrupt: true, minRepeatSec: 5, sessionTypes: "all" },
  { id: "ended_early_1", trigger: "ended-early", text: "Session ended. Every step still counts — well done for getting out.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all" },

  // — Safety / excessive effort (data-driven; see controller trigger) --------
  { id: "safety_1", trigger: "safety-effort", text: "Easy — your effort's been very high for a while. Back it off and check in with how you feel.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 300, sessionTypes: "all" },
  { id: "safety_2", trigger: "safety-effort", text: "Let's be sensible. Ease down, breathe, and only push on if you feel good.", priority: P_CRITICAL, interrupt: true, minRepeatSec: 300, sessionTypes: "all" },
];
// The by-id fragments live in the same catalogue so generation, the manifest and the no-digit
// test all see them without a second code path.
export const ALL_PROMPTS: PromptDef[] = PROMPTS.concat(PACE_NUMBER_CLIPS, PACE_FRAGMENT_CLIPS);


// ---- Selection (pure, testable) -------------------------------------------

/** Every prompt for a trigger that applies to the given session type. */
export function promptsFor(trigger: PromptTrigger, sessionType: SessionType): PromptDef[] {
  return PROMPTS.filter(
    (p) => p.trigger === trigger && (p.sessionTypes === "all" || p.sessionTypes.includes(sessionType)),
  );
}

/** State the selector needs to avoid repeats and add variety, kept by the caller. */
export type PromptHistory = {
  /** prompt id -> last played at (seconds into the session). */
  lastPlayedAt: Record<string, number>;
};

export function newPromptHistory(): PromptHistory {
  return { lastPlayedAt: {} };
}

/** True if this prompt's repeat window has elapsed. */
export function canPlay(prompt: PromptDef, nowSec: number, history: PromptHistory): boolean {
  const last = history.lastPlayedAt[prompt.id];
  if (last == null) return true;
  return nowSec - last >= prompt.minRepeatSec;
}

/**
 * Choose the best prompt for a trigger: highest priority, then the one played
 * least recently (for variety), skipping any still inside its repeat window.
 * Returns null when nothing is eligible — a silent, safe outcome.
 */
export function selectPrompt(
  trigger: PromptTrigger,
  sessionType: SessionType,
  nowSec: number,
  history: PromptHistory,
): PromptDef | null {
  const eligible = promptsFor(trigger, sessionType).filter((p) => canPlay(p, nowSec, history));
  if (eligible.length === 0) return null;
  const topPriority = Math.max(...eligible.map((p) => p.priority));
  const top = eligible.filter((p) => p.priority === topPriority);
  // Among equal priority, prefer the least-recently-played (never played sorts first).
  top.sort((a, b) => (history.lastPlayedAt[a.id] ?? -1) - (history.lastPlayedAt[b.id] ?? -1));
  return top[0]!;
}

/** Record that a prompt was played (mutates history). */
export function markPlayed(prompt: PromptDef, nowSec: number, history: PromptHistory): void {
  history.lastPlayedAt[prompt.id] = nowSec;
}

/**
 * Decide whether an incoming prompt should replace one that's currently playing.
 * A prompt interrupts only when it is flagged interrupt AND outranks the current one.
 */
export function shouldInterrupt(incoming: PromptDef, current: PromptDef | null): boolean {
  if (!current) return true;
  return incoming.interrupt && incoming.priority > current.priority;
}

/** All prompt ids (used by the generation pipeline and the manifest). */
export function allPromptIds(): string[] {
  return PROMPTS.map((p) => p.id);
}

// ---- Personal prompts (the runner's person, by name) ------------------------
//
// Pre-generated audio cannot contain an arbitrary name, so the shared catalogue above stays
// name-free and works for everyone. These lines are the optional upgrade: the same why-moments
// with a {name} slot, generated into a PERSONAL pack for one specific name and never shipped
// publicly. When a pack for the runner's person exists the coach says the name out loud; when it
// doesn't, the shared line plays and the runner's own written words appear on screen instead.
//
// Ids are distinct stems so a personal clip can never collide with a shared one.

/** Prompts whose text carries a `{name}` slot. Expand with `personalPrompts(name)`. */
export const PERSONAL_PROMPT_TEMPLATES: PromptDef[] = [
  { id: "why_name_inspire_1", trigger: "why-inspire", text: "Think of {name}. Run this part with them.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: { guide: "Think of {name}. Run this part with them.", pacer: "{name} is the reason. Hold the pace.", motivator: "Picture {name} — now show them what you've got!", technician: "Recall {name}. Match that standard for one kilometre." } },
  { id: "why_name_anchor_1", trigger: "why-anchor", text: "It's tough. So think of {name}, and let that carry you.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: { guide: "It's tough. So think of {name}, and let that carry you.", pacer: "Hard patch. Anchor to {name} and hold on.", motivator: "This is the tough bit — and you're doing it for {name}!", technician: "When it's tough, {name} is your anchor. Use it now." } },
  { id: "why_name_anchor_2", trigger: "why-anchor", text: "{name} would want you to finish this properly. So finish it properly.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: { guide: "{name} would want you to finish this properly. So finish it properly.", pacer: "Finish this one the way {name} would want it finished.", motivator: "Do it for {name} — all the way to the line!", technician: "Finish to standard. That is what {name} sees." } },
  { id: "why_name_goal_1", trigger: "why-goal", text: "That goal has {name} behind it. This is you earning it.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all",
    variants: { guide: "That goal has {name} behind it. This is you earning it.", pacer: "The goal, and {name}. Both worth this next stretch.", motivator: "That time goal is for {name} — go and take it!", technician: "Goal chosen for {name}. Run this stretch deliberately." } },
  { id: "why_name_final_1", trigger: "final-effort", text: "Last effort. Run this one home for {name}.", priority: P_KEY, interrupt: false, minRepeatSec: ONESHOT, sessionTypes: "all", intensity: "high",
    variants: { guide: "Last effort. Run this one home for {name}.", pacer: "Final stretch. This one's for {name}.", motivator: "Everything you've got — for {name}!", technician: "Final effort. Hold form, and bring it home for {name}." } },
];

/** The personal prompts with a real name substituted in. Empty for a blank name. */
export function personalPrompts(name: string): PromptDef[] {
  const n = name.trim();
  if (!n) return [];
  const put = (s: string) => s.split("{name}").join(n);
  return PERSONAL_PROMPT_TEMPLATES.map((p) => ({
    ...p,
    text: put(p.text),
    variants: p.variants
      ? (Object.fromEntries(Object.entries(p.variants).map(([c, t]) => [c, put(t as string)])) as PromptDef["variants"])
      : undefined,
  }));
}

/** Folder/manifest key for a person's pack — lowercase, safe, and stable. */
export function personalPackSlug(name: string): string {
  return name.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 24);
}
