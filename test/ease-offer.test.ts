// THE APP NOTICES WHEN A WEEK IS WORTH EASING (owner, 2026-09-02: "go")
//
// The last piece of Hudson's ch7 sentence. The scheduled recovery week went for a low-mileage 5k/10k
// runner; "Make a week easier" gave every runner the manual control; this is the app OFFERING one.
//
// ⚠️⚠️ THREE DETECTORS THAT HAD ZERO CALLERS SINCE THEY WERE WRITTEN: `assessWeeklyJump`,
// `assessLongRunSpike` and `countTrailingMisses`. The progression audit's complaint about the first
// ("it compares the planned week to LAST WEEK in KILOMETRES") was about using it to audit the PLAN
// AGAINST ITSELF — a different question, and one the generator already guards. Pointed at the RUNNER
// they are right as written: `longestRunLast30dKm` asks for the runner's own last 30 days in as many
// words. A plan can be internally smooth and still be a large step for somebody who has missed half
// of the last month.
//
// ⚠️⚠️ AND THE SHORTFALL IS THE TRIGGER, NOT THE SIZE OF THE STEP. Measured before that gate existed,
// the offer fired on 5.1% of weeks for a runner doing 100% of their plan. The cause is not a threshold
// needing a nudge: A PROGRESSIVE PLAN MEANS EVERY WEEK IS BIGGER THAN THE TRAILING MEAN, so "next week
// is 30% up on your four-week average" is positive by design for a perfect runner. Worse, both
// detectors' thresholds sit ON the generator's own guardrails — `assessLongRunSpike` fires above 1.10
// and `LONG_LIFT_STEP_MAX` clamps the ladder AT 1.10, so an on-plan runner trips it on rounding.
//
// MEASURED ACROSS 2,256 WEEKS PER ROW (4 distances x 3-6 days x 3 experiences x 3 abilities), with a
// seeded per-session coin flip for adherence:
//   100% of sessions   SILENT 100.0%
//    95%               SILENT  96.2%   missed  0.4%  jump  3.4%  long-run 0.0%
//    85%               SILENT  71.2%   missed  2.0%  jump 26.5%  long-run 0.3%
//    70%               SILENT  34.0%   missed  8.3%  jump 57.5%  long-run 0.1%
//    50%               SILENT  17.5%   missed 19.9%  jump 62.5%  long-run 0.1%
// ⚠️ MY FIRST PROBE'S ADHERENCE MODEL WAS BROKEN and reported 7 trailing misses at EVERY level: it used
// ((k*997)%100)/100 < adherence, a fixed descending pattern that always put the misses at the END. It
// could never produce the realistic case of a couple of recent misses. A seeded RNG replaced it.
import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import type { Athlete, Goal, SessionOutcome } from "../src/domain/types.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import { weekVolumeMeters } from "../src/domain/steps.ts";
import {
  easeOffer, buildWeeklyReview, retestDue,
  EASE_WEEKS_OF_EVIDENCE, EASE_COOLDOWN_DAYS, EASE_MIN_MISSES, EASE_MAX_COMPLETION,
  ADD_DAY_MIN_COMPLETION,
} from "../src/adapt/weekly-review.ts";

const RUNNABLE = new Set(["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific", "race"]);
const outcomes = (completedTail: boolean[]) => completedTail.map((c) => ({ completed: c })) as SessionOutcome[];
const weeksAt = (done: number, of: number) =>
  Array.from({ length: EASE_WEEKS_OF_EVIDENCE }, () => ({ prescribedRuns: of, completedRuns: done }));

/** A runner who is keeping up: full completion, actuals matching the plan. */
const keepingUp = (o: Partial<Parameters<typeof easeOffer>[0]> = {}) => easeOffer({
  plannedWeekKm: 46, plannedLongestRunKm: 18,
  actualWeeksKm: [40, 42, 41, 43], longestRunLast30dKm: 17,
  recentWeeks: weeksAt(5, 5), recentOutcomes: outcomes([true, true, true]),
  phase: "build", todayIso: "2026-11-01", ...o,
});
/** The same runner, but they have only been getting about half of it done. */
const shortfall = (o: Partial<Parameters<typeof easeOffer>[0]> = {}) => easeOffer({
  plannedWeekKm: 46, plannedLongestRunKm: 18,
  actualWeeksKm: [20, 22, 19, 21], longestRunLast30dKm: 10,
  recentWeeks: weeksAt(2, 5), recentOutcomes: outcomes([true, true, true]),
  phase: "build", todayIso: "2026-11-01", ...o,
});

test("BLOCKER: silent for a runner who is keeping up, at every step size", () => {
  // ⚠️ THE NUMBER THAT MATTERS. An offer that fires on somebody doing everything right is noise, and
  // noise in a weekly card is how the card stops being read. Swept over step sizes far past anything
  // the generator produces: the plan's own worst measured km jump is 1.36x, and none of these fires.
  for (const plannedWeekKm of [44, 50, 60, 80, 120]) {
    for (const plannedLongestRunKm of [16, 20, 26, 34]) {
      const r = keepingUp({ plannedWeekKm, plannedLongestRunKm });
      assert.equal(r, null,
        `a runner completing every session was offered an easier week for a ${plannedWeekKm} km week ` +
        `with a ${plannedLongestRunKm} km long run: ${r ? r.basis + " — " + r.why : ""}`);
    }
  }
  // ...and the same runner WITH a shortfall is offered one, or the sweep above proves nothing.
  assert.ok(shortfall(), "the fixture cannot produce an offer at all, so the silence above is vacuous");
});

test("BLOCKER: the SHORTFALL is the trigger, not the size of the step", () => {
  // Identical plan week; the only difference is whether the runner has been getting it done.
  const step = { plannedWeekKm: 60, plannedLongestRunKm: 24 };
  assert.equal(keepingUp(step), null, "a big step alone triggered the offer");
  assert.ok(shortfall(step), "a big step with a real shortfall did not trigger it");
  // ⚠️ AND THE LINE IS ADD_DAY_MIN_COMPLETION READ FROM THE OTHER SIDE — one number, two directions.
  // Two constants for one line would be two answers to "is this runner keeping up".
  assert.equal(EASE_MAX_COMPLETION, ADD_DAY_MIN_COMPLETION,
    "the easier-week bar and the extra-day bar are different numbers, so the app has two opinions " +
    "about whether the same runner is keeping up");
  // just above the line: silent. just below: offered.
  assert.equal(easeOffer({ plannedWeekKm: 60, plannedLongestRunKm: 24, actualWeeksKm: [20, 22, 19, 21],
    longestRunLast30dKm: 10, recentWeeks: weeksAt(9, 10), recentOutcomes: outcomes([true, true]),
    phase: "build", todayIso: "2026-11-01" }), null, "90% completion was treated as a shortfall");
  assert.ok(easeOffer({ plannedWeekKm: 60, plannedLongestRunKm: 24, actualWeeksKm: [20, 22, 19, 21],
    longestRunLast30dKm: 10, recentWeeks: weeksAt(8, 10), recentOutcomes: outcomes([true, true]),
    phase: "build", todayIso: "2026-11-01" }), "80% completion was not treated as a shortfall");
});

test("BLOCKER: two missed sessions in a row fire on their own, and one does not", () => {
  // ⚠️ THIS SIGNAL NEEDS NO WINDOW AND IS CHECKED FIRST: the runner already knows they missed them, so
  // it is the most credible thing to lead with. It is also the signal applyMissedSessionAdjustment was
  // written for — and that function APPLIES its adjustment on the spot, which this app's standing
  // instruction forbids ("the app may observe and it may propose; it may never change a pace, a plan or
  // a target on its own"). So its DETECTOR raises the offer and its MECHANISM runs only on accept.
  const missed = (n: number) => keepingUp({
    recentOutcomes: outcomes([...Array.from({ length: 4 }, () => true), ...Array.from({ length: n }, () => false)]),
  });
  assert.equal(missed(0), null, "no misses triggered the offer");
  assert.equal(missed(EASE_MIN_MISSES - 1), null, "one missed session triggered the offer");
  const two = missed(EASE_MIN_MISSES);
  assert.ok(two, "two missed sessions did not trigger the offer");
  assert.equal(two!.basis, "missed", "two missed sessions were reported as something else");
  assert.match(two!.why, /missed your last 2 sessions/, "the offer does not name the evidence");
  // ⚠️ AND IT FIRES WITHOUT THE FOUR-WEEK WINDOW, which is what "on their own" means.
  const noHistory = easeOffer({ plannedWeekKm: 46, plannedLongestRunKm: 18, actualWeeksKm: [],
    longestRunLast30dKm: 0, recentWeeks: [], recentOutcomes: outcomes([false, false]),
    phase: "build", todayIso: "2026-11-01" });
  assert.ok(noHistory && noHistory.basis === "missed",
    "the missed-session signal needs a history window it should not need");
});

test("BLOCKER: four weeks of evidence or nothing", () => {
  // ⚠️ THE WINDOW IS THE GUARD. This repo has measured what a shorter one does: allowing short windows
  // gave 315 breaches with a worst case of 1.897x AT WEEK 2 — week 2 against week 1 alone — against 94
  // and 1.549x windowed properly. A single light week (a deload the runner did as asked) moves a
  // four-week mean by about 7%, nowhere near the threshold, so the window is also what stops the offer
  // firing on a plan working correctly.
  assert.equal(EASE_WEEKS_OF_EVIDENCE, 4, "the evidence window is no longer four weeks");
  for (const n of [0, 1, 2, 3]) {
    const r = easeOffer({ plannedWeekKm: 46, plannedLongestRunKm: 18,
      actualWeeksKm: Array.from({ length: n }, () => 20), longestRunLast30dKm: 10,
      recentWeeks: Array.from({ length: n }, () => ({ prescribedRuns: 5, completedRuns: 2 })),
      recentOutcomes: outcomes([true, true]), phase: "build", todayIso: "2026-11-01" });
    assert.equal(r, null, `${n} weeks of history was enough to judge the runner`);
  }
  assert.ok(shortfall(), "four weeks is not enough either, so the guard above proves nothing");
});

test("BLOCKER: a taper week and an already-eased week are refused", () => {
  // A taper is already eased, so offering to ease it offers to undo the plan's own sharpening at the
  // worst possible moment — and easeWeek reports nothing to ease for a bare race week, by which point
  // the question is already on the screen.
  assert.equal(shortfall({ phase: "taper" }), null, "a taper week was offered an easier week");
  assert.equal(shortfall({ alreadyEased: true }), null, "an already-eased week was offered again");
  for (const phase of ["base", "build", "peak"] as const)
    assert.ok(shortfall({ phase }), `${phase} was refused, so the taper refusal proves nothing`);
});

test("BLOCKER: BOTH answers cool the question down for a fortnight", () => {
  // ⚠️ EITHER WAY, AND NOT addDayOffer's DECLINE-ONLY. A runner at 50% adherence would otherwise be
  // offered an easier week, accept it, and be offered another one seven days later — and a plan eased
  // every week is not a plan.
  const ago = (n: number) => {
    const d = new Date("2026-11-01T00:00:00Z");
    d.setUTCDate(d.getUTCDate() - n);
    return d.toISOString().slice(0, 10);
  };
  assert.ok(shortfall({ lastAnsweredIso: null }), "an unanswered question was suppressed");
  for (const n of [0, 1, 7, EASE_COOLDOWN_DAYS - 1])
    assert.equal(shortfall({ lastAnsweredIso: ago(n) }), null,
      `answered ${n} days ago and it was asked again inside the ${EASE_COOLDOWN_DAYS}-day cooldown`);
  assert.ok(shortfall({ lastAnsweredIso: ago(EASE_COOLDOWN_DAYS + 1) }),
    "a runner still short a fortnight later is never asked again");
});

test("BLOCKER: it is NOT gated on unwell — that is the opposite of the retest", () => {
  // ⚠️ BEING UNWELL IS A REASON TO EASE A WEEK, NOT A REASON TO WITHHOLD THE OFFER. What must never be
  // offered to somebody unwell is a MAXIMAL EFFORT, which is why retestDue refuses and this does not.
  // The input carries no `unwell` field at all, so this is asserted at the type's own shape.
  const src = readFileSync(new URL("../src/adapt/weekly-review.ts", import.meta.url), "utf8");
  const at = src.indexOf("export type EaseWeekInput");
  const block = src.slice(at, src.indexOf("};", at));
  assert.ok(at > 0 && block.length > 100, "EaseWeekInput was not found");
  assert.ok(!/\bunwell\b/.test(block),
    "EaseWeekInput takes an `unwell` flag, which would withhold an easier week from exactly the runner " +
    "who needs one");
  // ...and the retest DOES refuse, or the contrast is not a contrast.
  const runs = [{ id: "a", type: "easy", distKm: 6, dateIso: "2026-10-28" },
    { id: "b", type: "easy", distKm: 6, dateIso: "2026-10-30" }] as never;
  assert.equal(retestDue({ runs, lastTrialIso: null, todayIso: "2026-11-01", unwell: true }), false,
    "the retest is offered to somebody unwell");
});

test("BLOCKER: the long-run signal is reachable and catches a case the jump does not", () => {
  // ⚠️ MEASURED AT 0.1-0.3% ACROSS THE GRID, which is rare enough to ask whether it is dead code. It is
  // not: its distinct case is a runner whose weekly volume has held up but who has been skipping the
  // LONG RUN specifically, which is the session people skip most.
  const skippedLongRuns = easeOffer({
    plannedWeekKm: 42, plannedLongestRunKm: 18,
    actualWeeksKm: [40, 41, 40, 41], longestRunLast30dKm: 10,
    recentWeeks: weeksAt(4, 5), recentOutcomes: outcomes([true, true]),
    phase: "build", todayIso: "2026-11-01",
  });
  assert.ok(skippedLongRuns, "a runner skipping their long runs was not offered an easier week");
  assert.equal(skippedLongRuns!.basis, "long-run",
    "the long-run signal is unreachable — the jump signal covers its case first, so it is dead code");
  assert.match(skippedLongRuns!.why, /longer than anything you have run in the past month/);
  // the control: same volume, long runs done too
  assert.equal(easeOffer({ plannedWeekKm: 42, plannedLongestRunKm: 18,
    actualWeeksKm: [40, 41, 40, 41], longestRunLast30dKm: 17,
    recentWeeks: weeksAt(5, 5), recentOutcomes: outcomes([true, true]),
    phase: "build", todayIso: "2026-11-01" }), null,
    "a runner doing their long runs was offered an easier week anyway");
});

test("BLOCKER: it comes BEFORE the retest and add-a-day in the review's order", () => {
  // ⚠️⚠️ A SAFETY CLAIM RATHER THAN A PREFERENCE. A retest asks for a MAXIMAL 2 km effort; offering one
  // in a week the app has just decided is a large step for this runner is the prompt doing harm. And
  // being ahead of add-a-day means a runner who is not absorbing the current load is never asked to do
  // MORE in the same breath, without add-a-day needing a second refusal for it.
  const runs = [
    { id: "a", type: "easy", distKm: 6, dateIso: "2026-10-27" },
    { id: "b", type: "easy", distKm: 6, dateIso: "2026-10-29" },
  ] as never;
  const base = {
    runs, flags: { flags: [], suggestion: null }, weekStartIso: "2026-10-26", todayIso: "2026-11-01",
    lastTrialIso: null,
  } as never as Parameters<typeof buildWeeklyReview>[0];
  const easeInput = {
    plannedWeekKm: 46, plannedLongestRunKm: 18, actualWeeksKm: [20, 22, 19, 21],
    longestRunLast30dKm: 10, recentWeeks: weeksAt(2, 5), recentOutcomes: outcomes([true, true]),
    phase: "build" as const, todayIso: "2026-11-01",
  };
  // With no ease evidence the review offers the retest (nothing else is pending).
  const without = buildWeeklyReview({ ...base });
  assert.equal(without.suggestion?.kind, "retest",
    "the fixture does not reach the retest, so the ordering claim below is untestable");
  // With it, the easier week wins.
  const withEase = buildWeeklyReview({ ...base, easeWeek: easeInput });
  assert.equal(withEase.suggestion?.kind, "ease-week",
    "a maximal 2 km retest is offered in a week the app has just judged a big step");
  // ⚠️ AND THE PACE SUGGESTION STILL WINS OVER IT — the flags engine's verdict on work already done is
  // the bigger change, and that is the "one voice" rule this file keeps.
  const withFlag = buildWeeklyReview({
    ...base, easeWeek: easeInput,
    flags: { flags: [], suggestion: { action: "anchor", direction: "slower", basis: "pace", proposedRecent5kSeconds: 1600 } },
  } as never as Parameters<typeof buildWeeklyReview>[0]);
  assert.equal(withFlag.suggestion?.kind, "adjust-paces",
    "the easier week displaces the flags engine's own pace decision");
  // and the source order says so, so a reordering fails even where a fixture cannot reach it
  const src = readFileSync(new URL("../src/adapt/weekly-review.ts", import.meta.url), "utf8");
  const body = src.slice(src.indexOf("export function buildWeeklyReview"));
  const ease = body.indexOf("easeOffer(");
  const retest = body.indexOf("retestDue(input)");
  const addDay = body.indexOf("addDayOffer(");
  assert.ok(ease > 0 && retest > 0 && addDay > 0, "the review no longer has all three offers");
  assert.ok(ease < retest, "the easier week is offered after the retest");
  assert.ok(retest < addDay, "the retest is offered after the extra day");
});

test("BLOCKER: the three dead detectors are the ones actually used", () => {
  // ⚠️ THE WHOLE POINT OF THE CHANGE. All three had ZERO callers since they were written; the fix is
  // the import, not new arithmetic. Guarded at the READER so a future rewrite that re-implements the
  // comparison inline fails rather than passing on the import alone.
  const src = readFileSync(new URL("../src/adapt/weekly-review.ts", import.meta.url), "utf8");
  const nocomment = src.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
  const at = nocomment.indexOf("export function easeOffer");
  const body = nocomment.slice(at, nocomment.indexOf("\n}", at));
  assert.ok(at > 0, "easeOffer is gone");
  for (const d of ["assessWeeklyJump", "assessLongRunSpike", "countTrailingMisses"])
    assert.ok(body.includes(d + "("), `easeOffer does not call ${d}, which is the function being wired`);
  // and it must not re-derive what they answer
  assert.ok(!/1\.3\b|1\.1\b/.test(body),
    "easeOffer carries its own thresholds instead of reading the detectors' verdicts");
});

// ---------------------------------------------------------------------------------------------
// The app side
// ---------------------------------------------------------------------------------------------

const appBlock = (() => {
  let cache: string | null = null;
  return () => {
    if (cache) return cache;
    const page = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
    const blocks = [...page.matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] ?? "");
    cache = blocks.reduce((a, b) => (b.includes("function easeWeekEvidence") ? b : a), "");
    return cache;
  };
})();
const nocomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/(^|\n)\s*\/\/[^\n]*/g, "$1");
function fn(name: string): string {
  const src = appBlock();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not in the built page");
  const open = src.indexOf("{", at);
  let depth = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") depth++;
    else if (src[i] === "}") { depth--; if (depth === 0) return src.slice(at, i + 1); }
  }
  assert.fail(name + " never closes");
}

test("BLOCKER: the app's evidence comes from LOGGED RUNS, never from state.done", () => {
  // ⚠️ seedDone() REBUILDS state.done AT EVERY BOOT by marking every non-rest session dated before
  // today as done, run or not — so a completion figure from there reads 100% for somebody who has not
  // run at all. Logged runs against RAW.weeks is the only honest pair, and this file records that.
  const body = nocomment(fn("easeWeekEvidence"));
  assert.ok(!/state\.done/.test(body),
    "the evidence reads state.done, which is 100% for a runner who has done nothing");
  assert.match(body, /state\.logged/, "the evidence does not read the logged runs");
  assert.match(body, /state\.hist/, "the evidence does not read the run history for actual mileage");
  assert.match(body, /RAW\.weeks/, "the evidence reads PLAN for the prescription rather than RAW");
  assert.match(body, /PRIMARY_TYPES/, "the evidence has its own idea of what counts as a run");
  // ⚠️ AND IT REUSES addDayEvidence'S OWN ARRAY. "Is this runner keeping up" must have ONE answer.
  // ⚠️⚠️ ASSERTED ON WHAT IS PASSED, NOT ON THE CALL BEING PRESENT — the mention-is-not-the-use trap,
  // caught by re-break. The first version matched `addDayEvidence(` and a break that KEPT the call
  // (it is also the null guard) while hand-building its own recentWeeks array sailed straight past it.
  assert.match(body, /addDayEvidence\(/,
    "the evidence never asks addDayEvidence at all");
  assert.match(body, /recentWeeks:\s*add\.recentWeeks/,
    "the evidence passes a completion array of its own rather than addDayEvidence's, so the app has " +
    "two answers to whether this runner is keeping up");
  assert.ok(!/prescribedRuns:\s*\d/.test(body),
    "the evidence builds prescribedRuns figures itself instead of reusing the one computation");
});

test("BLOCKER: the evidence builder does not swallow its own bugs", () => {
  // ⚠️ addDayEvidence's OWN NOTE RECORDS WHY: its first cut called two helpers that do not exist, the
  // catch swallowed the ReferenceError, and the offer would have shipped as a permanent no-op with
  // nothing to see. A caught error here is a bug in this function, not an expected state.
  const body = fn("easeWeekEvidence");
  assert.match(body, /console\.error\("easeWeekEvidence failed"/,
    "a failure inside the evidence builder is silent, so the offer would never appear and nothing " +
    "would say why");
});

test("BLOCKER: accepting goes through the manual control's own path", () => {
  // One mechanism, so an offer the runner accepts cannot ease a week differently from one they chose
  // themselves — and it inherits the snapshot-before-rebuild undo, the breaks-list row and the week
  // marking for free.
  const body = nocomment(fn("applyEaseOffer"));
  assert.match(body, /applyEaseWeek\(/, "accepting does not go through applyEaseWeek");
  assert.ok(!/RC\.easeWeek\(/.test(body), "accepting eases the week itself instead of using the one path");
  assert.match(body, /saveEaseAnswered\(\)/, "accepting does not record that the question was answered");
  assert.match(nocomment(fn("declineEaseOffer")), /saveEaseAnswered\(\)/,
    "declining does not record that the question was answered, so it is asked again next week");
});

test("BLOCKER: the offer never eases a week on its own", () => {
  // ⚠️ THE STANDING INSTRUCTION, 2026-08-03: "the app may observe and it may propose; it may never
  // change a pace, a plan or a target on its own. Every suggestion ends in a choice the runner makes."
  const ev = nocomment(fn("easeWeekEvidence"));
  const cur = nocomment(fn("currentWeeklyReview"));
  for (const [where, body] of [["easeWeekEvidence", ev], ["currentWeeklyReview", cur]] as const) {
    assert.ok(!/applyEaseWeek\(|RC\.easeWeek\(|easeWeekIn\(/.test(body),
      `${where} eases a week while merely working out whether to offer one`);
  }
});

test("BLOCKER: the card's two buttons exist and are wired", () => {
  // The looks-live-does-nothing class, which this app has shipped three times.
  const src = nocomment(appBlock());
  const card = nocomment(fn("weeklyReviewCard"));
  assert.match(card, /kind === "ease-week"/, "the card has no branch for the easier-week offer");
  for (const [id, handler] of [["wrEase", "applyEaseOffer"], ["wrNoEase", "declineEaseOffer"]]) {
    assert.ok(card.includes('id="' + id + '"'), `${id} is never rendered`);
    assert.ok(new RegExp('\\$\\("' + id + '"\\)[\\s\\S]{0,80}onclick = ' + handler).test(src),
      `${id} is rendered but not wired to ${handler}`);
  }
});

test("BLOCKER: the offered week is remembered, not re-derived at the tap", () => {
  // ⚠️ WeeklySuggestion IS AN ENGINE TYPE and the engine knows nothing about plan indices, so without
  // this the accept handler would have to work out which week was offered a second time — and the two
  // derivations would disagree the first time the clock crossed a Monday between the card rendering
  // and the tap.
  const src = nocomment(appBlock());
  assert.match(src, /EASE_OFFER_WEEK = ev \? ev\.weekIndex : null/,
    "the offered week index is not recorded when the card is built");
  const apply = nocomment(fn("applyEaseOffer"));
  assert.match(apply, /EASE_OFFER_WEEK/, "the accept handler does not read the recorded week");
  assert.ok(!/startIso >= today|for \(let i = 0/.test(apply),
    "the accept handler re-derives which week was offered instead of reading it");
});

test("BLOCKER: the offer is unreachable on a fresh plan, and that is not a defect", () => {
  // ⚠️ applyProfile CLAMPS THE START DATE TO TODAY, so a fresh profile is always in week 0 and the
  // four-week evidence window can never fill. addDayOffer records the same obstacle. What must NOT
  // happen is the builder throwing or inventing evidence: it returns null and the engine treats absent
  // as "do not offer".
  const athlete = { daysPerWeek: 5, recent: { distanceMeters: 5000, timeSeconds: 1500 },
    experience: "recreational", includeStrength: true, includeMobility: true,
    returningFromInjury: false, returningFromBreak: false, runWalk: false, longRunDay: 6,
  } as unknown as Athlete;
  const goal = { distance: "10k", targetTimeSeconds: 3200, raceDateIso: "2027-01-24" } as unknown as Goal;
  const p = generatePlan(athlete, goal, { startDateIso: "2026-09-07" });
  assert.ok(p.weeks.length > 8, "the fixture plan is too short to reason about");
  // Absent evidence must produce no suggestion at all rather than a default one.
  const runs = [{ id: "a", type: "easy", distKm: 6, dateIso: "2026-10-27" }] as never;
  const r = buildWeeklyReview({ runs, flags: { flags: [], suggestion: null },
    weekStartIso: "2026-10-26", todayIso: "2026-11-01" } as never as Parameters<typeof buildWeeklyReview>[0]);
  assert.notEqual(r.suggestion?.kind, "ease-week", "absent evidence produced the offer by default");
  // and the week the app would offer is one that has NOT started
  const body = nocomment(fn("easeWeekEvidence"));
  assert.match(body, /wk\.startIso >= today/,
    "the app offers a week that may already have begun — easing it would trim a long run that has " +
    "already happened and swap a session already done");
  void weekVolumeMeters;
});
