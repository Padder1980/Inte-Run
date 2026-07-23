import assert from "node:assert/strict";
import { test } from "node:test";
import {
  distanceForTime,
  formatDuration,
  formatPace,
  METRES_PER_MILE,
  paceSecPerKm,
  parseDuration,
  secPerKmToSecPerMile,
  timeForDistance,
} from "../src/domain/units.ts";

test("parseDuration handles ss, mm:ss and h:mm:ss", () => {
  assert.equal(parseDuration("45"), 45);
  assert.equal(parseDuration("5:35"), 335);
  assert.equal(parseDuration("1:30:00"), 5400);
});

test("parseDuration rejects malformed input", () => {
  assert.throws(() => parseDuration("1:2:3:4"));
  assert.throws(() => parseDuration("ab:cd"));
});

test("formatDuration round-trips with parseDuration", () => {
  for (const s of [0, 45, 335, 3599, 3600, 5400, 9296]) {
    assert.equal(parseDuration(formatDuration(s, s >= 3600)), s);
  }
});

test("formatDuration shows hours only when needed", () => {
  assert.equal(formatDuration(335), "5:35");
  assert.equal(formatDuration(5400), "1:30:00");
  assert.equal(formatDuration(335, true), "0:05:35");
});

test("pace/time/distance conversions are mutually consistent", () => {
  // 5 km in 20:00 → 4:00/km
  const pace = paceSecPerKm(1200, 5000);
  assert.equal(pace, 240);
  assert.equal(timeForDistance(pace, 5000), 1200);
  assert.ok(Math.abs(distanceForTime(pace, 1200) - 5000) < 1e-6);
});

test("km↔mile pace conversion", () => {
  // 4:00/km → ~6:26/mile
  const perMile = secPerKmToSecPerMile(240);
  assert.ok(Math.abs(perMile - 240 * (METRES_PER_MILE / 1000)) < 1e-6);
  assert.equal(formatPace(240, "mi"), "6:26/mi");
  assert.equal(formatPace(240, "km"), "4:00/km");
});
