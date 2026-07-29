import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * The strip above a Home Screen web app is painted by iOS, not by us.
 *
 * Since iOS 26 a standalone web app is no longer given the space under the status bar, so
 * `apple-mobile-web-app-status-bar-style: black-translucent` no longer buys the full screen.
 * Measured on the owner's 16 Pro Max: screen 956, page 894, `env(safe-area-inset-top)` 0 — a 62pt
 * band the page cannot draw into, which iOS fills from `theme-color`.
 *
 * That colour was the brand teal (`--accent`) while the app underneath is near-white in light mode.
 * The bug does not look like a colour bug: the app appears shunted down behind a coloured band, and
 * re-adding the Home Screen icon "fixes" nothing because the fresh install re-reads the same value.
 *
 * So the rule is simply: the colour iOS paints must be the colour we paint. Anything else is a seam.
 */
const SOURCE = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");

function tokenBg(theme: "light" | "dark"): string {
  const rule = new RegExp(`:root\\[data-theme="${theme}"\\]\\s*\\{([^}]*)\\}`).exec(SOURCE);
  assert.ok(rule, `no :root[data-theme="${theme}"] block`);
  const bg = /--bg:\s*([^;]+);/.exec(rule![1]!);
  assert.ok(bg, `no --bg in the ${theme} tokens`);
  return bg![1]!.trim().toLowerCase();
}

function metaThemeColor(scheme: "light" | "dark"): string {
  const re = new RegExp(
    `<meta name="theme-color" content="([^"]+)" media="\\(prefers-color-scheme: ${scheme}\\)">`,
  );
  const m = re.exec(SOURCE);
  assert.ok(m, `no theme-color meta for ${scheme}`);
  return m![1]!.trim().toLowerCase();
}

test("the status-bar strip matches the background it sits above", () => {
  for (const scheme of ["light", "dark"] as const) {
    assert.equal(
      metaThemeColor(scheme),
      tokenBg(scheme),
      `${scheme} theme-color must equal --bg, or iOS paints a band above the app`,
    );
  }
});

test("the manifest fallback is a background colour, not the brand colour", () => {
  // iOS caches this at install and paints the strip with it until the page loads. The accent is the
  // wrong kind of colour for it however good it looks in the icon.
  const theme = /theme_color:\s*"([^"]+)"/.exec(SOURCE);
  assert.ok(theme, "no theme_color in the manifest");
  const value = theme![1]!.trim().toLowerCase();
  assert.equal(value, tokenBg("light"), "manifest theme_color must be the light --bg");

  const accent = /:root\[data-theme="light"\][^}]*--accent:\s*([^;]+);/.exec(SOURCE);
  assert.ok(accent, "no --accent in the light tokens");
  assert.notEqual(value, accent![1]!.trim().toLowerCase(), "manifest theme_color is the brand accent");
});

test("a manual theme change moves the strip too", () => {
  // The two media-query metas cover the SYSTEM scheme only. The app also has its own theme button,
  // which no media query can observe — without a runtime sync the strip keeps the old colour and the
  // band comes straight back for anyone who uses that button.
  assert.match(SOURCE, /function syncThemeColor\(\)/, "no runtime theme-color sync");
  assert.match(
    SOURCE,
    /setAttribute\("data-theme"[^;]*\);\s*syncThemeColor\(\);/,
    "the theme button must re-sync theme-color after switching",
  );
  assert.match(
    SOURCE,
    /matchMedia\('\(prefers-color-scheme: dark\)'\)\.addEventListener\('change', syncThemeColor\)/,
    "a system scheme change must re-sync theme-color",
  );
});
