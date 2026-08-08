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

// ---- The behaviour-rich components ---------------------------------------------------------------

/** Lift a component builder out of the built page and run it for real. */
function lift(names: string[]): any {
  const html = css();
  const src = names.map((fn) => {
    const at = html.indexOf("function " + fn + "(");
    assert.ok(at >= 0, "not in the build: " + fn);
    let d = 0;
    for (let i = html.indexOf("{", at); i < html.length; i++) {
      if (html[i] === "{") d++;
      else if (html[i] === "}") { d--; if (!d) return html.slice(at, i + 1); }
    }
    throw new Error("unbalanced braces in " + fn);
  }).join("\n");
  // The status/label tables the builders read live outside their own braces.
  const tables = ["UI_ROW_STATUS", "UI_BAR_STATES"].map((n) => {
    const at = html.indexOf("const " + n + " = {");
    if (at < 0) return "";
    return html.slice(at, html.indexOf("};", at) + 2);
  }).join("\n");
  return new Function("esc", "ICON",
    tables + "\n" + src + "; return {" + names.join(",") + "};")(
      (v: any) => String(v == null ? "" : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      { play: "<svg></svg>", coach: "<svg></svg>", alfie: "<svg></svg>" });
}

const C = lift(["uiDecisionHero", "uiSessionRow", "uiCoachNote", "uiReadinessTile", "uiActionBar"]);

/** The brief's build specification lists these states per component. All of them must render. */
const STATES = {
  hero: ["scheduled", "rest", "completed", "missed", "changed", "risk"],
  row: ["done", "next", "future", "moved", "missed", "optional", "disabled"],
  note: ["info", "praise", "caution", "progress", "low", "unavailable"],
  tile: ["incomplete", "ready", "steady", "reduced", "conflict", "stale"],
  bar: ["start", "pause", "resume", "complete", "preview", "retry", "disabled"],
};

test("⚠️ every state in the brief's build specification renders", () => {
  // ⚠️ NOT ONLY THE IDEAL STATE. "Implement loading, empty, error and accessibility states — not only
  // the ideal state." A component with one state is a mockup, not a component.
  for (const kind of STATES.hero) {
    const h = C.uiDecisionHero({ kind, headline: "Recovery day", implication: "Keep today easy.", action: "Preview tomorrow" });
    assert.ok(h.includes("ui-hero " + kind), "hero state did not render: " + kind);
    assert.ok(h.includes("Recovery day"), "hero lost its headline in state " + kind);
  }
  for (const status of STATES.row) {
    const r = C.uiSessionRow({ day: "TUE", title: "VO2 pyramid", meta: "44 min - 8 km", status, id: "x" });
    assert.ok(r.includes("ui-row "), "row did not render: " + status);
    assert.ok(r.includes("VO2 pyramid"), "row lost its title in state " + status);
  }
  for (const tone of STATES.note) {
    const n = C.uiCoachNote({ tone, observation: "It will be hot tomorrow.", implication: "Your usual pace may feel harder.", action: "Run by effort and take water." });
    assert.ok(n.includes("ui-note " + tone), "note did not render: " + tone);
  }
  for (const state of STATES.tile) {
    const t = C.uiReadinessTile({ state, score: 4, contributor: "You slept badly", since: "yesterday" });
    assert.ok(t.includes("ui-tile"), "tile did not render: " + state);
  }
  for (const state of STATES.bar) {
    const b = C.uiActionBar({ state });
    assert.ok(b.includes("ui-bar-btn"), "bar did not render: " + state);
  }
});

test("⚠️ a disabled control is not silently tappable", () => {
  const row = C.uiSessionRow({ day: "THU", title: "Rest", status: "disabled" });
  assert.match(row, /aria-disabled="true"/, "a disabled row does not say so to a screen reader");
  assert.doesNotMatch(row, /<button/, "a disabled row is still a button");
  const bar = C.uiActionBar({ state: "disabled" });
  assert.match(bar, /disabled aria-disabled="true"/, "a disabled action bar is still pressable");
});

test("⚠️ status is carried by a WORD in every component that has one", () => {
  // The brief, twice: colour is never the only signal. This is the assertion that keeps it true as
  // states get added.
  for (const [status, word] of [["done", "Done"], ["next", "Next"], ["moved", "Moved"],
                                ["missed", "Missed"], ["optional", "Optional"]] as const) {
    const r = C.uiSessionRow({ day: "MON", title: "Easy run", status });
    assert.ok(r.includes(">" + word + "<"), `the ${status} row shows no word, only a colour`);
  }
  // low confidence must SAY low confidence
  assert.match(C.uiCoachNote({ tone: "low", observation: "x" }), /Low confidence/,
    "a low-confidence note hedges only by colour, so it reads as certain");
  // a stale readiness reading must say when it was taken
  assert.match(C.uiReadinessTile({ state: "stale", score: 3, since: "yesterday" }), /From yesterday/,
    "a stale readiness score is presented as if it were current");
});

test("⚠️ the readiness tile is a whole number out of five", () => {
  // His ruling, and the scale is five because there are exactly five reachable values.
  const t = C.uiReadinessTile({ state: "ready", score: 4.4 });
  assert.match(t, />4</, "the score is not rounded to a whole number");
  assert.match(t, /\/5</, "the score is not out of five");
  assert.doesNotMatch(t, /4\.4|\/10/, "false precision, or the mockup's ten-point scale, is back");
});

test("the coach note carries observation, implication AND action", () => {
  // ⚠️ The three parts are the whole point — a note that observes and stops is what this replaces.
  const n = C.uiCoachNote({ tone: "caution", observation: "It will be hot during tomorrow's run.",
    implication: "Your usual pace may feel harder.", action: "Run by effort and take water." });
  assert.ok(n.includes("ui-note-o") && n.includes("ui-note-i") && n.includes("ui-note-a"),
    "the note dropped one of observation / implication / action");
});

test("components survive real-content extremes", () => {
  // ⚠️ "Components render with real-content extremes" is the brief's own exit criterion for Phase 0.
  const long = "Progression tempo: ten minutes steady into ten minutes at threshold, with the last "
    + "three minutes lifted to critical velocity if it still feels controlled";
  const r = C.uiSessionRow({ day: "WED", title: long, meta: "62 min - 12.4 km - RPE 6-7", status: "next" });
  assert.ok(r.includes(long), "a long title was truncated in the markup rather than by CSS");
  // and nothing breaks with everything missing
  for (const fn of ["uiDecisionHero", "uiSessionRow", "uiCoachNote", "uiReadinessTile", "uiActionBar"]) {
    const out = C[fn]({});
    assert.ok(typeof out === "string" && out.length > 10, fn + " produced nothing for an empty input");
    assert.doesNotMatch(out, /undefined|NaN|\[object/, fn + " leaked a placeholder into the markup");
  }
});
