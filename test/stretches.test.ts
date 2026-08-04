import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { STRETCHES, STRETCH_INTRO, stretchHolds, stretchTotalSeconds } from "../src/science/stretches.ts";

const everyString = () =>
  [STRETCH_INTRO, ...STRETCHES.flatMap((s) => [s.name, s.area, s.cue])].join(" ");

test("no stretch copy may promise injury prevention", () => {
  // ⚠️ THE SAME RULE THE WARM-UP COPY LIVES UNDER, for the same reason: static stretching after running
  // is not injury prevention, and the app may not imply otherwise however tempting the phrasing. This
  // sits next to a RED-S screen and an adaptive coach — a claim we cannot defend here costs the runner's
  // trust in everything else the app says.
  const copy = everyString().toLowerCase();
  for (const banned of [
    "prevent injury", "prevents injury", "injury prevention", "avoid injury", "avoids injury",
    "stop injuries", "prevents injuries", "reduce injury", "reduces injury", "injury-proof",
  ]) {
    assert.ok(!copy.includes(banned), `stretch copy claims injury prevention: "${banned}"`);
  }
});

test("nor may it sell stretching as making you faster or safer", () => {
  const copy = everyString().toLowerCase();
  for (const banned of [
    "makes you faster", "make you faster", "run faster", "improves your economy", "running economy",
    "boosts performance", "improve performance", "improves performance", "safer",
  ]) {
    assert.ok(!copy.includes(banned), `stretch copy overclaims: "${banned}"`);
  }
});

test("the routine is short enough that somebody will actually do it", () => {
  // A post-run stretch competes with a shower. Past about eight minutes it stops being offered and
  // starts being ignored, which is worse than a shorter routine — and the offer on the debrief prints
  // this same total, so a long routine also makes the invitation unappealing at a glance.
  const total = stretchTotalSeconds();
  assert.ok(total >= 3 * 60, `the routine is only ${total}s — too short to be worth a screen`);
  assert.ok(total <= 8 * 60, `the routine takes ${Math.round(total / 60)} minutes — too long to be done`);
});

test("every hold is long enough to be a stretch and short enough to hold", () => {
  for (const s of STRETCHES) {
    assert.ok(s.seconds >= 20, `${s.id}: ${s.seconds}s is a touch, not a stretch`);
    assert.ok(s.seconds <= 60, `${s.id}: ${s.seconds}s is longer than anyone holds a stretch`);
    assert.ok(s.cue.trim().length > 20, `${s.id}: the cue does not say how to do it`);
    assert.ok(/[.!]$/.test(s.cue), `${s.id}: cue is not a sentence`);
  }
});

test("the total counts BOTH sides, and the holds list agrees with it", () => {
  // ⚠️ `seconds` is the time for ONE hold. A five-movement routine that counted each one once would
  // promise half the time it takes — and the player counts the holds, so the clock would run past the
  // total it printed.
  const holds = stretchHolds();
  const summed = holds.reduce((t, h) => t + h.seconds, 0);
  assert.equal(summed, stretchTotalSeconds(), "the holds do not add up to the advertised total");
  const twoSided = STRETCHES.filter((s) => s.bothSides);
  assert.ok(twoSided.length > 0, "no two-sided stretch — this test would prove nothing");
  for (const s of twoSided) {
    const mine = holds.filter((h) => h.stretch.id === s.id);
    assert.equal(mine.length, 2, `${s.id} is two-sided but produced ${mine.length} hold(s)`);
    assert.deepEqual(mine.map((h) => h.side), ["left", "right"], `${s.id}: sides are not left then right`);
  }
});

test("ids are unique and every stretch has a figure to draw", () => {
  // ⚠️ `exAnim` falls back to POSES.squat for an unknown pattern, silently — so a typo here does not
  // throw, it draws six identical squats and the whole routine looks like one movement. Read the poses
  // out of the BUILT page, the same precedent as the warm-up delivery test.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("const POSES = {");
  assert.ok(at > 0, "POSES not found in the build — run node web/app.ts");
  const block = html.slice(at, html.indexOf("function exAnim", at));
  const ids = new Set<string>();
  for (const s of STRETCHES) {
    assert.ok(!ids.has(s.id), `duplicate stretch id: ${s.id}`);
    ids.add(s.id);
    assert.match(block, new RegExp("[{,\\s]" + s.pattern + ":"),
      `${s.id}: pattern "${s.pattern}" has no entry in POSES, so it would draw a squat`);
  }
});

test("the sheet's clock is derived from the engine, not written out by hand", () => {
  // The reference design shows a running total. If the sheet hardcoded it, the number on screen and the
  // routine would drift apart the first time a hold time changed.
  const html = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const at = html.indexOf("function stretchSheetHtml(");
  assert.ok(at > 0, "stretchSheetHtml is not in the build");
  const body = html.slice(at, html.indexOf("function openStretchSheet", at));
  assert.match(body, /stretchTotalSeconds\(\)/, "the sheet does not read the total from the engine");
  assert.match(body, /STRETCH_INTRO/, "the sheet does not use the engine's framing line");
});
