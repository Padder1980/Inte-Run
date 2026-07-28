import assert from "node:assert/strict";
import { test } from "node:test";
import type { RecentPerformance } from "../src/domain/types.ts";
import { formatDuration } from "../src/domain/units.ts";
import {
  deriveTrainingPaces,
  estimateHrZones,
  predictRaceTime,
  riegelPredict,
} from "../src/science/paces.ts";

const fiveKin20: RecentPerformance = { distanceMeters: 5000, timeSeconds: 1200 };

test("Riegel predicts a slower pace over longer distance", () => {
  // 5k in 20:00 → 10k should be ~41:40 (well-known ballpark), and slower per-km.
  const tenK = predictRaceTime(fiveKin20, "10k");
  assert.ok(Math.abs(tenK - 2502) < 20, `10k predicted ${formatDuration(tenK)}`);
  const half = predictRaceTime(fiveKin20, "half");
  assert.ok(half > tenK * 2, "half should be more than double the 10k time per Riegel");
});

test("Riegel is self-consistent at the input distance", () => {
  assert.equal(Math.round(riegelPredict(5000, 1200, 5000)), 1200);
});

test("training paces are physiologically ordered: rep < vo2 < threshold < steady < easy", () => {
  const p = deriveTrainingPaces(fiveKin20);
  // smaller sec/km = faster
  assert.ok(p.rep.minSecPerKm < p.vo2.minSecPerKm, "reps faster than VO2");
  assert.ok(p.vo2.maxSecPerKm < p.threshold.minSecPerKm, "VO2 faster than threshold");
  assert.ok(p.threshold.maxSecPerKm < p.steady.minSecPerKm, "threshold faster than steady");
  assert.ok(p.steady.maxSecPerKm < p.easy.minSecPerKm, "steady faster than easy");
});

test("easy sits ~1.22–1.33× threshold at EVERY ability, not a fixed s/km offset", () => {
  // The gears are proportional to threshold rather than a constant offset. A fixed +92 s/km is a
  // 50% slowdown for a 14-minute 5 km runner and only 16% for a 45-minute one, so fast runners were
  // told to jog absurdly slowly while beginners got an "easy" pace barely easier than their tempo.
  // Daniels' tables put the real figure near 1.25× across the whole range.
  for (const t of [14 * 60, 18 * 60, 22 * 60, 30 * 60, 45 * 60]) {
    const p = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: t });
    const mid = (r: { minSecPerKm: number; maxSecPerKm: number }) => (r.minSecPerKm + r.maxSecPerKm) / 2;
    const ratio = mid(p.easy) / mid(p.threshold);
    assert.ok(ratio > 1.2 && ratio < 1.34, `5k ${t}s: easy/threshold ratio was ${ratio.toFixed(2)}`);
    // And the absolute gap must grow with the runner's pace, which is the whole point.
    const delta = mid(p.easy) - mid(p.threshold);
    assert.ok(delta > 40 && delta < 200, `5k ${t}s: easy-threshold delta ${Math.round(delta)} s/km`);
  }
  // Explicitly: a slower runner gets a BIGGER absolute slowdown than a faster one.
  const fast = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 16 * 60 });
  const slow = deriveTrainingPaces({ distanceMeters: 5000, timeSeconds: 35 * 60 });
  const gap = (p: typeof fast) => (p.easy.minSecPerKm + p.easy.maxSecPerKm) / 2 -
    (p.threshold.minSecPerKm + p.threshold.maxSecPerKm) / 2;
  assert.ok(gap(slow) > gap(fast) * 1.5, "the easy gap should scale with ability");
});

test("goal pace is honoured when a goal is supplied", () => {
  const p = deriveTrainingPaces(fiveKin20, {
    distance: "half",
    targetTimeSeconds: 5400, // 1:30:00 → ~4:16/km
    raceDateIso: "2027-09-01",
  });
  const mid = (p.goalRace.minSecPerKm + p.goalRace.maxSecPerKm) / 2;
  assert.ok(Math.abs(mid - 5400 / 21.0975) < 3, `goal pace mid ${mid}`);
});

test("HR zones ascend and respect max/reserve", () => {
  const zMax = estimateHrZones(190);
  assert.equal(zMax.length, 5);
  assert.ok(zMax[0]!.minBpm < zMax[4]!.minBpm);
  assert.ok(zMax[4]!.maxBpm <= 190);
  const zReserve = estimateHrZones(190, 50);
  // Karvonen lifts the low zones above plain %max.
  assert.ok(zReserve[1]!.minBpm > zMax[1]!.minBpm);
});
