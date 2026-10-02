import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import {
  BEST_DISTANCES, BEST_TOLERANCE, BEST_FASTEST_SEC_PER_KM, bestEligible, bestDistanceOf, runBests, newBest,
  type BestRun,
} from "../src/progress/records.ts";

/**
 * BEST TIMES (stage B1, 2026-10-02) — the engine half.
 *
 * The app shipped a "Best" chip on the Inte-Club profile computed inline, and three screens promising
 * "personal bests" in Performance, which showed none. This module is now the one definition both
 * screens read, so these tests are the rule itself: the 3% window the club chips were built on, the
 * measured-only rule, the plausibility floor, and A6's "a first is not a record".
 */

const run = (id: string, dateIso: string, km: number, sec: number, origin?: string): BestRun =>
  ({ id, dateIso, km, sec, origin });

test("the six distances, in reading order, with the mile distances exact", () => {
  assert.deepEqual(BEST_DISTANCES.map((d) => d.id), ["5k", "5mi", "10k", "10mi", "half", "marathon"]);
  const km = Object.fromEntries(BEST_DISTANCES.map((d) => [d.id, d.km]));
  assert.equal(km["5mi"], 8.04672, "5 miles is 8.04672 km exactly");
  assert.equal(km["10mi"], 16.09344, "10 miles is 16.09344 km exactly");
  assert.equal(km.half, 21.0975);
  assert.equal(km.marathon, 42.195);
  // ⚠️ NO WINDOW OVERLAPS ANOTHER, so a run counts for one distance at most. Derived, not listed:
  // each window's top must sit below the next window's bottom.
  for (let i = 1; i < BEST_DISTANCES.length; i++) {
    const lo = BEST_DISTANCES[i - 1]!, hi = BEST_DISTANCES[i]!;
    assert.ok(lo.km * (1 + BEST_TOLERANCE) < hi.km * (1 - BEST_TOLERANCE), lo.id + " and " + hi.id + " overlap");
  }
});

test("a run counts within 3% of a distance and not beyond it — the club chips' own rule", () => {
  assert.equal(bestDistanceOf(5)?.id, "5k");
  assert.equal(bestDistanceOf(4.86)?.id, "5k", "2.8% short still counts");
  assert.equal(bestDistanceOf(5.15)?.id, "5k", "exactly 3% over counts");
  assert.equal(bestDistanceOf(5.4), null, "a 5.4 km run is not a 5 km time");
  assert.equal(bestDistanceOf(4.8), null, "4% short is not a 5 km either");
  assert.equal(bestDistanceOf(8.1)?.id, "5mi");
  assert.equal(bestDistanceOf(21.3)?.id, "half");
  assert.equal(bestDistanceOf(42.6)?.id, "marathon");
  assert.equal(bestDistanceOf(12), null, "12 km is no distance on the list");
  assert.equal(bestDistanceOf(0), null);
});

test("the quickest eligible run wins each distance, and an unrun distance is absent rather than zero", () => {
  const bests = runBests([
    run("a", "2026-09-01", 5.02, 1530),
    run("b", "2026-09-08", 4.97, 1490),
    run("c", "2026-09-15", 10.1, 3100),
    run("d", "2026-09-20", 7.0, 1900), // no distance
  ]);
  assert.deepEqual(bests.map((b) => b.distance), ["5k", "10k"], "only the distances actually run appear");
  const five = bests[0]!;
  assert.equal(five.sec, 1490);
  assert.equal(five.runId, "b");
  assert.equal(five.km, 4.97, "the measured length travels with the time, so a screen can say what it was run over");
  assert.equal(five.dateIso, "2026-09-08");
  assert.ok(bests.every((b) => b.sec > 0), "a best is never a zero");
});

test("⚠️ only a MEASURED distance can set a best: hand-added, treadmill, no-GPS and simulated runs never do", () => {
  for (const origin of ["manual", "indoor", "nogps", "sim"]) {
    const bests = runBests([run("m", "2026-09-01", 5, 900, origin), run("real", "2026-09-02", 5, 1500)]);
    assert.equal(bests[0]!.runId, "real", "a run flagged " + origin + " set a best");
    assert.equal(bestEligible(run("m", "2026-09-01", 5, 1500, origin)), false, origin + " is eligible");
  }
  assert.equal(bestEligible(run("ok", "2026-09-01", 5, 1500)), true);
});

test("a time faster than any human can run is a GPS fault, refused rather than announced", () => {
  // 5 km in 11:40 is 2:20/km — quicker than the world record.
  assert.equal(bestEligible(run("g", "2026-09-01", 5, 700)), false);
  assert.equal(runBests([run("g", "2026-09-01", 5, 700)]).length, 0);
  // At the floor exactly, it counts.
  assert.equal(bestEligible(run("f", "2026-09-01", 5, 5 * BEST_FASTEST_SEC_PER_KM)), true);
  assert.equal(bestEligible(run("z", "2026-09-01", 5, 0)), false, "no time is not a time");
  assert.equal(bestEligible(run("n", "2026-09-01", NaN, 1500)), false);
});

test("a tie goes to the earlier run: equalling a time is not beating it", () => {
  const bests = runBests([run("late", "2026-09-20", 5, 1500), run("early", "2026-09-01", 5, 1500)]);
  assert.equal(bests[0]!.runId, "early");
});

test("newBest: strictly quicker than every other run at that distance, and never a first", () => {
  const prior = [run("a", "2026-09-01", 5.01, 1500), run("b", "2026-09-05", 10, 3200)];
  const hit = newBest(prior, run("new", "2026-10-01", 4.99, 1471));
  assert.ok(hit, "a quicker 5 km was not noticed");
  assert.equal(hit!.distance, "5k");
  assert.equal(hit!.sec, 1471);
  assert.equal(hit!.previousSec, 1500);
  assert.equal(hit!.previousDateIso, "2026-09-01");
  assert.equal(newBest(prior, run("tie", "2026-10-01", 5, 1500)), null, "a tie was called a new best");
  assert.equal(newBest(prior, run("slow", "2026-10-01", 5, 1600)), null);
  // ⚠️ A FIRST IS NOT A RECORD.
  assert.equal(newBest(prior, run("first-half", "2026-10-01", 21.1, 6000)), null, "the first half marathon was announced as a new best");
  assert.equal(newBest([], run("first", "2026-10-01", 5, 1400)), null);
  // The run is never compared against itself (it is already in the history by the time a save point asks).
  assert.equal(newBest([...prior, run("new", "2026-10-01", 4.99, 1471)], run("new", "2026-10-01", 4.99, 1471))?.sec, 1471);
  // An ineligible run is never a new best, however quick.
  assert.equal(newBest(prior, run("hand", "2026-10-01", 5, 1300, "manual")), null);
  // A run of no listed distance is never a new best.
  assert.equal(newBest(prior, run("odd", "2026-10-01", 7, 1500)), null);
});

test("the app reads the ONE definition: the bundle exports it and the club chips call it", () => {
  const entry = readFileSync(new URL("../web/entry.ts", import.meta.url), "utf8");
  assert.match(entry, /export \{[^}]*\brunBests\b[^}]*\} from "\.\.\/src\/progress\/records\.ts"/, "runBests is not on RC");
  assert.match(entry, /export \{[^}]*\bnewBest\b[^}]*\} from "\.\.\/src\/progress\/records\.ts"/, "newBest is not on RC");
  // ⚠️ AND IT REACHED THE BUILT PAGE. An export the bundler dropped would leave RC.runBests undefined,
  // and every caller sits inside a try.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  assert.ok(/runBests:\s*\(\)\s*=>/.test(html), "runBests is not in the bundled RC");
  assert.ok(/newBest:\s*\(\)\s*=>/.test(html), "newBest is not in the bundled RC");
});
