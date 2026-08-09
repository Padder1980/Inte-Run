import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

/**
 * iOS auto-zooms the page whenever a field with a computed font-size under 16px takes focus, and
 * because InteRun blocks pinch the runner then has no way to zoom back out — the whole app stays
 * scaled, with the app bar and bottom nav pushed off screen, on every screen after it.
 *
 * This has now shipped twice. The first fix raised every rule that NAMED input/select/textarea, and
 * missed `.set-in` — the strength log's weight and reps boxes — because the selector is a bare
 * class. Worse, a blanket `input, select, textarea { font-size: 16px }` has specificity (0,0,1) and
 * loses to any single class, so adding one does not save you.
 *
 * So this test does not try to be clever about which selectors match a field. It flags EVERY rule
 * that sets a font-size under 16px and is not on the allow-list of things that provably cannot be
 * focused. Adding a new small-text class means adding it here, which is the point: the next person
 * has to look at this comment and decide.
 */
const SOURCE = readFileSync(new URL("../web/app.ts", import.meta.url), "utf8");
const STYLE = SOURCE.slice(SOURCE.indexOf("<style>"), SOURCE.indexOf("</style>"));

type Rule = { selector: string; size: number; line: number };

function rulesUnder16(): Rule[] {
  const out: Rule[] = [];
  const re = /([^\n{}]+)\{([^}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(STYLE))) {
    const selector = m[1]!.trim().replace(/\s+/g, " ");
    const fs = /font-size:\s*([\d.]+)px/.exec(m[2]!);
    if (!fs) continue;
    const size = Number(fs[1]);
    if (size >= 16) continue;
    out.push({ selector, size, line: STYLE.slice(0, m.index).split("\n").length });
  }
  return out;
}

/** A rule is dangerous if it could possibly apply to something focusable. */
function couldBeAField(selector: string): boolean {
  // Explicit element selectors are obvious.
  if (/\b(input|select|textarea)\b/.test(selector)) return true;
  // A bare class MIGHT be on an input — the .set-in trap. Only clear it if the markup never puts
  // that class on a field.
  const classes = selector.match(/\.[a-zA-Z][\w-]*/g) ?? [];
  for (const c of classes) {
    const name = c.slice(1);
    // Does any <input|select|textarea> in the runtime markup carry this class?
    const onField = new RegExp(`<(input|select|textarea)[^>]*class="[^"]*\\b${name}\\b`).test(SOURCE);
    if (onField) return true;
  }
  return false;
}

test("no focusable field is styled under 16px — iOS would auto-zoom and never zoom back", () => {
  const offenders = rulesUnder16().filter((r) => couldBeAField(r.selector));
  assert.deepEqual(
    offenders.map((r) => `${r.selector} @ ${r.size}px`),
    [],
    "these rules put a field under the iOS 16px auto-zoom threshold",
  );
});

test("the blanket input rule exists, but is not relied on alone", () => {
  // It catches fields with no class of their own. It cannot beat a class selector, which is why the
  // test above scans the markup rather than trusting this line.
  assert.ok(
    /input,\s*select,\s*textarea\s*\{[^}]*font-size:\s*16px/.test(STYLE),
    "the catch-all 16px rule for unstyled fields has gone missing",
  );
});

test("the shell sizes to its own PAGE, and still yields to a keyboard", () => {
  // Two separate requirements, both learned the hard way.
  //
  // 1. The resting height must be 100%, not 100dvh. 100% chains html → body → the real layout
  //    viewport, so the shell is exactly as tall as the page it is in. dvh does not: a Home Screen
  //    web app is handed a viewport SHORTER than the screen (measured on a 16 Pro Max: screen 956,
  //    page 894), dvh resolved against the bigger box, and the sticky bottom nav was pushed past
  //    the fold with a band of background where it should have been.
  // 2. The keyboard must still be answered — ⚠️ since v3 by OVERLAYING, not by shrinking. The
  //    owner's words: "surely the keyboard just overlays the screen and it doesn't move it
  //    anywhere" — and he was right; the shrink dragged the bottom bar up the screen on every
  //    keystroke. The shell stays full height; --kbh (published only while a field is focused and
  //    the visual viewport is genuinely short) adds scroll room under .view and lifts bottom
  //    sheets, so any focused field can still be brought above the keyboard.
  assert.ok(/\.app \{[^}]*height: var\(--vvh, 100%\)/.test(STYLE),
    ".app must rest at 100% (its own page); --vvh stays as the inert emergency hook");
  assert.ok(!/\.app \{[^}]*100dvh/.test(STYLE),
    ".app must not size on dvh — it measures the screen, not the page it was given");
  assert.ok(!/setProperty\("--vvh"/.test(SOURCE),
    "nothing may publish --vvh any more — the v3 keyboard overlays instead of shrinking the shell");
  assert.ok(/setProperty\("--kbh"/.test(SOURCE), "the keyboard height must be published as --kbh");
  assert.ok(/html\.kbup \.view \{ padding-bottom: calc\(96px \+ var\(--kbh/.test(STYLE),
    ".view must gain keyboard-height scroll room while the keyboard is up");
  assert.ok(/html\.kbup \.sheet-ov \{ padding-bottom: var\(--kbh/.test(STYLE),
    "bottom sheets must lift above the keyboard — their fields live where the keyboard lands");
});

test("nothing is SIZED in vh — on iOS that is lvh, taller than the visible area", () => {
  // Specifically height/max-height/min-height. A vh inside a padding clamp is harmless; a vh height
  // is the bug, because iOS resolves vh to the LARGE viewport and the element then runs off screen
  // whenever the browser chrome or the keyboard is up.
  const bad: string[] = [];
  for (const m of STYLE.matchAll(/([^\n{}]+)\{([^}]*)\}/g)) {
    if (/(?:^|[;\s])(?:max-|min-)?height:\s*[^;]*\b[\d.]+vh\b/.test(m[2]!)) bad.push(m[1]!.trim());
  }
  assert.deepEqual(bad, [], "these size on vh rather than dvh");
});

test("⚠️ double-tap cannot zoom the app, on any element", () => {
  // ⚠️ touch-action DOES NOT INHERIT. It was set on html and body alone, which governs only the taps
  // that land on html or body themselves — so a double tap on a card, a row, a stat tile or an input
  // hit an element with the default value and iOS zoomed the page to fit whatever box was under the
  // finger. That is why the zoom looked inconsistent: it scales to the TAPPED ELEMENT, so a small
  // tile zoomed far more than a wide card, which reads as a random bug rather than a missing rule.
  const css = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  const style = css.slice(css.indexOf("<style>"), css.indexOf("</style>"));
  assert.match(style, /\n\* \{ touch-action: manipulation; \}/,
    "touch-action is not applied to every element, so double-tap zoom works on anything nested");
  // ⚠️ manipulation still allows pinch and scrolling — it removes double-tap zoom and the tap delay.
  // The two deliberate exceptions are class selectors, so they outrank the universal rule whatever
  // the source order: the cropper drives its own zoom, and a swipeable row must pan vertically.
  assert.match(style, /\.crop-stage \{ touch-action: none; \}/, "the avatar cropper lost its own gestures");
  assert.match(style, /\.swipe-face \{[^}]*touch-action: pan-y/, "a swipeable run row lost vertical panning");
  // Nothing may set touch-action: none on a scroller, or the screen stops scrolling entirely.
  const nones = [...new Set([...style.matchAll(/([^\s{}]+) \{[^}]*touch-action: none/g)].map((m) => m[1]))];
  assert.deepEqual(nones, [".crop-stage"],
    "something other than the cropper disables touch entirely: " + nones.join(", "));
});
