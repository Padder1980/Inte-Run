/**
 * A6 — THE APP LAYER: THE PLACEHOLDER/VALUE DISTINCTION, THE NEW-RECORD TOAST, THE HISTORY CARD.
 *
 * The math (Epley, double progression, records) is tested directly against src/strength/progression.ts
 * and src/strength/records.ts in strength-progression.test.ts. This file is about the app layer's own
 * two chances to get it wrong: writing a computed SUGGESTION into a row as if the runner had typed it,
 * and a `web/entry.ts` export that never actually reaches the bundled RC global (a builder proves a
 * shape exists; only the caller proves the runner reaches it — this project's own repeated lesson).
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { exerciseById } from "../src/strength/library.ts";
import { suggestLoad } from "../src/strength/progression.ts";
import { detectStrengthRecords } from "../src/strength/records.ts";
import { isYouthAge } from "../src/domain/youth.ts";

const APP = readFileSync(new URL("../web/app.html", import.meta.url), "utf8");
/**
 * ⚠️ ANCHORED TO THE START OF A LINE. The app markup contains accept="image/*", an unbalanced comment
 * opener mid-line, so an unanchored sweep opens there and eats 10,382 characters of live code.
 */
const nocomment = (s: string) => s.replace(/^\s*\/\/.*$/gm, "").replace(/^\s*\/\*[\s\S]*?\*\//gm, "");
/** One function of the built page, brace-matched. A character window is not a function. */
function fnOf(name: string): string {
  const at = APP.indexOf("function " + name + "(");
  assert.ok(at > 0, "no function " + name + " in the built page");
  let d = 0;
  for (let i = APP.indexOf("{", at); i < APP.length; i++) {
    if (APP[i] === "{") d++;
    else if (APP[i] === "}") { d--; if (!d) return nocomment(APP.slice(at, i + 1)); }
  }
  return assert.fail(name + " has no matching close brace");
}
function constOf(name: string): string {
  const m = new RegExp("^const " + name + " = [^\\n]+$", "m").exec(APP);
  assert.ok(m, "const " + name + " is not declared on one line in the built page");
  return m![0]!;
}

// -------------------------------------------------------------------------------------------------
// 0. THE ENTRY.TS EXPORT REACHED THE BUNDLE — a claim in web/entry.ts is not a fact about the page
// -------------------------------------------------------------------------------------------------

test("BLOCKER: every A6 engine function web/entry.ts claims to export is a real property of the bundled RC", () => {
  for (const name of ["epley1RM", "bestE1RMKg", "suggestLoad", "sumVolumeKg", "detectStrengthRecords"]) {
    assert.match(APP, new RegExp(name + ":\\(\\)=>[a-zA-Z0-9_$]+"),
      name + " is not a property of the bundled RC — entry.ts exports it, but esbuild did not carry it through");
  }
});

// -------------------------------------------------------------------------------------------------
// 1. strSuggestFor — resolves pattern/equipment from the CATALOGUE, not the (possibly absent) instance
// -------------------------------------------------------------------------------------------------

/**
 * strSuggestFor and its dependents, lifted and executed against the REAL engine (imported directly,
 * not stubbed — the "a probe that supplies its own dependency measures a strictly easier program"
 * trap this repo's own strength-player.test.ts already names).
 */
function loadSuggestFor() {
  const body = [fnOf("strParseSet"), fnOf("strPriorInstances"), fnOf("strSuggestFor")].join("\n");
  const store: { d: string; x: string; w?: string; r?: string; rpe?: string }[] = [];
  const ctx = { slogFor: (x: string) => store.filter((r) => r.x === x), RC: { exerciseById, suggestLoad } };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "const slogFor = ctx.slogFor, RC = ctx.RC;" + body + "\nreturn strSuggestFor;");
  return { strSuggestFor: factory(ctx) as (x: string, reps: string, load: string | undefined, iso: string) => unknown, store };
}

test("BLOCKER: strSuggestFor reads pattern/equipment from RC.exerciseById, not a field on the exercise instance", () => {
  // ⚠️ A LEGACY SESSION (no strength preferences answered) never copies `equipment` onto its
  // exercises — only the A3 preference-driven builder does. If this read the field off the caller's
  // own exercise instance rather than the catalogue, the barbell-squat/hinge bonus step would be
  // unreachable for every runner who has not answered the new questions.
  const { strSuggestFor, store } = loadSuggestFor();
  store.push({ d: "2026-09-01", x: "barbellDeadlift", w: "45", r: "6" }); // hinge, barbell-only, ≥40kg, all at top of "3–6 (heavy)"
  const s = strSuggestFor("barbellDeadlift", "3–6 (heavy)", "80%+", "2026-09-08") as { kg: number; direction: string } | null;
  assert.ok(s, "no suggestion at all — the catalogue lookup failed");
  assert.equal(s!.direction, "up");
  assert.equal(s!.kg, 50, "a barbell hinge at 45 kg should have stepped up by 5, not 2.5 — the bonus was not applied");
});

test("a hold prescription gets no suggestion, whatever the history says", () => {
  const { strSuggestFor, store } = loadSuggestFor();
  store.push({ d: "2026-09-01", x: "plank", w: "20", r: "10" }); // meaningless data — reps has no numeric range
  const s = strSuggestFor("plank", "30–45s hold", undefined, "2026-09-08");
  assert.equal(s, null);
});

// -------------------------------------------------------------------------------------------------
// 2. The kg box — placeholder gets the suggestion, value gets only what the runner actually did
// -------------------------------------------------------------------------------------------------

function loadPlayerBody() {
  const body = [
    constOf("STR_REST_WARN_S"), fnOf("strRestLeft"), fnOf("strHoldLeft"), fnOf("strPrefill"),
    fnOf("strParseSet"), fnOf("strPriorInstances"), fnOf("strSuggestFor"),
    fnOf("strPlayerBodyHtml"), fnOf("strPlayerDoneHtml"),
  ].join("\n");
  const store: { d: string; s: string; x: string; i: number; w?: string; r?: string; rpe?: string }[] = [];
  const ctx = {
    SPLAY: null as Record<string, unknown> | null,
    esc: (x: unknown) => String(x == null ? "" : x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;"),
    exAnim: () => "<svg></svg>",
    ICON: { play: "<svg/>", check: "<svg/>" },
    fmtPace: (n: number) => String(n),
    slogFor: (x: string) => store.filter((r) => r.x === x),
    RC: { exerciseById, suggestLoad },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "let SPLAY = ctx.SPLAY;" +
    "const esc = ctx.esc, exAnim = ctx.exAnim, ICON = ctx.ICON, fmtPace = ctx.fmtPace, slogFor = ctx.slogFor, RC = ctx.RC;" +
    body +
    "\nreturn (s) => { SPLAY = s; return strPlayerBodyHtml(); };");
  return { render: factory(ctx) as (s: Record<string, unknown>) => string, store };
}

const ITEM = (x: string, over: Record<string, unknown> = {}) => ({
  x, name: "Squat", cue: "Sit back.", pattern: "squat", set: 0, ofSets: 3, reps: "8–12",
  load: "70–75%", hold: 0, rest: 120, ss: null, ...over,
});
const BASE = { sess: { id: "s" }, iso: "2026-09-08", i: 0, restEnd: null, holdEnd: null, done: false, logged: 0 };

test("BLOCKER: the suggested load is the kg input's PLACEHOLDER; the runner's own last figure is its VALUE — they never collide", () => {
  const { render, store } = loadPlayerBody();
  // Last time: 20kg for 12 reps (top of the 8-12 range) -> suggests 22.5kg next. Two different numbers.
  store.push({ d: "2026-09-01", s: "s-old", x: "squat", i: 0, w: "20", r: "12" });
  const out = render({ ...BASE, items: [ITEM("squat")] });
  assert.match(out, /id="strpW" placeholder="22\.5"/, "the suggested 22.5kg is not the placeholder");
  assert.match(out, /id="strpW"[^>]*\svalue="20"/, "last time's 20kg is not the prefilled value");
  // The suggested figure must not appear as a value attribute anywhere in the markup — the guard the
  // stage exists for: a suggestion silently recorded as if the runner had typed it.
  assert.doesNotMatch(out, /value="22\.5"/, "the suggestion leaked into a value attribute");
});

test("BLOCKER: with no suggestion, the kg box falls back to its plain placeholder and nothing is invented", () => {
  const { render } = loadPlayerBody(); // empty store -- no history, no load% on this item
  const out = render({ ...BASE, items: [ITEM("core", { load: undefined })] });
  assert.match(out, /id="strpW" placeholder="kg"/);
  assert.doesNotMatch(out, /class="strp-sugg"/, "a suggestion caption appeared with nothing to suggest");
});

test("the suggestion's reason is rendered next to the box, and restates the number", () => {
  const { render, store } = loadPlayerBody();
  store.push({ d: "2026-09-01", s: "s-old", x: "squat", i: 0, w: "20", r: "12" });
  const out = render({ ...BASE, items: [ITEM("squat")] });
  assert.match(out, /class="strp-sugg">Every set hit the top of the range last time.*22\.5 kg/);
});

test("a hold item computes no suggestion at all -- the placeholder logic is not even reached", () => {
  const { render, store } = loadPlayerBody();
  store.push({ d: "2026-09-01", s: "s-old", x: "plank", i: 0, w: "999", r: "999" }); // garbage, would blow up any numeric handling if it ran
  const out = render({ ...BASE, items: [ITEM("plank", { hold: 45, reps: "30–45s hold", load: undefined })] });
  assert.doesNotMatch(out, /class="strp-sugg"/);
  assert.doesNotMatch(out, /id="strpW"/, "a hold offered a weight box at all");
});

// -------------------------------------------------------------------------------------------------
// 3. "estimated" — wherever an e1RM number is shown, the word is there too
// -------------------------------------------------------------------------------------------------

test("BLOCKER: every e1RM the engine hands the app carries the word 'estimated' in its own text", () => {
  // The player's fallback suggestion (loadPercent1RM x best e1RM) is the one path where a bare e1RM
  // number reaches a runner as a SUGGESTION, so its own reason string must say so.
  const s = suggestLoad({ prescribedReps: "8–12", loadPercent1RM: "70%", pattern: "squat", equipment: [],
    priorInstances: [[{ w: 40, r: 8 }], [{ w: null, r: 10 }]] });
  assert.ok(s);
  assert.match(s!.reason, /estimated one-rep max/i);
  // The history card's own e1RM line -- a static sweep of the source, because driving the whole
  // history view needs scaffolding disproportionate to what is left to prove once the arithmetic
  // (RC.bestE1RMKg, tested directly) and the placeholder/value split (tested above) both hold.
  assert.match(fnOf("viewStrengthHistory"), /estimated 1RM/i,
    "the history card renders an e1RM figure with no 'estimated' qualifier nearby");
});

// -------------------------------------------------------------------------------------------------
// 4. New-record detection and the toast it fires
// -------------------------------------------------------------------------------------------------

/**
 * ⚠️ `isYouth` IS LIFTED FOR REAL AND HANDED THE REAL `RC.isYouthAge`, NOT STUBBED. Y3 withholds the
 * estimated-1RM figure under 18, and a stub answering false would measure a strictly easier program:
 * the withholding would be untested and could be removed without a single assertion moving.
 */
function loadRecordMessage(age?: number) {
  const body = [fnOf("strParseSet"), fnOf("strPriorInstances"), fnOf("isYouth"), fnOf("strNewRecordMessage")].join("\n");
  const store: { d: string; s: string; x: string; i: number; w?: string; r?: string }[] = [];
  const ctx = {
    slogFor: (x: string) => store.filter((r) => r.x === x),
    RC: { detectStrengthRecords, isYouthAge },
    profile: { age },
  };
  // eslint-disable-next-line no-new-func
  const factory = new Function("ctx",
    "const slogFor = ctx.slogFor, RC = ctx.RC, profile = ctx.profile;" + body + "\nreturn strNewRecordMessage;");
  return { strNewRecordMessage: factory(ctx) as (sess: { iso: string }, items: unknown[]) => string | null, store };
}

test("BLOCKER: a genuinely heavier set produces a 'New best' toast naming the exercise and the weight", () => {
  const { strNewRecordMessage, store } = loadRecordMessage();
  store.push({ d: "2026-09-01", s: "s-old", x: "squat", i: 0, w: "60", r: "5" });
  store.push({ d: "2026-09-08", s: "s", x: "squat", i: 0, w: "65", r: "1" }); // today, heavier
  const msg = strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")]);
  assert.match(msg!, /^New best: Squat 65 kg$/);
});

test("an e1RM-only record names it as such, distinct from a heaviest-weight one", () => {
  const { strNewRecordMessage, store } = loadRecordMessage();
  for (let i = 0; i < 3; i++) store.push({ d: "2026-09-01", s: "s-old", x: "squat", i, w: "60", r: "5" }); // e1rm 70
  store.push({ d: "2026-09-08", s: "s", x: "squat", i: 0, w: "60", r: "8" }); // e1rm 76, weight ties (no heaviest hit)
  const msg = strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")]);
  assert.match(msg!, /^New estimated 1RM: Squat ~76 kg$/);
});

/**
 * ⚠️⚠️ Y3: A ONE-REP MAX IS NEVER PUT IN FRONT OF A 12-17 RUNNER, AND THE ACHIEVEMENT IS STILL
 * NAMED. Unsupervised 1RM testing is the one thing both youth resistance-training position stands
 * forbid outright, and a number on screen is the invitation to go and do it. Swallowing the toast
 * instead would take a real achievement away from a child to avoid printing a figure, so what goes
 * is the figure. The identical case for an adult is the guard directly above.
 */
test("BLOCKER: under 18, the estimated-1RM toast names the best without naming the number", () => {
  for (const age of [12, 14, 17]) {
    const { strNewRecordMessage, store } = loadRecordMessage(age);
    for (let i = 0; i < 3; i++) store.push({ d: "2026-09-01", s: "s-old", x: "squat", i, w: "60", r: "5" });
    store.push({ d: "2026-09-08", s: "s", x: "squat", i: 0, w: "60", r: "8" });
    const msg = strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")]);
    assert.ok(msg, "age " + age + ": the record was swallowed rather than reworded");
    assert.ok(!/1RM|\d+\s*kg/i.test(msg!), "age " + age + ": a one-rep-max figure reached a child: " + msg);
    assert.match(msg!, /Squat/, "age " + age + ": the toast stopped naming the exercise");
  }
  // 18 is an adult and gets the number, which is what makes the test above discriminate.
  const adult = loadRecordMessage(18);
  for (let i = 0; i < 3; i++) adult.store.push({ d: "2026-09-01", s: "s-old", x: "squat", i, w: "60", r: "5" });
  adult.store.push({ d: "2026-09-08", s: "s", x: "squat", i: 0, w: "60", r: "8" });
  assert.match(adult.strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")])!, /^New estimated 1RM: Squat ~76 kg$/);
});

test("a first-ever log of an exercise never toasts -- nothing to beat", () => {
  const { strNewRecordMessage, store } = loadRecordMessage();
  store.push({ d: "2026-09-08", s: "s", x: "squat", i: 0, w: "999", r: "1" }); // an absurd weight, still no prior
  const msg = strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")]);
  assert.equal(msg, null, "a first-ever log was reported as a record");
});

test("nothing logged today produces no message, whatever prior history exists", () => {
  const { strNewRecordMessage, store } = loadRecordMessage();
  store.push({ d: "2026-09-01", s: "s-old", x: "squat", i: 0, w: "60", r: "5" });
  const msg = strNewRecordMessage({ iso: "2026-09-08" }, [ITEM("squat")]);
  assert.equal(msg, null);
});

test("the message reports the FIRST exercise (in item order) with a genuine record, not just any with one", () => {
  const { strNewRecordMessage, store } = loadRecordMessage();
  // Exercise "a" ties its prior best -- no record. Exercise "b" beats it -- reported.
  store.push({ d: "2026-09-01", s: "s-old", x: "a", i: 0, w: "40", r: "5" });
  store.push({ d: "2026-09-08", s: "s", x: "a", i: 0, w: "40", r: "5" }); // tie
  store.push({ d: "2026-09-01", s: "s-old", x: "b", i: 0, w: "30", r: "5" });
  store.push({ d: "2026-09-08", s: "s", x: "b", i: 0, w: "35", r: "5" }); // genuine record
  const items = [ITEM("a", { name: "Exercise A" }), ITEM("b", { name: "Exercise B" })];
  const msg = strNewRecordMessage({ iso: "2026-09-08" }, items);
  assert.match(msg!, /Exercise B/, "the message did not report the exercise that actually set a record");
});

// -------------------------------------------------------------------------------------------------
// 5. strFinish is wired to the toast, and only when something was logged
// -------------------------------------------------------------------------------------------------

test("BLOCKER: strFinish computes the record message before flushing, and toasts only when there is one", () => {
  const src = fnOf("strFinish");
  assert.match(src, /strNewRecordMessage\(/, "strFinish no longer checks for a new record at all");
  assert.match(src, /sets > 0 \? strNewRecordMessage/, "the record check runs even when nothing was logged this session");
  assert.match(src, /if \(rec\) toast\(rec\)/, "the toast is not gated on a genuine hit");
  // ⚠️ computed BEFORE slogFlush, not after -- detectStrengthRecords reads the in-memory store via
  // slogFor, so the disk write's own debounce must not be a precondition for the check to see today's
  // sets. An ordering claim, so it is checked as one rather than merely trusting both calls exist.
  assert.ok(src.indexOf("strNewRecordMessage(") < src.indexOf("slogFlush()"),
    "the record check runs after the debounced flush rather than against the in-memory store");
});
