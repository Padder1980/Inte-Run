/**
 * The weekly review — one honest read of the week, and at most one thing to decide.
 *
 * ⚠️ THE RUNNER DECIDES. NOTHING HERE EVER CHANGES A PLAN. This module returns observations and,
 * at most, a single suggestion; applying it is always a separate, explicit tap. That is a standing
 * instruction from the owner (2026-08-03) and it is also the rule the rest of the app already
 * follows — "suggest, never impose". A coach who silently re-writes your paces on a Sunday night is
 * not a coach you can trust, and a runner who cannot see WHY cannot disagree with it.
 *
 * ⚠️ IT DOES NOT RE-IMPLEMENT THE ADAPTIVE ENGINE. `assessTrainingFlags` already decides whether
 * pace and effort evidence is strong enough to act on, and it carries four guards that each cost a
 * shipped bug: direction sanity, anchor stamping, per-kind muting and one-voice clearing. The 2 km
 * specification's §13 describes roughly the same behaviour in weaker terms; adopting its version
 * would be a downgrade wearing a newer date. This module CALLS the engine and frames its answer.
 *
 * What the review adds that a per-run flag cannot: a cadence. Flags fire when they fire, which for a
 * runner having a steady month is never — so the app goes quiet exactly when someone is training
 * consistently enough to be worth talking to. A weekly beat means the coach turns up whether or not
 * anything is wrong, which is what a real one does.
 */

import type { RunObservation, TrainingFlagsResult } from "./training-flags.ts";

/** A logged run, as the review needs it: the flags engine's view plus when and how it felt. */
export type ReviewRun = RunObservation & {
  /** ISO date (YYYY-MM-DD) the run happened on. */
  dateIso: string;
  /** Average heart rate, when a watch supplied one. */
  avgHr?: number | null;
  /** Seconds spent in each of the five zones, when a watch supplied them. */
  zoneSec?: number[] | null;
};

export type WeeklyReviewInput = {
  /** Every run in the week under review, any order. */
  runs: ReviewRun[];
  /** The engine's verdict on the runner's recent evidence. Pass it in; do not recompute here. */
  flags: TrainingFlagsResult;
  /** ISO date of the runner's most recent usable 2 km trial, if any. */
  lastTrialIso?: string | null;
  /** ISO date of the Monday the reviewed week began. */
  weekStartIso: string;
  /** Today, so "due" is decidable without reading the clock in here. */
  todayIso: string;
  /** True while the plan is tapering or racing — no maximal test belongs there. */
  inTaperOrRaceWeek?: boolean;
  /** The runner has reported illness, injury or pain. Blocks any suggestion to test. */
  unwell?: boolean;
  /**
   * Everything needed to decide whether to offer another running day. Absent means do not consider it —
   * a caller that cannot supply the evidence must not get the offer by default. See `addDayOffer`.
   */
  addDay?: AddDayInput;
};

export type WeeklyReview = {
  weekStartIso: string;
  /** Nothing to say. The caller should show nothing at all rather than an empty card. */
  quiet: boolean;
  runsLogged: number;
  /** Plain sentences about the week, in the order they matter. Never more than three. */
  observations: string[];
  /** At most ONE thing to decide, so the runner is never asked two questions at once. */
  suggestion: WeeklySuggestion | null;
};

export type WeeklySuggestion =
  | { kind: "adjust-paces"; direction: "faster" | "slower"; proposedRecent5kSeconds: number; basis: "pace" | "rpe"; why: string }
  | { kind: "easy-days-easier"; why: string }
  | { kind: "retest"; why: string }
  | { kind: "add-a-day"; from: number; to: number; why: string };

/**
 * Offering a fourth (or fifth, or sixth) running day.
 *
 * ⚠️ FREQUENCY IS THE ONE FITT AXIS THE PLAN NEVER PROGRESSED. The 2026-08-06 audit measured it flat in
 * 81.3% of blocks and never rising by even one day — because the runner picks their days at setup and
 * nothing ever revisits it. That is defensible for a generator and thin as coaching: adding a day is one
 * of the most effective progressions available, and the only way to get one was to edit your profile and
 * rebuild the whole plan yourself.
 *
 * ⚠️ IT ASKS. It never adds a day on its own — the owner's standing rule (2026-08-03) is that the app may
 * observe and propose and may never change a plan by itself. Accepting genuinely rewrites the weeks ahead
 * (his instruction, 2026-08-06: "it does need to change the weeks ahead; that's the whole point of the
 * app"), so the question has to be asked plainly and declining has to stick.
 *
 * ⚠️ EVERY REFUSAL BELOW IS A REAL ONE, the same rule `retestDue` follows. An offer to train more during
 * illness, in a taper, or to someone already missing sessions is the prompt doing harm — and it teaches
 * the runner to dismiss every future prompt, which costs more than this feature is worth.
 */
export type AddDayInput = {
  /** Running days the plan is currently built around. */
  daysPerWeek: number;
  /** The phase of the week being reviewed. */
  phase: "base" | "build" | "peak" | "taper";
  /** Whole weeks of plan left after this one. */
  weeksRemaining: number;
  /** Whole weeks the runner has been on this plan. */
  weeksOnPlan: number;
  /** Recent weeks, most recent last: how many runs the plan asked for and how many were logged. */
  recentWeeks: { prescribedRuns: number; completedRuns: number }[];
  experience: "beginner" | "recreational" | "competitive";
  returningFromInjury?: boolean;
  unwell?: boolean;
  /** ISO date the runner last said no, if they have. */
  lastDeclinedIso?: string | null;
  todayIso: string;
  /** True when the flags engine is already suggesting the runner eases off. */
  easingSuggested?: boolean;
};

/** Never offered automatically. Six days is a rest day a week; the seventh is a coached decision. */
export const ADD_DAY_MAX = 6;
/** A "no" is remembered for two months, not until tomorrow. */
export const ADD_DAY_COOLDOWN_DAYS = 56;
/** Below this there is not enough block left for another day to be worth the disruption. */
export const ADD_DAY_MIN_RUNWAY_WEEKS = 6;
/** And not before the runner has actually settled into the plan they have. */
export const ADD_DAY_MIN_WEEKS_ON_PLAN = 4;
/** Consistency bar: the evidence that the current load is being absorbed. */
export const ADD_DAY_MIN_COMPLETION = 0.85;
const ADD_DAY_WEEKS_OF_EVIDENCE = 3;

export function addDayOffer(input: AddDayInput): WeeklySuggestion | null {
  if (input.unwell || input.returningFromInjury) return null;
  // Beginners are on a deliberately gentle, capped track of their own; more days is not that track's
  // next step, and their plan does not read daysPerWeek the way this offer assumes.
  if (input.experience === "beginner") return null;
  if (input.daysPerWeek >= ADD_DAY_MAX) return null;
  // ⚠️ Never in a peak or a taper. Adding a running day in the sharpening weeks is the worst possible
  // moment for it: the block is at its biggest, and the change would land with no time to absorb it.
  if (input.phase === "peak" || input.phase === "taper") return null;
  if (input.weeksRemaining < ADD_DAY_MIN_RUNWAY_WEEKS) return null;
  if (input.weeksOnPlan < ADD_DAY_MIN_WEEKS_ON_PLAN) return null;
  // One voice: if the engine is already saying ease off, the app must not ask for more in the same breath.
  if (input.easingSuggested) return null;
  if (input.lastDeclinedIso && daysBetween(input.lastDeclinedIso, input.todayIso) < ADD_DAY_COOLDOWN_DAYS) return null;

  const weeks = input.recentWeeks.slice(-ADD_DAY_WEEKS_OF_EVIDENCE);
  if (weeks.length < ADD_DAY_WEEKS_OF_EVIDENCE) return null;
  const prescribed = weeks.reduce((a, w) => a + w.prescribedRuns, 0);
  const completed = weeks.reduce((a, w) => a + w.completedRuns, 0);
  if (prescribed <= 0) return null;
  // ⚠️ THE EVIDENCE IS COMPLETION, NOT ENTHUSIASM. Someone missing sessions does not need a fourth day;
  // they need the three they already have. This is the whole gate — without it the app would cheerfully
  // ask a struggling runner to do more, which is how a coaching app loses somebody.
  if (completed / prescribed < ADD_DAY_MIN_COMPLETION) return null;

  const to = input.daysPerWeek + 1;
  return {
    kind: "add-a-day",
    from: input.daysPerWeek,
    to,
    why: `You have run ${completed} of the last ${prescribed} sessions your plan asked for. `
      + `A ${to}th day is the next step available to you — more easy running, not more hard work.`,
  };
}

/** The specification's retest window (§14): often enough to catch real change, rarely enough that
 *  the test itself is not the training. */
export const RETEST_DUE_DAYS = 28;

function daysBetween(aIso: string, bIso: string): number {
  const a = Date.parse(aIso + "T00:00:00Z"), b = Date.parse(bIso + "T00:00:00Z");
  if (!isFinite(a) || !isFinite(b)) return 0;
  return Math.round((b - a) / 86400000);
}

/**
 * Is a 2 km retest worth offering? (§14, plus the safety gates of §3.2.)
 *
 * ⚠️ EVERY "no" here is a real one, not politeness. A maximal effort during illness, in a taper or
 * on top of a hard week is the test doing harm — and offering it anyway teaches the runner to
 * ignore the app's prompts, which is worse than never prompting.
 */
export function retestDue(input: Pick<WeeklyReviewInput, "lastTrialIso" | "todayIso" | "inTaperOrRaceWeek" | "unwell" | "runs">): boolean {
  if (input.unwell || input.inTaperOrRaceWeek) return false;
  // Somebody who has barely run does not need a maximal test; they need to run.
  if (input.runs.filter((r) => r.distKm > 0).length < 2) return false;
  if (!input.lastTrialIso) return true;
  return daysBetween(input.lastTrialIso, input.todayIso) >= RETEST_DUE_DAYS;
}

/**
 * Heart rate, used the way the evidence supports: as CONFIRMATION, never as the lead.
 *
 * ⚠️ HR NEVER DRIVES A PACE CHANGE ON ITS OWN, and this is a research position rather than a
 * preference. Heart rate at a given pace moves with heat, dehydration, caffeine, sleep, altitude
 * and cardiac drift within a single run — all of which look exactly like a fitness change over a
 * week. Pace against a known target and reported effort are the two signals that mean what they
 * appear to mean. So this returns a SENTENCE, never a suggestion.
 */
function heartRateNote(runs: ReviewRun[]): string | null {
  const easy = runs.filter((r) => (r.type === "easy" || r.type === "recovery") && r.avgHr && r.avgHr > 0);
  if (easy.length < 2) return null;
  const withZone = easy.filter((r) => Array.isArray(r.zoneSec) && r.zoneSec.some((s) => s > 0));
  if (withZone.length < 2) return null;
  // How much of the easy running actually sat in the two easiest zones.
  let low = 0, total = 0;
  for (const r of withZone) {
    const z = r.zoneSec as number[];
    const t = z.reduce((a, b) => a + b, 0);
    low += (z[0] || 0) + (z[1] || 0); total += t;
  }
  if (total < 600) return null;
  const pct = Math.round((low / total) * 100);
  if (pct >= 65) return "Your easy runs sat mostly in the two lowest heart-rate zones, which is what easy is supposed to look like.";
  return "Your heart rate on easy runs spent more time in the middle zones than easy running usually does — worth watching, though heat and tiredness move it around too.";
}

export function buildWeeklyReview(input: WeeklyReviewInput): WeeklyReview {
  const runs = input.runs.filter((r) => r && r.distKm >= 0);
  const observations: string[] = [];
  const km = runs.reduce((a, r) => a + (r.distKm || 0), 0);

  if (runs.length) {
    const rounded = Math.round(km * 10) / 10;
    observations.push(
      runs.length === 1
        ? `One run this week, ${rounded} km.`
        : `${runs.length} runs this week, ${rounded} km in total.`,
    );
  }

  // ⚠️ The flags engine's answer is REPORTED, not recomputed. Its evidence is already gated on two
  // or more consecutive qualifying runs, which is the "do not change zones after one anomalous
  // workout" rule the specification asks for — and it was written before the specification existed.
  let suggestion: WeeklySuggestion | null = null;
  const s = input.flags.suggestion;
  if (s && s.action === "anchor") {
    const faster = s.direction === "faster";
    observations.push(
      s.basis === "pace"
        ? (faster
          ? "Your sessions have been landing quicker than the paces asked for, more than once."
          : "Your sessions have been landing slower than the paces asked for, more than once.")
        : (faster
          ? "You have been reporting these sessions as easier than they were meant to feel."
          : "You have been reporting these sessions as harder than they were meant to feel."),
    );
    suggestion = {
      kind: "adjust-paces", direction: s.direction,
      proposedRecent5kSeconds: s.proposedRecent5kSeconds, basis: s.basis,
      why: faster
        ? "Your paces may be set a little conservatively for where you are now."
        : "Your paces may be set a little quick for where you are now.",
    };
  } else if (s && s.action === "advice-easy-days") {
    suggestion = { kind: "easy-days-easier", why: "Your easy days are being run harder than they are meant to be, which is the most common way to end up tired rather than fitter." };
    observations.push("Your easy running has been coming in harder than the plan intends.");
  }

  const hr = heartRateNote(runs);
  if (hr) observations.push(hr);

  // ⚠️ ONE QUESTION AT A TIME. A retest is only offered when there is no pace suggestion pending:
  // asking someone to both re-test and accept a pace change in the same breath guarantees that one
  // of the two gets dismissed unread, and the app has no way of knowing which.
  if (!suggestion && retestDue(input)) {
    suggestion = {
      kind: "retest",
      why: input.lastTrialIso
        ? "It has been about a month since your last 2 km. Repeating it is the cleanest way to see whether your training has actually moved your fitness."
        : "A hard 2 km would let your plan calibrate to the runner you are now rather than the times you first entered.",
    };
  }

  // ⚠️ LAST IN THE ORDER, AND THAT IS THE POINT. Adding a running day is the biggest change the review
  // can propose — it rewrites every week ahead — so it only ever gets asked in a week where there is
  // nothing more immediate to settle. A pace change is about work already done and wins; a retest
  // answers a question about the runner now and wins. This is about months from now, and can wait a week.
  if (!suggestion && input.addDay) {
    const offer = addDayOffer(input.addDay);
    if (offer) {
      suggestion = offer;
      observations.push("You have been getting your sessions done consistently.");
    }
  }

  return {
    weekStartIso: input.weekStartIso,
    // ⚠️ Silence is a valid answer. A weekly card that always appears, with nothing in it, becomes
    // wallpaper — and then the week it DOES matter, it is not read either.
    quiet: runs.length === 0 || (observations.length <= 1 && !suggestion),
    runsLogged: runs.length,
    observations: observations.slice(0, 3),
    suggestion,
  };
}
