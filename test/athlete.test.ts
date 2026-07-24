import assert from "node:assert/strict";
import { test } from "node:test";
import { classifyRunner } from "../src/athlete/classification.ts";
import { assessMasters } from "../src/athlete/masters.ts";
import { applicability, type EvidenceTag } from "../src/athlete/evidence-tag.ts";

// ---- Classification -------------------------------------------------------

test("a casual runner is recreational; a high-volume veteran is highly trained", () => {
  const casual = classifyRunner({ runsPerWeek: 2, yearsRunning: 0.5 });
  assert.equal(casual.tier, 2);
  assert.equal(casual.label, "Recreational runner");

  const veteran = classifyRunner({ runsPerWeek: 6, yearsRunning: 5, weeklyVolumeKm: 80 });
  assert.equal(veteran.tier, 4);
  assert.ok(veteran.note && /elite/i.test(veteran.note));
});

test("a fast 5k lifts the tier even on modest volume", () => {
  const base = classifyRunner({ runsPerWeek: 4, yearsRunning: 2, weeklyVolumeKm: 30 });
  assert.equal(base.tier, 3);
  const fast = classifyRunner({ runsPerWeek: 4, yearsRunning: 2, weeklyVolumeKm: 30, recent5kSeconds: 950 });
  assert.equal(fast.tier, 4); // ~15:50 5k lifts to highly trained
});

test("every classification is plain and explains what it means for training", () => {
  const c = classifyRunner({ runsPerWeek: 3, yearsRunning: 1 });
  assert.ok(c.label.length > 0 && c.meaning.length > 0);
});

// ---- Masters --------------------------------------------------------------

test("under 35 gets standard guidance, not masters treatment", () => {
  const m = assessMasters({ age: 28 });
  assert.equal(m.isMasters, false);
  assert.equal(m.minEasyDaysBetweenQuality, 1);
});

test("older masters get more recovery but keep their intensity", () => {
  const m = assessMasters({ age: 62 });
  assert.equal(m.isMasters, true);
  assert.equal(m.ageBand, "60-plus");
  assert.ok(m.minEasyDaysBetweenQuality >= 2);
  assert.match(m.points.join(" "), /intensity|speed|power/i); // never "just slow down"
});

test("women from midlife are pointed to the female-health screen", () => {
  assert.equal(assessMasters({ age: 52, sex: "female" }).suggestFemaleHealth, true);
  assert.equal(assessMasters({ age: 52, sex: "male" }).suggestFemaleHealth, false);
});

// ---- Evidence applicability ----------------------------------------------

const HEAVY_STRENGTH: EvidenceTag = {
  claim: "Heavy strength 2×/week improves economy",
  population: "trained young men",
  sex: "male",
  levels: [3, 4],
  ageRange: [18, 35],
  quality: "strong",
};

test("evidence applies well to the population it was studied in", () => {
  const a = applicability(HEAVY_STRENGTH, { tier: 3, sex: "male", age: 28 });
  assert.equal(a.level, "applies-well");
  assert.equal(a.caveats.length, 0);
});

test("a mismatch in sex or age becomes a plain caveat, not a removal", () => {
  const a = applicability(HEAVY_STRENGTH, { tier: 3, sex: "female", age: 55 });
  assert.equal(a.level, "limited"); // two mismatches (sex + age)
  assert.equal(a.caveats.length, 2);
  assert.ok(a.caveats.some((c) => /male runners/.test(c))); // "studied mainly in male runners"
  assert.ok(a.caveats.some((c) => /year/.test(c)));
});

test("emerging evidence is flagged even with no population mismatch", () => {
  const tag: EvidenceTag = { claim: "x", population: "runners", sex: "any", levels: "any", quality: "emerging" };
  const a = applicability(tag, { tier: 2, sex: "female", age: 40 });
  assert.equal(a.level, "general-guide");
  assert.match(a.qualityNote, /emerging/i);
});
