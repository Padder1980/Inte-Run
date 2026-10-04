import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { sessionVolumeMeters, weekVolumeMeters } from "../src/domain/steps.ts";
import { weekView } from "../src/view/plan-summary.ts";
import { easeWeek } from "../src/adapt/missed-sessions.ts";

/**
 * STAGE B5 (2026-10-04) — choose how quickly the plan builds back up after time off.
 *
 * When a "Going away" or "Not feeling 100%" break that took running out has ended, Today asks once — in the
 * first week back — "How quickly do you want to build back up?": Slowly (two easier weeks), Balanced (one),
 * Quickly (carry on). Each answer is an existing mechanism (the "make a week easier" row applyEaseWeek
 * writes) and quotes the distance it produces; the recommendation comes from pauseTierFor, the repository's
 * own lines for time away. The break is recorded in interun_reentry_v1 the moment it is seen to have ended,
 * because the break store prunes an ended break on its next write.
 */

const PAGE = fileURLToPath(new URL("../web/app.html", import.meta.url));
function appScript(): string {
  const html = readFileSync(PAGE, "utf8");
  const marker = html.indexOf("function reentryCapture(");
  assert.ok(marker >= 0, "reentryCapture is not in the build — run node web/app.ts");
  const open = html.lastIndexOf("<script>", marker), close = html.indexOf("</script>", marker);
  return html.slice(open + 8, close);
}
const SRC = appScript();
function fnBody(name: string): string {
  const at = SRC.indexOf("function " + name + "(");
  assert.ok(at >= 0, "no function " + name + " in the build");
  let d = 0;
  for (let i = SRC.indexOf("{", at); i < SRC.length; i++) {
    if (SRC[i] === "{") d++;
    else if (SRC[i] === "}") { d--; if (!d) return SRC.slice(at, i + 1); }
  }
  throw new Error("unbalanced braces in " + name);
}
function constStmt(name: string): string {
  const at = SRC.search(new RegExp("^(?:const|let) " + name + " = ", "m"));
  assert.ok(at >= 0, "no const " + name + " in the build");
  let d = 0;
  for (let i = at; i < SRC.length; i++) {
    const c = SRC[i]!;
    if (c === "[" || c === "{" || c === "(") d++;
    else if (c === "]" || c === "}" || c === ")") d--;
    else if (c === ";" && d === 0) return SRC.slice(at, i + 1);
  }
  throw new Error("unterminated const " + name);
}
const decomment = (s: string) =>
  s.replace(/^\s*\/\*[\s\S]*?\*\//gm, " ").replace(/(^|[^:'"\\])\/\/[^\n]*/g, "$1 ");

const ISO = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => { const d = new Date(iso + "T00:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return ISO(d); };
const TODAY = ISO(new Date());
const TODAY_DOW = (new Date(TODAY + "T00:00:00Z").getUTCDay() + 6) % 7;
const THIS_MON = addDays(TODAY, -TODAY_DOW);
// The plan starts next Monday, so its first week has not started whichever day the suite runs on.
const MON = (w: number) => addDays(THIS_MON, 7 * (w + 1));
const WEEKS = 4;

/** Four weeks: easy Mon, threshold Tue, rest Wed, easy Thu, rest Fri, rest Sat, long Sun; the last is race week. */
function fixture() {
  const sess = (w: number, d: number, type: string, min: number, km: number) => ({
    id: MON(w) + "-d" + d + "-" + type, dayOfWeek: d, type, title: type + " " + w + "/" + d,
    intensity: type === "threshold" ? "hard" : "easy",
    estimatedDurationSeconds: min * 60, estimatedDistanceMeters: km * 1000, trainingDistanceMeters: Math.round(km * 900),
    steps: [{ kind: "steady", durationSeconds: min * 60, targetPaceSecPerKm: { minSecPerKm: 330, maxSecPerKm: 360 } }],
  });
  const week = (w: number) => w === WEEKS - 1
    ? [sess(w, 0, "easy", 30, 5), sess(w, 1, "rest", 0, 0), sess(w, 2, "rest", 0, 0), sess(w, 6, "race", 100, 21.1)]
    : [sess(w, 0, "easy", 40 + w * 5, 7 + w), sess(w, 1, "threshold", 50, 9), sess(w, 2, "rest", 0, 0), sess(w, 3, "easy", 35, 6),
       sess(w, 4, "rest", 0, 0), sess(w, 5, "rest", 0, 0), sess(w, 6, "long", 90 + w * 10, 16 + w * 2)];
  const raw = Array.from({ length: WEEKS }, (_, w) => {
    const sessions = week(w);
    return { index: w + 1, startDateIso: MON(w), phase: w === WEEKS - 1 ? "taper" : "build", isDeload: false, focus: "",
      sessions, plannedDistanceMeters: weekVolumeMeters(sessions as any), qualitySessionCount: sessions.filter((s) => s.type === "threshold").length };
  });
  return { RAW: { weeks: raw }, PLAN: { weeks: raw.map((w, i) => Object.assign(weekView(w as any), { startIso: MON(i) })) } };
}

const FNS = ["isoAdd", "dmon", "runDateLabelIso", "esc", "loadAdjust", "saveAdjust", "adjustFor", "weekSkips", "adjDrops",
  "applyAdjustments", "eased", "easeWeekIn", "easeWeekOptions", "pauseTierFor", "pauseDaysLabel", "loadReentry", "saveReentry",
  "reentryCapture", "reentryWeeks", "reentryOptions", "currentReentry", "reentryWeekLine", "reentryKm", "reentryCard",
  "answerReentry", "weeklyReviewCard"];
const CONSTS = ["MONTHS", "MON_SHORT", "ADJUST_KEY", "SKIP_KEEP_DAYS", "REENTRY_KEY", "REENTRY_MODES", "REENTRY_ASK_DAYS",
  "PAUSE_TIERS", "ADJ_MODES", "ADJ_QUALITY", "ADJ_RUN"];

function sandbox(seedRows: unknown[] = []) {
  const store: Record<string, string> = {};
  if (seedRows.length) store["interun_adjust_v1"] = JSON.stringify(seedRows);
  const localStorage = {
    getItem: (k: string) => (k in store ? store[k]! : null),
    setItem: (k: string, v: string) => { store[k] = String(v); },
    removeItem: (k: string) => { delete store[k]; },
  };
  const f = fixture();
  const PLAN: any = f.PLAN, RAW: any = f.RAW;
  const clock = { today: TODAY };
  const box: any = { store, PLAN, RAW, clock, toasts: [] as string[], calls: [] as string[], undo: null as null | (() => void),
    profile: { startDateIso: "" }, review: { quiet: false, observations: ["2 runs, 16 km"], suggestion: null } };
  const env: Record<string, unknown> = {
    PLAN, RAW, localStorage, todayIso: () => clock.today, TODAY_IN_PLAN: true, profile: box.profile,
    state: { trainFlag: null, dayOverride: {} }, ICON: { alfie: "" },
    RC: { weekVolumeMeters, sessionVolumeMeters, weekView, easeWeek },
    // The weekly review's own engine is not the subject here: it answers with a non-quiet review, so the
    // only thing that can silence the card is the one-question rule under test.
    currentWeeklyReview: () => box.review,
    recompute: () => { const g = fixture(); PLAN.weeks = g.PLAN.weeks; RAW.weeks = g.RAW.weeks; box.api.applyAdjustments(); box.calls.push("recompute"); },
    computeToday: () => box.calls.push("computeToday"), seedDone: () => box.calls.push("seedDone"),
    todayTicks: () => [], restoreTicks: () => box.calls.push("restoreTicks"),
    toast: (m: string) => box.toasts.push(m), toastUndo: (m: string, fn: () => void) => { box.toasts.push(m); box.undo = fn; },
    render: () => box.calls.push("render"),
  };
  const src = CONSTS.map(constStmt).join("\n") + "\n" + FNS.map(fnBody).join("\n");
  const names = Object.keys(env);
  box.api = new Function(...names, src + "\nreturn {" + FNS.join(",") + "};")(...names.map((n) => env[n]));
  (env.recompute as () => void)();
  return box;
}
const brk = (o: Record<string, unknown>) => ({ id: "w" + Math.random(), kind: "holiday", mode: "none", dropNonRun: false, ...o });
const ended = (days: number, o: Record<string, unknown> = {}) =>
  brk({ from: addDays(TODAY, -days), to: addDays(TODAY, -1), ...o });
const rec = (box: any) => JSON.parse(box.store["interun_reentry_v1"] || "null");

/* ------------------------------------------------------------------------------------------------ */

test("BLOCKER: a break is recorded when it has ended — only one that took running out, and only in the first week back", () => {
  const cases: [string, unknown, boolean][] = [
    ["a fortnight away, not running, ended yesterday", ended(14), true],
    ["not feeling 100%, easy runs only", ended(5, { kind: "ease", mode: "easy" }), true],
    ["a holiday with no long run", ended(7, { mode: "easyspeed" }), true],
    ["a holiday run as planned", ended(10, { mode: "full" }), false],
    ["an easier week the runner chose", ended(7, { kind: "recovery", mode: "recovery" }), false],
    ["a skipped session", ended(1, { kind: "skip", mode: "skip", sid: "x" }), false],
    ["a break still running (it ends today)", brk({ from: addDays(TODAY, -6), to: TODAY }), false],
    ["a break that ended eight days ago", brk({ from: addDays(TODAY, -20), to: addDays(TODAY, -8) }), false],
  ];
  for (const [what, row, want] of cases) {
    const box = sandbox();
    box.api.reentryCapture([row]);
    assert.equal(!!rec(box), want, what + (want ? " was not recorded" : " was recorded"));
  }
  const box = sandbox();
  box.api.reentryCapture([ended(14)]);
  assert.equal(rec(box).days, 14, "the break's length is not its days, first to last");
  // The newest ended break wins; the same break keeps its answer (declining is remembered).
  const a = ended(14, { id: "a", to: addDays(TODAY, -3), from: addDays(TODAY, -16) }), b = ended(4, { id: "b" });
  box.api.reentryCapture([a]);
  box.api.reentryCapture([a, b]);
  assert.equal(rec(box).id, "b", "an older break displaced the newer one");
  box.store["interun_reentry_v1"] = JSON.stringify({ ...rec(box), answer: "quick" });
  box.api.reentryCapture([a, b]);
  assert.equal(rec(box).answer, "quick", "capturing the same break again threw its answer away");
});

test("BLOCKER: the break store's own prune cannot lose it — saveAdjust records it before dropping it", () => {
  // The defect this order prevents: saveAdjust drops every ended window on every write, so the first skip
  // or booking after a holiday erased it, and the question it should have raised was never asked.
  const box = sandbox();
  box.api.saveAdjust([ended(14, { id: "h" })]);
  assert.deepEqual(JSON.parse(box.store["interun_adjust_v1"]), [], "the ended holiday was not pruned — the case proves nothing");
  assert.equal(rec(box) && rec(box).id, "h", "the prune dropped the break before it was recorded");
  assert.ok(decomment(fnBody("saveAdjust")).indexOf("reentryCapture(rows)") < decomment(fnBody("saveAdjust")).indexOf("const wins"),
    "saveAdjust records the break after its prune");
  // And at launch, for a break that ended while the app was closed: right after the first seedDone().
  assert.match(decomment(SRC), /migrateRunRoutes\(\);\s*seedDone\(\);\s*try \{ reentryCapture\(loadAdjust\(\)\); \}/,
    "nothing records a break that ended while the app was closed");
});

test("BLOCKER: the recommendation follows the repository's own lines for time away", () => {
  const want: [number, string][] = [[5, "quick"], [7, "quick"], [10, "balanced"], [14, "balanced"], [21, "slow"], [40, "slow"]];
  for (const [days, id] of want) {
    const box = sandbox();
    box.api.reentryCapture([ended(days)]);
    const q = box.api.currentReentry();
    assert.ok(q, days + " days away asked nothing");
    assert.deepEqual(q.options.map((o: any) => o.id), ["slow", "balanced", "quick"]);
    assert.equal(q.options.find((o: any) => o.rec).id, id, days + " days away recommended the wrong answer");
    assert.equal(q.tier.id, box.api.pauseTierFor(days).id);
  }
  // The card says what that length of time means in the pause tiers' own words — one definition.
  const box = sandbox();
  box.api.reentryCapture([ended(14)]);
  const html = box.api.reentryCard();
  assert.ok(html.includes(box.api.esc(box.api.pauseTierFor(14).why)), "the card does not use the tier's own words");
  assert.match(html, /You were away [\s\S]* — 2 weeks, no running at all\./);
  assert.match(html, /How quickly do you want to build back up\?/);
});

test("BLOCKER: each answer quotes the distance it produces — and the plan then reads exactly that", () => {
  for (const choice of ["balanced", "slow"]) {
    const box = sandbox();
    box.api.reentryCapture([ended(14)]);
    const q = box.api.currentReentry();
    const o = q.options.find((x: any) => x.id === choice);
    const promised = o.weeks.map((w: any) => [w.i, box.api.reentryKm(w.km1)]);
    assert.equal(promised.length, choice === "slow" ? 2 : 1);
    const card = box.api.reentryCard();
    for (const [i, km] of promised) assert.ok(card.includes("Week " + (i + 1) + ": "), "week " + (i + 1) + " is not quoted");
    box.api.answerReentry(choice);
    for (const [i, km] of promised) {
      assert.equal(box.PLAN.weeks[i].distanceKm.toFixed(1), km, "week " + (i + 1) + " was promised " + km + " km and reads " + box.PLAN.weeks[i].distanceKm);
    }
    // The mechanism is the "make a week easier" row, exactly as applyEaseWeek writes it.
    const rows = JSON.parse(box.store["interun_adjust_v1"]).filter((r: any) => r.kind === "recovery");
    assert.equal(rows.length, promised.length);
    for (const r of rows) {
      assert.equal(r.mode, "recovery"); assert.equal(r.dropNonRun, false);
      assert.equal(r.to, addDays(r.from, 6), "an easier week is not a whole week");
    }
    assert.equal(new Set(rows.map((r: any) => r.id)).size, rows.length, "two easier weeks share an id, so Cancel would take both");
  }
  // Quickly changes nothing, and says what stays.
  const box = sandbox();
  box.api.reentryCapture([ended(5)]);
  assert.match(box.api.reentryCard(), /Week 1 stays at \d+\.\d km/);
  const before = JSON.stringify(box.PLAN.weeks);
  box.api.answerReentry("quick");
  assert.equal(JSON.stringify(box.PLAN.weeks), before, "carrying on as planned changed the plan");
  assert.equal(box.calls.includes("recompute") && box.calls.filter((c: string) => c === "recompute").length, 1, "carrying on rebuilt the plan");
});

test("BLOCKER: one question at a time — the weekly review says nothing while this one is open", () => {
  // ⚠️ PLAN.md's OWN RE-BREAK: remove the suppression, and two questions render.
  const box = sandbox();
  assert.ok(box.api.weeklyReviewCard(), "the review renders nothing even with no other question — the case proves nothing");
  box.api.reentryCapture([ended(14)]);
  assert.ok(box.api.reentryCard(), "the coming-back card did not render");
  assert.equal(box.api.weeklyReviewCard(), "", "the weekly review asked its question beside the coming-back one");
  box.api.answerReentry("quick");
  assert.ok(box.api.weeklyReviewCard(), "the review stayed silent after the question was answered");
  // And it is the attention item: first in Today's cards.
  assert.match(decomment(fnBody("todayCards")), /return \[reentryCard\(\), trainFlagBanner\(\), weeklyReviewCard\(\)/);
});

test("BLOCKER: an answer is remembered, Undo asks again, and the question goes after the first week back", () => {
  const box = sandbox();
  box.api.reentryCapture([ended(14)]);
  box.api.answerReentry("balanced");
  assert.equal(rec(box).answer, "balanced");
  assert.equal(box.api.currentReentry(), null, "an answered question was asked again");
  assert.ok(box.toasts.includes("Week 1 is easier."), "the toast does not say what changed");
  box.undo();
  assert.equal(rec(box).answer, null, "Undo kept the answer");
  assert.ok(box.api.currentReentry(), "Undo did not put the question back");
  assert.deepEqual(JSON.parse(box.store["interun_adjust_v1"]).filter((r: any) => r.kind === "recovery"), [], "Undo left the easier week");
  // Declining is an answer too.
  box.api.answerReentry("quick");
  assert.equal(box.api.currentReentry(), null);
  // A week after the break ended, the question has gone whether it was answered or not.
  const late = sandbox();
  late.api.reentryCapture([ended(14)]);
  late.clock.today = addDays(TODAY, 7);
  assert.equal(late.api.currentReentry(), null, "the question was still asked more than a week after coming back");
});

test("BLOCKER: not asked while paused, nor when every gentler answer would do nothing", () => {
  const paused = sandbox();
  paused.api.reentryCapture([ended(14)]);
  paused.profile.startDateIso = addDays(TODAY, 10);
  assert.equal(paused.api.currentReentry(), null, "the question was asked during a pause");
  // Both weeks ahead already easier: there is nothing for Slowly or Balanced to do, so there is no question.
  const easy = sandbox([
    { id: "r1", kind: "recovery", mode: "recovery", from: MON(0), to: addDays(MON(0), 6), dropNonRun: false },
    { id: "r2", kind: "recovery", mode: "recovery", from: MON(1), to: addDays(MON(1), 6), dropNonRun: false },
  ]);
  easy.api.reentryCapture([ended(14)]);
  assert.equal(easy.api.currentReentry(), null, "three answers that all do the same thing were offered");
  // One week ahead already easier: Balanced would do nothing, so it is not offered, and Slowly eases the other.
  const one = sandbox([{ id: "r1", kind: "recovery", mode: "recovery", from: MON(0), to: addDays(MON(0), 6), dropNonRun: false }]);
  one.api.reentryCapture([ended(14)]);
  const q = one.api.currentReentry();
  assert.deepEqual(q.options.map((o: any) => o.id + ":" + o.weeks.map((w: any) => w.i).join("+")), ["slow:1", "quick:"]);
  assert.equal(q.options[0].s, "one easier week", "an answer easing one week says two");
  // A fortnight asks for one notch easier — and the first week back already IS easier, so carrying on is the
  // recommendation: the step the tier asks for is in the plan. (Missing answers step to the next quicker one.)
  assert.equal(q.options.find((o: any) => o.rec).id, "quick", "the recommendation asked for a week more than the tier does");
});

test("the buttons are wired, and the answers never touch the 'after time off' profile answer", () => {
  assert.match(decomment(SRC), /document\.querySelectorAll\("\[data-reentry\]"\)\.forEach\(\(b\) => \{ b\.onclick = \(\) => answerReentry\(b\.dataset\.reentry\); \}\);/,
    "the answers render and do nothing");
  const box = sandbox();
  box.api.reentryCapture([ended(21)]);
  const html = box.api.reentryCard();
  for (const id of ["slow", "balanced", "quick"]) assert.match(html, new RegExp('data-reentry="' + id + '"'));
  // ⚠️ returningFromBreak re-shapes the block's FIRST weeks: a brake that never came off while the block was
  // rebuilt from today, and nothing at all for a plan begun months ago now it is anchored. Never the tool here.
  assert.ok(!/returning/.test(decomment(fnBody("answerReentry"))), "an answer sets the 'after time off' profile flag");
});
