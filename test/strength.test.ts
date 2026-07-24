import assert from "node:assert/strict";
import { test } from "node:test";
import type { Phase } from "../src/domain/types.ts";
import { strengthSession } from "../src/plan/session-templates.ts";

// Plyometrics are now structured exercises with the "jump" movement pattern.
const hasPlyometrics = (s: { exercises?: { pattern: string }[] }): boolean =>
  (s.exercises ?? []).some((e) => e.pattern === "jump");

test("build and peak heavy strength sessions include plyometric/power work", () => {
  for (const phase of ["build", "peak"] as Phase[]) {
    const s = strengthSession(phase, false);
    assert.equal(s.type, "strength");
    assert.ok(s.exercises && s.exercises.length > 0, "should list exercises");
    assert.ok(hasPlyometrics(s), `expected plyometrics in a heavy ${phase} strength session`);
  }
});

test("base strength stays technique-focused with no plyometrics yet", () => {
  const s = strengthSession("base", false);
  assert.match(s.title, /technique/i);
  assert.ok(
    !hasPlyometrics(s),
    "base phase should not add plyometrics before faster running is tolerated",
  );
});

test("maintenance strength sessions never add plyometrics", () => {
  for (const phase of ["base", "build", "peak", "taper"] as Phase[]) {
    const s = strengthSession(phase, true);
    assert.match(s.title, /maintenance/i);
    assert.ok(!hasPlyometrics(s), `maintenance (${phase}) should stay low-volume without plyometrics`);
  }
});

test("every strength exercise carries a prescription and a demo pattern", () => {
  const s = strengthSession("build", false);
  for (const e of s.exercises ?? []) {
    assert.ok(e.name && e.primary && e.pattern, "exercise needs name/primary/pattern");
    assert.ok(e.sets >= 1 && e.reps.length > 0, "exercise needs sets and reps");
  }
});
