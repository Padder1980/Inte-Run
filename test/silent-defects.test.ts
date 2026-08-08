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

/** Just the stylesheet — matching the whole document would sweep up inline styles in the markup. */
function sheetOf(html: string): string {
  const a = html.indexOf("<style>"), b = html.indexOf("</style>");
  assert.ok(a >= 0 && b > a, "no style block in the build");
  return html.slice(a, b);
}

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
  // ⚠️ There were TWO of them in one line: the click binder and the aria-pressed sweep beside it.
  // ⚠️ AND THE INVARIANT IS "NEVER FROM document", NOT "always via a #chart selector string" — the
  // first version of this guard counted selector strings, so scoping via the chart ELEMENT instead
  // (chart.querySelectorAll(...), which is stricter) failed it. A guard that rejects a better fix
  // than the one it was written against is a guard that gets deleted.
  const fromDocument = html.match(/document\.querySelectorAll\(\s*["'`]\[data-wk\]["'`]\s*\)/g) || [];
  assert.deepEqual(fromDocument, [],
    "an unscoped [data-wk] query from document will capture the workout library rows too");
  // Every reader must be scoped to the chart, one way or the other.
  // Match the RECEIVER too, or "chart.querySelectorAll(...)" is indistinguishable from a bare one.
  const readers = html.match(/[A-Za-z_$][\w$]*\.querySelectorAll\(\s*["'`][^"'`]*\[data-wk\][^"'`]*["'`]\s*\)/g) || [];
  assert.ok(readers.length >= 2, "nothing reads the chart bars any more: " + readers.length);
  for (const r of readers) {
    assert.ok(/#chart |#sheetBody /.test(r) || /^chart\./.test(r),
      "an unscoped [data-wk] reader: " + r);
  }
  const anyChartScoped = (html.match(/chart\.querySelectorAll\(\s*["'`]\[data-wk\]["'`]/g) || []).length
    + (html.match(/querySelectorAll\("#chart \[data-wk\]"\)/g) || []).length;
  assert.ok(anyChartScoped >= 2, "both the click binder and the aria-pressed sweep must be scoped to the chart");
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

test("⚠️ the logbook's week starts on a Monday, in every timezone and every week of the year", () => {
  // ⚠️ new Date(iso + "T00:00:00") has no Z, so it parses as LOCAL midnight — and calling
  // toISOString() on that hands back the PREVIOUS day for the whole of British Summer Time. The
  // first version of logWeekStartIso did exactly that, which put the week boundary one day early
  // for half the year: on a Monday the "this week" total silently included Sunday's long run. The
  // biggest run of the week, so the figure would have looked plausible almost every time.
  const html = page();
  const at = html.indexOf("function logWeekStartIso(");
  assert.ok(at > 0, "logWeekStartIso is gone");
  const src = html.slice(at, html.indexOf("\nfunction ", at + 10));
  const isoAdd = (iso: string, days: number) => {
    const p = String(iso).split("-").map(Number);
    const dt = new Date(Date.UTC(p[0]!, (p[1] || 1) - 1, p[2] || 1));
    dt.setUTCDate(dt.getUTCDate() + days);
    return dt;
  };
  // ⚠️ A SWEEP, NOT A FIXTURE. One date passes under the bug for five days in seven, and passes
  // always outside summer time — which is exactly how it would have reached a runner.
  for (let i = 0; i < 400; i++) {
    const t = new Date(Date.UTC(2026, 0, 1 + i)).toISOString().slice(0, 10);
    const f = new Function("todayIso", "isoAdd", src + "\nreturn logWeekStartIso;")(() => t, isoAdd);
    const ws = f() as string;
    assert.equal(new Date(ws + "T00:00:00Z").getUTCDay(), 1, "week start is not a Monday: " + t + " -> " + ws);
    assert.ok(ws <= t, "the week starts in the future: " + t + " -> " + ws);
    assert.ok(isoAdd(ws, 7).toISOString().slice(0, 10) > t, "today is not inside its own week: " + t + " -> " + ws);
  }
});

test("⚠️ the logbook addresses a run by id, never by its position in the list", () => {
  // The index was already "not a handle" — state.logged is unshifted whenever a watch run arrives.
  // Filtering breaks it a SECOND way: position in the rendered list stops matching position in the
  // array. Deleting run 3 of a filtered list would delete run 3 of the whole store.
  const html = page().replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.ok(!/data-runidx="/.test(html), "a run row still carries its array index as its handle");
  assert.match(html, /data-runid="/, "run rows carry no id");
  assert.match(html, /deleteRunById\(b\.dataset\.delrun\)/, "delete still resolves by position");
  // Every run must HAVE an id, including ones logged before ids existed.
  assert.match(html, /if \(!r\.id\) \{ r\.id = /, "old runs are never given an id, so they cannot be addressed");
});

test("⚠️ consistency is measured against runs actually logged, never against state.done", () => {
  // seedDone() rebuilds state.done at every boot by marking every non-rest session dated before
  // today as done, whether or not anybody ran it. A consistency figure taken from it would read
  // 100% for a runner who has not run at all — praise for nothing, which this app has a rule against.
  const html = page();
  const at = html.indexOf("function logConsistency(");
  assert.ok(at > 0, "logConsistency is gone");
  const fn = html.slice(at, html.indexOf("\nfunction ", at + 10));
  assert.ok(!fn.includes("state.done"), "consistency is computed from state.done, which is not evidence");
  assert.match(fn, /state\.logged/, "consistency does not look at logged runs");
  assert.match(fn, /RAW\.weeks/, "the prescription is not read from RAW.weeks");
  assert.ok(!fn.includes("PLAN.weeks[CURRENT_WEEK].sessions"),
    "the prescription is read from PLAN.weeks, which is a display summary with no session detail");
  // ⚠️ It must not count days that have not happened yet, or every week reads as a failure until Sunday.
  assert.match(fn, /if \(iso > todayIso\(\)\) break;/, "future days of this week are counted as missed");
});

test("⚠️ every emitted <script> block actually parses", () => {
  // ⚠️ THIS EXISTED ONLY AS A MANUAL STEP, AND THE MANUAL STEP GETS SKIPPED. CLAUDE.md documents
  // running node --check over the generated blocks after any runtime-JS edit, precisely because
  // `node web/app.ts` only builds the OUTER template literal: a broken string inside it produces a
  // file that builds cleanly, typechecks cleanly, passes every other test, and then dies silently in
  // the browser with a blank screen. It happened again while writing this file — 451 tests green
  // against an app that would not boot. A check nobody can forget is worth more than a documented one.
  const html = page();
  const blocks = html.match(/<script>([\s\S]*?)<\/script>/g) || [];
  assert.ok(blocks.length >= 2, "no inline scripts found — this test no longer proves anything");
  for (let i = 0; i < blocks.length; i++) {
    const src = blocks[i]!.replace(/^<script>/, "").replace(/<\/script>$/, "");
    // new Function throws a SyntaxError on exactly what node --check catches, without executing it.
    assert.doesNotThrow(() => new Function(src),
      "script block " + i + " does not parse — the app will be blank with no console error");
  }
});

test("⚠️ Alfie says what it is BEFORE the first question, and outside the log", () => {
  // Exit criterion: "Ask Alfie's limits are visible before the first question." It failed on every
  // entry point — the bubble, the Support card and the Guides button all landed on a greeting and
  // an input, with the only "not medical" sentence buried inside the answer to "who are you".
  const html = page();
  const view = fnSrc("viewAlfie");
  assert.match(view, /alfieLimits\(\)/, "viewAlfie does not show the limits");
  // ⚠️ ABOVE THE LOG, NOT INSIDE IT. alfieRenderLog() rebuilds #alfieLog's innerHTML on every
  // message, so a label placed in there is destroyed by the first question — the precise moment the
  // criterion is about.
  assert.ok(view.indexOf("alfieLimits()") < view.indexOf('id="alfieLog"'),
    "the limits are rendered after the log, so the first answer scrolls them away");
  const lim = fnSrc("alfieLimits");
  assert.match(lim, /not medical advice/i, "there is no 'not medical' label");
  assert.match(lim, /AI coach/i, "it never says it is an AI");
  assert.match(lim, /not a doctor or a physiotherapist/i, "it never says what it cannot do");
  // ⚠️ THE ESCALATION ROUTE IS A BUTTON, NOT A SENTENCE. The screener was reachable only by typing a
  // symptom AT Alfie and having it matched; a worried runner could not go and find it.
  assert.match(lim, /id="alfEsc"/, "there is no way to reach the symptom check-in from Alfie");
  assert.match(html, /alfEsc.*state\.support = "redflags"/s, "the escalation button goes nowhere");
});

test("⚠️ every health check-in says what happens to the answers, and says it truthfully", () => {
  const html = page();
  const con = fnSrc("checkinConsent");
  // ⚠️ THE WORDING HAD TO BE CHECKED AGAINST THE CODE. chkValues() reads the boxes straight out of
  // the DOM and nothing writes them anywhere, so "saved on this device" would have been FALSE. A
  // consent line that overstates what is kept is worse than none — it is the sentence a worried
  // runner reads most carefully.
  assert.ok(!/saved|stored on|we keep|remembered/i.test(con),
    "the consent copy claims the answers are kept, and they are not");
  assert.match(con, /stay on this phone/i, "it does not say where the answers stay");
  assert.match(con, /nothing is kept/i, "it does not say the answers are not kept");
  for (const view of ["redflagsView", "redsView", "femaleView"]) {
    const fn = fnSrc(view);
    assert.match(fn, /checkinConsent\(\)/, view + " has no consent copy");
    // Every screener carries the emergency route, not just the injury one — somebody arrives at the
    // fuelling or women's-health check-in in exactly the same state of worry.
    assert.ok(/promise|EMERGENCY_BANNER\(\)/.test(fn), view + " has no emergency route");
  }
});

test("⚠️ the Support hub is grouped, and grouping cannot silently drop a card", () => {
  const html = page();
  // Anchored on viewSupport itself, not on the next named function — the search builders landed
  // between the two and stretched the old window past what it was measuring.
  const fn = html.slice(html.indexOf("const SUPPORT_GROUPS"), html.indexOf("\nfunction supportDetail("));
  assert.ok(fn.length > 0 && fn.length < 5200, "the viewSupport slice window is wrong: " + fn.length);
  for (const g of ["Coaching", "Health and safety", "Your setup"]) {
    assert.ok(fn.includes('"' + g + '"'), "no " + g + " group");
  }
  // ⚠️ AN UNGROUPED CARD MUST STILL APPEAR. A hub that silently drops an entry somebody adds later
  // is worse than a flat one, because nothing looks wrong.
  assert.match(fn, /placed\[h\.id\]/, "cards not named in a group are dropped");
  assert.match(fn, /"More"/, "there is no home for an ungrouped card");
  // The health check-ins must not be last: somebody arrives there worried and in a hurry.
  const groups = fn.slice(fn.indexOf("SUPPORT_GROUPS"));
  assert.ok(groups.indexOf('"Health and safety"') < groups.indexOf('"Your setup"'),
    "the health check-ins sit below the housekeeping");
});

test("⚠️ a profile edit previews before it rebuilds, and the preview commits nothing", () => {
  // The brief's clearest safety recommendation. Saving used to rebuild every week, clear the day's
  // ticks, drop every session the runner had moved and push the new schedule to iOS and the watch —
  // on one tap, with no warning and nothing to go back to.
  const html = page();
  const imp = fnSrc("profileImpact");
  // ⚠️ applyProfile IS PURE; adoptPlan/recompute COMMIT — and adoptPlan fires syncNativeReminders()
  // and syncWatch() inside try/catch. Building a preview with the familiar helper would push a plan
  // the runner has not accepted to the notification scheduler and to the wrist, where it becomes
  // what the watch runs from when it stands alone. Nothing would throw; nothing would look different.
  assert.match(imp, /applyProfile\(pf\)/, "the preview does not build a candidate plan");
  assert.ok(!/adoptPlan|recompute\(/.test(imp), "the preview COMMITS the plan it is meant to preview");
  // The reschedules seedDone would silently drop must be counted and named before it happens.
  assert.match(imp, /state\.dayOverride/, "the preview never mentions the runner's own reschedules");

  const save = html.slice(html.indexOf("function doSaveProfile("), html.indexOf("function doSaveProfile(") + 3000)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  assert.match(save, /if \(imp && !PROFILE_CONFIRMED\) \{ openProfilePreview/,
    "saving does not go through the preview");
  // ⚠️ ONE-SHOT. Left set, the NEXT edit saves silently — the exact behaviour this removes,
  // reintroduced by a variable nobody would think to look at.
  assert.match(save, /PROFILE_CONFIRMED = false;/, "the confirm flag is never cleared");
});

test("⚠️ undo puts back everything the rebuild destroys, not just the profile", () => {
  const html = page();
  // ⚠️ COMMENTS STRIPPED, because the comment explaining the fix names seedDone() — so an
  // ordering assertion measured against the raw text finds the WORD before the CALL and fails on
  // correct code. Fourth outing of that trap in this file; it is why fnSrc strips them.
  const save = html.slice(html.indexOf("function doSaveProfile("), html.indexOf("function doSaveProfile(") + 4000)
    .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  // ⚠️ SNAPSHOT BEFORE THE REBUILD. seedDone() prunes state.dayOverride and PERSISTS the prune, so
  // by the time a toast appears the reschedules are already gone from disk. An undo restoring only
  // the profile — the obvious implementation, and the one the toastUndo precedent models — hands
  // back a plan with the runner's own moves deleted, on a screen they were not looking at.
  const snap = save.indexOf("undoSnap = {");
  const seed = save.indexOf("seedDone()");
  assert.ok(snap > 0, "nothing is snapshotted for undo");
  assert.ok(snap < seed, "the snapshot is taken AFTER seedDone has already pruned the reschedules");
  for (const field of ["profile:", "dayOverride:", "ticks:"]) {
    assert.ok(save.slice(snap, snap + 400).includes(field), "undo does not capture " + field);
  }
  assert.match(save, /state\.dayOverride = undoSnap\.dayOverride; saveDayOverride\(\)/,
    "undo does not restore the reschedules to disk");
  assert.match(save, /restoreTicks\(undoSnap\.ticks\)/, "undo does not restore today's ticks");
  assert.match(save, /recompute\(\); computeToday\(\)/,
    "undo does not rebuild, so iOS and the watch keep the plan the runner just rejected");
  // ⚠️ AND THE FORWARD PATH HAD THE SAME HOLE. doSaveProfile was the ONE rebuild path that never
  // bracketed seedDone with todayTicks/restoreTicks, so editing your profile silently un-ticked the
  // run you had already done today.
  assert.match(save, /const keptTicks = todayTicks\(\)/, "the forward save does not keep today's ticks");
  assert.match(save, /seedDone\(\); restoreTicks\(keptTicks\)/, "the forward save does not restore them");
});

test("⚠️ no handler reaches for an element id that does not exist", () => {
  // The confirm button first clicked "#saveSetup", which is nowhere in the app. It built, typechecked
  // and passed every test, and the button silently did nothing — this codebase's documented
  // invented-identifier trap, third outing.
  // ⚠️ NOT COMMENT-STRIPPED, DELIBERATELY. The obvious fix when this tripped on a comment in the app
  // containing the literal dollar-paren-"id" was to strip comments first — and a regex doing that
  // over 1.6 MB of generated page ate real markup and reported sixteen live ids as missing, which is
  // far worse than the false positive it was fixing. The app's comment was reworded instead.
  const html = page();
  const ids = new Set<string>();
  for (const m of html.matchAll(/id="([A-Za-z][\w-]*)"/g)) ids.add(m[1]!);
  const refs = new Set<string>();
  for (const m of html.matchAll(/\$\("([A-Za-z][\w-]*)"\)/g)) refs.add(m[1]!);
  // ⚠️ THE INVARIANT IS "SOMETHING PRODUCES IT", NOT "IT APPEARS AS A LITERAL id=". Several real ids
  // are built by string concatenation — uiActionBar's `id` option, uiDecisionHero's `actionId`, the
  // live-metric builder — so a literal-only check rejects correct code, and the first version of this
  // guard did exactly that and had to carry a hand-written exemption list. A list like that goes
  // stale the first time somebody adds a builder, and then it gets deleted rather than updated.
  // An id that is PASSED to a builder still appears as a quoted string somewhere; an invented one
  // (the "#saveSetup" that started this) appears only inside its own failed lookup.
  const produced = new Set(ids);
  for (const m of html.matchAll(/["']([A-Za-z][\w-]*)["']/g)) {
    // Only count it as "produced" if the quoted string occurs somewhere OTHER than a $() lookup.
    const before = html.slice(Math.max(0, m.index! - 2), m.index!);
    if (before !== '$(') produced.add(m[1]!);
  }
  // readySlot is the documented landmine: guarded, deliberately kept, and covered by its own test.
  const missing = [...refs].filter((r) => !produced.has(r) && r !== "readySlot");
  assert.deepEqual(missing, [], "these ids are looked up but nothing ever produces them: " + missing.join(", "));
});

test("⚠️ every performance insight carries its provenance", () => {
  // "Every performance insight gains provenance: what it means, what it is based on, how fresh it is,
  // and one next action." Before this the screen was three numbers with no source, no date and no
  // uncertainty — and ALL of it was already computed and thrown away.
  const html = page();
  const view = fnSrc("viewPerformance");
  const ins = fnSrc("perfInsight");
  const ev = fnSrc("perfEvidence");

  assert.match(ins, /perfEvidence\(est\)/, "an insight is rendered without its evidence");
  assert.match(ev, /Based on /, "the evidence never says what it is based on");
  // ⚠️ FRESHNESS. All three dimensions come from ONE input, so the meter labelled "endurance base"
  // only ever moves when that input changes, however much training has happened. A number with no
  // date reads as a measurement of today.
  assert.match(ev, /src\.when/, "the evidence never dates its input");
  assert.match(ev, /no date recorded/, "an undated input is not admitted as undated");
  // ⚠️ CONFIDENCE IN WORDS, not by colour. RC.rangeText and every Estimate's .low/.high/.confidence
  // were computed on every render and had zero readers.
  assert.match(ins, /Low confidence/, "low confidence is not stated in words");
  assert.match(ins, /o\.range/, "the range is never shown, so a point estimate reads as fact");
  assert.match(view, /RC\.rangeText\(/, "rangeText still has no callers");
  assert.match(view, /actionId: "perfTrial"/, "there is no next action");
  assert.match(html, /perfTrial.*startTrialFlow/s, "the action button goes nowhere");

  // ⚠️ A SEEDED ANCHOR IS NOT EVIDENCE. buildProfileFromDraft seeds a 5 km time for a beginner and
  // sets noRecent — a time nobody ran. This app already refuses to raise adaptive flags off a seeded
  // anchor; printing a fitness estimate from one as measured is the same mistake elsewhere.
  const src = fnSrc("perfSource");
  assert.match(src, /profile\.noRecent/, "a seeded anchor is treated as a real result");
  assert.match(src, /seeded: true/, "nothing marks an estimate as unmeasured");
  assert.match(ev, /not something you have run/, "a seeded estimate never says so");

  // ⚠️ THE THIRD DIMENSION IS PERMANENTLY EMPTY. durability.confidence is always "none" because
  // nothing computes it. The old copy promised "we'll learn this from your long runs" — a promise the
  // app never keeps. An empty state that admits what is missing is honest; one that promises is not.
  assert.ok(!/learn this from your long runs/i.test(html), "the durability card still promises");
  assert.match(view, /tone: "unavailable"/, "the empty dimension does not use the unavailable state");
  assert.match(view, /no method behind it yet/, "the empty state does not say WHY it is empty");
  // FITNESS.summary is the engine's own honest one-liner and was rendered nowhere.
  assert.match(view, /FITNESS\.summary/, "the engine's own provenance line is still discarded");
});

test("⚠️ Support search reads the articles' bodies, not just their titles", () => {
  // The owner ruled this BUILD IT, not a placeholder: "the articles are markup in the build; a
  // client-side index over them needs no backend."
  const fn = fnSrc("supportSearch");
  // ⚠️ THE BODY IS THE POINT. Somebody typing "gel" or "shin splints" is not looking for an article
  // called that — they want the paragraph that mentions it. A title-only search returns nothing and
  // teaches them the search does not work.
  assert.match(fn, /g\.b\.join/, "the search never looks inside an article");
  assert.match(fn, /SUPPORT_HUB/, "the search does not cover the help screens");
  assert.match(fn, /rank/, "title matches are not ranked above body matches");
  assert.match(fn, /needle\.length < 2/, "a single character searches the whole corpus");

  const view = fnSrc("supportSearchHtml");
  // ⚠️ A focusable field must be >= 16px or iOS auto-zooms on focus, and pinch is deliberately
  // disabled so the runner can never zoom back out. --t-card is 17px: on the type ladder AND above
  // the floor, so it satisfies both without widening the ladder to admit 16px everywhere.
  const css = sheetOf(page());
  assert.match(css, /\.sup-search input \{[^}]*font-size: var\(--t-card\)/,
    "the search field's size is not on the ladder and above the iOS zoom floor");
  assert.match(view, /Nothing matches/, "there is no empty state");
  assert.match(view, /supAskAlfie/, "the empty state offers no way forward");

  // ⚠️ The icon must EXIST. ICON.search did not, so `(ICON.search || "")` rendered an empty slot in
  // silence — the same shape as every other invented-identifier bug in this file.
  const html = page();
  assert.match(html, /\bsearch: '<svg/, "ICON.search is not defined, so the field shows a blank slot");

  // ⚠️ While searching, the groups are HIDDEN, not filtered. A grid that quietly loses eight of its
  // eleven tiles reads as the app having lost them.
  const vs = fnSrc("viewSupport");
  assert.match(vs, /if \(\(state\.supportQ \|\| ""\)\.trim\(\)\) return supportSearchHtml\(\)/,
    "the hub is filtered rather than replaced while searching");

  // A guide is named by its slug, so a search result can open the right one.
  const gv = fnSrc("guidesView");
  assert.ok(!/data-gd="' \+ i \+ '"/.test(gv), "a guide is still keyed on its array index");
  assert.match(gv, /data-gd="' \+ esc\(g\.k\)/, "a guide carries no stable name");
  assert.match(gv, /state\.openGuide === g\.k/, "a search result cannot open its article");
});

test("⚠️ every form label names its own field, and there is a main landmark", () => {
  const html = page();
  // ⚠️ THIRTEEN LABELS WERE FLOATING. The setup form is built as
  // <div class="q"><label>Age</label><select id="s_age">…</select></div> — a label that is a SIBLING
  // of its field with no "for", so a screen reader announces an unlabelled combo box. It is the most
  // form-heavy screen in the app and the first one a runner meets.
  const fn = fnSrc("linkFormLabels");
  assert.match(fn, /lab\.setAttribute\("for", f\.id\)/, "labels are never connected to their fields");
  // ⚠️ FOUR GROUP SHAPES, NOT ONE. Segmented controls, checkbox lists, the status-card grid and the
  // coach picker are all "one label naming several controls". A selector listing only the first two
  // left the two biggest questions on the screen — what kind of runner you are, and which coach
  // speaks to you — announced as unlabelled buttons.
  for (const cls of [".seg", ".opts", ".statuscards", ".coachsel"]) {
    assert.ok(fn.includes(cls), "the group-label pass does not cover " + cls);
  }
  // ⚠️ DONE AT RUNTIME, and re-run wherever form markup is REPLACED — the goal block is rebuilt
  // after wire() has run, which is why its three fields stayed unnamed while the static ones above
  // them were fixed.
  assert.ok((html.match(/linkFormLabels\(\)/g) || []).length >= 3,
    "linkFormLabels is not re-run after the form is rebuilt");
  assert.match(html, /gb\.innerHTML = goalCardInner\(st, cur\);\s*(\/\/[^\n]*\n\s*)*linkFormLabels\(\)/,
    "the goal block is rebuilt without re-linking its labels");
  // The hidden file input can never take a visible label, so it carries its own.
  assert.match(html, /id="s_avatar_file"[^>]*aria-label=/, "the avatar file input has no accessible name");
  // A screen reader needs somewhere to skip to.
  assert.match(html, /<main class="view" id="view">/, "there is no main landmark");
});

test("⚠️ small controls still offer a 44px hit area", () => {
  // --tap is the design system's minimum. Measured, these all sat under it: the top-bar icon buttons
  // (36px), the back button (20), Alfie's chips (35), the logbook filters (34), a calendar tick (24)
  // and the profile's segmented buttons (38).
  const css = sheetOf(page());
  // ⚠️ THE HIT AREA GROWS, NOT THE BOX. Growing the boxes would relayout the top bar and every
  // segmented control; a pseudo-element leaves the design exactly as drawn.
  assert.match(css, /\.iconbtn::after[\s\S]{0,400}?min-height: var\(--tap\)/,
    "small controls have no expanded hit area");
  for (const sel of [".backbtn::after", ".seg button::after", ".lb-f::after", ".cal-check::after"]) {
    assert.ok(css.includes(sel), sel + " has no expanded hit area");
  }
});

test("⚠️ the type ladder scales with the reader's own text-size setting", () => {
  const css = sheetOf(page());
  // ⚠️ THE LADDER IS THE SCALING MECHANISM, and that is the point of having had one. Every size in
  // this app is px, so it honoured the phone's text-size setting NOWHERE — and making 443 individual
  // font sizes responsive is exactly the "looks mechanical" sweep this project's history says goes
  // wrong. Scaling the seven TOKENS means every screen already on the ladder scales for free, and
  // gives the off-ladder ratchet a second meaning: an off-ladder value is one that does not grow.
  for (const t of ["--t-display", "--t-hero", "--t-section", "--t-card", "--t-body", "--t-meta", "--t-label"]) {
    assert.match(css, new RegExp(t + ": calc\\([0-9.]+px \\* var\\(--tscale\\)\\)"),
      t + " is a fixed size, so it cannot follow the reader's setting");
  }
  assert.match(css, /--tscale: 1;/, "there is no default scale, so the ladder resolves to nothing");

  const fn = fnSrc("syncTextScale");
  // ⚠️ font: -apple-system-body IS THE ONLY THING THAT TRACKS DYNAMIC TYPE INSIDE A WKWebView.
  // rem follows the page, not the phone, and there is no API to ask.
  assert.match(fn, /-apple-system-body/, "nothing measures the reader's actual setting");
  // ⚠️ CLAMPED, and never below 1: this app is full of fixed-height controls, so an unclamped 235%
  // overlaps them rather than reflowing, and a runner who shrank their type should still get the
  // design as drawn. A partial improvement beats a broken layout at the largest setting.
  assert.match(fn, /Math\.max\(1, Math\.min\(1\.3, raw\)\)/, "the scale is unclamped or can shrink text");
  // ⚠️ iOS never tells a web view the setting changed, so returning to the app is the only chance.
  assert.match(page(), /visibilitychange[^\n]*syncTextScale\(\)/,
    "the scale is read once at boot and never again");
});

test("⚠️ a screen arrives in one motion, and the haptic goes through the bridge", () => {
  const css = sheetOf(page());
  // The brief asks for 160-220ms content-preserving transitions.
  const dur = Number((css.match(/\.view-in \{ animation: viewIn \.([0-9]+)s/) || [])[1]);
  assert.ok(dur >= 16 && dur <= 22, "the view transition is outside 160-220ms: ." + dur + "s");
  // ⚠️ CONTENT-PRESERVING: it fades and rises 4px. No slide, no scale, nothing that reflows — text
  // stays legible throughout rather than arriving from off-screen.
  assert.match(css, /@keyframes viewIn \{ from \{ opacity: 0; transform: translateY\(4px\)/,
    "the transition moves content the runner is trying to read");
  // ⚠️ THE CLASS IS REMOVED, A REFLOW READ, THEN ADDED. Without that a second render inside the
  // window finds the class present, the animation does not restart, and the screen just appears —
  // which is most tab switches, because render() is called from many paths.
  const fn = fnSrc("viewEnter");
  assert.match(fn, /classList\.remove\("view-in"\);\s*void v\.offsetWidth;\s*v\.classList\.add\("view-in"\)/,
    "the animation will not restart on a second render");

  // ⚠️ WKWebView HAS NO navigator.vibrate AT ALL, so calling it raw is silent in the native app —
  // which is where the runner actually is. haptic() is the only path that reaches a real generator.
  const html = page().replace(/\/\*[\s\S]*?\*\//g, "");
  const raw = (html.match(/navigator\.vibrate\(/g) || []).length;
  assert.equal(raw, 1, "navigator.vibrate is called outside haptic(), so it is silent in the app");
});
