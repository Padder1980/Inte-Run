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
    // ⚠️ The ladder is calc(Npx * var(--tscale)) now, so that the seven tokens ARE the app's
    // Dynamic Type support. Read the base size out of the calc.
    .map((t) => Number((s.match(new RegExp(t + ": *calc\\(([0-9.]+)px")) || [])[1]));
  assert.ok(vals.every((v) => v > 0), "a type token has no value: " + JSON.stringify(vals));
  assert.equal(new Set(vals).size, 7, "two type steps are the same size: " + vals.join(", "));
  for (let i = 1; i < vals.length; i++) assert.ok(vals[i]! < vals[i - 1]!, "the ladder is not descending: " + vals.join(", "));
});

/**
 * ⚠️ THE RATCHET. These ceilings are the measurement taken on 2026-08-08, not a target. Adding an
 * off-ladder value fails; migrating a screen lowers them.
 */
const RADIUS_CEILING = 143;   // measured 2026-08-08: 143 of 227
const FONTSIZE_CEILING = 322; // measured 2026-08-08: 322 of 443 (was 323 — the Plan week card's
                              // 12.5px subtitle went onto the ladder when it was retargeted by class)

test("⚠️ off-ladder radii do not increase", () => {
  const s = sheet();
  const onLadder = new Set(["24px", "18px", "12px", "999px", "50%"]);
  const found = (s.match(/border-radius: *[0-9]+(px|%)/g) || [])
    .map((m) => m.split(":")[1]!.trim())
    .filter((v) => !onLadder.has(v));
  assert.ok(found.length <= RADIUS_CEILING,
    `off-ladder radii rose to ${found.length} (ceiling ${RADIUS_CEILING}). Use var(--r-hero|--r-card|--r-ctl|--r-pill).`);
});

/**
 * ⚠️ EVERY var(--…) IN THE STYLESHEET MUST RESOLVE TO A DECLARED TOKEN.
 *
 * The two ratchets above count LITERAL off-ladder values, so they are structurally blind to the
 * opposite mistake: reaching for a token that does not exist. An undefined custom property makes the
 * whole declaration invalid at computed-value time, so the property silently falls back to its
 * initial value and nothing anywhere reports it.
 *
 * Found the hard way on 2026-08-15: var(--r-sm) was invented and used four times — twice in the plan
 * drag-and-drop that had already SHIPPED TO TESTFLIGHT, where it left the drag highlight and the
 * floating card with square corners. It passed the build, the typecheck, 573 tests and a screenshot
 * review, because "slightly less rounded than intended" is not something an eye catches.
 */
test("⚠️ every custom property used in the stylesheet is declared", () => {
  const s = sheet();
  // ⚠️ DECLARATIONS ARE SCANNED ACROSS THE WHOLE PAGE, USES ONLY IN THE STYLESHEET. Nine tokens
  // (--hc, --phase, --rc, --p and friends) are legitimately set per element as inline
  // style="--hc: …" in the markup, so a stylesheet-only scan reports every one of them as missing
  // and the guard is useless. The first version of this test did exactly that.
  const declared = new Set([...css().matchAll(/(--[a-z0-9-]+)\s*:/gi)].map((m) => m[1]!.toLowerCase()));
  assert.ok(declared.size > 40, `only ${declared.size} tokens declared — the scan is broken`);
  const used = new Set([...s.matchAll(/var\(\s*(--[a-z0-9-]+)/gi)].map((m) => m[1]!.toLowerCase()));
  assert.ok(used.size > 30, `only ${used.size} tokens used — the scan is broken`);
  // A var() with a fallback — var(--x, 10px) — is deliberate and legal, so only bare uses are faults.
  const bare = new Set([...s.matchAll(/var\(\s*(--[a-z0-9-]+)\s*\)/gi)].map((m) => m[1]!.toLowerCase()));
  const missing = [...bare].filter((t) => !declared.has(t));
  assert.deepEqual(missing, [], `used but never declared, so the declaration is silently dropped: ${missing.join(", ")}`);
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

// ---- Phase 1: Today ------------------------------------------------------------------------------

test("⚠️ Today leads with the decision, then what is next", () => {
  // The brief's recommended content order, and its specific complaint that "multiple large cards
  // precede upcoming training" — there were FIVE banners ahead of the prescription.
  const html = css();
  // ⚠️ ASSERT THE RETURN EXPRESSION, NOT THE FUNCTION BODY. `nextUp` is BUILT into a const above the
  // return and CONCATENATED below it, so reading the whole body put "Next up" before the hero in the
  // source while the rendered order was correct. A test measuring source position was measuring the
  // wrong thing entirely.
  const at = html.indexOf("function viewToday(");
  const fnBody = html.slice(at, html.indexOf("\nfunction ", at + 10));
  const body = fnBody.slice(fnBody.lastIndexOf("return mirror"));
  assert.ok(body.length > 100, "could not find viewToday's return expression");
  const hero = body.indexOf("uiDecisionHero(");
  const next = body.indexOf("nextUp");
  const know = body.indexOf("What to know today");
  const week = body.indexOf("weeklyOverview()");
  assert.ok(hero > 0 && next > hero, "Next up does not come directly after the decision hero");
  assert.ok(know > next, "What to know is not below Next up");
  assert.ok(week > know, "the week overview is not below the fold");
  // ⚠️ ONE attention item above the decision, not five.
  assert.match(body, /todayAttention\(\)/, "the banners are not collapsed to one above the hero");
  assert.match(body, /todayBelowAttention\(\)/, "the other banners were dropped rather than moved");
});

test("⚠️ the prescription decides the action, and a rest day is never asked to record", () => {
  // "On a rest day, the premium action is often reassurance or preview — not a large record-workout
  // button. The interface should respect the coach's own prescription."
  const html = css();
  const fn = html.slice(html.indexOf("function todayDecision("), html.indexOf("function todayNextUp("));
  assert.match(fn, /kind: "rest"/, "there is no rest state");
  assert.match(fn, /todayPreview/, "a rest day is not offered a preview");
  const rest = fn.slice(fn.indexOf('kind: "rest"'), fn.indexOf('kind: "rest"') + 400);
  assert.doesNotMatch(rest, /Start session/, "a rest day offers a record button");
});

test("⚠️ a risk warning is never drawn from example weather", () => {
  // The weather falls back to a sample preset that defaults to 30C, so every runner who had not
  // granted location saw a red-bordered heat warning built from weather that was not theirs.
  const html = css();
  const fn = html.slice(html.indexOf("function todayDecision("), html.indexOf("function todayNextUp("));
  assert.match(fn, /state\.wx && state\.wx\.live/, "the risk state is not gated on a live reading");
});

test("⚠️ the surveillance language is gone", () => {
  // ⚠️ STRIP COMMENTS FIRST. The source EXPLAINS why the phrase was retired — by quoting it — so the
  // note recording the decision tripped the guard enforcing it. Second time this exact shape has
  // appeared today; the fix is never to soften the comment.
  // ⚠️ STRIP BLOCK COMMENTS PROPERLY, not by line prefix. A continuation line inside a /* */ block
  // starts with neither // nor * nor /*, so a prefix filter left it in and the guard still tripped on
  // the note explaining the decision.
  const html = css().replace(/\/\*[\s\S]*?\*\//g, " ").split("\n")
    .filter((l) => !l.trim().startsWith("//")).join("\n");
  assert.doesNotMatch(html, /coach is watching/i,
    "'Your coach is watching' is back — the brief flags it as reducing trust around health data");
  assert.match(html, /Coach check-in/, "the replacement heading is missing");
});

test("⚠️ readiness is never scored before the runner has answered", () => {
  // ⚠️ state.subj ships with defaults — energy "good", soreness "none" — so before this the app
  // computed 4/5 for a runner who had never been asked and showed it as measured. A number with no
  // answers behind it is exactly what the brief's insight contract exists to prevent.
  const html = css();
  const fn = html.slice(html.indexOf("function feelSquare("), html.indexOf("function feelSquare(") + 1600);
  assert.match(fn, /state\.subjAnswered/, "readiness does not check whether the questions were answered");
  assert.match(fn, /"incomplete"/, "there is no incomplete state, so defaults are shown as a real score");
  // ...and answering has to set the marker, or it can never leave the incomplete state.
  assert.match(html, /state\.subjAnswered = true/, "nothing ever records that the runner answered");
  // ⚠️ And a reading goes stale: last night's answer is not about this morning.
  assert.match(fn, /stale/, "an old reading is presented as current");
});

test("⚠️ readiness and the weather are separate tiles", () => {
  // "Readiness is qualitative while weather is a warning. The combined meaning is unclear." They must
  // not be able to contradict each other in one object — a 'good to go' beside a heat warning is the
  // internal inconsistency the brief opens with.
  const html = css();
  const at = html.indexOf("function viewToday(");
  const body = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.match(body, /conditionsSquare\(sess\) \+ feelSquare\(\)/,
    "readiness and conditions are no longer two separate tiles");
});

// ---- Phase 2: Plan -------------------------------------------------------------------------------

test("⚠️ the plan week is one day per row, not nested cards", () => {
  // "Stop card nesting. One day should be one row. Rest days do not need a large bordered card."
  const html = css();
  const fn = html.slice(html.indexOf("function weekDetail("), html.indexOf("function weekDetail(") + 2600);
  assert.match(fn, /uiSessionRow\(/, "the week still builds its own markup instead of the shared row");
  assert.doesNotMatch(fn, /class="sess/, "the nested .sess cards are back");
  assert.doesNotMatch(fn, /day-row/, "the wrapping day cards are back");
});

test("⚠️ a missed session says it was missed", () => {
  // "Use completion semantics. Done, next, changed and missed need text/icon support; colour alone is
  // insufficient." A past session that was never ticked is the one the runner most needs told.
  const html = css();
  const fn = html.slice(html.indexOf("function weekDetail("), html.indexOf("function weekDetail(") + 2600);
  assert.match(fn, /"missed"/, "a past unticked session is not marked missed");
  assert.match(fn, /"done"/, "a completed session is not marked done");
  assert.match(fn, /nextId/, "nothing identifies the next session");
  // ⚠️ ...and only in the CURRENT week: "Next" on a week three months away is nonsense.
  assert.match(fn, /isCur && TODAY_IN_PLAN/, "the next marker is not scoped to the current week");
});

test("⚠️ the goal hero shows one sentence, with the analysis behind a disclosure", () => {
  // "Reduce the goal hero. Keep target, date, progress, confidence and one sentence of
  // interpretation. Move the detailed realism analysis behind 'How we calculated this.'"
  const html = css();
  const fn = html.slice(html.indexOf("function feasibilityWhy("), html.indexOf("function viewPlan("));
  assert.match(fn, /lines\[0\]/, "the card no longer leads with a single sentence");
  assert.match(fn, /lines\.slice\(1\)/, "the rest of the analysis is not separated out");
  // ⚠️ Native <details>: keyboard- and screen-reader-operable for free, and the browser owns the open
  // state so a re-render cannot snap it shut — which on this screen happens constantly.
  assert.match(fn, /<details/, "the disclosure is hand-rolled, so a re-render will close it");
  assert.match(fn, /<summary>/, "the disclosure has no accessible label");
});

test("⚠️ future weeks collapse to summaries, and the summary uses words", () => {
  // "Current week as one row per day. Future weeks collapse to summaries." Before this the Plan
  // screen showed the chart and then exactly ONE week, so the only way to learn what week nine held
  // was to hunt for its bar on a horizontally scrolling chart and tap it.
  const html = css();
  const fn = html.slice(html.indexOf("function weekList("), html.indexOf("function selectPlanWeek("));
  assert.ok(fn.length > 0 && fn.length < 1200, "the weekList slice window is wrong: " + fn.length);
  assert.match(fn, /w\.index === state\.planWeek/, "weekList does not expand the selected week");
  assert.match(fn, /weekDetail\(\)/, "the expanded week is not the real week detail");
  assert.match(fn, /weekSummaryRow\(/, "the other weeks are not summarised");

  const row = css().slice(css().indexOf("function weekSummaryRow("), css().indexOf("function weekList("));
  // ⚠️ THE KIND OF WEEK IS A WORD. An absorb week is a diagonal hatch on the chart and a taper is a
  // hue — and those are precisely the weeks a runner needs to see coming. "Text/icon support;
  // colour alone is insufficient."
  for (const word of ["Race week", "Taper", "Absorb week"]) {
    assert.ok(row.includes('"' + word + '"'), "a summary never says " + word);
  }
  assert.match(row, /w\.distanceKm/, "a summary does not say how far the week is");
  assert.match(row, /This week/, "a summary cannot say which week is the current one");

  // ⚠️ ONE PLACE SETS THE WEEK, so the chart and the list can never disagree about which is open.
  const sel = html.slice(html.indexOf("function selectPlanWeek("), html.indexOf("function wireWeekList("));
  assert.match(sel, /aria-pressed/, "selecting a week does not move the chart's pressed state");
  assert.match(sel, /wireSessionTaps\(\)/, "the newly expanded week's sessions are not tappable");
  assert.match(html, /onclick = \(\) => selectPlanWeek\(Number\(b\.dataset\.wk\)\)/,
    "the chart does not go through selectPlanWeek");
});

test("⚠️ the phase legend names where each phase IS, not just its colour", () => {
  // "Text labels, not colour alone." A swatch reading "Build" only helps if you can then match that
  // colour to a bar, which is the one task a colour-blind runner cannot do.
  const html = css();
  const fn = html.slice(html.indexOf("const phaseRange ="), html.indexOf("const bars ="));
  assert.ok(fn.length > 0 && fn.length < 1400, "the phaseRange slice window is wrong: " + fn.length);
  assert.match(fn, /Math\.min/, "the range is not computed from the weeks in the plan");
  assert.match(html, /pk-wk/, "the legend carries no week range");
  assert.match(html, /phaseRange\(ph\)/, "the legend does not use the range");
});

test("⚠️ the plan week card is styled by name, not by position", () => {
  // These rules were "> div:first-child" and "> div:nth-child(2)" on #weekDetail, which addressed the
  // week heading and subtitle only while that element held exactly one week. It now holds the whole
  // list. Position is not a name.
  const s = sheet();
  assert.ok(!/#weekDetail > div:(first-child|nth-child)/.test(s),
    "the week card is still styled by child position");
  assert.match(s, /\.wk-open \.ui-hero-t/, "the week heading is not targeted by class");
  assert.match(s, /\.wk-open \.ui-sub/, "the week subtitle is not targeted by class");
  // ⚠️ And the card styling moved WITH them, or #weekDetail draws a card around the whole list and
  // .wk-open draws a second one inside it — the nested cards the brief exists to remove.
  assert.ok(!/#view:has\(\.plan-head\) #weekDetail \{\s*padding/.test(s),
    "#weekDetail still carries the card padding, so every week sits inside a second card");
});

test("⚠️ the session is staged, and Start does not scroll away", () => {
  // "Stage the workout. Warm-up, main set and cool-down are the top-level units. Expand individual
  // drills only when needed." And: "Keep Start persistent. The current top CTA scrolls away while
  // reading a long session."
  const html = css();
  const fn = html.slice(html.indexOf("function sessionStages("), html.indexOf("function mainSubtitle("));
  assert.match(fn, /Main set/, "there is no main-set stage");
  assert.match(fn, /Cool down/, "there is no cool-down stage");
  assert.match(fn, /Warm up/, "the warm-up is not a stage");
  assert.match(fn, /<details class="sd-stage"/, "the stages do not collapse");
  // ⚠️ The main set is open; the others are not. It is the reason the session exists.
  assert.match(fn, /main, true/, "the main set is collapsed by default");
  // Start is the shared action bar, and it keeps its id so the existing handler still finds it.
  const sheet = html.slice(html.indexOf("function sessionSheetHtml("), html.indexOf("function ensureSheet("));
  assert.match(sheet, /uiActionBar\(\{ state: "start", id: "sdStart"/, "Start is not the persistent bar");
  // ⚠️ ...and it is LAST in the composition, or it is not persistent, it is just lower down.
  const bar = sheet.lastIndexOf("startBtn");
  // \u26a0\ufe0f ANCHORED ON SOMETHING THE SHEET STILL CONTAINS. This read "sd-desc" until the description
  // moved into the Why disclosure, at which point lastIndexOf returned -1 and "bar > -1" was true
  // however the sheet was ordered -- a guard that could no longer fail. Anchor on the last real
  // section instead, and assert it is found before comparing.
  const lastSection = sheet.lastIndexOf("whyThisSession(sess)");
  assert.ok(lastSection > 0, "the Why disclosure is no longer in the sheet");
  assert.ok(bar > lastSection, "the Start bar is still inline above the session body");

  // --- the three things the owner asked for after seeing it beside the mockup -----------------
  // 1. Each stage number carries its own colour, and only the MIDDLE one varies with the session.
  assert.match(fn, /stage\(3, "Cool down".*"var\(--eff-easy\)"\)/, "the cool-down stage has no colour");
  assert.match(fn, /"Main set", mainSubtitle\(main\), main, true, sc\)/, "the main set does not take the session's effort colour");
  assert.match(fn, /sd-sn" style="background:var\(--steady\)/, "the warm-up stage has no colour");
  // \u26a0\ufe0f The ink on those circles must NOT be a theme token: the circle behind it does not flip
  // with the theme, so an ink that does would fail in one of the two.
  assert.match(html, /\.sd-sn \{ color: #[0-9a-f]{6} !important/, "the stage number's ink flips with the theme");
  // 2. A chevron on every stage, so a collapsed row reads as openable.
  assert.equal((fn.match(/sd-chev/g) || []).length, 2, "not every stage summary carries a chevron");
  assert.match(html, /\.sd-stage\[open\][^{]*\.sd-chev[^{]*\{[^}]*rotate/, "the chevron does not turn when the stage opens");
  // 3. "Why this session?" -- optional rationale, using the session's OWN description.
  assert.match(html, /class="sd-why"/, "there is no Why this session disclosure");
  assert.match(html, /sd-whyb">' \+ esc\(sess\.description\)/, "the Why body is not the session's own description");
  // \u26a0\ufe0f ...and it must not be invented copy. Every short line is keyed on the session type.
  const whyShort = html.slice(html.indexOf("const WHY_SHORT"), html.indexOf("function whyThisSession"));
  for (const t of ["vo2", "threshold", "easy", "long", "recovery"]) {
    assert.ok(whyShort.includes(t + ":") || whyShort.includes('"' + t + '"'), "no Why line for " + t);
  }
});
