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

test("the PWA gets the original chrome; only the native app opts into viewport-fit=cover", () => {
  // ⚠️ THE REGRESSION, found by git archaeology after five rounds of treating its symptoms.
  //
  // 6abb4d0 (2026-07-27, "Background GPS, and unbury the app bar from the Dynamic Island") is a
  // NATIVE-APP commit. Its only chrome change to the shared page was adding viewport-fit=cover,
  // which WKWebView needs for env(safe-area-inset-*) to report anything. But docs/ is one page
  // serving both, so the Home Screen PWA inherited it — and cover + black-translucent gave the PWA
  // a 894-tall viewport anchored at the top of a 956 screen, stranding 62pt below it:
  //   SCREEN 440×956 · PAGE 440×894 · INSETS T62 B34 · SCREENY 0 · OUTER 440×956
  // APP 0..894 and NAV 796..894 show the CSS was correct throughout. The viewport was misplaced.
  //
  // Every env() use in the CSS is calc(N + env(..., 0px)), so with no insets they collapse to exactly
  // the constants the app shipped with before that commit. The CSS needs no change — only the meta.
  const vp = /<meta name="viewport" content="([^"]+)">/.exec(SOURCE);
  assert.ok(vp, "no viewport meta");
  assert.ok(!/viewport-fit=cover/.test(vp![1]!),
    "viewport-fit=cover is back in the STATIC meta — that is the regression; the native app adds it itself");

  // The native app opts in for itself, before first paint, keyed on its custom scheme.
  assert.match(SOURCE, /location\.protocol==='interun:'[\s\S]{0,200}viewport-fit=cover/,
    "the native app must still add viewport-fit=cover — WKWebView needs it for real insets");

  // ⚠️ iOS SNAPSHOTS THE STATUS-BAR STYLE WHEN THE ICON IS ADDED TO THE HOME SCREEN. Changing it did
  // nothing across five deploys and only took effect once the icon was deleted and re-added. Any
  // change here must be judged only after a fresh re-add.
  const sb = /<meta name="apple-mobile-web-app-status-bar-style" content="([^"]+)">/.exec(SOURCE);
  assert.ok(sb, "no apple-mobile-web-app-status-bar-style meta");
  assert.equal(sb![1], "black-translucent",
    "black-translucent is the original, and is what lets the splash reach both screen edges");
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

test("the launch screen's top stop is --bg, in BOTH themes", () => {
  // ⚠️ The invariant that makes the launch seamless, and it must hold per theme.
  //
  // VERIFIED mechanism: iOS paints the strip from the document's CANVAS background (the propagated
  // html/body background-color), read once at first paint and never re-read. Not theme-color — an
  // unintentional A/B proved it: with the meta held at #0c2b28 in both states, moving only the canvas
  // moved the strip. So the strip is --bg for the whole session, and the splash is what sits beneath
  // it at launch. If the splash's top stop is not --bg, that is a visible 62pt band.
  //
  // Light shipped exact and dark did not: --bg #0a100e against a #0c2b28 top stop, dL* ~12 — the same
  // band light had just lost, with a comment claiming otherwise and no test to catch it.
  for (const theme of ["light", "dark"] as const) {
    const rule = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(SOURCE);
    assert.ok(rule, `no :root[data-theme="${theme}"] block`);
    const grad = /--splash-bg:\s*radial-gradient\([^,]+,\s*(#[0-9a-fA-F]{3,8})\s+0%/.exec(rule![1]!);
    assert.ok(grad, `no --splash-bg first colour stop in the ${theme} tokens`);
    assert.equal(grad![1]!.trim().toLowerCase(), tokenValue(theme, "bg"),
      `${theme} splash must start at --bg or iOS paints a band above it`);
  }
});

test("the remembered theme is applied BEFORE first paint", () => {
  // ⚠️ The two halves of this are inseparable, and shipping one without the other is a real bug that
  // reached the owner's phone: his system is light, he prefers dark, and with the theme reset on
  // every launch the strip latched LIGHT while the app rendered DARK — every single session.
  //
  // Persisting alone does not fix it. iOS latches the strip from the canvas at FIRST PAINT, so the
  // stored theme has to be on documentElement before that — which means an inline script in <head>,
  // not the main script at the end of <body>.
  assert.match(SOURCE, /localStorage\.setItem\("interun_theme_v1", next\)/,
    "the theme button must remember the choice");

  const head = /<head>([\s\S]*?)<\/head>/.exec(SOURCE);
  assert.ok(head, "no <head> block");
  assert.match(head![1]!, /<script>[^<]*interun_theme_v1[^<]*setAttribute\('data-theme'/,
    "the stored theme must be applied by an inline <head> script, before first paint");

  // And it must come before the body, where the main script lives — a script at the end of <body>
  // runs after the first paint has already latched the strip.
  const inlineAt = SOURCE.indexOf("interun_theme_v1");
  const bodyAt = SOURCE.indexOf("<body>");
  assert.ok(inlineAt > 0 && inlineAt < bodyAt,
    "the theme restore must precede <body> or the strip latches the system colour");
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
  const btn = /\$\("themeBtn"\)\.onclick = \(\) => \{([\s\S]*?)\n\};/.exec(SOURCE);
  assert.ok(btn, "could not find the theme button handler");
  assert.match(btn![1]!, /setAttribute\("data-theme", next\)/, "the theme button must set data-theme");
  assert.match(btn![1]!, /syncThemeColor\(\);/, "the theme button must re-sync theme-color");
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
