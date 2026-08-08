import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Eight defects found by surveying the app against the redesign brief, 2026-08-08. Every one of them
 * shipped behind a green suite of 437 tests, and they are grouped here because they share a cause
 * rather than a screen:
 *
 * ⚠️ NONE OF THEM THREW. A missing "+" ended a return statement; a 1-based number was compared to a
 * 0-based one; a field name that does not exist read as undefined; a string branch nothing writes
 * went unreachable; an escape helper let quotes through; an attribute name meant two things; a
 * handler dereferenced an element that is not in the markup; a safety screen sat on the failure path
 * of the thing it was meant to screen. Inside one 20,000-line template literal there is no
 * typechecking and no linting, so the only thing that can see any of this is a test that asks the
 * question a runner would ask.
 *
 * Each assertion below was watched FAILING against the pre-fix source before being believed.
 */

const page = () => readFileSync(new URL("../web/app.html", import.meta.url), "utf8");

/**
 * The source of one function, COMMENTS STRIPPED.
 * ⚠️ Both halves are load-bearing. Slicing to a named later function assumes an order the file does
 * not promise — uiDecisionHero is 68,000 characters AFTER weekDetail, so that window swallowed a
 * third of the app. And three of the guards below first tripped on their own explanatory comments,
 * which quote the very strings they forbid; this file's own history records that trap twice already.
 */
function fnSrc(name: string): string {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  const end = html.indexOf("\nfunction ", at + 10);
  const src = html.slice(at, end > at ? end : at + 8000);
  assert.ok(src.length < 9000, name + " sliced to " + src.length + " characters — the window is wrong");
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

/** Pull a top-level function out of the built page and evaluate it with a supplied scope. */
function lift(name: string, scope: Record<string, unknown> = {}): Function {
  const html = page();
  const at = html.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  // Up to the next top-level declaration.
  const rest = html.slice(at + 1);
  const end = rest.search(/\n(function |const |let |\/\*\*)/);
  const src = html.slice(at, end > 0 ? at + 1 + end : at + 4000);
  const keys = Object.keys(scope);
  const make = new Function(...keys, src + "\nreturn " + name + ";");
  return make(...keys.map((k) => scope[k]));
}

test("⚠️ the treadmill / GPS-denied card reaches its own distance input", () => {
  // A missing "+" let automatic semicolon insertion end the return statement, so the card rendered
  // its heading and paragraph and stopped. Every treadmill run and every outdoor run that failed to
  // acquire GPS (gpsFallback lands in startIndoor) could never have its distance added — the one
  // outright functional break in the whole survey, and on no screen anybody was reviewing.
  const fn = fnSrc("treadmillDistanceHtml");
  for (const id of ["tmDist", "tmSet", "tmNote"]) {
    assert.ok(fn.includes(id), "the card never reaches #" + id);
  }
  // ⚠️ The real guard: no string literal may END a line inside this return without an operator.
  // Asserting the ids alone would pass on unreachable code — they were all present, below the
  // severed return. This is what actually discriminates.
  const lines = fn.split("\n").map((l) => l.replace(/\/\/.*$/, "").trimEnd());
  const dangling = lines.filter((l, i) => {
    if (!/['"]\s*$/.test(l)) return false;              // does not end in a string literal
    const next = (lines[i + 1] || "").trim();
    // ⚠️ A ternary's arms legitimately end in a string with ":" on the next line. Forbidding that
    // flagged healthy code, which is how a guard gets deleted rather than fixed.
    return next !== "" && !/^[+:?;,)\]}]/.test(next);
  });
  assert.deepEqual(dangling, [], "a string literal ends a line with no operator — ASI will end the return here");
});

test("⚠️ the plan week knows which week is actually current", () => {
  // CURRENT_WEEK is a 0-based array index; w.index is 1-based. Compared directly, weekDetail marked
  // the week AFTER the current one, and in week 1 matched nothing at all — so a runner in their first
  // week never saw "Next" on any session.
  const fn = fnSrc("weekDetail");
  assert.ok(!/w\.index === CURRENT_WEEK/.test(fn),
    "weekDetail compares a 1-based week number to a 0-based array index");
  assert.match(fn, /w\.index === curWeekNo\(\)/, "weekDetail does not use the documented converter");
  // ⚠️ curWeekNo() falls back to week 1 when today is outside the block, so it must be gated.
  assert.match(fn, /TODAY_IN_PLAN && w\.index === curWeekNo\(\)/,
    "isCur is not gated on TODAY_IN_PLAN, so week 1 reads as current all through a finished plan");
});

test("⚠️ the week's mileage reads a field WeekView actually has", () => {
  // plannedDistanceMeters is the engine's PlannedWeek field and does not survive weekView(); reading
  // it gave undefined, so the figure never appeared once.
  const fn = fnSrc("weekDetail");
  assert.ok(!fn.includes("plannedDistanceMeters"),
    "weekDetail reads plannedDistanceMeters, which is not on WeekView");
  assert.match(fn, /w\.distanceKm/, "the week's mileage is not read at all");
});

test("⚠️ the readiness scale has five reachable values and no dead branch", () => {
  // The check-in offers none / mild / moderate / high. The score read "some", which nothing writes,
  // so a runner answering SORE scored the same as one answering FINE. And the base was 4 with no
  // positive term, so 5 — the "ready" state — was unreachable: a four-point scale printed as n/5.
  const score = lift("readinessScore", { state: { subj: {} } }) as () => number;
  assert.ok(!/soreness === "some"/.test(fnSrc("readinessScore")),
    'readinessScore branches on "some", which nothing writes');

  const SORE = ["none", "mild", "moderate", "high"];
  const ENERGY = ["good", "ok", "low"];
  const seen = new Set<number>();
  const bySore: Record<string, number> = {};
  for (const so of SORE) {
    for (const en of ENERGY) {
      const f = lift("readinessScore", { state: { subj: { soreness: so, energy: en } } }) as () => number;
      const v = f();
      assert.ok(Number.isInteger(v), "the score is not a whole number: " + v);
      assert.ok(v >= 1 && v <= 5, "the score left 1..5: " + v);
      seen.add(v);
      if (en === "good") bySore[so] = v;
    }
  }
  assert.deepEqual([...seen].sort(), [1, 2, 3, 4, 5],
    "not all five values are reachable, so n/5 is false precision: " + [...seen].sort().join(","));
  // ⚠️ The defect stated as a runner would: answering "Sore" must not score the same as "Fine".
  assert.ok(bySore.moderate! < bySore.none!, "a runner reporting soreness scores the same as one who is fine");
  assert.ok(bySore.mild! < bySore.none!, "stiffness counts for nothing");
  assert.ok(bySore.high! < bySore.moderate!, "very sore and sore score the same");
  assert.equal(score(), 5, "a runner with nothing wrong cannot reach the top of the scale");
});

test("⚠️ esc() escapes quotes, because user text reaches attributes through it", () => {
  const esc = lift("esc") as (s: unknown) => string;
  assert.equal(esc('5" Racer'), "5&quot; Racer", "a double quote survives esc and closes the attribute");
  assert.equal(esc("it's"), "it&#39;s", "a single quote survives esc");
  assert.equal(esc("<b>&</b>"), "&lt;b&gt;&amp;&lt;/b&gt;", "the original escapes regressed");
  // ⚠️ Order matters: & must be escaped first or &quot; becomes &amp;quot;.
  assert.equal(esc('&"'), "&amp;&quot;", "the ampersand escape runs after the quote escape");
  // And the real call sites: free text in attribute position.
  const html = page();
  for (const site of ['value="\' + esc(']) {
    assert.ok(html.includes(site), "no attribute call site found — this test no longer proves anything");
  }
});

test("⚠️ data-wk means two things, so the chart handler is scoped to the chart", () => {
  // A week NUMBER on the plan chart, a workout FORMAT ID on the add-a-session library rows. The sheet
  // survives a render because #sheetOv is outside #view, so an unscoped rebind turned every library
  // row into state.planWeek = Number("vo2-10x1") = NaN and killed the sheet.
  const html = page().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ There were TWO in one line: the click binder and the aria-pressed sweep beside it. Fixing the
  // first and not the second left every library row losing its pressed state to the chart.
  assert.equal((html.match(/querySelectorAll\("\[data-wk\]"\)/g) || []).length, 0,
    "an unscoped [data-wk] handler will capture the workout library rows too");
  assert.equal((html.match(/querySelectorAll\("#chart \[data-wk\]"\)/g) || []).length, 2,
    "both the click binder and the aria-pressed sweep must be scoped");
  // Both writers still exist, which is why the scoping is needed rather than a rename.
  assert.ok(html.includes('#sheetBody [data-wk]'), "the sheet's own scoped handler is gone");
});

test("⚠️ no handler dereferences an element that is not in the markup", () => {
  const html = page().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const body = html.slice(html.indexOf("<body"));
  assert.ok(!/\$\("readySlot"\)\.innerHTML/.test(html),
    "readySlot is dereferenced without a guard and there is no such element");
  assert.equal((body.match(/id="readySlot"/g) || []).length, 0,
    "there is now a #readySlot element — the guard can be removed, but check the handler first");
  assert.match(html, /function readySlotPaint\(\) \{ const el = \$\("readySlot"\); if \(el\)/,
    "the paint helper is not guarded");
});

test("⚠️ the red-flag screen runs BEFORE anything is sent to a remote model", () => {
  // alfieRedFlags lived inside alfieLocalAnswer, which the remote path only reaches on FAILURE. With
  // a proxy configured, "chest pain" got a language model's reply and no escalation. The screener's
  // whole value is that it does not depend on a model choosing to escalate.
  const fn = fnSrc("alfieAsk");
  const remote = fn.indexOf("alfieRemote(");
  const screen = fn.indexOf("alfieRedFlags(");
  assert.ok(screen > 0, "alfieAsk does not screen for red flags at all");
  assert.ok(screen < remote, "the red-flag screen runs after the remote dispatch");
  assert.match(fn, /alfieCfg\(\)\.proxy && !alfieRedFlags\(/,
    "a red-flag question is still dispatched to the proxy");
});
