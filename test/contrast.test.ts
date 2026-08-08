import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

/**
 * PHASE 0 EXIT CRITERION: every text token meets WCAG AA in BOTH themes.
 *
 * The Experience Design Brief scored accessibility 2.6/5 and asked for 4.5:1 on body text. Measuring
 * it found the brief was right about the problem and wrong about where it was:
 *
 * ⚠️ IN DARK MODE THE TEXT TOKENS ALREADY PASSED. The brief's own target for secondary text (9.33:1)
 * was within a rounding error of what shipped (9.23:1). The real defect was in LIGHT mode, where
 * `--accent` — the primary action colour, on every button and every link — measured 4.14:1 on white
 * and 3.64:1 on the canvas. The review saw dark screenshots only, so it could not have caught it.
 *
 * ⚠️ THIS TEST READS THE GENERATED CSS, not a table of values written down beside it. A hardcoded
 * expectation would pass for ever while the real tokens drifted; the whole point is to measure what
 * actually ships. Run `node web/app.ts` first.
 */
const css = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/** Relative luminance, WCAG 2.x. */
function lum(hex: string): number {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * f(r!) + 0.7152 * f(g!) + 0.0722 * f(b!);
}
function ratio(a: string, b: string): number {
  const la = lum(a), lb = lum(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/**
 * Pull a theme's tokens out of the built stylesheet.
 * ⚠️ Reads the `:root[data-theme="…"]` blocks specifically, because those are the ones the theme
 * TOGGLE stamps — and the toggle has to win over the media query in both directions. If a future
 * change updates only the `@media (prefers-color-scheme)` block, this reads the stale values and
 * fails, which is the correct outcome: the two must agree.
 */
function tokens(theme: "light" | "dark"): Record<string, string> {
  const html = css();
  const at = html.indexOf(':root[data-theme="' + theme + '"]');
  assert.ok(at >= 0, "no :root[data-theme=" + theme + "] block in the build");
  const block = html.slice(at, html.indexOf("}", at));
  const out: Record<string, string> = {};
  for (const m of block.matchAll(/--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})/g)) out[m[1]!] = m[2]!;
  return out;
}

const GROUNDS = ["bg", "surface", "surface-2"] as const;
/** Body-size text has to clear 4.5:1. Nothing in this app renders body copy in anything else. */
const TEXT_TOKENS = ["ink", "ink-soft", "ink-faint", "accent"] as const;

for (const theme of ["light", "dark"] as const) {
  test(`every text token meets WCAG AA on every ground — ${theme}`, () => {
    const t = tokens(theme);
    for (const g of GROUNDS) assert.ok(t[g], `${theme}: no --${g}`);
    const failures: string[] = [];
    for (const tok of TEXT_TOKENS) {
      const c = t[tok];
      assert.ok(c, `${theme}: no --${tok}`);
      for (const g of GROUNDS) {
        const r = ratio(c!, t[g]!);
        if (r < 4.5) failures.push(`--${tok} on --${g}: ${r.toFixed(2)}:1`);
      }
    }
    assert.deepEqual(failures, [], `${theme} text below 4.5:1 —\n  ` + failures.join("\n  "));
  });

  test(`the accent works as a button background too — ${theme}`, () => {
    // ⚠️ THE ACCENT IS BOTH A TEXT COLOUR AND A SURFACE. Darkening it until it passes as text can
    // push the label on top of it the other way, so both directions have to be checked or the fix
    // for one is a regression in the other.
    const t = tokens(theme);
    const r = ratio(t["accent-ink"]!, t["accent"]!);
    assert.ok(r >= 4.5, `${theme}: --accent-ink on --accent is ${r.toFixed(2)}:1`);
  });
}

test("⚠️ the theme toggle and the media query agree", () => {
  // ⚠️ FOUR PLACES DEFINE THESE TOKENS: :root (light default), the prefers-color-scheme block, and
  // the two data-theme blocks. A change applied to three of them leaves the fourth silently stale —
  // and which one a runner gets depends on their OS setting, so it would reproduce for some people
  // and not others.
  // ⚠️ THE SLICE MUST STOP AT THE END OF THE MEDIA BLOCK. Written as slice(start) it ran to the end
  // of the document — which contains the :root[data-theme="dark"] block — so every value was "found"
  // and the test passed with the media query deliberately reverted. A guard that cannot fail.
  const html = css();
  const start = html.indexOf("@media (prefers-color-scheme: dark)");
  assert.ok(start >= 0, "no prefers-color-scheme block");
  let depth = 0, end = start;
  for (let i = html.indexOf("{", start); i < html.length; i++) {
    if (html[i] === "{") depth++;
    else if (html[i] === "}") { depth--; if (!depth) { end = i; break; } }
  }
  assert.ok(end > start, "unbalanced braces in the media block");
  const media = html.slice(start, end);
  const dark = tokens("dark");
  for (const tok of ["bg", "surface", "ink", "accent"]) {
    assert.ok(media.includes(dark[tok]!),
      `--${tok} is ${dark[tok]} under the theme toggle but that value is absent from the media query`);
  }
});

test("⚠️ the launch splash still starts at its own theme's canvas", () => {
  // ⚠️ iOS PAINTS THE STATUS STRIP FROM THE CANVAS AT FIRST PAINT AND NEVER RE-READS IT. If the
  // splash gradient does not begin at that theme's --bg, the strip stays the splash colour above the
  // app for the WHOLE session. Coupled to any change of --bg, which is exactly what Phase 0 did.
  const html = css();
  for (const theme of ["light", "dark"] as const) {
    const t = tokens(theme);
    const at = html.indexOf(':root[data-theme="' + theme + '"]');
    const block = html.slice(at, html.indexOf("}", at));
    const m = block.match(/--splash-bg:\s*radial-gradient\([^,]+,\s*(#[0-9a-fA-F]{6})/);
    assert.ok(m, `${theme}: no --splash-bg gradient`);
    assert.equal(m![1]!.toLowerCase(), t["bg"]!.toLowerCase(),
      `${theme}: the splash starts at ${m![1]} but the canvas is ${t["bg"]}`);
  }
});

test("the identity survived the refinement", () => {
  // The brief's instruction was to refine the dark aesthetic, not replace it. Guard the two things
  // that make it recognisable: a near-black GREEN canvas, and a teal accent — not a blue or a grey.
  const d = tokens("dark");
  const hex = (c: string) => [0, 2, 4].map((i) => parseInt(c.replace("#", "").slice(i, i + 2), 16));
  const [br, bg, bb] = hex(d["bg"]!);
  assert.ok(bg! > br! && bg! >= bb!, `the canvas is no longer green-biased: ${d["bg"]}`);
  assert.ok(lum(d["bg"]!) < 0.02, `the canvas is no longer near-black: ${d["bg"]}`);
  // ⚠️ "green and blue both beat red" is satisfied by a BLUE. Swapping the accent for #3a7ce8 passed
  // this check and was only caught by the contrast test, which is luck rather than a guard. Teal
  // leans green: green must be the dominant channel.
  const [ar, ag, ab] = hex(d["accent"]!);
  assert.ok(ag! > ar! && ag! >= ab!,
    `the accent is no longer teal (green must dominate): ${d["accent"]}`);
});
