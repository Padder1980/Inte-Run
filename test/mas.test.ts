import assert from "node:assert/strict";
import { test } from "node:test";
import { computeMas } from "../src/science/mas.ts";

test("MAS from an 8:00 2km is 4.17 m/s at 4:00/km", () => {
  const r = computeMas(480);
  assert.equal(r.masMps, 4.17);
  assert.equal(r.masPaceSecPerKm, 240); // 4:00/km, and equals 480/2
});

test("100% MAS is the 2km time-trial pace itself", () => {
  const r = computeMas(480);
  const long = r.zones.find((z) => z.key === "long")!;
  assert.equal(long.pct, 100);
  assert.equal(long.paceSecPerKm, r.masPaceSecPerKm);
});

test("Eurofit is 120% MAS at 15s/15s with a rep distance", () => {
  const r = computeMas(480); // MAS 4.167 → 120% = 5.0 m/s
  const e = r.zones.find((z) => z.key === "eurofit")!;
  assert.equal(e.pct, 120);
  assert.equal(e.velocityMps, 5);
  assert.equal(e.paceSecPerKm, 200); // 1000/5
  assert.equal(e.workSeconds, 15);
  assert.equal(e.restSeconds, 15);
  assert.equal(e.repDistanceMeters, 75); // 5 m/s × 15s
});

test("Tabata is 130% MAS at 20s/10s and faster than Eurofit", () => {
  const r = computeMas(480);
  const t = r.zones.find((z) => z.key === "tabata")!;
  assert.equal(t.pct, 130);
  assert.equal(t.workSeconds, 20);
  assert.equal(t.restSeconds, 10);
  assert.ok(t.velocityMps > r.zones.find((z) => z.key === "eurofit")!.velocityMps);
});

test("a positive 2km time is required", () => {
  assert.throws(() => computeMas(0));
  assert.throws(() => computeMas(-10));
});
