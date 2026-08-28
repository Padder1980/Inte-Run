// Guards for the Manage plan menu and the Pause adaptation.
//
// ⚠️ THE ONE THAT MATTERS MOST IS THE REACHABILITY ONE. Two of the three defects this feature shipped
// during its own build were invented identifiers — `prefersReducedMotion()` and `openHub()`, neither of
// which exists — and the third was `isoAdd` returning a Date where I assigned it as a string, which
// made the whole apply path throw inside its own try/catch. The first two are catchable statically;
// the third was only found by driving the button.

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";

let PAGE: string | null = null;
function page(): string {
  if (PAGE == null) PAGE = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
  return PAGE;
}
let APP: string | null = null;
function appBlock(): string {
  if (APP != null) return APP;
  const blocks = [...page().matchAll(/<script>([\s\S]*?)<\/script>/g)].map((m) => m[1] || "");
  const app = blocks.reduce((a, b) => (b.length > a.length && b.includes("function viewPlan(") ? b : a), "");
  assert.ok(app, "the app's script block could not be found");
  APP = app;
  return app;
}
/** ⚠️ Anchored to the start of a line: `accept="image/*,video/*"` is an unbalanced opener mid-line. */
const nocomment = (s: string) => s.replace(/^\s*\/\*[\s\S]*?\*\//gm, "").replace(/^\s*\/\/.*$/gm, "");
function fn(name: string): string {
  const src = appBlock();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at >= 0, name + " is not in the built page");
  const open = src.indexOf("{", at);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}" && --d === 0) return src.slice(at, i + 1);
  }
  assert.fail(name + " is unbalanced");
  return "";
}

test("BLOCKER: every control in the menu reaches something that exists", () => {
  const app = appBlock();
  const clean = nocomment(app);
  // The four tiles, and one dispatcher branch per tile.
  const tiles = [...clean.matchAll(/tile\("([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tiles, ["overview", "move", "apps", "manage"], "the tile set changed");
  const dispatch = nocomment(fn("planAction"));
  for (const t of tiles)
    assert.ok(new RegExp('id === "' + t + '"').test(dispatch), "planAction has no branch for " + t);

  // ⚠️ AND EVERY FUNCTION EITHER DISPATCHER CALLS MUST EXIST. Both invented identifiers this feature
  // produced would have shipped as a tile that looked live and did nothing — the class this app has
  // shipped three times (rdMore, #saveSetup, the recap's Share button).
  const bodies = ["planAction", "manageAction", "applyPause", "openManagePlan", "openPauseSheet",
    "pausePlanHtml", "managePlanHtml", "planActionsHtml"].map((n) => nocomment(fn(n))).join("\n");
  // ⚠️ BARE IDENTIFIERS ONLY — a method call is a property of something else and is not ours to find.
  // The first version matched `.scrollIntoView(`, `JSON.stringify(` and `.toISOString(` and reported
  // four of the platform's own methods as missing functions.
  const called = new Set([...bodies.matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/gm)].map((m) => m[2]!));
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const BUILTIN = new Set(["if", "for", "while", "switch", "return", "catch", "function", "Number",
    "String", "Math", "JSON", "Boolean", "Array", "Object", "parseInt", "parseFloat", "RegExp", "Date",
    "isNaN", "typeof", "new", "await", "else", "do"]);
  const missing = [...called].filter((n) => !BUILTIN.has(n)
    // ⚠️ `$` IS DEFINED AS `const $ = (id) => ...`, so the check must accept an arrow assignment as
    // well as a function declaration — and `$` is a regex metacharacter, so it has to be escaped
    // while ordinary names must NOT be (escaping every name matched nothing and reported twelve real
    // functions as missing).
    && !new RegExp("(function|const|let|var)\\s+" + esc(n) + "(?![\\w$])").test(app)
    && !new RegExp("\\b" + n + "\\s*[:=]\\s*(function|\\()").test(app));
  assert.deepEqual(missing, [], "these are called and do not exist: " + missing.join(", "));

  // The menu's own rows.
  const menu = nocomment(fn("managePlanHtml"));
  const rows = [...menu.matchAll(/row\("([a-z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(rows, ["pause", "prefs", "new"], "the menu row set changed");
  const ma = nocomment(fn("manageAction"));
  for (const r of rows) assert.ok(new RegExp('id === "' + r + '"').test(ma), "manageAction has no branch for " + r);

  // ⚠️ AND EVERY ICON KEY MUST BE A REAL ONE. ICON.chart, ICON.link, ICON.list and ICON.chev were all
  // invented here; an undefined ICON renders an empty circle in total silence, which is exactly what
  // ICON.search did before somebody noticed the gap in the search field.
  const iconObj = app.slice(app.indexOf("const ICON = {"));
  for (const m of nocomment(fn("planActionsHtml")).matchAll(/ICON\.([a-zA-Z0-9_]+)/g))
    assert.ok(new RegExp("\\b" + m[1] + ":").test(iconObj.slice(0, iconObj.indexOf("\n};"))),
      "ICON." + m[1] + " does not exist, so that tile draws an empty circle");
});

test("BLOCKER: the pause recommendation is derived from the length, and moving the date wins once a break costs something", () => {
  // ⚠️ THE FIRST VERSION RECOMMENDED KEEPING THE TARGET DATE AFTER A MONTH OFF, which is backwards: a
  // month away plus an unchanged target means the block is compressed at exactly the moment the runner
  // is least ready for it. Driven at four lengths so the tier boundaries are exercised, not asserted.
  const src = fn("pauseTierFor") + "\n" + appBlock().slice(appBlock().indexOf("const PAUSE_TIERS ="),
    appBlock().indexOf("];", appBlock().indexOf("const PAUSE_TIERS =")) + 2);
  const tierFor = new Function(src + "; return pauseTierFor;")() as (d: number) => { id: string };
  assert.equal(tierFor(0).id, "nudge");
  assert.equal(tierFor(7).id, "nudge", "a week is still the no-rebuild tier");
  assert.equal(tierFor(8).id, "resume");
  assert.equal(tierFor(14).id, "resume");
  assert.equal(tierFor(15).id, "rebuild");
  assert.equal(tierFor(28).id, "rebuild", "four weeks is the last tier before the long layoff");
  assert.equal(tierFor(29).id, "reentry");
  assert.equal(tierFor(365).id, "reentry");

  // ⚠️ THE 28-DAY LINE IS THE REPO'S OWN, NOT A NEW NUMBER. `returnToRunningPlan` in
  // src/adapt/load-guardrails.ts already draws its long-layoff line at weeksOff >= 4.
  const guard = readFileSync(new URL("../src/adapt/load-guardrails.ts", import.meta.url), "utf8");
  assert.match(guard, /weeksOff >= 4/,
    "the engine's own long-layoff line moved; the pause tier at 28 days was derived from it");

  const sheet = nocomment(fn("pausePlanHtml"));
  // Moving the date is recommended whenever it is offered at all, and is not offered for a short gap.
  assert.match(sheet, /opt\("shift", true,/, "moving the date is no longer the recommendation");
  assert.match(sheet, /t\.id === "nudge"\s*\n?\s*\?\s*""/,
    "a gap of a week or less is still being offered a date move, which is silly");
  assert.ok(!/opt\("keep", true/.test(sheet), "keeping the date is being recommended");
});

test("BLOCKER: applying a pause goes through recompute and never assigns PLAN by hand", () => {
  const ap = nocomment(fn("applyPause"));
  // ⚠️ `adoptPlan` is what snaps every week back to its Monday and re-sends the plan to iOS's
  // notification scheduler and to the wrist. The Save handler open-coded the assignment once and left
  // the OS holding reminders for a schedule that no longer existed.
  assert.match(ap, /recompute\(\)/, "the rebuild no longer goes through recompute");
  assert.ok(!/\bPLAN\s*=/.test(ap), "PLAN is being assigned by hand");
  assert.ok(!/applyProfile\(/.test(ap), "applyProfile is pure — it does not commit — so it cannot rebuild here");

  // ⚠️ THE UNDO SNAPSHOT IS TAKEN BEFORE THE REBUILD, and this is an ORDERING claim. `seedDone()`
  // prunes state.dayOverride of every session id the new plan lacks and PERSISTS the prune, so a
  // snapshot taken afterwards hands back a plan with the runner's own reschedules already deleted.
  const snap = ap.indexOf("const before =");
  const rebuild = ap.indexOf("recompute()");
  const seed = ap.indexOf("seedDone()");
  assert.ok(snap >= 0 && rebuild >= 0 && seed >= 0, "the apply path lost one of its three landmarks");
  assert.ok(snap < rebuild, "the undo snapshot is taken after the rebuild");
  assert.ok(rebuild < seed, "seedDone runs before the rebuild");
  // Today's ticks are restored around seedDone, which every other rebuild path in this app brackets.
  assert.ok(ap.indexOf("todayTicks()") < rebuild, "today's ticks are not captured before the rebuild");
  // ⚠️ COUNTED, NOT MATCHED. There are TWO paths that rebuild here — the apply and the undo closure —
  // and each must bracket seedDone with restoreTicks. A bare /restoreTicks\(/ passed with the apply
  // path's removed, because the undo closure's still satisfied it: watched escaping. `doSaveProfile`
  // was the one rebuild path in this app that ever missed the pairing, and editing your profile
  // silently un-ticked the run you had already done that day.
  const paired = [...ap.matchAll(/seedDone\(\);\s*restoreTicks\(/g)].length;
  assert.equal(paired, 2,
    "seedDone is bracketed by restoreTicks " + paired + " times; both the apply and the undo need it");

  // ⚠️ isoAdd RETURNS A DATE. Every use of it must be converted, or the value assigned into
  // profile.raceDate is a Date and the whole path throws inside its own try/catch — which is exactly
  // what happened, with the sheet simply staying open and nothing to see.
  for (const src of [ap, nocomment(fn("pausePlanHtml"))])
    for (const m of src.matchAll(/isoAdd\([^)]*\)(\.toISOString\(\)\.slice\(0, 10\))?/g))
      assert.ok(m[1], "an isoAdd result is used without .toISOString().slice(0, 10): " + m[0]);
});

test("BLOCKER: nothing is applied without the runner choosing it", () => {
  // Standing instruction, 2026-08-03: the app may observe and it may propose; it may never change a
  // pace, a plan or a target on its own. So applyPause must be reached only from a control.
  const app = nocomment(appBlock());
  const calls = [...app.matchAll(/applyPause\(/g)].length;
  assert.equal(calls, 2, "applyPause is called " + calls + " times; expected its definition and one handler");
  assert.match(app, /\[data-pauseopt\][\s\S]{0,140}applyPause\(b\.dataset\.pauseopt\)/,
    "the only caller is no longer the option button");
  // And the sheet says the choice is a choice.
  assert.match(fn("pausePlanHtml"), /nothing is saved until you choose it/,
    "the sheet no longer tells the runner nothing has happened yet");
});

test("the plan-screen action row is wired from #view, not the document", () => {
  // ⚠️ #sheetOv LIVES OUTSIDE #view AND SURVIVES A RENDER, so a document-wide bind on a selector the
  // sheet also uses rebinds the sheet's controls on every background render — the fault that made
  // data-wk mean two things and killed the session builder mid-use. data-pact appears only on the plan
  // screen, so it is scoped; data-mp and data-pauseopt are on the sheet and are bound from document.
  const app = appBlock();
  assert.match(app, /vw\.querySelectorAll\("\[data-pact\]"\)/, "the action row is no longer scoped to #view");
  assert.match(app, /document\.querySelectorAll\("\[data-mp\]"\)/, "the menu rows lost their binding");
  assert.match(app, /document\.querySelectorAll\("\[data-pauseopt\]"\)/, "the pause options lost their binding");
});
