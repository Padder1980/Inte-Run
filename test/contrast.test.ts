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

  /**
   * ⚠️ A CATEGORY COLOUR USED AS TEXT IS TEXT, AND NOTHING WAS CHECKING IT. The sweep above covers the
   * four INK tokens on the three neutral grounds — which is where body copy lives — so it never looked
   * at the pattern both new guide pages use: a small uppercase label in `--peak`, `--rest` or `--ease`
   * sitting on a panel tinted 8–9% with that same colour. Measured 2026-08-10, all in LIGHT mode:
   *
   *   --ease  on its own 8% tint  2.41:1   (the injury guide's URGENT band title)
   *   --peak  on --surface-2      2.58:1   (BEFORE/DURING keys, meal-part headings)
   *   --rest  on its own 8% tint  4.31:1   (both guides' emergency band titles)
   *
   * Dark mode passed all three, which is exactly the trap the accent fix already taught this file: the
   * brief reviewed dark screenshots, and the failures live in light. Each is now mixed toward the
   * theme's own `--ink`, so one declaration darkens in light and lightens in dark.
   *
   * ⚠️ THE GROUND IS THE TINT, NOT THE PLAIN SURFACE. Checking these against `--surface-2` would be
   * measuring a background the label never appears on, and the tint is the harder case in light mode.
   */
  test(`category colours used as text clear AA on their own tinted panels — ${theme}`, () => {
    const t = tokens(theme);
    /** color-mix(in srgb, a p%, b) — component-wise on gamma-encoded sRGB, which is what CSS does. */
    const mix = (a: string, b: string, p: number): string => {
      const px = (h: string) => [0, 2, 4].map((i) => parseInt(h.replace("#", "").slice(i, i + 2), 16));
      const [x, y] = [px(a), px(b)];
      return "#" + [0, 1, 2].map((i) => Math.round(x[i]! * p + y[i]! * (1 - p))
        .toString(16).padStart(2, "0")).join("");
    };
    // [label, ink colour as shipped, the ground it actually sits on]
    const pairs: Array<[string, string, string]> = [
      ["fuelling BEFORE/DURING key", mix(t["peak"]!, t["ink"]!, 0.6), t["surface-2"]!],
      ["fuelling meal-part heading", mix(t["peak"]!, t["ink"]!, 0.6), t["surface-2"]!],
      ["fuelling emergency heading", mix(t["rest"]!, t["ink"]!, 0.8), mix(t["rest"]!, t["surface-2"]!, 0.08)],
      ["injury emergency band title", mix(t["rest"]!, t["ink"]!, 0.8), mix(t["rest"]!, t["surface-2"]!, 0.08)],
      ["injury urgent band title", mix(t["ease"]!, t["ink"]!, 0.6), mix(t["ease"]!, t["surface-2"]!, 0.08)],
    ];
    const failures: string[] = [];
    for (const [name, ink, ground] of pairs) {
      const r = ratio(ink, ground);
      if (r < 4.5) failures.push(`${name}: ${r.toFixed(2)}:1`);
    }
    assert.deepEqual(failures, [], `${theme} category text below 4.5:1 —\n  ` + failures.join("\n  "));
    // ⚠️ AND THE RAW TOKENS MUST STILL BE THE FAILING CASE, or this test is measuring a mix nobody uses.
    // If a future palette change made raw --peak pass on its own, the mixes above became unnecessary
    // and somebody should simplify them rather than leave the indirection in place unexplained.
    if (theme === "light") {
      assert.ok(ratio(t["peak"]!, t["surface-2"]!) < 4.5,
        "raw --peak now passes as text in light mode — the color-mix indirection can be removed");
      assert.ok(ratio(t["ease"]!, mix(t["ease"]!, t["surface-2"]!, 0.08)) < 4.5,
        "raw --ease now passes on its own tint — the color-mix indirection can be removed");
    }
    // The declarations really are the ones measured above, not a table that has drifted from the CSS.
    // ⚠️ COUNTED, NOT `includes`. Two of the three appear TWICE (--peak on .fg-bda-k and .fg-part-h,
    // --rest on both guides' band titles), so a presence check let either element of a pair revert to the
    // raw token while its sibling kept the guard green — which is the failing case, undetected.
    const html = css();
    for (const [decl, want] of [
      ["color: color-mix(in srgb, var(--peak) 60%, var(--ink))", 2],
      ["color: color-mix(in srgb, var(--rest) 80%, var(--ink))", 2],
      ["color: color-mix(in srgb, var(--ease) 60%, var(--ink))", 1],
    ] as Array<[string, number]>) {
      const n = html.split(decl).length - 1;
      assert.equal(n, want, "expected " + want + " uses of `" + decl + "`, found " + n);
    }
    // ⚠️ AND THE GROUND ITSELF IS ASSERTED. The 8% tint above is hardcoded here; darkening it in the CSS
    // would drop the real contrast while every number in this test stayed the same.
    for (const tint of ["var(--rest) 8%, var(--surface-2)", "var(--ease) 8%, var(--surface-2)"])
      assert.ok(html.includes(tint), "the band tint changed but this test still assumes 8%: " + tint);
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

// ---- Shoe Rack -----------------------------------------------------------------------------------

test("⚠️ the shoe rack never claims a new pair prevents injury", () => {
  // ⚠️ THE SAME RULE THE WARM-UP AND STRETCH COPY ALREADY FOLLOW, and for the same reason: this app
  // sits beside a RED-S screen, and one claim it cannot defend costs the runner's trust in all the
  // rest. Shoes wearing out is real; "replace them to avoid injury" is not supported by the evidence.
  const html = css();
  const at = html.indexOf("function shoeRackView(");
  assert.ok(at >= 0, "shoeRackView is not in the build");
  const view = html.slice(at, html.indexOf("function shoeBar(", at) + 600);
  const sheet = html.slice(html.indexOf("function openShoeSheet("), html.indexOf("function openShoeSheet(") + 5000);
  const banned = /prevent\w* (an )?injur|avoid\w* injur|protects? your (joints|knees|legs)|reduces? (the )?risk|safer|injury[- ]free|worn[- ]out shoes cause/i;
  // ⚠️ STRIP THE COMMENTS FIRST. This guard reads the source, and the source explains WHY the banned
  // phrasing is banned — by quoting it. So the comment documenting the rule tripped the rule, and the
  // fix would obviously have been to soften the comment, which is exactly backwards. It must measure
  // the copy that SHIPS, not the reasoning beside it.
  const strip = (b: string) => b.split("\n").filter((l) => !l.trim().startsWith("//")).join("\n");
  for (const [where, raw] of [["the rack", view], ["the edit sheet", sheet]] as const) {
    const body = strip(raw);
    const copy = (body.match(/'[^']{25,}'/g) || []).join(" ");
    assert.ok(copy.length > 100, `${where}: found almost no copy to check — the guard is not reading it`);
    const m = copy.match(banned);
    assert.equal(m, null, `${where} claims a health benefit: "${m && m[0]}"`);
  }
  // ...and it must still say the honest thing: that it is a reminder, not a rule.
  assert.match(view + sheet, /reminder, not a rule/i,
    "the rack no longer says the replacement distance is a reminder rather than a rule");
});

test("the shoe rack states are carried by words, not only colour", () => {
  // The brief: colour is never the only workout, completion or risk signal. A wear bar is exactly
  // where that is tempting.
  const html = css();
  // ⚠️ The wear labels live in shoePill(), not shoeRackView() — the slice has to reach past it or the
  // guard fails for the wrong reason and someone "fixes" it by deleting the assertion.
  const view = html.slice(html.indexOf("function shoeRackView("), html.indexOf("function shoeBar(") + 600);
  // The wording follows his mockup: Good / Monitor / Replace, plus Retired.
  for (const word of ["Good", "Monitor", "Replace", "Retired"]) {
    assert.ok(view.includes(word), `no text label for a wear state: ${word}`);
  }
  assert.match(view, /role="img" aria-label=/, "the wear bar has no accessible label");
});

test("⚠️ every commit point credits the rack", () => {
  // ⚠️ A phone run and a wrist run are committed in two different places, and this project's
  // most-repeated defect is a fix applied to one builder and not the other. A runner who records on
  // their watch would otherwise watch their shoes never wear out.
  const html = css();
  assert.equal((html.match(/shoeCreditRun\(/g) || []).length, 3,
    "expected the definition plus BOTH commit points (phone and wrist) to credit the rack");
  // ⚠️ SCOPED TO deleteRun's BODY. Written against the whole document, /shoeUncreditRun\(run\)/ matched
  // the FUNCTION DECLARATION — `function shoeUncreditRun(run) {` — so the guard passed with the call
  // site deliberately deleted. A regex that matches a definition can never prove a caller exists.
  const del = html.slice(html.indexOf("function deleteRun("), html.indexOf("function deleteRun(") + 1400);
  assert.ok(del.length > 200, "could not read deleteRun");
  assert.match(del, /shoeUncreditRun\(run\)/, "deleting a run does not take its distance back off");
  assert.match(del, /shoeRecreditRun\(UNDO_RUN\.run\)/, "undoing a delete does not restore the mileage");
});
