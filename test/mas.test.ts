import assert from "node:assert/strict";
import { test } from "node:test";
import { computeMas, masVo2Range } from "../src/science/mas.ts";
import { generatePlan } from "../src/plan/generate-plan.ts";
import type { Athlete, Goal } from "../src/domain/types.ts";

test("MAS from a 4:00 1km is 4.17 m/s at 4:00/km", () => {
  const r = computeMas(240);
  assert.equal(r.masMps, 4.17);
  assert.equal(r.masPaceSecPerKm, 240); // 4:00/km, and equals the 1km time
  assert.equal(r.oneKmSeconds, 240);
});

test("100% MAS is the 1km time-trial pace itself", () => {
  const r = computeMas(240);
  const long = r.zones.find((z) => z.key === "long")!;
  assert.equal(long.pct, 100);
  assert.equal(long.paceSecPerKm, r.masPaceSecPerKm);
});

test("Eurofit is 120% MAS at 15s/15s with a rep distance", () => {
  const r = computeMas(240); // MAS 4.167 → 120% = 5.0 m/s
  const e = r.zones.find((z) => z.key === "eurofit")!;
  assert.equal(e.pct, 120);
  assert.equal(e.velocityMps, 5);
  assert.equal(e.paceSecPerKm, 200); // 1000/5
  assert.equal(e.repDistanceMeters, 75); // 5 m/s × 15s
});

test("Tabata is 130% MAS at 20s/10s and faster than Eurofit", () => {
  const r = computeMas(240);
  const t = r.zones.find((z) => z.key === "tabata")!;
  assert.equal(t.pct, 130);
  assert.ok(t.velocityMps > r.zones.find((z) => z.key === "eurofit")!.velocityMps);
});

test("a positive 1km time is required", () => {
  assert.throws(() => computeMas(0));
  assert.throws(() => computeMas(-10));
});

// ---- Integration: MAS anchors the plan's VO2 paces ------------------------

const athlete: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 },
  experience: "recreational",
  includeStrength: true,
};
const goal: Goal = { distance: "10k", targetTimeSeconds: 2400, raceDateIso: "2027-03-28", startDateIso: "2026-07-24" };

test("a 1km trial anchors the plan's VO2 interval pace to MAS", () => {
  const withMas = generatePlan({ ...athlete, oneKmTrialSeconds: 210 }, goal); // 3:30 1km
  const expected = masVo2Range(computeMas(210).masMps);
  // Pick a VO2 session with a paced rep (hill reps are effort-based and carry no pace).
  const vo2 = withMas.weeks
    .flatMap((w) => w.sessions)
    .find((s) => s.type === "vo2" && s.steps.some((st) => st.kind === "rep" && st.targetPaceSecPerKm));
  assert.ok(vo2, "plan should contain a paced VO2 session");
  const repPace = vo2.steps.find((st) => st.kind === "rep" && st.targetPaceSecPerKm)!.targetPaceSecPerKm!;
  assert.equal(repPace.minSecPerKm, expected.minSecPerKm);
  assert.equal(repPace.maxSecPerKm, expected.maxSecPerKm);
  assert.ok(withMas.notes.some((n) => /MAS/.test(n)));
});

test("without a 1km trial, VO2 pace comes from the usual derivation (unchanged)", () => {
  const plain = generatePlan(athlete, goal);
  assert.ok(!plain.notes.some((n) => /MAS/.test(n)));
});
