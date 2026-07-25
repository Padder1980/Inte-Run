// Central, typed, data-driven catalogue for spoken coaching. This is the single source of truth for
// every spoken line: raw text and audio filenames live here, never scattered through the UI. The app's
// audio controller reads this catalogue, maps live-session events to prompt triggers, and plays the
// matching pre-generated clip for the chosen coach. Selection (priority, interruption, repeat limits)
// is pure and unit-tested so behaviour is predictable without any audio present.

import type { SessionType } from "../domain/types.ts";

// ---- Coaches ---------------------------------------------------------------
// Original InteRun personalities (not imitations of any real person). Each is bound to one open-source
// Kokoro voice; the voice carries the personality, while the spoken text is shared across coaches.

export type CoachId = "guide" | "pacer" | "motivator" | "technician";

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
};

export const COACH_IDS: CoachId[] = ["guide", "pacer", "motivator", "technician"];
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
  | "safety-effort";      // sustained excessive effort warning (data-driven)

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
  /** Optional tag for future per-intensity selection. */
  intensity?: PromptIntensity;
};

// Priority bands (kept as named constants so intent is legible).
const P_AMBIENT = 20;   // easy encouragement, form cues — never interrupts anything
const P_INFO = 40;      // step transitions, milestones
const P_KEY = 60;       // interval starts, halfway, final effort
const P_CRITICAL = 90;  // safety warnings — always interrupt

const ONESHOT = 36000;  // effectively once per session

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
