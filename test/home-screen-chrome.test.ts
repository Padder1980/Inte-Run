import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * How a Home Screen web app sits on the screen, and what colours the strip iOS paints above it.
 *
 * All of this is MEASURED on the owner's iPhone 16 Pro Max, iOS 18.7, from the Home Screen — printed
 * by the panel in Support › Your data. It is written down because every part of it was got wrong at
 * least once by reasoning from screenshots instead, and the wrong answers are all plausible.
 */
const SOURCE = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");

function tokenValue(theme: "light" | "dark", name: string): string {
  const rule = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(SOURCE);
  assert.ok(rule, `no :root[data-theme="${theme}"] block`);
  const v = new RegExp(`--${name}:\\s*([^;]+);`).exec(rule![1]!);
  assert.ok(v, `no --${name} in the ${theme} tokens`);
  return v![1]!.trim().toLowerCase();
}

test("the status bar style is not black-translucent", () => {
  // MEASURED with black-translucent:
  //   SCREEN 440×956 · PAGE 440×894 · INSETS T62 B34 · SCREENY 0 · OUTER 440×956
  // The window was the full screen but the layout viewport was 894 starting at screenY 0, so 62pt of
  // the BOTTOM was dead — while inset-top reported 62, so the top bar padded for a status bar that
  // already overlapped it. APP 0..894 and NAV 796..894 show the CSS was right the whole time: the
  // shell filled the viewport and the nav sat on its bottom edge. The viewport was misplaced.
  //
  // ⚠️ iOS SNAPSHOTS THIS META WHEN THE ICON IS ADDED TO THE HOME SCREEN. Changing it did nothing
  // through five deploys; it only took effect after the icon was deleted and re-added. If this value
  // is ever changed again, the app must be re-added before the change can be judged.
  const m = /<meta name="apple-mobile-web-app-status-bar-style" content="([^"]+)">/.exec(SOURCE);
  assert.ok(m, "no apple-mobile-web-app-status-bar-style meta");
  assert.notEqual(m![1], "black-translucent",
    "black-translucent strands 62pt at the bottom of the screen on iOS 18");
  // viewport-fit=cover must stay: it is what gives inset-bottom 34 for the home indicator.
  assert.match(SOURCE, /<meta name="viewport"[^>]*viewport-fit=cover/, "viewport-fit=cover was dropped");
});

test("the strip is the APP background, never the splash colour", () => {
  // ⚠️ MEASURED: with status-bar-style "default" the strip colour is fixed at launch and never
  // re-read. Setting it to the splash colour was tried and is WRONG: the splash matched for its two
  // seconds and then a dark strip sat above the light app for the entire session. Verified that the
  // page background and the meta both switch to --bg when the app appears — iOS simply ignores it.
  //
  // So the strip must be the colour the app spends its session being. A two-second mismatch during
  // the splash beats a permanent one, and the only way to remove even that is to make the splash
  // itself match the theme — a design decision, not a chrome one.
  for (const scheme of ["light", "dark"] as const) {
    const re = new RegExp(
      `<meta name="theme-color" content="([^"]+)" media="\\(prefers-color-scheme: ${scheme}\\)">`);
    const m = re.exec(SOURCE);
    assert.ok(m, `no theme-color meta for ${scheme}`);
    assert.equal(m![1]!.trim().toLowerCase(), tokenValue(scheme, "bg"),
      `${scheme} theme-color must be that scheme's --bg`);
  }
  // The runtime resolver must not reintroduce a launch-time colour.
  assert.ok(!/SPLASH_CHROME/.test(SOURCE),
    "chromeColor must not return a splash colour — the strip cannot follow the screen on iOS");
});

test("the manifest fallback is a background colour, not the brand colour", () => {
  // iOS snapshots this at install and it cannot follow the theme, so it is the light --bg — the
  // common case — with the per-scheme metas covering the rest where iOS honours them.
  const mf = /theme_color:\s*"([^"]+)"/.exec(SOURCE);
  assert.ok(mf, "no theme_color in the manifest");
  const value = mf![1]!.trim().toLowerCase();
  assert.equal(value, tokenValue("light", "bg"), "manifest theme_color must be the light --bg");
  assert.notEqual(value, tokenValue("light", "accent"),
    "manifest theme_color is the brand accent — that is the original teal-band bug");
});

test("a manual theme change still moves the strip", () => {
  // The media queries see the SYSTEM scheme only; the app's own theme button is invisible to them.
  // iOS will not act on this mid-session, but other browsers do, and it keeps the value honest.
  assert.match(SOURCE, /function syncThemeColor\(\)/, "no runtime theme-color sync");
  assert.match(SOURCE, /setAttribute\("data-theme"[^;]*\);\s*syncThemeColor\(\);/,
    "the theme button must re-sync theme-color");
  assert.match(SOURCE,
    /matchMedia\('\(prefers-color-scheme: dark\)'\)\.addEventListener\('change', syncThemeColor\)/,
    "a system scheme change must re-sync theme-color");
  // ⚠️ One un-media'd tag at runtime: with several present the browser takes the first that matches,
  // so the static media pair would outvote the live one.
  assert.match(SOURCE, /for \(let i = metas\.length - 1; i >= 1; i--\) metas\[i\]\.remove\(\);/,
    "syncThemeColor must collapse to a single meta");
});

test("--vvh cannot latch at launch, so the nav never floats above a dead strip", () => {
  // A size threshold alone cannot prevent this. A Home Screen web app reports visualViewport.height
  // wrong at launch — short, with no corrective resize afterwards — and at that moment the LAYOUT
  // viewport still reads full height, so the bogus delta sails past any threshold. --vvh latched the
  // short value and the shell stayed short for the whole session.
  //
  // A keyboard cannot be up unless something focusable is focused, and nothing is focused at launch.
  assert.match(SOURCE, /const keyboardPossible = \(\) =>/, "no focused-field gate on --vvh");
  assert.match(SOURCE, /if \(keyboardPossible\(\) && layout - h > 120\)/,
    "--vvh must require BOTH a focused field and a keyboard-sized delta");
  assert.ok(/keyboardPossible\(\) &&/.test(SOURCE) && /layout - h > 120/.test(SOURCE),
    "neither condition may be dropped");
  for (const ev of ["focusin", "focusout", "pageshow", "visibilitychange"]) {
    assert.ok(new RegExp(`addEventListener\\("${ev}"`).test(SOURCE),
      `--vvh is never re-evaluated on ${ev}, so a stale value can survive`);
  }
});
