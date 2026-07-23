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

test("easy pace sits roughly 75–110 s/km slower than threshold", () => {
  const p = deriveTrainingPaces(fiveKin20);
  const thresholdMid = (p.threshold.minSecPerKm + p.threshold.maxSecPerKm) / 2;
  const easyMid = (p.easy.minSecPerKm + p.easy.maxSecPerKm) / 2;
  const delta = easyMid - thresholdMid;
  assert.ok(delta >= 70 && delta <= 115, `easy-threshold delta was ${delta} s/km`);
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
