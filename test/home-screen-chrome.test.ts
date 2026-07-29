import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The strip above a Home Screen web app is painted by iOS, and it CANNOT BE REMOVED.
 *
 * A standalone web app on iOS 26 is handed a viewport exactly one top-safe-area short of the screen
 * — WebKit bug 301994. Measured on the owner's 16 Pro Max: screen 956, page 894, difference 62, with
 * env(safe-area-inset-top) 0 while inset-bottom still reports 34 (so viewport-fit=cover IS being
 * honoured — this was never a missing meta tag). iOS fills those 62pt itself, from theme-color.
 *
 * So the only thing that hides the strip is making it the same colour as whatever is on screen
 * underneath it. That is a moving target, and getting it wrong is not a subtle cosmetic issue: it
 * reads as the whole app being pushed down behind a band. Two ways it has already gone wrong here:
 *
 *   1. theme-color was the brand teal, above a near-white app. A teal band.
 *   2. Fixing (1) by pinning theme-color to --bg put a near-WHITE band above the splash, which is
 *      hardcoded near-black in BOTH themes — brighter and worse, at the one moment every single
 *      launch passes through, and the welcome-back overlay waits for a tap before it goes.
 *
 * Hence: the static meta and the manifest default are the SPLASH colour, because the first paint is
 * always the splash; syncThemeColor() then tracks whatever is actually on screen from there.
 */
const SOURCE = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");

function tokenValue(theme: "light" | "dark", name: string): string {
  const rule = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(SOURCE);
  assert.ok(rule, `no :root[data-theme="${theme}"] block`);
  const v = new RegExp(`--${name}:\\s*([^;]+);`).exec(rule![1]!);
  assert.ok(v, `no --${name} in the ${theme} tokens`);
  return v![1]!.trim().toLowerCase();
}

function splashChrome(): string {
  const m = /const SPLASH_CHROME = '([^']+)'/.exec(SOURCE);
  assert.ok(m, "no SPLASH_CHROME constant");
  return m![1]!.trim().toLowerCase();
}

test("the status bar style is not black-translucent", () => {
  // MEASURED on the owner's 16 Pro Max, iOS 18.7, from the Home Screen:
  //   SCREEN 440×956 · PAGE 440×894 · INSETS T62 B34 · FIXED INSET:0 → 0..894 · NAV 796..894
  //
  // The layout viewport was 894 tall anchored at 0..894 on a 956 screen, so 62pt of the screen
  // BOTTOM was dead — while safe-area-inset-top still reported 62, so the top bar padded 62pt for a
  // status bar that already overlapped it. The app was compensating at the top for space missing at
  // the bottom, and APP 0..894 / NAV 796..894 show the CSS was doing exactly what it should: the
  // shell filled the viewport and the nav sat on its bottom edge. The viewport was in the wrong place.
  //
  // With default, iOS puts the view BELOW the status bar (62..956) — same height, but it reaches the
  // bottom edge and inset-top becomes 0, so the top bar stops double-padding.
  const m = /<meta name="apple-mobile-web-app-status-bar-style" content="([^"]+)">/.exec(SOURCE);
  assert.ok(m, "no apple-mobile-web-app-status-bar-style meta");
  assert.notEqual(m![1], "black-translucent",
    "black-translucent anchors the viewport at the top and strands 62pt at the bottom on iOS 18");
  // viewport-fit=cover must stay: it is what still gives inset-bottom 34 for the home indicator,
  // which the bottom nav pads for.
  assert.match(SOURCE, /<meta name="viewport"[^>]*viewport-fit=cover/, "viewport-fit=cover was dropped");
});

test("the launch default is the splash colour, not a theme colour", () => {
  // Before any script runs, the strip is painted from the static meta and the installed manifest.
  // What is on screen at that instant is the splash — dark in both themes — so a light or brand
  // value here is a bright band above a near-black screen on every cold launch.
  const chrome = splashChrome();

  const metas = [...SOURCE.matchAll(/<meta name="theme-color" content="([^"]+)"([^>]*)>/g)];
  assert.equal(metas.length, 1, "there must be exactly one static theme-color meta");
  assert.equal(metas[0]![1]!.trim().toLowerCase(), chrome, "static theme-color must be the splash colour");

  const mf = /theme_color:\s*"([^"]+)"/.exec(SOURCE);
  assert.ok(mf, "no theme_color in the manifest");
  assert.equal(mf![1]!.trim().toLowerCase(), chrome, "manifest theme_color must be the splash colour");
  assert.notEqual(mf![1]!.trim().toLowerCase(), tokenValue("light", "accent"),
    "manifest theme_color is the brand accent — that is the original teal-band bug");
});

test("SPLASH_CHROME actually matches the splash it is standing in for", () => {
  // If the overlay is restyled and this constant is not, the band silently stops matching again.
  const grad = /\.splash, \.welcome \{[^}]*background: radial-gradient\([^)]*?,\s*(#[0-9a-fA-F]{3,8})\s+0%/.exec(SOURCE);
  assert.ok(grad, "could not find the .splash/.welcome gradient's first colour stop");
  assert.equal(splashChrome(), grad![1]!.trim().toLowerCase(),
    "SPLASH_CHROME must equal the splash gradient's top colour");
});

test("the strip follows what is actually on screen", () => {
  // ⚠️ ALL overlays, not the first. The first-run #welcome sits in the markup permanently with
  // display:none and comes BEFORE the welcome-back overlay appended at runtime — so querySelector
  // finds the hidden one, reads display:none, and concludes nothing is up. That shipped once.
  assert.match(SOURCE, /const overs = document\.querySelectorAll\('\.splash, \.welcome'\)/,
    "chromeColor must consider every overlay, not just the first match");
  assert.ok(!/const over = document\.querySelector\('\.splash, \.welcome'\)/.test(SOURCE),
    "querySelector finds the permanently-hidden #welcome first");

  // The media queries only see the SYSTEM scheme. The app's own theme button is invisible to them.
  assert.match(SOURCE, /function syncThemeColor\(\)/, "no runtime theme-color sync");
  assert.match(SOURCE, /setAttribute\("data-theme"[^;]*\);\s*syncThemeColor\(\);/,
    "the theme button must re-sync theme-color");
  assert.match(SOURCE, /matchMedia\('\(prefers-color-scheme: dark\)'\)\.addEventListener\('change', syncThemeColor\)/,
    "a system scheme change must re-sync theme-color");

  // And at every step of the launch handoff, which changes what is on screen twice in three seconds.
  const launch = /const removeSplash = \(\) => \{[\s\S]{0,2200}?setTimeout\(go, 2200\);/.exec(SOURCE);
  assert.ok(launch, "could not find the launch IIFE");
  const syncs = (launch![0].match(/syncThemeColor\(\)/g) || []).length;
  assert.ok(syncs >= 4, `launch sequence re-syncs the strip only ${syncs} times; every transition must`);
  assert.match(SOURCE, /ov\.classList\.add\("on"\);[^\n]*\n\s*syncThemeColor\(\);/,
    "the welcome-back overlay must set the strip when it appears");
});

test("--vvh cannot latch at launch, so the nav never floats above a dead strip", () => {
  // A size threshold alone cannot prevent this.
  //
  // A Home Screen web app reports visualViewport.height wrong at launch — short, and with no
  // corrective resize event afterwards. The delta test was meant to reject that, but at launch the
  // LAYOUT viewport still reads full height while the visual viewport reads short, so the bogus
  // delta sails straight past any threshold. --vvh latched the short value and, with no later
  // resize, the shell stayed short for the whole session: the bottom nav floating above a dead
  // strip of page background on every screen.
  //
  // A keyboard cannot be up unless something focusable is focused, and nothing is focused at launch.
  // That makes the bad state unreachable rather than merely improbable.
  assert.match(SOURCE, /const keyboardPossible = \(\) =>/, "no focused-field gate on --vvh");
  assert.match(SOURCE, /if \(keyboardPossible\(\) && layout - h > 120\)/,
    "--vvh must require BOTH a focused field and a keyboard-sized delta");
  // Both are load-bearing: a field can be focused with no keyboard (programmatic focus, a hardware
  // keyboard), and the delta is what rejects that.
  assert.ok(/keyboardPossible\(\) &&/.test(SOURCE) && /layout - h > 120/.test(SOURCE),
    "neither condition may be dropped");
  // And it must be able to CLEAR. A value left behind after the keyboard goes is the same strip.
  for (const ev of ["focusin", "focusout", "pageshow", "visibilitychange"]) {
    assert.ok(new RegExp(`addEventListener\\("${ev}"`).test(SOURCE),
      `--vvh is never re-evaluated on ${ev}, so a stale value can survive`);
  }
});
