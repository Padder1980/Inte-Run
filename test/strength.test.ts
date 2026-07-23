import assert from "node:assert/strict";
import { test } from "node:test";
import type { Phase } from "../src/domain/types.ts";
import { strengthSession } from "../src/plan/session-templates.ts";

const mentionsPlyometrics = (description: string): boolean =>
  /plyometric|pogo|box.*jump|hurdle jump/i.test(description);

test("build and peak heavy strength sessions include plyometric/power work", () => {
  for (const phase of ["build", "peak"] as Phase[]) {
    const s = strengthSession(phase, false);
    assert.equal(s.type, "strength");
    assert.ok(
      mentionsPlyometrics(s.description),
      `expected plyometrics in a heavy ${phase} strength session`,
    );
  }
});

test("base strength stays technique-focused with no plyometrics yet", () => {
  const s = strengthSession("base", false);
  assert.match(s.description, /technique focus/);
  assert.ok(
    !mentionsPlyometrics(s.description),
    "base phase should not add plyometrics before faster running is tolerated",
  );
});

test("maintenance strength sessions never add plyometrics", () => {
  for (const phase of ["base", "build", "peak", "taper"] as Phase[]) {
    const s = strengthSession(phase, true);
    assert.match(s.title, /maintenance/i);
    assert.ok(
      !mentionsPlyometrics(s.description),
      `maintenance (${phase}) should stay low-volume without plyometrics`,
    );
  }
});
