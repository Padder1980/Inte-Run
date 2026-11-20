import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * A TOAST IS NEVER DRAWN UNDER SOMETHING THE RUNNER IS LOOKING AT (2026-11-20).
 *
 * `.app-toast` was z-index 70 — the same number as the bottom sheet — and both are added to `.app` the first
 * time they are used, so page order decided the tie: after any toast that came before the session's first sheet,
 * every later toast sat hidden behind an open sheet (measured in a browser: the hit test at the toast's centre
 * landed on the sheet's own text). The full-screen overlays (share studio, club editor, photo library, club
 * question) were above it outright, though they raise toasts of their own. `.app` sets no z-index, so all of
 * these share one stacking context and their numbers compare directly.
 *
 * Derived from the built stylesheet rather than listed: every z-index in it must be below the toast's, except
 * the few that cover everything on purpose. A new overlay above the toast fails here until somebody decides.
 */
const PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
const STYLES = [...PAGE.matchAll(/<style>([\s\S]*?)<\/style>/g)].map((m) => m[1]!).join("\n");
const CSS = STYLES.replace(/\/\*[\s\S]*?\*\//g, ""); // CSS comments quote numbers; they are not declarations

/** Above the toast on purpose: the launch screen, the 3-2-1 before a run, and a session being dragged. */
const ABOVE_ON_PURPOSE = new Set([".splash", ".countin", ".cal-ghost"]);

type Layer = { sel: string; z: number };
const LAYERS: Layer[] = [...CSS.matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .map((m) => ({ sel: m[1]!.trim().replace(/\s+/g, " "), z: /(?:^|;|\s)z-index:\s*(-?\d+)/.exec(m[2]!) }))
  .filter((r): r is { sel: string; z: RegExpExecArray } => !!r.z)
  .map((r) => ({ sel: r.sel, z: Number(r.z[1]) }));
const selectors = (l: Layer) => l.sel.split(",").map((s) => s.trim());
const only = (name: string) => {
  const found = LAYERS.filter((l) => selectors(l).includes(name));
  assert.equal(found.length, 1, name + " should set its z-index once; found " + found.length);
  return found[0]!;
};

test("the stylesheet was read: the known layers are all there", () => {
  // If the comment stripper or the rule parser ate part of the stylesheet, these go missing and the guard below
  // would be checking nothing.
  for (const s of [".app-toast", ".sheet-ov", ".topbar", ".splash", ".countin", ".cal-ghost", ".sst-ov", ".club-lib"])
    assert.ok(LAYERS.some((l) => selectors(l).includes(s)), "no z-index found for " + s);
  assert.ok(LAYERS.length >= 40, "only " + LAYERS.length + " layers found — the stylesheet was not read whole");
});

test("BLOCKER: a toast is drawn above the bottom sheet, not tied with it", () => {
  const toast = only(".app-toast"), sheet = only(".sheet-ov");
  assert.ok(toast.z > sheet.z, "the toast (z " + toast.z + ") is not above the sheet (z " + sheet.z + "): " +
    "a tie is settled by page order, which hides every toast behind an open sheet once a toast came first");
});

test("a toast is above every layer except the ones that cover everything on purpose", () => {
  const toast = only(".app-toast");
  for (const l of LAYERS) {
    if (l === toast || l.z < toast.z) continue;
    assert.ok(selectors(l).every((s) => ABOVE_ON_PURPOSE.has(s)),
      l.sel + " (z " + l.z + ") is drawn over toasts (z " + toast.z + "); raise the toast, or add it to ABOVE_ON_PURPOSE with a reason");
  }
});
