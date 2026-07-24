import assert from "node:assert/strict";
import { test } from "node:test";
import {
  fitCriticalSpeed,
  predictTimeFromModel,
  type Effort,
} from "../src/science/critical-speed.ts";
import { buildFitnessProfile } from "../src/science/fitness-profile.ts";

// ---- Critical speed -------------------------------------------------------

test("recovers a known critical speed and D' from clean efforts", () => {
  // Construct efforts from CS = 4.0 m/s, D' = 200 m: d = 4·t + 200.
  const efforts: Effort[] = [
    { timeSeconds: 180, distanceMeters: 4 * 180 + 200 }, // 920 m
    { timeSeconds: 360, distanceMeters: 4 * 360 + 200 }, // 1640 m
    { timeSeconds: 600, distanceMeters: 4 * 600 + 200 }, // 2600 m
  ];
  const m = fitCriticalSpeed(efforts);
  assert.ok(Math.abs(m.criticalSpeedMps - 4.0) < 1e-6, `CS ${m.criticalSpeedMps}`);
  assert.ok(Math.abs(m.dPrimeMeters - 200) < 1, `D' ${m.dPrimeMeters}`);
  assert.ok(m.rSquared > 0.999);
  assert.equal(m.csPaceSecPerKm, 250); // 1000 / 4.0
});

test("needs two efforts of differing duration", () => {
  assert.throws(() => fitCriticalSpeed([{ timeSeconds: 300, distanceMeters: 1500 }]));
  assert.throws(() =>
    fitCriticalSpeed([
      { timeSeconds: 300, distanceMeters: 1500 },
      { timeSeconds: 300, distanceMeters: 1500 },
    ]),
  );
});

test("model round-trips: predicted time matches the generating line", () => {
  const efforts: Effort[] = [
    { timeSeconds: 200, distanceMeters: 4 * 200 + 200 },
    { timeSeconds: 500, distanceMeters: 4 * 500 + 200 },
  ];
  const m = fitCriticalSpeed(efforts);
  assert.ok(Math.abs(predictTimeFromModel(m, 4 * 400 + 200) - 400) < 1e-3);
});

test("two efforts stay at low confidence (a line, but unverifiable)", () => {
  const m = fitCriticalSpeed([
    { timeSeconds: 200, distanceMeters: 1000 },
    { timeSeconds: 500, distanceMeters: 2200 },
  ]);
  assert.equal(m.confidence, "low");
});

// ---- Fitness profile ------------------------------------------------------

test("never reduces fitness to one score — separate estimates are returned", () => {
  const p = buildFitnessProfile({
    efforts: [
      { distanceMeters: 3000, timeSeconds: 660 },
      { distanceMeters: 5000, timeSeconds: 1170 },
    ],
  });
  for (const e of [p.aerobicCapacity, p.thresholdSpeed, p.speedReserve, p.durability, p.economy, p.trainingTolerance]) {
    assert.ok(e.metric && e.unit && e.method, "each estimate carries provenance");
  }
});

test("VO₂max is shown as a range, never a bare point value", () => {
  const p = buildFitnessProfile({ efforts: [{ distanceMeters: 5000, timeSeconds: 1170 }] });
  assert.equal(p.aerobicCapacity.unit, "ml/kg/min");
  assert.ok(p.aerobicCapacity.low! < p.aerobicCapacity.high!);
  assert.ok(p.aerobicCapacity.value! >= p.aerobicCapacity.low! && p.aerobicCapacity.value! <= p.aerobicCapacity.high!);
  assert.ok(p.aerobicCapacity.limitations);
});

test("two efforts raise aerobic confidence and attach a critical-speed model", () => {
  const one = buildFitnessProfile({ efforts: [{ distanceMeters: 5000, timeSeconds: 1170 }] });
  const two = buildFitnessProfile({
    efforts: [
      { distanceMeters: 3000, timeSeconds: 660 },
      { distanceMeters: 5000, timeSeconds: 1170 },
    ],
  });
  assert.equal(one.aerobicCapacity.confidence, "low");
  assert.equal(two.aerobicCapacity.confidence, "moderate");
  assert.ok(one.criticalSpeed === undefined);
  assert.ok(two.criticalSpeed && two.criticalSpeed.criticalSpeedMps > 0);
});

test("economy and training tolerance are honestly 'none' without the right data", () => {
  const p = buildFitnessProfile({ efforts: [{ distanceMeters: 5000, timeSeconds: 1170 }] });
  assert.equal(p.economy.confidence, "none");
  assert.equal(p.economy.value, undefined);
  assert.equal(p.trainingTolerance.confidence, "none");
});

test("speed reserve and durability unlock only when their data is supplied", () => {
  const bare = buildFitnessProfile({ efforts: [{ distanceMeters: 5000, timeSeconds: 1170 }] });
  assert.equal(bare.speedReserve.confidence, "none");
  assert.equal(bare.durability.confidence, "none");
  const rich = buildFitnessProfile({
    efforts: [{ distanceMeters: 5000, timeSeconds: 1170 }],
    maxSprintSpeedMps: 9.0,
    longRunDecouplingPct: 4.2,
  });
  assert.equal(rich.speedReserve.confidence, "low");
  assert.equal(rich.durability.confidence, "low");
});
