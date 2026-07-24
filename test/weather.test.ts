import assert from "node:assert/strict";
import { test } from "node:test";
import { assessConditions } from "../src/environment/weather.ts";

test("cool, calm conditions need no adjustment", () => {
  const r = assessConditions({ tempC: 12, humidityPct: 55, windKph: 8, sessionType: "threshold" });
  assert.equal(r.severity, "none");
  assert.equal(r.effortBased, false);
  assert.equal(r.pacePenaltySecPerKm, undefined);
});

test("a hot, humid threshold session switches to effort with a pace penalty", () => {
  const r = assessConditions({ tempC: 30, humidityPct: 75, windKph: 8, sessionType: "threshold" });
  assert.ok(["high", "severe"].includes(r.severity));
  assert.equal(r.effortBased, true);
  assert.ok((r.pacePenaltySecPerKm ?? 0) > 0);
  assert.match(r.points.join(" "), /effort/i);
  assert.match(r.points.join(" "), /humid/i);
});

test("severe heat advises rescheduling or easing a hard session", () => {
  const r = assessConditions({ tempC: 36, humidityPct: 60, windKph: 6, sessionType: "vo2" });
  assert.equal(r.severity, "severe");
  assert.match(r.points.join(" "), /cooler time|swapping it|reschedul/i);
});

test("an easy run in heat is told to slow down, not reschedule", () => {
  const r = assessConditions({ tempC: 29, humidityPct: 70, windKph: 8, sessionType: "easy" });
  assert.match(r.points.join(" "), /slow down|go by feel/i);
});

test("strong wind on intervals becomes effort-based with headwind strategy", () => {
  const r = assessConditions({ tempC: 14, humidityPct: 55, windKph: 42, sessionType: "vo2" });
  assert.equal(r.effortBased, true);
  assert.match(r.points.join(" "), /headwind/i);
  assert.match(r.headline, /wind|effort/i);
});

test("cold prompts a longer warm-up but no pace penalty", () => {
  const r = assessConditions({ tempC: 1, humidityPct: 70, windKph: 10, sessionType: "easy" });
  assert.match(r.points.join(" "), /warm up longer|layer/i);
  assert.equal(r.pacePenaltySecPerKm, undefined);
});

test("the summary describes the conditions plainly", () => {
  const r = assessConditions({ tempC: 30, humidityPct: 75, windKph: 8, sessionType: "threshold" });
  assert.match(r.summary, /30°C/);
  assert.match(r.summary, /km\/h/);
});
