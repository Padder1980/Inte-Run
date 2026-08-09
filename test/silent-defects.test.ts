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

test("⚠️ the Support hub matches the mockup, and cannot silently drop a card", () => {
  const html = page();
  const fn = fnSrc("viewSupport");
  // Alfie is a feature card, not a tile in a grid — it is what most visits want.
  assert.match(fn, /alf-feat/, "Alfie is not the feature card the mockup shows");
  // ⚠️ THE "NOT MEDICAL" LABEL IS ON THE CARD, not only behind it. It used to live inside the Alfie
  // screen, so it was visible only once you had already decided to go and ask it something.
  assert.match(fn, /AI coach \\u00b7 not medical|AI coach · not medical/,
    "the hub card does not say Alfie is an AI and not medical");
  // ⚠️ "Not a diagnosis" sits at SECTION level — true of all three check-ins, and repeating it on
  // each card makes it wallpaper.
  assert.match(fn, /Private check-ins/, "the check-ins are not grouped together");
  assert.match(fn, /Not a diagnosis/, "the check-ins carry no scope caveat");
  assert.match(fn, /Learn/, "there is no Learn section");
  assert.match(fn, /hub-safety/, "there is no safety and privacy destination");

  // ⚠️ NOTHING MAY BE SILENTLY DROPPED. Every hub id must be reachable from this screen or from the
  // Profile page it moved to — a card that quietly disappears in a restructure is the failure mode
  // nobody notices, because nothing looks wrong.
  const ids = [...html.matchAll(/\{ id: "([a-z]+)", ic:/g)].map((m) => m[1]!);
  assert.ok(ids.length >= 10, "the hub list is not where this test thinks it is: " + ids.length);
  const listed = fnSrc("viewSupport") + html.slice(html.indexOf("const HUB_CHECKINS"), html.indexOf("function viewSupport("));
  const prof = fnSrc("viewProfile");
  // ⚠️ A card can be reachable via a SCOPED PROFILE EDIT too ("setup:why"), not only as a hub id.
  const missing = ids.filter((id) =>
    !listed.includes('"' + id + '"') && !prof.includes('"' + id + '"') && !prof.includes('setup:' + id));
  assert.deepEqual(missing, [],
    "these hub cards are reachable from nowhere after the restructure: " + missing.join(", "));

  // ⚠️ Shoes and devices MOVED to Profile > Connections — the brief always put them there, and
  // CLAUDE.md recorded the hub as their "honest interim home, not the intended one".
  assert.match(prof, /"shoes"/, "the shoe rack lost its home when it left the hub");
  assert.match(prof, /"connect"/, "apps and devices lost their home when they left the hub");
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

test("⚠️ the profile is a summary you can read, with the form behind it", () => {
  // "A profile should be scannable in seconds and make plan-changing edits feel safe, reversible and
  // explicit." The profile WAS the six-section setup form: the only way to check what your goal was
  // set to was to open every question you had ever answered, on the screen where a stray tap on Save
  // rebuilds your plan. Reading and editing were the same act.
  const html = page();
  const fn = fnSrc("viewProfile");
  for (const sec of ["Training profile", "Connections", "Preferences", "Account"]) {
    assert.ok(fn.includes(sec), "the profile has no " + sec + " section");
  }
  for (const row of ["Goal", "Current fitness", "Training rhythm", "Current context"]) {
    assert.ok(fn.includes('label: "' + row + '"'), "no " + row + " row");
  }
  // ⚠️ THE FORM IS MOVED BEHIND IT, NOT REPLACED. Every question is still answered in the same place.
  // ⚠️ AND EACH ROW OPENS ITS OWN QUESTIONS. All four used to open the whole six-section form, which
  // is a summary row that has saved nobody anything. Every row must name a DISTINCT topic.
  const topics = [...fn.matchAll(/action: "setup:([a-z]+)"/g)].map((m) => m[1]!);
  // ⚠️ DISTINCT, not a fixed count — the count was 4 and became 5 the moment voice coaching gained a
  // row, and a guard that fails on a legitimate addition is a guard somebody deletes.
  for (const t of ["goal", "fitness", "rhythm", "context"]) {
    assert.ok(topics.includes(t), "no scoped edit for " + t);
  }
  assert.equal(new Set(topics).size, topics.length, "two rows open the same questions: " + topics.join(","));
  assert.match(fn, /data-pf="setup"/, "the section Edit link no longer opens every question");
  const map = fnSrc("applySetupFocus");
  const defs = html.slice(html.indexOf("const SETUP_TOPICS"), html.indexOf("function applySetupFocus"));
  for (const t of topics) assert.ok(defs.includes(t + ":"), "no questions defined for topic " + t);
  // ⚠️ HIDDEN, NOT OMITTED. draftFromForm() reads values straight out of the DOM, so a form that
  // genuinely left the other sections out would read them as blank and write those blanks over the
  // profile — editing your goal would erase your age, your long-run day and your stated mileage.
  assert.match(map, /classList\.add\("setup-off"\)/, "the focus pass removes fields instead of hiding them");
  assert.ok(!/\.remove\(\)|innerHTML = ""/.test(map), "the focus pass destroys fields the save path reads");
  assert.match(sheetOf(html), /\.setup-off \{ display: none !important; \}/,
    "hidden questions are not merely hidden, so their values may not be readable");
  // ⚠️ And it must say what is NOT on screen: one question above a button reading "Update my plan"
  // looks like it saves only that, when it saves everything exactly as it always did.
  assert.match(map, /Your other answers stay exactly as they are/, "the runner is not told the rest is untouched");
  // ⚠️ The focus must not outlive the visit, or the next Edit opens a single question.
  // ⚠️ Anchored on the fact, not on two lines being adjacent — saving from the overlay now branches
  // (back to the profile) or falls through (to the plan), so the two statements are no longer
  // neighbours. The invariant is that the focus is cleared, and that EVERY exit clears it.
  const saveFn = html.slice(html.indexOf("function doSaveProfile("), html.indexOf("function doSaveProfile(") + 4000);
  assert.match(saveFn, /state\.setupFocus = null;/, "the edit focus survives a save");
  assert.match(fnSrc("closeSheet"), /state\.setupFocus = null/,
    "dismissing the overlay leaves the form focused, so the next full Edit opens one question");
  assert.match(html, /profileBtn"\)\.onclick[^\n]*state\.screen = "profile"/,
    "the avatar still opens the raw form rather than the summary");

  // ⚠️ NO PREMIUM BADGE, THOUGH THE MOCKUP HAS ONE. The owner cut subscriptions — "thats not
  // something we are doing (yet)" — and CLAUDE.md says do not reinstate it from the mockup. A badge
  // for a tier that does not exist is a promise the app cannot keep.
  assert.ok(!/PREMIUM|Premium/.test(fn), "the profile advertises a subscription that does not exist");

  // ⚠️ A SEEDED FITNESS FIGURE MUST SAY SO. Printing a 5 km time nobody ran as "Current fitness" is
  // the app quoting a result back at somebody who never produced it, on the screen where they would
  // most reasonably believe it.
  const fit = fnSrc("profFitness");
  assert.match(fit, /profile\.noRecent \|\| profile\.autoPace/, "a seeded time is shown as a measurement");
  assert.match(fit, /Not measured yet/, "there is no honest value for an unmeasured runner");

  // ⚠️ EVERY DESTINATION ALREADY EXISTS — this page is a way in, not a set of new screens. Both of
  // these were INVENTED first time round ("toggleTheme", "openRemindSheet") and did nothing.
  assert.match(html, /openRemindersSheet\(\)/, "the notifications row goes nowhere");
  assert.ok(!/toggleTheme\(\)|openRemindSheet\(\)/.test(html), "a row calls a function that does not exist");
});

test("⚠️ the safety page states only what the code actually does", () => {
  // ⚠️ THIS IS THE EASIEST PAGE IN THE APP TO WRITE DISHONESTLY, because every sentence on it sounds
  // reassuring whether or not it is true — and it is the page somebody reads most carefully.
  const fn = fnSrc("safetyView");
  assert.match(fn, /not a doctor, a physiotherapist or a dietitian/i, "it never says what it is not");
  assert.match(fn, /not a diagnosis and cannot be one/i, "the check-ins are not scoped");
  assert.match(fn, /On this phone/, "it does not say where the data lives");
  // The check-ins genuinely keep nothing — chkValues reads the DOM and writes nowhere.
  assert.match(fn, /keep nothing at all/i, "it overstates or understates what the check-ins retain");
  // ⚠️ It must name the two things that DO leave the phone, or "nothing is sent anywhere" is false.
  assert.match(fn, /weather/i, "the weather request is not disclosed");
  assert.match(fn, /map tiles/i, "the map tile request is not disclosed");
  // ⚠️ And it must adapt if the runner has pointed Alfie at their own service.
  assert.match(fn, /alfieCfg\(\) \|\| \{\}\)\.proxy/, "the Alfie claim is fixed rather than read from config");
  assert.match(fn, /EMERGENCY_BANNER\(\)/, "the emergency route is missing from the safety page");
});

test("⚠️ the bottom-nav label and the screen heading are separate strings", () => {
  // ⚠️ TITLES feeds BOTH. Renaming Support to "Support & guidance" for the header truncated the tab
  // to "Support & gui…" — a tab label has about eight characters, a heading has a screen.
  const html = page();
  assert.match(html, /const NAV_LABEL = \{/, "the nav has no labels of its own");
  assert.match(html, /NAV_LABEL\[t\] \|\| TITLES\[t\]/, "the nav still derives its label from the heading");
  const nav = html.slice(html.indexOf("const NAV_LABEL"), html.indexOf("const NAV_LABEL") + 220);
  for (const m of nav.matchAll(/: "([^"]+)"/g)) {
    assert.ok(m[1]!.length <= 9, "the nav label \"" + m[1] + "\" is too long for a tab and will truncate");
  }
});

test("⚠️ the form's sections are the profile page's rows, under the same names", () => {
  // "All of the profile questions need ordering in such a way that they fit neatly under the new
  // sections." They did not: section 4 was "A few details" and held BOTH training rhythm and current
  // context, so the two profile rows either shared a screen or the split had to be invented per
  // question. A row that opens a section called something else makes the runner work out that they
  // are the same thing.
  const html = page();
  const setup = html.slice(html.indexOf("return savedMsg"), html.indexOf("function draftFromForm("));
  const order = [...setup.matchAll(/setupSection\(\d+, "([^"]+)"/g)].map((m) => m[1]!);
  for (const name of ["Current fitness", "Training rhythm", "Current context"]) {
    assert.ok(order.includes(name), "the form has no section called " + name);
  }
  assert.ok(!setup.includes('"A few details"'), "the catch-all section is still there");
  assert.match(setup, /Your goal/, "the goal section is gone");

  // ⚠️ CURRENT FITNESS MUST COME BEFORE THE GOAL, and that is a real dependency rather than taste:
  // GOAL_BY_STATUS gates which races are offered on the running status, and syncStatus rebuilds the
  // goal block from it. Asking somebody to pick a race before saying what kind of runner they are
  // means the options change under them.
  const fit = setup.indexOf('"Current fitness"'), goal = setup.indexOf("Your goal");
  assert.ok(fit > 0 && goal > 0 && fit < goal, "the goal is asked before the fitness that gates it");

  // Every row's topic must name a section that exists.
  const defs = html.slice(html.indexOf("const SETUP_TOPIC_TITLE"), html.indexOf("const SETUP_TOPIC_TITLE") + 400);
  for (const m of defs.matchAll(/: "([^"]+)"/g)) {
    const title = m[1]!;
    assert.ok(order.includes(title) || setup.includes(title),
      "a profile row opens \"" + title + "\", which is not a section in the form");
  }
});

test("⚠️ the profile photo is tappable, and back goes where you came from", () => {
  const html = page();
  const fn = fnSrc("viewProfile");
  // ⚠️ THE PICTURE WAS A DIV. It looks exactly like the thing you tap to change your photo — a photo,
  // in a circle, at the top of your profile — and it did nothing at all.
  assert.match(fn, /<button class="pf-av" data-pf="setup:you"/, "the profile photo is not tappable");
  assert.match(fn, /aria-label="Change your photo or name"/, "the photo button has no accessible name");
  const defs = html.slice(html.indexOf("const SETUP_TOPICS"), html.indexOf("function applySetupFocus"));
  assert.match(defs, /you: \["s_name", "s_avatar_file"\]/, "the You topic does not reach the photo picker");

  // ⚠️ BACK MEANS WHERE YOU CAME FROM. Apps & devices, Shoes, Your data and Safety are Support
  // screens, so opening one from the profile and pressing back dumped the runner into the Support
  // hub — a tab they had not been near.
  const det = fnSrc("supportDetail");
  assert.match(det, /state\.supportFrom === "profile"/, "the back button does not know where it came from");
  assert.match(det, /fromProfile \? "Profile" : "Support"/, "the back button always says Support");
  assert.match(html, /wasFrom === "profile"\) state\.screen = "profile"/, "back does not return to the profile");
  // ⚠️ …and arriving from the Support hub must CLEAR the origin, or a later back goes to the profile
  // from a screen the runner reached through Support.
  assert.match(html, /state\.support = b\.dataset\.hub; state\.supportFrom = null;/,
    "opening a hub card leaves a stale origin behind");
});

test("⚠️ a first-time runner cannot build a plan on questions they never answered", () => {
  const html = page();
  const fn = fnSrc("draftFromForm");
  // ⚠️ THE DRAFT WAS SEEDED FROM DEFAULT_PROFILE, so the two questions that shape the whole plan —
  // what kind of runner you are, and how many days a week you run — arrived already answered
  // ("Regular runner", "5 days"). Somebody who scrolled past them got a plan built for a runner they
  // had never claimed to be, with nothing on screen to say the app had decided for them.
  assert.match(fn, /!profile\.personalized/, "the check runs for everyone, not just a first run");
  assert.match(fn, /Before we can build your plan/, "there is no message naming what is missing");
  assert.match(fn, /!draft\.status/, "the running status can still be left unanswered");
  assert.match(fn, /!draft\.days/, "days per week can still be left unanswered");

  // The seeder must leave them EMPTY on a first run, or the check has nothing to catch.
  const seed = fnSrc("seedSetupDraft");
  assert.match(seed, /const first = !profile\.personalized/, "the seeder cannot tell a first run");
  assert.match(seed, /days: first \? "" :/, "days is pre-answered from the defaults");
  assert.match(seed, /status: first \? "" :/, "the running status is pre-answered from the defaults");
  // ⚠️ And both controls must render from the DRAFT, or they show a selection nobody made.
  assert.match(html, /statusCards\(draft\.status != null/, "the status cards render from the stored profile");
  assert.match(html, /draft\.days != null \? draft\.days/, "the days control renders from the stored profile");
});

test("⚠️ the Logbook summarises the period, then interprets it, then lists it", () => {
  const html = page();
  const snap = fnSrc("logbookSnapshot");
  // "Summarise the period before listing individual sessions." ⚠️ ONE PERIOD, NOT THREE COLUMNS OF
  // DIFFERENT PERIODS — the first version showed this week, this month and all-logged side by side,
  // which asks the reader to work out which one answers their question.
  assert.match(snap, /MON_FULL/, "the period is not named");
  assert.match(snap, /Consistency/, "there is no consistency figure");
  // The streak's own explanation moved into streakRow, which draws it as flames.
  const st = fnSrc("streakRow");
  assert.match(st, /in a row/, "the consistency number does not say what it counted");
  // ⚠️ ONE FLAME PER WEEK, and the number stays beside them so the picture can be checked.
  assert.match(st, /Array\(streak \+ 1\)\.join/, "the flames are not counted from the streak");
  assert.match(st, /streak <= 12/, "a thirty-week streak draws thirty flames, which is a smear");
  assert.match(st, /streak \+ \(streak === 1 \? " week" : " weeks"\)/, "the number is not shown beside the flames");
  // ⚠️ THE QUOTE IS EARNED — this app has a rule against praise that arrives whatever you did. A
  // single week is not a streak, and congratulating it is the empty praise the rule exists to prevent.
  assert.match(st, /if \(streak < 2\)/, "one week gets congratulated");
  // ⚠️ …and it is picked by week, not at random: this screen re-renders on a filter tap, a delete or
  // a swipe, so randomQuote() would make the quote flicker while it was being read.
  assert.match(st, /QUOTES\[streak % QUOTES\.length\]/, "the quote changes on every render");
  assert.ok(!/randomQuote\(\)/.test(st), "the quote is random, so it will not sit still");

  const streak = fnSrc("logStreakWeeks");
  // ⚠️ LAST WEEK COUNTS AS THE START. Measured from THIS week only, the number collapses to zero every
  // Monday until the first run of the week — a runner with four months of consistency would open the
  // app on a Monday and be told nothing.
  assert.match(streak, /if \(!wk\.has\(cursor\)\) cursor = isoAdd\(cursor, -7\)/,
    "the streak breaks every Monday morning");

  const prog = fnSrc("progressSnapshot");
  // "Interpret comparable runs and state the evidence behind the insight."
  // ⚠️ COMPARABLE MEANS THE SAME KIND OF RUN. Comparing every run's pace would report a gain whenever
  // the plan happened to schedule more easy running — a change in the PLAN read as a change in the
  // RUNNER, which is the exact mistake this app already refuses to make with fitness estimates.
  assert.match(prog, /logFilterOf\(r\) === "easy"/, "the snapshot compares runs that are not comparable");
  assert.match(prog, /Based on ' \+ easy\.length \+ ' comparable runs/, "the insight does not state its evidence");
  // ⚠️ AND IT REFUSES RATHER THAN GUESSES. A snapshot that always finds something is one nobody can
  // trust the day it finds something real.
  assert.match(prog, /if \(easy\.length < 6\) return "";/, "it will make a claim from a handful of runs");
  assert.match(prog, /Math\.abs\(delta\) < 3\) return "";/, "it will report noise as a trend");

  // "Use compact, date-aware rows so history remains scannable."
  const view = fnSrc("viewActivities");
  assert.match(view, /lg-row/, "the runs are still full cards with stat blocks");
  assert.match(view, /runDateLabelIso\(a\.dateIso\)/, "a row does not carry its own date");
  assert.ok(!view.includes('class="card runcard'), "the old three-column run card is still there");
  // "Provide filters without turning them into a second navigation layer."
  assert.match(snap, /id="lbFilterBtn"/, "the filters are always on screen as a second nav layer");
});

test("⚠️ every run row but the last carries a separator", () => {
  // ⚠️ EVERY ROW IS THE LAST CHILD OF ITS OWN SWIPE WRAPPER, so ".lg-row:last-child { border: 0 }"
  // matched ALL of them and removed every separator in the list — the same "position is not a name"
  // mistake as the plan week card, in reverse. The wrapper is the thing to count.
  const css = sheetOf(page());
  assert.ok(!/\.lg-row:last-child \{ border-bottom: 0/.test(css),
    "the separator is removed from every row, because each one is the last child of its own wrapper");
  assert.match(css, /\.lg-list \.swipe:last-child \.lg-row \{ border-bottom: 0/,
    "only the final row in the list should lose its separator");
  assert.match(css, /\.lg-row \{[^}]*border-bottom: 1px solid var\(--line\)/,
    "the rows carry no separator at all");
});

test("⚠️ the streak quote is the brand colour, centred, with the author to the right", () => {
  const css = sheetOf(page());
  const q = (css.match(/\.st-q \{[^}]*\}/) || [""])[0];
  const a = (css.match(/\.st-qa \{[^}]*\}/) || [""])[0];
  assert.match(q, /color: var\(--accent\)/, "the quote is not in the brand colour");
  assert.match(q, /text-align: center/, "the quote is not centred");
  // ⚠️ The author is NOT the accent — one voice per line, and it is the attribution rather than the
  // quote. --ink is the plain text colour in both themes.
  assert.match(a, /color: var\(--ink\)/, "the author is not in plain text colour");
  assert.match(a, /text-align: right/, "the author is not to the right");
  // ⚠️ A RUNG SMALLER THAN THE QUOTE, AND TUCKED UNDER IT. It is the source, not the words — set at
  // the same size and pushed away it reads as a second line of the quotation.
  assert.match(a, /font-size: var\(--t-label\)/, "the author is not smaller than the quote it attributes");
  assert.match(a, /margin-top: 3px/, "the author has drifted away from its quote");
  // ⚠️ --accent is BOTH a text colour and a button background, which is why it was darkened in light
  // mode to clear 4.5:1 as text. Measured on the card it sits on: 8.07:1 dark, 5.14:1 light.
  assert.match(css, /--accent: *#0c7b70/, "the light accent is back below the contrast floor for text");
});

test("⚠️ Motivation lives with the training profile, and the overlay says what it is editing", () => {
  const html = page();
  const prof = fnSrc("viewProfile");
  // ⚠️ It is a thing about the RUNNER, not an article to read, so it sits with the other answers that
  // shape the plan rather than in Support's Learn list.
  assert.match(prof, /label: "Motivation".*action: "setup:why"/, "Motivation is not on the profile");
  const learn = html.slice(html.indexOf("const HUB_LEARN"), html.indexOf("const HUB_LEARN") + 120);
  assert.ok(!learn.includes('"why"'), "Your why is still in the Support hub as well");
  // ⚠️ COUNTED, NOT QUOTED. Putting one of the runner's own sentences on a settings row, in a summary
  // of everything else, cheapens it.
  const w = fnSrc("profWhy");
  assert.match(w, /" of " \+ WHY_QUESTIONS\.length \+ " answered"/, "the row does not say how many are answered");

  // ⚠️ THE FOCUS HEADER RENDERS WHEREVER THE FORM IS. It looked inside #view only, so once a scoped
  // edit opened in a sheet it silently skipped — and "Your other answers stay exactly as they are"
  // never appeared in the overlay, which is now the main way anybody edits one answer.
  const focus = fnSrc("applySetupFocus");
  assert.match(focus, /PROFILE_EDIT_OPEN \? \$\("sheetBody"\) : \$\("view"\)/,
    "the focus header is looked for in the wrong container when the form is in a sheet");
  // ⚠️ And the why answers write through their own handler, not draftFromForm — without wiring them
  // in the overlay, typing one would look accepted and save nothing.
  assert.match(fnSrc("openProfileEdit"), /wireWhyInputs\(null\)/, "the why answers are not wired in the overlay");
});

test("⚠️ a run can be assigned to trainers, and the mileage moves with it", () => {
  // The rack only ever credited whichever pair was marked ACTIVE, and nothing let a runner say what
  // they actually wore — so somebody who owns two pairs and swaps between them had one number
  // climbing and one frozen, and the one figure the rack exists to produce ("when do I replace
  // these") was wrong for both.
  const html = page();
  const assign = fnSrc("shoeAssignRun");
  // ⚠️ THE DISTANCE MOVES BOTH WAYS. Setting run.shoeId alone leaves the old pair carrying kilometres
  // it never ran and the new pair short by the same amount — two wrong numbers from one tap.
  // ⚠️ RUN THE ARITHMETIC, DO NOT MATCH THE SOURCE. The first version of this asserted the two lines
  // that add and subtract — and they survive inside a dead branch, so wrapping them in "if (false)"
  // left the test green while the mileage stopped moving. A guard that cannot fail is worse than none.
  let shoes: Array<{ id: string; km: number }> = [];
  const fn = lift("shoeAssignRun", {
    loadShoes: () => shoes,
    saveShoes: (l: typeof shoes) => { shoes = l; },
    saveRuns: () => {},
  }) as (run: Record<string, unknown>, id: string | null) => void;
  const reset = () => { shoes = [{ id: "a", km: 100 }, { id: "b", km: 50 }]; };
  const km = (id: string) => shoes.find((s) => s.id === id)!.km;

  reset();
  const run = { distKm: 10, shoeId: null as string | null };
  fn(run, "a");
  assert.equal(km("a"), 110, "assigning a run does not credit the pair");
  fn(run, "b");
  assert.equal(km("a"), 100, "the old pair keeps distance it never ran");
  assert.equal(km("b"), 60, "the new pair does not gain the distance");
  // ⚠️ Re-picking the same pair is idempotent — and NOT because of the early return, which I first
  // claimed. Without it the move subtracts from the pair and adds straight back, so the total is
  // identical either way. The early return saves a pointless write; it is not what protects the
  // number, and a comment saying otherwise would send the next person to the wrong line.
  fn(run, "b");
  assert.equal(km("b"), 60, "re-picking the same pair changed the total");
  fn(run, null);
  assert.equal(km("b"), 50, "removing the trainers leaves the distance behind");
  assert.equal(run.shoeId, null, "the run still claims a pair it is no longer credited to");
  // ⚠️ A run with no distance must not move anything — a treadmill run before its distance is typed in.
  reset();
  const zero = { distKm: 0, shoeId: null as string | null };
  fn(zero, "a");
  assert.equal(km("a"), 100, "a run with no distance still credited a pair");
  assert.equal(zero.shoeId, "a", "a distance-less run cannot be assigned at all");

  // Crediting can be told which pair rather than always taking the active one.
  const credit = fnSrc("shoeCreditRun");
  assert.match(credit, /preferId \? list\.find\(\(x\) => x\.id === preferId\)/, "a chosen pair is ignored at save");
  assert.match(html, /shoeCreditRun\(rec, LIVE && LIVE\.summary \? LIVE\.summary\.shoeId : null\)/,
    "the pair picked on the finish screen is not honoured when the run is saved");

  // ⚠️ ON AN UNSAVED RUN THE CHOICE PARKS ON LIVE.summary, exactly as the note and the effort rating
  // do — liveRunRecord rebuilds the record on every render of the finish screen, so anything written
  // onto the record itself is gone by the next tick and the run would save to the wrong pair.
  const choice = fnSrc("runShoeChoice");
  assert.match(choice, /LIVE\.summary\.shoeId/, "an unsaved run's choice is not parked where it survives a render");
  assert.match(html, /else if \(LIVE && LIVE\.summary\) LIVE\.summary\.shoeId = id;/,
    "picking on the finish screen assigns a run that may never be saved");
  // It appears on both surfaces because runOverviewHtml is shared.
  assert.match(fnSrc("runOverviewHtml"), /runShoeHtml\(run\)/, "the picker is not on the debrief");
});
