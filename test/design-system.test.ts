import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * PHASE 0 — THE LADDERS, AND A RATCHET THAT ONLY TURNS ONE WAY.
 *
 * The design brief's central visual finding was that "repeated rounded containers and outlines give
 * most elements similar weight". Measured before any of this was written, the stylesheet carried TEN
 * distinct border-radius values and TWELVE font sizes. Hierarchy cannot survive that, because every
 * object ends up shouting at the same volume.
 *
 * ⚠️ THIS TEST DOES NOT DEMAND THE LADDERS BE FULLY ADOPTED, AND THAT IS DELIBERATE. Rewriting 200-odd
 * off-ladder values across 1,900 lines of CSS in one pass is a large regression risk for no visible
 * gain, and this project's history says the dangerous changes are the ones that look mechanical. So
 * it counts the drift and refuses to let it GROW. Migration then happens screen by screen, inside the
 * phase that touches that screen, and the number can only ever come down.
 *
 * ⚠️ WHEN YOU MIGRATE A SCREEN, LOWER THE CEILING TO WHAT IT MEASURES. Leaving it high is how a
 * ratchet quietly becomes a rubber band.
 */
const css = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** Just the stylesheet — matching the whole document would sweep up inline styles in the markup. */
function sheet(): string {
  const html = css();
  const a = html.indexOf("<style>"), b = html.indexOf("</style>");
  assert.ok(a >= 0 && b > a, "no style block in the build");
  return html.slice(a, b);
}

test("the ladders exist, as tokens", () => {
  const s = sheet();
  for (const t of ["--r-hero", "--r-card", "--r-ctl", "--r-pill"]) assert.match(s, new RegExp(t + ":"), "missing radius token " + t);
  for (const t of ["--s1", "--s2", "--s3", "--s4", "--s5", "--s6"]) assert.match(s, new RegExp("\\" + "-" + "-" + t.slice(2) + ":"), "missing spacing token " + t);
  for (const t of ["--t-display", "--t-hero", "--t-section", "--t-card", "--t-body", "--t-meta", "--t-label"])
    assert.match(s, new RegExp(t + ":"), "missing type token " + t);
  assert.match(s, /--tap: *44px/, "no minimum touch-target token");
});

test("the type ladder is seven steps and they are distinct", () => {
  // A ladder with two rungs the same height is not a ladder.
  const s = sheet();
  const vals = ["--t-display", "--t-hero", "--t-section", "--t-card", "--t-body", "--t-meta", "--t-label"]
    .map((t) => Number((s.match(new RegExp(t + ": *([0-9.]+)px")) || [])[1]));
  assert.ok(vals.every((v) => v > 0), "a type token has no value: " + JSON.stringify(vals));
  assert.equal(new Set(vals).size, 7, "two type steps are the same size: " + vals.join(", "));
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i]! < vals[i - 1]!, "the ladder is not descending: " + vals.join(", "));
});

/**
 * ⚠️ THE RATCHET. These ceilings are the measurement taken on 2026-08-08, not a target. Adding an
 * off-ladder value fails; migrating a screen lowers them.
 */
const RADIUS_CEILING = 143;   // measured 2026-08-08: 143 of 225
const FONTSIZE_CEILING = 323; // measured 2026-08-08: 323 of 442

test("⚠️ off-ladder radii do not increase", () => {
  const s = sheet();
  const onLadder = new Set(["24px", "18px", "12px", "999px", "50%"]);
  const found = (s.match(/border-radius: *[0-9]+(px|%)/g) || [])
    .map((m) => m.split(":")[1]!.trim())
    .filter((v) => !onLadder.has(v));
  assert.ok(found.length <= RADIUS_CEILING,
    `off-ladder radii rose to ${found.length} (ceiling ${RADIUS_CEILING}). Use var(--r-hero|--r-card|--r-ctl|--r-pill).`);
});

test("⚠️ off-ladder font sizes do not increase", () => {
  const s = sheet();
  const onLadder = new Set(["32px", "24px", "20px", "17px", "15px", "13px", "11px"]);
  const found = (s.match(/font-size: *[0-9.]+px/g) || [])
    .map((m) => m.split(":")[1]!.trim())
    .filter((v) => !onLadder.has(v));
  assert.ok(found.length <= FONTSIZE_CEILING,
    `off-ladder font sizes rose to ${found.length} (ceiling ${FONTSIZE_CEILING}). Use var(--t-*).`);
});

test("⚠️ everything focusable has a visible focus ring", () => {
  // There were FOUR focus-visible rules in the whole stylesheet before this. A keyboard or
  // switch-control user could not see where they were on the screen.
  const s = sheet();
  assert.match(s, /:focus-visible *\{[^}]*outline:/, "no global focus-visible outline");
  for (const el of ["button", "a", "input", "select", "textarea"])
    assert.match(s, new RegExp(el + ":focus-visible"), "no focus ring for " + el);
  assert.match(s, /\[role="button"\]:focus-visible/, "no focus ring for role=button elements");
});

test("⚠️ Reduce Motion is honoured globally, not per component", () => {
  // A rule per component is a rule the next component forgets.
  const s = sheet();
  // ⚠️ THERE ARE FOURTEEN reduced-motion BLOCKS, and indexOf finds the first — a per-component one
  // that predates this work. Written that way the test failed while the global rule sat two hundred
  // lines below it, which would have been "fixed" by deleting the assertion. Scan them all.
  const blocks = s.split("@media (prefers-reduced-motion: reduce)").slice(1).map((b) => b.slice(0, 400));
  assert.ok(blocks.length > 0, "no reduced-motion block at all");
  const global = blocks.find((b) => /\*, *\*::before, *\*::after/.test(b));
  assert.ok(global, `${blocks.length} reduced-motion blocks and none is global — a per-component rule is one the next component forgets`);
  assert.match(global!, /animation-duration/, "the global rule does not stop animations");
  assert.match(global!, /transition-duration/, "the global rule does not stop transitions");
});

test("the shared vocabulary exists and is built on the tokens", () => {
  const s = sheet();
  for (const c of [".ui-eyebrow", ".ui-display", ".ui-section", ".ui-pill", ".ui-bar"])
    assert.ok(s.includes(c), "missing shared component " + c);
  // ⚠️ Built FROM the tokens, or it is just another set of hardcoded numbers with a nicer name.
  const disp = s.slice(s.indexOf(".ui-display"), s.indexOf(".ui-display") + 220);
  assert.match(disp, /var\(--t-display\)/, ".ui-display hardcodes its size instead of using the token");
  const pill = s.slice(s.indexOf(".ui-pill {"), s.indexOf(".ui-pill {") + 320);
  assert.match(pill, /var\(--r-pill\)/, ".ui-pill hardcodes its radius");
});

test("⚠️ every status variant carries a word, not only a colour", () => {
  // The brief: colour is never the only workout, completion or risk signal. A pill that differs only
  // by hue is invisible to a colour-blind runner and to anyone in bright sun.
  const s = sheet();
  for (const v of [".ui-pill.good", ".ui-pill.watch", ".ui-pill.stop", ".ui-pill.done"])
    assert.ok(s.includes(v), "missing status variant " + v);
  // and the rack, which is the first consumer, must label every state in words
  const html = css();
  const rack = html.slice(html.indexOf("function shoePill("), html.indexOf("function shoePill(") + 500);
  for (const w of ["Good", "Monitor", "Replace", "Retired"])
    assert.ok(rack.includes(w), "a wear state has no word: " + w);
});
