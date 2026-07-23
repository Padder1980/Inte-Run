import assert from "node:assert/strict";
import { test } from "node:test";
import type { Activity } from "../src/domain/types.ts";
import { bestEffort, detectAchievements } from "../src/progress/achievements.ts";

// A 10 km run with even 4:00/km splits.
const evenSplits = Array.from({ length: 10 }, () => ({ distanceMeters: 1000, timeSeconds: 240 }));
const tenK: Activity = {
  id: "a1",
  dateIso: "2026-08-02",
  distanceMeters: 10000,
  movingTimeSeconds: 2400,
  splits: evenSplits,
};

test("best effort finds sub-distances within an activity", () => {
  assert.equal(bestEffort(tenK, 5000), 1200); // fastest 5k = 20:00
  assert.equal(bestEffort(tenK, 10000), 2400);
  assert.equal(bestEffort(tenK, 1000), 240);
  // Can't extract a distance longer than the activity.
  assert.equal(bestEffort(tenK, 21097.5), undefined);
});

test("best effort interpolates the final partial split", () => {
  // fastest mile (1609.344 m) across even 4:00/km splits = 1609.344/1000 * 240 ≈ 386s
  const mile = bestEffort(tenK, 1609.344)!;
  assert.ok(Math.abs(mile - 386) <= 1, `mile effort ${mile}`);
});

test("best effort picks the fastest window, not the first", () => {
  const surge: Activity = {
    id: "a2",
    dateIso: "2026-08-03",
    distanceMeters: 3000,
    movingTimeSeconds: 720,
    splits: [
      { distanceMeters: 1000, timeSeconds: 260 },
      { distanceMeters: 1000, timeSeconds: 230 }, // fastest km
      { distanceMeters: 1000, timeSeconds: 250 },
    ],
  };
  assert.equal(bestEffort(surge, 1000), 230);
});

test("without splits, only a whole-activity effort at the target distance counts", () => {
  const race: Activity = {
    id: "a3",
    dateIso: "2026-08-04",
    distanceMeters: 5000,
    movingTimeSeconds: 1190,
  };
  assert.equal(bestEffort(race, 5000), 1190);
  const longRun: Activity = {
    id: "a4",
    dateIso: "2026-08-05",
    distanceMeters: 18000,
    movingTimeSeconds: 5400,
  };
  assert.equal(bestEffort(longRun, 5000), undefined); // no splits → can't know the fastest 5k
});

test("new PBs are detected against prior bests; ties are not", () => {
  const { achievements, bests } = detectAchievements([tenK], {
    "fastest-5k": 1260,
    "fastest-10k": 2400,
  });
  const kinds = achievements.map((a) => a.kind);
  assert.ok(kinds.includes("fastest-5k"), "20:00 beats prior 21:00 5k");
  assert.equal(bests["fastest-5k"], 1200);
  // 10k tie (2400 == 2400) must NOT be reported as a new record.
  assert.ok(!kinds.includes("fastest-10k"), "a tie is not a new PB");
  assert.ok(kinds.includes("longest-run"));
});
