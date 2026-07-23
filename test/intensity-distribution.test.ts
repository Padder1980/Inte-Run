import assert from "node:assert/strict";
import { test } from "node:test";
import type { Athlete } from "../src/domain/types.ts";
import { chooseModel } from "../src/science/intensity-distribution.ts";

const base: Athlete = {
  daysPerWeek: 5,
  recent: { distanceMeters: 5000, timeSeconds: 1260 },
  experience: "recreational",
  includeStrength: true,
};

test("recreational and beginner athletes default to pyramidal", () => {
  assert.equal(chooseModel({ ...base, experience: "recreational" }), "pyramidal");
  assert.equal(chooseModel({ ...base, experience: "beginner" }), "pyramidal");
});

test("competitive athletes default to polarized", () => {
  assert.equal(chooseModel({ ...base, experience: "competitive" }), "polarized");
});

test("returning-from-injury forces pyramidal even for competitive athletes", () => {
  assert.equal(
    chooseModel({ ...base, experience: "competitive", returningFromInjury: true }),
    "pyramidal",
  );
});
