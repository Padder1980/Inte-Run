import assert from "node:assert/strict";
import { test } from "node:test";
import { screenRedFlags } from "../src/safety/escalation.ts";
import { screenRedS, estimateEnergyAvailability } from "../src/safety/red-s.ts";
import { assessFemaleHealth } from "../src/safety/female-health.ts";
import { NOT_A_DIAGNOSIS } from "../src/safety/common.ts";

// ---- Medical escalation ---------------------------------------------------

test("no symptoms → no red flags, and never a diagnosis", () => {
  const r = screenRedFlags([]);
  assert.equal(r.urgency, "none");
  assert.equal(r.flags.length, 0);
  assert.equal(r.disclaimer, NOT_A_DIAGNOSIS);
});

test("chest pain escalates to emergency and refers to emergency services", () => {
  const r = screenRedFlags(["chest-pain"]);
  assert.equal(r.urgency, "emergency");
  assert.ok(r.refer.includes("emergency-services"));
  assert.match(r.headline, /emergency/i);
});

test("the most urgent flag leads and sets the overall urgency", () => {
  const r = screenRedFlags(["mental-health-concern", "chest-pain", "bone-pain"]);
  assert.equal(r.urgency, "emergency");
  assert.equal(r.flags[0]?.flag, "chest-pain"); // emergency sorts first
  // all three still reported
  assert.equal(r.flags.length, 3);
});

test("self-harm thoughts route to crisis support with compassionate framing", () => {
  const r = screenRedFlags(["self-harm-thoughts"]);
  assert.equal(r.urgency, "emergency");
  assert.ok(r.refer.includes("crisis-support"));
  assert.doesNotMatch(r.flags[0]?.guidance ?? "", /diagnos/i);
});

test("duplicate flags are de-duplicated", () => {
  const r = screenRedFlags(["bone-pain", "bone-pain"]);
  assert.equal(r.flags.length, 1);
});

// ---- RED-S ----------------------------------------------------------------

test("no indicators → low risk, no referral", () => {
  const r = screenRedS([]);
  assert.equal(r.risk, "low");
  assert.equal(r.refer.length, 0);
});

test("a single strong indicator lifts risk off low and refers on", () => {
  const r = screenRedS(["bone-stress-history"]);
  assert.notEqual(r.risk, "low");
  assert.ok(r.refer.includes("sports-dietitian"));
});

test("two strong indicators → high risk", () => {
  const r = screenRedS(["menstrual-disruption", "unintentional-weight-loss"]);
  assert.equal(r.risk, "high");
  assert.equal(r.urgency, "professional");
});

test("guidance never tells anyone to eat less", () => {
  const r = screenRedS(["restrictive-or-skipped-meals", "persistent-fatigue"]);
  const all = r.guidance.join(" ").toLowerCase();
  assert.doesNotMatch(all, /lose weight|eat less|cut calories|restrict/);
  assert.match(all, /fuel/);
});

test("energy-availability estimate bands low/reduced/adequate", () => {
  assert.equal(estimateEnergyAvailability({ intakeKcal: 2000, exerciseEnergyKcal: 800, fatFreeMassKg: 50 }).band, "low"); // 24
  assert.equal(estimateEnergyAvailability({ intakeKcal: 2500, exerciseEnergyKcal: 700, fatFreeMassKg: 50 }).band, "reduced"); // 36
  assert.equal(estimateEnergyAvailability({ intakeKcal: 3200, exerciseEnergyKcal: 700, fatFreeMassKg: 50 }).band, "adequate"); // 50
  assert.throws(() => estimateEnergyAvailability({ intakeKcal: 2000, exerciseEnergyKcal: 0, fatFreeMassKg: 0 }));
});

// ---- Female-athlete health ------------------------------------------------

test("absent periods → health prompt and suggests the RED-S screen", () => {
  const r = assessFemaleHealth({ status: "absent-3m-plus" });
  assert.equal(r.suggestRedSScreen, true);
  assert.equal(r.urgency, "professional");
  assert.ok(r.prompts.some((p) => /period/i.test(p.topic)));
});

test("early postpartum holds impact running and refers to pelvic-health physio", () => {
  const r = assessFemaleHealth({ status: "postpartum", postpartumWeeks: 6 });
  const p = r.prompts.find((x) => /return to running/i.test(x.topic));
  assert.ok(p);
  assert.ok(p.refer.includes("pelvic-health-physio"));
});

test("regular cycle with no symptoms produces no prompts (no compulsory cycle-syncing)", () => {
  const r = assessFemaleHealth({ status: "regular" });
  assert.equal(r.prompts.length, 0);
  assert.equal(r.urgency, "none");
});

test("pelvic-floor symptoms refer to a pelvic-health physio", () => {
  const r = assessFemaleHealth({ status: "regular", symptoms: ["pelvic-floor"] });
  assert.ok(r.prompts.some((p) => p.refer.includes("pelvic-health-physio")));
});
