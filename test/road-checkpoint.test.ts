// STAGE B14 — THE CHECKPOINT'S JUDGEMENT (STAGES.md §5; the owner's decision 3, 2026-11-18, word for word:
// "Ready (all three), Nearly (one missing: a week more), Not yet (pain flagged: ease back, with the injury
// guidance); the runner still chooses"). Pure over observed facts — the app gathers them, this only judges.
import assert from "node:assert/strict";
import { test } from "node:test";
import { type CheckpointFacts, evaluateCheckpoint, runsNeeded } from "../src/plan/checkpoint.ts";

const rebuild = (o: Partial<CheckpointFacts> & { best?: number | null } = {}): CheckpointFacts => ({
  stage: "rebuild", planned: 7, done: 7, painRuns: 0,
  keyRun: { kind: "easy-run", needMin: 40, bestMin: o.best === undefined ? 41 : o.best, bestIso: "Sun 13 Dec" },
  ...o,
});

test("Ready only when all three are met, and the choice put first is moving up", () => {
  const v = evaluateCheckpoint(rebuild());
  assert.equal(v.verdict, "ready");
  assert.equal(v.recommend, "up");
  assert.deepEqual(v.met, { runs: true, noPain: true, keyRun: true });
  assert.equal(v.reasons.length, 3);
  assert.match(v.reasons[0]!, /You ran 7 of your 7 planned runs/);
  assert.match(v.reasons[2]!, /41-minute run on Sun 13 Dec felt easy/);
});

test("Nearly: exactly one check missing and nothing hurt — a week more is put first", () => {
  for (const f of [rebuild({ done: 5 }), rebuild({ best: 35 }), rebuild({ best: null })]) {
    const v = evaluateCheckpoint(f);
    assert.equal(v.verdict, "nearly", JSON.stringify(f));
    assert.equal(v.recommend, "more");
  }
  // The runs rule is 80%: 6 of 7 passes (ceil(5.6) = 6), 5 of 7 does not.
  assert.equal(evaluateCheckpoint(rebuild({ done: 6 })).met.runs, true);
  assert.equal(evaluateCheckpoint(rebuild({ done: 5 })).met.runs, false);
  assert.equal(runsNeeded(12), 10);
  assert.equal(runsNeeded(5), 4);
});

test("Not yet: any run that hurt, whatever else was done — and easing back is put first", () => {
  const v = evaluateCheckpoint(rebuild({ painRuns: 1 }));
  assert.equal(v.verdict, "notyet");
  assert.equal(v.recommend, "ease");
  assert.match(v.reasons[1]!, /You said one run in the last two weeks hurt/);
  // Two missing without pain is also not yet, but nothing hurt, so a week more comes first, never easing back.
  const w = evaluateCheckpoint(rebuild({ done: 2, best: null }));
  assert.equal(w.verdict, "notyet");
  assert.equal(w.recommend, "more");
});

test("the words say only what was observed: an unanswered pain question is never 'nothing hurt'", () => {
  const v = evaluateCheckpoint(rebuild());
  assert.equal(v.reasons[1], "You didn’t flag pain on any run in the last two weeks.");
  assert.ok(!v.reasons.some((r) => /nothing hurt|no pain/i.test(r)));
  // Nothing planned is not a pass: there is nothing to count.
  const none = evaluateCheckpoint(rebuild({ planned: 0, done: 0 }));
  assert.equal(none.met.runs, false);
  assert.match(none.reasons[0]!, /nothing to count/);
});

test("Base's key run is a test run, read only from one logged in the stage", () => {
  const base = (doneIso: string | null): CheckpointFacts =>
    ({ stage: "base", planned: 6, done: 6, painRuns: 0, keyRun: { kind: "test", doneIso, label: "2 km in 8:40" } });
  assert.equal(evaluateCheckpoint(base("Sat 16 Jan")).verdict, "ready");
  assert.match(evaluateCheckpoint(base("Sat 16 Jan")).reasons[2]!, /test run on Sat 16 Jan \(2 km in 8:40\)/);
  const v = evaluateCheckpoint(base(null));
  assert.equal(v.verdict, "nearly");
  assert.match(v.reasons[2]!, /No test run yet/);
});
