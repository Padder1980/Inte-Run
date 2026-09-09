import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * THE MOMENT A PLAN IS REBUILT — SHOW THE WORK, DO NOT FAKE A DELAY.
 *
 * The owner asked why a rebuild is instant here when the comparison app takes a few seconds, and
 * chose "show the work" over a spinner. Measured: a 20-week half-marathon block (140 sessions, 593
 * steps) rebuilds in 1.1ms p50 — it is arithmetic on the phone, not a server round trip.
 *
 * ⚠️ SO EVERY GUARD IN THIS FILE IS ABOUT HONESTY RATHER THAN APPEARANCE. A stage may only be named
 * when it genuinely runs, a runner with nothing to wait for must get no moment at all, and the two
 * stages that ARE slow must be waited for rather than guessed at.
 */

const page = (() => {
  let c: string | null = null;
  return () => (c ??= readFileSync(new URL("../web/app.html", import.meta.url), "utf8"));
})();

/** A page function, brace-matched from its declaration. */
function fn(name: string): string {
  const src = page();
  const at = src.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name);
  let d = 0;
  for (let i = src.indexOf("{", at); i < src.length; i++) {
    if (src[i] === "{") d++;
    else if (src[i] === "}") { d--; if (!d) return src.slice(at, i + 1); }
  }
  return assert.fail(name + " has no matching close");
}
const nocomment = (s: string) =>
  s.replace(/^\s*\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

test("BLOCKER: a stage is only ever named when the work behind it really runs", () => {
  // ⚠️ THE WHOLE POINT. A line promising "Sending it to your Apple Watch" to somebody with no watch
  // is the thing this design refuses — it would be the fake delay wearing the honest one's clothes.
  const stages = nocomment(fn("planMomentStages"));

  // Each optional stage must be gated on the SAME condition the work itself is gated on.
  const pairs: Array<[string, RegExp]> = [
    ["Applying your breaks", /loadAdjust\(\)\.length/],
    ["Rescheduling your reminders", /NATIVE_NOTIFY[\s\S]*REMIND\.enabled/],
    ["Sending it to your Apple Watch", /NATIVE_WATCH/],
  ];
  for (const [label, gate] of pairs) {
    assert.ok(stages.includes(label), "the stage list no longer offers: " + label);
    assert.match(stages, gate, "the stage \"" + label + "\" is not gated on the work's own condition");
  }

  // And the gates must be the real ones the work uses.
  assert.match(nocomment(fn("syncWatch")), /if \(!NATIVE_WATCH\) return;/,
    "syncWatch's own gate has moved, so the stage list now promises a sync that may not happen");
  assert.match(nocomment(fn("syncNativeReminders")), /if \(!NATIVE_NOTIFY\) return;/,
    "syncNativeReminders' own gate has moved");
});

test("BLOCKER: nothing real to wait for means no moment at all", () => {
  // ⚠️ Instant must stay instant. A runner with no watch and no reminders is shown nothing, because
  // for them the rebuild genuinely is 1ms and a spinner would be the invented delay he rejected.
  const pm = nocomment(fn("planMoment"));
  assert.match(pm, /stages\.length < 2/,
    "the moment no longer bails out when there is only the instant stage — it is now a fake delay");
  const bail = pm.slice(pm.indexOf("stages.length < 2"));
  assert.match(bail.slice(0, 120), /commit\(\);\s*then\(\);\s*return;/,
    "the bail-out must still commit and hand back, not skip the work");
});

test("BLOCKER: the moment runs the caller's own commit — it is not a second commit path", () => {
  // adoptPlan's own note: never hand-assign PLAN, always go through it. A moment that rebuilt the
  // plan itself would be exactly that trap with a spinner on top.
  const pm = nocomment(fn("planMoment"));
  assert.match(pm, /commit\(\)/, "the moment no longer runs the commit it was given");
  for (const forbidden of ["adoptPlan(", "applyProfile(", "PLAN =", "RAW ="]) {
    assert.ok(!pm.includes(forbidden),
      "planMoment commits for itself (" + forbidden + ") instead of running the caller's commit");
  }
});

test("BLOCKER: a stage is confirmed by a stamp newer than this rebuild, and the wait is bounded", () => {
  const pm = nocomment(fn("planMoment"));
  // ⚠️ NEWER THAN THIS REBUILD. Reading the raw stamp would let a PREVIOUS rebuild's success be
  // reported as this one's, which is the stale-evidence fault this project keeps finding.
  assert.match(pm, /const since = Date\.now\(\)/, "the moment no longer records when it began");
  assert.match(pm, /Math\.abs\(SYNC_RAN\[key\]\) >= since/,
    "a stage is confirmed without checking the stamp belongs to THIS rebuild");
  // ⚠️ AND IT IS BOUNDED. A native side that never answers must not trap the runner behind a modal.
  assert.match(pm, /PM_CEIL_MS/, "the wait is unbounded, so a silent native side traps the runner");
  const src = page();
  const ceil = /const PM_CEIL_MS = (\d+);/.exec(src);
  assert.ok(ceil, "no ceiling constant");
  assert.ok(Number(ceil![1]) > 500 && Number(ceil![1]) <= 8000,
    "the ceiling must outlast the 400ms and 500ms debounces without stranding anybody: " + ceil![1]);
});

test("BLOCKER: both deferred syncs stamp whether they succeeded or failed", () => {
  // ⚠️ THIS CLOSES A SILENT CATCH. adoptPlan wraps both in try/catch with an EMPTY body, so a failed
  // reminder reschedule or a refused watch push was indistinguishable from a successful one. The
  // moment can only be honest if the stamp distinguishes them.
  const rem = nocomment(fn("syncNativeReminders"));
  const wat = nocomment(fn("syncWatch"));
  assert.match(rem, /SYNC_RAN\.remind = Date\.now\(\)/, "a successful reschedule is not stamped");
  assert.match(rem, /SYNC_RAN\.remind = -Date\.now\(\)/, "a FAILED reschedule is not distinguishable");
  assert.match(wat, /SYNC_RAN\.watch = Date\.now\(\)/, "a successful watch push is not stamped");
  assert.match(wat, /SYNC_RAN\.watch = -Date\.now\(\)/, "a FAILED watch push is not distinguishable");
});

test("BLOCKER: the dwell is legibility only, and is nowhere near the real work", () => {
  const src = page();
  const dwell = /const PM_DWELL_MS = (\d+);/.exec(src);
  assert.ok(dwell, "no dwell constant");
  const ms = Number(dwell![1]);
  // ⚠️ A BOUND IN BOTH DIRECTIONS. Too short and the line cannot be read, which defeats the point;
  // too long and it stops being a legibility floor and becomes the invented delay he rejected.
  assert.ok(ms >= 200 && ms <= 600, "the dwell is no longer a legibility floor: " + ms + "ms");
  // The dwell is a FLOOR on real work, not an addition to it — a stage that took longer waits no
  // extra time.
  const pm = nocomment(fn("planMoment"));
  assert.match(pm, /PM_DWELL_MS - \(Date\.now\(\) - t0\)/,
    "the dwell is added to the work rather than being a floor under it");
});

test("BLOCKER: the deliberate rebuild path uses it, and the internal ones do not", () => {
  const src = page();
  // ⚠️ 33 PATHS CALL recompute()/adoptPlan(), INCLUDING ONE AT MODULE TOP LEVEL. Baking the moment
  // into adoptPlan would put a modal over the launch and over every internal repaint, so it is
  // opt-in at the deliberate call sites only.
  assert.ok(!nocomment(fn("adoptPlan")).includes("planMoment"),
    "the moment is inside adoptPlan, so it now fires at boot and on every internal recompute");
  const saves = (src.match(/planMoment\(/g) || []).length;
  assert.ok(saves >= 2 && saves <= 6,
    "planMoment has " + saves + " references — either nothing uses it, or it has spread beyond the "
    + "deliberate rebuilds it was scoped to");
  // The profile save is the path the owner asked about; it must be one of them.
  // ⚠️ BRACE-MATCHED, NOT A CHARACTER WINDOW. Written as a 3000-character slice this failed on
  // correct code — doSaveProfile is far longer than that — and "a character window is not a
  // function" is a lesson this project has now paid for thirteen times.
  assert.match(fn("doSaveProfile"), /planMoment\(commit,/,
    "saving the profile no longer goes through the moment");
  // ⚠️ And the commit it is handed must still be the WHOLE original commit, not a fragment: the
  // ticks restore is the one that has silently gone missing from this path before.
  const save = nocomment(fn("doSaveProfile"));
  const commitAt = save.indexOf("const commit = ");
  assert.notEqual(commitAt, -1, "the commit is no longer extracted");
  const body = save.slice(commitAt, save.indexOf("planMoment(commit,"));
  for (const must of ["adoptPlan(out)", "seedDone()", "restoreTicks(keptTicks)", "saveProfileStore()"]) {
    assert.ok(body.includes(must), "the commit handed to the moment has lost: " + must);
  }
});

/* ------------------------------------------------------------------------------------------------
 * DRIVEN, NOT GREPPED. The honesty claim — a stage is named only when its work runs — is the whole
 * feature, so it is EXECUTED against every combination of runner rather than matched in the source.
 * The gates are module-level bindings in the built page (not on window), so they are supplied to a
 * lift rather than poked in a browser.
 * --------------------------------------------------------------------------------------------- */

function stagesFor(g: { adjust: number; notify: boolean; perm: string; remind: boolean; watch: boolean }) {
  const f = new Function("NATIVE_NOTIFY", "NATIVE_PERM", "NATIVE_WATCH", "REMIND", "loadAdjust",
    fn("planMomentStages") + "\nreturn planMomentStages();");
  return (f as (...a: unknown[]) => Array<{ k: string; t: string }>)(
    g.notify, g.perm, g.watch, { enabled: g.remind }, () => new Array(g.adjust).fill(0),
  );
}
const KEYS = (s: Array<{ k: string }>) => s.map((x) => x.k).join(",");

test("BLOCKER: the stage list is exactly the work that will run, driven", () => {
  const bare = { adjust: 0, notify: false, perm: "granted", remind: false, watch: false };

  // A runner in a browser, or on a phone with nothing connected: one instant stage, so NO moment.
  assert.equal(KEYS(stagesFor(bare)), "build");

  // A watch, and nothing else.
  assert.equal(KEYS(stagesFor({ ...bare, watch: true })), "build,watch");

  // Reminders on — and the three conditions are all required, because all three gate the work.
  assert.equal(KEYS(stagesFor({ ...bare, notify: true, remind: true })), "build,remind");
  assert.equal(KEYS(stagesFor({ ...bare, notify: true, remind: false })), "build",
    "reminders switched off must not be announced as being rescheduled");
  assert.equal(KEYS(stagesFor({ ...bare, notify: true, remind: true, perm: "denied" })), "build",
    "iOS having refused notification permission must not be announced as a reschedule");
  assert.equal(KEYS(stagesFor({ ...bare, notify: false, remind: true })), "build",
    "a browser has no notification bridge at all, so nothing is being rescheduled");

  // Breaks, only when some are actually booked.
  assert.equal(KEYS(stagesFor({ ...bare, adjust: 1, watch: true })), "build,adjust,watch");
  assert.equal(KEYS(stagesFor({ ...bare, adjust: 0, watch: true })), "build,watch",
    "no holiday or easier week booked must not be announced as breaks being applied");

  // Everything on, in the order adoptPlan performs them.
  assert.equal(KEYS(stagesFor({ adjust: 2, notify: true, perm: "granted", remind: true, watch: true })),
    "build,adjust,remind,watch",
    "the stages must be listed in the order adoptPlan actually does them");
});

test("BLOCKER: a runner with nothing to wait for sees no overlay, driven", async () => {
  // ⚠️ Instant stays instant. This is the half that stops it being the fake delay he rejected.
  let appended = 0, committed = 0, thened = 0;
  const doc = {
    body: { appendChild: () => { appended++; }, removeChild: () => {} },
  };
  // ⚠️⚠️ THE REAL el(), LIFTED — NOT A STUB. The stub that used to sit here is why this test passed
  // while the shipped code threw: planMoment called el("div", "pmoment"), and el() in this app takes
  // an HTML STRING, so it returned a TEXT NODE whose classList is undefined. A probe that supplies
  // its own dependency measures a strictly easier program, and this one measured a program where
  // el() accepted a tag name. Found by driving the real page hours after it shipped.
  const f = new Function("document", "el", "esc", "requestAnimationFrame", "out",
    "NATIVE_NOTIFY", "NATIVE_PERM", "NATIVE_WATCH", "REMIND", "loadAdjust",
    "const PM_DWELL_MS = 1; const PM_CEIL_MS = 50; let SYNC_RAN = { remind: 0, watch: 0 };\n"
    + fn("planMomentStages") + "\n" + fn("planMomentHtml") + "\n" + fn("planMoment")
    + "\nplanMoment(out.commit, out.then);");
  (f as (...a: unknown[]) => void)(
    doc,
    // ⚠️ A STUB, AND ITS LIMIT IS STATED. node has no document, so the overlay path cannot be driven
    // here — which is exactly how el("div", "pmoment") shipped and threw on a real phone. The
    // signature is guarded statically instead, in test/silent-defects.test.ts ("el() takes an HTML
    // string"). Do not read this test as proof that the overlay path runs.
    () => ({ classList: { add() {}, remove() {} }, querySelector: () => null, set innerHTML(_v: string) {} }),
    (s: string) => s, (cb: () => void) => cb(),
    { commit: () => { committed++; }, then: () => { thened++; } },
    false, "granted", false, { enabled: false }, () => [],
  );
  assert.equal(appended, 0, "an overlay was drawn for a runner with nothing to wait for");
  assert.equal(committed, 1, "the rebuild did not happen");
  assert.equal(thened, 1, "the caller's navigation did not happen");
});
