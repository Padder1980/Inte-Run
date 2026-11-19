// Easing a week: the one definition, with two callers.
//
// Rule from the brief: if the athlete misses two sessions in a row, get them back on track — do NOT
// cram the missed work on top. The adjustment eases the upcoming week (drop the hardest session,
// trim the long run and easy volume) so re-entry is gentle, then normal progression resumes.
//
// ⚠️ AND THE SAME SHAPE IS WHAT HUDSON'S ch7 PRESCRIBES FOR A RUNNER WHO WANTS AN EASIER WEEK ON
// DEMAND: "they can just take a day off or REPLACE A HARD RUN WITH AN EASY RUN as necessary". So
// `easeWeek` is the mechanism and the two callers differ only in what triggered it — `applyMissedSessionAdjustment`
// owns the two-misses gate, and the app's own "make a week easier" control asks for it directly.
// ⚠️ THE GATE BELONGS TO THE CALLER, NOT TO THE MECHANISM. Written the other way round, a runner-
// initiated easier week would have to fake two missed sessions to get one — lying to the function to
// get the behaviour, and the wording ("after missed sessions") would then be false on screen.
//
// ⚠️ IT SUBSTITUTES; IT NEVER DELETES, and that is the whole reason it exists. Every level the app
// could already offer is a FILTER (`adjDrops`), so the shallowest easing a runner could reach took
// 57% off their week when a scheduled recovery week takes 25%. Measured, this takes 20-21% — inside
// the book's own "20-to 30-percent reduction in mileage" — and leaves the session COUNT unchanged.
//
// ⚠️⚠️ AND THE TRIM IS REAL (2026-11-18). It used to scale only the FIGURES (scaleSessionDistance plus the estimate), so
// the runs the runner actually runs — the steps the live run, the voice coach and the watch follow — and their titles
// stayed exactly as they were: an eased "58′ long run" still ran 58 minutes under a week summary saying 46, and a
// walk-run or Rebuild week, which has no hard session to swap, was not easier at all. `shortenSession` now shortens the
// steps and derives the minutes, kilometres and title from them. The owner chose what easier means for a run–walk
// session — "Shorter runs, same walks" — and that a walk-run KEY RUN in an easier week "Stays as it is".

import type { PlannedWeek, Session, SessionOutcome } from "../domain/types.ts";
import { weekVolumeMeters } from "../domain/steps.ts";
import { shortenSession } from "../plan/session-templates.ts";

export type MissedSessionResult = {
  triggered: boolean;
  changes: string[];
  week: PlannedWeek;
};

/** Number of consecutive not-completed outcomes at the end of the log. */
export function countTrailingMisses(outcomes: SessionOutcome[]): number {
  let n = 0;
  for (let i = outcomes.length - 1; i >= 0; i--) {
    if (outcomes[i]!.completed) break;
    n++;
  }
  return n;
}

const EASY_SCALE = 0.85;
const LONG_SCALE = 0.8;
/** How close an easy run may come to the long run (keepLongRunLongest). */
const LONGEST_MARGIN = 0.95;
const EASY_RUN_TYPES = new Set(["easy", "recovery", "strides"]);
const HARDNESS = { vo2: 3, "race-specific": 2, threshold: 1 } as const;

/** Why a week is being eased. Decides the wording only — the arithmetic is identical.
 *  "race" (stage B7): the week before a smaller race inside the plan, so the runner arrives at it fresh. */
export type EaseReason = "missed" | "chosen" | "race";

export function applyMissedSessionAdjustment(
  week: PlannedWeek,
  outcomes: SessionOutcome[],
): MissedSessionResult {
  const misses = countTrailingMisses(outcomes);
  if (misses < 2) {
    return { triggered: false, changes: [], week };
  }
  return easeWeek(week, "missed");
}

/**
 * Take roughly a fifth out of one week by SUBSTITUTING its hardest session for an easy run and
 * trimming the long run and the easy volume. The session count does not change.
 *
 * ⚠️ `triggered` IS FALSE WHEN THERE WAS NOTHING TO EASE, and the caller must honour that rather than
 * reporting success. A rest week, or a week whose only sessions are strength and mobility, has no
 * hardest session, no long run and no easy running — so nothing changes and telling the runner their
 * week is now easier would be false.
 * ⚠️ THE GOAL RACE IS NEVER DEMOTED. `HARDNESS` scores only threshold/vo2/race-specific, so
 * `hardestSessionId` cannot pick it, and a `race` session matches none of the branches below and is
 * returned untouched — the same rule `adjDrops` keeps for the app's own levels.
 */
export function easeWeek(week: PlannedWeek, reason: EaseReason = "chosen"): MissedSessionResult {
  const changes: string[] = [];
  const easyPace = findEasyPace(week);

  // Demote the single hardest quality session to an easy run (no cramming, gentle re-entry).
  const hardestId = hardestSessionId(week);
  const trimmed: Session[] = week.sessions.map((s) => {
    if (s.id === hardestId) {
      changes.push(
        reason === "missed"
          ? `Replaced "${s.title}" with an easy run to ease back in after missed sessions.`
          : reason === "race"
            ? `Swapped "${s.title}" for an easy run, so you arrive at your race fresh.`
            : `Swapped "${s.title}" for an easy run of about the same effort as the rest of the week.`,
      );
      const minutes = Math.round((s.estimatedDurationSeconds / 60) * 0.7) || 35;
      return {
        ...s,
        type: "easy",
        // ⚠️ THE TITLE AND THE DESCRIPTION VARY BY REASON TOO, and this was found by driving the real
        // control rather than the function: a runner who chose an easier week was handed a session
        // called "31′ easy (eased re-entry)" when they had missed nothing. A derived string that does
        // not follow its own reason is the stale-derived-fact trap, and it is the text the runner reads.
        title: reason === "missed"
          ? `${minutes}′ easy (eased re-entry)`
          : reason === "race"
            ? `${minutes}′ easy (race next week)`
            : `${minutes}′ easy (easier week)`,
        description: reason === "missed"
          ? "Reintroduce running gently after a break — quality resumes next week."
          : reason === "race"
            ? "An easier week before your race — keep it conversational, so you arrive fresh."
            : "An easier week by choice — keep it conversational. Normal training resumes next week.",
        intensity: "easy",
        estimatedDurationSeconds: minutes * 60,
        estimatedDistanceMeters: easyPace
          ? Math.round(((minutes * 60) / easyPace) * 1000)
          : s.estimatedDistanceMeters,
        // ⚠️ The replacement is a single steady step — no warm-up, no cool-down — so all of it is
        // training. Inheriting the demoted session's `trainingDistanceMeters` would leave the week
        // counting a workout that is no longer prescribed.
        trainingDistanceMeters: easyPace
          ? Math.round(((minutes * 60) / easyPace) * 1000)
          : s.trainingDistanceMeters,
        steps: [
          {
            kind: "steady",
            label: "Conversational easy running",
            durationSeconds: minutes * 60,
            targetRpe: { min: 2, max: 3 },
          },
        ],
        targetRpe: { min: 2, max: 3 },
      };
    }
    // ⚠️ A WALK-RUN KEY RUN STAYS AS IT IS — the owner's ruling of 2026-11-18, asked whether an easier week should hold
    // the test back a week or keep it: "Stays as it is". It is the run the block's checkpoint looks for (20, then 30
    // minutes without stopping), so the rest of the week gets easier and the checkpoint can still be passed in it.
    if (s.keyRun) return s;
    if (s.type === "long") return shortenSession(s, LONG_SCALE);
    if (s.intensity === "easy") return shortenSession(s, EASY_SCALE);
    return s;
  });

  // ⚠️⚠️ THE LONG RUN STAYS THE LONGEST RUN OF THE WEEK — the owner's ruling of 2026-10-05 ("Easier weeks: keep the
  // long run the longest run"), chosen over the book's 30% band where the two disagree. keepLongRunLongest records
  // where they do; test/ease-week.test.ts holds the band everywhere else.
  // ⚠️ AND WHERE AN EASY RUN CANNOT GET ANY SHORTER, THE LONG RUN GIVES UP SOME OF ITS TRIM. Shortened for real, a run
  // stops at its floor (ten minutes, in the owner's five-minute steps; shortenSession), so a tiny beginner week can hold a
  // "10′ easy + gentle pickups" that no hold can bring under a long run trimmed from 13′ to 10′ — measured 2026-11-18,
  // 5k/3d/beginner week 4. On paper the old trim passed; on the road the easy run was the longer one. Both of the owner's
  // rules hold this way: the long run stays the longest run, and the run stays on a multiple of five minutes.
  const longAt = trimmed.findIndex((s) => s.type === "long");
  const longWas = week.sessions[longAt];
  let sessions = keepLongRunLongest(trimmed);
  let longGave = false;
  for (let f = LONG_SCALE + 0.05; longWas && longestBroken(sessions) && f < 1.001; f += 0.05) {
    const t2 = trimmed.slice();
    t2[longAt] = f > 0.999 ? longWas : shortenSession(longWas, f);
    sessions = keepLongRunLongest(t2);
    longGave = true;
  }
  const heldEasy = sessions.some((s, i) => s !== trimmed[i] && s.type !== "long");
  if (heldEasy || longGave) {
    changes.push(heldEasy && longGave
      ? "Kept your long run the longest run of the week: it is trimmed a little less, and an easy run is a little shorter too."
      : heldEasy
        ? "Kept your long run the longest run of the week, so an easy run is a little shorter too."
        : "Kept your long run the longest run of the week, so it is trimmed a little less.");
  }

  // ⚠️ SAY ONLY WHAT WAS TRIMMED. A walk-run week has no long run, and a run already at its floor is left as it was —
  // "trimmed the long run" over a week without one is the stale-derived-fact trap in the engine's own words.
  const cutLong = sessions.some((s, i) => s !== week.sessions[i] && s.id !== hardestId && s.type === "long");
  const cutEasy = sessions.some((s, i) => s !== week.sessions[i] && s.id !== hardestId && s.type !== "long");
  const what = cutLong && cutEasy ? "the long run ~20% and easy volume ~15%"
    : cutLong ? "the long run ~20%" : cutEasy ? "easy running ~15%" : "";
  if (what) {
    changes.push(
      reason === "missed"
        ? `Trimmed ${what} this week; missed sessions are not added back.`
        : reason === "race"
          ? `Trimmed ${what} this week, so you arrive at your race fresh.`
          : `Trimmed ${what} this week. Next week picks up where it left off.`,
    );
  }
  const key = week.sessions.find((s) => s.keyRun);
  if (key?.keyRun) changes.push(`Kept your key run as it is: ${key.keyRun.minutes} minutes without stopping.`);

  const plannedDistanceMeters = weekVolumeMeters(sessions);
  const qualitySessionCount = sessions.filter(
    (s) => s.type === "threshold" || s.type === "vo2" || s.type === "race-specific",
  ).length;

  // ⚠️ NOTHING CHANGED MEANS NOTHING CHANGED. A rest week or a strength-and-mobility-only week has no
  // hardest session, no long run and no easy running, so every branch above returned the session
  // untouched — and `triggered: true` there would put "this week is easier now" over an identical week.
  const moved = sessions.some((s, i) => s !== week.sessions[i]);
  if (!moved) return { triggered: false, changes: [], week };

  return {
    triggered: true,
    changes,
    week: {
      ...week,
      sessions,
      plannedDistanceMeters,
      qualitySessionCount,
      focus: reason === "missed"
        ? "Re-entry — ease back after missed sessions"
        : reason === "race"
          ? "Easier week — so you arrive at your race fresh"
          : "Easier week — volume down, nothing added back",
    },
  };
}

/**
 * Hold every easy run of a week just under its long run, on both rulers this repo measures a run by (the
 * outing's distance and the training distance) — the owner's rule, "the long run is meant to be the longest run
 * of the week" (pc-longshort).
 * ⚠️ WHY IT EXISTS. An eased week trims the long run by a fifth, easy running by a seventh, and turns the demoted
 * session into an easy run of 70% of ITS length, so it could come out with an easy run longer than its long run:
 * measured over the B-race axis of the progression audit, 148 such weeks became 217 once the week before a B-race
 * was eased (stage B7), worst 1.33x — a slow 5K runner's "50′ easy" of 9.6 km beside an 8.2 km long run.
 * ⚠️⚠️ AND WHAT IT COSTS, WHICH THE OWNER WEIGHED. Holding the run under the long run takes time, and in a handful of
 * weeks (slow 5K base weeks, where the threshold session outlasts the long run) that takes an eased week past the
 * book's 20-30% band: 13 of 3,360 weeks over 28%, the deepest 32.2%. Asked which rule wins, the owner ruled on
 * 2026-10-05: "Easier weeks: keep the long run the longest run". So easeWeek calls this for every caller — Make a
 * week easier, both comeback offers (B5, B6) and the week before a B-race (B7).
 */
export function keepLongRunLongest(sessions: Session[]): Session[] {
  const long = sessions.find((s) => s.type === "long");
  if (!long) return sessions;
  return sessions.map((s) => {
    if (!heldUnder(s, long)) return s;
    let f = 1;
    const cap = (mine: number | undefined, theirs: number | undefined) => {
      if (mine && theirs && mine > theirs * LONGEST_MARGIN) f = Math.min(f, (theirs * LONGEST_MARGIN) / mine);
    };
    cap(s.estimatedDistanceMeters, long.estimatedDistanceMeters);
    cap(s.trainingDistanceMeters, long.trainingDistanceMeters);
    if (f >= 1) return s;
    // ⚠️ SHORTENED FOR REAL AND ROUNDED DOWN, so the hold is true of the run as prescribed, not of a figure beside it
    // (shortenSession). Its strides or hill sprints are kept, so one pass can land a unit over: tighten until it holds.
    let out = shortenSession(s, f, "down");
    for (let k = 1; k <= 10 && pastLong(out, long); k++) out = shortenSession(s, f - 0.02 * k, "down");
    return out;
  });
}

/** An easy run the hold keeps under the long run (never the long run itself, nor a walk-run key run). */
function heldUnder(s: Session, long: Session): boolean {
  return s !== long && !s.keyRun && s.intensity === "easy" && EASY_RUN_TYPES.has(s.type);
}
/** Is this run longer than the long run allows (LONGEST_MARGIN), on either ruler? */
function pastLong(s: Session, long: Session): boolean {
  const over = (mine: number | undefined, theirs: number | undefined) => !!(mine && theirs && mine > theirs * LONGEST_MARGIN);
  return over(s.estimatedDistanceMeters, long.estimatedDistanceMeters) || over(s.trainingDistanceMeters, long.trainingDistanceMeters);
}
/** Is an easy run still past the long run — one keepLongRunLongest could not shorten enough (it sits at its floor)? */
function longestBroken(sessions: Session[]): boolean {
  const long = sessions.find((s) => s.type === "long");
  return !!long && sessions.some((s) => heldUnder(s, long) && pastLong(s, long));
}

function hardestSessionId(week: PlannedWeek): string | undefined {
  let best: { id: string; score: number } | undefined;
  for (const s of week.sessions) {
    const score = (HARDNESS as Record<string, number>)[s.type] ?? 0;
    if (score > 0 && (!best || score > best.score)) best = { id: s.id, score };
  }
  return best?.id;
}

/** Seconds-per-km of an easy step already present in the week, for rebuilding a demoted session. */
function findEasyPace(week: PlannedWeek): number | undefined {
  for (const s of week.sessions) {
    if (s.intensity !== "easy") continue;
    for (const step of s.steps) {
      if (step.targetPaceSecPerKm) {
        return (step.targetPaceSecPerKm.minSecPerKm + step.targetPaceSecPerKm.maxSecPerKm) / 2;
      }
    }
  }
  return undefined;
}
