import assert from "node:assert/strict";
import { test } from "node:test";
import { RETEST_DUE_DAYS, buildWeeklyReview, retestDue, type ReviewRun } from "../src/adapt/weekly-review.ts";
import type { TrainingFlagsResult } from "../src/adapt/training-flags.ts";

const NO_FLAGS: TrainingFlagsResult = { flags: [], suggestion: null };
const run = (over: Partial<ReviewRun> = {}): ReviewRun => ({
  id: "r" + Math.round(Math.random() * 1e6), type: "easy", distKm: 8,
  dateIso: "2026-07-29", ...over,
});
const base = {
  runs: [run(), run({ dateIso: "2026-07-31" })],
  flags: NO_FLAGS,
  weekStartIso: "2026-07-27",
  todayIso: "2026-08-03",
};

test("nothing to say means nothing is shown", () => {
  // ⚠️ A card that appears every week saying "2 runs, 16 km" becomes wallpaper, and then the week it
  // matters it is not read either. Silence has to be a valid answer or the feature defeats itself.
  const r = buildWeeklyReview({ ...base, runs: [] });
  assert.equal(r.quiet, true);
  const oneLine = buildWeeklyReview(base);
  assert.equal(oneLine.quiet, false, "a due retest is worth speaking up for");
});

test("the review never changes anything — it only ever returns a suggestion", () => {
  // The whole contract of this module. If it ever grows a way to mutate a plan, this fails.
  const r = buildWeeklyReview({
    ...base,
    flags: { flags: [], suggestion: { action: "anchor", direction: "faster", proposedRecent5kSeconds: 1440, basis: "pace" } },
  });
  assert.ok(r.suggestion);
  assert.equal(r.suggestion!.kind, "adjust-paces");
  // A suggestion carries the evidence and the proposal, and nothing that looks like a command.
  assert.ok(!Object.keys(r).some((k) => /apply|commit|save|mutate/i.test(k)));
});

test("a pace suggestion is reported from the engine, not re-derived here", () => {
  const faster = buildWeeklyReview({
    ...base,
    flags: { flags: [], suggestion: { action: "anchor", direction: "faster", proposedRecent5kSeconds: 1430, basis: "pace" } },
  });
  assert.equal(faster.suggestion!.kind, "adjust-paces");
  assert.equal((faster.suggestion as any).proposedRecent5kSeconds, 1430, "the engine's number is passed through untouched");
  assert.equal((faster.suggestion as any).direction, "faster");

  const slower = buildWeeklyReview({
    ...base,
    flags: { flags: [], suggestion: { action: "anchor", direction: "slower", proposedRecent5kSeconds: 1560, basis: "rpe" } },
  });
  assert.equal((slower.suggestion as any).direction, "slower");
  assert.equal((slower.suggestion as any).basis, "rpe");
});

test("the runner is never asked two questions in one week", () => {
  // ⚠️ A retest offer and a pace change in the same card means one of them is dismissed unread, and
  // the app cannot tell which. The pace change wins because it is about work already done.
  const both = buildWeeklyReview({
    ...base,
    lastTrialIso: "2026-01-01", // long overdue
    flags: { flags: [], suggestion: { action: "anchor", direction: "faster", proposedRecent5kSeconds: 1430, basis: "pace" } },
  });
  assert.equal(both.suggestion!.kind, "adjust-paces", "a pace decision outranks a retest offer");
});

test("a retest is offered on the specification's cadence, and never when it would be unsafe", () => {
  const due = { runs: base.runs, todayIso: "2026-08-03" };
  assert.equal(retestDue({ ...due, lastTrialIso: null }), true, "never tested: offer it");
  assert.equal(retestDue({ ...due, lastTrialIso: "2026-08-01" }), false, "two days ago: far too soon");
  assert.equal(retestDue({ ...due, lastTrialIso: "2026-07-06" }), true, `${RETEST_DUE_DAYS} days is due`);

  // ⚠️ Each of these is a real refusal, not politeness. Offering a maximal effort into illness or a
  // taper is the prompt doing harm, and it teaches the runner to ignore every future prompt.
  assert.equal(retestDue({ ...due, lastTrialIso: null, unwell: true }), false);
  assert.equal(retestDue({ ...due, lastTrialIso: null, inTaperOrRaceWeek: true }), false);
  assert.equal(retestDue({ ...due, lastTrialIso: null, runs: [] }), false, "someone who has not run does not need a test");
  assert.equal(retestDue({ ...due, lastTrialIso: null, runs: [run()] }), false, "one run is not a training week");
});

test("heart rate confirms; it never drives a pace change", () => {
  // ⚠️ THE RESEARCH POSITION, not a preference. HR at a given pace moves with heat, dehydration,
  // caffeine, sleep and cardiac drift inside a single run — all of which look exactly like a fitness
  // change across a week. So HR may produce a SENTENCE and must never produce a suggestion.
  const hrRuns = [
    run({ type: "easy", avgHr: 165, zoneSec: [0, 100, 900, 600, 0] }),
    run({ type: "easy", avgHr: 168, zoneSec: [0, 120, 950, 700, 0], dateIso: "2026-07-31" }),
  ];
  const r = buildWeeklyReview({ ...base, runs: hrRuns, lastTrialIso: "2026-08-01" });
  assert.ok(r.observations.some((o) => /heart rate/i.test(o)), "high-zone easy running is worth remarking on");
  assert.equal(r.suggestion, null, "heart rate alone must never produce a suggestion");
});

test("heart rate says so when the easy running was genuinely easy", () => {
  const easyRuns = [
    run({ type: "easy", avgHr: 132, zoneSec: [600, 1400, 200, 0, 0] }),
    run({ type: "recovery", avgHr: 128, zoneSec: [800, 1200, 100, 0, 0], dateIso: "2026-07-31" }),
  ];
  const r = buildWeeklyReview({ ...base, runs: easyRuns, lastTrialIso: "2026-08-01" });
  assert.ok(r.observations.some((o) => /what easy is supposed to look like/i.test(o)));
});

test("no heart-rate data is simply silence, not a complaint", () => {
  // Most runs have no watch. The review must read the same for them, minus one sentence.
  const r = buildWeeklyReview({ ...base, lastTrialIso: "2026-08-01" });
  assert.ok(!r.observations.some((o) => /heart rate/i.test(o)));
});

test("observations are plain sentences, and never more than three", () => {
  const r = buildWeeklyReview({
    ...base,
    runs: [run({ avgHr: 165, zoneSec: [0, 100, 900, 600, 0] }), run({ avgHr: 168, zoneSec: [0, 120, 950, 700, 0] })],
    flags: { flags: [], suggestion: { action: "anchor", direction: "slower", proposedRecent5kSeconds: 1560, basis: "rpe" } },
  });
  assert.ok(r.observations.length <= 3, "more than three lines is a report, not a coach");
  for (const o of r.observations) {
    // A count is a fine way to open a sentence — "2 runs this week" reads better than "Two".
    assert.ok(/^[A-Z0-9]/.test(o) && /[.!]$/.test(o), `not a sentence: "${o}"`);
    assert.ok(!/undefined|null|NaN|\[object/.test(o), `a raw value leaked into copy: "${o}"`);
  }
  assert.ok(r.suggestion!.why.length > 20, "a suggestion must explain itself");
});
