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
/**
 * ⚠️ A NAME INSIDE A STRING LITERAL IS NOT A CALL. The per-row colours are written as CSS —
 * `"var(--rest)"` — and the bare-identifier sweep below read `var(` as a function this app does not
 * define, reporting the fix as the defect. Same class as nocomment: strip what is not code before
 * scanning for code. Kept to single- and double-quoted strings, because the runtime JS in this file
 * has no template literals in it by rule.
 */
const nostring = (s: string) => s.replace(/"(?:[^"\\]|\\.)*"/g, '""').replace(/'(?:[^'\\]|\\.)*'/g, "''");
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
  // ⚠️⚠️ THE COLLECTION IS DERIVED, NOT LISTED, AND THAT CHANGE IS WHY. The hand-written list this
  // replaced held eight names and could not see the ninth: "Make a week easier" shipped calling
  // `sheetBody()` and `sheetOv()` — two helpers that do not exist — so the sheet opened showing the
  // menu it came from and the control looked live and did nothing. It built, it typechecked, node
  // --check passed all three emitted blocks and 1,469 tests passed, because the one sweep that asks
  // this question was pointed at eight functions and `openEaseWeekSheet` was not among them. A guard
  // over a collection is only as good as the collection, and a hand-written collection goes stale on
  // the next feature by construction.
  // It now walks OUT from the two dispatchers to the functions they call DIRECTLY, plus the sheet
  // builders and wirers among those. One level, not transitive — measured, a fixed-point walk reaches
  // most of the app and reports 47 false positives (platform globals, callback parameters, words from
  // prose), and a guard with 47 false positives is one nobody reads. One level is where an invented
  // helper is fatal — a control that opens a sheet — and it is derived, so the next feature is in
  // scope by construction rather than by somebody remembering to add it.
  const topLevel = new Set([...app.matchAll(/(?:^|\n)function (\w+)\s*\(/g)].map((m) => m[1]!));
  const reach = new Set(["planAction", "manageAction"]);
  for (const n of ["planAction", "manageAction"]) {
    const b = nostring(nocomment(fn(n)));
    for (const m of b.matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/gm))
      if (topLevel.has(m[2]!)) reach.add(m[2]!);
  }
  // ...and the wirer that goes with each sheet builder the dispatchers open.
  const lower = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  for (const n of [...reach]) {
    const stem = n.replace(/^open/, "");
    for (const cand of ["wire" + stem, lower(stem) + "Html", lower(stem) + "SheetHtml"])
      if (topLevel.has(cand)) reach.add(cand);
  }
  assert.ok(reach.size >= 10,
    "the reachable set is only " + reach.size + " functions, so the walk is not walking");
  assert.ok(reach.has("openEaseWeekSheet") && reach.has("easeWeekSheetHtml") && reach.has("wireEaseWeekSheet"),
    "the walk does not reach the easier-week sheet, whose invented helpers this sweep exists to catch: " +
    [...reach].join(", "));
  const bodies = [...reach].map((n) => { try { return nostring(nocomment(fn(n))); } catch { return ""; } }).join("\n");
  // ⚠️ BARE IDENTIFIERS ONLY — a method call is a property of something else and is not ours to find.
  // The first version matched `.scrollIntoView(`, `JSON.stringify(` and `.toISOString(` and reported
  // four of the platform's own methods as missing functions.
  const called = new Set([...bodies.matchAll(/(^|[^.\w$])([a-zA-Z_$][\w$]*)\s*\(/gm)].map((m) => m[2]!));
  const esc = (x: string) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const BUILTIN = new Set(["if", "for", "while", "switch", "return", "catch", "function", "Number",
    "String", "Math", "JSON", "Boolean", "Array", "Object", "parseInt", "parseFloat", "RegExp", "Date",
    "isNaN", "typeof", "new", "await", "else", "do",
    // ⚠️ The platform's own timers and frame callbacks. Added when the sweep's collection became
    // derived and reached the sheets that use them — they are globals, not app functions, and the
    // sweep cannot tell the difference by shape.
    "setTimeout", "clearTimeout", "setInterval", "clearInterval",
    "requestAnimationFrame", "cancelAnimationFrame"]);
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
  // ⚠️ A DELIBERATE LIST, AND ADDING TO IT IS MEANT TO BE A DECISION. "easier" is Hudson's ch7
  // alternative to a scheduled recovery week — "instead, they can just take a day off or replace a hard
  // run with an easy run as necessary" — and it is the only level in this app that SUBSTITUTES rather
  // than deletes. It sits after "ease" because that is the order of increasing commitment.
  assert.deepEqual(rows, ["pause", "holiday", "ease", "easier", "prefs", "new", "plans"],
    "the menu row set changed");
  const ma = nocomment(fn("manageAction"));
  for (const r of rows) assert.ok(new RegExp('id === "' + r + '"').test(ma), "manageAction has no branch for " + r);

  // ⚠️ AND EVERY ICON KEY MUST BE A REAL ONE. ICON.chart, ICON.link, ICON.list and ICON.chev were all
  // invented here; an undefined ICON renders an empty circle in total silence, which is exactly what
  // ICON.search did before somebody noticed the gap in the search field.
  const iconObj = app.slice(app.indexOf("const ICON = {"));
  const icons = iconObj.slice(0, iconObj.indexOf("\n};"));
  for (const m of nocomment(fn("planActionsHtml")).matchAll(/ICON\.([a-zA-Z0-9_]+)/g))
    assert.ok(new RegExp("\\b" + m[1] + ":").test(icons),
      "ICON." + m[1] + " does not exist, so that tile draws an empty circle");
  // ⚠️ AND THE MENU'S OWN SIX, which the tile sweep could not see. managePlanHtml looks its icon up as
  // ICON[icon] from a variable, so a mistyped key is `undefined` and renders an EMPTY coloured chip in
  // total silence -- the identical failure ICON.search had. The keys are read out of the row() calls
  // rather than listed here, so a seventh row cannot arrive unguarded.
  // ⚠️ ANCHORED ON THE COLOUR ARGUMENT, NOT ON row(. A `[^)]*?` window cannot cross the `)` in
  // `planListSub()`, so the first version found five of the six icons and reported the sixth row as
  // missing -- the collection-too-narrow trap, in the guard rather than in the code. Every row ends
  // in `"NAME", "var(--TOKEN)"`, which is unambiguous wherever it sits.
  const menuIcons = [...nocomment(fn("managePlanHtml"))
    .matchAll(/,\s*"([a-zA-Z0-9_]+)",\s*"var\(--/g)].map((m) => m[1]!);
  // ⚠️ THE COUNT IS DERIVED FROM THE ROW SET RATHER THAN TYPED. Pinned at six it caught the seventh
  // row arriving — which is what it is for — but the assertion it makes is a VACUITY check (did the
  // regex find them all), and a vacuity check that needs a manual bump on every new row is one
  // somebody eventually bumps without reading. `rows` is captured above from the same builder.
  assert.equal(menuIcons.length, rows.length,
    "found " + menuIcons.length + " menu icons for " + rows.length + " rows: " + menuIcons.join(", "));
  for (const k of menuIcons)
    assert.ok(new RegExp("\\b" + k + ":").test(icons),
      "ICON." + k + " does not exist, so that row draws an empty coloured chip");
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
  // ⚠️ THE CLAIM IS THAT THE RESULT IS TREATED AS A DATE, NOT THAT IT IS ALWAYS STRINGIFIED. Both
  // `.toISOString().slice(0, 10)` and `.getTime()` are correct uses; the defect is a BARE result, which
  // is what got assigned into profile.raceDate. My first version forbade `.getTime()` too and failed on
  // correct code — and its `[^)]*` could not see past a nested `todayIso()`, so the message it printed
  // was a truncated call rather than the offending one.
  for (const src of [ap, nocomment(fn("pausePlanHtml")), nocomment(fn("pausedCard"))])
    for (const m of src.matchAll(/isoAdd\((?:[^()]|\([^()]*\))*\)(\s*\.)?/g))
      assert.ok(m[1], "an isoAdd result is used bare, as if it were a string: " + m[0]);
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

// ---------------------------------------------------------------------------------------------
// Plan history
// ---------------------------------------------------------------------------------------------

test("BLOCKER: plan history is ONE store, and adoptPlan is the only thing that adds to it", () => {
  // ⚠️ The journal rows were ALREADY the record of a block — the club's plan-journal rail reads them,
  // adoptPlan already wrote them, and they are already in the backup by the interun_ prefix. A second
  // "recent plans" store would have given one fact two homes, and the two disagree the first time
  // somebody deletes from one of them.
  const app = nocomment(appBlock());
  const keys = [...app.matchAll(/"(interun_[a-z0-9_]+)"/g)].map((m) => m[1]!);
  const planish = keys.filter((k) => /plan|block|history/.test(k));
  assert.deepEqual(planish, [], "a second plan store appeared: " + planish.join(", "));
  // ⚠️ SCOPED TO THE JOURNAL ROW'S OWN SHAPE. `rows` is the variable name three unrelated stores use
  // — the club's posts among them — so counting `rows.unshift(` reported two innocent stores as
  // writers of the plan history. `sig:` is the field only a journal row has.
  assert.equal([...app.matchAll(/unshift\(\{\s*sig:/g)].length, 1, "something else adds a journal row");
  // ⚠️ INSIDE adoptPlan. That function's own note records what happens when the assignment is
  // open-coded somewhere else: normalizeWeekStarts and the two syncs get skipped.
  assert.match(nocomment(fn("adoptPlan")), /journalSync\(\)/, "adoptPlan no longer writes the journal");
});

test("BLOCKER: the row carries what the list needs and nothing personal", () => {
  const sync = nocomment(fn("journalSync"));
  for (const f of ["createdIso", "name", "prof"])
    assert.match(sync, new RegExp("\\b" + f + ":"), "the row no longer carries " + f);
  // ⚠️ THE DAY IT WAS MADE, NOT THE DAY IT STARTS. startIso is the first week's MONDAY, which
  // normalizeWeekStarts can put before today — so a plan made on a Thursday would list as created
  // three days before it existed.
  assert.match(sync, /createdIso: todayIso\(\)/, "the creation date is derived from something else");

  // ⚠️ THE SNAPSHOT IS THE PLAN'S INPUTS AND NOT THE PLAN, AND NOT THE PERSON. The avatar is a 256px
  // data URL — twenty-four of those in a capped list is megabytes of duplicated image in localStorage,
  // which is where the whole training history lives. The person's name is not a plan input.
  const src = appBlock();
  const list = src.slice(src.indexOf("const PLAN_PROF_FIELDS"), src.indexOf("];", src.indexOf("const PLAN_PROF_FIELDS")));
  const fields = [...list.matchAll(/"([a-zA-Z]+)"/g)].map((m) => m[1]!);
  assert.ok(fields.length >= 15, "the snapshot has shrunk to " + fields.length + " fields");
  for (const banned of ["avatar", "name", "personalized"])
    assert.ok(!fields.includes(banned), "the snapshot carries " + banned);
  for (const need of ["goalDist", "raceDate", "daysPerWeek", "longRunDay", "recentTimeS", "volKm", "status"])
    assert.ok(fields.includes(need), "the snapshot is missing " + need + ", so a rebuild would differ");
  const snap = nocomment(fn("planProfSnapshot"));
  assert.match(snap, /PLAN_PROF_FIELDS/, "the snapshot no longer derives from the field list");
});

test("BLOCKER: a row written before any of this still lists, and offers only what it can", () => {
  // ⚠️ THE MIGRATION CASE IS THE COMMON CASE FOR EVERY EXISTING RUNNER. Rows already on their phones
  // have no name, no createdIso and no prof. Driven, not read.
  const src = fn("planName") + fn("planCreatedIso") + fn("planDistLabel") + fn("planBadge") +
    'const RACE_LABEL = { "5k": "5 km", "10k": "10 km", half: "Half marathon", marathon: "Marathon" };';
  const f = new Function(src + "; return { planName, planCreatedIso, planDistLabel, planBadge };")() as {
    planName: (j: unknown) => string; planCreatedIso: (j: unknown) => string;
    planDistLabel: (j: unknown) => string; planBadge: (j: unknown) => string;
  };
  const old = { sig: "half|2026-01-05|20", goal: "half", startIso: "2026-01-05", weeks: 20, endedIso: "" };
  assert.equal(f.planName(old), "Half marathon plan", "an unnamed row has no name to show");
  assert.equal(f.planCreatedIso(old), "2026-01-05", "an old row has no date to show");
  assert.equal(f.planDistLabel(old), "21.1 km");
  assert.equal(f.planBadge(old), "21");
  // A typed name wins, and clearing it goes back to the derived one rather than to nothing.
  assert.equal(f.planName({ ...old, name: "My spring half" }), "My spring half");
  assert.equal(f.planName({ ...old, name: "" }), "Half marathon plan", "clearing the name leaves it blank");
  // A row for a goal the app no longer offers still gets a name and a badge.
  assert.equal(f.planName({ goal: "ultra" }), "Training plan");
  assert.equal(f.planBadge({ goal: "ultra" }), "RUN");
  assert.equal(f.planDistLabel({ goal: "ultra" }), "", "an unknown goal invents a distance");

  // ⚠️ AND A ROW WITH NO SNAPSHOT OFFERS NO REUSE — the button is absent, not disabled, because a
  // greyed control on every historic plan advertises something the app cannot do for them.
  const view = nocomment(fn("viewPlans"));
  assert.match(view, /j\.prof\s*\?[\s\S]{0,120}data-rpuse/, "the reuse button is not gated on the snapshot");
  assert.match(nocomment(fn("reusePlan")), /if \(!j \|\| !j\.prof\) return;/, "reusePlan no longer refuses a row it cannot rebuild");
});

test("BLOCKER: reusing a plan rebuilds from the answers and cannot land in the past", () => {
  const r = nocomment(fn("reusePlan"));
  // ⚠️ REBUILT, NEVER RESTORED. The snapshot is the fields that DETERMINE a plan, so the block comes
  // back built by today's engine rather than by whatever version was current when it was abandoned.
  assert.match(r, /recompute\(\)/, "the rebuild no longer goes through recompute");
  assert.ok(!/\bPLAN\s*=/.test(r), "PLAN is being assigned by hand");
  // ⚠️ A TARGET DATE IN THE PAST PRODUCES A PLAN WITH NO WEEKS IN IT, because applyProfile clamps the
  // start to today. So a stale date is pulled forward — and the runner is told which happened.
  assert.match(r, /j\.prof\.raceDate <= todayIso\(\)/, "a target date in the past is no longer detected");
  assert.match(r, /the old one has passed/, "the runner is not told the date moved");
  assert.match(r, /keeping its target date/, "the runner is not told the date was kept");
  // It asks, and the ticks and the snapshot follow the same ordering every rebuild path here uses.
  assert.match(r, /confirmSheet\(/, "reusing a plan no longer asks");
  const snap = r.indexOf("const before ="), reb = r.indexOf("recompute()"), seed = r.indexOf("seedDone()");
  assert.ok(snap >= 0 && snap < reb && reb < seed, "the snapshot/rebuild/seed ordering is wrong");
  assert.match(r, /seedDone\(\); restoreTicks\(/, "today's ticks are not restored around seedDone");
});

test("BLOCKER: deleting a plan asks first, and says what it does not touch", () => {
  const d = nocomment(fn("confirmDeletePlan"));
  assert.match(d, /confirmSheet\(/, "deleting a plan no longer asks");
  assert.match(d, /no way to/, "the dialog does not say the deletion is permanent");
  assert.match(d, /runs you did during it are untouched/, "the dialog does not say the runs survive");
  assert.match(d, /plan journal/, "the dialog does not say the club's journal loses it too");
  // And it is the only deleter.
  const app = nocomment(appBlock());
  assert.equal([...app.matchAll(/journalDelete\(/g)].length, 2,
    "journalDelete has more callers than its definition and the confirm");
});

test("BLOCKER: the plans screen introduces no second colour vocabulary, and every control is wired", () => {
  // ⚠️⚠️ THIS ASSERTION WAS INVERTED, NOT DELETED, ON THE OWNER'S INSTRUCTION (2026-08-28: "i want you
  // to use different colours for the icons of the different run plans"). It used to require
  // `isLive ? "var(--accent)" : "var(--ink-faint)"` -- active versus past and nothing else -- on the
  // reasoning that this app has exactly ONE meaning for a coloured chip (ruling 7). What that protected
  // survives intact and is what is asserted now: the shields borrow neither the effort nor the phase
  // colours, and the active plan is still readable at a glance. Only the grey went.
  const view = nocomment(fn("viewPlans"));
  assert.ok(!/--eff-/.test(view), "the plans screen paints with the effort colours");
  assert.ok(!/PHASE\[/.test(view), "the plans screen paints with the phase colours");
  assert.match(view, /planHue\(j, isLive\)/, "the badge no longer takes its colour from the one hue function");
  assert.ok(!/var\(--ink-faint\)/.test(view), "the shields are grey again, which is what he asked to change");

  // Every control the screen renders is reached by a handler, and from #view rather than the document.
  const app = appBlock();
  for (const a of ["rpname", "rpdel", "rpuse"]) {
    assert.match(view, new RegExp("data-" + a + '="'), "the screen no longer renders data-" + a);
    assert.match(app, new RegExp('vw\\.querySelectorAll\\("\\[data-' + a + '\\]"\\)'),
      "data-" + a + " is not bound from #view");
  }
  // The menu row that reaches it, and the subtitle that says whether there is anything behind it.
  assert.match(nocomment(fn("managePlanHtml")), /row\("plans"/, "the menu lost the plans row");
  assert.match(nocomment(fn("manageAction")), /state\.screen = "plans"/, "the plans row goes nowhere");
  assert.match(nocomment(appBlock()), /state\.screen === "plans"/, "there is no route for the plans screen");
});

// ---------------------------------------------------------------------------------------------
// The pause defect he reported, and the holiday / easing family built on the same mechanism
// ---------------------------------------------------------------------------------------------

test("BLOCKER: a pause actually empties the window it was given", () => {
  // ⚠️⚠️ THE DEFECT HE REPORTED WITHIN THE HOUR OF SHIPPING. The first version moved the target date and
  // rebuilt, which grew the block by the right number of weeks — and left the plan STARTING IN THE PAST,
  // so the days he had just said he would be away were still full of sessions. Reproduced exactly:
  // pausing 28 days moved the race 14 Feb → 14 Mar and grew the plan 25 → 29 weeks while leaving
  // **21 runs inside the 28-day window** and the next fortnight byte-identical.
  const ap = nocomment(fn("applyPause"));
  assert.match(ap, /profile\.startDateIso = isoAdd\(todayIso\(\), days\)\.toISOString\(\)\.slice\(0, 10\)/,
    "the pause no longer moves the plan's start date, so the window stays full");
  // ⚠️ FOR BOTH OPTIONS. Keeping the target date with no start date is the same defect wearing the
  // other option's clothes.
  assert.match(ap, /kind === "shift" \|\| kind === "keep"/, "only one of the two options empties the window");
  // And the undo must put the start date back, or a pause cannot be taken off.
  assert.match(ap, /profile\.startDateIso = before\.startDateIso/, "undo does not restore the start date");
  assert.match(ap, /startDateIso: profile\.startDateIso/, "the snapshot does not include the start date");
  // ⚠️ IT ONLY WORKS BECAUSE applyProfile HONOURS A FUTURE START DATE — its clamp refuses one in the
  // past and accepts one ahead. If that ever changes, the pause silently stops emptying anything.
  assert.match(nocomment(appBlock()),
    /pf\.startDateIso && pf\.startDateIso >= todayIso\(\)\) \? pf\.startDateIso : todayIso\(\)/,
    "applyProfile's start-date clamp changed; the pause depends on a future date being honoured");
});

test("BLOCKER: a paused plan says so, and can be un-paused", () => {
  // ⚠️ A GAP WITH NO EXPLANATION IS THE OTHER HALF OF THAT DEFECT. Measured before this card existed:
  // TODAY_IN_PLAN false, 1,748 characters on Today, and not one of them the word "paused".
  const c = nocomment(fn("pausedCard"));
  assert.match(c, /profile\.startDateIso/, "the card no longer derives the pause from the start date");
  assert.match(c, /Paused/, "the card no longer says the plan is paused");
  assert.match(c, /picks up on/, "the card no longer says when the plan resumes");
  assert.match(c, /pzResume/, "the card no longer carries a way back");
  // ⚠️ DERIVED, NOT STORED. A pause store would be a second answer to "are they away", and the two
  // would disagree the first time somebody edited their start date on the profile screen instead.
  const app = nocomment(appBlock());
  const keys = [...app.matchAll(/"(interun_[a-z0-9_]+)"/g)].map((m) => m[1]!);
  assert.ok(!keys.some((k) => /paus/.test(k)), "a pause store appeared: " + keys.filter((k) => /paus/.test(k)));
  // It is rendered by Today, and un-pausing is the same rebuild as every other.
  assert.match(app, /banner \+ pausedCard\(\)/, "Today does not render the paused card");
  const r = nocomment(fn("resumeFromPause"));
  assert.match(r, /profile\.startDateIso = ""/, "un-pausing no longer clears the start date");
  // ⚠️ COUNTED, NOT MATCHED — the same trap applyPause's restoreTicks guard already paid for. There are
  // two rebuild paths in here, the un-pause and its undo, so a bare /recompute\(\)/ passed with the
  // un-pause's removed: watched escaping.
  assert.equal([...r.matchAll(/recompute\(\)/g)].length, 2,
    "un-pausing has " + [...r.matchAll(/recompute\(\)/g)].length + " rebuilds; the action and its undo each need one");
  assert.match(r, /seedDone\(\); restoreTicks\(/, "today's ticks are not restored around seedDone");
  assert.match(app, /\$\("pzResume"\)\.onclick = resumeFromPause/, "the way back is not wired");
});

test("BLOCKER: the adjustment windows are one store applied in one place, before the syncs", () => {
  const app = nocomment(appBlock());
  // ⚠️ INSIDE adoptPlan. A rebuild happens on every launch (recompute runs at module level), so an
  // adjustment applied anywhere else would be undone by the next one.
  const adopt = nocomment(fn("adoptPlan"));
  assert.match(adopt, /applyAdjustments\(\)/, "the adjustments are no longer applied when a plan is adopted");
  // ⚠️ AND BEFORE THE TWO SYNCS — an ORDERING claim. Run after them, iOS holds reminders for sessions
  // the runner has just said they will not do, and the wrist holds them too.
  const a = adopt.indexOf("applyAdjustments()");
  const rem = adopt.indexOf("syncNativeReminders()");
  const wat = adopt.indexOf("syncWatch()");
  assert.ok(a >= 0 && rem >= 0 && wat >= 0, "adoptPlan lost one of its three landmarks");
  assert.ok(a < rem && a < wat, "the adjustments are applied after the reminders or the watch are told");
  assert.equal([...app.matchAll(/applyAdjustments\(\)/g)].length, 2,
    "applyAdjustments has callers beyond its definition and adoptPlan");

  // ⚠️ RAW IS THE TRUTH AND PLAN IS A PROJECTION. Filtering only PLAN leaves the wrist and the session
  // sheet still prescribing the work; filtering only RAW leaves the chart showing a full week.
  const ap = nocomment(fn("applyAdjustments"));
  assert.match(ap, /wk\.sessions = wk\.sessions\.filter/, "PLAN's sessions are no longer filtered");
  assert.match(ap, /raw\.sessions = raw\.sessions\.filter/, "RAW's sessions are no longer filtered");
  // ⚠️ AND THE WEEK'S MILEAGE COMES FROM THE ENGINE'S OWN DEFINITION. src/domain/steps.ts records what a
  // second one cost: an adjusted week measured on a different scale from every other week in its plan.
  assert.match(ap, /RC\.weekVolumeMeters\(raw\.sessions\)/, "the week's mileage is being re-summed here");
  assert.match(nocomment(readFileSync(new URL("../web/entry.ts", import.meta.url), "utf8")),
    /export \{ sessionVolumeMeters, weekVolumeMeters \}/, "the engine's volume definition is no longer exported");
  // ⚠️ THE SESSION'S OWN DAY, NOT effDay. A session the runner MOVED into the window is one they put
  // there after the window was set, and reading effDay here would silently delete it.
  assert.ok(!/effDay\(/.test(ap), "the adjustment reads effDay and would delete a session the runner moved in");
});

test("BLOCKER: the four levels remove exactly what they claim, and never the race", () => {
  // Driven against the real predicate, because the copy on each option is a promise about it.
  const src = fn("adjDrops") + "\n" +
    'const ADJ_QUALITY = { threshold: 1, vo2: 1, "race-specific": 1 };\n' +
    'const ADJ_RUN = { easy: 1, long: 1, recovery: 1, threshold: 1, vo2: 1, strides: 1, "race-specific": 1 };';
  const drops = new Function(src + "; return adjDrops;")() as (a: unknown, s: unknown) => boolean;
  const S = (type: string) => ({ type });
  const W = (mode: string, dropNonRun = false) => ({ mode, dropNonRun });
  const EXPECT: Record<string, string[]> = {
    full: [],
    easyspeed: ["long"],
    easy: ["long", "threshold", "vo2", "race-specific"],
    none: ["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific"],
  };
  const ALL = ["easy", "long", "recovery", "threshold", "vo2", "strides", "race-specific"];
  for (const [mode, gone] of Object.entries(EXPECT))
    for (const t of ALL)
      assert.equal(drops(W(mode), S(t)), gone.includes(t),
        mode + " " + (gone.includes(t) ? "keeps" : "removes") + " a " + t + " session and should not");
  // ⚠️ THE GOAL RACE IS NEVER REMOVED AT ANY LEVEL. It is what the whole block exists to reach, and a
  // holiday that quietly deleted it would be the app throwing the plan away rather than adapting it.
  for (const mode of Object.keys(EXPECT))
    assert.equal(drops(W(mode, true), S("race")), false, mode + " removes the goal race");
  // ⚠️ AND A NON-RUN GOES ONLY IF THE RUNNER ASKED — a separate switch, as Runna's own sheet has it.
  for (const t of ["strength", "mobility", "cross-training"]) {
    assert.equal(drops(W("none"), S(t)), false, "a " + t + " session goes without being asked for");
    assert.equal(drops(W("full", true), S(t)), true, "asking to remove " + t + " does nothing");
  }
  // The mode list the sheet offers is exactly the set the predicate understands.
  const app = appBlock();
  const modes = [...app.slice(app.indexOf("const ADJ_MODES ="), app.indexOf("];", app.indexOf("const ADJ_MODES =")))
    .matchAll(/id: "([a-z]+)"/g)].map((m) => m[1]!);
  assert.deepEqual(modes.sort(), Object.keys(EXPECT).sort(), "the offered modes and the predicate disagree");
});

test("BLOCKER: the preview counts with the same predicate the application uses, and a past window is dropped", () => {
  // ⚠️ The sheet quotes a number the runner is agreeing to. The only honest way to produce it is to ask
  // the same question the application will ask — a second estimate would be a second answer.
  const prev = nocomment(fn("adjustPreviewCount"));
  assert.match(prev, /adjDrops\(a, x\)/, "the preview no longer uses the real predicate");
  assert.ok(!/mode ===/.test(prev), "the preview has its own opinion about what a mode removes");
  // ⚠️ PAST WINDOWS GO ON EVERY WRITE. An adjustment is applied at adopt time, so one that has ended can
  // only make the next rebuild slower and the store bigger. The runs done during it are in the logbook.
  const sa = nocomment(fn("saveAdjust"));
  assert.match(sa, /r\.to >= today/, "an ended window is kept for ever");
  assert.match(sa, /slice\(0, 12\)/, "the store is uncapped");
  // Undo restores the whole store, because the only way back from a removal is a rebuild without it.
  const sd = nocomment(fn("saveAdjustDraft"));
  assert.match(sd, /const before = JSON\.stringify\(loadAdjust\(\)\)/, "the undo snapshot is not the store");
  assert.match(sd, /toastUndo\(/, "there is no undo");
  const snap = sd.indexOf("const before ="), reb = sd.indexOf("recompute()");
  assert.ok(snap >= 0 && snap < reb, "the snapshot is taken after the rebuild");
});

test("BLOCKER: going away and easing off leave the target date alone — that is what makes them not a pause", () => {
  const sd = nocomment(fn("saveAdjustDraft"));
  for (const f of ["raceDate", "startDateIso", "targetS", "daysPerWeek"])
    assert.ok(!new RegExp("profile\\." + f + "\\s*=").test(sd),
      "an adjustment writes profile." + f + "; it is meant to take sessions out, not move the block");
  assert.match(nocomment(fn("managePlanHtml")), /target date alone/,
    "the menu no longer says what separates these from a pause");
  // Both entry points exist, share one builder, and are wired.
  const ma = nocomment(fn("manageAction"));
  for (const id of ["holiday", "ease"]) {
    assert.match(nocomment(fn("managePlanHtml")), new RegExp('row\\("' + id + '"'), "the menu lost the " + id + " row");
    assert.match(ma, new RegExp('id === "' + id + '"[\\s\\S]{0,80}openAdjustSheet\\("' + id + '"\\)'),
      "the " + id + " row does not open the shared sheet");
  }
  // ⚠️ ONE BUILDER, TWO HEADINGS. Two builders over one mechanism is how the two come to behave
  // differently for no reason.
  const app = nocomment(appBlock());
  // ⚠️ THE CLAIM IS THAT ONE FUNCTION WRITES THE SHEET, NOT THAT ONE NAME EXISTS. Counting
  // `function renderAdjustSheet(` missed a second builder called anything else — and a wrapper that
  // merely delegates is not a second builder at all, so the honest discriminator is which functions
  // write the sheet's own markup.
  const writers = [...app.matchAll(/function (\w+)\s*\([^)]*\)\s*\{/g)].map((m) => m[1]!)
    .filter((n) => { try { return /data-adjmode=/.test(nocomment(fn(n))); } catch { return false; } });
  assert.deepEqual(writers, ["renderAdjustSheet"],
    "the adjust sheet's markup is written by: " + writers.join(", "));
  for (const a of ["adjmode", "adjnonrun"])
    assert.match(app, new RegExp('querySelectorAll\\("\\[data-' + a + '\\]"\\)|querySelector\\("\\[data-' + a + '\\]"\\)'),
      "data-" + a + " is not bound");
});

/**
 * Slices a top-level `const NAME = ...;` out of the BUILT page, balancing brackets so an array or an
 * object literal comes back whole.
 *
 * ⚠️ THE CONSTS ARE READ OUT OF THE PAGE RATHER THAN TYPED IN HERE. A supplied table means the lifted
 * function runs against the TEST's values, which this project has twice watched escape a re-break —
 * once with `CLUB_TONE_N` and once with the engine's own distance tables.
 */
function constSrc(name: string): string {
  const src = appBlock();
  const at = src.indexOf("const " + name + " =");
  assert.ok(at >= 0, name + " is not in the built page");
  let d = 0;
  for (let i = at; i < src.length; i++) {
    const c = src[i];
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return src.slice(at, i + 1);
  }
  assert.fail(name + " is unterminated");
  return "";
}

type Adj = { kind: string; from: string; to: string; mode: string; dropNonRun?: boolean };
type Mark = { adj: Adj; days: string[]; count: number; tag: string; phrase: string } | null;
/** The two real functions, over the real predicate, with only the STORE READ stubbed. */
function weekMark(rows: Adj[]) {
  // ⚠️ `adjPhrase` JOINED THIS LIST WHEN THE STORE GAINED A THIRD KIND. A hand-written lift list goes
  // stale on the next change by construction — and that is the ACCEPTABLE kind of stale, because it
  // fails loudly with a ReferenceError rather than quietly measuring less.
  const src = ["weekAdjust", "weekAdjustNote", "adjPhrase", "adjustFor", "isoAdd", "runDateLabelIso", "esc"]
    .map((n) => fn(n)).join("\n") + "\n" +
    ["ADJ_MODES", "MON_SHORT"].map((n) => constSrc(n)).join("\n") + "\n" +
    "function loadAdjust() { return ROWS; }\n";
  return new Function("ROWS", src + "return { weekAdjust: weekAdjust, note: weekAdjustNote };")(rows) as
    { weekAdjust: (w: unknown) => Mark; note: (w: unknown) => string };
}
const WK = (startIso: string, index = 3) => ({ startIso, index, phase: "build" });

test("BLOCKER: an altered week is marked by a DASHED border AND a word — colour is never the only signal", () => {
  const app = appBlock();
  const css = page().slice(page().indexOf("<style>"), page().indexOf("</style>"));
  // ⚠️ THE DASH IS WHAT DISTINGUISHES IT FROM THE CURRENT WEEK, which already owns the solid accent
  // border. Two different things marked identically is the same fault as a phase legend whose swatch
  // you cannot match to a bar.
  const rule = (sel: string) => {
    const at = css.indexOf(sel + " {");
    assert.ok(at >= 0, "there is no " + sel + " rule");
    return css.slice(at, css.indexOf("}", at));
  };
  for (const sel of [".wk-sum.adj", ".wk-open.adj"]) {
    assert.match(rule(sel), /border-style:\s*dashed/, sel + " is not dashed, so it cannot be told from the current week");
    assert.match(rule(sel), /border-color:\s*var\(--accent\)/, sel + " does not use the accent");
  }
  // ⚠️ AND THE MARK SURVIVES ON THE CURRENT WEEK. `.wk-sum.cur` sets a solid accent border and ties on
  // specificity with `.wk-sum.adj`, so without this rule whichever came later in the stylesheet would
  // decide — and "this week, and it is a holiday week" is the case a runner most needs to read.
  assert.match(rule(".wk-sum.cur.adj"), /border-style:\s*dashed/,
    "a current week that is also altered loses its dash");
  // The word. A tag, in the accent, carrying weekAdjust's own label.
  const row = nocomment(fn("weekSummaryRow"));
  assert.match(row, /const adj = weekAdjust\(w\)/, "the row no longer asks weekAdjust");
  assert.match(row, /adj \? " adj" : ""/, "the row does not carry the class");
  assert.match(row, /wk-tag adj[\s\S]{0,40}adj\.tag/, "the row marks the week by colour alone, with no word in it");
  assert.match(rule(".wk-tag.adj"), /var\(--accent\)/, "the tag is not in the accent");
  assert.match(rule(".wk-tag.adj"), /color:\s*var\(--accent-ink\)/, "the tag's label is not the accent's own ink");
  // ⚠️ NO NEW COLOUR AND NO TINT, which is what makes test/contrast.test.ts cover this by construction:
  // --accent-ink on --accent and --accent/--ink-soft/--ink-faint on --surface-2 are all already asserted
  // there, in all four theme blocks. A color-mix() or a hex here would be outside every existing guard.
  for (const sel of [".wk-sum.adj", ".wk-open.adj", ".wk-tag.adj", ".wk-paused", ".wk-adj", ".wk-adj b", ".wk-adj span"]) {
    const r = rule(sel);
    assert.ok(!/#[0-9a-f]{3,8}\b/i.test(r), sel + " carries a literal colour instead of a token");
    assert.ok(!/color-mix\(/.test(r), sel + " tints a token, which no existing contrast guard covers");
  }
});

test("BLOCKER: a window is measured in DAYS, so one spanning two weeks marks both", () => {
  // ⚠️ THIS IS THE WHOLE REASON weekAdjust WALKS THE SEVEN DAYS RATHER THAN TESTING THE WEEK'S START.
  // A holiday runs Friday to the following Thursday far more often than it lines up with a Monday, and
  // a week-start test marks one of the two weeks it actually touches — the other reads as untouched
  // while its sessions have been taken out.
  const A: Adj = { kind: "holiday", from: "2026-09-11", to: "2026-09-17", mode: "easy" };
  const api = weekMark([A]);
  const w1 = api.weekAdjust(WK("2026-09-07", 3)); // Mon 7 Sep — the window's first three days
  const w2 = api.weekAdjust(WK("2026-09-14", 4)); // Mon 14 Sep — its last four
  assert.ok(w1 && w2, "a window spanning two weeks marked " + (w1 ? "" : "not the first ") + (w2 ? "" : "not the second"));
  assert.equal(w1!.count, 3, "the first week counted " + w1!.count + " days, not the 3 it holds");
  assert.equal(w2!.count, 4, "the second week counted " + w2!.count + " days, not the 4 it holds");
  assert.deepEqual(w1!.days, ["2026-09-11", "2026-09-12", "2026-09-13"], "the first week's days are wrong");
  // A week that does not meet it at all is not marked, and gets no note.
  assert.equal(api.weekAdjust(WK("2026-09-21", 5)), null, "an untouched week is marked");
  assert.equal(api.note(WK("2026-09-21", 5)), "", "an untouched week carries a note");
  assert.equal(weekMark([]).weekAdjust(WK("2026-09-07", 3)), null, "a week is marked with no windows stored");
  // A whole week says so, rather than counting to seven.
  const whole = weekMark([{ kind: "holiday", from: "2026-09-07", to: "2026-09-13", mode: "none" }]);
  assert.equal(whole.weekAdjust(WK("2026-09-07", 3))!.count, 7, "a fully covered week did not count 7");
  assert.match(whole.note(WK("2026-09-07", 3)), /The whole week/, "a fully covered week counts to seven at the runner");
  // ⚠️⚠️ AND THE COUNT IS OF **THIS** WINDOW'S DAYS, WHICH ONE WINDOW CANNOT DISCRIMINATE. Watched
  // escaping: dropping the `a === hit` test is a no-op with a single window stored, so every assertion
  // above passed while a week holding two windows reported one's label over both their days — "5 days of
  // this week, easy runs only" when three of them were the holiday and two were an easier stretch. Two
  // windows in one week is rare and entirely legal, and the fixture has to hold two to see it at all.
  const both = weekMark([
    { kind: "holiday", from: "2026-09-07", to: "2026-09-09", mode: "easy" },
    { kind: "ease", from: "2026-09-10", to: "2026-09-11", mode: "easyspeed" },
  ]);
  const m = both.weekAdjust(WK("2026-09-07", 3))!;
  assert.equal(m.count, 3, "a week holding two windows counted " + m.count + " days for the first of them");
  assert.deepEqual(m.days, ["2026-09-07", "2026-09-08", "2026-09-09"],
    "the count includes days belonging to a different window");
  assert.equal(m.tag, "Holiday", "the first window this week meets does not decide the label");
  const bn = both.note(WK("2026-09-07", 3));
  assert.match(bn, /7 Sep to 9 Sep/, "the note's span reaches into the second window");
  assert.ok(!/11 Sep/.test(bn), "the note names a day belonging to a different window");
});

test("BLOCKER: the opened week names the change, in the runner's own dates, with the way back", () => {
  const api = weekMark([{ kind: "holiday", from: "2026-09-11", to: "2026-09-17", mode: "easy" }]);
  const note = api.note(WK("2026-09-07", 3));
  assert.match(note, /class="wk-adj"/, "there is no note");
  assert.match(note, /Going away/, "the note does not say what happened");
  // ⚠️ REAL DATES, NEVER "THIS WEEK". The row above it already says which week; what the runner cannot
  // work out for themselves is WHICH DAYS of it are gone, and a plan is read weeks ahead of time.
  assert.match(note, /11 Sep/, "the note does not name the first affected day");
  assert.match(note, /13 Sep/, "the note does not name the last affected day");
  assert.match(note, /3 days of this week/, "the note does not say how much of the week it covers");
  // ⚠️ THE PHRASE COMES FROM ADJ_MODES[].p, NOT FROM LOWERCASING THE TITLE — my own defect, measured:
  // `.t.toLowerCase()` on the fourth mode produced "i am not planning on running", which is a sentence
  // about the runner's intention pasted into a sentence about the week.
  assert.match(note, /easy runs only/, "the note does not say what is left");
  const none = weekMark([{ kind: "holiday", from: "2026-09-07", to: "2026-09-13", mode: "none" }]).note(WK("2026-09-07", 3));
  assert.match(none, /no running at all/, "the strongest level does not say what it leaves");
  assert.ok(!/i am not planning/i.test(none), "the note lowercases the option's title instead of using its phrase");
  // ⚠️ EVERY MODE CARRIES ONE, or a fifth level would fall back to printing its raw id at the runner.
  const modes = constSrc("ADJ_MODES");
  assert.equal((modes.match(/\bid:/g) || []).length, (modes.match(/\bp:/g) || []).length,
    "a mode has no phrase, so its note would print the option's id or its title");
  // The way back is named, per kind, because the sheet it came from is not the screen it is read on.
  assert.match(note, /Manage plan/, "the note does not say how to undo it");
  assert.match(note, /Going away\.<\/span>/, "the holiday note points at the wrong sheet");
  const ease = weekMark([{ kind: "ease", from: "2026-09-11", to: "2026-09-13", mode: "easyspeed" }]);
  const en = ease.note(WK("2026-09-07", 3));
  assert.match(en, /Taking it easier/, "an easing note is headed as a holiday");
  assert.match(en, /Not feeling 100%\.<\/span>/, "the easing note points at the wrong sheet");
  assert.equal(ease.weekAdjust(WK("2026-09-07", 3))!.tag, "Easier", "the easing tag reads as a holiday");
  assert.equal(api.weekAdjust(WK("2026-09-07", 3))!.tag, "Holiday", "the holiday tag does not say holiday");
  // Strength and mobility are mentioned only when they were actually taken out.
  const nr = weekMark([{ kind: "holiday", from: "2026-09-11", to: "2026-09-13", mode: "easy", dropNonRun: true }]);
  assert.match(nr.note(WK("2026-09-07", 3)), /Strength and mobility are out too/, "the note omits the non-runs");
  assert.ok(!/Strength and mobility/.test(note), "the note claims the non-runs went when they did not");
});

test("BLOCKER: one definition of whether a week is altered, read by both the row and the note", () => {
  // ⚠️ A SECOND COMPUTATION IS HOW THE BORDER AND THE NOTE COME TO DISAGREE — the row saying nothing
  // happened over a note describing three missing days, or the reverse. Neither render site may walk
  // the week's days or ask adjustFor itself.
  const app = nocomment(appBlock());
  for (const site of ["weekSummaryRow", "weekAdjustNote", "weekList"]) {
    const b = nocomment(fn(site));
    assert.match(b, /weekAdjust\(/, site + " no longer asks weekAdjust");
    assert.ok(!/adjustFor\(/.test(b), site + " asks adjustFor directly, which is a second definition");
  }
  // ⚠️ THE SWEEP MUST STRIP THE FUNCTION'S OWN SIGNATURE, or `adjustFor` matches itself and reports the
  // one definition as a rogue caller — the guard-trips-on-its-own-vocabulary trap, again.
  const body = (n: string) => nocomment(fn(n)).replace(/^function \w+\s*\([^)]*\)/, "");
  const askers = [...app.matchAll(/function (\w+)\s*\([^)]*\)\s*\{/g)].map((m) => m[1]!)
    .filter((n) => { try { return /adjustFor\(/.test(body(n)); } catch { return false; } });
  // ⚠️ `eased` IS A THIRD ASKER AND NOT A THIRD DEFINITION, and this list is what forced that to be a
  // decision rather than a surprise. It answers one question — is this plan week covered by a stored
  // "make this week easier" row — by DELEGATING to adjustFor and adding a mode test. It does not
  // re-implement the range comparison, which is the thing that must stay in one place.
  assert.deepEqual(askers.sort(), ["applyAdjustments", "eased", "weekAdjust"],
    "a stored window's membership is decided by: " + askers.join(", "));
  // ...and it must genuinely delegate rather than re-derive the range.
  const easedBody = body("eased");
  assert.match(easedBody, /adjustFor\(/, "eased does not ask adjustFor");
  assert.ok(!/>=\s*\w+\.from|<=\s*\w+\.to/.test(easedBody),
    "eased re-implements the window range test instead of delegating to adjustFor");
  // ⚠️ `adjustPreviewCount` RANGE-TESTS INLINE AND THAT IS NOT A SECOND DEFINITION: it is handed ONE
  // draft window that is not in the store yet, so there is nothing for adjustFor to search. Stated here
  // rather than left as a silent exception, and pinned so it cannot quietly grow into a search.
  const prevBody = body("adjustPreviewCount");
  assert.match(prevBody, /iso < a\.from \|\| iso > a\.to/, "the preview no longer range-tests its own draft");
  assert.ok(!/loadAdjust\(/.test(prevBody), "the preview reads the store, so it is answering a different question");
  // The opened week renders the note, and the list marks the opened card too.
  assert.match(nocomment(fn("weekDetail")), /weekAdjustNote\(w\)/, "an opened week does not name its change");
  assert.match(nocomment(fn("weekList")), /wk-open[\s\S]{0,40}weekAdjust\(w\) \? " adj" : ""/,
    "the opened card loses the mark, so opening a marked week un-marks it");
});

test("BLOCKER: a paused stretch is a row above the list, not a coloured week", () => {
  // ⚠️ A PAUSE HAS NO WEEK TO COLOUR, and that is the difference between it and a holiday. Pausing moves
  // the block's start date, so the paused days belong to no week of the plan at all — there is no row to
  // put a border on. A holiday leaves the weeks where they are and empties days inside them.
  const row = nocomment(fn("pausedWeekRow"));
  assert.match(row, /<div class="wk-sum wk-paused"/, "the paused stretch is not a plain row");
  assert.ok(!/<button/.test(row), "the paused stretch is a button, so it looks like it opens something");
  assert.match(row, /aria-disabled="true"/, "the paused row is not announced as inert");
  // Derived from the future start date — the same derivation pausedCard uses, and no store of its own.
  assert.match(row, /profile\.startDateIso/, "the paused row does not read the start date");
  assert.match(row, /from <= todayIso\(\)/, "the paused row shows when the plan is not paused");
  assert.ok(!/localStorage|PAUSE_KEY/.test(row), "the paused row keeps a store, which can go stale against the date");
  assert.match(row, /week 1 begins/, "the paused row does not say when running resumes");
  // First, above every week, because it is the stretch before week one.
  const list = nocomment(fn("weekList"));
  assert.match(list, /return pausedWeekRow\(\) \+ PLAN\.weeks/, "the paused row is not the first thing in the list");
  // ⚠️ NO TAG ON THIS ROW. Its own title is the word, and a tag repeating it read "PausedPaused".
  assert.ok(!/wk-tag/.test(row), "the paused row carries a tag that repeats its own title");
});

/* ============================================================================================
 * The owner's 2026-08-28 batch: the sheet sliding sideways, cancelling a booked break, starting a
 * new plan through the wizard, and a colour per plan shield.
 * ========================================================================================== */

let SHEETCSS: string | null = null;
function css(): string {
  if (SHEETCSS != null) return SHEETCSS;
  const s = page();
  SHEETCSS = s.slice(s.indexOf("<style>"), s.indexOf("</style>"));
  return SHEETCSS;
}
/**
 * ⚠️ STRIPS CSS COMMENTS. The .rp-badge rule carries a note explaining why it no longer uses
 * var(--accent-ink), so a guard forbidding that token read the sentence defending the fix AS the
 * defect -- the eleventh firing of comment-quotes-what-it-forbids in this project.
 * ⚠️ And it slices to the rule's closing brace by scanning past comments, because a /* ... *\/ inside a
 * declaration block contains no brace but does contain text a naive indexOf("}") would stop before.
 */
function rule(sel: string): string {
  const c = css();
  const at = c.indexOf(sel + " {");
  assert.ok(at >= 0, "there is no " + sel + " rule");
  const body = c.slice(at, c.indexOf("}", at) + 1);
  return body.replace(/\/\*[\s\S]*?\*\//g, "");
}

test("BLOCKER: a sheet can never be dragged sideways", () => {
  // ⚠️ THE OWNER PHOTOGRAPHED THIS. The spec turns `visible` into `auto` when the other axis is not
  // visible, so `overflow-y: auto` alone had made every sheet a HORIZONTAL scroller -- and one pixel of
  // overflow is then enough for iOS rubber-banding to slide the whole sheet, headings and all, off the
  // left edge. Measured 0px of overflow in headless Chrome at four sizes, which is exactly why it took
  // a photograph from a real phone: a native date input renders wider on iOS than in Chrome.
  assert.match(rule(".sheet"), /overflow-x:\s*clip/,
    "the sheet does not pin its horizontal axis, so any overflow at all makes it draggable");
  // ⚠️ A RATCHET, NOT A BAN. Eleven rules in this stylesheet legitimately scroll vertically and say
  // nothing about x, and most of them are harmless; what must not grow is the number of them, because
  // each one is a surface that can be slid sideways by accident.
  const IMPLICIT_CEILING = 9;   // measured 2026-08-28, after .sheet and .caltip-body were pinned
  const implicit = [...css().matchAll(/([^{}\n]+)\{([^}]*)\}/g)]
    .filter((m) => /overflow-y:\s*(auto|scroll)/.test(m[2] || "") && !/overflow-x|overflow:\s/.test(m[2] || ""))
    .map((m) => (m[1] || "").trim());
  assert.ok(implicit.length <= IMPLICIT_CEILING,
    implicit.length + " rules scroll vertically without pinning x (ceiling " + IMPLICIT_CEILING + "): " + implicit.join(", "));
  assert.ok(!implicit.some((s) => s.includes(".sheet") || s.includes(".caltip-body")),
    "a pinned scroller lost its overflow-x again");
  // ⚠️ AND THE CLIP IS THE GUARANTEE, NOT THE FIX: on its own it turns an overflow into missing
  // content. The date row wraps on a MINIMUM so nothing is clipped -- flex-wrap breaks a line from the
  // flex BASIS, so with a basis of 140px two fields never wrapped and a wider intrinsic minimum pushed
  // them out of the row instead (measured 17px of overflow at 375 wide).
  const dates = rule(".adj-dates");
  assert.match(dates, /grid-template-columns:\s*repeat\(auto-fit,\s*minmax\(/,
    "the date row does not wrap on a minimum, so a wider native control overflows instead of stacking");
  assert.ok(!/flex-wrap/.test(dates), "the date row is back on flex-wrap, which wraps from the basis");
  assert.match(rule('input.sel[type="date"]'), /min-width:\s*0/,
    "a native date control keeps its intrinsic minimum, so width: 100% cannot squeeze it");
});

test("BLOCKER: a booked break can always be cancelled, and a pause is one of them", () => {
  const src = nocomment(fn("plannedBreaksHtml"));
  // ⚠️ WITHOUT THIS THERE WAS NO WAY BACK: booking raised an undo toast and nothing else, so once that
  // toast had gone the window was in the store for good.
  assert.match(src, /loadAdjust\(\)/, "the list does not read the adjustment store");
  assert.match(src, /profile\.startDateIso/, "the list does not know about a pause");
  assert.match(src, /data-pbdel=/, "there is no way to cancel a holiday or an easier stretch");
  assert.match(src, /data-pbresume=/, "there is no way to cancel a pause");
  // ⚠️ NOTHING BOOKED RENDERS NOTHING. A permanent empty heading on a menu teaches the runner to scroll
  // past that part of the screen.
  assert.match(src, /if \(!rows\.length && !paused\) return ""/, "the list renders when nothing is booked");
  // ⚠️ AND IT IS RENDERED. A builder proves a shape exists; only the caller proves the runner sees it --
  // deleting the call from managePlanHtml escaped every assertion above it, which is the same hole this
  // project has now recorded four times.
  assert.match(nocomment(fn("managePlanHtml")), /plannedBreaksHtml\(\)/,
    "the breaks list is built and never rendered, so there is still no way to cancel a break");
  // Both controls are reached by a handler.
  const app = nocomment(appBlock());
  for (const a of ["pbdel", "pbresume"])
    assert.match(app, new RegExp('querySelectorAll\\("\\[data-' + a + '\\]"\\)[\\s\\S]{0,140}onclick'),
      "data-" + a + " is rendered and never wired");
  assert.match(app, /data-pbresume\]"\)[\s\S]{0,140}resumeFromPause/,
    "the pause's way out is not the function that already existed for it");
  // ⚠️ cancelAdjust MUST SNAPSHOT BEFORE THE REBUILD. seedDone() prunes dayOverride of session ids the
  // new plan lacks and PERSISTS the prune, so a snapshot taken afterwards hands back a plan with the
  // runner's own reschedules already deleted -- under a button labelled Undo.
  const ca = nocomment(fn("cancelAdjust"));
  const snap = ca.indexOf("const before ="), reb = ca.indexOf("recompute()");
  assert.ok(snap >= 0, "cancelAdjust takes no snapshot");
  assert.ok(reb >= 0, "cancelAdjust never rebuilds");
  assert.ok(snap < reb, "the snapshot is taken after the rebuild, so Undo hands back a pruned plan");
  assert.match(ca, /toastUndo\(/, "cancelling a break cannot be undone");
  // ⚠️ THE HIT AREA GROWS BY A PSEUDO-ELEMENT AND MUST CLEAR 44px. Measured by bisecting
  // elementFromPoint: the label is 13px type on a ~17px line, so -12px gave 41.48px and -15px gives
  // 47.48px. A box cannot report its own pseudo-element, so the inset is what a static guard can check.
  const x = rule(".pb-x::after");
  const ins = /inset:\s*(-?[0-9.]+)px/.exec(x);
  assert.ok(ins, ".pb-x::after declares no inset, so the Cancel control has only its own text to hit");
  const grown = 17 + 2 * Math.abs(Number(ins![1]));
  assert.ok(grown >= 44,
    "the Cancel control's grown hit area is about " + grown + "px against this app's 44px floor");
  // Both cancel paths keep today's ticks across the rebuild -- the one rebuild path that ever forgot.
  for (const f of ["cancelAdjust", "resumeFromPause"]) {
    const body = nocomment(fn(f));
    assert.equal((body.match(/restoreTicks\(/g) || []).length, 2,
      f + " does not restore today's ticks on both the action and its undo");
    assert.match(body, /seedDone\(\); restoreTicks\(/, f + " calls seedDone without restoring ticks after it");
  }
});

/** Brace-matches ONE `if (id === "x") { ... }` branch. A character window is not a branch. */
function branch(dispatcher: string, id: string): string {
  const src = nocomment(fn(dispatcher));
  const at = src.indexOf('if (id === "' + id + '")');
  assert.ok(at >= 0, dispatcher + " has no branch for " + id);
  const open = src.indexOf("{", at);
  let d = 0;
  for (let i = open; i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}" && --d === 0) return src.slice(at, i + 1);
  }
  assert.fail(dispatcher + "'s " + id + " branch is unbalanced");
  return "";
}

test("BLOCKER: Start a new plan opens the wizard, and only a runner who has a name skips that step", () => {
  const br = branch("manageAction", "new");
  assert.match(br, /startWizard\(\)/, "Start a new plan does not open the wizard");
  assert.ok(!/state\.screen = "setup"/.test(br),
    "Start a new plan still opens the whole profile form, which is the screen for changing an answer");
  // ⚠️ ONE ENTRY POINT. It was reachable only from the first-run welcome; two copies of (reset draft,
  // reset wizStep, reset wizErr, set the screen) is how the second route starts half way through
  // somebody else's answers.
  const app = nocomment(appBlock());
  const setters = [...app.matchAll(/state\.screen = "wizard"/g)].length;
  assert.equal(setters, 1, "state.screen = \"wizard\" is set in " + setters + " places, expected 1");
  assert.match(nocomment(fn("startWizard")), /draft = \{\}[\s\S]{0,120}state\.wizStep = 0/,
    "startWizard does not clear the draft and the step together");
  // Driven: the step list, both ways round.
  // ⚠️ LIFT THE REAL FUNCTION WITH THE TWO GLOBALS IT READS, rather than re-implementing it. It reads
  // `profile.personalized` and `draft.status` and calls isBeginnerStatus, so those are what the harness
  // supplies -- a hand-written copy would agree with itself and prove nothing about the shipped one.
  const mkIds = (personalized: boolean, status: string): string[] => {
    const src = "let profile = { personalized: P }; let draft = { status: S };"
      + "function isBeginnerStatus(x) { return x === 'new' || x === 'building'; }"
      + fn("wizStepIds") + "; return wizStepIds();";
    return new Function("P", "S", src)(personalized, status) as string[];
  };
  assert.ok(!mkIds(true, "regular").includes("you"),
    "a runner who already has a name is asked for it again when starting a new plan");
  assert.ok(mkIds(false, "regular").includes("you"),
    "a genuine first run no longer asks for a name at all");
  assert.equal(mkIds(true, "regular")[0], "level", "the new-plan wizard does not open on the level step");
  // Every step a personalised runner sees is a step a first-run runner sees: skipping must only REMOVE.
  const extra = mkIds(true, "regular").filter((x) => !mkIds(false, "regular").includes(x));
  assert.deepEqual(extra, [], "skipping the name step invented steps: " + extra.join(", "));
});

test("BLOCKER: every plan shield is a different colour, keyed on the plan and not on its position", () => {
  const app = appBlock();
  // ⚠️ THIS REVERSES A REASON WRITTEN IN THIS FILE, on the owner's instruction. The guard exists so a
  // cold session does not revert it to grey on the strength of the old comment.
  assert.match(nocomment(fn("planHue")), /isLive\) return "var\(--accent\)"/,
    "the active plan is not always the accent, so which plan you are on stops being readable");
  const hues = (/const PLAN_HUES = \[([^\]]*)\]/.exec(app) || [, ""])[1]!;
  assert.ok(hues.split(",").filter((x) => x.trim()).length >= 4,
    "there are too few hues for the plans to look different");
  assert.ok(!hues.includes("--accent"), "a past plan can wear the active plan's colour");
  // ⚠️ --eff-* ARE NOT IN THIS PALETTE. Those four answer one question through one table (ruling 7) and
  // a shield wearing one would state a session effort that is not there.
  assert.ok(!/--eff-/.test(hues), "the shield palette borrows the session-effort colours");
  // ⚠️ KEYED ON THE SIGNATURE, NEVER THE INDEX. Delete one plan and every colour below it would shift,
  // so the shield a runner had learned to recognise would become somebody else's.
  const ph = nocomment(fn("planHue"));
  assert.match(ph, /j\.sig/, "the colour is not derived from the plan's own signature");
  for (const bad of ["index", "idx", "rows.indexOf", "arguments[1]"])
    assert.ok(!ph.includes(bad), "the colour is derived from " + bad + ", which shifts when a plan is deleted");
  // Driven: stable, spread, and unaffected by what is around it.
  // ⚠️ THE TYPE GOES ON THE const, NOT IN A TRAILING `as` ON THE NEXT LINE. TypeScript ends the
  // statement at the newline and then parses `as (` as a call, which fails with "',' expected".
  const hue: (j: { sig: string }, live: boolean) => string =
    new Function("const PLAN_HUES = [" + hues + "];\n" + fn("planHue") + "; return planHue;")();
  const seen = new Set<string>();
  for (let i = 0; i < 40; i++) seen.add(hue({ sig: "plan-" + i + "-xyz" }, false));
  assert.ok(seen.size >= 4, "40 plans produced only " + seen.size + " distinct shields");
  assert.equal(hue({ sig: "abc" }, false), hue({ sig: "abc" }, false), "the same plan is not a stable colour");
  assert.equal(hue({ sig: "abc" }, true), "var(--accent)", "the active plan is not the accent");
  // ⚠️ THE INK IS WHITE ON A FIXED DARK BASE, which is the only treatment that carries six hues. The
  // old one painted var(--accent-ink) on the raw token, and --accent-ink flips with the theme while the
  // tokens get lighter in dark -- so darkening to fix light mode breaks dark mode. Measured on the
  // gradient's lightest end: light 2.76 (ease) / 2.94 (build) / 3.16 (base) against a 4.5 floor.
  const badge = rule(".rp-badge");
  assert.match(badge, /color:\s*#fff/, "the shield's numerals are not white, so a six-hue set cannot clear the floor");
  assert.ok(!/var\(--accent-ink\)/.test(badge), "the shield is back on --accent-ink, which flips with the theme");
  // ⚠️ NOT `var\(--pc[^)]*\)`: --pc is written with a fallback, `var(--pc, var(--accent))`, so a
  // negated-) class stops inside it. Anchored on the two things that carry the meaning -- the weight
  // and the fixed base -- with the token named separately.
  assert.match(badge, /color-mix\(in srgb, var\(--pc,[\s\S]{0,30}55%, #0a1a16\)/,
    "the shield's ground is not mixed into a fixed dark base at the measured weight");
  assert.match(badge, /30%, #0a1a16\)/, "the shield's gradient has no darker end");
});
